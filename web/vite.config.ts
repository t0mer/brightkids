import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// Build output is embedded into the Go binary; base must be "/".
export default defineConfig({
  base: "/",
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png", "audio/*"],
      manifest: {
        name: "BrightKids",
        short_name: "BrightKids",
        description: "Learn Hebrew, English, and Math — for kids in grades 1–4.",
        theme_color: "#6C5CE7",
        background_color: "#1B1B3A",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2,mp3,wav}"],
        // Lessons API is small and JSON — cache for offline playback.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/subjects") ||
              url.pathname.startsWith("/api/v1/lessons"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "brightkids-content" },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/healthz": "http://localhost:8080",
      "/readyz": "http://localhost:8080",
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../internal/server/dist"),
    emptyOutDir: true,
  },
});
