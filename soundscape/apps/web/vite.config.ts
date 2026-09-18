import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/trpc': { target: 'http://localhost:3001', changeOrigin: true },
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/ws': { target: 'http://localhost:3001', changeOrigin: true, ws: true },
    },
  },
  build: {
    target: 'esnext',
  },
});
