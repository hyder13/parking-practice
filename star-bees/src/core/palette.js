/**
 * 全場唯一的調色盤。
 * 大方向:背景維持街機的「純黑太空 + 彩色像素星」,角色用 80 年代街機那種
 * 高飽和的原色(綠蜂 / 紫紅蝶 / 橘色王),再交給 cel 陰影與描線去做 3D 質感。
 */
export const PAL = {
  space: 0x04030b,
  ink: 0x120e26,

  // stars:復古像素星的顏色
  stars: [0xffffff, 0xffffff, 0xff5a5a, 0x5a8cff, 0xffe35a, 0x6cff8a, 0xc77dff, 0x5affff],

  // light
  key: 0xfff2e0,
  fill: 0x8fa8ff,
  rim: 0xff8ad9,
  hemiSky: 0xc4d2ff,
  hemiGround: 0x3a2d5c,

  // player fighter
  shipWhite: 0xf1f2f8,
  shipRed: 0xe8322e,
  shipBlue: 0x3a6fff,
  shipCyan: 0x70e0ff,
  engine: 0xffa53a,
  captive: 0xe8322e, // 被抓走的戰機變紅色(原作的經典設定)
  captiveDark: 0x8f1f2a,

  // bee (ザコ)
  beeBody: 0x49c23c,
  beeBelly: 0xf2d33a,
  beeBand: 0x2a8a3a,
  beeWing: 0x3f6fe8,
  beeWingRim: 0x9fc0ff,
  eye: 0xff3b3b,
  antenna: 0x2a3a8a,

  // butterfly (ゴエイ)
  bflyBody: 0xe8403a,
  bflyHead: 0xf4eef2,
  bflyWing: 0xa05ce8,
  bflyRim: 0x4169ff,

  // boss (ボス)
  bossBody: 0xf39a2a,
  bossHead: 0xffc23a,
  bossWing: 0x3f6fe8,
  bossInner: 0xf5b43a,
  bossHit: 0x8f68ff,      // 第一發打中後轉成紫色
  bossHitHead: 0xc4a0ff,
  bossCrown: 0xffe35a,

  // shots / fx
  shot: 0xfff4d8,
  shotTip: 0xff3b3b,
  ebullet: 0xff4a6a,
  ebulletCore: 0xfff0f0,
  beam: 0x7fd8ff,
  beam2: 0xc98bff,
  white: 0xffffff,
};

/** 每一關的背景配色(星雲兩色 + 行星 + 行星環)。第 6 關以後循環。 */
export const THEMES = [
  { nebula: [0x3a1d7a, 0x13306f], planet: 0x7f6ad8, ring: 0xc9b8ff },
  { nebula: [0x0f4f5f, 0x1b2f7a], planet: 0x3fb3a8, ring: 0xaef0e0 },
  { nebula: [0x6f1d5f, 0x3a1d7a], planet: 0xe06a9a, ring: 0xffc0e0 },
  { nebula: [0x6f3a13, 0x3a1d4f], planet: 0xe0923a, ring: 0xffd9a0 },
  { nebula: [0x6f1320, 0x2a0f4f], planet: 0xc8443a, ring: 0xffb0a0 },
];
