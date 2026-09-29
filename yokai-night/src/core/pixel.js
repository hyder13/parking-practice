/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f8f4ea', r: '#c8323a', b: '#3a4a8a', c: '#a8d0ff', y: '#f2c23a', o: '#e8a040', k: '#1a1a22', g: '#7ac8a8',
  s: '#f8e2cc', p: '#8a6ab8', n: '#7a5238', l: '#fff0c8', e: '#e8505a',
};

export const SPRITES = {
  // 陰陽師(黑烏帽子 + 淡藍狩衣 + 紫袴)
  ship: [
    '....kk.....',
    '...kkk.....',
    '...kkk.....',
    '..kkkkk....',
    '..sksks....',
    '..sssss....',
    '.cccwccc...',
    'ccccbcccwrw',
    '.ccpppcc.w.',
    '...pp.pp...',
  ],
  // 關卡圖示:1 提燈 / 5 符 / 10 鳥居 / 50 小判
  flag: [
    '..k..',
    '.kkk.',
    'lllll',
    'lrlrl',
    'lllll',
    '.kkk.',
  ],
  badge5: [
    'wwww',
    'wrrw',
    'wwrw',
    'wrrw',
    'wwww',
  ],
  badge10: [
    'rrrrrrr',
    '.rrrrr.',
    '.r...r.',
    'rrrrrrr',
    '.r...r.',
    '.r...r.',
  ],
  badge50: [
    '.yyyyy.',
    'yyoyoyy',
    'yyyyyyy',
    'yyoyoyy',
    '.yyyyy.',
  ],
  // 唐傘妖
  bee: [
    '....n....',
    '...rrr...',
    '..rrrrr..',
    '.rrwwwrr.',
    '.rrwkwrr.',
    'rrrrerrrr',
    '....e....',
    '....n....',
    '...nnn...',
  ],
  // 提燈妖
  bfly: [
    '....n....',
    '...kkk...',
    '..lllll..',
    '.llwwlll.',
    '.llwkll..',
    '.lkkkkll.',
    '.lllelll.',
    '..llell..',
    '...kkk...',
  ],
  // 赤鬼
  boss: [
    '.w.....w.',
    '.wkkkkkw.',
    '..rrrrr..',
    '..kwrwk..',
    '..rrrrr..',
    '..rwrwr..',
    '.rrrrrrr.',
    '..yyyyy..',
    '...r.r...',
  ],
};
