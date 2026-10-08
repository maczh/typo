import type { Editor } from '@milkdown/core'
import { insert } from '@milkdown/utils'
import {
  addRowAfter,
  addRowBefore,
  deleteRow,
  addColumnAfter,
  deleteColumn,
} from '@milkdown/prose/tables'
import { editorViewCtx } from '@milkdown/core'

/**
 * Table helpers. Crepe (GFM) already provides editable tables; these helpers
 * insert a starter table and run ProseMirror table-editing commands (add/remove
 * row & column) on the current selection — used by TableToolbar.vue.
 */

/** Insert a 3x2 starter table at the caret. */
export function insertTable(editor: Editor): void {
  const md = [
    '',
    '| Column 1 | Column 2 | Column 3 |',
    '| --- | --- | --- |',
    '| Cell | Cell | Cell |',
    '| Cell | Cell | Cell |',
    '',
  ].join('\n')
  editor.action(insert(md))
}

function runTableCommand(
  editor: Editor,
  cmd: (state: unknown, dispatch?: (tr: unknown) => void) => boolean,
): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx) as unknown as {
      state: unknown
      dispatch: (tr: unknown) => void
    }
    cmd(view.state, view.dispatch)
  })
}

export function addRow(editor: Editor, after = true): void {
  runTableCommand(editor, after ? (addRowAfter as never) : (addRowBefore as never))
}

export function removeRow(editor: Editor): void {
  runTableCommand(editor, deleteRow as never)
}

export function addColumn(editor: Editor): void {
  runTableCommand(editor, addColumnAfter as never)
}

export function removeColumn(editor: Editor): void {
  runTableCommand(editor, deleteColumn as never)
}
