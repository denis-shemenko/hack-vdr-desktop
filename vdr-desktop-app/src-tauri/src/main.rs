// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::sync::Mutex;
use tauri::image::Image;
use tauri::menu::{Menu, MenuBuilder, MenuItem, MenuItemBuilder};
//use tauri::tray::{ClickType, TrayIcon, TrayIconBuilder};
use tauri::tray::TrayIconBuilder;
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Create menu items first
            let show_item = MenuItemBuilder::new("Show")
                .accelerator("Ctrl+Shift+S")
                .build(app)?;
            let hide_item = MenuItemBuilder::new("Hide")
                .accelerator("Ctrl+Shift+H")
                .build(app)?;
            let quit_item = MenuItemBuilder::new("Quit")
                .accelerator("Ctrl+Shift+Q")
                .build(app)?;

            // Build menu with resolved items
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&hide_item)
                .item(&quit_item)
                .build()?;

            app.set_menu(tray_menu)?;

            app.on_menu_event(move |app, event| {
                let window = app.get_webview_window("main").unwrap();
                if event.id() == quit_item.id() {
                    app.exit(0);
                } else if event.id() == show_item.id() {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                } else if event.id() == hide_item.id() {
                    window.hide().unwrap();
                }
            });

            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide_i = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            //let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;
            let menu = Menu::with_items(app, &[&quit_i, &show_i, &hide_i])?;

            let icon_bytes = include_bytes!("../icons/cropped-ideals_favicon_new-1-32x32.png");
            let icon_tray = Image::new_owned(icon_bytes.to_vec(), 32, 32);

            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .menu_on_left_click(true)
                //.icon(icon_tray)
                .icon(app.default_window_icon().unwrap().clone())
                .build(app)?;

            app.tray_by_id(tray.id());

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .on_window_event(|app, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let window = app.get_webview_window("main").unwrap();
                window.hide().unwrap();
            }
        })
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
