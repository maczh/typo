use std::{fs, path::Path};

/// Copy local images without overwriting existing destination files.
pub fn copy_image_files(paths: Vec<String>, directory: String) -> Result<Vec<String>, String> {
    use std::io::Write;
    let directory = Path::new(&directory);
    if !directory.is_dir() {
        return Err("Image destination is not a directory".into());
    }
    let mut destinations = Vec::with_capacity(paths.len());
    for path in paths {
        let source = Path::new(&path);
        let name = source
            .file_name()
            .ok_or("Invalid image filename")?
            .to_string_lossy();
        let bytes = fs::read(source).map_err(|e| format!("{}: {}", path, e))?;
        let mut suffix = 0_u32;
        loop {
            let name = if suffix == 0 {
                name.to_string()
            } else {
                format!("{}-{}", suffix, name)
            };
            let destination = directory.join(name);
            match fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&destination)
            {
                Ok(mut file) => {
                    if let Err(error) = file.write_all(&bytes).and_then(|()| file.sync_all()) {
                        drop(file);
                        let _ = fs::remove_file(&destination);
                        return Err(error.to_string());
                    }
                    destinations.push(destination.to_string_lossy().into_owned());
                    break;
                }
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                    suffix = suffix
                        .checked_add(1)
                        .ok_or("Too many duplicate image names")?;
                }
                Err(error) => return Err(error.to_string()),
            }
        }
    }
    Ok(destinations)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);

    struct TempDir(std::path::PathBuf);
    impl TempDir {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "typo-images-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn copy_should_preserve_bytes_and_original_when_destination_exists() {
        let root = TempDir::new();
        let source = root.0.join("source.png");
        let destination = root.0.join("images");
        fs::create_dir(&destination).unwrap();
        fs::write(&source, b"new image").unwrap();
        fs::write(destination.join("source.png"), b"existing image").unwrap();
        let paths = copy_image_files(
            vec![source.to_string_lossy().into_owned()],
            destination.to_string_lossy().into_owned(),
        )
        .unwrap();
        assert_eq!(fs::read(&paths[0]).unwrap(), b"new image");
        assert_eq!(
            fs::read(destination.join("source.png")).unwrap(),
            b"existing image"
        );
        assert!(source.exists());
    }

    #[test]
    fn copy_should_return_error_when_source_is_missing() {
        let root = TempDir::new();
        assert!(copy_image_files(
            vec![root.0.join("missing.png").to_string_lossy().into_owned()],
            root.0.to_string_lossy().into_owned()
        )
        .is_err());
    }
}
