/**
 * 全場唯一的調色盤。
 * 大方向:二戰縱向射擊的「藍色大海 + 雲 + 島嶼」,飛機用高辨識度的塗裝
 * (玩家銀白紅鼻 / 敵機橄欖綠、鐵鏽橘、鐵灰),再交給 cel 陰影與描線做 3D 質感。
 */
export const PAL = {
  sea: 0x2f7fc4,
  ink: 0x14203a,

  // light
  key: 0xfff2e0,
  fill: 0x9fc4ff,
  rim: 0xffe0b0,
  hemiSky: 0xd8ecff,
  hemiGround: 0x2f5a8a,

  // player fighter
  shipWhite: 0xe9edf2,
  shipRed: 0xe8322e,
  shipBlue: 0x2a3f8a,
  shipCyan: 0x8fe0ff,
  engine: 0xffa53a,
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,

  // 戰鬥機(原本的蜂)
  beeBody: 0x5f8f3a,
  beeBelly: 0xd8d8c0,
  beeBand: 0xf2c23a,
  beeWing: 0x4f7a30,
  beeWingRim: 0x2e4a22,
  eye: 0xff3b3b,
  antenna: 0x2a2f3a,

  // 俯衝轟炸機(原本的蝶)
  bflyBody: 0xd8663a,
  bflyHead: 0xf2e2b8,
  bflyWing: 0xc0552e,
  bflyRim: 0x6a3a22,

  // 重戰機(原本的王)
  bossBody: 0x5f6f8f,
  bossHead: 0x8fa0bf,
  bossWing: 0x4a5670,
  bossInner: 0x2e3648,
  bossHit: 0xc8603a,      // 第一發打中後:冒火變焦橘色
  bossHitHead: 0xffa06a,
  bossCrown: 0xffd23a,

  // shots / fx
  shot: 0xfff2b0,
  shotTip: 0xffb03a,
  ebullet: 0xff5a2a,
  ebulletCore: 0xfff4d0,
  beam: 0xffe0a0,
  beam2: 0xff8a3a,
  white: 0xffffff,
  smoke: 0x5a5a66,
  fire: 0xff7a2a,
};

/**
 * 每一關的場景(海色 / 浪花 / 雲 / 光線 + 會捲過去的東西)。第 n 關用 THEMES[(n-1) % 7]。
 *   islands / ships / ice / clouds:每 100 單位飛行距離大約出現幾個
 */
export const THEMES = [
  { name: 'MORNING', deep: 0x1d5a9e, sea: 0x2f86c8, foam: 0xd8f0ff, cloud: 0xffffff, key: 0xfff2e0, keyI: 2.4, hemi: 0xd8ecff, islands: 2.2, ships: 1.2, ice: 0, clouds: 5 },
  { name: 'TROPICAL', deep: 0x1583a8, sea: 0x2ab8c8, foam: 0xe8fff8, cloud: 0xffffff, key: 0xfff6d8, keyI: 2.6, hemi: 0xe0fff4, islands: 3.5, ships: 0.6, ice: 0, clouds: 3.5 },
  { name: 'FLEET', deep: 0x163f7a, sea: 0x225fa8, foam: 0xc8e0ff, cloud: 0xf4f8ff, key: 0xfff0e0, keyI: 2.3, hemi: 0xd0e0ff, islands: 0.5, ships: 4, ice: 0, clouds: 4.5 },
  { name: 'SUNSET', deep: 0x4a2a5a, sea: 0x8a4a5a, foam: 0xffc890, cloud: 0xffc0a0, key: 0xffb070, keyI: 2.3, hemi: 0xffd0b0, islands: 1.6, ships: 1.4, ice: 0, clouds: 5 },
  { name: 'STORM', deep: 0x22303e, sea: 0x3a5068, foam: 0xc8d8e8, cloud: 0x98a2b4, key: 0xc8d4e8, keyI: 1.7, hemi: 0xa0b0c8, islands: 0.8, ships: 1.6, ice: 0, clouds: 8 },
  { name: 'ARCTIC', deep: 0x1d4a6a, sea: 0x3a7a9a, foam: 0xffffff, cloud: 0xf0f8ff, key: 0xf0f6ff, keyI: 2.3, hemi: 0xe8f4ff, islands: 0.4, ships: 1.0, ice: 7, clouds: 4 },
  { name: 'NIGHT', deep: 0x0f1f40, sea: 0x1c3566, foam: 0x7a9ad0, cloud: 0x5a6a94, key: 0xc0d0ff, keyI: 2.0, hemi: 0x8a9ad0, islands: 1.2, ships: 1.8, ice: 0, clouds: 4 },
];

/** 材質畫風(arcade-core/render/toon.js);null = 原本的賽璐璐 */
export const TOON = null;
