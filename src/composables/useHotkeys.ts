import { onMounted, onBeforeUnmount } from 'vue'
import * as A from '@/commands/actions'
import { useUI } from '@/composables/useUI'

/**
 * Global Typora-style hotkey layer.
 *
 * Design notes:
 * - `metaKey` is treated as `ctrlKey` so the same bindings work on macOS.
 * - Keys the ProseMirror editor already owns natively (Ctrl/Cmd+B/I, Z/Y, A)
 *   are intentionally NOT rebound here to avoid double-toggling; the editor
 *   handles them, and the toolbar/menu provide click access.
 * - `global` bindings (save, source toggle, find, quick open, command palette)
 *   also fire while typing in inputs/textareas; everything else is suppressed
 *   when a field is focused so it only acts inside the editor.
 * - When any modal dialog is open, only Ctrl/Cmd+S is allowed (dialogs own their
 *   own keyboard handling).
 */

interface Binding {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  key: string
  global?: boolean
  run: () => void
}

const bindings: Binding[] = [
  // File
  { ctrl: true, key: 'n', global: true, run: A.newFile },
  { ctrl: true, key: 'o', global: true, run: A.openFileDialog },
  { ctrl: true, shift: true, key: 'o', global: true, run: A.openFolderDialog },
  { ctrl: true, key: 's', global: true, run: A.saveFile },
  { ctrl: true, shift: true, key: 's', global: true, run: A.saveFileAs },
  { ctrl: true, key: 'p', global: true, run: A.quickOpen },
  { ctrl: true, shift: true, key: 'p', global: true, run: A.openCommandPalette },
  { ctrl: true, key: ',', global: true, run: A.openPreferences },
  { ctrl: true, key: 'w', global: true, run: A.closeWindow },

  // Source mode + find/replace (always available)
  { ctrl: true, key: '/', global: true, run: A.toggleSourceMode },
  { ctrl: true, key: 'f', global: true, run: A.openFind },
  { ctrl: true, key: 'h', global: true, run: A.openFind },

  // Paragraph
  { ctrl: true, key: '0', run: A.setParagraph },
  { ctrl: true, key: '1', run: () => A.setHeading(1) },
  { ctrl: true, key: '2', run: () => A.setHeading(2) },
  { ctrl: true, key: '3', run: () => A.setHeading(3) },
  { ctrl: true, key: '4', run: () => A.setHeading(4) },
  { ctrl: true, key: '5', run: () => A.setHeading(5) },
  { ctrl: true, key: '6', run: () => A.setHeading(6) },
  { ctrl: true, key: '=', run: A.increaseHeadingLevel },
  { ctrl: true, shift: true, key: '=', run: A.increaseHeadingLevel },
  { ctrl: true, key: '-', run: A.decreaseHeadingLevel },
  { ctrl: true, shift: true, key: '-', run: A.decreaseHeadingLevel },
  { ctrl: true, key: 't', run: A.insertTable },
  { ctrl: true, shift: true, key: 'k', run: A.insertCodeBlock },
  { ctrl: true, shift: true, key: 'm', run: A.insertMathBlock },
  { ctrl: true, shift: true, key: 'q', run: A.insertBlockquote },
  { ctrl: true, shift: true, key: '[', run: A.insertOrderedList },
  { ctrl: true, shift: true, key: ']', run: A.insertUnorderedList },
  { ctrl: true, shift: true, key: 'x', run: A.insertTaskList },
  { ctrl: true, shift: true, key: 'i', run: A.insertLocalImage },

  // Format
  { ctrl: true, key: 'k', run: A.insertHyperlink },
  { alt: true, shift: true, key: '5', run: A.toggleStrike },
  { ctrl: true, shift: true, key: '`', run: A.toggleInlineCode },
  { ctrl: true, key: 'u', run: A.toggleUnderline },
  { ctrl: true, key: '\\', run: A.clearStyle },
  { ctrl: true, shift: true, key: 'c', run: A.copyAsMarkdown },
  { ctrl: true, shift: true, key: 'v', run: A.pasteAsPlainText },

  // View
  { ctrl: true, shift: true, key: 'l', run: A.toggleSidebar },
  { ctrl: true, shift: true, key: '1', run: A.showOutlinePanel },
  { ctrl: true, shift: true, key: '3', run: A.showFileTreePanel },
  { key: 'f8', run: A.toggleFocusMode },
  { key: 'f9', run: A.toggleTypewriterMode },
  { key: 'f11', run: A.toggleFullscreen },
  { ctrl: true, shift: true, key: '0', run: A.zoomActualSize },
  { ctrl: true, shift: true, key: '+', run: A.zoomIn },
  { ctrl: true, shift: true, key: '=', run: A.zoomIn },
  { ctrl: true, shift: true, key: '-', run: A.zoomOut },
]

/**
 * True when the event originates from a plain form field, or a contentEditable
 * that is NOT the editor surface.
 *
 * The Milkdown/ProseMirror editing surface is itself `contentEditable`, so it
 * must be treated as *the editor* rather than as a field. Otherwise every
 * paragraph / format hotkey (Ctrl+1..6, Ctrl+0, ...) would be suppressed the
 * moment the user types inside the editor — which is exactly where they apply.
 */
function isField(el: EventTarget | null): boolean {
  const e = el as HTMLElement | null
  if (!e) return false
  const tag = e.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (e.isContentEditable) return !e.closest('.milkdown')
  return false
}

export function useHotkeys(): void {
  const ui = useUI()

  function handler(e: KeyboardEvent): void {
    const ctrl = e.ctrlKey || e.metaKey
    const shift = e.shiftKey
    const alt = e.altKey
    const key = e.key.toLowerCase()

    const match = bindings.find(
      (b) =>
        !!b.ctrl === ctrl &&
        !!b.shift === shift &&
        !!b.alt === alt &&
        b.key === key,
    )
    if (!match) return

    const dialogsOpen =
      ui.commandPaletteOpen.value ||
      ui.findOpen.value ||
      ui.quickOpenOpen.value ||
      ui.settingsOpen.value ||
      ui.recoveryOpen.value
    // While a modal dialog is open, only Save is permitted.
    if (dialogsOpen && !(ctrl && key === 's')) return

    // Non-global bindings only act when not typing in a field (i.e. in editor).
    if (!match.global && isField(e.target)) return

    e.preventDefault()
    match.run()
  }

  onMounted(() => window.addEventListener('keydown', handler))
  onBeforeUnmount(() => window.removeEventListener('keydown', handler))
}
