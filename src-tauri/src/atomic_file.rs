//! Replace files only after a complete, synced write in the same directory.
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT: AtomicU64 = AtomicU64::new(0);

pub fn write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    // Preserve symlinks: update their target rather than replacing the link.
    let resolved = if path.exists() {
        fs::canonicalize(path)?
    } else {
        path.to_path_buf()
    };
    let parent = resolved
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let permissions = fs::metadata(&resolved).ok().map(|m| m.permissions());
    if permissions.as_ref().is_some_and(|p| p.readonly()) {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "File is read-only",
        ));
    }
    let (temporary, mut file) = loop {
        let candidate = parent.join(format!(
            ".typo-{}-{}.tmp",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        match options.open(&candidate) {
            Ok(file) => break (candidate, file),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    };
    let result = (|| {
        file.write_all(bytes)?;
        if let Some(permissions) = permissions {
            file.set_permissions(permissions)?;
        }
        file.sync_all()?;
        drop(file);
        fs::rename(&temporary, &resolved)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn writes_and_replaces_without_leaving_temporary_files() -> io::Result<()> {
        let dir = std::env::temp_dir().join(format!("typo-atomic-{}", std::process::id()));
        fs::create_dir_all(&dir)?;
        let path = dir.join("note.md");
        write(&path, b"old")?;
        write(&path, b"new")?;
        assert_eq!(fs::read(&path)?, b"new");
        assert_eq!(fs::read_dir(&dir)?.count(), 1);
        fs::remove_dir_all(dir)
    }
    #[test]
    fn failed_replace_preserves_existing_directory() -> io::Result<()> {
        let dir = std::env::temp_dir().join(format!("typo-atomic-fail-{}", std::process::id()));
        fs::create_dir_all(&dir)?;
        fs::write(dir.join("keep"), b"original")?;
        assert!(write(&dir, b"replacement").is_err());
        assert_eq!(fs::read(dir.join("keep"))?, b"original");
        fs::remove_dir_all(dir)
    }
    #[cfg(unix)]
    #[test]
    fn replacement_preserves_symlink_and_private_permissions() -> io::Result<()> {
        use std::os::unix::fs::{symlink, PermissionsExt};
        let dir = std::env::temp_dir().join(format!("typo-atomic-link-{}", std::process::id()));
        fs::create_dir_all(&dir)?;
        let target = dir.join("original.md");
        let link = dir.join("link.md");
        fs::write(&target, b"private")?;
        fs::set_permissions(&target, fs::Permissions::from_mode(0o600))?;
        symlink(&target, &link)?;
        write(&link, b"updated")?;
        assert!(fs::symlink_metadata(&link)?.file_type().is_symlink());
        assert_eq!(fs::read(&target)?, b"updated");
        assert_eq!(fs::metadata(&target)?.permissions().mode() & 0o777, 0o600);
        fs::remove_dir_all(dir)
    }
}
