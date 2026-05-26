mod runtime;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_cli::CliExt;
use tauri_plugin_cli::{ArgData, Matches};

#[tauri::command]
async fn runtime_add_plugins(
    paths: Vec<String>,
    reload: bool,
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<Vec<runtime::ComponentHandle>, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.add_plugins(paths, reload))
        .await
        .map_err(|error| format!("runtime add plugins task failed: {error}"))?
}

#[tauri::command]
async fn runtime_invoke(
    target: String,
    args: serde_json::Value,
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<serde_json::Value, String> {
    let runtime = runtime.inner().clone();
    tauri::async_runtime::spawn_blocking(move || runtime.invoke(&target, args))
        .await
        .map_err(|error| format!("runtime invoke task failed: {error}"))?
}

#[tauri::command]
fn runtime_diagnostics(
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<serde_json::Value, String> {
    runtime.diagnostics()
}

#[tauri::command]
fn runtime_release_resource(
    resource: serde_json::Value,
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<(), String> {
    runtime.release_resource(resource)
}

#[tauri::command]
fn runtime_call_view_ready(runtime: tauri::State<'_, runtime::Runtime>) -> Result<(), String> {
    runtime.mark_call_view_ready()
}

#[tauri::command]
fn runtime_call_view_response(
    id: String,
    ok: Option<String>,
    err: Option<String>,
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<(), String> {
    runtime.respond_to_call_view(id, ok, err)
}

#[tauri::command]
fn runtime_clear_compiled_component_cache(
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<(), String> {
    runtime.clear_compiled_component_cache()
}

fn runtime_root() -> anyhow::Result<PathBuf> {
    let raw = match std::env::var("GAMS_APP_CWD") {
        Ok(value) if !value.is_empty() => PathBuf::from(value),
        _ => std::env::current_dir()?,
    };
    Ok(raw.canonicalize()?)
}

fn cli_arg_string(args: &HashMap<String, ArgData>, name: &str) -> anyhow::Result<Option<String>> {
    let Some(arg) = args.get(name) else {
        return Ok(None);
    };
    match &arg.value {
        serde_json::Value::Null => Ok(None),
        serde_json::Value::String(value) => Ok(Some(value.clone())),
        other => anyhow::bail!("CLI argument `{name}` must be a string, got {other}"),
    }
}

fn cli_arg_strings(args: &HashMap<String, ArgData>, name: &str) -> anyhow::Result<Vec<String>> {
    let Some(arg) = args.get(name) else {
        return Ok(Vec::new());
    };
    match &arg.value {
        serde_json::Value::Null => Ok(Vec::new()),
        serde_json::Value::String(value) => Ok(vec![value.clone()]),
        serde_json::Value::Array(values) => values
            .iter()
            .map(|value| match value {
                serde_json::Value::String(value) => Ok(value.clone()),
                other => anyhow::bail!("CLI argument `{name}` values must be strings, got {other}"),
            })
            .collect(),
        other => anyhow::bail!("CLI argument `{name}` must be a string array, got {other}"),
    }
}

fn is_wasi_http_proxy_export(export: &str) -> bool {
    export.starts_with("wasi:http/incoming-handler")
        || export.starts_with("wasi:http/handler")
        || export.starts_with("wasi:http/proxy")
}

fn run_cli_command(
    root: &Path,
    runtime: &runtime::Runtime,
    matches: &Matches,
) -> anyhow::Result<bool> {
    let Some(subcommand) = &matches.subcommand else {
        return Ok(false);
    };

    match subcommand.name.as_str() {
        "add" => {
            let Some(add_subcommand) = &subcommand.matches.subcommand else {
                anyhow::bail!("`add` requires one of: plugin, theme, view");
            };
            match add_subcommand.name.as_str() {
                "plugin" => {
                    let path = cli_arg_string(&add_subcommand.matches.args, "path")?
                        .ok_or_else(|| anyhow::anyhow!("`add plugin` requires a plugin path"))?;
                    let cache_path = runtime
                        .cache_component(PathBuf::from(path))
                        .map_err(|error| anyhow::anyhow!(error))?;
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&serde_json::json!({
                            "cached": cache_path,
                        }))?
                    );
                }
                "theme" => println!("`add theme` is not implemented yet"),
                "view" => println!("`add view` is not implemented yet"),
                other => anyhow::bail!("unknown `add` subcommand `{other}`"),
            }
        }
        "clean" => {
            runtime
                .clear_compiled_component_cache()
                .map_err(|error| anyhow::anyhow!(error))?;
            println!("compiled component cache cleared");
        }
        "serve" => {
            let addr = cli_arg_string(&subcommand.matches.args, "addr")?
                .unwrap_or_else(|| "127.0.0.1:8080".to_string());
            let plugin_paths = cli_arg_strings(&subcommand.matches.args, "plug")?;
            if plugin_paths.is_empty() {
                anyhow::bail!("`serve` requires at least one --plug component");
            }
            let handles = runtime
                .add_component_files(plugin_paths.into_iter().map(PathBuf::from).collect())
                .map_err(|error| anyhow::anyhow!(error))?;
            let http_handlers = handles
                .iter()
                .filter(|handle| {
                    handle
                        .exports
                        .iter()
                        .any(|export| is_wasi_http_proxy_export(export))
                })
                .collect::<Vec<_>>();
            match http_handlers.as_slice() {
                [] => anyhow::bail!(
                    "`serve` loaded components successfully, but none export wasi:http/proxy"
                ),
                [handler] => {
                    println!(
                        "`serve` validated component graph. HTTP handler: {}. Next step: start HTTP server on {addr} and route requests to its wasi:http/proxy export.",
                        handler.path
                    );
                }
                handlers => {
                    let paths = handlers
                        .iter()
                        .map(|handler| handler.path.as_str())
                        .collect::<Vec<_>>();
                    anyhow::bail!(
                        "`serve` expected exactly one wasi:http/proxy exporter, found {}: {}",
                        paths.len(),
                        paths.join(", ")
                    );
                }
            }
        }
        "init" => {
            let path = root.join("gams.json");
            let file = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(|error| anyhow::anyhow!("failed to create {}: {error}", path.display()))?;
            serde_json::to_writer_pretty(file, &serde_json::json!({}))?;
            println!("created {}", path.display());
        }
        "run" => {
            let plugin_paths = cli_arg_strings(&subcommand.matches.args, "plug")?;
            if !plugin_paths.is_empty() {
                runtime
                    .add_component_files(plugin_paths.into_iter().map(PathBuf::from).collect())
                    .map_err(|error| anyhow::anyhow!(error))?;
            }
            let Some(target) = cli_arg_string(&subcommand.matches.args, "target")? else {
                println!(
                    "`run` needs a target; use `run --plug path/to/plugin.wasm target '[args]'`"
                );
                return Ok(true);
            };
            let args = cli_arg_string(&subcommand.matches.args, "args")?
                .map(|raw| serde_json::from_str(&raw))
                .transpose()?
                .unwrap_or_else(|| serde_json::json!([]));
            let value = runtime
                .invoke(&target, args)
                .map_err(|error| anyhow::anyhow!(error))?;
            println!("{}", serde_json::to_string_pretty(&value)?);
        }
        other => anyhow::bail!("unknown CLI subcommand `{other}`"),
    }

    Ok(true)
}

fn preopens_for_root(root: &Path) -> anyhow::Result<Vec<runtime::FsPreopen>> {
    let mut preopens = vec![
        runtime::FsPreopen {
            host_path: root.to_path_buf(),
            guest_path: ".".to_string(),
        },
        runtime::FsPreopen {
            host_path: root.to_path_buf(),
            guest_path: root.to_string_lossy().into_owned(),
        },
    ];

    for entry in std::fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_symlink() {
            continue;
        }
        let target = entry.path().canonicalize()?;
        if target.is_dir() {
            preopens.push(runtime::FsPreopen {
                host_path: target,
                guest_path: entry.file_name().to_string_lossy().into_owned(),
            });
        }
    }

    Ok(preopens)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let root = runtime_root().expect("failed to resolve GAMS runtime root");
    let runtime = runtime::Runtime::new_at(
        root.clone(),
        preopens_for_root(&root).expect("failed to build GAMS filesystem preopens"),
    )
    .expect("failed to initialize GAMS runtime");

    tauri::Builder::default()
        .manage(runtime)
        .plugin(tauri_plugin_cli::init())
        .setup(move |app| {
            let runtime = app.state::<runtime::Runtime>();
            runtime.attach_app_handle(app.handle().clone())?;
            let cache_dir = match std::env::var_os("GAMS_WASMTIME_CACHE_DIR") {
                Some(path) => PathBuf::from(path),
                None => app
                    .path()
                    .app_cache_dir()
                    .map_err(|error| error.to_string())?
                    .join("wasmtime-components"),
            };
            runtime.set_compiled_component_cache_dir(cache_dir)?;

            let matches = app.cli().matches().map_err(|error| error.to_string())?;
            match run_cli_command(&root, &runtime, &matches) {
                Ok(true) => std::process::exit(0),
                Ok(false) => {}
                Err(error) => {
                    eprintln!("error: {error:#}");
                    std::process::exit(1);
                }
            }

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("GAMS")
                .inner_size(1000.0, 700.0)
                .build()?;

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            runtime_add_plugins,
            runtime_invoke,
            runtime_diagnostics,
            runtime_release_resource,
            runtime_call_view_ready,
            runtime_call_view_response,
            runtime_clear_compiled_component_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
