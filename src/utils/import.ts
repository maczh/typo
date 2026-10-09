import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import type { OpenKind } from '@/types'

/**
 * HTML → Markdown and DOCX → Markdown conversion for file import and clipboard
 * paste. Both paths funnel through `TurndownService`; DOCX first goes through
 * `mammoth` (DOCX → HTML) in the browser.
 *
 * Why not convert in Rust: both libraries are pure-JS and already run in the
 * webview; doing it on the frontend keeps the Rust side to a byte-read and lets
 * the same code serve paste and file-open.
 */

let turndown: TurndownService | null = null

function getTurndown(): TurndownService {
  if (!turndown) {
    turndown = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      fence: '```',
      emDelimiter: '*',
      strongDelimiter: '**',
      linkStyle: 'inlined',
    })
    // Tables, strikethrough and task lists — the bits GitHub-flavoured Markdown
    // adds on top of the original Turndown rules.
    turndown.use(gfm)
    // Drop machinery that has no Markdown equivalent (and would otherwise leak
    // as stray text or empty nodes).
    turndown.remove(['script', 'style', 'meta', 'link', 'head', 'title'])
  }
  return turndown
}

/** Convert an HTML string to Markdown. Returns `''` on empty / failure. */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return ''
  try {
    return getTurndown().turndown(html).trim()
  } catch {
    return ''
  }
}

/** Convert a DOCX file (ArrayBuffer) to Markdown via mammoth → turndown. */
export async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  try {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.convertToHtml({ arrayBuffer: buffer })
    return htmlToMarkdown(value)
  } catch {
    return ''
  }
}

export interface RawFile {
  path: string
  name: string
  kind: OpenKind
  /** UTF-8 text for text/html/markdown payloads. */
  text: string
  /** base64 of the raw bytes for DOCX; undefined otherwise. */
  data?: string
}

/** Convert a Rust `FileResult` payload into Markdown source. */
export async function importToMarkdown(file: RawFile): Promise<string> {
  switch (file.kind) {
    case 'docx':
      if (!file.data) return ''
      return docxToMarkdown(base64ToArrayBuffer(file.data))
    case 'html':
      return htmlToMarkdown(file.text)
    case 'text':
    case 'markdown':
    default:
      return file.text
  }
}

/** Decode a base64 string (e.g. a DOCX blob) into an ArrayBuffer. */
export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
