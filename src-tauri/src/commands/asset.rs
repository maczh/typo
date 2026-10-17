use std::fs;
use std::io::Write;
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
    current_folder: Option<bool>,
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
    if Path::new(&filename)
        .file_name()
        .and_then(|name| name.to_str())
        != Some(filename.as_str())
    {
        return Err("Asset filename must not contain a path".into());
    }
    let current_folder = current_folder.unwrap_or(false);
    let assets_dir = if current_folder {
        parent.to_path_buf()
    } else {
        parent.join(format!("{}_imgs", stem))
    };
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let mut suffix = 0_u64;
    let filename = loop {
        let candidate = if suffix == 0 {
            filename.clone()
        } else {
            format!("{suffix}-{filename}")
        };
        let target = assets_dir.join(&candidate);
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)
        {
            Ok(mut file) => {
                if let Err(error) = file.write_all(&data).and_then(|()| file.sync_all()) {
                    drop(file);
                    let _ = fs::remove_file(&target);
                    return Err(error.to_string());
                }
                break candidate;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                suffix = suffix
                    .checked_add(1)
                    .ok_or("Too many duplicate image names")?;
            }
            Err(error) => return Err(error.to_string()),
        }
    };
    Ok(if current_folder {
        filename
    } else {
        format!("{}_imgs/{}", stem, filename)
    })
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
    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only HTTP(S) image URLs are supported".into());
    }
    const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(concat!("Typo/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let mut resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    let ct = resp
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if resp
        .content_length()
        .is_some_and(|length| length > MAX_IMAGE_BYTES as u64)
    {
        return Err("Image exceeds 25 MiB".into());
    }
    let mut data = Vec::new();
    while let Some(chunk) = resp.chunk().await.map_err(|e| e.to_string())? {
        if data.len() + chunk.len() > MAX_IMAGE_BYTES {
            return Err("Image exceeds 25 MiB".into());
        }
        data.extend_from_slice(&chunk);
    }
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

/// Copy image files on the blocking pool while retaining original files.
#[tauri::command]
pub async fn copy_image_files(
    paths: Vec<String>,
    directory: String,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::image_files::copy_image_files(paths, directory)
    })
    .await
    .map_err(|e| e.to_string())?
}
