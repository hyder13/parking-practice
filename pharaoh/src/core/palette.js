/**
 * 全場唯一的調色盤。
 * 大方向:古埃及的墓室壁畫 / 莎草紙畫。只用幾種礦物顏料:赭黃、赭紅、埃及藍、孔雀石綠、金、黑、米白。
 * 顏色要「平」:TOON 把 cel 材質壓成兩個平平的色階(正面 = 原色、側面 = 深一點),沒有漸層;
 * 描線是粗黑線;最後一道 pass 把整個畫面往顏料色靠、疊上莎草紙的纖維紋,四周一圈彩色的壁畫邊框。
 * 地面是沙漠 + 尼羅河 + 石板神殿大道(sea.js)。
 */
export const PAL = {
  sea: 0xd8b878,
  ink: 0x14100c,

  // light
  key: 0xfff4e0,
  fill: 0xf0e0c0,
  rim: 0xfff0d0,
  hemiSky: 0xfff8e8,
  hemiGround: 0x8a7050,

  // 小法老(玩家)
  shipWhite: 0xf4ecd8,
  shipRed: 0x2a5ab8,     // 頭巾的藍條紋
  shipBlue: 0xe8b830,    // 金
  shipCyan: 0x3ab8a8,
  engine: 0xfff0b0,
  captive: 0x2a5ab8,
  captiveDark: 0x1a2a6a,
  skin: 0xc8844a,
  hair: 0x14100c,

  // 木乃伊(原本的蜂)
  beeBody: 0xe8dcc0,
  beeBelly: 0xb8a888,
  beeBand: 0x8a7a5a,
  beeWing: 0xd8c898,
  beeWingRim: 0x5a4a30,
  eye: 0x14100c,
  antenna: 0x3a2a1a,

  // 聖甲蟲(原本的蝶)
  bflyBody: 0x1a7a7a,
  bflyHead: 0xe8b830,
  bflyWing: 0x3ab8a8,
  bflyRim: 0x14100c,

  // 胡狼守衛(原本的王,打兩下;被打一下金色的項圈掉色、眼睛變紅)
  bossBody: 0x24201c,
  bossHead: 0x2a2622,
  bossWing: 0xe8b830,
  bossInner: 0xe8b830,
  bossHit: 0x6a2a1a,
  bossHitHead: 0x8a3020,
  bossCrown: 0xffd040,

  // shots / fx
  shot: 0xffd040,        // 金色的太陽光
  shotTip: 0xfff8d0,
  ebullet: 0xd83a1a,     // 赭紅色的詛咒火球
  ebulletCore: 0xfff0a0,
  beam: 0xfff0a0,
  beam2: 0xffb030,
  white: 0xffffff,
  smoke: 0xe8d8b8,
  fire: 0xff8a2a,
};

/**
 * 尼羅河王國的 7 個場景(每一關用 stages.js 的 STAGE_THEME 指定)。
 *   deep / sea / foam:沙地的三種顏色(暗 / 中 / 亮,沙丘條紋);water:尼羅河的藍;flower:點綴(花 / 石頭)
 *   road:神殿大道的石板色;river:河的寬度(0 = 沒有);green:河岸的綠(田、蘆葦)
 *   trunk / canopy / canopy2:樹的顏色;tree:樹形(palm 棕櫚 / reed 紙莎草 / column 蓮花柱)
 *   props:地上的大物件(pyramid 金字塔 / obelisk 方尖碑 / pylon 神殿門 / sphinx 小獅身像 / tomb 帝王谷的墓門 / statue 坐像 / altar 冥界祭壇)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(petals = 沙 / 金粉;clouds = 風沙)
 */
export const THEMES = [
  { name: '金色沙漠', deep: 0xc89a58, sea: 0xdcb46e, foam: 0xecd092, water: 0x2a6ab8, flower: 0x8a5a30, road: 0xe8dcc0, green: 0x4a8a3a, trunk: 0x8a5a30, canopy: 0x3a8a3a, canopy2: 0x6ab84a, tree: 'palm', props: ['pyramid', 'pyramid', 'obelisk'],
    petal: 0xfff0b0, cloud: 0xf0dca8, key: 0xfff4e0, keyI: 2.5, hemi: 0xfff8e8, river: 0, trees: 1.5, camps: 1.8, petals: 4, clouds: 1.2, rocks: 1.2 },
  { name: '尼羅河畔', deep: 0xb88e52, sea: 0xd2ac6a, foam: 0xe4c88a, water: 0x2a6ab8, flower: 0xe8e0f0, road: 0xe8dcc0, green: 0x3a8a3a, trunk: 0x8a5a30, canopy: 0x3a8a3a, canopy2: 0x6ab84a, tree: 'reed', props: ['obelisk', 'statue', 'pylon'],
    petal: 0xffffff, cloud: 0xf0e8d0, key: 0xfff8e8, keyI: 2.5, hemi: 0xfff8f0, river: 1.2, trees: 4, camps: 1.4, petals: 3, clouds: 1, rocks: 1 },
  { name: '金字塔群', deep: 0xc8985a, sea: 0xdab070, foam: 0xeacc90, water: 0x2a6ab8, flower: 0x8a5a30, road: 0xe8dcc0, green: 0x4a8a3a, trunk: 0x8a5a30, canopy: 0x3a8a3a, canopy2: 0x6ab84a, tree: 'palm', props: ['pyramid', 'sphinx', 'pyramid'],
    petal: 0xffe8a0, cloud: 0xf0d8a0, key: 0xfff0d8, keyI: 2.5, hemi: 0xfff4e0, river: 0, trees: 1, camps: 2.2, petals: 4, clouds: 1.5, rocks: 1.5 },
  { name: '神殿大道', deep: 0xc0925a, sea: 0xd4ae72, foam: 0xe6c890, water: 0x2a6ab8, flower: 0xd83a1a, road: 0xf0e4c8, green: 0x3a8a3a, trunk: 0x8a5a30, canopy: 0x3a8a3a, canopy2: 0x6ab84a, tree: 'column', props: ['pylon', 'sphinx', 'obelisk', 'statue'],
    petal: 0xffe070, cloud: 0xf0e0b8, key: 0xfff4e0, keyI: 2.5, hemi: 0xfff8e8, river: 0.3, trees: 3, camps: 2.2, petals: 4, clouds: 1, rocks: 0.8 },
  { name: '綠洲', deep: 0xa88a52, sea: 0xc8a86a, foam: 0xdcc08a, water: 0x3a9ac8, flower: 0xe8e0f0, road: 0xe8dcc0, green: 0x3a9a4a, trunk: 0x8a5a30, canopy: 0x2a9a4a, canopy2: 0x6ac85a, tree: 'palm', props: ['statue', 'obelisk'],
    petal: 0xffffff, cloud: 0xf0e8d0, key: 0xfff8e8, keyI: 2.5, hemi: 0xfff8f0, river: 0.7, trees: 6, camps: 1.2, petals: 3, clouds: 0.8, rocks: 1 },
  { name: '帝王谷', deep: 0x9a6a3a, sea: 0xb8844a, foam: 0xcc9a5a, water: 0x2a6ab8, flower: 0x5a3a20, road: 0xd8c8a8, green: 0x5a7a3a, trunk: 0x6a4a2a, canopy: 0x5a7a3a, canopy2: 0x8a9a4a, tree: 'palm', props: ['tomb', 'tomb', 'statue'],
    petal: 0xffc070, cloud: 0xe0b880, key: 0xffe8c8, keyI: 2.3, hemi: 0xf0dcc0, river: 0, trees: 0.6, camps: 2, petals: 6, clouds: 2, rocks: 3 },
  { name: '冥界', deep: 0x1a1a3a, sea: 0x2a2250, foam: 0x3a2a62, water: 0x1a3a8a, flower: 0xe8b830, road: 0x3a3450, green: 0x1a4a4a, trunk: 0x2a2030, canopy: 0x1a5a5a, canopy2: 0x3a8a7a, tree: 'column', props: ['altar', 'pylon', 'statue'],
    petal: 0xffd040, cloud: 0x8a7ab8, key: 0xd8d0ff, keyI: 2.1, hemi: 0xb8b0e0, river: 0.5, trees: 2, camps: 2, petals: 10, clouds: 1.5, rocks: 1.5 },
];

/**
 * 材質畫風(arcade-core/render/toon.js):壁畫一樣的平塗。
 * 正對鏡頭的面 = 原本的顏料色、側面 = 深一階(一樣很平),沒有漸層、沒有高光。
 */
export const TOON = {
  key: 'mural',
  patch(shader) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      {
        float fr = clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 );
        vec3 base = diffuseColor.rgb;
        vec3 paint = base * mix( 0.74, 1.02, step( 0.42, fr ) );
        outgoingLight = mix( outgoingLight, paint, 0.85 ) + totalEmissiveRadiance;
      }
      #include <opaque_fragment>`);
  },
};
