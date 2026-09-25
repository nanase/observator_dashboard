import { cloudflare } from '@cloudflare/vite-plugin';
import vue from '@vitejs/plugin-vue';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue(), Icons({ compiler: 'vue3', scale: 1 }), cloudflare()],
  server: { port: 15173 },
});
