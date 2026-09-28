/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * ------------------------------------------------------------------ */
const COLORS = {
  w: '#f1f2f8', r: '#e8322e', b: '#3a6fff', c: '#70e0ff', y: '#ffd23a', o: '#f39a2a', k: '#1a1433', g: '#49c23c',
  p: '#a05ce8',
};

export const SPRITES = {
  ship: [
    '......r......',
    '......r......',
    '.....rwr.....',
    '.....www.....',
    '.r...wcw...r.',
    '.b...wcw...b.',
    '.b..wwrww..b.',
    'rbwwwwrwwwwbr',
    'bbwww.r.wwwbb',
    'b.ww..r..ww.b',
    '.....w.w.....',
  ],
  flag: [
    '.y.......',
    '.yrrrrr..',
    '.yrrrrrrr',
    '.yrrrrr..',
    '.y.......',
    '.y.......',
    '.y.......',
    '.y.......',
    'yyy......',
  ],
  bee: [
    '...b...b...',
    '....b.b....',
    '.bb.ggg.bb.',
    'bbbbgygbbbb',
    'bbb.ggg.bbb',
    '.b..yyy..b.',
    '....ygy....',
    '....yyy....',
    '.....g.....',
  ],
  bfly: [
    '...w...w...',
    '....w.w....',
    'bbb.rwr.bbb',
    'bpppwrwpppb',
    'bppprrrpppb',
    '.bbprrrpbb.',
    '..bbprpbb..',
    '....r.r....',
  ],
  boss: [
    '....y.y....',
    '...y.o.y...',
    '..ooowooo..',
    '.bbooyoobb.',
    'bbbooooobbb',
    'bbooooooobb',
    '.b.ooooo.b.',
    '...o...o...',
  ],
  badge10: [
    '..bbbbb..',
    '.bcccccb.',
    'bccwcwwcb',
    'bcwwcwcwb',
    'bccwcwcwb',
    'bccwcwcwb',
    '.bcwcwwb.',
    '..bcccb..',
    '...bbb...',
  ],
  badge50: [
    'y.y.y.y.y',
    'yyyyyyyyy',
    'yooooooy.',
    'yowwowwoy',
    'yowoowooy',
    'yowwowwoy',
    'yooowowoy',
    'yowwowwoy',
    'yyyyyyyyy',
  ],
  badge5: [
    '..yyyyy..',
    '.yrrrrry.',
    'yrrwwwrry',
    'yrrwrrrry',
    'yrrwwwrry',
    'yrrrrwrry',
    '.yrwwwry.',
    '..yrrry..',
    '...yyy...',
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
