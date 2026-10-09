use std::fs;
use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use tokio::sync::oneshot;

use crate::models::{FileItem, FileResult, SaveResult};
use crate::state::now_ms;

/// Extract the file name portion of a path.
fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

/// Which kind of native dialog to show.
enum DialogMode {
    Open,
    Save,
    Folder,
}

/// Bridge the callback-based `tauri-plugin-dialog` API into an awaitable result.
///
/// `tauri-plugin-dialog` v2.2+ exposes `pick_file`/`save_file`/`pick_folder` as
/// `FnOnce(Option<FilePath>)` callbacks rather than `async` functions, so we use a
/// `oneshot` channel to convert the callback into a `Future`.
async fn pick_path(app: &AppHandle, mode: DialogMode, default_name: Option<&str>) -> Option<String> {
    let (tx, rx) = oneshot::channel::<Option<String>>();
    match mode {
        DialogMode::Open => {
            let mut builder = app.dialog().file();
            // Filters so HTML / DOCX / Markdown show up directly in the picker.
            builder = builder
                .add_filter("Markdown", &["md", "markdown", "txt", "text"])
                .add_filter("HTML", &["html", "htm"])
                .add_filter("Word", &["docx"])
                .add_filter("All Files", &["*"]);
            builder.pick_file(move |p| {
                let _ = tx.send(p.map(|x| x.to_string()));
            });
        }
        DialogMode::Save => {
            let mut builder = app.dialog().file();
            if let Some(name) = default_name {
                builder = builder.set_file_name(name);
            }
            builder.save_file(move |p| {
                let _ = tx.send(p.map(|x| x.to_string()));
            });
        }
        DialogMode::Folder => {
            app.dialog().file().pick_folder(move |p| {
                let _ = tx.send(p.map(|x| x.to_string()));
            });
        }
    }
    rx.await.ok().flatten()
}

/// Classify a file by extension into the `kind` the frontend expects.
fn detect_kind(ext: &str) -> &'static str {
    match ext {
        "md" | "markdown" => "markdown",
        "txt" | "text" => "text",
        "html" | "htm" => "html",
        "docx" => "docx",
        // Unknown extensions are best-effort read as UTF-8 text.
        _ => "text",
    }
}

/// Open a file. When `path` is `None`, a native open dialog is shown.
///
/// Markdown/text/HTML are returned as UTF-8 `content`; DOCX is returned as a
/// base64 `data` blob so the frontend can run mammoth → turndown locally.
#[tauri::command]
pub async fn open_file(
    path: Option<String>,
    app: AppHandle,
) -> Result<FileResult, String> {
    let p = match path {
        Some(p) => p,
        None => match pick_path(&app, DialogMode::Open, None).await {
            Some(fp) => fp,
            None => return Err("no file selected".to_string()),
        },
    };

    let bytes = fs::read(&p).map_err(|e| e.to_string())?;
    let name = file_name(&p);
    let ext = Path::new(&p)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();
    let kind = detect_kind(&ext);

    let (content, data) = if kind == "docx" {
        (String::new(), Some(STANDARD.encode(&bytes)))
    } else {
        (String::from_utf8_lossy(&bytes).to_string(), None)
    };

    Ok(FileResult {
        path: p,
        name,
        content,
        kind: kind.to_string(),
        data,
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
    // Borrow `content` for the write so it remains owned for the result below.
    fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(FileResult {
        path: path.clone(),
        name: file_name(&path),
        content,
        kind: String::new(),
        data: None,
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
    Ok(pick_path(&app, DialogMode::Open, None).await)
}

/// Show a native save dialog seeded with `default_name`; returns the chosen path or `None`.
#[tauri::command]
pub async fn pick_save(default_name: String, app: AppHandle) -> Result<Option<String>, String> {
    Ok(pick_path(&app, DialogMode::Save, Some(&default_name)).await)
}

/// Show a native folder picker; returns the chosen directory or `None`.
#[tauri::command]
pub async fn pick_dir(app: AppHandle) -> Result<Option<String>, String> {
    Ok(pick_path(&app, DialogMode::Folder, None).await)
}

/// Pick a folder and list its immediate children in one call.
#[tauri::command]
pub async fn open_folder(app: AppHandle) -> Result<Vec<FileItem>, String> {
    let dir = match pick_path(&app, DialogMode::Folder, None).await {
        Some(d) => d,
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
