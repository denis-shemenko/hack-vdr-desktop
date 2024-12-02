// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::sync::Mutex;
use tauri::Manager;
use tauri::{command, State};

struct UploadState(Mutex<Vec<String>>);

#[command]
async fn upload_file(file_path: String, state: State<'_, UploadState>) -> Result<String, String> {
    // Read file content
    let content = fs::read(&file_path).map_err(|e| e.to_string())?;

    // Upload logic here (example: store file path in state)
    let mut uploads = state.0.lock().unwrap();
    uploads.push(file_path.clone());

    Ok(format!("File uploaded successfully: {}", file_path))
}

#[command]
async fn download_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path).map_err(|e| e.to_string())
}

#[command]
async fn delete_file(file_path: String) -> Result<String, String> {
    fs::remove_file(&file_path).map_err(|e| e.to_string())?;
    Ok("File deleted successfully".into())
}

#[command]
async fn read_file(file_path: String) -> Result<Vec<u8>, String> {
    fs::read(&file_path).map_err(|e| e.to_string())
}

fn main() {
    //vdr_desktop_app_lib::run()
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(UploadState(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            upload_file,
            download_file,
            delete_file,
            read_file
        ])
        // .register_uri_scheme_protocol("local-file", move |_app, request| {
        //     // Handle local file protocol
        //     ResponseBuilder::new().status(200).body(Vec::new())
        // })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
