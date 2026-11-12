import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The client tier talks to the server tier over REST. In development Vite
// proxies /api to the Express process so both run on one origin and the
// browser never hits a CORS preflight.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
