import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split heavy vendors into their own chunks for faster first paint.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('react')) return 'react'
        }
      }
    }
  },
  server: { host: '0.0.0.0', port: 3000 }
})
