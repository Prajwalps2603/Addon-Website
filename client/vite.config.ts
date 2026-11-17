import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 127.0.0.1 (not "localhost") avoids IPv6/IPv4 resolution surprises on Windows.
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:4000';
  const proxy = {
    '/api': { target: apiTarget, changeOrigin: true },
    '/uploads': { target: apiTarget, changeOrigin: true },
  };
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1100,
      // Never inline fonts as base64: a small subset (say Cyrillic) would then sit inside the
      // render-blocking CSS for every visitor, where unicode-range would otherwise skip it.
      assetsInlineLimit: (file) => (file.endsWith('.woff2') ? false : undefined),
    },
  };
});
