mod commands;
mod models;
mod state;

use tauri::Manager;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let handle = app.handle();
            let app_state = AppState::new(handle).map_err(|e| e.to_string())?;
            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // file
            commands::file::open_file,
            commands::file::save_file,
            commands::file::save_file_as,
            commands::file::list_dir,
            commands::file::pick_open,
            commands::file::pick_save,
            // asset
            commands::asset::write_asset,
            commands::asset::get_assets_dir,
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
        .run(tauri::generate_context!());

    match result {
        Ok(_) => {}
        Err(e) => {
            eprintln!("error while running tauri application: {}", e);
            std::process::exit(1);
        }
    }
}
