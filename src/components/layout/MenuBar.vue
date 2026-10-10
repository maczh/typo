<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MenuItem } from './menuTypes'
import MenuNode from './MenuNode.vue'
import { useUI } from '@/composables/useUI'
import * as A from '@/commands/actions'
import { exportDocument } from '@/utils/exporter'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useMilkdown } from '@/composables/useMilkdown'
import type { ExportFormat } from '@/types'

const { t } = useI18n()
const ui = useUI()
const editor = useEditorStore()
const settings = useSettingsStore()
const milkdown = useMilkdown()

const openMenu = ref<string | null>(null)
const aboutOpen = ref(false)

const inCode = (): boolean => A.nodeActive('code_block') || A.nodeActive('fence')
const inTable = (): boolean => A.nodeActive('table')
const inLink = (): boolean => A.markActive('link')
const inTask = (): boolean => A.nodeActive('list_item')

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
      { id: 'copyAsMarkdown', titleKey: 'menu.copyAsMarkdown', shortcut: 'Ctrl/⌘+⇧+D' },
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
      { sep: true },
      { id: 'paragraph', titleKey: 'menu.paragraph', shortcut: 'Ctrl/⌘+0' },
      { sep: true },
      { id: 'incHeading', titleKey: 'menu.incHeading', shortcut: 'Ctrl/⌘+=' },
      { id: 'decHeading', titleKey: 'menu.decHeading', shortcut: 'Ctrl/⌘+-' },
      { sep: true },
      {
        titleKey: 'menu.table',
        shortcut: 'Ctrl/⌘+T',
        sub: [
          { id: 'table-insert', titleKey: 'menu.insertTable', shortcut: 'Alt/⌥+⌘+T' },
          { sep: true },
          { id: 'table-row-above', titleKey: 'ctx.rowAbove', disabled: () => !inTable() },
          { id: 'table-row-below', titleKey: 'ctx.rowBelow', shortcut: 'Ctrl/⌘+⇧+⏎', disabled: () => !inTable() },
          { sep: true },
          { id: 'table-col-left', titleKey: 'ctx.colLeft', disabled: () => !inTable() },
          { id: 'table-col-right', titleKey: 'ctx.colRight', disabled: () => !inTable() },
          { sep: true },
          { id: 'table-move-row-up', titleKey: 'ctx.moveRowUp', shortcut: 'Alt/⌥+⌘+↑', disabled: () => !inTable() },
          { id: 'table-move-row-down', titleKey: 'ctx.moveRowDown', shortcut: 'Alt/⌥+⌘+↓', disabled: () => !inTable() },
          { id: 'table-move-col-left', titleKey: 'ctx.moveColLeft', shortcut: 'Alt/⌥+⌘+←', disabled: () => !inTable() },
          { id: 'table-move-col-right', titleKey: 'ctx.moveColRight', shortcut: 'Alt/⌥+⌘+→', disabled: () => !inTable() },
          { sep: true },
          { id: 'table-del-row', titleKey: 'ctx.deleteRow', shortcut: 'Ctrl/⌘+⇧+⌫', disabled: () => !inTable() },
          { id: 'table-del-col', titleKey: 'ctx.deleteCol', disabled: () => !inTable() },
          { sep: true },
          { id: 'table-copy', titleKey: 'ctx.copyTable', disabled: () => !inTable() },
          { id: 'table-format', titleKey: 'ctx.formatTable', disabled: () => !inTable() },
          { sep: true },
          { id: 'table-del', titleKey: 'ctx.deleteTable', disabled: () => !inTable() },
        ],
      },
      { id: 'mathBlock', titleKey: 'menu.insertMath', shortcut: 'Alt/⌥+⌘+B' },
      { id: 'codeBlock', titleKey: 'menu.codeBlock', shortcut: 'Alt/⌥+⌘+C' },
      {
        titleKey: 'menu.codeTools',
        sub: [
          { id: 'copy-code', titleKey: 'menu.copyCodeBlock', disabled: () => !inCode() },
          { id: 'indent-selection', titleKey: 'menu.indentSelection' },
          { id: 'indent-block', titleKey: 'menu.indentCodeBlock', disabled: () => !inCode() },
        ],
      },
      {
        titleKey: 'menu.alert',
        sub: [
          { id: 'alert-note', titleKey: 'menu.alertNote' },
          { id: 'alert-tip', titleKey: 'menu.alertTip' },
          { id: 'alert-important', titleKey: 'menu.alertImportant' },
          { id: 'alert-warning', titleKey: 'menu.alertWarning' },
          { id: 'alert-caution', titleKey: 'menu.alertCaution' },
        ],
      },
      { sep: true },
      { id: 'quote', titleKey: 'menu.quote', shortcut: 'Ctrl/⌘+⇧+Q' },
      { sep: true },
      { id: 'orderedList', titleKey: 'menu.orderedList', shortcut: 'Alt/⌥+⌘+O' },
      { id: 'unorderedList', titleKey: 'menu.unorderedList', shortcut: 'Alt/⌥+⌘+U' },
      { id: 'taskList', titleKey: 'menu.taskList', shortcut: 'Ctrl/⌘+⇧+X' },
      {
        titleKey: 'menu.taskStatus',
        disabled: () => !inTask(),
        sub: [
          { id: 'task-selected', titleKey: 'menu.taskSelected' },
          { id: 'task-unselected', titleKey: 'menu.taskUnselected' },
          { id: 'task-ignored', titleKey: 'menu.taskIgnored' },
        ],
      },
      {
        titleKey: 'menu.indent',
        sub: [
          { id: 'indent-list', titleKey: 'menu.indent', shortcut: 'Ctrl/⌘+]' },
          { id: 'outdent-list', titleKey: 'menu.outdent', shortcut: 'Ctrl/⌘+[' },
        ],
      },
      { sep: true },
      { id: 'insertParaAbove', titleKey: 'menu.insertParaAbove' },
      { id: 'insertParaBelow', titleKey: 'menu.insertParaBelow' },
      { sep: true },
      { id: 'linkReference', titleKey: 'menu.linkReference', shortcut: 'Alt/⌥+⌘+L' },
      { id: 'footnote', titleKey: 'menu.footnote', shortcut: 'Alt/⌥+⌘+R' },
      { sep: true },
      { id: 'horizontalRule', titleKey: 'menu.horizontalRule' },
      { id: 'toc', titleKey: 'menu.toc' },
    ],
  },
  {
    id: 'format',
    titleKey: 'menu.format',
    items: [
      { id: 'bold', titleKey: 'menu.bold', shortcut: 'Ctrl/⌘+B' },
      { id: 'italic', titleKey: 'menu.italic', shortcut: 'Ctrl/⌘+I' },
      { id: 'underline', titleKey: 'menu.underline', shortcut: 'Ctrl/⌘+U' },
      { id: 'inlineCode', titleKey: 'menu.code', shortcut: 'Ctrl/⌘+⇧+`' },
      { sep: true },
      { id: 'inlineMath', titleKey: 'menu.inlineMath', shortcut: 'Ctrl/⌘+M' },
      { id: 'strike', titleKey: 'menu.strike', shortcut: 'Alt/⌥+⌘+5' },
      { id: 'comment', titleKey: 'menu.comment' },
      { sep: true },
      { id: 'link', titleKey: 'menu.link', shortcut: 'Ctrl/⌘+K' },
      {
        titleKey: 'menu.link',
        disabled: () => !inLink(),
        sub: [
          { id: 'link-open', titleKey: 'menu.openLink', disabled: () => !inLink() },
          { id: 'link-copy', titleKey: 'menu.copyLinkAddress', disabled: () => !inLink() },
          { id: 'link-edit', titleKey: 'menu.editLink', disabled: () => !inLink() },
          { id: 'link-remove', titleKey: 'menu.removeLink', disabled: () => !inLink() },
        ],
      },
      {
        titleKey: 'menu.insertImage',
        sub: [
          { id: 'image-remote', titleKey: 'menu.insertRemoteImage', shortcut: 'Alt/⌥+⌘+I' },
          { id: 'image-local', titleKey: 'menu.insertLocalImage' },
          { sep: true },
          { id: 'image-location', titleKey: 'menu.openImageLocation', disabled: () => true },
          {
            titleKey: 'menu.scaleImage',
            disabled: () => true,
            sub: [{ titleKey: 'menu.noSpecialOp', disabled: () => true }],
          },
          {
            titleKey: 'menu.convertImageSyntax',
            disabled: () => true,
            sub: [{ titleKey: 'menu.noSpecialOp', disabled: () => true }],
          },
          { sep: true },
          { id: 'image-delete-file', titleKey: 'menu.deleteImageFile', disabled: () => true },
          { sep: true },
          { id: 'image-copy-to', titleKey: 'menu.copyImageTo', disabled: () => true },
          { id: 'image-rename-move', titleKey: 'menu.renameMoveImage', disabled: () => true },
          { id: 'image-upload', titleKey: 'menu.uploadImage', disabled: () => true },
          { sep: true },
          { id: 'image-copy-all', titleKey: 'menu.copyAllImagesTo' },
          { id: 'image-move-all', titleKey: 'menu.moveAllImagesTo' },
          { id: 'image-upload-all', titleKey: 'menu.uploadAllLocalImages' },
          { sep: true },
          { id: 'image-reload-all', titleKey: 'menu.reloadAllImages' },
          { sep: true },
          {
            titleKey: 'menu.whenInsertLocalImage',
            sub: [
              { id: 'image-mode-none', titleKey: 'menu.noSpecialOp' },
              { id: 'image-mode-current', titleKey: 'menu.copyToCurrentFolder' },
              { id: 'image-mode-assets', titleKey: 'menu.copyToAssetsRelative' },
            ],
          },
          { id: 'image-root', titleKey: 'menu.setImageRoot' },
          { sep: true },
          { id: 'image-global', titleKey: 'menu.globalImageSettings' },
        ],
      },
      {
        titleKey: 'menu.insertFromIPhone',
        disabled: () => true,
        sub: [{ titleKey: 'menu.noSpecialOp', disabled: () => true }],
      },
      { sep: true },
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
      { id: 'theme-github', titleKey: 'theme.github', checked: () => settings.settings.theme === 'github' },
      { id: 'theme-gothic', titleKey: 'theme.gothic', checked: () => settings.settings.theme === 'gothic' },
      { id: 'theme-newsprint', titleKey: 'theme.newsprint', checked: () => settings.settings.theme === 'newsprint' },
      { id: 'theme-night', titleKey: 'theme.night', checked: () => settings.settings.theme === 'night' },
      { id: 'theme-pixyll', titleKey: 'theme.pixyll', checked: () => settings.settings.theme === 'pixyll' },
      { id: 'theme-whitey', titleKey: 'theme.whitey', checked: () => settings.settings.theme === 'whitey' },
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

function about(): void {
  aboutOpen.value = true
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
    case 'table-insert': A.insertTable(); break
    case 'table-row-above': A.tableRowAbove(); break
    case 'table-row-below': A.tableRowBelow(); break
    case 'table-col-left': A.tableColLeft(); break
    case 'table-col-right': A.tableColRight(); break
    case 'table-move-row-up': A.tableMoveRowUp(); break
    case 'table-move-row-down': A.tableMoveRowDown(); break
    case 'table-move-col-left': A.tableMoveColLeft(); break
    case 'table-move-col-right': A.tableMoveColRight(); break
    case 'table-del-row': A.tableDeleteRow(); break
    case 'table-del-col': A.tableDeleteCol(); break
    case 'table-copy': void A.tableCopy(); break
    case 'table-format': A.tableFormat(); break
    case 'table-del': A.tableDelete(); break
    case 'mathBlock': A.insertMathBlock(); break
    case 'codeBlock': A.insertCodeBlock(); break
    case 'copy-code': void A.copyCodeBlockContent(); break
    case 'indent-selection': A.indentSelectedLines(); break
    case 'indent-block': A.indentCodeBlock(); break
    case 'alert-note': A.insertAlert('NOTE'); break
    case 'alert-tip': A.insertAlert('TIP'); break
    case 'alert-important': A.insertAlert('IMPORTANT'); break
    case 'alert-warning': A.insertAlert('WARNING'); break
    case 'alert-caution': A.insertAlert('CAUTION'); break
    case 'quote': A.insertBlockquote(); break
    case 'orderedList': A.insertOrderedList(); break
    case 'unorderedList': A.insertUnorderedList(); break
    case 'taskList': A.insertTaskList(); break
    case 'task-selected': A.setTaskStatus('selected'); break
    case 'task-unselected': A.setTaskStatus('unselected'); break
    case 'task-ignored': A.setTaskStatus('ignored'); break
    case 'indent-list': A.indentList(); break
    case 'outdent-list': A.outdentList(); break
    case 'insertParaAbove': A.insertParagraphAbove(); break
    case 'insertParaBelow': A.insertParagraphBelow(); break
    case 'linkReference': A.insertLinkReference(); break
    case 'footnote': A.insertFootnote(); break
    case 'horizontalRule': A.insertHorizontalRule(); break
    case 'toc': A.insertToc(); break
    // Format
    case 'bold': A.toggleBold(); break
    case 'italic': A.toggleItalic(); break
    case 'underline': A.toggleUnderline(); break
    case 'inlineCode': A.toggleInlineCode(); break
    case 'inlineMath': A.insertInlineMath(); break
    case 'strike': A.toggleStrike(); break
    case 'comment': A.insertComment(); break
    case 'link': A.insertHyperlink(); break
    case 'link-open': void A.openLink(); break
    case 'link-copy': void A.copyLinkAddress(); break
    case 'link-edit': void A.editLink(); break
    case 'link-remove': A.removeLink(); break
    case 'image-remote': A.insertRemoteImage(); break
    case 'image-local': A.pickAndInsertImage(); break
    case 'image-copy-all': A.copyAllImages(); break
    case 'image-move-all': A.moveAllImages(); break
    case 'image-upload-all': A.uploadAllImages(); break
    case 'image-reload-all': A.reloadAllImages(); break
    case 'image-mode-none': A.setImageInsertMode('none'); break
    case 'image-mode-current': A.setImageInsertMode('current'); break
    case 'image-mode-assets': A.setImageInsertMode('assets'); break
    case 'image-root': A.setImageRoot(); break
    case 'image-global': A.globalImageSettings(); break
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
    case 'theme-github': applyTheme('github'); break
    case 'theme-gothic': applyTheme('gothic'); break
    case 'theme-newsprint': applyTheme('newsprint'); break
    case 'theme-night': applyTheme('night'); break
    case 'theme-pixyll': applyTheme('pixyll'); break
    case 'theme-whitey': applyTheme('whitey'); break
    // Help
    case 'commandPalette': ui.openCommandPalette(); break
    case 'about': about(); break
  }
  closeMenu()
}
</script>

<template>
  <header class="menu-bar" @click="closeMenu">
    <div class="brand" @click.stop>
      <img src="/logo.png" class="brand-logo" alt="Typo" />
      <span class="brand-name">{{ t('app.name') }}</span>
    </div>
    <template v-for="menu in menus" :key="menu.id">
      <div class="menu" @click.stop>
        <button class="menu-title" :class="{ active: openMenu === menu.id }" @click="toggleMenu(menu.id)">
          {{ t(menu.titleKey) }}
        </button>
        <div v-if="openMenu === menu.id" class="menu-dropdown">
          <MenuNode
            v-for="(item, idx) in menu.items"
            :key="item.id || `sep-${idx}`"
            :item="item"
            :on-run="runCommand"
          />
        </div>
      </div>
    </template>
    <div class="menu-spacer"></div>
    <button class="icon-btn" :title="t('menu.commandPalette')" @click="ui.openCommandPalette()">
      ⌘P
    </button>
  </header>

  <Teleport to="body">
    <div v-if="aboutOpen" class="about-mask" @click.self="aboutOpen = false">
      <div class="about-dialog">
        <img src="/logo.png" class="about-logo" alt="Typo" />
        <h2>{{ t('app.name') }} v0.1.0</h2>
        <p class="about-desc">A Typora-style WYSIWYG Markdown editor.</p>
        <button class="about-btn" @click="aboutOpen = false">{{ t('common.close') }}</button>
      </div>
    </div>
  </Teleport>
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
.brand {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 6px;
  cursor: default;
}
.brand-logo {
  width: 18px;
  height: 18px;
  border-radius: 4px;
}
.brand-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--fg);
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
.about-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.about-dialog {
  width: 320px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow);
  padding: 28px 24px 20px;
  text-align: center;
}
.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  margin-bottom: 12px;
}
.about-dialog h2 {
  margin: 0 0 6px;
  font-size: 18px;
  color: var(--fg);
}
.about-desc {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--fg-muted);
}
.about-btn {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  border-radius: 6px;
  padding: 6px 18px;
  cursor: pointer;
  font-size: 13px;
}
.about-btn:hover {
  background: var(--accent-soft);
}
</style>
