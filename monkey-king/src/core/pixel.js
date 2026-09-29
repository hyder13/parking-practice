/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#fffaf0', r: '#d8322e', b: '#3a5aa8', c: '#8fe0ff', y: '#ffc23a', o: '#ffb03a', k: '#2e2e3e', g: '#4aa040',
  p: '#ffb080', q: '#3a2050', m: '#8a4ab0', f: '#9a6a3a', v: '#8a3aa8', s: '#c8d0e0', i: '#8a94a8',
};

export const SPRITES = {
  // 大聖 + 筋斗雲
  ship: [
    '....f...f....',
    '.....fff.....',
    '....yyyyy....',
    '....fsssf....',
    '.....sss.....',
    'ryyyyyyyyyyyr',
    '.....frf.....',
    '...wwwwwww...',
    '.wwwwwwwwwww.',
    'wwwwwwwwwwwww',
    '.www.www.www.',
  ],
  // 關卡圖示:1 蟠桃 / 5 葫蘆 / 10 元寶 / 50 蓮花
  flag: [
    '...g.gg',
    '..ggg..',
    '.ppppp.',
    'pppprpp',
    'ppprrpp',
    '.ppppp.',
    '..ppp..',
  ],
  badge5: [
    '...y...',
    '..vvv..',
    '..vvv..',
    '...r...',
    '.vvvvv.',
    'vvvvvvv',
    'vvvvvvv',
    '.vvvvv.',
  ],
  badge10: [
    '.yy...yy.',
    '.yyy.yyy.',
    'yyyyyyyyy',
    '.yyyoyyy.',
    '..yyyyy..',
  ],
  badge50: [
    '....p....',
    '...pwp...',
    '.p.pwp.p.',
    'pppppppp.',
    '.ppppppp.',
    '..ggggg..',
  ],
  // 蝙蝠精
  bee: [
    '...q.....q...',
    '..qq.m.m.qq..',
    '.qqq.mmm.qqq.',
    'qqqqqmrmqqqqq',
    'qq.qqmmmqq.qq',
    'q...q.m.q...q',
  ],
  // 烏鴉精
  bfly: [
    '......o......',
    '.....rrr.....',
    '.....kkk.....',
    'kkkkkkkkkkkkk',
    '.kkkkkkkkkkk.',
    '..k.kkkkk.k..',
    '.....kkk.....',
    '....kkkkk....',
  ],
  // 天兵(踩雲、拿槍)
  boss: [
    '..s...r......',
    '..s..sss.....',
    '..s..sss.....',
    '..s.bsssb.ii.',
    '..s.bbbbb.ii.',
    '..wwwwwwwww..',
    '.wwwwwwwwwww.',
  ],
};
