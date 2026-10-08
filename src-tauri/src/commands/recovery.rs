use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;

use tauri::{AppHandle, State};

use crate::models::{RecoveryItem, SaveResult};
use crate::state::{now_ms, AppState};

/// Deterministic hash of a document path, used for the backup file name.
fn hash_path(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Resolve (and ensure existence of) the autosave cache directory.
fn backup_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    let bp = dir.join("autosave");
    fs::create_dir_all(&bp).map_err(|e| e.to_string())?;
    Ok(bp)
}

/// Write a crash-safe backup of `content` for `doc_path` into the cache dir.
/// Never overwrites the user's real file.
#[tauri::command]
pub async fn autosave(
    doc_path: String,
    content: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<SaveResult, String> {
    let dir = backup_dir(&app)?;
    let hash = hash_path(&doc_path);
    let backup_path = dir.join(format!("{}.md", hash));
    let backup_str = backup_path.to_string_lossy().to_string();
    fs::write(&backup_path, content).map_err(|e| e.to_string())?;

    {
        let mut idx = state
            .backup_index
            .lock()
            .map_err(|_| "backup index lock poisoned".to_string())?;
        idx.insert(doc_path.clone(), backup_str.clone());
    }
    state.persist_backup_index(&app)?;

    Ok(SaveResult {
        success: true,
        path: backup_str,
        saved_at: now_ms(),
    })
}

/// Return backups that are newer than the original document (i.e. recovery-worthy).
#[tauri::command]
pub async fn check_recovery(
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Vec<RecoveryItem>, String> {
    let dir = backup_dir(&app)?;
    let idx = state
        .backup_index
        .lock()
        .map_err(|_| "backup index lock poisoned".to_string())?;

    let mut items: Vec<RecoveryItem> = Vec::new();
    for (doc_path, backup_path) in idx.iter() {
        let backup_p = Path::new(backup_path);
        let backup_meta = match fs::metadata(backup_p) {
            Ok(m) => m,
            Err(_) => continue,
        };
        let backup_time = backup_meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // If the original file is missing or is newer-or-equal, no recovery needed.
        let original_newer = Path::new(doc_path).exists()
            && {
                let orig = fs::metadata(doc_path)
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                orig >= backup_time
            };

        if !original_newer {
            items.push(RecoveryItem {
                doc_path: doc_path.clone(),
                backup_path: backup_path.clone(),
                saved_at: backup_time,
            });
        }
    }
    Ok(items)
}

/// Delete the backup for `doc_path` after a successful recovery (or user dismissal).
#[tauri::command]
pub async fn clear_recovery(
    doc_path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let hash = hash_path(&doc_path);
    let dir = backup_dir(&app)?;
    let backup_path = dir.join(format!("{}.md", hash));
    let _ = fs::remove_file(&backup_path);
    {
        let mut idx = state
            .backup_index
            .lock()
            .map_err(|_| "backup index lock poisoned".to_string())?;
        idx.remove(&doc_path);
    }
    state.persist_backup_index(&app)
}
