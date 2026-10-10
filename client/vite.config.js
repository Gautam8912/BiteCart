import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The client build runs from the repository root (`npm run build`), so paths are
// resolved relative to this config file rather than the process cwd.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // Same-origin in dev: the browser talks to Vite only, and Vite proxies the
    // API. This keeps the session cookie first-party and avoids CORS entirely.
    proxy: {
      '/api': {
        target: process.env.FE_API_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
});
