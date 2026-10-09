import { ref } from 'vue'
import type { Editor } from '@milkdown/core'
import { createEditor, type EditorInstance } from '@/milkdown/setup'

// Module-level shared state so every component (EditorPane, ImageHandler,
// TableToolbar, export) operates on the same editor instance.
const instance = ref<EditorInstance | null>(null)
const isReady = ref(false)

/**
 * Shared Milkdown controller. Returns the singleton editor instance and helpers.
 * Call `mount` once from EditorPane.
 */
export function useMilkdown() {
  async function mount(
    container: HTMLElement,
    defaultValue = '',
    onChange?: (markdown: string) => void,
  ): Promise<void> {
    instance.value = await createEditor(container, defaultValue, { onChange })
    isReady.value = true
    // Opt-in handle so automated probes can drive the editor. Only exposed when the
    // URL carries `?e2e=1`, so it has no effect in normal use or production.
    if (typeof location !== 'undefined' && location.search.includes('e2e=1')) {
      ;(window as unknown as { __typo?: EditorInstance }).__typo = instance.value
    }
  }

  function getMarkdown(): Promise<string> | string {
    return instance.value?.getMarkdown() ?? ''
  }

  function loadMarkdown(md: string): void {
    instance.value?.loadMarkdown(md)
  }

  function getHTML(): Promise<string> | string {
    return instance.value?.getHTML() ?? ''
  }

  function getEditor(): Editor | null {
    return instance.value?.getEditor() ?? null
  }

  function insert(md: string): void {
    instance.value?.insert(md)
  }

  function destroy(): void {
    instance.value?.destroy()
    instance.value = null
    isReady.value = false
  }

  return {
    instance,
    isReady,
    mount,
    getMarkdown,
    loadMarkdown,
    getHTML,
    getEditor,
    insert,
    destroy,
  }
}
