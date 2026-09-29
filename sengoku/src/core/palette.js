/**
 * 全場唯一的調色盤。
 * 大方向:日本戰國。深色的鐵甲、朱漆、金色的前立、白色的陣幕、各大名的家紋旗;
 * 地面是尾張的田野 / 長篠的原野 / 川中島的河灘,本能寺之夜是火光。角色是 Q 版大頭的武將。
 */
export const PAL = {
  sea: 0x6a9a4a,
  ink: 0x201a18,

  // light
  key: 0xfff2e0,
  fill: 0xc8d0f0,
  rim: 0xffd8a8,
  hemiSky: 0xf8f4ec,
  hemiGround: 0x6a7a58,

  // 織田信長(玩家)
  shipWhite: 0xf4ecdc,
  shipRed: 0x2a2a30,     // 黑漆鎧甲
  shipBlue: 0xc8282a,    // 紅披風
  shipCyan: 0xfff2c0,
  engine: 0xffe0a0,
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,
  skin: 0xf8dcc0,
  hair: 0x2a2226,

  // 足輕(原本的蜂)
  beeBody: 0x5a6a8a,     // 藍灰色胴丸
  beeBelly: 0xd8c8a0,
  beeBand: 0x3a3a44,     // 陣笠
  beeWing: 0x8a6a40,     // 槍柄
  beeWingRim: 0x6a4a30,
  eye: 0x2a2226,
  antenna: 0x2a2226,

  // 忍者(原本的蝶)
  bflyBody: 0x2a2a38,
  bflyHead: 0x1a1a24,
  bflyWing: 0x6a6a7a,
  bflyRim: 0xc8323a,     // 紅色的頭巾帶

  // 武將(原本的王,打兩下;被打一下鎧甲裂開變銅色)
  bossBody: 0x8a2a2a,    // 赤備
  bossHead: 0x2a2226,
  bossWing: 0xf2c23a,    // 金色前立
  bossInner: 0x6a6a74,
  bossHit: 0xc8703a,
  bossHitHead: 0x6a3a2a,
  bossCrown: 0xffc23a,

  // shots / fx
  shot: 0xffe08a,        // 鐵砲的彈丸(拖著火光)
  shotTip: 0xfff8e0,
  ebullet: 0xa8b0c0,     // 手裏劍
  ebulletCore: 0x3a3a44,
  beam: 0xffe0a0,
  beam2: 0xff8a3a,
  white: 0xffffff,
  smoke: 0xd8d0c4,       // 硝煙
  fire: 0xff7a2a,
};

/**
 * 天下布武的 7 個戰場。每一戰用 stages.js 的 STAGE_THEME 指定。
 *   deep / sea:地面兩色;foam:小路;water:河(river 0 = 沒有、1 = 一條蜿蜒的河)
 *   trunk / canopy / canopy2:樹的顏色;tree:樹形(round 圓樹 / pine 松)
 *   props:地上的大物件(camp 陣幕 + 旗 / stakes 馬防柵 / castle 天守閣 / temple 寺 / ruins 燃燒的殘骸)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(camps = props;petals = 櫻花 / 火星;clouds = 硝煙)
 */
export const THEMES = [
  { name: '尾張', deep: 0x74a84a, sea: 0x92c05e, foam: 0xd8c08a, water: 0x5aa0c8, trunk: 0x6a4a30, canopy: 0xffb0c8, canopy2: 0xff90b0, tree: 'round', props: ['camp', 'temple'],
    petal: 0xffc0d0, cloud: 0xf4f0e8, key: 0xfff4e0, keyI: 2.4, hemi: 0xf4fff0, river: 0, trees: 4, camps: 1.2, petals: 8, clouds: 1.5, rocks: 1 },
  { name: '桶狹間', deep: 0x3a5a3a, sea: 0x4a6e44, foam: 0x8a7a5a, water: 0x4a6a8a, trunk: 0x4a3a2a, canopy: 0x2e5a34, canopy2: 0x3a6a3e, tree: 'round', props: ['camp'],
    petal: 0xa8c0e0, cloud: 0x9aa4b4, key: 0xc8d0e0, keyI: 1.9, hemi: 0xb8c4d8, river: 0.3, trees: 6, camps: 1.8, petals: 14, clouds: 3, rocks: 1 },
  { name: '長篠', deep: 0x8aa04a, sea: 0xa8b85e, foam: 0xc8a870, water: 0x5a9ab8, trunk: 0x6a4a30, canopy: 0x5a8a3a, canopy2: 0x4a7a32, tree: 'round', props: ['stakes', 'stakes', 'camp'],
    petal: 0xe8e0c0, cloud: 0xe8e0d4, key: 0xfff0d8, keyI: 2.4, hemi: 0xfff4e4, river: 0.5, trees: 2, camps: 2.2, petals: 3, clouds: 3.5, rocks: 1.5 },
  { name: '川中島', deep: 0x8a9a8a, sea: 0xa8b4a4, foam: 0xc8c0a8, water: 0x6a9ab8, trunk: 0x5a4a3a, canopy: 0x4a6a4a, canopy2: 0x5a7a58, tree: 'pine', props: ['camp', 'stakes'],
    petal: 0xf0f0f0, cloud: 0xf0f0f4, key: 0xf0f4ff, keyI: 2.2, hemi: 0xe8ecf4, river: 1.2, trees: 2.5, camps: 1.6, petals: 4, clouds: 4, rocks: 2.5 },
  { name: '安土城', deep: 0x6a9a4a, sea: 0x84b45a, foam: 0xd8c8a0, water: 0x4a8ac0, trunk: 0x6a4a30, canopy: 0x3a7a3a, canopy2: 0x4a8a44, tree: 'pine', props: ['castle', 'temple', 'camp'],
    petal: 0xffd24a, cloud: 0xfff8ec, key: 0xfff4e0, keyI: 2.5, hemi: 0xfff8f0, river: 0.4, trees: 3, camps: 1.6, petals: 4, clouds: 1.2, rocks: 1 },
  { name: '比叡山', deep: 0x5a4a3a, sea: 0x6e5a44, foam: 0x9a7a5a, water: 0x4a6a8a, trunk: 0x3a2a1e, canopy: 0x6a3a1e, canopy2: 0x8a4a22, tree: 'pine', props: ['temple', 'ruins'],
    petal: 0xffa030, cloud: 0x5a4a4a, key: 0xffa070, keyI: 2.0, hemi: 0xd0a090, river: 0, trees: 3.5, camps: 1.4, petals: 12, clouds: 2.5, rocks: 1.5 },
  { name: '本能寺', deep: 0x2a2030, sea: 0x3a2c3a, foam: 0x6a5a58, water: 0x2a3a5a, trunk: 0x2a1e18, canopy: 0x3a2a2a, canopy2: 0x4a3024, tree: 'round', props: ['temple', 'ruins', 'ruins'],
    petal: 0xff7a2a, cloud: 0x4a3a40, key: 0xff9a60, keyI: 2.0, hemi: 0xb88898, river: 0, trees: 2, camps: 2, petals: 16, clouds: 2.5, rocks: 1 },
];

/** 材質畫風(arcade-core/render/toon.js);null = 原本的賽璐璐 */
export const TOON = null;
