use std::path::Path;

use tauri::{AppHandle, State};

use crate::models::RecentItem;
use crate::state::{now_ms, AppState};

/// Maximum number of recent-file entries kept.
const MAX_RECENT: usize = 20;

/// Whether a path points at a Markdown file (`.md` / `.markdown`, case-insensitive).
fn is_markdown(path: &str) -> bool {
    match Path::new(path).extension().and_then(|s| s.to_str()) {
        Some(ext) => {
            let e = ext.to_lowercase();
            e == "md" || e == "markdown"
        }
        None => false,
    }
}

/// List the recent files, most-recent first.
///
/// Non-Markdown entries are filtered out so the recent list only ever shows files
/// the editor can actually open (DOCX / HTML import was removed).
#[tauri::command]
pub async fn list_recent(state: State<'_, AppState>) -> Result<Vec<RecentItem>, String> {
    let r = state
        .recent
        .lock()
        .map_err(|_| "recent lock poisoned".to_string())?;
    Ok(r.iter().filter(|item| is_markdown(&item.path)).cloned().collect())
}

/// Add (or bump) a path in the recent-files list.
#[tauri::command]
pub async fn add_recent(
    path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    {
        let mut r = state
            .recent
            .lock()
            .map_err(|_| "recent lock poisoned".to_string())?;
        r.retain(|item| item.path != path);
        let name = Path::new(&path)
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());
        r.insert(
            0,
            RecentItem {
                path,
                name,
                opened_at: now_ms(),
            },
        );
        r.truncate(MAX_RECENT);
    }
    state.persist_recent(&app)
}

/// Remove a single entry (or all entries when `path` is empty) from recents.
#[tauri::command]
pub async fn clear_recent(
    path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    {
        let mut r = state
            .recent
            .lock()
            .map_err(|_| "recent lock poisoned".to_string())?;
        if path.is_empty() {
            r.clear();
        } else {
            r.retain(|item| item.path != path);
        }
    }
    state.persist_recent(&app)
}
