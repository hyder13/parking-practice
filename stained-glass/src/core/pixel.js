/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f0f0f8', s: '#c8d0e0', k: '#14121a', b: '#2a5ad8', y: '#ffc830', r: '#e8203a', f: '#ffd8b8', g: '#5ac83a',
  n: '#8a5a2a', p: '#7a3ac8', l: '#9a4ae8', d: '#3a3a5a',
};

export const SPRITES = {
  // 小騎士(銀盔 + 紅羽飾 + 藍盾 + 光之劍)
  ship: [
    '....rr....y',
    '...sssss..y',
    '..sffffs..y',
    '..sfkfks..y',
    '...ffff..nn',
    '.bbsssss...',
    'bybsssss...',
    '.bb.yyy....',
    '...ss.ss...',
  ],
  // 關卡圖示:1 旗 / 5 寶石 / 10 盾 / 50 皇冠
  flag: [
    'krrr.',
    'kryr.',
    'krrr.',
    'k....',
    'k....',
  ],
  badge5: [
    '..b..',
    '.bwb.',
    'bbbbb',
    '.bbb.',
    '..b..',
  ],
  badge10: [
    'bbbbb',
    'bbybb',
    'byyyb',
    '.bbb.',
    '..b..',
  ],
  badge50: [
    'y..y..y',
    'yy.y.yy',
    'yyyyyyy',
    'yryyyby',
    'yyyyyyy',
    '.......',
  ],
  // 哥布林
  bee: [
    'g..ggg..g',
    '.gggggggg',
    '..gyggyg.',
    '..ggggg..',
    '..gwgwg..',
    '.nnnnnnns',
    '..nnnnn..',
    '..n...n..',
  ],
  // 蝙蝠
  bfly: [
    '..p...p..',
    '..pp.pp..',
    'l.ppppp.l',
    'llprprpll',
    'lllpppll.',
    'll.pwp.ll',
    'l..p.p..l',
    '.........',
  ],
  // 黑騎士
  boss: [
    '.d.....d.',
    '..d...d..',
    '..ddddd..',
    '.dkrkrkd.',
    '..ddkdd..',
    '.rdddddr.',
    'rrdddddrr',
    '.rddrddr.',
    '..d...d..',
  ],
};
