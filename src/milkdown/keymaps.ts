import type { Ctx } from '@milkdown/ctx'
import { blockquoteKeymap, bulletListKeymap, codeBlockKeymap, headingKeymap, orderedListKeymap, paragraphKeymap, emphasisKeymap, inlineCodeKeymap, strongKeymap, listItemKeymap } from '@milkdown/preset-commonmark'
import { strikethroughKeymap, tableKeymap } from '@milkdown/preset-gfm'
import { historyKeymap } from '@milkdown/plugin-history'

function structuralKeys<T extends Record<string, { shortcuts: string | string[] }>>(config: T): T {
  return Object.fromEntries(Object.entries(config).map(([id, value]) => [id, {
    ...value,
    shortcuts: [value.shortcuts].flat().filter(key => !/(?:Mod|Ctrl|Meta|Alt)-/.test(key)),
  }])) as T
}

/** Application shortcuts have one owner; retain editor navigation keys such as Tab. */
export function configureEditorKeymaps(ctx: Ctx): void {
  ctx.update(blockquoteKeymap.key, structuralKeys)
  ctx.update(bulletListKeymap.key, structuralKeys)
  ctx.update(codeBlockKeymap.key, structuralKeys)
  ctx.update(headingKeymap.key, structuralKeys)
  ctx.update(orderedListKeymap.key, structuralKeys)
  ctx.update(paragraphKeymap.key, structuralKeys)
  ctx.update(emphasisKeymap.key, structuralKeys)
  ctx.update(inlineCodeKeymap.key, structuralKeys)
  ctx.update(strongKeymap.key, structuralKeys)
  ctx.update(listItemKeymap.key, structuralKeys)
  ctx.update(strikethroughKeymap.key, structuralKeys)
  ctx.update(tableKeymap.key, structuralKeys)
  ctx.update(historyKeymap.key, structuralKeys)
}
