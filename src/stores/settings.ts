import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import type { Settings, ThemeDef, Lang } from '@/types'
import { useTauri } from '@/composables/useTauri'
import { i18n } from '@/i18n'

const defaultSettings: Settings = {
  theme: 'github-light',
  language: 'zh-CN',
  fontSize: 16,
  lineHeight: 1.6,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  autoSave: true,
  autoSaveInterval: 30000,
  mode: 'normal',
  contentWidth: 70,
  customCss: '',
}

const themes: ThemeDef[] = [
  { id: 'github-light', name: 'GitHub Light', kind: 'light' },
  { id: 'nord-dark', name: 'Nord Dark', kind: 'dark' },
]

/**
 * Settings store — theme, language, editor preferences and auto-save config.
 * Persists to disk via the Rust `settings` command.
 */
export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<Settings>({ ...defaultSettings })
  const themeList = ref<ThemeDef[]>(themes)

  function loadThemeCss(id: string): void {
    if (id === 'nord-dark') {
      import('@/styles/themes/nord-dark.css')
    } else {
      import('@/styles/themes/github-light.css')
    }
  }

  async function load(): Promise<void> {
    const tauri = useTauri()
    try {
      const s = await tauri.loadSettings()
      Object.assign(settings, s)
    } catch {
      /* keep defaults */
    }
    applyTheme(settings.theme)
    setLanguage(settings.language)
    applyTypography()
    applyLayout()
    applyCustomCss(settings.customCss)
  }

  async function persist(): Promise<void> {
    const tauri = useTauri()
    try {
      await tauri.saveSettings(settings)
    } catch {
      /* non-fatal in environments without a backend */
    }
  }

  function applyTheme(id: string): void {
    settings.theme = id
    const el = document.documentElement
    el.setAttribute('data-theme', id)
    loadThemeCss(id)
  }

  /** Push font size / line height / family into CSS variables. */
  function applyTypography(): void {
    const el = document.documentElement
    el.style.setProperty('--font-size', `${settings.fontSize}px`)
    el.style.setProperty('--line-height', String(settings.lineHeight))
    el.style.setProperty('--font-family', settings.fontFamily)
  }

  /** Push the WYSIWYG column width into its CSS variable. */
  function applyLayout(): void {
    const width = Number(settings.contentWidth)
    const safe = Number.isFinite(width) ? Math.min(100, Math.max(30, width)) : 70
    settings.contentWidth = safe
    document.documentElement.style.setProperty('--content-width', `${safe}%`)
  }

  /** Inject (or clear) user custom CSS into a dedicated <style> tag. */
  function applyCustomCss(css: string): void {
    settings.customCss = css
    let el = document.getElementById('typo-custom-css') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'typo-custom-css'
      document.head.appendChild(el)
    }
    el.textContent = css
  }

  function setLanguage(lang: Lang): void {
    settings.language = lang
    i18n.global.locale.value = lang as Lang
    try {
      localStorage.setItem('typo-lang', lang)
    } catch {
      /* ignore */
    }
  }

  function update(partial: Partial<Settings>): void {
    Object.assign(settings, partial)
  }

  return {
    settings,
    themeList,
    load,
    persist,
    applyTheme,
    applyTypography,
    applyLayout,
    applyCustomCss,
    setLanguage,
    update,
  }
})
