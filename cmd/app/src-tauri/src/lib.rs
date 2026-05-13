mod runtime;

use std::path::{Path, PathBuf};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_cli::CliExt;

#[tauri::command]
fn runtime_add_plugins(
    paths: Vec<String>,
    reload: bool,
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<Vec<runtime::ComponentHandle>, String> {
    runtime.add_plugins(paths, reload)
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

fn runtime_root() -> anyhow::Result<PathBuf> {
    let raw = match std::env::var("GAMS_APP_CWD") {
        Ok(value) if !value.is_empty() => PathBuf::from(value),
        _ => std::env::current_dir()?,
    };
    Ok(raw.canonicalize()?)
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
        .setup(|app| {
            app.state::<runtime::Runtime>()
                .attach_app_handle(app.handle().clone())?;

            let matches = app.cli().matches().map_err(|error| error.to_string())?;
            if let Some(subcommand) = matches.subcommand {
                match subcommand.name.as_str() {
                    "run" => {
                        println!("GAMS component runtime CLI bootstrap is not implemented yet");
                        std::process::exit(0);
                    }
                    other => return Err(format!("unknown CLI subcommand `{other}`").into()),
                }
            }

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("gams")
                .inner_size(1000.0, 700.0)
                .build()?;

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            runtime_add_plugins,
            runtime_invoke,
            runtime_diagnostics,
            runtime_call_view_ready,
            runtime_call_view_response,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
