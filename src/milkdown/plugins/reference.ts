import type { RemarkPluginRaw } from '@milkdown/transformer'
import { $node, $remark } from '@milkdown/utils'

/** Preserve reference definitions that CommonMark otherwise drops from the editor. */
export const referenceDefinition = $node('reference_definition', () => ({
  group: 'block',
  atom: true,
  attrs: { identifier: { default: 'ref' }, url: { default: 'https://' }, title: { default: null } },
  toDOM: (node) => ['div', { 'data-reference-definition': node.attrs.identifier, 'data-url': node.attrs.url, 'data-title': node.attrs.title || '' }, `[${node.attrs.identifier}]: ${node.attrs.url}`],
  parseDOM: [{ tag: 'div[data-reference-definition]', getAttrs: (dom) => ({ identifier: (dom as HTMLElement).dataset.referenceDefinition, url: (dom as HTMLElement).dataset.url, title: (dom as HTMLElement).dataset.title || null }) }],
  parseMarkdown: {
    match: (node) => node.type === 'definition',
    runner: (state, node, type) => { state.addNode(type, { identifier: node.identifier, url: node.url, title: node.title ?? null }) },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'reference_definition',
    runner: (state, node) => { state.addNode('definition', undefined, undefined, { ...node.attrs, label: node.attrs.identifier }) },
  },
}))

interface ReferenceNode {
  type: string
  identifier?: string
  url?: string
  title?: string | null
  alt?: string
  children?: ReferenceNode[]
}

/** Resolve reference uses while retaining their editable definitions. */
export function resolveReferences(tree: ReferenceNode): void {
  const definitions = new Map<string, ReferenceNode>()
  for (const node of tree.children ?? []) {
    if (node.type === 'definition' && node.identifier) definitions.set(node.identifier.toLowerCase(), node)
  }
  function walk(node: ReferenceNode): void {
    if (node.type === 'linkReference' || node.type === 'imageReference') {
      const definition = definitions.get((node.identifier || '').toLowerCase())
      if (definition) {
        node.type = node.type === 'linkReference' ? 'link' : 'image'
        node.url = definition.url
        node.title = definition.title
      }
    }
    node.children?.forEach(walk)
  }
  walk(tree)
}

export const referenceLinks = $remark('preserveReferenceLinks', () => (() => resolveReferences) as unknown as RemarkPluginRaw<Record<string, unknown>>)
