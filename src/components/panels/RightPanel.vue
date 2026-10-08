<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/stores/editor'
import OutlinePanel from '../sidebar/OutlinePanel.vue'
import { toHtml } from '@/utils/exporter/toHtml'

const { t } = useI18n()
const editor = useEditorStore()
const tab = ref<'outline' | 'preview'>('outline')
const previewHtml = ref('')
let timer: number | null = null

async function renderPreview(): Promise<void> {
  previewHtml.value = await toHtml(editor.doc.content, editor.doc.name)
}

watch(
  () => editor.doc.content,
  () => {
    if (tab.value !== 'preview') return
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => void renderPreview(), 300)
  },
)
watch(tab, (v) => {
  if (v === 'preview') void renderPreview()
})
</script>

<template>
  <aside class="right-panel">
    <div class="tabs">
      <button class="tab" :class="{ active: tab === 'outline' }" @click="tab = 'outline'">
        {{ t('sidebar.outline') }}
      </button>
      <button class="tab" :class="{ active: tab === 'preview' }" @click="tab = 'preview'">
        {{ t('menu.export') }}
      </button>
    </div>
    <div class="panel-body">
      <OutlinePanel v-if="tab === 'outline'" />
      <div v-else class="preview" v-html="previewHtml"></div>
    </div>
  </aside>
</template>

<style scoped>
.right-panel {
  width: var(--panel-width);
  flex: 0 0 var(--panel-width);
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border-left: 1px solid var(--border);
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
.panel-body {
  flex: 1 1 auto;
  overflow: auto;
  padding: 8px;
}
.preview {
  font-size: 13px;
  line-height: 1.6;
}
</style>
