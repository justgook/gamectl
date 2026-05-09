mod fs;
mod runtime;

use tauri::WebviewUrl;
use tauri::WebviewWindowBuilder;
use tauri_plugin_cli::CliExt;

#[tauri::command]
fn runtime_call(
    plugin: String,
    method: String,
    input: Vec<u8>,
    runtime: tauri::State<'_, runtime::Runtime>,
) -> Result<Vec<u8>, String> {
    runtime.call(&plugin, &method, input)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let runtime = runtime::Runtime::new().expect("failed to initialize GAMS runtime");

    tauri::Builder::default()
        .manage(runtime)
        .plugin(tauri_plugin_cli::init())
        .setup(|app| {
           // match app.cli().matches() {
           //     // `matches` here is a Struct with { args, subcommand }.
           //     // `args` is `HashMap<String, ArgData>` where `ArgData` is a struct with { value, occurrences }.
           //     // `subcommand` is `Option<Box<SubcommandMatches>>` where `SubcommandMatches` is a struct with { name, matches }.
           //     Ok(matches) => {
           //         println!("{:?}", matches)
           //     }
           //     Err(_) => {}
           // }
           // Ok(())



            let matches = app.cli().matches().map_err(|e| e.to_string())?;

               if let Some(subcommand) = matches.subcommand {
                   match subcommand.name.as_str() {
                       "run" => {
                           println!("CLI result here");
                           std::process::exit(0);
                       }

                       _ => {}
                   }
               }

               WebviewWindowBuilder::new(
                   app,
                   "main",
                   WebviewUrl::App("index.html".into()),
               )
               .title("gams")
               .inner_size(800.0, 600.0)
               .build()?;

               Ok(())

       })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![runtime_call])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
