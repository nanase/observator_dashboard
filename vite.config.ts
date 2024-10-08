import { resolve } from 'path';
import { defineConfig } from 'vite';
import VueMacros from 'unplugin-vue-macros/vite';
import Vue from '@vitejs/plugin-vue';
import webfontDownload from 'vite-plugin-webfont-dl';

const root = resolve(__dirname);
const srcDir = resolve(root, 'src');

// https://vitejs.dev/config/
export default defineConfig({
  root: srcDir,
  base: '/observator/',
  publicDir: resolve(root, 'public'),
  envDir: root,
  plugins: [
    VueMacros({
      plugins: {
        vue: Vue({
          script: {
            defineModel: true,
            propsDestructure: true,
          },
        }),
      },
    }),
    webfontDownload(),
  ],
  resolve: {
    alias: [{ find: '@', replacement: srcDir }],
  },
  css: {
    devSourcemap: true,
  },
  build: {
    outDir: resolve(root, 'docs'),
    rollupOptions: {
      input: {
        dashboard: resolve(srcDir, 'observation', 'dashboard.html'),
      },
      output: {
        chunkFileNames: 'assets/observator-[name]-[hash].js',
      },
    },
    emptyOutDir: true,
  },
  server: {
    port: 15173,
    strictPort: true,
    fs: {
      cachedChecks: false,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 14173,
    strictPort: true,
  },
});
