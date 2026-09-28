import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { clamp, bakeTree } from '../core/geom.js';

// cab: [後窗下緣, 後窗上緣, 擋風上緣, 擋風下緣],以車長比例(-0.5 車尾 .. +0.5 車頭)
export const CARS = [
  { id: 'compact', name: '小型車', desc: '3.7m 最好停',  L: 3.7, W: 1.70, H: 1.50, wb: 2.45, steer: 0.62, r: 0.30, belt: 0.55, cab: [-0.45, -0.38, 0.12, 0.28], color: 0xf2c14e },
  { id: 'sedan',   name: '轎車',   desc: '4.8m 標準',    L: 4.8, W: 1.85, H: 1.45, wb: 2.85, steer: 0.60, r: 0.33, belt: 0.58, cab: [-0.32, -0.20, 0.10, 0.24], color: 0x3f7fe0 },
  { id: 'suv',     name: '休旅車', desc: '4.7m 車身高',  L: 4.7, W: 1.93, H: 1.75, wb: 2.80, steer: 0.60, r: 0.37, belt: 0.55, cab: [-0.47, -0.44, 0.12, 0.25], color: 0x3fa070 },
  { id: 'sports',  name: '跑車',   desc: '4.5m 低矮寬',  L: 4.5, W: 1.95, H: 1.20, wb: 2.65, steer: 0.56, r: 0.33, belt: 0.60, cab: [-0.25, -0.12, 0.05, 0.20], color: 0xe0433a },
  { id: 'van',     name: '廂型車', desc: '5.2m 方正',    L: 5.2, W: 2.00, H: 2.10, wb: 3.20, steer: 0.60, r: 0.36, belt: 0.50, cab: [-0.49, -0.48, 0.34, 0.42], color: 0xf1eff4 },
  { id: 'pickup',  name: '小貨卡', desc: '5.4m 軸距長',  L: 5.4, W: 1.95, H: 1.85, wb: 3.35, steer: 0.58, r: 0.40, belt: 0.55, cab: [-0.12, -0.10, 0.15, 0.25], color: 0x9a6a45, bed: true },
  { id: 'bus',     name: '大巴士', desc: '11m 內輪差大', L: 11,  W: 2.50, H: 3.20, wb: 5.80, steer: 0.66, r: 0.50, belt: 0.45, cab: [-0.49, -0.49, 0.48, 0.495], color: 0xf39a3a },
];
export const carById = (id) => CARS.find((c) => c.id === id);

const MAT = {
  get glass() { return flat({ color: PAL.glass, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }); },
  get glassDark() { return cel({ color: PAL.glassDark, side: THREE.DoubleSide, bands: 2 }); },
  get tire() { return cel({ color: PAL.tire, bands: 2 }); },
  get rim() { return cel({ color: PAL.rim }); },
  get trim() { return cel({ color: PAL.trim, bands: 2 }); },
  get interior() { return cel({ color: PAL.interior, bands: 2 }); },
  get seat() { return cel({ color: PAL.seat }); },
  get head() { return flat({ color: PAL.headlight }); },
};

function box(p, w, h, d, x, y, z, mat, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  p.add(m); return m;
}
function quad(p, pts, mat, shadow) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...pts[0], ...pts[1], ...pts[2], ...pts[0], ...pts[2], ...pts[3]], 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = !!shadow; p.add(m); return m;
}
function beam(p, p1, p2, t, mat) {
  const a = new THREE.Vector3(...p1), b = new THREE.Vector3(...p2);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, a.distanceTo(b)), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5); m.lookAt(b); m.castShadow = true; p.add(m); return m;
}

/**
 * 車輛模型。local:+z = 車頭,+x = 駕駛側(左駕),y 向上,原點在車身中心地面。
 * detailed = 玩家車:透明玻璃、A/B/C 柱、儀表板、方向盤、座椅(第一人稱看得到)。
 * 非 detailed = 停放車:深色玻璃,最後烤成少數幾個 mesh。
 */
export function buildCar(spec, color, detailed) {
  const g = new THREE.Group();
  const { L, W, H, r } = spec, belt = H * spec.belt, top = H;
  const [rb, rt, ft, fb] = spec.cab.map((f) => f * L);
  const paint = cel({ color, bands: 3 });
  const bottom = r * 0.55;

  box(g, W, belt - bottom, L, 0, (belt + bottom) / 2, 0, paint);
  box(g, W + 0.04, 0.2, 0.14, 0, bottom + 0.1, L / 2 - 0.05, MAT.trim);
  box(g, W + 0.04, 0.2, 0.14, 0, bottom + 0.1, -L / 2 + 0.05, MAT.trim);
  box(g, W + 0.02, 0.12, L * 0.62, 0, bottom + 0.06, 0, MAT.trim); // 側裙
  if (spec.bed) box(g, W - 0.16, 0.03, (rb + L / 2) - 0.2, 0, belt + 0.005, (-L / 2 + rb) / 2, MAT.interior, false);

  // cabin
  const hw = W / 2 - 0.05, gm = detailed ? MAT.glass : MAT.glassDark;
  quad(g, [[-hw, belt, fb], [hw, belt, fb], [hw, top - 0.03, ft], [-hw, top - 0.03, ft]], gm, !detailed);
  quad(g, [[-hw, belt, rb], [hw, belt, rb], [hw, top - 0.03, rt], [-hw, top - 0.03, rt]], gm, !detailed);
  for (const sx of [hw, -hw]) quad(g, [[sx, belt, rb], [sx, belt, fb], [sx, top - 0.03, ft], [sx, top - 0.03, rt]], gm, !detailed);
  box(g, W - 0.06, 0.07, ft - rt + 0.04, 0, top - 0.035, (ft + rt) / 2, paint);

  for (const s of [1, -1]) box(g, 0.1, 0.13, 0.2, s * (W / 2 + 0.1), belt + 0.09, fb - 0.08, paint); // 後照鏡殼

  const tail = cel({ color: PAL.tail, emissive: PAL.tail, emissiveIntensity: 0.25, cache: false });
  const rev = cel({ color: 0xe8e6ee, emissive: 0xffffff, emissiveIntensity: 0, cache: false });
  for (const s of [1, -1]) {
    box(g, 0.36, 0.12, 0.04, s * (W / 2 - 0.28), belt - 0.12, L / 2 + 0.01, MAT.head, false);
    box(g, 0.34, 0.12, 0.04, s * (W / 2 - 0.27), belt - 0.12, -L / 2 - 0.01, tail, false);
    box(g, 0.12, 0.08, 0.04, s * (W / 2 - 0.55), belt - 0.12, -L / 2 - 0.01, rev, false);
  }

  // wheels
  const tireGeo = new THREE.CylinderGeometry(r, r, 0.24, 18); tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.25, 10); rimGeo.rotateZ(Math.PI / 2);
  const front = [], spin = [];
  for (const z of [spec.wb / 2, -spec.wb / 2]) for (const s of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(s * (W / 2 - 0.1), r, z); g.add(piv);
    const sp = new THREE.Group(); piv.add(sp);
    const t = new THREE.Mesh(tireGeo, MAT.tire); t.castShadow = true; sp.add(t);
    sp.add(new THREE.Mesh(rimGeo, MAT.rim));
    box(sp, 0.26, r * 0.22, r * 1.1, 0, 0, 0, MAT.trim, false);
    if (z > 0) front.push(piv);
    spin.push(sp);
  }

  if (!detailed) {
    const baked = bakeTree(g);
    return { group: baked };
  }

  const out = { group: g, front, spin, tail, rev, belt };
  // pillars
  const pt = spec.id === 'bus' ? 0.1 : 0.075;
  for (const s of [hw, -hw]) {
    beam(g, [s, belt, fb], [s, top - 0.02, ft], pt, paint);
    beam(g, [s, belt, rb], [s, top - 0.02, rt], pt, paint);
    const n = Math.floor((ft - rt) / 1.35);
    for (let k = 1; k <= n; k++) { const z = rt + (ft - rt) * k / (n + 1); beam(g, [s, belt, z], [s, top - 0.02, z], pt, paint); }
  }
  // interior
  const zWind = (y) => fb + (ft - fb) * (y - belt) / (top - belt);
  box(g, W - 0.12, 0.02, fb - rb, 0, belt + 0.01, (fb + rb) / 2, MAT.interior, false);
  const dashTop = belt + 0.17, dashFront = zWind(dashTop) - 0.02, dashBack = dashFront - 0.45;
  box(g, W - 0.14, 0.26, 0.45, 0, dashTop - 0.13, dashFront - 0.225, MAT.trim, false);
  const drvX = W * (spec.id === 'bus' ? 0.26 : 0.22);
  box(g, 0.42, 0.09, 0.2, drvX, dashTop + 0.03, dashBack + 0.12, MAT.interior, false); // 儀表罩
  const eye = { x: drvX, y: belt + clamp((top - belt) * 0.55, 0.3, 0.55), z: Math.max(dashBack - 0.55, rb + 0.35) };

  const sw = new THREE.Group();
  sw.position.set(drvX, eye.y - 0.33, dashBack - 0.1);
  sw.rotation.x = spec.id === 'bus' ? 1.0 : 0.38;
  g.add(sw);
  const swIn = new THREE.Group(); sw.add(swIn);
  swIn.add(new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.022, 8, 28), MAT.interior));
  box(swIn, 0.34, 0.03, 0.02, 0, 0, 0, MAT.trim, false);
  box(swIn, 0.03, 0.17, 0.02, 0, -0.085, 0, MAT.trim, false);
  box(swIn, 0.07, 0.07, 0.04, 0, 0, 0, MAT.trim, false);
  box(swIn, 0.035, 0.035, 0.03, 0, 0.18, 0, flat({ color: PAL.lineYellow }), false); // 12 點鐘標記

  for (const sx of [drvX, -drvX]) {
    box(g, 0.5, 0.62, 0.12, sx, belt + 0.2, eye.z - 0.3, MAT.seat, false);
    box(g, 0.28, 0.2, 0.1, sx, belt + 0.62, eye.z - 0.31, MAT.seat, false);
  }
  box(g, 0.26, 0.07, 0.03, 0, top - 0.13, zWind(top - 0.13) - 0.08, MAT.interior, false); // 車內後視鏡

  Object.assign(out, { eye, steerWheel: swIn, fb, ft });
  return out;
}

export function buildPerson() {
  const g = new THREE.Group();
  const add = (geo, mat, y, x = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, 0); m.castShadow = true; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.22, 0.2, 1.0, 10), cel({ color: PAL.person }), 1.0);
  add(new THREE.SphereGeometry(0.16, 12, 10), cel({ color: PAL.skin }), 1.66);
  add(new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), cel({ color: PAL.hair }), 1.7);
  for (const s of [1, -1]) add(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8), cel({ color: PAL.trim }), 0.25, s * 0.1);
  return g;
}
