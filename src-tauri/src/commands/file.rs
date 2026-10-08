use std::fs;
use std::path::Path;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::models::{FileItem, FileResult, SaveResult};
use crate::state::{now_ms, AppState};

/// Extract the file name portion of a path.
fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Open a file. When `path` is `None`, a native open dialog is shown.
#[tauri::command]
pub async fn open_file(
    path: Option<String>,
    app: AppHandle,
) -> Result<FileResult, String> {
    let p = match path {
        Some(p) => p,
        None => match app.dialog().file().pick_file().await {
            Some(fp) => fp.to_string(),
            None => return Err("no file selected".to_string()),
        },
    };

    let content = fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let name = file_name(&p);
    Ok(FileResult {
        path: p,
        name,
        content,
    })
}

/// Save (overwrite) a file at the given absolute path.
#[tauri::command]
pub async fn save_file(path: String, content: String) -> Result<SaveResult, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(SaveResult {
        success: true,
        path,
        saved_at: now_ms(),
    })
}

/// Save a file as a new path and return the resulting `FileResult`.
#[tauri::command]
pub async fn save_file_as(path: String, content: String) -> Result<FileResult, String> {
    fs::write(&path, content).map_err(|e| e.to_string())?;
    Ok(FileResult {
        path: path.clone(),
        name: file_name(&path),
        content,
    })
}

/// List the immediate children of a directory.
#[tauri::command]
pub async fn list_dir(path: String) -> Result<Vec<FileItem>, String> {
    let entries = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut items: Vec<FileItem> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        let is_dir = p.is_dir();
        let name = p
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        // Hide dotfiles / special directories for a cleaner tree.
        if name.is_empty() || name.starts_with('.') {
            continue;
        }
        items.push(FileItem {
            name,
            path: p.to_string_lossy().to_string(),
            is_dir,
            children: None,
        });
    }

    items.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    Ok(items)
}

/// Show a native open dialog; returns the chosen path or `None`.
#[tauri::command]
pub async fn pick_open(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().pick_file().await;
    Ok(picked.map(|fp| fp.to_string()))
}

/// Show a native save dialog seeded with `default_name`; returns the chosen path or `None`.
#[tauri::command]
pub async fn pick_save(default_name: String, app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .save_file()
        .await;
    Ok(picked.map(|fp| fp.to_string()))
}

/// Show a native folder picker; returns the chosen directory or `None`.
#[tauri::command]
pub async fn pick_dir(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app.dialog().file().pick_folder().await;
    Ok(picked.map(|p| p.to_string()))
}

/// Pick a folder and list its immediate children in one call.
#[tauri::command]
pub async fn open_folder(app: AppHandle) -> Result<Vec<FileItem>, String> {
    let dir = match app.dialog().file().pick_folder().await {
        Some(d) => d.to_string(),
        None => return Ok(Vec::new()),
    };
    list_dir(dir).await
}

/// Delete a file or (recursively) a directory.
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p)
    } else {
        fs::remove_file(p)
    }
    .map_err(|e| e.to_string())
}
