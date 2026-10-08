# Typo

> A Typora-style, cross-platform **WYSIWYG Markdown editor** built with
> **Rust + Tauri v2** (desktop shell) and **Vue 3 + Vite + TypeScript + Milkdown**
> (frontend / editor).

Typo lets you write Markdown and see it rendered instantly — no source/preview
split, no manual mode switching. It supports math (KaTeX), diagrams (Mermaid),
syntax-highlighted code, GFM tables, drag-and-drop / paste images, an outline
panel, a command palette, multi-language UI (简体中文 / English / 繁體中文),
theming, auto-save with crash recovery, and export to **Markdown / HTML / Word /
PDF**.

---

## Features

| Area | Capability |
| --- | --- |
| Editing | Real-time WYSIWYG via Milkdown (ProseMirror core), Markdown is the source of truth |
| Blocks | Headings, lists (incl. task lists), quotes, code, tables, links, images, bold/italic/strike, rules |
| Math | Inline `$...$` and block `$$...$$` KaTeX rendering |
| Diagrams | ` ```mermaid ` fenced blocks rendered lazily via Mermaid |
| Code | highlight.js code blocks (curated 20+ language subset) |
| Images | Paste / drag-and-drop → written to `<doc>/assets/` as a relative path |
| Navigation | Live outline (H1–H6) with click-to-scroll; command palette (Ctrl/⌘+Shift+P) |
| UI | 2 built-in themes (GitHub Light / Nord Dark), custom CSS, 3 languages |
| Persistence | Auto-save backups + crash recovery; recent-files list |
| Export | Markdown, standalone HTML (offline KaTeX CSS), Word (.docx), PDF (print) |

---

## Tech Stack

- **Desktop**: Rust + Tauri v2 (`src-tauri/`)
- **Frontend**: Vue 3 + Vite + TypeScript (`src/`)
- **Editor**: [@milkdown/crepe](https://milkdown.dev) (bundles commonmark, GFM,
  KaTeX math, Mermaid, highlight.js, tables)
- **State**: Pinia (`editor` / `files` / `settings` stores)
- **i18n**: vue-i18n (zh-CN / en / zh-TW)
- **Export**: `unified` + `remark`/`rehype` (HTML), `docx` (Word), `window.print` (PDF)

---

## Project Layout

```
typo/
├── package.json / vite.config.ts / tsconfig*.json / index.html   # frontend
├── src-tauri/                                                    # Rust backend (Tauri v2)
│   ├── Cargo.toml · build.rs · tauri.conf.json · capabilities/
│   └── src/{main.rs, lib.rs, models.rs, state.rs, commands/*}
├── src/
│   ├── main.ts · App.vue · vite-env.d.ts
│   ├── types/index.ts
│   ├── stores/{editor,files,settings}.ts
│   ├── composables/{useTauri,useMilkdown,useRecentFiles,useAutosave,useUI}.ts
│   ├── components/{layout,sidebar,editor,panels,command,dialogs}/*
│   ├── milkdown/{setup.ts, plugins/{latex,mermaid,highlight,image,table}.ts}
│   ├── utils/{file,outline,markdown}.ts · utils/exporter/*
│   ├── i18n/{index.ts, locales/{zh-CN,en,zh-TW}.ts}
│   └── styles/{variables,app,print}.css · styles/themes/*
└── README.md · build-env.md
```

See [`build-env.md`](./build-env.md) for the full per-platform build guide and
the offline / degraded-delivery notes.

---

## Development

> Requires Node.js 18+ and a Rust toolchain (for the Tauri desktop build).
> See `build-env.md` for OS-specific prerequisites.

```bash
# 1. Install frontend dependencies
npm install

# 2. Run the web UI only (Vite dev server — works without Rust)
npm run dev

# 3. Type-check + build the frontend bundle
npm run build          # = vue-tsc --noEmit && vite build

# 4. Run the full desktop app (needs Rust + Tauri prerequisites)
npm run tauri dev

# 5. Produce a platform installer
npm run tauri build
```

### Pure-frontend development

`npm run dev` launches the Vue app in a browser. File dialogs and on-disk
persistence require the Tauri runtime, so those paths show a friendly toast in a
plain browser. Everything else — editing, outline, export preview, theming,
i18n, command palette — runs fully in the browser.

---

## Architecture Notes

- **Source of truth**: the document is always Markdown. Saving / exporting always
  derives from `editor.getMarkdown()`.
- **Tauri bridge**: all `invoke` calls are wrapped in `composables/useTauri.ts`,
  which routes errors to a global toast. Components never call Rust directly.
- **Theming**: colors flow through CSS variables in `styles/variables.css`;
  switching theme = setting `data-theme` on `<html>` + loading the matching css.
- **Milkdown plugins**: `src/milkdown/plugins/*` provide insertion / rendering
  helpers (math, diagram, highlight subset, image, table) that operate on the
  live Crepe editor; Crepe itself supplies the base WYSIWYG nodes with full
  Markdown round-trip.

---

## Known Limitations (v1)

- **PDF** export relies on the OS print dialog ("Save as PDF"); there is no
  silent one-click PDF writing.
- **Word** export renders math as LaTeX source text (no OMML conversion yet).
- **Mermaid** in exported standalone HTML is left as a fenced code block (the
  live editor renders it); full offline Mermaid SVG baking in HTML export is a
  future enhancement.
- The Rust layer is delivered as complete, self-consistent source; it must be
  compiled on a machine with the Tauri v2 toolchain (see `build-env.md`).
