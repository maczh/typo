import puppeteer from 'puppeteer-core'

const URL = 'http://127.0.0.1:1420/?e2e=1'
const results = {}
const consoleErrors = []

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })

await page.waitForFunction(
  () =>
    window.__typo &&
    document.querySelector('.ProseMirror') &&
    document.querySelector('.ProseMirror').getAttribute('contenteditable') === 'true',
  { timeout: 30000 },
)

/* ---- Requirement 1: right "大纲/导出" panel removed ---- */
results.rightPanel = await page.evaluate(() => ({
  exists: !!document.querySelector('.right-panel'),
  count: document.querySelectorAll('.right-panel').length,
}))

/* ---- Requirement 2: content column ~70% + resize handle + drag + reset ---- */
results.width = await page.evaluate(() => {
  const milk = document.querySelector('.milkdown')
  const pane = document.querySelector('.editor-pane')
  if (!milk || !pane) return { ok: false, reason: 'missing .milkdown/.editor-pane' }
  const mw = milk.getBoundingClientRect().width
  const pw = pane.getBoundingClientRect().width
  const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--content-width').trim()
  return { ratio: +(mw / pw).toFixed(3), cssVar, mw: Math.round(mw), pw: Math.round(pw) }
})

results.handle = await page.evaluate(() => ({
  exists: !!document.querySelector('.content-resize-handle'),
}))

results.drag = await page.evaluate(async () => {
  const handle = document.querySelector('.content-resize-handle')
  const pane = document.querySelector('.editor-pane')
  if (!handle || !pane) return { ok: false }
  const hb = handle.getBoundingClientRect()
  const pw = pane.getBoundingClientRect().width
  const startX = hb.left + hb.width / 2
  const y = hb.top + 10
  const moveBy = Math.round(pw * 0.15)
  handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: startX, clientY: y, pointerId: 1 }))
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: startX + moveBy, clientY: y, pointerId: 1 }))
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: startX + moveBy, clientY: y, pointerId: 1 }))
  await new Promise((r) => setTimeout(r, 300))
  const milk = document.querySelector('.milkdown')
  const ratio = milk.getBoundingClientRect().width / pw
  const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--content-width').trim()
  return { ratioAfterDrag: +ratio.toFixed(3), cssVar }
})

results.reset = await page.evaluate(async () => {
  const handle = document.querySelector('.content-resize-handle')
  handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }))
  await new Promise((r) => setTimeout(r, 300))
  const milk = document.querySelector('.milkdown')
  const pane = document.querySelector('.editor-pane')
  const ratio = milk.getBoundingClientRect().width / pane.getBoundingClientRect().width
  const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--content-width').trim()
  return { ratioAfterReset: +ratio.toFixed(3), cssVar }
})

/* ---- Requirement 3: code block uses a LIGHT (not oneDark) theme ---- */
await page.evaluate(() => {
  window.__typo.loadMarkdown(
    '# Code\n\n```js\nconst x = 1\nfunction foo() {\n  return x + 2\n}\n```\n',
  )
})
await page.waitForSelector('.milkdown-code-block .cm-editor', { timeout: 15000 })
results.codeBlock = await page.evaluate(async () => {
  await new Promise((r) => setTimeout(r, 600))
  const block = document.querySelector('.milkdown-code-block')
  if (!block) return { ok: false, reason: 'no .milkdown-code-block' }
  const cm = block.querySelector('.cm-editor')
  const gutters = block.querySelector('.cm-gutters')
  const content = block.querySelector('.cm-content')
  const gutterBg = gutters ? getComputedStyle(gutters).backgroundColor : null
  const contentColor = content ? getComputedStyle(content).color : null
  const oneDark = 'rgb(40, 44, 52)' // #282c34 from @codemirror/theme-one-dark
  const isLightGutter = gutterBg != null && gutterBg !== oneDark
  const tokenSpans = block.querySelectorAll('.cm-line span').length
  const copyBtn = !!block.querySelector('button')
  return {
    ok: true,
    gutterBg,
    contentColor,
    isLightGutter,
    hasSyntaxTokens: tokenSpans > 0,
    tokenSpans,
    copyButton: copyBtn,
  }
})

/* ---- Requirement 4a: mermaid hides source when caret is elsewhere, shows diagram ---- */
const mermaidMd = [
  '# Mermaid',
  '',
  '```mermaid',
  'graph TD',
  '  A[Start] --> B{Decision}',
  '  B -->|Yes| C[OK]',
  '  B -->|No| D[End]',
  '```',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant U as User',
  '  participant S as System',
  '  U->>S: Request',
  '  S-->>U: Response',
  '```',
].join('\n')

await page.evaluate((md) => window.__typo.loadMarkdown(md), mermaidMd)
await page.waitForFunction(
  () => document.querySelectorAll('.typo-mermaid-diagram.is-ready svg').length >= 2,
  { timeout: 15000 },
)
results.mermaid = await page.evaluate(() => {
  const diagrams = document.querySelectorAll('.typo-mermaid-diagram')
  const ready = document.querySelectorAll('.typo-mermaid-diagram.is-ready svg')
  const hidden = document.querySelectorAll('.typo-mermaid-source-hidden')
  const codeBlocks = document.querySelectorAll('.milkdown-code-block')
  const mermaidBlocks = Array.from(codeBlocks).filter(
    (b) => (b.getAttribute('data-language') || '').toLowerCase() === 'mermaid',
  )
  return {
    diagramCount: diagrams.length,
    readySvgCount: ready.length,
    sourceHiddenCount: hidden.length,
    mermaidCodeBlockCount: mermaidBlocks.length,
    sampleSvgLen: ready[0] ? ready[0].outerHTML.length : 0,
  }
})

/* ---- Requirement 4b: clicking a diagram reveals its source ---- */
results.mermaidClick = await page.evaluate(async () => {
  const diag = document.querySelector('.typo-mermaid-diagram')
  if (!diag) return { ok: false }
  const before = document.querySelectorAll('.typo-mermaid-source-hidden').length
  diag.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  await new Promise((r) => setTimeout(r, 500))
  const after = document.querySelectorAll('.typo-mermaid-source-hidden').length
  return { hiddenBeforeClick: before, hiddenAfterClick: after, revealed: after < before }
})

/* ---- Requirement 4c: ALL mermaid diagram formats render (no errors) ---- */
const formatsMd = [
  '# All formats',
  '```mermaid',
  'flowchart LR\n  a-->b-->c',
  '```',
  '```mermaid',
  'classDiagram\n  class A {\n    +foo()\n  }',
  '```',
  '```mermaid',
  'stateDiagram-v2\n  s1 --> s2',
  '```',
  '```mermaid',
  'erDiagram\n  USER ||--o{ POST : writes',
  '```',
  '```mermaid',
  'gantt\n  section A\n  task1 :a1, 2024-01-01, 1d',
  '```',
  '```mermaid',
  'pie title Pets\n  "Dogs" : 40\n  "Cats" : 35',
  '```',
  '```mermaid',
  'journey\n  title Trip\n  section Go\n    A: 5: Me',
  '```',
  '```mermaid',
  'gitGraph\n  commit\n  branch dev\n  commit',
  '```',
  '```mermaid',
  'mindmap\n  root((Root))\n    A\n    B',
  '```',
].join('\n')

await page.evaluate((md) => window.__typo.loadMarkdown(md), formatsMd)
await page.waitForFunction(
  () => {
    const total = document.querySelectorAll('.typo-mermaid-diagram').length
    const ready = document.querySelectorAll('.typo-mermaid-diagram.is-ready svg').length
    const err = document.querySelectorAll('.typo-mermaid-status.error').length
    return total > 0 && ready + err >= total
  },
  { timeout: 25000 },
)
results.mermaidFormats = await page.evaluate(() => {
  const total = document.querySelectorAll('.typo-mermaid-diagram').length
  const ready = document.querySelectorAll('.typo-mermaid-diagram.is-ready svg').length
  const err = document.querySelectorAll('.typo-mermaid-status.error').length
  return { total, ready, error: err }
})

results.consoleErrors = consoleErrors.slice(0, 20)
console.log(JSON.stringify(results, null, 2))
await browser.close()
