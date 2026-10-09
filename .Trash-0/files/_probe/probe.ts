/**
 * jsdom probe: exercises the real Crepe/ProseMirror schema through
 * `src/commands/prose.ts` so menu behaviour can be verified without a browser.
 *
 * Bundled with esbuild and driven by `run.mjs`.
 */
import { Crepe } from '@milkdown/crepe'
import { editorViewCtx, type Editor } from '@milkdown/core'
import type { EditorView } from '@milkdown/prose/view'
import * as prose from '../src/commands/prose'

const DOC = [
  '# Heading one',
  '',
  'Hello **world** and *friends*, plus ~~struck~~ text.',
  '',
  '- alpha',
  '- beta',
  '',
  'Second paragraph.',
].join('\n')

type Out = Record<string, unknown>

function view(editor: Editor): EditorView {
  let v: EditorView | null = null
  editor.action((ctx) => {
    v = ctx.get(editorViewCtx) as EditorView
  })
  if (!v) throw new Error('editor view unavailable')
  return v
}

function docText(editor: Editor): string {
  const state = view(editor).state
  return state.doc.textBetween(0, state.doc.content.size, '\n')
}

function findText(editor: Editor, needle: string): [number, number] {
  let from = -1
  let to = -1
  view(editor).state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const i = node.text.indexOf(needle)
    if (i >= 0 && from < 0) {
      from = pos + i
      to = pos + i + needle.length
    }
  })
  return [from, to]
}

function blockTypes(editor: Editor): string[] {
  const doc = view(editor).state.doc
  const types: string[] = []
  for (let i = 0; i < doc.childCount; i += 1) types.push(doc.child(i).type.name)
  return types
}

export async function run(): Promise<Out> {
  const out: Out = {}
  const root = document.createElement('div')
  document.body.appendChild(root)

  const crepe = new Crepe({ root, defaultValue: DOC })
  await (crepe as unknown as { create: () => Promise<void> }).create()
  const editor = (crepe as unknown as { editor: Editor }).editor

  const call = <T>(fn: () => T, key: string): T | string => {
    try {
      return fn()
    } catch (e) {
      out[`${key}__error`] = String(e)
      return `<threw>`
    }
  }

  /* A. schema ------------------------------------------------------------- */
  const marks = Object.keys(view(editor).state.schema.marks)
  out.marks = marks
  out.hasStrikeMark = marks.includes('strike_through')
  out.docOk = docText(editor).includes('Hello world and friends')

  /* B. strike on a real selection (the `S̶` button) ------------------------- */
  const [wFrom, wTo] = findText(editor, 'world')
  out.rangeWorld = [wFrom, wTo]
  prose.setSelectionRange(editor, wFrom, wTo)
  out.selectionAfterRestore = prose.getSelectionRange(editor)
  out.toggleStrikeReturned = call(() => prose.toggleStrike(editor), 'toggleStrike')
  out.strikeIsActive = call(() => prose.isMarkActive(editor, 'strike_through', 'strikethrough', 'strike'), 'strikeActive')

  /* C. getSelectionText (the copy/cut source) ------------------------------ */
  prose.setSelectionRange(editor, wFrom, wTo)
  out.selectionText = call(() => prose.getSelectionText(editor), 'getSelectionText')
  out.selectionTextEmptyWhenCollapsed = call(() => {
    prose.setCaret(editor, wFrom)
    return prose.getSelectionText(editor)
  }, 'getSelectionTextCollapsed')

  /* D. clearFormatting with a collapsed caret inside a heading ------------- */
  // (the old code collapsed `from/to` to the whole document here, which made
  //  `Transaction.setBlockType` throw and the button appear dead)
  prose.setCaret(editor, 3)
  out.blockBeforeClear = call(() => prose.getBlockInfo(editor), 'blockBefore')
  call(() => prose.clearFormatting(editor), 'clearCollapsed')
  out.blockAfterClear = call(() => prose.getBlockInfo(editor), 'blockAfter')

  /* E. clearFormatting again, collapsed, on the now-multi-block doc -------- */
  call(() => {
    prose.setCaret(editor, 3)
    prose.clearFormatting(editor)
  }, 'clearCollapsed2')

  /* F. clearFormatting with a selection removes marks ---------------------- */
  out.clearedStrong = call(() => {
    const [a, b] = findText(editor, 'world')
    prose.setSelectionRange(editor, a, b)
    prose.clearFormatting(editor)
    return prose.isMarkActive(editor, 'strong', 'bold')
  }, 'clearSelection')

  /* G. insertPlainText keeps Markdown literal ----------------------------- */
  out.plainInsert = call(() => {
    const size = view(editor).state.doc.content.size
    prose.setSelectionRange(editor, size - 2, size - 2)
    prose.insertPlainText(editor, '**literal**\nsecond line')
    const text = docText(editor)
    return {
      literal: text.includes('**literal**'),
      multiLine: text.includes('**literal**\nsecond line'),
    }
  }, 'insertPlainText')

  /* H. deleteBlock -------------------------------------------------------- */
  out.blocksBefore = blockTypes(editor)
  out.deleteBlockReturned = call(() => {
    prose.setCaret(editor, 3)
    return prose.deleteBlock(editor)
  }, 'deleteBlock')
  out.blocksAfter = blockTypes(editor)

  ;(crepe as unknown as { destroy: () => void }).destroy()
  return out
}
