/**
 * 全場唯一的調色盤。
 * 大方向:美式漫畫(pop art)。印刷四原色的紅 / 黃 / 藍 / 青,粗黑線,陰影不是變暗而是「網點」
 * (TOON:cel 材質的陰影面改成一顆顆的圓點),畫面最後像印在泛黃的新聞紙上(skin.js LOOK.style)。
 * 主角是 Q 版大頭的超級英雄,城市是俯視的屋頂和街道。
 */
export const PAL = {
  sea: 0x5a6a7a,
  ink: 0x101018,

  // light
  key: 0xfffaf0,
  fill: 0xc8d8ff,
  rim: 0xfff0d0,
  hemiSky: 0xf8f8ff,
  hemiGround: 0x6a6a7a,

  // 驚奇小子(玩家)
  shipWhite: 0xf8f8f8,
  shipRed: 0xe8202a,     // 紅色緊身衣
  shipBlue: 0x2050d8,    // 藍披風
  shipCyan: 0xffe020,
  engine: 0xfff080,
  captive: 0xe8202a,
  captiveDark: 0x8a1020,
  skin: 0xffd0a8,
  hair: 0x1a1a2a,

  // 機器人小兵(原本的蜂)
  beeBody: 0x8aa0c0,
  beeBelly: 0x5a6a88,
  beeBand: 0x2a3040,
  beeWing: 0xff3a3a,     // 紅色眼罩燈
  beeWingRim: 0x3a3a4a,
  eye: 0x1a1a2a,
  antenna: 0x2a2a3a,

  // 噴射背包打手(原本的蝶)
  bflyBody: 0x8a3ad8,
  bflyHead: 0x5a2a9a,
  bflyWing: 0x7a7a8a,
  bflyRim: 0xffc020,

  // 大塊頭打手(原本的王,打兩下;被打一下氣到臉發紅)
  bossBody: 0xf4f4f4,    // 黑白條紋搶匪衫的白
  bossHead: 0x2a2a3a,
  bossWing: 0x1a1a24,
  bossInner: 0x3a8a4a,
  bossHit: 0xff9a8a,
  bossHitHead: 0xe8202a,
  bossCrown: 0xffe020,

  // shots / fx
  shot: 0xffe020,        // 黃色能量星
  shotTip: 0xffffff,
  ebullet: 0xff2a9a,     // 洋紅色能量彈
  ebulletCore: 0xffffff,
  beam: 0x9af0ff,
  beam2: 0x3ad0ff,
  white: 0xffffff,
  smoke: 0xe8e8f0,
  fire: 0xffa020,
};

/**
 * 漫畫城市的 7 個場景(每一話用 stages.js 的 STAGE_THEME 指定)。
 *   deep / sea / foam:地面三色(馬路 / 人行道 / 標線);water:水;grid / river / grass / plate / lava:地面的成分(0 ~ 1)
 *   trunk / canopy / canopy2:樹的顏色;tree:樹形(round / palm)
 *   props:地上的大物件(roof 大樓屋頂 / billboard 看板 / cars 汽車 / containers 貨櫃 / crane 吊車 / tanks 儲槽 /
 *          fountain 噴泉 / pylon 能量塔 / lavarock 熔岩石)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(camps = props;petals = 飛舞的報紙 / 雨 / 火星)
 */
export const THEMES = [
  { name: '市中心', deep: 0x5a6070, sea: 0xc8c0b0, foam: 0xffe020, water: 0x2a80d8, trunk: 0x6a4a2a, canopy: 0x3ab04a, canopy2: 0x2a8a3a, tree: 'round', props: ['roof', 'roof', 'billboard', 'cars'],
    petal: 0xfff8e8, cloud: 0xffffff, key: 0xfffaf0, keyI: 2.5, hemi: 0xf8f8ff, grid: 1, river: 0, grass: 0, plate: 0, lava: 0, trees: 1.5, camps: 3, petals: 3, clouds: 1.5, rocks: 0.3 },
  { name: '港口碼頭', deep: 0x6a5a4a, sea: 0xb8a888, foam: 0xffe020, water: 0x1a70d0, trunk: 0x6a4a2a, canopy: 0x3ab04a, canopy2: 0x2a8a3a, tree: 'palm', props: ['containers', 'crane', 'containers'],
    petal: 0xfff8e8, cloud: 0xffffff, key: 0xfffaf0, keyI: 2.4, hemi: 0xf0f8ff, grid: 0.3, river: 1, grass: 0, plate: 0, lava: 0, trees: 1, camps: 2.6, petals: 2, clouds: 2.5, rocks: 0.5 },
  { name: '化學工廠', deep: 0x7a7a70, sea: 0xa8a898, foam: 0xffc020, water: 0x3ad86a, trunk: 0x5a4a3a, canopy: 0x7a9a3a, canopy2: 0x5a7a2a, tree: 'round', props: ['tanks', 'tanks', 'containers'],
    petal: 0xd8ff6a, cloud: 0xe8f0d8, key: 0xfff8e0, keyI: 2.3, hemi: 0xf0f0e0, grid: 0.5, river: 0.5, grass: 0, plate: 0.5, lava: 0, trees: 0.8, camps: 2.6, petals: 4, clouds: 3, rocks: 1 },
  { name: '霓虹夜城', deep: 0x1a1a3a, sea: 0x3a3a6a, foam: 0xff3ad8, water: 0x2a4ab8, trunk: 0x2a1a2a, canopy: 0x2a6a5a, canopy2: 0x1a4a4a, tree: 'round', props: ['roof', 'billboard', 'billboard', 'cars'],
    petal: 0x9ae0ff, cloud: 0x6a6aa8, key: 0xb8c8ff, keyI: 2.0, hemi: 0x8a90d8, grid: 1, river: 0, grass: 0, plate: 0, lava: 0, trees: 1, camps: 3, petals: 10, clouds: 1.5, rocks: 0.3 },
  { name: '中央公園', deep: 0x3aa84a, sea: 0x5ac85a, foam: 0xe8d8a8, water: 0x2a90e8, trunk: 0x6a4a2a, canopy: 0x2a9a3a, canopy2: 0x5ac84a, tree: 'round', props: ['fountain', 'cars'],
    petal: 0xffa8c8, cloud: 0xffffff, key: 0xfffaf0, keyI: 2.5, hemi: 0xf8fff0, grid: 0.2, river: 0.4, grass: 1, plate: 0, lava: 0, trees: 5, camps: 1.4, petals: 4, clouds: 1.5, rocks: 1 },
  { name: '秘密基地', deep: 0x4a5060, sea: 0x6a7080, foam: 0xffd020, water: 0x3ad0ff, trunk: 0x3a3a4a, canopy: 0x6a7080, canopy2: 0x4a5060, tree: 'round', props: ['pylon', 'tanks', 'pylon'],
    petal: 0x9af0ff, cloud: 0xc8e8ff, key: 0xe0f0ff, keyI: 2.2, hemi: 0xc8d8f0, grid: 0, river: 0, grass: 0, plate: 1, lava: 0, trees: 0, camps: 2.4, petals: 6, clouds: 1, rocks: 0.5 },
  { name: '火山要塞', deep: 0x3a2a2a, sea: 0x5a3a30, foam: 0xffd020, water: 0xff5a1a, trunk: 0x2a1a1a, canopy: 0x4a3a30, canopy2: 0x3a2a24, tree: 'round', props: ['lavarock', 'pylon', 'lavarock'],
    petal: 0xffa030, cloud: 0x6a4a4a, key: 0xffb080, keyI: 2.1, hemi: 0xd8a090, grid: 0, river: 0.45, grass: 0, plate: 0.3, lava: 1, trees: 0, camps: 2.4, petals: 12, clouds: 2.5, rocks: 2 },
];

/**
 * 材質畫風(arcade-core/render/toon.js):cel 材質的陰影面改成「網點」。
 * 用光照強度 / 固有色算出這個像素有多暗,越暗網點越大(45° 斜排的圓點,螢幕座標),
 * 亮面是乾淨的平塗色、網點是固有色的深色版 —— 就像彩色漫畫的印刷。
 */
export const TOON = {
  key: 'halftone',
  patch(shader) {
    // 1) 在賽璐璐光照裡記下「直射光落在第幾階」(0.36 / 0.7 / 1.0),依各盞燈的亮度加權平均
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform vec3 uShadowTint;', 'uniform vec3 uShadowTint;\nfloat gCelSum = 0.0, gCelW = 0.0;')
      .replace('vec3 celBand = getGradientIrradiance( geometryNormal, directLight.direction );',
        'vec3 celBand = getGradientIrradiance( geometryNormal, directLight.direction );\n\tfloat cw = dot( directLight.color, vec3( 0.3333 ) ); gCelSum += celBand.r * cw; gCelW += cw;')
      // 2) 最後上色:亮面平塗、中間一階小網點、最暗一階大網點(45° 斜排,螢幕座標)
      .replace('#include <opaque_fragment>', /* glsl */ `
      {
        float k = gCelW > 0.0001 ? gCelSum / gCelW : 1.0;
        vec2 fc = gl_FragCoord.xy / 9.0;
        vec2 rq = vec2( fc.x + fc.y, fc.x - fc.y ) * 0.7071;
        float d = length( fract( rq ) - 0.5 );
        float rad = clamp( ( 0.92 - k ) * 1.25, 0.0, 0.68 );
        float dotm = ( 1.0 - smoothstep( rad - 0.06, rad + 0.06, d ) ) * step( 0.001, rad );
        vec3 litC = diffuseColor.rgb * ( 1.02 + 0.06 * step( 0.97, k ) ) + totalEmissiveRadiance;
        vec3 darkC = diffuseColor.rgb * 0.32 + vec3( 0.01, 0.01, 0.05 );
        outgoingLight = mix( litC, darkC, dotm );
      }
      #include <opaque_fragment>`);
  },
};
