/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated。水墨版:只用墨 / 淡墨 / 紙白 / 朱紅。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f4f0e6', k: '#141414', g: '#7a7a78', d: '#3a3a3a', r: '#c8281e', s: '#f0dcc4',
};

export const SPRITES = {
  // 少年劍客(髮髻 + 紅髮帶 + 白衫 + 劍)
  ship: [
    '....kk.....',
    '...rkkr...w',
    '..kkkkkk.w.',
    '..sksksk.w.',
    '..ssssss w.',
    '.wwwwwwwwk.',
    'wwwwkkwww..',
    '.wwwwwwww..',
    '..ww..ww...',
    '..kk..kk...',
  ],
  // 關卡圖示:1 印章 / 5 卷軸 / 10 劍 / 50 寶塔
  flag: [
    'rrrr.',
    'rwwr.',
    'rrwr.',
    'rwrr.',
    'rrrr.',
  ],
  badge5: [
    'k...k',
    'kwwwk',
    'kwkwk',
    'kwwwk',
    'k...k',
  ],
  badge10: [
    '....w',
    '...w.',
    '..w..',
    'kk...',
    'rk...',
  ],
  badge50: [
    '...k...',
    '..kkk..',
    '.kkkkk.',
    '..www..',
    'kkkkkkk',
    '.wwwww.',
  ],
  // 山賊
  bee: [
    '..kkkkk..',
    '.kkkkkkk.',
    '..sksks..',
    '..kkkkk..',
    '.ddddddw.',
    '.dddgddw.',
    '..ddddd..',
    '..k...k..',
  ],
  // 飛賊
  bfly: [
    '...kkk...',
    '..kkkkk..',
    '.kkswskk.',
    'rrrkkkkk.',
    'kkkkkkkkk',
    '..kkkkk..',
    '..kk.kk..',
    '.k.....k.',
  ],
  // 鐵頭陀
  boss: [
    '...sss...',
    '..sssss..',
    '..kskks..',
    '..sssss..',
    '.gkgkgkg.',
    'ggggggggk',
    '.ggggggk.',
    '.ggggggk.',
    '..k...k..',
  ],
};
