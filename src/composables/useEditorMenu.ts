import { ref } from 'vue'
import type { BlockKind } from '@/commands/prose'

/**
 * Shared state for the editor's floating menu. A single module-level singleton so
 * both entry points — the per-line block handle and the right-click context menu —
 * drive the exact same component.
 *
 * `kind` records what the caret was on when the menu opened, which lets the menu
 * show a different set of actions for a table vs. a plain paragraph.
 */
export type MenuKind = BlockKind

const open = ref(false)
const x = ref(0)
const y = ref(0)
const kind = ref<MenuKind>('paragraph')

export function useEditorMenu() {
  return {
    open,
    x,
    y,
    kind,
    show(px: number, py: number, k: MenuKind = 'paragraph'): void {
      x.value = px
      y.value = py
      kind.value = k
      open.value = true
    },
    hide(): void {
      open.value = false
    },
  }
}
