// Core TypeScript types shared across the frontend.
// These mirror the Rust-side data structures (see src-tauri/src/models.rs) where
// relevant, and are the single source of truth for the Vue / Pinia layer.

export type Lang = 'zh-CN' | 'en' | 'zh-TW'

export type EditorMode = 'normal' | 'focus' | 'typewriter' | 'source'

export type ThemeKind = 'light' | 'dark'

/** The currently open document — Markdown source is the single source of truth. */
export interface EditorDoc {
  /** Absolute path on disk; `null` means an unsaved draft. */
  path: string | null
  name: string
  /** Markdown source (source of truth). */
  content: string
  dirty: boolean
  savedAt: number | null
}

/** A node in the document outline (H1–H6). */
export interface OutlineNode {
  id: string
  level: number // 1-6
  text: string
  pos: number // ProseMirror position, used for scroll-to
  children: OutlineNode[]
}

/** A file-system entry in the sidebar tree. */
export interface FileItem {
  name: string
  path: string
  isDir: boolean
  children?: FileItem[]
}

/** A recently opened document. */
export interface RecentItem {
  path: string
  name: string
  openedAt: number
}

/** How a dropped-in file should be interpreted before it becomes Markdown. */
export type OpenKind = 'markdown' | 'text'

/** Result of opening a file (mirrors Rust `FileResult`). */
export interface FileResult {
  path: string
  content: string
  name: string
  /** What the payload is — see `OpenKind`. */
  kind?: OpenKind
  /** base64 of the raw bytes for binary formats (DOCX); absent otherwise. */
  data?: string
}

/** Result of saving / autosaving a file (mirrors Rust `SaveResult`). */
export interface SaveResult {
  success: boolean
  path: string
  savedAt: number
}

/** A recoverable autosave backup (mirrors Rust `RecoveryItem`). */
export interface RecoveryItem {
  doc_path: string
  backup_path: string
  saved_at: number
}

/** A single hotkey binding (layout-independent; `code` preferred for keys whose
 *  `key` changes with Shift, e.g. Backquote `→ ~`). */
export interface HotkeySpec {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  /** Normalized key, lowercased (e.g. 'b', '1', 'enter', 'f8', 'backquote'). */
  key?: string
  /** Physical key code (e.g. 'Backquote') for layout-independent matching. */
  code?: string
}

/** Editor / appearance settings (persisted via the Rust `settings` command). */
export interface Settings {
  theme: string
  language: Lang
  fontSize: number
  lineHeight: number
  fontFamily: string
  autoSave: boolean
  autoSaveInterval: number // ms
  mode: EditorMode
  /** WYSIWYG content column width, as a percentage of the editor pane. */
  contentWidth: number
  customCss: string
  /** Per-command hotkey overrides, keyed by command id. Missing ids fall back
   *  to the built-in defaults. */
  hotkeys?: Record<string, HotkeySpec>
}

/** A selectable theme definition. */
export interface ThemeDef {
  id: string
  name: string
  kind: ThemeKind
  cssPath?: string
}

/** Result of persisting an asset: relative + absolute path. */
export interface AssetWriteResult {
  relativePath: string // assets/xxx.png
  absolutePath: string
}

/** A command-palette entry. */
export interface CommandItem {
  id: string
  title: string
  // i18n key used when `title` is not already localized
  i18nKey?: string
  shortcut?: string
  run: () => void | Promise<void>
}

/** Supported export formats. */
export type ExportFormat = 'markdown' | 'html' | 'pdf'
