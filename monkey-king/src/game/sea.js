import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';

/* ------------------------------------------------------------------ *
 * 背景:從雲端往下看的水墨仙境(類別名稱沿用 Sea,main.js 不用改)。
 *   雲海   一整片 shader 平面(z = -SEA_Z):淡彩暈染的大色塊 + 等高線般的細墨線(像水墨的皴法 / 祥雲紋)
 *   仙山   從雲海裡竄出來的尖峰(低多邊形圓錐 + 峰頂顏色 + 松樹,偶爾有紅色寶塔)
 *   仙鶴   在雲間慢慢飛、會拍翅膀
 *   飄落物 桃花 / 金光 / 火星 / 雪花 / 螢火(依主題)
 *   雲     低空的 cel 雲團 + 偶爾從鏡頭前飄過的薄霧
 * 全部以同一個世界速度往 -y 捲動,透視自然產生視差:越遠的看起來越慢,高聳的山峰會有明顯的立體感。
 * ------------------------------------------------------------------ */

export const SEA_Z = 62;
const BASE_SPEED = 7;   // 世界單位 / 秒

const SEA_VS = /* glsl */ `
  varying vec2 vP;
  void main() {
    vec4 w = modelMatrix * vec4( position, 1.0 );
    vP = w.xy;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const SEA_FS = /* glsl */ `
  uniform vec3 uDeep, uSea, uFoam;
  uniform float uTime, uScroll;
  varying vec2 vP;
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
  void main() {
    vec2 p = vP + vec2( 0.0, uScroll );
    // 淡彩暈染:兩色大色塊,分界柔一點(水墨的「暈」)
    float n = noise( p * 0.03 ) * 0.6 + noise( p * 0.08 + 3.1 ) * 0.3 + noise( p * 0.2 + 7.7 ) * 0.1;
    vec3 c = mix( uDeep, uSea, smoothstep( 0.35, 0.62, n ) );
    // 細墨線:取雜訊的等高線 → 一圈一圈的雲紋(雲慢慢流動)
    float m = n + noise( p * 0.05 + vec2( uTime * 0.03, 0.0 ) ) * 0.25;
    float l = abs( fract( m * 7.0 ) - 0.5 );
    float line = 1.0 - smoothstep( 0.0, 0.035, l );
    float fade = smoothstep( 0.25, 0.55, noise( p * 0.04 + 21.0 ) ); // 墨線有濃有淡、有的地方沒有
    c = mix( c, uFoam, line * 0.22 * fade );
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone6: new THREE.ConeGeometry(1, 1, 6),
  cone5: new THREE.ConeGeometry(1, 1, 5),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 9),
  disc: new THREE.CircleGeometry(1, 20),
  petal: new THREE.CircleGeometry(1, 5),
};
const rand = (a, b) => a + Math.random() * (b - a);
const UP = [Math.PI / 2, 0, 0]; // 圓錐 / 圓柱的軸(+y)轉成 +z(朝鏡頭 = 往上長)

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
        uTime: { value: 0 }, uScroll: { value: 0 },
      },
    });
    this.ocean = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.seaMat);
    this.ocean.position.z = -SEA_Z; this.ocean.renderOrder = -10;
    this.group.add(this.ocean);

    // 會跟主題變色的材質(不快取)
    this.mat = {
      rock: cel({ color: 0x5a8a7a, bands: 3, tint: 0x6a6a8a, cache: false }),
      rock2: cel({ color: 0x4a7a6a, bands: 3, tint: 0x6a6a8a, cache: false }),
      top: cel({ color: 0x6fae5a, bands: 2, cache: false }),
      pine: cel({ color: 0x2f6a4a, bands: 2, cache: false }),
      mist: flat({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, cache: false }),
      cloud: cel({ color: 0xffffff, bands: 'soft', tint: 0x9fb4e0, cache: false }),
      cloud2: cel({ color: 0xffffff, bands: 'soft3', tint: 0x9fb4e0, cache: false }),
      haze: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }),
      petal: flat({ color: 0xffb0c8, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, cache: false }),
    };
    this.stat = {
      roof: cel({ color: 0xb8282a, bands: 2 }), wall: cel({ color: 0xf2e6c8, bands: 2 }), gold: cel({ color: 0xffc23a, bands: 2 }),
      crane: cel({ color: 0xfaf8f2, bands: 'soft' }), craneBlack: cel({ color: 0x23202a, bands: 2 }), craneRed: flat({ color: 0xd8322e }),
    };

    this.pools = {
      peaks: Array.from({ length: 9 }, () => this.makePeak()),
      cranes: Array.from({ length: 6 }, () => this.makeCrane()),
      petals: Array.from({ length: 12 }, () => this.makePetals()),
      clouds: Array.from({ length: 14 }, () => this.makeCloud()),
      haze: Array.from({ length: 3 }, () => this.makeHaze()),
    };
    this.acc = { peaks: 0, cranes: 0, petals: 0, clouds: 0, haze: 0 };
    for (const k in this.pools) for (const o of this.pools[k]) { o.g.visible = false; o.on = false; this.group.add(o.g); }

    this.theme = THEMES[0];
    this.cur = null; this.target = null;
    this.setTheme(0, true);
  }

  /* ---------------- 物件 ---------------- */
  /** 仙山:一叢 1~3 座尖峰,峰頂另一種顏色 + 松樹,偶爾有寶塔;山腳圍一圈雲霧 */
  makePeak() {
    const g = new THREE.Group(), T = this.mat, n = 1 + Math.floor(Math.random() * 3);
    let R = 0;
    for (let i = 0; i < n; i++) {
      const r = rand(2.0, 3.8) * (i ? 0.75 : 1), h = rand(7, 16) * (i ? 0.7 : 1);
      const a = Math.random() * 6, d = i ? rand(2.5, 4.5) : 0;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const geo = [G.cone6, G.cone5, G.cone4][Math.floor(Math.random() * 3)];
      put(g, geo, i % 2 ? T.rock2 : T.rock, [x, y, h / 2], [r, h, r * rand(0.8, 1.1)], [Math.PI / 2, Math.random() * 3, 0]);
      // 峰頂:上面 30% 換顏色(綠苔 / 雪 / 金 / 岩漿…)
      put(g, geo, T.top, [x, y, h * 0.86], [r * 0.3, h * 0.3, r * 0.3], [Math.PI / 2, Math.random() * 3, 0]);
      for (let k = 0; k < 3; k++) {
        const pa = Math.random() * 6, pr = r * rand(0.35, 0.6), pz = h * rand(0.35, 0.55);
        put(g, G.cone5, T.pine, [x + Math.cos(pa) * pr, y + Math.sin(pa) * pr, pz], [0.5, 1.6, 0.5], UP);
      }
      R = Math.max(R, d + r);
    }
    if (Math.random() < 0.35) {
      // 寶塔(蓋在旁邊的小平台上)
      const x = R * 0.8, y = -R * 0.3, z0 = 6;
      put(g, G.cyl, T.rock, [x, y, z0 / 2], [1.4, z0, 1.4], UP);
      for (let k = 0; k < 3; k++) {
        const z = z0 + k * 1.1, s = 1 - k * 0.22;
        put(g, G.box, this.stat.wall, [x, y, z + 0.4], [1.1 * s, 1.1 * s, 0.8]);
        put(g, G.cone4, this.stat.roof, [x, y, z + 0.95], [1.3 * s, 0.5, 1.3 * s], [Math.PI / 2, Math.PI / 4, 0]);
      }
      put(g, G.cone4, this.stat.gold, [x, y, z0 + 3.9], [0.15, 0.9, 0.15], UP);
    }
    put(g, G.disc, T.mist, [0, 0, 1.2], [R * 1.15, R * 1.0, 1]);
    return { g, r: R + 6, z: -SEA_Z, on: false };
  }

  /** 仙鶴:白身黑翅尖、紅頂、長脖子,翅膀會拍 */
  makeCrane() {
    const g = new THREE.Group(), S = this.stat;
    put(g, G.ico, S.crane, [0, 0, 0], [0.35, 0.9, 0.3]);
    put(g, G.cyl, S.crane, [0, 1.1, 0.05], [0.08, 0.8, 0.08]);
    put(g, G.ico, S.crane, [0, 1.55, 0.08], 0.16);
    put(g, G.ico, S.craneRed, [0, 1.58, 0.2], 0.08);
    put(g, G.cone4, S.craneBlack, [0, 1.85, 0.06], [0.05, 0.4, 0.05]);
    for (const s of [-1, 1]) put(g, G.cyl, S.craneBlack, [s * 0.08, -1.1, 0], [0.03, 0.9, 0.03]);
    const wings = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.position.set(s * 0.25, 0.1, 0.05);
      put(piv, G.ico, S.crane, [s * 0.9, 0, 0], [0.95, 0.35, 0.05]);
      put(piv, G.ico, S.craneBlack, [s * 1.75, -0.1, 0], [0.35, 0.22, 0.05]);
      piv.userData.s = s; g.add(piv); wings.push(piv);
    }
    g.scale.setScalar(1.3);
    return { g, r: 4, z: -rand(22, 36), on: false, wings, ph: Math.random() * 6, vy: 0 };
  }

  /** 飄落物:一小群 6 片花瓣 / 雪花 / 火星,各自翻轉飄動 */
  makePetals() {
    const g = new THREE.Group(), list = [];
    for (let i = 0; i < 6; i++) {
      const m = put(g, G.petal, this.mat.petal, [rand(-6, 6), rand(-5, 5), rand(-3, 3)], rand(0.18, 0.32), [Math.random() * 3, Math.random() * 3, 0]);
      list.push({ m, sx: rand(-1, 1), sp: rand(1, 3) });
    }
    return { g, r: 8, z: -rand(8, 30), on: false, list };
  }

  makeCloud() {
    // 祥雲:一排互相重疊的球(中間大兩邊小)+ 上面再疊幾顆,底部壓平
    const g = new THREE.Group(), n = 5 + Math.floor(Math.random() * 4), w = rand(2.6, 5.5);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5, s = rand(1.5, 2.3) * (1 - Math.abs(u) * 0.9);
      put(g, G.ico, this.mat.cloud, [u * w * 2, rand(-0.5, 0.5), 0], [s * 1.25, s * 0.95, s * 0.6]);
    }
    for (let i = 0; i < 3; i++) {
      const s = rand(1.2, 1.9);
      put(g, G.ico, this.mat.cloud2, [rand(-0.5, 0.5) * w, rand(0.3, 1.2), 0.5], [s * 1.2, s, s * 0.6]);
    }
    return { g, r: w + 3, z: -rand(16, 40), on: false };
  }

  makeHaze() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) put(g, G.disc, this.mat.haze, [rand(-4, 4), rand(-2, 2), i * 0.02], [rand(2.5, 4.5), rand(1.6, 2.6), 1]);
    return { g, r: 7, z: rand(4, 7), on: false };
  }

  /* ---------------- 主題 ---------------- */
  setTheme(i, instant = false) {
    const t = this.theme = THEMES[((i % THEMES.length) + THEMES.length) % THEMES.length];
    const C = (h) => new THREE.Color(h);
    this.target = {
      deep: C(t.deep), sea: C(t.sea), foam: C(t.foam), cloud: C(t.cloud), key: C(t.key), keyI: t.keyI, hemi: C(t.hemi),
      rock: C(t.rock), top: C(t.top), pine: C(t.pine), petal: C(t.petal), mist: C(t.sea).lerp(C(0xffffff), 0.15),
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'cloud', 'key', 'hemi', 'rock', 'top', 'pine', 'petal', 'mist']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam);
    const M = this.mat;
    M.rock.color.copy(c.rock); M.rock2.color.copy(c.rock).multiplyScalar(0.85);
    M.top.color.copy(c.top); M.pine.color.copy(c.pine); M.mist.color.copy(c.mist); M.petal.color.copy(c.petal);
    M.cloud.color.copy(c.cloud); M.cloud2.color.copy(c.cloud).multiplyScalar(0.93);
    M.haze.color.copy(c.cloud);
    if (this.lights) {
      this.lights.key.color.copy(c.key); this.lights.key.intensity = c.keyI;
      this.lights.hemi.color.copy(c.hemi);
    }
  }
  get clearColor() { return this.cur.deep; }

  /** 鏡頭 fit 之後呼叫:算出每個深度的可視範圍,雲海鋪滿 */
  fit(camera, camDist, tilt, targetY) {
    const tf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    this.frame = (Z) => {
      // Z = 在遊戲平面「下方」多深(負值 = 在上方、靠近鏡頭)
      const D = (camDist * Math.cos(tilt) + Z) / Math.cos(tilt);
      const hh = D * tf * 1.12, hw = hh * camera.aspect * 1.05;
      return { cy: targetY + Z * Math.tan(tilt), hh, hw };
    };
    const f = this.frame(SEA_Z);
    this.ocean.position.set(0, f.cy, -SEA_Z);
    this.ocean.scale.set(f.hw * 2.6, f.hh * 2.6, 1);
    if (!this.primed) { this.primed = true; for (let i = 0; i < 40; i++) this.step(1.2, 0.05, true); }
  }

  spawn(kind, o) {
    const f = this.frame(-o.z);
    o.on = true; o.g.visible = true;
    o.g.position.set(rand(-1, 1) * (f.hw - o.r * 0.3), f.cy + f.hh + o.r, o.z);
    o.g.rotation.z = kind === 'cranes' ? rand(-0.5, 0.5) + (Math.random() < 0.3 ? Math.PI : 0) : kind === 'clouds' || kind === 'haze' ? rand(-0.3, 0.3) : kind === 'peaks' ? Math.random() * 6 : 0;
    o.vy = kind === 'cranes' ? 3 : 0;
  }

  step(dy, dt, prime = false) {
    const t = this.theme;
    const rates = { peaks: t.peaks, cranes: t.cranes, petals: t.petals, clouds: t.clouds, haze: prime ? 0 : 0.35 };
    for (const k in this.pools) {
      this.acc[k] += dy * rates[k] / 100;
      if (this.acc[k] >= 1) {
        const o = this.pools[k].find((p) => !p.on);
        if (o) { this.spawn(k, o); if (prime) o.g.position.y -= Math.random() * this.frame(-o.z).hh * 2.4; }
        this.acc[k] -= 1;
      }
      for (const o of this.pools[k]) {
        if (!o.on) continue;
        o.g.position.y -= dy;
        if (o.vy) {
          const a = o.g.rotation.z;
          o.g.position.x += -Math.sin(a) * o.vy * dt; o.g.position.y += Math.cos(a) * o.vy * dt;
        }
        if (o.wings) {
          o.ph += dt * 4;
          for (const w of o.wings) w.rotation.y = -w.userData.s * Math.sin(o.ph) * 0.6;
        }
        if (o.list) for (const p of o.list) {
          p.m.rotation.x += dt * p.sp; p.m.rotation.y += dt * p.sp * 0.7;
          p.m.position.x += Math.sin(this.time * 1.3 + p.sp * 3) * p.sx * dt;
          p.m.position.y -= dt * 0.8;
        }
        const f = this.frame(-o.z);
        if (o.g.position.y < f.cy - f.hh - o.r) { o.on = false; o.g.visible = false; }
      }
    }
  }

  update(dt) {
    this.time += dt;
    this.applyTheme(Math.min(1, dt * 1.2)); // 換關時顏色慢慢漸變過去
    const dy = BASE_SPEED * this.speed * dt;
    this.scroll += dy;
    const U = this.seaMat.uniforms;
    U.uTime.value = this.time; U.uScroll.value = this.scroll;
    if (this.frame) this.step(dy, dt);
  }
}
