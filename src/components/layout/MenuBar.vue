<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUI } from '@/composables/useUI'
import * as A from '@/commands/actions'
import { exportDocument } from '@/utils/exporter'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useMilkdown } from '@/composables/useMilkdown'
import type { ExportFormat, Lang } from '@/types'

const { t } = useI18n()
const ui = useUI()
const editor = useEditorStore()
const settings = useSettingsStore()
const milkdown = useMilkdown()

const openMenu = ref<string | null>(null)

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
      { id: 'newWindow', titleKey: 'menu.newWindow' },
      { id: 'open', titleKey: 'menu.open' },
      { id: 'openFolder', titleKey: 'menu.openFolder' },
      { id: 'quickOpen', titleKey: 'menu.quickOpen', shortcut: 'Ctrl/⌘+P' },
      { id: 'save', titleKey: 'menu.save', shortcut: 'Ctrl/⌘+S' },
      { id: 'saveAs', titleKey: 'menu.saveAs', shortcut: 'Ctrl/⌘+⇧+S' },
      { id: 'close', titleKey: 'menu.close' },
      { id: 'recent', titleKey: 'menu.recent' },
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
      { id: 'preferences', titleKey: 'menu.preferences', shortcut: 'Ctrl/⌘+,' },
    ],
  },
  {
    id: 'edit',
    titleKey: 'menu.edit',
    items: [
      { id: 'undo', titleKey: 'menu.undo', shortcut: 'Ctrl/⌘+Z' },
      { id: 'redo', titleKey: 'menu.redo', shortcut: 'Ctrl/⌘+Y' },
      { id: 'cut', titleKey: 'menu.cut', shortcut: 'Ctrl/⌘+X' },
      { id: 'copy', titleKey: 'menu.copy', shortcut: 'Ctrl/⌘+C' },
      { id: 'paste', titleKey: 'menu.paste', shortcut: 'Ctrl/⌘+V' },
      { id: 'copyAsMarkdown', titleKey: 'menu.copyAsMarkdown', shortcut: 'Ctrl/⌘+⇧+C' },
      { id: 'pastePlain', titleKey: 'menu.pastePlain', shortcut: 'Ctrl/⌘+⇧+V' },
      { id: 'selectAll', titleKey: 'menu.selectAll', shortcut: 'Ctrl/⌘+A' },
      { id: 'find', titleKey: 'menu.find', shortcut: 'Ctrl/⌘+F' },
      { id: 'replace', titleKey: 'menu.replace', shortcut: 'Ctrl/⌘+H' },
    ],
  },
  {
    id: 'paragraph',
    titleKey: 'menu.paragraph',
    items: [
      { id: 'h1', titleKey: 'menu.h1', shortcut: 'Ctrl/⌘+1' },
      { id: 'h2', titleKey: 'menu.h2', shortcut: 'Ctrl/⌘+2' },
      { id: 'h3', titleKey: 'menu.h3', shortcut: 'Ctrl/⌘+3' },
      { id: 'h4', titleKey: 'menu.h4', shortcut: 'Ctrl/⌘+4' },
      { id: 'h5', titleKey: 'menu.h5', shortcut: 'Ctrl/⌘+5' },
      { id: 'h6', titleKey: 'menu.h6', shortcut: 'Ctrl/⌘+6' },
      { id: 'paragraph', titleKey: 'menu.paragraph', shortcut: 'Ctrl/⌘+0' },
      { id: 'incHeading', titleKey: 'menu.incHeading', shortcut: 'Ctrl/⌘+=' },
      { id: 'decHeading', titleKey: 'menu.decHeading', shortcut: 'Ctrl/⌘+-' },
      { id: 'table', titleKey: 'menu.insertTable', shortcut: 'Ctrl/⌘+T' },
      { id: 'codeBlock', titleKey: 'menu.codeBlock', shortcut: 'Ctrl/⌘+⇧+K' },
      { id: 'mathBlock', titleKey: 'menu.insertMath', shortcut: 'Ctrl/⌘+⇧+M' },
      { id: 'quote', titleKey: 'menu.quote', shortcut: 'Ctrl/⌘+⇧+Q' },
      { id: 'orderedList', titleKey: 'menu.orderedList', shortcut: 'Ctrl/⌘+⇧+[' },
      { id: 'unorderedList', titleKey: 'menu.unorderedList', shortcut: 'Ctrl/⌘+⇧+]' },
      { id: 'taskList', titleKey: 'menu.taskList' },
      { id: 'indent', titleKey: 'menu.indent' },
      { id: 'outdent', titleKey: 'menu.outdent' },
    ],
  },
  {
    id: 'format',
    titleKey: 'menu.format',
    items: [
      { id: 'bold', titleKey: 'menu.bold', shortcut: 'Ctrl/⌘+B' },
      { id: 'italic', titleKey: 'menu.italic', shortcut: 'Ctrl/⌘+I' },
      { id: 'underline', titleKey: 'menu.underline', shortcut: 'Ctrl/⌘+U' },
      { id: 'strike', titleKey: 'menu.strike', shortcut: 'Alt+⇧+5' },
      { id: 'inlineCode', titleKey: 'menu.code', shortcut: 'Ctrl/⌘+⇧+`' },
      { id: 'link', titleKey: 'menu.link', shortcut: 'Ctrl/⌘+K' },
      { id: 'image', titleKey: 'menu.insertImage', shortcut: 'Ctrl/⌘+⇧+I' },
      { id: 'clearFormat', titleKey: 'menu.clearFormat', shortcut: 'Ctrl/⌘+\\' },
    ],
  },
  {
    id: 'view',
    titleKey: 'menu.view',
    items: [
      { id: 'sourceMode', titleKey: 'menu.sourceMode', shortcut: 'Ctrl/⌘+/' },
      { id: 'toggleSidebar', titleKey: 'menu.toggleSidebar', shortcut: 'Ctrl/⌘+⇧+L' },
      { id: 'outline', titleKey: 'menu.toggleOutline', shortcut: 'Ctrl/⌘+⇧+1' },
      { id: 'fileTree', titleKey: 'menu.fileTree', shortcut: 'Ctrl/⌘+⇧+3' },
      { id: 'focusMode', titleKey: 'menu.focusMode', shortcut: 'F8' },
      { id: 'typewriterMode', titleKey: 'menu.typewriterMode', shortcut: 'F9' },
      { id: 'fullscreen', titleKey: 'menu.fullscreen', shortcut: 'F11' },
      { id: 'zoomActual', titleKey: 'menu.zoomActual', shortcut: 'Ctrl/⌘+⇧+0' },
      { id: 'zoomIn', titleKey: 'menu.zoomIn', shortcut: 'Ctrl/⌘+⇧+=' },
      { id: 'zoomOut', titleKey: 'menu.zoomOut', shortcut: 'Ctrl/⌘+⇧+-' },
    ],
  },
  {
    id: 'theme',
    titleKey: 'menu.theme',
    items: [
      { id: 'theme-github-light', titleKey: 'theme.github-light' },
      { id: 'theme-nord-dark', titleKey: 'theme.nord-dark' },
    ],
  },
  {
    id: 'help',
    titleKey: 'menu.help',
    items: [
      { id: 'commandPalette', titleKey: 'menu.commandPalette', shortcut: 'Ctrl/⌘+⇧+P' },
      { id: 'about', titleKey: 'menu.about' },
    ],
  },
]

function toggleMenu(id: string): void {
  openMenu.value = openMenu.value === id ? null : id
}
function closeMenu(): void {
  openMenu.value = null
}

async function doExport(format: ExportFormat): Promise<void> {
  const md = await milkdown.getMarkdown()
  const base = (editor.doc.name || 'untitled').replace(/\.md$/i, '')
  await exportDocument(md, format, base || 'untitled')
}

function applyTheme(id: string): void {
  settings.applyTheme(id)
  void settings.persist()
}

function setLanguage(lang: Lang): void {
  settings.setLanguage(lang)
  void settings.persist()
}

function about(): void {
  window.alert(`${t('app.name')} v0.1.0\nA Typora-style WYSIWYG Markdown editor.`)
}

function runCommand(id: string): void {
  switch (id) {
    // File
    case 'new': void A.newFile(); break
    case 'newWindow': A.newWindow(); break
    case 'open': void A.openFileDialog(); break
    case 'openFolder': void A.openFolderDialog(); break
    case 'quickOpen': A.quickOpen(); break
    case 'save': void A.saveFile(); break
    case 'saveAs': void A.saveFileAs(); break
    case 'close': A.closeWindow(); break
    case 'recent': ui.toggleSidebar(); break
    case 'export-md': void doExport('markdown'); break
    case 'export-html': void doExport('html'); break
    case 'export-docx': void doExport('docx'); break
    case 'export-pdf': void doExport('pdf'); break
    case 'preferences': ui.openSettings(); break
    // Edit
    case 'undo': A.undo(); break
    case 'redo': A.redo(); break
    case 'cut': A.cut(); break
    case 'copy': A.copySelection(); break
    case 'paste': A.paste(); break
    case 'copyAsMarkdown': void A.copyAsMarkdown(); break
    case 'pastePlain': void A.pasteAsPlainText(); break
    case 'selectAll': A.selectAll(); break
    case 'find': ui.openFind(); break
    case 'replace': ui.openFind(); break
    // Paragraph
    case 'h1': A.setHeading(1); break
    case 'h2': A.setHeading(2); break
    case 'h3': A.setHeading(3); break
    case 'h4': A.setHeading(4); break
    case 'h5': A.setHeading(5); break
    case 'h6': A.setHeading(6); break
    case 'paragraph': A.setParagraph(); break
    case 'incHeading': A.increaseHeadingLevel(); break
    case 'decHeading': A.decreaseHeadingLevel(); break
    case 'table': A.insertTable(); break
    case 'codeBlock': A.insertCodeBlock(); break
    case 'mathBlock': A.insertMathBlock(); break
    case 'quote': A.insertBlockquote(); break
    case 'orderedList': A.insertOrderedList(); break
    case 'unorderedList': A.insertUnorderedList(); break
    case 'taskList': A.insertTaskList(); break
    case 'indent': A.indentList(); break
    case 'outdent': A.outdentList(); break
    // Format
    case 'bold': A.toggleBold(); break
    case 'italic': A.toggleItalic(); break
    case 'underline': A.toggleUnderline(); break
    case 'strike': A.toggleStrike(); break
    case 'inlineCode': A.toggleInlineCode(); break
    case 'link': A.insertHyperlink(); break
    case 'image': A.insertLocalImage(); break
    case 'clearFormat': A.clearStyle(); break
    // View
    case 'sourceMode': A.toggleSourceMode(); break
    case 'toggleSidebar': A.toggleSidebar(); break
    case 'outline': A.showOutlinePanel(); break
    case 'fileTree': A.showFileTreePanel(); break
    case 'focusMode': A.toggleFocusMode(); break
    case 'typewriterMode': A.toggleTypewriterMode(); break
    case 'fullscreen': A.toggleFullscreen(); break
    case 'zoomActual': A.zoomActualSize(); break
    case 'zoomIn': A.zoomIn(); break
    case 'zoomOut': A.zoomOut(); break
    // Theme
    case 'theme-github-light': applyTheme('github-light'); break
    case 'theme-nord-dark': applyTheme('nord-dark'); break
    // Help
    case 'commandPalette': ui.openCommandPalette(); break
    case 'about': about(); break
  }
  closeMenu()
}
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
  min-width: 200px;
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
.icon-btn {
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.icon-btn:hover {
  background: var(--accent-soft);
}
</style>
