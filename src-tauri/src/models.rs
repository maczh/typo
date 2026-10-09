use serde::{Deserialize, Serialize};

/// Result of opening a file from disk.
///
/// `kind` tells the frontend how to interpret the payload:
///   - `"markdown"` / `"text"`: `content` holds the UTF-8 text (loaded as-is).
///   - `"html"`: `content` holds the raw HTML (frontend converts to Markdown).
///   - `"docx"`: `data` holds a base64 of the file bytes (frontend runs
///     mammoth → turndown to produce Markdown). `content` is empty.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileResult {
    pub path: String,
    pub name: String,
    pub content: String,
    pub kind: String,
    pub data: Option<String>,
}

/// A single entry in the "recent files" list.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentItem {
    pub path: String,
    pub name: String,
    pub opened_at: u64,
}

/// A node in the directory/file tree (used by `list_dir`).
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileItem {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileItem>>,
}

/// Persisted editor settings.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: String,
    pub language: String,
    pub font_size: u32,
    pub line_height: f32,
    pub font_family: String,
    pub auto_save: bool,
    pub auto_save_interval: u64,
    pub mode: String,
    pub custom_css: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            theme: "github-light".to_string(),
            language: "zh-CN".to_string(),
            font_size: 16,
            line_height: 1.6,
            font_family: "system-ui, -apple-system, 'Segoe UI', sans-serif".to_string(),
            auto_save: true,
            auto_save_interval: 30_000,
            mode: "normal".to_string(),
            custom_css: String::new(),
        }
    }
}

/// Result of a save operation.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub success: bool,
    pub path: String,
    pub saved_at: u64,
}

/// A pending crash-recovery backup discovered at startup.
#[derive(Serialize, Deserialize)]
pub struct RecoveryItem {
    pub doc_path: String,
    pub backup_path: String,
    pub saved_at: u64,
}
