import * as THREE from 'three';
import { THEMES } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * 背景:從高空往下看的大海。
 *   海面   一整片 shader 平面(z = -SEA_Z):深淺兩色的大塊洋流 + cel 風格的浪花條紋 + 反光點
 *   海上   島嶼(沙灘 + 綠丘 + 椰子樹 + 淺灘)、艦隊(驅逐艦 / 航艦 + 白色航跡)、浮冰
 *   雲     低空的 cel 雲團(在飛機下面,有描線)+ 偶爾從鏡頭前飄過的薄雲
 * 全部以同一個世界速度往 -y 捲動(鏡頭往前飛),透視自然產生視差:越遠的看起來越慢。
 * 每一關換一個 THEME(早晨 / 熱帶 / 艦隊 / 夕陽 / 暴風雨 / 極地 / 夜晚),顏色與光線慢慢漸變過去。
 * ------------------------------------------------------------------ */

export const SEA_Z = 62;
const BASE_SPEED = 7.5;   // 世界單位 / 秒

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
    // 大塊洋流:兩色 cel 分界(不做平滑漸層,保留動畫感)
    float n = noise( p * 0.035 ) * 0.62 + noise( p * 0.09 + 3.1 ) * 0.38;
    vec3 c = mix( uDeep, uSea, smoothstep( 0.44, 0.5, n ) );
    c = mix( c, mix( uSea, uFoam, 0.18 ), smoothstep( 0.66, 0.7, n ) * 0.8 );
    // 浪花:橫向拉長的雜訊,只取一條細細的等高線 = 一道一道的白浪
    // 只有在大尺度遮罩內才有浪(海面有平靜區也有起浪區,不會滿滿都是花紋)
    float mask = smoothstep( 0.5, 0.62, noise( p * 0.05 + 11.0 ) );
    vec2 q = p * vec2( 0.3, 0.95 ) + vec2( uTime * 0.18, -uTime * 0.04 );
    float w = noise( q ) * 0.75 + noise( q * 2.1 + 7.0 ) * 0.25;
    float crest = smoothstep( 0.72, 0.735, w ) * ( 1.0 - smoothstep( 0.75, 0.765, w ) );
    c = mix( c, uFoam, crest * 0.32 * mask );
    // 陽光反光點
    float sp = step( 0.965, noise( p * vec2( 1.4, 2.8 ) + vec2( uTime * 0.9, 0.0 ) ) ) * step( 0.55, n );
    c = mix( c, uFoam, sp * 0.35 );
    gl_FragColor = vec4( c, 1.0 );
  }`;

const G = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 9),
  disc: new THREE.CircleGeometry(1, 20),
  ring: new THREE.RingGeometry(0.86, 1, 28),
  floe: [5, 6, 7].map((n) => new THREE.CylinderGeometry(1, 1, 1, n)),
};
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

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
    this.frames = null;

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
      shallow: flat({ color: 0x6fd0e0, transparent: true, opacity: 0.7, depthWrite: false, cache: false }),
      foam: flat({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false, cache: false }),
      wake: flat({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, cache: false }),
      cloud: cel({ color: 0xffffff, bands: 'soft', tint: 0x9fb4e0, cache: false }),
      cloud2: cel({ color: 0xffffff, bands: 'soft3', tint: 0x9fb4e0, cache: false }),
      haze: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }),
    };
    this.stat = {
      sand: cel({ color: 0xf2dca0, bands: 2 }), grass: cel({ color: 0x5fb04a }), grass2: cel({ color: 0x3f8a3a }),
      rock: cel({ color: 0x8a8070, bands: 2 }), trunk: cel({ color: 0x8a5a3a, bands: 2 }), leaf: cel({ color: 0x3fa03a, bands: 2 }),
      hull: cel({ color: 0x6a7480 }), deck: cel({ color: 0x9aa2ac }), wood: cel({ color: 0xb08a5a, bands: 2 }),
      dark: cel({ color: 0x3a4048, bands: 2 }), red: cel({ color: 0xb8322e, bands: 2 }),
      ice: cel({ color: 0xf4faff, bands: 'soft', tint: 0x8fb4e0 }), ice2: cel({ color: 0xd8ecff, bands: 'soft', tint: 0x8fb4e0 }),
    };

    // 物件池:每一類預先做好幾個,飛出畫面就回收到上方
    this.pools = {
      islands: Array.from({ length: 6 }, () => this.makeIsland()),
      ships: Array.from({ length: 7 }, (_, i) => this.makeShip(i % 3)),
      ice: Array.from({ length: 16 }, () => this.makeIce()),
      clouds: Array.from({ length: 14 }, () => this.makeCloud()),
      haze: Array.from({ length: 3 }, () => this.makeHaze()),
    };
    this.acc = { islands: 0, ships: 0, ice: 0, clouds: 0, haze: 0 };
    for (const k in this.pools) for (const o of this.pools[k]) { o.g.visible = false; o.on = false; this.group.add(o.g); }

    this.theme = THEMES[0];
    this.cur = null; this.target = null;
    this.setTheme(0, true);
  }

  /* ---------------- 物件 ---------------- */
  makeIsland() {
    const g = new THREE.Group();
    const S = this.stat, r = rand(3.5, 7);
    put(g, G.disc, this.mat.shallow, [0, 0, 0.05], [r * 1.45, r * 1.25, 1]);
    put(g, G.ring, this.mat.foam, [0, 0, 0.08], [r * 1.12, r * 0.98, 1]);
    put(g, G.cyl, S.sand, [0, 0, 0.3], [r, 0.6, r * 0.86], [Math.PI / 2, 0, 0]);
    const hills = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < hills; i++) {
      const hr = r * rand(0.35, 0.6), a = Math.random() * 6, d = r * 0.3 * Math.random();
      put(g, G.ico, i % 2 ? S.grass2 : S.grass, [Math.cos(a) * d, Math.sin(a) * d, 0.5], [hr, hr * 0.85, hr * rand(0.35, 0.6)], [0, 0, a]);
    }
    const palms = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < palms; i++) {
      const a = Math.random() * 6, d = r * rand(0.62, 0.85);
      const px = Math.cos(a) * d, py = Math.sin(a) * d * 0.86;
      put(g, G.cyl, S.trunk, [px, py, 0.9], [0.12, 1.3, 0.12], [Math.PI / 2, 0, 0]);
      put(g, G.cone, S.leaf, [px, py, 1.65], [0.8, 0.35, 0.8], [-Math.PI / 2, 0, Math.random() * 3]);
    }
    if (Math.random() < 0.6) put(g, G.ico0, S.rock, [r * 0.5, -r * 0.4, 0.5], rand(0.6, 1.1));
    return { g, r: r * 1.5, z: -SEA_Z, on: false };
  }

  /** kind 0 = 驅逐艦、1 = 巡洋艦、2 = 航空母艦 */
  makeShip(kind) {
    const g = new THREE.Group(), S = this.stat;
    const L = [5, 7, 9][kind], W = [0.9, 1.25, 1.9][kind];
    // 航跡:船尾拖出兩道細細的 V 字白浪 + 中間一道翻起的水花
    const wg = new THREE.BufferGeometry(), v = [];
    const quad = (x0, y0, x1, y1, w0, w1) => {
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
      const a = [x0 + nx * w0, y0 + ny * w0], b = [x0 - nx * w0, y0 - ny * w0], c = [x1 - nx * w1, y1 - ny * w1], d = [x1 + nx * w1, y1 + ny * w1];
      v.push(...a, 0.05, ...b, 0.05, ...c, 0.05, ...a, 0.05, ...c, 0.05, ...d, 0.05);
    };
    for (const sd of [-1, 1]) quad(sd * W * 0.45, -L * 0.3, sd * W * 2.2, -L * 1.7, 0.12, 0.03);
    quad(0, -L * 0.42, 0, -L * 1.2, W * 0.32, 0.05);
    wg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.add(new THREE.Mesh(wg, this.mat.wake));
    put(g, G.box, S.hull, [0, 0, 0.3], [W, L * 0.8, 0.6]);
    put(g, G.cone, S.hull, [0, L * 0.4 + L * 0.08, 0.3], [W * 0.62, L * 0.2, 0.3], [0, 0, 0]);
    if (kind === 2) {
      put(g, G.box, S.wood, [0, 0.1, 0.7], [W * 1.2, L * 0.98, 0.14]);
      put(g, G.box, S.deck, [0, L * 0.05, 0.78], [0.06, L * 0.9, 0.02]);
      put(g, G.box, S.dark, [W * 0.55, -L * 0.05, 1.1], [0.35, 1.3, 0.8]);
      put(g, G.box, S.red, [W * 0.55, -L * 0.05, 1.55], [0.3, 0.4, 0.2]);
    } else {
      put(g, G.box, S.deck, [0, 0, 0.62], [W * 0.82, L * 0.7, 0.06]);
      put(g, G.box, S.dark, [0, L * 0.06, 0.95], [W * 0.5, L * 0.22, 0.6]);
      put(g, G.cyl, S.dark, [0, -L * 0.1, 1.1], [W * 0.18, 0.8, W * 0.18], [Math.PI / 2, 0, 0]);
      for (const y of kind ? [0.3, 0.2, -0.22, -0.32] : [0.3, -0.3]) {
        put(g, G.cyl, S.hull, [0, L * y, 0.75], [W * 0.26, 0.25, W * 0.26], [Math.PI / 2, 0, 0]);
        put(g, G.box, S.dark, [0, L * y + Math.sign(y) * W * 0.3, 0.8], [0.08, W * 0.5, 0.08]);
      }
    }
    g.scale.setScalar(1.5);
    return { g, r: L * 2.8, z: -SEA_Z, on: false, kind, vy: 0 };
  }

  makeIce() {
    const g = new THREE.Group(), r = rand(0.8, 3.2);
    // 浮冰:扁平的不規則多邊形板(幾塊疊在一起),從上方看是一片一片的冰
    const mat = Math.random() < 0.5 ? this.stat.ice : this.stat.ice2, k = rand(0.55, 1);
    put(g, G.floe[Math.floor(Math.random() * G.floe.length)], mat, [0, 0, 0.15], [r, 0.3, r * k], [Math.PI / 2, 0, 0]);
    if (Math.random() < 0.6) put(g, G.floe[0], this.stat.ice2, [r * rand(-0.5, 0.5), r * k * rand(-0.4, 0.4), 0.35], [r * 0.45, 0.3, r * 0.35], [Math.PI / 2, Math.random() * 3, 0]);
    put(g, G.disc, this.mat.foam, [0, 0, 0.04], [r * 1.08, r * k * 1.08, 1]);
    return { g, r: r * 1.3, z: -SEA_Z, on: false };
  }

  makeCloud() {
    // 雲團:一排互相重疊的球(中間大兩邊小)+ 上面再疊幾顆,底部壓平
    const g = new THREE.Group(), n = 5 + Math.floor(Math.random() * 4), w = rand(2.6, 5.5);
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1) - 0.5, s = rand(1.5, 2.3) * (1 - Math.abs(u) * 0.9);
      put(g, G.ico, this.mat.cloud, [u * w * 2, rand(-0.5, 0.5), 0], [s * 1.25, s * 0.95, s * 0.6]);
    }
    for (let i = 0; i < 3; i++) {
      const s = rand(1.2, 1.9);
      put(g, G.ico, this.mat.cloud2, [rand(-0.5, 0.5) * w, rand(0.3, 1.2), 0.5], [s * 1.2, s, s * 0.6]);
    }
    return { g, r: w + 3, z: -rand(18, 42), on: false };
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
      shallow: C(t.sea).lerp(C(t.foam), 0.45),
    };
    if (!this.cur || instant) {
      this.cur = Object.fromEntries(Object.entries(this.target).map(([k, v]) => [k, v.clone ? v.clone() : v]));
    }
    // 這個主題沒有的東西(例如熱帶的浮冰)就不再生成;畫面上的讓它自然捲出去
  }
  applyTheme(k) {
    const T = this.target, c = this.cur;
    for (const key of ['deep', 'sea', 'foam', 'cloud', 'key', 'hemi', 'shallow']) c[key].lerp(T[key], k);
    c.keyI += (T.keyI - c.keyI) * k;
    const U = this.seaMat.uniforms;
    U.uDeep.value.copy(c.deep); U.uSea.value.copy(c.sea); U.uFoam.value.copy(c.foam);
    this.mat.shallow.color.copy(c.shallow);
    this.mat.foam.color.copy(c.foam); this.mat.wake.color.copy(c.foam);
    this.mat.cloud.color.copy(c.cloud); this.mat.cloud2.color.copy(c.cloud).multiplyScalar(0.93);
    this.mat.haze.color.copy(c.cloud);
    if (this.lights) {
      this.lights.key.color.copy(c.key); this.lights.key.intensity = c.keyI;
      this.lights.hemi.color.copy(c.hemi);
    }
  }
  get clearColor() { return this.cur.deep; }

  /** 鏡頭 fit 之後呼叫:算出每個深度的可視範圍,海面鋪滿 */
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
    this.seaFrame = f;
    if (!this.primed) { this.primed = true; this.prime(); }
  }

  /** 第一次:先把畫面鋪滿,標題畫面才不會空空的 */
  prime() {
    for (let i = 0; i < 40; i++) this.step(1.2, true);
  }

  spawn(kind, o) {
    const f = this.frame(-o.z);
    o.on = true; o.g.visible = true;
    o.g.position.set(rand(-1, 1) * (f.hw - o.r * 0.3), f.cy + f.hh + o.r, o.z);
    o.g.rotation.z = kind === 'ships' ? (Math.random() < 0.5 ? 0 : Math.PI) + rand(-0.4, 0.4) : kind === 'clouds' || kind === 'haze' ? rand(-0.3, 0.3) : Math.random() * 6;
    o.vy = kind === 'ships' ? 1.4 : 0;  // 船自己也在開(沿船頭方向)
  }

  step(dy, prime = false) {
    const t = this.theme;
    const rates = { islands: t.islands, ships: t.ships, ice: t.ice, clouds: t.clouds, haze: prime ? 0 : 0.35 };
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
          o.g.position.x += -Math.sin(a) * o.vy * dy / BASE_SPEED; o.g.position.y += Math.cos(a) * o.vy * dy / BASE_SPEED;
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
    if (this.frame) this.step(dy);
  }
}
