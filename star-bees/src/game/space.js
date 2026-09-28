import * as THREE from 'three';
import { PAL, THEMES } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * 背景:三層視差像素星(方形點、會一閃一閃,原作的招牌)
 *      + 遠方星雲(canvas 程序貼圖)+ 一顆 cel 陰影的環狀行星。
 * 星星 depthWrite = false:不寫深度 → 描線 pass 當它是天空,不會把星星描黑。
 * ------------------------------------------------------------------ */

const STAR_VS = /* glsl */ `
  attribute vec3 aColor; attribute float aPhase; attribute float aRate;
  uniform float uTime, uScroll, uPx, uCenterY; uniform vec2 uSpan;
  varying vec3 vCol; varying float vOn;
  void main() {
    vec3 p = position;
    p.x *= uSpan.x;
    p.y = mod( p.y * uSpan.y - uScroll + uSpan.y * 0.5, uSpan.y ) - uSpan.y * 0.5 + uCenterY;
    vCol = aColor;
    vOn = step( 0.0, sin( uTime * aRate + aPhase ) ) * 0.8 + 0.2;
    gl_PointSize = uPx * ( 1.6 + fract( aPhase * 7.31 ) * 1.4 );
    gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
  }`;
const STAR_FS = /* glsl */ `
  varying vec3 vCol; varying float vOn;
  void main() { gl_FragColor = vec4( vCol * vOn, 1.0 ); }`;

function nebulaTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 128 + (Math.random() - 0.5) * 120, y = 128 + (Math.random() - 0.5) * 120, r = 30 + Math.random() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  // 邊緣淡出成圓形
  g.globalCompositeOperation = 'destination-in';
  const m = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = m; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Space {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.time = 0; this.speed = 1;
    this.layers = [];
    for (const [z, n, v] of [[-25, 110, 2.2], [-70, 160, 1.3], [-150, 240, 0.7]]) {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), ph = new Float32Array(n), rate = new Float32Array(n);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        pos[i * 3] = Math.random() - 0.5; pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = z + (Math.random() - 0.5) * 6;
        c.set(PAL.stars[Math.floor(Math.random() * PAL.stars.length)]);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        ph[i] = Math.random() * 100; rate[i] = 1.5 + Math.random() * 4;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
      g.setAttribute('aRate', new THREE.BufferAttribute(rate, 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: STAR_VS, fragmentShader: STAR_FS, depthWrite: false,
        uniforms: {
          uTime: { value: 0 }, uScroll: { value: Math.random() * 100 }, uPx: { value: 1 },
          uCenterY: { value: 0 }, uSpan: { value: new THREE.Vector2(100, 100) },
        },
      });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = -10;
      this.group.add(pts);
      this.layers.push({ pts, mat, z, v });
    }

    // 星雲
    const tex = nebulaTex();
    this.nebulae = [];
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x333366, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.renderOrder = -9; m.rotation.z = Math.random() * 6;
      this.group.add(m); this.nebulae.push(m);
    }

    // 行星 + 環
    this.planetMat = cel({ color: 0x7f6ad8, bands: 4, flat: false, tint: 0x2a1d5c, cache: false });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), this.planetMat);
    this.ringMat = flat({ color: 0xc9b8ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, cache: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.95, 72, 1), this.ringMat);
    this.ring.rotation.set(1.15, 0.25, 0.3);
    const band = new THREE.Mesh(new THREE.RingGeometry(1.52, 1.58, 72, 1), flat({ color: PAL.space, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.add(band);
    this.planetG = new THREE.Group(); this.planetG.add(this.planet, this.ring);
    this.group.add(this.planetG);

    this.target = null;
    this.setTheme(0, true);
  }

  setTheme(i, instant = false) {
    const t = THEMES[i % THEMES.length];
    this.target = {
      neb: t.nebula.map((c) => new THREE.Color(c)),
      planet: new THREE.Color(t.planet), ring: new THREE.Color(t.ring),
    };
    if (instant) this.applyTheme(1);
  }
  applyTheme(k) {
    const T = this.target;
    this.nebulae.forEach((m, i) => m.material.color.lerp(T.neb[i % T.neb.length], k));
    this.planetMat.color.lerp(T.planet, k);
    this.ringMat.color.lerp(T.ring, k);
  }

  /** 鏡頭 fit 之後呼叫:把星星層鋪滿各自深度的可視範圍,行星 / 星雲放到畫面邊角 */
  fit(camera, camDist, tilt, targetY, px) {
    const tf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const frame = (Z) => {
      const D = (camDist * Math.cos(tilt) + Z) / Math.cos(tilt);
      const hh = D * tf * 1.08, hw = hh * camera.aspect;
      return { cy: targetY + Z * Math.tan(tilt), hh, hw };
    };
    for (const L of this.layers) {
      const f = frame(-L.z);
      L.mat.uniforms.uSpan.value.set(f.hw * 2.1, f.hh * 2.3);
      L.mat.uniforms.uCenterY.value = f.cy;
      L.mat.uniforms.uPx.value = px;
    }
    const fn = frame(260);
    const spots = [[-0.55, 0.45, 1.1], [0.6, -0.2, 0.9], [-0.2, -0.65, 0.8]];
    this.nebulae.forEach((m, i) => {
      const [sx, sy, s] = spots[i];
      const r = Math.max(fn.hw, fn.hh) * s;
      m.position.set(fn.hw * sx, fn.cy + fn.hh * sy, -260);
      m.scale.set(r, r, 1);
    });
    const fp = frame(200);
    const R = Math.min(fp.hw, fp.hh) * 0.27;
    this.planetG.position.set(fp.hw * 0.8, fp.cy + fp.hh * 0.62, -200);
    this.planetG.scale.setScalar(R);
  }

  update(dt) {
    this.time += dt;
    this.applyTheme(Math.min(1, dt * 1.5)); // 換關時顏色慢慢漸變過去
    for (const L of this.layers) {
      L.mat.uniforms.uTime.value = this.time;
      L.mat.uniforms.uScroll.value += L.v * this.speed * dt;
    }
    this.planet.rotation.y += dt * 0.05;
    this.nebulae.forEach((m, i) => { m.rotation.z += dt * 0.004 * (i % 2 ? 1 : -1); });
  }
}
