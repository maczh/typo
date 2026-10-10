# Typo 增量变更任务书（2026-10-10）

> 主理人（齐活林）产出 · 交给工程师（寇豆码）实现 · 之后交 QA（严过关）验证。
> 项目根目录：`/Users/macro/Work/rust/src/github.com/maczh/typo`
> 栈：Tauri v2 (Rust) + Vue3 + Vite + TypeScript + Pinia + vue-i18n + Milkdown/Crepe(ProseMirror)。

## 0. 沙箱约束（CRITICAL，务必遵守）
- `RLIMIT_AS = 4GB`，Node 的 wasm（undici/lazyllhttp）必崩 → **不要运行 `npm run build` / `vite build` / `npx tauri build`**，也不要启动无头浏览器。
- 验证方式（只能这两条）：
  - 前端类型：`cd /Users/macro/Work/rust/src/github.com/maczh/typo && npx vue-tsc --noEmit`
  - Rust：`cd /Users/macro/Work/rust/src/github.com/maczh/typo/src-tauri && cargo check`（若已有 target，增量很快）
- 前端构建/打包由用户在真实终端执行，你只需保证源码与类型正确。
- 依赖钉死：`vite ^5` + `@vitejs/plugin-vue ^5`；`build.minify:'terser'` + **无 manualChunks**（拆分 milkdown/prosemirror/vue 会触发跨 chunk 循环初始化 TDZ 崩）。不要改 vite.config.ts 的分包策略。
- `index.html` 里 CSP 的 `script-src` 必须保留 `'unsafe-eval'`（vue-i18n 运行时编译需要），`connect-src` 保留 `ws://localhost:*`（Vite HMR）。改动 CSP 时别删这两个。

---

## 1. 设计一个时尚的 Typo 软件 Logo（素材已由主理人生成）
- 已生成素材：`design/A_modern__premium_app_icon_log_2026-10-10T02-14-47.png`（1024×1024 圆角方形，靛蓝→紫渐变，"T" 与钢笔尖融合）。
- 需求：
  1. 新建 `public/` 目录，把该 PNG 复制为 `public/logo.png`（Vite 会原样映射到站点根）。
  2. `index.html` `<head>` 加 favicon：`<link rel="icon" type="image/png" href="/logo.png" />`。
  3. 生成 Tauri 打包图标（macOS 用 `sips`，勿用需要联网的工具）：
     - `src-tauri/icons/32x32.png`（32×32）
     - `src-tauri/icons/128x128.png`（128×128）
     - `src-tauri/icons/128x128@2x.png`（256×256）
     - `src-tauri/icons/icon.png`（512×512）
     - 命令示例：`sips -z 32 32 public/logo.png --out src-tauri/icons/32x32.png`（其余同理）。
     - 若本机有 `tauri icon` 且能离线运行可选用；跑不通就手工 sips，保证上面 4 个文件存在。
  4. `src-tauri/tauri.conf.json` 的 `bundle.icon` 数组改为包含上述 4 个 PNG（保留原有路径风格）。
  5. `src/components/layout/MenuBar.vue` 左上角加品牌区：`<img src="/logo.png" class="brand-logo" />` + 文字 `Typo`（logo 约 18×18，圆角 4px）。品牌区不参与菜单交互。
  6. "关于"对话框（`MenuBar.vue` 里的 `about()`）改为在项目内实现一个简洁的关于弹窗或沿用 `window.alert`，但必须显示 logo 与版本号。**最低要求**：`about()` 文案包含 `Typo v0.1.0`。
- 交付物：logo 已接入 favicon、Tauri 图标、菜单栏品牌区。

---

## 2. "打开文件夹"仅导入 .md，左侧文件列表过滤掉非 .md 文件
- **Rust** `src-tauri/src/commands/file.rs`：
  - `list_dir`：保留目录条目（`is_dir == true` 全部保留，便于逐级进入）；文件条目仅保留扩展名为 `md` / `markdown`（不区分大小写）。其余文件跳过。继续隐藏 `.` 开头的条目。
  - `pick_open` 的过滤器：**删除 HTML / Word 过滤器**，只留 `Markdown`（`md, markdown`）与 `All Files`。实际上按需求 9，All Files 里非 md 也无意义，可保留 All Files 但不做转换。
  - `detect_kind`：删除 `html` / `htm` / `docx` 分支（见需求 9）。
  - `list_recent`（`src-tauri/src/commands/recent.rs`）：读取最近文件时过滤掉非 `.md/.markdown` 的路径。
- **前端** `src/components/sidebar/FileTree.vue`：文件列表渲染时仅显示 `.md/.markdown`（双保险），目录照常显示。
- `src/stores/files.ts` 的 `openFile`：去掉 html/docx 转换分支（见需求 9）。

---

## 3. 主菜单"段落"菜单 —— 仿 Typora（截图 1–4）并实现每个功能

### 3.1 需要先改造菜单基础设施（MenuBar.vue）
当前 `MenuItem` 只有 `{id,titleKey,shortcut?,sub?}`，且 **不支持分隔线、禁用态、勾选态、多级子菜单**。请改造为：
```ts
interface MenuItem {
  id?: string            // 叶子项命令 id
  titleKey: string
  shortcut?: string
  sub?: MenuItem[]       // 子菜单
  sep?: boolean          // 分隔线（此时无 titleKey/id）
  disabled?: () => boolean  // 动态禁用
  checked?: () => boolean   // 动态勾选（左侧 ✓）
}
```
- 建议抽一个递归组件 `src/components/layout/MenuNode.vue` 渲染任意层级子菜单（图像子菜单里"当插入本地图片时 ▸"是第 3 级）。
- 渲染规则：
  - 有 `sub` 的项：显示标题 + `▸`，**不触发 runCommand、不关闭菜单**，hover 展开（CSS 或 hover 状态）。
  - `sep` 渲染为分隔线 `<div class="menu-sep">`。
  - `disabled()` 为 true：加 `.disabled` 类（`opacity:.45; pointer-events:none`），不可点。
  - `checked()` 为 true：标题前显示 `✓`。
  - 叶子项点击 → `runCommand(id)` → 关闭菜单。
- 顶层菜单展开时点击其它地方关闭（现有 `@click="closeMenu"` 机制保留）。

### 3.2 段落菜单结构（严格按截图 1，顺序/分隔一致）
```
一级标题            ⌘1
二级标题            ⌘2
三级标题            ⌘3
四级标题            ⌘4
五级标题            ⌘5
六级标题            ⌘6
────────────
段落                ⌘0
────────────
提升标题级别        ⌘+
降低标题级别        ⌘-
────────────
表格                ▸     （子菜单见 3.3）
公式块              ⇧⌘B
代码块              ⇧⌘C
代码工具            ▸     （子菜单见 3.4）
警告框              ▸     （子菜单见 3.5）
────────────
引用                ⇧⌘Q
────────────
有序列表            ⇧⌘O
无序列表            ⇧⌘U
任务列表            ⇧⌘X
任务状态            ▸     （子菜单见 3.6；不在任务列表内时禁用/置灰）
列表缩进            ▸     （子菜单见 3.7）
────────────
在上方插入段落
在下方插入段落
────────────
链接引用            ⇧⌘L
脚注                ⇧⌘R
────────────
水平分割线
内容目录
```
- 快捷键提示文本按上图（macOS 风格 ⌘/⇧⌘/⌥⌘）。Windows/Linux 用户看 `Ctrl+`，可统一用 `Ctrl/⌘+…` 文案或直接照抄 mac 符号，保持与截图一致优先。

### 3.3 表格子菜单（截图 2）
```
插入表格            ⌥⌘T
────────────
上方插入行          （光标不在表格内时禁用）
下方插入行          ⇧⌘⏎
────────────
左侧插入列
右侧插入列
────────────
向上移动表格行      ⌥⌘↑
向下移动表格行      ⌥⌘↓
向左移动表格列      ⌥⌘←
向右移动表格列      ⌥⌘→
────────────
删除行              ⇧⌘⌫
删除列
────────────
复制表格
格式化表格源码
────────────
删除表格
```
- 动作已存在：`actions.ts` 的 `insertTable/tableRowAbove/tableRowBelow/tableColLeft/tableColRight/tableMoveRowUp/tableMoveRowDown/tableMoveColLeft/tableMoveColRight/tableDeleteRow/tableDeleteCol/tableCopy/tableFormat/tableDelete`。直接接线。
- 禁用判定：`A.nodeActive('table')`。

### 3.4 代码工具子菜单（截图 3）
```
复制代码块内容        （不在代码块内时禁用）
为选中内容调整缩进
为整个代码块调整缩进  （不在代码块内时禁用）
```
- 新增 actions/prose：
  - `copyCodeBlockContent()`：把当前代码块纯文本写入剪贴板（用 `useClipboard().writeClipboardText`）。需在 prose.ts 加 `getCodeBlockText(editor)`。
  - `indentSelectedLines()`：对当前选中的行首增加 2 个空格（无选区时给当前行）。
  - `indentCodeBlock()`：对整个代码块的每一行缩进 2 个空格。
- 判定是否在代码块内：`A.nodeActive('code_block') || A.nodeActive('fence')`。

### 3.5 警告框子菜单（Typora 警告框 / GitHub Alerts）
```
注意      → 插入  > [!NOTE]\n> 内容
提示      → 插入  > [!TIP]\n> 内容
重要      → 插入  > [!IMPORTANT]\n> 内容
警告      → 插入  > [!WARNING]\n> 内容
严重      → 插入  > [!CAUTION]\n> 内容
```
- 新增 `insertAlert(type: 'NOTE'|'TIP'|'IMPORTANT'|'WARNING'|'CAUTION')`，用 `insert()`（`@milkdown/utils`）把 Markdown 文本插入。文案用中文标题或英文均可，保持类型正确即可。

### 3.6 任务状态子菜单
```
已选
未选
已忽略
```
- 实现把当前任务列表项的复选框状态设置为 `[x]` / `[ ]` / `[-]`（`[-]` 为忽略）。可用 prose 命令或 `insert()` 替换行首标记。不在任务列表内时禁用（`A.nodeActive('task_list') || A.nodeActive('bullet_list')` 且行首匹配 `- [ ]`）。

### 3.7 列表缩进子菜单（截图 4）
```
增加缩进    ⌘]
减少缩进    ⌘[
```
- 接线 `A.indentList` / `A.outdentList`。
- 注意热键：现有 `Ctrl+]` / `Ctrl+[` 未注册；在 `useHotkeys.ts` 增加 `{ctrl:true,key:']',run:A.indentList}` 与 `{ctrl:true,key:'[',run:A.outdentList}`（仅在编辑器内生效）。

### 3.8 段落菜单其它项
- 内容目录 → `A.insertToc`；水平分割线 → `A.insertHorizontalRule`；链接引用 → `A.insertLinkReference`；脚注 → `A.insertFootnote`；上/下方插入段落 → `A.insertParagraphAbove/Below`（均已存在）。

---

## 4. 主菜单"格式"菜单 —— 仿 Typora（截图 5–6）并实现每个功能

### 4.1 格式菜单结构（严格按截图 5）
```
加粗                ⌘B
斜体                ⌘I
下划线              ⌘U
代码                ^`
────────────
内联公式            ^M
删除线              ^⇧`
注释                ^-
────────────
超链接              ⌘K
链接操作            ▸     （见 4.2；选区/光标不在链接上时置灰）
图像                ▸     （见 4.3）
从 iPhone 插入      ▸     （置灰/暂不支持）
────────────
清除样式            ⌘\
```
- 加粗/斜体/代码/删除线/超链接/清除样式 → 已存在，接线即可。
- **内联公式**：`A.insertInlineMath()`（已存在，插入 `$E = mc^2$` 行内公式）。
- **注释**：`A.insertComment()`（已存在，插入 `<!-- 注释 -->`）。
- **下划线**：Markdown 无原生下划线。请实现一个真实的 ProseMirror `underline` mark（`toDOM: ['u',0]`，`parseDOM: [{tag:'u'}]`），并通过一个小 remark/mdast 插件把 `<u>...</u>` 与 markdown 互相序列化；若评估风险过高，退而求其次：用 `insert()` 在选区两侧包 `<u>`/`</u>` 字面量（降级方案），并在交付说明里注明降级。优先尝试真实 mark。工具栏 `toggleUnderline` 与 `actions.toggleUnderline` 都要改为调用新实现（去掉"v1 暂不支持"提示）。
- **从 iPhone 插入**：`disabled` 或点击弹 toast「需要 macOS 连续互通，暂未支持」。

### 4.2 链接操作子菜单（截图 5 中置灰）
```
打开链接
复制链接地址
编辑链接
移除链接
```
- `打开链接`：取当前 link mark 的 href，Tauri 下用 `@tauri-apps/plugin-opener` 或 `window.open`；浏览器下 `window.open(href,'_blank')`。
- `复制链接地址`：复制 href。
- `编辑链接`：弹出 `window.prompt` 输入新地址，修改 mark。
- `移除链接`：移除 link mark。
- 光标不在链接内时整组禁用：判断 `markActive('link')`。

### 4.3 图像子菜单（截图 6）
```
插入图片              ⌥⌘I
插入本地图片...
────────────
打开图片位置          （禁用）
缩放图片              ▸ （禁用）
转换图片语法          ▸ （禁用）
────────────
删除图片文件          （禁用）
────────────
复制图片到...         （禁用）
重命名 / 移动图片到... （禁用）
上传图片              （禁用）
────────────
复制所有图片到...
移动所有图片到...
上传所有本地图片
────────────
重新加载所有图片
────────────
当插入本地图片时      ▸   （子菜单：无特殊操作 / 复制到当前文件夹 / 复制到 ./assets 并设置相对路径）
设置图片根目录
────────────
全局图像设置...
```
- 按截图绝大多数项是**禁用**的。实现并启用的项：
  - `插入图片` → `A.insertRemoteImage()`：`window.prompt` 输入 URL 后 `insertImage(e, url, '')`。
  - `插入本地图片...` → `A.pickAndInsertImage()`（已存在）。
  - `复制所有图片到...` / `移动所有图片到...` → 弹 toast「需要桌面能力，v1 暂未开放」（或实现为提示）。
  - `重新加载所有图片` → 重新触发图片节点刷新（可先 toast 提示，若实现成本高）。
  - `设置图片根目录` → 打开设置对话框中的图片根目录项（若设置项缺失，先弹 `window.prompt` 记录到 settings，或打开偏好设置）。
  - `全局图像设置...` → `ui.openSettings()`。
- 其余项保持 `disabled: () => true`（与截图一致）。**注意**：disabled 的项必须有正确样式，不能点击报错。

---

## 5. 主菜单"主题"菜单 —— 实现 6 套主题（截图 7）
截图 7 的 6 个主题：`Github`（勾选）、`Gothic`、`Newsprint`、`Night`、`Pixyll`、`Whitey`。

### 5.1 主题定义
- `src/stores/settings.ts`：
  - `themes` 列表改为：
    ```ts
    { id:'github',    name:'Github',    kind:'light' },
    { id:'gothic',    name:'Gothic',    kind:'dark'  },
    { id:'newsprint', name:'Newsprint', kind:'light' },
    { id:'night',     name:'Night',     kind:'dark'  },
    { id:'pixyll',    name:'Pixyll',    kind:'light' },
    { id:'whitey',    name:'Whitey',    kind:'light' },
    ```
  - 默认主题 `theme: 'github'`。
  - `loadThemeCss(id)` 动态 import 对应 CSS。
  - `load()` 增加旧主题 id 迁移：`github-light → github`，`nord-dark → night`（避免老配置读出来主题丢失）。
- 新建 `src/styles/themes/`：`github.css`、`gothic.css`、`newsprint.css`、`night.css`、`pixyll.css`、`whitey.css`。
  - 每个文件定义 `[data-theme='<id>']` 下的全部 CSS 变量（参照 `variables.css` 的 token 集合：`--bg/--fg/--fg-muted/--accent/--accent-soft/--border/--sidebar-bg/--panel-bg/--code-bg/--selection/--shadow`，以及 `--editor-bg`）。
  - `github.css` 直接沿用现有 `github-light.css` 的配色；`night.css` 沿用现有 `nord-dark.css` 的配色（可微调）。
  - 其余主题给出合理配色：Gothic=深色衬线（近黑底/灰白字）、Newsprint=米白纸质+衬线、Pixyll=清爽白+蓝、Whitey=纯白极简。
  - **删除** 旧的 `github-light.css` / `nord-dark.css`（或保留重命名即可，确保不再被 import）。
  - 深色主题的 `--editor-bg` 与代码块背景要正确（`variables.css` 里 `[data-theme='github-light']` 的规则同步改到新 id 或改为通用）。
- `MenuBar.vue` 主题菜单项改为 6 项，`id: 'theme-github' ... 'theme-whitey'`，用 `checked: () => settings.settings.theme === 'github'` 显示 ✓。
- `i18n` 三套语言补 `theme.github/gothic/newsprint/night/pixyll/whitey` 文案。
- `SettingsDialog.vue` 的主题下拉改用 6 套（复用 store 的 `themeList`，不要写死）。
- `src/milkdown/setup.ts` 的 `isDarkTheme()` 已按 `data-theme` 含 `dark` 判断 → 新的深色主题 id（gothic/night）不含 "dark" 字样，**必须改判断逻辑**：改为查 `themes` 定义里 kind==='dark'（可从 settings store 或一个共享常量取），保证深色主题下代码块用 oneDark 代码高亮。

---

## 6. 代码块行号行为
需求原文：**代码块不用默认选定第 1 行；光标离开代码块，则代码块不显示当前行号标识块。**

- 现状：Crepe 的代码块是 CodeMirror（`@milkdown/crepe` 的 code-mirror feature），带行号 gutter 与 active-line 高亮（`.cm-activeLine` / `.cm-activeLineGutter`），代码块获得焦点时外层有 `.selected` 描边。
- 请先用 jsdom 探针或阅读 `node_modules/@milkdown/crepe/lib/theme/common/code-mirror.css` 与 Crepe code-block feature 源码确认 DOM 类名，然后：
  1. **不要默认选定第 1 行**：插入代码块后（`prose.setCodeBlock` / 工具栏 / 菜单路径）让光标**折叠**在末尾，而不是全选整行。若 Crepe 在 code block 创建时自动全选，需在创建后 dispatch 一个折叠选区的 transaction。
  2. **离开代码块隐藏"当前行号标识块"**：用 CSS 让 active-line 行号高亮只在**代码块获得焦点时**出现：
     ```css
     /* 未聚焦时隐藏当前行高亮与行号标识 */
     .milkdown .milkdown-code-block .cm-activeLine,
     .milkdown .milkdown-code-block .cm-activeLineGutter { background: none !important; }
     .milkdown .milkdown-code-block:focus-within .cm-activeLineGutter { background: <soft-tint>; }
     ```
     同时让 `.milkdown-code-block.selected` 的描边也只在 `:focus-within` 时出现（若该描边就是"标识块"）。
  3. 若"行号标识块"实际是别的 DOM（例如 `.milkdown-code-block.selected` 的 outline 或语言选择器），以真实 DOM 为准实现上述语义：**聚焦时显示、失焦时隐藏、创建时不默认整行选中**。
- 把上述样式加到 `src/styles/typora.css`（在 Crepe 主题之后加载，优先级更高）。

---

## 7. 窗口标题显示为 "Typo - <当前文件名>"
- 新增一个 composable（如 `src/composables/useWindowTitle.ts`）或直接在 `AppLayout.vue` 加 watcher：
  - 监听 `editor.doc.name`（与 `dirty`）。
  - Tauri 环境：`import { getCurrentWindow } from '@tauri-apps/api/window'` → `getCurrentWindow().setTitle(title)`。
  - 浏览器环境 fallback：`document.title = title`。
  - 标题格式：`Typo - ${doc.name}`；建议脏标记：`Typo - ${doc.name}${dirty ? ' •' : ''}`（可接受）。
- 在 `AppLayout.vue` 的 `onMounted` 初始化一次，`watch` 后续变化。`@tauri-apps/api` 已在依赖中。

---

## 8. 全面检测所有工具条按钮、主菜单、右键菜单项及子菜单、手柄菜单项及子菜单，修复不生效项
必须逐项走查并修复以下已知问题（并自行发现其它失效项一并修）：
1. **工具栏块级下拉**（`Toolbar.vue` 的 `.block-select`）：`blockValue` 从未与真实块类型同步（永远停在"段落"）。改为响应式：随选区变化设置当前值（段落/h1..h6），且不要因为 `@change` 触发回写死循环。
2. **下划线按钮**：目前只弹"暂不支持" → 按需求 4.1 实现。
3. **手柄菜单 / 右键菜单**（`EditorContextMenu.vue` + `useEditorMenu.ts`）：逐项点击验证（剪切/复制/粘贴/删除、复制为 Markdown、粘贴为纯文本、B/I/行内代码/链接/删除线/清除格式、引用/无序/有序/任务列表、块样式子菜单、插入子菜单）。
   - 注意浮层选区同步：所有菜单项执行前必须 `A.restoreSelection(range.from, range.to)`（`run()` 已实现），确认每条路径都走到。
4. **表格工具栏**（`TableToolbar.vue`）：验证其每个按钮接线到 `actions.ts` 的表格动作。
5. **图片处理**（`ImageHandler.vue`）：验证粘贴/拖拽图片可用。
6. **主菜单所有项**：逐项验证 `runCommand` 的 switch 覆盖了菜单里出现的每个 id；有 `sub` 的父项不再走 `runCommand`（改造后）。
7. **命令面板**（`CommandPalette.vue`）：验证命令可执行。
8. **热键层**（`useHotkeys.ts`）：补 `Ctrl+]/Ctrl+[`（列表缩进）；核对与新菜单快捷键一致（如代码块 ⇧⌘C、公式块 ⇧⌘B、有序 ⇧⌘O、无序 ⇧⌘U、任务 ⇧⌘X、引用 ⇧⌘Q、链接引用 ⇧⌘L、脚注 ⇧⌘R、插入表格 ⌥⌘T 等）。注意与 PM 原生键位冲突（B/I/Z/Y/A 由编辑器处理，不重复绑定）。
   - **重要**：把热键与菜单里展示的快捷键对齐；展示的快捷键必须真的可用（否则就是"不生效"）。
- 交付时请给出一张"功能自检表"（菜单/工具条/右键/手柄 × 是否生效），标注修复前后。

---

## 9. 删除导入 .docx / .html 转换成 Markdown 的功能
- **Rust** `src-tauri/src/commands/file.rs`：
  - `detect_kind` 删除 `html/htm/docx` 分支（`md/markdown → markdown`，其余 → `text`）。
  - `open_file` 删除 docx → base64 的逻辑（不再需要 `data`，但 `FileResult.data` 字段可保留为 `None` 以兼容类型；若移除字段需同步 TS 类型）。
  - `pick_open` 过滤器删除 HTML / Word（见需求 2）。
  - 移除不再使用的 `base64` import（若无其他引用）。
- **前端**：
  - `src/utils/import.ts`：删除 `docxToMarkdown`、`importToMarkdown`、`RawFile`、`base64ToArrayBuffer`、`OpenKind` 相关的 docx/html 分支。
    - **保留** `htmlToMarkdown`（供 `setup.ts` 的"粘贴 HTML→Markdown"使用——这是粘贴增强，不属于"导入文件"，保留）。若 `mammoth` 仅此处使用则删除。
  - `src/stores/files.ts`：`openFile` 删除 `kind === 'html' || kind === 'docx'` 的转换分支，直接 `editor.loadFromText(content, result.path, result.name)`。
  - `src/types/index.ts`：`OpenKind` 改为 `'markdown' | 'text'`。
- **依赖**：`package.json` 删除 `mammoth`（若确认无引用）。`turndown` / `turndown-plugin-gfm` / `@types/turndown` 因粘贴功能保留。
- `index.html` / `tauri.conf.json` CSP 无需因此改动。
- 检查 `tests/` 是否有引用被删函数（`tests/exporter-*.test.ts` 只测导出，应无影响）；有则同步修正。

---

## 10. 清理无用的垃圾及缓存
删除以下内容（项目内，均为可再生/垃圾）：
- 根目录 25 个 `vite.config.ts.timestamp-*.mjs`（Vite 临时文件）。
- `.Trash-0/`（沙箱回收站，约 35MB）。
- `.dist-previous/`（旧构建，约 8MB）。
- `tests/.out/` 下的 `.mjs` 产物（由 `tests/build.mjs` 生成）。
- `dist/`（前端构建产物，已 gitignore，可再生）— 可删除；若你判断保留更稳妥，保留并在报告中说明。
- 顺手检查是否有其它明显的临时/缓存文件（如 `.DS_Store`）。
同时更新 `.gitignore` 追加：
```
# Vite temp
vite.config.ts.timestamp-*.mjs
# Sandbox / build caches
.Trash-0/
.dist-previous/
tests/.out/
```
**注意**：不要删除 `node_modules/`、`src-tauri/target/`（已有 gitignore）、`.git/`、`.workbuddy/`。

---

## 11. 交付要求
1. 所有改动遵循"最小变更"原则，保持现有代码风格（中文注释/英文注释风格与现有一致）。
2. i18n 三套语言（zh-CN / en / zh-TW）新增键必须齐全，键名一致；`tests/i18n.test.ts` 会校验一致性，别让它挂。
3. 完成后执行：
   - `npx vue-tsc --noEmit`（必须 0 error）
   - `cd src-tauri && cargo check`（必须 success）
4. 用一段"代码摘要"回报：改了哪些文件、每个需求如何实现、已知降级/未实现项（若 `vue-tsc`/`cargo check` 因沙箱限制无法完成，如实说明）。
5. 只做本任务书范围内的事，不引入无关重构。
