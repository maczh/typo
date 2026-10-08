import type { Editor } from '@milkdown/core'
import { useMilkdown } from '@/composables/useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useFilesStore } from '@/stores/files'
import { useSettingsStore } from '@/stores/settings'
import { useTauri, isTauri } from '@/composables/useTauri'
import { useUI } from '@/composables/useUI'
import { showToast } from '@/utils/toast'
import { exportDocument } from '@/utils/exporter'
import { insertTable as insertTablePlugin } from '@/milkdown/plugins/table'
import { insertMath } from '@/milkdown/plugins/latex'
import { insertDiagram } from '@/milkdown/plugins/mermaid'
import { insertImage } from '@/milkdown/plugins/image'
import { insert } from '@milkdown/utils'
import { dirname } from '@/utils/file'
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
  try {
    const md = await milkdown.getMarkdown()
    return md || editor.doc.content
  } catch {
    return editor.doc.content
  }
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

export function newWindow(): void {
  showToast('多窗口功能需要桌面运行时支持，v1 暂未开放', 'info')
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

export async function saveFile(): Promise<void> {
  if (!requireTauri('保存')) return
  const content = await getMarkdown()
  const editor = useEditorStore()
  if (!editor.doc.path) {
    await saveFileAs()
    return
  }
  await useTauri().saveFile(editor.doc.path, content)
  editor.markSaved()
}

export async function saveFileAs(): Promise<void> {
  if (!requireTauri('另存为')) return
  const content = await getMarkdown()
  const editor = useEditorStore()
  const path = await useTauri().pickSave(editor.doc.name || 'untitled.md')
  if (!path) return
  const res = await useTauri().saveFileAs(path, content)
  editor.doc.path = res.path
  editor.doc.name = res.name
  editor.markSaved()
  await useFilesStore().addRecent(res.path)
}

export async function deleteCurrentFile(): Promise<void> {
  const editor = useEditorStore()
  if (!editor.doc.path) {
    await newFile()
    return
  }
  if (!requireTauri('删除')) return
  if (!window.confirm(`确定删除文件「${editor.doc.name}」？此操作不可恢复。`)) return
  try {
    await useTauri().deleteFile(editor.doc.path)
    showToast('已删除', 'info')
  } catch {
    /* toast already shown by bridge */
  }
  await newFile()
}

export function saveAll(): void {
  showToast('当前版本仅维护单个打开的文档', 'info')
}

export function revealFileInFolder(): void {
  showToast('打开文件位置需要桌面运行时支持，v1 暂未开放', 'info')
}

export async function exportAs(format: 'markdown' | 'html' | 'docx' | 'pdf'): Promise<void> {
  const md = await getMarkdown()
  const base = (useEditorStore().doc.name || 'untitled').replace(/\.md$/i, '')
  await exportDocument(md, format, base || 'untitled')
}

export function printDocument(): void {
  void exportAs('pdf')
}

export function closeWindow(): void {
  window.close()
}

/* ---------------------------- edit ---------------------------- */

export function undo(): void {
  withEditor((e) => prose.undo(e))
}

export function redo(): void {
  withEditor((e) => prose.redo(e))
}

export function cut(): void {
  try {
    document.execCommand('cut')
  } catch {
    /* ignore */
  }
}

export function copySelection(): void {
  try {
    document.execCommand('copy')
  } catch {
    /* ignore */
  }
}

export function paste(): void {
  try {
    document.execCommand('paste')
  } catch {
    showToast('请使用 Ctrl+V 粘贴（WebView 限制）', 'info')
  }
}

export async function copyAsMarkdown(): Promise<void> {
  await copyText(await getMarkdown())
}

export async function pasteAsPlainText(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText()
    withEditor((e) => e.action(insert(text)))
  } catch {
    showToast('无法读取剪贴板（权限受限），请使用 Ctrl+Shift+V', 'error')
  }
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    showToast('已复制', 'info')
  } catch {
    showToast('复制失败：剪贴板权限受限', 'error')
  }
}

export function selectAll(): void {
  withEditor((e) => prose.selectAll(e))
}

export function deleteSelection(): void {
  withEditor((e) => prose.deleteSelection(e))
}

export function openFind(find = true): void {
  useUI().openFind()
  void find
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

export function insertCodeBlock(): void {
  withEditor((e) => prose.setCodeBlock(e))
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
  withEditor((e) => insertDiagram(e, 'graph TD;\n  A-->B;'))
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
  showToast('v1 暂不支持下划线（Markdown 标准外语法）', 'info')
}

export function toggleInlineCode(): void {
  withEditor((e) => prose.toggleInlineCode(e))
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
  withEditor((e) => prose.insertLink(e))
}

export function insertLocalImage(): void {
  pickAndInsertImage()
}

/** Open a file picker and insert the chosen image (relative asset when possible). */
export function pickAndInsertImage(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    const editor = useEditorStore()
    const e = useMilkdown().getEditor()
    if (!e) return
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    if (editor.doc.path && isTauri()) {
      try {
        const buf = await file.arrayBuffer()
        const rel = await useTauri().writeAsset(dirname(editor.doc.path), filename, new Uint8Array(buf))
        insertImage(e, `./${rel}`, file.name)
        return
      } catch {
        /* fall through to data-url */
      }
    }
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.readAsDataURL(file)
    })
    insertImage(e, dataUrl, file.name)
  }
  input.click()
}

export function clearStyle(): void {
  withEditor((e) => prose.clearFormatting(e))
}

/* ---------------------------- view ---------------------------- */

export function toggleSourceMode(): void {
  const ui = useUI()
  const milkdown = useMilkdown()
  const editor = useEditorStore()
  if (!ui.sourceMode.value) {
    void (async () => {
      try {
        const md = await milkdown.getMarkdown()
        if (md) editor.doc.content = md
      } catch {
        /* keep store content */
      }
      ui.sourceMode.value = true
    })()
  } else {
    ui.sourceMode.value = false
  }
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

export function showArticlesPanel(): void {
  useUI().setSidebarView('articles')
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
