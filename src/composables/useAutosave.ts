import { ref, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useTauri } from './useTauri'

/**
 * Periodic autosave. Every `autoSaveInterval` ms (default 30s) it writes a crash
 * backup of the current document to the app cache dir — but only when the document
 * is dirty and already has a path (so we can key the backup by path).
 */
export function useAutosave() {
  const editor = useEditorStore()
  const settings = useSettingsStore()
  const tauri = useTauri()
  const timer = ref<number | null>(null)

  let inFlight = false

  async function tick(): Promise<void> {
    if (inFlight || !settings.settings.autoSave) return
    if (!editor.doc.dirty) return
    if (!editor.doc.path) return
    const { path, content } = editor.doc
    inFlight = true
    try {
      await tauri.autosave(path, content)
    } catch {
      /* non-fatal — backend may be unavailable in plain dev mode */
    } finally {
      inFlight = false
    }
  }

  function start(): void {
    stop()
    const interval = Math.max(5000, Number(settings.settings.autoSaveInterval) || 30000)
    timer.value = window.setInterval(() => void tick(), interval)
  }

  function stop(): void {
    if (timer.value !== null) {
      window.clearInterval(timer.value)
      timer.value = null
    }
  }

  watch(() => settings.settings.autoSaveInterval, () => { if (timer.value !== null) start() })
  return { start, stop, tick }
}
