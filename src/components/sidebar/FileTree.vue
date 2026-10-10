<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import * as A from '@/commands/actions'
import TreeItem from './TreeItem.vue'

const { t } = useI18n()
const files = useFilesStore()

// The sidebar only ever shows at most the 10 most-recent files (Rust also caps
// the stored list at 10; this slice is a defensive UI guard).
const recentFiles = computed(() => files.recent.slice(0, 10))

function openRecent(path: string): void {
  void files.openFile(path)
}
</script>

<template>
  <div class="file-tree">
    <div class="tree-actions">
      <button class="btn" @click="A.openFileDialog">{{ t('menu.open') }}</button>
      <button class="icon-btn" :title="t('sidebar.openFolder')" @click="files.openFolder">
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
          <path
            d="M1.5 3.5h4l1.2 1.3h7.3a.8.8 0 0 1 .8.8v6.6a.8.8 0 0 1-.8.8H1.5a.8.8 0 0 1-.8-.8V4.3a.8.8 0 0 1 .8-.8z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>

    <div v-if="files.currentDir" class="breadcrumb" :title="files.currentDir">
      {{ files.currentDir }}
    </div>

    <div class="section-title">{{ t('sidebar.recent') }}</div>
    <ul class="list">
      <li
        v-for="r in recentFiles"
        :key="r.path"
        class="entry"
        :title="r.path"
        @click="openRecent(r.path)"
      >
        <span class="dot" />
        <span class="name">{{ r.name }}</span>
      </li>
      <li v-if="!recentFiles.length" class="empty">{{ t('sidebar.empty') }}</li>
    </ul>

    <div class="section-title">{{ t('sidebar.directory') }}</div>
    <div v-if="files.currentDir" class="tree">
      <TreeItem
        v-for="item in files.tree"
        :key="item.path"
        :item="item"
        :depth="0"
      />
      <div v-if="!files.tree.length" class="empty">{{ t('sidebar.empty') }}</div>
    </div>
    <div v-else class="empty hint">{{ t('sidebar.openFolder') }}…</div>
  </div>
</template>

<style scoped>
.file-tree {
  font-size: 13px;
}
.tree-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.btn {
  flex: 1 1 auto;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
}
.btn:hover {
  background: var(--accent-soft);
}
.icon-btn {
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  background: var(--accent-soft);
}
.breadcrumb {
  font-size: 11px;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 2px 4px 6px;
}
.section-title {
  font-size: 11px;
  text-transform: uppercase;
  color: var(--fg-muted);
  margin: 10px 0 4px;
  letter-spacing: 0.04em;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entry {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}
.entry:hover {
  background: var(--accent-soft);
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex: 0 0 auto;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree {
  margin-top: 2px;
}
.empty {
  padding: 4px 6px;
  font-size: 12px;
  color: var(--fg-muted);
}
.hint {
  font-style: italic;
}
</style>
