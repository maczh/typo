/**
 * jsdom harness for `probe.ts`.
 *
 * jsdom has no layout engine and Node 22 ships its own `Event`/`navigator`, so the
 * DOM globals are force-installed and a handful of layout APIs are stubbed. ProseMirror
 * only needs the *existence* of these methods to build and dispatch transactions.
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
})
const win = dom.window

// Install the window's globals on globalThis (Node's own `Event`, `MutationObserver`,
// `Range` … must be shadowed), but NOT the timer/async family: jsdom's Window.js calls
// the *global* `setTimeout` internally, so re-pointing globalThis.setTimeout at it
// recurses until the stack blows.
const SKIP = new Set([
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'queueMicrotask',
  'process',
  'global',
  'globalThis',
  'console',
  'performance',
  'fetch',
  'crypto',
  'Blob',
  'File',
  'FormData',
  'Headers',
  'Request',
  'Response',
  'AbortController',
  'AbortSignal',
  'structuredClone',
  'TextEncoder',
  'TextDecoder',
  'URL',
  'URLSearchParams',
  'WebSocket',
  'EventSource',
  'MessageChannel',
  'MessagePort',
  'BroadcastChannel',
])

for (const key of Object.getOwnPropertyNames(win)) {
  if (key === 'undefined' || SKIP.has(key)) continue
  try {
    Object.defineProperty(globalThis, key, { value: win[key], configurable: true, writable: true })
  } catch {
    /* getter-only global we cannot shadow */
  }
}
try {
  Object.defineProperty(globalThis, 'navigator', { value: win.navigator, configurable: true })
} catch {
  /* already shadowed */
}
globalThis.window = win
globalThis.document = win.document
globalThis.getComputedStyle = win.getComputedStyle.bind(win)
globalThis.requestAnimationFrame = win.requestAnimationFrame.bind(win)
globalThis.cancelAnimationFrame = win.cancelAnimationFrame.bind(win)
// EventTarget methods live on the prototype, so `getOwnPropertyNames(win)` misses them.
for (const method of ['addEventListener', 'removeEventListener', 'dispatchEvent']) {
  globalThis[method] = win[method].bind(win)
}

const rect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }

function rectList() {
  const list = [rect]
  list.item = (i) => list[i] ?? null
  return list
}

for (const proto of [win.Range.prototype, win.Element.prototype, win.Text.prototype]) {
  proto.getClientRects = () => rectList()
  proto.getBoundingClientRect = () => rect
}
win.Element.prototype.scrollIntoView = function scrollIntoView() {}
win.document.elementFromPoint = () => null
win.document.caretRangeFromPoint = () => null
win.document.caretPositionFromPoint = () => null

if (!win.ResizeObserver) {
  win.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = win.ResizeObserver
}
if (!win.IntersectionObserver) {
  win.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  globalThis.IntersectionObserver = win.IntersectionObserver
}
if (!win.matchMedia) {
  win.matchMedia = () => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  })
  globalThis.matchMedia = win.matchMedia
}
if (!win.requestIdleCallback) {
  win.requestIdleCallback = (cb) => win.setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 5 }), 0)
  globalThis.requestIdleCallback = win.requestIdleCallback
}

const errors = []
win.addEventListener('error', (e) => errors.push(String(e.error ?? e.message)))

process.on('uncaughtException', (e) => {
  console.error('UNCAUGHT:', e && e.stack ? e.stack : e)
  process.exit(3)
})

// jsdom's atob is spec-strict and chokes on the (unpadded) base64 blob that
// `entities` – pulled in through vue's CJS entry – decodes at import time. Swap in
// lenient Buffer-based versions so the bundle can load.
globalThis.atob = (s) => Buffer.from(String(s), 'base64').toString('binary')
globalThis.btoa = (s) => Buffer.from(String(s), 'binary').toString('base64')
win.atob = globalThis.atob
win.btoa = globalThis.btoa

let result
try {
  const mod = await import('./bundle.mjs')
  result = await mod.run()
} catch (e) {
  console.error('THREW:', e && e.stack ? e.stack : e)
  process.exit(4)
}

console.log(JSON.stringify({ result, windowErrors: errors }, null, 2))
