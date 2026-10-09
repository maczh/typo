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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG9cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL01hY3JvL1dvcmsvanMvc3JjL2dpdGh1Yi5jb20vbWFjemgvdHlwby92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9NYWNyby9Xb3JrL2pzL3NyYy9naXRodWIuY29tL21hY3poL3R5cG8vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFt2dWUoKV0sXG4gIC8vIFRhdXJpIGV4cGVjdHMgYSBmaXhlZCBwb3J0IGFuZCByZWxhdGl2ZSBiYXNlIHNvIHRoZSBidW5kbGVkIGFzc2V0cyByZXNvbHZlXG4gIC8vIGNvcnJlY3RseSBpbnNpZGUgdGhlIHdlYnZpZXcuXG4gIGJhc2U6ICcuLycsXG4gIGNsZWFyU2NyZWVuOiBmYWxzZSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMTQyMCxcbiAgICBzdHJpY3RQb3J0OiB0cnVlLFxuICAgIGhvc3Q6IGZhbHNlLFxuICAgIGhtcjoge1xuICAgICAgcHJvdG9jb2w6ICd3cycsXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcbiAgICAgIHBvcnQ6IDE0MjEsXG4gICAgfSxcbiAgICB3YXRjaDoge1xuICAgICAgLy8gRG9uJ3Qgd2F0Y2ggdGhlIFJ1c3Qgc291cmNlIHRyZWUgdG8gYXZvaWQgbmVlZGxlc3MgcmVzdGFydHMuXG4gICAgICBpZ25vcmVkOiBbJyoqL3NyYy10YXVyaS8qKiddLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgdGFyZ2V0OiAnZXNuZXh0JyxcbiAgICBvdXREaXI6ICdkaXN0JyxcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDMwMDAsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIFNwbGl0IGhlYXZ5LCBvcHRpb25hbGx5IGxhenkgZGVwZW5kZW5jaWVzIGludG8gdGhlaXIgb3duIGNodW5rcyBzbyB0aGVcbiAgICAgICAgLy8gZmlyc3QgcGFpbnQgc3RheXMgbGlnaHQgYW5kIG1lcm1haWQva2F0ZXggY2FuIGJlIGNvZGUtc3BsaXQuXG4gICAgICAgIC8vXG4gICAgICAgIC8vIE5PVEU6IGVhY2ggYEBtaWxrZG93bi8qYCBzdWItcGFja2FnZSBpcyBzcGxpdCBpbnRvIGl0cyBPV04gY2h1bmsuIFRoZVxuICAgICAgICAvLyBNaWxrZG93biBwYWNrYWdlcyBoYXZlIGNpcmN1bGFyIEVTLW1vZHVsZSBkZXBlbmRlbmNpZXM7IHdoZW4gUm9sbHVwXG4gICAgICAgIC8vIGNvbmNhdGVuYXRlcyB0aGVtIGludG8gYSBzaW5nbGUgY2h1bmsgaXQgZW1pdHMgYSBURFpcbiAgICAgICAgLy8gKFwiQ2Fubm90IGFjY2VzcyAnYnQnIGJlZm9yZSBpbml0aWFsaXphdGlvblwiKSB0aGF0IGNyYXNoZWQgdGhlIGFwcCBhdFxuICAgICAgICAvLyBsb2FkIHRpbWUgaW4gdGhlIHByb2R1Y3Rpb24gYnVpbGQuIEtlZXBpbmcgdGhlIHBhY2thZ2VzIGluIHNlcGFyYXRlXG4gICAgICAgIC8vIGNodW5rcyB0dXJucyB0aGF0IGludG8gYSBuYXRpdmUgY3Jvc3MtbW9kdWxlIChFU00pIGN5Y2xlLCB3aGljaCB0aGVcbiAgICAgICAgLy8gYnJvd3NlciByZXNvbHZlcyB3aXRob3V0IGEgVERaLiAoRGV2IG1vZGUgd2FzIG5ldmVyIGFmZmVjdGVkIGJlY2F1c2UgaXRcbiAgICAgICAgLy8gc2VydmVzIG1vZHVsZXMgaW5kaXZpZHVhbGx5LilcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdtZXJtYWlkJykpIHJldHVybiAndmVuZG9yLW1lcm1haWQnXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2thdGV4JykpIHJldHVybiAndmVuZG9yLWthdGV4J1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdoaWdobGlnaHQuanMnKSkgcmV0dXJuICd2ZW5kb3ItaGlnaGxpZ2h0J1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdkb2N4JykpIHJldHVybiAndmVuZG9yLWRvY3gnXG4gICAgICAgICAgICBjb25zdCBtaWxrID0gaWQubWF0Y2goL25vZGVfbW9kdWxlc1svXFxcXF1AbWlsa2Rvd25bL1xcXFxdKFteL1xcXFxdKykvKVxuICAgICAgICAgICAgaWYgKG1pbGspIHJldHVybiBgdmVuZG9yLW1pbGtkb3duLSR7bWlsa1sxXX1gXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ3Byb3NlbWlycm9yJykpIHJldHVybiAndmVuZG9yLXByb3NlbWlycm9yJ1xuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCd2dWUnKSB8fCBpZC5pbmNsdWRlcygncGluaWEnKSB8fCBpZC5pbmNsdWRlcygndnVlLWkxOG4nKSkgcmV0dXJuICd2ZW5kb3ItdnVlJ1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSksXG4gICAgfSxcbiAgfSxcbiAgLy8gUHJlLWJ1bmRsZSBNZXJtYWlkICsgdGhlIENvZGVNaXJyb3IgdGhlbWUgKyB0aGUgbGFuZ3VhZ2UtZGF0YSBwYWNrYWdlICh3aGljaFxuICAvLyBDcmVwZSdzIGNvZGUgYmxvY2sgbGF6eS1sb2FkcyBwZXIgbGFuZ3VhZ2UpLiBUaGlzIGtlZXBzIHRoZW0gaW4gdGhlIG9wdGltaXplZFxuICAvLyBkZXBzIGNhY2hlIHNvIHRoZSBkeW5hbWljIGltcG9ydHMgZHVyaW5nIGEgc2Vzc2lvbiBkb24ndCB0cmlnZ2VyIGEgbWlkLXNlc3Npb25cbiAgLy8gcmUtb3B0aW1pemUgXHUyMDE0IHdoaWNoIHRoZSBzYW5kYm94IGJ1bGstZGVsZXRlIGd1YXJkIHdvdWxkIG90aGVyd2lzZSBibG9jayBhbmRcbiAgLy8gY3Jhc2ggdGhlIGRldiBzZXJ2ZXIuXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFsnbWVybWFpZCcsICdAY29kZW1pcnJvci90aGVtZS1vbmUtZGFyaycsICdAY29kZW1pcnJvci9sYW5ndWFnZS1kYXRhJ10sXG4gIH0sXG4gIC8vIFRhdXJpJ3MgYGludm9rZWAgd29ya3Mgd2l0aG91dCB0aGUgb3B0aW9uYWwgVEFVUklfKiBlbnYgdmFycyBpbiBkZXYuXG4gIGVudlByZWZpeDogWydWSVRFXycsICdUQVVSSV8nXSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlULFNBQVMsb0JBQW9CO0FBQ3RWLE9BQU8sU0FBUztBQUNoQixTQUFTLGVBQWUsV0FBVztBQUYrSixJQUFNLDJDQUEyQztBQUtuUCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsSUFBSSxDQUFDO0FBQUE7QUFBQTtBQUFBLEVBR2YsTUFBTTtBQUFBLEVBQ04sYUFBYTtBQUFBLEVBQ2IsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sWUFBWTtBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sS0FBSztBQUFBLE1BQ0gsVUFBVTtBQUFBLE1BQ1YsTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLElBQ1I7QUFBQSxJQUNBLE9BQU87QUFBQTtBQUFBLE1BRUwsU0FBUyxDQUFDLGlCQUFpQjtBQUFBLElBQzdCO0FBQUEsRUFDRjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLElBQ1IsUUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2IsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQVlOLGFBQWEsSUFBSTtBQUNmLGNBQUksR0FBRyxTQUFTLGNBQWMsR0FBRztBQUMvQixnQkFBSSxHQUFHLFNBQVMsU0FBUyxFQUFHLFFBQU87QUFDbkMsZ0JBQUksR0FBRyxTQUFTLE9BQU8sRUFBRyxRQUFPO0FBQ2pDLGdCQUFJLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUN4QyxnQkFBSSxHQUFHLFNBQVMsTUFBTSxFQUFHLFFBQU87QUFDaEMsa0JBQU0sT0FBTyxHQUFHLE1BQU0sMENBQTBDO0FBQ2hFLGdCQUFJLEtBQU0sUUFBTyxtQkFBbUIsS0FBSyxDQUFDLENBQUM7QUFDM0MsZ0JBQUksR0FBRyxTQUFTLGFBQWEsRUFBRyxRQUFPO0FBQ3ZDLGdCQUFJLEdBQUcsU0FBUyxLQUFLLEtBQUssR0FBRyxTQUFTLE9BQU8sS0FBSyxHQUFHLFNBQVMsVUFBVSxFQUFHLFFBQU87QUFBQSxVQUNwRjtBQUNBLGlCQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxjQUFjLElBQUksSUFBSSxTQUFTLHdDQUFlLENBQUM7QUFBQSxJQUN0RDtBQUFBLEVBQ0Y7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsV0FBVyw4QkFBOEIsMkJBQTJCO0FBQUEsRUFDaEY7QUFBQTtBQUFBLEVBRUEsV0FBVyxDQUFDLFNBQVMsUUFBUTtBQUMvQixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
