import path from "path"
import { fileURLToPath } from "url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Bundle React together to prevent duplicate instances
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI and utility libraries
          'ui-vendor': ['react-markdown', 'react-icons', 'lucide-react', 'recharts'],
          // Other dependencies
          'vendor': ['date-fns', 'jspdf', 'jspdf-autotable', 'html2canvas', 'leaflet', 'react-leaflet']
        }
      }
    },
    // Smaller chunks for better caching
    chunkSizeWarningLimit: 1000,
    // Minify & optimize
    minify: 'esbuild',
    target: 'es2015',
    // Optimize CSS
    cssCodeSplit: true
  },
  // Faster dev server
  server: {
    hmr: {
      overlay: false, // ปิด error overlay เพื่อความเร็ว
    }
  }
})