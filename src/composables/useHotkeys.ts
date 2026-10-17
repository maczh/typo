import { onMounted, onBeforeUnmount } from 'vue'
import * as A from '@/commands/actions'
import { useUI } from '@/composables/useUI'
import { useSettingsStore } from '@/stores/settings'
import type { HotkeySpec } from '@/types'

/**
 * Central hotkey registry — the single source of truth for every command's
 * shortcut. The main menu, the floating (right-click / block-handle) menu and the
 * global key handler all read from here, so the *same* shortcut is displayed
 * everywhere and the *same* binding fires, and users can rebind any command from
 * Settings → Hotkey Management.
 *
 * Design notes:
 * - `metaKey` is treated as `ctrlKey` so the same bindings work on macOS.
 * - Editing commands run in capture phase before the editor keymap.
 * - `global: true` bindings (save, open, find, …) also fire while typing in
 *   inputs/textareas; everything else is suppressed when a field is focused so it
 *   only acts inside the editor.
 * - When any modal dialog is open, only Ctrl/Cmd+S is allowed (dialogs own their
 *   own keyboard handling).
 */

/** A rebindable command plus its default binding and display metadata. */
export interface CommandDef {
  /** Stable id, shared with menu item ids and persisted overrides. */
  id: string
  /** i18n key for the human-readable command name. */
  labelKey: string
  /** Default binding. */
  default: HotkeySpec
  /** Action to run; omitted for editor-native / display-only commands. */
  run?: () => void | Promise<void>
  /** Fire even when a form field is focused. */
  global?: boolean
}

function h(n: number): () => void {
  return () => A.setHeading(n)
}

export const COMMAND_DEFS: CommandDef[] = [
  { id: 'insertLocalImage', labelKey: 'menu.insertLocalImage', default: { ctrl: true, shift: true, key: 'i' }, run: A.insertLocalImage },
  { id: 'image-remote', labelKey: 'menu.insertRemoteImage', default: { ctrl: true, alt: true, key: 'i' }, run: A.insertRemoteImage },
  { id: 'indent-list', labelKey: 'menu.indent', default: { ctrl: true, key: ']' }, run: A.indentList },
  { id: 'outdent-list', labelKey: 'menu.outdent', default: { ctrl: true, key: '[' }, run: A.outdentList },

  // ── File / global ───────────────────────────────────────────────
  { id: 'new', labelKey: 'menu.new', default: { ctrl: true, key: 'n' }, run: A.newFile, global: true },
  { id: 'open', labelKey: 'menu.open', default: { ctrl: true, key: 'o' }, run: A.openFileDialog, global: true },
  { id: 'openFolder', labelKey: 'menu.openFolder', default: { ctrl: true, shift: true, key: 'o' }, run: A.openFolderDialog, global: true },
  { id: 'save', labelKey: 'menu.save', default: { ctrl: true, key: 's' }, run: A.saveFile, global: true },
  { id: 'saveAs', labelKey: 'menu.saveAs', default: { ctrl: true, shift: true, key: 's' }, run: A.saveFileAs, global: true },
  { id: 'quickOpen', labelKey: 'menu.quickOpen', default: { ctrl: true, key: 'p' }, run: A.quickOpen, global: true },
  { id: 'commandPalette', labelKey: 'menu.commandPalette', default: { ctrl: true, shift: true, key: 'p' }, run: A.openCommandPalette, global: true },
  { id: 'preferences', labelKey: 'menu.preferences', default: { ctrl: true, key: ',' }, run: A.openPreferences, global: true },
  { id: 'close', labelKey: 'menu.close', default: { ctrl: true, key: 'w' }, run: A.closeWindow, global: true },
  { id: 'sourceMode', labelKey: 'menu.sourceMode', default: { ctrl: true, key: '/' }, run: A.toggleSourceMode, global: true },
  { id: 'find', labelKey: 'menu.find', default: { ctrl: true, key: 'f' }, run: A.openFind, global: true },
  { id: 'replace', labelKey: 'menu.replace', default: { ctrl: true, key: 'h' }, run: A.openReplace, global: true },
  { id: 'toggleSidebar', labelKey: 'menu.toggleSidebar', default: { ctrl: true, shift: true, key: 'l' }, run: A.toggleSidebar },

  // ── Paragraph / blocks ──────────────────────────────────────────
  { id: 'paragraph', labelKey: 'menu.paragraph', default: { ctrl: true, key: '0' }, run: A.setParagraph },
  { id: 'h1', labelKey: 'menu.h1', default: { ctrl: true, key: '1' }, run: h(1) },
  { id: 'h2', labelKey: 'menu.h2', default: { ctrl: true, key: '2' }, run: h(2) },
  { id: 'h3', labelKey: 'menu.h3', default: { ctrl: true, key: '3' }, run: h(3) },
  { id: 'h4', labelKey: 'menu.h4', default: { ctrl: true, key: '4' }, run: h(4) },
  { id: 'h5', labelKey: 'menu.h5', default: { ctrl: true, key: '5' }, run: h(5) },
  { id: 'h6', labelKey: 'menu.h6', default: { ctrl: true, key: '6' }, run: h(6) },
  { id: 'incHeading', labelKey: 'menu.incHeading', default: { ctrl: true, key: '=' }, run: A.increaseHeadingLevel },
  { id: 'decHeading', labelKey: 'menu.decHeading', default: { ctrl: true, key: '-' }, run: A.decreaseHeadingLevel },
  { id: 'insertTable', labelKey: 'menu.insertTable', default: { ctrl: true, key: 't' }, run: A.insertTable },
  { id: 'mathBlock', labelKey: 'menu.insertMath', default: { ctrl: true, shift: true, key: 'm' }, run: A.insertMathBlock },
  { id: 'codeBlock', labelKey: 'menu.codeBlock', default: { ctrl: true, shift: true, key: 'k' }, run: A.insertCodeBlock },
  { id: 'quote', labelKey: 'menu.quote', default: { ctrl: true, shift: true, key: 'q' }, run: A.insertBlockquote },
  { id: 'orderedList', labelKey: 'menu.orderedList', default: { ctrl: true, shift: true, key: '[' }, run: A.insertOrderedList },
  { id: 'unorderedList', labelKey: 'menu.unorderedList', default: { ctrl: true, shift: true, key: ']' }, run: A.insertUnorderedList },
  { id: 'taskList', labelKey: 'menu.taskList', default: { ctrl: true, shift: true, key: 'x' }, run: A.insertTaskList },
  { id: 'linkReference', labelKey: 'menu.linkReference', default: { alt: true, ctrl: true, key: 'l' }, run: A.insertLinkReference },
  { id: 'footnote', labelKey: 'menu.footnote', default: { alt: true, ctrl: true, key: 'r' }, run: A.insertFootnote },
  { id: 'inlineMath', labelKey: 'menu.inlineMath', default: { ctrl: true, key: 'm' }, run: A.insertInlineMath },

  // ── Format ──────────────────────────────────────────────────────
  { id: 'link', labelKey: 'menu.link', default: { ctrl: true, key: 'k' }, run: A.insertHyperlink },
  // Inline code: match the physical Backquote key (Ctrl/Cmd+Shift+`) — `e.key`
  // reports '~' while Shift is held, so a `key: '`'` binding would never fire.
  { id: 'inlineCode', labelKey: 'menu.code', default: { ctrl: true, shift: true, code: 'Backquote', key: '`' }, run: A.toggleInlineCode },
  { id: 'underline', labelKey: 'menu.underline', default: { ctrl: true, key: 'u' }, run: A.toggleUnderline },
  { id: 'strike', labelKey: 'menu.strike', default: { alt: true, shift: true, key: '5' }, run: A.toggleStrike },
  { id: 'clearFormat', labelKey: 'menu.clearFormat', default: { ctrl: true, key: '\\' }, run: A.clearStyle },
  { id: 'copyAsMarkdown', labelKey: 'menu.copyAsMarkdown', default: { ctrl: true, shift: true, key: 'd' }, run: A.copyAsMarkdown },
  { id: 'pastePlain', labelKey: 'menu.pastePlain', default: { ctrl: true, shift: true, key: 'v' }, run: A.pasteAsPlainText },

  // ── View ───────────────────────────────────────────────────────
  { id: 'outline', labelKey: 'menu.toggleOutline', default: { ctrl: true, shift: true, key: '1' }, run: A.showOutlinePanel },
  { id: 'fileTree', labelKey: 'menu.fileTree', default: { ctrl: true, shift: true, key: '3' }, run: A.showFileTreePanel },
  { id: 'focusMode', labelKey: 'menu.focusMode', default: { key: 'f8' }, run: A.toggleFocusMode },
  { id: 'typewriterMode', labelKey: 'menu.typewriterMode', default: { key: 'f9' }, run: A.toggleTypewriterMode },
  { id: 'fullscreen', labelKey: 'menu.fullscreen', default: { key: 'f11' }, run: A.toggleFullscreen },
  { id: 'zoomActual', labelKey: 'menu.zoomActual', default: { ctrl: true, shift: true, key: '0' }, run: A.zoomActualSize },
  { id: 'zoomIn', labelKey: 'menu.zoomIn', default: { ctrl: true, shift: true, key: '=' }, run: A.zoomIn },
  { id: 'zoomOut', labelKey: 'menu.zoomOut', default: { ctrl: true, shift: true, key: '-' }, run: A.zoomOut },

  // ── Editing commands (dispatched before the editor keymap) ──────
  { id: 'bold', labelKey: 'menu.bold', default: { ctrl: true, key: 'b' }, run: A.toggleBold },
  { id: 'italic', labelKey: 'menu.italic', default: { ctrl: true, key: 'i' }, run: A.toggleItalic },
  { id: 'undo', labelKey: 'menu.undo', default: { ctrl: true, key: 'z' }, run: A.undo },
  { id: 'redo', labelKey: 'menu.redo', default: { ctrl: true, key: 'y' }, run: A.redo },
  { id: 'cut', labelKey: 'menu.cut', default: { ctrl: true, key: 'x' }, run: A.cut },
  { id: 'copy', labelKey: 'menu.copy', default: { ctrl: true, key: 'c' }, run: A.copySelection },
  { id: 'paste', labelKey: 'menu.paste', default: { ctrl: true, key: 'v' }, run: A.paste },
  { id: 'selectAll', labelKey: 'menu.selectAll', default: { ctrl: true, key: 'a' }, run: A.selectAll },

  // ── Table submenu ──
  { id: 'table-row-below', labelKey: 'ctx.rowBelow', default: { ctrl: true, key: 'enter' }, run: A.tableRowBelow },
  { id: 'table-move-row-up', labelKey: 'ctx.moveRowUp', default: { alt: true, ctrl: true, key: 'arrowup' }, run: A.tableMoveRowUp },
  { id: 'table-move-row-down', labelKey: 'ctx.moveRowDown', default: { alt: true, ctrl: true, key: 'arrowdown' }, run: A.tableMoveRowDown },
  { id: 'table-move-col-left', labelKey: 'ctx.moveColLeft', default: { alt: true, ctrl: true, key: 'arrowleft' }, run: A.tableMoveColLeft },
  { id: 'table-move-col-right', labelKey: 'ctx.moveColRight', default: { alt: true, ctrl: true, key: 'arrowright' }, run: A.tableMoveColRight },
  { id: 'table-del-row', labelKey: 'ctx.deleteRow', default: { ctrl: true, shift: true, key: 'backspace' }, run: A.tableDeleteRow },
]

/** Default bindings keyed by command id. */
export const DEFAULT_HOTKEYS: Record<string, HotkeySpec> = Object.fromEntries(
  COMMAND_DEFS.map((d) => [d.id, d.default]),
) as Record<string, HotkeySpec>

/** Commands a user can rebind from Settings (those with an action). */
export const REBINDABLE: CommandDef[] = COMMAND_DEFS.filter((d) => d.run)

/**
 * Effective bindings = user overrides merged over defaults. Reactive: callers
 * that read this inside a Vue computed track `settings.hotkeys`.
 *
 * Falls back to defaults (no overrides) when called before Pinia is active
 * (e.g. a module-level tooltip computed at import time).
 */
export function getEffectiveHotkeys(): Record<string, HotkeySpec> {
  let overrides: Record<string, HotkeySpec> | undefined
  try {
    overrides = useSettingsStore().settings.hotkeys
  } catch {
    overrides = undefined
  }
  const out: Record<string, HotkeySpec> = {}
  // Resolve persisted conflicts deterministically too (older versions allowed them).
  // Explicit overrides take priority over defaults.
  const ordered = [...COMMAND_DEFS].sort((a, b) => Number(!!overrides?.[b.id]) - Number(!!overrides?.[a.id]))
  for (const d of ordered) {
    const candidate = overrides?.[d.id] ?? d.default
    if (!Object.values(out).some((used) => sameHotkey(used, candidate))) out[d.id] = candidate
  }
  return out
}

/** Effective binding for a single command id (undefined if unknown). */
export function getHotkey(id: string): HotkeySpec | undefined {
  return getEffectiveHotkeys()[id]
}

/** Render a binding as a compact, cross-platform label (e.g. `Ctrl/⌘+⇧+``). */
export function formatHotkey(spec: HotkeySpec | undefined): string {
  if (!spec) return ''
  const key = spec.key?.toLowerCase()
  let label = ''
  if (spec.code === 'Backquote') label = '`'
  else if (key === 'enter') label = '⏎'
  else if (key === 'backspace') label = '⌫'
  else if (key === 'escape') label = 'Esc'
  else if (key === 'arrowup') label = '↑'
  else if (key === 'arrowdown') label = '↓'
  else if (key === 'arrowleft') label = '←'
  else if (key === 'arrowright') label = '→'
  else if (key === 'space') label = 'Space'
  else if (key && /^f\d+$/.test(key)) label = key.toUpperCase()
  else if (key && key.length === 1 && /[a-z0-9]/.test(key)) label = key.toUpperCase()
  else if (key) label = key
  const parts: string[] = []
  if (spec.ctrl) parts.push('Ctrl/⌘')
  if (spec.alt) parts.push('Alt/⌥')
  if (spec.shift) parts.push('Shift/⇧')
  if (label) parts.push(label)
  return parts.join('+')
}

/** Convenience: formatted effective shortcut for a command id. */
export function hk(id: string): string {
  return formatHotkey(getHotkey(id))
}

/** True when two specs describe the same physical binding. */
export function sameHotkey(a: HotkeySpec, b: HotkeySpec): boolean {
  return !!a.ctrl === !!b.ctrl && !!a.shift === !!b.shift && !!a.alt === !!b.alt &&
    physicalKey(a) === physicalKey(b)

}

function physicalKey(spec: HotkeySpec): string {
  if (spec.code) return spec.code.toLowerCase()
  const key = (spec.key || '').toLowerCase()
  if (/^[a-z]$/.test(key)) return `key${key}`
  if (/^[0-9]$/.test(key)) return `digit${key}`
  const punctuation: Record<string, string> = { '`': 'backquote', '[': 'bracketleft', ']': 'bracketright', '=': 'equal', '-': 'minus', '/': 'slash', '\\': 'backslash', ',': 'comma' }
  return punctuation[key] || key
}

export function matchesHotkey(e: KeyboardEvent, spec: HotkeySpec): boolean {
  if (!!spec.ctrl !== (e.ctrlKey || e.metaKey) || !!spec.shift !== e.shiftKey || !!spec.alt !== e.altKey) return false
  return physicalKey(spec) === (e.code || '').toLowerCase() ||
    (!spec.code && spec.key?.toLowerCase() === e.key.toLowerCase())
}

/**
 * Build a {@link HotkeySpec} from a raw keyboard event (used when the user
 * records a new binding). Returns `null` for a lone modifier press so the
 * capture can wait for the real key.
 */
export function specFromEvent(e: KeyboardEvent): HotkeySpec | null {
  const ctrl = e.ctrlKey || e.metaKey
  const shift = e.shiftKey
  const alt = e.altKey
  if (e.code === 'Backquote') return { ctrl, shift, alt, key: '`', code: 'Backquote' }
  const baseKeys: Record<string, string> = { Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']', Slash: '/', Backslash: '\\', Comma: ',' }
  const k = baseKeys[e.code] || (/^Digit[0-9]$/.test(e.code) ? e.code.slice(5) : /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : e.key.toLowerCase())
  if (['control', 'meta', 'shift', 'alt'].includes(k)) return null
  return { ctrl, shift, alt, key: k }
}

/**
 * True when the event originates from a plain form field, or a contentEditable
 * that is NOT the editor surface.
 *
 * The Milkdown/ProseMirror editing surface is itself `contentEditable`, so it
 * must be treated as *the editor* rather than as a field. Otherwise every
 * paragraph / format hotkey (Ctrl+1..6, Ctrl+0, …) would be suppressed the
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

/** Install the global hotkey listener (call once, from AppLayout setup). */
export function useHotkeys(): void {
  const ui = useUI()

  function handler(e: KeyboardEvent): void {
    if (e.isComposing || e.key === 'Process' || ui.settingsOpen.value) return

    const sourceEditing = (e.target as HTMLElement | null)?.classList?.contains('source-textarea')
    const effective = getEffectiveHotkeys()
    for (const def of COMMAND_DEFS) {
      if (!def.run) continue // display-only
      const spec = effective[def.id]
      if (!spec) continue
      if (!matchesHotkey(e, spec)) continue

      const dialogsOpen =
        ui.commandPaletteOpen.value ||
        ui.findOpen.value ||
        ui.quickOpenOpen.value ||
        ui.settingsOpen.value ||
        ui.recoveryOpen.value
      // While a modal dialog is open, only Save is permitted.
      if (dialogsOpen && def.id !== 'save') return

      // Non-global bindings only act when not typing in a field (i.e. in editor).
      if (!def.global && isField(e.target) && !(sourceEditing && ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll', 'copyAsMarkdown', 'pastePlain'].includes(def.id))) return

      if (['cut', 'copy', 'paste'].includes(def.id) && sameHotkey(spec, def.default)) return
      e.preventDefault()
      e.stopImmediatePropagation()
      void def.run()
      return
    }
    // Suppress obsolete editor-native aliases after a binding has been changed.
    if (((!isField(e.target) || sourceEditing) && COMMAND_DEFS.some((d) => matchesHotkey(e, d.default))) ||
        (sourceEditing && (e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ')) {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }

  onMounted(() => window.addEventListener('keydown', handler, true))
  onBeforeUnmount(() => window.removeEventListener('keydown', handler, true))
}
