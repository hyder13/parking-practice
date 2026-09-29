/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#eef0f4', r: '#e8322e', b: '#2a4fa8', c: '#8fe0ff', y: '#ffd23a', o: '#d8663a', k: '#2a2d34', g: '#6f9f3a',
  p: '#a05ce8', n: '#6a3a22', s: '#8fa0bf', d: '#4a5670',
};

export const SPRITES = {
  // 玩家戰機(銀白 + 紅機鼻)
  ship: [
    '......r......',
    '.....rrr.....',
    '......w......',
    '.....wcw.....',
    'b.wwwwcwwww.b',
    'bwwwwwwwwwwwb',
    '.....www.....',
    '......w......',
    '......w......',
    '....wwwww....',
    '......r......',
  ],
  // 關卡勳章:1 / 5 / 10 / 50
  flag: [
    '.rbr.',
    '.rbr.',
    '.rbr.',
    '..y..',
    '.yyy.',
    'yyoyy',
    '.yyy.',
    '..y..',
  ],
  // 戰鬥機(橄欖綠,機頭朝下)
  bee: [
    '.....g.....',
    '....ggg....',
    '.y.gggggy..',
    'gggggcggggg',
    '.gg.ggg.gg.',
    '....ggg....',
    '.....k.....',
    '....kkk....',
  ],
  // 俯衝轟炸機(鐵鏽橘 + 奶油色機身)
  bfly: [
    '.....w.....',
    '...ooooo...',
    '.....w.....',
    'ooooowooooo',
    'nooowcwooon',
    '.....w.....',
    '....kwk....',
    '.....k.....',
  ],
  // 雙發重戰機(鐵灰)
  boss: [
    '.....s.....',
    '...sssss...',
    '.....s.....',
    'sssssssssss',
    'ssdssssssds',
    '..d..c..d..',
    '..k..s..k..',
    '.....k.....',
  ],
  badge10: [
    '..rbbbr..',
    '..rbbbr..',
    '...yyy...',
    '..yyyyy..',
    '.yywywyy.',
    '.yyywyyy.',
    '.yywywyy.',
    '..yyyyy..',
    '...yyy...',
  ],
  badge50: [
    'rrbbbbbrr',
    '.rbbbbbr.',
    '...yyy...',
    '.yyyyyyy.',
    'yyoyyyoyy',
    'yyyoyoyyy',
    'yyyyoyyyy',
    '.yyyyyyy.',
    '...yyy...',
  ],
  badge5: [
    '.rbbr.',
    '.rbbr.',
    '..cc..',
    '.cwcc.',
    'cwcccc',
    '.cccc.',
    '..cc..',
  ],
};
