import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const mobileDevHost = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.TAURI_DEV_HOST;

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? '/-/' : '/',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: mobileDevHost || '127.0.0.1',
    hmr: mobileDevHost
      ? {
          protocol: 'ws',
          host: mobileDevHost,
          port: 1421,
        }
      : undefined,
  },
}));
