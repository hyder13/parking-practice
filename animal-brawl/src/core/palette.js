/**
 * 全場唯一的調色盤。
 * 大方向:卡通動物大亂鬥。明亮飽和的草地綠 / 沙黃 / 天空藍,柴犬的橘、貓咪的三花、
 * 野豬的咖啡、鸚鵡的紅綠藍;角色是 Q 版大頭的動物,再交給 cel 陰影與描線做出黏土感。
 */
export const PAL = {
  sea: 0x6ab84a,
  ink: 0x2a2018,

  // light
  key: 0xfff6e8,
  fill: 0xc8d8ff,
  rim: 0xffe8c0,
  hemiSky: 0xf4fbff,
  hemiGround: 0x7a8a60,

  // 柴犬(玩家)
  shipWhite: 0xfff4e4,   // 白色的臉頰 / 肚子
  shipRed: 0xe89a48,     // 柴犬橘
  shipBlue: 0x3a8ad8,
  shipCyan: 0xfff2c0,
  engine: 0xfff0d0,
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,
  skin: 0xfff4e4,
  hair: 0xe89a48,

  // 兔子(原本的蜂)
  beeBody: 0xf4f0ec,
  beeBelly: 0xffd0d8,
  beeBand: 0xff8a2a,     // 紅蘿蔔
  beeWing: 0x5ab84a,
  beeWingRim: 0x6a4020,
  eye: 0x2a2226,
  antenna: 0x2a2226,

  // 鸚鵡(原本的蝶)
  bflyBody: 0xe8322e,
  bflyHead: 0xffd24a,
  bflyWing: 0x2a8ad8,
  bflyRim: 0x3ab86a,

  // 野豬(原本的王,打兩下;被打一下氣到發紅)
  bossBody: 0xa06a44,
  bossHead: 0x6e4a30,
  bossWing: 0xf4ecdc,    // 獠牙
  bossInner: 0xe89a8a,   // 鼻子
  bossHit: 0xd84a3a,
  bossHitHead: 0x8a2a1a,
  bossCrown: 0xffc23a,

  // shots / fx
  shot: 0xfaf6ea,        // 骨頭
  shotTip: 0xe8dcc0,
  ebullet: 0x9a5a2a,     // 橡實
  ebulletCore: 0xd8a868,
  beam: 0xffe0a0,
  beam2: 0xff8a3a,
  white: 0xffffff,
  smoke: 0xe8dcc0,       // 塵土
  fire: 0xffb03a,
};

/**
 * 動物大亂鬥的 7 種場景。每一回合用 stages.js 的 STAGE_THEME 指定。
 *   deep / sea:地面兩色;foam:小路;water:河(river 0 = 沒有河、1 = 有一條蜿蜒的河 / 海灘的海)
 *   trunk / canopy / canopy2:樹的顏色;tree:樹形(round 圓樹 / palm 椰子樹 / acacia 金合歡 / pine 松 / cactus 仙人掌)
 *   props:地上的大物件(barn 穀倉 / fence 柵欄 / mushroom 大蘑菇 / igloo 冰屋 / mound 蟻丘 / hut 草屋 / parasol 陽傘)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(camps = props)
 */
export const THEMES = [
  { name: '草原', deep: 0xc8b048, sea: 0xdcc864, foam: 0xc89a5a, water: 0x5aa0c8, trunk: 0x6a4a30, canopy: 0x7aa03a, canopy2: 0x5a8a2e, tree: 'acacia', props: ['mound', 'fence'],
    petal: 0xf0e0a0, cloud: 0xf0e0c0, key: 0xfff0d0, keyI: 2.5, hemi: 0xfff4e0, river: 0, trees: 2.5, camps: 1.4, petals: 4, clouds: 1.5, rocks: 1.5 },
  { name: '叢林', deep: 0x2e7a3a, sea: 0x3e9a44, foam: 0x9a7a4a, water: 0x3a9ab8, trunk: 0x5a3a24, canopy: 0x2e8a3a, canopy2: 0x5ab040, tree: 'palm', props: ['mushroom', 'hut'],
    petal: 0xff6a8a, cloud: 0xe8f4e8, key: 0xfff8e0, keyI: 2.4, hemi: 0xe8fff0, river: 0.7, trees: 6, camps: 1.2, petals: 5, clouds: 1.5, rocks: 0.8 },
  { name: '農場', deep: 0x6ab84a, sea: 0x8ad05a, foam: 0xd8b07a, water: 0x5aa8d8, trunk: 0x7a5a3a, canopy: 0x4aa040, canopy2: 0x6ab84a, tree: 'round', props: ['barn', 'fence'],
    petal: 0xffffff, cloud: 0xf8f8f0, key: 0xfff6e8, keyI: 2.5, hemi: 0xf4fff0, river: 0, trees: 3, camps: 1.8, petals: 4, clouds: 1.5, rocks: 0.6 },
  { name: '冰原', deep: 0xd0e0f0, sea: 0xe8f2fc, foam: 0xa8c0d8, water: 0x6ab0e0, trunk: 0x5a4a3a, canopy: 0x2e6a4a, canopy2: 0x3e7a5a, tree: 'pine', props: ['igloo'],
    petal: 0xffffff, cloud: 0xf0f6ff, key: 0xe8f0ff, keyI: 2.3, hemi: 0xe0ecff, river: 0.5, trees: 2.5, camps: 1, petals: 12, clouds: 1.5, rocks: 2 },
  { name: '沙漠', deep: 0xe0b870, sea: 0xf0cc88, foam: 0xc8964a, water: 0x3ab8b0, trunk: 0x6a4a2a, canopy: 0x5a9a3a, canopy2: 0x7ab84a, tree: 'cactus', props: ['mound'],
    petal: 0xf8e8c0, cloud: 0xf8e8c8, key: 0xfff0d0, keyI: 2.6, hemi: 0xfff0dc, river: 0, trees: 2.5, camps: 0.8, petals: 3, clouds: 2.5, rocks: 3 },
  { name: '森林', deep: 0x3a7a3a, sea: 0x5a9a44, foam: 0xb8905a, water: 0x4a90b8, trunk: 0x6a4a2a, canopy: 0xd87a2a, canopy2: 0xe8a83a, tree: 'round', props: ['mushroom', 'hut'],
    petal: 0xe8702a, cloud: 0xf4ece0, key: 0xffe8c8, keyI: 2.4, hemi: 0xfff0e0, river: 0.4, trees: 6, camps: 1, petals: 8, clouds: 1.2, rocks: 1 },
  { name: '海灘', deep: 0xf0dca0, sea: 0xf8e8b8, foam: 0xd8b880, water: 0x2ab0d8, trunk: 0x7a5a3a, canopy: 0x3aa04a, canopy2: 0x5ab84a, tree: 'palm', props: ['parasol'],
    petal: 0xffffff, cloud: 0xf8fbff, key: 0xfff8ec, keyI: 2.6, hemi: 0xf4fbff, river: 1.4, trees: 2, camps: 1.6, petals: 3, clouds: 1.2, rocks: 1 },
];

/** 材質畫風(arcade-core/render/toon.js);null = 原本的賽璐璐 */
export const TOON = null;
