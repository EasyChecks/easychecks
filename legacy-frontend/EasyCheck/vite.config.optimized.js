import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Vite Configuration - Optimized for Performance
// อัปเดต: 26 ตุลาคม 2025
export default defineConfig({
  plugins: [
    react({
      // ใช้ Fast Refresh สำหรับ HMR ที่เร็วขึ้น
      fastRefresh: true,
      babel: {
        compact: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // เพิ่มประสิทธิภาพ chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // แยก vendor chunks เพื่อ caching ที่ดีขึ้น
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'chart-vendor': ['recharts'],
          'map-vendor': ['leaflet', 'react-leaflet'],
          'pdf-vendor': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          'date-vendor': ['date-fns', 'react-datepicker', 'react-day-picker'],
          'ui-vendor': ['react-markdown', 'react-icons', 'lucide-react'],
        },
      },
    },
    // ลดขนาด chunk และเพิ่มความเร็ว
    chunkSizeWarningLimit: 1000,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // ลบ console.log ใน production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'], // ลบ specific functions
      },
    },
    // ปิด sourcemap ใน production เพื่อความเร็ว
    sourcemap: false,
    // เพิ่มความเร็วในการ build
    target: 'esnext',
    cssCodeSplit: true,
  },
  // เพิ่มความเร็ว Dev Server
  server: {
    hmr: {
      overlay: false, // ปิด error overlay เพื่อลด overhead
    },
    // Pre-warm frequently used files
    warmup: {
      clientFiles: [
        './src/main.jsx',
        './src/App.jsx',
        './src/pages/admin/*.jsx',
        './src/pages/user/*.jsx',
        './src/components/**/*.jsx',
      ],
    },
  },
  // Optimize dependencies - Pre-bundle ไฟล์ที่ใช้บ่อย
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'leaflet',
      'react-leaflet',
      'recharts',
      'jspdf',
      'html2canvas',
      'date-fns',
    ],
    // Exclude large dependencies ที่ไม่จำเป็นต้อง pre-bundle
    exclude: [],
  },
  // เพิ่ม esbuild options สำหรับ transpilation ที่เร็วขึ้น
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    legalComments: 'none',
    treeShaking: true,
  },
  // Cache options
  cacheDir: 'node_modules/.vite',
})
