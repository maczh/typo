<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import * as A from '@/commands/actions'
import { useEditorMenu } from '@/composables/useEditorMenu'

/**
 * Typora-style floating menu, shared by two entry points:
 *  - clicking the per-line block handle (opens on the block style submenu), and
 *  - right-clicking inside the editor (context-sensitive: table vs. paragraph).
 */

const { t } = useI18n()
const menu = useEditorMenu()
const openSub = ref<string | null>(null)

const isTable = computed(() => menu.kind.value === 'table')
const submenuTitle = computed(() => (isTable.value ? t('ctx.blockStyleTable') : t('ctx.blockStyle')))

const style = computed(() => {
  const w = 248
  const h = 360
  let left = menu.x.value
  let top = menu.y.value
  if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8)
  if (top + h > window.innerHeight - 8) top = Math.max(8, window.innerHeight - h - 8)
  return { left: `${left}px`, top: `${top}px` }
})

function run(fn?: () => void | Promise<void>): void {
  menu.hide()
  if (fn) void fn()
}

function isPara(): boolean {
  return A.currentBlockType() === 'paragraph'
}
function isHeading(i: number): boolean {
  return A.nodeActive('heading', { level: i })
}
function markActive(...n: string[]): boolean {
  return A.markActive(...n)
}
function nodeActive(n: string): boolean {
  return A.nodeActive(n)
}

interface Item {
  sep?: boolean
  label?: string
  shortcut?: string
  run?: () => void | Promise<void>
  checked?: () => boolean
}

const paragraphItems = computed<Item[]>(() => {
  const items: Item[] = [
    { label: t('ctx.text'), shortcut: 'Ctrl+0', run: A.setParagraph, checked: isPara },
  ]
  for (let i = 1; i <= 6; i += 1) {
    items.push({
      label: t(`ctx.h${i}`),
      shortcut: `Ctrl+${i}`,
      run: () => A.setHeading(i),
      checked: () => isHeading(i),
    })
  }
  return items
})

const insertItems = computed<Item[]>(() => [
  { label: t('ctx.image'), shortcut: 'Ctrl+Shift+I', run: A.insertLocalImage },
  { label: t('ctx.footnote'), run: A.insertFootnote },
  { label: t('ctx.linkRef'), run: A.insertLinkReference },
  { label: t('ctx.horizontalRule'), run: A.insertHorizontalRule },
  { label: t('ctx.table'), shortcut: 'Ctrl+T', run: A.insertTable },
  { label: t('ctx.codeBlock'), shortcut: 'Ctrl+Shift+K', run: A.insertCodeBlock },
  { label: t('ctx.mathBlock'), shortcut: 'Ctrl+Shift+M', run: A.insertMathBlock },
  { label: t('ctx.toc'), run: A.insertToc },
  { label: t('ctx.yaml'), run: A.insertYamlFrontMatter },
  { sep: true },
  { label: t('ctx.paraAbove'), run: A.insertParagraphAbove },
  { label: t('ctx.paraBelow'), run: A.insertParagraphBelow },
])

const tableItems = computed<Item[]>(() => [
  { label: t('ctx.rowAbove'), run: A.tableRowAbove },
  { label: t('ctx.rowBelow'), shortcut: 'Ctrl+Enter', run: A.tableRowBelow },
  { label: t('ctx.colLeft'), run: A.tableColLeft },
  { label: t('ctx.colRight'), run: A.tableColRight },
  { sep: true },
  { label: t('ctx.moveRowUp'), shortcut: 'Alt+↑', run: A.tableMoveRowUp },
  { label: t('ctx.moveRowDown'), shortcut: 'Alt+↓', run: A.tableMoveRowDown },
  { label: t('ctx.moveColLeft'), shortcut: 'Alt+←', run: A.tableMoveColLeft },
  { label: t('ctx.moveColRight'), shortcut: 'Alt+→', run: A.tableMoveColRight },
  { sep: true },
  { label: t('ctx.deleteRow'), shortcut: 'Ctrl+Shift+⌫', run: A.tableDeleteRow },
  { label: t('ctx.deleteCol'), run: A.tableDeleteCol },
  { sep: true },
  { label: t('ctx.copyTable'), run: A.tableCopy },
  { label: t('ctx.formatTable'), run: A.tableFormat },
  { sep: true },
  { label: t('ctx.deleteTable'), run: A.tableDelete },
])

watch(
  () => menu.open.value,
  (o) => {
    if (o) openSub.value = null
  },
)

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') menu.hide()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div v-if="menu.open.value" class="ctx-layer" @pointerdown="menu.hide()" @contextmenu.prevent>
      <div class="ctx-menu" :style="style" @pointerdown.stop.prevent @contextmenu.prevent>
        <!-- clipboard -->
        <div class="ctx-bar">
          <button type="button" :title="t('ctx.cut')" @click="run(A.cut)">✂</button>
          <button type="button" :title="t('ctx.copy')" @click="run(A.copySelection)">⧉</button>
          <button type="button" :title="t('ctx.paste')" @click="run(A.paste)">▤</button>
          <button type="button" :title="t('ctx.remove')" @click="run(A.deleteSelection)">🗑</button>
        </div>

        <div class="ctx-bar">
          <button type="button" class="wide" @click="run(A.copyAsMarkdown)">
            {{ t('ctx.copyAs') }} Markdown
          </button>
          <button type="button" class="wide" @click="run(A.pasteAsPlainText)">
            {{ t('ctx.pasteAs') }}
          </button>
        </div>

        <div class="ctx-bar">
          <button type="button" :class="{ active: markActive('strong', 'bold') }" @click="run(A.toggleBold)"><b>B</b></button>
          <button type="button" :class="{ active: markActive('emphasis', 'em', 'italic') }" @click="run(A.toggleItalic)"><i>I</i></button>
          <button type="button" :class="{ active: markActive('code_inline', 'code') }" @click="run(A.toggleInlineCode)">‹›</button>
          <button type="button" @click="run(A.insertHyperlink)">🔗</button>
          <button type="button" :class="{ active: markActive('strike_through', 'strikethrough', 'strike') }" @click="run(A.toggleStrike)">S̶</button>
          <button type="button" @click="run(A.clearStyle)">⌫</button>
        </div>

        <div class="ctx-bar">
          <button type="button" :class="{ active: nodeActive('blockquote') }" @click="run(A.insertBlockquote)">❝</button>
          <button type="button" :class="{ active: nodeActive('bullet_list') }" @click="run(A.insertUnorderedList)">•</button>
          <button type="button" :class="{ active: nodeActive('ordered_list') }" @click="run(A.insertOrderedList)">1.</button>
          <button type="button" :class="{ active: nodeActive('task_list') }" @click="run(A.insertTaskList)">☑</button>
        </div>

        <div class="ctx-sep"></div>

        <!-- block style / table submenu -->
        <div class="ctx-item has-sub" @mouseenter="openSub = isTable ? 'table' : 'style'">
          <span>{{ submenuTitle }}</span><span class="arrow">▸</span>
          <div v-if="openSub === 'table' || openSub === 'style'" class="ctx-submenu">
            <template v-if="isTable">
              <template v-for="(it, idx) in tableItems" :key="`t${idx}`">
                <div v-if="it.sep" class="ctx-sep"></div>
                <button v-else type="button" class="ctx-row-item" @click="run(it.run)">
                  <span class="lbl">{{ it.label }}</span>
                  <span class="sc">{{ it.shortcut || '' }}</span>
                </button>
              </template>
            </template>
            <template v-else>
              <button v-for="(it, idx) in paragraphItems" :key="`p${idx}`" type="button" class="ctx-row-item" @click="run(it.run)">
                <span class="lbl"><span class="check">{{ it.checked && it.checked() ? '✓' : '' }}</span>{{ it.label }}</span>
                <span class="sc">{{ it.shortcut || '' }}</span>
              </button>
            </template>
          </div>
        </div>

        <!-- insert submenu -->
        <div class="ctx-item has-sub" @mouseenter="openSub = 'insert'">
          <span>{{ t('ctx.insert') }}</span><span class="arrow">▸</span>
          <div v-if="openSub === 'insert'" class="ctx-submenu">
            <template v-for="(it, idx) in insertItems" :key="`i${idx}`">
              <div v-if="it.sep" class="ctx-sep"></div>
              <button v-else type="button" class="ctx-row-item" @click="run(it.run)">
                <span class="lbl">{{ it.label }}</span>
                <span class="sc">{{ it.shortcut || '' }}</span>
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx-layer {
  position: fixed;
  inset: 0;
  z-index: 1500;
}
.ctx-menu {
  position: fixed;
  min-width: 236px;
  padding: 6px;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  font-size: 13px;
  user-select: none;
}
.ctx-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 0;
}
.ctx-bar button {
  min-width: 30px;
  height: 28px;
  padding: 0 6px;
  border: none;
  background: transparent;
  color: var(--fg);
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
.ctx-bar button.wide {
  flex: 1 1 auto;
  font-size: 12px;
}
.ctx-bar button:hover {
  background: var(--accent-soft);
}
.ctx-bar button.active {
  background: var(--accent);
  color: #fff;
}
.ctx-sep {
  height: 1px;
  margin: 5px 4px;
  background: var(--border);
}
.ctx-item {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 10px;
  border-radius: 5px;
  cursor: default;
}
.ctx-item:hover {
  background: var(--accent-soft);
}
.ctx-item .arrow {
  color: var(--fg-muted);
  font-size: 11px;
}
.ctx-submenu {
  position: absolute;
  left: 100%;
  top: -6px;
  margin-left: 2px;
  min-width: 220px;
  padding: 6px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  z-index: 1600;
}
.ctx-row-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--fg);
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  text-align: left;
}
.ctx-row-item:hover {
  background: var(--accent-soft);
}
.ctx-row-item .lbl {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.ctx-row-item .check {
  display: inline-block;
  width: 14px;
  color: var(--accent);
}
.ctx-row-item .sc {
  color: var(--fg-muted);
  font-size: 12px;
  white-space: nowrap;
}
</style>
