import puppeteer from 'puppeteer-core'

const URL = 'http://127.0.0.1:1420/?e2e=1'
const out = {}
const errors = []

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForFunction(
  () => window.__typo && document.querySelector('.ProseMirror[contenteditable="true"]'),
  { timeout: 30000 },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function centerOf(sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, sel)
}

async function load(md) {
  await page.evaluate((m) => window.__typo.loadMarkdown(m), md)
  await sleep(400)
}

/* ---- Feature 1: Markdown marker at the caret ---- */
await load('# 一级标题\n\n## 标题2内容\n\n这是普通段落\n')
let c = await centerOf('.milkdown h2')
if (c) await page.mouse.click(c.x, c.y)
await sleep(200)
out.markerOnHeading = await page.evaluate(() => {
  const m = document.querySelector('.typo-md-marker')
  return { exists: !!m, text: m ? m.textContent : null }
})
c = await centerOf('.milkdown p')
if (c) await page.mouse.click(c.x, c.y)
await sleep(200)
out.markerAfterLeave = await page.evaluate(() => !!document.querySelector('.typo-md-marker'))

/* ---- Feature 4: Ctrl+1 → H1 style ---- */
await load('普通段落文字\n')
c = await centerOf('.milkdown p')
if (c) await page.mouse.click(c.x, c.y)
await sleep(150)
await page.keyboard.down('Control')
await page.keyboard.press('1')
await page.keyboard.up('Control')
await sleep(300)
out.ctrl1 = await page.evaluate(async () => {
  const md = await window.__typo.getMarkdown()
  return { h1Count: document.querySelectorAll('.milkdown h1').length, mdHasH1: /^# /m.test(md) }
})

/* ---- Feature 5/6: context menu on a paragraph ---- */
await load('右键测试段落\n')
c = await centerOf('.milkdown p')
if (c) await page.mouse.click(c.x, c.y, { button: 'right' })
await sleep(250)
out.paragraphMenu = await page.evaluate(() => {
  const menu = document.querySelector('.ctx-menu')
  if (!menu) return { exists: false }
  const text = menu.textContent || ''
  return {
    exists: true,
    bars: menu.querySelectorAll('.ctx-bar').length,
    hasStyle: /段落|Paragraph/.test(text),
    hasInsert: /插入|Insert/.test(text),
    hasTableSection: /表格|Table/.test(text),
  }
})
// hover the first submenu parent to reveal the style submenu
const styleItem = await page.evaluate(() => {
  const it = document.querySelector('.ctx-menu .ctx-item.has-sub')
  if (!it) return null
  const r = it.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
if (styleItem) {
  await page.mouse.move(styleItem.x, styleItem.y)
  await sleep(200)
}
out.styleSubmenu = await page.evaluate(() => {
  const sub = document.querySelector('.ctx-submenu')
  if (!sub) return { exists: false }
  const items = Array.from(sub.querySelectorAll('.ctx-row-item .lbl')).map((e) => e.textContent.trim())
  return { exists: true, count: items.length, sample: items.slice(0, 8) }
})
await page.keyboard.press('Escape')
await sleep(150)

/* ---- Feature 2: table styling + Feature 6: table context menu ---- */
await load('# 表格\n\n| A | B |\n| --- | --- |\n| averyveryverylongtokenthatshouldwrap | b |\n')
out.tableCss = await page.evaluate(() => {
  const t = document.querySelector('.milkdown table')
  if (!t) return { exists: false }
  const td = t.querySelector('td')
  const cs = getComputedStyle(t)
  const tdcs = td ? getComputedStyle(td) : null
  return {
    exists: true,
    tableLayout: cs.tableLayout,
    tdBorderColor: tdcs ? tdcs.borderTopColor : null,
    tdOverflowWrap: tdcs ? tdcs.overflowWrap : null,
  }
})
const cell = await page.evaluate(() => {
  const el = document.querySelector('.milkdown table td')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
})
if (cell) await page.mouse.click(cell.x, cell.y, { button: 'right' })
await sleep(250)
out.tableMenu = await page.evaluate(() => {
  const menu = document.querySelector('.ctx-menu')
  if (!menu) return { exists: false }
  const text = menu.textContent || ''
  return {
    exists: true,
    hasTableSection: /表格|Table/.test(text),
    hasInsertRow: /插入行|Insert row/.test(text),
    hasStyleSection: /段落|Paragraph/.test(text),
  }
})
await page.keyboard.press('Escape')
await sleep(150)

/* ---- Feature 3: code block fold-gutter triangle hidden ---- */
await load('# 代码\n\n```js\nconst x = 1\nfunction foo() {\n  return x\n}\n```\n')
await page.waitForSelector('.milkdown-code-block .cm-editor', { timeout: 15000 }).catch(() => {})
await sleep(500)
out.foldGutter = await page.evaluate(() => {
  const g = document.querySelector('.milkdown-code-block .cm-foldGutter')
  if (!g) return { exists: false }
  return { exists: true, display: getComputedStyle(g).display, visible: g.getBoundingClientRect().width > 0 }
})

out.consoleErrors = errors.slice(0, 15)
console.log(JSON.stringify(out, null, 2))
await browser.close()
