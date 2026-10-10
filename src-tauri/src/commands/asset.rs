use std::fs;
use std::path::Path;

use reqwest::header;

use crate::models::RemoteImage;

/// Persist a binary asset (e.g. a pasted/dropped image) into
/// `<doc_parent>/<doc_stem>_imgs/<filename>` and return the document-relative
/// path (`<doc_stem>_imgs/<filename>`) so the editor can insert a relative
/// reference. The `<doc_stem>_imgs` directory keeps each document's images
/// isolated from every other document's images.
#[tauri::command]
pub async fn write_asset(
    doc_path: String,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let p = Path::new(&doc_path);
    let stem = p
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("document");
    let parent = p
        .parent()
        .ok_or_else(|| "invalid document path".to_string())?;
    let assets_dir = parent.join(format!("{}_imgs", stem));
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let target = assets_dir.join(&filename);
    fs::write(&target, data).map_err(|e| e.to_string())?;
    Ok(format!("{}_imgs/{}", stem, filename))
}

/// Resolve the assets directory (`<doc_parent>/<doc_stem>_imgs`) for a given
/// document path.
#[tauri::command]
pub async fn get_assets_dir(doc_path: String) -> Result<String, String> {
    let p = Path::new(&doc_path);
    let stem = p
        .file_stem()
        .and_then(|s| s.to_str())
        .filter(|s| !s.is_empty())
        .unwrap_or("document");
    let parent = p
        .parent()
        .ok_or_else(|| "invalid document path".to_string())?;
    let assets = parent.join(format!("{}_imgs", stem));
    Ok(assets.to_string_lossy().to_string())
}

/// Download a remote image (`http`/`https`) and return its bytes + a guessed
/// extension.
///
/// The frontend cannot fetch cross-origin images itself (CORS would block reading
/// the bytes), so the download happens here, on the native side, where there is
/// no same-origin policy. The bytes are written to disk by `write_asset` on the
/// frontend after this returns.
#[tauri::command]
pub async fn fetch_remote_image(url: String) -> Result<RemoteImage, String> {
    let client = reqwest::Client::builder()
        .user_agent("Typo/0.1")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let ct = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let data = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();
    let ext = mime_to_ext(&ct);
    Ok(RemoteImage { data, ext })
}

/// Map a MIME content-type to a file extension (lower-case, no dot).
fn mime_to_ext(ct: &str) -> String {
    let m = ct.split(';').next().unwrap_or("").trim().to_lowercase();
    let ext = match m.as_str() {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        "image/svg+xml" => "svg",
        "image/bmp" => "bmp",
        "image/x-icon" | "image/vnd.microsoft.icon" => "ico",
        _ => "png",
    };
    ext.to_string()
}
