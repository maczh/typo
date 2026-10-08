import { Crepe } from '@milkdown/crepe'
import type { Editor } from '@milkdown/core'
import { insert, getHTML as getHTMLCommand } from '@milkdown/utils'

/** A thin, stable wrapper around a Crepe editor instance. */
export interface EditorInstance {
  getMarkdown: () => Promise<string> | string
  getHTML: () => Promise<string> | string
  loadMarkdown: (markdown: string) => void
  destroy: () => void
  insert: (markdown: string) => void
  getEditor: () => Editor | null
  focus: () => void
}

export interface CreateOptions {
  onChange?: (markdown: string) => void
}

/** Access the underlying Milkdown `Editor` (Crepe exposes it as `editor`). */
function getCoreEditor(crepe: Crepe | null): Editor | null {
  if (!crepe) return null
  return (crepe as unknown as { editor?: Editor }).editor ?? null
}

/**
 * Create a WYSIWYG editor backed by `@milkdown/crepe` (which bundles KaTeX math,
 * Mermaid, highlight.js, GFM tables and images with full markdown round-trip).
 *
 * `loadMarkdown` recreates the instance so the new content is loaded cleanly
 * without fighting the existing ProseMirror history.
 */
export async function createEditor(
  root: HTMLElement,
  defaultValue: string,
  options: CreateOptions = {},
): Promise<EditorInstance> {
  let crepe: Crepe | null = null
  let loading = false

  const attach = (instance: Crepe) => {
    instance.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        if (loading) return
        options.onChange?.(markdown)
      })
    })
  }

  const spawn = (initial: string): Crepe => {
    const instance = new Crepe({ root, defaultValue: initial })
    attach(instance)
    return instance
  }

  crepe = spawn(defaultValue)
  loading = true
  await (crepe as unknown as { create: () => Promise<void> }).create()
  loading = false

  const getMarkdown = (): Promise<string> | string =>
    crepe ? (crepe as unknown as { getMarkdown: () => Promise<string> }).getMarkdown() : ''
  const getHTML = (): Promise<string> | string =>
    crepe ? (crepe.editor.action(getHTMLCommand()) as string) : ''
  const insertMarkdown = (markdown: string) => {
    const editor = getCoreEditor(crepe)
    if (!editor) return
    editor.action(insert(markdown))
  }
  const loadMarkdown = (markdown: string) => {
    if (!crepe) return
    void (crepe as unknown as { destroy: () => void }).destroy()
    crepe = spawn(markdown)
    loading = true
    void (crepe as unknown as { create: () => Promise<void> })
      .create()
      .then(() => {
        loading = false
      })
  }
  const destroy = () => {
    ;(crepe as unknown as { destroy: () => void } | null)?.destroy()
    crepe = null
  }
  const focus = () => {
    root.focus()
  }
  const getEditor = (): Editor | null => getCoreEditor(crepe)

  return {
    getMarkdown,
    getHTML,
    loadMarkdown,
    destroy,
    insert: insertMarkdown,
    getEditor,
    focus,
  }
}
