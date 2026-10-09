# 修复 `npm run tauri build` 的 cargo 配置解析错误

## 问题

```
error: expected a string, but found a table for `LIBCLANG_PATH`
       in src-tauri/.cargo/config.toml
failed to build app: failed to build app
```

## 根因

`src-tauri/.cargo/config.toml` 把环境变量写在 `[target.x86_64-unknown-linux-gnu.env]`
下，却使用了**表格式**写法 `KEY = { value = "...", relative = false }`。

Cargo 的表格式 env **只在顶层 `[env]` 段有效**；`[target.<triple>.env]` 下只接受纯字符串
`KEY = "value"`。因此配置解析阶段直接 abort。

最小复现已验证：

| 写法 | 结果 |
| --- | --- |
| `[target.x86_64-unknown-linux-gnu.env]` + 表格式 | ❌ 报同样的错 |
| `[env]`（顶层）+ 表格式 | ✅ 正常 |
| `[target.<triple>.env]` + `KEY = "value"` | ✅ 正常 |

## 修复

既然要改，顺带发现这段 sysroot 注入已完全多余：

- `/home/Macro/tauri-dev` 与 `/home/macro/tauri-dev` **都不存在**；
- 本机已装好真正的 -dev 包：webkit2gtk-4.1 2.46.3、javascriptcoregtk-4.1、
  libsoup-3.0 3.4.3、gtk+-3.0 3.24.41、glib 2.80.1，pkg-config 直接从
  `/usr/lib/x86_64-linux-gnu/pkgconfig` 解析。

改动：**只动了 `src-tauri/.cargo/config.toml`** —— 删掉整个 sysroot env 块，
保留注释 + 空 `[target.x86_64-unknown-linux-gnu] rustflags = []`，并在注释里写明
"target.env 不能用表格式"这个坑，避免以后再踩。

## 验证

| 检查项 | 结果 |
| --- | --- |
| `cargo check` | ✅ 通过 |
| `cargo build --release` | ✅ 通过（1m37s） |
| `vue-tsc --noEmit`（`npm run build` 前半段） | ✅ 通过 |
| `tauri.conf.json` → `bundle.icon` 三个图标 | ✅ 全部存在 |
| `tauri.conf.json` → `frontendDist: ../dist` | ✅ 存在，225 个文件，index.html 引用完整 |
| `vite build`（`npm run build` 后半段） | ⚠️ 本环境无法验证，见下 |

残留 2 个无害 warning：`src/commands/recovery.rs:63` 未使用变量 `dir`、
`src/state.rs:51` `cache_dir` 未被调用。

## 已知限制：本环境无法跑 `vite build`

在工具沙箱里 `vite build` 必崩：

```
RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm memory
    at lazyllhttp (node:internal/deps/undici/undici:5971:32)
```

原因是沙箱给进程设了 `Max address space = 4GB` 硬限制且 CapEff=0 无法提升，
V8 的 wasm guard region 预留不进去（`new WebAssembly.Memory({initial:1})` 都失败）。
已确认连只有一个 html + 一个 js 的最小 vite 项目同样崩溃，而机器上的真实进程
（dde-session / Xorg / workbuddy）limits 均为 `unlimited` —— **这是沙箱专属限制，
不是项目问题**。已试过无效的绕行：`--wasm-max-mem-pages=256/1024/4096`、
`--wasm-enforce-bounds-checks`、`--no-experimental-fetch`、换 Node 18.19.1、
缩小 `--max-old-space-size`。

请在自己的终端执行 `npm run tauri build` 完成最终验证。

---

# 追加修复：release 二进制启动白屏（WebKitGTK DMA-BUF）

## 现象

`./src-tauri/target/release/typo` 窗口起来了但内容空白，stderr：

```
g_value_set_boxed: assertion 'G_VALUE_HOLDS_BOXED (value)' failed   ← 无害
AT-SPI: Error retrieving accessibility bus address                    ← 无害
KMS: DRM_IOCTL_MODE_CREATE_DUMB failed: 权限不够                      ← 致命
Failed to create GBM buffer of size 1200x800: 权限不够                ← 致命
```

`1200x800` 正是 `tauri.conf.json` 里的窗口尺寸，`sudo` 运行同样报错。

## 决定性证据（udev 规则）

```
/usr/lib/udev/rules.d/50-udev-default.rules:49:
  SUBSYSTEM=="drm", KERNEL!="renderD*", GROUP="video"            → card0/card1 归 root:video
/usr/lib/udev/rules.d/50-udev-default.rules:54:
  SUBSYSTEM=="drm", KERNEL=="renderD*", GROUP="render", MODE="0660"  → renderD128 归 root:render 0660
```

而 `getent group render` → `render:x:994:` **一个成员都没有**，`macro` 只在 `video` 组：

```
uid=1000(macro) gid=1000(macro) groups=...,44(video),...
```

所以 `macro` 打不开 `renderD128`，只能打开 `card0`。又因为在 render node 上
`DRM_IOCTL_MODE_CREATE_DUMB` 本来是允许的（它属于 GEM 内存类 ioctl，不属于
modesetting），报 EPERM 恰恰说明 GBM 手上拿的是 **card0 的 fd**，即 render node 确实
没打开成功 —— 反证了上面的权限判断。

补充：`systemd-logind`（PID 712）确实在跑，`70-uaccess.rules` 给 `renderD*` 打了
`uaccess` tag，理论上活动会话用户可通过 ACL 拿到访问权；但实测仍失败，所以
`usermod -aG render` 才是这台机器上可靠的修法。

## 根因

会话是 **X11**（`deepin-kwin_x11`）。WebKitGTK ≥ 2.41.1 只要 EGL 声称支持 GBM 平台就
走 DMA-BUF 渲染器，但分配不到 backing store 时**网页进程直接不渲染**（白屏），不会
自动回退软件渲染 —— 见 <https://webkit.org/b/261874>。

分配不到的原因链条：

1. 用户 `macro` 在 `video` 组，但**不在 `render` 组**（`render:x:994:` 无任何成员）
   → 打不开 `/dev/dri/renderD128`；
2. GBM 于是退回主节点 `/dev/dri/card0`（此节点 `macro` 能开，因为他在 `video` 组）；
3. `DRM_IOCTL_MODE_CREATE_DUMB` 在 card0 上需要 **DRM master**，已被 Xorg 独占 → EPERM。
4. **sudo 也修不了**：DRM master 是排他的，root 一样抢不到。与用户观察完全吻合。

## 修复

新增 `src-tauri/src/webview.rs`：`apply_dmabuf_workaround()` 在 `run()` 最开头
（任何 webview / WebKitWebProcess 创建之前，因为渲染器选择是从环境变量读的）
检测 `/dev/dri/renderD*` 是否能以读写打开；打不开就设
`WEBKIT_DISABLE_DMABUF_RENDERER=1` 回退软件渲染。用户自己设过该变量时不覆盖。

`src-tauri/src/lib.rs` 用 `#[cfg(target_os = "linux")]` 引入，不影响 Windows/macOS 构建。

## 彻底修法（恢复硬件加速）

```bash
sudo usermod -aG render "$USER"   # 然后注销重新登录
```

加进 `render` 组后 `/dev/dri/renderD128` 可访问，GBM 走 render node 不再需要
DRM master，自动检测也就不会再触发回退。

## 验证状态

`cargo build --release` ✅ 通过（22.8s），二进制已更新至
`src-tauri/target/release/typo`（12.6MB，01:10）。

**兜底代码路径冒烟测试通过** —— 无 DISPLAY 环境下运行二进制，确认提示在 GTK
初始化之前就打印出来了（随后 GTK 因无 display 报错退出，属预期）：

```
typo: no usable DRM render node (/dev/dri/renderD*) — disabling the WebKitGTK
      DMA-BUF renderer to fall back to software rendering.
typo: run `sudo usermod -aG render "$USER"` and log in again to re-enable
      hardware acceleration.
```

**实际渲染效果需用户在桌面会话里确认** —— 沙箱内无 DISPLAY，无法验证画面。

排查建议：

```bash
./src-tauri/target/release/typo                                    # 走自动检测，看是否打印提示
WEBKIT_DISABLE_DMABUF_RENDERER=1 ./src-tauri/target/release/typo   # 强制软件渲染
groups                                                             # 确认是否已含 render
```

若自动检测路径仍白屏（说明 renderD128 能开但 GBM 仍失败），用第二条命令强制回退，
并考虑改用 `WEBKIT_DISABLE_COMPOSITING_MODE=1`。

---

# BUG 修复：手柄菜单 / 右键菜单功能不生效，选中文字无法改样式

## 三个现象，一个根因

1. 行首"手柄"单击出的菜单，任何功能按钮都不生效
2. 右键菜单只有表格相关功能生效，样式功能与插入功能全部不生效
3. 选中文字后右键，无法对选中内容做样式修改

根因：`EditorPane.onContextMenu` 无条件调用了 `setCaret()`，而
`src/commands/prose.ts` 的 `setCaret` 使用 `TextSelection.near()` —— **必然把选区折叠成
光标**。再加上菜单是 `Teleport` 到 body 的全屏浮层，点击时编辑器已经失焦，
ProseMirror 的 `state.selection` 与真实 DOM 选区脱节：

- **现象 1**：手柄是编辑器外的 widget，点击它根本不会给 ProseMirror 任何选区，
  只靠 `setCaret` 那一次 dispatch；一旦被后续状态同步覆盖，所有命令都作用在空的
  选区上 → 全军覆没。
- **现象 2/3**：选中文字右键 → 选区当场被折叠 → 加粗/斜体等没有作用对象；
  依赖真实 DOM 选区的 `document.execCommand('cut'/'copy')` 更是彻底失效。
- **表格命令之所以还活着**：它们从选区结构反查所在表格，对选区形态的容错更强。

## 修复

| 文件 | 改动 |
| --- | --- |
| `src/commands/prose.ts` | 新增 `getSelectionRange()`、`setSelectionRange(from,to)`（`TextSelection.between` 恢复区间 + `view.focus()` 交还焦点）、`focus()` |
| `src/composables/useEditorMenu.ts` | 新增 `range` 状态；`show(x, y, kind, range)` 携带菜单要作用的文档区间 |
| `src/components/editor/EditorPane.vue` | 右键时若已有非空选区且点击落在选区内 → **保留选区**，否则才 `setCaret`；手柄路径同样记录 range |
| `src/components/editor/EditorContextMenu.vue` | `run()` 改为 `hide() → restoreSelection() → 执行动作`；菜单加 `@mousedown.stop.prevent` |
| `src/commands/actions.ts` | 暴露 `restoreSelection()` / `focusEditor()` |

## 验证

`vue-tsc --noEmit` 通过。另外用 esbuild + jsdom 探针实测（无头 Chrome 在本机跑不起来）：

| 场景 | 结果 |
| --- | --- |
| 修复前：`setCaret` 后 `toggleBold` | 选区 `{from:1,to:1,empty:true}`，`strongApplied: **false**` ❌ |
| 修复后：`setSelectionRange(8,13)` 后 `toggleBold` | 选区 `{from:8,to:13,empty:false}`，`strongApplied: **true**` ✅ |
| 手柄路径：`setCaret` + `setHeading(2)` | `paragraphBecameH2: **true**` ✅ |
| `focus()` | 正常 ✅ |

浏览器里的实际交互（点击、焦点）仍需你在桌面端确认。

## 附带事项

工作区内 `.Trash-0/`（378 个文件）被 git 跟踪，是安全删除钩子的残留（node_modules
旧文件）。清理临时目录时曾误碰，已用 `git checkout -- .Trash-0` 完整恢复，
当前 `git status` 仅剩本次 config.toml 改动。建议后续将其加入 `.gitignore` 或提交清理。

---

# BUG 续修：截图红框"功能无效" + 第3行倒数第2个图标看不出功能

用户又用截图反馈：行首手柄菜单与右键菜单里红框标出的按钮点了没反应，且第 3 行倒数第 2 个
图标（旧删除线 `S̶`）渲染成豆腐块、看不出是什么。这一轮是上面菜单修复的收尾。

## 根因（仍与上一轮同源，但有两个独立死点）

1. **剪贴板那排按钮（✂ ⧉ ▤ 🗑）= 死按钮。**
   - 旧实现用 `document.execCommand('cut'/'copy'/'paste')`。但 `execCommand` 在
     WebKitGTK（以及 Blink/Gecko）里 `paste` **直接被禁用**，而 `cut`/`copy` 只作用于
     **聚焦元素的实时 DOM 选区**且不抛错（失败只是返回 `false`）—— 菜单是 Teleport
     浮层，点击时编辑器已失焦，所以这三下永远是静默的 no-op。
2. **第3行倒数第2个图标看不出功能 = 旧删除线 `S̶`（带 combining 的 U+0336）。**
   Deepin/UOS 默认字体栈里没有这个字形 → 渲染成豆腐块。同理，旧 `⌫`/`⧉`/`▤`/`❝`/`•`/`1.`/`☑`
   也都是"字体有就有、没有就 tofu"的脆弱字形。

## 修复

| 文件 | 改动 |
| --- | --- |
| `src/composables/useClipboard.ts`（新增） | 剪贴板抽象：优先 Tauri 官方插件 `@tauri-apps/plugin-clipboard-manager`（`writeText`/`readText`），回退 `navigator.clipboard`，再回退隐藏 textarea + `execCommand('copy')`（仅写）。`isTauri()` 为假时自动走 web 路径 |
| `src/commands/actions.ts` | 重写 `cut`/`copySelection`/`paste`/`copyAsMarkdown`/`pasteAsPlainText`：`cut` = 读选区文本→写剪贴板→恢复选区并删；`paste` = 读剪贴板后 `insert(text)`（MD 生效）；`pasteAsPlainText` = `insertPlainText` |
| `src/components/common/icons.ts`（新增） | 17 个 24×24 SVG path（格式化类取自 `@milkdown/crepe` 图标集，剪贴板/插入类按 Material 约定补）。用 `gen_icons.py` 一次性生成（脚本已删） |
| `src/components/common/Icon.vue`（新增） | `<svg fill=currentColor>`，继承按钮颜色，避免 tofu |
| `src/components/editor/EditorContextMenu.vue` | 全部按钮换 `<Icon name=.../>`，补 `:title`/`:aria-label`；样式条 6 个：bold/italic/code/link/**strike**/clearFormat，删除线现在是真正的删除线-S 图形 |
| `src-tauri/Cargo.toml` | 加 `tauri-plugin-clipboard-manager = "2"` |
| `src-tauri/src/lib.rs` | 加 `.plugin(tauri_plugin_clipboard_manager::init())` |
| `src-tauri/capabilities/default.json` | 加 `clipboard-manager:default` |
| `src/i18n/locales/{zh-CN,zh-TW,en}.ts` | 补 `copyAsMarkdown` 等键 |

## 验证

- `vue-tsc --noEmit` ✅ 通过（exit 0）
- `cargo build --release` ✅ 通过（仅 2 个无害 warning：`recovery.rs:63` 未用变量 `dir`、`state.rs:51` 未被调用的 `cache_dir`）
- 三语言包 `ctx` 键齐全
- 交互层（点击/焦点/剪贴板）仍无法在沙箱验证（无头 Chrome 崩），需在桌面端实测

## 你这边怎么验证

前端 `dist/` 仍是旧构建，直接跑旧 release 二进制看不到改动。请重新构建：

```bash
npm run tauri build          # 前端 + Rust 一起重编（你机器上能跑通 vite build）
# 或仅重编前端后手动起：npm run build
./src-tauri/target/release/typo
```

实测清单：
- 选中一段文字 → 右键 → 点 B/I/删除线，确认作用到选中文本
- 行首手柄 → 点"段落"子菜单里的 H2/H3，确认整块变标题
- 右键 → 剪贴板那排 ✂ ⧉ ▤，确认剪切/复制/粘贴真正生效（之前是死的）
- 第3行中间那个"删除线"图标现在是清晰的 S 加删除线，不再是豆腐块

