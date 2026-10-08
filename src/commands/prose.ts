import type { Editor } from '@milkdown/core'
import { editorViewCtx } from '@milkdown/core'
import type { EditorView } from '@milkdown/prose/view'
import type { Node as PMNode, NodeType, MarkType } from '@milkdown/prose/model'
import type { EditorState, Transaction } from '@milkdown/prose/state'
import {
  setBlockType,
  toggleMark,
  wrapIn,
  selectAll as pmSelectAll,
  deleteSelection as pmDeleteSelection,
} from '@milkdown/prose/commands'
import { wrapInList, sinkListItem, liftListItem } from '@milkdown/prose/schema-list'
import { undo as pmUndo, redo as pmRedo } from '@milkdown/prose/history'
import { TextSelection } from '@milkdown/prose/state'
import { insert } from '@milkdown/utils'

/**
 * Thin ProseMirror command helpers over the Milkdown editor instance.
 * Node/mark names are looked up defensively (with fallbacks) so these helpers
 * survive minor preset renames across versions.
 */

type PMCommand = (state: EditorState, dispatch?: (tr: Transaction) => void) => boolean

function runWithView(editor: Editor, fn: (view: EditorView) => void): void {
  editor.action((ctx) => {
    fn(ctx.get(editorViewCtx) as EditorView)
  })
}

function runCmd(editor: Editor, cmd: PMCommand): boolean {
  let ok = false
  runWithView(editor, (view) => {
    ok = cmd(view.state, view.dispatch)
  })
  return ok
}

function nodeType(schema: EditorState['schema'], ...names: string[]): NodeType | null {
  for (const n of names) {
    const t = schema.nodes[n]
    if (t) return t
  }
  return null
}

function markType(schema: EditorState['schema'], ...names: string[]): MarkType | null {
  for (const n of names) {
    const t = schema.marks[n]
    if (t) return t
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Block commands                                                      */
/* ------------------------------------------------------------------ */

export function setHeading(editor: Editor, level: number): void {
  runWithView(editor, (view) => {
    const h = nodeType(view.state.schema, 'heading')
    if (!h) return
    setBlockType(h, { level })(view.state, view.dispatch)
  })
}

export function setParagraph(editor: Editor): void {
  runWithView(editor, (view) => {
    const p = nodeType(view.state.schema, 'paragraph')
    if (!p) return
    setBlockType(p)(view.state, view.dispatch)
  })
}

/** Increase (delta > 0) / decrease (delta < 0) the current heading level. */
export function bumpHeading(editor: Editor, delta: number): void {
  runWithView(editor, (view) => {
    const h = nodeType(view.state.schema, 'heading')
    if (!h) return
    const parent = view.state.selection.$from.parent
    const level =
      parent.type.name === 'heading'
        ? Math.min(6, Math.max(1, Number((parent.attrs as { level?: number }).level ?? 1) + delta))
        : delta > 0
          ? 1
          : 6
    setBlockType(h, { level })(view.state, view.dispatch)
  })
}

export function toggleBulletList(editor: Editor): void {
  runWithView(editor, (view) => {
    const t = nodeType(view.state.schema, 'bullet_list')
    if (t) wrapInList(t)(view.state, view.dispatch)
  })
}

export function toggleOrderedList(editor: Editor): void {
  runWithView(editor, (view) => {
    const t = nodeType(view.state.schema, 'ordered_list')
    if (t) wrapInList(t)(view.state, view.dispatch)
  })
}

export function toggleTaskList(editor: Editor): void {
  // GFM task list — inserting the marker text at the caret is the most
  // predictable path (the input rule builds the task_list_item node).
  editor.action(insert('- [ ] '))
}

export function toggleBlockquote(editor: Editor): void {
  runWithView(editor, (view) => {
    const t = nodeType(view.state.schema, 'blockquote')
    if (t) wrapIn(t)(view.state, view.dispatch)
  })
}

export function setCodeBlock(editor: Editor): void {
  runWithView(editor, (view) => {
    const t = nodeType(view.state.schema, 'code_block', 'fence')
    if (t) setBlockType(t)(view.state, view.dispatch)
  })
}

export function sinkIndent(editor: Editor): void {
  runWithView(editor, (view) => {
    const item = nodeType(view.state.schema, 'list_item', 'task_list_item')
    if (item) sinkListItem(item)(view.state, view.dispatch)
  })
}

export function liftIndent(editor: Editor): void {
  runWithView(editor, (view) => {
    const item = nodeType(view.state.schema, 'list_item', 'task_list_item')
    if (item) liftListItem(item)(view.state, view.dispatch)
  })
}

function insertEmptyParagraph(editor: Editor, at: (sel: EditorState['selection']) => number): void {
  runWithView(editor, (view) => {
    const { state, dispatch } = view
    const p = nodeType(state.schema, 'paragraph')
    if (!p) return
    const pos = at(state.selection)
    const tr = state.tr.insert(pos, p.create() as PMNode)
    dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(pos), 1)))
  })
}

export function insertParagraphAbove(editor: Editor): void {
  insertEmptyParagraph(editor, (sel) => sel.$from.before(1))
}

export function insertParagraphBelow(editor: Editor): void {
  insertEmptyParagraph(editor, (sel) => sel.$to.after(1))
}

export function insertHardBreak(editor: Editor): void {
  runWithView(editor, (view) => {
    const hb = nodeType(view.state.schema, 'hardbreak', 'hard_break', 'br')
    if (hb) {
      const tr = view.state.tr.replaceSelectionWith(hb.create() as PMNode)
      view.dispatch(tr)
    }
  })
}

/* ------------------------------------------------------------------ */
/* Mark (inline style) commands                                        */
/* ------------------------------------------------------------------ */

export function toggleMarkBy(editor: Editor, ...names: string[]): boolean {
  let ok = false
  runWithView(editor, (view) => {
    const mt = markType(view.state.schema, ...names)
    if (!mt) return
    toggleMark(mt)(view.state, view.dispatch)
    ok = true
  })
  return ok
}

export function toggleBold(editor: Editor): boolean {
  return toggleMarkBy(editor, 'strong', 'bold')
}

export function toggleItalic(editor: Editor): boolean {
  return toggleMarkBy(editor, 'emphasis', 'em', 'italic')
}

export function toggleInlineCode(editor: Editor): boolean {
  return toggleMarkBy(editor, 'code_inline', 'code')
}

export function toggleStrike(editor: Editor): boolean {
  return toggleMarkBy(editor, 'strike_through', 'strikethrough', 'strike')
}

/** Milkdown's default schema has no underline mark — callers show a hint. */
export function toggleUnderline(_editor: Editor): boolean {
  return false
}

export function clearFormatting(editor: Editor): void {
  runWithView(editor, (view) => {
    const { state, dispatch } = view
    const { from, to, empty } = state.selection
    const sel = empty ? { from: 0, to: state.doc.content.size } : { from, to }
    const tr = state.tr
    for (const m of Object.values(state.schema.marks)) {
      tr.removeMark(sel.from, sel.to, m)
    }
    const p = nodeType(state.schema, 'paragraph')
    if (p) tr.setBlockType(sel.from, sel.to, p)
    dispatch(tr)
  })
}

/* ------------------------------------------------------------------ */
/* Insert helpers (markdown-based)                                     */
/* ------------------------------------------------------------------ */

export function insertHorizontalRule(editor: Editor): void {
  editor.action(insert('\n---\n\n'))
}

export function insertLink(editor: Editor, text = '链接文本', url = 'https://'): void {
  editor.action(insert(`[${text}](${url})`))
}

export function insertFootnote(editor: Editor): void {
  editor.action(insert('[^1]'))
}

export function insertLinkReference(editor: Editor): void {
  editor.action(insert('\n[ref]: https://\n'))
}

export function insertComment(editor: Editor): void {
  editor.action(insert('\n<!-- 注释内容 -->\n'))
}

export function insertToc(editor: Editor): void {
  editor.action(insert('\n[toc]\n\n'))
}

export function insertYamlFrontMatter(editor: Editor): void {
  editor.action(insert('---\ntitle: Untitled\ndate: \n---\n\n'))
}

/* ------------------------------------------------------------------ */
/* History / selection                                                 */
/* ------------------------------------------------------------------ */

export function undo(editor: Editor): boolean {
  return runCmd(editor, pmUndo as PMCommand)
}

export function redo(editor: Editor): boolean {
  return runCmd(editor, pmRedo as PMCommand)
}

export function selectAll(editor: Editor): boolean {
  return runCmd(editor, pmSelectAll as PMCommand)
}

export function deleteSelection(editor: Editor): boolean {
  return runCmd(editor, pmDeleteSelection as PMCommand)
}

/* ------------------------------------------------------------------ */
/* Introspection (menu checkmarks)                                     */
/* ------------------------------------------------------------------ */

export interface BlockInfo {
  type: string
  level?: number
}

export function getBlockInfo(editor: Editor | null): BlockInfo | null {
  if (!editor) return null
  let info: BlockInfo | null = null
  runWithView(editor, (view) => {
    const parent = view.state.selection.$from.parent
    const attrs = parent.attrs as { level?: number }
    info = { type: parent.type.name, level: attrs.level }
  })
  return info
}

export function isMarkActive(editor: Editor | null, ...names: string[]): boolean {
  if (!editor) return false
  let active = false
  runWithView(editor, (view) => {
    const mt = markType(view.state.schema, ...names)
    if (!mt) return
    const state = view.state
    if (state.selection.empty) {
      active = (state.storedMarks ?? []).some((m) => m.type === mt)
    } else {
      active = state.doc.rangeHasMark(state.selection.from, state.selection.to, mt)
    }
  })
  return active
}

export function isNodeActive(
  editor: Editor | null,
  name: string,
  attrs?: Record<string, unknown>,
): boolean {
  if (!editor) return false
  let active = false
  runWithView(editor, (view) => {
    const $from = view.state.selection.$from
    let depth = $from.depth
    while (depth > 0) {
      const node = $from.node(depth)
      if (node.type.name === name) {
        active = attrs
          ? Object.entries(attrs).every(([k, v]) => (node.attrs as Record<string, unknown>)[k] === v)
          : true
        return
      }
      depth--
    }
  })
  return active
}
