/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f8f8f8', r: '#e8202a', b: '#2050d8', y: '#ffd020', k: '#101018', s: '#ffd0a8', g: '#3ab04a',
  p: '#8a3ad8', e: '#8aa0c0', d: '#2a2a3a', m: '#ff2a9a', c: '#9af0ff',
};

export const SPRITES = {
  // 驚奇小子(黑髮 + 黑眼罩 + 紅衣 + 藍披風 + 閃電徽章)
  ship: [
    '...kkkk....',
    '..kkkkkk...',
    '..kwkkwk...',
    '..ssssss...',
    '.b.rrrr.b..',
    'bbrryyrrbb.',
    'bbrrryrrbb.',
    '..bbbbbb...',
    '..rr..rr...',
  ],
  // 關卡圖示:1 漫畫書 / 5 閃電 / 10 星星 / 50 獎盃
  flag: [
    'rrrr.',
    'rwwr.',
    'ryyr.',
    'rwwr.',
    'rrrr.',
  ],
  badge5: [
    '..yy.',
    '.yy..',
    'yyyy.',
    '..yy.',
    '.yy..',
  ],
  badge10: [
    '..y..',
    '.yyy.',
    'yyyyy',
    '.yyy.',
    '.y.y.',
  ],
  badge50: [
    'yyyyyyy',
    '.yyyyy.',
    '..yyy..',
    '...y...',
    '..yyy..',
    '.rrrrr.',
  ],
  // 機器人小兵
  bee: [
    '....k....',
    '...eee...',
    '..eeeee..',
    '.krrrrrk.',
    '..eeeee..',
    'k.eyrge.k',
    'e.eeeee.e',
    '..d...d..',
  ],
  // 噴射背包打手
  bfly: [
    '...ppp...',
    '..ppppp..',
    '.pcpppcp.',
    '..ppppp..',
    'e.ppyppp.',
    'e.ppppp..',
    '.y.p.p.y.',
    '..y...y..',
  ],
  // 大塊頭打手
  boss: [
    '..kkkkk..',
    '.kkkkkkk.',
    '.kkwkwkk.',
    '..sssss..',
    '.wwwwwww.',
    'skkkkkkks',
    '.wwwwwww.',
    '.kkkkkkk.',
    '..d...d..',
  ],
};
