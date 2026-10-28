mod atomic_file;
mod commands;
mod image_files;
mod models;
mod state;
#[cfg(target_os = "linux")]
mod webview;

use std::collections::HashMap;
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use tauri::Emitter;
use tauri::{Manager, PhysicalPosition, PhysicalSize};

/// Documents handed to the app on the command line, drained by the first
/// window that boots.
#[derive(Default)]
struct OpenFiles(Mutex<Vec<String>>);

/// Documents a window must open as soon as its webview boots, keyed by window
/// label. A window created for a specific document claims its entry when it
/// mounts, which keeps the hand-off deterministic — unlike an event emitted on
/// a timer, which is lost whenever the new webview is still loading.
#[derive(Default)]
struct WindowOpenFiles(Mutex<HashMap<String, Vec<String>>>);

#[tauri::command]
fn take_open_files(window: tauri::WebviewWindow) -> Result<Vec<String>, String> {
    let mut files = window
        .state::<WindowOpenFiles>()
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .remove(window.label())
        .unwrap_or_default();
    // Launch arguments belong to the window the app started with.
    if window.label() == "main" {
        let launch = window.state::<OpenFiles>();
        let mut pending = launch.0.lock().map_err(|e| e.to_string())?;
        files.append(&mut pending);
    }
    Ok(files)
}

#[tauri::command]
async fn new_window(app: tauri::AppHandle, path: Option<String>) -> Result<(), String> {
    let label = format!("document-{}", crate::state::now_ms());
    if let Some(path) = path {
        // Registered before the webview exists: the new window may boot at any
        // moment after `build` returns and must already find its document.
        app.state::<WindowOpenFiles>()
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .insert(label.clone(), vec![path]);
    }
    let built = tauri::WebviewWindowBuilder::new(&app, label.clone(), tauri::WebviewUrl::App("index.html".into()))
        .title("Typo")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .build();
    if let Err(error) = built {
        if let Ok(mut pending) = app.state::<WindowOpenFiles>().0.lock() {
            pending.remove(&label);
        }
        return Err(error.to_string());
    }
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
        .manage(WindowOpenFiles::default())
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
                let _ = _handle.emit("open-files", paths);
            }
        }),
        Err(e) => {
            eprintln!("error while running tauri application: {}", e);
            std::process::exit(1);
        }
    }
}
