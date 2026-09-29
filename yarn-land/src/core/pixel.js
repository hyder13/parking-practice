/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#fff8f0', o: '#ff9a3a', s: '#ffe0cc', k: '#2a2030', b: '#5ab8e8', p: '#ff7a9a', y: '#ffd84a', g: '#8ad86a',
  m: '#9a8a9a', l: '#c8b8c8', r: '#ff8a4a', e: '#d8dce8', n: '#b07a50',
};

export const SPRITES = {
  // 小毛(橘色毛線頭髮 + 鈕扣眼 + 天藍毛衣)
  ship: [
    '..o.oo.o...',
    '.ooooooo...',
    'oosssssoo..',
    '.sksssks...',
    '.pssssspp..',
    '..bbbbb....',
    '.bwwwwwb...',
    '.bbbbbbb...',
    '..nn.nn....',
  ],
  // 關卡圖示:1 線軸 / 5 鈕扣 / 10 毛線球 / 50 皇冠
  flag: [
    'nnnn.',
    '.pp..',
    '.pp..',
    '.pp..',
    'nnnn.',
  ],
  badge5: [
    '.yyy.',
    'ykyky',
    'yyyyy',
    'ykyky',
    '.yyy.',
  ],
  badge10: [
    '.ppp.',
    'pwppp',
    'ppwpp',
    'pppwp',
    '.ppp.',
  ],
  badge50: [
    'y..y..y',
    'yy.y.yy',
    'yyyyyyy',
    'ypyyyby',
    'yyyyyyy',
    '.......',
  ],
  // 襪子怪
  bee: [
    '...ggg...',
    '..gwgwg..',
    '..gkgkg..',
    '..wwwww..',
    '...gg....',
    '...yy....',
    '...gg....',
    '...ww....',
  ],
  // 小飛蛾
  bfly: [
    '.m.....m.',
    '..m...m..',
    'll.mmm.ll',
    'lllkmklll',
    'lll.m.lll',
    '.ll.m.ll.',
    '....m....',
    '.........',
  ],
  // 剪刀螃蟹
  boss: [
    'e.e...e.e',
    '.e.....e.',
    '.r.w.w.r.',
    '..rkrkr..',
    '.rrrrrrr.',
    'rrrwwwrrr',
    '.rrrrrrr.',
    'r.r...r.r',
    '.........',
  ],
};
