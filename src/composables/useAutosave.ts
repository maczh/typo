import { ref, watch } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useTauri } from './useTauri'
import { saveFile } from '@/commands/actions'

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
    inFlight = true
    try {
      if (editor.doc.path) {
        await saveFile()
      } else {
        // Unnamed documents are intentionally kept as crash-recovery drafts;
        // they must not trigger a Save As dialog from the timer.
        await tauri.autosave(`untitled:${editor.doc.id ?? 'current'}`, editor.doc.content)
      }
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
