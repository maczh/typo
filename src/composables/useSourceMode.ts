import { computed } from 'vue'
import { useMilkdown } from '@/composables/useMilkdown'
import { useEditorStore } from '@/stores/editor'
import { useUI } from '@/composables/useUI'
import { buildOutlineFromMarkdown } from '@/utils/outline'

/**
 * Drives the "source code mode" (Ctrl+/) toggle. When entering source mode we
 * snapshot the live Markdown; when leaving we push the edited text back into the
 * editor and refresh the document store + outline.
 */
export function useSourceMode() {
  const milkdown = useMilkdown()
  const editor = useEditorStore()
  const ui = useUI()
  const sourceText = computed({
    get: () => editor.doc.content,
    set: (md: string) => {
      editor.updateContent(md)
      editor.setOutline(buildOutlineFromMarkdown(md))
    },
  })

  async function enter(): Promise<void> {
    const session = editor.loadSignal
    const content = editor.doc.content
    const md = await milkdown.getMarkdown()
    if (session === editor.loadSignal && ui.sourceMode.value && editor.doc.content === content && typeof md === 'string') {
      const wasDirty = editor.doc.dirty
      editor.updateContent(md)
      if (!wasDirty) editor.markSaved(md)
    }
  }

  async function commit(): Promise<void> {
    const md = sourceText.value
    editor.setOutline(buildOutlineFromMarkdown(md))
    await milkdown.loadMarkdown(md, false)
  }

  return { sourceText, enter, commit }
}
