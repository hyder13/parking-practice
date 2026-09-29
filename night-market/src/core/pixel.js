/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f8f6f0', r: '#ff5a4a', b: '#3a8ad8', c: '#8fe0ff', y: '#ffd24a', o: '#e0963a', k: '#2a2226', g: '#8ac860',
  s: '#ffe0c8', t: '#d8b088', n: '#6a3a1e', p: '#ff5a8a', d: '#a8682a',
};

export const SPRITES = {
  // 小吃貨(翹頭髮 + 紅 T 恤 + 右手一杯珍奶)
  ship: [
    '...k.k.k...',
    '..kkkkkkk..',
    '..kkkkkkk..',
    '..ksssssk..',
    '..sksssks..',
    '...sssss.p.',
    '.rrrrrrrtt.',
    '.srrrrrstt.',
    '...bb.bbnn.',
    '...ss.ss...',
  ],
  // 關卡圖示:1 珍奶 / 5 代幣 / 10 雞排 / 50 金牌
  flag: [
    '...p.',
    '.www.',
    '.ttt.',
    '.ttt.',
    '.nnn.',
  ],
  badge5: [
    '.yyy.',
    'yyoyy',
    'yoyoy',
    'yyoyy',
    '.yyy.',
  ],
  badge10: [
    '.ooo..',
    'oodooo',
    'oooodo',
    'odoooo',
    '.oooo.',
  ],
  badge50: [
    'y.....y',
    'yyyyyyy',
    '.yyryy.',
    '..yyy..',
    '.yyyyy.',
  ],
  // 臭豆腐
  bee: [
    '...g.g...',
    '..ggggg..',
    '.ooooooo.',
    '.owkowko.',
    '.ooooooo.',
    '.oodkkdo.',
    '.ooooooo.',
    '..d...d..',
  ],
  // 雞排
  bfly: [
    '..ooooo..',
    '.oodoooo.',
    'oowkowkoo',
    'oooooodoo',
    '.odkkkoo.',
    '..ooooo..',
    '..wwwww..',
    '..wrrrw..',
    '..wwwww..',
  ],
  // 刈包
  boss: [
    '..wwwww..',
    '.wwwwwww.',
    'wwkwwwkww',
    'wwwwwwwww',
    'nngnngnnn',
    'wwwwwwwww',
    '.wwwwwww.',
    '..w...w..',
  ],
};
