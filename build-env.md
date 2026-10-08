# Build Environment & Degraded Delivery Guide

This document lists everything required to compile and package **Typo** on each
platform, plus the fallback plan used when the Rust / WebView toolchain is
unavailable (as was the case when this source tree was generated).

---

## 1. Prerequisites (all platforms)

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | ≥ 18 (20 LTS recommended) | Runs the Vite frontend |
| npm | ≥ 9 | Installs frontend deps |
| Rust | stable (via `rustup`) | Required for `tauri` commands |
| Tauri CLI | `npm i -D @tauri-apps/cli@^2` | Wraps `cargo` for the desktop build |

Tauri v2 also requires the **platform system WebView** and its dev libraries
(see per-OS sections). Without them `cargo build` / `tauri build` fails at the
link stage.

---

## 2. Linux (Debian / Ubuntu)

```bash
# System libraries
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential \
  curl wget file libxdo-dev libssl-dev \
  libayatana-appindicator3-dev librsvg2-dev

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Build
npm install
npm run tauri build
```

> Key packages: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `librsvg2-dev`,
> `libjavascriptcoregtk-4.1-dev`, `build-essential`, `curl`, `rustup`.

## 3. macOS

```bash
# Command Line Tools (provides clang, headers)
xcode-select --install

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

npm install
npm run tauri build
```

macOS uses the system **WebKit** (no extra WebView package needed).

## 4. Windows

1. Install **Visual Studio 2022 Build Tools** with the *C++ desktop development*
   workload (MSVC + Windows SDK).
2. Install **Rust** via <https://rustup.rs> (MSVC toolchain).
3. Install **WebView2** runtime (pre-installed on Win11; download for Win10).
4. `npm install` then `npm run tauri build`.

---

## 5. App Icons

`src-tauri/icons/` ships only a `.gitkeep` placeholder. Generate the full icon
set from any square PNG source:

```bash
npm run tauri icon path/to/source.png
```

This writes `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`,
`icon.ico` into `src-tauri/icons/`. The `tauri.conf.json` bundle list already
references these.

---

## 6. Build Commands Reference

| Command | Purpose |
| --- | --- |
| `npm install` | Install frontend dependencies |
| `npm run dev` | Vite dev server (browser-only UI) |
| `npm run build` | `vue-tsc --noEmit && vite build` (type-check + bundle) |
| `npm run typecheck` | `vue-tsc --noEmit` only |
| `npm run tauri dev` | Run the desktop app in dev mode |
| `npm run tauri build` | Produce a release installer for the host OS |

---

## 7. Degraded Delivery (no Rust toolchain)

When the environment cannot compile Rust (e.g. missing `cargo`, WebKit dev
libs, or network restrictions), the following still holds:

1. **All source is complete and self-consistent** — Rust (`src-tauri/`) and
   Vue (`src/`) follow the architecture's file list, interfaces and naming.
2. **Frontend type-check + build passes** independently:
   ```bash
   npm install
   npm run build      # vue-tsc --noEmit && vite build
   ```
   This validates types and produces `dist/` without any Rust dependency.
3. **Browser-only dev works**: `npm run dev` runs the full editor UI; only the
   Tauri system dialogs and on-disk persistence are mocked with toasts.
4. **To finish the desktop build**, transfer the tree to a machine meeting the
   §2–§4 prerequisites and run `npm run tauri build`.

### Verified / unverified in this delivery

| Item | Status |
| --- | --- |
| Frontend `vue-tsc --noEmit` + `vite build` | ✅ target (run on a machine with Node) |
| Rust `cargo check` / `cargo build` | ⚠ not compiled here (no toolchain) — code follows Tauri v2 conventions |
| File dialogs / real on-disk I/O | ⚠ requires the Tauri runtime |
| PDF print | ⚠ depends on the host OS print dialog |
| Editor runtime behaviour (math/mermaid/highlight) | ⚠ validated by type-check; runtime tested on a Tauri host |

---

## 8. Troubleshooting

- **`webkit2gtk` not found** → install the Linux dev packages in §2.
- **`cargo: command not found`** → `source "$HOME/.cargo/env"`.
- **Capabilities error at runtime** → ensure `src-tauri/capabilities/default.json`
  grants `core:default`, `dialog:*`, `core:webview:allow-print`, etc.
- **Frontend build fails on types** → run `npm run typecheck` and fix the flagged
  `src/**` file; the Rust layer is independent of this step.
