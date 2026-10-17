import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { useTauri } from '@/composables/useTauri'
import { dirname, nativeJoin, normalizeFsPath } from '@/utils/file'

/**
 * Image reference handling for Markdown save / load.
 *
 * The editor renders images through the Tauri webview, where a *relative*
 * reference such as `./note_imgs/foo.png` resolves against the page URL (the app's
 * own HTML), not the Markdown file's directory — so it would never load.
 *
 * To make files portable (and survive a move) while still rendering, we keep a
 * clean split:
 *
 *   - **On disk** the Markdown stores *relative* refs (`<stem>_imgs/foo.png`),
 *     percent-encoded when the path contains characters (spaces, parentheses…)
 *     that would make the Markdown destination invalid.
 *   - **In memory / on screen** local images use an absolute `asset://…` URL
 *     produced by `convertFileSrc`, which the webview can actually load.
 *
 * This module provides the two transforms:
 *   - `localizeMarkdown`  : disk → screen  (relative / fs path → asset://)
 *   - `prepareImagesForSave` : screen → disk (download remote/data/blob, and
 *     normalize any absolute asset:// refs back to relative).
 */

/** A remote / inline image fetched and written to `<doc>_imgs/`. */
interface RemoteImage {
  data: number[]
  ext: string
}

// Markdown image destinations may be bare (CommonMark forbids raw spaces, but we
// tolerate ones written by other editors such as Typora) or wrapped in `<…>`;
// an optional quoted title may follow. `[^)\n]+?` keeps a match on a single line
// and stops at the closing `)`.
/** Strip the optional `<…>` wrapper CommonMark allows around a link/image URL. */
function unwrapRef(token: string): string {
  const t = token.trim()
  return t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1).trim() : t
}

/**
 * Percent-encode only the characters that would break a bare Markdown image
 * destination (whitespace, parentheses, angle brackets, quotes and a few URL
 * delimiters), leaving path separators and non-ASCII characters (e.g. Chinese
 * folder names) human-readable.
 */
function encodeRef(rel: string): string {
  return rel.replace(/[ \t\n\r()<>`"'#?%[\]]/g, (c) =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'),
  )
}

/** `decodeURIComponent` that tolerates a stray `%` in a raw filesystem path. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Whether `src` is a local reference that should be localized (not remote/data/blob/asset). */
function isLocalRef(src: string): boolean {
  if (/^asset:/i.test(src)) return false
  if (/^https?:\/\//i.test(src)) return false
  if (/^data:/i.test(src)) return false
  if (/^blob:/i.test(src)) return false
  return true
}

/** Whether `src` must be downloaded and re-hosted locally. */
function needsDownload(src: string): boolean {
  if (/^asset:/i.test(src)) return false
  if (/^data:/i.test(src)) return true
  if (/^blob:/i.test(src)) return true
  if (/^https?:\/\//i.test(src)) return !/^https?:\/\/asset\.localhost/i.test(src)
  return false
}

function mimeToExt(mime: string): string {
  const m = (mime.split(';')[0] ?? '').trim().toLowerCase()
  switch (m) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/gif':
      return 'gif'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    case 'image/bmp':
      return 'bmp'
    case 'image/x-icon':
    case 'image/vnd.microsoft.icon':
      return 'ico'
    default:
      return 'png'
  }
}

function sanitizeName(name: string): string {
  const n = name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/\.+/g, '.').replace(/^-+|-+$/g, '')
  return n || 'image'
}

function extFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const base = u.pathname.split('/').pop() ?? ''
    const m = /\.([a-z0-9]+)$/i.exec(base)
    if (m) return m[1].toLowerCase()
  } catch {
    /* not a URL */
  }
  return ''
}

/**
 * Collect every unique image destination token referenced in the Markdown
 * (md + html forms). Tokens are returned verbatim — Markdown ones may still
 * carry the optional `<…>` wrapper; use `unwrapRef` before resolving them.
 */
interface ImageSpan { start: number; end: number; token: string }
interface MarkdownNode {
  type: string
  identifier?: string
  children?: MarkdownNode[]
  position?: { start: { offset?: number }; end: { offset?: number } }
}
const imageParser = unified().use(remarkParse).use(remarkGfm)

/** Use syntax positions so code, prose and ordinary links are never rewritten. */
function imageSpans(md: string): ImageSpan[] {
  const tree = imageParser.parse(md) as MarkdownNode
  const references = new Set<string>()
  const nodes: MarkdownNode[] = []
  function visit(node: MarkdownNode): void {
    nodes.push(node)
    if (node.type === 'imageReference' && node.identifier) references.add(node.identifier.toLowerCase())
    node.children?.forEach(visit)
  }
  visit(tree)
  const spans: ImageSpan[] = []
  for (const node of nodes) {
    const start = node.position?.start.offset
    const end = node.position?.end.offset
    if (start === undefined || end === undefined) continue
    const raw = md.slice(start, end)
    if (node.type === 'html') {
      for (const match of raw.matchAll(/<img\b(?:[^"'>]|"[^"]*"|'[^']*')*>/gi)) {
        const attr = /\ssrc\s*=\s*(["'])(.*?)\1/i.exec(match[0])
        if (!attr) continue
        const offset = attr.index + attr[0].indexOf(attr[1]) + 1
        const at = start + match.index! + offset
        spans.push({ start: at, end: at + attr[2].length, token: attr[2] })
      }
      continue
    }
    if (node.type !== 'image' && !(node.type === 'definition' && references.has(node.identifier?.toLowerCase() ?? ''))) continue
    const prefix = node.type === 'image' ? /^!\[(?:\\.|[^\]\\])*\]\(\s*/ : /^ {0,3}\[[^\]]+\]:\s*/
    const match = prefix.exec(raw)
    if (!match) continue
    let at = match[0].length
    let until = at
    if (raw[at] === '<') {
      at++
      until = at
      while (until < raw.length && raw[until] !== '>') until += raw[until] === '\\' ? 2 : 1
    } else {
      let depth = 0
      while (until < raw.length) {
        const ch = raw[until]
        if (ch === '\\') { until += 2; continue }
        if (/\s/.test(ch) || (ch === ')' && depth === 0)) break
        if (ch === '(') depth++
        if (ch === ')') depth--
        until++
      }
    }
    if (until > at) spans.push({ start: start + at, end: start + until, token: raw.slice(at, until) })
  }
  return spans.sort((a, b) => a.start - b.start)
}

function collectSrcs(md: string): string[] {
  return [...new Set(imageSpans(md).map(span => span.token))]
}

export function rewriteImageReferences(md: string, mappings: ReadonlyMap<string, string>): string {
  let out = md
  for (const span of imageSpans(md).reverse()) {
    const replacement = mappings.get(span.token)
    if (replacement !== undefined) out = out.slice(0, span.start) + replacement + out.slice(span.end)
  }
  return out
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; ext: string } {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) throw new Error('unsupported data url')
  const header = dataUrl.slice(5, comma) // between "data:" and ","
  const mime = (header.split(';')[0] || 'image/png').trim()
  const payload = dataUrl.slice(comma + 1)
  // Base64 is the common form; tolerate a percent-encoded payload too.
  const bin = /;base64/i.test(header) ? atob(payload) : decodeURIComponent(payload)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { bytes, ext: mimeToExt(mime) }
}

/** Fetch the bytes for a downloadable src (data: / blob: / http(s):). */
async function downloadBytes(src: string): Promise<{ bytes: Uint8Array; ext: string }> {
  if (src.startsWith('data:')) return dataUrlToBytes(src)
  if (src.startsWith('blob:')) {
    const resp = await fetch(src)
    if (!resp.ok) throw new Error(`blob ${resp.status}`)
    const ct = resp.headers.get('content-type') ?? ''
    const buf = await resp.arrayBuffer()
    return { bytes: new Uint8Array(buf), ext: ct ? mimeToExt(ct) : 'png' }
  }
  // http(s): delegate to Rust — the webview cannot read cross-origin bytes (CORS).
  const res = await invoke<RemoteImage>('fetch_remote_image', { url: src })
  const ext = res.ext || extFromUrl(src) || 'png'
  return { bytes: Uint8Array.from(res.data), ext }
}

/** Read a Blob/File as a `data:` URL (used when there is no document on disk yet). */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Persist a pasted / dropped / uploaded image file and return the `src` to insert
 * into the document.
 *
 * Inside Tauri with a document already saved to disk the bytes are written to
 * `<doc>_imgs/` and an absolute `asset://` URL is returned — it renders
 * immediately and `prepareImagesForSave` later rewrites it to a relative
 * `./<stem>_imgs/…` path on save. Without a document path (or outside Tauri) it
 * falls back to a `data:` URL, which is still materialised on the next save.
 *
 * Never throws: a write failure degrades to the data URL so the image is not lost
 * (a `blob:` URL would be, since it cannot be read back at save time and dies on
 * reload).
 */
export async function persistImageFile(file: File, docPath: string | null): Promise<string> {
  const ext = mimeToExt(file.type || '')
  const base = file.name && file.name.trim() ? sanitizeName(file.name) : `image.${ext}`
  const name = `${Date.now()}-${base}`
  if (isTauri() && docPath) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const dir = dirname(docPath)
      const rel = await useTauri().writeAsset(docPath, name, bytes)
      return convertFileSrc(nativeJoin(dir, rel))
    } catch {
      /* fall through to the data URL so the image is never lost */
    }
  }
  return blobToDataUrl(file)
}

/** Resolve Typora's per-document image root, falling back to the document folder. */
export function documentImageRoot(md: string, docPath: string): string {
  const frontMatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(md)
  const match = frontMatter && /^typora-root-url:\s*(.+)$/m.exec(frontMatter[1])
  if (!match) return dirname(docPath)
  let root = match[1].trim()
  if (root.startsWith('"')) { try { root = JSON.parse(root); if (typeof root !== 'string') return dirname(docPath) } catch { return dirname(docPath) } }
  else if (root.startsWith("'")) root = root.slice(1, -1).replace(/''/g, "'")
  return /^(?:\/|[a-z]:[\\/]|\\\\)/i.test(root) ? root : nativeJoin(dirname(docPath), root)
}

/** Convert a local reference to an absolute `asset://` URL the webview can load. */
function toDisplaySrc(src: string, docDir: string): string {
  if (!isLocalRef(src)) return src // remote / data / blob / asset url → render as-is
  // The on-disk ref may be percent-encoded (spaces → %20); decode it back to the
  // real filesystem path before handing it to `convertFileSrc`.
  const decoded = safeDecode(unwrapRef(src))
  let abs: string
  if (decoded.startsWith('/') || /^[A-Za-z]:[\\/]/.test(decoded) || decoded.startsWith('\\\\')) {
    abs = decoded // already an absolute filesystem path
  } else {
    // `docDir` is the document's directory; resolve the relative ref against it.
    // Strip a leading "./" so the joined path is a clean absolute path.
    abs = nativeJoin(docDir, decoded.replace(/^\.\//, ''))
  }
  try {
    return convertFileSrc(abs)
  } catch {
    return src
  }
}

/** Compute a document-relative path from an absolute `asset://` URL. */
function assetUrlToRelative(src: string, docPath: string, root = dirname(docPath)): string | null {
  let abs: string | null = null
  if (/^asset:/i.test(src)) {
    const m = /^asset:\/\/[^/]*\/(.*)$/.exec(src)
    if (m) abs = safeDecode(m[1])
  } else if (/^https?:\/\/asset\.localhost\//i.test(src)) {
    const m = /^https?:\/\/asset\.localhost\/(.*)$/.exec(src)
    if (m) abs = safeDecode(m[1])
  }
  if (!abs) return null
  // Re-encode so the value written back into the .md stays a valid Markdown
  // destination even when the path contains spaces / parentheses.
  return encodeRef(fsRelative(root, abs))
}

/** Relative path (`./` or `../` prefixed) from `fromDir` to an absolute `abs`. */
function fsRelative(fromDir: string, abs: string): string {
  const fromDrive = /^[a-z]:/i.exec(fromDir)?.[0].toLowerCase()
  const toDrive = /^[a-z]:/i.exec(abs)?.[0].toLowerCase()
  if (fromDrive !== toDrive && (fromDrive || toDrive)) return abs
  fromDir = normalizeFsPath(fromDir)
  abs = normalizeFsPath(abs)
  if (fromDir.startsWith('//') || abs.startsWith('//')) {
    const share = (path: string) => path.split('/').slice(0, 4).join('/').toLowerCase()
    if (share(fromDir) !== share(abs)) return abs
  }
  const from = fromDir.split(/[\\/]+/).filter(Boolean)
  const to = abs.split(/[\\/]+/).filter(Boolean)
  let i = 0
  while (i < from.length && i < to.length && (fromDrive ? from[i].toLowerCase() === to[i].toLowerCase() : from[i] === to[i])) i += 1
  const up = from.length - i
  const rel = [...Array(up).fill('..'), ...to.slice(i)]
  const r = rel.join('/')
  return r.startsWith('.') ? r : `./${r}`
}

/**
 * Convert every local image reference in `md` to an absolute `asset://` URL so
 * it renders in the webview. Remote / inline / asset-URL refs are left untouched.
 *
 * Returns `md` unchanged outside Tauri or when no document path is known.
 */
export function localizeMarkdown(md: string, docPath: string | null): string {
  if (!isTauri() || !docPath) return md
  const dir = documentImageRoot(md, docPath)
  const mappings = new Map<string, string>()
  for (const token of collectSrcs(md)) {
    const src = unwrapRef(token)
    if (!src || !isLocalRef(src)) continue
    const display = toDisplaySrc(src, dir)
    if (display !== src) mappings.set(token, display)
  }
  return rewriteImageReferences(md, mappings)
}

export interface SaveImageResult {
  /** Markdown with local image refs rewritten to relative `./<stem>_imgs/…` paths. */
  content: string
  /**
   * Mapping from the in-memory (pre-save) image `src` to the absolute
   * `asset://` URL it should keep in memory so it keeps rendering after the
   * file on disk has been switched to a relative path.
   */
  displayMappings: { old: string; display: string }[]
  /** Count of images that could not be downloaded (network / read failure). */
  errors: number
}

/**
 * Prepare Markdown for saving:
 *   1. Download every remote / inline (`http(s)` / `data:` / `blob:`) image into
 *      `<doc>_imgs/` and rewrite its ref to a relative `./<stem>_imgs/…` path
 *      (percent-encoded so the Markdown stays valid).
 *   2. Normalize any existing absolute `asset://` references back to document-
 *      relative paths (so the saved file stays portable).
 *
 * Returns the rewritten content plus the in-memory mappings so the caller can
 * keep the editor showing absolute `asset://` URLs (which actually render).
 *
 * Outside Tauri (browser preview) this is a no-op that returns the input.
 */
export async function prepareImagesForSave(md: string, docPath: string): Promise<SaveImageResult> {
  const result: SaveImageResult = { content: md, displayMappings: [], errors: 0 }
  if (!isTauri() || !docPath) return result

  const dir = dirname(docPath)
  const tauri = useTauri()
  const mappings = new Map<string, string>()
  const usedNames = new Set<string>()
  let counter = 0

  for (const token of collectSrcs(md)) {
    const src = unwrapRef(token)
    if (!src) continue
    try {
      if (needsDownload(src)) {
        const { bytes, ext } = await downloadBytes(src)
        const base =
          src.startsWith('data:') || src.startsWith('blob:')
            ? `image-${Date.now()}`
            : sanitizeName(extFromUrl(src) || 'image')
        let name = `${base}-${counter}.${ext}`
        while (usedNames.has(name)) {
          counter += 1
          name = `${base}-${counter}.${ext}`
        }
        usedNames.add(name)
        const relPath = await tauri.writeAsset(docPath, name, bytes) // "<stem>_imgs/<name>"
        // Encode so the on-disk ref stays a valid Markdown destination even when
        // the document name (and thus the `<stem>_imgs` folder) contains spaces.
        const newRel = encodeRef(fsRelative(documentImageRoot(md, docPath), nativeJoin(dir, relPath)))
        mappings.set(token, newRel)
        const abs = nativeJoin(dir, relPath)
        result.displayMappings.push({ old: src, display: convertFileSrc(abs) })
      } else if (/^asset:/i.test(src) || /^https?:\/\/asset\.localhost/i.test(src)) {
        const rel = assetUrlToRelative(src, docPath, documentImageRoot(md, docPath))
        if (rel && rel !== src) mappings.set(token, rel)
      }
      // Other local references (relative / absolute fs paths) are left as-is;
      // they are already on disk and will be localized again on the next open.
    } catch {
      result.errors += 1
    }
  }

  result.content = rewriteImageReferences(md, mappings)
  return result
}

/** Local image sources paired with native paths, for batch copy/move. */
export function localImageFiles(md: string, docPath: string): { src: string; path: string }[] {
  return collectSrcs(md).flatMap(token => {
    const src = unwrapRef(token)
    if (needsDownload(src)) return []
    const asset = /^asset:\/\/[^/]*\/(.*)$/.exec(src) || /^https?:\/\/asset\.localhost\/(.*)$/.exec(src)
    const path = asset ? safeDecode(asset[1]) : safeDecode(src)
    if (!path || /^(?:data|blob|https?):/i.test(path)) return []
    return [{ src, path: /^(?:\/|[a-z]:[\\/]|\\\\)/i.test(path) ? path : nativeJoin(documentImageRoot(md, docPath), path) }]
  })
}
