import { SPRITES, COLORS } from '@skin/core/pixel.js';

/** HUD 點陣小圖:各遊戲 pixel.js 的字元陣列 → canvas → dataURL(所有換皮共用) */
const cache = new Map();
export function spriteURL(name) {
  if (cache.has(name)) return cache.get(name);
  const rows = SPRITES[name];
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    g.fillStyle = COLORS[ch]; g.fillRect(x, y, 1, 1);
  }));
  const url = c.toDataURL();
  cache.set(name, url);
  return url;
}
