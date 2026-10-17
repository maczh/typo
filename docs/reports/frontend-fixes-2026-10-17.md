# Typo 前端修复报表

日期：2026-10-17（Asia/Shanghai）

## 交付结论

已修复本轮自动化回归发现的菜单、工具条、快捷键、选区操作、文档往返保存和图片处理问题，加入可重复执行的回归脚本。**尚不能宣称“所有操作系统安装后均自动覆盖已有 `.md` 默认程序”或“所有原先禁用的功能已经实现”。** 跨平台安装包尚未实机验收。用户已明确图片保存在本地目录，本轮不接入图床服务。

## 修复项目

| 范围 | 问题及处理 |
| --- | --- |
| 浮动菜单、手柄菜单、主菜单、图表菜单 | 公用窗口边界定位指令；子菜单空间不足时向左展开；高度超过窗口时独立滚动；滚动及缩放后重新定位；滚轮可到达末项。 |
| 手柄入口 | 使用手柄旁内容块的位置捕获操作目标，避免在编辑器外侧沟槽命中失败。保留拖动与点击的区分。 |
| 工具条 | 按钮鼠标按下时保留编辑选区；标题选择器反映当前块；任务列表状态不再误认普通项目列表。 |
| 快捷键 | 统一从注册表获取绑定及提示；补齐表格、图片和缩进操作绑定；移除 Milkdown 重复的修饰键绑定，保留 Tab 等结构导航。 |
| 快捷键自定义 | 支持原编辑器内置命令的改键；捕获 Shift 标点时按物理键归一化；阻止冲突配置保存；已有冲突按显式覆盖优先确定唯一有效绑定；“重置全部”恢复默认。 |
| 选区 | “复制为 Markdown”复制选区并保留标记；无选区时复制整篇。图片插入改为节点事务，避免选区内图片被丢弃。 |
| 编辑 | “替换”直接展开替换输入栏；列表和引用支持再次操作取消；任务列表保留原选中文字；分隔线正常插入。 |
| 文档往返 | 文档加载改为同步替换编辑状态，避免销毁重建期间的未就绪实例；引用定义、YAML Front Matter、脚注新增对应节点，重载后保留。 |
| 源码模式 | 保存与导出读取当前源码；剪切、复制、粘贴、全选、撤销和替换面向源码文本；粘贴进入原生撤销历史；不支持的可视格式菜单在源码模式下禁用。 |
| 图片 | 批量复制/移动接通文件操作；不覆盖目标同名文件；更新块图片与行内图片引用；移动先保存新引用再删除原图，保存失败不删原图。 |
| 图片设置 | 插入方式支持原路径、当前文件夹、文档图片目录；根目录写入文档 `typora-root-url` 并参与本地引用解析及保存；重新加载图片实际重设图片资源。 |
| 桌面操作 | 新窗口、关闭、全屏使用桌面实现；链接打开接通系统浏览器命令；命令面板主题 ID 与现有主题一致。 |
| 安装入口 | 添加 `.md` / `.markdown` 文件关联；Windows/Linux 接收启动参数；macOS 接收打开文件事件；前端加载待打开文件。 |
| 构建与测试 | 移除导致依赖安装失败的相对 NODE_OPTIONS 预加载；提供菜单、IPC 契约和安装脚本测试入口；不再执行已删除 DOCX 导出功能的旧测试。 |

## 验证结果

| 检查 | 结果与边界 |
| --- | --- |
| `npm run typecheck` | 通过。 |
| `npm run build` | 通过；仍有现有动态/静态导入混用的分包提示。 |
| `npm test` | 23 / 23 通过，包括路径、导出、目录、大纲、国际化和 Linux 安装/卸载脚本测试。 |
| `npm run test:menus` | 163 / 163 通过。Chrome 无头浏览器；覆盖菜单、选中文字的右键菜单、手柄入口、工具条、表格、图表模板、快捷键、自定义绑定、剪贴板、YAML 和脚注往返等。部分菜单检查验证入口可达，部分验证内容或结构变化；逐项名称见结果文件。 |
| `npm run test:native-contract` | 15 / 15 通过。**使用模拟 IPC 后端**，检查打开、保存、导出、新窗口、关闭、全屏、图片根目录、批量图片操作与失败保护；不是桌面系统端到端验收。 |
| Rust 文件复制逻辑 | 2 / 2 通过；独立 `rustc --test -D warnings` 检验实际临时文件、同名保护、原文件保留、缺失源文件报错。 |
| `cargo check --locked` | 环境阻挡：缺少 `libsoup-3.0` 开发包；Tauri info 同时报告 WebKitGTK 4.1 开发环境缺失。完整 Rust 应用检查、Clippy 和原生打包未通过验收，不能用独立 Rust 测试替代。 |
| 菜单清单 | 梳理 110 个具名菜单 ID；禁用状态与当前上下文有关。表格、代码块、链接操作另有对应上下文用例。无 ID 的父菜单和分隔符不计入此数字。 |
| 快捷键 | 65 个默认绑定，自动检测无重复；提示随当前有效配置刷新。 |

浏览器回归需要先运行 `npm run dev -- --host 127.0.0.1`，并安装 Chrome；可通过 `CHROME_PATH` 指定浏览器路径。主菜单回归支持 `TYPO_URL`（带 `?e2e=1`）。

独立 Rust 校验命令：

```sh
rustc --edition 2021 -D warnings --test src-tauri/src/image_files.rs -o /tmp/typo-image-tests
/tmp/typo-image-tests
```

## 安装关联的实际行为

| 平台/包 | 本轮实现 | 未验证或系统限制 |
| --- | --- | --- |
| Linux DEB / RPM | 桌面启动项包含 `%F`，声明 Markdown MIME；安装脚本在系统 MIME 默认列表前置 Typo，并保留旧处理器作为后备；重复安装不重复添加；卸载移除 Typo 并恢复后备。 | 用户已有的个人默认配置优先于系统配置。脚本在临时目录测试通过，真实包安装、桌面双击仍待实机验收。 |
| Windows NSIS | 注册唯一 `Typo.Markdown` ProgID、Default Apps capabilities；正确引用含空格的可执行路径和文件参数；交互式新安装打开默认应用设置；静默安装不弹设置。 | 已有受保护的 UserChoice 不能由应用可靠静默替换，用户须在 Windows 设置中确认。未生成或安装 NSIS 包验证。 |
| Windows MSI | 使用 Tauri 公用文件关联配置注册候选处理器。 | NSIS 专用 hook 不适用于 MSI；已有默认关联仍须系统选择，未实机验证。 |
| macOS APP / DMG | 注册 Markdown UTI、Editor 角色及 Owner rank；处理系统打开文件事件。 | 注册优先级不等于覆盖用户已选默认应用；需要在 macOS 上验证 Finder 双击、运行中打开及默认应用选择。 |
| AppImage | 公用文件关联元数据随应用打包。 | AppImage 是便携格式，没有通用安装后钩子；本轮没有实现用户桌面集成安装器，也未验证其成为默认应用。 |

系统依据：[Tauri 配置](https://v2.tauri.app/reference/config/)、[Windows 默认程序机制](https://learn.microsoft.com/en-us/windows/win32/shell/default-programs)、[XDG MIME 默认应用规范](https://specifications.freedesktop.org/mime-apps/1.0/default.html)。

## 尚未完成的能力与验收

- 图片存储按用户确认采用本地目录：移除单张/批量图床上传入口与占位操作，保留本地图片插入、保存、复制、移动和根目录设置。默认写入文档同名 `<文档名>_imgs/` 目录，也可选择当前文件夹或保留原路径。图床上传不再是待办事项。
- 原先禁用的单张图片“打开位置、删除文件、复制到、重命名/移动”、图片缩放/语法转换，以及 iPhone 连续互通，仍未实现，不计作功能通过。
- 完整桌面 Rust 编译、Windows/macOS/Linux 安装包安装、卸载和系统双击验收仍需对应开发环境。
- “各平台安装完成后无条件成为 `.md` 默认程序”的原始要求尚未完全达到；本轮交付的是文件关联注册、支持的平台安装钩子和打开文件链路，并保留系统用户选择规则。

## 补充修复：列表行手柄的样式转换

- 修复手柄仅按顶层块定位而误选整组列表/首项的问题，改为定位具体文本行，包含嵌套列表行。
- 当前列表项转换为段落、H1–H6、引用、无序/有序/任务列表时，按需要拆分前后列表，只转换当前项。
- 保留前后列表项、原有有序编号、文字顺序、行内格式和子列表；转换可通过一次撤销完整恢复。
- 新增真实点击手柄的专项回归 `npm run test:list-style`：69 / 69 通过，覆盖两类列表首/中/末项、全部上述样式及嵌套情况。
- [专项回归明细](../../tests/list-style-results.json)、[当前行转换效果](../../tests/list-style-after.png)。

## 证据文件

- [菜单测试明细](../../tests/menu-results.json)
- [菜单入口清单](../../tests/menu-inventory.json)
- [IPC 契约测试明细](../../tests/native-contract-results.json)
- [快捷键清单](../../tests/shortcut-results.json)
- [小窗口子菜单滚动截图](../../tests/menu-viewport.png)

## 默认快捷键清单

`Ctrl/⌘` 表示 Windows/Linux 使用 Ctrl，macOS 使用 Command；每个功能只有一个默认绑定，用户自定义后以当前有效绑定为准。

| 功能 | 命令 ID | 默认绑定 |
| --- | --- | --- |
| 插入本地图片… | `insertLocalImage` | Ctrl/⌘+Shift/⇧+I |
| 插入图片 | `image-remote` | Ctrl/⌘+Alt/⌥+I |
| 缩进 | `indent-list` | Ctrl/⌘+] |
| 减少缩进 | `outdent-list` | Ctrl/⌘+[ |
| 新建 | `new` | Ctrl/⌘+N |
| 打开… | `open` | Ctrl/⌘+O |
| 打开文件夹… | `openFolder` | Ctrl/⌘+Shift/⇧+O |
| 保存 | `save` | Ctrl/⌘+S |
| 另存为… | `saveAs` | Ctrl/⌘+Shift/⇧+S |
| 快速打开 | `quickOpen` | Ctrl/⌘+P |
| 命令面板 | `commandPalette` | Ctrl/⌘+Shift/⇧+P |
| 偏好设置 | `preferences` | Ctrl/⌘+, |
| 关闭 | `close` | Ctrl/⌘+W |
| 源码模式 | `sourceMode` | Ctrl/⌘+/ |
| 查找 | `find` | Ctrl/⌘+F |
| 替换 | `replace` | Ctrl/⌘+H |
| 切换侧栏 | `toggleSidebar` | Ctrl/⌘+Shift/⇧+L |
| 段落 | `paragraph` | Ctrl/⌘+0 |
| 一级标题 | `h1` | Ctrl/⌘+1 |
| 二级标题 | `h2` | Ctrl/⌘+2 |
| 三级标题 | `h3` | Ctrl/⌘+3 |
| 四级标题 | `h4` | Ctrl/⌘+4 |
| 五级标题 | `h5` | Ctrl/⌘+5 |
| 六级标题 | `h6` | Ctrl/⌘+6 |
| 提升标题级别 | `incHeading` | Ctrl/⌘+= |
| 降低标题级别 | `decHeading` | Ctrl/⌘+- |
| 插入表格 | `insertTable` | Ctrl/⌘+T |
| 插入公式 | `mathBlock` | Ctrl/⌘+Shift/⇧+M |
| 代码块 | `codeBlock` | Ctrl/⌘+Shift/⇧+K |
| 引用 | `quote` | Ctrl/⌘+Shift/⇧+Q |
| 有序列表 | `orderedList` | Ctrl/⌘+Shift/⇧+[ |
| 无序列表 | `unorderedList` | Ctrl/⌘+Shift/⇧+] |
| 任务列表 | `taskList` | Ctrl/⌘+Shift/⇧+X |
| 链接引用 | `linkReference` | Ctrl/⌘+Alt/⌥+L |
| 脚注 | `footnote` | Ctrl/⌘+Alt/⌥+R |
| 内联公式 | `inlineMath` | Ctrl/⌘+M |
| 链接 | `link` | Ctrl/⌘+K |
| 行内代码 | `inlineCode` | Ctrl/⌘+Shift/⇧+&#96; |
| 下划线 | `underline` | Ctrl/⌘+U |
| 删除线 | `strike` | Alt/⌥+Shift/⇧+5 |
| 清除格式 | `clearFormat` | Ctrl/⌘+\ |
| 复制为 Markdown | `copyAsMarkdown` | Ctrl/⌘+Shift/⇧+D |
| 粘贴为纯文本 | `pastePlain` | Ctrl/⌘+Shift/⇧+V |
| 切换大纲 | `outline` | Ctrl/⌘+Shift/⇧+1 |
| 文件树 | `fileTree` | Ctrl/⌘+Shift/⇧+3 |
| 专注模式 | `focusMode` | F8 |
| 打字机模式 | `typewriterMode` | F9 |
| 全屏 | `fullscreen` | F11 |
| 实际大小 | `zoomActual` | Ctrl/⌘+Shift/⇧+0 |
| 放大 | `zoomIn` | Ctrl/⌘+Shift/⇧+= |
| 缩小 | `zoomOut` | Ctrl/⌘+Shift/⇧+- |
| 加粗 | `bold` | Ctrl/⌘+B |
| 斜体 | `italic` | Ctrl/⌘+I |
| 撤销 | `undo` | Ctrl/⌘+Z |
| 重做 | `redo` | Ctrl/⌘+Y |
| 剪切 | `cut` | Ctrl/⌘+X |
| 复制 | `copy` | Ctrl/⌘+C |
| 粘贴 | `paste` | Ctrl/⌘+V |
| 全选 | `selectAll` | Ctrl/⌘+A |
| 下方插入行 | `table-row-below` | Ctrl/⌘+⏎ |
| 上移该行 | `table-move-row-up` | Ctrl/⌘+Alt/⌥+↑ |
| 下移该行 | `table-move-row-down` | Ctrl/⌘+Alt/⌥+↓ |
| 左移该列 | `table-move-col-left` | Ctrl/⌘+Alt/⌥+← |
| 右移该列 | `table-move-col-right` | Ctrl/⌘+Alt/⌥+→ |
| 删除行 | `table-del-row` | Ctrl/⌘+Shift/⇧+⌫ |
