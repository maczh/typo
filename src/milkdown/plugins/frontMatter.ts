import { $node, $remark } from '@milkdown/utils'
import type { RemarkPluginRaw } from '@milkdown/transformer'

export const frontMatter = $node('front_matter', () => ({
  group: 'block',
  atom: true,
  attrs: { value: { default: '' } },
  toDOM: node => ['pre', { 'data-front-matter': node.attrs.value }, `---\n${node.attrs.value}\n---`],
  parseDOM: [{ tag: 'pre[data-front-matter]', getAttrs: dom => ({ value: (dom as HTMLElement).dataset.frontMatter || '' }) }],
  parseMarkdown: {
    match: node => node.type === 'frontMatter',
    runner: (state, node, type) => { state.addNode(type, { value: node.value }) },
  },
  toMarkdown: {
    match: node => node.type.name === 'front_matter',
    runner: (state, node) => { state.addNode('html', undefined, `---\n${node.attrs.value}\n---`) },
  },
}))

interface MdNode { type: string; value?: string; position?: { start: { offset?: number } }; children?: MdNode[] }
// Preserve metadata as one block, without interpreting its arbitrary YAML values.
export const frontMatterRemark = $remark('frontMatterPreserve', () => (() => (tree: MdNode, file: { value: unknown }) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(String(file.value))
  if (!match || !tree.children) return
  tree.children = [{ type: 'frontMatter', value: match[1] }, ...tree.children.filter(node => (node.position?.start.offset ?? 0) >= match[0].length)]
}) as unknown as RemarkPluginRaw<Record<string, unknown>>)
