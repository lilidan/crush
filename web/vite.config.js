import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: [],
      output: {
        manualChunks: {
          'openai': ['openai'],
          'anthropic': ['@anthropic-ai/sdk']
        }
      }
    }
  },
  define: {
    // Define global variables if needed
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['openai', '@anthropic-ai/sdk']
  },
  server: {
    port: 3000,
    open: true
  }
})