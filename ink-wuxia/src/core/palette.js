/**
 * 全場唯一的調色盤。
 * 大方向:水墨畫。宣紙的暖白是底(大量留白),東西用墨的濃淡(焦 / 濃 / 重 / 淡 / 清)畫,
 * 唯一的鮮色是朱紅(印章、紅繩、酒罈的紅紙、梅花、敵人的飛鏢)。最後一道畫風 pass(skin.js LOOK.style)
 * 會把畫面轉成墨色 + 保留朱紅 + 一點點淡彩,所以這裡的顏色以「亮度」為主,紅色才用飽和的朱紅。
 */
export const PAL = {
  sea: 0xf0ebe0,
  ink: 0x121212,

  // light
  key: 0xfffaf0,
  fill: 0xd8d8e0,
  rim: 0xfff4e4,
  hemiSky: 0xf8f6f0,
  hemiGround: 0x8a8880,

  // 少年劍客(玩家)
  shipWhite: 0xf4f2ec,
  shipRed: 0xe8e6e0,     // 白色長衫
  shipBlue: 0x3a3a3c,    // 墨色腰帶 / 外袍
  shipCyan: 0xffffff,
  engine: 0xffffff,
  captive: 0xc8281e,
  captiveDark: 0x6a1a14,
  skin: 0xf4e4d0,
  hair: 0x181818,

  // 山賊(原本的蜂)
  beeBody: 0x4a4a4c,
  beeBelly: 0x8a8a88,
  beeBand: 0x1c1c1e,
  beeWing: 0xc8c8c4,
  beeWingRim: 0x2a2a2c,
  eye: 0x121212,
  antenna: 0x1a1a1a,

  // 飛賊(原本的蝶,輕功飛過來)
  bflyBody: 0x2a2a2c,
  bflyHead: 0x1a1a1c,
  bflyWing: 0x6a6a6c,
  bflyRim: 0xc8281e,

  // 鐵頭陀(原本的王,打兩下;被打一下袍子破了、臉氣紅)
  bossBody: 0x7a7a78,
  bossHead: 0xf0dcc4,
  bossWing: 0x3a2a1c,
  bossInner: 0x2a2a2a,
  bossHit: 0x4a4a48,
  bossHitHead: 0xe06a50,
  bossCrown: 0xc8281e,

  // shots / fx
  shot: 0x1a1a1c,        // 墨色劍氣
  shotTip: 0x5a5a5c,
  ebullet: 0xd02a1e,     // 朱紅飛鏢
  ebulletCore: 0x1a1a1a,
  beam: 0x3a3a3c,
  beam2: 0x8a8a8a,
  white: 0xffffff,
  smoke: 0x9a9894,
  fire: 0xd8321e,
};

/**
 * 江湖的 7 個場景(每一回用 stages.js 的 STAGE_THEME 指定)。
 *   deep / sea / foam:地面的墨色(濃 / 紙色 / 淡);water:水邊的墨;wash:淡墨暈染的多寡;river:江(0 = 沒有)
 *   snow:雪地(留白更多);lotus:湖上的荷葉;dark:夜裡的濃墨(魔教)
 *   trunk / canopy / canopy2:樹的墨色;tree:樹形(bamboo 竹 / pine 松 / plum 梅 / willow 柳)
 *   props:地上的大物件(pavilion 亭子 / bridge 石橋 / boat 小舟 / inn 客棧 / rocks 山石 / lotus 荷花 / lantern 石燈 / shrine 魔教祭壇)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(camps = props;petals = 竹葉 / 雪 / 花瓣 / 火星;clouds = 雲霧)
 */
export const THEMES = [
  { name: '竹林', deep: 0x2a2a2a, sea: 0xf0ebe0, foam: 0xb8b4ac, water: 0x6a6a6a, trunk: 0x3a3a3a, canopy: 0x2a2a2a, canopy2: 0x5a5a5a, tree: 'bamboo', props: ['pavilion', 'rocks', 'lantern'],
    petal: 0x3a3a3a, cloud: 0xffffff, key: 0xfffaf0, keyI: 2.4, hemi: 0xf8f6f0, wash: 0.5, river: 0, snow: 0, lotus: 0, dark: 0, trees: 7, camps: 1.4, petals: 8, clouds: 2, rocks: 1.5 },
  { name: '客棧小鎮', deep: 0x2a2a2a, sea: 0xf0ebe0, foam: 0xc8c4bc, water: 0x6a6a6a, trunk: 0x3a3a3a, canopy: 0x3a3a3a, canopy2: 0x6a6a6a, tree: 'willow', props: ['inn', 'inn', 'lantern'],
    petal: 0xd02a1e, cloud: 0xffffff, key: 0xfffaf0, keyI: 2.4, hemi: 0xf8f6f0, wash: 0.35, river: 0.25, snow: 0, lotus: 0, dark: 0, trees: 2, camps: 2.2, petals: 2, clouds: 1.5, rocks: 1 },
  { name: '山水', deep: 0x222222, sea: 0xf0ebe0, foam: 0xa8a49c, water: 0x5a5a5a, trunk: 0x2a2a2a, canopy: 0x2a2a2a, canopy2: 0x4a4a4a, tree: 'pine', props: ['rocks', 'bridge', 'boat', 'pavilion'],
    petal: 0x4a4a4a, cloud: 0xffffff, key: 0xfffaf0, keyI: 2.4, hemi: 0xf8f6f0, wash: 0.8, river: 1.1, snow: 0, lotus: 0, dark: 0, trees: 3, camps: 2, petals: 3, clouds: 3, rocks: 2 },
  { name: '雪山', deep: 0x2a2a2a, sea: 0xf8f6f0, foam: 0xd8d4cc, water: 0x8a8a8a, trunk: 0x2a2a2a, canopy: 0x3a3a3a, canopy2: 0xe8e6e0, tree: 'pine', props: ['rocks', 'pavilion'],
    petal: 0xffffff, cloud: 0xffffff, key: 0xf8faff, keyI: 2.3, hemi: 0xf8faff, wash: 0.25, river: 0, snow: 1, lotus: 0, dark: 0, trees: 3, camps: 1.3, petals: 12, clouds: 3.5, rocks: 1.5 },
  { name: '荷花湖', deep: 0x2a2a2a, sea: 0xf0ebe0, foam: 0xb8b4ac, water: 0x7a7a7a, trunk: 0x3a3a3a, canopy: 0x3a3a3a, canopy2: 0x6a6a6a, tree: 'willow', props: ['lotus', 'lotus', 'boat', 'bridge'],
    petal: 0xe86a70, cloud: 0xffffff, key: 0xfffaf0, keyI: 2.4, hemi: 0xf8f6f0, wash: 0.4, river: 0, snow: 0, lotus: 1, dark: 0, trees: 1.5, camps: 2.6, petals: 3, clouds: 2, rocks: 0.5 },
  { name: '懸崖古寺', deep: 0x1c1c1c, sea: 0xece6da, foam: 0x9a968e, water: 0x4a4a4a, trunk: 0x222222, canopy: 0x2a2a2a, canopy2: 0x4a4a4a, tree: 'plum', props: ['rocks', 'pavilion', 'lantern'],
    petal: 0xd02a1e, cloud: 0xffffff, key: 0xfff4e8, keyI: 2.3, hemi: 0xf0ece4, wash: 1, river: 0, snow: 0, lotus: 0, dark: 0.2, trees: 3, camps: 1.8, petals: 5, clouds: 4, rocks: 3 },
  { name: '魔教總壇', deep: 0x2a2a2a, sea: 0xb8b2a8, foam: 0x7a7670, water: 0x2a2a2a, trunk: 0x121212, canopy: 0x1c1c1c, canopy2: 0x3a3a3a, tree: 'plum', props: ['shrine', 'rocks', 'shrine'],
    petal: 0xd02a1e, cloud: 0x5a5a5a, key: 0xffd8c8, keyI: 2.1, hemi: 0xc8b8b0, wash: 1, river: 0, snow: 0, lotus: 0, dark: 0.55, trees: 2, camps: 2.2, petals: 12, clouds: 2.5, rocks: 2 },
];

/** 材質畫風(arcade-core/render/toon.js);水墨版用原本的賽璐璐色階,濃淡交給最後的畫風 pass */
export const TOON = null;
