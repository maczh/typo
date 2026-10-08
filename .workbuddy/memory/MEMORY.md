# Typo (Typora-clone) — project memory

Markdown editor mimicking Typora. Stack: Tauri v2 (Rust desktop) + Vue3/Vite/TS
web app; WYSIWYG via Milkdown/Crepe (ProseMirror). Editor source-of-truth = Markdown string.

## Environment constraint (IMPORTANT)
- This dev container **cannot run `vite` dev/build**: startup throws
  `RangeError: WebAssembly.instantiate(): Out of memory` in Node's built-in
  `undici` (lazyllhttp) — a Wasm heap cap, NOT a code bug.
- Validate changes with `npx vue-tsc --noEmit` (works in container).
  Do NOT waste time trying `npm run dev` / `vite build` here.

## Dependency pin (do not break)
- Keep `vite ^5` + `@vitejs/plugin-vue ^5`. A stray `vite ^8` in package.json
  (mismatched with plugin-vue 5) was the root cause of the "page never enters
  edit mode" report. Restore from git HEAD if corrupted: `git checkout -- package.json`.

## Architecture (added 2026-10-09)
- `src/commands/prose.ts` — low-level ProseMirror command helpers over the
  Milkdown Editor (heading/paragraph/list/quote/code/mark toggles, introspection).
- `src/commands/actions.ts` — shared app action layer used by menu, toolbar and
  hotkeys (file/edit/paragraph/format/view/theme commands). Single implementation.
- `src/composables/useHotkeys.ts` — global Typora hotkey layer (window keydown).
  Ctrl+B/I/Z/Y/A intentionally left to ProseMirror to avoid double-toggle.
  Ctrl+/ = source mode; respected even inside the source textarea.
- Source mode: `src/composables/useSourceMode.ts` + `src/components/editor/SourceView.vue`
  (textarea bound to markdown; commit reloads editor via `loadMarkdown`).
- `src/components/editor/Toolbar.vue` — Typora-style format toolbar, live active state via `selectionchange`.
- `src/composables/useFind.ts` + `FindDialog.vue` (Ctrl+F/H); `useQuickOpen.ts` + `QuickOpenDialog.vue` (Ctrl+P).
- `src/components/layout/MenuBar.vue` — faithful Typora menu (File/Edit/Paragraph/Format/View/Theme/Help) with shortcut labels.
- `src/composables/useUI.ts` holds shared panel/dialog state (sourceMode, findOpen, quickOpenOpen, sidebarView, statusBarVisible).
- Rust: `src-tauri/src/commands/file.rs` has `pick_dir`, `open_folder`, `delete_file` (registered in `lib.rs`); bridged via `src/composables/useTauri.ts` (`pickDir`, `deleteFile`).
