mod values;

use anyhow::{bail, Context as AnyhowContext, Result};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Emitter;
use values::{json_to_val_with_resources, result_json_with_resources, val_default_for_type};
use wasmtime::component::types::{ComponentInstance, ComponentItem};
use wasmtime::component::{
    Component, Func, Instance, Linker, LinkerInstance, ResourceAny, ResourceTable, Val,
};
use wasmtime::{Config, Engine, Store, StoreContextMut};
use wasmtime_wasi::{DirPerms, FilePerms, WasiCtx, WasiCtxView, WasiView};
use wasmtime_wasi_http::p2::{WasiHttpCtxView, WasiHttpView};
use wasmtime_wasi_http::WasiHttpCtx;

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
    compiled_component_cache_dir: PathBuf,
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
    http_ctx: WasiHttpCtx,
    resource_table: ResourceTable,
    json_resource_refs: BTreeMap<String, JsonResourceRef>,
    next_json_resource: u64,
    view_bridge: ViewBridge,
    root: PathBuf,
    runtime_funcs: BTreeMap<String, ExportedFunc>,
}

impl WasiView for HostState {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.wasi_ctx,
            table: &mut self.resource_table,
        }
    }
}

impl WasiHttpView for HostState {
    fn http(&mut self) -> WasiHttpCtxView<'_> {
        WasiHttpCtxView {
            ctx: &mut self.http_ctx,
            table: &mut self.resource_table,
            hooks: Default::default(),
        }
    }
}

#[derive(Clone)]
struct JsonResourceRef {
    resource_type_name: String,
    resource: ResourceAny,
}

#[derive(Clone)]
enum ExportedFunc {
    Wasm(Func),
    NativeShellRun,
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
    NativeShell,
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

#[derive(Clone, Debug)]
struct RuntimeCallInterfaceId<'a> {
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

    pub fn set_compiled_component_cache_dir(&self, path: PathBuf) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        inner.compiled_component_cache_dir = path;
        Ok(())
    }

    pub fn cache_component(&self, path: PathBuf) -> Result<PathBuf, String> {
        let source = if path.is_absolute() {
            path
        } else {
            std::env::current_dir()
                .map_err(|error| format!("failed to read current directory: {error}"))?
                .join(path)
        }
        .canonicalize()
        .map_err(|error| format!("failed to canonicalize component path: {error}"))?;
        let inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        let cache_path =
            compiled_component_cache_path(&inner.compiled_component_cache_dir, &source);
        inner
            .load_component(&source)
            .map_err(|error| format!("failed to cache component {}: {error}", source.display()))?;
        Ok(cache_path)
    }

    pub fn clear_compiled_component_cache(&self) -> Result<(), String> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        if inner.compiled_component_cache_dir.exists() {
            fs::remove_dir_all(&inner.compiled_component_cache_dir).map_err(|error| {
                format!(
                    "failed to remove compiled component cache {}: {error}",
                    inner.compiled_component_cache_dir.display()
                )
            })?;
        }
        fs::create_dir_all(&inner.compiled_component_cache_dir).map_err(|error| {
            format!(
                "failed to recreate compiled component cache {}: {error}",
                inner.compiled_component_cache_dir.display()
            )
        })
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

    pub fn add_component_files(&self, paths: Vec<PathBuf>) -> Result<Vec<ComponentHandle>, String> {
        let requests = paths
            .into_iter()
            .map(|path| {
                let source = if path.is_absolute() {
                    path
                } else {
                    std::env::current_dir()
                        .map_err(|error| format!("failed to read current directory: {error}"))?
                        .join(path)
                };
                source
                    .canonicalize()
                    .map_err(|error| format!("failed to canonicalize component path: {error}"))
            })
            .collect::<Result<Vec<_>, _>>()?;
        let display_paths = requests
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>();
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        inner
            .add_resolved_plugins(display_paths, requests)
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

    pub fn release_resource(&self, resource: serde_json::Value) -> Result<(), String> {
        let mut inner = self
            .inner
            .lock()
            .map_err(|_| "runtime lock poisoned".to_string())?;
        inner
            .release_resource(resource)
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
            "jsonResourceRefs": inner.store.data().json_resource_refs.len(),
            "compiledComponentCacheDir": inner.compiled_component_cache_dir.display().to_string(),
        }))
    }
}

impl RuntimeInner {
    fn new(cwd: PathBuf, preopens: Vec<FsPreopen>, view_bridge: ViewBridge) -> Result<Self> {
        let mut config = Config::new();
        config.wasm_component_model(true);
        config.wasm_exceptions(true);

        let engine = Engine::new(&config)?;
        let mut linker = Linker::new(&engine);

        wasmtime_wasi::p2::add_to_linker_sync(&mut linker)?;
        wasmtime_wasi_http::p2::add_only_http_to_linker_sync(&mut linker)?;
        add_gams_runtime_import(&mut linker, "gams:runtime/runtime@1.0.0")?;
        add_gams_shell_import(&mut linker, "gams:shell/shell@1.0.0")?;
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
            http_ctx: WasiHttpCtx::new(),
            resource_table: ResourceTable::new(),
            json_resource_refs: BTreeMap::new(),
            next_json_resource: 1,
            view_bridge,
            root: cwd.clone(),
            runtime_funcs: BTreeMap::from([(
                "gams:shell/shell@1.0.0::run".to_string(),
                ExportedFunc::NativeShellRun,
            )]),
        };
        let store = Store::new(&engine, state);

        Ok(RuntimeInner {
            engine,
            linker,
            store,
            next_component: 1,
            root: cwd.clone(),
            preopens,
            components: BTreeMap::new(),
            funcs: BTreeMap::from([(
                "gams:shell/shell@1.0.0::run".to_string(),
                ExportedFunc::NativeShellRun,
            )]),
            linked_interfaces: BTreeSet::from([
                "gams:runtime/runtime@1.0.0".to_string(),
                "gams:shell/shell@1.0.0".to_string(),
            ]),
            compiled_component_cache_dir: default_compiled_component_cache_dir(&cwd),
        })
    }

    fn load_component(&self, path: &Path) -> Result<Component> {
        let cache_path = compiled_component_cache_path(&self.compiled_component_cache_dir, path);
        if compiled_component_cache_is_fresh(path, &cache_path)? {
            let bytes = fs::read(&cache_path).with_context(|| {
                format!(
                    "failed to read compiled component cache {}",
                    cache_path.display()
                )
            })?;
            // SAFETY: GAMS only writes this cache from `Component::serialize` below, into a
            // runtime-owned cache directory keyed by Wasmtime/runtime config and invalidated
            // when the source `.wasm` mtime changes. Users can clear the cache if external
            // filesystem operations make mtime insufficient.
            return unsafe { Component::deserialize(&self.engine, bytes) }.map_err(|error| {
                anyhow::anyhow!(
                    "failed to deserialize compiled component cache {}: {error}",
                    cache_path.display()
                )
            });
        }

        let component = Component::from_file(&self.engine, path)?;
        let bytes = component.serialize()?;
        write_compiled_component_cache(path, &cache_path, &bytes)?;
        Ok(component)
    }

    fn add_plugins(&mut self, paths: Vec<String>, reload: bool) -> Result<Vec<ComponentHandle>> {
        if reload {
            return self.reload_plugins(paths);
        }

        let requests = paths
            .iter()
            .map(|path| resolve_component_path(&self.root, &self.preopens, path))
            .collect::<Result<Vec<_>>>()?;

        self.add_resolved_plugins(paths, requests)
    }

    fn add_resolved_plugins(
        &mut self,
        paths: Vec<String>,
        requests: Vec<PathBuf>,
    ) -> Result<Vec<ComponentHandle>> {
        let mut candidates = Vec::new();
        let mut candidate_by_path = BTreeMap::new();
        for (path, resolved_path) in paths.iter().zip(requests.iter()) {
            if self.component_by_path(resolved_path).is_some() {
                continue;
            }
            if candidate_by_path.contains_key(resolved_path) {
                continue;
            }

            let component = self.load_component(resolved_path).map_err(|error| {
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
        let compiled_component_cache_dir = self.compiled_component_cache_dir.clone();
        let mut rebuilt = RuntimeInner::new(root, self.preopens.clone(), view_bridge)?;
        rebuilt.compiled_component_cache_dir = compiled_component_cache_dir;
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
        insert_provider(
            &mut providers,
            "gams:shell/shell@1.0.0",
            ProviderSource::NativeShell,
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
                ProviderSource::NativeShell => self.ensure_gams_shell_import(import)?,
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
        let (resolved_target, func) = {
            let (key, func) = self.resolve_func(target)?;
            (key.clone(), func.clone())
        };
        match func {
            ExportedFunc::Wasm(func) => self.invoke_wasm(&resolved_target, func, args),
            ExportedFunc::NativeShellRun => invoke_native_shell_run(&self.root, args),
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

        let resource_type_name = invocation_resource_type_name(target);
        let mut resolve_resource = |resource_type_name: &str, id: &str| {
            let resource_ref = self
                .store
                .data()
                .json_resource_refs
                .get(id)
                .with_context(|| format!("unknown resource ref `{id}`"))?;
            if resource_ref.resource_type_name != resource_type_name {
                bail!(
                    "resource ref `{id}` has type `{}`, got `{resource_type_name}`",
                    resource_ref.resource_type_name
                );
            }
            Ok(resource_ref.resource)
        };
        let params = args
            .iter()
            .zip(params_ty.iter())
            .map(|(value, ty)| {
                json_to_val_with_resources(
                    value,
                    ty,
                    Some(&resource_type_name),
                    &mut resolve_resource,
                )
            })
            .collect::<Result<Vec<_>>>()?;

        let mut results = ty
            .results()
            .map(|ty| val_default_for_type(&ty))
            .collect::<Result<Vec<_>>>()?;

        func.call(&mut self.store, &params, &mut results)
            .map_err(|error| anyhow::anyhow!("calling {target}: {error}"))?;

        let mut register_resource = |resource: ResourceAny, resource_type_name: &str| {
            let state = self.store.data_mut();
            let id = format!("res_{:016x}", state.next_json_resource);
            state.next_json_resource += 1;
            state.json_resource_refs.insert(
                id.clone(),
                JsonResourceRef {
                    resource_type_name: resource_type_name.to_string(),
                    resource,
                },
            );
            Ok(serde_json::json!({
                "$resource": resource_type_name,
                "id": id,
            }))
        };
        result_json_with_resources(results, Some(&resource_type_name), &mut register_resource)
    }

    fn release_resource(&mut self, resource: serde_json::Value) -> Result<()> {
        let object = resource
            .as_object()
            .context("resource release expects resource object")?;
        let resource_type_name = object
            .get("$resource")
            .and_then(|value| value.as_str())
            .context("resource object must contain string `$resource`")?;
        let id = object
            .get("id")
            .and_then(|value| value.as_str())
            .context("resource object must contain string `id`")?;

        let resource_ref = self
            .store
            .data_mut()
            .json_resource_refs
            .remove(id)
            .with_context(|| format!("unknown resource ref `{id}`"))?;
        if resource_ref.resource_type_name != resource_type_name {
            let actual_type = resource_ref.resource_type_name.clone();
            self.store
                .data_mut()
                .json_resource_refs
                .insert(id.to_string(), resource_ref);
            bail!("resource ref `{id}` has type `{actual_type}`, got `{resource_type_name}`");
        }

        resource_ref
            .resource
            .resource_drop(&mut self.store)
            .map_err(|error| anyhow::anyhow!("failed to drop resource ref `{id}`: {error}"))
    }

    fn resolve_func(&self, target: &str) -> Result<(&String, &ExportedFunc)> {
        if let Some((key, func)) = self.funcs.get_key_value(target) {
            return Ok((key, func));
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
            1 => {
                let (key, func) = matches.swap_remove(0);
                Ok((key, func))
            }
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
        ensure_native_import_interface(interface_name, "runtime", "runtime")?;
        add_gams_runtime_import(&mut self.linker, interface_name)?;
        self.linked_interfaces.insert(interface_name.to_string());
        Ok(())
    }

    fn ensure_gams_shell_import(&mut self, interface_name: &str) -> Result<()> {
        if self.linked_interfaces.contains(interface_name) {
            return Ok(());
        }
        ensure_native_import_interface(interface_name, "shell", "shell")?;
        add_gams_shell_import(&mut self.linker, interface_name)?;
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
            match func {
                ExportedFunc::Wasm(forward) => {
                    linker_iface.func_new(
                        &func_name,
                        move |mut cx: StoreContextMut<'_, HostState>, _callee, params, results| {
                            forward.call(&mut cx, params, results)
                        },
                    )?;
                }
                ExportedFunc::NativeShellRun => {
                    add_shell_run_func(&mut linker_iface, &func_name)?;
                }
            }
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
                    self.insert_exported_func(name.to_string(), func)?;
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

        let mut registrations = Vec::new();
        {
            let mut linker_iface = self.linker.instance(interface_name)?;

            for (func_name, item) in iface_ty.exports(&self.engine) {
                let ComponentItem::ComponentFunc(_) = item else {
                    continue;
                };

                let func_index = component
                    .get_export_index(Some(&iface_index), func_name)
                    .with_context(|| {
                        format!("missing func index `{interface_name}.{func_name}`")
                    })?;
                let exported_func = instance
                    .get_func(&mut self.store, &func_index)
                    .with_context(|| {
                        format!("missing exported func `{interface_name}.{func_name}`")
                    })?;

                let forward = exported_func.clone();
                linker_iface.func_new(
                    func_name,
                    move |mut cx: StoreContextMut<'_, HostState>, _callee, params, results| {
                        forward.call(&mut cx, params, results)
                    },
                )?;

                registrations.push((format!("{interface_name}::{func_name}"), exported_func));
            }
        }

        for (key, func) in registrations {
            self.insert_exported_func(key, func)?;
        }

        self.linked_interfaces.insert(interface_name.to_string());
        Ok(())
    }

    fn insert_exported_func(&mut self, key: String, func: Func) -> Result<()> {
        insert_unique_func(&mut self.funcs, key.clone(), func.clone())?;
        insert_unique_func(&mut self.store.data_mut().runtime_funcs, key, func)?;
        Ok(())
    }
}

fn ensure_native_import_interface(
    interface_name: &str,
    package: &str,
    interface: &str,
) -> Result<()> {
    let parsed = parse_interface_id(interface_name)
        .with_context(|| format!("invalid native import interface `{interface_name}`"))?
        .with_context(|| format!("native import `{interface_name}` is not an interface id"))?;
    if parsed.package != package || parsed.interface != interface {
        bail!("native {package}/{interface} provider cannot satisfy `{interface_name}`");
    }
    let Some(version) = parsed.version else {
        bail!("native import `{interface_name}` must be versioned");
    };
    if version.major != 1 {
        bail!(
            "native import `{interface_name}` requires unsupported major version {}",
            version.major
        );
    }
    Ok(())
}

fn add_gams_runtime_import(linker: &mut Linker<HostState>, interface_name: &str) -> Result<()> {
    ensure_native_import_interface(interface_name, "runtime", "runtime")?;
    let mut iface = linker.instance(interface_name)?;
    iface.func_new(
        "call",
        |mut _cx: StoreContextMut<'_, HostState>, _callee, params, results| {
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
            match call_runtime_target(&mut _cx, &target, &args) {
                Ok(Some(value)) => results[0] = Val::Result(Ok(Some(Box::new(Val::String(value))))),
                Ok(None) => {
                    let bridge = _cx.data().view_bridge.clone();
                    match bridge.call_view(target, args) {
                        Ok(value) => {
                            results[0] = Val::Result(Ok(Some(Box::new(Val::String(value)))))
                        }
                        Err(error) => {
                            results[0] = Val::Result(Err(Some(Box::new(Val::String(error)))))
                        }
                    }
                }
                Err(error) => results[0] = Val::Result(Err(Some(Box::new(Val::String(error))))),
            }
            Ok(())
        },
    )?;
    Ok(())
}

fn add_gams_shell_import(linker: &mut Linker<HostState>, interface_name: &str) -> Result<()> {
    ensure_native_import_interface(interface_name, "shell", "shell")?;
    let mut iface = linker.instance(interface_name)?;
    add_shell_run_func(&mut iface, "run")?;
    Ok(())
}

fn add_shell_run_func(iface: &mut LinkerInstance<'_, HostState>, func_name: &str) -> Result<()> {
    iface.func_new(
        func_name,
        |cx: StoreContextMut<'_, HostState>, _callee, params, results| {
            let command = match params.get(0) {
                Some(Val::String(value)) => value.clone(),
                other => {
                    return Err(wasmtime::Error::msg(format!(
                        "gams:shell/shell.run command must be string, got {other:?}"
                    )))
                }
            };
            let timeout_ms = match params.get(1) {
                Some(Val::U64(value)) => *value,
                other => {
                    return Err(wasmtime::Error::msg(format!(
                        "gams:shell/shell.run timeout-ms must be u64, got {other:?}"
                    )))
                }
            };
            results[0] =
                shell_result_to_val(run_shell_command(&cx.data().root, command, timeout_ms));
            Ok(())
        },
    )?;
    Ok(())
}

fn invocation_resource_type_name(target: &str) -> String {
    let interface = target
        .split_once("::")
        .map(|(interface, _)| interface)
        .unwrap_or(target);
    interface
        .split_once('@')
        .map(|(without_version, _)| without_version)
        .unwrap_or(interface)
        .to_string()
}

fn call_runtime_target(
    cx: &mut StoreContextMut<'_, HostState>,
    target: &str,
    args: &str,
) -> std::result::Result<Option<String>, String> {
    let (resolved_target, func) = match resolve_runtime_call_func(&cx.data().runtime_funcs, target)
        .map_err(|error| error.to_string())?
    {
        Some((key, func)) => (key.clone(), func.clone()),
        None => return Ok(None),
    };

    let func = match func {
        ExportedFunc::Wasm(func) => func,
        ExportedFunc::NativeShellRun => {
            let args_json = serde_json::from_str::<serde_json::Value>(args).map_err(|error| {
                format!("runtime.call component args must be a JSON array: {error}")
            })?;
            let value = invoke_native_shell_run(&cx.data().root, args_json)
                .map_err(|error| error.to_string())?;
            return serde_json::to_string(&value)
                .map(Some)
                .map_err(|error| format!("encoding {target} result: {error}"));
        }
    };
    let ty = func.ty(&mut *cx);
    let params_ty = ty.params().map(|(_, ty)| ty).collect::<Vec<_>>();
    let args_json = serde_json::from_str::<serde_json::Value>(args)
        .map_err(|error| format!("runtime.call component args must be a JSON array: {error}"))?;
    let args_array = args_json
        .as_array()
        .ok_or_else(|| "runtime.call component args must be a JSON array".to_string())?;
    if args_array.len() != params_ty.len() {
        return Err(format!(
            "{target} expects {} args, got {}",
            params_ty.len(),
            args_array.len()
        ));
    }

    let resource_type_name = invocation_resource_type_name(&resolved_target);
    let mut resolve_resource = |resource_type_name: &str, id: &str| {
        let resource_ref = cx
            .data()
            .json_resource_refs
            .get(id)
            .with_context(|| format!("unknown resource ref `{id}`"))?;
        if resource_ref.resource_type_name != resource_type_name {
            bail!(
                "resource ref `{id}` has type `{}`, got `{resource_type_name}`",
                resource_ref.resource_type_name
            );
        }
        Ok(resource_ref.resource)
    };
    let params = args_array
        .iter()
        .zip(params_ty.iter())
        .map(|(value, ty)| {
            json_to_val_with_resources(value, ty, Some(&resource_type_name), &mut resolve_resource)
                .map_err(|error| error.to_string())
        })
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let mut results = ty
        .results()
        .map(|ty| val_default_for_type(&ty).map_err(|error| error.to_string()))
        .collect::<std::result::Result<Vec<_>, _>>()?;

    func.call(&mut *cx, &params, &mut results)
        .map_err(|error| format!("calling {target}: {error}"))?;
    let mut register_resource = |resource: ResourceAny, resource_type_name: &str| {
        let state = cx.data_mut();
        let id = format!("res_{:016x}", state.next_json_resource);
        state.next_json_resource += 1;
        state.json_resource_refs.insert(
            id.clone(),
            JsonResourceRef {
                resource_type_name: resource_type_name.to_string(),
                resource,
            },
        );
        Ok(serde_json::json!({
            "$resource": resource_type_name,
            "id": id,
        }))
    };
    let value =
        result_json_with_resources(results, Some(&resource_type_name), &mut register_resource)
            .map_err(|error| error.to_string())?;
    serde_json::to_string(&value)
        .map(Some)
        .map_err(|error| format!("encoding {target} result: {error}"))
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

#[derive(Debug)]
struct ShellOutput {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Debug)]
enum ShellError {
    FailedToStart(String),
    Timeout,
    HostError(String),
}

fn invoke_native_shell_run(root: &Path, args: serde_json::Value) -> Result<serde_json::Value> {
    let args = args
        .as_array()
        .context("shell/shell::run args must be a JSON array")?;
    if args.len() != 2 {
        bail!("shell/shell::run expects 2 args, got {}", args.len());
    }
    let command = args[0]
        .as_str()
        .context("shell/shell::run command must be a string")?
        .to_string();
    let timeout_ms = args[1]
        .as_u64()
        .context("shell/shell::run timeout-ms must be a u64")?;
    Ok(shell_result_to_json(run_shell_command(
        root, command, timeout_ms,
    )))
}

fn shell_result_to_json(result: std::result::Result<ShellOutput, ShellError>) -> serde_json::Value {
    match result {
        Ok(output) => serde_json::json!({
            "ok": {
                "exit-code": output.exit_code,
                "stdout": output.stdout,
                "stderr": output.stderr,
            }
        }),
        Err(error) => serde_json::json!({
            "err": shell_error_to_json(error)
        }),
    }
}

fn shell_result_to_val(result: std::result::Result<ShellOutput, ShellError>) -> Val {
    match result {
        Ok(output) => Val::Result(Ok(Some(Box::new(Val::Record(vec![
            ("exit-code".to_string(), Val::S32(output.exit_code)),
            ("stdout".to_string(), Val::String(output.stdout)),
            ("stderr".to_string(), Val::String(output.stderr)),
        ]))))),
        Err(error) => Val::Result(Err(Some(Box::new(shell_error_to_val(error))))),
    }
}

fn shell_error_to_json(error: ShellError) -> serde_json::Value {
    match error {
        ShellError::FailedToStart(message) => serde_json::json!({
            "case": "failed-to-start",
            "value": message,
        }),
        ShellError::Timeout => serde_json::json!({
            "case": "timeout",
            "value": null,
        }),
        ShellError::HostError(message) => serde_json::json!({
            "case": "host-error",
            "value": message,
        }),
    }
}

fn shell_error_to_val(error: ShellError) -> Val {
    match error {
        ShellError::FailedToStart(message) => Val::Variant(
            "failed-to-start".to_string(),
            Some(Box::new(Val::String(message))),
        ),
        ShellError::Timeout => Val::Variant("timeout".to_string(), None),
        ShellError::HostError(message) => Val::Variant(
            "host-error".to_string(),
            Some(Box::new(Val::String(message))),
        ),
    }
}

fn run_shell_command(
    root: &Path,
    command: String,
    timeout_ms: u64,
) -> std::result::Result<ShellOutput, ShellError> {
    if timeout_ms == 0 {
        return Err(ShellError::Timeout);
    }

    let mut child = default_shell_command(&command)
        .current_dir(root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| ShellError::FailedToStart(error.to_string()))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| ShellError::HostError("child stdout was not piped".to_string()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| ShellError::HostError("child stderr was not piped".to_string()))?;

    let stdout_reader = thread::spawn(move || read_pipe(stdout));
    let stderr_reader = thread::spawn(move || read_pipe(stderr));

    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = join_reader(stdout_reader);
                    let _ = join_reader(stderr_reader);
                    return Err(ShellError::Timeout);
                }
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => return Err(ShellError::HostError(error.to_string())),
        }
    };

    let stdout = join_reader(stdout_reader)?;
    let stderr = join_reader(stderr_reader)?;
    Ok(ShellOutput {
        exit_code: status.code().unwrap_or(-1),
        stdout,
        stderr,
    })
}

fn read_pipe(mut pipe: impl Read) -> std::result::Result<String, String> {
    let mut bytes = Vec::new();
    pipe.read_to_end(&mut bytes)
        .map_err(|error| error.to_string())?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn join_reader(
    handle: thread::JoinHandle<std::result::Result<String, String>>,
) -> std::result::Result<String, ShellError> {
    handle
        .join()
        .map_err(|_| ShellError::HostError("shell output reader thread panicked".to_string()))?
        .map_err(ShellError::HostError)
}

#[cfg(windows)]
fn default_shell_command(command: &str) -> Command {
    let mut shell = Command::new("cmd");
    shell.arg("/C").arg(command);
    shell
}

#[cfg(not(windows))]
fn default_shell_command(command: &str) -> Command {
    let mut shell = Command::new("/bin/sh");
    shell.arg("-c").arg(command);
    shell
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
            ProviderSource::NativeShell => "native shell".to_string(),
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

impl<'a> RuntimeCallInterfaceId<'a> {
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

fn parse_runtime_call_interface_id(value: &str) -> Result<RuntimeCallInterfaceId<'_>> {
    let interface = value
        .split_once("::")
        .map_or(value, |(interface, _)| interface);
    let (namespace_and_package, interface_and_version) = interface
        .split_once('/')
        .with_context(|| format!("runtime.call interface `{value}` must be `package/interface`"))?;
    let package = namespace_and_package
        .split_once(':')
        .map_or(namespace_and_package, |(_, package)| package);
    if package.is_empty() {
        bail!("runtime.call interface `{value}` has empty package");
    }
    let (interface, version) = match interface_and_version.rsplit_once('@') {
        Some((interface, version)) => (interface, Some(parse_version(version)?)),
        None => (interface_and_version, None),
    };
    if interface.is_empty() {
        bail!("runtime.call interface `{value}` has empty interface");
    }
    Ok(RuntimeCallInterfaceId {
        package,
        interface,
        version,
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

fn resolve_runtime_call_func<'a>(
    funcs: &'a BTreeMap<String, ExportedFunc>,
    target: &str,
) -> Result<Option<(&'a String, &'a ExportedFunc)>> {
    if let Some((key, func)) = funcs.get_key_value(target) {
        return Ok(Some((key, func)));
    }

    let Some((interface, function)) = target.split_once("::") else {
        return Ok(None);
    };
    let requested = parse_runtime_call_interface_id(interface)?;
    let mut matches = funcs
        .iter()
        .filter(|(key, _)| runtime_call_key_matches_request(key, &requested, function))
        .collect::<Vec<_>>();

    match matches.len() {
        0 => Ok(None),
        1 => {
            let (key, func) = matches.swap_remove(0);
            Ok(Some((key, func)))
        }
        _ => {
            let options = matches
                .into_iter()
                .map(|(key, _)| format!("  {key}"))
                .collect::<Vec<_>>()
                .join("\n");
            bail!("ambiguous runtime.call `{target}` matches:\n{options}");
        }
    }
}

fn runtime_call_key_matches_request(
    key: &str,
    requested: &RuntimeCallInterfaceId<'_>,
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

fn default_compiled_component_cache_dir(root: &Path) -> PathBuf {
    std::env::var_os("GAMS_WASMTIME_CACHE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join("build.nosync/wasmtime-cache"))
}

fn compiled_component_cache_format_dir() -> String {
    format!(
        "wasmtime44-component-exceptions-v1-{}-{}",
        std::env::consts::OS,
        std::env::consts::ARCH
    )
}

fn compiled_component_cache_path(cache_dir: &Path, source_path: &Path) -> PathBuf {
    let source = source_path.to_string_lossy();
    let hash = fnv1a64(source.as_bytes());
    let file_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("component.wasm");
    cache_dir
        .join(compiled_component_cache_format_dir())
        .join(format!("{hash:016x}-{file_name}.cwasm"))
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

fn compiled_component_cache_is_fresh(source_path: &Path, cache_path: &Path) -> Result<bool> {
    if !cache_path.exists() {
        return Ok(false);
    }
    let source_mtime = fs::metadata(source_path)
        .with_context(|| format!("failed to stat component {}", source_path.display()))?
        .modified()
        .with_context(|| {
            format!(
                "failed to read mtime for component {}",
                source_path.display()
            )
        })?;
    let cache_mtime = fs::metadata(cache_path)
        .with_context(|| format!("failed to stat component cache {}", cache_path.display()))?
        .modified()
        .with_context(|| {
            format!(
                "failed to read mtime for component cache {}",
                cache_path.display()
            )
        })?;
    Ok(cache_mtime >= source_mtime)
}

fn write_compiled_component_cache(
    source_path: &Path,
    cache_path: &Path,
    bytes: &[u8],
) -> Result<()> {
    let parent = cache_path.parent().with_context(|| {
        format!(
            "compiled component cache path has no parent: {}",
            cache_path.display()
        )
    })?;
    fs::create_dir_all(parent).with_context(|| {
        format!(
            "failed to create compiled component cache directory {}",
            parent.display()
        )
    })?;
    let tmp_path = cache_path.with_extension("cwasm.tmp");
    fs::write(&tmp_path, bytes).with_context(|| {
        format!(
            "failed to write compiled component cache {} for {}",
            tmp_path.display(),
            source_path.display()
        )
    })?;
    fs::rename(&tmp_path, cache_path).with_context(|| {
        format!(
            "failed to install compiled component cache {} for {}",
            cache_path.display(),
            source_path.display()
        )
    })?;
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
    use super::{compiled_component_cache_path, FsPreopen, Runtime};
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
    fn compiled_component_cache_is_written_and_reused() {
        let path = "../../../build.nosync/plugins/adder.comp.wasm";
        if !std::path::Path::new(path).exists() {
            eprintln!(
                "skipping compiled cache test; build it with `make build.nosync/plugins/adder.comp.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../..").canonicalize().unwrap();
        let source = PathBuf::from(path).canonicalize().unwrap();
        let cache_dir = tempfile::tempdir().unwrap();
        let cache_path = compiled_component_cache_path(cache_dir.path(), &source);

        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .set_compiled_component_cache_dir(cache_dir.path().to_path_buf())
            .unwrap();
        runtime
            .add_plugins(vec![source.display().to_string()], false)
            .unwrap();
        assert!(
            cache_path.exists(),
            "missing cache {}",
            cache_path.display()
        );
        let first_cache_mtime = std::fs::metadata(&cache_path).unwrap().modified().unwrap();

        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .set_compiled_component_cache_dir(cache_dir.path().to_path_buf())
            .unwrap();
        runtime
            .add_plugins(vec![source.display().to_string()], false)
            .unwrap();
        let second_cache_mtime = std::fs::metadata(&cache_path).unwrap().modified().unwrap();
        assert_eq!(first_cache_mtime, second_cache_mtime);
        let value = runtime
            .invoke("adder/add::add", serde_json::json!([2, 3]))
            .unwrap();
        assert_eq!(value, serde_json::json!(5));

        runtime.clear_compiled_component_cache().unwrap();
        assert!(!cache_path.exists());
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
    fn invokes_native_shell_from_runtime_invoke() {
        let root = tempfile::tempdir().unwrap();
        let runtime =
            Runtime::new_at(root.path().to_path_buf(), test_preopens(root.path())).unwrap();
        let value = runtime
            .invoke(
                "shell/shell::run",
                serde_json::json!(["printf shell-ok", 5_000]),
            )
            .unwrap();
        assert_eq!(value["ok"]["exit-code"], serde_json::json!(0));
        assert_eq!(value["ok"]["stdout"], serde_json::json!("shell-ok"));
        assert_eq!(value["ok"]["stderr"], serde_json::json!(""));
    }

    #[test]
    fn native_shell_timeout_is_structured_error() {
        let root = tempfile::tempdir().unwrap();
        let runtime =
            Runtime::new_at(root.path().to_path_buf(), test_preopens(root.path())).unwrap();
        let value = runtime
            .invoke("shell/shell::run", serde_json::json!(["sleep 1", 1]))
            .unwrap();
        assert_eq!(value["err"]["case"], serde_json::json!("timeout"));
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

        let stat = runtime
            .invoke("fs/fs::stat", serde_json::json!(["gams.json"]))
            .unwrap();
        assert_eq!(stat["ok"]["type"], "regular-file");
        assert!(stat["ok"]["size"].as_u64().unwrap() > 0, "{stat}");

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
    fn fs_proxy_mutates_files_and_directories_through_wasi() {
        let fs = PathBuf::from("../../../build.nosync/plugins/fs.wasm");
        if !fs.exists() {
            eprintln!(
                "skipping fs proxy mutation test; build it with `make build.nosync/plugins/fs.wasm`"
            );
            return;
        }

        let temp = tempfile::tempdir().unwrap();
        let plugins_dir = temp.path().join("plugins");
        std::fs::create_dir(&plugins_dir).unwrap();
        std::fs::copy(fs, plugins_dir.join("fs.wasm")).unwrap();

        let runtime =
            Runtime::new_at(temp.path().to_path_buf(), test_preopens(temp.path())).unwrap();
        runtime
            .add_plugins(vec!["plugins/fs.wasm".to_string()], false)
            .unwrap();

        let created = runtime
            .invoke("fs/fs::create-dir", serde_json::json!(["assets"]))
            .unwrap();
        assert!(created.get("ok").is_some(), "{created}");

        let written_text = runtime
            .invoke(
                "fs/fs::write-text",
                serde_json::json!(["assets/hello.txt", "hello"]),
            )
            .unwrap();
        assert!(written_text.get("ok").is_some(), "{written_text}");

        let updated_text = runtime
            .invoke(
                "fs/fs::write-text",
                serde_json::json!(["assets/hello.txt", "updated"]),
            )
            .unwrap();
        assert!(updated_text.get("ok").is_some(), "{updated_text}");

        let text = runtime
            .invoke("fs/fs::read-text", serde_json::json!(["assets/hello.txt"]))
            .unwrap();
        assert_eq!(text["ok"], "updated");

        let written_file = runtime
            .invoke(
                "fs/fs::write-file",
                serde_json::json!(["assets/blob.bin", [0, 1, 255]]),
            )
            .unwrap();
        assert!(written_file.get("ok").is_some(), "{written_file}");

        let file = runtime
            .invoke("fs/fs::read-file", serde_json::json!(["assets/blob.bin"]))
            .unwrap();
        assert_eq!(file["ok"], serde_json::json!([0, 1, 255]));

        let renamed_file = runtime
            .invoke(
                "fs/fs::rename",
                serde_json::json!(["assets/hello.txt", "assets/renamed.txt"]),
            )
            .unwrap();
        assert!(renamed_file.get("ok").is_some(), "{renamed_file}");

        let removed_file = runtime
            .invoke(
                "fs/fs::remove-file",
                serde_json::json!(["assets/renamed.txt"]),
            )
            .unwrap();
        assert!(removed_file.get("ok").is_some(), "{removed_file}");
        let removed_blob = runtime
            .invoke("fs/fs::remove-file", serde_json::json!(["assets/blob.bin"]))
            .unwrap();
        assert!(removed_blob.get("ok").is_some(), "{removed_blob}");

        let renamed_dir = runtime
            .invoke("fs/fs::rename", serde_json::json!(["assets", "assets2"]))
            .unwrap();
        assert!(renamed_dir.get("ok").is_some(), "{renamed_dir}");
        let dir_stat = runtime
            .invoke("fs/fs::stat", serde_json::json!(["assets2"]))
            .unwrap();
        assert_eq!(dir_stat["ok"]["type"], "directory");

        let removed_dir = runtime
            .invoke("fs/fs::remove-dir", serde_json::json!(["assets2"]))
            .unwrap();
        assert!(removed_dir.get("ok").is_some(), "{removed_dir}");
    }

    #[test]
    fn lua_component_runs_script_and_calls_runtime() {
        let lua = "../../../build.nosync/plugins/lua.comp.wasm";
        if !std::path::Path::new(lua).exists() {
            eprintln!(
                "skipping lua component smoke test; build it with `make build.nosync/plugins/lua.comp.wasm`"
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
                    "plugins/fs.comp.wasm".to_string(),
                    "plugins/lua.comp.wasm".to_string(),
                ],
                false,
            )
            .unwrap();

        let source = [
            "function main()",
            "  return { answer = 42, ok = true }",
            "end",
        ]
        .join("\n");
        let value = runtime
            .invoke("lua/lua::run", serde_json::json!([source]))
            .unwrap();
        let parsed: serde_json::Value =
            serde_json::from_str(value["ok"].as_str().unwrap()).unwrap();
        assert_eq!(parsed, serde_json::json!({ "answer": 42, "ok": true }));

        let source = [
            "function main()",
            "  local text = fs.read_text('ng/run.lua')",
            "  return string.find(text, 'function main()', 1, true) ~= nil",
            "end",
        ]
        .join("\n");
        let fs_read = runtime
            .invoke("lua/lua::run", serde_json::json!([source]))
            .unwrap();
        assert_eq!(fs_read["ok"].as_str().unwrap(), "true");

        let source = [
            "function main()",
            "  local text = host.call('fs/fs::read-text', 'ng/run.lua')",
            "  return string.find(text, 'function main()', 1, true) ~= nil",
            "end",
        ]
        .join("\n");
        let component_call = runtime
            .invoke("lua/lua::run", serde_json::json!([source]))
            .unwrap();
        assert_eq!(component_call["ok"].as_str().unwrap(), "true");

        let source = [
            "function main()",
            "  local text = host.call('gams:fs/fs::read-text', 'ng/run.lua')",
            "  return string.find(text, 'function main()', 1, true) ~= nil",
            "end",
        ]
        .join("\n");
        let full_component_call = runtime
            .invoke("lua/lua::run", serde_json::json!([source]))
            .unwrap();
        assert_eq!(full_component_call["ok"].as_str().unwrap(), "true");

        let source = [
            "function main()",
            "  local ok, message = pcall(host.call, 'fs/fs::read-text', 'missing.lua')",
            "  return ok == false and string.len(tostring(message)) > 0",
            "end",
        ]
        .join("\n");
        let handled_error = runtime
            .invoke("lua/lua::run", serde_json::json!([source]))
            .unwrap();
        assert_eq!(handled_error["ok"].as_str().unwrap(), "true");

        let graph = serde_json::json!([
            {
                "id": 1,
                "kind": 4,
                "inputs": [],
                "outputs": [{ "id": 1, "name": "", "value": "41" }]
            },
            {
                "id": 2,
                "kind": 2,
                "name": "positions",
                "codePath": "ng/positions.lua",
                "inputs": [{ "id": 1, "name": "", "srcNodeId": 1, "srcOutputId": 1 }],
                "outputs": [
                    { "id": 1, "name": "entity", "value": "" },
                    { "id": 2, "name": "positions", "value": "" }
                ]
            },
            {
                "id": 3,
                "kind": 1,
                "name": "result",
                "inputs": [
                    { "id": 1, "name": "entity", "srcNodeId": 2, "srcOutputId": 1 },
                    { "id": 2, "name": "positions", "srcNodeId": 2, "srcOutputId": 2 }
                ],
                "outputs": []
            }
        ]);
        let compiler = std::fs::read_to_string(root.join("ng/run.lua")).unwrap();
        let compiler_source = format!(
            "_G.input = {}\n{}",
            serde_json::to_string(&graph.to_string()).unwrap(),
            compiler
        );
        let generated = runtime
            .invoke("lua/lua::run", serde_json::json!([compiler_source]))
            .unwrap();
        let generated_source = generated["ok"].as_str().unwrap();
        assert!(generated_source.contains("function main()"));
        assert!(generated_source.contains("return output"));
        let graph_run = runtime
            .invoke("lua/lua::run", serde_json::json!([generated_source]))
            .unwrap();
        let graph_result: serde_json::Value =
            serde_json::from_str(graph_run["ok"].as_str().unwrap()).unwrap();
        assert_eq!(graph_result["result"]["inputs"]["entity"], "42");
        assert_eq!(graph_result["result"]["active"]["entity"], true);

        let source = [
            "function main()",
            "  return host.call('view:test', '{\"ping\":true}')",
            "end",
        ]
        .join("\n");
        let host_call = runtime
            .invoke("lua/lua::run", serde_json::json!([source]))
            .unwrap();
        assert!(host_call["err"]
            .as_str()
            .unwrap()
            .contains("frontend view bridge is not attached"));

        let source = [
            "function main()",
            "  local typo = nil",
            "  return typo.missing",
            "end",
        ]
        .join("\n");
        let lua_error = runtime
            .invoke("lua/lua::run", serde_json::json!([source]))
            .unwrap();
        assert!(lua_error["err"].as_str().unwrap().contains("nil"));
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
    fn image_component_resources_round_trip_through_json_refs() {
        let image = "../../../build.nosync/plugins/image.comp.wasm";
        if !std::path::Path::new(image).exists() {
            eprintln!(
                "skipping image resource test; build it with `make build.nosync/plugins/image.comp.wasm`"
            );
            return;
        }

        let root = PathBuf::from("../../../examples/demo")
            .canonicalize()
            .unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/image.comp.wasm".to_string()], false)
            .unwrap();

        let created = runtime
            .invoke(
                "image/image::create",
                serde_json::json!([2, 3, { "r": 1, "g": 2, "b": 3, "a": 4 }]),
            )
            .unwrap();
        let resource = created.get("ok").unwrap();
        assert_eq!(resource["$resource"], serde_json::json!("gams:image/image"));
        assert!(resource["id"].as_str().unwrap().starts_with("res_"));

        let info = runtime
            .invoke("image/image::info", serde_json::json!([resource]))
            .unwrap();
        assert_eq!(
            info,
            serde_json::json!({
                "ok": {
                    "width": 2,
                    "height": 3,
                    "pixel-format": "rgba8"
                }
            })
        );

        let pixel = runtime
            .invoke(
                "image/image::read-pixel",
                serde_json::json!([resource, { "x": 1, "y": 2 }]),
            )
            .unwrap();
        assert_eq!(
            pixel,
            serde_json::json!({ "ok": { "r": 1, "g": 2, "b": 3, "a": 4 } })
        );

        assert_eq!(
            runtime.diagnostics().unwrap()["jsonResourceRefs"],
            serde_json::json!(1)
        );
        runtime.release_resource(resource.clone()).unwrap();
        assert_eq!(
            runtime.diagnostics().unwrap()["jsonResourceRefs"],
            serde_json::json!(0)
        );
        let after_release = runtime
            .invoke("image/image::info", serde_json::json!([resource]))
            .unwrap_err();
        assert!(after_release.contains("unknown resource ref"));
    }

    #[test]
    fn image_component_opens_exports_and_saves_files() {
        let image_plugin = "../../../build.nosync/plugins/image.comp.wasm";
        if !std::path::Path::new(image_plugin).exists() {
            eprintln!(
                "skipping image file test; build it with `make build.nosync/plugins/image.comp.wasm`"
            );
            return;
        }

        let repo = PathBuf::from("../../..").canonicalize().unwrap();
        let temp = tempfile::tempdir().unwrap();
        std::fs::copy(
            repo.join("examples/demo/ng/nine.png"),
            temp.path().join("input.png"),
        )
        .unwrap();
        std::fs::create_dir(temp.path().join("plugins")).unwrap();
        std::fs::copy(
            repo.join("build.nosync/plugins/image.comp.wasm"),
            temp.path().join("plugins/image.comp.wasm"),
        )
        .unwrap();

        let root = temp.path().canonicalize().unwrap();
        let runtime = Runtime::new_at(root.clone(), test_preopens(&root)).unwrap();
        runtime
            .add_plugins(vec!["plugins/image.comp.wasm".to_string()], false)
            .unwrap();

        let opened = runtime
            .invoke("image/image::open", serde_json::json!(["input.png"]))
            .unwrap();
        let resource = opened.get("ok").unwrap();
        assert_eq!(resource["$resource"], serde_json::json!("gams:image/image"));

        let info = runtime
            .invoke("image/image::info", serde_json::json!([resource]))
            .unwrap();
        assert_eq!(info["ok"]["pixel-format"], serde_json::json!("rgba8"));
        let width = info["ok"]["width"].as_u64().unwrap();
        let height = info["ok"]["height"].as_u64().unwrap();
        assert!(width > 0);
        assert!(height > 0);

        let exported_qoi = runtime
            .invoke("image/image::export", serde_json::json!([resource, "qoi"]))
            .unwrap();
        let qoi_bytes = exported_qoi["ok"].as_array().unwrap();
        assert_eq!(qoi_bytes[0], serde_json::json!(113));
        assert_eq!(qoi_bytes[1], serde_json::json!(111));
        assert_eq!(qoi_bytes[2], serde_json::json!(105));
        assert_eq!(qoi_bytes[3], serde_json::json!(102));

        let exported_png = runtime
            .invoke("image/image::export", serde_json::json!([resource, "png"]))
            .unwrap();
        let png_bytes = exported_png["ok"].as_array().unwrap();
        assert_eq!(png_bytes[0], serde_json::json!(137));
        assert_eq!(png_bytes[1], serde_json::json!(80));
        assert_eq!(png_bytes[2], serde_json::json!(78));
        assert_eq!(png_bytes[3], serde_json::json!(71));

        let saved_qoi = runtime
            .invoke(
                "image/image::save",
                serde_json::json!([resource, "out.qoi", "qoi"]),
            )
            .unwrap();
        assert!(saved_qoi["ok"].as_u64().unwrap() > 0);
        assert!(root.join("out.qoi").exists());

        let saved_png = runtime
            .invoke(
                "image/image::save",
                serde_json::json!([resource, "out.png", "png"]),
            )
            .unwrap();
        assert!(saved_png["ok"].as_u64().unwrap() > 0);
        assert!(root.join("out.png").exists());

        let reopened_qoi = runtime
            .invoke("image/image::open", serde_json::json!(["out.qoi"]))
            .unwrap();
        let reopened_qoi_resource = reopened_qoi.get("ok").unwrap();
        let reopened_qoi_info = runtime
            .invoke(
                "image/image::info",
                serde_json::json!([reopened_qoi_resource]),
            )
            .unwrap();
        assert_eq!(reopened_qoi_info["ok"]["width"], serde_json::json!(width));
        assert_eq!(reopened_qoi_info["ok"]["height"], serde_json::json!(height));

        let reopened_png = runtime
            .invoke("image/image::open", serde_json::json!(["out.png"]))
            .unwrap();
        let reopened_png_resource = reopened_png.get("ok").unwrap();
        let reopened_png_info = runtime
            .invoke(
                "image/image::info",
                serde_json::json!([reopened_png_resource]),
            )
            .unwrap();
        assert_eq!(reopened_png_info["ok"]["width"], serde_json::json!(width));
        assert_eq!(reopened_png_info["ok"]["height"], serde_json::json!(height));
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
