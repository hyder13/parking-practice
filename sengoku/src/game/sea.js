import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut, noboriMat } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的戰國戰場(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):兩色草地 + 小草點 / 野花 + 蜿蜒的小路 + (川中島…)一條河
 *   地上   樹(櫻 / 松…)、陣幕(白布圍起來 + 家紋 + 各家的のぼり旗)、長篠的馬防柵、天守閣(往畫面上方仰倒)、寺、燃燒的殘骸、石頭
 *          —— 捲進畫面時像立體書一樣「啪」地從紙面立起來(scale.z 0 → 1;仰倒的天守閣用 scale.y)
 *   空中   櫻花 / 雨 / 火星、戰場上的硝煙
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
  uniform float uTime, uScroll, uRiver;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    // 草地:兩色 cel 色塊
    float n = noise( p * 0.06 ) * 0.65 + noise( p * 0.17 + 3.1 ) * 0.35;
    vec3 c = mix( uDeep, uSea, smoothstep( 0.46, 0.52, n ) );
    // 小草點 + 野花(格子裡隨機放一點)
    vec2 g = floor( p * 1.3 ), f = fract( p * 1.3 ) - 0.5;
    float h = hash( g );
    vec2 o = vec2( hash( g + 7.0 ), hash( g + 13.0 ) ) - 0.5;
    float d = length( f - o * 0.6 );
    c = mix( c, uDeep * 0.82, step( 0.72, h ) * ( 1.0 - smoothstep( 0.06, 0.1, d ) ) );
    c = mix( c, uFlower, step( 0.965, h ) * ( 1.0 - smoothstep( 0.07, 0.11, d ) ) );
    // 黃土路:沿著 y 蜿蜒,兩道車轍
    float rx = sin( p.y * 0.035 ) * 6.0 + sin( p.y * 0.011 + 1.3 ) * 3.0;
    float rd = abs( vP.x - rx );
    c = mix( c, uFoam * 0.8, 1.0 - smoothstep( 1.55, 1.7, rd ) );
    c = mix( c, uFoam, 1.0 - smoothstep( 1.35, 1.45, rd ) );
    c = mix( c, uFoam * 0.86, ( 1.0 - smoothstep( 0.04, 0.09, abs( rd - 0.6 ) ) ) * step( rd, 1.3 ) );
    // 江:比路寬,兩岸有浪花
    if ( uRiver > 0.01 ) {
      float wx = sin( p.y * 0.018 + 2.0 ) * 7.0 - 3.0;
      float wd = abs( vP.x - wx ), W = 4.0 * uRiver;
      float w = noise( p * vec2( 0.4, 0.12 ) + vec2( 0.0, uTime * 0.3 ) );
      vec3 water = mix( uWater, uWater * 1.25, smoothstep( 0.55, 0.6, w ) );
      water = mix( water, vec3( 1.0 ), ( 1.0 - smoothstep( 0.02, 0.05, abs( fract( w * 4.0 ) - 0.5 ) ) ) * 0.15 );
      c = mix( c, uFoam * 0.7, 1.0 - smoothstep( W + 0.35, W + 0.5, wd ) );    // 河岸泥
      c = mix( c, water, 1.0 - smoothstep( W - 0.05, W + 0.05, wd ) );
      c = mix( c, vec3( 1.0 ), ( 1.0 - smoothstep( 0.0, 0.12, abs( wd - W + 0.2 ) ) ) * 0.55 ); // 岸邊浪花
    }
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  disc: new THREE.CircleGeometry(1, 18),
  petal: new THREE.CircleGeometry(1, 5),
  flag: new THREE.PlaneGeometry(0.7, 1.0).translate(0.35, -0.5, 0),
};
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let makuM = null;
const MAKU_GEO = new THREE.PlaneGeometry(3.4, 1.1);
/** 陣幕:白布 + 上下兩條黑帶 + 三個家紋(canvas 畫的) */
function makuMat() {
  if (!makuM) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 84;
    const g = c.getContext('2d');
    g.fillStyle = '#f4f0e8'; g.fillRect(0, 0, 256, 84);
    g.fillStyle = '#2a2226'; g.fillRect(0, 0, 256, 12); g.fillRect(0, 72, 256, 12);
    for (let i = 0; i < 3; i++) {
      const cx = 44 + i * 84, cy = 42;
      g.beginPath(); g.arc(cx, cy, 22, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f4f0e8';
      for (let k = 0; k < 4; k++) {                                                   // 四瓣的花紋(像木瓜紋)
        const a = k * Math.PI / 2 + Math.PI / 4;
        g.beginPath(); g.ellipse(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 8, 6, a, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#2a2226'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    makuM = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
  }
  return makuM;
}
const CASTLE_LEAN = 0.8; // 天守閣往畫面上方仰倒(立體書:從俯視也看得到一層層的屋頂)
// 各家的のぼり旗:[字, 底色, 字色]
const CLANS = [['織田', '#e8e0c8', '#2a2226'], ['武田', '#b8282a', '#fff4d8'], ['上杉', '#f4f0e8', '#2a2226'], ['今川', '#2a4fa8', '#fff4d8'],
  ['德川', '#f4f0e8', '#2a6a3a'], ['毛利', '#2a2226', '#fff4d8'], ['明智', '#3a5aa8', '#fff4d8'], ['淺井', '#6a3a8a', '#fff4d8']];

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
        uTime: { value: 0 }, uScroll: { value: 0 }, uRiver: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    this.mat = {
      trunk: cel({ color: 0x7a5a3a, bands: 2, cache: false }),
      canopy: cel({ color: 0xffa8c4, bands: 3, cache: false }),
      canopy2: cel({ color: 0xff88aa, bands: 3, cache: false }),
      petal: flat({ color: 0xffb8cc, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, cache: false }),
      dust: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, depthWrite: false }),
    };
    const C2 = (color) => cel({ color, bands: 2 });
    this.stat = {
      cloth: C2(0xf4f0e8), band: C2(0x2a2226), wood: C2(0x8a6a44), stake: C2(0x7a5a38), stone: C2(0x9a988e), stoneDark: C2(0x6a6862),
      wall: C2(0xf4f0ea), roof: C2(0x3a3e4a), roofDark: C2(0x24262e), gold: C2(0xf2c23a), shu: C2(0xc8402a), char: C2(0x2a2020),
      fire: flat({ color: 0xffa040 }), fire2: flat({ color: 0xffe070 }), cap: C2(0xe8322e), coconut: C2(0x6a4a2a),
      rock: cel({ color: 0x9a968a }), rock2: cel({ color: 0x7a766c, bands: 2 }),
    };

    this.pools = {
      trees: Array.from({ length: 40 }, () => this.makeTree()),
      camps: Array.from({ length: 8 }, () => this.makeProp()),
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
  /** 樹:五種樹形先全部蓋好,出場時依場景只顯示一種(顏色跟著主題變) */
  makeTree() {
    const g = new THREE.Group(), T = this.mat, s = rand(0.8, 1.4), v = {};
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    let t = add('round');
    put(t, G.cyl, T.trunk, [0, 0, 0.35 * s], [0.12 * s, 0.7 * s, 0.12 * s], UP);
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6, d = i ? 0.35 * s : 0;
      put(t, G.ico, i % 2 ? T.canopy2 : T.canopy, [Math.cos(a) * d, Math.sin(a) * d, (0.85 + i * 0.1) * s], [0.62 * s, 0.58 * s, 0.42 * s]);
    }
    t = add('palm');                                                                                          // 椰子樹:彎彎的幹 + 一圈長葉子 + 椰子
    put(t, G.cyl, T.trunk, [0.15 * s, 0, 0.7 * s], [0.08 * s, 1.4 * s, 0.08 * s], [Math.PI / 2, 0.2, 0]);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      put(t, G.ico, i % 2 ? T.canopy2 : T.canopy, [0.3 * s + Math.cos(a) * 0.55 * s, Math.sin(a) * 0.55 * s, 1.35 * s], [0.6 * s, 0.14 * s, 0.06 * s], [0, 0, a]);
    }
    for (let i = 0; i < 3; i++) put(t, G.ico, this.stat.coconut, [0.3 * s + Math.cos(i * 2) * 0.12 * s, Math.sin(i * 2) * 0.12 * s, 1.3 * s], 0.09 * s);
    t = add('acacia');                                                                                        // 金合歡:細幹 + 平平的傘狀樹冠
    put(t, G.cyl, T.trunk, [0, 0, 0.55 * s], [0.07 * s, 1.1 * s, 0.07 * s], UP);
    for (const x of [-1, 1]) put(t, G.cyl, T.trunk, [x * 0.25 * s, 0, 1.0 * s], [0.04 * s, 0.6 * s, 0.04 * s], [Math.PI / 2, 0, x * 0.7]);
    put(t, G.ico, T.canopy, [0, 0, 1.25 * s], [1.1 * s, 0.8 * s, 0.16 * s]);
    put(t, G.ico, T.canopy2, [0.2 * s, 0.15 * s, 1.35 * s], [0.6 * s, 0.45 * s, 0.1 * s]);
    t = add('pine');                                                                                          // 松:三層圓錐(頂上有雪)
    put(t, G.cyl, T.trunk, [0, 0, 0.25 * s], [0.08 * s, 0.5 * s, 0.08 * s], UP);
    for (let i = 0; i < 3; i++) put(t, G.cone6, i % 2 ? T.canopy2 : T.canopy, [0, 0, (0.7 + i * 0.4) * s], [(0.6 - i * 0.14) * s, 0.6 * s, (0.6 - i * 0.14) * s], UP);
    t = add('cactus');                                                                                        // 仙人掌:一根主幹 + 兩隻手
    put(t, G.cyl, T.canopy, [0, 0, 0.6 * s], [0.16 * s, 1.2 * s, 0.16 * s], UP);
    put(t, G.ico, T.canopy, [0, 0, 1.2 * s], 0.16 * s);
    for (const x of [-1, 1]) {
      put(t, G.cyl, T.canopy2, [x * 0.25 * s, 0, 0.6 * s], [0.08 * s, 0.3 * s, 0.08 * s], [0, 0, Math.PI / 2]);
      put(t, G.cyl, T.canopy2, [x * 0.38 * s, 0, 0.8 * s], [0.08 * s, 0.4 * s, 0.08 * s], UP);
      put(t, G.ico, T.canopy2, [x * 0.38 * s, 0, 1.0 * s], 0.08 * s);
    }
    put(t, G.ico, this.stat.cap, [0, 0, 1.36 * s], 0.06 * s);                                               // 頂上的小紅花
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 戰場上的大物件:五種先全部蓋好,出場時依場景(THEMES.props)只顯示一種 */
  makeProp() {
    const g = new THREE.Group(), S = this.stat, v = {}, flags = [], fires = [];
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    const nobori = (parent, x, y, clan, h = 1.6) => {
      const [text, bg, fg] = clan, { mat, aspect } = noboriMat(text, bg, fg);
      put(parent, G.cyl, S.wood, [x, y, h * 0.6], [0.035, h * 1.2, 0.035], UP);
      // 旗面朝鏡頭、微微往後仰(立體書):字由上往下讀
      const f = put(parent, new THREE.PlaneGeometry(h * aspect, h).translate(h * aspect / 2, h / 2, 0), mat, [x + 0.03, y, h * 0.75], 1, [-0.35, 0, 0]);
      flags.push(f);
      return f;
    };
    // 陣幕:白布圍成一圈(黑帶 + 家紋)+ 兩三面のぼり旗 + 床几
    let t = add('camp');
    const W = 3.4, H = 2.4;
    // 從俯視鏡頭看得到的是「面朝鏡頭、微微往後仰」的布幕(立體書);兩側只是矮矮的布邊
    for (const y of [-H / 2, H / 2]) put(t, MAKU_GEO, makuMat(), [0, y, 0.6], 1, [-0.4, 0, 0]);
    for (const x of [-W / 2, W / 2]) put(t, G.box, S.cloth, [x, 0, 0.3], [0.12, H, 0.6]);
    const clans = [];
    for (let i = 0; i < 3; i++) clans.push(nobori(t, -W / 2 + 0.3 + i * 1.3, H / 2 + 0.1, pick(CLANS)));
    put(t, G.box, S.wood, [0, 0, 0.25], [0.5, 0.3, 0.05]);
    // 馬防柵:一排交叉的木樁 + 兩道橫木(長篠)
    t = add('stakes');
    const st = new THREE.Group(); st.rotation.x = -CASTLE_LEAN; t.add(st);                               // 也往上仰,才看得到交叉的木樁
    for (let i = 0; i < 9; i++) {
      const x = -3.2 + i * 0.8;
      for (const k of [-1, 1]) put(st, G.box, S.stake, [x + k * 0.12, 0, 0.6], [0.12, 0.12, 1.3], [0, k * 0.35, 0]);
    }
    for (const z of [0.4, 0.85]) put(st, G.box, S.stake, [0, 0, z], [7.0, 0.1, 0.12]);
    // 天守閣:石垣 + 三層白牆 + 深色屋頂 + 金色鯱(往畫面上方仰倒)
    t = add('castle');
    const c = new THREE.Group(); c.rotation.x = -CASTLE_LEAN; t.add(c);
    put(c, G.box, S.stone, [0, 0, 0.5], [3.4, 3.0, 1.0]);
    put(c, G.box, S.stoneDark, [0, -1.51, 0.5], [3.4, 0.02, 1.0]);
    for (let i = 0; i < 3; i++) {
      const w = 2.4 - i * 0.55, z = 1.0 + i * 0.95;
      put(c, G.box, S.wall, [0, 0, z + 0.35], [w, w * 0.85, 0.7]);
      for (let k = -1; k <= 1; k++) put(c, G.box, S.char, [k * w * 0.28, -w * 0.43, z + 0.4], [0.18, 0.02, 0.2]);   // 窗
      put(c, G.box, S.roof, [0, 0, z + 0.78], [w + 0.9, w * 0.85 + 0.9, 0.16]);
      put(c, G.box, S.roofDark, [0, -(w * 0.85 + 0.9) / 2, z + 0.78], [w + 0.9, 0.06, 0.2]);
    }
    for (const x of [-1, 1]) put(c, G.cone6, S.gold, [x * 0.45, 0, 3.95], [0.12, 0.35, 0.12], [0, 0, x * 0.4]);      // 鯱
    put(c, G.box, S.roof, [0, 0, 3.85], [0.9, 0.9, 0.16]);
    // 寺:木造本堂 + 大屋頂 + 石燈籠
    t = add('temple');
    put(t, G.box, S.stone, [0, 0, 0.12], [3.4, 2.8, 0.24]);
    put(t, G.box, S.wood, [0, 0, 0.8], [2.8, 2.2, 1.1]);
    for (const s2 of [-1, 1]) put(t, G.box, S.roof, [s2 * 0.85, 0, 1.75], [2.0, 3.0, 0.16], [0, s2 * 0.5, 0]);
    put(t, G.box, S.roofDark, [0, 0, 2.2], [0.25, 3.1, 0.18]);
    for (const x of [-1, 1]) {
      put(t, G.cyl, S.stone, [x * 1.1, -1.9, 0.4], [0.1, 0.8, 0.1], UP);
      put(t, G.box, S.stoneDark, [x * 1.1, -1.9, 0.9], [0.35, 0.35, 0.25]);
      put(t, G.box, S.fire2, [x * 1.1, -1.9, 0.9], [0.36, 0.18, 0.15]);
    }
    // 燃燒的殘骸(比叡山 / 本能寺):燒黑的樑柱 + 火
    t = add('ruins');
    for (let i = 0; i < 5; i++) put(t, G.box, S.char, [rand(-1.2, 1.2), rand(-0.8, 0.8), 0.25], [2.0, 0.18, 0.18], [0, rand(-0.4, 0.4), rand(0, 3)]);
    for (let i = 0; i < 6; i++) {
      const f = put(t, G.cone6, i % 2 ? S.fire2 : S.fire, [rand(-1.2, 1.2), rand(-0.8, 0.8), 0.5], [0.3, 1.0, 0.3], UP);
      f.userData.base = rand(0.8, 1.3); fires.push(f);
    }
    return { g, r: 3.4, z: -GROUND_Z, on: false, pop: 1, v, flags, fires, clans };
  }

  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = rand(0.35, 0.9);
      put(g, G.ico0, i % 2 ? this.stat.rock2 : this.stat.rock, [rand(-0.8, 0.8), rand(-0.6, 0.6), s * 0.4], [s, s * rand(0.7, 1), s * 0.7], [Math.random(), Math.random(), Math.random() * 3]);
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const m = put(g, G.petal, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.12, 0.2), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  makeDust() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) put(g, G.disc, this.mat.dust, [rand(-4, 4), rand(-2, 2), i * 0.02], [rand(2.5, 4.5), rand(1.6, 2.6), 1]);
    return { g, r: 7, z: rand(3, 5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), cloud: Cl(t.cloud), key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal), river: t.river,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'cloud', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k; c.river += (T.river - c.river) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.petal); U.uRiver.value = c.river;
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
    if (o.v) {
      const want = kind === 'trees' ? this.theme.tree : pick(this.theme.props);
      for (const k in o.v) o.v[k].visible = k === want;
      o.lean = want === 'castle' || want === 'stakes';
    }
    o.g.rotation.z = kind === 'camps' ? (o.lean ? 0 : rand(-0.25, 0.25)) : kind === 'clouds' ? rand(-0.3, 0.3) : Math.random() * 6;
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
        if (o.flags) o.flags.forEach((f, i) => { f.rotation.z = Math.sin(this.time * 3 + i + o.g.position.x) * 0.12; });
        if (o.fires && o.v.ruins.visible) o.fires.forEach((f, i) => { f.scale.y = f.userData.base * (0.8 + 0.3 * Math.sin(this.time * 12 + i * 2.3)); });
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
