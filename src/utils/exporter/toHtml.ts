import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import type { Root as MdRoot, Nodes as MdNodes } from 'mdast'
import type { Root as HtmlRoot, Element, RootContent } from 'hast'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'
import katex from 'katex'
// Inline the KaTeX stylesheet so the exported file is fully offline.
import katexCss from 'katex/dist/katex.min.css?raw'
import { escapeAttr } from '@/utils/markdown'

/** Transform parsed text only: dollar signs in code must remain literal. */
function remarkMath() {
  return (tree: MdRoot) => {
    function walk(node: MdNodes): void {
      if (!('children' in node)) return
      const children: MdNodes[] = []
      for (const child of node.children) {
        if (child.type !== 'text') { walk(child); children.push(child); continue }
        const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g
        let offset = 0
        for (const match of child.value.matchAll(pattern)) {
          if (match.index! > offset) children.push({ type: 'text', value: child.value.slice(offset, match.index) })
          const display = match[1] !== undefined
          children.push({ type: 'html', value: `<span class="math-${display ? 'block' : 'inline'}">${escapeAttr(match[1] ?? match[2])}</span>` })
          offset = match.index! + match[0].length
        }
        children.push({ type: 'text', value: child.value.slice(offset) })
      }
      node.children = children as typeof node.children
    }
    walk(tree)
  }
}

/** Only trusted KaTeX output is introduced after the HTML sanitizer. */
function rehypeMath() {
  return (tree: HtmlRoot) => {
    function walk(node: HtmlRoot | Element): void {
      node.children = node.children.map((child): RootContent => {
        if (child.type !== 'element') return child
        const classes = child.properties.className
        if (child.tagName === 'span' && Array.isArray(classes) && classes.some(c => c === 'math-inline' || c === 'math-block')) {
          const expr = child.children.filter(c => c.type === 'text').map(c => c.value).join('')
          const display = classes.includes('math-block')
          return { type: 'raw', value: `<span class="math-${display ? 'block' : 'inline'}">${katex.renderToString(expr.trim(), { displayMode: display, throwOnError: false, trust: false })}</span>` }
        }
        walk(child)
        return child
      }) as typeof node.children
    }
    walk(tree)
  }
}

/** Convert Markdown to a self-contained HTML document (offline-friendly). */
export async function toHtml(markdown: string, title = 'Document'): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
      attributes: { ...defaultSchema.attributes, span: [['className', 'math-inline', 'math-block']] },
      protocols: { ...defaultSchema.protocols, src: ['http', 'https', 'data', 'asset', 'file'] },
    })
    .use(rehypeMath)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown)
  const body = String(file)
  return wrapHtml(body, title)
}

function wrapHtml(body: string, title: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: asset: file: http: https:; font-src data:; base-uri 'none'; form-action 'none'" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(title)}</title>
<style>${katexCss}</style>
<style>
  body { max-width: 820px; margin: 40px auto; padding: 0 16px; font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; color: #24292f; }
  pre, code { background: #f6f8fa; border-radius: 6px; }
  pre { padding: 12px; overflow: auto; }
  code { padding: 1px 5px; font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.9em; }
  blockquote { border-left: 4px solid #d0d7de; margin: 1em 0; padding: 0 1em; color: #57606a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d0d7de; padding: 6px 10px; }
  img { max-width: 100%; }
  .math-block { display: block; text-align: center; overflow: auto; }
  .mermaid { text-align: center; }
</style>
</head>
<body>
${body}
</body>
</html>`
}
