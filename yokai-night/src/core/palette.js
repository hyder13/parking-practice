/**
 * 全場唯一的調色盤。
 * 大方向:浮世繪木版畫。普魯士藍(ベロ藍)、藍染、朱紅、黃土、墨黑、米色和紙;
 * 色塊平塗(cel 只分 2 階)、粗墨線,陰影偏藍紫 —— 像歌川國芳的妖怪畫。
 * 角色是 Q 版大頭的陰陽師 / 妖怪,再交給 cel 陰影與描線做出紙藝感。
 */
export const PAL = {
  sea: 0x2a2a3a,
  ink: 0x1a1a2a,     // 墨(微微偏藍)

  // light
  key: 0xfff0d8,
  fill: 0xb8c8e8,
  rim: 0xffd8b0,
  hemiSky: 0xf4ecdc,
  hemiGround: 0x6a6a7a,

  // 陰陽師(玩家)
  shipWhite: 0xc8d4f0,   // 淡藍狩衣
  shipRed: 0xc8323a,     // 朱
  shipBlue: 0x3a4a8a,    // 藍染
  shipCyan: 0xe8f0ff,
  engine: 0xa8d0ff,      // 靈氣
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,
  skin: 0xf8e2cc,
  hair: 0x1a1a22,

  // 唐傘妖(原本的蜂)
  beeBody: 0xc8503a,     // 朱紅油紙傘
  beeBelly: 0xf2d8a0,
  beeBand: 0xf2d8a0,     // 傘骨
  beeWing: 0x6a4a30,     // 木柄
  beeWingRim: 0x4a3020,
  eye: 0x1a1a22,
  antenna: 0x1a1a22,

  // 提燈妖(原本的蝶)
  bflyBody: 0xf4e8c8,    // 燈籠紙
  bflyHead: 0x1a1a22,    // 黑框
  bflyWing: 0xff8a3a,
  bflyRim: 0xc8323a,

  // 赤鬼(原本的王,打兩下;被打一下變青鬼)
  bossBody: 0xd8402a,
  bossHead: 0x1a1a22,
  bossWing: 0xf2c23a,
  bossInner: 0x6a6a74,
  bossHit: 0x3a6ac8,
  bossHitHead: 0x1a2a4a,
  bossCrown: 0xffc23a,

  // shots / fx
  shot: 0xfaf6ea,        // 符札(白紙)
  shotTip: 0xd8323a,     // 朱印
  ebullet: 0x7ab8ff,     // 人魂(青白色的鬼火)
  ebulletCore: 0xf0f8ff,
  beam: 0xc8d8ff,
  beam2: 0x7a8aff,
  white: 0xffffff,
  smoke: 0xe8e0d0,
  fire: 0xff6a3a,
};

/**
 * 平安京三十夜的場景。每一夜用 stages.js 的 STAGE_THEME 指定。
 *   side:街道兩側的地面(town = 瓦屋頂、paddy = 稻田、harbor = 北斎的大浪、forest = 杉林 / 竹林 / 紅葉)
 *   deep / sea:兩側地面的兩個顏色;road / grout:街道(土路 / 石疊)與縫;pave 1 = 石疊、0 = 土路
 *   roof:町家屋瓦;tree:街邊種什麼(sakura / maple / willow / bamboo / pine);gate:跨街的是鳥居還是燈籠串
 *   houses / temples / stalls / lanterns / petals / clouds:每 100 單位路程大約出現幾個(clouds = 金色的霞)
 */
export const THEMES = [
  { name: '平安京', side: 'town', deep: 0x4a5a7a, sea: 0x62728e, road: 0xdcc49a, grout: 0xae966e, pave: 0, roof: 0x55607a, tree: 'willow', gate: 'rope',
    petal: 0xffb8c8, cloud: 0xf0d8a0, key: 0xffd8b0, keyI: 2.5, hemi: 0xfff0dc, houses: 6, temples: 0.8, stalls: 2.5, lanterns: 1.2, petals: 3, clouds: 1.4 },
  { name: '千本鳥居', side: 'forest', deep: 0x2a5236, sea: 0x46784a, road: 0xb8a888, grout: 0x8a7a60, pave: 1, roof: 0x4a4e5c, tree: 'pine', gate: 'torii',
    petal: 0xd8e8a0, cloud: 0xf0d8a0, key: 0xfff0d8, keyI: 2.5, hemi: 0xf0f4e0, houses: 0.6, temples: 0.7, stalls: 3, lanterns: 4, petals: 2, clouds: 1 },
  { name: '竹林', side: 'forest', deep: 0x3a6a32, sea: 0x6a9a44, road: 0xa8a080, grout: 0x7a7458, pave: 1, roof: 0x4a4e5c, tree: 'bamboo', gate: 'rope',
    petal: 0x9ad06a, cloud: 0xe8f0d0, key: 0xf4fff0, keyI: 2.5, hemi: 0xe8ffe8, houses: 0.8, temples: 0.5, stalls: 9, lanterns: 0.6, petals: 5, clouds: 1.2 },
  { name: '夜櫻', side: 'town', deep: 0x283060, sea: 0x384478, road: 0x7a7890, grout: 0x565468, pave: 1, roof: 0x3a4068, tree: 'sakura', gate: 'rope',
    petal: 0xffc8d8, cloud: 0xd8b8e8, key: 0xd0d8ff, keyI: 2.1, hemi: 0xc0c0f0, houses: 5, temples: 0.7, stalls: 4, lanterns: 3.5, petals: 12, clouds: 1 },
  { name: '浪裏', side: 'harbor', deep: 0x1a3a7a, sea: 0x2a5aa8, road: 0xc8b890, grout: 0x9a8a6a, pave: 0, roof: 0x4a4e5c, tree: 'pine', gate: 'rope',
    petal: 0xf4f8ff, cloud: 0xf0e0b0, key: 0xfff4e0, keyI: 2.4, hemi: 0xf0f4ff, houses: 1.5, temples: 0.4, stalls: 2.5, lanterns: 0.8, petals: 6, clouds: 1.6 },
  { name: '雪夜', side: 'town', deep: 0xc8d0dc, sea: 0xe0e6ee, road: 0xe8eef4, grout: 0xb8c4d0, pave: 0, roof: 0xe8eef6, tree: 'pine', gate: 'rope',
    petal: 0xffffff, cloud: 0xd8e0f0, key: 0xd8e4ff, keyI: 2.0, hemi: 0xd8e0f8, houses: 5, temples: 0.8, stalls: 2.5, lanterns: 1.5, petals: 16, clouds: 1 },
  { name: '紅葉', side: 'forest', deep: 0x9a3422, sea: 0xd8682e, road: 0xd8b888, grout: 0x9a7a58, pave: 1, roof: 0x4a4e5c, tree: 'maple', gate: 'torii',
    petal: 0xe8502a, cloud: 0xf0d090, key: 0xffc890, keyI: 2.2, hemi: 0xffe0c8, houses: 1.2, temples: 1.4, stalls: 5, lanterns: 1.2, petals: 10, clouds: 1.2 },
];

/** 材質畫風(arcade-core/render/toon.js);null = 原本的賽璐璐 */
export const TOON = null;
