import { Crepe } from '@milkdown/crepe'
import type { Editor } from '@milkdown/core'
import { insert, getHTML as getHTMLCommand } from '@milkdown/utils'
import { oneDark } from '@codemirror/theme-one-dark'
import { i18n } from '@/i18n'
import { mermaidDiagramPlugin } from './plugins/mermaid'
import { markdownMarkerPlugin } from './plugins/markdownMarker'

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

function isDarkTheme(): boolean {
  return (document.documentElement.getAttribute('data-theme') || '').includes('dark')
}

/**
 * Crepe's code block defaults to the **oneDark** CodeMirror theme, which is wrong
 * for a light page (washed-out syntax colors, a dark active-line gutter on a light
 * surface). Pick the CodeMirror theme that matches the app theme instead, and
 * localise the widgets Crepe injects into every code block.
 */
function crepeConfig(root: HTMLElement, defaultValue: string) {
  const t = (key: string): string => i18n.global.t(key)
  return {
    root,
    defaultValue,
    featureConfigs: {
      'code-mirror': {
        theme: isDarkTheme() ? oneDark : [],
        copyText: t('editor.codeCopy'),
        searchPlaceholder: t('editor.codeSearchLanguage'),
        noResultText: t('editor.codeNoResult'),
        previewToggleText: (previewOnlyMode: boolean) =>
          previewOnlyMode ? t('editor.codePreviewEdit') : t('editor.codePreviewHide'),
      },
    },
  }
}

/**
 * Create a WYSIWYG editor backed by `@milkdown/crepe` (which bundles KaTeX math,
 * highlight.js, GFM tables and images with full markdown round-trip), plus a
 * custom Mermaid diagram plugin (Crepe ships no Mermaid feature of its own).
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
    const instance = new Crepe(crepeConfig(root, initial))
    // Registered after Crepe's own features so the diagram decorations win.
    instance.addFeature<void>((editor) => {
      editor.use(mermaidDiagramPlugin)
      editor.use(markdownMarkerPlugin)
    })
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
