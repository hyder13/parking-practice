import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的童話王國,整片地面是一幅彩繪玻璃(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):Voronoi 切成一塊塊玻璃(世界座標,跟著地面捲動),
 *          每塊一種寶石色(依大區塊混出草地 / 天空 / 花 的圖案),塊與塊之間是黑色鉛條;
 *          玻璃中間亮、邊緣深(厚薄不均),偶爾一塊亮色的花;金色玻璃小路、藍色玻璃河
 *   地上   玫瑰叢 / 棒棒糖樹 / 松、城堡塔、小教堂、噴泉、村屋、水晶簇、城門、暗黑祭壇
 *          —— 立著的東西往畫面上方仰倒;捲進畫面時像立體書一樣「啪」地彈起來
 *   空中   閃閃的光點 / 花瓣 / 火星、柔柔的光
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
  uniform vec3 uDeep, uSea, uFoam, uWater, uFlower, uRoad;
  uniform float uTime, uScroll, uRiver;
  varying vec2 vP;
  vec2 hash2( vec2 p ) { return fract( sin( vec2( dot( p, vec2( 127.1, 311.7 ) ), dot( p, vec2( 269.5, 183.3 ) ) ) ) * 43758.5453 ); }
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  float roadX( float y ) { return sin( y * 0.03 ) * 5.0 + sin( y * 0.011 + 1.3 ) * 3.0; }
  float riverX( float y ) { return sin( y * 0.018 + 2.0 ) * 7.0 - 3.0; }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    // Voronoi:找最近和第二近的玻璃塊中心
    vec2 q = p / 1.7;
    vec2 qi = floor( q );
    float d1 = 9.0, d2 = 9.0; vec2 site = vec2( 0.0 ), sid = vec2( 0.0 );
    for ( int j = -1; j <= 1; j++ ) for ( int i = -1; i <= 1; i++ ) {
      vec2 c = qi + vec2( float( i ), float( j ) );
      vec2 o = c + 0.15 + hash2( c ) * 0.7;
      float d = length( q - o );
      if ( d < d1 ) { d2 = d1; d1 = d; site = o; sid = c; } else if ( d < d2 ) d2 = d;
    }
    vec2 sp = site * 1.7;                                   // 這塊玻璃的中心(世界座標)
    float h = hash( sid + 3.1 );
    // 這塊玻璃的顏色:大區塊決定主色(草地 / 天空 / 花 / 水),少數亮色的花
    float region = noise( sp * 0.06 ) * 0.7 + noise( sp * 0.17 + 5.0 ) * 0.3;
    vec3 col = region < 0.35 ? uDeep : region < 0.55 ? uSea : region < 0.72 ? mix( uSea, uFoam, 0.5 ) : uFoam;
    col = mix( col, mix( col, uWater, 0.5 ), step( 0.8, h ) * 0.6 );
    col = mix( col, uFlower, step( 0.955, h ) );
    col *= 0.82 + h * 0.3;
    // 金色玻璃小路 / 藍色玻璃河(用玻璃塊的中心判斷,整塊一起換色,不會切一半)
    float rd = abs( sp.x - roadX( sp.y ) );
    col = mix( col, uRoad * ( 0.85 + h * 0.25 ), step( rd, 1.8 ) );
    if ( uRiver > 0.01 ) {
      float wd = abs( sp.x - riverX( sp.y ) );
      col = mix( col, mix( uWater, vec3( 0.8, 0.95, 1.0 ), step( 0.7, h ) * 0.35 ), step( wd, 4.0 * uRiver ) );
    }
    // 玻璃的厚薄:中間亮、邊緣深 + 細細的紋理 + 慢慢閃的光
    float inner = 1.0 - smoothstep( 0.0, 0.75, d1 );
    col *= 0.72 + inner * 0.45;
    col *= 0.93 + noise( p * 3.0 + h * 10.0 ) * 0.12;
    col += col * 0.15 * ( sin( uTime * 1.2 + h * 20.0 ) * 0.5 + 0.5 ) * step( 0.9, h );
    // 地面整體壓暗、彩度收一點(像傍晚透光的窗),角色和子彈才會跳出來
    col = mix( vec3( dot( col, vec3( 0.333 ) ) ), col, 0.8 ) * 0.62;
    // 鉛條:兩塊玻璃的交界
    float lead = 1.0 - smoothstep( 0.035, 0.075, d2 - d1 );
    col = mix( col, vec3( 0.05, 0.045, 0.06 ), lead );
    gl_FragColor = vec4( col, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  disc: new THREE.CircleGeometry(1, 18),
  arch: archGeo(),
};
/** 哥德式尖拱窗(平面) */
function archGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, -0.6); s.lineTo(-0.5, 0.2); s.quadraticCurveTo(-0.45, 0.55, 0, 0.8); s.quadraticCurveTo(0.45, 0.55, 0.5, 0.2); s.lineTo(0.5, -0.6); s.lineTo(-0.5, -0.6);
  return new THREE.ShapeGeometry(s);
}
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LEAN = 0.85;              // 立著的東西(塔、教堂、房子、城門)往畫面上方仰倒,俯視鏡頭才看得到正面
const GEMS = [0xe8203a, 0x2a5ad8, 0x3ab84a, 0xffc830, 0x8a3ad8, 0x3ac8e8];

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
        uTime: { value: 0 }, uScroll: { value: 0 }, uRiver: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    const CT = (color) => cel({ color, bands: 3, tint: 0x5a4a8a, cache: false });
    this.mat = {
      trunk: CT(0x8a5a2a), canopy: CT(0x3ab84a), canopy2: CT(0x8ae04a),
      petal: flat({ color: 0xffe070, cache: false }),
      dust: new THREE.MeshBasicMaterial({ color: 0xfff4c8, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }),
    };
    const C3 = (color) => cel({ color, bands: 3, tint: 0x5a4a8a });
    this.stat = {
      stone: C3(0xc8c0d0), stone2: C3(0x8a84a0), dark: C3(0x3a3450), roofB: C3(0x2a5ad8), roofR: C3(0xe8203a), wood: C3(0x8a5a2a),
      wall: C3(0xf8e8c8), gold: C3(0xffc830), water: flat({ color: 0x6ad0ff }), purple: flat({ color: 0xc86aff }),
      gems: GEMS.map((c) => C3(c)), glassWin: GEMS.map((c) => flat({ color: c })), rose: C3(0xe8203a),
      rock: C3(0x8a84a0), rock2: C3(0x6a6480),
    };

    this.pools = {
      trees: Array.from({ length: 40 }, () => this.makeTree()),
      camps: Array.from({ length: 8 }, () => this.makeProp()),
      rocks: Array.from({ length: 24 }, () => this.makeRocks()),
      petals: Array.from({ length: 12 }, () => this.makePetals()),
      clouds: Array.from({ length: 4 }, () => this.makeDust()),
    };
    this.acc = { trees: 0, camps: 0, rocks: 0, petals: 0, clouds: 0 };
    this.popKinds = new Set(['trees', 'camps', 'rocks']);
    for (const k in this.pools) for (const o of this.pools[k]) { o.g.visible = false; o.on = false; this.group.add(o.g); }

    this.theme = THEMES[0];
    this.cur = null; this.target = null;
    this.setTheme(0, true);
  }

  /* ---------------- 物件 ---------------- */
  /** 樹:三種樹形先全部蓋好,出場時依場景只顯示一種(顏色跟著主題變) */
  makeTree() {
    const g = new THREE.Group(), T = this.mat, S = this.stat, s = rand(0.9, 1.4), v = {};
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    let t = add('round');                                                                         // 棒棒糖樹:直直的幹 + 一顆多面的圓樹冠
    put(t, G.cyl, T.trunk, [0, 0, 0.45 * s], [0.1 * s, 0.9 * s, 0.1 * s], UP);
    put(t, G.ico, T.canopy, [0, 0, 1.15 * s], [0.62 * s, 0.62 * s, 0.55 * s]);
    put(t, G.ico0, T.canopy2, [0.2 * s, -0.1 * s, 1.35 * s], 0.25 * s);
    t = add('pine');                                                                              // 松:三層多面錐
    put(t, G.cyl, T.trunk, [0, 0, 0.25 * s], [0.08 * s, 0.5 * s, 0.08 * s], UP);
    for (let i = 0; i < 3; i++) put(t, G.cone6, i % 2 ? T.canopy2 : T.canopy, [0, 0, (0.7 + i * 0.4) * s], [(0.6 - i * 0.14) * s, 0.6 * s, (0.6 - i * 0.14) * s], UP);
    t = add('rose');                                                                              // 玫瑰叢:綠色的叢 + 幾朵紅玫瑰
    for (let i = 0; i < 3; i++) { const a = i * 2.1; put(t, G.ico, i % 2 ? T.canopy2 : T.canopy, [Math.cos(a) * 0.3 * s, Math.sin(a) * 0.3 * s, 0.4 * s], [0.45 * s, 0.45 * s, 0.4 * s]); }
    for (let i = 0; i < 5; i++) { const a = i * 1.3; put(t, G.ico0, S.rose, [Math.cos(a) * 0.4 * s, Math.sin(a) * 0.4 * s, 0.75 * s], 0.13 * s); }
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 大物件:七種先全部蓋好,出場時依場景(THEMES.props)只顯示一種;仰倒的用 scale.y 出場 */
  makeProp() {
    const g = new THREE.Group(), S = this.stat, v = {}, flags = [], fires = [];
    const add = (k, lean) => { v[k] = new THREE.Group(); v[k].visible = false; v[k].userData.lean = lean; g.add(v[k]); return v[k]; };
    const leanG = (t) => { const c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c); return c; };
    // 城堡塔:圓塔 + 藍色尖頂 + 小旗 + 彩色窗
    let t = add('tower', true), c = leanG(t);
    for (const [x, h, r] of [[-1.0, 2.2, 0.55], [1.0, 2.2, 0.55], [0, 3.0, 0.75]]) {
      put(c, G.cyl, S.stone, [x, 0, h / 2], [r, h, r], UP);
      put(c, G.cone8, x ? S.roofR : S.roofB, [x, 0, h + 0.55], [r * 1.25, 1.1, r * 1.25], UP);
      put(c, G.arch, pick(S.glassWin), [x, -r - 0.01, h * 0.65], [0.3, 0.45, 1], [Math.PI / 2, 0, 0]);
    }
    put(c, G.box, S.stone2, [0, 0, 0.6], [2.4, 1.0, 1.2]);
    put(c, G.cyl, S.dark, [0, 0, 4.4], [0.03, 0.8, 0.03], UP);
    flags.push(put(c, new THREE.PlaneGeometry(0.6, 0.35).translate(0.3, 0, 0), flat({ color: 0xe8203a, side: THREE.DoubleSide }), [0, 0, 4.65], 1, [Math.PI / 2, 0, 0]));
    // 小教堂:長長的屋子 + 尖塔 + 一排彩色尖拱窗 + 圓花窗
    t = add('church', true); c = leanG(t);
    put(c, G.box, S.wall, [0, 0.4, 1.0], [2.2, 3.0, 2.0]);
    for (const s2 of [-1, 1]) put(c, G.box, S.roofB, [s2 * 0.6, 0.4, 2.3], [1.4, 3.1, 0.14], [0, s2 * 0.7, 0]);
    put(c, G.box, S.wall, [0, -1.1, 1.6], [0.8, 0.8, 3.2]);
    put(c, G.cone6, S.roofB, [0, -1.1, 3.8], [0.6, 1.3, 0.6], UP);
    put(c, G.disc, S.glassWin[0], [0, -1.51, 2.6], 0.3, [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) put(c, G.disc, S.glassWin[(i + 1) % 6], [Math.cos(i) * 0.2, -1.52, 2.6 + Math.sin(i) * 0.2], 0.08, [Math.PI / 2, 0, 0]);
    for (const x of [-0.6, 0, 0.6]) put(c, G.arch, pick(S.glassWin), [x, -1.12, 0.9], [0.35, 0.8, 1], [Math.PI / 2, 0, 0]);
    // 噴泉:八角水池 + 水 + 中間的柱子 + 水花
    t = add('fountain', false);
    put(t, G.cyl, S.stone, [0, 0, 0.2], [1.6, 0.4, 1.6], UP);
    put(t, G.cyl, S.water, [0, 0, 0.41], [1.4, 0.02, 1.4], UP);
    put(t, G.cyl, S.stone2, [0, 0, 0.8], [0.25, 1.0, 0.25], UP);
    put(t, G.cyl, S.stone, [0, 0, 1.3], [0.7, 0.15, 0.7], UP);
    for (let i = 0; i < 6; i++) put(t, G.cone6, S.water, [Math.cos(i) * 0.5, Math.sin(i) * 0.5, 1.5], [0.07, 0.4, 0.07], UP);
    // 村屋:木骨架的白牆 + 紅屋頂 + 彩色窗(往上仰)
    t = add('cottage', true); c = leanG(t);
    put(c, G.box, S.wall, [0, 0, 0.8], [2.2, 1.6, 1.6]);
    for (const x of [-1.05, 0, 1.05]) put(c, G.box, S.wood, [x, -0.81, 0.8], [0.12, 0.02, 1.6]);
    put(c, G.box, S.wood, [0, -0.81, 1.2], [2.2, 0.02, 0.1]);
    put(c, G.cone6, S.roofR, [0, 0, 2.1], [1.7, 1.1, 1.3], [UP[0], Math.PI / 6, 0]);
    for (const x of [-0.55, 0.55]) put(c, G.box, pick(S.glassWin), [x, -0.82, 0.75], [0.36, 0.02, 0.36]);
    put(c, G.box, S.dark, [0.8, 0, 2.5], [0.25, 0.25, 0.8]);
    // 水晶簇:幾顆發光的多面水晶
    t = add('crystal', false);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2, r = i ? 0.6 : 0, h = i ? rand(0.8, 1.3) : 1.8;
      put(t, G.oct, S.gems[(i + 1) % 6], [Math.cos(a) * r, Math.sin(a) * r, h * 0.5], [0.3, 0.3, h * 0.6], [Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0]);
    }
    // 城門:兩座塔 + 拱門 + 鐵柵門(往上仰)
    t = add('gate', true); c = leanG(t);
    for (const x of [-1.3, 1.3]) {
      put(c, G.box, S.stone, [x, 0, 1.2], [0.9, 0.9, 2.4]);
      for (let k = -1; k <= 1; k++) put(c, G.box, S.stone, [x + k * 0.3, 0, 2.55], [0.22, 0.9, 0.3]);
    }
    put(c, G.box, S.stone2, [0, 0, 2.0], [1.9, 0.8, 0.8]);
    for (let k = -2; k <= 2; k++) put(c, G.box, S.dark, [k * 0.3, -0.42, 0.8], [0.06, 0.04, 1.6]);
    for (let k = 0; k < 3; k++) put(c, G.box, S.dark, [0, -0.42, 0.3 + k * 0.5], [1.5, 0.04, 0.06]);
    // 暗黑祭壇:黑石台 + 紫色魔火 + 尖刺
    t = add('altar', false);
    put(t, G.box, S.dark, [0, 0, 0.35], [2.2, 1.6, 0.7]);
    for (const [x, y] of [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]]) {
      put(t, G.cone6, S.stone2, [x, y, 1.0], [0.18, 0.8, 0.18], UP);
    }
    for (let i = 0; i < 3; i++) { const f = put(t, G.cone6, S.purple, [(i - 1) * 0.5, 0, 1.0], [0.25, 0.8, 0.25], UP); f.userData.base = 1; fires.push(f); }
    return { g, r: 3.4, z: -GROUND_Z, on: false, pop: 1, v, flags, fires };
  }

  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = rand(0.3, 0.6);
      put(g, G.ico0, i % 2 ? this.stat.rock2 : this.stat.rock, [rand(-0.8, 0.8), rand(-0.6, 0.6), s * 0.4], [s, s * rand(0.7, 1), s * 0.6], [Math.random(), Math.random(), Math.random() * 3]);
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 飄著的光點 / 花瓣 / 火星(小小的多面體) */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const m = put(g, G.oct, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.07, 0.13), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  /** 柔柔的光斑(從窗外透進來的光) */
  makeDust() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) put(g, G.disc, this.mat.dust, [(i - 1) * 1.8 + rand(-0.3, 0.3), rand(-0.5, 0.5), i * 0.02], [rand(1.4, 2.2), rand(2.4, 3.4), 1], [0, 0, 0.4]);
    return { g, r: 7, z: rand(3, 5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), flower: Cl(t.flower), road: Cl(t.road), cloud: Cl(t.cloud),
      key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal), river: t.river,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'flower', 'road', 'cloud', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k; c.river += (T.river - c.river) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.flower); U.uRoad.value.copy(c.road); U.uRiver.value = c.river;
    const M = this.mat;
    M.trunk.color.copy(c.trunk); M.canopy.color.copy(c.canopy); M.canopy2.color.copy(c.canopy2);
    M.petal.color.copy(c.petal); M.dust.color.copy(c.cloud);
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
        if (o.flags) o.flags.forEach((fl, i) => { fl.rotation.y = Math.sin(this.time * 3 + i + o.g.position.x) * 0.3; });
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
