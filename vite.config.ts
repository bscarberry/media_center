import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    },
  },

  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
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

  // Ensure Electron modules are not bundled
  optimizeDeps: {
    exclude: ['electron', 'electron-store'],
  },
});
