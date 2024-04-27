import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import VueMacros from 'unplugin-vue-macros/vite';
import Vue from '@vitejs/plugin-vue';
import webfontDownload from 'vite-plugin-webfont-dl';

const root = resolve(__dirname, 'src');
const outDir = resolve(__dirname, 'docs');

// https://vitejs.dev/config/
export default defineConfig({
  root,
  base: '/observator/',
  publicDir: '../public',
  envDir: '../',
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
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    devSourcemap: true,
  },
  build: {
    outDir,
    rollupOptions: {
      input: {
        dashboard: resolve(root, 'observation', 'dashboard.html'),
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
