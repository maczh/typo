import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table as DocxTable,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'

// mdast node — typed loosely because @types/mdast is not a project dependency.
interface MdNode {
  type: string
  value?: string
  depth?: number
  ordered?: boolean
  children?: MdNode[]
  [key: string]: unknown
}

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
]

function inlineText(nodes: MdNode[] | undefined): string {
  return (nodes || []).map((n) => {
    if (n.type === 'text' || n.type === 'inlineCode') return n.value || ''
    if (n.children) return inlineText(n.children)
    return ''
  }).join('')
}

function inlineToRuns(nodes: MdNode[] | undefined): TextRun[] {
  const runs: TextRun[] = []
  for (const n of nodes || []) {
    if (n.type === 'text') {
      runs.push(new TextRun(n.value || ''))
    } else if (n.type === 'strong') {
      runs.push(new TextRun({ text: inlineText(n.children), bold: true }))
    } else if (n.type === 'emphasis') {
      runs.push(new TextRun({ text: inlineText(n.children), italics: true }))
    } else if (n.type === 'inlineCode') {
      runs.push(new TextRun({ text: n.value || '', font: 'Courier New' }))
    } else if (n.type === 'link') {
      runs.push(new TextRun({ text: inlineText(n.children), underline: {} }))
    } else if (n.type === 'image') {
      runs.push(new TextRun(n.alt ? String(n.alt) : '[image]'))
    } else {
      runs.push(new TextRun(inlineText([n])))
    }
  }
  return runs.length ? runs : [new TextRun('')]
}

function mdastToDocxChildren(nodes: MdNode[] | undefined): (Paragraph | DocxTable)[] {
  const out: (Paragraph | DocxTable)[] = []
  for (const n of nodes || []) {
    switch (n.type) {
      case 'heading': {
        const level = Math.min(Math.max(n.depth || 1, 1), 6) - 1
        out.push(
          new Paragraph({
            heading: HEADING_LEVELS[level],
            children: inlineToRuns(n.children),
          }),
        )
        break
      }
      case 'paragraph':
        out.push(new Paragraph({ children: inlineToRuns(n.children) }))
        break
      case 'code':
        out.push(new Paragraph({ children: [new TextRun({ text: n.value || '', font: 'Courier New' })] }))
        break
      case 'blockquote':
        out.push(...mdastToDocxChildren(n.children))
        break
      case 'list':
        ;(n.children || []).forEach((item: MdNode, i: number) => {
          const prefix = n.ordered ? `${i + 1}. ` : '• '
          const text = inlineText(item.children?.[0]?.children)
          out.push(new Paragraph({ children: [new TextRun(prefix + text)] }))
        })
        break
      case 'table': {
        const rows = (n.children || []).map(
          (row: MdNode) =>
            new TableRow({
              children: (row.children || []).map(
                (cell: MdNode) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: inlineToRuns((cell.children?.[0] as MdNode)?.children),
                      }),
                    ],
                  }),
              ),
            }),
        )
        out.push(
          new DocxTable({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        )
        break
      }
      case 'thematicBreak':
        out.push(
          new Paragraph({
            border: {
              bottom: { color: '999999', space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          }),
        )
        break
      default:
        if (n.children) out.push(...mdastToDocxChildren(n.children))
    }
  }
  return out
}

/** Build a .docx Blob from Markdown, preserving heading levels and tables. */
export async function toDocx(markdown: string, title = 'Document'): Promise<Blob> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as unknown as MdNode
  const children = mdastToDocxChildren(tree.children)
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: children.length ? children : [new Paragraph(title)],
      },
    ],
  })
  return Packer.toBlob(doc)
}
