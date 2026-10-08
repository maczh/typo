<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMilkdown } from '@/composables/useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useFilesStore } from '@/stores/files'
import { useSettingsStore } from '@/stores/settings'
import { useTauri } from '@/composables/useTauri'
import { useUI } from '@/composables/useUI'
import { exportDocument } from '@/utils/exporter'
import { insertMath } from '@/milkdown/plugins/latex'
import { insertDiagram } from '@/milkdown/plugins/mermaid'
import { insertImage } from '@/milkdown/plugins/image'
import { insertTable } from '@/milkdown/plugins/table'
import { undo, redo } from '@milkdown/prose/history'
import { editorViewCtx } from '@milkdown/core'
import { dirname } from '@/utils/file'
import type { ExportFormat } from '@/types'

const { t } = useI18n()
const milkdown = useMilkdown()
const editor = useEditorStore()
const files = useFilesStore()
const settings = useSettingsStore()
const tauri = useTauri()
const ui = useUI()

const openMenu = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

interface MenuItem {
  id: string
  titleKey: string
  shortcut?: string
  sub?: MenuItem[]
}
const menus: { id: string; titleKey: string; items: MenuItem[] }[] = [
  {
    id: 'file',
    titleKey: 'menu.file',
    items: [
      { id: 'new', titleKey: 'menu.new' },
      { id: 'open', titleKey: 'menu.open' },
      { id: 'save', titleKey: 'menu.save', shortcut: 'Ctrl/⌘+S' },
      { id: 'saveAs', titleKey: 'menu.saveAs' },
      {
        id: 'export',
        titleKey: 'menu.export',
        sub: [
          { id: 'export-md', titleKey: 'export.markdown' },
          { id: 'export-html', titleKey: 'export.html' },
          { id: 'export-docx', titleKey: 'export.word' },
          { id: 'export-pdf', titleKey: 'export.pdf' },
        ],
      },
      { id: 'recent', titleKey: 'menu.recent' },
      { id: 'preferences', titleKey: 'menu.preferences' },
    ],
  },
  { id: 'edit', titleKey: 'menu.edit', items: [
    { id: 'undo', titleKey: 'menu.undo' },
    { id: 'redo', titleKey: 'menu.redo' },
  ] },
  { id: 'view', titleKey: 'menu.view', items: [
    { id: 'toggleSidebar', titleKey: 'menu.toggleSidebar' },
    { id: 'toggleOutline', titleKey: 'menu.toggleOutline' },
    { id: 'focusMode', titleKey: 'menu.focusMode' },
    { id: 'typewriterMode', titleKey: 'menu.typewriterMode' },
    { id: 'normalMode', titleKey: 'menu.normalMode' },
  ] },
  { id: 'format', titleKey: 'menu.format', items: [
    { id: 'insertTable', titleKey: 'menu.insertTable' },
    { id: 'insertImage', titleKey: 'menu.insertImage' },
    { id: 'insertMath', titleKey: 'menu.insertMath' },
    { id: 'insertDiagram', titleKey: 'menu.insertDiagram' },
  ] },
  { id: 'theme', titleKey: 'menu.theme', items: [
    { id: 'theme-github-light', titleKey: 'theme.github-light' },
    { id: 'theme-nord-dark', titleKey: 'theme.nord-dark' },
  ] },
  { id: 'help', titleKey: 'menu.help', items: [
    { id: 'commandPalette', titleKey: 'menu.commandPalette', shortcut: 'Ctrl/⌘+⇧+P' },
    { id: 'about', titleKey: 'menu.about' },
  ] },
]

function toggleMenu(id: string): void {
  openMenu.value = openMenu.value === id ? null : id
}
function closeMenu(): void {
  openMenu.value = null
}

async function getMarkdownContent(): Promise<string> {
  return await milkdown.getMarkdown()
}

async function newFile(): Promise<void> {
  await files.newFile()
}
async function openFile(): Promise<void> {
  const path = await tauri.pickOpen()
  if (path) await files.openFile(path)
}
async function save(): Promise<void> {
  const content = await getMarkdownContent()
  if (!editor.doc.path) {
    await saveAs()
    return
  }
  await tauri.saveFile(editor.doc.path, content)
  editor.markSaved()
}
async function saveAs(): Promise<void> {
  const content = await getMarkdownContent()
  const name = editor.doc.name || 'untitled.md'
  const path = await tauri.pickSave(name)
  if (path) {
    const res = await tauri.saveFileAs(path, content)
    editor.doc.path = res.path
    editor.doc.name = res.name
    editor.markSaved()
    await files.addRecent(res.path)
  }
}
async function doExport(format: ExportFormat): Promise<void> {
  const md = await getMarkdownContent()
  const base = (editor.doc.name || 'untitled').replace(/\.md$/i, '')
  await exportDocument(md, format, base || 'untitled')
}
async function recent(): Promise<void> {
  await files.loadRecent()
  ui.toggleSidebar()
}
function openSettings(): void {
  ui.openSettings()
}

function history(cmd: (state: unknown, dispatch?: (tr: unknown) => void) => boolean): void {
  const e = milkdown.getEditor()
  if (!e) return
  e.action((ctx) => {
    const v = ctx.get(editorViewCtx) as unknown as { state: unknown; dispatch: (tr: unknown) => void }
    cmd(v.state, v.dispatch)
  })
}
function undoEdit(): void {
  history(undo as never)
}
function redoEdit(): void {
  history(redo as never)
}

function setMode(mode: 'normal' | 'focus' | 'typewriter'): void {
  settings.update({ mode })
  void settings.persist()
}
function applyTheme(id: string): void {
  settings.applyTheme(id)
  void settings.persist()
}
function toggleSidebar(): void {
  ui.toggleSidebar()
}
function toggleOutline(): void {
  ui.toggleOutline()
}

function insertTableCmd(): void {
  const e = milkdown.getEditor()
  if (e) insertTable(e)
}
function insertMathCmd(): void {
  const e = milkdown.getEditor()
  if (e) insertMath(e, 'E = mc^2', true)
}
function insertDiagramCmd(): void {
  const e = milkdown.getEditor()
  if (e) insertDiagram(e, 'graph TD;\n  A-->B;')
}
function insertImageCmd(): void {
  fileInput.value?.click()
}
async function onFilePicked(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const ed = milkdown.getEditor()
  if (!ed) return
  const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
  if (editor.doc.path) {
    const buf = await file.arrayBuffer()
    const rel = await tauri.writeAsset(dirname(editor.doc.path), filename, new Uint8Array(buf))
    insertImage(ed, `./${rel}`, file.name)
  } else {
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result as string)
      r.readAsDataURL(file)
    })
    insertImage(ed, dataUrl, file.name)
  }
}

function about(): void {
  window.alert(`${t('app.name')} v0.1.0\nA Typora-style WYSIWYG Markdown editor.`)
}

function runCommand(id: string): void {
  switch (id) {
    case 'new': void newFile(); break
    case 'open': void openFile(); break
    case 'save': void save(); break
    case 'saveAs': void saveAs(); break
    case 'export-md': void doExport('markdown'); break
    case 'export-html': void doExport('html'); break
    case 'export-docx': void doExport('docx'); break
    case 'export-pdf': void doExport('pdf'); break
    case 'recent': void recent(); break
    case 'preferences': openSettings(); break
    case 'undo': undoEdit(); break
    case 'redo': redoEdit(); break
    case 'toggleSidebar': toggleSidebar(); break
    case 'toggleOutline': toggleOutline(); break
    case 'focusMode': setMode('focus'); break
    case 'typewriterMode': setMode('typewriter'); break
    case 'normalMode': setMode('normal'); break
    case 'insertTable': insertTableCmd(); break
    case 'insertImage': insertImageCmd(); break
    case 'insertMath': insertMathCmd(); break
    case 'insertDiagram': insertDiagramCmd(); break
    case 'theme-github-light': applyTheme('github-light'); break
    case 'theme-nord-dark': applyTheme('nord-dark'); break
    case 'commandPalette': ui.openCommandPalette(); break
    case 'about': about(); break
  }
  closeMenu()
}

function onSaveKey(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    void save()
  }
}

onMounted(() => window.addEventListener('keydown', onSaveKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onSaveKey))
</script>

<template>
  <header class="menu-bar" @click="closeMenu">
    <template v-for="menu in menus" :key="menu.id">
      <div class="menu" @click.stop>
        <button class="menu-title" :class="{ active: openMenu === menu.id }" @click="toggleMenu(menu.id)">
          {{ t(menu.titleKey) }}
        </button>
        <div v-if="openMenu === menu.id" class="menu-dropdown">
          <template v-for="item in menu.items" :key="item.id">
            <div class="menu-item has-sub" @click.stop>
              <button class="menu-item-btn" @click="runCommand(item.id)">
                <span>{{ t(item.titleKey) }}</span>
                <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>
              </button>
              <div v-if="item.sub" class="sub-menu">
                <button
                  v-for="sub in item.sub"
                  :key="sub.id"
                  class="menu-item-btn"
                  @click="runCommand(sub.id)"
                >
                  {{ t(sub.titleKey) }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
    <div class="menu-spacer"></div>
    <button class="icon-btn" :title="t('menu.commandPalette')" @click="ui.openCommandPalette()">
      ⌘P
    </button>
    <input ref="fileInput" type="file" accept="image/*" hidden @change="onFilePicked" />
  </header>
</template>

<style scoped>
.menu-bar {
  display: flex;
  align-items: center;
  height: var(--menubar-height);
  background: var(--sidebar-bg);
  border-bottom: 1px solid var(--border);
  padding: 0 4px;
  user-select: none;
  font-size: 13px;
}
.menu {
  position: relative;
}
.menu-title {
  border: none;
  background: transparent;
  color: var(--fg);
  padding: 4px 10px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
}
.menu-title:hover,
.menu-title.active {
  background: var(--accent-soft);
}
.menu-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 180px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow);
  padding: 4px;
  z-index: 500;
}
.menu-item {
  position: relative;
}
.menu-item-btn {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--fg);
  padding: 6px 10px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  text-align: left;
}
.menu-item-btn:hover {
  background: var(--accent-soft);
}
.shortcut {
  color: var(--fg-muted);
  font-size: 11px;
}
.sub-menu {
  position: absolute;
  left: 100%;
  top: 0;
  min-width: 160px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: var(--shadow);
  padding: 4px;
  display: none;
}
.has-sub:hover .sub-menu {
  display: block;
}
.menu-spacer {
  flex: 1 1 auto;
}
</style>
