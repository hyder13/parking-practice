/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated。黑白卡通:只用黑 / 白 / 灰 / 奶油色。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f8f6f0', k: '#1a1816', g: '#8a847a', d: '#4a4640', c: '#f0e4cc', l: '#c8c2b6', y: '#e8dcc0',
};

export const SPRITES = {
  // 小咚(黑身體、奶油臉、派切眼、長耳朵、喇叭)
  ship: [
    '...kkkk....',
    '..kkkkkk.y.',
    '.kkccwcck.y',
    'kkcwkckwky.',
    'kk.ccccc.y.',
    'k..ckkkc.y.',
    '...kkkkkww.',
    '..wkkkkk...',
    '...gggg....',
    '..kk..kk...',
  ],
  // 關卡圖示:1 電影場記板 / 5 膠卷 / 10 星星 / 50 獎盃
  flag: [
    'wkwkw',
    'kkkkk',
    'wwwww',
    'wkkkw',
    'wwwww',
  ],
  badge5: [
    '.kkk.',
    'kwkwk',
    'kkwkk',
    'kwkwk',
    '.kkk.',
  ],
  badge10: [
    '..w..',
    '.www.',
    'wwwww',
    '.www.',
    '.w.w.',
  ],
  badge50: [
    'yyyyyyy',
    '.yyyyy.',
    '..yyy..',
    '...y...',
    '..yyy..',
    '.kkkkk.',
  ],
  // 跳舞的花
  bee: [
    '..w.w.w..',
    '.wwcccww.',
    '..ckckc..',
    '.wckkkcw.',
    '..wcccw..',
    '....g....',
    '.wggggw..',
    '..k...k..',
  ],
  // 小幽靈
  bfly: [
    '...www...',
    '..wwwww..',
    '.wkwwwkw.',
    '.wkwwwkw.',
    'wwwwkwwww',
    '.wwwwwww.',
    '.wwwwwww.',
    '.w.w.w.w.',
  ],
  // 骷髏
  boss: [
    '...kkk...',
    '..kkkkk..',
    '..wwwww..',
    '.wkwwwkw.',
    '.wwwkwww.',
    '..wkwkw..',
    '.kwkwkwk.',
    '..kwwwk..',
    '..w...w..',
  ],
};
