import type { Editor } from '@milkdown/core'
import { useMilkdown } from '@/composables/useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useFilesStore } from '@/stores/files'
import { useSettingsStore } from '@/stores/settings'
import { useTauri, isTauri } from '@/composables/useTauri'
import { useFind } from '@/composables/useFind'
import { useUI } from '@/composables/useUI'
import { readClipboardText, writeClipboardText } from '@/composables/useClipboard'
import { showToast } from '@/utils/toast'
import { confirmDiscard } from '@/utils/documentGuard'
import { exportDocument } from '@/utils/exporter'
import {
  insertTable as insertTablePlugin,
  addRow as tableAddRow,
  removeRow as tableRemoveRow,
  addColumn as tableAddColumn,
  removeColumn as tableRemoveColumn,
  removeTable as tableRemoveTable,
  moveRow as tableMoveRow,
  moveColumn as tableMoveColumn,
  clearColumnWidths as tableClearWidths,
  tableToMarkdown,
} from '@/milkdown/plugins/table'
import { insertMath } from '@/milkdown/plugins/latex'
import { insertDiagram } from '@/milkdown/plugins/mermaid'
import { findTemplate } from '@/milkdown/plugins/mermaidTemplates'
import { insertImage } from '@/milkdown/plugins/image'
import { insert } from '@milkdown/utils'
import { dirname, nativeJoin } from '@/utils/file'
import { localImageFiles, prepareImagesForSave, rewriteImageReferences } from '@/utils/images'
import { convertFileSrc } from '@tauri-apps/api/core'
import * as prose from './prose'
import type { Lang } from '@/types'

/**
 * Application-level command actions — the single implementation every surface
 * (menu bar, toolbar, keymap, command palette) calls into. Stores/composables
 * are resolved lazily so this module is safe to import anywhere after Pinia is
 * installed.
 */

async function getMarkdown(): Promise<string> {
  const milkdown = useMilkdown()
  const editor = useEditorStore()
  if (useUI().sourceMode.value) return sourceArea()?.value ?? editor.doc.content
  try {
    const md = await milkdown.getMarkdown()
    return md ?? editor.doc.content
  } catch {
    return editor.doc.content
  }
}

function unchangedDocument(): () => boolean {
  const store = useEditorStore()
  const session = store.loadSignal
  const content = store.doc.content
  const sourceMode = useUI().sourceMode.value
  return () => session === store.loadSignal && content === store.doc.content && sourceMode === useUI().sourceMode.value
}

function withEditor(fn: (editor: Editor) => void): void {
  const e = useMilkdown().getEditor()
  if (!e) {
    showToast('编辑器尚未就绪', 'error')
    return
  }
  fn(e)
}

function requireTauri(action: string): boolean {
  if (isTauri()) return true
  showToast(`「${action}」需要桌面运行时（浏览器预览模式不可用）`, 'error')
  return false
}

/* ---------------------------- file ---------------------------- */

export async function newFile(): Promise<void> {
  await useFilesStore().newFile()
}

/** Create a native window; resolves once the window exists. */
export async function newWindow(path?: string | null): Promise<boolean> {
  if (!requireTauri('新建窗口')) return false
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('new_window', { path: path ?? null })
    return true
  } catch (error) {
    showToast(String(error), 'error')
    return false
  }
}

export async function openFileDialog(): Promise<void> {
  if (!requireTauri('打开文件')) return
  const p = await useTauri().pickOpen()
  if (p) await useFilesStore().openFile(p)
}

export async function openFolderDialog(): Promise<void> {
  if (!requireTauri('打开文件夹')) return
  const dir = await useTauri().pickDir()
  if (dir) await useFilesStore().refreshTree(dir)
}

export function quickOpen(): void {
  useUI().openQuickOpen()
}

/**
 * Persist embedded images next to the document and rewrite the Markdown so the
 * on-disk file keeps portable relative refs while the live editor keeps absolute
 * `asset://` URLs (which actually render). Then save to `path` and return the
 * resulting file identity.
 */
// Serialize saves: an older write must never finish after a newer save.
let saveQueue: Promise<void> = Promise.resolve()
function queueSave(as: boolean): Promise<void> {
  const editor = useEditorStore()
  const session = editor.loadSignal
  const job = saveQueue.then(async () => {
    if (session !== editor.loadSignal) return
    let path = as ? null : editor.doc.path
    if (!path) path = await useTauri().pickSave(editor.doc.name || 'untitled.md')
    if (!path || session !== editor.loadSignal) return
    const revisionContent = editor.doc.content
    const content = await getMarkdown()
    if (session !== editor.loadSignal) return
    const prepared = await prepareImagesForSave(content, path)
    const result = as || !editor.doc.path
      ? await useTauri().saveFileAs(path, prepared.content)
      : await useTauri().saveFile(path, prepared.content)
    if (session !== editor.loadSignal) return
    editor.doc.path = result.path
    editor.doc.name = result.path.split(/[\\/]/).pop() || 'untitled.md'
    // Keep newer edits dirty; only normalize images when this exact revision was saved.
    let savedDisplay = content
    if (editor.doc.content === revisionContent) {
      const mappings = new Map(prepared.displayMappings.map(m => [m.old, m.display]))
      savedDisplay = rewriteImageReferences(content, mappings)
      editor.updateContent(savedDisplay)
      if (!useUI().sourceMode.value) {
        const ed = useMilkdown().getEditor()
        for (const mapping of prepared.displayMappings) prose.replaceImageSrc(ed, mapping.old, mapping.display)
      }
    }
    editor.markSaved(savedDisplay)
    if (prepared.errors) showToast(`有 ${prepared.errors} 张图片未能保存到本地，已保留原链接`, 'error')
    await useFilesStore().addRecent(result.path)
  })
  saveQueue = job.catch(() => {})
  return job
}

export async function saveFile(): Promise<void> {
  if (requireTauri('保存')) await queueSave(false)
}

export async function saveFileAs(): Promise<void> {
  if (requireTauri('另存为')) await queueSave(true)
}

/** Close one tab after persisting its current content. */
export async function closeTab(id: string): Promise<void> {
  const editor = useEditorStore()
  if (editor.activeTabId !== id) editor.activateTab(id)
  if (editor.doc.dirty) await saveFile()
  if (editor.doc.dirty) return
  editor.closeTab(id)
}

/**
 * Move a tab's document into a brand-new window. The document is persisted
 * first because the new window reads it from disk, and the tab is closed only
 * once the window that owns it now actually exists.
 */
export async function moveTabToWindow(id: string): Promise<void> {
  const editor = useEditorStore()
  const tab = editor.tabs.find((item) => item.id === id)
  if (!tab?.doc.path) return
  if (editor.activeTabId !== id) editor.activateTab(id)
  if (editor.doc.dirty) await saveFile()
  if (editor.doc.dirty) return
  if (!await newWindow(editor.doc.path)) return
  editor.closeTab(id)
}

export async function deleteCurrentFile(): Promise<void> {
  const editor = useEditorStore()
  if (!editor.doc.path) {
    await newFile()
    return
  }
  if (!requireTauri('删除')) return
  const session = editor.loadSignal
  const content = editor.doc.content
  const path = editor.doc.path
  const { confirm } = await import('@tauri-apps/plugin-dialog')
  if (!await confirm(`确定删除文件「${editor.doc.name}」？此操作不可恢复。`, { title: '删除文件', kind: 'warning' })) return
  if (session !== editor.loadSignal || content !== editor.doc.content) return
  try {
    await useTauri().deleteFile(path)
    showToast('已删除', 'info')
  } catch {
    return
  }
  if (session === editor.loadSignal && content === editor.doc.content) editor.loadFromText('', null, 'untitled.md')
}

export function saveAll(): void {
  showToast('当前版本仅维护单个打开的文档', 'info')
}

export function revealFileInFolder(): void {
  showToast('打开文件位置需要桌面运行时支持，v1 暂未开放', 'info')
}

export async function exportAs(format: 'markdown' | 'html' | 'pdf'): Promise<void> {
  const md = await getMarkdown()
  const base = (useEditorStore().doc.name || 'untitled').replace(/\.md$/i, '')
  await exportDocument(md, format, base || 'untitled')
}

export function printDocument(): void {
  void exportAs('pdf')
}

export function closeWindow(): void {
  if (isTauri()) {
    void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => getCurrentWindow().close())
  } else window.close()
}

/** Exit the whole desktop application from File > Exit. */
export function exitApp(): void {
  if (!isTauri()) {
    window.close()
    return
  }
  // Confirm before asking the native process to exit: app.exit() intentionally
  // closes every window and therefore cannot be used as the confirmation
  // boundary itself.
  void (async () => {
    if (!await confirmDiscard()) return
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      const window = getCurrentWindow()
      const [size, position] = await Promise.all([window.outerSize(), window.outerPosition()])
      await invoke('save_window_state', {
        state: { x: position.x, y: position.y, width: size.width, height: size.height },
      })
      await invoke('exit_app')
    } catch (error) {
      showToast(`退出失败：${String(error)}`, 'error')
    }
  })()
}

function sourceArea(): HTMLTextAreaElement | null {
  return useUI().sourceMode.value ? document.querySelector<HTMLTextAreaElement>('.source-textarea') : null
}

function replaceSourceSelection(text: string): boolean {
  const area = sourceArea()
  if (!area) return false
  area.focus()
  if (!document.execCommand('insertText', false, text)) {
    area.setRangeText(text, area.selectionStart, area.selectionEnd, 'end')
  }
  area.dispatchEvent(new Event('input', { bubbles: true }))
  return true
}

/* ---------------------------- edit ---------------------------- */

export function undo(): void {
  const area = sourceArea()
  if (area) { area.focus(); document.execCommand('undo'); return }
  withEditor((e) => prose.undo(e))
}

export function redo(): void {
  const area = sourceArea()
  if (area) { area.focus(); document.execCommand('redo'); return }
  withEditor((e) => prose.redo(e))
}

export function cut(): void {
  const unchanged = unchangedDocument()
  const area = sourceArea()
  if (area) {
    const { selectionStart: from, selectionEnd: to } = area
    void writeClipboardText(area.value.slice(from, to)).then(ok => {
      if (ok && unchanged() && sourceArea() === area) { area.setSelectionRange(from, to); replaceSourceSelection('') }
    })
    return
  }
  const editor = useMilkdown().getEditor()
  const range = prose.getSelectionRange(editor)
  if (!range || range.empty) {
    showToast('请先选中要剪切的内容', 'info')
    return
  }
  const text = prose.getSelectionText(editor)
  void writeClipboardText(text).then((ok) => {
    if (!unchanged()) return
    if (!ok) {
      showToast('剪切失败：无法写入系统剪贴板', 'error')
      return
    }
    withEditor((e) => {
      prose.setSelectionRange(e, range.from, range.to)
      prose.deleteSelection(e)
    })
  })
}

export function copySelection(): void {
  const area = sourceArea()
  if (area) { void writeClipboardText(area.value.slice(area.selectionStart, area.selectionEnd)); return }
  const text = prose.getSelectionText(useMilkdown().getEditor())
  if (!text) {
    showToast('请先选中要复制的内容', 'info')
    return
  }
  void writeClipboardText(text).then((ok) => {
    showToast(ok ? '已复制' : '复制失败：剪贴板不可用', ok ? 'info' : 'error')
  })
}

/** Paste the clipboard, letting Markdown syntax in it take effect. */
export function paste(): void {
  const unchanged = unchangedDocument()
  void (async () => {
    const text = await readClipboardText()
    if (!unchanged()) return
    if (!text) {
      showToast('无法读取剪贴板内容（可改用 Ctrl+V）', 'error')
      return
    }
    if (!replaceSourceSelection(text)) withEditor((e) => e.action(insert(text)))
  })()
}

export async function copyAsMarkdown(): Promise<void> {
  const area = sourceArea()
  if (area) { await copyText(area.value.slice(area.selectionStart, area.selectionEnd) || area.value); return }
  const editor = useMilkdown().getEditor()
  const selected = editor ? prose.getSelectionMarkdown(editor) : null
  await copyText(selected ?? await getMarkdown())
}

export async function pasteAsPlainText(): Promise<void> {
  const unchanged = unchangedDocument()
  const text = await readClipboardText()
  if (!unchanged()) return
  if (!text) {
    showToast('无法读取剪贴板内容（可改用 Ctrl+Shift+V）', 'error')
    return
  }
  if (!replaceSourceSelection(text)) withEditor((e) => prose.insertPlainText(e, text))
}

async function copyText(text: string): Promise<void> {
  const ok = await writeClipboardText(text)
  showToast(ok ? '已复制' : '复制失败：剪贴板不可用', ok ? 'info' : 'error')
}

export function selectAll(): void {
  const area = sourceArea()
  if (area) { area.focus(); area.select(); return }
  withEditor((e) => prose.selectAll(e))
}

/**
 * Re-apply `from`/`to` and give the editor focus back.
 *
 * Floating menus (block handle, right-click) live outside the editor DOM, so the
 * click that triggers an item leaves ProseMirror's `state.selection` and the real
 * DOM selection out of sync. Every menu item must call this first — otherwise the
 * command applies to the wrong place, and clipboard actions (`execCommand`) do
 * nothing at all because they operate on the live DOM selection.
 */
export function restoreSelection(from: number, to: number): void {
  withEditor((e) => prose.setSelectionRange(e, from, to))
}

export function focusEditor(): void {
  withEditor((e) => prose.focus(e))
}

/**
 * The 🗑 button. With a selection it removes just that text; on a bare caret
 * (the block-handle entry point) it removes the whole block, which is what
 * Typora's block menu does.
 */
export function deleteSelection(): void {
  withEditor((e) => {
    const range = prose.getSelectionRange(e)
    if (range && !range.empty) {
      prose.deleteSelection(e)
      return
    }
    if (!prose.deleteBlock(e)) showToast('当前位置没有可删除的内容块', 'info')
  })
}

export function openFind(): void {
  useUI().openFind()
}

export function openReplace(): void {
  useFind().replaceVisible.value = true
  useUI().openFind()
}

/* ---------------------------- paragraph ---------------------------- */

export function setHeading(level: number): void {
  withEditor((e) => prose.setHeading(e, level))
}

export function setParagraph(): void {
  withEditor((e) => prose.setParagraph(e))
}

export function increaseHeadingLevel(): void {
  withEditor((e) => prose.bumpHeading(e, -1))
}

export function decreaseHeadingLevel(): void {
  withEditor((e) => prose.bumpHeading(e, 1))
}

export function insertTable(): void {
  withEditor((e) => insertTablePlugin(e))
}

/* ---------------------------- table operations (context menu) ---------------------------- */

export function tableRowAbove(): void {
  withEditor((e) => tableAddRow(e, false))
}

export function tableRowBelow(): void {
  withEditor((e) => tableAddRow(e, true))
}

export function tableColLeft(): void {
  withEditor((e) => tableAddColumn(e, false))
}

export function tableColRight(): void {
  withEditor((e) => tableAddColumn(e, true))
}

export function tableDeleteRow(): void {
  withEditor((e) => tableRemoveRow(e))
}

export function tableDeleteCol(): void {
  withEditor((e) => tableRemoveColumn(e))
}

export function tableDelete(): void {
  withEditor((e) => tableRemoveTable(e))
}

export function tableMoveRowUp(): void {
  withEditor((e) => tableMoveRow(e, -1))
}

export function tableMoveRowDown(): void {
  withEditor((e) => tableMoveRow(e, 1))
}

export function tableMoveColLeft(): void {
  withEditor((e) => tableMoveColumn(e, -1))
}

export function tableMoveColRight(): void {
  withEditor((e) => tableMoveColumn(e, 1))
}

export function tableFormat(): void {
  withEditor((e) => tableClearWidths(e))
  showToast('已格式化表格：列宽随内容自适应', 'info')
}

export async function tableCopy(): Promise<void> {
  const e = useMilkdown().getEditor()
  if (!e) return
  const md = tableToMarkdown(e)
  if (!md) return
  const ok = await writeClipboardText(md)
  showToast(ok ? '已复制表格（Markdown）' : '复制失败：剪贴板不可用', ok ? 'info' : 'error')
}

export function insertCodeBlock(): void {
  withEditor((e) => prose.setCodeBlock(e))
}

/* ---------------------------- code tools (paragraph menu) ---------------------------- */

/** Copy the plain text of the code block at the caret to the clipboard. */
export async function copyCodeBlockContent(): Promise<void> {
  const text = prose.getCodeBlockText(useMilkdown().getEditor())
  if (text == null) {
    showToast('光标不在代码块内', 'info')
    return
  }
  const ok = await writeClipboardText(text)
  showToast(ok ? '已复制代码块内容' : '复制失败：剪贴板不可用', ok ? 'info' : 'error')
}

/** Indent the lines intersecting the current selection by two spaces. */
export function indentSelectedLines(): void {
  withEditor((e) => prose.indentCodeLines(e, 'selection'))
}

/** Indent every line of the code block at the caret by two spaces. */
export function indentCodeBlock(): void {
  withEditor((e) => prose.indentCodeLines(e, 'all'))
}

/** Insert a GitHub-style alert block of the given type. */
export function insertAlert(type: prose.AlertType): void {
  withEditor((e) => prose.insertAlert(e, type))
}

/** Set the checkbox state of the task-list item containing the caret. */
export function setTaskStatus(status: prose.TaskStatus): void {
  withEditor((e) => prose.setTaskStatus(e, status))
}

export function insertMathBlock(): void {
  withEditor((e) => insertMath(e, 'E = mc^2', true))
}

export function insertInlineMath(): void {
  withEditor((e) => insertMath(e, 'E = mc^2', false))
}

export function insertBlockquote(): void {
  withEditor((e) => prose.toggleBlockquote(e))
}

export function insertOrderedList(): void {
  withEditor((e) => prose.toggleOrderedList(e))
}

export function insertUnorderedList(): void {
  withEditor((e) => prose.toggleBulletList(e))
}

export function insertTaskList(): void {
  withEditor((e) => prose.toggleTaskList(e))
}

export function indentList(): void {
  withEditor((e) => prose.sinkIndent(e))
}

export function outdentList(): void {
  withEditor((e) => prose.liftIndent(e))
}

export function insertParagraphAbove(): void {
  withEditor((e) => prose.insertParagraphAbove(e))
}

export function insertParagraphBelow(): void {
  withEditor((e) => prose.insertParagraphBelow(e))
}

export function insertLinkReference(): void {
  withEditor((e) => prose.insertLinkReference(e))
}

export function insertFootnote(): void {
  withEditor((e) => prose.insertFootnote(e))
}

export function insertHorizontalRule(): void {
  withEditor((e) => prose.insertHorizontalRule(e))
}

export function insertToc(): void {
  withEditor((e) => prose.insertToc(e))
}

export function insertYamlFrontMatter(): void {
  withEditor((e) => prose.insertYamlFrontMatter(e))
}

export function insertDiagramBlock(): void {
  withEditor((e) => insertDiagram(e, findTemplate('flowchart').code))
}

/** Insert an example ```` ```mermaid ```` block for the chosen diagram type. */
export function insertDiagramTemplate(id: string): void {
  withEditor((e) => insertDiagram(e, findTemplate(id).code))
}

/* ---------------------------- format ---------------------------- */

export function toggleBold(): void {
  withEditor((e) => {
    if (!prose.toggleBold(e)) showToast('当前上下文不支持加粗', 'info')
  })
}

export function toggleItalic(): void {
  withEditor((e) => {
    if (!prose.toggleItalic(e)) showToast('当前上下文不支持斜体', 'info')
  })
}

export function toggleUnderline(): void {
  withEditor((e) => {
    if (!prose.toggleUnderline(e)) showToast('当前上下文不支持下划线', 'info')
  })
}

export function toggleInlineCode(): void {
  withEditor((e) => {
    // A click in the top toolbar / format menu blurs the editor; re-apply the
    // captured selection and hand focus back so the mark toggles on the *selected*
    // text (the floating/context menu already does this via restoreSelection — we
    // mirror it here so every surface behaves identically).
    const range = prose.getSelectionRange(e)
    if (range && !range.empty) prose.setSelectionRange(e, range.from, range.to)
    prose.toggleInlineCode(e)
  })
}

export function toggleStrike(): void {
  withEditor((e) => {
    if (!prose.toggleStrike(e)) showToast('当前上下文不支持删除线', 'info')
  })
}

export function insertComment(): void {
  withEditor((e) => prose.insertComment(e))
}

export function insertHyperlink(): void {
  withEditor((e) => {
    // Preserve the current selection across the click that opened the toolbar /
    // menu (the editor blurs), then add the link to the selected text instead of
    // replacing it with a placeholder.
    const range = prose.getSelectionRange(e)
    if (range && !range.empty) prose.setSelectionRange(e, range.from, range.to)
    prose.insertLink(e)
  })
}

export async function insertLocalImage(): Promise<void> {
  const unchanged = unchangedDocument()
  if (isTauri() && localStorage.getItem('typo-image-insert-mode') === 'none') {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const path = await open({ multiple: false, filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'] }] })
    if (typeof path === 'string' && unchanged()) withEditor(editor => insertImage(editor, convertFileSrc(path), ''))
  } else pickAndInsertImage()
}

/** Open a file picker and insert the chosen image (relative asset when possible). */
export function pickAndInsertImage(): void {
  const unchanged = unchangedDocument()
  const docPath = useEditorStore().doc.path
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    input.remove()
    if (!file || !unchanged()) return
    const editor = useEditorStore()
    const e = useMilkdown().getEditor()
    if (!e) return
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    if (docPath && isTauri()) {
      try {
        const buf = await file.arrayBuffer()
        const rel = await useTauri().writeAsset(docPath, filename, new Uint8Array(buf))
        // Insert an absolute `asset://` URL so the webview can render it right
        // away; the on-disk file keeps a relative `./assets/…` ref after saving.
        const abs = nativeJoin(dirname(docPath), rel)
        if (unchanged()) insertImage(e, convertFileSrc(abs), file.name)
        return
      } catch {
        /* fall through to data-url */
      }
    }
    const dataUrl = await new Promise<string>((res, reject) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.onerror = () => reject(r.error ?? new Error('读取图片失败'))
      r.readAsDataURL(file)
    })
    if (unchanged()) insertImage(e, dataUrl, file.name)
  }
  input.click()
}

export function clearStyle(): void {
  withEditor((e) => prose.clearFormatting(e))
}

/* ---------------------------- link operations (format menu) ---------------------------- */

/** Open the link under the caret in the system browser / Tauri opener. */
export async function openLink(): Promise<void> {
  const href = prose.getLinkHref(useMilkdown().getEditor())
  if (!href) {
    showToast('光标不在链接上', 'info')
    return
  }
  if (!/^(https?:|mailto:)/i.test(href)) {
    showToast('不支持的链接协议', 'error')
    return
  }
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_external_url', { url: href })
  } else window.open(href, '_blank', 'noopener,noreferrer')
}

/** Copy the `href` of the link under the caret to the clipboard. */
export async function copyLinkAddress(): Promise<void> {
  const href = prose.getLinkHref(useMilkdown().getEditor())
  if (!href) {
    showToast('光标不在链接上', 'info')
    return
  }
  const ok = await writeClipboardText(href)
  showToast(ok ? '已复制链接地址' : '复制失败：剪贴板不可用', ok ? 'info' : 'error')
}

/** Prompt for a new URL and rewrite the link mark at the caret. */
export async function editLink(): Promise<void> {
  const editor = useMilkdown().getEditor()
  if (!editor) return
  const current = prose.getLinkHref(editor) ?? 'https://'
  const next = window.prompt('编辑链接地址', current)
  if (next == null || next === '') return
  const range = prose.getLinkRange(editor)
  if (range) prose.setLinkHref(editor, range.from, range.to, next)
  else prose.setLinkHref(editor, 0, 0, next)
}

/** Remove the link mark over the selection. */
export function removeLink(): void {
  withEditor((e) => prose.removeLink(e))
}

/* ---------------------------- image submenu (format menu) ---------------------------- */

/** Insert an image from a URL entered in a prompt. */
export function insertRemoteImage(): void {
  const url = window.prompt('输入图片 URL', 'https://')
  if (!url) return
  const editor = useMilkdown().getEditor()
  if (editor) insertImage(editor, url, '')
}

/** Insert from iPhone — requires macOS Continuity, not available in v1. */
export function insertFromIPhone(): void {
  showToast('需要 macOS 连续互通，暂未支持', 'info')
}

/** Reload all images — re-focus the editor so decorations/embeds rebuild. */
export function reloadAllImages(): void {
  document.querySelectorAll<HTMLImageElement>('.milkdown img').forEach(image => {
    const src = image.src
    image.removeAttribute('src')
    image.src = src
  })
  showToast('已刷新图片', 'info')
}

async function relocateImages(move: boolean): Promise<void> {
  if (!requireTauri(move ? '移动图片' : '复制图片')) return
  const store = useEditorStore()
  const session = store.loadSignal
  const doc = store.doc
  if (!doc.path) { showToast('请先保存文档', 'info'); return }
  // During a document switch the editor view can still be catching up with
  // `loadSignal`. The store is the authoritative snapshot for file actions,
  // so do not mistake a transiently empty Milkdown result for an image-free
  // document.
  // `doc.content` is kept in sync by both Milkdown and source mode and avoids
  // accidentally reading a stale hidden editor when the user switches modes.
  const markdown = store.doc.content
  if (session !== store.loadSignal) return
  const revisionContent = store.doc.content
  const images = localImageFiles(markdown, doc.path)
  if (!images.length) { showToast('文档中没有本地图片', 'info'); return }
  const directory = await useTauri().pickDir()
  if (!directory || session !== store.loadSignal || store.doc.content !== revisionContent) return
  const paths = [...new Set(images.map(image => image.path))]
  const { invoke } = await import('@tauri-apps/api/core')
  const destinations = await invoke<string[]>('copy_image_files', { paths, directory })
  if (session !== store.loadSignal || store.doc.content !== revisionContent) return
  let changed = 0
  withEditor(editor => {
    for (const image of images) {
      if (prose.replaceImageSrc(editor, image.src, convertFileSrc(destinations[paths.indexOf(image.path)])) > 0) changed++
    }
  })
  if (changed !== images.length) throw new Error('部分图片引用未能更新，原文件已保留')
  if (move) {
    // Save the rewritten references before deleting any original image.
    await saveFile()
    if (session !== store.loadSignal || store.doc.dirty || store.doc.path !== doc.path) {
      showToast('文档发生变化，已保留原图片', 'info')
      return
    }
    for (const path of paths) await useTauri().deleteFile(path)
  }
  showToast(`已${move ? '移动' : '复制'} ${paths.length} 张图片`, 'info')
}

export async function copyAllImages(): Promise<void> { await relocateImages(false) }
export async function moveAllImages(): Promise<void> { await relocateImages(true) }

/** Open the global image / appearance settings dialog. */
export function globalImageSettings(): void {
  useUI().openSettings()
}

/** Set the image root directory — opens the settings dialog (v1 keeps it simple). */
export async function setImageRoot(): Promise<void> {
  if (!requireTauri('设置图片根目录')) return
  const unchanged = unchangedDocument()
  const directory = await useTauri().pickDir()
  if (directory && unchanged()) withEditor(editor => prose.setImageRoot(editor, directory))
}

/** Set the local-image insertion behaviour (no special op / copy / assets). */
export function setImageInsertMode(mode: 'none' | 'current' | 'assets'): void {
  try {
    localStorage.setItem('typo-image-insert-mode', mode)
  } catch {
    /* ignore */
  }
  const label =
    mode === 'current' ? '复制到当前文件夹' : mode === 'assets' ? '复制到同名 _imgs 目录' : '无特殊操作'
  showToast(`图片插入方式：${label}`, 'info')
}

/* ---------------------------- view ---------------------------- */

export function toggleSourceMode(): void {
  const ui = useUI()
  ui.sourceMode.value = !ui.sourceMode.value
}

export function setMode(mode: 'normal' | 'focus' | 'typewriter'): void {
  const settings = useSettingsStore()
  settings.update({ mode })
  void settings.persist()
}

export function toggleFocusMode(): void {
  const settings = useSettingsStore()
  setMode(settings.settings.mode === 'focus' ? 'normal' : 'focus')
}

export function toggleTypewriterMode(): void {
  const settings = useSettingsStore()
  setMode(settings.settings.mode === 'typewriter' ? 'normal' : 'typewriter')
}

export function toggleSidebar(): void {
  useUI().toggleSidebar()
}

export function showOutlinePanel(): void {
  useUI().setSidebarView('outline')
}

export function showFileTreePanel(): void {
  useUI().setSidebarView('files')
}

export function openSearchPanel(): void {
  useUI().openFind()
}

export function toggleStatusBar(): void {
  useUI().toggleStatusBar()
}

export function toggleFullscreen(): void {
  if (isTauri()) {
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const window = getCurrentWindow()
      await window.setFullscreen(!await window.isFullscreen())
    })
    return
  }
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    void document.documentElement.requestFullscreen()
  }
}

export function alwaysOnTop(): void {
  showToast('窗口置顶需要桌面运行时支持，v1 暂未开放', 'info')
}

export function zoomActualSize(): void {
  const settings = useSettingsStore()
  settings.update({ fontSize: 16 })
  settings.applyTypography()
  void settings.persist()
}

export function zoomIn(): void {
  const settings = useSettingsStore()
  const next = Math.min(32, settings.settings.fontSize + 1)
  settings.update({ fontSize: next })
  settings.applyTypography()
  void settings.persist()
}

export function zoomOut(): void {
  const settings = useSettingsStore()
  const next = Math.max(12, settings.settings.fontSize - 1)
  settings.update({ fontSize: next })
  settings.applyTypography()
  void settings.persist()
}

export function switchInAppWindow(): void {
  showToast('应用内窗口切换需要多标签支持，v1 暂未开放', 'info')
}

export function devTools(): void {
  showToast('开发者工具需要在 Tauri 桌面端使用', 'info')
}

/* ---------------------------- theme / lang ---------------------------- */

export function applyTheme(id: string): void {
  const settings = useSettingsStore()
  settings.applyTheme(id)
  void settings.persist()
}

export function setLanguage(lang: Lang): void {
  const settings = useSettingsStore()
  settings.setLanguage(lang)
  void settings.persist()
}

export function openPreferences(): void {
  useUI().openSettings()
}

export function openCommandPalette(): void {
  useUI().openCommandPalette()
}

/* ---------------------------- introspection for menus ---------------------------- */

export function currentBlockType(): string {
  return prose.getBlockInfo(useMilkdown().getEditor())?.type ?? 'paragraph'
}

export function currentHeadingLevel(): number | null {
  const info = prose.getBlockInfo(useMilkdown().getEditor())
  return info?.type === 'heading' ? (info.level ?? 1) : null
}

export function markActive(...names: string[]): boolean {
  return prose.isMarkActive(useMilkdown().getEditor(), ...names)
}

export function nodeActive(name: string, attrs?: Record<string, unknown>): boolean {
  return prose.isNodeActive(useMilkdown().getEditor(), name, attrs)
}

export function taskListActive(): boolean {
  return prose.isTaskList(useMilkdown().getEditor())
}
