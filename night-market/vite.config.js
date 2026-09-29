import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 共用引擎在 ../arcade-core(@arcade);引擎回頭拿這款遊戲的皮用 @skin(= ./src)。
// 相對路徑 base:放在任何子路徑(GitHub Pages / artifact)底下都能跑。
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@arcade': fileURLToPath(new URL('../arcade-core', import.meta.url)),
      '@skin': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['three'], // arcade-core 的 import 'three' 也用這個專案的 node_modules(只打包一份)
  },
  server: { port: 5187, host: true, fs: { allow: ['..'] } },
});
