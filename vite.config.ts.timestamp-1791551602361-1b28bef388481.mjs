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
    chunkSizeWarningLimit: 3e3,
    rollupOptions: {
      output: {
        // Split heavy, optionally lazy dependencies into their own chunks so the
        // first paint stays light and mermaid/katex can be code-split.
        //
        // NOTE: each `@milkdown/*` sub-package is split into its OWN chunk. The
        // Milkdown packages have circular ES-module dependencies; when Rollup
        // concatenates them into a single chunk it emits a TDZ
        // ("Cannot access 'bt' before initialization") that crashed the app at
        // load time in the production build. Keeping the packages in separate
        // chunks turns that into a native cross-module (ESM) cycle, which the
        // browser resolves without a TDZ. (Dev mode was never affected because it
        // serves modules individually.)
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("mermaid")) return "vendor-mermaid";
            if (id.includes("katex")) return "vendor-katex";
            if (id.includes("highlight.js")) return "vendor-highlight";
            if (id.includes("docx")) return "vendor-docx";
            const milk = id.match(/node_modules[/\\]@milkdown[/\\]([^/\\]+)/);
            if (milk) return `vendor-milkdown-${milk[1]}`;
            if (id.includes("prosemirror")) return "vendor-prosemirror";
            if (id.includes("vue") || id.includes("pinia") || id.includes("vue-i18n")) return "vendor-vue";
          }
          return void 0;
        }
      }
    }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG9cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL01hY3JvL1dvcmsvanMvc3JjL2dpdGh1Yi5jb20vbWFjemgvdHlwby92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG8vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFt2dWUoKV0sXG4gIC8vIFRhdXJpIGV4cGVjdHMgYSBmaXhlZCBwb3J0IGFuZCByZWxhdGl2ZSBiYXNlIHNvIHRoZSBidW5kbGVkIGFzc2V0cyByZXNvbHZlXG4gIC8vIGNvcnJlY3RseSBpbnNpZGUgdGhlIHdlYnZpZXcuXG4gIGJhc2U6ICcuLycsXG4gIGNsZWFyU2NyZWVuOiBmYWxzZSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMTQyMCxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhvc3Q6IGZhbHNlLFxuICAgIGhtcjoge1xuICAgICAgcHJvdG9jb2w6ICd3cycsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgIHBvcnQ6IDE0MjEsXG4gICAgfSxcbiAgICB3YXRjaDoge1xuICAgICAgLy8gRG9uJ3Qgd2F0Y2ggdGhlIFJ1c3Qgc291cmNlIHRyZWUgdG8gYXZvaWQgbmVlZGxlc3MgcmVzdGFydHMuXG4gICAgICBpZ25vcmVkOiBbJyoqL3NyYy10YXVyaS8qKiddLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICAvLyBOT1RFOiBlc2J1aWxkJ3MgbWluaWZpZXIgcmVvcmRlcnMgbW9kdWxlIGluaXQgaW4gYSB3YXkgdGhhdCB0cmlwcyBhXG4gICAgLy8gZ2VudWluZSBjaXJjdWxhci1kZXBlbmRlbmN5IFREWiBpbnNpZGUgQG1pbGtkb3duL2NvbXBvbmVudHMgKFwiQ2Fubm90XG4gICAgLy8gYWNjZXNzICd2ZScgYmVmb3JlIGluaXRpYWxpemF0aW9uXCIpLCB3aGljaCBjcmFzaGVzIHRoZSBwcm9kdWN0aW9uIGJ1aWxkXG4gICAgLy8gYXQgbG9hZCB0aW1lLiBUZXJzZXIgcHJlc2VydmVzIGluaXQgb3JkZXIsIHNvIHdlIHVzZSBpdCBpbnN0ZWFkIG9mIHRoZVxuICAgIC8vIGRlZmF1bHQgZXNidWlsZCBtaW5pZmllci4gKERldiBtb2RlIGlzIHVuYWZmZWN0ZWQgYmVjYXVzZSBpdCBzZXJ2ZXMgRVNNXG4gICAgLy8gbW9kdWxlcyBpbmRpdmlkdWFsbHkuKVxuICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAzMDAwLFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICAvLyBTcGxpdCBoZWF2eSwgb3B0aW9uYWxseSBsYXp5IGRlcGVuZGVuY2llcyBpbnRvIHRoZWlyIG93biBjaHVua3Mgc28gdGhlXG4gICAgICAgIC8vIGZpcnN0IHBhaW50IHN0YXlzIGxpZ2h0IGFuZCBtZXJtYWlkL2thdGV4IGNhbiBiZSBjb2RlLXNwbGl0LlxuICAgICAgICAvL1xuICAgICAgICAvLyBOT1RFOiBlYWNoIGBAbWlsa2Rvd24vKmAgc3ViLXBhY2thZ2UgaXMgc3BsaXQgaW50byBpdHMgT1dOIGNodW5rLiBUaGVcbiAgICAgICAgLy8gTWlsa2Rvd24gcGFja2FnZXMgaGF2ZSBjaXJjdWxhciBFUy1tb2R1bGUgZGVwZW5kZW5jaWVzOyB3aGVuIFJvbGx1cFxuICAgICAgICAvLyBjb25jYXRlbmF0ZXMgdGhlbSBpbnRvIGEgc2luZ2xlIGNodW5rIGl0IGVtaXRzIGEgVERaXG4gICAgICAgIC8vIChcIkNhbm5vdCBhY2Nlc3MgJ2J0JyBiZWZvcmUgaW5pdGlhbGl6YXRpb25cIikgdGhhdCBjcmFzaGVkIHRoZSBhcHAgYXRcbiAgICAgICAgLy8gbG9hZCB0aW1lIGluIHRoZSBwcm9kdWN0aW9uIGJ1aWxkLiBLZWVwaW5nIHRoZSBwYWNrYWdlcyBpbiBzZXBhcmF0ZVxuICAgICAgICAvLyBjaHVua3MgdHVybnMgdGhhdCBpbnRvIGEgbmF0aXZlIGNyb3NzLW1vZHVsZSAoRVNNKSBjeWNsZSwgd2hpY2ggdGhlXG4gICAgICAgIC8vIGJyb3dzZXIgcmVzb2x2ZXMgd2l0aG91dCBhIFREWi4gKERldiBtb2RlIHdhcyBuZXZlciBhZmZlY3RlZCBiZWNhdXNlIGl0XG4gICAgICAgIC8vIHNlcnZlcyBtb2R1bGVzIGluZGl2aWR1YWxseS4pXG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHtcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbWVybWFpZCcpKSByZXR1cm4gJ3ZlbmRvci1tZXJtYWlkJ1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdrYXRleCcpKSByZXR1cm4gJ3ZlbmRvci1rYXRleCdcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnaGlnaGxpZ2h0LmpzJykpIHJldHVybiAndmVuZG9yLWhpZ2hsaWdodCdcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZG9jeCcpKSByZXR1cm4gJ3ZlbmRvci1kb2N4J1xuICAgICAgICAgICAgY29uc3QgbWlsayA9IGlkLm1hdGNoKC9ub2RlX21vZHVsZXNbL1xcXFxdQG1pbGtkb3duWy9cXFxcXShbXi9cXFxcXSspLylcbiAgICAgICAgICAgIGlmIChtaWxrKSByZXR1cm4gYHZlbmRvci1taWxrZG93bi0ke21pbGtbMV19YFxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdwcm9zZW1pcnJvcicpKSByZXR1cm4gJ3ZlbmRvci1wcm9zZW1pcnJvcidcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygndnVlJykgfHwgaWQuaW5jbHVkZXMoJ3BpbmlhJykgfHwgaWQuaW5jbHVkZXMoJ3Z1ZS1pMThuJykpIHJldHVybiAndmVuZG9yLXZ1ZSdcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpLFxuICAgIH0sXG4gIH0sXG4gIC8vIFByZS1idW5kbGUgTWVybWFpZCArIHRoZSBDb2RlTWlycm9yIHRoZW1lICsgdGhlIGxhbmd1YWdlLWRhdGEgcGFja2FnZSAod2hpY2hcbiAgLy8gQ3JlcGUncyBjb2RlIGJsb2NrIGxhenktbG9hZHMgcGVyIGxhbmd1YWdlKS4gVGhpcyBrZWVwcyB0aGVtIGluIHRoZSBvcHRpbWl6ZWRcbiAgLy8gZGVwcyBjYWNoZSBzbyB0aGUgZHluYW1pYyBpbXBvcnRzIGR1cmluZyBhIHNlc3Npb24gZG9uJ3QgdHJpZ2dlciBhIG1pZC1zZXNzaW9uXG4gIC8vIHJlLW9wdGltaXplIFx1MjAxNCB3aGljaCB0aGUgc2FuZGJveCBidWxrLWRlbGV0ZSBndWFyZCB3b3VsZCBvdGhlcndpc2UgYmxvY2sgYW5kXG4gIC8vIGNyYXNoIHRoZSBkZXYgc2VydmVyLlxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ21lcm1haWQnLCAnQGNvZGVtaXJyb3IvdGhlbWUtb25lLWRhcmsnLCAnQGNvZGVtaXJyb3IvbGFuZ3VhZ2UtZGF0YSddLFxuICB9LFxuICAvLyBUYXVyaSdzIGBpbnZva2VgIHdvcmtzIHdpdGhvdXQgdGhlIG9wdGlvbmFsIFRBVVJJXyogZW52IHZhcnMgaW4gZGV2LlxuICBlbnZQcmVmaXg6IFsnVklURV8nLCAnVEFVUklfJ10sXG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF5VCxTQUFTLG9CQUFvQjtBQUN0VixPQUFPLFNBQVM7QUFDaEIsU0FBUyxlQUFlLFdBQVc7QUFGK0osSUFBTSwyQ0FBMkM7QUFLblAsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLElBQUksQ0FBQztBQUFBO0FBQUE7QUFBQSxFQUdmLE1BQU07QUFBQSxFQUNOLGFBQWE7QUFBQSxFQUNiLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxJQUNaLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFVBQVU7QUFBQSxNQUNWLE1BQU07QUFBQSxNQUNOLE1BQU07QUFBQSxJQUNSO0FBQUEsSUFDQSxPQUFPO0FBQUE7QUFBQSxNQUVMLFNBQVMsQ0FBQyxpQkFBaUI7QUFBQSxJQUM3QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFFBQVE7QUFBQSxJQUNSLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU9iLFFBQVE7QUFBQSxJQUNSLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFZTixhQUFhLElBQUk7QUFDZixjQUFJLEdBQUcsU0FBUyxjQUFjLEdBQUc7QUFDL0IsZ0JBQUksR0FBRyxTQUFTLFNBQVMsRUFBRyxRQUFPO0FBQ25DLGdCQUFJLEdBQUcsU0FBUyxPQUFPLEVBQUcsUUFBTztBQUNqQyxnQkFBSSxHQUFHLFNBQVMsY0FBYyxFQUFHLFFBQU87QUFDeEMsZ0JBQUksR0FBRyxTQUFTLE1BQU0sRUFBRyxRQUFPO0FBQ2hDLGtCQUFNLE9BQU8sR0FBRyxNQUFNLDBDQUEwQztBQUNoRSxnQkFBSSxLQUFNLFFBQU8sbUJBQW1CLEtBQUssQ0FBQyxDQUFDO0FBQzNDLGdCQUFJLEdBQUcsU0FBUyxhQUFhLEVBQUcsUUFBTztBQUN2QyxnQkFBSSxHQUFHLFNBQVMsS0FBSyxLQUFLLEdBQUcsU0FBUyxPQUFPLEtBQUssR0FBRyxTQUFTLFVBQVUsRUFBRyxRQUFPO0FBQUEsVUFDcEY7QUFDQSxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTUEsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFdBQVcsOEJBQThCLDJCQUEyQjtBQUFBLEVBQ2hGO0FBQUE7QUFBQSxFQUVBLFdBQVcsQ0FBQyxTQUFTLFFBQVE7QUFDL0IsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
