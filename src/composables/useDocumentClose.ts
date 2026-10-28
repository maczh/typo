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
      // A close request can be asynchronous because the discard dialog is
      // asynchronous. Keep the event cancelled until the decision is made.
      // Once accepted, destroy the native window instead of calling close()
      // from inside its own close-request callback (which re-enters this
      // callback and can leave the event loop waiting indefinitely).
      if (closing) return
      event.preventDefault()
      if (prompting) return
      prompting = true
      try {
        if (await confirmDiscard()) {
          closing = true
          const size = await win.outerSize()
          const position = await win.outerPosition()
          const { invoke } = await import('@tauri-apps/api/core')
          await invoke('save_window_state', {
            state: { x: position.x, y: position.y, width: size.width, height: size.height },
          })
          try { await win.destroy() } catch { closing = false }
        }
      } catch { closing = false
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
