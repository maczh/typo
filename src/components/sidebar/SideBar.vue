<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUI } from '@/composables/useUI'
import FileTree from './FileTree.vue'
import OutlinePanel from './OutlinePanel.vue'

const { t } = useI18n()
const ui = useUI()
</script>

<template>
  <aside class="sidebar">
    <div class="tabs">
      <button class="tab" :class="{ active: ui.sidebarView.value === 'files' }" @click="ui.sidebarView.value = 'files'">
        {{ t('sidebar.files') }}
      </button>
      <button class="tab" :class="{ active: ui.sidebarView.value === 'outline' }" @click="ui.sidebarView.value = 'outline'">
        {{ t('sidebar.outline') }}
      </button>
      <button class="tab" :class="{ active: ui.sidebarView.value === 'articles' }" @click="ui.sidebarView.value = 'articles'">
        {{ t('sidebar.articles') }}
      </button>
    </div>
    <div class="sidebar-body">
      <FileTree v-if="ui.sidebarView.value !== 'outline'" />
      <OutlinePanel v-else />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex: 0 0 var(--sidebar-width);
  display: flex;
  flex-direction: column;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border);
  min-height: 0;
}
.tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
}
.tab {
  flex: 1 1 0;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  padding: 8px 0;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 2px solid transparent;
}
.tab.active {
  color: var(--fg);
  border-bottom-color: var(--accent);
}
.sidebar-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 8px;
}
</style>
