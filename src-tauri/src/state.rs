use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};

use crate::models::{RecentItem, Settings};

const RECENT_FILE: &str = "recent.json";
const SETTINGS_FILE: &str = "settings.json";
const BACKUP_INDEX_FILE: &str = "backup_index.json";

/// Application-wide, process-lifecycle state. Held behind `tauri::State` and
/// persisted to the OS-provided config / cache directories. All file IO uses
/// `map_err(|e| e.to_string())` so commands return `Result<T, String>`.
pub struct AppState {
    pub recent: Mutex<Vec<RecentItem>>,
    pub settings: Mutex<Settings>,
    pub backup_index: Mutex<HashMap<String, String>>,
}

impl AppState {
    /// Build the state from disk (or defaults when files are missing).
    pub fn new(app: &AppHandle) -> Result<Self, String> {
        let config_dir = app
            .path()
            .app_config_dir()
            .map_err(|e| e.to_string())?;
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;

        let recent: Vec<RecentItem> = load_json(&config_dir.join(RECENT_FILE)).unwrap_or_default();
        let settings: Settings = load_json(&config_dir.join(SETTINGS_FILE))
            .unwrap_or_else(Settings::default);
        let backup_index: HashMap<String, String> =
            load_json(&config_dir.join(BACKUP_INDEX_FILE)).unwrap_or_default();

        Ok(AppState {
            recent: Mutex::new(recent),
            settings: Mutex::new(settings),
            backup_index: Mutex::new(backup_index),
        })
    }

    /// Resolve the application config directory.
    pub fn config_dir(&self, app: &AppHandle) -> Result<PathBuf, String> {
        app.path().app_config_dir().map_err(|e| e.to_string())
    }

    /// Resolve the application cache directory (used for autosave backups).
    pub fn cache_dir(&self, app: &AppHandle) -> Result<PathBuf, String> {
        app.path().app_cache_dir().map_err(|e| e.to_string())
    }

    pub fn persist_recent(&self, app: &AppHandle) -> Result<(), String> {
        let dir = self.config_dir(app)?;
        let data = self.recent.lock().map_err(|_| "recent lock poisoned".to_string())?;
        write_json(&dir.join(RECENT_FILE), &*data)
    }

    pub fn persist_settings(&self, app: &AppHandle) -> Result<(), String> {
        let dir = self.config_dir(app)?;
        let data = self.settings.lock().map_err(|_| "settings lock poisoned".to_string())?;
        write_json(&dir.join(SETTINGS_FILE), &*data)
    }

    pub fn persist_backup_index(&self, app: &AppHandle) -> Result<(), String> {
        let dir = self.config_dir(app)?;
        let data = self
            .backup_index
            .lock()
            .map_err(|_| "backup index lock poisoned".to_string())?;
        write_json(&dir.join(BACKUP_INDEX_FILE), &*data)
    }
}

/// Monotonic-ish millisecond timestamp (used for sorting recent items & backups).
pub fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn load_json<T: serde::de::DeserializeOwned>(path: &Path) -> Option<T> {
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

fn write_json<T: serde::Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let content = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}
