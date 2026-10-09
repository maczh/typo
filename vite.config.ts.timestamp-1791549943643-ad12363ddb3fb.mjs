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
    chunkSizeWarningLimit: 3e3,
    rollupOptions: {
      output: {
        // Split heavy, optionally lazy dependencies into their own chunks so the
        // first paint stays light and mermaid/katex can be code-split.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("mermaid")) return "vendor-mermaid";
            if (id.includes("katex")) return "vendor-katex";
            if (id.includes("highlight.js")) return "vendor-highlight";
            if (id.includes("docx")) return "vendor-docx";
            if (id.includes("@milkdown") || id.includes("prosemirror")) return "vendor-milkdown";
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
  // Pre-bundle Mermaid + the CodeMirror theme so the dynamic `import('mermaid')`
  // inside the diagram plugin and the one-dark theme resolve from the optimized
  // deps cache instead of triggering a mid-session re-optimize (which the sandbox
  // bulk-delete guard would otherwise block).
  optimizeDeps: {
    include: ["mermaid", "@codemirror/theme-one-dark"]
  },
  // Tauri's `invoke` works without the optional TAURI_* env vars in dev.
  envPrefix: ["VITE_", "TAURI_"]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG9cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL01hY3JvL1dvcmsvanMvc3JjL2dpdGh1Yi5jb20vbWFjemgvdHlwby92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG8vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFt2dWUoKV0sXG4gIC8vIFRhdXJpIGV4cGVjdHMgYSBmaXhlZCBwb3J0IGFuZCByZWxhdGl2ZSBiYXNlIHNvIHRoZSBidW5kbGVkIGFzc2V0cyByZXNvbHZlXG4gIC8vIGNvcnJlY3RseSBpbnNpZGUgdGhlIHdlYnZpZXcuXG4gIGJhc2U6ICcuLycsXG4gIGNsZWFyU2NyZWVuOiBmYWxzZSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMTQyMCxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhvc3Q6IGZhbHNlLFxuICAgIGhtcjoge1xuICAgICAgcHJvdG9jb2w6ICd3cycsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgIHBvcnQ6IDE0MjEsXG4gICAgfSxcbiAgICB3YXRjaDoge1xuICAgICAgLy8gRG9uJ3Qgd2F0Y2ggdGhlIFJ1c3Qgc291cmNlIHRyZWUgdG8gYXZvaWQgbmVlZGxlc3MgcmVzdGFydHMuXG4gICAgICBpZ25vcmVkOiBbJyoqL3NyYy10YXVyaS8qKiddLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDMwMDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIFNwbGl0IGhlYXZ5LCBvcHRpb25hbGx5IGxhenkgZGVwZW5kZW5jaWVzIGludG8gdGhlaXIgb3duIGNodW5rcyBzbyB0aGVcbiAgICAgICAgLy8gZmlyc3QgcGFpbnQgc3RheXMgbGlnaHQgYW5kIG1lcm1haWQva2F0ZXggY2FuIGJlIGNvZGUtc3BsaXQuXG4gICAgICAgIG1hbnVhbENodW5rcyhpZCkge1xuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbm9kZV9tb2R1bGVzJykpIHtcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnbWVybWFpZCcpKSByZXR1cm4gJ3ZlbmRvci1tZXJtYWlkJ1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdrYXRleCcpKSByZXR1cm4gJ3ZlbmRvci1rYXRleCdcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnaGlnaGxpZ2h0LmpzJykpIHJldHVybiAndmVuZG9yLWhpZ2hsaWdodCdcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcygnZG9jeCcpKSByZXR1cm4gJ3ZlbmRvci1kb2N4J1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAbWlsa2Rvd24nKSB8fCBpZC5pbmNsdWRlcygncHJvc2VtaXJyb3InKSkgcmV0dXJuICd2ZW5kb3ItbWlsa2Rvd24nXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3Z1ZScpIHx8IGlkLmluY2x1ZGVzKCdwaW5pYScpIHx8IGlkLmluY2x1ZGVzKCd2dWUtaTE4bicpKSByZXR1cm4gJ3ZlbmRvci12dWUnXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiB1bmRlZmluZWRcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSxcbiAgICB9LFxuICB9LFxuICAvLyBQcmUtYnVuZGxlIE1lcm1haWQgKyB0aGUgQ29kZU1pcnJvciB0aGVtZSBzbyB0aGUgZHluYW1pYyBgaW1wb3J0KCdtZXJtYWlkJylgXG4gIC8vIGluc2lkZSB0aGUgZGlhZ3JhbSBwbHVnaW4gYW5kIHRoZSBvbmUtZGFyayB0aGVtZSByZXNvbHZlIGZyb20gdGhlIG9wdGltaXplZFxuICAvLyBkZXBzIGNhY2hlIGluc3RlYWQgb2YgdHJpZ2dlcmluZyBhIG1pZC1zZXNzaW9uIHJlLW9wdGltaXplICh3aGljaCB0aGUgc2FuZGJveFxuICAvLyBidWxrLWRlbGV0ZSBndWFyZCB3b3VsZCBvdGhlcndpc2UgYmxvY2spLlxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbJ21lcm1haWQnLCAnQGNvZGVtaXJyb3IvdGhlbWUtb25lLWRhcmsnXSxcbiAgfSxcbiAgLy8gVGF1cmkncyBgaW52b2tlYCB3b3JrcyB3aXRob3V0IHRoZSBvcHRpb25hbCBUQVVSSV8qIGVudiB2YXJzIGluIGRldi5cbiAgZW52UHJlZml4OiBbJ1ZJVEVfJywgJ1RBVVJJXyddLFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBeVQsU0FBUyxvQkFBb0I7QUFDdFYsT0FBTyxTQUFTO0FBQ2hCLFNBQVMsZUFBZSxXQUFXO0FBRitKLElBQU0sMkNBQTJDO0FBS25QLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFBQTtBQUFBO0FBQUEsRUFHZixNQUFNO0FBQUEsRUFDTixhQUFhO0FBQUEsRUFDYixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixNQUFNO0FBQUEsSUFDTixLQUFLO0FBQUEsTUFDSCxVQUFVO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTixNQUFNO0FBQUEsSUFDUjtBQUFBLElBQ0EsT0FBTztBQUFBO0FBQUEsTUFFTCxTQUFTLENBQUMsaUJBQWlCO0FBQUEsSUFDN0I7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYix1QkFBdUI7QUFBQSxJQUN2QixlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUE7QUFBQTtBQUFBLFFBR04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLGdCQUFJLEdBQUcsU0FBUyxTQUFTLEVBQUcsUUFBTztBQUNuQyxnQkFBSSxHQUFHLFNBQVMsT0FBTyxFQUFHLFFBQU87QUFDakMsZ0JBQUksR0FBRyxTQUFTLGNBQWMsRUFBRyxRQUFPO0FBQ3hDLGdCQUFJLEdBQUcsU0FBUyxNQUFNLEVBQUcsUUFBTztBQUNoQyxnQkFBSSxHQUFHLFNBQVMsV0FBVyxLQUFLLEdBQUcsU0FBUyxhQUFhLEVBQUcsUUFBTztBQUNuRSxnQkFBSSxHQUFHLFNBQVMsS0FBSyxLQUFLLEdBQUcsU0FBUyxPQUFPLEtBQUssR0FBRyxTQUFTLFVBQVUsRUFBRyxRQUFPO0FBQUEsVUFDcEY7QUFDQSxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDO0FBQUEsSUFDdEQ7QUFBQSxFQUNGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxXQUFXLDRCQUE0QjtBQUFBLEVBQ25EO0FBQUE7QUFBQSxFQUVBLFdBQVcsQ0FBQyxTQUFTLFFBQVE7QUFDL0IsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
