<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMilkdown } from '@/composables/useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useFilesStore } from '@/stores/files'
import { useSettingsStore } from '@/stores/settings'
import { useTauri } from '@/composables/useTauri'
import { useUI } from '@/composables/useUI'
import * as A from '@/commands/actions'
import { exportDocument } from '@/utils/exporter'
import { insertMath } from '@/milkdown/plugins/latex'
import { insertDiagram } from '@/milkdown/plugins/mermaid'
import { findTemplate } from '@/milkdown/plugins/mermaidTemplates'
import { insertImage } from '@/milkdown/plugins/image'
import { insertTable } from '@/milkdown/plugins/table'
import type { ExportFormat, Lang } from '@/types'

const { t } = useI18n()
const milkdown = useMilkdown()
const editor = useEditorStore()
const files = useFilesStore()
const settings = useSettingsStore()
const tauri = useTauri()
const ui = useUI()

const query = ref('')
const selected = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

interface Cmd {
  id: string
  labelKey?: string
  label?: string
  run: () => void | Promise<void>
}

async function getMd(): Promise<string> {
  return await milkdown.getMarkdown()
}
async function save(): Promise<void> {
  await A.saveFile()
}
async function saveAs(): Promise<void> {
  await A.saveFileAs()
}
async function doExport(format: ExportFormat): Promise<void> {
  const md = await getMd()
  const base = (editor.doc.name || 'untitled').replace(/\.md$/i, '')
  await exportDocument(md, format, base || 'untitled')
}
function setMode(mode: 'normal' | 'focus' | 'typewriter'): void {
  settings.update({ mode })
  void settings.persist()
}
function applyTheme(id: string): void {
  settings.applyTheme(id)
  void settings.persist()
}

const cmds: Cmd[] = [
  { id: 'new', labelKey: 'menu.new', run: () => files.newFile() },
  {
    id: 'open',
    labelKey: 'menu.open',
    run: async () => {
      const p = await tauri.pickOpen()
      if (p) await files.openFile(p)
    },
  },
  { id: 'save', labelKey: 'menu.save', run: save },
  { id: 'saveAs', labelKey: 'menu.saveAs', run: saveAs },
  { id: 'export-md', labelKey: 'export.markdown', run: () => doExport('markdown') },
  { id: 'export-html', labelKey: 'export.html', run: () => doExport('html') },
  { id: 'export-docx', labelKey: 'export.word', run: () => doExport('docx') },
  { id: 'export-pdf', labelKey: 'export.pdf', run: () => doExport('pdf') },
  { id: 'toggleSidebar', labelKey: 'menu.toggleSidebar', run: () => ui.toggleSidebar() },
  { id: 'toggleOutline', labelKey: 'menu.toggleOutline', run: () => ui.toggleOutline() },
  { id: 'focus', labelKey: 'menu.focusMode', run: () => setMode('focus') },
  { id: 'typewriter', labelKey: 'menu.typewriterMode', run: () => setMode('typewriter') },
  { id: 'normal', labelKey: 'menu.normalMode', run: () => setMode('normal') },
  { id: 'theme-light', labelKey: 'theme.github-light', run: () => applyTheme('github-light') },
  { id: 'theme-dark', labelKey: 'theme.nord-dark', run: () => applyTheme('nord-dark') },
  {
    id: 'lang-zh',
    label: '中文 (简体)',
    run: () => {
      settings.setLanguage('zh-CN' as Lang)
      void settings.persist()
    },
  },
  {
    id: 'lang-en',
    label: 'English',
    run: () => {
      settings.setLanguage('en' as Lang)
      void settings.persist()
    },
  },
  {
    id: 'lang-zhtw',
    label: '繁體中文',
    run: () => {
      settings.setLanguage('zh-TW' as Lang)
      void settings.persist()
    },
  },
  {
    id: 'insertTable',
    labelKey: 'menu.insertTable',
    run: () => {
      const e = milkdown.getEditor()
      if (e) insertTable(e)
    },
  },
  {
    id: 'insertImage',
    labelKey: 'menu.insertImage',
    run: async () => {
      const p = await tauri.pickOpen()
      if (!p) return
      const e = milkdown.getEditor()
      if (!e) return
      insertImage(e, p, p.split('/').pop() || 'image')
    },
  },
  {
    id: 'insertMath',
    labelKey: 'menu.insertMath',
    run: () => {
      const e = milkdown.getEditor()
      if (e) insertMath(e, 'E = mc^2', true)
    },
  },
  {
    id: 'insertDiagram',
    labelKey: 'menu.insertDiagram',
    run: () => {
      const e = milkdown.getEditor()
      if (e) insertDiagram(e, findTemplate('flowchart').code)
    },
  },
  { id: 'settings', labelKey: 'menu.preferences', run: () => ui.openSettings() },
]

function labelOf(c: Cmd): string {
  return c.labelKey ? t(c.labelKey) : c.label || c.id
}

const filtered = computed<Cmd[]>(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return cmds
  return cmds.filter((c) => labelOf(c).toLowerCase().includes(q))
})

function runAt(i: number): void {
  const c = filtered.value[i]
  if (!c) return
  void c.run()
  ui.closeCommandPalette()
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selected.value = Math.min(selected.value + 1, filtered.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selected.value = Math.max(selected.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    runAt(selected.value)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    ui.closeCommandPalette()
  }
}

watch(query, () => {
  selected.value = 0
})

onMounted(async () => {
  await nextTick()
  inputEl.value?.focus()
})
</script>

<template>
  <div class="palette-mask" @click.self="ui.closeCommandPalette()">
    <div class="palette">
      <input
        ref="inputEl"
        v-model="query"
        class="palette-input"
        :placeholder="t('command.placeholder')"
        @keydown="onKeydown"
      />
      <ul class="palette-list">
        <li
          v-for="(c, i) in filtered"
          :key="c.id"
          class="palette-item"
          :class="{ active: i === selected }"
          @mouseenter="selected = i"
          @click="runAt(i)"
        >
          {{ labelOf(c) }}
        </li>
        <li v-if="!filtered.length" class="palette-empty">{{ t('command.empty') }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.palette-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1500;
  padding-top: 12vh;
}
.palette {
  width: 520px;
  max-width: 90vw;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  overflow: hidden;
}
.palette-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 12px 14px;
  font-size: 14px;
  background: var(--bg);
  color: var(--fg);
  outline: none;
}
.palette-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 50vh;
  overflow: auto;
}
.palette-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.palette-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.palette-empty {
  padding: 12px;
  color: var(--fg-muted);
  font-size: 13px;
}
</style>
