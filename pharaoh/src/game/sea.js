import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的尼羅河王國(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):
 *          沙漠 = 三種沙色一條條的沙丘(像壁畫一樣分成平平的色階)+ 細細的風紋 + 小石子;
 *          尼羅河 = 藍色的水 + 壁畫裡畫水的黑色鋸齒紋,兩岸是綠色的紙莎草和一條條的田;
 *          神殿大道 = 一塊塊的石板路;冥界 = 深紫色 + 金色的星星
 *   地上   棕櫚樹 / 紙莎草 / 蓮花柱、金字塔、方尖碑、神殿門、小獅身像、帝王谷的墓門、坐像、冥界祭壇
 *          —— 立著的東西往畫面上方仰倒;捲進畫面時像立體書一樣「啪」地彈起來
 *   空中   金粉、一陣陣的風沙
 * ------------------------------------------------------------------ */

export const SEA_Z = GROUND_Z;
const BASE_SPEED = 5;

const SEA_VS = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4( position, 1.0 );
    vP = w.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SEA_FS = /* glsl */ `
  uniform vec3 uDeep, uSea, uFoam, uWater, uFlower, uRoad, uGreen;
  uniform float uTime, uScroll, uRiver;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  float roadX( float y ) { return sin( y * 0.02 ) * 5.0 + sin( y * 0.007 + 1.3 ) * 3.0 + 3.0; }
  float riverX( float y ) { return sin( y * 0.014 + 2.0 ) * 6.0 - 5.0; }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    // 沙丘:大塊的起伏(歪歪的條紋)分成三個平平的色階,色階交界有一條深色的線(壁畫的輪廓)
    float warp = noise( p * 0.05 ) * 6.0 + noise( p * 0.13 ) * 2.0;
    float dune = sin( ( p.y * 0.35 + p.x * 0.12 + warp ) ) * 0.5 + 0.5;
    dune = dune * 0.7 + noise( p * 0.08 + 3.0 ) * 0.3;
    vec3 col = dune < 0.36 ? uDeep : dune < 0.66 ? uSea : uFoam;
    float bandEdge = min( abs( dune - 0.36 ), abs( dune - 0.66 ) );
    col = mix( col * 0.88, col, smoothstep( 0.0, 0.02, bandEdge ) );
    // 風紋:細細的橫紋
    col *= 0.975 + 0.04 * sin( ( p.y + warp * 0.6 ) * 7.0 );
    // 小石子 / 星星
    vec2 sc = floor( p * 1.4 );
    float hs = hash( sc );
    vec2 sf = fract( p * 1.4 ) - 0.5;
    col = mix( col, uFlower, step( 0.97, hs ) * step( length( sf ), 0.16 ) );
    // 尼羅河:兩岸的田(一條條)+ 綠色的紙莎草岸 + 藍色的水 + 黑色鋸齒紋
    if ( uRiver > 0.01 ) {
      float u = p.x - riverX( p.y ), W = 3.4 * uRiver, au = abs( u );
      float field = step( au, W + 5.0 ) * ( 1.0 - step( au, W + 1.4 ) );
      vec3 fc = mod( floor( ( au - W ) / 1.1 ) + floor( p.y / 6.0 ), 2.0 ) < 1.0 ? uGreen : uGreen * 0.55 + vec3( 0.08, 0.06, 0.03 );
      col = mix( col, fc, field * step( 0.3, noise( vec2( floor( p.y / 6.0 ), 1.0 ) ) ) );
      col = mix( col, uGreen * ( 0.8 + 0.25 * step( 0.5, fract( p.y * 2.2 + au ) ) ), step( au, W + 1.4 ) );
      col = mix( col, uWater, step( au, W ) );
      float zz = abs( fract( p.y * 0.55 ) - 0.5 ) * 1.6;
      float lines = step( abs( fract( u * 0.9 + zz ) - 0.5 ), 0.07 );
      col = mix( col, uWater * 0.45, lines * step( au, W - 0.25 ) );
      col = mix( col, vec3( 0.06, 0.05, 0.04 ), step( abs( au - W ), 0.06 ) );
    }
    // 神殿大道:一塊塊的石板 + 兩邊的黑邊
    float rd = abs( p.x - roadX( p.y ) );
    if ( rd < 1.6 ) {
      vec2 slab = vec2( ( p.x - roadX( p.y ) ) * 0.8, p.y * 0.8 );
      vec2 si = floor( slab ), sfr = fract( slab );
      vec3 rc = uRoad * ( 0.88 + hash( si ) * 0.16 );
      rc = mix( rc * 0.7, rc, smoothstep( 0.0, 0.06, min( min( sfr.x, 1.0 - sfr.x ), min( sfr.y, 1.0 - sfr.y ) ) ) );
      col = rd > 1.45 ? vec3( 0.06, 0.05, 0.04 ) : rc;
    }
    // 地面整體壓暗一點,角色和子彈才會跳出來
    col = mix( vec3( dot( col, vec3( 0.333 ) ) ), col, 0.9 ) * 0.8;
    gl_FragColor = vec4( col, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  flare: new THREE.CylinderGeometry(1, 0.55, 1, 12),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
  disc: new THREE.CircleGeometry(1, 18),
};
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LEAN = 0.85;              // 立著的東西(方尖碑、神殿門、坐像)往畫面上方仰倒,俯視鏡頭才看得到正面

function put(parent, geo, mat, pos, scl, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(...scl);
  if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}

export class Sea {
  constructor(scene, lights) {
    this.scene = scene; this.lights = lights;
    this.group = new THREE.Group(); scene.add(this.group);
    this.time = 0; this.speed = 1; this.scroll = 0;

    this.seaMat = new THREE.ShaderMaterial({
      vertexShader: SEA_VS, fragmentShader: SEA_FS,
      uniforms: {
        uDeep: { value: new THREE.Color() }, uSea: { value: new THREE.Color() }, uFoam: { value: new THREE.Color() },
        uWater: { value: new THREE.Color() }, uFlower: { value: new THREE.Color() }, uRoad: { value: new THREE.Color() },
        uGreen: { value: new THREE.Color() }, uTime: { value: 0 }, uScroll: { value: 0 }, uRiver: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    const CT = (color) => cel({ color, bands: 2, tint: 0x8a6a4a, cache: false });
    this.mat = {
      trunk: CT(0x8a5a30), canopy: CT(0x3a8a3a), canopy2: CT(0x6ab84a),
      petal: flat({ color: 0xfff0b0, cache: false }),
      sand: new THREE.MeshBasicMaterial({ color: 0xf0dca8, transparent: true, opacity: 0.28, depthWrite: false }),
    };
    const C3 = (color) => cel({ color, bands: 2, tint: 0x8a6a4a });
    this.stat = {
      lime: C3(0xecdcb8), stone: C3(0xd8c098), stone2: C3(0xb89a6a), dark: C3(0x24201c), gold: C3(0xe8b830),
      blue: C3(0x2a5ab8), red: C3(0xc83a1a), turq: C3(0x3ab8a8), green: C3(0x3a8a4a), rock: C3(0x9a6a3a), rock2: C3(0x7a5230),
      pot: C3(0xb8603a), fire: flat({ color: 0x6af0e0 }), door: flat({ color: 0x14100c }),
    };

    this.pools = {
      trees: Array.from({ length: 40 }, () => this.makeTree()),
      camps: Array.from({ length: 8 }, () => this.makeProp()),
      rocks: Array.from({ length: 24 }, () => this.makeRocks()),
      petals: Array.from({ length: 12 }, () => this.makePetals()),
      clouds: Array.from({ length: 5 }, () => this.makeSand()),
    };
    this.acc = { trees: 0, camps: 0, rocks: 0, petals: 0, clouds: 0 };
    this.popKinds = new Set(['trees', 'camps', 'rocks']);
    for (const k in this.pools) for (const o of this.pools[k]) { o.g.visible = false; o.on = false; this.group.add(o.g); }

    this.theme = THEMES[0];
    this.cur = null; this.target = null;
    this.setTheme(0, true);
  }

  /* ---------------- 物件 ---------------- */
  /** 樹:三種先全部蓋好,出場時依場景只顯示一種(顏色跟著主題變) */
  makeTree() {
    const g = new THREE.Group(), T = this.mat, S = this.stat, s = rand(0.9, 1.3), v = {};
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    let t = add('palm');                                                                          // 棕櫚樹:一節節的樹幹 + 一圈長葉子 + 椰棗
    for (let i = 0; i < 5; i++) put(t, G.cyl, T.trunk, [i * 0.05 * s, 0, (0.2 + i * 0.36) * s], [(0.12 - i * 0.01) * s, 0.34 * s, (0.12 - i * 0.01) * s], UP);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      put(t, G.box, i % 2 ? T.canopy2 : T.canopy, [0.25 * s + Math.cos(a) * 0.55 * s, Math.sin(a) * 0.55 * s, 1.85 * s], [1.1 * s, 0.22 * s, 0.05 * s], [0, 0.35, a]);
    }
    for (let i = 0; i < 3; i++) put(t, G.ico, S.red, [0.25 * s + Math.cos(i * 2) * 0.12 * s, Math.sin(i * 2) * 0.12 * s, 1.7 * s], 0.08 * s);
    t = add('reed');                                                                              // 紙莎草:一叢細莖 + 扇形的頭
    for (let i = 0; i < 5; i++) {
      const x = rand(-0.35, 0.35) * s, y = rand(-0.35, 0.35) * s, h = rand(1.0, 1.5) * s;
      put(t, G.cyl, T.canopy, [x, y, h / 2], [0.03 * s, h, 0.03 * s], UP);
      put(t, G.cone8, T.canopy2, [x, y, h + 0.12 * s], [0.22 * s, 0.26 * s, 0.22 * s], [-Math.PI / 2, 0, 0]);
    }
    t = add('column');                                                                            // 蓮花柱:彩色的橫帶 + 張開的柱頭
    put(t, G.cyl, S.lime, [0, 0, 1.0 * s], [0.28 * s, 2.0 * s, 0.28 * s], UP);
    for (const [z, m] of [[0.3, S.blue], [0.5, S.red], [1.6, S.turq], [1.75, S.gold]]) put(t, G.cyl, m, [0, 0, z * s], [0.3 * s, 0.08 * s, 0.3 * s], UP);
    put(t, G.flare, T.canopy, [0, 0, 2.2 * s], [0.5 * s, 0.4 * s, 0.5 * s], UP);
    put(t, G.box, S.lime, [0, 0, 2.45 * s], [0.55 * s, 0.55 * s, 0.12 * s]);
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 大物件:七種先全部蓋好,出場時依場景(THEMES.props)只顯示一種;仰倒的用 scale.y 出場 */
  makeProp() {
    const g = new THREE.Group(), S = this.stat, v = {}, fires = [];
    const add = (k, lean) => { v[k] = new THREE.Group(); v[k].visible = false; v[k].userData.lean = lean; g.add(v[k]); return v[k]; };
    const leanG = (t) => { const c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c); return c; };
    // 金字塔:四角錐(稜線對齊)+ 金色的塔尖 + 一面亮一面暗
    let t = add('pyramid', true), c = leanG(t);
    put(c, G.cone4, S.stone, [0, 0, 1.4], [2.6, 2.8, 2.6], [UP[0], Math.PI / 4, 0]);
    for (let i = 1; i < 4; i++) put(c, G.box, S.stone2, [0, -2.6 * (1 - i / 4) * 0.72, i * 0.7], [3.7 * (1 - i / 4), 0.02, 0.05]); // 一層層的石塊線
    put(c, G.cone4, S.gold, [0, 0, 2.55], [0.55, 0.6, 0.55], [UP[0], Math.PI / 4, 0]);
    // 方尖碑:高高的四角柱 + 金色的尖頂 + 一格格的紅色象形文字
    t = add('obelisk', true); c = leanG(t);
    put(c, G.box, S.lime, [0, 0, 0.2], [1.1, 1.1, 0.4]);
    put(c, G.box, S.stone, [0, 0, 2.0], [0.55, 0.55, 3.4]);
    put(c, G.cone4, S.gold, [0, 0, 3.95], [0.4, 0.5, 0.4], [UP[0], Math.PI / 4, 0]);
    for (let i = 0; i < 6; i++) put(c, G.box, i % 2 ? S.red : S.blue, [0, -0.28, 0.8 + i * 0.45], [0.2 + (i % 3) * 0.05, 0.02, 0.18]);
    // 神殿門:兩座梯形的塔門 + 中間的門 + 彩色浮雕帶 + 旗桿
    t = add('pylon', true); c = leanG(t);
    for (const x of [-1.2, 1.2]) {
      put(c, G.box, S.lime, [x, 0, 1.3], [1.5, 0.9, 2.6]);
      put(c, G.box, S.blue, [x, -0.46, 2.1], [1.3, 0.02, 0.25]);
      put(c, G.box, S.red, [x, -0.46, 1.4], [0.5, 0.02, 0.9]);
      put(c, G.box, S.gold, [x, -0.46, 1.4], [0.25, 0.02, 0.3]);
      put(c, G.cyl, S.dark, [x + (x > 0 ? 0.5 : -0.5), -0.5, 2.3], [0.04, 3.0, 0.04], UP);
    }
    put(c, G.box, S.stone, [0, 0, 0.9], [1.0, 0.7, 1.8]);
    put(c, G.box, S.door, [0, -0.36, 0.6], [0.5, 0.02, 1.2]);
    put(c, G.box, S.gold, [0, -0.37, 1.5], [0.8, 0.02, 0.14]);
    // 小獅身像:趴著的獅子 + 條紋頭巾的頭(平放)
    t = add('sphinx', false);
    put(t, G.box, S.lime, [0, 0, 0.2], [1.2, 2.4, 0.4]);
    put(t, G.ico2, S.stone, [0, -0.2, 0.7], [0.55, 0.9, 0.35]);
    for (const x of [-0.3, 0.3]) put(t, G.box, S.stone, [x, 0.75, 0.55], [0.22, 0.7, 0.18]);
    put(t, G.ico2, S.blue, [0, 0.55, 1.05], [0.35, 0.3, 0.35]);
    for (let i = 0; i < 3; i++) put(t, G.torus, S.gold, [0, 0.55, 1.0 + i * 0.08], [0.33 - i * 0.03, 0.28 - i * 0.03, 0.8]);
    put(t, G.ico2, S.stone, [0, 0.75, 1.05], [0.2, 0.18, 0.22]);
    // 帝王谷的墓門:岩壁 + 黑色的門洞 + 彩色的門楣(往上仰)
    t = add('tomb', true); c = leanG(t);
    put(c, G.ico0, S.rock, [0, 0.3, 1.2], [2.2, 0.9, 1.6]);
    put(c, G.box, S.lime, [0, -0.52, 0.8], [1.0, 0.1, 1.5]);
    put(c, G.box, S.door, [0, -0.58, 0.65], [0.6, 0.02, 1.2]);
    for (let i = 0; i < 4; i++) put(c, G.box, [S.blue, S.red, S.turq, S.gold][i], [(i - 1.5) * 0.24, -0.59, 1.45], [0.2, 0.02, 0.14]);
    // 坐像:寶座 + 坐著的法老(條紋頭巾、雙手放膝上)
    t = add('statue', true); c = leanG(t);
    put(c, G.box, S.stone2, [0, 0.2, 0.7], [1.2, 1.2, 1.4]);
    put(c, G.box, S.stone, [0, -0.2, 1.1], [0.8, 0.7, 0.6]);
    put(c, G.box, S.stone, [0, -0.1, 1.8], [0.6, 0.45, 0.9]);
    put(c, G.ico2, S.stone, [0, -0.1, 2.5], [0.3, 0.28, 0.32]);
    put(c, G.ico2, S.blue, [0, 0.0, 2.6], [0.36, 0.3, 0.3]);
    for (const x of [-0.3, 0.3]) put(c, G.box, S.gold, [x, -0.25, 2.25], [0.14, 0.06, 0.4]);
    put(c, G.box, S.gold, [0, -0.28, 2.3], [0.06, 0.06, 0.2]);
    // 冥界祭壇:黑石台 + 藍綠色的鬼火 + 金色的生命之符
    t = add('altar', false);
    put(t, G.box, S.dark, [0, 0, 0.35], [2.2, 1.6, 0.7]);
    put(t, G.box, S.gold, [0, 0, 0.72], [2.3, 1.7, 0.06]);
    for (let i = 0; i < 3; i++) { const f = put(t, G.cone6, S.fire, [(i - 1) * 0.6, 0, 1.1], [0.22, 0.8, 0.22], UP); fires.push(f); }
    return { g, r: 3.4, z: -GROUND_Z, on: false, pop: 1, v, fires };
  }

  /** 地上的小東西:砂岩塊 / 斷掉的柱子 / 陶罐 */
  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3), S = this.stat;
    for (let i = 0; i < n; i++) {
      const s = rand(0.3, 0.55), x = rand(-0.8, 0.8), y = rand(-0.6, 0.6), k = Math.random();
      if (k < 0.4) put(g, G.box, i % 2 ? S.rock2 : S.stone2, [x, y, s * 0.4], [s * 1.3, s, s * 0.8], [0, 0, Math.random()]);
      else if (k < 0.7) put(g, G.cyl, S.lime, [x, y, s * 0.3], [s * 0.4, s * 1.6, s * 0.4], [0, 0, Math.random() * 3]);
      else { put(g, G.ico2, S.pot, [x, y, s * 0.5], [s * 0.45, s * 0.45, s * 0.55]); put(g, G.cyl, S.pot, [x, y, s * 1.0], [s * 0.18, s * 0.2, s * 0.18], UP); }
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 飄著的金粉(小小的多面體) */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const m = put(g, G.oct, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.06, 0.1), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  /** 一陣風沙(幾條拉長的半透明沙色) */
  makeSand() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) put(g, G.disc, this.mat.sand, [(i - 1) * 1.6 + rand(-0.3, 0.3), rand(-0.4, 0.4), i * 0.02], [rand(3, 4.5), rand(0.35, 0.6), 1], [0, 0, rand(-0.15, 0.15)]);
    return { g, r: 6, z: rand(2.5, 4.5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), flower: Cl(t.flower), road: Cl(t.road), cloud: Cl(t.cloud), green: Cl(t.green),
      key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal), river: t.river,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'flower', 'road', 'cloud', 'green', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k; c.river += (T.river - c.river) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.flower); U.uRoad.value.copy(c.road); U.uRiver.value = c.river; U.uGreen.value.copy(c.green);
    const M = this.mat;
    M.trunk.color.copy(c.trunk); M.canopy.color.copy(c.canopy); M.canopy2.color.copy(c.canopy2);
    M.petal.color.copy(c.petal); M.sand.color.copy(c.cloud);
    if (this.lights) {
      this.lights.key.color.copy(c.key); this.lights.key.intensity = c.keyI;
      this.lights.hemi.color.copy(c.hemi);
    }
  }
  get clearColor() { return this.cur.deep; }

  /** 鏡頭 fit 之後呼叫:算出每個深度的可視範圍,地面鋪滿 */
  fit(camera, camDist, tilt, targetY) {
    const tf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    this.frame = (Z) => {
      const D = (camDist * Math.cos(tilt) + Z) / Math.cos(tilt);
      const hh = D * tf * 1.12, hw = hh * camera.aspect * 1.05;
      return { cy: targetY + Z * Math.tan(tilt), hh, hw };
    };
    const f = this.frame(GROUND_Z);
    this.ocean.position.set(0, f.cy, -GROUND_Z);
    this.ocean.scale.set(f.hw * 2.6, f.hh * 2.6, 1);
    if (!this.primed) { this.primed = true; for (let i = 0; i < 40; i++) this.step(1.2, 0.05, true); }
  }

  spawn(kind, o) {
    const f = this.frame(-o.z);
    o.on = true; o.g.visible = true;
    o.g.position.set(rand(-1, 1) * (f.hw - o.r * 0.3), f.cy + f.hh + o.r, o.z);
    o.lean = false;
    if (o.v) {
      const want = kind === 'trees' ? this.theme.tree : pick(this.theme.props);
      for (const k in o.v) o.v[k].visible = k === want;
      o.lean = !!o.v[want].userData.lean;
      o.want = want;
    }
    o.g.rotation.z = kind === 'camps' ? (o.lean ? rand(-0.06, 0.06) : rand(-0.4, 0.4)) : kind === 'clouds' ? rand(-0.2, 0.2) : Math.random() * 6;
    if (this.popKinds.has(kind)) { o.pop = -1; if (o.lean) o.g.scale.set(1, 0.02, 1); else o.g.scale.set(1, 1, 0.02); }
  }

  step(dy, dt, prime = false) {
    const t = this.theme;
    // 地面就在腳下,可視範圍小 → 密度要比高空版高很多
    const rates = { trees: t.trees * 5, camps: t.camps * 2.5, rocks: t.rocks * 4, petals: t.petals * 1.5, clouds: prime ? 0 : t.clouds };
    for (const k in this.pools) {
      this.acc[k] += dy * rates[k] / 100;
      if (this.acc[k] >= 1) {
        const o = this.pools[k].find((p) => !p.on);
        if (o) {
          this.spawn(k, o);
          if (prime) { o.g.position.y -= Math.random() * this.frame(-o.z).hh * 2.4; o.pop = 1; o.g.scale.set(1, 1, 1); }
        }
        this.acc[k] -= 1;
      }
      for (const o of this.pools[k]) {
        if (!o.on) continue;
        o.g.position.y -= dy;
        const f = this.frame(-o.z);
        // 立體書:進到畫面時從紙面彈起來
        if (o.pop < 0 && o.g.position.y < f.cy + f.hh * 0.92) o.pop = 0;
        if (o.pop >= 0 && o.pop < 1) {
          o.pop = Math.min(1, o.pop + dt * 1.8);
          const e = Math.max(0.02, elasticOut(o.pop)), w = 1 + (1 - o.pop) * 0.12;
          if (o.lean) o.g.scale.set(w, e, 1); else o.g.scale.set(w, w, e);
        }
        if (o.fires && o.want === 'altar') o.fires.forEach((fi, i) => { fi.scale.y = 0.8 * (0.8 + 0.3 * Math.sin(this.time * 10 + i * 2.1)); });
                if (o.list) for (const p of o.list) {
          p.m.rotation.x += dt * p.sp; p.m.rotation.y += dt * p.sp * 0.7;
          p.m.position.x += Math.sin(this.time * 1.3 + p.sp * 3) * p.sx * dt;
          p.m.position.y -= dt * 0.8;
        }
        if (o.g.position.y < f.cy - f.hh - o.r) { o.on = false; o.g.visible = false; }
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.applyTheme(Math.min(1, dt * 1.2));
    const dy = BASE_SPEED * this.speed * dt;
    this.scroll += dy;
    const U = this.seaMat.uniforms;
    U.uTime.value = this.time; U.uScroll.value = this.scroll;
    if (this.frame) this.step(dy, dt);
  }
}
