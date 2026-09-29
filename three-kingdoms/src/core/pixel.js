/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * ------------------------------------------------------------------ */
const COLORS = {
  w: '#f8f6f0', r: '#d8322e', b: '#2e4a8a', c: '#8fe0ff', y: '#f2c23a', o: '#b8844a', k: '#2a2226', g: '#3aa06a',
  s: '#f6d2b0', h: '#2a2226', n: '#6a4a30', l: '#8a6040',
};

export const SPRITES = {
  // 趙雲 + 白馬(俯視)
  ship: [
    '.....r.......',
    '....sss..w...',
    '....sks..w...',
    '...bbbbb.w...',
    '....www..w...',
    '...wwwww.....',
    '...wwwww.....',
    '....www......',
    '.....w.......',
  ],
  // 關卡圖示:1 令旗 / 5 虎符 / 10 將印 / 50 玉璽
  flag: [
    '.rrr.',
    '.rrrr',
    '.rrr.',
    '.k...',
    '.k...',
    '.k...',
  ],
  badge5: [
    '..yyy..',
    '.yykyy.',
    'yyyyyyy',
    '.ykkky.',
    '..yyy..',
  ],
  badge10: [
    '...r...',
    '..rrr..',
    '.yyyyy.',
    '.yrrry.',
    '.yyyyy.',
  ],
  badge50: [
    '..ggg..',
    '.ggggg.',
    'gwgwgwg',
    'ggggggg',
    'yyyyyyy',
  ],
  // 黃巾兵
  bee: [
    '...yyy...',
    '..yhhhy..',
    '..hsssh..',
    '...sks...',
    '.o.nnn.l.',
    '.o.nnn.l.',
    '...n.n...',
  ],
  // 魏軍弓兵
  bfly: [
    '....k....',
    '...kkk...',
    '..ksssk..',
    '...sks...',
    'l.bbbbb..',
    'l.bbbbb..',
    '...b.b...',
  ],
  // 騎兵
  boss: [
    '...kkk...',
    '...sss...',
    '..rrrrr..',
    '...nnn...',
    '..nnnnn..',
    '..nnnnn..',
    '...nnn...',
    '....n....',
  ],
};

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
