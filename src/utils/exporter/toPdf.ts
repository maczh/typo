// Print sanitized HTML in a frame with scripts disabled, including native IPC.
import printCss from '@/styles/print.css?raw'

export async function toPdf(htmlContent: string): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-same-origin allow-modals')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); throw new Error('无法创建打印窗口') }
  const loaded = new Promise<void>(resolve => { iframe.onload = () => resolve() })
  doc.open()
  doc.write(htmlContent.replace('</head>', `<style>${printCss}</style></head>`))
  doc.close()
  await loaded
  await doc.fonts?.ready
  const timeout = window.setTimeout(() => iframe.remove(), 300000)
  win.addEventListener('afterprint', () => { window.clearTimeout(timeout); iframe.remove() }, { once: true })
  try { win.focus(); win.print() } catch (error) { window.clearTimeout(timeout); iframe.remove(); throw error }
}
