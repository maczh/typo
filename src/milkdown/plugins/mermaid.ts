import type { Editor } from '@milkdown/core'
import { insert } from '@milkdown/utils'

/**
 * Mermaid diagram helpers. Crepe bundles a Mermaid-powered `diagram` node; these
 * helpers insert a diagram at the caret and lazily render a diagram to SVG for
 * export / preview (the mermaid runtime is dynamically imported to keep it out of
 * the initial bundle).
 */

/** Insert a Mermaid code block (` ```mermaid `) at the caret. */
export function insertDiagram(editor: Editor, code: string): void {
  const md = `\n\`\`\`mermaid\n${code}\n\`\`\`\n`
  editor.action(insert(md))
}

let mermaidInstance: Promise<typeof import('mermaid').default> | null = null

/** Lazily load and initialize Mermaid, returning the singleton instance. */
export async function getMermaid(): Promise<typeof import('mermaid').default> {
  if (!mermaidInstance) {
    mermaidInstance = import('mermaid').then((mod) => {
      const inst = mod.default
      inst.initialize({ startOnLoad: false, securityLevel: 'loose' })
      return inst
    })
  }
  return mermaidInstance
}

/** Render a Mermaid diagram definition to an SVG string. */
export async function renderMermaid(code: string): Promise<string> {
  const mermaid = await getMermaid()
  const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code)
  return svg
}
