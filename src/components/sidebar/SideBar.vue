<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FileTree from './FileTree.vue'
import OutlinePanel from './OutlinePanel.vue'

const { t } = useI18n()
const tab = ref<'files' | 'outline'>('files')
</script>

<template>
  <aside class="sidebar">
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'files' }" @click="tab = 'files'">
        {{ t('sidebar.files') }}
      </button>
      <button class="tab" :class="{ active: tab === 'outline' }" @click="tab = 'outline'">
        {{ t('sidebar.outline') }}
      </button>
    </div>
    <div class="sidebar-body">
      <FileTree v-if="tab === 'files'" />
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
