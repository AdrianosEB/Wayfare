import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Wayfare web client.
// - Dev server on :5173 (per FRONTEND_BRIEF / API_CONTRACT).
// - All client calls go to `/api`; in dev we proxy `/api/*` → http://localhost:3000.
//   When VITE_USE_MOCKS=1 (the default in dev), MSW intercepts `/api` in the browser and
//   the proxy is never hit — flip the env to talk to the real server with zero code change.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
