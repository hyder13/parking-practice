/**
 * 全場唯一的調色盤。
 * 大方向:蒸汽龐克。黃銅、紅銅、鐵灰、深棕皮革,暖暖的琥珀色光,到處冒蒸汽。
 * 暖色的金屬會被 TOON 變成「會反光的黃銅」(正對鏡頭亮、斜面暗 + 一條環境反光),
 * 布、皮膚這些不是金屬的顏色只加一點點亮點。
 * 地面是俯視的維多利亞城市(sea.js):屋頂、石板街、運河、鐵軌;最後一道 pass 加上琥珀色調、飄過的蒸汽和黃銅鉚釘框。
 */
export const PAL = {
  sea: 0x3a2e24,
  ink: 0x1e140c,

  // light
  key: 0xfff0d8,
  fill: 0xd8c8b0,
  rim: 0xffe0b0,
  hemiSky: 0xfff0e0,
  hemiGround: 0x6a5a48,

  // 小飛行員(玩家)
  shipWhite: 0xf0e8d8,
  shipRed: 0x8a5a3a,     // 皮夾克
  shipBlue: 0xc83a2a,    // 紅圍巾
  shipCyan: 0xffd070,
  engine: 0xfff0c8,
  captive: 0xc83a2a,
  captiveDark: 0x6a2a1a,
  skin: 0xffd8b8,
  hair: 0xc86a2a,

  // 發條兵(原本的蜂)
  beeBody: 0x3a5a8a,
  beeBelly: 0xe8e0d0,
  beeBand: 0x2a2a3a,
  beeWing: 0xd8b060,
  beeWingRim: 0x5a3a1a,
  eye: 0x1e140c,
  antenna: 0x3a2a1a,

  // 發條蜻蜓(原本的蝶)
  bflyBody: 0x3a8a7a,
  bflyHead: 0xc8902a,
  bflyWing: 0xa8e0e0,
  bflyRim: 0x5a3a1a,

  // 蒸汽機器人(原本的王,打兩下;被打一下鍋爐燒紅)
  bossBody: 0x6a6a72,
  bossHead: 0xb8862a,
  bossWing: 0xc8a050,
  bossInner: 0x4a4a52,
  bossHit: 0x9a3a2a,
  bossHitHead: 0xff6a2a,
  bossCrown: 0xffd040,

  // shots / fx
  shot: 0xffc850,        // 黃銅鉚釘
  shotTip: 0xfff4d0,
  ebullet: 0xff5a1a,     // 燒紅的煤球
  ebulletCore: 0xfff0a0,
  beam: 0xfff0c0,
  beam2: 0xffa040,
  white: 0xffffff,
  smoke: 0xe8e0d8,
  fire: 0xff8a2a,
};

/**
 * 蒸汽之國的 7 個場景(每一段用 stages.js 的 STAGE_THEME 指定)。
 *   deep / sea / foam / water:地面四種主色(屋頂 A / 屋頂 B / 屋頂 C / 石板街);flower:點綴的暖光(窗戶、火光)
 *   road:鐵軌路基的顏色;river:運河寬度(0 = 沒有);city:1 = 滿滿的城市屋頂、0 = 郊外(荒地 + 礦坑)
 *   trunk / canopy / canopy2:樹 / 路燈的顏色;tree:樹形(round 公園樹 / lamp 煤氣路燈 / pipe 蒸汽管)
 *   props:地上的大物件(factory 工廠煙囪 / clock 鐘樓 / tank 儲氣槽 / pump 蒸汽幫浦 / crane 起重機 / water 水塔 / fort 鐵要塞)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(petals = 火星 / 小齒輪;clouds = 蒸汽團)
 */
export const THEMES = [
  { name: '煙囪城', deep: 0x5a6878, sea: 0x9a4a32, foam: 0x5a8a78, water: 0x6a6258, flower: 0xffc860, road: 0x4a3a30, trunk: 0x3a2e24, canopy: 0x5a7a3a, canopy2: 0xc8902a, tree: 'lamp', props: ['factory', 'tank', 'clock'],
    petal: 0xffa040, cloud: 0xf0e8e0, key: 0xfff0d8, keyI: 2.4, hemi: 0xfff0e0, river: 0, city: 1, trees: 3, camps: 1.8, petals: 4, clouds: 2.2, rocks: 1.2 },
  { name: '鐘樓廣場', deep: 0x4a5868, sea: 0x8a3a2a, foam: 0x6a9a88, water: 0x7a7266, flower: 0xffd070, road: 0x5a4a3a, trunk: 0x3a2e24, canopy: 0x4a8a3a, canopy2: 0x8ac84a, tree: 'round', props: ['clock', 'water', 'pump'],
    petal: 0xffd070, cloud: 0xf8f0e8, key: 0xfff4e0, keyI: 2.5, hemi: 0xfff4e8, river: 0, city: 1, trees: 2.5, camps: 1.6, petals: 3, clouds: 1.8, rocks: 1 },
  { name: '運河碼頭', deep: 0x6a4a3a, sea: 0x4a5a6a, foam: 0x7a8a6a, water: 0x6a6a60, flower: 0xffc050, road: 0x4a3a30, trunk: 0x3a2e24, canopy: 0x5a7a3a, canopy2: 0xc8902a, tree: 'lamp', props: ['crane', 'tank', 'water'],
    petal: 0xffb050, cloud: 0xe8e8e8, key: 0xf8f0e0, keyI: 2.3, hemi: 0xf0f0e8, river: 1.0, city: 0.8, trees: 2.5, camps: 2, petals: 3, clouds: 2.5, rocks: 2 },
  { name: '煤礦山谷', deep: 0x3a3028, sea: 0x5a4a38, foam: 0x7a6a50, water: 0x2a2420, flower: 0xff7a2a, road: 0x6a5040, trunk: 0x3a2e24, canopy: 0x4a5a2a, canopy2: 0x7a6a3a, tree: 'pipe', props: ['pump', 'crane', 'factory'],
    petal: 0xff7a2a, cloud: 0xc8c0b8, key: 0xffe0c0, keyI: 2.2, hemi: 0xe8d8c8, river: 0.3, city: 0, trees: 3, camps: 2, petals: 8, clouds: 2.5, rocks: 3 },
  { name: '鐵道平原', deep: 0x5a6a3a, sea: 0x7a7a42, foam: 0x9a8a4a, water: 0x5a5040, flower: 0xffd060, road: 0x4a3a30, trunk: 0x4a3a2a, canopy: 0x4a7a3a, canopy2: 0x8aa83a, tree: 'round', props: ['water', 'pump', 'tank'],
    petal: 0xfff0a0, cloud: 0xf8f4ec, key: 0xfff8e0, keyI: 2.5, hemi: 0xfff8ec, river: 0.4, city: 0.15, trees: 4, camps: 1.4, petals: 3, clouds: 2, rocks: 1.5 },
  { name: '雲上工廠', deep: 0x6a7080, sea: 0xa05a3a, foam: 0x7a9a90, water: 0x8a847a, flower: 0xffe080, road: 0x5a4a3a, trunk: 0x3a2e24, canopy: 0x7a8a8a, canopy2: 0xc8a050, tree: 'pipe', props: ['factory', 'factory', 'tank'],
    petal: 0xfff0c0, cloud: 0xffffff, key: 0xffffff, keyI: 2.6, hemi: 0xffffff, river: 0, city: 1, trees: 2, camps: 2.4, petals: 4, clouds: 4, rocks: 1 },
  { name: '風暴要塞', deep: 0x2a2a34, sea: 0x5a2a24, foam: 0x3a4a4a, water: 0x3a3632, flower: 0xff4a2a, road: 0x2a2420, trunk: 0x2a2420, canopy: 0x3a3a3a, canopy2: 0x8a3a2a, tree: 'pipe', props: ['fort', 'factory', 'clock'],
    petal: 0xff5a2a, cloud: 0xa8a0a0, key: 0xe8d0c0, keyI: 2.1, hemi: 0xc0b0a8, river: 0, city: 1, trees: 2, camps: 2.2, petals: 10, clouds: 3, rocks: 1.5 },
];

/**
 * 材質畫風(arcade-core/render/toon.js):暖色(黃銅 / 紅銅 / 皮革)變成會反光的金屬。
 *   正對鏡頭 = 亮、斜面 = 暗(金屬的明暗對比很大),加一條「環境反光」帶(像拋光的黃銅映著天空)和一顆小亮點。
 *   不是暖色的(布、皮膚、玻璃)只加一顆小亮點,保持原本的賽璐璐。
 */
export const TOON = {
  key: 'brass',
  patch(shader) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      {
        vec3 nV = normalize( normal );
        vec3 vV = normalize( vViewPosition );
        float fr = clamp( dot( nV, vV ), 0.0, 1.0 );
        vec3 base = diffuseColor.rgb;
        float warm = smoothstep( 0.3, 0.5, base.r - base.b ) * step( base.g, base.r + 0.02 );
        // 拋光金屬:對比很大的明暗 + 一條環境反光 + 小亮點
        float envBand = smoothstep( 0.05, 0.25, nV.y ) * ( 1.0 - smoothstep( 0.45, 0.75, nV.y ) );
        vec3 metal = base * ( 0.22 + 1.25 * pow( fr, 2.2 ) ) + vec3( 1.0, 0.86, 0.6 ) * envBand * 0.35 * fr;
        float spec = pow( fr, 28.0 );
        metal += vec3( 1.0, 0.95, 0.8 ) * spec * 0.8;
        vec3 lit = outgoingLight + vec3( 1.0, 0.95, 0.85 ) * spec * 0.18;
        outgoingLight = mix( lit, metal + totalEmissiveRadiance, warm * 0.8 );
      }
      #include <opaque_fragment>`);
  },
};
