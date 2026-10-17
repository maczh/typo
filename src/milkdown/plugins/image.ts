import type { Editor } from '@milkdown/core'
import { editorViewCtx } from '@milkdown/core'

/**
 * Image helpers. Crepe provides an `image` node; these helpers insert an image
 * (with a document-relative path) at the caret and normalise relative paths.
 */

/** Insert an image at the caret using `src` (relative or absolute) and `alt`. */
export function insertImage(editor: Editor, src: string, alt = ''): void {
  editor.action(ctx => {
    const view = ctx.get(editorViewCtx)
    const type = view.state.schema.nodes.image
    if (type) view.dispatch(view.state.tr.replaceSelectionWith(type.create({ src, alt, title: '' })).scrollIntoView())
  })
}

/** Ensure a relative asset path is dot-prefixed for portability. */
export function toRelativePath(assetRel: string): string {
  if (assetRel.startsWith('.') || assetRel.startsWith('/')) return assetRel
  return `./${assetRel}`
}
