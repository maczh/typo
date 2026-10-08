<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFilesStore } from '@/stores/files'
import * as A from '@/commands/actions'

const { t } = useI18n()
const files = useFilesStore()

onMounted(() => {
  if (files.currentDir) void files.refreshTree(files.currentDir)
})

function openItem(path: string): void {
  void files.openFile(path)
}

function openDir(path: string): void {
  void files.refreshTree(path)
}
</script>

<template>
  <div class="file-tree">
    <div class="tree-actions">
      <button class="btn" @click="A.openFileDialog">{{ t('menu.open') }}</button>
      <button class="icon-btn" :title="t('sidebar.openFolder')" @click="files.openFolder">
        📁
      </button>
    </div>

    <div v-if="files.currentDir" class="breadcrumb" :title="files.currentDir">
      📂 {{ files.currentDir }}
    </div>

    <div class="section-title">{{ t('sidebar.recent') }}</div>
    <ul class="list">
      <li
        v-for="r in files.recent"
        :key="r.path"
        class="entry"
        :title="r.path"
        @click="openItem(r.path)"
      >
        📄 {{ r.name }}
      </li>
      <li v-if="!files.recent.length" class="empty">{{ t('sidebar.empty') }}</li>
    </ul>

    <div class="section-title">{{ t('sidebar.files') }}</div>
    <ul class="list">
      <li
        v-for="item in files.tree"
        :key="item.path"
        class="entry"
        :class="{ dir: item.isDir }"
        :title="item.path"
        @click="item.isDir ? openDir(item.path) : openItem(item.path)"
      >
        {{ item.isDir ? '📁' : '📄' }} {{ item.name }}
      </li>
      <li v-if="!files.tree.length" class="empty">{{ t('sidebar.empty') }}</li>
    </ul>
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
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.entry:hover {
  background: var(--accent-soft);
}
.empty {
  padding: 4px 6px;
  font-size: 12px;
  color: var(--fg-muted);
}
</style>
