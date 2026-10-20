import { configureEditorKeymaps } from './keymaps'
import { Crepe } from '@milkdown/crepe'
import type { Editor } from '@milkdown/core'
import { editorViewCtx } from '@milkdown/core'
import type { EditorView } from '@milkdown/prose/view'
import { replaceAll, insert, getHTML as getHTMLCommand } from '@milkdown/utils'
import { oneDark } from '@codemirror/theme-one-dark'
import { i18n } from '@/i18n'
import { mermaidDiagramPlugin } from './plugins/mermaid'
import { markdownMarkerPlugin } from './plugins/markdownMarker'
import { remarkInlineLinkPlugin } from '@milkdown/preset-commonmark'
import { footnoteReference, footnoteDefinition } from './plugins/footnote'
import { frontMatter, frontMatterRemark } from './plugins/frontMatter'
import { referenceDefinition, referenceLinks } from './plugins/reference'
import { underline, underlineRemark } from './plugins/underline'
import { htmlToMarkdown } from '@/utils/import'
import { persistImageFile } from '@/utils/images'

/** A thin, stable wrapper around a Crepe editor instance. */
export interface EditorInstance {
  getMarkdown: () => Promise<string> | string
  getHTML: () => Promise<string> | string
  loadMarkdown: (markdown: string, resetHistory?: boolean) => void
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
 * Whether the active theme is a dark theme. The data-theme attribute is now a
 * stable id (`github`, `gothic`, `night`, …) whose name no longer encodes
 * "dark", so we consult the theme definitions' `kind` instead — matching what
 * the Settings/Theme menu uses, so code-block highlighting (oneDark) stays in
 * sync with the chosen theme.
 */
function isDarkTheme(): boolean {
  const id = document.documentElement.getAttribute('data-theme') || ''
  const def = themeKindMap[id]
  if (def) return def === 'dark'
  // Fallback: no registered theme (e.g. before the store loads) — infer from id.
  return id.includes('dark')
}

// Small lookup so isDarkTheme doesn't have to import the Pinia store (which would
// create a circular dependency during editor boot). Kept in sync with
// stores/settings.ts's theme list.
const themeKindMap: Record<string, 'light' | 'dark'> = {
  github: 'light',
  gothic: 'dark',
  newsprint: 'light',
  night: 'dark',
  pixyll: 'light',
  whitey: 'light',
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
      'image-block': {
        // Persist pasted / dropped / uploaded image files to `<docDir>/assets` and
        // insert an absolute `asset://` URL. Without an `onUpload`, Crepe falls
        // back to `URL.createObjectURL(file)` — a `blob:` URL that cannot be read
        // back when saving (blocked by CSP) and is dead after a reload.
        onUpload: async (file: File): Promise<string> => {
          let docPath: string | null = null
          try {
            // Dynamic import keeps this store out of the editor's boot graph
            // (a static import would create a module-init cycle during mount).
            const { useEditorStore } = await import('@/stores/editor')
            docPath = useEditorStore().doc.path
          } catch {
            docPath = null
          }
          return persistImageFile(file, docPath)
        },
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
  let loadedMarkdown: string | null = null

  const attach = (instance: Crepe) => {
    instance.on((api) => {
      api.markdownUpdated((_ctx, markdown) => {
        if (loading || markdown === loadedMarkdown) return
        loadedMarkdown = null
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
      // Real `underline` mark + its `<u>…</u>` markdown round-trip.
      editor.remove(remarkInlineLinkPlugin)
      editor.use(footnoteReference)
      editor.use(footnoteDefinition)
      editor.use(frontMatter)
      editor.use(frontMatterRemark)
      editor.use(referenceDefinition)
      editor.use(referenceLinks)
      editor.use(underline)
      editor.use(underlineRemark)
    })
    instance.editor.config(configureEditorKeymaps)
    attach(instance)
    return instance
  }

  crepe = spawn(defaultValue)
  loading = true
  await (crepe as unknown as { create: () => Promise<void> }).create()
  loading = false
  loadedMarkdown = crepe.getMarkdown()

  // Paste with HTML flavour → Markdown. Captured on the container (ancestor of
  // the editable) in the *capture* phase so it runs before ProseMirror's own
  // paste handler, letting us replace the default rich-HTML insertion with a
  // Markdown round-trip. Plain-text paste is left untouched.
  const handlePaste = (e: ClipboardEvent) => {
      const dt = e.clipboardData
      if (!dt) return
      const html = dt.getData('text/html')
      if (!html || !html.trim()) return // plain text — let the default happen
      const editor = getCoreEditor(crepe)
      if (!editor) return
      // Inside a code block the user wants literal text, not Markdown — bail.
      let inCode = false
      editor.action((ctx) => {
        const view = ctx.get(editorViewCtx) as EditorView
        const parent = view.state.selection.$from.parent
        inCode = parent.type.name === 'code_block' || parent.type.name === 'fence'
      })
      if (inCode) return
      e.preventDefault()
      // Stop the event before it reaches the editable element so ProseMirror's
      // own paste handler (which would insert the raw HTML) never runs — without
      // this the converted Markdown would be inserted *and* the original HTML.
      e.stopPropagation()
      const md = htmlToMarkdown(html)
      if (!md) {
        // Conversion produced nothing useful — fall back to plain text.
        const text = dt.getData('text/plain')
        if (text) editor.action(insert(text))
        return
      }
      editor.action(insert(md))
    }
  root.addEventListener('paste', handlePaste, true)

  const getMarkdown = (): Promise<string> | string =>
    crepe ? (crepe as unknown as { getMarkdown: () => Promise<string> }).getMarkdown() : ''
  const getHTML = (): Promise<string> | string =>
    crepe ? (crepe.editor.action(getHTMLCommand()) as string) : ''
  const insertMarkdown = (markdown: string) => {
    const editor = getCoreEditor(crepe)
    if (!editor) return
    editor.action(insert(markdown))
  }
  const loadMarkdown = (markdown: string, resetHistory = true) => {
    if (!crepe) return
    const editor = getCoreEditor(crepe)
    if (!editor) return
    loading = true
    try {
      editor.action(replaceAll(markdown, resetHistory))
      loadedMarkdown = crepe.getMarkdown()
    } catch (error) {
      // A document switch can overlap with Crepe's own pending transaction
      // (notably when source mode is toggled at the same time). ProseMirror
      // rejects that transaction; retrying on the next turn lets the pending
      // update settle without losing the requested document.
      if (error instanceof Error && /mismatched transaction/i.test(error.message)) {
        setTimeout(() => loadMarkdown(markdown, resetHistory), 0)
        return
      }
      throw error
    } finally {
      loading = false
    }
  }
  const destroy = () => {
    root.removeEventListener('paste', handlePaste, true)
    ;(crepe as unknown as { destroy: () => void } | null)?.destroy()
    crepe = null
  }
  const focus = () => {
    getCoreEditor(crepe)?.action(ctx => ctx.get(editorViewCtx).focus())
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
