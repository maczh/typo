mod atomic_file;
mod commands;
mod image_files;
mod models;
mod state;
#[cfg(target_os = "linux")]
mod webview;

use std::sync::Mutex;
#[cfg(target_os = "macos")]
use tauri::Emitter;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

#[derive(Default)]
struct OpenFiles(Mutex<Vec<String>>);

#[tauri::command]
fn take_open_files(files: tauri::State<OpenFiles>) -> Result<Vec<String>, String> {
    let mut pending = files.0.lock().map_err(|e| e.to_string())?;
    Ok(std::mem::take(&mut *pending))
}

#[tauri::command]
async fn new_window(app: tauri::AppHandle) -> Result<(), String> {
    let label = format!("document-{}", crate::state::now_ms());
    tauri::WebviewWindowBuilder::new(&app, label, tauri::WebviewUrl::App("index.html".into()))
        .title("Typo")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_window_state(
    app: tauri::AppHandle,
    state: crate::models::WindowState,
) -> Result<(), String> {
    if state.width == 0 || state.height == 0 {
        return Err("window dimensions must be positive".into());
    }
    app.state::<AppState>().persist_window_state(&app, state)
}

/// Exit the native application after the frontend has completed any document
/// confirmation. `AppHandle::exit` terminates all windows and the event loop;
/// unlike closing the current window it cannot leave other document windows or
/// their webviews running.
#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !["https://", "http://", "mailto:"]
        .iter()
        .any(|scheme| url.starts_with(scheme))
    {
        return Err("Unsupported link protocol".into());
    }
    #[cfg(target_os = "linux")]
    let mut command = std::process::Command::new("xdg-open");
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = std::process::Command::new("rundll32.exe");
        command.arg("url.dll,FileProtocolHandler");
        command
    };
    command.arg(url).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn markdown_path(path: &std::path::Path) -> bool {
    path.is_file()
        && path
            .extension()
            .and_then(|s| s.to_str())
            .is_some_and(|ext| {
                ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown")
            })
}

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Must run before any webview (and therefore any WebKitWebProcess) is
    // created, since the renderer choice is read from the environment at that
    // point.
    #[cfg(target_os = "linux")]
    webview::apply_dmabuf_workaround();

    let result = tauri::Builder::default()
        .manage(OpenFiles(Mutex::new(
            std::env::args_os()
                .skip(1)
                .map(std::path::PathBuf::from)
                .filter(|p| markdown_path(p))
                .map(|p| p.to_string_lossy().into_owned())
                .collect(),
        )))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let handle = app.handle();
            let app_state = AppState::new(handle).map_err(|e| e.to_string())?;
            if let Some(window_state) = app_state
                .window_state
                .lock()
                .map_err(|_| "window state lock poisoned".to_string())?
                .as_ref()
                .copied()
            {
                if let Some(window) = app.get_webview_window("main") {
                    window
                        .set_size(PhysicalSize::new(window_state.width, window_state.height))
                        .map_err(|e| e.to_string())?;
                    window
                        .set_position(PhysicalPosition::new(window_state.x, window_state.y))
                        .map_err(|e| e.to_string())?;
                }
            }
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            take_open_files,
            new_window,
            save_window_state,
            exit_app,
            open_external_url,
            // file
            commands::file::open_file,
            commands::file::save_file,
            commands::file::save_file_as,
            commands::file::list_dir,
            commands::file::pick_open,
            commands::file::pick_save,
            commands::file::pick_dir,
            commands::file::open_folder,
            commands::file::delete_file,
            // asset
            commands::asset::write_asset,
            commands::asset::copy_image_files,
            commands::asset::get_assets_dir,
            commands::asset::fetch_remote_image,
            // settings
            commands::settings::load_settings,
            commands::settings::save_settings,
            // recent
            commands::recent::list_recent,
            commands::recent::add_recent,
            commands::recent::clear_recent,
            // recovery
            commands::recovery::autosave,
            commands::recovery::check_recovery,
            commands::recovery::clear_recovery,
        ])
        .build(tauri::generate_context!());

    match result {
        Ok(app) => app.run(|_handle, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let paths: Vec<String> = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter(|path| markdown_path(path))
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                let files = _handle.state::<OpenFiles>();
                if let Ok(mut pending) = files.0.lock() {
                    pending.extend(paths);
                }
                let _ = _handle.emit("open-files", ());
            }
        }),
        Err(e) => {
            eprintln!("error while running tauri application: {}", e);
            std::process::exit(1);
        }
    }
}
