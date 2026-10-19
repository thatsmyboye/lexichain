import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";

// Identifies this build. The running app compares it with /version.json to
// notice a newer deploy (see src/lib/appUpdates.ts).
const APP_BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || String(Date.now());

// Content hash of the dictionary. It is added to the dictionary URL so a
// changed word list is never served from an old cache.
const DICTIONARY_VERSION = crypto
  .createHash("sha256")
  .update(fs.readFileSync(path.resolve(__dirname, "public/words.txt.gz")))
  .digest("hex")
  .slice(0, 12);

function emitVersionFile(): Plugin {
  return {
    name: "lexichain-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId: APP_BUILD_ID }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD_ID__: JSON.stringify(APP_BUILD_ID),
    __DICTIONARY_VERSION__: JSON.stringify(DICTIONARY_VERSION),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    emitVersionFile(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered from src/lib/appUpdates.ts, which also handles updates.
      injectRegister: false,
      includeAssets: ['favicon.ico', 'icons/*.svg'],
      manifest: false, // use our hand-crafted public/manifest.json
      workbox: {
        // The page itself is not precached: it is fetched network-first below
        // so every launch picks up the latest deploy.
        globPatterns: ['**/*.{js,css,svg,ico}'],
        globIgnores: ['sw-upgrade.js'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        // Activate a new worker immediately and take over open tabs.
        skipWaiting: true,
        clientsClaim: true,
        // One-time reload of tabs controlled by an older cache-first worker.
        importScripts: ['sw-upgrade.js'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              expiration: { maxEntries: 10 },
            },
          },
          {
            // The URL carries a content hash (?v=...), so a new word list is a
            // cache miss and old copies age out.
            urlPattern: /\/words\.txt(\.gz)?(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'dictionary-cache-v2',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize asset generation for better caching
    rollupOptions: {
      output: {
        // Ensure consistent chunk naming for better caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Split vendor chunks for better caching
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts'],
          forms: ['react-hook-form', 'zod', '@hookform/resolvers'],
          ui: [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
    // Enable source maps for better debugging while maintaining performance
    sourcemap: false,
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
  },
}));
