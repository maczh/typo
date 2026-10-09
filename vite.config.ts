import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Tauri expects a fixed port and relative base so the bundled assets resolve
  // correctly inside the webview.
  base: './',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 1421,
    },
    watch: {
      // Don't watch the Rust source tree to avoid needless restarts.
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    // NOTE: esbuild's minifier reorders module init in a way that trips a
    // genuine circular-dependency TDZ inside @milkdown/components ("Cannot
    // access 've' before initialization"), which crashes the production build
    // at load time. Terser preserves init order, so we use it instead of the
    // default esbuild minifier. (Dev mode is unaffected because it serves ESM
    // modules individually.)
    minify: 'terser',
    chunkSizeWarningLimit: 3000,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Pre-bundle Mermaid + the CodeMirror theme + the language-data package (which
  // Crepe's code block lazy-loads per language). This keeps them in the optimized
  // deps cache so the dynamic imports during a session don't trigger a mid-session
  // re-optimize — which the sandbox bulk-delete guard would otherwise block and
  // crash the dev server.
  optimizeDeps: {
    include: ['mermaid', '@codemirror/theme-one-dark', '@codemirror/language-data'],
  },
  // Tauri's `invoke` works without the optional TAURI_* env vars in dev.
  envPrefix: ['VITE_', 'TAURI_'],
})
