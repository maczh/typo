/**
 * Shared menu-item shape for the application menu bar.
 *
 * Supports Typora-style menus: leaf commands (`id`), nested submenus (`sub`),
 * separators (`sep`), dynamic disable (`disabled`) and radio-style checkmarks
 * (`checked`). Mirrors the data the MenuBar builds and MenuNode renders, so a
 * single recursive component can draw arbitrarily deep menus (the image menu
 * nests four levels).
 */
export interface MenuItem {
  /** Leaf command id — wired to `runCommand` in MenuBar. Omitted for parents/seps. */
  id?: string
  /** i18n key for the visible label. Omitted for pure separators (`sep`). */
  titleKey?: string
  /** Displayed shortcut hint (right-aligned), if any. */
  shortcut?: string
  /** Child menu items — renders this entry as a submenu (▸) when present. */
  sub?: MenuItem[]
  /** Renders a horizontal separator instead of a button. */
  sep?: boolean
  /** Dynamic disabled predicate; when true the item is greyed and unclickable. */
  disabled?: () => boolean
  /** Dynamic checkmark predicate; when true a ✓ is shown to the left. */
  checked?: () => boolean
}
