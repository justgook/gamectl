mod values;

use anyhow::{bail, Context as AnyhowContext, Result};
use serde::Serialize;
use std::collections::BTreeMap;
use std::sync::Mutex;
use values::{json_to_val, result_json, val_default_for_type};
use wasmtime::{Config, Engine, Store, StoreContextMut};
use wasmtime::component::{Component, Func, Instance, Linker, ResourceTable, Val};
use wasmtime::component::types::{ComponentInstance, ComponentItem};
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtx, WasiCtxView, WasiView};

pub struct Runtime {
    inner: Mutex<RuntimeInner>,
}

struct RuntimeInner {
    engine: Engine,
    linker: Linker<HostState>,
    store: Store<HostState>,
    next_component: usize,
    components: BTreeMap<String, ComponentRecord>,
    funcs: BTreeMap<String, ExportedFunc>,
    preopens: Vec<Preopen>,
}

pub struct HostState {
    wasi_ctx: WasiCtx,
    resource_table: ResourceTable,
}

impl WasiView for HostState {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.wasi_ctx,
            table: &mut self.resource_table,
        }
    }
}

#[derive(Clone)]
enum ExportedFunc {
    Wasm(Func),
    Native(NativeFunc),
}

#[derive(Clone)]
struct NativeFunc {
    kind: NativeFuncKind,
}

#[derive(Clone, Copy)]
enum NativeFuncKind {
    WasiFilesystemPreopensGetDirectories,
}

#[derive(Clone)]
struct Preopen {
    guest_path: String,
    descriptor: String,
}

#[derive(Clone)]
#[allow(dead_code)]
struct ComponentRecord {
    handle: String,
    path: String,
    imports: Vec<String>,
    exports: Vec<String>,
    instance: Instance,
}

#[derive(Debug, Serialize)]
pub struct ComponentHandle {
    pub handle: String,
    pub path: String,
    pub imports: Vec<String>,
    pub exports: Vec<String>,
}

impl Runtime {
    pub fn new() -> Result<Self> {
        let mut config = Config::new();
        config.wasm_component_model(true);

        let engine = Engine::new(&config)?;
        let mut linker = Linker::new(&engine);

        wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;
        add_gams_runtime_import(&mut linker)?;

        let cwd = std::env::current_dir().context("failed to resolve current working directory")?;
        let preopens = vec![Preopen {
            guest_path: "/".to_string(),
            descriptor: "wasi:filesystem/descriptor:1".to_string(),
        }];

        let mut wasi_builder = WasiCtx::builder();
        wasi_builder.inherit_stdio().inherit_args();
        wasi_builder
            .preopened_dir(&cwd, "/", DirPerms::all(), FilePerms::all())
            .map_err(|error| anyhow::anyhow!("failed to preopen {} as /: {error}", cwd.display()))?;
        let wasi_ctx = wasi_builder.build();
        let state = HostState {
            wasi_ctx,
            resource_table: ResourceTable::new(),
        };
        let store = Store::new(&engine, state);

        let mut inner = RuntimeInner {
            engine,
            linker,
            store,
            next_component: 1,
            components: BTreeMap::new(),
            funcs: BTreeMap::new(),
            preopens,
        };
        inner.register_native_builtins()?;

        Ok(Self {
            inner: Mutex::new(inner),
        })
    }

    pub fn add_plugins(&self, paths: Vec<String>) -> Result<Vec<ComponentHandle>, String> {
        let mut inner = self.inner.lock().map_err(|_| "runtime lock poisoned".to_string())?;
        inner.add_plugins(paths).map_err(|error| error.to_string())
    }

    pub fn invoke(&self, target: &str, args: serde_json::Value) -> Result<serde_json::Value, String> {
        let mut inner = self.inner.lock().map_err(|_| "runtime lock poisoned".to_string())?;
        inner.invoke(target, args).map_err(|error| error.to_string())
    }

    pub fn diagnostics(&self) -> Result<serde_json::Value, String> {
        let inner = self.inner.lock().map_err(|_| "runtime lock poisoned".to_string())?;
        Ok(serde_json::json!({
            "components": inner.components.values().map(|component| serde_json::json!({
                "handle": component.handle,
                "path": component.path,
                "imports": component.imports,
                "exports": component.exports,
            })).collect::<Vec<_>>(),
            "exports": inner.funcs.keys().cloned().collect::<Vec<_>>(),
        }))
    }
}

impl RuntimeInner {
    fn add_plugins(&mut self, paths: Vec<String>) -> Result<Vec<ComponentHandle>> {
        let mut out = Vec::new();

        for path in paths {
            let component = Component::from_file(&self.engine, &path)
                .map_err(|error| anyhow::anyhow!("loading component {path}: {error}"))?;
            let imports = component_imports(&self.engine, &component);
            let exports = component_exports(&self.engine, &component);

            let instance = self.linker
                .instantiate(&mut self.store, &component)
                .map_err(|error| anyhow::anyhow!("instantiating component {path}: {error}"))?;

            self.expose_instance_exports(&component, &instance)?;

            let handle = format!("component:{}", self.next_component);
            self.next_component += 1;

            let record = ComponentRecord {
                handle: handle.clone(),
                path: path.clone(),
                imports: imports.clone(),
                exports: exports.clone(),
                instance,
            };
            self.components.insert(handle.clone(), record);

            out.push(ComponentHandle {
                handle,
                path,
                imports,
                exports,
            });
        }

        Ok(out)
    }

    fn invoke(&mut self, target: &str, args: serde_json::Value) -> Result<serde_json::Value> {
        let func = self.resolve_func(target)?.clone();
        match func {
            ExportedFunc::Wasm(func) => self.invoke_wasm(target, func, args),
            ExportedFunc::Native(func) => self.invoke_native(target, func, args),
        }
    }

    fn invoke_wasm(&mut self, target: &str, func: Func, args: serde_json::Value) -> Result<serde_json::Value> {
        let ty = func.ty(&self.store);
        let params_ty = ty.params().map(|(_, ty)| ty).collect::<Vec<_>>();
        let args = args.as_array().context("runtime_invoke args must be a JSON array")?;
        if args.len() != params_ty.len() {
            bail!("{target} expects {} args, got {}", params_ty.len(), args.len());
        }

        let params = args.iter()
            .zip(params_ty.iter())
            .map(|(value, ty)| json_to_val(value, ty))
            .collect::<Result<Vec<_>>>()?;

        let mut results = ty.results()
            .map(|ty| val_default_for_type(&ty))
            .collect::<Result<Vec<_>>>()?;

        func.call(&mut self.store, &params, &mut results)
            .map_err(|error| anyhow::anyhow!("calling {target}: {error}"))?;

        result_json(results)
    }

    fn invoke_native(&mut self, target: &str, func: NativeFunc, args: serde_json::Value) -> Result<serde_json::Value> {
        let args = args.as_array().context("runtime_invoke args must be a JSON array")?;
        match func.kind {
            NativeFuncKind::WasiFilesystemPreopensGetDirectories => {
                if !args.is_empty() {
                    bail!("{target} expects 0 args, got {}", args.len());
                }
                Ok(serde_json::Value::Array(self.preopens.iter().map(|preopen| serde_json::json!([
                    {
                        "resource": preopen.descriptor,
                        "type": "wasi:filesystem/types@0.2.0/descriptor",
                    },
                    preopen.guest_path,
                ])).collect()))
            }
        }
    }

    fn register_native_builtins(&mut self) -> Result<()> {
        self.insert_unique_native_func(
            "wasi:filesystem/preopens@0.2.0::get-directories",
            NativeFuncKind::WasiFilesystemPreopensGetDirectories,
        )?;
        Ok(())
    }

    fn insert_unique_native_func(&mut self, key: &str, kind: NativeFuncKind) -> Result<()> {
        if self.funcs.contains_key(key) {
            bail!("duplicate provider for exported function `{key}`");
        }
        self.funcs.insert(key.to_string(), ExportedFunc::Native(NativeFunc { kind }));
        Ok(())
    }

    fn resolve_func(&self, target: &str) -> Result<&ExportedFunc> {
        if let Some(func) = self.funcs.get(target) {
            return Ok(func);
        }

        let Some((interface, function)) = target.split_once("::") else {
            bail!("target must be `package/interface::function`");
        };

        if interface.contains('@') {
            bail!("no exported function found for `{target}`");
        }

        let mut matches = self.funcs
            .iter()
            .filter(|(key, _)| invocation_key_matches_unversioned(key, interface, function))
            .collect::<Vec<_>>();

        match matches.len() {
            0 => bail!("no exported function found for `{target}`"),
            1 => Ok(matches.swap_remove(0).1),
            _ => {
                let options = matches.into_iter()
                    .map(|(key, _)| format!("  {key}"))
                    .collect::<Vec<_>>()
                    .join("\n");
                bail!("ambiguous invocation `{target}` matches:\n{options}");
            }
        }
    }

    fn expose_instance_exports(&mut self, component: &Component, instance: &Instance) -> Result<()> {
        let ty = component.component_type();
        let exports = ty.exports(&self.engine)
            .map(|(name, item)| (name.to_string(), item))
            .collect::<Vec<_>>();

        for (name, item) in exports {
            let name = name.as_str();
            match item {
                ComponentItem::ComponentInstance(iface_ty) => {
                    self.expose_interface(component, instance, name, iface_ty)?;
                }
                ComponentItem::ComponentFunc(_) => {
                    let idx = component.get_export_index(None, name)
                        .with_context(|| format!("missing export index for `{name}`"))?;
                    let func = instance.get_func(&mut self.store, &idx)
                        .with_context(|| format!("missing exported func `{name}`"))?;
                    insert_unique_func(&mut self.funcs, name.to_string(), func)?;
                }
                _ => {}
            }
        }

        Ok(())
    }

    fn expose_interface(
        &mut self,
        component: &Component,
        instance: &Instance,
        interface_name: &str,
        iface_ty: ComponentInstance,
    ) -> Result<()> {
        let iface_index = component.get_export_index(None, interface_name)
            .with_context(|| format!("missing interface export index `{interface_name}`"))?;

        let mut linker_iface = self.linker.instance(interface_name)?;

        for (func_name, item) in iface_ty.exports(&self.engine) {
            let ComponentItem::ComponentFunc(_) = item else { continue; };

            let func_index = component.get_export_index(Some(&iface_index), func_name)
                .with_context(|| format!("missing func index `{interface_name}.{func_name}`"))?;
            let exported_func = instance.get_func(&mut self.store, &func_index)
                .with_context(|| format!("missing exported func `{interface_name}.{func_name}`"))?;

            let forward = exported_func.clone();
            linker_iface.func_new(
                func_name,
                move |mut cx: StoreContextMut<'_, HostState>, _callee, params, results| {
                    forward.call(&mut cx, params, results)
                },
            )?;

            insert_unique_func(
                &mut self.funcs,
                format!("{interface_name}::{func_name}"),
                exported_func,
            )?;
        }

        Ok(())
    }
}

fn add_gams_runtime_import(linker: &mut Linker<HostState>) -> Result<()> {
    let mut iface = linker.instance("gams:runtime/runtime@1.0.0")?;
    iface.func_new(
        "call",
        |_cx: StoreContextMut<'_, HostState>, _callee, params, results| {
            let target = match params.get(0) {
                Some(Val::String(value)) => value.clone(),
                other => return Err(wasmtime::Error::msg(format!("gams:runtime/runtime.call target must be string, got {other:?}"))),
            };
            let args = match params.get(1) {
                Some(Val::String(value)) => value.clone(),
                other => return Err(wasmtime::Error::msg(format!("gams:runtime/runtime.call args must be string, got {other:?}"))),
            };
            let message = format!("frontend view bridge is not connected yet: target={target}, args={args}");
            results[0] = Val::Result(Err(Some(Box::new(Val::String(message)))));
            Ok(())
        },
    )?;
    Ok(())
}

fn insert_unique_func(funcs: &mut BTreeMap<String, ExportedFunc>, key: String, func: Func) -> Result<()> {
    if funcs.contains_key(&key) {
        bail!("duplicate provider for exported function `{key}`");
    }
    funcs.insert(key, ExportedFunc::Wasm(func));
    Ok(())
}

fn component_imports(engine: &Engine, component: &Component) -> Vec<String> {
    component.component_type()
        .imports(engine)
        .filter_map(|(name, item)| match item {
            ComponentItem::ComponentInstance(_) | ComponentItem::ComponentFunc(_) => Some(name.to_string()),
            _ => None,
        })
        .collect()
}

fn component_exports(engine: &Engine, component: &Component) -> Vec<String> {
    component.component_type()
        .exports(engine)
        .filter_map(|(name, item)| match item {
            ComponentItem::ComponentInstance(_) | ComponentItem::ComponentFunc(_) => Some(name.to_string()),
            _ => None,
        })
        .collect()
}

fn invocation_key_matches_unversioned(key: &str, interface: &str, function: &str) -> bool {
    let Some((candidate_interface, candidate_function)) = key.split_once("::") else {
        return false;
    };
    candidate_function == function && strip_interface_version(candidate_interface) == interface
}

fn strip_interface_version(interface: &str) -> &str {
    interface.rsplit_once('@').map_or(interface, |(base, _)| base)
}

#[cfg(test)]
mod tests {
    use super::Runtime;

    #[test]
    fn invokes_wasi_filesystem_preopens_builtin() {
        let runtime = Runtime::new().unwrap();
        let value = runtime.invoke("wasi:filesystem/preopens@0.2.0::get-directories", serde_json::json!([])).unwrap();
        assert_eq!(value.as_array().unwrap().len(), 1);
        assert_eq!(value[0][1], serde_json::json!("/"));
    }

    #[test]
    fn invokes_adder_component() {
        let path = "../../../build.nosync/plugins/adder.wasm";
        if !std::path::Path::new(path).exists() {
            eprintln!("skipping adder smoke test; build it with `make build.nosync/plugins/adder.wasm`");
            return;
        }

        let runtime = Runtime::new().unwrap();
        runtime.add_plugins(vec![path.to_string()]).unwrap();
        let value = runtime.invoke("docs:adder/add::add", serde_json::json!([2, 3])).unwrap();
        assert_eq!(value, serde_json::json!(5));
    }
}
