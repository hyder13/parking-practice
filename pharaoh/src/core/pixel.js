/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f4ecd8', s: '#b8a888', k: '#14100c', b: '#2a5ab8', y: '#e8b830', r: '#c83a1a', f: '#c8844a', g: '#3ab8a8',
  n: '#8a5a30', t: '#1a7a7a', d: '#24201c', e: '#e8dcc0',
};

export const SPRITES = {
  // 小法老(藍金條紋頭巾 + 白短裙)
  ship: [
    '...bbbbb...',
    '..byyyyyb..',
    '.bbffffffb.',
    '.ybfkffkfy.',
    '.bbffffffb.',
    '..yyyyyyy..',
    '...fwwwf..y',
    '...wwwww..y',
    '...ff.ff...',
  ],
  // 關卡圖示:1 旗 / 5 生命之符 / 10 金字塔 / 50 太陽
  flag: [
    'kbbb.',
    'kbyb.',
    'kbbb.',
    'k....',
    'k....',
  ],
  badge5: [
    '.yyy.',
    '.y.y.',
    'yyyyy',
    '..y..',
    '..y..',
  ],
  badge10: [
    '..y..',
    '.yyy.',
    '.yyn.',
    'yyynn',
    'yynnn',
  ],
  badge50: [
    'y..r..y',
    '.yrrry.',
    'yrrrrry',
    '.yrrry.',
    'y..r..y',
    '.......',
  ],
  // 木乃伊
  bee: [
    '...eee...',
    '..ekkke..',
    '..eyeye..',
    '..eeeee..',
    '.eseeese.',
    'e.eseee.e',
    '..eeese..',
    '..e...e..',
  ],
  // 聖甲蟲
  bfly: [
    '....r....',
    '...yyy...',
    'gg.yyy.gg',
    'gggtttggg',
    '.ggttkgg.',
    '...ttt...',
    '..t...t..',
    '.........',
  ],
  // 胡狼守衛
  boss: [
    '.d.....d.',
    '.dd...dd.',
    '..ddddd..',
    '..dyddd..',
    '...dddkk.',
    '.yyyyyyy.',
    '.bbbbbbb.',
    '..wwwww..',
    '..d...d..',
  ],
};
