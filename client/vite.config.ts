import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In development the Vite dev server proxies API and upload requests to the
// Express backend, so the browser sees a single origin (cookies stay first-party).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: false },
      '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: false },
    },
  },
});
