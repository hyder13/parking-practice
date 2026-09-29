import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut, comicTex } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的漫畫城市(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下),全部用平塗色 + 網點:
 *          城市的街道格子(柏油路 + 黃色虛線 + 斑馬線 + 人行道)、碼頭的水、公園草地、
 *          秘密基地的金屬地板(鉚釘 + 警示斜紋)、火山的熔岩裂縫。成分由 THEMES 的 grid / river / grass / plate / lava 決定
 *   地上   大樓屋頂(女兒牆 + 水塔 + 冷氣機)、漫畫看板(往上仰)、汽車、貨櫃、港口吊車(往上仰)、化學儲槽、
 *          噴泉(中間是英雄雕像)、能量塔、熔岩石、樹 —— 捲進畫面時「啪」地彈起來
 *   空中   飛舞的報紙、白雲
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
  uniform vec3 uDeep, uSea, uFoam, uWater, uFlower;
  uniform float uTime, uScroll, uGrid, uRiver, uGrass, uPlate, uLava;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  // 網點:k = 0 ~ 1(越大點越大),世界座標(跟著地面捲動)
  float ht( vec2 p, float k ) {
    vec2 q = vec2( p.x + p.y, p.x - p.y ) * 0.7071 * 2.4;
    return 1.0 - smoothstep( k * 0.62 - 0.05, k * 0.62 + 0.05, length( fract( q ) - 0.5 ) );
  }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    // 底色:人行道 / 空地,大塊的網點濃淡
    float n = noise( p * 0.07 );
    vec3 c = mix( uSea, uSea * 0.72, ht( p, smoothstep( 0.45, 0.8, n ) * 0.8 ) );
    // 城市街道:一格一格的街廓,馬路 = 深色柏油 + 黃色虛線 + 路口斑馬線
    if ( uGrid > 0.01 ) {
      vec2 B = vec2( 13.0, 15.0 );
      vec2 q = p + vec2( 4.0, 0.0 );
      vec2 fq = mod( q, B ), cell = floor( q / B );
      vec2 dr = min( fq, B - fq );                      // 到街廓邊的距離
      float roadX = step( dr.x, 1.7 ), roadY = step( dr.y, 1.7 );
      float road = max( roadX, roadY );
      vec3 rc = mix( uDeep, uDeep * 0.8, ht( p, 0.35 ) );
      // 中線:黃色虛線
      float midX = ( 1.0 - smoothstep( 0.08, 0.14, abs( fq.x - ( fq.x > B.x * 0.5 ? B.x : 0.0 ) ) ) ) * step( 0.5, fract( q.y * 0.25 ) ) * ( 1.0 - roadY );
      float midY = ( 1.0 - smoothstep( 0.08, 0.14, abs( fq.y - ( fq.y > B.y * 0.5 ? B.y : 0.0 ) ) ) ) * step( 0.5, fract( q.x * 0.25 ) ) * ( 1.0 - roadX );
      rc = mix( rc, uFoam, max( midX, midY ) );
      // 斑馬線(路口前)
      float zx = step( dr.y, 1.7 ) * step( abs( dr.x - 2.6 ), 0.7 ) * step( 0.5, fract( q.y * 1.2 ) );
      float zy = step( dr.x, 1.7 ) * step( abs( dr.y - 2.6 ), 0.7 ) * step( 0.5, fract( q.x * 1.2 ) );
      // 街廓裡面 = 大樓屋頂(每一格不同顏色,邊緣一圈女兒牆 + 靠畫面下方那側的網點陰影 + 冷氣機 / 水塔)
      float m = min( dr.x, dr.y );
      vec3 roofs[4];
      roofs[0] = vec3( 0.86, 0.46, 0.38 ); roofs[1] = vec3( 0.62, 0.68, 0.78 ); roofs[2] = vec3( 0.52, 0.76, 0.7 ); roofs[3] = vec3( 0.9, 0.8, 0.56 );
      float hc = hash( cell * 1.7 + 0.3 );
      vec3 rf = roofs[ int( hc * 3.99 ) ] * ( dot( uSea, vec3( 0.333 ) ) * 1.5 + 0.1 );
      vec2 lq = fq - B * 0.5;                          // 街廓中心的座標
      float sh = step( lq.y, -B.y * 0.5 + 4.3 ) + step( B.x * 0.5 - 4.3, lq.x );
      rf = mix( rf, rf * 0.55, ht( p, 0.5 ) * min( sh, 1.0 ) );
      vec2 ac = abs( lq - vec2( hash( cell ) - 0.5, hash( cell + 2.0 ) - 0.5 ) * 3.0 );
      rf = mix( rf, vec3( 0.85, 0.88, 0.92 ), step( max( ac.x, ac.y ), 0.6 ) );
      rf = mix( rf, uDeep * 0.5, ( 1.0 - smoothstep( 0.0, 0.1, abs( max( ac.x, ac.y ) - 0.6 ) ) ) );
      float tk = length( lq + vec2( ( hash( cell + 5.0 ) - 0.5 ) * 4.0, 1.5 ) );
      rf = mix( rf, vec3( 0.6, 0.42, 0.3 ), 1.0 - smoothstep( 0.8, 0.86, tk ) );
      rf = mix( rf, uDeep * 0.4, 1.0 - smoothstep( 0.0, 0.1, abs( tk - 0.83 ) ) );
      float roofOn = step( 3.0, m ) * step( 0.18, hash( cell + 9.0 ) );   // 少數街廓是空地(不蓋樓)
      c = mix( c, rf, roofOn );
      c = mix( c, uDeep * 0.35, ( 1.0 - smoothstep( 0.0, 0.14, abs( m - 3.0 ) ) ) * step( 0.18, hash( cell + 9.0 ) ) );
      vec3 cc = mix( c, rc, road );
      cc = mix( cc, vec3( 0.97 ), max( zx, zy ) * ( 1.0 - road ) );
      // 人行道邊的一條深線
      cc = mix( cc, uDeep * 0.5, ( 1.0 - smoothstep( 0.0, 0.12, abs( min( dr.x, dr.y ) - 1.75 ) ) ) );
      c = mix( c, cc, uGrid );
    }
    // 公園草地:綠色 + 深綠網點 + 小徑
    if ( uGrass > 0.01 ) {
      vec3 gc = mix( uDeep, uDeep * 0.7, ht( p, smoothstep( 0.4, 0.75, noise( p * 0.09 + 5.0 ) ) ) );
      float px = abs( vP.x - ( sin( p.y * 0.05 ) * 6.0 ) );
      gc = mix( gc, uFoam, 1.0 - smoothstep( 1.1, 1.2, px ) );
      gc = mix( gc, uFoam * 0.7, ( 1.0 - smoothstep( 0.0, 0.1, abs( px - 1.2 ) ) ) );
      c = mix( c, gc, uGrass );
    }
    // 金屬地板:大片鋼板 + 鉚釘 + 警示斜紋帶
    if ( uPlate > 0.01 ) {
      vec2 fq = fract( p / 4.0 );
      vec3 pc = mix( uSea, uDeep, step( 0.5, hash( floor( p / 4.0 ) ) ) * 0.4 );
      pc = mix( pc, uDeep * 0.5, 1.0 - smoothstep( 0.0, 0.02, min( min( fq.x, 1.0 - fq.x ), min( fq.y, 1.0 - fq.y ) ) ) );
      vec2 rv = abs( fq - 0.5 );
      pc = mix( pc, uDeep * 0.6, 1.0 - smoothstep( 0.03, 0.045, length( rv - vec2( 0.42 ) ) ) );
      float band = step( abs( mod( p.y, 30.0 ) - 15.0 ), 1.2 );
      pc = mix( pc, mix( vec3( 0.08 ), uFoam, step( 0.5, fract( ( p.x + p.y ) * 0.35 ) ) ), band );
      c = mix( c, pc, uPlate );
    }
    // 熔岩:黑色岩地 + 發亮的裂縫
    if ( uLava > 0.01 ) {
      float cr = abs( noise( p * 0.22 ) - 0.5 ) + abs( noise( p * 0.5 + 3.0 ) - 0.5 ) * 0.5;
      vec3 lc = mix( uDeep, uSea, ht( p, 0.3 ) );
      float glow = 1.0 - smoothstep( 0.03, 0.08, cr );
      lc = mix( lc, uWater, glow );
      lc = mix( lc, vec3( 1.0, 0.9, 0.4 ), ( 1.0 - smoothstep( 0.0, 0.025, cr ) ) * ( 0.6 + 0.4 * sin( uTime * 3.0 + p.y ) ) );
      c = mix( c, lc, uLava );
    }
    // 水(碼頭 / 河 / 熔岩河):平塗 + 網點 + 白色短浪
    if ( uRiver > 0.01 ) {
      float wx = sin( p.y * 0.018 + 2.0 ) * 6.0 - 4.0;
      float wd = abs( vP.x - wx ), WR = 4.5 * uRiver;
      vec3 water = mix( uWater, uWater * 0.7, ht( p + vec2( 0.0, uTime * 0.4 ), 0.4 ) );
      vec2 wq = vec2( vP.x * 0.9, p.y * 0.9 + uTime * 0.6 );
      water = mix( water, vec3( 1.0 ), ( 1.0 - smoothstep( 0.05, 0.1, abs( fract( wq.y ) - 0.5 ) ) ) * step( 0.7, noise( floor( wq ) * 0.7 ) ) );
      c = mix( c, uDeep * 0.5, 1.0 - smoothstep( WR + 0.15, WR + 0.3, wd ) );
      c = mix( c, vec3( 0.55, 0.4, 0.25 ), ( 1.0 - smoothstep( WR + 0.0, WR + 0.15, wd ) ) * step( 0.5, fract( p.y * 0.8 ) ) * ( 1.0 - uLava ) );
      c = mix( c, water, 1.0 - smoothstep( WR - 0.05, WR + 0.05, wd ) );
    }
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone12: new THREE.ConeGeometry(1, 1, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  disc: new THREE.CircleGeometry(1, 18),
  page: new THREE.PlaneGeometry(1, 0.75),
};
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LEAN = 0.85;              // 看板 / 吊車往畫面上方仰倒,俯視鏡頭才看得到正面
const CAR_COLORS = [0xe8202a, 0x2050d8, 0xffd020, 0x3ab04a, 0xff8a20, 0x8a3ad8, 0xf8f8f8];
const ADS = [['POW COLA', '#e8202a', '#ffd020'], ['HERO NEWS', '#ffd020', '#101018'], ['ZAP!', '#2050d8', '#ffffff'],
  ['BURGER', '#ff8a20', '#ffffff'], ['WOW!', '#3ab04a', '#ffd020'], ['HOT DOGS', '#f8f8f8', '#e8202a']];
const CRATE_COLORS = [0xe8202a, 0x2050d8, 0xffd020, 0x3ab04a, 0xff8a20];

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
        uWater: { value: new THREE.Color() }, uFlower: { value: new THREE.Color() },
        uTime: { value: 0 }, uScroll: { value: 0 }, uGrid: { value: 0 }, uRiver: { value: 0 }, uGrass: { value: 0 }, uPlate: { value: 0 }, uLava: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    this.mat = {
      trunk: cel({ color: 0x6a4a2a, bands: 2, cache: false }),
      canopy: cel({ color: 0x3ab04a, bands: 3, cache: false }),
      canopy2: cel({ color: 0x2a8a3a, bands: 3, cache: false }),
      petal: flat({ color: 0xfff8e8, side: THREE.DoubleSide, cache: false }),
      dust: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }),
    };
    const C3 = (color) => cel({ color, bands: 3 });
    this.stat = {
      roof: C3(0xb8b0a8), roof2: C3(0x8a8480), parapet: C3(0xd8d0c4), tank: C3(0x9a6a4a), dark: C3(0x2a2a3a), white: C3(0xf8f8f8),
      steel: C3(0xb8c4d8), steel2: C3(0x6a7488), yellow: C3(0xffd020), red: C3(0xe8202a), blue: C3(0x2050d8), green: C3(0x3ab04a),
      glass: C3(0x9ae0ff), tire: C3(0x1a1a24), water: flat({ color: 0x5ad0ff }), glow: flat({ color: 0x6af4ff }), lava: flat({ color: 0xff7a1a }),
      rock: C3(0x4a3a36), rock2: C3(0x2e2624), stone: C3(0xc8c0b0), bronze: C3(0xc89a4a),
      cars: CAR_COLORS.map((c) => C3(c)), crates: CRATE_COLORS.map((c) => C3(c)),
    };

    this.pools = {
      trees: Array.from({ length: 40 }, () => this.makeTree()),
      camps: Array.from({ length: 10 }, () => this.makeProp()),
      rocks: Array.from({ length: 26 }, () => this.makeRocks()),
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
  /** 樹:兩種樹形先全部蓋好,出場時依場景只顯示一種(顏色跟著主題變) */
  makeTree() {
    const g = new THREE.Group(), T = this.mat, s = rand(0.9, 1.5), v = {};
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    let t = add('round');
    put(t, G.cyl, T.trunk, [0, 0, 0.35 * s], [0.12 * s, 0.7 * s, 0.12 * s], UP);
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6, d = i ? 0.35 * s : 0;
      put(t, G.ico2, i % 2 ? T.canopy2 : T.canopy, [Math.cos(a) * d, Math.sin(a) * d, (0.85 + i * 0.1) * s], [0.62 * s, 0.58 * s, 0.45 * s]);
    }
    t = add('palm');
    put(t, G.cyl, T.trunk, [0.15 * s, 0, 0.7 * s], [0.08 * s, 1.4 * s, 0.08 * s], [Math.PI / 2, 0.2, 0]);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      put(t, G.ico, i % 2 ? T.canopy2 : T.canopy, [0.3 * s + Math.cos(a) * 0.55 * s, Math.sin(a) * 0.55 * s, 1.35 * s], [0.6 * s, 0.14 * s, 0.06 * s], [0, 0, a]);
    }
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 大物件:九種先全部蓋好,出場時依場景(THEMES.props)只顯示一種;仰倒的用 scale.y 出場 */
  makeProp() {
    const g = new THREE.Group(), S = this.stat, v = {};
    const add = (k, lean) => { v[k] = new THREE.Group(); v[k].visible = false; v[k].userData.lean = lean; g.add(v[k]); return v[k]; };
    // 大樓屋頂:一大塊屋頂 + 女兒牆 + 水塔 + 冷氣機 + 樓梯間
    let t = add('roof', false);
    const W = rand(3.2, 4.2), H = rand(3.0, 3.8);
    put(t, G.box, S.roof, [0, 0, 0.5], [W, H, 1.0]);
    for (const y of [-H / 2, H / 2]) put(t, G.box, S.parapet, [0, y, 1.1], [W + 0.1, 0.18, 0.25]);
    for (const x of [-W / 2, W / 2]) put(t, G.box, S.parapet, [x, 0, 1.1], [0.18, H + 0.1, 0.25]);
    const wt = new THREE.Group(); wt.position.set(W * 0.22, H * 0.18, 1.0); t.add(wt);                     // 水塔
    for (const [x, y] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) put(wt, G.cyl, S.dark, [x, y, 0.35], [0.04, 0.7, 0.04], UP);
    put(wt, G.cyl, S.tank, [0, 0, 1.0], [0.55, 0.8, 0.55], UP);
    put(wt, G.cone12, S.dark, [0, 0, 1.6], [0.6, 0.45, 0.6], UP);
    for (let i = 0; i < 3; i++) put(t, G.box, S.steel, [-W * 0.3 + i * 0.55, -H * 0.25, 1.15], [0.42, 0.42, 0.3]);  // 冷氣機
    put(t, G.box, S.roof2, [-W * 0.25, H * 0.2, 1.3], [0.8, 0.7, 0.6]);                                          // 樓梯間
    put(t, G.box, S.dark, [-W * 0.25, H * 0.2 - 0.36, 1.2], [0.3, 0.02, 0.4]);
    // 漫畫看板:兩根柱子 + 大看板(字是 canvas 畫的)
    t = add('billboard', true);
    let c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    for (const x of [-1.2, 1.2]) put(c, G.box, S.dark, [x, 0, 0.8], [0.12, 0.12, 1.6]);
    const board = put(c, new THREE.PlaneGeometry(3.4, 1.6), new THREE.MeshBasicMaterial({ color: 0xffffff }), [0, -0.08, 2.2], 1, [Math.PI / 2, 0, 0]);
    put(c, G.box, S.dark, [0, 0, 2.2], [3.5, 0.1, 1.7]);
    // 汽車:兩三台卡通小車
    t = add('cars', false);
    const cars = [];
    for (let i = 0; i < 3; i++) {
      const car = new THREE.Group(); car.position.set((i - 1) * 1.6, rand(-0.6, 0.6), 0); car.rotation.z = rand(-0.2, 0.2) + (i % 2 ? Math.PI : 0); t.add(car);
      const bm = put(car, G.box, S.cars[0], [0, 0, 0.35], [0.8, 1.5, 0.4]);
      const cm = put(car, G.box, S.cars[0], [0, -0.1, 0.7], [0.7, 0.8, 0.35]);
      put(car, G.box, S.glass, [0, 0.31, 0.7], [0.62, 0.02, 0.26]);
      for (const [x, y] of [[-0.42, 0.45], [0.42, 0.45], [-0.42, -0.45], [0.42, -0.45]]) put(car, G.cyl, S.tire, [x, y, 0.2], [0.18, 0.1, 0.18], [0, 0, Math.PI / 2]);
      cars.push([bm, cm]);
    }
    // 貨櫃:兩三層彩色貨櫃
    t = add('containers', false);
    const crates = [];
    for (let i = 0; i < 5; i++) {
      const lay = i < 3 ? 0 : 1, x = lay ? (i - 3.5) * 1.3 : (i - 1) * 1.3;
      const m = put(t, G.box, S.crates[0], [x, 0, 0.45 + lay * 0.9], [1.2, 2.6, 0.88]);
      for (let k = 0; k < 5; k++) put(t, G.box, S.dark, [x, -1.0 + k * 0.5, 0.9 + lay * 0.9], [1.22, 0.04, 0.02]);
      crates.push(m);
    }
    // 港口吊車:A 字形的腳 + 橫梁 + 吊鉤(往上仰)
    t = add('crane', true);
    c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    for (const x of [-1.2, 1.2]) {
      put(c, G.box, S.yellow, [x, 0, 1.4], [0.18, 0.18, 2.8], [0, x * 0.12, 0]);
      put(c, G.box, S.dark, [x, 0, 0.1], [0.5, 0.5, 0.2]);
    }
    put(c, G.box, S.yellow, [0.6, 0, 2.9], [4.4, 0.24, 0.24]);
    put(c, G.box, S.red, [-0.6, 0, 3.25], [1.0, 0.6, 0.5]);
    put(c, G.cyl, S.dark, [2.3, 0, 2.2], [0.02, 1.4, 0.02], [0, 0, 0]);
    put(c, G.box, S.dark, [2.3, 0, 1.45], [0.3, 0.1, 0.2]);
    // 化學儲槽:兩個圓槽 + 管子 + 警示標誌
    t = add('tanks', false);
    for (const [x, r] of [[-0.9, 0.9], [1.0, 0.75]]) {
      put(t, G.cyl, S.white, [x, 0, 0.7], [r, 1.4, r], UP);
      put(t, G.ico2, S.white, [x, 0, 1.4], [r, r, r * 0.4]);
      put(t, G.cyl, S.red, [x, 0, 1.0], [r * 1.01, 0.12, r * 1.01], UP);
      put(t, G.box, S.yellow, [x, -r, 0.7], [0.4, 0.04, 0.4], [0, 0, 0]);
      put(t, G.box, S.dark, [x, -r - 0.02, 0.7], [0.14, 0.02, 0.2]);
    }
    put(t, G.cyl, S.steel2, [0.05, 0.4, 0.4], [0.08, 1.8, 0.08], [0, 0, Math.PI / 2]);
    put(t, G.cyl, S.steel2, [0.05, -0.4, 0.9], [0.06, 1.8, 0.06], [0, 0, Math.PI / 2]);
    // 噴泉:圓形水池 + 水 + 中間的英雄雕像
    t = add('fountain', false);
    put(t, G.cyl, S.stone, [0, 0, 0.15], [1.8, 0.3, 1.8], UP);
    put(t, G.cyl, S.water, [0, 0, 0.31], [1.6, 0.02, 1.6], UP);
    put(t, G.cyl, S.stone, [0, 0, 0.5], [0.4, 0.7, 0.4], UP);
    const st = new THREE.Group(); st.position.set(0, 0, 0.9); st.rotation.x = -0.5; t.add(st);
    put(st, G.ico2, S.bronze, [0, 0, 0.35], [0.25, 0.2, 0.35]);
    put(st, G.ico2, S.bronze, [0, 0, 0.8], 0.2);
    put(st, G.box, S.bronze, [0.25, 0, 0.9], [0.08, 0.08, 0.5], [0, 0.5, 0]);                               // 舉起的拳頭
    put(st, G.box, S.bronze, [0, 0.15, 0.4], [0.5, 0.05, 0.6], [0.3, 0, 0]);                                 // 披風
    for (let i = 0; i < 6; i++) put(t, G.cone6, S.water, [Math.cos(i) * 0.8, Math.sin(i) * 0.8, 0.5], [0.08, 0.4, 0.08], UP);
    // 能量塔(秘密基地):警示底座 + 柱子 + 發光的環 + 能量球
    t = add('pylon', false);
    put(t, G.cyl, S.dark, [0, 0, 0.15], [1.0, 0.3, 1.0], UP);
    for (let i = 0; i < 8; i++) put(t, G.box, i % 2 ? S.yellow : S.dark, [Math.cos(i / 8 * Math.PI * 2) * 1.0, Math.sin(i / 8 * Math.PI * 2) * 1.0, 0.15], [0.4, 0.2, 0.32], [0, 0, i / 8 * Math.PI * 2 + Math.PI / 2]);
    put(t, G.cyl, S.steel2, [0, 0, 1.2], [0.25, 2.0, 0.25], UP);
    for (const z of [0.9, 1.6]) put(t, G.cyl, S.glow, [0, 0, z], [0.45, 0.1, 0.45], UP);
    put(t, G.ico2, S.glow, [0, 0, 2.4], 0.4);
    // 熔岩石:黑色尖石 + 熔岩池
    t = add('lavarock', false);
    put(t, G.disc, S.lava, [0, 0, 0.03], [1.6, 1.2, 1]);
    for (let i = 0; i < 4; i++) put(t, G.cone6, i % 2 ? S.rock : S.rock2, [rand(-1.2, 1.2), rand(-0.8, 0.8), 0.6], [rand(0.3, 0.6), rand(0.8, 1.4), rand(0.3, 0.6)], [UP[0] + rand(-0.3, 0.3), 0, rand(0, 3)]);
    return { g, r: 3.6, z: -GROUND_Z, on: false, pop: 1, v, board, cars, crates };
  }

  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = rand(0.3, 0.7);
      put(g, G.ico0, i % 2 ? this.stat.steel2 : this.stat.stone, [rand(-0.8, 0.8), rand(-0.6, 0.6), s * 0.4], [s, s * rand(0.7, 1), s * 0.6], [Math.random(), Math.random(), Math.random() * 3]);
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 飛舞的報紙(一張一張翻來翻去) */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 4; i++) {
      const m = put(g, G.page, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.35, 0.55), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  makeDust() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) put(g, G.disc, this.mat.dust, [(i - 2) * 1.2 + rand(-0.3, 0.3), rand(-0.5, 0.5), i * 0.02], rand(1.0, 1.6));
    return { g, r: 7, z: rand(3, 5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), cloud: Cl(t.cloud), key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal),
      grid: t.grid, river: t.river, grass: t.grass, plate: t.plate, lava: t.lava,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'cloud', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    for (const key of ['keyI', 'grid', 'river', 'grass', 'plate', 'lava']) c[key] += (T[key] - c[key]) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.petal);
    U.uGrid.value = c.grid; U.uRiver.value = c.river; U.uGrass.value = c.grass; U.uPlate.value = c.plate; U.uLava.value = c.lava;
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
      // 每次出場換一個看板廣告 / 車色 / 貨櫃色
      if (want === 'billboard' && o.board) {
        const [text, bg, fg] = pick(ADS);
        o.board.material.map = comicTex(text, bg, fg, 512, 240, '#101018'); o.board.material.needsUpdate = true;
      }
      if (want === 'cars') for (const [a, b] of o.cars) { const m = pick(this.stat.cars); a.material = m; b.material = m; }
      if (want === 'containers') for (const m of o.crates) m.material = pick(this.stat.crates);
    }
    o.g.rotation.z = kind === 'camps' ? (o.lean ? rand(-0.06, 0.06) : pick([0, Math.PI / 2, Math.PI]) + rand(-0.1, 0.1)) : kind === 'clouds' ? rand(-0.3, 0.3) : Math.random() * 6;
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
