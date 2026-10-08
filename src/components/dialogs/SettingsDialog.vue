<script setup lang="ts">
import { reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsStore } from '@/stores/settings'
import { useUI } from '@/composables/useUI'
import type { EditorMode, Lang } from '@/types'

const { t } = useI18n()
const settingsStore = useSettingsStore()
const ui = useUI()

// Local form uses string-typed fields so native <select v-model> binds cleanly;
// values are cast to the strict union types on save.
interface SettingsForm {
  theme: string
  language: string
  fontSize: number
  lineHeight: number
  fontFamily: string
  autoSave: boolean
  autoSaveInterval: number
  mode: string
  customCss: string
}

const form = reactive<SettingsForm>({
  theme: 'github-light',
  language: 'zh-CN',
  fontSize: 16,
  lineHeight: 1.6,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  autoSave: true,
  autoSaveInterval: 30000,
  mode: 'normal',
  customCss: '',
})

const languages: { value: Lang; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
]
const modes: EditorMode[] = ['normal', 'focus', 'typewriter', 'source']

onMounted(() => {
  Object.assign(form, settingsStore.settings)
})

async function save(): Promise<void> {
  settingsStore.update({
    ...form,
    language: form.language as Lang,
    mode: form.mode as EditorMode,
  } as never)
  settingsStore.applyTheme(form.theme)
  settingsStore.setLanguage(form.language as Lang)
  settingsStore.applyTypography()
  settingsStore.applyCustomCss(form.customCss)
  await settingsStore.persist()
  ui.closeSettings()
}

function cancel(): void {
  ui.closeSettings()
}
</script>

<template>
  <div class="dialog-mask" @click.self="cancel">
    <div class="dialog">
      <h2>{{ t('dialog.settings.title') }}</h2>

      <div class="field">
        <label>{{ t('dialog.settings.theme') }}</label>
        <select v-model="form.theme">
          <option v-for="th in settingsStore.themeList" :key="th.id" :value="th.id">
            {{ th.name }}
          </option>
        </select>
      </div>

      <div class="field">
        <label>{{ t('dialog.settings.language') }}</label>
        <select v-model="form.language">
          <option v-for="l in languages" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
      </div>

      <div class="field">
        <label>{{ t('dialog.settings.fontSize') }}</label>
        <input type="number" v-model.number="form.fontSize" min="10" max="36" />
      </div>

      <div class="field">
        <label>{{ t('dialog.settings.lineHeight') }}</label>
        <input type="number" step="0.1" v-model.number="form.lineHeight" min="1" max="3" />
      </div>

      <div class="field">
        <label>{{ t('dialog.settings.fontFamily') }}</label>
        <input type="text" v-model="form.fontFamily" />
      </div>

      <div class="field">
        <label>{{ t('dialog.settings.mode') }}</label>
        <select v-model="form.mode">
          <option v-for="m in modes" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <div class="field checkbox">
        <input type="checkbox" v-model="form.autoSave" />
        <label>{{ t('dialog.settings.autoSave') }}</label>
      </div>

      <div class="field">
        <label>{{ t('dialog.settings.autoSaveInterval') }}</label>
        <input type="number" v-model.number="form.autoSaveInterval" min="5000" step="1000" />
      </div>

      <div class="field">
        <label>{{ t('dialog.settings.customCss') }}</label>
        <textarea rows="4" v-model="form.customCss" placeholder="body { color: #333; }"></textarea>
      </div>

      <div class="dialog-actions">
        <button class="btn" @click="cancel">{{ t('dialog.settings.cancel') }}</button>
        <button class="btn btn-primary" @click="save">{{ t('dialog.settings.save') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field {
  margin-bottom: 12px;
}
.field.checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
}
.field.checkbox label {
  margin: 0;
}
</style>
