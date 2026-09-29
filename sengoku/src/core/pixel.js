/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f4ecdc', r: '#c8282a', b: '#5a6a8a', c: '#8fe0ff', y: '#f2c23a', o: '#e8902a', k: '#2a2226', g: '#6a9a4a',
  s: '#f8dcc0', a: '#3a3a44', n: '#8a6040', d: '#1a1a24', e: '#c8d0dc',
};

export const SPRITES = {
  // 織田信長(髷 + 黑甲 + 紅披風 + 鐵砲)
  ship: [
    '....kk.....',
    '...kkk.....',
    '..kkkkk....',
    '..sksks..a.',
    '..sssss..a.',
    '..skkks.na.',
    '.raaaaaarn.',
    'rraayaaarr.',
    'rraaaaaarr.',
    '..aa..aa...',
  ],
  // 關卡圖示:1 のぼり / 5 印籠 / 10 金扇 / 50 天守閣
  flag: [
    'k....',
    'kwww.',
    'kwkw.',
    'kwww.',
    'kwkw.',
    'k....',
  ],
  badge5: [
    '..y..',
    '.rrr.',
    'ryyyr',
    'rrrrr',
    '.rrr.',
  ],
  badge10: [
    'y.y.y',
    'yyyyy',
    '.yyy.',
    '..r..',
    '..r..',
  ],
  badge50: [
    '...y...',
    '.aaaaa.',
    '..www..',
    'aaaaaaa',
    '.wwwww.',
    'eeeeeee',
  ],
  // 足輕
  bee: [
    '....a..e.',
    '..aaaaaen',
    '.aaaaaaan',
    '..sksks.n',
    '..sssss.n',
    '.bbbbbbbn',
    '..bwbwb.n',
    '..b...b..',
  ],
  // 忍者
  bfly: [
    '...ddd...',
    '..ddddd.r',
    '.dddddddr',
    '.dsksksd.',
    '..ddddd..',
    '.dddddddd',
    '..ddddd..',
    '..d...d..',
  ],
  // 武將
  boss: [
    '.y.....y.',
    '..y...y..',
    '..rrrrr..',
    '.rrrrrrr.',
    '..sksks..',
    '..sskss..',
    '.rrrrrrr.',
    'rrrryrrrr',
    '..r...r..',
  ],
};
