import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
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
        // Use content-based hashes for long-term caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: ({ name }) => {
          if (/\.(gif|jpe?g|png|svg)$/.test(name ?? '')) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.css$/.test(name ?? '')) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        // Enhanced manual chunks for optimal caching and minimal initial bundle
        manualChunks: (id) => {
          // Core React libraries - loaded on every page
          if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
            return 'vendor';
          }
          
          // Critical UI components needed for title screen only
          if (id.includes('@radix-ui/react-slot') || 
              id.includes('class-variance-authority') || 
              id.includes('clsx') || 
              id.includes('tailwind-merge')) {
            return 'ui-critical';
          }
          
          // Authentication and data - defer until needed
          if (id.includes('@supabase/supabase-js') || id.includes('@tanstack/react-query')) {
            return 'data';
          }
          
          // Form and validation libraries - defer until auth/game screens
          if (id.includes('react-hook-form') || 
              id.includes('@hookform/resolvers') || 
              id.includes('zod')) {
            return 'forms';
          }
          
          // Game-specific libraries - defer until gameplay
          if (id.includes('date-fns') || id.includes('recharts')) {
            return 'game-utils';
          }
          
          // Non-critical UI components - defer until specific screens
          if (id.includes('@radix-ui/react-dialog') || 
              id.includes('@radix-ui/react-dropdown-menu') ||
              id.includes('@radix-ui/react-tabs') ||
              id.includes('@radix-ui/react-select') ||
              id.includes('@radix-ui/react-accordion') ||
              id.includes('@radix-ui/react-toast') ||
              id.includes('@radix-ui/react-alert-dialog') ||
              id.includes('@radix-ui/react-checkbox') ||
              id.includes('@radix-ui/react-switch') ||
              id.includes('@radix-ui/react-progress') ||
              id.includes('sonner') ||
              id.includes('cmdk') ||
              id.includes('embla-carousel')) {
            return 'ui-deferred';
          }
          
          // Tooltip and basic interactions - small but separate
          if (id.includes('@radix-ui/react-tooltip') || 
              id.includes('@radix-ui/react-hover-card') ||
              id.includes('@radix-ui/react-popover')) {
            return 'ui-tooltips';
          }
          
          // Icon library - separate chunk
          if (id.includes('lucide-react')) {
            return 'icons';
          }
        },
      },
      // Optimize tree shaking for production
      ...(mode === 'production' ? {
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        }
      } : {}),
    },
    // Optimize for production caching and minimal initial load
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
    chunkSizeWarningLimit: 500,
    // Enable more aggressive asset inlining for critical small files
    assetsInlineLimit: 2048,
  },
}));
