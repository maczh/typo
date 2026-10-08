import { ref } from 'vue'
import { useMilkdown } from './useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useSettingsStore } from '@/stores/settings'
import { useTauri } from './useTauri'

/**
 * Periodic autosave. Every `autoSaveInterval` ms (default 30s) it writes a crash
 * backup of the current document to the app cache dir — but only when the document
 * is dirty and already has a path (so we can key the backup by path).
 */
export function useAutosave() {
  const milkdown = useMilkdown()
  const editor = useEditorStore()
  const settings = useSettingsStore()
  const tauri = useTauri()
  const timer = ref<number | null>(null)

  async function tick(): Promise<void> {
    if (!settings.settings.autoSave) return
    if (!editor.doc.dirty) return
    if (!editor.doc.path) return
    const content = await milkdown.getMarkdown()
    try {
      await tauri.autosave(editor.doc.path, content)
    } catch {
      /* non-fatal — backend may be unavailable in plain dev mode */
    }
  }

  function start(): void {
    stop()
    const interval = Math.max(5000, settings.settings.autoSaveInterval)
    timer.value = window.setInterval(() => void tick(), interval)
  }

  function stop(): void {
    if (timer.value !== null) {
      window.clearInterval(timer.value)
      timer.value = null
    }
  }

  return { start, stop }
}
