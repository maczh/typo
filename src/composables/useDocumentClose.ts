import { onMounted, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { isTauri } from './useTauri'
import { confirmDiscard } from '@/utils/documentGuard'

export function useDocumentClose(): void {
  const editor = useEditorStore()
  let unlisten: (() => void) | undefined
  let disposed = false
  let closing = false
  let prompting = false
  const beforeUnload = (event: BeforeUnloadEvent): void => {
    if (!editor.doc.dirty || closing) return
    event.preventDefault()
    event.returnValue = ''
  }
  onMounted(async () => {
    if (!isTauri()) { window.addEventListener('beforeunload', beforeUnload); return }
    const win = (await import('@tauri-apps/api/window')).getCurrentWindow()
    const off = await win.onCloseRequested(async (event) => {
      if (closing || !editor.doc.dirty) return
      event.preventDefault()
      if (prompting) return
      prompting = true
      try {
        if (await confirmDiscard()) {
          closing = true
          try { await win.close() } catch { closing = false }
        }
      } finally { prompting = false }
    })
    if (disposed) off()
    else unlisten = off
  })
  onBeforeUnmount(() => {
    disposed = true
    unlisten?.()
    window.removeEventListener('beforeunload', beforeUnload)
  })
}
