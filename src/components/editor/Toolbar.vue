<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import * as A from '@/commands/actions'

const { t } = useI18n()

const active = reactive({
  bold: false,
  italic: false,
  strike: false,
  code: false,
  h1: false,
  h2: false,
  h3: false,
  h4: false,
  h5: false,
  h6: false,
  paragraph: false,
  bullet: false,
  ordered: false,
  task: false,
  quote: false,
  codeblock: false,
})

let scheduled = false
function refresh(): void {
  if (scheduled) return
  scheduled = true
  requestAnimationFrame(() => {
    scheduled = false
    active.bold = A.markActive('strong', 'bold')
    active.italic = A.markActive('emphasis', 'em', 'italic')
    active.strike = A.markActive('strike_through', 'strikethrough', 'strike')
    active.code = A.markActive('code_inline', 'code')
    ;(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach((k, idx) => {
      active[k] = A.nodeActive('heading', { level: idx + 1 })
    })
    active.paragraph = A.nodeActive('paragraph')
    active.bullet = A.nodeActive('bullet_list')
    active.ordered = A.nodeActive('ordered_list')
    active.task = A.nodeActive('task_list') || A.nodeActive('bullet_list')
    active.quote = A.nodeActive('blockquote')
    active.codeblock = A.nodeActive('code_block') || A.nodeActive('fence')
  })
}

function onSelectionChange(): void {
  refresh()
}

onMounted(() => {
  document.addEventListener('selectionchange', onSelectionChange)
  refresh()
})
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChange)
})

const blockValue = ref('paragraph')
function onBlockChange(e: Event): void {
  const v = (e.target as HTMLSelectElement).value
  if (v === 'paragraph') A.setParagraph()
  else A.setHeading(Number(v.replace('h', '')))
}

interface ToolBtn {
  key: string
  title: string
  run: () => void
  isActive?: () => boolean
}

const inlineBtns: ToolBtn[] = [
  { key: 'bold', title: 'Ctrl+B', run: A.toggleBold, isActive: () => active.bold },
  { key: 'italic', title: 'Ctrl+I', run: A.toggleItalic, isActive: () => active.italic },
  { key: 'underline', title: 'Ctrl+U', run: A.toggleUnderline },
  { key: 'strike', title: 'Alt+Shift+5', run: A.toggleStrike, isActive: () => active.strike },
  { key: 'code', title: 'Ctrl+Shift+`', run: A.toggleInlineCode, isActive: () => active.code },
  { key: 'link', title: 'Ctrl+K', run: A.insertHyperlink },
]

const blockBtns: ToolBtn[] = [
  { key: 'quote', title: 'Ctrl+Shift+Q', run: A.insertBlockquote, isActive: () => active.quote },
  { key: 'bullet', title: 'Ctrl+Shift+]', run: A.insertUnorderedList, isActive: () => active.bullet },
  { key: 'ordered', title: 'Ctrl+Shift+[', run: A.insertOrderedList, isActive: () => active.ordered },
  { key: 'task', title: 'Ctrl+Shift+X', run: A.insertTaskList, isActive: () => active.task },
  { key: 'table', title: 'Ctrl+T', run: A.insertTable },
  { key: 'codeblock', title: 'Ctrl+Shift+K', run: A.insertCodeBlock, isActive: () => active.codeblock },
  { key: 'math', title: 'Ctrl+Shift+M', run: A.insertMathBlock },
  { key: 'diagram', title: 'Mermaid', run: A.insertDiagramBlock },
  { key: 'image', title: 'Ctrl+Shift+I', run: A.insertLocalImage },
  { key: 'source', title: 'Ctrl+/', run: A.toggleSourceMode },
]
</script>

<template>
  <div class="toolbar">
    <button class="tb-btn" :title="t('toolbar.undo')" @click="A.undo()">↶</button>
    <button class="tb-btn" :title="t('toolbar.redo')" @click="A.redo()">↷</button>

    <span class="sep"></span>

    <select class="block-select" :value="blockValue" @change="onBlockChange">
      <option value="paragraph">{{ t('toolbar.paragraph') }}</option>
      <option v-for="i in 6" :key="i" :value="`h${i}`">{{ t('toolbar.heading') }} {{ i }}</option>
    </select>

    <span class="sep"></span>

    <button
      v-for="b in inlineBtns"
      :key="b.key"
      class="tb-btn"
      :class="{ active: b.isActive?.() }"
      :title="`${t('toolbar.' + b.key)} (${b.title})`"
      @click="b.run()"
    >
      {{ b.key === 'bold' ? 'B' : b.key === 'italic' ? 'I' : b.key === 'underline' ? 'U' : b.key === 'strike' ? 'S' : b.key === 'code' ? '‹›' : '🔗' }}
    </button>

    <span class="sep"></span>

    <button
      v-for="b in blockBtns"
      :key="b.key"
      class="tb-btn"
      :class="{ active: b.isActive?.() }"
      :title="`${t('toolbar.' + b.key)} (${b.title})`"
      @click="b.run()"
    >
      {{ b.key === 'quote' ? '❝' : b.key === 'bullet' ? '•' : b.key === 'ordered' ? '1.' : b.key === 'task' ? '☑' : b.key === 'table' ? '▦' : b.key === 'codeblock' ? '⤞' : b.key === 'math' ? '∑' : b.key === 'diagram' ? '📊' : b.key === 'image' ? '🖼' : b.key === 'source' ? '⟨/⟩' : '' }}
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-wrap: wrap;
  height: var(--toolbar-height, 40px);
  padding: 0 8px;
  background: var(--sidebar-bg);
  border-bottom: 1px solid var(--border);
  user-select: none;
}
.tb-btn {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border: none;
  background: transparent;
  color: var(--fg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
.tb-btn:hover {
  background: var(--accent-soft);
}
.tb-btn.active {
  background: var(--accent);
  color: #fff;
}
.block-select {
  height: 28px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  border-radius: 4px;
  font-size: 13px;
  padding: 0 4px;
  cursor: pointer;
}
.sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}
</style>
