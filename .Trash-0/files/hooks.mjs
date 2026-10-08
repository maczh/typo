// ESM loader hooks: resolve the `@/` path alias (-> src/) and stub Vite-only
// `?raw` / `.css` imports so the pure-logic modules can run under Node.
import { pathToFileURL } from 'node:url'
import { resolve as pathResolve } from 'node:path'

const SRC = pathToFileURL(pathResolve(process.cwd(), 'src')).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(SRC + specifier.slice(2), context)
  }
  // Vite-only asset imports (e.g. `katex/dist/katex.min.css?raw`).
  if (specifier.includes('.css')) {
    return { url: 'data:text/javascript,export%20default%20%22%22', shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
