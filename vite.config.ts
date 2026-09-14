import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/go-3d/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-512-maskable.png", "icons/apple-touch-icon.png"],
      manifest: {
        name: "Go 3D — Weiqi & Baduk",
        short_name: "Go 3D",
        description: "Play Go in 3D. Local hotseat, a simple AI, and interactive lessons.",
        theme_color: "#1a1410",
        background_color: "#1a1410",
        display: "standalone",
        orientation: "any",
        start_url: "/go-3d/",
        scope: "/go-3d/",
        categories: ["games", "education"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,ico}"],
        navigateFallback: "/go-3d/index.html",
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
