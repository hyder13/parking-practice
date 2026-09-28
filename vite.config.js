import { defineConfig } from 'vite';

// 相對路徑:GitHub Pages 放在 /parking-practice/ 子路徑底下也能跑,本機 dev 不受影響
export default defineConfig({
  base: './',
  server: { port: 5180 },
});
