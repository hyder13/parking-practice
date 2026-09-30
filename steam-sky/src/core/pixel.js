/* ------------------------------------------------------------------ *
 * HUD 用的點陣小圖(剩餘戰機、關卡旗):字元陣列 → canvas → dataURL。
 * 顯示時加 CSS image-rendering: pixelated,保留原作的像素顆粒感。
 * 這裡只放圖;轉成圖片的程式在 arcade-core/ui/sprite.js。
 * ------------------------------------------------------------------ */
export const COLORS = {
  w: '#f0e8d8', s: '#6a6a72', k: '#1e140c', b: '#3a5a8a', y: '#e8b84a', r: '#c83a2a', f: '#ffd8b8', g: '#3a8a7a',
  n: '#8a5a3a', c: '#9ae8f0', o: '#ff8a2a', d: '#4a4a52',
};

export const SPRITES = {
  // 小飛行員(皮帽 + 黃銅護目鏡 + 紅圍巾)
  ship: [
    '...nnnnn...',
    '..nyyynyy..',
    '..nycynyc..',
    '..nffffff..',
    '...fkffkf..',
    '..rrrrrrr..',
    '.nnnnnnnnn.',
    '.n.nnnnn.ny',
    '...nn.nn...',
  ],
  // 關卡圖示:1 旗 / 5 齒輪 / 10 懷錶 / 50 皇冠
  flag: [
    'kyyy.',
    'kyry.',
    'kyyy.',
    'k....',
    'k....',
  ],
  badge5: [
    '.y.y.',
    'yyyyy',
    '.yky.',
    'yyyyy',
    '.y.y.',
  ],
  badge10: [
    '..y..',
    '.yyy.',
    'ywkwy',
    'ywwwy',
    '.yyy.',
  ],
  badge50: [
    'y..y..y',
    'yy.y.yy',
    'yyyyyyy',
    'yryyyby',
    'yyyyyyy',
    '.......',
  ],
  // 發條兵
  bee: [
    '...kkk...',
    '...kyk...',
    '...kkk...',
    '..fffff..',
    '..frfrf..',
    '.bwbbbwb.',
    '..bwbwb..',
    '..k...k..',
  ],
  // 發條蜻蜓
  bfly: [
    '....y....',
    '..cyyyc..',
    'cc.ggg.cc',
    'ccccgcccc',
    '....g....',
    '....y....',
    '....g....',
    '....o....',
  ],
  // 蒸汽機器人
  boss: [
    '......d..',
    '..yyyyd..',
    '.yykkkyy.',
    '.ykoyoky.',
    '..yyyyy..',
    '.dsssssd.',
    'd.swsws.d',
    '..sssss..',
    '..d...d..',
  ],
};
