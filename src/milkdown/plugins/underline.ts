import { $mark, $remark } from '@milkdown/utils'
import type { MarkSchema, RemarkPluginRaw } from '@milkdown/transformer'

/** Underline round-trips as HTML while retaining nested Markdown marks. */
export const underline = $mark('underline', () =>
  ({
    parseDOM: [
      { tag: 'u' },
      {
        style: 'text-decoration',
        getAttrs: (value) => (value === 'underline' ? {} : false),
      },
    ],
    toDOM: () => ['u', { class: 'milkdown-underline' }, 0],
    parseMarkdown: {
      match: (node) => node.type === 'underline',
      runner: (state, node, markType) => {
        state.openMark(markType)
        state.next(node.children)
        state.closeMark(markType)
      },
    },
    toMarkdown: {
      match: (mark) => mark.type.name === 'underline',
      runner: (state, mark) => {
        state.withMark(mark, 'underline')
      },
    },
  }) as MarkSchema,
)

/** Morph `<u>…</u>` raw-HTML inline pairs into `underline` mdast nodes on load. */
export const underlineRemark = $remark(
  'underlineMorph',
  () =>
    (function (this: { data: () => Record<string, unknown> }) {
      const data = this.data()
      const extensions = (data.toMarkdownExtensions ??= []) as unknown[]
      extensions.push({ handlers: {
        underline: (node: unknown, _parent: unknown, state: { containerPhrasing: (node: unknown, info: unknown) => string }, info: unknown) => `<u>${state.containerPhrasing(node, info)}</u>`,
      } })
      return (tree: unknown) => {
      const root = tree as { children?: unknown[] }
      const walk = (nodes: unknown[]): void => {
        if (!Array.isArray(nodes)) return
        for (const child of nodes) {
          const c = child as { children?: unknown[] }
          if (c && Array.isArray(c.children)) walk(c.children)
        }
        let i = 0
        while (i < nodes.length) {
          const n = nodes[i] as { type?: string; value?: unknown }
          if (n && n.type === 'html' && String(n.value).trim() === '<u>') {
            const content: unknown[] = []
            let j = i + 1
            while (j < nodes.length) {
              const m = nodes[j] as { type?: string; value?: unknown }
              if (m && m.type === 'html' && String(m.value).trim() === '</u>') break
              content.push(nodes[j])
              j += 1
            }
            if (j < nodes.length) {
              nodes.splice(i, j - i + 1, { type: 'underline', children: content })
              i += 1
            } else {
              i += 1
            }
          } else {
            i += 1
          }
        }
      }
      if (root && Array.isArray(root.children)) walk(root.children)
      }
    }) as unknown as RemarkPluginRaw<Record<string, unknown>>,
)
