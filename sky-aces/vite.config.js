import { defineConfig } from 'vite';

// 相對路徑:放在任何子路徑(GitHub Pages / artifact)底下都能跑
export default defineConfig({
  base: './',
  server: { port: 5182, host: true },
});
