import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { GROUND_Z, elasticOut } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的蒸汽城市(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):
 *          城市 = 一格一格的街區,每棟一種屋頂(石板 / 紅磚瓦 / 綠銅),斜屋頂一半亮一半暗、有瓦片的橫紋、
 *          黑黑的煙囪口、偶爾亮著的天窗;街道是石板路,路口有煤氣燈的光;
 *          郊外(city 小)= 荒地 / 煤渣地;鐵軌(碎石路基 + 兩條亮亮的鐵軌 + 枕木)一路穿過去;運河(紅磚岸)
 *   地上   公園樹 / 煤氣路燈 / 蒸汽管、工廠(兩根大煙囪冒煙)、鐘樓、儲氣槽、蒸汽幫浦(大飛輪會轉)、起重機、水塔、鐵要塞
 *          —— 立著的東西往畫面上方仰倒;捲進畫面時像立體書一樣「啪」地彈起來
 *   空中   火星、一團團蒸汽
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
  uniform float uTime, uScroll, uRiver, uCity;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  float roadX( float y ) { return sin( y * 0.021 ) * 4.0 + sin( y * 0.009 + 1.3 ) * 3.0 + 2.0; }
  float riverX( float y ) { return sin( y * 0.016 + 2.0 ) * 6.0 - 4.0; }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    const float B = 9.0, ST = 1.7;
    vec2 cell = floor( p / B ), f = p - cell * B;
    float hc = hash( cell + 7.3 );
    float isCity = step( hc, uCity );
    vec3 col;
    // ---- 郊外:荒地 / 煤渣地(一塊塊的顏色 + 小石子)
    float n = noise( p * 0.12 ) * 0.6 + noise( p * 0.5 ) * 0.3 + noise( p * 2.0 ) * 0.1;
    vec3 wild = n < 0.42 ? uDeep : n < 0.58 ? uSea : uFoam;
    wild *= 0.85 + noise( p * 4.0 ) * 0.25;
    wild = mix( wild, wild * 0.6, step( 0.93, hash( floor( p * 3.0 ) ) ) );
    // ---- 城市:街道(石板路)+ 屋頂
    float street = max( step( f.x, ST ), step( f.y, ST ) );
    vec2 sq = floor( p * 2.6 );
    vec3 cob = uWater * ( 0.8 + hash( sq ) * 0.3 );
    vec2 sf = fract( p * 2.6 );
    cob *= 0.8 + 0.2 * smoothstep( 0.0, 0.12, min( min( sf.x, 1.0 - sf.x ), min( sf.y, 1.0 - sf.y ) ) );
    // 路口的煤氣燈光
    vec2 lp = f - vec2( ST * 0.5 );
    cob += uFlower * 0.35 * ( 1.0 - smoothstep( 0.0, 1.1, length( lp ) ) );
    // 屋頂:街區裡切成 2 x 2 棟(切線位置每區不同)
    vec2 g = ( f - ST ) / ( B - ST );
    vec2 sp = vec2( 0.35 + hash( cell + 1.0 ) * 0.3, 0.35 + hash( cell + 2.0 ) * 0.3 );
    vec2 bi = step( sp, g );
    vec2 bid = cell * 2.0 + bi;
    vec2 lo = mix( vec2( 0.0 ), sp, bi ), hi = mix( sp, vec2( 1.0 ), bi );
    vec2 u = ( g - lo ) / ( hi - lo );                         // 這棟屋頂裡的 0..1
    float hb = hash( bid + 5.1 );
    vec3 roof = hb < 0.4 ? uDeep : hb < 0.75 ? uSea : uFoam;
    roof *= 0.85 + hash( bid + 9.0 ) * 0.25;
    // 斜屋頂:沿長邊有一條屋脊,一邊亮一邊暗 + 瓦片的橫紋
    vec2 sz = ( hi - lo ) * ( B - ST );
    float alongX = step( sz.y, sz.x );
    float across = mix( u.x, u.y, alongX ), along = mix( u.y, u.x, alongX );
    roof *= across < 0.5 ? 1.12 : 0.66;
    roof *= 0.85 + 0.15 * smoothstep( 0.0, 0.2, abs( fract( across * mix( sz.x, sz.y, alongX ) * 2.2 ) - 0.5 ) );
    roof *= 1.0 - 0.35 * ( 1.0 - smoothstep( 0.0, 0.04, abs( across - 0.5 ) ) );  // 屋脊
    // 屋頂邊緣(女兒牆)
    float edge = min( min( u.x, 1.0 - u.x ), min( u.y, 1.0 - u.y ) );
    roof = mix( roof * 0.55, roof, smoothstep( 0.0, 0.05, edge ) );
    // 煙囪:每棟一兩根(黑黑的口 + 一圈煤灰)
    vec2 cp = vec2( 0.2 + hash( bid + 3.0 ) * 0.6, mix( 0.25, 0.75, step( 0.5, hash( bid + 4.0 ) ) ) );
    vec2 cd = abs( ( u - cp ) * sz );
    roof = mix( roof, roof * 0.55, 1.0 - smoothstep( 0.35, 0.8, length( u - cp ) * 3.0 ) );
    roof = mix( roof, vec3( 0.35, 0.22, 0.16 ), step( max( cd.x, cd.y ), 0.32 ) );
    roof = mix( roof, vec3( 0.06, 0.04, 0.03 ), step( max( cd.x, cd.y ), 0.18 ) );
    // 亮著的天窗
    vec2 wd = abs( ( u - vec2( 0.7, 0.5 ) ) * sz );
    roof = mix( roof, uFlower, step( 0.8, hash( bid + 6.0 ) ) * step( wd.x, 0.28 ) * step( wd.y, 0.18 ) );
    // 房子的影子落在街上(光從左上來 → 影子在街區的右邊和下面)
    float sh = max( step( f.x, ST ) * ( 1.0 - smoothstep( 0.0, 0.7, f.x ) ), step( f.y, ST ) * step( ST, f.x ) * smoothstep( ST - 0.7, ST, f.y ) );
    cob *= 1.0 - 0.45 * sh;
    vec3 city = mix( roof, cob, street );
    col = mix( wild, city, isCity );
    // 郊外也有土路(沿著街道的格線,寬一點、軟一點)
    col = mix( col, uRoad * 1.15 * ( 0.9 + noise( p * 3.0 ) * 0.2 ), ( 1.0 - isCity ) * ( 1.0 - smoothstep( 0.35, 0.6, abs( f.x - ST * 0.5 ) ) ) * step( 0.6, hash( cell + 11.0 ) ) );
    // 運河:紅磚岸 + 深色的水 + 漣漪
    if ( uRiver > 0.01 ) {
      float wdist = abs( p.x - riverX( p.y ) ), W = 3.2 * uRiver;
      vec3 water = mix( vec3( 0.16, 0.24, 0.24 ), vec3( 0.3, 0.4, 0.38 ), noise( p * vec2( 1.0, 0.3 ) + vec2( 0.0, uTime * 0.4 ) ) );
      col = mix( col, uSea * 0.8 * ( 0.8 + 0.2 * step( 0.5, fract( p.y * 3.0 ) ) ), step( wdist, W + 0.45 ) );
      col = mix( col, water, step( wdist, W ) );
    }
    // 鐵軌:碎石路基 + 枕木 + 兩條亮亮的鐵軌
    float rd = p.x - roadX( p.y );
    if ( abs( rd ) < 1.25 ) {
      col = uRoad * ( 0.75 + hash( floor( p * 6.0 ) ) * 0.35 );
      col = mix( col, vec3( 0.32, 0.2, 0.12 ), step( abs( rd ), 0.95 ) * step( fract( p.y * 1.4 ), 0.32 ) );
      col = mix( col, vec3( 0.78, 0.74, 0.7 ), step( abs( abs( rd ) - 0.55 ), 0.07 ) );
    }
    // 煤灰:一層淡淡的黑霧,讓畫面有點髒髒的工業味
    col *= 0.85 + noise( p * 0.25 + uTime * 0.02 ) * 0.2;
    // 地面整體壓暗、彩度收一點,角色和子彈才會跳出來
    col = mix( vec3( dot( col, vec3( 0.333 ) ) ), col, 0.85 ) * 0.72;
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
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
  disc: new THREE.CircleGeometry(1, 18),
};
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(往上長)
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LEAN = 0.85;              // 立著的東西(工廠、鐘樓、水塔)往畫面上方仰倒,俯視鏡頭才看得到正面

function put(parent, geo, mat, pos, scl, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(...scl);
  if (rot) m.rotation.set(...rot);
  parent.add(m); return m;
}
/** 面朝 +z 的齒輪(平放在地上時用 UP 轉起來) */
function gearG(parent, mat, pos, r, teeth, thick, rot) {
  const g = new THREE.Group(); g.position.set(...pos); if (rot) g.rotation.set(...rot); parent.add(g);
  put(g, G.cyl, mat, [0, 0, 0], [r * 0.82, thick, r * 0.82], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < teeth; i++) { const a = i / teeth * Math.PI * 2; put(g, G.box, mat, [Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, 0], [r * 0.24, r * 0.24, thick], [0, 0, a]); }
  return g;
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
        uTime: { value: 0 }, uScroll: { value: 0 }, uRiver: { value: 0 }, uCity: { value: 1 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -GROUND_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    const CT = (color) => cel({ color, bands: 3, tint: 0x6a4a3a, cache: false });
    this.mat = {
      trunk: CT(0x3a2e24), canopy: CT(0x5a7a3a), canopy2: CT(0xc8902a),
      petal: flat({ color: 0xffa040, cache: false }),
      steam: new THREE.MeshBasicMaterial({ color: 0xf0e8e0, transparent: true, opacity: 0.4, depthWrite: false }),
    };
    const C3 = (color) => cel({ color, bands: 3, tint: 0x6a4a3a });
    this.stat = {
      brick: C3(0x9a4a32), brick2: C3(0x6a3024), iron: C3(0x5a5a62), iron2: C3(0x3a3a42), brass: C3(0xc8902a), copper: C3(0xb8602a),
      verd: C3(0x5a8a78), wood: C3(0x7a5230), cream: C3(0xf0e4c4), dark: C3(0x2a2420), lamp: flat({ color: 0xffd070 }),
      glow: flat({ color: 0xff8a3a }), crate: C3(0x9a7040), barrel: C3(0x6a4a2a),
      smoke: new THREE.MeshBasicMaterial({ color: 0xd8d0c8, transparent: true, opacity: 0.6, depthWrite: false }),
    };

    this.pools = {
      trees: Array.from({ length: 40 }, () => this.makeTree()),
      camps: Array.from({ length: 8 }, () => this.makeProp()),
      rocks: Array.from({ length: 24 }, () => this.makeRocks()),
      petals: Array.from({ length: 12 }, () => this.makePetals()),
      clouds: Array.from({ length: 6 }, () => this.makeSteam()),
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
    let t = add('round');                                                                         // 公園樹:鑄鐵圍欄 + 圓樹冠
    put(t, G.cyl, T.trunk, [0, 0, 0.45 * s], [0.1 * s, 0.9 * s, 0.1 * s], UP);
    put(t, G.torus, S.iron2, [0, 0, 0.1], [0.45 * s, 0.45 * s, 0.6]);
    put(t, G.ico, T.canopy, [0, 0, 1.15 * s], [0.62 * s, 0.62 * s, 0.55 * s]);
    put(t, G.ico0, T.canopy, [0.25 * s, -0.1 * s, 1.35 * s], 0.28 * s);
    t = add('lamp');                                                                              // 煤氣路燈:黑鐵柱 + 亮著的燈籠 + 黃銅頂
    put(t, G.cyl, S.iron2, [0, 0, 0.9 * s], [0.06 * s, 1.8 * s, 0.06 * s], UP);
    put(t, G.cyl, S.iron2, [0, 0, 0.1], [0.14 * s, 0.2 * s, 0.14 * s], UP);
    put(t, G.box, S.lamp, [0, 0, 1.95 * s], [0.26 * s, 0.26 * s, 0.34 * s]);
    put(t, G.cone6, T.canopy2, [0, 0, 2.22 * s], [0.24 * s, 0.22 * s, 0.24 * s], UP);
    t = add('pipe');                                                                              // 蒸汽管:直管 + 彎頭 + 紅色閥門輪
    put(t, G.cyl, S.copper, [0, 0, 0.7 * s], [0.14 * s, 1.4 * s, 0.14 * s], UP);
    put(t, G.cyl, S.copper, [0.35 * s, 0, 1.4 * s], [0.14 * s, 0.7 * s, 0.14 * s], [0, 0, Math.PI / 2]);
    put(t, G.ico, S.copper, [0, 0, 1.4 * s], 0.17 * s);
    put(t, G.torus, flat({ color: 0xc83a2a }), [0, -0.18 * s, 0.8 * s], [0.22 * s, 0.22 * s, 0.8], [Math.PI / 2, 0, 0]);
    for (const z of [0.3, 1.1]) put(t, G.cyl, S.brass, [0, 0, z * s], [0.18 * s, 0.06 * s, 0.18 * s], UP);
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1, v };
  }

  /** 大物件:七種先全部蓋好,出場時依場景(THEMES.props)只顯示一種;仰倒的用 scale.y 出場 */
  makeProp() {
    const g = new THREE.Group(), S = this.stat, v = {}, fires = [], wheels = [];
    const add = (k, lean) => { v[k] = new THREE.Group(); v[k].visible = false; v[k].userData.lean = lean; g.add(v[k]); return v[k]; };
    const leanG = (t) => { const c = new THREE.Group(); c.rotation.x = -LEAN; t.add(c); return c; };
    // 工廠:紅磚廠房 + 鋸齒屋頂 + 兩根大煙囪(冒煙)+ 亮著的窗
    let t = add('factory', true), c = leanG(t);
    put(c, G.box, S.brick, [0, 0, 0.9], [3.0, 1.6, 1.8]);
    for (let i = 0; i < 3; i++) put(c, G.box, S.iron2, [(i - 1) * 1.0, 0.1, 2.0], [0.95, 1.5, 0.4], [0.5, 0, 0]);
    for (let i = 0; i < 4; i++) put(c, G.box, S.lamp, [(i - 1.5) * 0.7, -0.81, 0.9], [0.35, 0.02, 0.45]);
    for (const x of [-0.9, 0.6]) {
      put(c, G.cyl, S.brick2, [x, 0.3, 2.6], [0.28, 3.2, 0.28], UP);
      put(c, G.cyl, S.dark, [x, 0.3, 4.25], [0.33, 0.15, 0.33], UP);
      for (let k = 0; k < 3; k++) { const f = put(c, G.ico, S.smoke, [x + k * 0.2, 0.3, 4.6 + k * 0.55], 0.35 + k * 0.12); f.userData.base = 0.35 + k * 0.12; f.userData.k = k; fires.push(f); }
    }
    // 鐘樓:高高的磚塔 + 四面鐘 + 綠銅尖頂
    t = add('clock', true); c = leanG(t);
    put(c, G.box, S.brick, [0, 0, 1.8], [1.3, 1.3, 3.6]);
    put(c, G.box, S.cream, [0, 0, 3.9], [1.45, 1.45, 0.5]);
    put(c, G.cyl, S.cream, [0, -0.66, 3.0], [0.5, 0.05, 0.5]);
    put(c, G.torus, S.brass, [0, -0.7, 3.0], [0.5, 0.5, 0.5], [Math.PI / 2, 0, 0]);
    put(c, G.box, S.dark, [0, -0.72, 3.15], [0.04, 0.02, 0.35]);
    put(c, G.box, S.dark, [0.12, -0.72, 3.0], [0.26, 0.02, 0.04]);
    put(c, G.cone6, S.verd, [0, 0, 4.9], [1.0, 1.5, 1.0], UP);
    put(c, G.ico, S.brass, [0, 0, 5.7], 0.12);
    // 儲氣槽:大圓槽 + 一圈圈的鐵框(平放,不仰)
    t = add('tank', false);
    put(t, G.cyl, S.iron, [0, 0, 0.9], [1.6, 1.8, 1.6], UP);
    for (const z of [0.4, 1.0, 1.6]) put(t, G.torus, S.iron2, [0, 0, z], [1.62, 1.62, 1.2]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(t, G.cyl, S.iron2, [Math.cos(a) * 1.7, Math.sin(a) * 1.7, 1.0], [0.07, 2.0, 0.07], UP); }
    put(t, G.cyl, S.brass, [0, 0, 1.82], [1.2, 0.05, 1.2], UP);
    // 蒸汽幫浦:鍋爐 + 會轉的大飛輪 + 活塞
    t = add('pump', true); c = leanG(t);
    put(c, G.cyl, S.copper, [-0.4, 0, 0.8], [0.7, 1.6, 0.7], [0, 0, Math.PI / 2]);
    for (const x of [-1.0, -0.4, 0.2]) put(c, G.cyl, S.brass, [x, 0, 0.8], [0.74, 0.08, 0.74], [0, 0, Math.PI / 2]);
    put(c, G.cyl, S.iron2, [0.2, 0, 1.7], [0.18, 0.8, 0.18], UP);
    const wh = gearG(c, S.iron, [1.1, -0.2, 1.2], 1.0, 12, 0.14, [Math.PI / 2, 0, 0]);
    wheels.push(wh);
    put(c, G.box, S.brass, [0.6, -0.2, 1.2], [1.0, 0.08, 0.08]);
    { const f = put(c, G.ico, S.smoke, [0.2, 0, 2.3], 0.35); f.userData.base = 0.35; f.userData.k = 0; fires.push(f); }
    // 起重機:鐵架塔 + 長長的吊臂 + 吊鉤 + 一個木箱
    t = add('crane', true); c = leanG(t);
    for (const x of [-0.4, 0.4]) put(c, G.box, S.iron2, [x, 0, 1.6], [0.12, 0.12, 3.2]);
    for (let k = 0; k < 5; k++) put(c, G.box, S.iron2, [0, 0, 0.4 + k * 0.6], [0.8, 0.08, 0.06], [0, k % 2 ? 0.6 : -0.6, 0]);
    put(c, G.box, S.brass, [0, 0, 3.3], [0.9, 0.6, 0.5]);
    put(c, G.box, S.iron2, [1.4, 0, 3.4], [3.2, 0.12, 0.14]);
    put(c, G.cyl, S.dark, [2.6, 0, 2.7], [0.02, 1.3, 0.02], UP);
    put(c, G.box, S.crate, [2.6, 0, 1.8], [0.6, 0.6, 0.5]);
    // 水塔:四根腳 + 木桶 + 尖頂
    t = add('water', true); c = leanG(t);
    for (const [x, y] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) put(c, G.cyl, S.iron2, [x, y, 1.0], [0.07, 2.0, 0.07], UP);
    put(c, G.cyl, S.wood, [0, 0, 2.6], [0.9, 1.2, 0.9], UP);
    for (const z of [2.2, 2.6, 3.0]) put(c, G.torus, S.iron2, [0, 0, z], [0.92, 0.92, 0.8]);
    put(c, G.cone8, S.verd, [0, 0, 3.55], [1.0, 0.7, 1.0], UP);
    // 鐵要塞:厚重的鐵牆 + 砲塔 + 紅色警示燈
    t = add('fort', true); c = leanG(t);
    put(c, G.box, S.iron, [0, 0, 0.8], [3.0, 1.8, 1.6]);
    for (let k = -2; k <= 2; k++) put(c, G.box, S.iron2, [k * 0.6, -0.92, 0.8], [0.08, 0.04, 1.6]);
    put(c, G.cyl, S.iron2, [0, 0, 1.9], [0.8, 0.6, 0.8], UP);
    put(c, G.cyl, S.dark, [0, -0.9, 2.0], [0.14, 1.2, 0.14]);
    for (const x of [-1.3, 1.3]) { const f = put(c, G.ico, S.glow, [x, -0.5, 1.75], 0.16); f.userData.base = 0.16; f.userData.blink = 1; fires.push(f); }
    return { g, r: 3.4, z: -GROUND_Z, on: false, pop: 1, v, fires, wheels };
  }

  /** 地上的小東西:木箱 / 木桶 */
  makeRocks() {
    const g = new THREE.Group(), n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = rand(0.3, 0.5), x = rand(-0.8, 0.8), y = rand(-0.6, 0.6);
      if (Math.random() < 0.5) put(g, G.box, this.stat.crate, [x, y, s * 0.5], [s, s, s], [0, 0, Math.random()]);
      else { put(g, G.cyl, this.stat.barrel, [x, y, s * 0.55], [s * 0.5, s * 1.1, s * 0.5], UP); put(g, G.torus, this.stat.iron2, [x, y, s * 0.8], [s * 0.52, s * 0.52, 0.5]); }
    }
    return { g, r: 1.8, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 飄著的火星(小小的多面體) */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const m = put(g, G.oct, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(0, 3)], rand(0.06, 0.11), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: rand(-1, 2), on: false, list };
  }

  /** 一團團的蒸汽(幾顆白色的球擠在一起,半透明) */
  makeSteam() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) put(g, G.ico, this.mat.steam, [(i - 2) * 0.9 + rand(-0.3, 0.3), rand(-0.6, 0.6), rand(0, 0.4)], [rand(0.9, 1.5), rand(0.7, 1.1), 0.4]);
    return { g, r: 6, z: rand(3, 5), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const Cl = (h) => new THREE.Color(h);
    this.target = {
      deep: Cl(t.deep), sea: Cl(t.sea), foam: Cl(t.foam), water: Cl(t.water), flower: Cl(t.flower), road: Cl(t.road), cloud: Cl(t.cloud),
      key: Cl(t.key), keyI: t.keyI, hemi: Cl(t.hemi),
      trunk: Cl(t.trunk), canopy: Cl(t.canopy), canopy2: Cl(t.canopy2), petal: Cl(t.petal), river: t.river, city: t.city,
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
    // 城市 / 郊外是整塊換,不用漸變(漸變會看到街區一塊塊閃)
    this.cur.city = t.city;
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'water', 'flower', 'road', 'cloud', 'key', 'hemi', 'trunk', 'canopy', 'canopy2', 'petal']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k; c.river += (T.river - c.river) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam); U.uWater.value.copy(c.water);
    U.uFlower.value.copy(c.flower); U.uRoad.value.copy(c.road); U.uRiver.value = c.river; U.uCity.value = c.city;
    const M = this.mat;
    M.trunk.color.copy(c.trunk); M.canopy.color.copy(c.canopy); M.canopy2.color.copy(c.canopy2);
    M.petal.color.copy(c.petal); M.steam.color.copy(c.cloud);
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
        if (o.fires) o.fires.forEach((fi, i) => {
          const u = fi.userData;
          if (u.blink) fi.scale.setScalar(u.base * (Math.sin(this.time * 6 + i) > 0 ? 1.2 : 0.5));
          else fi.scale.setScalar(u.base * (0.85 + 0.25 * Math.sin(this.time * 2.5 + i * 1.7 + u.k)));
        });
        if (o.wheels) for (const w of o.wheels) w.rotation.z += dt * 2.2;
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
