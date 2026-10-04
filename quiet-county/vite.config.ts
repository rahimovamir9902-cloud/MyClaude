import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Relative base so the bundle loads from the Capacitor WebView (file/capacitor scheme).
export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: { port: 5173 },
});
