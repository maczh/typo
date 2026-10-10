# Typo — 类 Typora 的跨平台所见即所得 Markdown 编辑器

> 用 **Rust + Tauri v2**（桌面外壳）与 **Vue 3 + Vite + TypeScript + Milkdown/Crepe**（前端编辑器）打造的
> 一款「所见即所得」（WYSIWYG）Markdown 编辑器。写完即所见，没有源码/预览分屏，也不需要手动切换模式。

---

## 目录

- [1. 项目简介](#1-项目简介)
- [2. 功能特性](#2-功能特性)
- [3. 技术栈](#3-技术栈)
- [4. 目录结构](#4-目录结构)
- [5. 环境要求](#5-环境要求)
- [6. 各操作系统下从源码编译与安装](#6-各操作系统下从源码编译与安装)
- [7. 运行与使用手册](#7-运行与使用手册)
- [8. 快捷键速查表](#8-快捷键速查表)
- [9. 架构说明](#9-架构说明)
- [10. 故障排查](#10-故障排查)
- [11. 已知限制](#11-已知限制)

---

## 1. 项目简介

Typo 的目标是一个**轻量、本地优先、尊重你文件**的 Markdown 写作工具：

- 文档的真实来源始终是 **Markdown 纯文本**，所有保存/导出都从它派生；
- 编辑时即时渲染，但随时可按 `Ctrl/⌘ + /` 切到源码视图对照；
- 支持数学公式（KaTeX）、Mermaid 图表、代码高亮、GFM 表格、图片等常见块；
- 支持**粘贴 HTML 自动转换成 Markdown**（保留原网页排版的纯文本结构）；
- 内置大纲导航、文件树、命令面板、查找替换、主题与多语言、专注/打字机模式；
- 自动保存 + 崩溃恢复，最近的文档列表。
- 自定义应用图标与窗口标题（标题栏显示 `Typo - <文件名>`，未保存改动时追加 `•`）；
- 代码块体验优化：新建代码块光标不默认选中首行，光标离开代码块后隐藏当前行高亮。

应用标识：`productName = "Typo"`，包名/标识符 `com.maczh.typo`，版本 `0.1.0`。

---

## 2. 功能特性

| 分类 | 能力 |
| --- | --- |
| **编辑体验** | 基于 Milkdown（ProseMirror 内核）的实时 WYSIWYG；Markdown 是单一事实来源 |
| **块级元素** | 标题（H1–H6）、段落、有序/无序/任务列表、引用、代码块、GFM 表格、分割线、链接、图片、行内代码、加粗/斜体/删除线 |
| **数学公式** | 行内 `$...$` 与块级 `$$...$$` 的 KaTeX 渲染 |
| **图表** | ` ```mermaid ` 围栏代码块，由 Mermaid 懒加载渲染 |
| **代码** | highlight.js 代码块高亮（内置 20+ 语言子集） |
| **图片** | 粘贴 / 拖拽 / 本地选择 → 写入 `<文档目录>/assets/` 并以相对路径引用（无文档路径时退化为 data-URL）；**保存时**会把文档内嵌的远程（`http/https`）、`data:`、粘贴/拖拽的在线图片自动下载到本地 `assets/`，并把引用改写为相对路径，保证下次打开仍能正确渲染 |
| **导入** | **粘贴 HTML 自动转 Markdown**（复制网页带格式内容后粘贴即转为 Markdown 源）；「打开文件 / 打开文件夹」仅导入 `.md` / 纯文本 |
| **导出** | Markdown（.md）、独立 HTML（内联 KaTeX CSS，可离线打开）、Word（.docx）、PDF（系统打印对话框「另存为 PDF」） |
| **导航** | 实时大纲（H1–H6，点击滚动定位）；快速打开（Ctrl/⌘+P）；命令面板（Ctrl/⌘+⇧+P）；查找/替换（Ctrl/⌘+F / +H） |
| **侧边栏** | 大纲面板 + 文件树（上半「最近」最多 10 条；下半为可展开/收起的精致目录树，仅列出 `.md` 文件，天然适配 Windows / macOS / Linux 路径风格） |
| **主题与语言** | 内置 6 套主题（GitHub / Gothic / Newsprint / Night / Pixyll / Whitey），手动切换亮/暗；简体中文 / 繁體中文 / English 三语界面 |
| **界面模式** | 专注模式（F8）、打字机模式（F9）、全屏（F11）；字体缩放（Ctrl/⌘+⇧+0/+/−） |
| **持久化** | 自动保存备份 + 崩溃恢复对话框；最近文件列表 |
| **剪贴板** | 通过 Tauri 官方 `clipboard-manager` 插件实现「复制为 Markdown」、纯文本粘贴等（在 WebKitGTK 下 `execCommand` 失效时的可靠替代） |

---

## 3. 技术栈

- **桌面层**：Rust + Tauri v2（`src-tauri/`），WebView 渲染前端
- **远程图片下载**：Rust 端 `reqwest`（rustls-tls，避免系统 OpenSSL 依赖）在保存时拉取文档内嵌的在线图片到本地 `assets/`
- **前端**：Vue 3 + Vite + TypeScript（`src/`）
- **编辑器**：[@milkdown/crepe](https://milkdown.dev)（打包了 commonmark、GFM、KaTeX、Mermaid、highlight.js、表格，并具备完整的 Markdown 往返能力）
- **导入转换（粘贴）**：`turndown` + `turndown-plugin-gfm`（HTML→MD）
- **导出**：`docx`（Word）、`unified` + `remark`/`rehype`（HTML）、`window.print`（PDF）
- **状态管理**：Pinia（`editor` / `files` / `settings` 三个 store）
- **国际化**：vue-i18n（zh-CN / zh-TW / en）

---

## 4. 目录结构

```
typo/
├── package.json            # 前端依赖与脚本
├── vite.config.ts · tsconfig*.json · index.html
├── scripts/                # 构建辅助（prepare-build.cjs / build.sh / build.ps1 / build-all.sh）
├── docs/                   # 架构说明、PRD 等长文档
├── src-tauri/              # Rust 后端（Tauri v2）
│   ├── Cargo.toml · build.rs · tauri.conf.json · capabilities/
│   └── src/{main.rs, lib.rs, models.rs, state.rs, webview.rs, commands/*}
├── src/                    # 前端
│   ├── main.ts · App.vue
│   ├── types/              # 共享类型（含与 Rust 对齐的 FileResult）
│   ├── stores/             # Pinia：editor / files / settings
│   ├── composables/        # useTauri / useMilkdown / useHotkeys / useUI / useClipboard / ...
│   ├── commands/           # actions.ts（统一命令层）、prose.ts（ProseMirror 底层）
│   ├── components/         # layout / sidebar / editor / panels / command / dialogs / common
│   ├── milkdown/           # setup.ts + plugins/{latex,mermaid,highlight,image,table,markdownMarker,underline}.ts
│   ├── utils/              # file / outline / markdown / import.ts（HTML→MD，仅用于粘贴）/ exporter/*
│   ├── i18n/               # index.ts + locales/{zh-CN,zh-TW,en}.ts
│   └── styles/             # 变量、主题、打印样式
└── README.md
```

---

## 5. 环境要求

| 工具 | 版本 | 说明 |
| --- | --- | --- |
| Node.js | ≥ 18（推荐 20 LTS） | 运行 Vite 前端 |
| npm | ≥ 9 | 安装前端依赖 |
| Rust | stable（rustup） | 编译 Tauri 桌面端必需 |
| Tauri CLI | 项目自带 `@tauri-apps/cli@^2` | 包装 `cargo` 完成桌面构建 |

> Tauri v2 还需要**系统 WebView 及其开发库**（见下）。缺少它们时，`cargo build` / `tauri build` 会在链接阶段失败。
>
> **重要**：本项目前端构建（`vite build`）对内存敏感；在受限/沙箱环境中可能因地址空间限制而失败。请在**正常的本地终端**完成构建。

### 各操作系统系统依赖

- **Linux（Debian / Ubuntu / Deepin / UOS）**：`libwebkit2gtk-4.1-dev`、`libgtk-3-dev`、`libjavascriptcoregtk-4.1-dev`、`librsvg2-dev`、`libayatana-appindicator3-dev`、`build-essential`、`curl`、`pkg-config`、`libssl-dev`。
- **macOS**：安装 Xcode Command Line Tools（`xcode-select --install`）即可，系统自带 WebKit，无需额外 WebView 包。
- **Windows**：Visual Studio 2022 生成工具（勾选「使用 C++ 的桌面开发」，含 MSVC + Windows SDK）；Rust（MSVC 工具链）；WebView2 运行时（Win11 预装，Win10 需单独安装）。

---

## 6. 各操作系统下从源码编译与安装

### 6.1 Linux（Debian / Ubuntu / Deepin / UOS）

```bash
# 1) 系统库
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libgtk-3-dev libjavascriptcoregtk-4.1-dev \
  librsvg2-dev libayatana-appindicator3-dev build-essential curl pkg-config \
  libssl-dev

# 2) Rust（若尚未安装）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# 3) 前端依赖 + 桌面端构建（产物含 .deb / AppImage / .rpm）
npm install
npm run tauri build
```

- 安装包位于 `src-tauri/target/release/bundle/` 下，例如 `bundle/deb/typo_0.1.0_amd64.deb`。
- 安装：
  ```bash
  sudo dpkg -i src-tauri/target/release/bundle/deb/typo_0.1.0_amd64.deb
  ```
- 也可直接运行免安装的可执行文件：`src-tauri/target/release/typo`。

> **Deepin / UOS 上的渲染注意事项**：若当前用户只在 `video` 组、不在 `render` 组，WebKitGTK 的 DMA-BUF 渲染会失败（报 `KMS: DRM_IOCTL_MODE_CREATE_DUMB failed` / `Failed to create GBM buffer`）。
> 本项目已在 `src-tauri/src/webview.rs` 中自动检测并回退软件渲染（`WEBKIT_DISABLE_DMABUF_RENDERER=1`）。**彻底修复**请执行：
> ```bash
> sudo usermod -aG render "$USER"   # 然后重新登录
> ```

### 6.2 macOS

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
npm install
npm run tauri build
```

- 产物位于 `src-tauri/target/release/bundle/`：`.app`（在 `macOS/`）与 `.dmg` 安装镜像。
- macOS 目标（x86_64 / aarch64-apple-darwin）**只能在 macOS 上构建**（需要 macOS SDK）。

### 6.3 Windows

1. 安装 **Visual Studio 2022 生成工具**，工作负载选「使用 C++ 的桌面开发」（含 MSVC + Windows SDK）。
2. 安装 **Rust**（[rustup.rs](https://rustup.rs)，MSVC 工具链）。
3. 安装 **WebView2 运行时**（Win11 预装；Win10 从微软官网下载）。
4. 在 PowerShell 中：
   ```powershell
   npm install
   npm run tauri build
   ```
- 产物位于 `src-tauri\target\release\bundle\`：`.msi` 安装包与 `.exe`。

### 6.4 一键构建脚本

仓库 `scripts/` 下提供了封装好的构建脚本（自动选择 Rust target triple 并调用 `npm run tauri build`，前端会由 `beforeBuildCommand` 自动构建）：

```bash
# Linux / macOS：自动探测本机 OS/arch 并原生构建
./scripts/build.sh

# 指定目标（交叉编译需 --allow-cross，且 macOS 目标只能在 Mac 上构建）
./scripts/build.sh --os linux --arch arm64 --allow-cross

# Windows（PowerShell）
.\scripts\build.ps1 -Os win -Arch amd64

# 批量构建全部组合（macOS 组合会在非 Mac 上自动跳过）
./scripts/build-all.sh --allow-cross
```

> 前端构建由 `npm run build` 触发，等价于：
> `vue-tsc --noEmit && node scripts/prepare-build.cjs && vite build`
> （`prepare-build.cjs` 会在 Vite 输出前清理/挪走旧 `dist`，规避某些环境下批量删除被拦截的问题。）

---

## 7. 运行与使用手册

### 7.1 启动

- **桌面端**：安装后从系统启动器打开 `Typo`（或运行 `npm run tauri dev` 以开发模式启动；或执行编译出的 `typo` 可执行文件）。
- **纯前端预览**：`npm run dev` 在浏览器打开 Vite 开发服务器（无需 Rust）。文件对话框与落盘持久化在浏览器里不可用（会用提示代替），但编辑、大纲、导出预览、主题、语言、命令面板等都可正常体验。

### 7.2 菜单栏

顶部菜单栏忠实还原 Typora 风格，分为 **文件 / 编辑 / 段落 / 格式 / 视图 / 主题 / 帮助**：

- **文件**：新建、新建窗口（占位）、打开、打开文件夹、快速打开、保存、另存为、关闭、最近文件（= 侧栏）、导出（Markdown/HTML/Word/PDF）、偏好设置。
- **编辑**：撤销/重做、剪切、复制、粘贴、复制为 Markdown、粘贴为纯文本、全选、查找、替换。
- **段落**：H1–H6、正文段落、升/降级标题、插入/编辑表格（增删行列、移动行列、复制为 Markdown、删除表格）、数学块、代码块、**代码工具**（复制代码 / 缩进选区 / 缩进代码块）、**提示框 Alert**（Note/Tip/Important/Warning/Caution）、引用、有序/无序/任务列表、**任务状态**（选中 / 未选 / 忽略）、缩进/反缩进、在上方/下方插入段落、脚注、目录等。
- **格式**：加粗、斜体、**下划线（真实 `<u>` 标记，可 Markdown 往返）**、行内代码、行内公式、删除线、注释、链接（含子菜单：打开链接 / 复制链接地址 / 编辑链接 / 移除链接）、插入图片（远程/本地 + 批量复制·移动·上传·刷新等子菜单）、清除样式。
- **视图**：源码模式、切换侧边栏、大纲、文件树、专注模式、打字机模式、全屏、实际大小/放大/缩小。
- **主题**：GitHub / Gothic / Newsprint / Night / Pixyll / Whitey（带 ✓ 选中标记，亮/暗自动适配代码高亮）。
- **帮助**：命令面板、关于。

### 7.3 工具栏与浮动格式菜单

编辑区顶部有 Typora 风格的格式工具栏，按钮随光标所在位置实时高亮当前生效的样式（加粗/斜体/标题/列表等）。选中文字后悬停或操作，可即时套用或清除格式。

### 7.4 右键菜单与行首「块手柄」

- **行首手柄**：每个块左侧悬停出现的小控件，点击可对该块执行操作（删除块、转为其它块、插入等）。
- **右键菜单**：在编辑区右键弹出。支持对**已选中的文字**套用样式 / 插入元素（这是修复后的核心行为：菜单命中的命令会先把选区与焦点交还给编辑器，再执行，避免选区与 DOM 脱节导致命令静默失效）。表格相关操作（增删行列、移动行列、复制为 Markdown、删除表格）也在此处。

### 7.5 粘贴 HTML 自动转 Markdown

从网页等来源复制带格式的内容，在 Typo 中 `Ctrl/⌘ + V` 粘贴时，编辑器会读取剪贴板里的 `text/html`，用 `turndown`（启用 GFM 规则，支持表格、删除线、任务列表）转成 Markdown 后插入；并通过 `stopPropagation()` 阻止 ProseMirror 再把原始 HTML 插一次（避免重复）。在代码块内、纯文本粘贴照常放行。**也可**用「编辑 → 粘贴为纯文本」（`Ctrl/⌘+⇧+V`）忽略格式。

> 转换由 `src/utils/import.ts` 的 `htmlToMarkdown` 完成，监听逻辑在 `src/milkdown/setup.ts` 的 `paste` 捕获阶段。

> **打开文件只支持 `.md` / 纯文本**：「打开文件 / 打开文件夹」仅导入 Markdown 文件（打开文件夹时侧栏文件树**只列出 `.md`**），其它扩展名（如旧的 `.html` / `.docx`）不再做导入转换，避免误改原文件。

### 7.6 导出功能

「文件 → 导出」或对应菜单项：

- **Markdown（.md）**：直接落地当前文档的 Markdown 源。
- **HTML（.html）**：独立页面，内联 KaTeX/高亮等 CSS，可离线双击打开。
- **Word（.docx）**：用 `docx` 库生成（注意：数学公式以 LaTeX 源码文本形式呈现，暂无 OMML 转换）。
- **PDF**：调用系统打印对话框，选择「另存为 PDF」。

### 7.7 侧边栏：大纲 + 文件树

- **大纲面板**（`Ctrl/⌘+⇧+1`）：按 H1–H6 列出文档结构，点击定位滚动。
- **文件树**（`Ctrl/⌘+⇧+3`）：分为上下两部分。
  - **上半「最近」**：显示最近打开的文档，**最多 10 条**（Rust 端与界面双重限制），点击即可打开。
  - **下半「目录」**：点击文件夹或「打开文件夹」后呈现**可逐级展开 / 收起的精致目录树**，仅列出其中的 `.md` 文件与子目录（目录由系统 API 返回，天然适配 Windows / macOS / Linux 的路径与分隔符风格）；点击文件打开，点击文件夹展开其下内容。

### 7.8 源码模式

`Ctrl/⌘ + /` 在所见即所得与 Markdown 源码文本之间切换；源码视图是一个文本框，改动后切回即重新装载。

### 7.9 查找与替换

`Ctrl/⌘ + F` 打开查找，`Ctrl/⌘ + H` 打开替换；支持在文档内定位与替换。

### 7.10 快速打开与命令面板

- **快速打开**（`Ctrl/⌘ + P`）：按文件名模糊检索并打开最近/已知文档。
- **命令面板**（`Ctrl/⌘ + ⇧ + P`）：输入关键词执行任意命令（打开设置、切换主题、插入块等）。

### 7.11 主题与语言

- 主题：内置 6 套（GitHub / Gothic / Newsprint / Night / Pixyll / Whitey），可在「主题」菜单或偏好设置中切换，颜色经 CSS 变量统一注入；亮/暗主题会同步切换代码块的 CodeMirror 高亮。
- 语言：简体中文 / 繁體中文 / English，设置后即时生效并持久化。

### 7.12 专注 / 打字机 / 全屏模式

- 专注模式（F8）：淡化非当前段落，聚焦写作。
- 打字机模式（F9）：当前行保持垂直居中。
- 全屏（F11）。
- 字体缩放：`Ctrl/⌘+⇧+0`（实际大小）/ `+/−`（放大/缩小）。

### 7.13 自动保存与崩溃恢复

编辑过程中会定时写入本地备份（与当前文档关联）。若上次异常退出，重新打开时「恢复」对话框会列出可用的自动备份供你恢复，避免内容丢失。

---

## 8. 快捷键速查表

> 提示：macOS 上 `Ctrl` 即 `⌘`（Command）；表中以 `Ctrl/⌘` 表示。

### 文件

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + N` | 新建 |
| `Ctrl/⌘ + O` | 打开文件 |
| `Ctrl/⌘ + ⇧ + O` | 打开文件夹 |
| `Ctrl/⌘ + P` | 快速打开 |
| `Ctrl/⌘ + S` | 保存 |
| `Ctrl/⌘ + ⇧ + S` | 另存为 |
| `Ctrl/⌘ + ⇧ + P` | 命令面板 |
| `Ctrl/⌘ + ,` | 偏好设置 |
| `Ctrl/⌘ + W` | 关闭窗口 |

### 编辑

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + Z` / `Y` | 撤销 / 重做 |
| `Ctrl/⌘ + X` | 剪切 |
| `Ctrl/⌘ + C` | 复制 |
| `Ctrl/⌘ + V` | 粘贴（HTML 自动转 Markdown） |
| `Ctrl/⌘ + ⇧ + C` | 复制为 Markdown |
| `Ctrl/⌘ + ⇧ + V` | 粘贴为纯文本 |
| `Ctrl/⌘ + A` | 全选 |
| `Ctrl/⌘ + F` / `H` | 查找 / 替换 |

### 段落

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + 0` | 正文段落 |
| `Ctrl/⌘ + 1`…`6` | 标题 H1…H6 |
| `Ctrl/⌘ + =` / `-` | 升 / 降级标题 |
| `Ctrl/⌘ + T` | 插入表格 |
| `Ctrl/⌘ + ⇧ + K` | 代码块 |
| `Ctrl/⌘ + ⇧ + M` | 数学块 |
| `Ctrl/⌘ + ⇧ + Q` | 引用 |
| `Ctrl/⌘ + ⇧ + [` / `]` | 有序 / 无序列表 |
| `Ctrl/⌘ + ⇧ + X` | 任务列表 |
| `Ctrl/⌘ + ⇧ + I` | 插入本地图片 |

### 格式

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + B` / `I` | 加粗 / 斜体（由编辑器原生处理） |
| `Alt + ⇧ + 5` | 删除线 |
| `Ctrl/⌘ + ⇧ + \`` | 行内代码 |
| `Ctrl/⌘ + K` | 插入链接 |
| `Ctrl/⌘ + U` | 下划线（真实 `<u>` 标记） |
| `Ctrl/⌘ + \` | 清除样式 |

### 视图

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl/⌘ + /` | 源码模式 |
| `Ctrl/⌘ + ⇧ + L` | 切换侧边栏 |
| `Ctrl/⌘ + ⇧ + 1` | 大纲面板 |
| `Ctrl/⌘ + ⇧ + 3` | 文件树面板 |
| `F8` / `F9` | 专注 / 打字机模式 |
| `F11` | 全屏 |
| `Ctrl/⌘ + ⇧ + 0` / `=` / `-` | 实际大小 / 放大 / 缩小 |

---

## 9. 架构说明

- **单一事实来源**：文档始终是 Markdown；保存/导出都从 `editor.getMarkdown()` 派生。
- **Tauri 桥接**：所有 `invoke` 调用都封装在 `composables/useTauri.ts`，把错误统一路由到全局提示；组件从不直接调用 Rust。
- **统一命令层**：`src/commands/actions.ts` 是菜单、工具栏、快捷键、命令面板共用的唯一实现入口；ProseMirror 底层命令在 `src/commands/prose.ts`。
- **主题**：颜色通过 `styles/variables.css` 的 CSS 变量流动；切换主题 = 设置 `<html data-theme>` + 加载对应 CSS。
- **Milkdown 插件**：`src/milkdown/plugins/*` 在 Crepe 之上提供数学、图表、高亮、图片、表格等增强；Crepe 本身提供带完整 Markdown 往返的 WYSIWYG 基础节点。
- **图片相对路径与渲染**：磁盘上的 Markdown 始终保存**相对**引用（`./assets/xxx.png`）；打开文档时再把这些本地引用通过 `convertFileSrc` 转成 `asset://` 绝对地址交给 WebView 渲染（否则相对路径会相对页面地址而非文档目录，导致无法加载）；**保存时**把远程（`http/https`）、`data:`、粘贴/拖拽的在线图片下载到 `<文档目录>/assets/` 并改写引用，确保文件可移植且下次打开能渲染。远程图片下载在 **Rust 端用 `reqwest`** 完成，以规避 WebView 的跨域（CORS）限制。实现见 `src/utils/images.ts` 与 `src-tauri/src/commands/asset.rs` 的 `fetch_remote_image`。
- **导入转换（粘贴）**：`src/utils/import.ts` 的 `htmlToMarkdown` 与编辑器 `paste` 监听（在 `src/milkdown/setup.ts`）共同完成 HTML → Markdown；文件导入仅支持 `.md` / 纯文本。

---

## 10. 故障排查

- **`webkit2gtk` / `javascriptcoregtk` 找不到** → 安装 §5 中的 Linux 开发包（尤其是 `libwebkit2gtk-4.1-dev`、`libjavascriptcoregtk-4.1-dev`、`libgtk-3-dev`）。
- **Linux 启动白屏 / `KMS: DRM_IOCTL_MODE_CREATE_DUMB failed` / `Failed to create GBM buffer`** → 用户不在 `render` 组导致 WebKitGTK DMA-BUF 渲染失败。项目已自动回退软件渲染；彻底修复：`sudo usermod -aG render "$USER"` 后重新登录。启动期的 `g_value_set_boxed` GLib-*CRITICAL* 多为底层头文件/运行时版本错配的无害噪声，可忽略。
- **`cargo: command not found`** → `source "$HOME/.cargo/env"`。
- **运行时 capabilities 报错** → 确认 `src-tauri/capabilities/default.json` 已授予 `core:default`、`dialog:default`、`clipboard-manager:default`、`core:webview:allow-print` 等。
- **前端类型错误导致构建失败** → 运行 `npm run typecheck`（即 `vue-tsc --noEmit`）定位 `src/**` 中的报错；Rust 层与此步骤相互独立。
- **`vite build` 在受限/沙箱环境失败** → 多为内存（地址空间限制导致 Wasm 实例化 OOM）或批量删除被拦截所致。请在正常的本地机器上构建（本项目已用 `prepare-build.cjs` 规避批量删除问题）。
- **图标缺失** → `src-tauri/icons/` 若只有占位，可执行 `npm run tauri icon path/to/logo.png` 生成完整图标集。

---

## 11. 已知限制

- **PDF 导出**依赖系统打印对话框的「另存为 PDF」，没有静默一键写盘。
- **Word 导出**中数学公式以 LaTeX 源码文本呈现（尚无 OMML 转换）。
- 导出的独立 HTML 中，Mermaid 图以围栏代码块保留（实时编辑器会渲染它）；离线把 Mermaid 烘焙成 SVG 是后续增强项。
- 多窗口、应用内窗口切换、开发者工具等部分菜单项为占位/提示，v1 暂未开放。

---

> 文档与架构的更多细节见 [`docs/architecture.md`](./docs/architecture.md) 与 [`docs/prd.md`](./docs/prd.md)。
> 各平台更细的依赖与降级交付说明见 [`build-env.md`](./build-env.md)。
