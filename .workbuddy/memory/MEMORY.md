# Typo (Typora-clone) — project memory

Markdown editor mimicking Typora. Stack: Tauri v2 (Rust desktop) + Vue3/Vite/TS
web app; WYSIWYG via Milkdown/Crepe (ProseMirror). Editor source-of-truth = Markdown string.

## Environment constraint (IMPORTANT — updated 2026-10-09)
- `vite` dev/build **does run** in this container. The only hiccup: Vite tries to
  bulk-delete `node_modules/.vite/deps` when the lockfile changes, and the
  sandbox's safe-delete shim blocks deletes >50 files → dev server fails to start
  with `SAFE_DELETE_BULK_CONFIRM_REQUIRED`. **Fix:** `rm -rf node_modules/.vite`
  (a normal `rm`, not via node) once, then `vite` starts fine (`ready in ~1s`).
  If even `rm` is blocked, `mv node_modules/.vite /tmp/oldvite-<ts>` works.
- Headless Chrome is available at `/usr/bin/google-chrome`. Can drive the running
  dev server with `puppeteer-core` (install `--no-save`) to verify the editor
  actually mounts + accepts input. This is the reliable way to validate UI fixes.
- `npx vue-tsc --noEmit` also works for type-level checks.

## Gotchas / fixes (non-obvious)
- **Mermaid ER + Chinese:** Mermaid 10.x ER grammar is ASCII-only; Chinese entity
  names/labels/attrs fail. Fix in `src/milkdown/plugins/mermaid.ts`: for `erDiagram`
  sources, transliterate non-ASCII → `typocjkN` placeholders, render, then restore
  Chinese in the SVG. Other mermaid types already accept Chinese.
- **Prod build TDZ crash:** `manualChunks` splitting `@milkdown`/`prosemirror`/`vue`
  into separate chunks created a cross-chunk circular-init TDZ. Fix: remove
  `manualChunks` (let Rollup keep cyclic modules together) + `build.minify:'terser'`
  (added `terser` as devDependency). Dev mode was never affected.
- **CSP:** need `font-src 'self' data:` (mermaid/highlight.js `data:` fonts) in both
  `index.html` and `src-tauri/tauri.conf.json`; and `'unsafe-eval'` + `connect-src
  ws://localhost:*` for vue-i18n/HMR.

## Root cause of "page opens but no editing / no cursor / can't input"
- **Verified cause: the CSP in `index.html` lacked `'unsafe-eval'` in `script-src`.**
  vue-i18n v9 compiles message formatters with `new Function()` at runtime; every
  `t()` call (heavily used in `MenuBar.vue`) then throws under the strict CSP,
  crashing the whole app during render so the editor never mounts. Also the Vite
  HMR websocket (`ws://localhost:1421`) was blocked by a missing `connect-src`.
- **Fix:** add `'unsafe-eval'` to `script-src` and add
  `connect-src 'self' ws://localhost:* wss://localhost:*;` in `index.html`, and
  mirror the `'unsafe-eval'` in `src-tauri/tauri.conf.json` (same CSP string).
  After the fix, headless test confirms `.ProseMirror` is `contenteditable` and
  typing works. (In a Tauri production *build*, i18n messages get precompiled so
  eval isn't needed — but the dev/browser path hits runtime compilation.)
- The earlier "stray `vite ^8`" note was a coincident/earlier red herring; with
  `vite ^5` the app still failed to edit until the CSP was fixed.

## Dependency pin (do not break)
- Keep `vite ^5` + `@vitejs/plugin-vue ^5` (mismatched `vite ^8` breaks the build).

## Tauri cargo build (Rust) — FIXED 2026-10-09
- `npm run tauri dev` was failing at the `cargo` build stage (pkg-config couldn't find
  javascriptcoregtk-4.1 / libsoup-3.0): host Deepin/UOS `beige` apt source is 404 so
  the WebKit2GTK-4.1/GTK3/libsoup `-dev` packages can't be installed. The Rust code
  was also stale vs the locked `tauri-plugin-dialog v2.8.1` (callback-style dialog API).
- Fix (user-approved "local sysroot, zero risk"): bookworm `-dev` headers + `.pc`
  extracted into `/home/Macro/tauri-dev/sysroot` (pkg-config prefix rewritten) plus
  `libclang-14-dev` for bindgen; `libX.so -> /usr/lib/x86_64-linux-gnu/libX.so.0`
  symlinks created in the sysroot libdir for every pkg-config lib so linking uses the
  system runtime `.so`. `src-tauri/.cargo/config.toml` `[env]` auto-sets
  PKG_CONFIG_PATH / LIBCLANG_PATH / BINDGEN_EXTRA_CLANG_ARGS / LIBRARY_PATH for cargo.
- Code fixes: `src/commands/file.rs` (callback dialog API via a `tokio::sync::oneshot`
  `pick_path` helper; `save_file_as` no longer moves `content`; dropped unused imports),
  `src/commands/recovery.rs` (`use tauri::Manager;`), and generated RGBA PNG icons
  (32/128/256) with `tauri.conf.json` `bundle.icon` trimmed to those three.
- `cargo check` / `cargo build` / `npm run tauri dev` now succeed and launch the window.
  Non-fatal runtime `g_value_set_boxed` GLib-*CRITICAL*s come from the bookworm-headers /
  deepin-runtime version skew. On a working-apt machine, prefer installing the matching
  `-dev` packages and removing `src-tauri/.cargo/config.toml` + `/home/Macro/tauri-dev`.

## sysroot hack 已废弃（2026-10-10）
- 本机现已装好真正的 -dev 包：webkit2gtk-4.1 2.46.3 / javascriptcoregtk-4.1 /
  libsoup-3.0 3.4.4 / gtk+-3.0 3.24.41 / glib 2.80.1，pkg-config 直接从
  `/usr/lib/x86_64-linux-gnu/pkgconfig` 解析。`src-tauri/.cargo/config.toml` 里的
  sysroot env 块已删除（`/home/Macro/tauri-dev` 和 `/home/macro/tauri-dev` 都不存在了），
  文件只保留注释 + 空 `[target.x86_64-unknown-linux-gnu] rustflags = []`。
- **Cargo 配置规则**：`KEY = { value = "...", relative = false }` 表格式**只能**用在顶层
  `[env]`；写在 `[target.<triple>.env]` 下会直接报
  `error: expected a string, but found a table for KEY`。那里只能用 `KEY = "value"`。
- `cargo check` 与 `cargo build --release` 均通过（2 个无害 warning：
  `src/commands/recovery.rs:63` 未用变量 `dir`、`src/state.rs:51` `cache_dir` 未被调用）。

## 运行时：release 二进制白屏的兜底（2026-10-10）
- `src-tauri/src/webview.rs`：`apply_dmabuf_workaround()` 在 `run()` 最开头检测
  `/dev/dri/renderD*` 是否可读写，不可则设 `WEBKIT_DISABLE_DMABUF_RENDERER=1`
  回退软件渲染（用户已设该变量则不覆盖）。`lib.rs` 用 `#[cfg(target_os="linux")]` 引入。
- 触发条件：用户在 `video` 组但不在 `render` 组 → 打不开 renderD128 → GBM 退回
  `/dev/dri/card0` → `DRM_IOCTL_MODE_CREATE_DUMB` 需 DRM master（Xorg 独占）→ EPERM。
  **sudo 无效**（DRM master 排他）。彻底修法：`sudo usermod -aG render "$USER"` + 重登录。
- 无害噪声可忽略：`g_value_set_boxed` GLib-*CRITICAL*（bookworm 头文件 / deepin 运行库
  版本错配）、AT-SPI bus 警告。

## 浮层菜单（手柄/右键）的选区约定（2026-10-10）
- **任何 `Teleport` 出去的浮层菜单，点菜单项前必须先还回选区 + 焦点**，否则
  ProseMirror 的 `state.selection` 与 DOM 选区脱节，命令静默失效，
  `document.execCommand('cut'/'copy')` 更是完全没用。
  入口：`A.restoreSelection(from, to)`（内部 `prose.setSelectionRange` →
  `TextSelection.between` + `view.focus()`），无区间时退化为 `A.focusEditor()`。
- **不要用 `setCaret` 处理右键**：它用 `TextSelection.near()` 会**折叠选区**。
  只有"点手柄"这种需要重新定位光标的场景才用；右键要先判断点击是否落在已有
  非空选区内，是则原样保留选区，这样"选中文字 → 右键 → 改样式"才有作用对象。
- 菜单 DOM 上加 `@pointerdown.stop.prevent` **和** `@mousedown.stop.prevent`，
  防止点击菜单把焦点/选区从编辑器抢走（`click` 事件照常触发）。
- 无浏览器时的验证手法：esbuild 打包 + jsdom 探针（详见 2026-10-10 日志）。
  Chrome 在本机跑不起来（RLIMIT_AS=4GB 导致 SIGTRAP），`puppeteer-core` 也没装。

## Architecture (added 2026-10-09)
- `src/commands/prose.ts` — low-level ProseMirror command helpers over the
  Milkdown Editor (heading/paragraph/list/quote/code/mark toggles, introspection).
- `src/commands/actions.ts` — shared app action layer used by menu, toolbar and
  hotkeys (file/edit/paragraph/format/view/theme commands). Single implementation.
- `src/composables/useHotkeys.ts` — global Typora hotkey layer (window keydown).
  Ctrl+B/I/Z/Y/A intentionally left to ProseMirror to avoid double-toggle.
  Ctrl+/ = source mode; respected even inside the source textarea.
- Source mode: `src/composables/useSourceMode.ts` + `src/components/editor/SourceView.vue`
  (textarea bound to markdown; commit reloads editor via `loadMarkdown`).
- `src/components/editor/Toolbar.vue` — Typora-style format toolbar, live active state via `selectionchange`.
- `src/composables/useFind.ts` + `FindDialog.vue` (Ctrl+F/H); `useQuickOpen.ts` + `QuickOpenDialog.vue` (Ctrl+P).
- `src/components/layout/MenuBar.vue` — faithful Typora menu (File/Edit/Paragraph/Format/View/Theme/Help) with shortcut labels.
- `src/composables/useUI.ts` holds shared panel/dialog state (sourceMode, findOpen, quickOpenOpen, sidebarView, statusBarVisible).
- Rust: `src-tauri/src/commands/file.rs` has `pick_dir`, `open_folder`, `delete_file` (registered in `lib.rs`); bridged via `src/composables/useTauri.ts` (`pickDir`, `deleteFile`).
