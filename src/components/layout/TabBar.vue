<script setup lang="ts">
import { useEditorStore } from '@/stores/editor'
import * as A from '@/commands/actions'

const editor = useEditorStore()

function close(id: string): void {
  void A.closeTab(id)
}

function openInWindow(id: string): void {
  const tab = editor.tabs.find((item) => item.id === id)
  if (!tab?.doc.path) return
  A.newWindow(tab.doc.path)
  void A.closeTab(id)
}
</script>

<template>
  <div class="tab-bar" role="tablist">
    <button v-for="tab in editor.tabs" :key="tab.id" class="tab" :class="{ active: tab.id === editor.activeTabId }" @click="editor.activateTab(tab.id)" @dblclick="openInWindow(tab.id)">
      <span class="tab-title" :title="tab.doc.name">{{ tab.doc.dirty ? '*' : '' }}{{ tab.doc.name }}</span>
      <span class="tab-close" title="关闭" @click.stop="close(tab.id)">×</span>
    </button>
  </div>
</template>

<style scoped>
.tab-bar { display: flex; min-height: 34px; overflow-x: auto; background: var(--sidebar-bg); border-bottom: 1px solid var(--border); }
.tab { display: inline-flex; align-items: center; gap: 8px; flex: 0 1 220px; min-width: 0; max-width: 220px; padding: 0 12px; border: 0; border-right: 1px solid var(--border); background: transparent; color: var(--fg-muted); white-space: nowrap; cursor: pointer; overflow: hidden; }
.tab.active { background: var(--bg); color: var(--fg); }
.tab-title { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; }
.tab-close { flex: 0 0 auto; margin-left: auto; font-size: 16px; opacity: .7; }
.tab-close:hover { opacity: 1; }
</style>
