/**
 * 全場唯一的調色盤。
 * 大方向:1930 年代的黑白卡通。最後一道畫風 pass(skin.js LOOK.style)會把整個畫面轉成黑白底片,
 * 所以這裡的顏色重點是「亮度」:角色用黑 / 白 / 奶油色拉開對比,背景用中間調的灰(像當年的水彩背景)。
 * 角色是橡皮管手腳 + 派切眼 + 白手套的卡通明星。
 */
export const PAL = {
  sea: 0x9a948a,
  ink: 0x141210,

  // light
  key: 0xfff8ec,
  fill: 0xd8d4cc,
  rim: 0xfff0dc,
  hemiSky: 0xf8f4ec,
  hemiGround: 0x6a665e,

  // 小咚(玩家)
  shipWhite: 0xf4f0e8,
  shipRed: 0x24221e,     // 黑色身體
  shipBlue: 0x8a847a,    // 灰短褲
  shipCyan: 0xfff8e8,
  engine: 0xfff4d8,
  captive: 0xd8d0c4,
  captiveDark: 0x5a564e,
  skin: 0xf2e8d8,        // 奶油色的臉
  hair: 0x24221e,

  // 跳舞的花(原本的蜂)
  beeBody: 0xf4f0e8,     // 白花瓣
  beeBelly: 0x6a8a5a,    // 莖和葉(轉黑白後是中灰)
  beeBand: 0x2a2824,
  beeWing: 0x7a9a6a,
  beeWingRim: 0x3a3a34,
  eye: 0x141210,
  antenna: 0x24221e,

  // 小幽靈(原本的蝶)
  bflyBody: 0xf8f6f0,
  bflyHead: 0xf8f6f0,
  bflyWing: 0xd8d4cc,
  bflyRim: 0x24221e,

  // 骷髏(原本的王,打兩下;被打一下骨頭散開變暗)
  bossBody: 0xf0ece0,
  bossHead: 0xf4f0e6,
  bossWing: 0x24221e,
  bossInner: 0x3a3834,
  bossHit: 0x8a8478,
  bossHitHead: 0xa8a294,
  bossCrown: 0xfff8e0,

  // shots / fx
  shot: 0xfffcf0,        // 音符(白色 + 黑框)
  shotTip: 0x24221e,
  ebullet: 0xf8f4ea,     // 奶油派(白奶油 + 深色派皮)
  ebulletCore: 0x5a5046,
  beam: 0xfff8e0,
  beam2: 0xd8d0c0,
  white: 0xffffff,
  smoke: 0xe8e4dc,
  fire: 0xfff0d0,
};

/**
 * 卡通劇場的 7 個場景(每一集用 stages.js 的 STAGE_THEME 指定)。
 *   deep / sea:地面兩色(轉黑白後只看亮度);foam:小路 / 街道;water:河(river 0 = 沒有)
 *   pave:1 = 石板街;cloud:1 = 地面是雲海(夢境)
 *   trunk / canopy / canopy2:樹的顏色;tree:樹形(round 會跳舞的圓樹 / dead 枯樹 / pine 松 / puff 雲朵樹)
 *   props:地上的大物件(house 小屋 / barn 穀倉 / hay 乾草堆 / tent 馬戲團帳篷 / tombs 墓碑 / boat 小船)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(camps = props;petals = 音符 / 落葉 / 星星)
 */
export const THEMES = [
  { name: '小鎮大街', deep: 0xa8a296, sea: 0xbab4a8, foam: 0xd8d2c4, water: 0x7a8088, trunk: 0x2a2824, canopy: 0xd4d0c4, canopy2: 0xb4b0a4, tree: 'round', props: ['house', 'house', 'hay'],
    petal: 0xf8f4ea, cloud: 0xf4f0e8, key: 0xfff8ec, keyI: 2.4, hemi: 0xf8f4ec, river: 0, pave: 1, cloudy: 0, trees: 3, camps: 1.8, petals: 4, clouds: 1.2, rocks: 0.8 },
  { name: '快樂農場', deep: 0x9a9a84, sea: 0xb0b098, foam: 0xd0c8b0, water: 0x7a8288, trunk: 0x2a2824, canopy: 0xccccbc, canopy2: 0xacac9c, tree: 'round', props: ['barn', 'hay', 'hay', 'house'],
    petal: 0xf8f4ea, cloud: 0xf4f0e8, key: 0xfff8ec, keyI: 2.4, hemi: 0xf8f4ec, river: 0.4, pave: 0, cloudy: 0, trees: 4, camps: 1.8, petals: 3, clouds: 1.5, rocks: 1 },
  { name: '午夜墓園', deep: 0x6a665e, sea: 0x7c786e, foam: 0x9a948a, water: 0x4a4e54, trunk: 0x2a2824, canopy: 0x3a3830, canopy2: 0x2e2c26, tree: 'dead', props: ['tombs', 'tombs', 'house'],
    petal: 0xd8d4cc, cloud: 0xc8c4bc, key: 0xe8ecf4, keyI: 2.0, hemi: 0xc8ccd4, river: 0, pave: 0, cloudy: 0, trees: 3, camps: 2.2, petals: 6, clouds: 3, rocks: 1.5 },
  { name: '碼頭港口', deep: 0x8a8e90, sea: 0x9ea2a2, foam: 0xc8c2b4, water: 0x6a7278, trunk: 0x2a2824, canopy: 0x5a5a52, canopy2: 0x44443e, tree: 'pine', props: ['boat', 'house', 'boat'],
    petal: 0xf4f0e8, cloud: 0xf0ece4, key: 0xfff8ec, keyI: 2.3, hemi: 0xf0f0ec, river: 0.85, pave: 0, cloudy: 0, trees: 2, camps: 1.6, petals: 3, clouds: 2.5, rocks: 1.5 },
  { name: '馬戲團', deep: 0xa49c8c, sea: 0xb8b0a0, foam: 0xdcd4c4, water: 0x7a8088, trunk: 0x2a2824, canopy: 0xd4d0c4, canopy2: 0xb4b0a4, tree: 'round', props: ['tent', 'tent', 'hay'],
    petal: 0xfffcf0, cloud: 0xf8f4ec, key: 0xfff8ec, keyI: 2.5, hemi: 0xfff8f0, river: 0, pave: 0, cloudy: 0, trees: 2, camps: 2.2, petals: 8, clouds: 1, rocks: 0.6 },
  { name: '雲上夢境', deep: 0xa8a49c, sea: 0xc4c0b8, foam: 0xe4e0d8, water: 0x9a9ea4, trunk: 0x8a8680, canopy: 0xf4f0ea, canopy2: 0xe0dcd4, tree: 'puff', props: ['house', 'tent'],
    petal: 0xfffcf4, cloud: 0xffffff, key: 0xfffcf4, keyI: 2.3, hemi: 0xffffff, river: 0, pave: 0, cloudy: 1, trees: 4, camps: 1.0, petals: 10, clouds: 2, rocks: 0 },
  { name: '月夜狂歡', deep: 0x4a4844, sea: 0x5a5852, foam: 0x7a766e, water: 0x3a3e44, trunk: 0x24221e, canopy: 0x3a3a34, canopy2: 0x2e2e2a, tree: 'dead', props: ['tombs', 'house', 'tent'],
    petal: 0xf4f0e0, cloud: 0x8a8680, key: 0xd8dcec, keyI: 2.0, hemi: 0xb0b4c0, river: 0.3, pave: 1, cloudy: 0, trees: 2.5, camps: 2, petals: 12, clouds: 2, rocks: 1 },
];

/** 材質畫風(arcade-core/render/toon.js);黑白卡通用原本的賽璐璐色階就好(平塗 + 一層陰影) */
export const TOON = null;
