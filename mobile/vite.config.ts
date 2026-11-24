import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Standalone NeuroLink Mobile dev server on port 5174 (leaves Desktop Web on 5173 untouched).
// Proxies API, uploads, clinical workstation, and hardware WebSocket to live Express API on 4000.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5174,
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
