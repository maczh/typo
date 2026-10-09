/**
 * Sandbox-only workaround: Node cannot allocate WebAssembly memory here.
 *
 * Why this file exists
 * --------------------
 * This sandbox imposes `RLIMIT_AS = 4GB` (and runs under seccomp), so V8 can never
 * reserve the virtual address space that WebAssembly memory needs — even a 64KB
 * wasm page fails with:
 *     RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm
 *     memory for new instance
 *
 * Two things depend on wasm inside `vite build`:
 *   1. Node's own HTTP client (undici -> llhttp, wasm). Its eagerly-created
 *      instantiate promise rejects at bootstrap, and Node treats an unhandled
 *      rejection as fatal — the build dies before it prints anything.
 *   2. `es-module-lexer` (bundled by Vite 5, compiled to wasm). Vite uses it to
 *      locate static/dynamic imports and exports in every module; without it the
 *      `vite:build-import-analysis` plugin cannot run at all.
 *
 * What this shim does
 * -------------------
 * It wraps `WebAssembly.instantiate`. The REAL implementation is always attempted
 * first, so on a normal machine this module is a no-op. Only when the platform
 * genuinely cannot allocate wasm memory does it fall back to a JS object that
 * emulates es-module-lexer's wasm ABI (backed by `acorn`), plus inert no-ops for
 * anything else (covers undici/llhttp, which a local build never uses for HTTP).
 *
 * Fields are produced to match exactly what es-module-lexer 1.5.4 hands to Vite:
 *   imports -> { n, t, s, e, ss, se, d, a }
 *   exports -> { n, s, e, ls, le, ln }
 * where for STATIC specifiers `s`/`e` bound the content between quotes, and for
 * DYNAMIC ones they bound the quotes too (Vite relies on both conventions).
 *
 * Safe to keep in the repo: when wasm works, nothing is patched.
 */
'use strict'

const { createRequire } = require('node:module')
const path = require('node:path')

/* ------------------------------------------------------------------ */
/* Probe: is this actually a machine without WebAssembly memory?       */
/* ------------------------------------------------------------------ */

function wasmMemoryWorks() {
  try {
    // A module that declares one 64KB memory page. Anything that needs real wasm
    // memory fails here too, so this is a faithful capability probe.
    const bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1])
    new WebAssembly.Instance(new WebAssembly.Module(bytes))
    return true
  } catch {
    return false
  }
}

if (wasmMemoryWorks()) {
  // Nothing to do: leave Node completely untouched on normal machines.
  return
}

// The platform-level wasm failure surfaces as an unhandled rejection, which Node
// escalates to a fatal error. Downgrade it; anything genuinely needed still fails
// loudly on its own.
process.on('unhandledRejection', (err) => {
  const msg = err && typeof err.message === 'string' ? err.message : ''
  if (/wasm memory/i.test(msg)) return
  console.warn('[no-wasm] unhandled rejection:', err && err.message)
})

/* ------------------------------------------------------------------ */
/* Parser binding                                                       */
/* ------------------------------------------------------------------ */

let acorn = null
function loadAcorn() {
  if (acorn) return acorn
  const require_ = createRequire(__filename)
  const candidates = [
    path.join(__dirname, '..', 'node_modules', 'acorn'),
    path.join(process.cwd(), 'node_modules', 'acorn'),
    'acorn',
  ]
  for (const candidate of candidates) {
    try {
      acorn = require_(candidate)
      return acorn
    } catch {
      /* try next candidate */
    }
  }
  return null
}

function parseAst(source) {
  const parser = loadAcorn()
  if (!parser) throw new Error('[no-wasm] acorn is unavailable; cannot replace es-module-lexer')
  const base = {
    ecmaVersion: 'latest',
    ranges: true,
    allowHashBang: true,
    allowReturnOutsideFunction: true,
    allowAwaitOutsideFunction: true,
    allowSuperOutsideMethod: true,
    allowImportExportEverywhere: true,
  }
  try {
    return parser.parse(source, { ...base, sourceType: 'module' })
  } catch (moduleError) {
    // Fall back to sloppy/global parsing (Vite feeds arbitrary files here), but
    // keep throwing for genuinely unparsable input so Vite's own retry paths
    // (e.g. the JSX loader fallback) still engage.
    try {
      return parser.parse(source, { ...base, sourceType: 'script' })
    } catch {
      const err = new SyntaxError(`Parse error: ${moduleError.message}`)
      err.idx = moduleError.pos || 0
      throw err
    }
  }
}

/* ------------------------------------------------------------------ */
/* Source scanning -> es-module-lexer records                           */
/* ------------------------------------------------------------------ */

const ImportType = { Static: 1, Dynamic: 2, ImportMeta: 3 }

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  if (typeof node.type === 'string') visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') {
      continue
    }
    walk(node[key], visit)
  }
}

function makeSpecifier(node, sourceNode, type) {
  const isDynamic = type === ImportType.Dynamic
  if (sourceNode && sourceNode.start !== undefined) {
    return {
      n: sourceNode.type === 'Literal' ? sourceNode.value : null,
      // Static: content bounds (quotes excluded). Dynamic: quotes included.
      s: isDynamic ? sourceNode.start : sourceNode.start + 1,
      e: isDynamic ? sourceNode.end : sourceNode.end - 1,
      ss: node.start,
      se: node.end,
      d: isDynamic ? node.start : -1,
      t: type,
      a: -1,
    }
  }
  return {
    n: null,
    s: node.start,
    e: node.end,
    ss: node.start,
    se: node.end,
    d: isDynamic ? node.start : -1,
    t: type,
    a: -1,
  }
}

function attributeIndex(node) {
  const list = node.attributes || node.assertions
  return list && list.length > 0 ? list[0].start : -1
}

function scanSource(source) {
  const ast = parseAst(source)
  const imports = []
  const exports = []
  let hasModuleSyntax = false

  const addExport = (name, s, e, ln, ls, le) => {
    exports.push({
      n: name,
      s: s === undefined ? -1 : s,
      e: e === undefined ? -1 : e,
      ls: ls === undefined ? -1 : ls,
      le: le === undefined ? -1 : le,
      ln,
    })
  }

  walk(ast, (node) => {
    switch (node.type) {
      case 'ImportDeclaration': {
        hasModuleSyntax = true
        const record = makeSpecifier(node, node.source, ImportType.Static)
        record.a = attributeIndex(node)
        imports.push(record)
        break
      }
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration': {
        hasModuleSyntax = true
        if (node.source) {
          const record = makeSpecifier(node, node.source, ImportType.Static)
          record.a = attributeIndex(node)
          imports.push(record)
        }
        if (node.type === 'ExportAllDeclaration') {
          if (node.exported) {
            const target = node.exported
            const value = target.type === 'Literal' ? target.value : target.name
            addExport(value, target.start, target.end, value, -1, -1)
          } else {
            addExport(null, -1, -1, null, -1, -1)
          }
          break
        }
        if (Array.isArray(node.specifiers) && node.specifiers.length > 0) {
          for (const spec of node.specifiers) {
            const exported = spec.exported || spec.local
            const local = spec.local || null
            const name = exported.type === 'Literal' ? exported.value : exported.name
            const ln = local ? (local.type === 'Literal' ? local.value : local.name) : null
            addExport(name, exported.start, exported.end, ln, local ? local.start : -1, local ? local.end : -1)
          }
        } else if (node.declaration && node.declaration.id && node.declaration.id.name) {
          const id = node.declaration.id
          addExport(id.name, id.start, id.end, id.name, id.start, id.end)
        }
        break
      }
      case 'ExportDefaultDeclaration': {
        hasModuleSyntax = true
        const at = source.indexOf('default', node.start)
        addExport('default', at, at + 'default'.length, undefined, -1, -1)
        break
      }
      case 'ImportExpression': {
        hasModuleSyntax = true
        imports.push(makeSpecifier(node, node.source, ImportType.Dynamic))
        break
      }
      case 'MetaProperty': {
        if (node.meta && node.meta.name === 'import' && node.property && node.property.name === 'meta') {
          hasModuleSyntax = true
          // Vite compares `source.slice(s, e)` against the literal "import.meta".
          imports.push({
            n: undefined,
            s: node.start,
            e: node.end,
            ss: node.start,
            se: node.end,
            d: -1,
            t: ImportType.ImportMeta,
            a: -1,
          })
        }
        break
      }
      default:
        break
    }
  })

  return { imports, exports, facade: false, hasModuleSyntax }
}

/* ------------------------------------------------------------------ */
/* Emulation of es-module-lexer's wasm exports                          */
/* ------------------------------------------------------------------ */

function createLexerExports() {
  const HEAP_BASE = 65536
  let buffer = new ArrayBuffer(4 * 1024 * 1024)

  const memory = {
    get buffer() {
      return buffer
    },
    grow(pages) {
      const prevPages = buffer.byteLength / 65536
      const next = new ArrayBuffer((prevPages + pages) * 65536)
      new Uint8Array(next).set(new Uint8Array(buffer))
      buffer = next
      return prevPages
    },
  }

  let writeLength = 0
  let result = { imports: [], exports: [], facade: false, hasModuleSyntax: false }
  let importCursor = null
  let importIndex = 0
  let exportCursor = null
  let exportIndex = 0
  let errorIdx = 0

  const decodeSource = () => {
    const units = new Uint16Array(buffer, HEAP_BASE, writeLength + 1)
    let text = ''
    for (let i = 0; i < writeLength; i++) text += String.fromCharCode(units[i])
    return text
  }

  return {
    get memory() {
      return memory
    },
    get __heap_base() {
      return HEAP_BASE
    },
    sa(length) {
      writeLength = length
      return HEAP_BASE
    },
    parse() {
      try {
        result = scanSource(decodeSource())
      } catch (err) {
        errorIdx = err && typeof err.idx === 'number' ? err.idx : 0
        return 0
      }
      importIndex = 0
      exportIndex = 0
      importCursor = null
      exportCursor = null
      return 1
    },
    e() {
      return errorIdx
    },

    // `ri()` / `re()` check AND advance the cursor (matching the C bindings).
    ri() {
      if (importIndex >= result.imports.length) return 0
      importCursor = result.imports[importIndex++]
      return 1
    },
    is() {
      return importCursor ? importCursor.s : 0
    },
    ie() {
      return importCursor ? importCursor.e : 0
    },
    it() {
      return importCursor ? importCursor.t : 0
    },
    ai() {
      return importCursor ? importCursor.a : -1
    },
    id() {
      return importCursor ? importCursor.d : -1
    },
    ss() {
      return importCursor ? importCursor.ss : 0
    },
    se() {
      return importCursor ? importCursor.se : 0
    },
    ip() {
      return importCursor && importCursor.n !== undefined && importCursor.n !== null ? 1 : 0
    },

    re() {
      if (exportIndex >= result.exports.length) return 0
      exportCursor = result.exports[exportIndex++]
      return 1
    },
    es() {
      return exportCursor ? exportCursor.s : 0
    },
    ee() {
      return exportCursor ? exportCursor.e : 0
    },
    els() {
      return exportCursor ? exportCursor.ls : -1
    },
    ele() {
      return exportCursor ? exportCursor.le : -1
    },

    f() {
      return result.facade ? 1 : 0
    },
    ms() {
      return result.hasModuleSyntax ? 1 : 0
    },
  }
}

/* ------------------------------------------------------------------ */
/* Fallback wiring                                                      */
/* ------------------------------------------------------------------ */

function createInert(exportsObject) {
  return {
    module: {},
    instance: { exports: exportsObject },
    // Some consumers destructure `{ exports }` straight off the instantiate result.
    exports: exportsObject,
  }
}

/* ------------------------------------------------------------------ */
/* In-process worker_threads emulation                                  */
/* ------------------------------------------------------------------ */

/**
 * Node worker threads each spin up another V8 isolate, and an isolate reserves
 * several GB of *virtual* address space. With a tight RLIMIT_AS there is room for
 * exactly one isolate, so every spawned thread aborts with
 * "Failed to reserve virtual memory for CodeRange" (this is what kills the
 * terser minification step). Emulating `worker_threads.Worker` inside the current
 * process keeps tools like Vite working unchanged — the worker payload still runs,
 * just on the main isolate, connected over a MessageChannel.
 */
const DEBUG = Boolean(process.env.TYPO_TRACE_WORKERS)
const trace = (...args) => {
  if (DEBUG) console.error('[in-process-worker]', ...args)
}

function installInProcessWorkers() {
  const workerThreads = require('node:worker_threads')
  const { EventEmitter } = require('node:events')
  const { createRequire } = require('node:module')

  const RealWorker = workerThreads.Worker
  if (!RealWorker) return

  class InProcessWorker extends EventEmitter {
    constructor(code, options = {}) {
      super()
      const require_ = createRequire(__filename)
      const channel = new workerThreads.MessageChannel()
      const parentPort = channel.port1
      const childPort = channel.port2

      trace('created', { options })

      this._port = childPort
      this._stopped = false

      childPort.on('message', (message) => {
        trace('message from worker ->', Object.keys(message || {}).join(','))
        if (!this._stopped) this.emit('message', message)
      })
      childPort.on('error', (err) => this.emit('error', err))

      const fakeWorkers = {
        parentPort: {
          on: (event, handler) => parentPort.on(event, handler),
          once: (event, handler) => parentPort.once(event, handler),
          postMessage: (message) => {
            trace('worker -> parent', Object.keys(message || {}).join(','))
            parentPort.postMessage(message)
          },
          close: () => parentPort.close(),
          unref: () => parentPort.unref(),
          ref: () => parentPort.ref(),
        },
        workerData: options.workerData,
        isMainThread: false,
        threadId: 1,
        resourceLimits: {},
      }
      const patchedRequire = (id) => {
        if (id === 'worker_threads' || id === 'node:worker_threads') return fakeWorkers
        return require_(id)
      }

      try {
        const run = new Function('require', '__dirname', '__filename', `"use strict";\n${code}`)
        run(patchedRequire, require('node:path').dirname(__filename), __filename)
        trace('worker code evaluated OK')
        parentPort.unref?.()
        childPort.unref?.()
      } catch (err) {
        trace('worker code FAILED:', err && err.message)
        process.nextTick(() => this.emit('error', err))
      }
    }

    postMessage(message) {
      const keys = Object.keys(message || {}).join(',')
      trace('postMessage ->', keys, this._stopped ? '(stopped, dropped)' : '')
      if (this._stopped) return
      this._port.postMessage(message)
    }

    ref() {}

    unref() {
      try {
        this._port.unref?.()
      } catch {
        /* ignore */
      }
    }

    terminate() {
      this._stopped = true
      try {
        this._port.close()
      } catch {
        /* ignore */
      }
      return Promise.resolve(0)
    }
  }

  try {
    workerThreads.Worker = InProcessWorker
  } catch {
    /* module is read-only in some runtimes; leave it alone */
  }
}

installInProcessWorkers()

const originalInstantiate = WebAssembly.instantiate

WebAssembly.instantiate = function instantiate(bytesOrModule, importObject) {
  return Promise.resolve(originalInstantiate.call(this, bytesOrModule, importObject)).catch(
    (err) => {
      if (!/wasm memory/i.test((err && err.message) || '')) throw err
      return createInert(createLexerExports())
    },
  )
}
