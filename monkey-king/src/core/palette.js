/**
 * 全場唯一的調色盤。
 * 大方向:西遊記 + 水墨山水。背景是淡雅的雲海與仙山(低彩度、帶墨線),
 * 角色用高辨識度的戲曲配色(大聖金黃 + 紅披風、妖怪紫 / 黑 / 鐵灰),再交給 cel 陰影與描線。
 */
export const PAL = {
  sea: 0xd8e6dc,
  ink: 0x1e1a24,

  // light
  key: 0xfff4e0,
  fill: 0xc8d8ff,
  rim: 0xffe0b0,
  hemiSky: 0xf0f4ff,
  hemiGround: 0x6a7a70,

  // 大聖(玩家)
  shipWhite: 0xfff2c0,   // 筋斗雲
  shipRed: 0xd8322e,     // 披風
  shipBlue: 0xffc23a,    // 金
  shipCyan: 0xffe8a0,
  engine: 0xfff6d8,
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,
  fur: 0x9a6a3a,
  face: 0xf2c8a0,

  // 蝙蝠精(原本的蜂)
  beeBody: 0x6a3a8a,
  beeBelly: 0xb070c8,
  beeBand: 0xff3a5a,
  beeWing: 0x3a2050,
  beeWingRim: 0x5a3470,
  eye: 0xff2a3a,
  antenna: 0x2a1a34,

  // 烏鴉精(原本的蝶)
  bflyBody: 0x2e2e3e,
  bflyHead: 0xe8503a,
  bflyWing: 0x23232e,
  bflyRim: 0x4a4a62,

  // 天兵(原本的王,打兩下)
  bossBody: 0xc8d0e0,
  bossHead: 0x3a5aa8,
  bossWing: 0xe8e8f0,
  bossInner: 0x8a94a8,
  bossHit: 0xc8703a,      // 盔甲被打裂:變銅橘色
  bossHitHead: 0x8a3a2a,
  bossCrown: 0xd8322e,

  // shots / fx
  shot: 0xffe070,
  shotTip: 0xff8a2a,
  ebullet: 0xff3aa0,
  ebulletCore: 0xfff0f8,
  beam: 0xffe0a0,
  beam2: 0xff8a3a,
  white: 0xffffff,
  smoke: 0x8a8098,
  fire: 0xffb03a,
};

/**
 * 場景主題(雲海底色 / 墨線 / 仙山 / 雲 / 光線 + 會捲過去的東西)。每關用 stages.js 的 STAGE_THEME 指定。
 *   peaks / cranes / petals / clouds:每 100 單位飛行距離大約出現幾個
 *   petal:飄落物的顏色(桃花 / 金光 / 火星 / 雪 / 螢火)
 */
export const THEMES = [
  { name: '花果山', deep: 0x9fc4b0, sea: 0xdcebe0, foam: 0x5a7a6a, cloud: 0xffffff, rock: 0x7aa894, top: 0x8ac46a, pine: 0x3a7a52, petal: 0xffb0c8, key: 0xfff4e0, keyI: 2.3, hemi: 0xf0f8f0, peaks: 3.2, cranes: 1.2, petals: 9, clouds: 4 },
  { name: '天宮', deep: 0xf0c8b8, sea: 0xfff0dc, foam: 0xd8a04a, cloud: 0xfff8ec, rock: 0xd8dce8, top: 0xffd06a, pine: 0xc8a050, petal: 0xffe070, key: 0xfff0d0, keyI: 2.4, hemi: 0xfff0e0, peaks: 1.6, cranes: 3.0, petals: 7, clouds: 6 },
  { name: '水墨', deep: 0xb8b4a8, sea: 0xece8dc, foam: 0x3a3632, cloud: 0xf6f4ee, rock: 0x8a8680, top: 0x4a4844, pine: 0x2e2c28, petal: 0x3a3632, key: 0xfff8f0, keyI: 2.2, hemi: 0xf4f0e8, peaks: 3.6, cranes: 1.6, petals: 3, clouds: 4 },
  { name: '火焰山', deep: 0x8a2a1a, sea: 0xd86a3a, foam: 0xffd070, cloud: 0xffc8a0, rock: 0x4a2420, top: 0xff7a2a, pine: 0x2a1410, petal: 0xffa030, key: 0xffb070, keyI: 2.3, hemi: 0xffc8a0, peaks: 3.0, cranes: 0, petals: 10, clouds: 3 },
  { name: '流沙河', deep: 0x3a8a8a, sea: 0x7ac0b8, foam: 0xe8fff8, cloud: 0xf4fffc, rock: 0xc8aa7a, top: 0xe0cc9a, pine: 0x4a7a5a, petal: 0xe8fff8, key: 0xfff6e0, keyI: 2.4, hemi: 0xe8fff8, peaks: 2.2, cranes: 1.4, petals: 4, clouds: 4 },
  { name: '雪山', deep: 0xb4c4d4, sea: 0xf0f4f8, foam: 0x7a8aa0, cloud: 0xffffff, rock: 0x8a9ab0, top: 0xffffff, pine: 0x3a5a6a, petal: 0xffffff, key: 0xf0f6ff, keyI: 2.3, hemi: 0xf0f6ff, peaks: 3.4, cranes: 0.8, petals: 12, clouds: 4 },
  { name: '盤絲洞', deep: 0x2a1a3a, sea: 0x4a3066, foam: 0xb080e0, cloud: 0x7a6aa0, rock: 0x3a2a4a, top: 0x6a4a8a, pine: 0x1a1024, petal: 0xd8ff6a, key: 0xd0c0ff, keyI: 2.0, hemi: 0xa090d0, peaks: 2.6, cranes: 0, petals: 6, clouds: 4 },
];

/** 材質畫風(arcade-core/render/toon.js);null = 原本的賽璐璐 */
export const TOON = null;
