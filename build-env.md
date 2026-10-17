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

### Deepin 23 / 23.1：主软件源失效导致 GTK 开发包缺失

若日志同时报告找不到 `gdk-3.0.pc`、`gdk-pixbuf-2.0.pc`、
`cairo.pc`、`pango.pc` 或 `atk.pc`，先检查系统开发包与软件源。
安装运行时共享库并不足以编译 Tauri。

2026-10-17 本机复现了两个环境问题：

1. 官方地址能被普通 HTTP 客户端访问，但 Deepin 的 APT 智能镜像程序将其重写成
   `https://cdn-community-packages.deepin.com/deepin/beige/dists/beige/beige/InRelease`，
   多出一层 `beige` 而返回 404。改用不受该域名重写影响的中科大镜像。
2. 本机已安装 Debian bookworm-backports 的 ATK 2.56.2 和 WebP 1.5.0 运行库，
   必须匹配安装对应开发包，不能直接选择 Deepin 中较旧版本的开发包。

下面的镜像已经通过 APT 自身下载工具验证签名索引；在临时 APT 索引目录中执行
安装模拟通过：0 升级、78 新安装、0 移除。临时验证没有安装或降级系统包。
以下命令针对本机现有配置（已有 bookworm-backports 源）：

```bash
# 保留第一次备份，另建此次修改前的备份。
sudo cp -a /etc/apt/sources.list /etc/apt/sources.list.typo-before-ustc.bak
sudo sed -i '/^deb /s#https://community-packages.deepin.com/beige/#https://mirrors.ustc.edu.cn/deepin/beige/#' /etc/apt/sources.list
sudo apt update
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev \
  build-essential pkg-config libssl-dev libxdo-dev librsvg2-dev \
  libatk1.0-dev/bookworm-backports \
  libatk-bridge2.0-dev/bookworm-backports \
  libatspi2.0-dev/bookworm-backports \
  libwebp-dev/bookworm-backports libsharpyuv-dev/bookworm-backports

pkg-config --modversion gtk+-3.0 gdk-3.0 gdk-pixbuf-2.0 cairo pango atk webkit2gtk-4.1 libsoup-3.0
npm run tauri build
```

`/bookworm-backports` 仅用于匹配本机已安装的运行库，不是切换整个系统发行版。
这里没有使用 `--allow-downgrades`、`--allow-unauthenticated` 或全局 backports 优先级。
先确认 `apt update` 不再报告主源 404，并确认 `pkg-config` 输出全部版本号。
无需删除 Cargo 构建缓存，也无需设置虚假的 `PKG_CONFIG_PATH`。

依据：[Deepin 23 软件源指南](https://guide.deepin.org/deepin%E8%BF%9B%E9%98%B6%E6%95%99%E7%A8%8B/2.deepin%E8%BD%AF%E4%BB%B6%E5%8C%85%E7%AE%A1%E7%90%86/2.1.debian%E8%BD%AF%E4%BB%B6%E5%8C%85%E7%AE%A1%E7%90%86%E5%89%8D%E6%8F%90)、
[Tauri Linux 构建依赖](https://v2.tauri.app/start/prerequisites/#linux)。

---

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
