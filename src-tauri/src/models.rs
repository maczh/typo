use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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

/// A single hotkey binding. `code` is the physical key code (layout-independent);
/// `key` is the normalized key. Both may be absent for display-only bindings.
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct HotkeySpec {
    #[serde(default)]
    pub ctrl: bool,
    #[serde(default)]
    pub shift: bool,
    #[serde(default)]
    pub alt: bool,
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
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
    #[serde(default)]
    pub content_width: f64,
    pub custom_css: String,
    /// Per-command hotkey overrides, keyed by command id. Absent ids fall back to
    /// the front-end built-in defaults.
    #[serde(default)]
    pub hotkeys: Option<HashMap<String, HotkeySpec>>,
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
            content_width: 80.0,
            custom_css: String::new(),
            hotkeys: None,
        }
    }
}

/// The bytes of a remotely-fetched image plus a guessed extension.
///
/// Returned by `fetch_remote_image` so the frontend can persist a network image
/// next to the document and rewrite the Markdown reference to a local path.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteImage {
    pub data: Vec<u8>,
    pub ext: String,
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
