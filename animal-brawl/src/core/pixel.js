/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#faf6ee', r: '#e8322e', b: '#2a8ad8', c: '#8fe0ff', y: '#ffd24a', o: '#e89a48', k: '#2a2226', g: '#5ab84a',
  s: '#fff4e4', p: '#ffa0b0', n: '#8a5a3a', d: '#5a3a24', e: '#e0c8a0',
};

export const SPRITES = {
  // 小柴犬(立耳 + 麻呂眉 + 白嘴筒 + 紅領巾)
  ship: [
    '.oo.....oo.',
    '.ooo...ooo.',
    '.ooooooooo.',
    '.osooooso.',
    '.okosssoko.',
    '..osskssoo.',
    '...ssssso..',
    '..rrrrrrr..',
    '..osssssoo.',
    '..ss...ss..',
  ],
  // 關卡圖示:1 骨頭 / 5 腳印 / 10 獎牌 / 50 金獎盃
  flag: [
    'ww.ww',
    '.www.',
    '..w..',
    '.www.',
    'ww.ww',
  ],
  badge5: [
    '.n.n.',
    'n.n.n',
    '.nnn.',
    'nnnnn',
    '.nnn.',
  ],
  badge10: [
    'r...r',
    '.r.r.',
    '.yyy.',
    'yyryy',
    '.yyy.',
  ],
  badge50: [
    'y.yyy.y',
    'yyyyyyy',
    '.yyyyy.',
    '..yyy..',
    '.yyyyy.',
  ],
  // 兔子
  bee: [
    '..w...w..',
    '..wp.pw..',
    '..wp.pw..',
    '.wwwwwww.',
    '.wkwwwkw.',
    '.wwwpwww.',
    '..wwwww..',
    '.wwwwwoo.',
    '..w...w..',
  ],
  // 鸚鵡
  bfly: [
    '...rrr...',
    '..rwwkr..',
    '..rwwwe..',
    'b.rrrre.b',
    'bbryyyrbb',
    '.bryyyrb.',
    '...rrr...',
    '...bry...',
  ],
  // 野豬
  boss: [
    '.d.....d.',
    '.dnnnnnd.',
    '.nknnnkn.',
    '.nnpppnn.',
    'wnpkpkpnw',
    '.nnnnnnn.',
    'nnnnnnnnn',
    '.d.d.d.d.',
  ],
};
