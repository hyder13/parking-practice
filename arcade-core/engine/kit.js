import * as THREE from 'three';
import { cel } from '../render/toon.js';

/* ------------------------------------------------------------------ *
 * 模型共用小工具(所有換皮共用):幾何擺位、InstancedMesh 批次、裝甲換色、
 * Q 彈壓扁(squash & stretch)、彈性出場曲線。各遊戲的 models.js 只放造型。
 * ------------------------------------------------------------------ */

export function geoAt(geo, pos, scl) {
  const g = geo.clone(); g.scale(...scl); g.translate(...pos); return g;
}

export class Batch {
  constructor(scene, parts, cap) {
    this.meshes = parts.map(([geo, mat]) => {
      const m = new THREE.InstancedMesh(geo, mat, cap);
      m.count = 0; m.frustumCulled = false; m.renderOrder = 2;
      scene.add(m); return m;
    });
    this.cap = cap; this.n = 0; this.o = new THREE.Object3D();
  }
  begin() { this.n = 0; }
  add(x, y, z, rz, s = 1) {
    if (this.n >= this.cap) return;
    const o = this.o; o.position.set(x, y, z); o.rotation.set(0, 0, rz); o.scale.setScalar(s); o.updateMatrix();
    for (const m of this.meshes) m.setMatrixAt(this.n, o.matrix);
    this.n++;
  }
  end() { for (const m of this.meshes) { m.count = this.n; m.instanceMatrix.needsUpdate = true; } }
}

/** 裝甲關:敵人換成偏鋼灰的材質,裝甲打掉後換回原色 */
const armorCache = new Map();
const STEEL = new THREE.Color(0x9aa4c0);
export function armorize(mdl) {
  mdl.orig = mdl.meshes.map((m) => m.material);
  mdl.meshes.forEach((m) => {
    const src = m.material;
    if (!src.isMeshToonMaterial) return;
    if (!armorCache.has(src)) armorCache.set(src, cel({ color: src.color.clone().lerp(STEEL, 0.6).getHex(), bands: 2 }));
    m.material = armorCache.get(src);
  });
}
export function unarmor(mdl) {
  if (mdl.orig) mdl.meshes.forEach((m, i) => { m.material = mdl.orig[i]; });
  mdl.orig = null;
}

/**
 * Q 彈壓扁回饋(Squash & Stretch):te = 觸發後經過的秒數,k = 力道。
 * 往下壓扁再彈回來,體積大致守恆(寬變大、高變小)。
 */
export function squash(root, te, k = 1) {
  if (te < 0 || te > 0.7) { root.scale.set(1, 1, 1); return; }
  const a = Math.exp(-te * 7) * Math.sin(te * 22) * 0.22 * k;
  root.scale.set(1 + a, 1 - a, 1 - a * 1.3);
}
/** 彈性出場(0 → 1,略微超過再回來) */
export function elasticOut(t) {
  if (t <= 0) return 0.001;
  if (t >= 1) return 1;
  return Math.pow(2, -9 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
}
