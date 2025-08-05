import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'openai': ['openai'],
          'anthropic': ['@anthropic-ai/sdk']
        }
      }
    }
  },
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3000,
    open: true
  }
})