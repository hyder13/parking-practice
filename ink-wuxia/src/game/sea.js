import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut, noboriMat } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的水墨江湖(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):宣紙留白為主,淡墨一塊塊暈開(wash),
 *          皴法的短筆觸、江(兩岸濃墨 + 水紋細線)、雪地、荷塘的淡墨水面、魔教的濃墨夜色
 *   地上   竹林 / 松 / 梅(紅點)/ 柳、亭子(往上仰)、石拱橋、小舟、客棧(掛「酒」旗)、山石、荷花、石燈籠、魔教祭壇
 *          —— 捲進畫面時像立體書一樣「啪」地彈起來
 *   空中   竹葉 / 雪 / 花瓣 / 火星、白色的雲霧(留白)
 * 畫面最後會被轉成墨色,這裡的顏色只看亮度,紅色的東西(梅花、酒旗、紅燈籠)才用朱紅。
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
  uniform float uTime, uScroll, uWash, uRiver, uSnow, uLotus, uDark;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  float fbm( vec2 p ) { return noise( p ) * 0.55 + noise( p * 2.1 + 3.7 ) * 0.28 + noise( p * 4.3 + 9.1 ) * 0.17; }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    vec3 c = uSea;
    // 淡墨暈染:大塊的濃淡(邊緣柔柔的,像墨在宣紙上化開)
    float w = fbm( p * 0.045 );
    float wash = smoothstep( 0.52 - uWash * 0.14, 0.72 - uWash * 0.1, w );
    c = mix( c, uFoam, wash * 0.85 );
    c = mix( c, mix( uFoam, uDeep, 0.45 ), smoothstep( 0.72, 0.8, w ) * uWash );
    // 皴法:短短的斜筆觸(乾筆),只在暈染的區域裡
    vec2 g = p * vec2( 1.3, 0.9 );
    vec2 gi = floor( g ), gf = fract( g ) - 0.5;
    float h = hash( gi );
    float stroke = ( 1.0 - smoothstep( 0.015, 0.045, abs( gf.x * 0.8 + gf.y * 0.6 - ( h - 0.5 ) * 0.3 ) ) ) * step( abs( gf.y ), 0.3 );
    c = mix( c, uDeep, stroke * step( 0.72, h ) * wash * 0.55 * ( 1.0 - uSnow * 0.7 ) );
    // 雪地:更多留白,只剩零星的淡墨
    c = mix( c, mix( uSea, vec3( 1.0 ), 0.5 ), uSnow * ( 1.0 - wash * 0.6 ) );
    // 小路:淡淡的一條(兩邊一條細墨線)
    float rx = sin( p.y * 0.03 ) * 5.0 + sin( p.y * 0.011 + 1.3 ) * 3.0;
    float rd = abs( vP.x - rx );
    c = mix( c, uSea * 0.97, 1.0 - smoothstep( 1.1, 1.3, rd ) );
    c = mix( c, uFoam * 0.8, ( 1.0 - smoothstep( 0.0, 0.06, abs( rd - 1.25 ) ) ) * step( 0.35, noise( p * vec2( 0.2, 1.4 ) ) ) * ( 1.0 - uDark ) );
    // 荷塘:淡墨的水面 + 一片片荷葉(圓,中間一點)
    if ( uLotus > 0.01 ) {
      float pond = smoothstep( 0.4, 0.45, fbm( p * 0.03 + 11.0 ) );
      vec3 wc = mix( c, uWater, 0.45 );
      vec2 lq = p * 0.55; vec2 li = floor( lq ), lf = fract( lq ) - 0.5;
      float lh = hash( li + 3.0 );
      vec2 lo = vec2( hash( li + 5.0 ), hash( li + 8.0 ) ) - 0.5;
      float ld = length( lf - lo * 0.3 );
      float leaf = ( 1.0 - smoothstep( 0.19, 0.22, ld ) ) * step( 0.78, lh );
      wc = mix( wc, uDeep * 0.35 + uFoam * 0.65, leaf );
      wc = mix( wc, uFoam, leaf * ( 1.0 - smoothstep( 0.0, 0.03, abs( atan( lf.y - lo.y * 0.3, lf.x - lo.x * 0.3 ) * ld ) ) ) * 0.6 );
      c = mix( c, wc, pond * uLotus );
    }
    // 江:兩岸濃墨的一筆 + 水面留白 + 幾條細細的水紋
    if ( uRiver > 0.01 ) {
      float wx = sin( p.y * 0.018 + 2.0 ) * 7.0 - 3.0;
      float wd = abs( vP.x - wx ), WR = 4.0 * uRiver;
      vec2 wq = vec2( vP.x * 0.7, p.y * 0.45 + sin( vP.x * 0.6 + uTime * 0.8 ) * 0.35 );
      float rip = ( 1.0 - smoothstep( 0.02, 0.06, abs( fract( wq.y ) - 0.5 ) ) ) * step( 0.5, noise( floor( wq ) * vec2( 0.9, 1.3 ) ) );
      vec3 water = mix( uSea * 1.02, uWater, rip * 0.7 );
      float bank = 1.0 - smoothstep( WR - 0.1, WR + 0.5 + noise( p * 0.4 ) * 0.8, wd );
      c = mix( c, uDeep, bank * ( 1.0 - smoothstep( WR - 0.4, WR, wd ) * 0.0 ) * 0.85 * step( WR - 0.05, wd ) );
      c = mix( c, water, 1.0 - smoothstep( WR - 0.05, WR + 0.05, wd ) );
    }
    // 魔教:整片濃墨的夜
    c = mix( c, c * mix( vec3( 1.0 ), uDeep * 2.2, 0.85 ), uDark * ( 0.6 + 0.4 * w ) );
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  disc: new THREE.CircleGeometry(1, 18),
  leaf: new THREE.CircleGeometry(1, 10).scale(0.22, 1, 1),
  arch: new THREE.TorusGeometry(1, 0.22, 6, 16, Math.PI),
};
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LEAN = 0.85;              // 會「立著」的東西(亭子、客棧)往畫面上方仰倒,俯視鏡頭才看得到

const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** 3D 空間裡兩點之間的一根枝條(梅花的枝) */
function branch(parent, mat, a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const m = new THREE.Mesh(G.cyl, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.scale.set(r, L, r);
  m.quaternion.setFromUnitVectors(Y_AXIS, d.normalize());
  parent.add(m); return m;
}
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
        uTime: { value: 0 }, uScroll: { value: 0 }, uWash: { value: 0 }, uRiver: { value: 0 }, uSnow: { value: 0 }, uLotus: { value: 0 }, uDark: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    this.mat = {
      trunk: cel({ color: 0x3a3a3a, bands: 2, cache: false }),
      canopy: cel({ color: 0x2a2a2a, bands: 2, cache: false }),
      canopy2: cel({ color: 0x5a5a5a, bands: 2, cache: false }),
      petal: flat({ color: 0x3a3a3a, side: THREE.DoubleSide, cache: false }),
      dust: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
    };
    const C2 = (color) => cel({ color, bands: 2 });
    this.stat = {
      ink: C2(0x161616), ink2: C2(0x3a3a3a), ink3: C2(0x6a6a6a), paper: C2(0xf0ebe0), wall: C2(0xe8e4da), wood: C2(0x4a4440),
      tile: C2(0x2a2a2c), stone: C2(0xa8a49c), stone2: C2(0x6a6862), red: C2(0xd02a1e), redF: flat({ color: 0xd02a1e }),
      lotus: C2(0xe86a78), leaf: C2(0x3a3a38), fire: flat({ color: 0xd8321e }), lamp: flat({ color: 0xfff4e0 }),
      rock: C2(0x3a3a3a), rock2: C2(0x6a6a68),
    };

    this.pools = {
      trees: Array.from({ length: 44 }, () => this.makeTree()),
      camps: Array.from({ length: 8 }, () => this.makeProp()),
      rocks: Array.from({ length: 26 }, () => this.makeRocks()),
      petals: Array.from({ length: 12 }, () => this.makePetals()),
      clouds: Array.from({ length: 5 }, () => this.makeDust()),
    };
    this.acc = { trees: 0, camps: 0, rocks: 0, petals: 0, clouds: 0 };
    this.popKinds = new Set(['trees', 'camps', 'rocks']);
    for (const k in this.pools) for (const o of this.pools[k]) { o.g.visible = false; o.on = false; this.group.add(o.g); }

    this.theme = THEMES[0];
    this.cur = null; this.target = null;
    this.setTheme(0, true);
  }

  /* ---------------- 物件 ---------------- */
  /** 樹:四種樹形先全部蓋好,出場時依場景只顯示一種(墨色跟著主題變) */
  makeTree() {
    const g = new THREE.Group(), T = this.mat, S = this.stat, s = rand(0.9, 1.5), v = {};
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    // 竹:一叢往上仰的竹竿(一節一節)+ 一撇一撇的竹葉
    let t = add('bamboo');
    const bl = new THREE.Group(); bl.rotation.x = -0.7; t.add(bl);
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 0.28 * s + rand(-0.05, 0.05), h = rand(1.6, 2.4) * s, lean = rand(-0.15, 0.15);
      const st = new THREE.Group(); st.position.set(x, 0, 0); st.rotation.y = lean; bl.add(st);
      put(st, G.cyl, i % 2 ? T.canopy2 : T.trunk, [0, 0, h / 2], [0.045 * s, h, 0.045 * s], UP);
      for (let k = 1; k < 5; k++) put(st, G.cyl, T.canopy, [0, 0, h * k / 5], [0.055 * s, 0.03, 0.055 * s], UP);   // 竹節
      for (let k = 0; k < 4; k++) {
        const a = rand(0, Math.PI * 2);
        put(st, G.leaf, T.canopy, [Math.cos(a) * 0.2 * s, -0.02, h * rand(0.55, 1)], [0.5 * s, 0.5 * s, 1], [Math.PI / 2, 0, a]);
      }
    }
    // 松:歪歪的幹 + 一層層扁扁的松針(工筆的「松」)
    t = add('pine');
    const pl = new THREE.Group(); pl.rotation.x = -0.45; t.add(pl);
    put(pl, G.cyl, T.trunk, [0.1 * s, 0, 0.6 * s], [0.1 * s, 1.2 * s, 0.1 * s], [UP[0], 0.3, 0]);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7, r = (0.25 + i * 0.12) * s;
      put(pl, G.ico, i % 2 ? T.canopy2 : T.canopy, [Math.cos(a) * r, Math.sin(a) * 0.1, (0.7 + i * 0.22) * s], [0.55 * s, 0.35 * s, 0.1 * s], [0, 0, a]);
    }
    // 梅:黑色彎曲的枝 + 朱紅的梅花點點
    t = add('plum');
    const ml = new THREE.Group(); ml.rotation.x = -0.45; t.add(ml);
    const br = [[0, 0, 0, 0.1, 0, 0.8], [0.1, 0, 0.8, -0.4, 0, 1.3], [0.1, 0, 0.8, 0.5, 0, 1.2], [-0.4, 0, 1.3, -0.6, 0, 1.6], [0.5, 0, 1.2, 0.8, 0, 1.4]];
    for (const [x0, y0, z0, x1, y1, z1] of br) branch(ml, T.trunk, [x0 * s, y0, z0 * s], [x1 * s, y1, z1 * s], 0.05 * s);
    for (let i = 0; i < 12; i++) put(ml, G.ico, S.red, [rand(-0.8, 0.9) * s, rand(-0.15, 0.1), rand(0.9, 1.7) * s], 0.07 * s);
    // 柳:幹 + 垂下來的柳條
    t = add('willow');
    const wl = new THREE.Group(); wl.rotation.x = -0.45; t.add(wl);
    put(wl, G.cyl, T.trunk, [0, 0, 0.6 * s], [0.12 * s, 1.2 * s, 0.12 * s], UP);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, r = 0.5 * s;
      put(wl, G.box, i % 2 ? T.canopy : T.canopy2, [Math.cos(a) * r, Math.sin(a) * r * 0.4, 0.95 * s], [0.04 * s, 0.04 * s, 0.9 * s], [0, 0, 0]);
    }
    put(wl, G.ico, T.canopy2, [0, 0, 1.35 * s], [0.6 * s, 0.4 * s, 0.2 * s]);
    return { g, r: 1.8 * s, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 大物件:八種先全部蓋好,出場時依場景(THEMES.props)只顯示一種;仰倒的用 scale.y 出場 */
  makeProp() {
    const g = new THREE.Group(), S = this.stat, v = {}, fires = [], flags = [];
    const add = (k, lean) => { v[k] = new THREE.Group(); v[k].visible = false; v[k].userData.lean = lean; g.add(v[k]); return v[k]; };
    // 亭子:四根柱 + 翹起來的尖屋頂(往上仰)
    let t = add('pavilion', true);
    let c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    put(c, G.box, S.stone, [0, 0, 0.1], [2.4, 2.4, 0.2]);
    for (const [x, y] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) put(c, G.cyl, S.red, [x, y, 0.8], [0.08, 1.4, 0.08], UP);
    put(c, G.cone4, S.tile, [0, 0, 1.95], [2.1, 1.0, 2.1], [UP[0], Math.PI / 4, 0]);
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(c, G.cone6, S.tile, [x * 1.35, y * 1.35, 1.55], [0.1, 0.5, 0.1], [0, 0, 0]).rotation.set(0.9 * y, 0, -0.9 * x); // 翹角
    put(c, G.ico, S.ink, [0, 0, 2.5], 0.12);
    // 石拱橋:半圓的拱 + 橋面欄杆
    t = add('bridge', false);
    const bw = new THREE.Group(); bw.rotation.z = Math.PI / 2; t.add(bw);
    put(t, G.arch, S.stone, [0, 0, 0], [1.6, 1.0, 2.6], [Math.PI / 2, 0, Math.PI / 2]);
    for (const x of [-1, 1]) for (let i = 0; i < 5; i++) put(t, G.box, S.stone2, [x * 0.6, -1.3 + i * 0.65, 1.0 + Math.sin(i / 4 * Math.PI) * 0.4], [0.08, 0.08, 0.4]);
    // 小舟:細長的船身 + 船篷 + 撐篙的人
    t = add('boat', false);
    put(t, G.ico2, S.wood, [0, 0, 0.15], [0.55, 1.8, 0.28]);
    put(t, G.ico2, S.ink2, [0, 0.2, 0.3], [0.45, 0.6, 0.35]);
    put(t, G.ico2, S.paper, [0, -1.0, 0.6], [0.12, 0.12, 0.25]);
    put(t, G.cone6, S.ink3, [0, -1.0, 0.85], [0.28, 0.12, 0.28], UP);
    put(t, G.cyl, S.ink, [0.3, -1.0, 0.6], [0.02, 2.0, 0.02], [0.2, 0, 0]);
    // 客棧:兩層樓 + 瓦頂 + 紅燈籠 + 「酒」旗(往上仰)
    t = add('inn', true);
    c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    put(c, G.box, S.wall, [0, 0, 0.8], [3.0, 2.0, 1.6]);
    put(c, G.box, S.tile, [0, 0, 1.75], [3.5, 2.5, 0.25]);
    put(c, G.box, S.wall, [0, 0, 2.3], [2.4, 1.6, 0.9]);
    put(c, G.cone4, S.tile, [0, 0, 3.1], [2.1, 0.7, 1.6], [UP[0], Math.PI / 4, 0]);
    for (const x of [-0.9, 0, 0.9]) put(c, G.box, S.ink2, [x, -1.01, 0.8], [0.5, 0.02, 1.0]);
    for (let i = 0; i < 4; i++) put(c, G.box, S.wood, [-0.9 + i * 0.6, -0.81, 2.35], [0.35, 0.02, 0.45]);
    for (const x of [-1.2, 1.2]) put(c, G.ico2, S.redF, [x, -1.1, 1.45], [0.16, 0.16, 0.22]);            // 紅燈籠
    const flagInfo = noboriMat('酒', '#d02a1e', '#f4f0e6');
    put(c, G.cyl, S.wood, [1.7, -0.6, 1.6], [0.03, 3.2, 0.03], UP);
    flags.push(put(c, new THREE.PlaneGeometry(0.6 * flagInfo.aspect * 1.6, 0.96).translate(0.3 * flagInfo.aspect * 1.6, -0.48, 0), flagInfo.mat, [1.72, -0.62, 3.0], 1, [Math.PI / 2, 0, 0]));
    // 山石:幾塊疊在一起的濃墨石頭(皴紋)
    t = add('rocks', false);
    for (let i = 0; i < 4; i++) {
      const s = rand(0.7, 1.3);
      put(t, G.ico0, i % 2 ? S.rock : S.rock2, [rand(-1.2, 1.2), rand(-0.8, 0.8), s * 0.5], [s, s * rand(0.6, 1), s * rand(0.7, 1.2)], [Math.random(), Math.random(), Math.random() * 3]);
    }
    // 荷花:幾片大荷葉 + 兩朵粉紅荷花
    t = add('lotus', false);
    for (let i = 0; i < 5; i++) put(t, G.disc, S.leaf, [rand(-1.4, 1.4), rand(-1.0, 1.0), 0.06 + i * 0.01], rand(0.4, 0.7));
    for (let i = 0; i < 2; i++) {
      const x = rand(-1, 1), y = rand(-0.7, 0.7);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; put(t, G.leaf, S.lotus, [x + Math.cos(a) * 0.12, y + Math.sin(a) * 0.12, 0.3], [0.9, 0.9, 1], [0.8 * Math.sin(a), -0.8 * Math.cos(a), a - Math.PI / 2]); }
      put(t, G.ico, S.red, [x, y, 0.32], 0.06);
    }
    // 石燈籠:台座 + 燈室(亮)+ 屋頂
    t = add('lantern', false);
    for (const x of [-1.2, 1.2]) {
      put(t, G.cyl, S.stone, [x, 0, 0.4], [0.12, 0.8, 0.12], UP);
      put(t, G.box, S.stone2, [x, 0, 0.9], [0.4, 0.4, 0.3]);
      put(t, G.box, S.lamp, [x, 0, 0.9], [0.42, 0.2, 0.18]);
      put(t, G.cone4, S.tile, [x, 0, 1.2], [0.4, 0.3, 0.4], [UP[0], Math.PI / 4, 0]);
    }
    // 魔教祭壇:黑色高台 + 紅旗 + 火盆
    t = add('shrine', false);
    put(t, G.box, S.ink, [0, 0, 0.3], [2.6, 2.0, 0.6]);
    put(t, G.box, S.ink2, [0, 0, 0.7], [1.6, 1.2, 0.3]);
    for (const x of [-1, 1]) {
      put(t, G.cyl, S.stone2, [x * 1.0, -0.6, 0.9], [0.25, 0.4, 0.25], UP);
      const f = put(t, G.cone6, S.fire, [x * 1.0, -0.6, 1.4], [0.22, 0.7, 0.22], UP); f.userData.base = 1; fires.push(f);
      put(t, G.cyl, S.wood, [x * 1.2, 0.8, 1.2], [0.03, 2.4, 0.03], UP);
      flags.push(put(t, new THREE.PlaneGeometry(0.5, 1.2).translate(0.25, -0.6, 0), S.redF, [x * 1.2, 0.8, 2.3], 1, [Math.PI / 2 - 0.4, 0, 0]));
    }
    return { g, r: 3.2, z: -GROUND_Z, on: false, pop: 1, v, fires, flags };
  }

  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = rand(0.3, 0.7);
      put(g, G.ico0, i % 2 ? this.stat.rock2 : this.stat.rock, [rand(-0.8, 0.8), rand(-0.6, 0.6), s * 0.4], [s, s * rand(0.7, 1), s * 0.6], [Math.random(), Math.random(), Math.random() * 3]);
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 飄落的竹葉 / 雪 / 花瓣 / 火星(顏色跟著主題) */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const m = put(g, G.leaf, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.25, 0.4), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  /** 雲霧:一條條白色的霧(水墨畫的留白) */
  makeDust() {
    const g = new THREE.Group();
    for (let i = 0; i < 4; i++) put(g, G.disc, this.mat.dust, [(i - 1.5) * 1.8 + rand(-0.3, 0.3), rand(-0.3, 0.3), i * 0.02], [rand(2.2, 3.2), rand(0.5, 0.8), 1]);
    return { g, r: 7, z: rand(3, 5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), cloud: Cl(t.cloud), key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal),
      wash: t.wash, river: t.river, snow: t.snow, lotus: t.lotus, dark: t.dark,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'cloud', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    for (const key of ['keyI', 'wash', 'river', 'snow', 'lotus', 'dark']) c[key] += (T[key] - c[key]) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.petal);
    U.uWash.value = c.wash; U.uRiver.value = c.river; U.uSnow.value = c.snow; U.uLotus.value = c.lotus; U.uDark.value = c.dark;
    const M = this.mat;
    M.trunk.color.copy(c.trunk); M.canopy.color.copy(c.canopy); M.canopy2.color.copy(c.canopy2);
    M.petal.color.copy(c.petal); M.dust.color.copy(c.cloud);
    if (this.lights) {
      this.lights.key.color.copy(c.key); this.lights.key.intensity = c.keyI;
      this.lights.hemi.color.copy(c.hemi);
    }
  }
  get clearColor() { return this.cur.sea; }

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
    o.g.rotation.z = kind === 'camps' ? (o.lean ? rand(-0.06, 0.06) : rand(-0.4, 0.4)) : kind === 'trees' ? rand(-0.2, 0.2) : kind === 'clouds' ? rand(-0.15, 0.15) : Math.random() * 6;
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
        if (o.flags) o.flags.forEach((fl, i) => { fl.rotation.y = Math.sin(this.time * 3 + i + o.g.position.x) * 0.25; });
        if (o.fires && o.want === 'shrine') o.fires.forEach((fi, i) => { fi.scale.y = 0.7 * (0.8 + 0.3 * Math.sin(this.time * 12 + i * 2.3)); });
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
