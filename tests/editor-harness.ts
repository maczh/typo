import { editorViewCtx } from '@milkdown/core'
import { useMilkdown } from '../src/composables/useMilkdown'

/** Vite resolves this import through the same Milkdown instance as the app. */
export function editorSnapshot() {
  return useMilkdown().getEditor()?.action(ctx => ctx.get(editorViewCtx).state.doc.toJSON())
}
