import { useEditorStore } from '@/stores/editor'
import { isTauri } from '@/composables/useTauri'

/** Confirm only the document revision the user actually saw in the prompt. */
export async function confirmDiscard(): Promise<boolean> {
  const editor = useEditorStore()
  if (!editor.doc.dirty) return true
  const session = editor.loadSignal
  const content = editor.doc.content
  const message = `「${editor.doc.name}」有未保存的修改，是否放弃这些修改？`
  const accepted = isTauri()
    ? await (await import('@tauri-apps/plugin-dialog')).confirm(message, { title: '未保存的修改', kind: 'warning' })
    : window.confirm(message)
  return accepted && session === editor.loadSignal && content === editor.doc.content
}
