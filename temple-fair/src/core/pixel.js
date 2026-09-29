/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f8f6f0', r: '#d8322e', b: '#4a6ac8', c: '#8fe0ff', y: '#ffd24a', o: '#f0a030', k: '#2a2226', g: '#7ac8a8',
  s: '#ffe0c8', p: '#d8e4d8',
};

export const SPRITES = {
  // 三太子(雙髻大頭 + 紅甲)
  ship: [
    '..kk...kk..',
    '..kkkkkkk..',
    '..kyyyyyk..',
    '..ksssssk..',
    '..sksssks..',
    '...spsps...',
    '....sss....',
    '.rrrrrrrrr.',
    '...rryrr...',
    '...rr.rr...',
  ],
  // 關卡圖示:1 燈籠 / 5 金紙 / 10 紅包 / 50 金元寶
  flag: [
    '..y..',
    '.rrr.',
    'rrrrr',
    'rrrrr',
    '.rrr.',
    '..y..',
  ],
  badge5: [
    'yyyyy',
    'yrrry',
    'yryry',
    'yrrry',
    'yyyyy',
  ],
  badge10: [
    'rrrrr',
    'ryyyr',
    'rryrr',
    'rrrrr',
    'rrrrr',
  ],
  badge50: [
    '.y...y.',
    'yyy.yyy',
    'yyyyyyy',
    '.yyyyy.',
  ],
  // 小鬼
  bee: [
    '....w....',
    '...kkk...',
    '..kgggk..',
    '..gkgkg..',
    '...gwg...',
    '..ggggg..',
    '..ooooo..',
    '...g.g...',
  ],
  // 殭屍
  bfly: [
    '....r....',
    '..kkkkk..',
    '.kkkkkkk.',
    '..pyyyp..',
    '..pkykp..',
    'bbbbbbbbb',
    '...bbb...',
    '...b.b...',
  ],
  // 夜叉
  boss: [
    '..r.o.r..',
    '..rorror.',
    '..rbbbr..',
    '..bkbkb..',
    '..bwbwb..',
    '.bbbbbbb.',
    '..ooooo..',
    '...b.b...',
  ],
};
