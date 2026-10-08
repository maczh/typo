use tauri::{AppHandle, State};

use crate::models::Settings;
use crate::state::AppState;

/// Load persisted settings (falls back to defaults if none are stored).
#[tauri::command]
pub async fn load_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    let s = state
        .settings
        .lock()
        .map_err(|_| "settings lock poisoned".to_string())?;
    Ok(s.clone())
}

/// Persist new settings to disk.
#[tauri::command]
pub async fn save_settings(
    settings: Settings,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    {
        let mut s = state
            .settings
            .lock()
            .map_err(|_| "settings lock poisoned".to_string())?;
        *s = settings;
    }
    state.persist_settings(&app)
}
