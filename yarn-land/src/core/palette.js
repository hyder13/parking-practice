/**
 * 全場唯一的調色盤。
 * 大方向:毛線娃娃的世界。所有東西都是毛線織的 / 毛氈剪的 / 布縫的:粉嫩但飽和的糖果色,
 * 材質上有一格一格的針織 V 字紋(TOON:cel 材質疊上針織紋 + 毛茸茸的雜訊),
 * 描線不是黑線而是「深一點的同色毛線」,地面是格子布 / 牛仔布 / 毛氈 / 拼布。
 */
export const PAL = {
  sea: 0xf0c8c8,
  ink: 0x5a3a48,

  // light
  key: 0xfff4ec,
  fill: 0xe0d8ff,
  rim: 0xffe8f0,
  hemiSky: 0xfff4f8,
  hemiGround: 0x9a8090,

  // 小毛(玩家)
  shipWhite: 0xfff4ec,
  shipRed: 0x5ab8e8,     // 天藍色毛衣
  shipBlue: 0xff7a9a,    // 粉紅圍巾 / 帽子
  shipCyan: 0xfff08a,
  engine: 0xfff4c8,
  captive: 0xff7a9a,
  captiveDark: 0xa84a6a,
  skin: 0xffe0cc,
  hair: 0xff9a3a,        // 橘色毛線頭髮

  // 襪子怪(原本的蜂)
  beeBody: 0x8ad86a,
  beeBelly: 0xfff4e0,
  beeBand: 0x5a9a4a,
  beeWing: 0xffd84a,
  beeWingRim: 0x3a6a3a,
  eye: 0x2a2030,
  antenna: 0x3a2a30,

  // 小飛蛾(原本的蝶:專吃毛線的壞蛋)
  bflyBody: 0x9a8a9a,
  bflyHead: 0x7a6a7a,
  bflyWing: 0xc8b8c8,
  bflyRim: 0x6a5a6a,

  // 剪刀螃蟹(原本的王,打兩下;被打一下殼變紅)
  bossBody: 0xff8a4a,
  bossHead: 0xffb07a,
  bossWing: 0xd8dce8,
  bossInner: 0xfff0e0,
  bossHit: 0xe83a3a,
  bossHitHead: 0xff6a5a,
  bossCrown: 0xffd84a,

  // shots / fx
  shot: 0xff5a8a,        // 粉紅毛線球
  shotTip: 0xffc8d8,
  ebullet: 0xe8e8f0,     // 大頭針(銀色針 + 彩色頭)
  ebulletCore: 0xff3a5a,
  beam: 0xfff0a0,
  beam2: 0xffb0d0,
  white: 0xffffff,
  smoke: 0xfff4f8,
  fire: 0xffb04a,
};

/**
 * 毛線世界的 7 個場景(每一段用 stages.js 的 STAGE_THEME 指定)。
 *   deep / sea / foam:布的三色(深 / 主色 / 縫線);water:緞帶河;fabric:布料花樣
 *     0 格子布(野餐布)/ 1 牛仔布(斜紋 + 車縫)/ 2 毛氈(毛茸茸)/ 3 拼布(一格一格不同花)/ 4 針織(V 字紋)/ 5 絲絨(亮片)/ 6 木頭(針線盒)
 *   river:一條緞帶河(0 = 沒有)
 *   trunk / canopy / canopy2:樹的顏色;tree:樹形(pompom 毛球樹 / felt 毛氈圓樹 / pine 毛氈松 / mushroom 香菇)
 *   props:地上的大物件(buttons 鈕扣 / spools 線軸 / pincushion 針插 / yarnballs 毛線球 / house 毛氈小屋 / thimble 頂針 / needles 棒針)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(camps = props;petals = 飄落的毛球 / 雪花 / 亮片;clouds = 棉花雲)
 */
export const THEMES = [
  { name: '野餐格子布', deep: 0xf49aa0, sea: 0xfff4ec, foam: 0xffffff, water: 0x7ac8f0, trunk: 0xa87a5a, canopy: 0x7ad86a, canopy2: 0xffd84a, tree: 'pompom', props: ['buttons', 'spools', 'yarnballs'],
    petal: 0xffa8c8, cloud: 0xffffff, key: 0xfff4ec, keyI: 2.4, hemi: 0xfff4f8, fabric: 0, river: 0, trees: 3, camps: 2.2, petals: 4, clouds: 1.5, rocks: 0.6 },
  { name: '牛仔布田野', deep: 0x3a5a9a, sea: 0x5a7ab8, foam: 0xffc84a, water: 0xa8e0ff, trunk: 0x8a6a4a, canopy: 0xff8ab0, canopy2: 0xffd0e0, tree: 'felt', props: ['buttons', 'house', 'spools'],
    petal: 0xffffff, cloud: 0xffffff, key: 0xfff4ec, keyI: 2.4, hemi: 0xf0f4ff, fabric: 1, river: 0.4, trees: 3, camps: 2, petals: 3, clouds: 2, rocks: 0.8 },
  { name: '毛氈森林', deep: 0x4a9a4a, sea: 0x6ab85a, foam: 0xfff0a0, water: 0x6ac8e8, trunk: 0x8a5a3a, canopy: 0x3a8a3a, canopy2: 0x9ad870, tree: 'pine', props: ['house', 'yarnballs', 'pincushion'],
    petal: 0xffd84a, cloud: 0xffffff, key: 0xfff4ec, keyI: 2.3, hemi: 0xf4fff0, fabric: 2, river: 0.3, trees: 6, camps: 1.6, petals: 4, clouds: 1.5, rocks: 1 },
  { name: '拼布小鎮', deep: 0xd87a9a, sea: 0xffd8a8, foam: 0xffffff, water: 0x8ad0f0, trunk: 0xa87a5a, canopy: 0x7ad86a, canopy2: 0xff9ac0, tree: 'felt', props: ['house', 'house', 'buttons', 'thimble'],
    petal: 0xfff08a, cloud: 0xffffff, key: 0xfff4ec, keyI: 2.4, hemi: 0xfff4f8, fabric: 3, river: 0, trees: 2.5, camps: 2.4, petals: 3, clouds: 1.5, rocks: 0.5 },
  { name: '針織雪地', deep: 0xc8d8f0, sea: 0xf4f8ff, foam: 0xa8c0e8, water: 0x8ab8e8, trunk: 0x8a6a5a, canopy: 0xf4f8ff, canopy2: 0x9ac8a8, tree: 'pine', props: ['yarnballs', 'house', 'needles'],
    petal: 0xffffff, cloud: 0xffffff, key: 0xf8faff, keyI: 2.3, hemi: 0xf8faff, fabric: 4, river: 0, trees: 3, camps: 1.8, petals: 10, clouds: 3, rocks: 1 },
  { name: '絲絨夜空', deep: 0x2a2a5a, sea: 0x3a3a7a, foam: 0xffe08a, water: 0x6a8ad8, trunk: 0x5a4a6a, canopy: 0x8a6ad8, canopy2: 0x5a4aa8, tree: 'mushroom', props: ['spools', 'thimble', 'yarnballs'],
    petal: 0xffe08a, cloud: 0x8a8ac8, key: 0xd8d8ff, keyI: 2.0, hemi: 0xb0b0e8, fabric: 5, river: 0.3, trees: 2.5, camps: 2, petals: 10, clouds: 1.5, rocks: 0.6 },
  { name: '針線盒', deep: 0x8a5a3a, sea: 0xc88a5a, foam: 0xffd84a, water: 0xd83a5a, trunk: 0xa87a5a, canopy: 0xff7a9a, canopy2: 0xffd84a, tree: 'mushroom', props: ['pincushion', 'needles', 'spools', 'thimble'],
    petal: 0xff8ab0, cloud: 0xffe8d8, key: 0xfff0e0, keyI: 2.3, hemi: 0xfff0e8, fabric: 6, river: 0.5, trees: 1.5, camps: 2.6, petals: 4, clouds: 1, rocks: 1.5 },
];

/**
 * 材質畫風(arcade-core/render/toon.js):每個 cel 材質疊上「針織紋」。
 * 用物件自己的座標(乘上物件的縮放 → 針目大小在世界裡一致,又會黏在物件上跟著動),
 * 依法線挑兩個軸(三平面),畫出一排排 V 字形的針目 + 毛茸茸的雜訊,讓每個東西都像毛線織的。
 */
export const TOON = {
  key: 'knit',
  patch(shader) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKnitP;\nvarying vec3 vKnitN;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ksc = vec3( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ), length( modelMatrix[ 2 ].xyz ) );
        vKnitP = transformed * ksc; vKnitN = objectNormal;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vKnitP;
        varying vec3 vKnitN;
        float kHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
        // 一個面上的針織紋:x = 橫向、y = 縱向(針目往上排),回傳 0(縫隙)~ 1(毛線鼓起來的地方)
        float knit( vec2 q ) {
          q /= vec2( 0.13, 0.1 );
          float col = floor( q.x );
          float fx = fract( q.x ) - 0.5;
          float v = fract( q.y + abs( fx ) * 0.9 );             // V 字形:往兩側斜上去
          float loop = 1.0 - abs( v - 0.5 ) * 2.0;
          float gap = smoothstep( 0.02, 0.12, 0.5 - abs( fx ) );   // 兩排針目之間的溝
          float fuzz = kHash( floor( q * 6.0 ) + col ) * 0.35;
          return clamp( smoothstep( 0.05, 0.75, loop ) * gap + fuzz * 0.4, 0.0, 1.0 );
        }`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 an = abs( normalize( vKnitN ) ); an = pow( an, vec3( 4.0 ) ); an /= an.x + an.y + an.z;
          float k = knit( vKnitP.xy ) * an.z + knit( vKnitP.zy ) * an.x + knit( vKnitP.xz ) * an.y;
          outgoingLight *= 0.74 + 0.36 * k;
        }
        #include <opaque_fragment>`);
  },
};
