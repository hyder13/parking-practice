import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut, signTex } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的卡通世界(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):像當年水彩背景的斑駁灰階 + 小路,
 *          小鎮是石板街、港口有一條河、夢境是雲海
 *   地上   會跳舞的樹(有臉)、枯樹、小屋(窗戶是眼睛)、穀倉、乾草堆、馬戲團帳篷、墓碑、碼頭小船
 *          —— 捲進畫面時像立體書一樣「啪」地彈起來,之後跟著爵士樂的拍子一起蹦(橡皮管卡通的招牌)
 *   空中   飄來飄去的音符 / 星星、白色的雲團
 * 畫面最後會被轉成黑白,這裡的顏色只看亮度。
 * ------------------------------------------------------------------ */

export const SEA_Z = GROUND_Z;
const BASE_SPEED = 5;
const BEAT = 2.1; // 每秒幾拍(背景跳舞的節奏)

const SEA_VS = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4( position, 1.0 );
    vP = w.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SEA_FS = /* glsl */ `
  uniform vec3 uDeep, uSea, uFoam, uWater, uFlower;
  uniform float uTime, uScroll, uRiver, uPave, uCloud;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    // 水彩背景的斑駁:大塊的濃淡 + 細細的筆刷紋
    float n = noise( p * 0.05 ) * 0.6 + noise( p * 0.14 + 3.1 ) * 0.3 + noise( p * vec2( 0.9, 0.3 ) ) * 0.1;
    vec3 c = mix( uDeep, uSea, smoothstep( 0.35, 0.65, n ) );
    // 小草 / 小點(卡通背景常見的短短筆觸)
    vec2 g = floor( p * vec2( 1.1, 1.6 ) ), f = fract( p * vec2( 1.1, 1.6 ) ) - 0.5;
    float h = hash( g );
    vec2 o = vec2( hash( g + 7.0 ), hash( g + 13.0 ) ) - 0.5;
    vec2 d2 = f - o * 0.5;
    float tick = ( 1.0 - smoothstep( 0.02, 0.05, abs( d2.x + d2.y * 0.3 ) ) ) * step( abs( d2.y ), 0.18 );
    c = mix( c, uDeep * 0.72, step( 0.8, h ) * tick * ( 1.0 - uCloud ) );
    c = mix( c, uFlower, step( 0.975, h ) * ( 1.0 - smoothstep( 0.06, 0.1, length( d2 ) ) ) );
    // 小路:沿著 y 蜿蜒;小鎮是石板街(寬、一格一格的石板)
    float rx = sin( p.y * 0.03 ) * 5.0 + sin( p.y * 0.011 + 1.3 ) * 3.0;
    float rd = abs( vP.x - rx );
    float W = mix( 1.5, 2.4, uPave );
    c = mix( c, uFoam * 0.72, ( 1.0 - smoothstep( W + 0.1, W + 0.3, rd ) ) * ( 1.0 - uCloud ) );
    vec3 road = uFoam;
    if ( uPave > 0.5 ) {
      vec2 q = vec2( vP.x - rx, p.y ) * vec2( 1.3, 1.0 );
      q.x += step( 1.0, mod( floor( q.y ), 2.0 ) ) * 0.5;
      vec2 fq = abs( fract( q ) - 0.5 );
      float mortar = 1.0 - smoothstep( 0.4, 0.46, max( fq.x, fq.y ) );
      road = mix( uFoam * 0.78, uFoam * ( 0.9 + hash( floor( q ) ) * 0.1 ), mortar );
    }
    c = mix( c, road, ( 1.0 - smoothstep( W - 0.1, W, rd ) ) * ( 1.0 - uCloud ) );
    // 雲海(夢境):一團一團的白雲,邊緣一圈深一點
    if ( uCloud > 0.01 ) {
      float cl = noise( p * 0.12 + vec2( uTime * 0.05, 0.0 ) ) * 0.7 + noise( p * 0.35 ) * 0.3;
      vec3 cc = mix( uSea, uFoam, smoothstep( 0.5, 0.56, cl ) );
      cc = mix( cc, uDeep, ( 1.0 - smoothstep( 0.0, 0.03, abs( cl - 0.5 ) ) ) * 0.6 );
      c = mix( c, cc, uCloud );
    }
    // 河:兩岸一條深色描邊 + 卡通的水波紋(一段一段的橫線)
    if ( uRiver > 0.01 ) {
      float wx = sin( p.y * 0.018 + 2.0 ) * 7.0 - 3.0;
      float wd = abs( vP.x - wx ), WR = 4.0 * uRiver;
      vec2 wq = vec2( vP.x * 0.8, p.y * 1.6 + sin( vP.x * 0.9 + uTime * 2.0 ) * 0.3 );
      float wave = ( 1.0 - smoothstep( 0.04, 0.1, abs( fract( wq.y ) - 0.5 ) ) ) * step( 0.55, noise( wq * vec2( 0.8, 0.4 ) ) );
      vec3 water = mix( uWater, vec3( 0.95 ), wave * 0.6 );
      c = mix( c, uWater * 0.4, 1.0 - smoothstep( WR + 0.15, WR + 0.3, wd ) );
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
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  disc: new THREE.CircleGeometry(1, 18),
  pie: new THREE.CircleGeometry(1, 16, 1.15, Math.PI * 2 - 0.85),
  half: new THREE.TorusGeometry(1, 0.14, 5, 12, Math.PI),
  note: noteShape(),
  star: starShape(),
};
function noteShape() {
  const s = new THREE.Shape();
  s.absellipse(0, 0, 0.3, 0.22, 0, Math.PI * 2, false, 0.4);
  const g1 = new THREE.ShapeGeometry(s);
  const g2 = new THREE.PlaneGeometry(0.08, 0.9).translate(0.26, 0.45, 0);
  const g3 = new THREE.PlaneGeometry(0.35, 0.1).rotateZ(-0.5).translate(0.4, 0.8, 0);
  const pos = [g1, g2, g3].map((g) => g.toNonIndexed().attributes.position.array);
  const all = new Float32Array(pos.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of pos) { all.set(p, o); o += p.length; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(all, 3));
  return g;
}
function starShape() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.42 : 1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ShapeGeometry(s);
}
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LEAN = 0.85; // 會「立著」的東西(房子、墓碑…)往畫面上方仰倒,俯視鏡頭才看得到正面

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
        uTime: { value: 0 }, uScroll: { value: 0 }, uRiver: { value: 0 }, uPave: { value: 0 }, uCloud: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    this.mat = {
      trunk: cel({ color: 0x3a3630, bands: 2, cache: false }),
      canopy: cel({ color: 0x8a8a7a, bands: 2, cache: false }),
      canopy2: cel({ color: 0x6e6e60, bands: 2, cache: false }),
      petal: flat({ color: 0xf8f4ea, side: THREE.DoubleSide, cache: false }),
      dust: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
    };
    const C2 = (color) => cel({ color, bands: 2 });
    this.stat = {
      black: C2(0x24221e), white: C2(0xf4f0e8), cream: C2(0xe8dcc8), gray: C2(0x8a847a), gray2: C2(0x5a564e), light: C2(0xc8c2b6),
      eye: flat({ color: 0x141210 }), eyeW: flat({ color: 0xfffcf4 }), win: flat({ color: 0xf8f0d8 }),
      hay: C2(0xd8ccaa), hay2: C2(0xb8aa88), stone: C2(0xa8a498), stone2: C2(0x7a766e), wood: C2(0x6a6258),
      rock: C2(0x9a968a), rock2: C2(0x7a766c),
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
  /** 臉:派切眼 + 笑嘴(樹 / 房子都有),在 parent 的 XZ 平面上(臉朝 -y = 朝畫面下方的鏡頭) */
  face(parent, x, y, z, s, happy = true) {
    const S = this.stat;
    for (const k of [-1, 1]) {
      put(parent, G.ico, S.eyeW, [x + k * 0.16 * s, y, z + 0.1 * s], [0.1 * s, 0.05 * s, 0.14 * s]);
      put(parent, G.pie, S.eye, [x + k * 0.16 * s + 0.02 * s, y - 0.055 * s, z + 0.07 * s], [0.06 * s, 0.09 * s, 1], [Math.PI / 2, 0, 0]);
    }
    put(parent, G.half, S.eye, [x, y - 0.03 * s, z - 0.14 * s], [0.18 * s, 0.14 * s, 0.4], happy ? [Math.PI / 2, 0, Math.PI] : [Math.PI / 2, 0, 0]);
  }

  /** 樹:四種樹形先全部蓋好,出場時依場景只顯示一種(顏色跟著主題變) */
  makeTree() {
    const g = new THREE.Group(), T = this.mat, s = rand(1.1, 1.7), v = {};
    const add = (k) => { v[k] = new THREE.Group(); v[k].visible = false; g.add(v[k]); return v[k]; };
    let t = add('round');                                                                                     // 會跳舞的圓樹:彎彎的幹 + 一大團樹冠 + 臉
    const lt = new THREE.Group(); lt.rotation.x = -0.45; t.add(lt);
    put(lt, G.cyl, T.trunk, [0, 0, 0.4 * s], [0.13 * s, 0.8 * s, 0.13 * s], UP);
    put(lt, G.ico2, T.canopy, [0, 0, 1.15 * s], [0.7 * s, 0.6 * s, 0.6 * s]);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; put(lt, G.ico2, T.canopy2, [Math.cos(a) * 0.5 * s, Math.sin(a) * 0.4 * s, 1.05 * s], 0.32 * s); }
    this.face(lt, 0, -0.6 * s, 1.15 * s, s * 1.4);
    t = add('dead');                                                                                          // 枯樹:扭曲的幹 + 爪子一樣的枝
    const dt = new THREE.Group(); dt.rotation.x = -0.45; t.add(dt);
    put(dt, G.cone6, T.trunk, [0, 0, 0.7 * s], [0.26 * s, 1.5 * s, 0.26 * s], UP);
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.6;
      put(dt, G.cone6, T.trunk, [Math.cos(a) * 0.3 * s, Math.sin(a) * 0.2 * s, (0.9 + i * 0.12) * s], [0.08 * s, 0.8 * s, 0.08 * s], [Math.PI / 2 + Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9]);
    }
    // 樹幹上的洞 = 一張嚇人的臉
    for (const k of [-1, 1]) put(dt, G.ico, this.stat.eyeW, [k * 0.07 * s, -0.16 * s, 0.85 * s], [0.04 * s, 0.03 * s, 0.05 * s]);
    put(dt, G.ico, this.stat.eye, [0, -0.17 * s, 0.62 * s], [0.06 * s, 0.03 * s, 0.08 * s]);
    t = add('pine');                                                                                          // 松:三層圓錐
    put(t, G.cyl, T.trunk, [0, 0, 0.25 * s], [0.08 * s, 0.5 * s, 0.08 * s], UP);
    for (let i = 0; i < 3; i++) put(t, G.cone6, i % 2 ? T.canopy2 : T.canopy, [0, 0, (0.7 + i * 0.4) * s], [(0.6 - i * 0.14) * s, 0.6 * s, (0.6 - i * 0.14) * s], UP);
    t = add('puff');                                                                                          // 雲朵樹(夢境):三團白雲疊在細枝上
    put(t, G.cyl, T.trunk, [0, 0, 0.4 * s], [0.05 * s, 0.8 * s, 0.05 * s], UP);
    for (let i = 0; i < 3; i++) put(t, G.ico2, i % 2 ? T.canopy2 : T.canopy, [(i - 1) * 0.35 * s, 0, (0.95 + (i % 2) * 0.2) * s], [0.42 * s, 0.36 * s, 0.32 * s]);
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1, v, dance: 1 };
  }

  /** 大物件:六種先全部蓋好,出場時依場景(THEMES.props)只顯示一種;仰倒的用 scale.y 出場 */
  makeProp() {
    const g0 = new THREE.Group(), g = new THREE.Group(), S = this.stat, v = {};
    g.scale.setScalar(1.45); g0.add(g); // 卡通的房子要大大的才看得到臉
    const add = (k, lean) => { v[k] = new THREE.Group(); v[k].visible = false; v[k].userData.lean = lean; g.add(v[k]); return v[k]; };
    // 小屋:歪歪的牆 + 三角屋頂 + 窗戶是兩隻眼睛、門是嘴 + 歪煙囪
    let t = add('house', true);
    let c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    put(c, G.box, S.white, [0, 0, 0.9], [2.4, 1.6, 1.8], [0, 0.06, 0]);
    put(c, G.cone6, S.gray2, [0, 0, 2.35], [1.9, 1.3, 1.25], [Math.PI / 2, Math.PI / 4, 0]);
    put(c, G.box, S.black, [0.7, 0.2, 2.6], [0.28, 0.28, 0.9], [0, 0.25, 0]);
    for (const k of [-1, 1]) {
      put(c, G.box, S.win, [k * 0.55, -0.81, 1.2], [0.5, 0.02, 0.6]);
      put(c, G.pie, S.eye, [k * 0.55 + 0.05, -0.83, 1.12], [0.16, 0.22, 1], [Math.PI / 2, 0, 0]);
      put(c, G.box, S.black, [k * 0.55, -0.83, 1.55], [0.6, 0.03, 0.08]);
    }
    put(c, G.box, S.black, [0, -0.81, 0.4], [0.5, 0.02, 0.8]);
    put(c, G.box, S.gray, [0, -1.1, 0.04], [1.0, 0.6, 0.08]);
    // 穀倉:大紅穀倉(黑白版是深灰)+ 白色 X 門 + 尖屋頂
    t = add('barn', true);
    c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    put(c, G.box, S.gray2, [0, 0, 1.0], [2.8, 2.0, 2.0]);
    for (const k of [-1, 1]) put(c, G.box, S.black, [k * 0.8, 0, 2.3], [1.6, 2.1, 0.14], [0, k * 0.6, 0]);
    put(c, G.box, S.white, [0, -1.01, 0.6], [1.2, 0.02, 1.2]);
    for (const k of [-1, 1]) put(c, G.box, S.gray2, [0, -1.03, 0.6], [1.5, 0.02, 0.12], [0, k * 0.78, 0]);
    put(c, G.box, S.white, [0, -1.01, 1.7], [0.5, 0.02, 0.4]);
    // 乾草堆:圓圓的一堆 + 插著一支叉子
    t = add('hay', false);
    for (let i = 0; i < 3; i++) put(t, G.ico2, i ? S.hay2 : S.hay, [(i - 1) * 0.8, rand(-0.3, 0.3), 0.45], [0.9, 0.8, 0.7 - i * 0.05]);
    put(t, G.cyl, S.wood, [0.3, 0, 1.0], [0.04, 1.4, 0.04], [Math.PI / 2 - 0.4, 0, 0.3]);
    // 馬戲團帳篷:一圈黑白條紋 + 尖頂 + 小旗
    t = add('tent', false);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      put(t, G.box, i % 2 ? S.black : S.white, [Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0.6], [0.84, 0.1, 1.2], [0, 0, a + Math.PI / 2]);
    }
    put(t, G.cone12, S.white, [0, 0, 1.8], [1.95, 1.4, 1.95], UP);
    for (let i = 0; i < 6; i++) put(t, G.box, S.black, [Math.cos(i / 6 * Math.PI * 2) * 0.95, Math.sin(i / 6 * Math.PI * 2) * 0.95, 1.8], [0.14, 0.14, 1.5], [0, 0.95 * Math.cos(i / 6 * Math.PI * 2 + Math.PI / 2), 0]);
    put(t, G.cyl, S.black, [0, 0, 2.8], [0.04, 0.8, 0.04], UP);
    put(t, G.box, S.white, [0.22, 0, 3.05], [0.4, 0.02, 0.25]);
    // 墓碑:三四塊歪歪的圓頭墓碑(往上仰)+ RIP
    t = add('tombs', true);
    c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c);
    for (let i = 0; i < 4; i++) {
      const x = -1.5 + i * 1.0 + rand(-0.15, 0.15), h = rand(0.8, 1.2);
      const st = new THREE.Group(); st.position.set(x, rand(-0.3, 0.3), 0); st.rotation.y = rand(-0.25, 0.25); c.add(st);
      put(st, G.box, i % 2 ? S.stone2 : S.stone, [0, 0, h / 2], [0.7, 0.24, h]);
      put(st, G.cyl, i % 2 ? S.stone2 : S.stone, [0, 0, h], [0.35, 0.24, 0.35]);
      const lab = put(st, new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: signTex('RIP', null, '#2a2824', 128, 64), transparent: true }), [0, -0.13, h * 0.7], 1, [Math.PI / 2, 0, 0]);
      lab.renderOrder = 1;
    }
    // 碼頭:木棧板 + 一條小船(船頭有眼睛)
    t = add('boat', false);
    put(t, G.box, S.wood, [-0.8, 0, 0.3], [0.9, 3.2, 0.14]);
    for (let i = 0; i < 4; i++) put(t, G.box, S.gray2, [-0.8, -1.4 + i * 0.95, 0.3], [0.94, 0.04, 0.16]);
    for (const y of [-1.4, 1.4]) put(t, G.cyl, S.black, [-1.25, y, 0.3], [0.08, 0.7, 0.08], UP);
    const boat = new THREE.Group(); boat.position.set(0.8, 0, 0.25); t.add(boat);
    put(boat, G.ico2, S.white, [0, 0, 0], [0.6, 1.4, 0.35]);
    put(boat, G.ico2, S.gray2, [0, 0, 0.18], [0.46, 1.2, 0.12]);
    put(boat, G.cyl, S.black, [0, 0.2, 1.0], [0.04, 1.8, 0.04], UP);
    put(boat, G.cone6, S.white, [0.25, 0.2, 1.1], [0.02, 1.2, 0.5], [UP[0], 0, 0]);
    for (const k of [-1, 1]) put(boat, G.pie, S.eye, [k * 0.18, -1.3, 0.2], [0.07, 0.1, 1], [Math.PI / 2, 0, 0]);
    return { g: g0, r: 4.6, z: -GROUND_Z, on: false, pop: 1, v, dance: 0.5 };
  }

  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = rand(0.35, 0.8);
      put(g, G.ico, i % 2 ? this.stat.rock2 : this.stat.rock, [rand(-0.8, 0.8), rand(-0.6, 0.6), s * 0.4], [s, s * rand(0.7, 1), s * 0.6], [Math.random(), Math.random(), Math.random() * 3]);
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 飄在空中的星星 / 小圓點(不用音符:音符是玩家的子彈,背景不要跟它搶) */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 5; i++) {
      const m = put(g, i % 2 ? G.star : G.disc, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], i % 2 ? rand(0.3, 0.5) : rand(0.1, 0.18), [rand(-0.3, 0.3), 0, rand(-0.5, 0.5)]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  /** 白色的卡通雲團(一坨一坨) */
  makeDust() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) put(g, G.disc, this.mat.dust, [(i - 2) * 1.1 + rand(-0.3, 0.3), rand(-0.4, 0.4), i * 0.02], rand(0.9, 1.4));
    return { g, r: 7, z: rand(3, 5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), cloud: Cl(t.cloud), key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal), river: t.river, pave: t.pave, cloudy: t.cloudy,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'cloud', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    for (const key of ['keyI', 'river', 'pave', 'cloudy']) c[key] += (T[key] - c[key]) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.petal); U.uRiver.value = c.river; U.uPave.value = c.pave; U.uCloud.value = c.cloudy;
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
    }
    o.ph = Math.random() < 0.5 ? 0 : Math.PI; // 一半的東西反拍(卡通背景一左一右地晃)
    o.g.rotation.z = kind === 'camps' ? (o.lean ? rand(-0.08, 0.08) : rand(-0.3, 0.3)) : kind === 'trees' ? rand(-0.15, 0.15) : kind === 'clouds' ? rand(-0.3, 0.3) : Math.random() * 6;
    o.rz = o.g.rotation.z;
    if (this.popKinds.has(kind)) { o.pop = -1; if (o.lean) o.g.scale.set(1, 0.02, 1); else o.g.scale.set(1, 1, 0.02); }
  }

  step(dy, dt, prime = false) {
    const t = this.theme;
    // 地面就在腳下,可視範圍小 → 密度要比高空版高很多
    const rates = { trees: t.trees * 5, camps: t.camps * 2.5, rocks: t.rocks * 4, petals: t.petals * 1.5, clouds: prime ? 0 : t.clouds };
    const beat = this.time * BEAT * Math.PI * 2;
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
        } else if (o.dance && o.pop >= 1) {
          // 跟著拍子跳舞:往下壓一下再彈起來 + 左右晃
          const b = Math.abs(Math.sin(beat / 2 + o.ph / 2));
          const sq = 1 - (1 - b) * 0.12 * o.dance, st = 1 + (1 - b) * 0.06 * o.dance;
          if (o.lean) o.g.scale.set(st, sq, 1); else o.g.scale.set(st, st, sq);
          o.g.rotation.z = o.rz + Math.sin(beat / 2 + o.ph) * 0.08 * o.dance;
        }
        if (o.list) for (const p of o.list) {
          p.m.rotation.z = Math.sin(this.time * 2 + p.sp * 3) * 0.4;
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
