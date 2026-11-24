import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the Vite dev server proxies API, upload, and clinical workstation
// requests to the Express backend, so the browser sees a single origin (cookies stay first-party).
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: false },
      '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: false },
      '/clinical-workstation': { target: 'http://127.0.0.1:4000', changeOrigin: false },
      '/ws/hardware': { target: 'http://127.0.0.1:4000', ws: true, changeOrigin: false },
    },
  },
});
