import * as THREE from 'three';
import { PAL } from './palette.js';
import { flat } from './toon.js';

/* 手繪感天空:三段漸層穹頂(微量色階)+ 平面卡通雲 + 遠山剪影。
 * 結構參考 sakura-crossing 的 sky.js;雲的貼圖在這裡用 canvas 程序生成。 */

function cloudTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  const puffs = [[40, 64, 30], [78, 52, 38], [124, 44, 44], [170, 54, 36], [210, 66, 28], [100, 70, 30], [150, 72, 30]];
  for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.fillRect(30, 66, 196, 30);
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(0, 84, 256, 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildSky(scene, radius = 480) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: true, fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(PAL.skyTop) },
      uMid: { value: new THREE.Color(PAL.skyMid) },
      uHaze: { value: new THREE.Color(PAL.skyHaze) },
      uBands: { value: 26.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHaze; uniform float uBands; varying vec3 vDir;
      void main() {
        float h = normalize( vDir ).y;
        float t = clamp( h * 1.15 + 0.02, 0.0, 1.0 );
        t = mix( t, floor( t * uBands ) / uBands, 0.35 );
        vec3 col = mix( uHaze, uMid, smoothstep( 0.0, 0.30, t ) );
        col = mix( col, uTop, smoothstep( 0.26, 0.92, t ) );
        gl_FragColor = vec4( col, 1.0 );
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), mat);
  dome.frustumCulled = false; dome.renderOrder = -10;
  scene.add(dome);

  const tex = cloudTex();
  const matA = flat({ color: PAL.cloud, map: tex, transparent: true, opacity: 0.7, depthWrite: false, fog: false, cache: false });
  const matB = flat({ color: PAL.cloudShade, map: tex, transparent: true, opacity: 0.38, depthWrite: false, fog: false, cache: false });
  const clouds = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const r = 230 + Math.random() * 150, a = Math.random() * Math.PI * 2;
    const w = 80 + Math.random() * 120, h = w * 0.36, y = 50 + Math.random() * 90;
    const g = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matB); back.position.set(2, -h * 0.1, -1.5);
    g.add(back, new THREE.Mesh(new THREE.PlaneGeometry(w, h), matA));
    g.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.lookAt(0, y * 0.55, 0);
    clouds.add(g);
  }
  scene.add(clouds);

  // 遠山剪影(兩層,環繞四周)
  for (const [R, H, col, seed] of [[400, 48, PAL.hillFar, 1.3], [330, 34, PAL.hill, 2.7]]) {
    const n = 120, pos = [];
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const hh = (a) => Math.max(4, H * (0.55 + 0.25 * Math.sin(a * 3 + seed) + 0.15 * Math.sin(a * 7 + seed * 2) + 0.08 * Math.sin(a * 17)));
      const p = (a, y) => [Math.cos(a) * R, y, Math.sin(a) * R];
      pos.push(...p(a0, -5), ...p(a1, -5), ...p(a1, hh(a1)), ...p(a0, -5), ...p(a1, hh(a1)), ...p(a0, hh(a0)));
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(g, flat({ color: col, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -8; m.frustumCulled = false; scene.add(m);
  }
  return { dome, clouds };
}
