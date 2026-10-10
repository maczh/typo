import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc, isTauri } from '@tauri-apps/api/core'
import { useTauri } from '@/composables/useTauri'
import { dirname, nativeJoin } from '@/utils/file'

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
const MD_IMG_RE = /!\[[^\]]*\]\(\s*(<[^<>]*>|[^)\n]+?)\s*(?:"[^"]*"|'[^']*')?\s*\)/g
const HTML_IMG_RE = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi

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
function collectSrcs(md: string): string[] {
  const set = new Set<string>()
  for (const m of md.matchAll(MD_IMG_RE)) if (m[1]) set.add(m[1])
  for (const m of md.matchAll(HTML_IMG_RE)) if (m[1]) set.add(m[1])
  return [...set]
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
function assetUrlToRelative(src: string, docPath: string): string | null {
  let abs: string | null = null
  if (/^asset:/i.test(src)) {
    const m = /^asset:\/\/[^/]*\/(.*)$/.exec(src)
    if (m) abs = decodeURIComponent(m[1])
  } else if (/^https?:\/\/asset\.localhost\//i.test(src)) {
    const m = /^https?:\/\/asset\.localhost\/(.*)$/.exec(src)
    if (m) abs = decodeURIComponent(m[1])
  }
  if (!abs) return null
  // Re-encode so the value written back into the .md stays a valid Markdown
  // destination even when the path contains spaces / parentheses.
  return encodeRef(fsRelative(dirname(docPath), abs))
}

/** Relative path (`./` or `../` prefixed) from `fromDir` to an absolute `abs`. */
function fsRelative(fromDir: string, abs: string): string {
  const from = fromDir.split(/[\\/]+/).filter(Boolean)
  const to = abs.split(/[\\/]+/).filter(Boolean)
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i += 1
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
  const dir = dirname(docPath)
  let out = md
  for (const token of collectSrcs(md)) {
    const src = unwrapRef(token)
    if (!src || !isLocalRef(src)) continue
    const display = toDisplaySrc(src, dir)
    if (display !== src) out = out.split(token).join(display)
  }
  return out
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
        const newRel = `./${encodeRef(relPath)}`
        result.content = result.content.split(token).join(newRel)
        const abs = nativeJoin(dir, relPath)
        result.displayMappings.push({ old: src, display: convertFileSrc(abs) })
      } else if (/^asset:/i.test(src) || /^https?:\/\/asset\.localhost/i.test(src)) {
        const rel = assetUrlToRelative(src, docPath)
        if (rel && rel !== src) result.content = result.content.split(token).join(rel)
      }
      // Other local references (relative / absolute fs paths) are left as-is;
      // they are already on disk and will be localized again on the next open.
    } catch {
      result.errors += 1
    }
  }

  return result
}
