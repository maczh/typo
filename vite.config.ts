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
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        // Split heavy, optionally lazy dependencies into their own chunks so the
        // first paint stays light and mermaid/katex can be code-split.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('mermaid')) return 'vendor-mermaid'
            if (id.includes('katex')) return 'vendor-katex'
            if (id.includes('highlight.js')) return 'vendor-highlight'
            if (id.includes('docx')) return 'vendor-docx'
            if (id.includes('@milkdown') || id.includes('prosemirror')) return 'vendor-milkdown'
            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-i18n')) return 'vendor-vue'
          }
          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Tauri's `invoke` works without the optional TAURI_* env vars in dev.
  envPrefix: ['VITE_', 'TAURI_'],
})
