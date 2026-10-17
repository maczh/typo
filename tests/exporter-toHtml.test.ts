import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toHtml } from '../src/utils/exporter/toHtml'

// PRD REQ-P1-05: HTML export must succeed and emit correct document structure.

test('emits a complete standalone HTML document with headings and paragraphs', async () => {
  const html = await toHtml('# Hello\n\nA paragraph of **bold** text.')
  assert.match(html, /<!doctype html>/i)
  assert.match(html, /<html[\s>]/i)
  assert.match(html, /<body>/i)
  assert.match(html, /<h1[^>]*>.*Hello.*<\/h1>/s)
  assert.match(html, /A paragraph of/)
})

test('renders fenced code blocks', async () => {
  const html = await toHtml('```js\nconst x = 1\n```')
  assert.match(html, /<pre[ >]/)
  assert.match(html, /<code[ >]/)
  // rehype-highlight tokenises the source into spans, so assert on tokens
  assert.match(html, /class="hljs language-js"/)
  assert.match(html, /const/)
  assert.match(html, /1/)
})

test('renders GFM tables', async () => {
  const md = '| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |'
  const html = await toHtml(md)
  assert.match(html, /<table[ >]/)
  assert.match(html, /<th[ >]/)
  assert.match(html, /<td[ >]/)
  assert.match(html, /Alice/)
  assert.match(html, /Bob/)
})

test('pre-renders inline and block math via KaTeX (math-inline / math-block wrappers)', async () => {
  const html = await toHtml('Inline $x^2$ and block:\n\n$$\\int_0^1 x\\,dx$$')
  assert.match(html, /class="math-inline"/)
  assert.match(html, /class="math-block"/)
  // KaTeX injects its own markup when rendering succeeds
  assert.match(html, /katex/)
})

test('escapes the document title so it cannot inject markup', async () => {
  const html = await toHtml('# ignored', '<script>alert(1)</script>')
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.match(html, /<title>&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/)
})

test('inlines the KaTeX stylesheet so the file is offline-friendly', async () => {
  const html = await toHtml('# x')
  assert.match(html, /<style>/)
  // The katex CSS is imported via Vite's `?raw`; under Node we stub it with a
  // placeholder that still contains the `katex` class namespace, proving the
  // stylesheet is inlined into the document head.
  assert.match(html, /katex/i)
})


test('removes executable HTML while retaining safe markup and math', async () => {
  const html = await toHtml('<script>window.pwned=1</script>\n\n<img src="x" onerror="alert(1)">\n\n<a href="javascript:alert(1)">bad</a> <u>safe</u> $x$')
  assert.doesNotMatch(html, /<script|onerror=|href="javascript:/i)
  assert.match(html, /<u>safe<\/u>/)
  assert.match(html, /class="math-inline"/)
})

test('math export preserves literal dollars in inline and fenced code', async () => {
  const html = await toHtml('`$literal$`\n\n```text\n$$not math$$\n```')
  assert.match(html, /<code>\$literal\$<\/code>/)
  assert.match(html, /\$\$not math\$\$/)
  const body = html.split('<body>')[1]
  assert.doesNotMatch(body, /math-inline|math-block|class="katex"/)
})
