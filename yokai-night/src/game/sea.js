import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的平安京夜路(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   shader 平面(z = -GROUND_Z,就在角色腳下):中間是土路 / 石疊(散落的花瓣、落葉、雪),
 *          兩側依場景是瓦屋頂(town)/ 稻田(paddy)/ 北斎的大浪(harbor)/ 杉林・竹林・紅葉(forest)
 *   兩側   町家(格子窗 + 暖簾 + 瓦屋頂)、五重塔、神社(朱紅柱 + 檜皮屋頂 + 千木 + 賽錢箱)
 *   街邊   櫻 / 楓 / 柳 / 竹 / 松(依場景)、石燈籠
 *   頭上   跨過街道的朱紅鳥居,或一串提燈
 *   空中   花瓣 / 楓葉 / 雪、浮世繪的金色「霞」雲帶
 * 捲進畫面時像立體書一樣從紙面立起來(scale.z 0 → 1 彈性動畫)。
 * ------------------------------------------------------------------ */

export const SEA_Z = GROUND_Z;
const BASE_SPEED = 4.5;
const ROAD = 7.4;   // 街道半寬
const TORII_LEAN = 1.05; // 鳥居 / 五重塔 / 竹子往畫面上方仰倒的角度(立體書:讓高的東西從俯視也看得出形狀)

const SEA_VS = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4( position, 1.0 );
    vP = w.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SEA_FS = /* glsl */ `
  uniform vec3 uDeep, uSea, uRoad, uGrout, uPetal;
  uniform float uTime, uScroll, uSide, uPave;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    float ax = abs( vP.x );
    vec3 c;
    const float R = ${ROAD.toFixed(1)};
    if ( ax < R ) {
      if ( uPave > 0.5 ) {
        // 石疊:大小不一的方石,交錯排列
        vec2 q = p * vec2( 0.7, 1.0 );
        q.x += step( 1.0, mod( floor( q.y ), 2.0 ) ) * 0.5;
        vec2 id = floor( q ), f = fract( q );
        c = uRoad * ( 0.88 + hash( id ) * 0.2 );
        float e = min( min( f.x, 1.0 - f.x ) * 1.43, min( f.y, 1.0 - f.y ) );
        c = mix( uGrout, c, smoothstep( 0.03, 0.07, e ) );
      } else {
        // 土路:深淺不一 + 兩道車轍 + 木版畫刷出來的橫紋
        c = uRoad * ( 0.9 + noise( p * 0.6 ) * 0.16 );
        float rut = min( abs( ax - 2.4 ), abs( ax - 4.8 ) );
        c = mix( uGrout, c, 0.55 + 0.45 * smoothstep( 0.0, 0.3, rut ) );
        c *= 0.96 + 0.04 * sin( p.y * 34.0 + noise( p * 2.0 ) * 8.0 );
      }
      // 散落的花瓣 / 落葉 / 雪
      vec2 g = floor( p * 2.3 ), gf = fract( p * 2.3 ) - 0.5;
      float h = hash( g + 3.0 );
      c = mix( c, uPetal, step( 0.94, h ) * ( 1.0 - step( 0.1, length( gf * vec2( 1.0, 1.6 ) ) ) ) );
    } else if ( ax < R + 1.1 ) {
      // 路邊:石砌的水溝邊
      vec2 id = floor( p * vec2( 1.6, 2.2 ) );
      c = mix( uGrout, vec3( 0.5 ), 0.2 ) * ( 0.85 + hash( id ) * 0.2 );
      c = mix( c, uGrout * 0.6, 1.0 - smoothstep( 0.02, 0.06, min( fract( p.x * 1.6 ), fract( p.y * 2.2 ) ) ) );
      c = mix( c, uGrout * 0.5, 1.0 - smoothstep( 0.03, 0.09, abs( ax - R ) ) );
    } else if ( uSide < 0.5 ) {
      // 瓦屋頂群:一塊塊的屋頂 + 一排排的瓦
      float n = noise( p * vec2( 0.25, 0.4 ) );
      c = mix( uDeep, uSea, step( 0.5, n ) );
      c *= 0.84 + 0.16 * smoothstep( 0.15, 0.55, fract( p.y * 2.4 ) );
      c = mix( c, uDeep * 0.55, 1.0 - smoothstep( 0.0, 0.04, abs( n - 0.5 ) ) );
    } else if ( uSide < 1.5 ) {
      // 稻田:一行一行的秧苗 + 田埂 + 水光
      float row = abs( fract( vP.x * 1.6 ) - 0.5 );
      c = mix( uDeep * 0.9, uSea, smoothstep( 0.18, 0.3, row ) );
      float bund = abs( fract( p.y * 0.08 ) - 0.5 );
      c = mix( c, uGrout, 1.0 - smoothstep( 0.02, 0.04, bund ) );
    } else if ( uSide < 2.5 ) {
      // 北斎的大浪:藍色帶 + 刻線 + 浪尖的白色浪爪 + 浪花點
      float y = p.y * 0.32 + noise( p * vec2( 0.14, 0.3 ) ) * 2.2 + sin( vP.x * 0.45 + uTime * 0.6 ) * 0.35;
      float band = fract( y );
      c = mix( uDeep, uSea, smoothstep( 0.15, 0.8, band ) );
      float lines = abs( fract( y * 5.0 ) - 0.5 );
      c = mix( c, uSea * 1.3, ( 1.0 - smoothstep( 0.0, 0.07, lines ) ) * 0.45 * smoothstep( 0.2, 0.8, band ) );
      float crest = smoothstep( 0.82, 0.88, band ) * ( 1.0 - smoothstep( 0.97, 1.0, band ) );
      float claw = smoothstep( 0.35, 0.5, abs( fract( vP.x * 1.3 + band * 4.0 ) - 0.5 ) );
      c = mix( c, vec3( 0.97, 0.95, 0.9 ), crest * ( 0.55 + 0.45 * claw ) );
      c = mix( c, vec3( 0.97, 0.95, 0.9 ), step( 0.975, hash( floor( p * 3.0 ) ) ) * smoothstep( 0.55, 0.85, band ) );
      c = mix( c, vec3( 0.97, 0.95, 0.9 ), ( 1.0 - smoothstep( 0.0, 0.25, ax - R - 1.1 ) ) * 0.7 ); // 岸邊浪花
    } else {
      // 森林:一團團的樹冠(圓形、有墨線邊、左上一點亮面)
      vec2 q = p * 0.5; vec2 id = floor( q ), f = fract( q ) - 0.5;
      float h = hash( id );
      vec2 o = vec2( hash( id + 1.3 ), hash( id + 7.1 ) ) - 0.5;
      float d = length( f - o * 0.3 ), r = 0.36 + h * 0.14;
      c = uDeep * 0.7;
      if ( d < r ) {
        c = mix( uSea, uDeep, h * 0.7 );
        c = mix( c, uSea * 1.25, ( 1.0 - smoothstep( 0.0, r * 0.7, length( f - o * 0.3 - vec2( -0.1, 0.1 ) ) ) ) * 0.45 );
        c = mix( c, uDeep * 0.45, smoothstep( r - 0.06, r, d ) );
      }
    }
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  disc: new THREE.CircleGeometry(1, 18),
  petal: new THREE.PlaneGeometry(1, 0.6),
  sign: new THREE.PlaneGeometry(1.4, 1.0),
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const UP = [Math.PI / 2, 0, 0];
const SHOPS = ['酒', '茶', '湯', '宿', '米', '薬', '蕎', '団', '鮨', '飴', '油', '紙'];
const NOREN_BG = ['#2a3a6a', '#2a3a6a', '#8a2a2a', '#3a5a3a', '#4a3a2a'];

function put(parent, geo, mat, pos, scl, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(...scl);
  if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}
const norenMats = new Map();
/** 暖簾:藍染(或茶 / 紅)的布,分成三片,中間一個白字 */
function norenMat(ch) {
  if (!norenMats.has(ch)) {
    const c = document.createElement('canvas'); c.width = 96; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = pick(NOREN_BG); g.fillRect(0, 0, 96, 64);
    g.fillStyle = 'rgba(0,0,0,.35)'; for (const x of [31, 63]) g.fillRect(x, 10, 2, 54);   // 三片的縫
    g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, 96, 6);
    g.font = '900 38px "Noto Serif TC","Noto Serif JP","PingFang TC",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 48, 38);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    norenMats.set(ch, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  }
  return norenMats.get(ch);
}
/** 鳥居的額:黑框金字「稲荷」 */
let gakuMat = null;
function getGaku() {
  if (!gakuMat) {
    const c = document.createElement('canvas'); c.width = 40; c.height = 72;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1a22'; g.fillRect(0, 0, 40, 72);
    g.fillStyle = '#f2c23a'; g.font = '900 26px "Noto Serif TC","Noto Serif JP",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('稲', 20, 22); g.fillText('荷', 20, 52);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    gakuMat = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
  }
  return gakuMat;
}

export class Sea {
  constructor(scene, lights) {
    this.scene = scene; this.lights = lights;
    this.group = new THREE.Group(); scene.add(this.group);
    this.time = 0; this.speed = 1; this.scroll = 0;

    this.seaMat = new THREE.ShaderMaterial({
      vertexShader: SEA_VS, fragmentShader: SEA_FS,
      uniforms: {
        uDeep: { value: new THREE.Color() }, uSea: { value: new THREE.Color() }, uRoad: { value: new THREE.Color() },
        uGrout: { value: new THREE.Color() }, uPetal: { value: new THREE.Color() },
        uTime: { value: 0 }, uScroll: { value: 0 }, uSide: { value: 0 }, uPave: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    this.mat = {
      petal: flat({ color: 0xffb8c8, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, cache: false }),
      kasumi: new THREE.MeshBasicMaterial({ color: 0xf0d8a0, transparent: true, opacity: 0.42, depthWrite: false }),
    };
    const C2 = (color) => cel({ color, bands: 2 });
    this.stat = {
      wood: C2(0x5a3a2a), woodLight: C2(0x8a6040), plaster: C2(0xf0e8d8), roof: C2(0x4a4e5c), roofDark: C2(0x2a2c36),
      shu: C2(0xd8402a), shuDark: C2(0xa82a20), black: C2(0x1a1a22), bark: C2(0x6a4a3a), gold: C2(0xf2c23a),
      stone: C2(0x9a988e), stoneDark: C2(0x6a6862), fire: flat({ color: 0xffb04a }),
      trunk: C2(0x4a3428), blossom: C2(0xffb8cc), blossom2: C2(0xffe0ea), maple: C2(0xd8402a), maple2: C2(0xf08a2a),
      willow: C2(0x8ab84a), willow2: C2(0xb8d86a), bamboo: C2(0x6aa04a), bambooNode: C2(0x4a7a34), bambooLeaf: C2(0x8ac05a),
      pine: C2(0x2e5a3a), pine2: C2(0x3e7048), snow: C2(0xf8faff),
      paper: flat({ color: 0xfff0c8 }), rope: C2(0x3a2a24), straw: C2(0xd8c080),
    };

    this.pools = {
      houses: Array.from({ length: 16 }, () => this.makeHouse()),
      temples: Array.from({ length: 4 }, (_, i) => (i % 2 ? this.makeShrine() : this.makePagoda())),
      stalls: Array.from({ length: 22 }, () => this.makeTree()),
      lanterns: Array.from({ length: 6 }, () => this.makeGate()),
      petals: Array.from({ length: 14 }, () => this.makePetals()),
      clouds: Array.from({ length: 6 }, () => this.makeKasumi()),
    };
    this.acc = { houses: 0, temples: 0, stalls: 0, lanterns: 0, petals: 0, clouds: 0 };
    this.popKinds = new Set(['houses', 'temples', 'stalls', 'lanterns']);
    for (const k in this.pools) for (const o of this.pools[k]) { o.g.visible = false; o.on = false; this.group.add(o.g); }

    this.theme = THEMES[0];
    this.cur = null; this.target = null;
    this.setTheme(0, true);
  }

  /* ---------------- 物件 ---------------- */
  /** 町家:深色木造 + 白壁帶 + 瓦屋頂(一排排的瓦)+ 朝街道那面的格子窗和暖簾 */
  makeHouse() {
    const g = new THREE.Group(), S = this.stat, L = rand(3.2, 4.4), D = 4.2;
    put(g, G.box, S.wood, [0, 0, 0.75], [D, L, 1.5]);
    put(g, G.box, S.plaster, [0, 0, 1.55], [D * 0.98, L * 0.98, 0.3]);
    for (const s of [-1, 1]) {
      const sg = new THREE.Group(); sg.position.set(s * D * 0.25, 0, 1.9); sg.rotation.y = s * 0.42; g.add(sg);
      put(sg, G.box, S.roof, [0, 0, 0], [D * 0.58, L + 0.3, 0.12]);
      for (let k = -1; k <= 1; k++) put(sg, G.box, S.roofDark, [k * D * 0.16, 0, 0.065], [0.05, L + 0.3, 0.02]); // 一排排的瓦
    }
    put(g, G.box, S.roofDark, [0, 0, 2.1], [0.24, L + 0.35, 0.16]);
    const koshi = new THREE.Group(); g.add(koshi);                                                        // 格子窗(朝街道)
    const n = Math.floor(L / 0.3);
    for (let i = 0; i < n; i++) put(koshi, G.box, S.woodLight, [0, -L / 2 + 0.25 + i * (L - 0.5) / (n - 1), 0.7], [0.08, 0.06, 1.1]);
    put(koshi, G.box, S.woodLight, [0, 0, 1.26], [0.1, L * 0.95, 0.06]);
    const sign = put(g, G.sign, norenMat(pick(SHOPS)), [0, 0, 2.3], 0.9, [0.5, 0, 0]);
    return { g, r: L, z: -GROUND_Z, on: false, pop: 1, sign, koshi, D };
  }

  /** 五重塔:朱紅柱身 + 五層寬屋頂(越上越小)+ 金色相輪 */
  makePagoda() {
    const root = new THREE.Group(), g = new THREE.Group(), S = this.stat, D = 4.0;
    root.add(g); g.rotation.x = -TORII_LEAN * 0.75;
    put(g, G.box, S.stone, [0, 0, 0.12], [3.4, 3.4, 0.24]);
    for (let i = 0; i < 5; i++) {
      const w = 2.3 - i * 0.28, z = 0.24 + i * 0.78;
      put(g, G.box, S.shu, [0, 0, z + 0.28], [w, w, 0.56]);
      put(g, G.box, S.roofDark, [0, 0, z + 0.62], [w + 1.25, w + 1.25, 0.14]);
      put(g, G.cone4, S.roof, [0, 0, z + 0.78], [(w + 1.2) * 0.72, 0.28, (w + 1.2) * 0.72], [Math.PI / 2, Math.PI / 4, 0]);
    }
    put(g, G.cyl, S.gold, [0, 0, 4.6], [0.07, 1.2, 0.07], UP);                                           // 相輪
    for (let i = 0; i < 6; i++) put(g, G.cyl, S.gold, [0, 0, 4.2 + i * 0.16], [0.2 - i * 0.02, 0.05, 0.2 - i * 0.02], UP);
    put(g, G.ico, S.gold, [0, 0, 5.25], 0.12);
    return { g: root, r: 4.5, z: -GROUND_Z, on: false, pop: 1, D, lean: true };
  }

  /** 神社:朱紅柱 + 白壁 + 檜皮屋頂 + 千木 / 鰹木,朝街道那側放賽錢箱 + 鈴繩 + 一對石燈籠 */
  makeShrine() {
    const g = new THREE.Group(), S = this.stat, L = 5.4, D = 4.4;
    put(g, G.box, S.stone, [0, 0, 0.15], [D + 0.4, L + 0.4, 0.3]);
    put(g, G.box, S.plaster, [0, 0, 0.95], [D - 0.4, L - 0.4, 1.3]);
    for (const x of [-1, 1]) for (const y of [-1, 1]) put(g, G.cyl, S.shu, [x * (D / 2 - 0.2), y * (L / 2 - 0.2), 0.95], [0.16, 1.6, 0.16], UP);
    for (const s of [-1, 1]) put(g, G.box, S.bark, [s * D * 0.27, 0, 2.05], [D * 0.66, L + 0.8, 0.22], [0, s * 0.55, 0]);
    put(g, G.box, S.roofDark, [0, 0, 2.5], [0.3, L + 0.6, 0.2]);
    for (const e of [-1, 1]) for (const s of [-1, 1]) {                                                    // 千木(屋脊兩端交叉)
      put(g, G.box, S.bark, [s * 0.25, e * (L / 2 + 0.3), 2.85], [0.08, 0.1, 0.9], [0, s * 0.5, 0]);
    }
    for (let i = -2; i <= 2; i++) {                                                                        // 鰹木
      put(g, G.cyl, S.bark, [0, i * 0.9, 2.66], [0.1, 0.7, 0.1], [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) put(g, G.cyl, S.gold, [s * 0.36, i * 0.9, 2.66], [0.11, 0.03, 0.11], [0, 0, Math.PI / 2]);
    }
    const front = new THREE.Group(); g.add(front);                                                        // 賽錢箱 + 鈴繩 + 石燈籠
    put(front, G.box, S.woodLight, [0, 0, 0.35], [0.6, 1.2, 0.5]);
    put(front, G.cyl, S.gold, [0, 0, 1.9], [0.12, 0.12, 0.12], UP);
    put(front, G.cyl, S.shu, [-0.05, 0, 1.2], [0.04, 1.4, 0.04], UP);
    put(front, G.cyl, S.plaster, [0.05, 0, 1.2], [0.04, 1.4, 0.04], UP);
    for (const y of [-1, 1]) this.addToro(front, [-0.3, y * 2.0, 0], 0.9);
    return { g, r: L, z: -GROUND_Z, on: false, pop: 1, burner: front, D };
  }

  /** 石燈籠(台座 + 柱 + 發光的火袋 + 方形笠 + 寶珠) */
  addToro(parent, at, s = 1) {
    const S = this.stat, t = new THREE.Group();
    put(t, G.cyl, S.stoneDark, [0, 0, 0.1], [0.34, 0.2, 0.34], UP);
    put(t, G.cyl, S.stone, [0, 0, 0.55], [0.12, 0.8, 0.12], UP);
    put(t, G.box, S.stone, [0, 0, 1.0], [0.55, 0.55, 0.14]);
    put(t, G.box, S.stoneDark, [0, 0, 1.25], [0.42, 0.42, 0.36]);
    put(t, G.box, S.fire, [0, 0, 1.25], [0.44, 0.24, 0.24]);
    put(t, G.cone4, S.stone, [0, 0, 1.6], [0.55, 0.36, 0.55], [Math.PI / 2, Math.PI / 4, 0]);
    put(t, G.ico, S.stone, [0, 0, 1.85], 0.09);
    t.position.set(...at); t.scale.setScalar(s); parent.add(t);
    return t;
  }

  /** 街邊的樹 / 石燈籠:每一個都先把各種都蓋好,出場時依場景只顯示一種 */
  makeTree() {
    const g = new THREE.Group(), S = this.stat, v = {};
    const blossom = (a, b) => {
      const t = new THREE.Group(); g.add(t);
      put(t, G.cyl, S.trunk, [0, 0, 0.7], [0.12, 1.4, 0.12], UP);
      for (const s of [-1, 1]) put(t, G.cyl, S.trunk, [s * 0.3, 0, 1.3], [0.06, 0.8, 0.06], [Math.PI / 2, 0, s * 0.7]);
      for (let i = 0; i < 6; i++) {
        const a2 = i / 6 * Math.PI * 2;
        put(t, G.ico, i % 2 ? a : b, [Math.cos(a2) * 0.55, Math.sin(a2) * 0.5, 1.7 + (i % 3) * 0.15], rand(0.45, 0.65));
      }
      put(t, G.ico, a, [0, 0, 2.05], 0.7);
      return t;
    };
    v.sakura = blossom(S.blossom, S.blossom2);
    v.maple = blossom(S.maple, S.maple2);
    // 柳:樹冠 + 一圈垂下來的枝條
    v.willow = new THREE.Group(); g.add(v.willow);
    put(v.willow, G.cyl, S.trunk, [0, 0, 0.8], [0.12, 1.6, 0.12], UP);
    put(v.willow, G.ico, S.willow, [0, 0, 1.9], [0.8, 0.8, 0.45]);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      put(v.willow, G.cone8, i % 2 ? S.willow : S.willow2, [Math.cos(a) * 0.8, Math.sin(a) * 0.75, 1.2], [0.14, 1.3, 0.1], [-Math.PI / 2, 0, 0]);
    }
    // 竹:一叢高高的竹子(有竹節)+ 頂端的葉子
    v.bamboo = new THREE.Group(); v.bamboo.rotation.x = -TORII_LEAN * 0.7; g.add(v.bamboo);
    for (let i = 0; i < 6; i++) {
      const x = rand(-0.6, 0.6), y = rand(-0.6, 0.6), h = rand(3.0, 4.6);
      put(v.bamboo, G.cyl, S.bamboo, [x, y, h / 2], [0.07, h, 0.07], UP);
      for (let k = 1; k < h; k += 0.7) put(v.bamboo, G.cyl, S.bambooNode, [x, y, k], [0.085, 0.05, 0.085], UP);
      put(v.bamboo, G.ico, S.bambooLeaf, [x + 0.2, y, h], [0.5, 0.3, 0.12]);
    }
    // 松:彎曲的幹 + 一片片雲朵狀的平葉團(雪夜會積雪)
    v.pine = new THREE.Group(); g.add(v.pine);
    put(v.pine, G.cyl, S.trunk, [0, 0, 0.6], [0.14, 1.2, 0.14], UP);
    put(v.pine, G.cyl, S.trunk, [0.25, 0, 1.4], [0.1, 0.9, 0.1], [Math.PI / 2, 0, -0.6]);
    const snow = new THREE.Group(); v.pine.add(snow); v.pineSnow = snow;
    for (const [x, y, z, s] of [[-0.4, 0.1, 1.3, 0.8], [0.5, -0.1, 1.8, 0.75], [0.05, 0.1, 2.3, 0.6]]) {
      put(v.pine, G.ico, S.pine, [x, y, z], [s, s * 0.8, 0.22]);
      put(v.pine, G.ico, S.pine2, [x - 0.1, y + 0.1, z + 0.08], [s * 0.6, s * 0.5, 0.12]);
      put(snow, G.ico, S.snow, [x, y, z + 0.14], [s * 0.85, s * 0.7, 0.1]);
    }
    v.toro = new THREE.Group(); g.add(v.toro); this.addToro(v.toro, [0, 0, 0], 1.1);
    for (const k of ['sakura', 'maple', 'willow', 'bamboo', 'pine', 'toro']) v[k].visible = false;
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 跨街的朱紅鳥居(笠木 + 島木 + 貫 + 額束 + 兩根柱),或一串提燈 */
  makeGate() {
    const g = new THREE.Group(), S = this.stat, X = ROAD + 0.55;
    // 鳥居:跟人偶一樣往畫面上方仰倒(TORII_LEAN),從俯視鏡頭才看得到柱子 + 兩道橫木的剪影
    const torii = new THREE.Group(); torii.rotation.x = -TORII_LEAN; g.add(torii);
    for (const s of [-1, 1]) {
      put(torii, G.cyl, S.shu, [s * X, 0, 1.7], [0.34, 3.4, 0.34], UP);
      put(torii, G.cyl, S.black, [s * X, 0, 0.15], [0.4, 0.3, 0.4], UP);
      put(torii, G.box, S.black, [s * (X + 1.1), 0, 3.95], [1.0, 0.4, 0.45], [0, s * -0.28, 0]);          // 笠木兩端往上翹
    }
    put(torii, G.box, S.black, [0, 0, 3.8], [2 * X + 0.8, 0.4, 0.45]);                                  // 笠木
    put(torii, G.box, S.shu, [0, 0, 3.42], [2 * X + 0.4, 0.34, 0.34]);                                 // 島木
    put(torii, G.box, S.shu, [0, 0, 2.7], [2 * X + 1.1, 0.26, 0.3]);                                   // 貫
    put(torii, G.box, S.shu, [0, 0, 3.05], [0.22, 0.22, 0.45]);                                         // 額束
    put(torii, G.sign, getGaku(), [0, 0.2, 3.06], [0.36, 0.6, 1], [Math.PI / 2, 0, 0]);
    // 一串提燈(白紙 + 紅字帶 + 黑框)
    const rope = new THREE.Group(); g.add(rope);
    const z = 2.6, n = 7, list = [];
    put(rope, G.cyl, S.rope, [0, 0, z + 0.45], [0.02, ROAD * 2.6, 0.02], [0, 0, Math.PI / 2]);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 2.7, l = new THREE.Group();
      put(l, G.ico, S.paper, [0, 0, 0], [0.36, 0.36, 0.5]);
      put(l, G.cyl, S.shuDark, [0, 0, 0], [0.37, 0.14, 0.37], UP);
      put(l, G.cyl, S.black, [0, 0, 0.48], [0.2, 0.08, 0.2], UP);
      put(l, G.cyl, S.black, [0, 0, -0.48], [0.2, 0.08, 0.2], UP);
      put(l, G.cyl, S.black, [0, 0, -0.7], [0.03, 0.32, 0.03], UP);
      l.position.set(x, 0, z); rope.add(l); list.push(l);
    }
    return { g, r: 3.4, z: -GROUND_Z, on: false, pop: 1, swing: list, torii, rope };
  }

  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 7; i++) {
      const m = put(g, G.petal, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.14, 0.24), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(2, 5) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  /** 浮世繪的「霞」:幾條圓頭的金色橫帶,飄在畫面兩側 */
  makeKasumi() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const w = rand(3.5, 6.5), h = rand(0.5, 0.8), y = (i - 1) * 1.1, x = rand(-1.5, 1.5);
      put(g, G.disc, this.mat.kasumi, [x, y, i * 0.02], [w, h, 1]);
    }
    return { g, r: 7, z: rand(3.5, 5), on: false, kasumi: true };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), road: Cl(t.road), grout: Cl(t.grout), petal: Cl(t.petal), cloud: Cl(t.cloud), roof: Cl(t.roof),
      key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi), side: { town: 0, paddy: 1, harbor: 2, forest: 3 }[t.side], pave: t.pave,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'road', 'grout', 'petal', 'cloud', 'roof', 'key', 'hemi']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k;
    c.side = T.side; c.pave = T.pave; // 地面種類直接切(換關時有曲速捲動,看不出來)
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uRoad.value.copy(c.road); U.uGrout.value.copy(c.grout);
    U.uPetal.value.copy(c.petal); U.uSide.value = c.side; U.uPave.value = c.pave;
    this.mat.petal.color.copy(c.petal); this.mat.kasumi.color.copy(c.cloud);
    this.stat.roof.color.copy(c.roof);
    if (this.lights) {
      this.lights.key.color.copy(c.key); this.lights.key.intensity = c.keyI;
      this.lights.hemi.color.copy(c.hemi);
    }
  }
  get clearColor() { return this.cur.deep; }

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
    const f = this.frame(-o.z), side = Math.random() < 0.5 ? -1 : 1, t = this.theme;
    let x;
    if (kind === 'houses' || kind === 'temples') {
      // 兩側:朝街道那一面在內側(暖簾 / 格子窗 / 賽錢箱放在內側)
      x = side * (ROAD + 1.2 + o.D / 2 + rand(0, 0.8));
      if (t.side !== 'town' && kind === 'houses' && Math.random() < 0.5) x = side * (ROAD + 1.2 + o.D / 2);
      const inner = -side * o.D / 2;
      if (o.sign) o.sign.position.x = inner * 0.8;
      if (o.koshi) o.koshi.position.x = inner * 1.01;
      if (o.burner) o.burner.position.set(inner - side * 0.9, 0, 0);
    } else if (kind === 'stalls') {
      x = side * rand(ROAD - 0.4, ROAD + 1.0);
      const kindT = Math.random() < 0.25 ? 'toro' : t.tree;
      for (const k of ['sakura', 'maple', 'willow', 'bamboo', 'pine', 'toro']) o.v[k].visible = k === kindT;
      o.v.pineSnow.visible = t.name === '雪夜';
      if (t.side === 'forest' && kindT !== 'toro' && Math.random() < 0.5) x = side * rand(ROAD + 2, ROAD + 6); // 森林裡多種幾棵
    } else if (kind === 'lanterns') {
      x = 0;
      const torii = t.gate === 'torii' || (t.gate === 'rope' && Math.random() < 0.15);
      o.torii.visible = torii; o.rope.visible = !torii; o.lean = torii;
    } else if (o.kasumi) x = side * rand(3, f.hw);
    else x = rand(-1, 1) * (f.hw - o.r * 0.3);
    o.on = true; o.g.visible = true;
    o.g.position.set(x, f.cy + f.hh + o.r, o.z);
    o.g.rotation.z = o.kasumi ? rand(-0.08, 0.08) : 0;
    // 立起來的動畫:一般物件 scale.z 0 → 1(從紙面長高);仰倒的鳥居 / 五重塔改用 scale.y(從底邊往上展開)
    if (this.popKinds.has(kind)) { o.pop = -1; if (o.lean) o.g.scale.set(1, 0.02, 1); else o.g.scale.set(1, 1, 0.02); }
  }

  step(dy, dt, prime = false) {
    const t = this.theme;
    // 鄉間 / 海邊 / 森林:兩側的房子少很多
    const town = t.side === 'town' ? 1 : 0.35;
    const rates = { houses: t.houses * 4 * town, temples: t.temples * 4, stalls: t.stalls * 3, lanterns: t.lanterns, petals: t.petals * 1.5, clouds: prime ? t.clouds * 0.5 : t.clouds };
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
        o.g.position.y -= dy * (o.kasumi ? 0.7 : 1);
        const f = this.frame(-o.z);
        if (o.pop < 0 && o.g.position.y < f.cy + f.hh * 0.92) o.pop = 0;
        if (o.pop >= 0 && o.pop < 1) {
          o.pop = Math.min(1, o.pop + dt * 1.8);
          const e = Math.max(0.02, elasticOut(o.pop)), w = 1 + (1 - o.pop) * 0.12;
          if (o.lean) o.g.scale.set(w, e, 1); else o.g.scale.set(w, w, e);
        }
        if (o.swing && o.rope.visible) o.swing.forEach((l, i) => { l.rotation.y = Math.sin(this.time * 2 + i) * 0.15; });
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
