import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { GROUND_Z, bannerMat, elasticOut } from './models.js';

/* ------------------------------------------------------------------ *
 * 背景:俯視的三國戰場(類別名稱沿用 Sea,main.js 不用改)。
 *   地面   一整片 shader 平面(z = -GROUND_Z,就在角色腳下):兩色草地 + 小草點 / 野花 + 蜿蜒的黃土路
 *          + (赤壁 / 南蠻)一條蜿蜒的江,岸邊有白色浪花
 *   地上   樹(桃花 / 松 / 楓…)、軍營(帳篷 + 陣營旗 + 柵欄 + 營火)、石頭
 *          —— 捲進畫面時像立體書一樣「啪」地從紙面立起來(scale.z 0 → 1 的彈性動畫)
 *   空中   飄落的花瓣 / 落葉 / 火星、戰場上飄過的淡淡塵煙
 * 全部以同一個世界速度往 -y 捲動(大軍往前推進)。
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
const FACTION = [['魏', '#2a4fa8'], ['魏', '#2a4fa8'], ['吳', '#c8321e'], ['蜀', '#2e8a4a'], ['黃', '#c8a02a'], ['漢', '#b8201e']];

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
    this.stat = {
      tent: cel({ color: 0xf2e8d0, bands: 2 }), tentTop: cel({ color: 0xb8282a, bands: 2 }), pole: cel({ color: 0x6a4a30, bands: 2 }),
      fence: cel({ color: 0x9a7048, bands: 2 }), fire: flat({ color: 0xffa030 }), fire2: flat({ color: 0xffe070 }),
      rock: cel({ color: 0x9a968a }), rock2: cel({ color: 0x7a766c, bands: 2 }),
    };

    this.pools = {
      trees: Array.from({ length: 40 }, () => this.makeTree()),
      camps: Array.from({ length: 8 }, () => this.makeCamp()),
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
  makeTree() {
    const g = new THREE.Group(), T = this.mat, s = rand(0.8, 1.4);
    put(g, G.cyl, T.trunk, [0, 0, 0.35 * s], [0.12 * s, 0.7 * s, 0.12 * s], UP);
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6, d = i ? 0.35 * s : 0;
      put(g, G.ico, i % 2 ? T.canopy2 : T.canopy, [Math.cos(a) * d, Math.sin(a) * d, (0.85 + i * 0.1) * s], [0.62 * s, 0.58 * s, 0.42 * s]);
    }
    return { g, r: 1.6 * s, z: -GROUND_Z, on: false, pop: 1 };
  }

  /** 軍營:2~3 頂帳篷 + 陣營旗 + 一排柵欄 + 營火 */
  makeCamp() {
    const g = new THREE.Group(), S = this.stat, n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 1.9, y = rand(-0.4, 0.4);
      put(g, G.cone6, S.tent, [x, y, 0.55], [0.85, 1.1, 0.85], UP);
      put(g, G.cone6, S.tentTop, [x, y, 1.0], [0.3, 0.3, 0.3], UP);
    }
    const [ch, bg] = FACTION[Math.floor(Math.random() * FACTION.length)];
    put(g, G.cyl, S.pole, [n * 0.95 + 0.3, 0.2, 1.0], [0.04, 2.0, 0.04], UP);
    const f = put(g, G.flag, bannerMat(ch, bg), [n * 0.95 + 0.32, 0.2, 1.95], 1);
    f.name = 'flag';
    for (let i = 0; i < 7; i++) put(g, G.box, S.fence, [-n * 1.1 + i * 0.55, -1.2, 0.25], [0.08, 0.08, 0.5]);
    put(g, G.box, S.fence, [-n * 1.1 + 1.65, -1.2, 0.38], [3.4, 0.05, 0.06]);
    put(g, G.cone6, S.fire, [0, -0.6, 0.18], [0.2, 0.36, 0.2], UP);
    put(g, G.cone6, S.fire2, [0, -0.6, 0.14], [0.11, 0.24, 0.11], UP);
    return { g, r: n * 1.2 + 1.5, z: -GROUND_Z, on: false, pop: 1, flag: f };
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
    o.g.rotation.z = kind === 'camps' ? rand(-0.25, 0.25) : kind === 'clouds' ? rand(-0.3, 0.3) : Math.random() * 6;
    if (this.popKinds.has(kind)) { o.pop = -1; o.g.scale.set(1, 1, 0.02); }
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
          const e = elasticOut(o.pop);
          o.g.scale.set(1 + (1 - o.pop) * 0.12, 1 + (1 - o.pop) * 0.12, Math.max(0.02, e));
        }
        if (o.flag) o.flag.rotation.y = Math.sin(this.time * 4 + o.g.position.x) * 0.35;
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
