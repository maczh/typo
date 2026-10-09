# Typo (Typora-clone) — project memory

Markdown editor mimicking Typora. Stack: **Tauri v2 (Rust desktop) + Vue3/Vite/TS**;
WYSIWYG via **Milkdown/Crepe** (ProseMirror). Editor source-of-truth = Markdown string.

## 沙箱环境约束（Bash 工具，重要）
- **`RLIMIT_AS=4GB`（CapEff=0 无法提升）** → Node 的 wasm（undici lazyllhttp）必崩，
  **`vite build` / `npm run tauri build` 在沙箱里无法验证**。只能验证 `cargo check` /
  `cargo build --release` 与 `vue-tsc --noEmit`。前端构建要用户在真实终端跑。
- 无头 Chrome 在本机跑不起来（同 RLIMIT_AS 致 SIGTRAP），`puppeteer-core` 没装 →
  改用 **esbuild 打包 + jsdom 探针**验证编辑器逻辑（见 2026-10-10 日志）。
- 批量删除 >50 文件被沙箱拦（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`）。

## 关键修复（非显然，跨会话有效）
- **Cargo 配置**：`KEY = { value=, relative= }` 表格式**只能**在顶层 `[env]`；
  `[target.<triple>.env]` 下必须是 `KEY = "value"`，否则报
  `expected a string, but found a table`。
- **CSP 根因（页面能开但无法编辑）**：`index.html` 的 `script-src` 缺 `'unsafe-eval'`
  致 vue-i18n 运行时编译 `new Function()` 抛错、整页崩；并需 `connect-src` 放行
  `ws://localhost:*` 给 Vite HMR。两处 `index.html` + `tauri.conf.json` 都要加。
- **运行时白屏（release 二进制）**：WebKitGTK DMA-BUF/GBM 在用户不在 `render` 组时
  撞 `DRM_IOCTL_MODE_CREATE_DUMB` EPERM。修法 `src-tauri/src/webview.rs` 检测
  `/dev/dri/renderD*` 不可写则设 `WEBKIT_DISABLE_DMABUF_RENDERER=1`。
  彻底修法：`sudo usermod -aG render "$USER"` + 重登录。
- **浮层菜单（手柄/右键）选区约定**：Teleport 浮层点击会令编辑器失焦，PM 选区与 DOM
  选区脱节 → 命令失效。点菜单项前必须先 `restoreSelection(from,to)`（用
  `TextSelection.between` + `view.focus()`）。**不要用 `setCaret` 处理右键**（会折叠选区）。
  菜单 DOM 加 `@mousedown.stop.prevent` + `@pointerdown.stop.prevent`。
- 剪贴板按钮在 WebKitGTK 下 `execCommand('cut'/'copy')` 不可靠、`paste` 禁用 → 改用
  Tauri 官方 `@tauri-apps/plugin-clipboard-manager`（`src/composables/useClipboard.ts`）。

## 依赖钉死（勿破）
- `vite ^5` + `@vitejs/plugin-vue ^5`；`build.minify:'terser'` + **无 manualChunks**
  （拆分 @milkdown/prosemirror/vue 会触发跨 chunk 循环初始化 TDZ 崩）。

## 导入转换：HTML/DOCX → Markdown（2026-10-10 新增）
- **粘贴 HTML 自动转 MD**：`src/milkdown/setup.ts` 在编辑器容器上挂 capture 阶段
  `paste` 监听，读 `clipboardData.getData('text/html')` → `turndown`(+gfm) →
  `insert(md)`；并 `stopPropagation()` 阻止 PM 自带粘贴再插一次 HTML。代码块内不转
  （保留字面文本）；纯文本粘贴原样放行。
- **打开 HTML/DOCX 自动转 MD**：Rust `open_file` 读字节按扩展名判 `kind`
  （markdown/text/html → UTF-8 文本；docx → base64），`src/stores/files.ts` 的
  `openFile` 按 `kind` 调 `src/utils/import.ts` 的 `importToMarkdown`
  （html→turndown；docx→`mammoth`→turndown）。
- 用到的库：`turndown` + `turndown-plugin-gfm`（HTML→MD）、`mammoth`（DOCX→HTML，浏览器
  构建读 `arrayBuffer`）、`@types/turndown`。`turndown-plugin-gfm` 无类型，已在
  `src/types/turndown-plugin-gfm.d.ts` 补声明。

## 架构要点（详见 2026-10-09 日志）
- 动作层 `src/commands/actions.ts`（菜单/工具栏/快捷键统一入口）；
  底层 PM 命令 `src/commands/prose.ts`；编辑器桥 `src/milkdown/setup.ts`
  （`loadMarkdown` 重建实例，`insert` 走 `@milkdown/utils` 的 `insert()` 解析 MD）。
- 文件/对话框 Rust 在 `src-tauri/src/commands/file.rs`，经 `src/composables/useTauri.ts` 桥接。
