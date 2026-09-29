/**
 * 全場唯一的調色盤。
 * 大方向:台灣廟會遶境。石板 / 紅磚街道、橘紅琉璃瓦的燕尾脊、紅燈籠、鞭炮紅紙屑;
 * 角色是 Q 版大頭的神將 / 鬼怪(本來就是大頭比例),再交給 cel 陰影與描線做出紙藝感。
 */
export const PAL = {
  sea: 0xb8b0a0,
  ink: 0x2a1a18,

  // light
  key: 0xfff4e0,
  fill: 0xc8d8ff,
  rim: 0xffe0b0,
  hemiSky: 0xfff8f0,
  hemiGround: 0x8a7a6a,

  // 三太子(玩家)
  shipWhite: 0xf8f0e0,
  shipRed: 0xd8322e,
  shipBlue: 0xffc23a,
  shipCyan: 0xfff2c0,
  engine: 0xffd86a,
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,
  skin: 0xffe0c8,
  hair: 0x2a2226,

  // 小鬼(原本的蜂)
  beeBody: 0x7ac8a8,
  beeBelly: 0xa8e8c8,
  beeBand: 0xf0a030,
  beeWing: 0x6a4a30,
  beeWingRim: 0x4a3020,
  eye: 0x2a2226,
  antenna: 0x2a2226,

  // 殭屍(原本的蝶)
  bflyBody: 0x2a3a6a,
  bflyHead: 0x23262e,
  bflyWing: 0xc8d8c8,
  bflyRim: 0xb8282a,

  // 夜叉(原本的王,打兩下)
  bossBody: 0x4a6ac8,
  bossHead: 0xe8502a,
  bossWing: 0xf0a030,
  bossInner: 0x8a8a94,
  bossHit: 0xa84ac8,
  bossHitHead: 0x6a2a8a,
  bossCrown: 0xffc23a,

  // shots / fx
  shot: 0xffd24a,        // 乾坤圈
  shotTip: 0xfff2a0,
  ebullet: 0x3ae0b0,     // 鬼火
  ebulletCore: 0xf0fff8,
  beam: 0xffe0a0,
  beam2: 0xff8a3a,
  white: 0xffffff,
  smoke: 0xd8d0c8,       // 鞭炮煙
  fire: 0xff4a3a,        // 紅紙屑
};

/**
 * 遶境路線的場景。每站用 stages.js 的 STAGE_THEME 指定。
 *   deep / sea:街道兩側的地面(town = 屋頂群、paddy = 稻田、harbor = 海水)
 *   road / grout:街道石板 / 紅磚與磚縫
 *   houses / temples / stalls / lanterns / petals / clouds:每 100 單位路程大約出現幾個
 */
export const THEMES = [
  { name: '廟埕', side: 'town', deep: 0x8a7a6a, sea: 0xa89880, road: 0xc8c0b0, grout: 0x9a9284, petal: 0xe8322e, cloud: 0xf0ece4, key: 0xfff4e0, keyI: 2.3, hemi: 0xfff8f0, houses: 5, temples: 1.2, stalls: 3, lanterns: 1.5, petals: 8, clouds: 1.5 },
  { name: '老街', side: 'town', deep: 0x8a4a3a, sea: 0xa85a44, road: 0xb8624a, grout: 0x8a4a3a, petal: 0xe8322e, cloud: 0xf0e8e0, key: 0xfff0dc, keyI: 2.3, hemi: 0xfff4ec, houses: 7, temples: 0.6, stalls: 4, lanterns: 2.5, petals: 6, clouds: 1 },
  { name: '夜市', side: 'town', deep: 0x2a2436, sea: 0x3a3048, road: 0x5a5260, grout: 0x3a3440, petal: 0xffd24a, cloud: 0x8a7a9a, key: 0xffd8b0, keyI: 1.9, hemi: 0xc8a8d8, houses: 6, temples: 0.5, stalls: 7, lanterns: 4, petals: 5, clouds: 1 },
  { name: '鞭炮陣', side: 'town', deep: 0x6a4a3a, sea: 0x8a6048, road: 0xa8988a, grout: 0x8a7a6a, petal: 0xe8322e, cloud: 0xf4f0ec, key: 0xffc8a0, keyI: 2.1, hemi: 0xffe8d8, houses: 5, temples: 1, stalls: 2, lanterns: 2, petals: 16, clouds: 5 },
  { name: '鄉間', side: 'paddy', deep: 0x6aa04a, sea: 0x8ac060, road: 0xc8b48a, grout: 0xa8946a, petal: 0xe8322e, cloud: 0xf4f4ec, key: 0xfff6e0, keyI: 2.4, hemi: 0xf4fff0, houses: 1.5, temples: 0.8, stalls: 1, lanterns: 0.8, petals: 4, clouds: 1.5 },
  { name: '漁港', side: 'harbor', deep: 0x2a6a9a, sea: 0x3a8ab8, road: 0xb8b4a8, grout: 0x8a867a, petal: 0xe8322e, cloud: 0xf4f8ff, key: 0xfff4e8, keyI: 2.4, hemi: 0xf0f8ff, houses: 2, temples: 0.8, stalls: 2, lanterns: 1.5, petals: 5, clouds: 1.5 },
  { name: '燈會', side: 'town', deep: 0x1e1a3a, sea: 0x2a2450, road: 0x4a4468, grout: 0x2e2a48, petal: 0xffd86a, cloud: 0x6a5a9a, key: 0xd0c0ff, keyI: 1.9, hemi: 0xa898e0, houses: 5, temples: 0.8, stalls: 2, lanterns: 6, petals: 6, clouds: 1 },
];

/** 材質畫風(arcade-core/render/toon.js);null = 原本的賽璐璐 */
export const TOON = null;
