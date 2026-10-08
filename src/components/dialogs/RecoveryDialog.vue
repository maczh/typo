<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/stores/editor'
import { useTauri } from '@/composables/useTauri'
import { useUI } from '@/composables/useUI'
import type { RecoveryItem } from '@/types'

const { t } = useI18n()
const editor = useEditorStore()
const tauri = useTauri()
const ui = useUI()
const items = ref<RecoveryItem[]>([])

onMounted(async () => {
  try {
    items.value = await tauri.checkRecovery()
  } catch {
    items.value = []
  }
})

function basename(p: string): string {
  return p.split('/').pop() || p
}

async function recover(item: RecoveryItem): Promise<void> {
  try {
    const res = await tauri.openFile(item.backup_path)
    editor.loadFromText(res.content, item.doc_path, basename(item.doc_path))
    await tauri.clearRecovery(item.doc_path)
    items.value = items.value.filter((i) => i.doc_path !== item.doc_path)
  } catch {
    /* ignore */
  }
  if (!items.value.length) ui.closeRecovery()
}

async function ignore(item: RecoveryItem): Promise<void> {
  try {
    await tauri.clearRecovery(item.doc_path)
  } catch {
    /* ignore */
  }
  items.value = items.value.filter((i) => i.doc_path !== item.doc_path)
  if (!items.value.length) ui.closeRecovery()
}
</script>

<template>
  <div class="dialog-mask" @click.self="ui.closeRecovery()">
    <div class="dialog">
      <h2>{{ t('dialog.recovery.title') }}</h2>
      <p class="msg">{{ t('dialog.recovery.message') }}</p>
      <ul class="rec-list">
        <li v-for="item in items" :key="item.doc_path" class="rec-item">
          <span class="rec-name">{{ item.doc_path.split('/').pop() }}</span>
          <span class="rec-actions">
            <button class="btn btn-primary" @click="recover(item)">
              {{ t('dialog.recovery.recover') }}
            </button>
            <button class="btn" @click="ignore(item)">{{ t('dialog.recovery.ignore') }}</button>
          </span>
        </li>
        <li v-if="!items.length" class="empty">—</li>
      </ul>
      <div class="dialog-actions">
        <button class="btn" @click="ui.closeRecovery()">{{ t('common.close') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg {
  font-size: 13px;
  color: var(--fg-muted);
  margin: 0 0 12px;
}
.rec-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 40vh;
  overflow: auto;
}
.rec-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  gap: 12px;
}
.rec-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rec-actions {
  display: flex;
  gap: 6px;
  flex: 0 0 auto;
}
.empty {
  color: var(--fg-muted);
  font-size: 13px;
  padding: 8px 0;
}
</style>
