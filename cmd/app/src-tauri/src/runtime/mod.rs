mod values;

use anyhow::{bail, Context as AnyhowContext, Result};
use serde::Serialize;
use std::collections::BTreeMap;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use values::{json_to_val, result_json, val_default_for_type};
use wasmtime::component::types::{ComponentInstance, ComponentItem};
use wasmtime::component::{Component, Func, Instance, Linker, ResourceTable, Val};
use wasmtime::{Config, Engine, Store, StoreContextMut};
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtx, WasiCtxView, WasiView};

pub struct Runtime {
    inner: Mutex<RuntimeInner>,
}

struct RuntimeInner {
    engine: Engine,
    linker: Linker<HostState>,
    store: Store<HostState>,
    next_component: usize,
    next_resource: usize,
    root: PathBuf,
    components: BTreeMap<String, ComponentRecord>,
    funcs: BTreeMap<String, ExportedFunc>,
    preopens: Vec<Preopen>,
    descriptors: BTreeMap<String, DescriptorResource>,
    directory_entry_streams: BTreeMap<String, DirectoryEntryStreamResource>,
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
    WasiFilesystemDescriptorReadDirectory,
    WasiFilesystemDescriptorOpenAt,
    WasiFilesystemDescriptorRead,
    WasiFilesystemDirectoryEntryStreamReadDirectoryEntry,
}

#[derive(Clone)]
struct Preopen {
    guest_path: String,
    descriptor: String,
}

#[derive(Clone)]
struct DescriptorResource {
    host_path: PathBuf,
}

#[derive(Clone)]
struct DirectoryEntryStreamResource {
    entries: Vec<DirectoryEntry>,
    cursor: usize,
}

#[derive(Clone)]
struct DirectoryEntry {
    name: String,
    descriptor_type: &'static str,
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
        Self::new_at(runtime_root()?)
    }

    fn new_at(cwd: PathBuf) -> Result<Self> {
        let mut config = Config::new();
        config.wasm_component_model(true);

        let engine = Engine::new(&config)?;
        let mut linker = Linker::new(&engine);

        wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;
        add_gams_runtime_import(&mut linker)?;
        let root_descriptor = "wasi:filesystem/descriptor:1".to_string();
        let preopens = vec![Preopen {
            guest_path: "/".to_string(),
            descriptor: root_descriptor.clone(),
        }];
        let descriptors = BTreeMap::from([(
            root_descriptor,
            DescriptorResource {
                host_path: cwd.clone(),
            },
        )]);

        let mut wasi_builder = WasiCtx::builder();
        wasi_builder.inherit_stdio().inherit_args();
        wasi_builder
            .preopened_dir(&cwd, "/", DirPerms::all(), FilePerms::all())
            .map_err(|error| {
                anyhow::anyhow!("failed to preopen {} as /: {error}", cwd.display())
            })?;
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
            next_resource: 2,
            root: cwd,
            components: BTreeMap::new(),
            funcs: BTreeMap::new(),
            preopens,
            descriptors,
            directory_entry_streams: BTreeMap::new(),
        };
        inner.register_native_builtins()?;

        Ok(Self {
            inner: Mutex::new(inner),
        })
    }

    pub fn add_plugins(&self, paths: Vec<String>) -> Result<Vec<ComponentHandle>, String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        inner.add_plugins(paths).map_err(|error| error.to_string())
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
    fn add_plugins(&mut self, paths: Vec<String>) -> Result<Vec<ComponentHandle>> {
        let mut out = Vec::new();

        for path in paths {
            let resolved_path = resolve_component_path(&self.root, &path)?;
            let component =
                Component::from_file(&self.engine, &resolved_path).map_err(|error| {
                    anyhow::anyhow!(
                        "loading component {path} from {}: {error}",
                        resolved_path.display()
                    )
                })?;
            let imports = component_imports(&self.engine, &component);
            let exports = component_exports(&self.engine, &component);

            let instance = self
                .linker
                .instantiate(&mut self.store, &component)
                .map_err(|error| anyhow::anyhow!("instantiating component {path}: {error}"))?;

            self.expose_instance_exports(&component, &instance)?;

            let handle = format!("component:{}", self.next_component);
            self.next_component += 1;

            let record = ComponentRecord {
                handle: handle.clone(),
                path: resolved_path.display().to_string(),
                imports: imports.clone(),
                exports: exports.clone(),
                instance,
            };
            self.components.insert(handle.clone(), record);

            out.push(ComponentHandle {
                handle,
                path: resolved_path.display().to_string(),
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

    fn invoke_native(
        &mut self,
        target: &str,
        func: NativeFunc,
        args: serde_json::Value,
    ) -> Result<serde_json::Value> {
        let args = args
            .as_array()
            .context("runtime_invoke args must be a JSON array")?;
        match func.kind {
            NativeFuncKind::WasiFilesystemPreopensGetDirectories => {
                if !args.is_empty() {
                    bail!("{target} expects 0 args, got {}", args.len());
                }
                Ok(serde_json::Value::Array(
                    self.preopens
                        .iter()
                        .map(|preopen| {
                            serde_json::json!([
                                {
                                    "resource": preopen.descriptor,
                                    "type": "wasi:filesystem/types@0.2.0/descriptor",
                                },
                                preopen.guest_path,
                            ])
                        })
                        .collect(),
                ))
            }

            NativeFuncKind::WasiFilesystemDescriptorReadDirectory => {
                if args.len() != 1 {
                    bail!("{target} expects 1 arg, got {}", args.len());
                }
                let descriptor = resource_arg(&args[0], "wasi:filesystem/types@0.2.0/descriptor")?;
                let descriptor = self
                    .descriptors
                    .get(descriptor)
                    .with_context(|| format!("unknown descriptor resource `{descriptor}`"))?;

                let mut entries = Vec::new();
                for entry in std::fs::read_dir(&descriptor.host_path).with_context(|| {
                    format!(
                        "failed to read directory {}",
                        descriptor.host_path.display()
                    )
                })? {
                    let entry = entry?;
                    let metadata = entry.metadata()?;
                    entries.push(DirectoryEntry {
                        name: entry.file_name().to_string_lossy().to_string(),
                        descriptor_type: descriptor_type_for_metadata(&metadata),
                    });
                }
                entries.sort_by(|a, b| a.name.cmp(&b.name));

                let stream = self.alloc_resource("wasi:filesystem/directory-entry-stream");
                self.directory_entry_streams.insert(
                    stream.clone(),
                    DirectoryEntryStreamResource { entries, cursor: 0 },
                );

                Ok(resource_json(
                    &stream,
                    "wasi:filesystem/types@0.2.0/directory-entry-stream",
                ))
            }

            NativeFuncKind::WasiFilesystemDescriptorOpenAt => {
                if args.len() != 5 {
                    bail!("{target} expects 5 args, got {}", args.len());
                }
                let base = resource_arg(&args[0], "wasi:filesystem/types@0.2.0/descriptor")?;
                let base = self
                    .descriptors
                    .get(base)
                    .with_context(|| format!("unknown descriptor resource `{base}`"))?;
                reject_non_empty_flags(&args[1], "path-flags")?;
                let path = args[2].as_str().context("open-at path must be a string")?;
                reject_unsupported_open_flags(&args[3])?;
                reject_unsupported_descriptor_flags(&args[4])?;
                let target_path = safe_join(&base.host_path, path)?;
                if !target_path.exists() {
                    bail!("path does not exist: {path}");
                }
                let descriptor = self.alloc_resource("wasi:filesystem/descriptor");
                self.descriptors.insert(
                    descriptor.clone(),
                    DescriptorResource {
                        host_path: target_path,
                    },
                );
                Ok(resource_json(
                    &descriptor,
                    "wasi:filesystem/types@0.2.0/descriptor",
                ))
            }

            NativeFuncKind::WasiFilesystemDescriptorRead => {
                if args.len() != 3 {
                    bail!("{target} expects 3 args, got {}", args.len());
                }
                let descriptor = resource_arg(&args[0], "wasi:filesystem/types@0.2.0/descriptor")?;
                let descriptor = self
                    .descriptors
                    .get(descriptor)
                    .with_context(|| format!("unknown descriptor resource `{descriptor}`"))?;
                let length = args[1].as_u64().context("read length must be u64")?;
                let offset = args[2].as_u64().context("read offset must be u64")?;
                if length > usize::MAX as u64 {
                    bail!("read length is too large: {length}");
                }

                let mut file = std::fs::File::open(&descriptor.host_path).with_context(|| {
                    format!("failed to open {}", descriptor.host_path.display())
                })?;
                file.seek(SeekFrom::Start(offset))?;
                let mut bytes = vec![0; length as usize];
                let count = file.read(&mut bytes)?;
                bytes.truncate(count);
                let eof = count < length as usize;

                Ok(serde_json::json!([bytes, eof]))
            }
            NativeFuncKind::WasiFilesystemDirectoryEntryStreamReadDirectoryEntry => {
                if args.len() != 1 {
                    bail!("{target} expects 1 arg, got {}", args.len());
                }
                let stream = resource_arg(
                    &args[0],
                    "wasi:filesystem/types@0.2.0/directory-entry-stream",
                )?;
                let stream = self
                    .directory_entry_streams
                    .get_mut(stream)
                    .with_context(|| {
                        format!("unknown directory-entry-stream resource `{stream}`")
                    })?;

                if stream.cursor >= stream.entries.len() {
                    return Ok(serde_json::Value::Null);
                }

                let entry = stream.entries[stream.cursor].clone();
                stream.cursor += 1;

                Ok(serde_json::json!({
                    "type": entry.descriptor_type,
                    "name": entry.name,
                }))
            }
        }
    }

    fn alloc_resource(&mut self, prefix: &str) -> String {
        let resource = format!("{prefix}:{}", self.next_resource);
        self.next_resource += 1;
        resource
    }

    fn register_native_builtins(&mut self) -> Result<()> {
        self.insert_unique_native_func(
            "wasi:filesystem/preopens@0.2.0::get-directories",
            NativeFuncKind::WasiFilesystemPreopensGetDirectories,
        )?;
        self.insert_unique_native_func(
            "wasi:filesystem/types@0.2.0::descriptor.read-directory",
            NativeFuncKind::WasiFilesystemDescriptorReadDirectory,
        )?;
        self.insert_unique_native_func(
            "wasi:filesystem/types@0.2.0::descriptor.open-at",
            NativeFuncKind::WasiFilesystemDescriptorOpenAt,
        )?;
        self.insert_unique_native_func(
            "wasi:filesystem/types@0.2.0::descriptor.read",
            NativeFuncKind::WasiFilesystemDescriptorRead,
        )?;
        self.insert_unique_native_func(
            "wasi:filesystem/types@0.2.0::directory-entry-stream.read-directory-entry",
            NativeFuncKind::WasiFilesystemDirectoryEntryStreamReadDirectoryEntry,
        )?;
        Ok(())
    }

    fn insert_unique_native_func(&mut self, key: &str, kind: NativeFuncKind) -> Result<()> {
        if self.funcs.contains_key(key) {
            bail!("duplicate provider for exported function `{key}`");
        }
        self.funcs
            .insert(key.to_string(), ExportedFunc::Native(NativeFunc { kind }));
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

        let mut matches = self
            .funcs
            .iter()
            .filter(|(key, _)| invocation_key_matches_unversioned(key, interface, function))
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
            let message =
                format!("frontend view bridge is not connected yet: target={target}, args={args}");
            results[0] = Val::Result(Err(Some(Box::new(Val::String(message)))));
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

fn invocation_key_matches_unversioned(key: &str, interface: &str, function: &str) -> bool {
    let Some((candidate_interface, candidate_function)) = key.split_once("::") else {
        return false;
    };
    candidate_function == function && strip_interface_version(candidate_interface) == interface
}

fn strip_interface_version(interface: &str) -> &str {
    interface
        .rsplit_once('@')
        .map_or(interface, |(base, _)| base)
}

fn resource_arg<'a>(value: &'a serde_json::Value, expected_type: &str) -> Result<&'a str> {
    let object = value
        .as_object()
        .context("resource argument must be an object")?;
    let ty = object
        .get("type")
        .and_then(|value| value.as_str())
        .context("resource argument must contain string `type`")?;
    if ty != expected_type {
        bail!("resource argument type must be `{expected_type}`, got `{ty}`");
    }
    object
        .get("resource")
        .and_then(|value| value.as_str())
        .context("resource argument must contain string `resource`")
}

fn resource_json(resource: &str, ty: &str) -> serde_json::Value {
    serde_json::json!({
        "resource": resource,
        "type": ty,
    })
}

fn reject_non_empty_flags(value: &serde_json::Value, name: &str) -> Result<()> {
    let flags = value
        .as_array()
        .with_context(|| format!("{name} must be a JSON array of flag names"))?;
    if !flags.is_empty() {
        bail!("{name} flags are not supported yet: {flags:?}");
    }
    Ok(())
}

fn reject_unsupported_open_flags(value: &serde_json::Value) -> Result<()> {
    let flags = value
        .as_array()
        .context("open-flags must be a JSON array of flag names")?;
    for flag in flags {
        let flag = flag
            .as_str()
            .context("open-flags entries must be strings")?;
        match flag {
            "create" | "directory" | "exclusive" | "truncate" => {
                bail!("open-flag `{flag}` is not supported yet")
            }
            other => bail!("unknown open-flag `{other}`"),
        }
    }
    Ok(())
}

fn reject_unsupported_descriptor_flags(value: &serde_json::Value) -> Result<()> {
    let flags = value
        .as_array()
        .context("descriptor-flags must be a JSON array of flag names")?;
    for flag in flags {
        let flag = flag
            .as_str()
            .context("descriptor-flags entries must be strings")?;
        match flag {
            "read" => {}
            "write"
            | "file-integrity-sync"
            | "data-integrity-sync"
            | "requested-write-sync"
            | "mutate-directory" => {
                bail!("descriptor-flag `{flag}` is not supported yet")
            }
            other => bail!("unknown descriptor-flag `{other}`"),
        }
    }
    Ok(())
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

fn runtime_root() -> Result<PathBuf> {
    let raw = match std::env::var("GAMS_APP_CWD") {
        Ok(value) if !value.is_empty() => PathBuf::from(value),
        _ => std::env::current_dir().context("failed to resolve current working directory")?,
    };
    raw.canonicalize().with_context(|| {
        format!(
            "failed to resolve GAMS_APP_CWD/runtime root {}",
            raw.display()
        )
    })
}

fn resolve_component_path(root: &Path, path: &str) -> Result<PathBuf> {
    let raw = PathBuf::from(path);

    if raw.is_absolute() {
        if raw.exists() {
            return raw
                .canonicalize()
                .with_context(|| format!("failed to canonicalize absolute component path {path}"));
        }
        bail!("absolute component path not found: {path}");
    }

    let candidate = safe_join(root, path)?;
    if candidate.exists() {
        return candidate.canonicalize().with_context(|| {
            format!(
                "failed to canonicalize component path {}",
                candidate.display()
            )
        });
    }

    bail!(
        "component path not found relative to runtime root {}: {path}",
        root.display()
    )
}

fn descriptor_type_for_metadata(metadata: &std::fs::Metadata) -> &'static str {
    let file_type = metadata.file_type();
    if file_type.is_dir() {
        "directory"
    } else if file_type.is_file() {
        "regular-file"
    } else if file_type.is_symlink() {
        "symbolic-link"
    } else {
        "unknown"
    }
}

#[cfg(test)]
mod tests {
    use super::Runtime;
    use std::path::PathBuf;

    #[test]
    fn invokes_wasi_filesystem_preopens_builtin() {
        let runtime = Runtime::new().unwrap();
        let value = runtime
            .invoke(
                "wasi:filesystem/preopens@0.2.0::get-directories",
                serde_json::json!([]),
            )
            .unwrap();
        assert_eq!(value.as_array().unwrap().len(), 1);
        assert_eq!(value[0][1], serde_json::json!("/"));
    }

    #[test]
    fn lists_current_directory_through_wasi_filesystem_builtins() {
        let runtime = Runtime::new().unwrap();
        let preopens = runtime
            .invoke(
                "wasi:filesystem/preopens@0.2.0::get-directories",
                serde_json::json!([]),
            )
            .unwrap();
        let descriptor = preopens[0][0].clone();
        let stream = runtime
            .invoke(
                "wasi:filesystem/types@0.2.0::descriptor.read-directory",
                serde_json::json!([descriptor]),
            )
            .unwrap();
        let first = runtime
            .invoke(
                "wasi:filesystem/types@0.2.0::directory-entry-stream.read-directory-entry",
                serde_json::json!([stream]),
            )
            .unwrap();
        assert!(first.is_null() || first.get("name").unwrap().is_string());
    }

    #[test]
    fn opens_and_reads_file_through_wasi_filesystem_builtins() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("hello.txt"), "hello from wasi").unwrap();
        let runtime = Runtime::new_at(dir.path().to_path_buf()).unwrap();
        let preopens = runtime
            .invoke(
                "wasi:filesystem/preopens@0.2.0::get-directories",
                serde_json::json!([]),
            )
            .unwrap();
        let root = preopens[0][0].clone();
        let file = runtime
            .invoke(
                "wasi:filesystem/types@0.2.0::descriptor.open-at",
                serde_json::json!([root, [], "hello.txt", [], ["read"]]),
            )
            .unwrap();
        let read = runtime
            .invoke(
                "wasi:filesystem/types@0.2.0::descriptor.read",
                serde_json::json!([file, 64, 0]),
            )
            .unwrap();

        assert_eq!(read[0], serde_json::json!(b"hello from wasi"));
        assert_eq!(read[1], serde_json::json!(true));
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

        let runtime = Runtime::new().unwrap();
        let path = PathBuf::from(path).canonicalize().unwrap();
        runtime
            .add_plugins(vec![path.display().to_string()])
            .unwrap();
        let value = runtime
            .invoke("docs:adder/add::add", serde_json::json!([2, 3]))
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
        let runtime = Runtime::new_at(root).unwrap();
        runtime
            .add_plugins(vec!["plugins/adder.wasm".to_string()])
            .unwrap();
        let value = runtime
            .invoke("docs:adder/add::add", serde_json::json!([2, 3]))
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
        let runtime = Runtime::new_at(root).unwrap();
        runtime
            .add_plugins(vec![
                "plugins/adder.wasm".to_string(),
                "plugins/calculator.wasm".to_string(),
            ])
            .unwrap();
        let value = runtime
            .invoke(
                "docs:calculator/calculate::eval-expression",
                serde_json::json!(["add", 2, 3]),
            )
            .unwrap();
        assert_eq!(value, serde_json::json!(5));
    }
}
