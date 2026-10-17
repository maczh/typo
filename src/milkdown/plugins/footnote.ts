import { $node } from '@milkdown/utils'

export const footnoteReference = $node('footnote_reference', () => ({
  group: 'inline', inline: true, atom: true,
  attrs: { identifier: { default: '1' } },
  toDOM: node => ['sup', { 'data-footnote-reference': node.attrs.identifier }, `[^${node.attrs.identifier}]`],
  parseDOM: [{ tag: 'sup[data-footnote-reference]', getAttrs: dom => ({ identifier: (dom as HTMLElement).dataset.footnoteReference }) }],
  parseMarkdown: {
    match: node => node.type === 'footnoteReference',
    runner: (state, node, type) => { state.addNode(type, { identifier: node.identifier }) },
  },
  toMarkdown: {
    match: node => node.type.name === 'footnote_reference',
    runner: (state, node) => { state.addNode('footnoteReference', undefined, undefined, { identifier: node.attrs.identifier, label: node.attrs.identifier }) },
  },
}))

export const footnoteDefinition = $node('footnote_definition', () => ({
  group: 'block', content: 'block+', defining: true,
  attrs: { identifier: { default: '1' } },
  toDOM: node => ['div', { 'data-footnote-definition': node.attrs.identifier }, 0],
  parseDOM: [{ tag: 'div[data-footnote-definition]', getAttrs: dom => ({ identifier: (dom as HTMLElement).dataset.footnoteDefinition }) }],
  parseMarkdown: {
    match: node => node.type === 'footnoteDefinition',
    runner: (state, node, type) => { state.openNode(type, { identifier: node.identifier }); state.next(node.children); state.closeNode() },
  },
  toMarkdown: {
    match: node => node.type.name === 'footnote_definition',
    runner: (state, node) => { state.openNode('footnoteDefinition', undefined, { identifier: node.attrs.identifier, label: node.attrs.identifier }); state.next(node.content); state.closeNode() },
  },
}))
