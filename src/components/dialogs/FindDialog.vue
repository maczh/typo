<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFind } from '@/composables/useFind'
import { useUI } from '@/composables/useUI'

const { t } = useI18n()
const ui = useUI()
const f = useFind()
const findInput = ref<HTMLInputElement | null>(null)

onMounted(async () => {
  await nextTick()
  findInput.value?.focus()
  findInput.value?.select()
})

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (e.shiftKey) f.findPrev()
    else f.findNext()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    f.close()
  }
}
</script>

<template>
  <div class="find-bar" @keydown="onKey">
    <input
      ref="findInput"
      v-model="f.findText.value"
      class="fld"
      :placeholder="t('find.placeholder')"
      @input="f.findNext()"
    />
    <label class="chk">
      <input v-model="f.matchCase.value" type="checkbox" /> {{ t('find.matchCase') }}
    </label>
    <button class="btn" :title="t('find.prev')" @click="f.findPrev()">↑</button>
    <button class="btn" :title="t('find.next')" @click="f.findNext()">↓</button>
    <button class="btn" @click="f.replaceVisible.value = !f.replaceVisible.value">
      {{ t('find.replace') }}
    </button>

    <template v-if="f.replaceVisible.value">
      <input v-model="f.replaceText.value" class="fld" :placeholder="t('find.replaceWith')" />
      <button class="btn" @click="f.replaceOne()">{{ t('find.replaceOne') }}</button>
      <button class="btn" @click="f.replaceAll()">{{ t('find.replaceAll') }}</button>
    </template>

    <button class="btn close" :title="t('common.close')" @click="f.close()">✕</button>
  </div>
</template>

<style scoped>
.find-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--sidebar-bg);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.fld {
  height: 28px;
  min-width: 160px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  border-radius: 4px;
  padding: 0 8px;
  font-size: 13px;
  outline: none;
}
.chk {
  font-size: 12px;
  color: var(--fg-muted);
  display: flex;
  align-items: center;
  gap: 3px;
}
.btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--fg);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}
.btn:hover {
  background: var(--accent-soft);
}
.btn.close {
  margin-left: auto;
}
</style>
