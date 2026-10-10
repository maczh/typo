import type { ExportFormat } from '@/types'
import { toMarkdown } from './toMarkdown'
import { toHtml } from './toHtml'
import { toPdf } from './toPdf'
import { useTauri } from '@/composables/useTauri'
import { showToast } from '@/utils/toast'

/** Trigger a browser-style download of a Blob (works inside the Tauri webview). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * Export the current document to the requested format. Text formats (md/html) are
 * written through the Rust `save_file_as` command after a native save dialog;
 * pdf triggers the print dialog.
 */
export async function exportDocument(
  markdown: string,
  format: ExportFormat,
  baseName = 'untitled',
): Promise<void> {
  const tauri = useTauri()
  try {
    if (format === 'markdown') {
      const content = toMarkdown(markdown)
      const path = await tauri.pickSave(`${baseName}.md`)
      if (path) await tauri.saveFileAs(path, content)
    } else if (format === 'html') {
      const content = await toHtml(markdown, baseName)
      const path = await tauri.pickSave(`${baseName}.html`)
      if (path) await tauri.saveFileAs(path, content)
    } else if (format === 'pdf') {
      const html = await toHtml(markdown, baseName)
      await toPdf(html)
    }
    showToast(`✓ ${format}`)
  } catch (e) {
    showToast((e as Error).message || 'export failed', 'error')
  }
}

export { toMarkdown, toHtml, toPdf }
