import { watch, onBeforeUnmount } from 'vue'
import { useEditorStore } from '@/stores/editor'
import { isTauri } from '@/composables/useTauri'

/**
 * Keep the OS / browser window title in sync with the open document:
 *
 *   Typo - <filename>            (clean)
 *   Typo - <filename> •          (dirty / unsaved)
 *
 * In Tauri we use `@tauri-apps/api/window`'s `getCurrentWindow().setTitle` so the
 * native title bar reflects the document; in a plain browser we fall back to
 * `document.title`. A trailing " •" marks unsaved changes (lightweight, matches
 * what most editors do).
 */

function buildTitle(name: string, dirty: boolean): string {
  return `Typo - ${name}${dirty ? ' •' : ''}`
}

export function useWindowTitle(): void {
  const editor = useEditorStore()
  let win: { setTitle: (title: string) => void } | null = null

  if (isTauri()) {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => {
        win = getCurrentWindow() as unknown as { setTitle: (title: string) => void }
      })
      .catch(() => {
        win = null
      })
  }

  function apply(): void {
    const title = buildTitle(editor.doc.name || 'untitled.md', editor.doc.dirty)
    if (win) {
      try {
        win.setTitle(title)
        return
      } catch {
        /* window handle not ready — fall through to document.title */
      }
    }
    document.title = title
  }

  // Set the title once immediately, then react to name / dirty changes.
  apply()
  const stop = watch(
    () => [editor.doc.name, editor.doc.dirty] as const,
    () => apply(),
    { immediate: false },
  )

  onBeforeUnmount(() => stop())
}
