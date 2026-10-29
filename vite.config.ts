import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// PWA: o service worker guarda a "casca" do app (JS, CSS, fontes, ícones) para
// abrir sem internet. Os DADOS do inventário não ficam no cache HTTP — ficam no
// IndexedDB (src/offline/db.ts), que sobrevive a recarregar a página.
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  preview: { port: 8080 },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Erekoara — TJPA",
        short_name: "Erekoara",
        description: "Inventário patrimonial digital, offline e rastreável.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#F8F2E8",
        theme_color: "#9C3D22",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ico}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            // OCR (Tesseract): worker, núcleo wasm e modelo de idioma vêm de CDN
            // na primeira leitura e ficam guardados para uso offline.
            urlPattern: ({ url }) => ["cdn.jsdelivr.net", "tessdata.projectnaptha.com", "unpkg.com"].includes(url.hostname),
            handler: "CacheFirst",
            options: {
              cacheName: "ocr-assets",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          scanner: ["@zxing/browser", "@zxing/library"],
        },
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom"],
  },
});
