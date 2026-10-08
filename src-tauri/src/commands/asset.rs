use std::fs;
use std::path::Path;

/// Persist a binary asset (e.g. a pasted/dropped image) into
/// `<doc_dir>/assets/<filename>` and return the document-relative path
/// (`assets/<filename>`) so the editor can insert a relative reference.
#[tauri::command]
pub async fn write_asset(
    doc_dir: String,
    filename: String,
    data: Vec<u8>,
) -> Result<String, String> {
    let assets_dir = Path::new(&doc_dir).join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;
    let target = assets_dir.join(&filename);
    fs::write(&target, data).map_err(|e| e.to_string())?;
    Ok(format!("assets/{}", filename))
}

/// Resolve the assets directory (`<doc_dir>/assets`) for a given document path.
#[tauri::command]
pub async fn get_assets_dir(doc_path: String) -> Result<String, String> {
    let p = Path::new(&doc_path);
    let dir = p.parent().ok_or_else(|| "invalid document path".to_string())?;
    let assets = dir.join("assets");
    Ok(assets.to_string_lossy().to_string())
}
