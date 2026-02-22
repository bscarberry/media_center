import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { builtinModules } from 'module';

export default defineConfig({
  plugins: [react()],

  root: '.',

  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@services': path.resolve(__dirname, 'src/renderer/services'),
      '@stores': path.resolve(__dirname, 'src/renderer/stores'),
      '@hooks': path.resolve(__dirname, 'src/renderer/hooks'),
      '@types': path.resolve(__dirname, 'src/renderer/types'),
      '@utils': path.resolve(__dirname, 'src/renderer/utils'),
      '@config': path.resolve(__dirname, 'src/renderer/config'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      // electron-store uses electron.app.getPath() which is main-process-only.
      // Calling require('electron-store') from the renderer crashes even with
      // nodeIntegration: true. Replace it with a no-op in-memory stub so Rollup
      // inlines the stub class and never emits a require('electron-store') call.
      'electron-store': path.resolve(__dirname, 'src/renderer/electron-store-stub.ts'),
    },
  },

  base: './',

  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      // Externalize Node.js built-ins so Rollup emits require('fs') / require('path') /
      // require('crypto') etc. instead of bundling them with broken browser stubs.
      // These require() calls resolve correctly at runtime because the main BrowserWindow
      // has nodeIntegration: true. electron-store is NOT listed here — it is handled by
      // the resolve.alias stub above to avoid its main-process-only app.getPath() calls.
      external: [
        'electron',
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          state: ['zustand', '@tanstack/react-query'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },

  server: {
    port: 5173,
    strictPort: true,
  },

  // Make env vars with VITE_ prefix available to renderer
  envPrefix: 'VITE_',

  // Exclude electron from dev-server pre-bundling
  optimizeDeps: {
    exclude: ['electron'],
  },
});
