/**
 * 全場唯一的調色盤。
 * 大方向:教堂的彩繪玻璃窗 + 童話騎士。寶石一樣飽和的顏色(紅寶石、藍寶石、祖母綠、琥珀、紫水晶),
 * 每一塊顏色之間是粗粗的黑色鉛條(描線),光從背後透過來:玻璃塊中間亮、邊緣深(TOON)。
 * 地面是一整片拼起來的彩色玻璃(sea.js 的 Voronoi 碎片),最後一道 pass 加上透光的光暈和光束。
 */
export const PAL = {
  sea: 0x2a3a6a,
  ink: 0x14121a,

  // light
  key: 0xfff8ec,
  fill: 0xd0d8ff,
  rim: 0xfff0d8,
  hemiSky: 0xfff8f0,
  hemiGround: 0x6a6a8a,

  // 小騎士(玩家)
  shipWhite: 0xe8ecf4,
  shipRed: 0xc8d0e0,     // 銀色盔甲
  shipBlue: 0x2a5ad8,    // 藍色披風
  shipCyan: 0xffe070,
  engine: 0xfff4c8,
  captive: 0x2a5ad8,
  captiveDark: 0x1a2a6a,
  skin: 0xffd8b8,
  hair: 0xe8b83a,

  // 哥布林(原本的蜂)
  beeBody: 0x5ac83a,
  beeBelly: 0x8a5a2a,
  beeBand: 0x3a2a1a,
  beeWing: 0xd8dce8,
  beeWingRim: 0x2a4a1a,
  eye: 0x14121a,
  antenna: 0x2a2a2a,

  // 蝙蝠(原本的蝶)
  bflyBody: 0x7a3ac8,
  bflyHead: 0x5a2a9a,
  bflyWing: 0x9a4ae8,
  bflyRim: 0xff3a5a,

  // 黑騎士(原本的王,打兩下;被打一下盔甲裂開露出紅光)
  bossBody: 0x3a3a5a,
  bossHead: 0x2a2a44,
  bossWing: 0xc8202a,
  bossInner: 0x5a5a7a,
  bossHit: 0x8a2a3a,
  bossHitHead: 0xc83a3a,
  bossCrown: 0xffd040,

  // shots / fx
  shot: 0xffe070,        // 金色光之碎片
  shotTip: 0xffffff,
  ebullet: 0xff3aa8,     // 紫紅色魔法彈
  ebulletCore: 0xffffff,
  beam: 0xfff0a0,
  beam2: 0xffc040,
  white: 0xffffff,
  smoke: 0xe8e0f0,
  fire: 0xff8a2a,
};

/**
 * 童話王國的 7 個場景(每一章用 stages.js 的 STAGE_THEME 指定)。
 *   deep / sea / foam / water:地面玻璃的四種主色(會依區塊混出一片片的圖案);flower:點綴的亮色玻璃
 *   road:金色玻璃小路的顏色;river:藍色玻璃河(0 = 沒有)
 *   trunk / canopy / canopy2:樹的顏色;tree:樹形(round / pine / rose 玫瑰叢)
 *   props:地上的大物件(tower 城堡塔 / church 小教堂 / fountain 噴泉 / cottage 村屋 / crystal 水晶 / gate 城門 / altar 暗黑祭壇)
 *   trees / camps / petals / clouds / rocks:每 100 單位路程大約出現幾個(camps = props;petals = 光點 / 花瓣 / 火星;clouds = 光束)
 */
export const THEMES = [
  { name: '城堡花園', deep: 0x2a8a3a, sea: 0x5ac84a, foam: 0x3aa8e8, water: 0x2a5ad8, flower: 0xe8203a, road: 0xf0c040, trunk: 0x8a5a2a, canopy: 0x3ab84a, canopy2: 0x8ae04a, tree: 'rose', props: ['tower', 'fountain'],
    petal: 0xffe070, cloud: 0xfff4c8, key: 0xfff8ec, keyI: 2.4, hemi: 0xfff8f0, river: 0, trees: 3, camps: 1.6, petals: 4, clouds: 1.2, rocks: 0.8 },
  { name: '魔法森林', deep: 0x1a5a3a, sea: 0x2a8a4a, foam: 0x7a3ac8, water: 0x3a8ae8, flower: 0xffd040, road: 0xc8a8f0, trunk: 0x5a3a2a, canopy: 0x1a8a4a, canopy2: 0x5ac85a, tree: 'round', props: ['crystal', 'cottage'],
    petal: 0xc8ff8a, cloud: 0xd8fff0, key: 0xe8fff0, keyI: 2.2, hemi: 0xd8f0e8, river: 0.3, trees: 6, camps: 1.4, petals: 8, clouds: 1.5, rocks: 1.2 },
  { name: '童話村莊', deep: 0xc85a2a, sea: 0xf0a040, foam: 0x5ac84a, water: 0x3a8ae8, flower: 0xe8203a, road: 0xf8e080, trunk: 0x8a5a2a, canopy: 0x5ac84a, canopy2: 0xf0c040, tree: 'round', props: ['cottage', 'cottage', 'fountain'],
    petal: 0xff8ab0, cloud: 0xfff4c8, key: 0xfff4e0, keyI: 2.4, hemi: 0xfff4e8, river: 0.25, trees: 2.5, camps: 2.2, petals: 3, clouds: 1, rocks: 0.8 },
  { name: '大教堂', deep: 0x1a2a8a, sea: 0x2a5ad8, foam: 0xd8a820, water: 0x3aa8e8, flower: 0xe8203a, road: 0xffd860, trunk: 0x5a4a3a, canopy: 0x2a8a4a, canopy2: 0x5ac84a, tree: 'pine', props: ['church', 'tower'],
    petal: 0xfff0a0, cloud: 0xfff8d8, key: 0xf8f4ff, keyI: 2.3, hemi: 0xf0f0ff, river: 0, trees: 1.5, camps: 1.8, petals: 6, clouds: 2.5, rocks: 0.5 },
  { name: '湖畔', deep: 0x1a4a9a, sea: 0x3a8ae8, foam: 0x3ac8c8, water: 0x2a5ad8, flower: 0xffffff, road: 0xf0e0a0, trunk: 0x6a4a2a, canopy: 0x3ab85a, canopy2: 0x3ac8c8, tree: 'pine', props: ['crystal', 'fountain', 'tower'],
    petal: 0xffffff, cloud: 0xe8f8ff, key: 0xf4faff, keyI: 2.3, hemi: 0xf0f8ff, river: 1.1, trees: 2.5, camps: 1.5, petals: 4, clouds: 1.5, rocks: 1 },
  { name: '龍之山谷', deep: 0x8a1a1a, sea: 0xc83a1a, foam: 0xf08a20, water: 0xffc040, flower: 0x3a1a1a, road: 0xffd040, trunk: 0x3a2a1a, canopy: 0x5a3a2a, canopy2: 0x8a4a2a, tree: 'pine', props: ['gate', 'crystal'],
    petal: 0xffa030, cloud: 0xffc890, key: 0xffd8b0, keyI: 2.2, hemi: 0xe8c0a8, river: 0.5, trees: 1.5, camps: 1.8, petals: 10, clouds: 2, rocks: 2.5 },
  { name: '暗黑王城', deep: 0x2a1a4a, sea: 0x4a2a7a, foam: 0x8a1a3a, water: 0x6a3ac8, flower: 0x3ae8c8, road: 0xc8a8f0, trunk: 0x2a1a2a, canopy: 0x3a2a5a, canopy2: 0x5a3a8a, tree: 'round', props: ['altar', 'gate', 'tower'],
    petal: 0xc86aff, cloud: 0xb890e8, key: 0xd8c8ff, keyI: 2.1, hemi: 0xb8a8e0, river: 0, trees: 2, camps: 2, petals: 10, clouds: 2, rocks: 1.5 },
];

/**
 * 材質畫風(arcade-core/render/toon.js):cel 材質變成「透光的彩色玻璃」。
 * 平面著色的每一面都是一片玻璃:正對鏡頭的面最亮(光從背後透過來)、斜的面顏色越深越飽和,
 * 暗面不會變灰(彩繪玻璃沒有陰影,只有玻璃的厚薄)。
 */
export const TOON = {
  key: 'glass',
  patch(shader) {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
      {
        float fr = clamp( dot( normalize( normal ), normalize( vViewPosition ) ), 0.0, 1.0 );
        vec3 base = diffuseColor.rgb;
        vec3 glass = base * ( 0.42 + 0.95 * pow( fr, 1.6 ) );
        float gl = dot( glass, vec3( 0.3333 ) );
        glass = max( mix( vec3( gl ), glass, 1.35 ), 0.0 );
        outgoingLight = mix( outgoingLight, glass, 0.72 ) + totalEmissiveRadiance;
      }
      #include <opaque_fragment>`);
  },
};
