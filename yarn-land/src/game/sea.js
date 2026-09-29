import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的毛線 / 布料世界(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):一塊塊的布料 ——
 *          野餐格子布、牛仔布(斜紋 + 車縫線)、毛氈、拼布(每格不同花色 + 縫線)、針織(V 字紋)、絲絨(亮片)、針線盒的木板;
 *          地上有一條虛線的「平針縫」小路,有時還有一條緞帶河
 *   地上   毛球樹 / 毛氈樹 / 毛氈松 / 香菇、大鈕扣、線軸、番茄針插、毛線球 + 棒針、毛氈小屋(往上仰)、頂針、織到一半的圍巾
 *          —— 捲進畫面時「啪」地彈起來(布偶軟軟的)
 *   空中   飄落的小毛球 / 雪花 / 亮片、棉花雲
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
  uniform float uTime, uScroll, uFabric, uRiver;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  // 虛線縫線:d = 到線的距離,a = 沿著線的座標
  float stitch( float d, float a, float w ) { return ( 1.0 - smoothstep( w * 0.6, w, abs( d ) ) ) * step( 0.42, fract( a ) ); }
  float knit( vec2 q ) {
    q /= vec2( 0.55, 0.42 );
    float fx = fract( q.x ) - 0.5;
    float v = fract( q.y + abs( fx ) * 0.9 );
    return smoothstep( 0.05, 0.75, 1.0 - abs( v - 0.5 ) * 2.0 ) * smoothstep( 0.02, 0.12, 0.5 - abs( fx ) );
  }
  vec3 fabric( float k, vec2 p ) {
    float fuzz = noise( p * 9.0 ) * 0.5 + noise( p * 23.0 ) * 0.5;
    if ( k < 0.5 ) {                                   // 野餐格子布
      float a = step( 0.5, fract( p.x / 2.8 ) ), b = step( 0.5, fract( p.y / 2.8 ) );
      vec3 c = mix( uSea, mix( uSea, uDeep, 0.5 ), max( a, b ) );
      c = mix( c, uDeep, a * b );
      return c * ( 0.95 + fuzz * 0.08 ) * ( 0.97 + 0.03 * sin( p.x * 40.0 ) * sin( p.y * 40.0 ) );
    } else if ( k < 1.5 ) {                            // 牛仔布:斜紋 + 橘色雙車縫線
      float tw = step( 0.5, fract( ( p.x + p.y * 0.5 ) * 3.2 ) );
      vec3 c = mix( uSea, uDeep, tw * 0.55 ) * ( 0.9 + fuzz * 0.16 );
      float sx = mod( p.x + 6.0, 16.0 ) - 8.0;
      c = mix( c, uFoam, stitch( abs( sx ) - 5.0, p.y * 1.4, 0.07 ) );
      c = mix( c, uFoam, stitch( abs( sx ) - 5.35, p.y * 1.4 + 0.5, 0.07 ) );
      return c;
    } else if ( k < 2.5 ) {                            // 毛氈:毛茸茸的斑駁
      float n = noise( p * 0.3 ) * 0.6 + fuzz * 0.4;
      return mix( uDeep, uSea, smoothstep( 0.3, 0.7, n ) ) * ( 0.95 + fuzz * 0.1 );
    } else if ( k < 3.5 ) {                            // 拼布:每格不同的花色 + 縫線
      vec2 cell = floor( p / 3.2 ), f = fract( p / 3.2 );
      float h = hash( cell );
      vec3 cols[4];
      cols[0] = uSea; cols[1] = mix( uSea, uDeep, 0.55 ); cols[2] = mix( uSea, uFoam, 0.4 ); cols[3] = mix( uDeep, vec3( 1.0, 0.95, 0.7 ), 0.45 );
      vec3 base = cols[ int( h * 3.99 ) ];
      float pat = hash( cell + 7.0 );
      vec3 c = base;
      if ( pat < 0.33 ) c = mix( base, base * 0.8, 1.0 - smoothstep( 0.1, 0.14, length( fract( f * 4.0 ) - 0.5 ) ) );  // 圓點
      else if ( pat < 0.66 ) c = mix( base, base * 0.82, step( 0.5, fract( ( f.x + f.y ) * 5.0 ) ) );             // 斜條紋
      c *= 0.95 + fuzz * 0.08;
      vec2 e = min( f, 1.0 - f ) * 3.2;
      float m = min( e.x, e.y );
      c = mix( c, c * 0.7, 1.0 - smoothstep( 0.0, 0.06, m ) );
      c = mix( c, vec3( 1.0 ), stitch( m - 0.22, ( e.x < e.y ? p.y : p.x ) * 2.0, 0.05 ) );
      return c;
    } else if ( k < 4.5 ) {                            // 針織:V 字紋
      float kn = knit( p );
      return mix( uDeep, uSea, 0.35 + 0.65 * kn ) * ( 0.96 + fuzz * 0.06 );
    } else if ( k < 5.5 ) {                            // 絲絨 + 亮片
      float sheen = noise( p * 0.15 + vec2( uTime * 0.05, 0.0 ) );
      vec3 c = mix( uDeep, uSea, smoothstep( 0.3, 0.8, sheen ) ) * ( 0.94 + fuzz * 0.1 );
      vec2 q = p * 0.9; vec2 qi = floor( q ), qf = fract( q ) - 0.5;
      float sq = hash( qi );
      float sp = ( 1.0 - smoothstep( 0.08, 0.12, length( qf - ( vec2( hash( qi + 3.0 ), hash( qi + 5.0 ) ) - 0.5 ) * 0.6 ) ) ) * step( 0.86, sq );
      return mix( c, uFoam * ( 0.8 + 0.4 * sin( uTime * 3.0 + sq * 30.0 ) ), sp );
    }
    // 針線盒的木板:一條條木紋 + 捲尺
    float plank = floor( p.x / 2.4 );
    float grain = noise( vec2( p.x * 3.0, p.y * 0.25 + plank * 7.0 ) );
    vec3 c = mix( uDeep, uSea, 0.4 + 0.6 * grain ) * ( 0.92 + hash( vec2( plank, 0.0 ) ) * 0.12 );
    c = mix( c, uDeep * 0.6, 1.0 - smoothstep( 0.0, 0.05, abs( fract( p.x / 2.4 ) - 0.02 ) ) );
    float tm = abs( vP.x - 9.0 );
    c = mix( c, uFoam, 1.0 - smoothstep( 0.9, 0.95, tm ) );
    c = mix( c, uDeep * 0.5, ( 1.0 - smoothstep( 0.9, 0.95, tm ) ) * ( 1.0 - smoothstep( 0.02, 0.05, abs( fract( p.y * 2.0 ) - 0.5 ) ) ) * step( 0.4, tm ) );
    return c;
  }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    float k0 = floor( uFabric ), kf = fract( uFabric );
    vec3 c = fabric( k0, p );
    if ( kf > 0.01 ) c = mix( c, fabric( k0 + 1.0, p ), kf );
    // 平針縫的小路:兩排虛線
    float rx = sin( p.y * 0.03 ) * 5.0 + sin( p.y * 0.011 + 1.3 ) * 3.0;
    float rd = vP.x - rx;
    c = mix( c, vec3( 1.0, 0.98, 0.94 ), stitch( abs( rd ) - 1.1, p.y * 1.2, 0.09 ) );
    // 緞帶河:亮面的緞帶(一條條光澤)+ 兩邊的縫線
    if ( uRiver > 0.01 ) {
      float wx = sin( p.y * 0.018 + 2.0 ) * 7.0 - 3.0;
      float wd = abs( vP.x - wx ), WR = 3.6 * uRiver;
      float sh = sin( ( vP.x - wx ) / WR * 3.0 + p.y * 0.05 - uTime * 0.6 ) * 0.5 + 0.5;
      vec3 rib = mix( uWater * 0.82, mix( uWater, vec3( 1.0 ), 0.5 ), pow( sh, 3.0 ) );
      c = mix( c, uWater * 0.55, 1.0 - smoothstep( WR, WR + 0.12, wd ) );
      c = mix( c, rib, 1.0 - smoothstep( WR - 0.12, WR - 0.02, wd ) );
      c = mix( c, vec3( 1.0 ), stitch( wd - WR + 0.35, p.y * 1.5, 0.06 ) );
    }
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone12: new THREE.ConeGeometry(1, 1, 14),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  torus: new THREE.TorusGeometry(1, 0.12, 5, 18),
  disc: new THREE.CircleGeometry(1, 18),
};
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LEAN = 0.85;              // 毛氈小屋往畫面上方仰倒,俯視鏡頭才看得到正面
const CANDY = [0xff8ab0, 0xffd84a, 0x8ae0c0, 0xc8a8f0, 0x7ac8f0, 0xff9a5a, 0xf04a5a];

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
        uTime: { value: 0 }, uScroll: { value: 0 }, uFabric: { value: 0 }, uRiver: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    const CT = (color) => cel({ color, bands: 3, tint: 0x9a6a9a, cache: false });
    this.mat = {
      trunk: CT(0xa87a5a), canopy: CT(0x7ad86a), canopy2: CT(0xffd84a),
      petal: flat({ color: 0xffa8c8, cache: false }),
      dust: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
    };
    const C3 = (color) => cel({ color, bands: 3, tint: 0x9a6a9a });
    this.stat = {
      white: C3(0xfff8f0), wood: C3(0xd8a878), wood2: C3(0xa87a50), silver: C3(0xd8dce8), red: C3(0xf04a5a), green: C3(0x6ac85a),
      felt: C3(0xffd0a0), roof: C3(0xff7a9a), door: C3(0x8a5a3a), dark: C3(0x5a3a48), cream: C3(0xfff0d8),
      candy: CANDY.map((c) => C3(c)), rock: C3(0xd8c8d8), rock2: C3(0xb8a8c8),
    };

    this.pools = {
      trees: Array.from({ length: 40 }, () => this.makeTree()),
      camps: Array.from({ length: 9 }, () => this.makeProp()),
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
  /** 毛線球(纏繞的圈圈) */
  yarnBall(parent, mat, pos, r) {
    put(parent, G.ico2, mat, pos, r);
    for (let i = 0; i < 4; i++) put(parent, G.torus, mat, pos, r * 1.02, [i * 0.9, i * 1.4, i * 0.5]);
  }

  /** 樹:四種樹形先全部蓋好,出場時依場景只顯示一種(顏色跟著主題變) */
  makeTree() {
    const g = new THREE.Group(), T = this.mat, S = this.stat, s = rand(0.9, 1.4), v = {};
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    let t = add('pompom');                                                                        // 毛球樹:細枝 + 三顆蓬蓬的毛球
    put(t, G.cyl, T.trunk, [0, 0, 0.5 * s], [0.07 * s, 1.0 * s, 0.07 * s], UP);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; put(t, G.ico2, i % 2 ? T.canopy2 : T.canopy, [Math.cos(a) * 0.3 * s, Math.sin(a) * 0.3 * s, (1.0 + i * 0.12) * s], 0.4 * s); }
    t = add('felt');                                                                              // 毛氈圓樹:扁扁的圓樹冠 + 中間一顆鈕扣
    put(t, G.cyl, T.trunk, [0, 0, 0.4 * s], [0.1 * s, 0.8 * s, 0.1 * s], UP);
    put(t, G.ico2, T.canopy, [0, 0, 1.0 * s], [0.75 * s, 0.75 * s, 0.35 * s]);
    put(t, G.cyl, T.canopy2, [0, 0, 1.3 * s], [0.2 * s, 0.06 * s, 0.2 * s], UP);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(t, G.box, S.white, [Math.cos(a) * 0.6 * s, Math.sin(a) * 0.6 * s, 1.12 * s], [0.12 * s, 0.03 * s, 0.03 * s], [0, 0, a + Math.PI / 2]); } // 縫線
    t = add('pine');                                                                              // 毛氈松:三層三角形
    put(t, G.cyl, T.trunk, [0, 0, 0.25 * s], [0.08 * s, 0.5 * s, 0.08 * s], UP);
    for (let i = 0; i < 3; i++) put(t, G.cone6, i % 2 ? T.canopy2 : T.canopy, [0, 0, (0.7 + i * 0.4) * s], [(0.6 - i * 0.14) * s, 0.6 * s, (0.6 - i * 0.14) * s], UP);
    put(t, G.ico, S.candy[1], [0, 0, 1.75 * s], 0.1 * s);
    t = add('mushroom');                                                                          // 毛氈香菇:白柄 + 紅傘 + 白點點
    put(t, G.cyl, S.cream, [0, 0, 0.35 * s], [0.18 * s, 0.7 * s, 0.18 * s], UP);
    put(t, G.ico2, T.canopy, [0, 0, 0.8 * s], [0.6 * s, 0.6 * s, 0.35 * s]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(t, G.disc, S.white, [Math.cos(a) * 0.35 * s, Math.sin(a) * 0.35 * s, 1.05 * s], 0.08 * s); }
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 大物件:七種先全部蓋好,出場時依場景(THEMES.props)只顯示一種 */
  makeProp() {
    const g0 = new THREE.Group(), g = new THREE.Group(), S = this.stat, v = {}, tint = [];
    g.scale.setScalar(1.3); g0.add(g); // 布偶世界的東西大大的
    const add = (k, lean) => { v[k] = new THREE.Group(); v[k].visible = false; v[k].userData.lean = lean; g.add(v[k]); return v[k]; };
    // 大鈕扣:三顆平躺的鈕扣(四個扣眼 + 交叉的線)
    let t = add('buttons', false);
    for (let i = 0; i < 3; i++) {
      const r = rand(0.6, 1.0), x = (i - 1) * 1.7, y = rand(-0.5, 0.5);
      const m = put(t, G.cyl, S.candy[0], [x, y, 0.15], [r, 0.3, r], UP); tint.push(m);
      put(t, G.torus, S.dark, [x, y, 0.31], [r * 0.85, r * 0.85, 0.5]);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(t, G.cyl, S.dark, [x + dx * r * 0.22, y + dy * r * 0.22, 0.3], [r * 0.09, 0.04, r * 0.09], UP);
      for (const a of [Math.PI / 4, -Math.PI / 4]) put(t, G.box, S.white, [x, y, 0.33], [r * 0.7, 0.05, 0.03], [0, 0, a]);
    }
    // 線軸:兩三個站著的線軸(木頭兩端 + 彩色的線)+ 拉出來的一段線
    t = add('spools', false);
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * 1.3, y = rand(-0.4, 0.4), h = rand(0.9, 1.3);
      for (const z of [0.06, h]) put(t, G.cyl, S.wood, [x, y, z], [0.5, 0.12, 0.5], UP);
      const m = put(t, G.cyl, S.candy[2], [x, y, h / 2], [0.4, h, 0.4], UP); tint.push(m);
      for (let k = 1; k < 5; k++) put(t, G.cyl, S.white, [x, y, h * k / 5], [0.405, 0.015, 0.405], UP);
    }
    // 番茄針插:紅色的扁球 + 綠色的蒂 + 插著的彩色大頭針
    t = add('pincushion', false);
    put(t, G.ico2, S.red, [0, 0, 0.55], [1.1, 1.1, 0.65]);
    for (let i = 0; i < 6; i++) put(t, G.box, S.dark, [0, 0, 0.55], [0.02, 2.2, 1.3], [0, 0, i * Math.PI / 6]);   // 一瓣一瓣的線
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; put(t, G.cone6, S.green, [Math.cos(a) * 0.22, Math.sin(a) * 0.22, 1.18], [0.12, 0.35, 0.04], [0, 0, a - Math.PI / 2]); }
    for (let i = 0; i < 7; i++) {
      const a = rand(0, Math.PI * 2), r = rand(0.3, 0.8);
      put(t, G.cyl, S.silver, [Math.cos(a) * r, Math.sin(a) * r, 1.1], [0.02, 0.5, 0.02], UP);
      put(t, G.ico2, S.candy[i % 7], [Math.cos(a) * r, Math.sin(a) * r, 1.36], 0.09);
    }
    // 毛線球:三顆毛線球 + 插著的一對棒針
    t = add('yarnballs', false);
    for (let i = 0; i < 3; i++) this.yarnBall(t, S.candy[(i * 2) % 7], [(i - 1) * 1.2, rand(-0.4, 0.4), 0.5], rand(0.45, 0.6));
    for (const k of [-1, 1]) put(t, G.cyl, S.silver, [0.2, 0, 0.9], [0.04, 1.8, 0.04], [UP[0] - 0.8, 0, k * 0.5]);
    // 毛氈小屋:圓圓的牆 + 愛心窗 + 縫線門 + 粉紅屋頂(往上仰)
    t = add('house', true);
    const c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    const wall = put(c, G.box, S.felt, [0, 0, 0.8], [2.4, 1.8, 1.6]); tint.push(wall);
    put(c, G.cone6, S.roof, [0, 0, 2.1], [1.9, 1.2, 1.6], [UP[0], Math.PI / 6, 0]);
    put(c, G.box, S.door, [0, -0.91, 0.45], [0.55, 0.02, 0.9]);
    for (const x of [-0.75, 0.75]) {
      put(c, G.cyl, S.white, [x, -0.91, 1.1], [0.28, 0.02, 0.28]);
      for (const a of [Math.PI / 4, -Math.PI / 4]) put(c, G.box, S.dark, [x, -0.93, 1.1], [0.4, 0.02, 0.04], [0, a, 0]);   // 窗格 = 十字縫線
    }
    for (let i = 0; i < 6; i++) put(c, G.box, S.white, [-1.0 + i * 0.4, -0.91, 1.62], [0.2, 0.02, 0.04]);              // 屋簷下的縫線
    put(c, G.cyl, S.dark, [0.6, 0, 2.6], [0.14, 0.7, 0.14], UP);
    // 頂針:銀色的大頂針(一點一點的凹洞)
    t = add('thimble', false);
    put(t, G.cyl, S.silver, [0, 0, 0.7], [0.75, 1.4, 0.75], UP);
    put(t, G.ico2, S.silver, [0, 0, 1.4], [0.75, 0.75, 0.3]);
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 * 3, z = 0.4 + (i % 6) * 0.18; put(t, G.ico, S.rock2, [Math.cos(a) * 0.75, Math.sin(a) * 0.75, z], 0.07); }
    // 織到一半的圍巾:一條條紋長布 + 兩根棒針 + 一顆毛線球
    t = add('needles', false);
    for (let i = 0; i < 6; i++) { const m = put(t, G.box, i % 2 ? S.white : S.candy[0], [-0.4, -1.2 + i * 0.4, 0.1], [1.2, 0.4, 0.14]); if (!(i % 2)) tint.push(m); }
    for (const k of [-1, 1]) put(t, G.cyl, S.silver, [-0.4 + k * 0.2, 1.3, 0.2], [0.05, 2.4, 0.05], [0, 0, Math.PI / 2 + k * 0.2]);
    this.yarnBall(t, S.candy[1], [1.3, 0.8, 0.45], 0.45);
    return { g: g0, r: 4.2, z: -GROUND_Z, on: false, pop: 1, v, tint };
  }

  /** 小石頭 → 掉在地上的小鈕扣 */
  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = rand(0.18, 0.35);
      // 只用扁扁的、顏色淡的鈕扣(圓圓亮亮的小毛球會跟子彈搞混)
      const x = rand(-0.8, 0.8), y = rand(-0.6, 0.6);
      put(g, G.cyl, i % 2 ? this.stat.rock : this.stat.rock2, [x, y, 0.05], [s * 1.3, 0.08, s * 1.3], UP);
      for (const [dx, dy] of [[-1, -1], [1, 1]]) put(g, G.cyl, this.stat.dark, [x + dx * s * 0.3, y + dy * s * 0.3, 0.1], [s * 0.15, 0.04, s * 0.15], UP);
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 飄落的小毛球 / 雪花 / 亮片 */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const m = put(g, i % 2 ? G.ico : G.disc, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.1, 0.18), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  /** 棉花雲:一團團白白的棉花 */
  makeDust() {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) put(g, G.ico2, this.mat.dust, [(i - 2.5) * 0.8 + rand(-0.2, 0.2), rand(-0.5, 0.5), rand(0, 0.4)], [rand(0.8, 1.2), rand(0.6, 0.9), 0.4]);
    return { g, r: 7, z: rand(3, 5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), cloud: Cl(t.cloud), key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal), fabric: t.fabric, river: t.river,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'cloud', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    for (const key of ['keyI', 'river']) c[key] += (T[key] - c[key]) * k;
    // 布料花樣不能半路混(會變成奇怪的中間花樣)→ 換場景時顏色慢慢過渡,花樣直接切過去
    c.fabric = T.fabric;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.petal); U.uFabric.value = c.fabric; U.uRiver.value = c.river;
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
      if (o.tint) for (const m of o.tint) m.material = pick(this.stat.candy);  // 每次出場換一個糖果色
    }
    o.g.rotation.z = kind === 'camps' ? (o.lean ? rand(-0.08, 0.08) : rand(-0.5, 0.5)) : kind === 'clouds' ? rand(-0.3, 0.3) : Math.random() * 6;
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
        // 立體書:進到畫面時從布面彈起來
        if (o.pop < 0 && o.g.position.y < f.cy + f.hh * 0.92) o.pop = 0;
        if (o.pop >= 0 && o.pop < 1) {
          o.pop = Math.min(1, o.pop + dt * 1.8);
          const e = Math.max(0.02, elasticOut(o.pop)), w = 1 + (1 - o.pop) * 0.14;
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
