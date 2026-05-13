mod runtime;

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
fn runtime_invoke(
    target: String,
    args: serde_json::Value,
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<serde_json::Value, String> {
    runtime.invoke(&target, args)
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let runtime = runtime::Runtime::new().expect("failed to initialize GAMS runtime");

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
