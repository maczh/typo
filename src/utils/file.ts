// Pure path helpers (no Node APIs — runs in the browser/webview).

/** Return the directory portion of a path (best-effort, cross-platform). */
export function dirname(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  if (idx < 0) return '.'
  if (idx === 0) return '/'
  if (idx === 2 && /^[a-z]:/i.test(norm)) return norm.slice(0, 3)
  return norm.slice(0, idx)
}

/** Return the file name portion of a path. */
export function basename(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx < 0 ? norm : norm.slice(idx + 1)
}

/** Replace a file's extension: `a.md` -> `a.html`. */
export function replaceExtension(path: string, ext: string): string {
  const base = basename(path)
  const dot = base.lastIndexOf('.')
  const name = dot > 0 ? base.slice(0, dot) : base
  const prefix = path.slice(0, path.length - base.length)
  const extWithDot = ext.startsWith('.') ? ext : `.${ext}`
  return `${prefix}${name}${extWithDot}`
}

/** Resolve a document-relative asset path against the document directory. */
export function resolveAssetPath(docPath: string, assetRel: string): string {
  const dir = dirname(docPath)
  return `${dir}/${assetRel}`.replace(/\/+/g, '/')
}

/**
 * Join a directory and a (possibly forward-slashed) relative path, using the
 * directory's own separator so the result is a valid native absolute path
 * (e.g. for `convertFileSrc`, which expects a real filesystem path).
 */
export function normalizeFsPath(path: string): string {
  const norm = path.replace(/\\/g, '/')
  const prefix = norm.startsWith('//') ? '//' : /^[a-z]:\//i.test(norm) ? norm.slice(0, 3) : norm.startsWith('/') ? '/' : ''
  const segments: string[] = []
  const protectedSegments = prefix === '//' ? 2 : 0
  for (const part of norm.slice(prefix.length).split('/')) {
    if (!part || part === '.') continue
    if (part === '..' && segments.length > protectedSegments && segments.at(-1) !== '..') segments.pop()
    else if (part !== '..' || !prefix) segments.push(part)
  }
  return prefix + segments.join('/') || '.'
}

export function nativeJoin(dir: string, rel: string): string {
  const absolute = /^(?:[a-z]:[\\/]|[\\/])/i.test(rel)
  const sep = (absolute ? rel : dir).includes('\\') ? '\\' : '/'
  const joined = absolute || !dir ? rel : `${dir}${/[\\/]$/.test(dir) ? '' : '/'}${rel}`
  return normalizeFsPath(joined).replace(/\//g, sep)
}
