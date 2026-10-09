// vite.config.ts
import { defineConfig } from "file:///home/Macro/Work/js/src/github.com/maczh/typo/node_modules/vite/dist/node/index.js";
import vue from "file:///home/Macro/Work/js/src/github.com/maczh/typo/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///home/Macro/Work/js/src/github.com/maczh/typo/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [vue()],
  // Tauri expects a fixed port and relative base so the bundled assets resolve
  // correctly inside the webview.
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1421
    },
    watch: {
      // Don't watch the Rust source tree to avoid needless restarts.
      ignored: ["**/src-tauri/**"]
    }
  },
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
    // NOTE: esbuild's minifier reorders module init in a way that trips a
    // genuine circular-dependency TDZ inside @milkdown/components ("Cannot
    // access 've' before initialization"), which crashes the production build
    // at load time. Terser preserves init order, so we use it instead of the
    // default esbuild minifier. (Dev mode is unaffected because it serves ESM
    // modules individually.)
    minify: "terser",
    chunkSizeWarningLimit: 3e3
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  // Pre-bundle Mermaid + the CodeMirror theme + the language-data package (which
  // Crepe's code block lazy-loads per language). This keeps them in the optimized
  // deps cache so the dynamic imports during a session don't trigger a mid-session
  // re-optimize — which the sandbox bulk-delete guard would otherwise block and
  // crash the dev server.
  optimizeDeps: {
    include: ["mermaid", "@codemirror/theme-one-dark", "@codemirror/language-data"]
  },
  // Tauri's `invoke` works without the optional TAURI_* env vars in dev.
  envPrefix: ["VITE_", "TAURI_"]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG9cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL01hY3JvL1dvcmsvanMvc3JjL2dpdGh1Yi5jb20vbWFjemgvdHlwby92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG8vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFt2dWUoKV0sXG4gIC8vIFRhdXJpIGV4cGVjdHMgYSBmaXhlZCBwb3J0IGFuZCByZWxhdGl2ZSBiYXNlIHNvIHRoZSBidW5kbGVkIGFzc2V0cyByZXNvbHZlXG4gIC8vIGNvcnJlY3RseSBpbnNpZGUgdGhlIHdlYnZpZXcuXG4gIGJhc2U6ICcuLycsXG4gIGNsZWFyU2NyZWVuOiBmYWxzZSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMTQyMCxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhvc3Q6IGZhbHNlLFxuICAgIGhtcjoge1xuICAgICAgcHJvdG9jb2w6ICd3cycsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgIHBvcnQ6IDE0MjEsXG4gICAgfSxcbiAgICB3YXRjaDoge1xuICAgICAgLy8gRG9uJ3Qgd2F0Y2ggdGhlIFJ1c3Qgc291cmNlIHRyZWUgdG8gYXZvaWQgbmVlZGxlc3MgcmVzdGFydHMuXG4gICAgICBpZ25vcmVkOiBbJyoqL3NyYy10YXVyaS8qKiddLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICAvLyBOT1RFOiBlc2J1aWxkJ3MgbWluaWZpZXIgcmVvcmRlcnMgbW9kdWxlIGluaXQgaW4gYSB3YXkgdGhhdCB0cmlwcyBhXG4gICAgLy8gZ2VudWluZSBjaXJjdWxhci1kZXBlbmRlbmN5IFREWiBpbnNpZGUgQG1pbGtkb3duL2NvbXBvbmVudHMgKFwiQ2Fubm90XG4gICAgLy8gYWNjZXNzICd2ZScgYmVmb3JlIGluaXRpYWxpemF0aW9uXCIpLCB3aGljaCBjcmFzaGVzIHRoZSBwcm9kdWN0aW9uIGJ1aWxkXG4gICAgLy8gYXQgbG9hZCB0aW1lLiBUZXJzZXIgcHJlc2VydmVzIGluaXQgb3JkZXIsIHNvIHdlIHVzZSBpdCBpbnN0ZWFkIG9mIHRoZVxuICAgIC8vIGRlZmF1bHQgZXNidWlsZCBtaW5pZmllci4gKERldiBtb2RlIGlzIHVuYWZmZWN0ZWQgYmVjYXVzZSBpdCBzZXJ2ZXMgRVNNXG4gICAgLy8gbW9kdWxlcyBpbmRpdmlkdWFsbHkuKVxuICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAzMDAwLFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpLFxuICAgIH0sXG4gIH0sXG4gIC8vIFByZS1idW5kbGUgTWVybWFpZCArIHRoZSBDb2RlTWlycm9yIHRoZW1lICsgdGhlIGxhbmd1YWdlLWRhdGEgcGFja2FnZSAod2hpY2hcbiAgLy8gQ3JlcGUncyBjb2RlIGJsb2NrIGxhenktbG9hZHMgcGVyIGxhbmd1YWdlKS4gVGhpcyBrZWVwcyB0aGVtIGluIHRoZSBvcHRpbWl6ZWRcbiAgLy8gZGVwcyBjYWNoZSBzbyB0aGUgZHluYW1pYyBpbXBvcnRzIGR1cmluZyBhIHNlc3Npb24gZG9uJ3QgdHJpZ2dlciBhIG1pZC1zZXNzaW9uXG4gIC8vIHJlLW9wdGltaXplIFx1MjAxNCB3aGljaCB0aGUgc2FuZGJveCBidWxrLWRlbGV0ZSBndWFyZCB3b3VsZCBvdGhlcndpc2UgYmxvY2sgYW5kXG4gIC8vIGNyYXNoIHRoZSBkZXYgc2VydmVyLlxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ21lcm1haWQnLCAnQGNvZGVtaXJyb3IvdGhlbWUtb25lLWRhcmsnLCAnQGNvZGVtaXJyb3IvbGFuZ3VhZ2UtZGF0YSddLFxuICB9LFxuICAvLyBUYXVyaSdzIGBpbnZva2VgIHdvcmtzIHdpdGhvdXQgdGhlIG9wdGlvbmFsIFRBVVJJXyogZW52IHZhcnMgaW4gZGV2LlxuICBlbnZQcmVmaXg6IFsnVklURV8nLCAnVEFVUklfJ10sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VCxTQUFTLG9CQUFvQjtBQUN0VixPQUFPLFNBQVM7QUFDaEIsU0FBUyxlQUFlLFdBQVc7QUFGK0osSUFBTSwyQ0FBMkM7QUFLblAsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLElBQUksQ0FBQztBQUFBO0FBQUE7QUFBQSxFQUdmLE1BQU07QUFBQSxFQUNOLGFBQWE7QUFBQSxFQUNiLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFVBQVU7QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxPQUFPO0FBQUE7QUFBQSxNQUVMLFNBQVMsQ0FBQyxpQkFBaUI7QUFBQSxJQUM3QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU9iLFFBQVE7QUFBQSxJQUNSLHVCQUF1QjtBQUFBLEVBQ3pCO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBLElBQ3REO0FBQUEsRUFDRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1BLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxXQUFXLDhCQUE4QiwyQkFBMkI7QUFBQSxFQUNoRjtBQUFBO0FBQUEsRUFFQSxXQUFXLENBQUMsU0FBUyxRQUFRO0FBQy9CLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
