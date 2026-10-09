//! Linux/WebKitGTK rendering workarounds.
//!
//! Since 2.41.1 WebKitGTK selects its DMA-BUF/GBM renderer whenever EGL claims to
//! support the GBM platform. On machines where the user cannot open a DRM render
//! node (`/dev/dri/renderD*`) the backing-store allocation fails with
//!
//! ```text
//! KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: Permission denied
//! Failed to create GBM buffer of size 1200x800: Permission denied
//! ```
//!
//! and the web process renders nothing — the window comes up blank instead of
//! falling back to software rendering. Running as root does not help, because
//! `DRM_IOCTL_MODE_CREATE_DUMB` on the primary node needs DRM master, which the
//! X server already holds.
//!
//! Detecting the unreachable render node up front and disabling the DMA-BUF
//! renderer keeps the editor usable. See <https://webkit.org/b/261874>.
//!
//! The clean fix (which restores hardware acceleration) is to give the user
//! access to the render node: `sudo usermod -aG render "$USER"` and log in again.

use std::fs::File;

/// Understood by WebKitGTK >= 2.41.1; we link against 2.46.
const DISABLE_DMABUF: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";

/// True when at least one DRM render node can be opened read/write.
fn has_drm_render_node() -> bool {
    let Ok(entries) = std::fs::read_dir("/dev/dri") else {
        return false;
    };

    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("renderD"))
        })
        .any(|path| File::options().read(true).write(true).open(path).is_ok())
}

/// Fall back to software rendering when hardware buffers are unreachable.
///
/// A value set by the user (or their desktop file) is always respected.
pub fn apply_dmabuf_workaround() {
    if std::env::var_os(DISABLE_DMABUF).is_some() {
        return;
    }

    if has_drm_render_node() {
        return;
    }

    eprintln!(
        "typo: no usable DRM render node (/dev/dri/renderD*) — disabling the \
         WebKitGTK DMA-BUF renderer to fall back to software rendering.\n\
         typo: run `sudo usermod -aG render \"$USER\"` and log in again to \
         re-enable hardware acceleration."
    );
    std::env::set_var(DISABLE_DMABUF, "1");
}
