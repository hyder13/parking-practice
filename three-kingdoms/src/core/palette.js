/**
 * 全場唯一的調色盤。
 * 大方向:三國演義 + Q 版立體繪本。地面是柔和的草地 / 黃土 / 江水,
 * 角色用 Q 版大頭比例、高辨識度的陣營色(蜀漢白銀 + 綠、黃巾土黃、魏軍深藍、騎兵黑紅),
 * 再交給 cel 陰影與描線做出紙藝 / 黏土的立體感。
 */
export const PAL = {
  sea: 0x8ab85a,
  ink: 0x2a2018,

  // light
  key: 0xfff4e0,
  fill: 0xc8d8ff,
  rim: 0xffe0b0,
  hemiSky: 0xf4f8ff,
  hemiGround: 0x7a8a60,

  // 趙雲(玩家)
  shipWhite: 0xf4f2ec,   // 白馬
  shipRed: 0xd8322e,
  shipBlue: 0xc8d0e0,    // 銀甲
  shipCyan: 0xe8f0ff,
  engine: 0xfff6d8,
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,
  skin: 0xf6d2b0,
  hair: 0x2a2226,

  // 黃巾兵(原本的蜂)
  beeBody: 0xa8784a,
  beeBelly: 0xd8b888,
  beeBand: 0xf2c23a,
  beeWing: 0x8a5a3a,
  beeWingRim: 0x6a4a30,
  eye: 0x2a2226,
  antenna: 0x2a2226,

  // 魏軍弓兵(原本的蝶)
  bflyBody: 0x2e4a8a,
  bflyHead: 0x23262e,
  bflyWing: 0x3a5aa8,
  bflyRim: 0x8a6a3a,

  // 騎兵(原本的王,打兩下)
  bossBody: 0x3a3438,
  bossHead: 0xb8282a,
  bossWing: 0x5a3a2a,
  bossInner: 0x8a8a94,
  bossHit: 0xc8703a,
  bossHitHead: 0x8a3a2a,
  bossCrown: 0xffc23a,

  // shots / fx
  shot: 0xfff2c0,
  shotTip: 0xffd24a,
  ebullet: 0xff5a2a,     // 火箭(敵方箭矢)
  ebulletCore: 0xfff0c0,
  beam: 0xffe0a0,
  beam2: 0xff8a3a,
  white: 0xffffff,
  smoke: 0xb8a078,       // 塵土
  fire: 0xffb03a,
};

/**
 * 戰場主題(草地兩色 / 道路 / 江水 / 樹 / 光線 + 會捲過去的東西)。每關用 stages.js 的 STAGE_THEME 指定。
 *   trees / camps / petals / clouds / rocks:每 100 單位行軍距離大約出現幾個
 *   river:0 = 沒有江、1 = 畫面中有一條蜿蜒的江
 */
export const THEMES = [
  { name: '桃園', deep: 0x74b05a, sea: 0x96c86a, foam: 0xdcc494, water: 0x5aa0c8, trunk: 0x7a5a3a, canopy: 0xffa8c4, canopy2: 0xff88aa, petal: 0xffb8cc, cloud: 0xf8f4ec, key: 0xfff4e0, keyI: 2.3, hemi: 0xf4fff0, river: 0, trees: 5, camps: 0.6, petals: 9, clouds: 1.5, rocks: 1 },
  { name: '黃巾平原', deep: 0xc0ae62, sea: 0xdcca84, foam: 0xb08a58, water: 0x6aa0b0, trunk: 0x6a4a30, canopy: 0x8aa04a, canopy2: 0x6a8a3a, petal: 0xe8d8a0, cloud: 0xe8dcc0, key: 0xfff0d0, keyI: 2.4, hemi: 0xfff4e0, river: 0, trees: 1.6, camps: 2.2, petals: 5, clouds: 2, rocks: 2 },
  { name: '長坂坡', deep: 0x629a48, sea: 0x84b45a, foam: 0xc8a870, water: 0x5a9ac0, trunk: 0x6a4a30, canopy: 0x3a8a4a, canopy2: 0x2e7040, petal: 0x9ad06a, cloud: 0xf4f4ee, key: 0xfff4e0, keyI: 2.3, hemi: 0xf0fff0, river: 0, trees: 3.5, camps: 1, petals: 3, clouds: 1.5, rocks: 1.5 },
  { name: '赤壁', deep: 0x34402e, sea: 0x46543a, foam: 0x7a6a4a, water: 0x28405e, trunk: 0x3a2a1a, canopy: 0x2a4a34, canopy2: 0x223c2a, petal: 0xffa030, cloud: 0x6a5a5a, key: 0xffa070, keyI: 2.0, hemi: 0xc8a0a0, river: 1, trees: 2, camps: 1.6, petals: 10, clouds: 2.5, rocks: 1 },
  { name: '關隘', deep: 0x9a988a, sea: 0xb6b2a2, foam: 0x8a7a66, water: 0x6a90a8, trunk: 0x5a4a3a, canopy: 0x5a7a5a, canopy2: 0x4a6a4a, petal: 0xd8d4c8, cloud: 0xe8e8e4, key: 0xfff4ec, keyI: 2.3, hemi: 0xf0f0f4, river: 0, trees: 1.5, camps: 1.2, petals: 3, clouds: 1.5, rocks: 6 },
  { name: '南蠻', deep: 0x347434, sea: 0x4a9446, foam: 0xb86a4a, water: 0x3a8a8a, trunk: 0x6a4a2a, canopy: 0x2a8a3a, canopy2: 0x5ab040, petal: 0xb8e060, cloud: 0xe8f4e8, key: 0xfff8e0, keyI: 2.4, hemi: 0xe8fff0, river: 0.6, trees: 6.5, camps: 0.8, petals: 4, clouds: 1.5, rocks: 1 },
  { name: '五丈原', deep: 0xae8446, sea: 0xcaa25e, foam: 0x8a6a4a, water: 0x5a7a9a, trunk: 0x5a3a2a, canopy: 0xd8642a, canopy2: 0xe8a03a, petal: 0xe86a3a, cloud: 0xf0dcc8, key: 0xffb880, keyI: 2.2, hemi: 0xffe0c8, river: 0, trees: 3, camps: 1.6, petals: 8, clouds: 1.5, rocks: 1.5 },
];

/** 材質畫風(arcade-core/render/toon.js);null = 原本的賽璐璐 */
export const TOON = null;
