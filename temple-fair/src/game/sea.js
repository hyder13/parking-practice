import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { GROUND_Z, bannerTex, elasticOut } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的遶境路線(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   shader 平面(z = -GROUND_Z,就在角色腳下):中間是石板 / 紅磚街道(交錯的磚縫、散落的鞭炮紅紙屑),
 *          兩側是騎樓人行道,再外面依場景是屋頂群(town)/ 稻田(paddy)/ 海水(harbor)
 *   兩側   老街店屋(灰瓦 + 招牌:香鋪 / 金紙 / 餅店…)、廟宇(橘紅琉璃瓦 + 燕尾脊 + 剪黏雙龍搶珠 + 香爐)
 *   街邊   攤販(彩色陽傘 + 攤子)、供桌(紅桌巾 + 水果 + 香)
 *   頭上   一整排跨過街道的紅燈籠
 *   空中   鞭炮紅紙屑 / 金紙屑 / 燈火、淡淡的鞭炮煙
 * 捲進畫面時像立體書一樣從紙面立起來(scale.z 0 → 1 彈性動畫)。
 * ------------------------------------------------------------------ */

export const SEA_Z = GROUND_Z;
const BASE_SPEED = 4.5;
const ROAD = 7.4;   // 街道半寬

const SEA_VS = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4( position, 1.0 );
    vP = w.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SEA_FS = /* glsl */ `
  uniform vec3 uDeep, uSea, uRoad, uGrout, uPetal;
  uniform float uTime, uScroll, uSide;
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
    if ( ax < ${ROAD.toFixed(1)} ) {
      // 石板 / 紅磚:交錯排列,每塊顏色有一點差異
      vec2 q = p * vec2( 0.8, 1.2 );
      q.x += step( 1.0, mod( floor( q.y ), 2.0 ) ) * 0.5;
      vec2 id = floor( q ), f = fract( q );
      c = uRoad * ( 0.9 + hash( id ) * 0.18 );
      float e = min( min( f.x, 1.0 - f.x ) * 1.25, min( f.y, 1.0 - f.y ) * 0.83 );
      c = mix( uGrout, c, smoothstep( 0.02, 0.05, e ) );
      // 散落的鞭炮紅紙屑
      vec2 g = floor( p * 2.3 ), gf = fract( p * 2.3 ) - 0.5;
      float h = hash( g + 3.0 );
      c = mix( c, uPetal, step( 0.93, h ) * ( 1.0 - step( 0.12, max( abs( gf.x ), abs( gf.y ) * 1.6 ) ) ) );
    } else if ( ax < ${(ROAD + 1.1).toFixed(1)} ) {
      // 騎樓人行道(較亮的方磚)
      vec2 id = floor( p * 1.4 );
      c = mix( uRoad, vec3( 1.0 ), 0.25 ) * ( 0.93 + hash( id ) * 0.1 );
      c = mix( c, uGrout, 1.0 - smoothstep( 0.02, 0.06, min( fract( p.x * 1.4 ), fract( p.y * 1.4 ) ) ) );
      c = mix( c, uGrout * 0.8, 1.0 - smoothstep( 0.03, 0.08, abs( ax - ${ROAD.toFixed(1)} ) ) );   // 路緣
    } else if ( uSide < 0.5 ) {
      // 屋頂群:大塊色塊
      float n = noise( p * vec2( 0.25, 0.4 ) );
      c = mix( uDeep, uSea, step( 0.5, n ) );
    } else if ( uSide < 1.5 ) {
      // 稻田:一行一行的秧苗 + 田埂 + 水光
      float row = abs( fract( vP.x * 1.6 ) - 0.5 );
      c = mix( uDeep * 0.9, uSea, smoothstep( 0.18, 0.3, row ) );
      float bund = abs( fract( p.y * 0.08 ) - 0.5 );
      c = mix( c, uGrout, 1.0 - smoothstep( 0.02, 0.04, bund ) );
      c = mix( c, vec3( 0.9, 0.95, 1.0 ), step( 0.975, noise( p * 1.8 + uTime * 0.3 ) ) * 0.4 );
    } else {
      // 海水
      float w = noise( p * vec2( 0.3, 0.9 ) + vec2( uTime * 0.2, 0.0 ) );
      c = mix( uDeep, uSea, smoothstep( 0.45, 0.55, w ) );
      c = mix( c, vec3( 1.0 ), ( 1.0 - smoothstep( 0.0, 0.03, abs( w - 0.7 ) ) ) * 0.35 );
      c = mix( c, vec3( 1.0 ), ( 1.0 - smoothstep( 0.0, 0.15, ax - ${(ROAD + 1.1).toFixed(1)} ) ) * 0.5 ); // 堤岸浪花
    }
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone8: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  disc: new THREE.CircleGeometry(1, 18),
  petal: new THREE.PlaneGeometry(1, 0.6),
  sign: new THREE.PlaneGeometry(1.1, 1.6),
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const UP = [Math.PI / 2, 0, 0];
const SHOPS = ['香鋪', '金紙', '餅店', '茶行', '雜貨', '藥房', '冰店', '麵攤', '布莊', '米店', '糕餅', '豆花'];
const SIGN_BG = ['#b8201e', '#2a4fa8', '#2e7a4a', '#1e1a24', '#c88a1a'];
const UMBRELLA = [0xd8322e, 0xffc23a, 0x2a8ad8, 0x3ab86a, 0xf06aa0, 0xf4f0e8];

function put(parent, geo, mat, pos, scl, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(...scl);
  if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}
const signMats = new Map();
function signMat(text) {
  if (!signMats.has(text)) {
    const bg = pick(SIGN_BG);
    // 直式招牌:兩個字上下排
    const c = document.createElement('canvas'); c.width = 64; c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 64, 96);
    g.strokeStyle = '#ffe8a0'; g.lineWidth = 3; g.strokeRect(4, 4, 56, 88);
    g.fillStyle = '#fff4d8'; g.font = '900 34px "Noto Serif TC","PingFang TC","Microsoft JhengHei",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    [...text].forEach((ch, i) => g.fillText(ch, 32, 28 + i * 40));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    signMats.set(text, new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  }
  return signMats.get(text);
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
        uTime: { value: 0 }, uScroll: { value: 0 }, uSide: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    this.mat = {
      petal: flat({ color: 0xe8322e, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, cache: false }),
      smoke: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }),
    };
    this.stat = {
      brick: cel({ color: 0xb8624a }), cream: cel({ color: 0xf2e6c8 }), tile: cel({ color: 0xa8483a }), tileDark: cel({ color: 0x7a3a30, bands: 2 }),
      tempRoof: cel({ color: 0xd8582a }), tempWall: cel({ color: 0xc8342a }), ridge: cel({ color: 0xf0dcb0, bands: 2 }),
      dragon: cel({ color: 0x3aa06a, bands: 2 }), dragon2: cel({ color: 0x2a7ad8, bands: 2 }), gold: cel({ color: 0xffc23a, bands: 2 }),
      pearl: flat({ color: 0xff5a3a }), wood: cel({ color: 0x8a5a3a, bands: 2 }), cloth: cel({ color: 0xd8282a, bands: 2 }),
      fruit: [cel({ color: 0xff8a2a, bands: 2 }), cel({ color: 0xffd24a, bands: 2 }), cel({ color: 0x8ac83a, bands: 2 })],
      incense: flat({ color: 0xff7a2a }), rope: cel({ color: 0x3a2a24, bands: 2 }),
      lantern: flat({ color: 0xff3a2e }), lanternGold: cel({ color: 0xffc23a, bands: 2 }),
      umbrella: UMBRELLA.map((c) => cel({ color: c, bands: 2 })),
    };

    this.pools = {
      houses: Array.from({ length: 16 }, () => this.makeHouse()),
      temples: Array.from({ length: 4 }, () => this.makeTemple()),
      stalls: Array.from({ length: 14 }, () => this.makeStall()),
      lanterns: Array.from({ length: 6 }, () => this.makeLanterns()),
      petals: Array.from({ length: 14 }, () => this.makePetals()),
      clouds: Array.from({ length: 6 }, () => this.makeSmoke()),
    };
    this.acc = { houses: 0, temples: 0, stalls: 0, lanterns: 0, petals: 0, clouds: 0 };
    this.popKinds = new Set(['houses', 'temples', 'stalls', 'lanterns']);
    for (const k in this.pools) for (const o of this.pools[k]) { o.g.visible = false; o.on = false; this.group.add(o.g); }

    this.theme = THEMES[0];
    this.cur = null; this.target = null;
    this.setTheme(0, true);
  }

  /* ---------------- 物件 ---------------- */
  /** 老街店屋:紅磚 / 白牆 + 灰瓦兩坡屋頂 + 直式招牌(朝街道那一側) */
  makeHouse() {
    const g = new THREE.Group(), S = this.stat, L = rand(3.2, 4.4), D = 4.2;
    put(g, G.box, Math.random() < 0.6 ? S.brick : S.cream, [0, 0, 0.8], [D, L, 1.6]);
    for (const s of [-1, 1]) put(g, G.box, S.tile, [s * D * 0.25, 0, 1.85], [D * 0.56, L + 0.2, 0.12], [0, s * 0.45, 0]);
    put(g, G.box, S.tileDark, [0, 0, 2.05], [0.2, L + 0.25, 0.15]);
    const sign = put(g, G.sign, signMat(pick(SHOPS)), [0, 0, 2.3], 0.9, [0.5, 0, 0]);
    return { g, r: L, z: -GROUND_Z, on: false, pop: 1, sign, D };
  }

  /** 廟:紅牆 + 橘紅琉璃瓦 + 燕尾脊 + 剪黏雙龍搶珠 + 前面的香爐 */
  makeTemple() {
    const g = new THREE.Group(), S = this.stat, L = 6.2, D = 4.6;
    put(g, G.box, S.tempWall, [0, 0, 0.9], [D, L, 1.8]);
    for (const s of [-1, 1]) put(g, G.box, S.tempRoof, [s * D * 0.26, 0, 2.15], [D * 0.62, L + 0.6, 0.15], [0, s * 0.5, 0]);
    put(g, G.box, S.ridge, [0, 0, 2.45], [0.3, L + 0.4, 0.22]);
    for (const e of [-1, 1]) {
      // 燕尾:脊的兩端往外往上翹
      put(g, G.cone8, S.ridge, [0, e * (L / 2 + 0.55), 2.75], [0.16, 1.1, 0.16], [e * -1.1, 0, 0]);
      // 剪黏龍:一節一節彩色的身體,朝中間的寶珠
      for (let i = 0; i < 5; i++) put(g, G.ico, i % 2 ? S.dragon : S.dragon2, [Math.sin(i * 1.3) * 0.18, e * (0.6 + i * 0.42), 2.72 + Math.sin(i * 1.6) * 0.12], [0.16, 0.24, 0.14]);
      put(g, G.ico, S.gold, [0, e * 0.55, 2.85], 0.14);   // 龍頭
    }
    put(g, G.ico, S.pearl, [0, 0, 2.95], 0.22);            // 寶珠
    put(g, G.cyl, S.gold, [0, 0, 3.2], [0.04, 0.3, 0.04], UP);
    const burner = new THREE.Group();                       // 香爐(放在朝街道那一側)
    put(burner, G.cyl, S.gold, [0, 0, 0.4], [0.5, 0.8, 0.5], UP);
    put(burner, G.cyl, S.gold, [0, 0, 0.85], [0.6, 0.1, 0.6], UP);
    for (let i = -1; i <= 1; i++) put(burner, G.cyl, S.incense, [i * 0.18, 0, 1.1], [0.02, 0.5, 0.02], UP);
    g.add(burner);
    return { g, r: L, z: -GROUND_Z, on: false, pop: 1, burner, D };
  }

  /** 攤販(陽傘 + 攤子 + 貨)或供桌(紅桌巾 + 水果 + 香) */
  makeStall() {
    const g = new THREE.Group(), S = this.stat;
    if (Math.random() < 0.6) {
      put(g, G.box, S.wood, [0, 0, 0.35], [1.2, 0.8, 0.7]);
      for (let i = 0; i < 4; i++) put(g, G.ico, pick(S.fruit), [rand(-0.4, 0.4), rand(-0.25, 0.25), 0.8], 0.14);
      put(g, G.cyl, S.wood, [0.3, 0.2, 1.1], [0.03, 1.6, 0.03], UP);
      put(g, G.cone8, pick(S.umbrella), [0.3, 0.2, 1.95], [1.2, 0.4, 1.2], UP);
    } else {
      put(g, G.box, S.cloth, [0, 0, 0.35], [1.6, 0.8, 0.7]);
      put(g, G.box, S.gold, [0, -0.41, 0.45], [1.6, 0.02, 0.18]);
      for (let i = 0; i < 3; i++) put(g, G.ico, pick(S.fruit), [-0.5 + i * 0.5, 0.1, 0.82], [0.2, 0.2, 0.16]);
      for (let i = -1; i <= 1; i++) put(g, G.cyl, S.incense, [i * 0.1, -0.2, 0.95], [0.015, 0.4, 0.015], UP);
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 跨過整條街的一排紅燈籠 */
  makeLanterns() {
    const g = new THREE.Group(), S = this.stat, z = 2.6, n = 7;
    put(g, G.cyl, S.rope, [0, 0, z + 0.45], [0.02, ROAD * 2.6, 0.02], [0, 0, Math.PI / 2]);
    const list = [];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 2.7, l = new THREE.Group();
      put(l, G.ico, S.lantern, [0, 0, 0], [0.46, 0.4, 0.5]);
      put(l, G.cyl, S.lanternGold, [0, 0, 0.48], [0.22, 0.1, 0.22], UP);
      put(l, G.cyl, S.lanternGold, [0, 0, -0.48], [0.22, 0.1, 0.22], UP);
      put(l, G.cyl, S.lanternGold, [0, 0, -0.72], [0.04, 0.36, 0.04], UP);
      put(l, G.box, S.lanternGold, [0, -0.4, 0.05], [0.5, 0.02, 0.06]);
      l.position.set(x, 0, z); g.add(l); list.push(l);
    }
    return { g, r: 1.5, z: -GROUND_Z, on: false, pop: 1, swing: list };
  }

  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 7; i++) {
      const m = put(g, G.petal, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.14, 0.24), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(2, 5) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  makeSmoke() {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) put(g, G.disc, this.mat.smoke, [rand(-3.5, 3.5), rand(-2, 2), i * 0.02], [rand(1.6, 3.2), rand(1.2, 2.2), 1]);
    return { g, r: 6, z: rand(2, 4), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), road: Cl(t.road), grout: Cl(t.grout), petal: Cl(t.petal), cloud: Cl(t.cloud),
      key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi), side: { town: 0, paddy: 1, harbor: 2 }[t.side],
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'road', 'grout', 'petal', 'cloud', 'key', 'hemi']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k;
    c.side = T.side; // 地面種類直接切(換關時有曲速捲動,看不出來)
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uRoad.value.copy(c.road); U.uGrout.value.copy(c.grout);
    U.uPetal.value.copy(c.petal); U.uSide.value = c.side;
    this.mat.petal.color.copy(c.petal); this.mat.smoke.color.copy(c.cloud);
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
    const f = this.frame(-o.z), side = Math.random() < 0.5 ? -1 : 1;
    let x;
    if (kind === 'houses' || kind === 'temples') {
      // 兩側:朝街道那一面在內側(招牌 / 香爐放在內側)
      x = side * (ROAD + 1.2 + o.D / 2 + rand(0, 0.8));
      if (this.theme.side !== 'town' && kind === 'houses' && Math.random() < 0.5) x = side * (ROAD + 1.2 + o.D / 2); // 鄉間 / 漁港:房子少一點、貼路邊
      const inner = -side * o.D / 2;
      if (o.sign) { o.sign.position.x = inner * 0.8; }
      if (o.burner) { o.burner.position.set(inner - side * 0.9, 0, 0); }
    } else if (kind === 'stalls') x = side * rand(ROAD - 0.6, ROAD + 0.7);
    else if (kind === 'lanterns') x = 0;
    else x = rand(-1, 1) * (f.hw - o.r * 0.3);
    o.on = true; o.g.visible = true;
    o.g.position.set(x, f.cy + f.hh + o.r, o.z);
    o.g.rotation.z = kind === 'clouds' ? rand(-0.3, 0.3) : 0;
    if (this.popKinds.has(kind)) { o.pop = -1; o.g.scale.set(1, 1, 0.02); }
  }

  step(dy, dt, prime = false) {
    const t = this.theme;
    // 鄉間 / 漁港:兩側的房子少很多
    const town = t.side === 'town' ? 1 : 0.35;
    const rates = { houses: t.houses * 4 * town, temples: t.temples * 4, stalls: t.stalls * 3, lanterns: t.lanterns, petals: t.petals * 1.5, clouds: prime ? 0 : t.clouds };
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
        if (o.pop < 0 && o.g.position.y < f.cy + f.hh * 0.92) o.pop = 0;
        if (o.pop >= 0 && o.pop < 1) {
          o.pop = Math.min(1, o.pop + dt * 1.8);
          o.g.scale.set(1 + (1 - o.pop) * 0.12, 1 + (1 - o.pop) * 0.12, Math.max(0.02, elasticOut(o.pop)));
        }
        if (o.swing) o.swing.forEach((l, i) => { l.rotation.y = Math.sin(this.time * 2 + i) * 0.15; });
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
