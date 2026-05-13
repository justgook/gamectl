mod values;

use anyhow::{bail, Context as AnyhowContext, Result};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use tauri::Emitter;
use values::{json_to_val, result_json, val_default_for_type};
use wasmtime::component::types::{ComponentInstance, ComponentItem};
use wasmtime::component::{Component, Func, Instance, Linker, ResourceTable, Val};
use wasmtime::{Config, Engine, Store, StoreContextMut};
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtx, WasiCtxView, WasiView};

#[derive(Clone, Debug)]
pub struct FsPreopen {
    pub host_path: PathBuf,
    pub guest_path: String,
}

#[derive(Clone)]
pub struct Runtime {
    inner: Arc<Mutex<RuntimeInner>>,
    view_bridge: ViewBridge,
}

struct RuntimeInner {
    engine: Engine,
    linker: Linker<HostState>,
    store: Store<HostState>,
    next_component: usize,
    root: PathBuf,
    preopens: Vec<FsPreopen>,
    components: BTreeMap<String, ComponentRecord>,
    funcs: BTreeMap<String, ExportedFunc>,
    linked_interfaces: BTreeSet<String>,
}

#[derive(Clone)]
struct ViewBridge {
    inner: Arc<Mutex<ViewBridgeInner>>,
}

struct ViewBridgeInner {
    app_handle: Option<tauri::AppHandle>,
    frontend_ready: bool,
    next_call: u64,
    pending: BTreeMap<String, mpsc::Sender<std::result::Result<String, String>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CallViewRequest {
    id: String,
    target: String,
    args: String,
}

pub struct HostState {
    wasi_ctx: WasiCtx,
    resource_table: ResourceTable,
    view_bridge: ViewBridge,
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

#[derive(Clone, Debug, Serialize)]
pub struct ComponentHandle {
    pub handle: String,
    pub path: String,
    pub imports: Vec<String>,
    pub exports: Vec<String>,
}

struct ComponentCandidate {
    path: String,
    resolved_path: PathBuf,
    component: Component,
    imports: Vec<String>,
    exports: Vec<String>,
}

#[derive(Clone)]
struct InterfaceProvider {
    interface: String,
    source: ProviderSource,
}

#[derive(Clone)]
enum ProviderSource {
    NativeRuntime,
    LoadedComponent { path: String },
    NewComponent { index: usize, path: String },
}

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
struct InterfaceFamily {
    package: String,
    interface: String,
    major: Option<u64>,
}

#[derive(Clone, Debug)]
struct InterfaceId<'a> {
    package: &'a str,
    interface: &'a str,
    version: Option<Version>,
}

#[derive(Clone, Debug)]
struct InvocationInterfaceId<'a> {
    package: &'a str,
    interface: &'a str,
    version: Option<Version>,
}

#[derive(Clone, Copy, Debug)]
struct Version {
    major: u64,
    minor: u64,
    #[allow(dead_code)]
    patch: u64,
}

impl ViewBridge {
    fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(ViewBridgeInner {
                app_handle: None,
                frontend_ready: false,
                next_call: 1,
                pending: BTreeMap::new(),
            })),
        }
    }

    fn attach_app_handle(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "view bridge lock poisoned".to_string())?;
        inner.app_handle = Some(app_handle);
        Ok(())
    }

    fn mark_frontend_ready(&self) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "view bridge lock poisoned".to_string())?;
        if inner.app_handle.is_none() {
            return Err("frontend view bridge app handle is not attached".to_string());
        }
        inner.frontend_ready = true;
        Ok(())
    }

    fn call_view(&self, target: String, args: String) -> std::result::Result<String, String> {
        let (id, app_handle, rx) = {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "view bridge lock poisoned".to_string())?;
            let app_handle = inner
                .app_handle
                .clone()
                .ok_or_else(|| "frontend view bridge is not attached".to_string())?;
            if !inner.frontend_ready {
                return Err("frontend view bridge listener is not ready".to_string());
            }
            let id = format!("view-call:{}", inner.next_call);
            inner.next_call += 1;
            let (tx, rx) = mpsc::channel();
            if inner.pending.insert(id.clone(), tx).is_some() {
                return Err(format!("duplicate view call id `{id}`"));
            }
            (id, app_handle, rx)
        };

        let request = CallViewRequest {
            id: id.clone(),
            target,
            args,
        };
        if let Err(error) = app_handle.emit("gams-runtime-call-view", request) {
            let _ = self.remove_pending(&id);
            return Err(format!("failed to emit call-view request `{id}`: {error}"));
        }

        rx.recv()
            .map_err(|_| format!("frontend view bridge dropped response channel for `{id}`"))?
    }

    fn respond(
        &self,
        id: String,
        result: std::result::Result<String, String>,
    ) -> std::result::Result<(), String> {
        let tx = self
            .remove_pending(&id)?
            .ok_or_else(|| format!("unknown call-view request `{id}`"))?;
        tx.send(result)
            .map_err(|_| format!("call-view request `{id}` is no longer waiting"))
    }

    fn remove_pending(
        &self,
        id: &str,
    ) -> std::result::Result<Option<mpsc::Sender<std::result::Result<String, String>>>, String>
    {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "view bridge lock poisoned".to_string())?;
        Ok(inner.pending.remove(id))
    }
}

impl Runtime {
    pub fn new_at(cwd: PathBuf, preopens: Vec<FsPreopen>) -> Result<Self> {
        let view_bridge = ViewBridge::new();
        Ok(Self {
            inner: Arc::new(Mutex::new(RuntimeInner::new(
                cwd,
                preopens,
                view_bridge.clone(),
            )?)),
            view_bridge,
        })
    }

    pub fn attach_app_handle(&self, app_handle: tauri::AppHandle) -> Result<(), String> {
        self.view_bridge.attach_app_handle(app_handle)
    }

    pub fn mark_call_view_ready(&self) -> Result<(), String> {
        self.view_bridge.mark_frontend_ready()
    }

    pub fn respond_to_call_view(
        &self,
        id: String,
        ok: Option<String>,
        err: Option<String>,
    ) -> Result<(), String> {
        match (ok, err) {
            (Some(value), None) => self.view_bridge.respond(id, Ok(value)),
            (None, Some(error)) => self.view_bridge.respond(id, Err(error)),
            (Some(_), Some(_)) => {
                Err("call-view response must not contain both ok and err".to_string())
            }
            (None, None) => Err("call-view response must contain ok or err".to_string()),
        }
    }

    pub fn add_plugins(
        &self,
        paths: Vec<String>,
        reload: bool,
    ) -> Result<Vec<ComponentHandle>, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        inner
            .add_plugins(paths, reload)
            .map_err(|error| error.to_string())
    }

    pub fn invoke(
        &self,
        target: &str,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        inner
            .invoke(target, args)
            .map_err(|error| error.to_string())
    }

    pub fn diagnostics(&self) -> Result<serde_json::Value, String> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
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
    fn new(cwd: PathBuf, preopens: Vec<FsPreopen>, view_bridge: ViewBridge) -> Result<Self> {
        let mut config = Config::new();
        config.wasm_component_model(true);

        let engine = Engine::new(&config)?;
        let mut linker = Linker::new(&engine);

        wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;
        add_gams_runtime_import(&mut linker, "gams:runtime/runtime@1.0.0")?;
        let mut wasi_builder = WasiCtx::builder();
        wasi_builder.inherit_stdio().inherit_args();
        let preopens = canonicalize_preopens(preopens)?;
        for preopen in &preopens {
            wasi_builder
                .preopened_dir(
                    &preopen.host_path,
                    &preopen.guest_path,
                    DirPerms::all(),
                    FilePerms::all(),
                )
                .map_err(|error| {
                    anyhow::anyhow!(
                        "failed to preopen {} as {}: {error}",
                        preopen.host_path.display(),
                        preopen.guest_path
                    )
                })?;
        }
        let wasi_ctx = wasi_builder.build();
        let state = HostState {
            wasi_ctx,
            resource_table: ResourceTable::new(),
            view_bridge,
        };
        let store = Store::new(&engine, state);

        Ok(RuntimeInner {
            engine,
            linker,
            store,
            next_component: 1,
            root: cwd,
            preopens,
            components: BTreeMap::new(),
            funcs: BTreeMap::new(),
            linked_interfaces: BTreeSet::from(["gams:runtime/runtime@1.0.0".to_string()]),
        })
    }

    fn add_plugins(&mut self, paths: Vec<String>, reload: bool) -> Result<Vec<ComponentHandle>> {
        if reload {
            return self.reload_plugins(paths);
        }

        let requests = paths
            .iter()
            .map(|path| resolve_component_path(&self.root, &self.preopens, path))
            .collect::<Result<Vec<_>>>()?;

        let mut candidates = Vec::new();
        let mut candidate_by_path = BTreeMap::new();
        for (path, resolved_path) in paths.iter().zip(requests.iter()) {
            if self.component_by_path(resolved_path).is_some() {
                continue;
            }
            if candidate_by_path.contains_key(resolved_path) {
                continue;
            }

            let component = Component::from_file(&self.engine, resolved_path).map_err(|error| {
                anyhow::anyhow!(
                    "loading component {path} from {}: {error}",
                    resolved_path.display()
                )
            })?;
            let imports = component_imports(&self.engine, &component);
            let exports = component_exports(&self.engine, &component);
            let index = candidates.len();
            candidate_by_path.insert(resolved_path.clone(), index);
            candidates.push(ComponentCandidate {
                path: path.clone(),
                resolved_path: resolved_path.clone(),
                component,
                imports,
                exports,
            });
        }

        let order = self.topo_sort_candidates(&candidates)?;
        let mut loaded_by_path = BTreeMap::new();
        for index in order {
            let handle = self.instantiate_candidate(&candidates[index])?;
            loaded_by_path.insert(candidates[index].resolved_path.clone(), handle);
        }

        requests
            .iter()
            .map(|path| {
                if let Some(existing) = self.component_by_path(path) {
                    return Ok(existing);
                }
                loaded_by_path
                    .get(path)
                    .cloned()
                    .with_context(|| format!("component handle not found for {}", path.display()))
            })
            .collect()
    }

    fn reload_plugins(&mut self, paths: Vec<String>) -> Result<Vec<ComponentHandle>> {
        let root = self.root.clone();
        let reload_paths = paths
            .iter()
            .map(|path| resolve_component_path(&root, &self.preopens, path))
            .collect::<Result<Vec<_>>>()?;

        let mut all_paths = self
            .components
            .values()
            .map(|component| PathBuf::from(&component.path))
            .collect::<Vec<_>>();
        for reload_path in &reload_paths {
            if !all_paths.iter().any(|path| path == reload_path) {
                all_paths.push(reload_path.clone());
            }
        }

        let view_bridge = self.store.data().view_bridge.clone();
        let mut rebuilt = RuntimeInner::new(root, self.preopens.clone(), view_bridge)?;
        let handles = rebuilt.add_plugins(
            all_paths
                .iter()
                .map(|path| path.display().to_string())
                .collect::<Vec<_>>(),
            false,
        )?;
        let requested = reload_paths
            .iter()
            .map(|path| {
                handles
                    .iter()
                    .find(|handle| PathBuf::from(&handle.path) == *path)
                    .cloned()
                    .with_context(|| {
                        format!("reloaded component handle not found for {}", path.display())
                    })
            })
            .collect::<Result<Vec<_>>>()?;
        *self = rebuilt;
        Ok(requested)
    }

    fn component_by_path(&self, path: &Path) -> Option<ComponentHandle> {
        self.components
            .values()
            .find(|component| PathBuf::from(&component.path) == path)
            .map(|component| ComponentHandle {
                handle: component.handle.clone(),
                path: component.path.clone(),
                imports: component.imports.clone(),
                exports: component.exports.clone(),
            })
    }

    fn topo_sort_candidates(&self, candidates: &[ComponentCandidate]) -> Result<Vec<usize>> {
        let providers = self.provider_table(candidates)?;
        let mut deps = BTreeMap::<usize, BTreeSet<usize>>::new();

        for (index, candidate) in candidates.iter().enumerate() {
            let mut candidate_deps = BTreeSet::new();
            for import in &candidate.imports {
                if is_wasi_interface(import) {
                    continue;
                }
                let Some(provider) = resolve_provider(&providers, import)? else {
                    bail!(
                        "missing provider for import `{import}` required by `{}`",
                        candidate.resolved_path.display()
                    );
                };
                if let ProviderSource::NewComponent {
                    index: provider_index,
                    ..
                } = provider.source
                {
                    if provider_index != index {
                        candidate_deps.insert(provider_index);
                    }
                }
            }
            deps.insert(index, candidate_deps);
        }

        let mut done = BTreeSet::new();
        let mut order = Vec::new();
        loop {
            let mut progressed = false;
            for index in 0..candidates.len() {
                if done.contains(&index) {
                    continue;
                }
                if deps[&index].iter().all(|dep| done.contains(dep)) {
                    done.insert(index);
                    order.push(index);
                    progressed = true;
                }
            }

            if order.len() == candidates.len() {
                return Ok(order);
            }
            if !progressed {
                let remaining = (0..candidates.len())
                    .filter(|index| !done.contains(index))
                    .map(|index| format!("  {}", candidates[index].resolved_path.display()))
                    .collect::<Vec<_>>()
                    .join("\n");
                bail!("cycle in component imports/exports:\n{remaining}");
            }
        }
    }

    fn provider_table(
        &self,
        candidates: &[ComponentCandidate],
    ) -> Result<BTreeMap<InterfaceFamily, InterfaceProvider>> {
        let mut providers = BTreeMap::new();
        insert_provider(
            &mut providers,
            "gams:runtime/runtime@1.0.0",
            ProviderSource::NativeRuntime,
        )?;

        for component in self.components.values() {
            for export in &component.exports {
                insert_provider(
                    &mut providers,
                    export,
                    ProviderSource::LoadedComponent {
                        path: component.path.clone(),
                    },
                )?;
            }
        }

        for (index, candidate) in candidates.iter().enumerate() {
            for export in &candidate.exports {
                insert_provider(
                    &mut providers,
                    export,
                    ProviderSource::NewComponent {
                        index,
                        path: candidate.resolved_path.display().to_string(),
                    },
                )?;
            }
        }

        Ok(providers)
    }

    fn instantiate_candidate(&mut self, candidate: &ComponentCandidate) -> Result<ComponentHandle> {
        let providers = self.provider_table(&[])?;
        for import in &candidate.imports {
            if is_wasi_interface(import) {
                continue;
            }
            let Some(provider) = resolve_provider(&providers, import)? else {
                bail!(
                    "missing provider for import `{import}` required by `{}`",
                    candidate.resolved_path.display()
                );
            };
            match provider.source {
                ProviderSource::NativeRuntime => self.ensure_gams_runtime_import(import)?,
                ProviderSource::LoadedComponent { .. } | ProviderSource::NewComponent { .. } => {
                    self.ensure_interface_alias(import, &provider.interface)?;
                }
            }
        }

        let instance = self
            .linker
            .instantiate(&mut self.store, &candidate.component)
            .map_err(|error| {
                anyhow::anyhow!("instantiating component {}: {error}", candidate.path)
            })?;

        self.expose_instance_exports(&candidate.component, &instance)?;

        let handle = format!("component:{}", self.next_component);
        self.next_component += 1;

        let path = candidate.resolved_path.display().to_string();
        let record = ComponentRecord {
            handle: handle.clone(),
            path: path.clone(),
            imports: candidate.imports.clone(),
            exports: candidate.exports.clone(),
            instance,
        };
        self.components.insert(handle.clone(), record);

        Ok(ComponentHandle {
            handle,
            path,
            imports: candidate.imports.clone(),
            exports: candidate.exports.clone(),
        })
    }

    fn invoke(&mut self, target: &str, args: serde_json::Value) -> Result<serde_json::Value> {
        let func = self.resolve_func(target)?.clone();
        match func {
            ExportedFunc::Wasm(func) => self.invoke_wasm(target, func, args),
        }
    }

    fn invoke_wasm(
        &mut self,
        target: &str,
        func: Func,
        args: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let ty = func.ty(&self.store);
        let params_ty = ty.params().map(|(_, ty)| ty).collect::<Vec<_>>();
        let args = args
            .as_array()
            .context("runtime_invoke args must be a JSON array")?;
        if args.len() != params_ty.len() {
            bail!(
                "{target} expects {} args, got {}",
                params_ty.len(),
                args.len()
            );
        }

        let params = args
            .iter()
            .zip(params_ty.iter())
            .map(|(value, ty)| json_to_val(value, ty))
            .collect::<Result<Vec<_>>>()?;

        let mut results = ty
            .results()
            .map(|ty| val_default_for_type(&ty))
            .collect::<Result<Vec<_>>>()?;

        func.call(&mut self.store, &params, &mut results)
            .map_err(|error| anyhow::anyhow!("calling {target}: {error}"))?;

        result_json(results)
    }

    fn resolve_func(&self, target: &str) -> Result<&ExportedFunc> {
        if let Some(func) = self.funcs.get(target) {
            return Ok(func);
        }

        let Some((interface, function)) = target.split_once("::") else {
            bail!("target must be `package/interface::function`");
        };
        let requested = parse_invocation_interface_id(interface)?;

        let mut matches = self
            .funcs
            .iter()
            .filter(|(key, _)| invocation_key_matches_request(key, &requested, function))
            .collect::<Vec<_>>();

        match matches.len() {
            0 => bail!("no exported function found for `{target}`"),
            1 => Ok(matches.swap_remove(0).1),
            _ => {
                let options = matches
                    .into_iter()
                    .map(|(key, _)| format!("  {key}"))
                    .collect::<Vec<_>>()
                    .join("\n");
                bail!("ambiguous invocation `{target}` matches:\n{options}");
            }
        }
    }

    fn ensure_gams_runtime_import(&mut self, interface_name: &str) -> Result<()> {
        if self.linked_interfaces.contains(interface_name) {
            return Ok(());
        }
        let parsed = parse_interface_id(interface_name)
            .with_context(|| format!("invalid runtime import interface `{interface_name}`"))?
            .with_context(|| format!("runtime import `{interface_name}` is not an interface id"))?;
        if parsed.package != "runtime" || parsed.interface != "runtime" {
            bail!("native runtime provider cannot satisfy `{interface_name}`");
        }
        let Some(version) = parsed.version else {
            bail!("native runtime import `{interface_name}` must be versioned");
        };
        if version.major != 1 {
            bail!(
                "native runtime import `{interface_name}` requires unsupported major version {}",
                version.major
            );
        }
        add_gams_runtime_import(&mut self.linker, interface_name)?;
        self.linked_interfaces.insert(interface_name.to_string());
        Ok(())
    }

    fn ensure_interface_alias(
        &mut self,
        import_interface: &str,
        provider_interface: &str,
    ) -> Result<()> {
        if import_interface == provider_interface
            || self.linked_interfaces.contains(import_interface)
        {
            return Ok(());
        }

        let prefix = format!("{provider_interface}::");
        let exports = self
            .funcs
            .iter()
            .filter_map(|(key, func)| {
                key.strip_prefix(&prefix)
                    .map(|func_name| (func_name.to_string(), func.clone()))
            })
            .collect::<Vec<_>>();

        if exports.is_empty() {
            bail!("cannot alias `{import_interface}` to `{provider_interface}` because provider exports no functions yet");
        }

        let mut linker_iface = self.linker.instance(import_interface)?;
        for (func_name, func) in exports {
            let ExportedFunc::Wasm(forward) = func;
            linker_iface.func_new(
                &func_name,
                move |mut cx: StoreContextMut<'_, HostState>, _callee, params, results| {
                    forward.call(&mut cx, params, results)
                },
            )?;
        }
        self.linked_interfaces.insert(import_interface.to_string());
        Ok(())
    }

    fn expose_instance_exports(
        &mut self,
        component: &Component,
        instance: &Instance,
    ) -> Result<()> {
        let ty = component.component_type();
        let exports = ty
            .exports(&self.engine)
            .map(|(name, item)| (name.to_string(), item))
            .collect::<Vec<_>>();

        for (name, item) in exports {
            let name = name.as_str();
            match item {
                ComponentItem::ComponentInstance(iface_ty) => {
                    self.expose_interface(component, instance, name, iface_ty)?;
                }
                ComponentItem::ComponentFunc(_) => {
                    let idx = component
                        .get_export_index(None, name)
                        .with_context(|| format!("missing export index for `{name}`"))?;
                    let func = instance
                        .get_func(&mut self.store, &idx)
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
        let iface_index = component
            .get_export_index(None, interface_name)
            .with_context(|| format!("missing interface export index `{interface_name}`"))?;

        let mut linker_iface = self.linker.instance(interface_name)?;

        for (func_name, item) in iface_ty.exports(&self.engine) {
            let ComponentItem::ComponentFunc(_) = item else {
                continue;
            };

            let func_index = component
                .get_export_index(Some(&iface_index), func_name)
                .with_context(|| format!("missing func index `{interface_name}.{func_name}`"))?;
            let exported_func = instance
                .get_func(&mut self.store, &func_index)
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

        self.linked_interfaces.insert(interface_name.to_string());
        Ok(())
    }
}

fn add_gams_runtime_import(linker: &mut Linker<HostState>, interface_name: &str) -> Result<()> {
    let mut iface = linker.instance(interface_name)?;
    iface.func_new(
        "call",
        |_cx: StoreContextMut<'_, HostState>, _callee, params, results| {
            let target = match params.get(0) {
                Some(Val::String(value)) => value.clone(),
                other => {
                    return Err(wasmtime::Error::msg(format!(
                        "gams:runtime/runtime.call target must be string, got {other:?}"
                    )))
                }
            };
            let args = match params.get(1) {
                Some(Val::String(value)) => value.clone(),
                other => {
                    return Err(wasmtime::Error::msg(format!(
                        "gams:runtime/runtime.call args must be string, got {other:?}"
                    )))
                }
            };
            let bridge = _cx.data().view_bridge.clone();
            match bridge.call_view(target, args) {
                Ok(value) => results[0] = Val::Result(Ok(Some(Box::new(Val::String(value))))),
                Err(error) => results[0] = Val::Result(Err(Some(Box::new(Val::String(error))))),
            }
            Ok(())
        },
    )?;
    Ok(())
}

fn insert_unique_func(
    funcs: &mut BTreeMap<String, ExportedFunc>,
    key: String,
    func: Func,
) -> Result<()> {
    if funcs.contains_key(&key) {
        bail!("duplicate provider for exported function `{key}`");
    }
    funcs.insert(key, ExportedFunc::Wasm(func));
    Ok(())
}

fn insert_provider(
    providers: &mut BTreeMap<InterfaceFamily, InterfaceProvider>,
    interface: &str,
    source: ProviderSource,
) -> Result<()> {
    let Some(id) = parse_interface_id(interface)? else {
        return Ok(());
    };
    let family = id.family();
    let provider = InterfaceProvider {
        interface: interface.to_string(),
        source,
    };
    if let Some(existing) = providers.insert(family.clone(), provider.clone()) {
        bail!(
            "duplicate provider for interface family `{}`: `{}` from {}, `{}` from {}",
            family.display(),
            existing.interface,
            existing.source.display(),
            provider.interface,
            provider.source.display(),
        );
    }
    Ok(())
}

fn resolve_provider<'a>(
    providers: &'a BTreeMap<InterfaceFamily, InterfaceProvider>,
    import: &str,
) -> Result<Option<&'a InterfaceProvider>> {
    let Some(import_id) = parse_interface_id(import)? else {
        return Ok(None);
    };
    let Some(provider) = providers.get(&import_id.family()) else {
        return Ok(None);
    };
    let Some(provider_id) = parse_interface_id(&provider.interface)? else {
        bail!("provider `{}` is not an interface id", provider.interface);
    };
    if !provider_id.satisfies(&import_id) {
        bail!(
            "provider `{}` from {} is not compatible with import `{}`",
            provider.interface,
            provider.source.display(),
            import,
        );
    }
    Ok(Some(provider))
}

impl ProviderSource {
    fn display(&self) -> String {
        match self {
            ProviderSource::NativeRuntime => "native runtime".to_string(),
            ProviderSource::LoadedComponent { path } => format!("loaded component {path}"),
            ProviderSource::NewComponent { path, .. } => format!("requested component {path}"),
        }
    }
}

impl InterfaceFamily {
    fn display(&self) -> String {
        match self.major {
            Some(major) => format!("{}/{}@{}", self.package, self.interface, major),
            None => format!("{}/{}", self.package, self.interface),
        }
    }
}

impl<'a> InterfaceId<'a> {
    fn family(&self) -> InterfaceFamily {
        InterfaceFamily {
            package: self.package.to_string(),
            interface: self.interface.to_string(),
            major: self.version.map(|version| version.major),
        }
    }

    fn satisfies(&self, requested: &InterfaceId<'_>) -> bool {
        if self.package != requested.package || self.interface != requested.interface {
            return false;
        }
        version_satisfies(self.version, requested.version)
    }
}

impl<'a> InvocationInterfaceId<'a> {
    fn matches_provider(&self, provider: &InterfaceId<'_>) -> bool {
        if self.package != provider.package || self.interface != provider.interface {
            return false;
        }
        version_satisfies(provider.version, self.version)
    }
}

fn version_satisfies(provider: Option<Version>, requested: Option<Version>) -> bool {
    match (provider, requested) {
        (Some(provider), Some(requested)) => {
            provider.major == requested.major && provider.minor >= requested.minor
        }
        (None, None) => true,
        (Some(_), None) => true,
        (None, Some(_)) => false,
    }
}

fn parse_interface_id(value: &str) -> Result<Option<InterfaceId<'_>>> {
    let interface = value
        .split_once("::")
        .map_or(value, |(interface, _)| interface);
    let Some((namespace_and_package, interface_and_version)) = interface.split_once('/') else {
        return Ok(None);
    };
    let Some((_namespace, package)) = namespace_and_package.split_once(':') else {
        return Ok(None);
    };
    if package.is_empty() {
        bail!("interface id `{value}` has empty package");
    }
    let (interface, version) = match interface_and_version.rsplit_once('@') {
        Some((interface, version)) => (interface, Some(parse_version(version)?)),
        None => (interface_and_version, None),
    };
    if interface.is_empty() {
        bail!("interface id `{value}` has empty interface");
    }
    Ok(Some(InterfaceId {
        package,
        interface,
        version,
    }))
}

fn parse_invocation_interface_id(value: &str) -> Result<InvocationInterfaceId<'_>> {
    let interface = value
        .split_once("::")
        .map_or(value, |(interface, _)| interface);
    let (package, interface) = interface
        .split_once('/')
        .with_context(|| format!("invocation interface `{value}` must be `package/interface`"))?;
    if package.contains(':') {
        bail!(
            "invocation interface `{value}` must omit namespace; use `package/interface::function`"
        );
    }
    if interface.contains('@') {
        bail!(
            "invocation interface `{value}` must omit version; use `package/interface::function`"
        );
    }
    if package.is_empty() {
        bail!("invocation interface `{value}` has empty package");
    }
    if interface.is_empty() {
        bail!("invocation interface `{value}` has empty interface");
    }
    Ok(InvocationInterfaceId {
        package,
        interface,
        version: None,
    })
}

fn parse_version(value: &str) -> Result<Version> {
    let mut parts = value.split('.');
    let major = parts
        .next()
        .context("version must contain major")?
        .parse::<u64>()
        .with_context(|| format!("invalid major version `{value}`"))?;
    let minor = parts
        .next()
        .unwrap_or("0")
        .parse::<u64>()
        .with_context(|| format!("invalid minor version `{value}`"))?;
    let patch = parts
        .next()
        .unwrap_or("0")
        .parse::<u64>()
        .with_context(|| format!("invalid patch version `{value}`"))?;
    if parts.next().is_some() {
        bail!("version `{value}` has too many parts");
    }
    Ok(Version {
        major,
        minor,
        patch,
    })
}

fn is_wasi_interface(interface: &str) -> bool {
    interface.starts_with("wasi:")
}

fn component_imports(engine: &Engine, component: &Component) -> Vec<String> {
    component
        .component_type()
        .imports(engine)
        .filter_map(|(name, item)| match item {
            ComponentItem::ComponentInstance(_) | ComponentItem::ComponentFunc(_) => {
                Some(name.to_string())
            }
            _ => None,
        })
        .collect()
}

fn component_exports(engine: &Engine, component: &Component) -> Vec<String> {
    component
        .component_type()
        .exports(engine)
        .filter_map(|(name, item)| match item {
            ComponentItem::ComponentInstance(_) | ComponentItem::ComponentFunc(_) => {
                Some(name.to_string())
            }
            _ => None,
        })
        .collect()
}

fn invocation_key_matches_request(
    key: &str,
    requested: &InvocationInterfaceId<'_>,
    function: &str,
) -> bool {
    let Some((candidate_interface, candidate_function)) = key.split_once("::") else {
        return false;
    };
    if candidate_function != function {
        return false;
    }
    let Ok(Some(candidate)) = parse_interface_id(candidate_interface) else {
        return false;
    };
    requested.matches_provider(&candidate)
}

fn safe_join(base: &Path, relative: &str) -> Result<PathBuf> {
    if relative.starts_with('/') || relative.starts_with('\\') {
        bail!("WASI paths must be relative to their descriptor: `{relative}`");
    }
    let mut out = base.to_path_buf();
    for part in relative.replace('\\', "/").split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            bail!("WASI path escapes are not permitted: `{relative}`");
        }
        out.push(part);
    }
    Ok(out)
}

fn canonicalize_preopens(preopens: Vec<FsPreopen>) -> Result<Vec<FsPreopen>> {
    preopens
        .into_iter()
        .map(|preopen| {
            let host_path = preopen.host_path.canonicalize().with_context(|| {
                format!(
                    "failed to canonicalize preopen {} as {}",
                    preopen.host_path.display(),
                    preopen.guest_path
                )
            })?;
            Ok(FsPreopen {
                host_path,
                guest_path: preopen.guest_path,
            })
        })
        .collect()
}

fn path_is_preopened(path: &Path, preopens: &[FsPreopen]) -> bool {
    preopens
        .iter()
        .any(|preopen| path.starts_with(&preopen.host_path))
}

fn resolve_component_path(root: &Path, preopens: &[FsPreopen], path: &str) -> Result<PathBuf> {
    let raw = PathBuf::from(path);
    let candidate = if raw.is_absolute() {
        raw
    } else {
        safe_join(root, path)?
    };

    if !candidate.exists() {
        if PathBuf::from(path).is_absolute() {
            bail!("absolute component path not found: {path}");
        }
        bail!(
            "component path not found relative to runtime root {}: {path}",
            root.display()
        );
    }

    let resolved = candidate.canonicalize().with_context(|| {
        format!(
            "failed to canonicalize component path {}",
            candidate.display()
        )
    })?;
    if !path_is_preopened(&resolved, preopens) {
        bail!(
            "component path is not under a configured filesystem preopen: {}",
            resolved.display()
        );
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::{FsPreopen, Runtime};
    use std::path::{Path, PathBuf};

    fn test_preopens(root: &Path) -> Vec<FsPreopen> {
        let mut preopens = vec![
            FsPreopen {
                host_path: root.to_path_buf(),
                guest_path: ".".to_string(),
            },
            FsPreopen {
                host_path: root.to_path_buf(),
                guest_path: root.to_string_lossy().into_owned(),
            },
        ];
        for entry in std::fs::read_dir(root).unwrap() {
            let entry = entry.unwrap();
            if !entry.file_type().unwrap().is_symlink() {
                continue;
            }
            let target = entry.path().canonicalize().unwrap();
            if target.is_dir() {
                preopens.push(FsPreopen {
                    host_path: target,
                    guest_path: entry.file_name().to_string_lossy().into_owned(),
                });
            }
        }
        preopens
    }

    #[test]
    fn invokes_adder_component() {
        let path = "../../../build.nosync/plugins/adder.wasm";
        if !std::path::Path::new(path).exists() {
            eprintln!(
                "skipping adder smoke test; build it with `make build.nosync/plugins/adder.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../..").canonicalize().unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        let path = PathBuf::from(path).canonicalize().unwrap();
        runtime
            .add_plugins(vec![path.display().to_string()], false)
            .unwrap();
        let value = runtime
            .invoke("adder/add::add", serde_json::json!([2, 3]))
            .unwrap();
        assert_eq!(value, serde_json::json!(5));
    }

    #[test]
    fn loads_adder_component_from_runtime_relative_plugins_path() {
        let path = "../../../build.nosync/plugins/adder.wasm";
        if !std::path::Path::new(path).exists() {
            eprintln!(
                "skipping adder smoke test; build it with `make build.nosync/plugins/adder.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()], false)
            .unwrap();
        let value = runtime
            .invoke("adder/add::add", serde_json::json!([2, 3]))
            .unwrap();
        assert_eq!(value, serde_json::json!(5));
    }

    #[test]
    fn add_plugins_skips_already_loaded_component_by_default() {
        let path = "../../../build.nosync/plugins/adder.wasm";
        if !std::path::Path::new(path).exists() {
            eprintln!(
                "skipping adder smoke test; build it with `make build.nosync/plugins/adder.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        let first = runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()], false)
            .unwrap();
        let second = runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()], false)
            .unwrap();
        assert_eq!(first[0].handle, second[0].handle);
        assert_eq!(first[0].path, second[0].path);
    }

    #[test]
    fn add_plugins_reload_rebuilds_component_registry() {
        let path = "../../../build.nosync/plugins/adder.wasm";
        if !std::path::Path::new(path).exists() {
            eprintln!(
                "skipping adder smoke test; build it with `make build.nosync/plugins/adder.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        let first = runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()], false)
            .unwrap();
        let second = runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()], true)
            .unwrap();
        assert_eq!(first[0].path, second[0].path);
        let value = runtime
            .invoke("adder/add::add", serde_json::json!([2, 3]))
            .unwrap();
        assert_eq!(value, serde_json::json!(5));
    }

    #[test]
    fn calculator_calls_adder_component() {
        let adder = "../../../build.nosync/plugins/adder.wasm";
        let calculator = "../../../build.nosync/plugins/calculator.wasm";
        if !std::path::Path::new(adder).exists() || !std::path::Path::new(calculator).exists() {
            eprintln!(
                "skipping calculator smoke test; build it with `make build.nosync/plugins/adder.wasm build.nosync/plugins/calculator.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(
                vec![
                    "plugins/adder.wasm".to_string(),
                    "plugins/calculator.wasm".to_string(),
                ],
                false,
            )
            .unwrap();
        let value = runtime
            .invoke(
                "calculator/calculate::eval-expression",
                serde_json::json!(["add", 2, 3]),
            )
            .unwrap();
        assert_eq!(value, serde_json::json!(5));
    }

    #[test]
    fn add_plugins_topo_sorts_reverse_dependency_order() {
        let adder = "../../../build.nosync/plugins/adder.wasm";
        let calculator = "../../../build.nosync/plugins/calculator.wasm";
        if !std::path::Path::new(adder).exists() || !std::path::Path::new(calculator).exists() {
            eprintln!(
                "skipping calculator topo test; build it with `make build.nosync/plugins/adder.wasm build.nosync/plugins/calculator.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        let handles = runtime
            .add_plugins(
                vec![
                    "plugins/calculator.wasm".to_string(),
                    "plugins/adder.wasm".to_string(),
                ],
                false,
            )
            .unwrap();
        assert!(handles[0].path.ends_with("calculator.wasm"));
        assert!(handles[1].path.ends_with("adder.wasm"));

        let value = runtime
            .invoke(
                "calculator/calculate::eval-expression",
                serde_json::json!(["add", 2, 3]),
            )
            .unwrap();
        assert_eq!(value, serde_json::json!(5));
    }

    #[test]
    fn add_plugins_uses_already_loaded_dependency() {
        let adder = "../../../build.nosync/plugins/adder.wasm";
        let calculator = "../../../build.nosync/plugins/calculator.wasm";
        if !std::path::Path::new(adder).exists() || !std::path::Path::new(calculator).exists() {
            eprintln!(
                "skipping loaded dependency test; build it with `make build.nosync/plugins/adder.wasm build.nosync/plugins/calculator.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()], false)
            .unwrap();
        runtime
            .add_plugins(vec!["plugins/calculator.wasm".to_string()], false)
            .unwrap();
        let value = runtime
            .invoke(
                "calculator/calculate::eval-expression",
                serde_json::json!(["add", 2, 3]),
            )
            .unwrap();
        assert_eq!(value, serde_json::json!(5));
    }

    #[test]
    fn add_plugins_reports_missing_provider() {
        let calculator = "../../../build.nosync/plugins/calculator.wasm";
        if !std::path::Path::new(calculator).exists() {
            eprintln!(
                "skipping missing provider test; build it with `make build.nosync/plugins/calculator.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        let error = runtime
            .add_plugins(vec!["plugins/calculator.wasm".to_string()], false)
            .unwrap_err();
        assert!(error.contains("missing provider for import"), "{error}");
    }

    #[test]
    fn add_plugins_rejects_duplicate_interface_family() {
        let adder = PathBuf::from("../../../build.nosync/plugins/adder.wasm");
        if !adder.exists() {
            eprintln!(
                "skipping duplicate provider test; build it with `make build.nosync/plugins/adder.wasm`"
            );
            return;
        }

        let dir = tempfile::tempdir().unwrap();
        std::fs::copy(&adder, dir.path().join("adder-a.wasm")).unwrap();
        std::fs::copy(&adder, dir.path().join("adder-b.wasm")).unwrap();
        let runtime = Runtime::new_at(dir.path().to_path_buf(), test_preopens(dir.path())).unwrap();
        let error = runtime
            .add_plugins(
                vec!["adder-a.wasm".to_string(), "adder-b.wasm".to_string()],
                false,
            )
            .unwrap_err();
        assert!(
            error.contains("duplicate provider for interface family"),
            "{error}"
        );
    }

    #[test]
    fn invoke_rejects_full_or_versioned_interface_targets() {
        let path = "../../../build.nosync/plugins/adder.wasm";
        if !std::path::Path::new(path).exists() {
            eprintln!(
                "skipping invocation target validation test; build it with `make build.nosync/plugins/adder.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()], false)
            .unwrap();

        let full_name_error = runtime
            .invoke("docs:adder/add::add", serde_json::json!([2, 3]))
            .unwrap_err();
        assert!(
            full_name_error.contains("must omit namespace"),
            "{full_name_error}"
        );

        let version_error = runtime
            .invoke("adder/add@1.0.0::add", serde_json::json!([2, 3]))
            .unwrap_err();
        assert!(
            version_error.contains("must omit version"),
            "{version_error}"
        );
    }

    #[test]
    fn fs_proxy_reads_and_lists_through_wasi() {
        let fs = "../../../build.nosync/plugins/fs.wasm";
        if !std::path::Path::new(fs).exists() {
            eprintln!(
                "skipping fs proxy smoke test; build it with `make build.nosync/plugins/fs.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/fs.wasm".to_string()], false)
            .unwrap();

        let text = runtime
            .invoke("fs/fs::read-text", serde_json::json!(["gams.json"]))
            .unwrap();
        assert!(
            text["ok"].as_str().unwrap_or("").contains("\"fs\""),
            "{text}"
        );

        let absolute_gams_json = root.join("gams.json").to_string_lossy().into_owned();
        let absolute_text = runtime
            .invoke("fs/fs::read-text", serde_json::json!([absolute_gams_json]))
            .unwrap();
        assert!(absolute_text["ok"].as_str().unwrap().contains("\"fs\""));

        let entries = runtime
            .invoke("fs/fs::list", serde_json::json!([""]))
            .unwrap();
        let entries = entries["ok"].as_array().unwrap();
        assert!(entries.iter().any(|entry| entry["name"] == "gams.json"));

        let dot_entries = runtime
            .invoke("fs/fs::list", serde_json::json!(["."]))
            .unwrap();
        let dot_entries = dot_entries["ok"].as_array().unwrap();
        assert!(dot_entries.iter().any(|entry| entry["name"] == "gams.json"));

        let plugin_bytes = runtime
            .invoke("fs/fs::read-file", serde_json::json!(["plugins/fs.wasm"]))
            .unwrap();
        assert!(
            plugin_bytes["ok"]
                .as_array()
                .is_some_and(|bytes| !bytes.is_empty()),
            "{plugin_bytes}"
        );
    }

    #[test]
    fn benchmark_exercises_json_wit_conversion() {
        let benchmark = "../../../build.nosync/plugins/benchmark.wasm";
        if !std::path::Path::new(benchmark).exists() {
            eprintln!(
                "skipping benchmark conversion test; build it with `make build.nosync/plugins/benchmark.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/benchmark.wasm".to_string()], false)
            .unwrap();

        let cases = [
            (
                "benchmark/benchmark::echo-bool",
                serde_json::json!([true]),
                serde_json::json!(true),
            ),
            (
                "benchmark/benchmark::echo-s8",
                serde_json::json!([-8]),
                serde_json::json!(-8),
            ),
            (
                "benchmark/benchmark::echo-u8",
                serde_json::json!([8]),
                serde_json::json!(8),
            ),
            (
                "benchmark/benchmark::echo-s16",
                serde_json::json!([-16]),
                serde_json::json!(-16),
            ),
            (
                "benchmark/benchmark::echo-u16",
                serde_json::json!([16]),
                serde_json::json!(16),
            ),
            (
                "benchmark/benchmark::echo-s32",
                serde_json::json!([-32]),
                serde_json::json!(-32),
            ),
            (
                "benchmark/benchmark::echo-u32",
                serde_json::json!([32]),
                serde_json::json!(32),
            ),
            (
                "benchmark/benchmark::echo-s64",
                serde_json::json!([-64]),
                serde_json::json!(-64),
            ),
            (
                "benchmark/benchmark::echo-u64",
                serde_json::json!([64]),
                serde_json::json!(64),
            ),
            (
                "benchmark/benchmark::echo-f32",
                serde_json::json!([1.5]),
                serde_json::json!(1.5),
            ),
            (
                "benchmark/benchmark::echo-f64",
                serde_json::json!([2.25]),
                serde_json::json!(2.25),
            ),
            (
                "benchmark/benchmark::echo-char",
                serde_json::json!(["λ"]),
                serde_json::json!("λ"),
            ),
            (
                "benchmark/benchmark::echo-string",
                serde_json::json!(["hello"]),
                serde_json::json!("hello"),
            ),
            (
                "benchmark/benchmark::echo-enum",
                serde_json::json!(["beta"]),
                serde_json::json!("beta"),
            ),
            (
                "benchmark/benchmark::echo-flags",
                serde_json::json!([["read", "execute"]]),
                serde_json::json!(["read", "execute"]),
            ),
            (
                "benchmark/benchmark::echo-list-u8",
                serde_json::json!([[1, 2, 3]]),
                serde_json::json!([1, 2, 3]),
            ),
            (
                "benchmark/benchmark::echo-list-string",
                serde_json::json!([["a", "b"]]),
                serde_json::json!(["a", "b"]),
            ),
            (
                "benchmark/benchmark::echo-record",
                serde_json::json!([{ "name": "rec", "count": 7, "enabled": true }]),
                serde_json::json!({ "name": "rec", "count": 7, "enabled": true }),
            ),
            (
                "benchmark/benchmark::echo-tuple",
                serde_json::json!([["tuple", 9, false]]),
                serde_json::json!(["tuple", 9, false]),
            ),
            (
                "benchmark/benchmark::echo-option",
                serde_json::json!(["some"]),
                serde_json::json!("some"),
            ),
            (
                "benchmark/benchmark::echo-option",
                serde_json::json!([null]),
                serde_json::json!(null),
            ),
            (
                "benchmark/benchmark::echo-result",
                serde_json::json!([{ "ok": 11 }]),
                serde_json::json!({ "ok": 11 }),
            ),
            (
                "benchmark/benchmark::echo-result",
                serde_json::json!([{ "err": "bad" }]),
                serde_json::json!({ "err": "bad" }),
            ),
            (
                "benchmark/benchmark::echo-variant",
                serde_json::json!([{ "case": "none" }]),
                serde_json::json!({ "case": "none", "value": null }),
            ),
            (
                "benchmark/benchmark::echo-variant",
                serde_json::json!([{ "case": "text", "value": "variant" }]),
                serde_json::json!({ "case": "text", "value": "variant" }),
            ),
            (
                "benchmark/benchmark::echo-variant",
                serde_json::json!([{ "case": "number", "value": 42 }]),
                serde_json::json!({ "case": "number", "value": 42 }),
            ),
        ];

        for (target, args, expected) in cases {
            let value = runtime.invoke(target, args).unwrap();
            assert_eq!(value, expected, "target {target}");
        }
    }

    #[test]
    fn benchmark_exercises_runtime_call_stub_for_deadlock_harness() {
        let benchmark = "../../../build.nosync/plugins/benchmark.wasm";
        if !std::path::Path::new(benchmark).exists() {
            eprintln!(
                "skipping benchmark runtime.call test; build it with `make build.nosync/plugins/benchmark.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/benchmark.wasm".to_string()], false)
            .unwrap();

        let value = runtime
            .invoke(
                "benchmark/benchmark::call-runtime-view",
                serde_json::json!(["view:test", "{\"ping\":true}"]),
            )
            .unwrap();
        assert!(value["err"]
            .as_str()
            .unwrap()
            .contains("frontend view bridge is not attached"));
    }

    #[test]
    fn benchmark_exercises_wasi_filesystem_from_component() {
        let benchmark = "../../../build.nosync/plugins/benchmark.wasm";
        if !std::path::Path::new(benchmark).exists() {
            eprintln!(
                "skipping benchmark wasi test; build it with `make build.nosync/plugins/benchmark.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/benchmark.wasm".to_string()], false)
            .unwrap();

        let value = runtime
            .invoke(
                "benchmark/benchmark::check-wasi-filesystem",
                serde_json::json!(["."]),
            )
            .unwrap();
        let report = &value["ok"];
        assert_eq!(report["first-preopen"], serde_json::json!("."));
        assert!(report["preopen-count"].as_u64().unwrap() >= 1);
        assert!(report["entry-count"].as_u64().unwrap() >= 1);
    }

    #[test]
    fn layout3_splits_by_content_id() {
        let layout3 = "../../../build.nosync/plugins/layout3.wasm";
        if !std::path::Path::new(layout3).exists() {
            eprintln!(
                "skipping layout3 smoke test; build it with `make build.nosync/plugins/layout3.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/layout3.wasm".to_string()], false)
            .unwrap();

        let init = runtime
            .invoke(
                "layout3/layout::init-screen",
                serde_json::json!([{
                    "w": 800,
                    "h": 600,
                    "config": {
                        "max-areas": 8,
                        "max-handles": 7,
                        "min-panel-size": 100,
                        "handle-half-size": 4
                    },
                    "root-content-id": "main"
                }]),
            )
            .unwrap();
        let document = init["ok"]["document"].clone();
        assert_eq!(
            document["areas"][0]["content-id"],
            serde_json::json!("main")
        );

        let split = runtime
            .invoke(
                "layout3/layout::move-corner",
                serde_json::json!([{
                    "document": document,
                    "area-content-id": "main",
                    "corner-index": 2,
                    "x": 400,
                    "y": 300,
                    "new-area-content-id": null,
                    "new-handle-content-id": null
                }]),
            )
            .unwrap();
        let document = &split["ok"]["document"];
        assert_eq!(document["areas"].as_array().unwrap().len(), 2);
        assert_eq!(document["handles"].as_array().unwrap().len(), 1);
        assert_eq!(
            document["areas"][1]["content-id"],
            serde_json::json!("main_1")
        );
        assert_eq!(
            document["handles"][0]["content-id"],
            serde_json::json!("main_handle")
        );
    }
}
