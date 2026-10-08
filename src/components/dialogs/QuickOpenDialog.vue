<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useQuickOpen } from '@/composables/useQuickOpen'

const { t } = useI18n()
const q = useQuickOpen()
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await nextTick()
  inputEl.value?.focus()
})

watch(q.query, () => {
  q.selected.value = 0
})
</script>

<template>
  <div class="quickopen-mask" @click.self="q.close()">
    <div class="quickopen">
      <input
        ref="inputEl"
        v-model="q.query.value"
        class="qo-input"
        :placeholder="t('quickopen.placeholder')"
        @keydown="q.onKey"
      />
      <ul class="qo-list">
        <li
          v-for="(e, i) in q.filtered.value"
          :key="e.path"
          class="qo-item"
          :class="{ active: i === q.selected.value }"
          :title="e.path"
          @mouseenter="q.selected.value = i"
          @click="q.open(e)"
        >
          <span class="qo-name">{{ e.name }}</span>
          <span class="qo-path">{{ e.path }}</span>
        </li>
        <li v-if="!q.filtered.value.length" class="qo-empty">{{ t('quickopen.empty') }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.quickopen-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 1600;
  padding-top: 12vh;
}
.quickopen {
  width: 560px;
  max-width: 92vw;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  overflow: hidden;
}
.qo-input {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--border);
  padding: 12px 14px;
  font-size: 14px;
  background: var(--bg);
  color: var(--fg);
  outline: none;
}
.qo-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 50vh;
  overflow: auto;
}
.qo-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  flex-direction: column;
}
.qo-item.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.qo-name {
  font-weight: 600;
}
.qo-path {
  font-size: 11px;
  color: var(--fg-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.qo-empty {
  padding: 12px;
  color: var(--fg-muted);
  font-size: 13px;
}
</style>
