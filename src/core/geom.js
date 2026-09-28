import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const wrapPi = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

/* ------------------------------------------------------------------ *
 * 2D 矩形 (OBB),所有碰撞 / 雷達 / 評分都用它。
 *   x,z  中心
 *   a    朝向:前軸 f = (sin a, cos a);右軸 r = (cos a, -sin a) = 車身 local +x
 *   hw   沿 r 的半寬;hl 沿 f 的半長
 * ------------------------------------------------------------------ */
export function axes(o) { const c = Math.cos(o.a), s = Math.sin(o.a); return [[c, -s], [s, c]]; }

export function corners(o) {
  const [r, f] = axes(o);
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [
    o.x + r[0] * o.hw * i + f[0] * o.hl * j,
    o.z + r[1] * o.hw * i + f[1] * o.hl * j,
  ]);
}

/** 世界座標 → 矩形 local (lx 沿 r, lz 沿 f) */
export function toLocal(o, px, pz) {
  const dx = px - o.x, dz = pz - o.z, c = Math.cos(o.a), s = Math.sin(o.a);
  return [dx * c - dz * s, dx * s + dz * c];
}

/** 矩形 local → 世界座標 */
export function localToWorld2(x, z, a, lx, lz) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

/** SAT 分離軸檢查 */
export function overlap(A, B) {
  const ca = corners(A), cb = corners(B);
  for (const ax of [...axes(A), ...axes(B)]) {
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (const p of ca) { const d = p[0] * ax[0] + p[1] * ax[1]; if (d < a0) a0 = d; if (d > a1) a1 = d; }
    for (const p of cb) { const d = p[0] * ax[0] + p[1] * ax[1]; if (d < b0) b0 = d; if (d > b1) b1 = d; }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

/** 點到矩形的最短距離(在內部 = 0) */
export function pointDist(o, px, pz) {
  const [lx, lz] = toLocal(o, px, pz);
  return Math.hypot(Math.max(Math.abs(lx) - o.hw, 0), Math.max(Math.abs(lz) - o.hl, 0));
}

/* ------------------------------------------------------------------ *
 * bake:把一棵子樹依材質合併成少數幾個 mesh(sakura-crossing 的做法)。
 * 停放的車每台原本 ~30 個 draw call,烤完剩 6-8 個;後照鏡要把場景多畫
 * 4 次,這個差距很明顯。
 * ------------------------------------------------------------------ */
export function bakeTree(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const e = byMat.get(o.material) || { geos: [], cast: false };
    e.geos.push(g); e.cast = e.cast || o.castShadow;
    byMat.set(o.material, e);
  });
  const out = new THREE.Group();
  for (const [mat, e] of byMat) {
    const m = new THREE.Mesh(mergeGeometries(e.geos, false), mat);
    e.geos.forEach((g) => g.dispose());
    m.castShadow = e.cast; m.receiveShadow = true;
    out.add(m);
  }
  return out;
}
