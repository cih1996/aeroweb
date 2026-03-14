import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  root: path.resolve(__dirname),
  base: './', // 使用相对路径，确保在 Electron 打包后资源能正确加载
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3800,
    strictPort: true,
    host: 'localhost',
  },
  optimizeDeps: {
    exclude: ['@qiyi/shared'],
  },
});

