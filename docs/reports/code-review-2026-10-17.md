# Typo 全面代码评审与修复报告

日期：2026-10-17。范围：当前工作区前端、编辑器插件、文档与图片操作、导出、Tauri 文件/备份接口、依赖和安装关联脚本。保留此前未提交的菜单、快捷键、列表转换和安装包修复；本报告记录本轮增量评审。图片继续保存在本地目录，没有引入图床或上传服务。

## 已修复问题

P1 表示内容丢失或安全风险；P2 表示功能、状态或资源管理问题。

| 编号 | 优先级 | 问题与修复 | 主要位置 |
| --- | --- | --- | --- |
| R01 | P1 | 源码输入只保存在组件中，未及时标记未保存；改为直接更新文档 store 和大纲。 | `src/composables/useSourceMode.ts` |
| R02 | P1 | 自动备份读取隐藏的可视编辑器，可能备份旧源码或混用另一个文档路径；改为同步截取路径和正文，并防止备份重叠。 | `src/composables/useAutosave.ts` |
| R03 | P1 | 保存成功无条件清除未保存状态，掩盖保存期间继续输入的内容；按实际保存的内容建立基线，保留后续修改。 | `src/stores/editor.ts`, `src/commands/actions.ts` |
| R04 | P1 | 异步保存/另存为完成后可能修改已切换文档的名称、路径和状态；加入文档身份检查，固定目标路径。 | `src/commands/actions.ts` |
| R05 | P1 | 多次保存可能倒序完成而覆盖新内容；保存操作通过队列串行执行。 | `src/commands/actions.ts` |
| R06 | P1 | 新建、打开、关闭窗口缺少未保存保护；加入原生确认、浏览器离开保护和原生窗口关闭事件处理。确认期间内容变化也会取消操作。 | `src/utils/documentGuard.ts`, `src/composables/useDocumentClose.ts`, `src/stores/files.ts` |
| R07 | P1 | 迟到的打开结果可覆盖后来打开的文档或读取期间输入的新内容；加入请求顺序、文档身份及内容检查。 | `src/stores/files.ts` |
| R08 | P1 | 删除失败仍会清空文档；改为仅在删除成功且文档未变化时清空，使用原生确认。 | `src/commands/actions.ts` |
| R09 | P1 | 文档、设置、最近文件和恢复索引直接截断写入；改为同目录独占临时文件、完整写入与同步后原子替换。保留已有符号链接和权限，Unix 临时文件初始权限为 0600。 | `src-tauri/src/atomic_file.rs`, `commands/file.rs`, `commands/recovery.rs`, `state.rs` |
| R10 | P1 | 非 UTF-8 文件被静默替换成乱码，后续保存可能毁坏原文；改为明确拒绝无效 UTF-8。 | `src-tauri/src/commands/file.rs` |
| R11 | P1 | 恢复内容被标记已保存并立即删除备份；恢复内容现在保持未保存，保留备份。备份删除失败不再丢弃索引。 | `src/components/dialogs/RecoveryDialog.vue`, `src/stores/editor.ts`, `src-tauri/src/commands/recovery.rs` |
| R12 | P1 | 图片路径采用全局字符串替换，会误改正文、链接、代码和较长路径；使用 Markdown 语法位置，仅替换图片目的地址，支持引用式图片及 HTML 图片。 | `src/utils/images.ts` |
| R13 | P1 | 图片写入在名称重复时覆盖原文件；改为独占创建并自动加前缀避让，写入失败清理不完整目标。 | `src-tauri/src/commands/asset.rs`, `src-tauri/src/image_files.rs` |
| R14 | P1 | 批量移动图片期间切换/修改文档，可能重写错误文档或删除仍被引用的源图；加文档检查，保存成功且状态一致后才删除原图。 | `src/commands/actions.ts` |
| R15 | P1 | 导出原始 HTML 可带脚本和事件属性，PDF iframe 与应用同源且未隔离；增加 HTML 语法解析与白名单清理、导出 CSP，以及禁止脚本的 iframe sandbox。 | `src/utils/exporter/toHtml.ts`, `toPdf.ts` |
| R16 | P2 | 自动保存间隔修改不生效或非法值引发异常频率；监听间隔设置并提供默认值和最小间隔。 | `src/composables/useAutosave.ts` |
| R17 | P2 | 原地更新、撤销到已保存内容仍被标记未保存；使用内容基线比较，加载可视文档时建立规范化基线。 | `src/stores/editor.ts`, `src/components/editor/EditorPane.vue` |
| R18 | P2 | 隐藏编辑器的迟到事件可能覆盖源码；源码模式忽略可视编辑事件，过滤程序加载产生的相同 Markdown 通知。 | `src/components/editor/EditorPane.vue`, `src/milkdown/setup.ts` |
| R19 | P2 | 切换源码及查找替换会清除可视编辑器撤销历史；区分新文档加载和同文档替换。 | `src/milkdown/setup.ts`, `src/composables/useSourceMode.ts`, `useFind.ts` |
| R20 | P2 | 替换文本里的 `$&`、`$$` 等被当作特殊替换语法；改为字面值替换，并阻止异步替换跨文档执行。 | `src/composables/useFind.ts` |
| R21 | P2 | 下划线插件未正确注册解析转换，且序列化会丢失粗体等并存标记；修正 remark 插件工厂和标记序列化。 | `src/milkdown/plugins/underline.ts` |
| R22 | P2 | 导出公式的全文正则会改写代码块和行内代码；改为解析后的正文文本节点处理。 | `src/utils/exporter/toHtml.ts` |
| R23 | P2 | PDF 嵌套完整 HTML、打印前未等待资源、1 秒后过早移除窗口；改为单文档打印，等待加载及字体，打印结束后清理。取消导出也不再显示成功提示。 | `src/utils/exporter/toPdf.ts`, `index.ts` |
| R24 | P2 | 根目录路径计算错误、`..` 未规整、跨盘符/UNC 相对路径错误及元数据解码异常；修复路径规则并添加回归用例。 | `src/utils/file.ts`, `src/utils/images.ts` |
| R25 | P2 | 编辑器被 Vue 深度代理，异步挂载结束时可能在卸载后泄漏实例；使用 shallowRef 和挂载代次检查。销毁时移除粘贴监听，正确聚焦编辑器。 | `src/composables/useMilkdown.ts`, `src/milkdown/setup.ts` |
| R26 | P2 | 调整宽度的拖动在取消或组件卸载时未清理监听；补齐清理。目录树异步返回也加入顺序检查。 | `src/components/editor/EditorPane.vue`, `src/stores/files.ts` |
| R27 | P2 | 异步剪切、粘贴、选图和图片根目录选择可能作用于另一文档；加入身份、内容和模式检查，读取图片失败可正常结束。 | `src/commands/actions.ts` |
| R28 | P2 | 远程图片下载无限等待和无限读取；限制 HTTP(S)、30 秒超时及 25 MiB 大小。 | `src-tauri/src/commands/asset.rs` |
| R29 | P2 | 夜间和 Gothic 主题的 Mermaid 仍用亮色；补齐主题识别。 | `src/milkdown/plugins/mermaid.ts` |
| R30 | P2 | Rust 最低版本声明低于锁定的 Tauri 依赖要求；改为依赖实际要求的 Rust 1.90。 | `src-tauri/Cargo.toml` |
| R31 | 安全 | 将 Vite 更新至兼容 Node 18 的 6.4.4，KaTeX 统一锁定到 0.18.2；引入 rehype-raw/rehype-sanitize。jsdom 移至开发依赖并使用兼容 Node 18 的版本。 | `package.json`, `package-lock.json` |

## 验证

最终验证全部通过：

| 检查 | 结果 |
| --- | --- |
| `npm test` | 32/32，包括路径、图片语法、文档状态、HTML 清理和 Linux 关联脚本 |
| `npm run test:review` | 12/12，浏览器实测状态/竞态/打印隔离；系统接口使用模拟 IPC |
| `npm run test:menus` | 163/163，含菜单、工具条、快捷键与窗口边界检查 |
| `npm run test:list-style` | 69/69，含列表各行、嵌套列表、段落样式转换与撤销 |
| `npm run test:native-contract` | 15/15，模拟 IPC 契约检查 |
| `npm run build` | 通过，Vite 6.4.4 生产构建 |
| Chrome 加载生产静态资源 | 挂载、Markdown 加载、键盘编辑和无未捕获异常四项通过 |
| `cargo test --manifest-path src-tauri/Cargo.toml --locked` | 5/5，含原子替换、失败保护、符号链接/权限及图片复制 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --locked -- -D warnings` | 通过，无告警 |
| `cargo build --manifest-path src-tauri/Cargo.toml --features custom-protocol --locked` | 通过，Linux debug 桌面程序含生产前端资源；产物 `src-tauri/target/debug/typo` |
| `npm audit --omit=dev` | 0 项漏洞 |
| `git diff --check` | 通过 |

浏览器结果保存在 `tests/menu-results.json`、`list-style-results.json`、`native-contract-results.json`、`review-results.json`、`production-smoke-results.json`。浏览器回归脚本要求先启动本地 Vite 服务（1420 端口），默认使用 `/usr/bin/google-chrome`；可通过 `CHROME_PATH` 指定 Chrome。

构建会报告部分模块同时静态/动态导入的分包提示，不影响构建或运行。本轮未生成和实际安装三个系统的发行安装包。

## 尚需注意的边界

- 浏览器的原生接口测试使用模拟 IPC；不能据此声称原生窗口关闭确认、系统打印、剪贴板和安装流程已在三个操作系统实测。
- Windows/macOS 安装包未在对应系统构建和安装。受操作系统默认应用策略限制，注册 `.md` 关联不等于可以静默强制替换用户默认程序。
- 全量 npm 审计仍有 7 项开发依赖告警，源于 Puppeteer 24 的下载/代理/解压依赖链；生产依赖审计为 0。官方修复路线涉及 Puppeteer 25 及更高的 Node 要求，本轮保留当前 Node 18 测试环境。测试直接启动本机 Chrome，不下载或解压浏览器归档。告警仍应在开发工具升级时解决。
- 未命名文档尚不具备按路径存储的崩溃恢复备份；关闭已有未保存内容会确认。
- HTML 导出会清理危险 HTML，因此脚本、事件属性等不再保留。图片和 KaTeX 字体未全部打包为独立 HTML 的内嵌资源，跨机器移动导出 HTML 时仍需检查这些资源。
- 原子替换已经同步临时文件并保留权限，但没有实现跨进程文档锁，也不承诺所有文件系统断电场景下的持久化保证。
- Tauri 的本地资源协议仍允许任意用户文档位置，未在本轮改为按打开文档动态收紧目录权限。

## 安全修复依据

- [rehype-sanitize 官方清理流程](https://github.com/rehypejs/rehype-sanitize)
- [Vite Windows 路径绕过安全公告](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)
- [KaTeX trust 限制绕过安全公告](https://github.com/advisories/GHSA-238p-pmpm-9mq7)
