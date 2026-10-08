<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'

const { t } = useI18n()
const editor = useEditorStore()
const settings = useSettingsStore()

const savedLabel = computed(() =>
  editor.doc.dirty ? t('statusbar.unsaved') : t('statusbar.saved'),
)
const themeLabel = computed(() => settings.themeList.find((x) => x.id === settings.settings.theme)?.name || settings.settings.theme)
const langLabel = computed(() => settings.settings.language)
</script>

<template>
  <footer class="status-bar">
    <span class="item">{{ t('statusbar.words') }}: {{ editor.wordCount }}</span>
    <span class="item">{{ t('statusbar.line') }} {{ editor.cursor.line }}:{{ t('statusbar.col') }} {{ editor.cursor.col }}</span>
    <span class="item" :class="{ dirty: editor.doc.dirty }">{{ savedLabel }}</span>
    <span class="spacer"></span>
    <span class="item">{{ t('statusbar.theme') }}: {{ themeLabel }}</span>
    <span class="item">{{ t('statusbar.lang') }}: {{ langLabel }}</span>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  height: var(--statusbar-height);
  padding: 0 12px;
  font-size: 12px;
  color: var(--fg-muted);
  background: var(--sidebar-bg);
  border-top: 1px solid var(--border);
  user-select: none;
}
.item {
  margin-right: 16px;
  white-space: nowrap;
}
.item.dirty {
  color: var(--accent);
}
.spacer {
  flex: 1 1 auto;
}
</style>
