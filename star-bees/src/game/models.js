import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * 所有角色都用基本幾何體拼出來(沒有模型檔)。
 * local:+y = 機頭、+x = 右翼、+z = 朝鏡頭(背部)。
 * 結構:root(位置 + heading)→ rig(翻滾 / 傾斜)→ 身體(烤成少數 mesh)+ 翅膀 pivot。
 * 每種角色先做一份樣板,之後用 clone() 共用 geometry / material。
 * ------------------------------------------------------------------ */

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
};

const M = {
  beeBody: cel({ color: PAL.beeBody }),
  beeBelly: cel({ color: PAL.beeBelly }),
  beeBand: cel({ color: PAL.beeBand, bands: 2 }),
  beeWing: cel({ color: PAL.beeWing, bands: 2 }),
  beeWingRim: cel({ color: PAL.beeWingRim, bands: 2 }),
  antenna: cel({ color: PAL.antenna, bands: 2 }),
  eye: flat({ color: PAL.eye }),
  eyeW: flat({ color: 0xfff6c8 }),
  bflyBody: cel({ color: PAL.bflyBody }),
  bflyHead: cel({ color: PAL.bflyHead }),
  bflyWing: cel({ color: PAL.bflyWing, bands: 2 }),
  bflyRim: cel({ color: PAL.bflyRim, bands: 2 }),
  bossBody: cel({ color: PAL.bossBody }),
  bossHead: cel({ color: PAL.bossHead }),
  bossWing: cel({ color: PAL.bossWing, bands: 2 }),
  bossInner: cel({ color: PAL.bossInner, bands: 2 }),
  bossCrown: cel({ color: PAL.bossCrown }),
  bossHit: cel({ color: PAL.bossHit }),
  bossHitHead: cel({ color: PAL.bossHitHead }),
  bossHitInner: cel({ color: PAL.bossHit, bands: 2 }),
  shipWhite: cel({ color: PAL.shipWhite }),
  shipRed: cel({ color: PAL.shipRed }),
  shipBlue: cel({ color: PAL.shipBlue }),
  shipCyan: cel({ color: PAL.shipCyan, bands: 2 }),
  shipTrim: cel({ color: 0x4a4a66, bands: 2 }),
  capWhite: cel({ color: PAL.captive }),
  capRed: cel({ color: 0xfff0f0 }),
  capBlue: cel({ color: PAL.captiveDark }),
  engine: flat({ color: PAL.engine, transparent: true, opacity: 0.95, depthWrite: false }),
};

/** 王被打第一發之後換色用的對照表 */
export const BOSS_HIT_SWAP = new Map([
  [M.bossBody, M.bossHit], [M.bossHead, M.bossHitHead], [M.bossInner, M.bossHitInner],
]);

function part(parent, geo, mat, pos, scl, rot) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (typeof scl === 'number') m.scale.setScalar(scl); else m.scale.set(...scl);
  if (rot) m.rotation.set(...rot);
  parent.add(m);
  return m;
}
const mirrorX = (v, s) => [v[0] * s, v[1], v[2]];

/** 把一個 group 底下的 mesh 依材質合併(draw call:~15 → 4~6) */
function bake(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(g);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    out.add(new THREE.Mesh(mergeGeometries(geos, false), mat));
    geos.forEach((g) => g.dispose());
  }
  return out;
}

/** 組樣板:body(fn)+ 左右翅膀 pivot(wing(side) 回傳 pivot 內容) */
function template(bodyFn, wings, scale = 1) {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; rig.scale.setScalar(scale); root.add(rig);
  const body = new THREE.Group(); bodyFn(body); rig.add(bake(body));
  wings.forEach(({ at, build }, i) => {
    for (const s of [-1, 1]) {
      const piv = new THREE.Group(); piv.name = `w${i}${s > 0 ? 'R' : 'L'}`;
      piv.position.set(...mirrorX(at, s)); piv.userData.side = s;
      const g = new THREE.Group(); build(g, s); piv.add(bake(g));
      rig.add(piv);
    }
  });
  return root;
}

/* ---------------- 蜂 ---------------- */
function beeBody(b) {
  part(b, GEO.ico, M.beeBody, [0, 0.38, 0.02], [0.25, 0.25, 0.23]);
  part(b, GEO.ico, M.beeBody, [0, 0.05, 0], [0.3, 0.3, 0.27]);
  part(b, GEO.ico, M.beeBelly, [0, -0.42, 0], [0.29, 0.42, 0.27]);
  part(b, GEO.cyl, M.beeBand, [0, -0.33, 0], [0.285, 0.07, 0.265]);
  part(b, GEO.cyl, M.beeBand, [0, -0.56, 0], [0.235, 0.07, 0.215]);
  part(b, GEO.cone, M.beeBand, [0, -0.9, 0], [0.07, 0.2, 0.07], [0, 0, Math.PI]);
  for (const s of [-1, 1]) {
    part(b, GEO.ico, M.eye, [s * 0.13, 0.5, 0.13], 0.085);
    part(b, GEO.cyl, M.antenna, [s * 0.13, 0.7, 0.06], [0.025, 0.34, 0.025], [0, 0, -s * 0.5]);
    part(b, GEO.ico, M.beeBelly, [s * 0.22, 0.86, 0.06], 0.06);
  }
}
const beeWings = [{
  at: [0.2, 0.12, 0.1],
  build(g, s) {
    part(g, GEO.ico, M.beeWing, [s * 0.4, 0.1, 0], [0.46, 0.22, 0.035], [0, 0, s * 0.35]);
    part(g, GEO.ico, M.beeWingRim, [s * 0.32, -0.2, -0.02], [0.33, 0.15, 0.03], [0, 0, -s * 0.35]);
  },
}];

/* ---------------- 蝶 ---------------- */
function bflyBody(b) {
  part(b, GEO.ico, M.bflyHead, [0, 0.45, 0.03], 0.21);
  part(b, GEO.ico, M.bflyBody, [0, 0.1, 0], [0.24, 0.32, 0.24]);
  part(b, GEO.ico, M.bflyBody, [0, -0.42, 0], [0.18, 0.38, 0.18]);
  part(b, GEO.cyl, M.bflyHead, [0, -0.38, 0], [0.175, 0.06, 0.175]);
  for (const s of [-1, 1]) {
    part(b, GEO.ico, M.eye, [s * 0.1, 0.57, 0.14], 0.07);
    part(b, GEO.cyl, M.bflyRim, [s * 0.11, 0.74, 0.05], [0.022, 0.34, 0.022], [0, 0, -s * 0.38]);
    part(b, GEO.ico, M.bflyHead, [s * 0.18, 0.9, 0.05], 0.055);
  }
}
const bflyWings = [{
  at: [0.17, 0.12, 0.08],
  build(g, s) {
    part(g, GEO.ico, M.bflyRim, [s * 0.42, 0.2, 0], [0.47, 0.29, 0.03], [0, 0, s * 0.45]);
    part(g, GEO.ico, M.bflyWing, [s * 0.42, 0.2, 0.025], [0.36, 0.2, 0.035], [0, 0, s * 0.45]);
    part(g, GEO.ico, M.bflyRim, [s * 0.33, -0.2, -0.01], [0.34, 0.21, 0.03], [0, 0, -s * 0.5]);
    part(g, GEO.ico, M.bflyWing, [s * 0.33, -0.2, 0.015], [0.25, 0.14, 0.035], [0, 0, -s * 0.5]);
  },
}];

/* ---------------- 王 ---------------- */
function bossBody(b) {
  part(b, GEO.ico, M.bossHead, [0, 0.28, 0.04], [0.42, 0.36, 0.34]);
  part(b, GEO.ico, M.bossBody, [0, -0.3, 0], [0.36, 0.46, 0.32]);
  part(b, GEO.cyl, M.bossWing, [0, -0.22, 0], [0.33, 0.07, 0.3]);
  part(b, GEO.cone, M.bossCrown, [0, 0.72, 0.12], [0.09, 0.32, 0.09]);
  for (const s of [-1, 1]) {
    part(b, GEO.cone, M.bossCrown, [s * 0.22, 0.62, 0.1], [0.08, 0.26, 0.08], [0, 0, -s * 0.4]);
    part(b, GEO.ico, M.eyeW, [s * 0.17, 0.4, 0.26], 0.09);
    part(b, GEO.cone, M.bossBody, [s * 0.12, -0.78, 0], [0.07, 0.24, 0.07], [0, 0, Math.PI + s * 0.35]);
  }
}
const bossWings = [{
  at: [0.3, 0.05, 0.08],
  build(g, s) {
    part(g, GEO.ico, M.bossWing, [s * 0.45, -0.05, 0], [0.52, 0.32, 0.035], [0, 0, -s * 0.25]);
    part(g, GEO.ico, M.bossInner, [s * 0.44, -0.02, 0.025], [0.4, 0.22, 0.04], [0, 0, -s * 0.25]);
  },
}];

/* ---------------- 玩家戰機(10 段進化) ----------------
 * 殺敵累積經驗 → Lv.1 ROOKIE … Lv.10 PHOENIX。每一段加一些零件、換配色、火焰顏色,
 * 讓玩家一眼看得出「我又變強了」。樣板第一次用到才建(spawnModel('ship3') …)。 */
export const SHIP_LV = [
  { name: 'ROOKIE', body: 0xf1f2f8, accent: 0xe8322e, pod: 0x3a6fff, flame: 0xffa53a, span: 1.0 },
  { name: 'SCOUT', body: 0xf1f2f8, accent: 0xe8322e, pod: 0x3a9fff, flame: 0xffb03a, span: 1.06 },
  { name: 'FALCON', body: 0xe6f2ff, accent: 0xff5a3a, pod: 0x2ab8ff, flame: 0xffc23a, span: 1.1 },
  { name: 'HAWK', body: 0xcfe6ff, accent: 0xff3a6a, pod: 0x2a7bff, flame: 0x6fe3ff, span: 1.14 },
  { name: 'RAPTOR', body: 0xa6d8ff, accent: 0xff3a3a, pod: 0x3a4fff, flame: 0x6fe3ff, span: 1.18 },
  { name: 'VALKYRIE', body: 0x7faaff, accent: 0xffd23a, pod: 0x2a3aa8, flame: 0x9f8aff, span: 1.22 },
  { name: 'COMET', body: 0xa98aff, accent: 0xffe35a, pod: 0x5a2ab8, flame: 0xc98bff, span: 1.26 },
  { name: 'NOVA', body: 0xffd86a, accent: 0xff4a3a, pod: 0xe8322e, flame: 0xfff2a0, span: 1.3 },
  { name: 'SUPERNOVA', body: 0xffc23a, accent: 0xffffff, pod: 0xff5a2a, flame: 0xffffff, span: 1.34 },
  { name: 'PHOENIX', body: 0xff6a3a, accent: 0xffe35a, pod: 0xffd23a, flame: 0xffffff, span: 1.4 },
];

function wingShape(s) {
  const sh = new THREE.Shape();
  const P = [[0, 0.32], [0.92, -0.28], [0.92, -0.52], [0, -0.5]].map(([x, y]) => [x * s, y]);
  sh.moveTo(...P[0]);
  P.slice(1).forEach((p) => sh.lineTo(...p)); // 鏡像後變順時針,ExtrudeGeometry 會自己修正繞向
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false });
  g.translate(0, 0, -0.05);
  return g;
}
const WING = { L: wingShape(-1), R: wingShape(1) };
const FUSE = new THREE.CylinderGeometry(0.15, 0.3, 1.3, 6);

function shipBody(m, L = 1, span = 1) {
  return (b) => {
    part(b, FUSE, m.white, [0, 0.05, 0], 1);
    part(b, GEO.cone, m.red, [0, 0.9, 0], [0.15, 0.42, 0.15]);
    part(b, GEO.ico, M.shipCyan, [0, 0.26, 0.16], L >= 9 ? [0.17, 0.32, 0.15] : [0.13, 0.25, 0.11]);
    part(b, GEO.box, m.red, [0, -0.2, 0.22], [0.1, 0.5, 0.06]);
    for (const s of [-1, 1]) {
      const W = s > 0 ? WING.R : WING.L;
      part(b, W, m.white, [s * 0.1, -0.12, 0], [span, 1, 1]);
      const px = s * (0.1 + 0.88 * span);
      part(b, GEO.cyl, m.blue, [px, -0.32, 0.02], [0.09, 0.72, 0.09]);
      part(b, GEO.cone, m.red, [px, 0.14, 0.02], [0.09, 0.22, 0.09]);
      part(b, GEO.cyl, M.shipTrim, [s * 0.2, -0.68, 0], [0.11, 0.24, 0.11]);
      if (L >= 3) { // 機首兩側加砲管
        part(b, GEO.cyl, m.blue, [s * 0.42, 0.3, 0.06], [0.055, 0.55, 0.055]);
        part(b, GEO.cone, m.red, [s * 0.42, 0.62, 0.06], [0.06, 0.16, 0.06]);
      }
      if (L >= 5) part(b, GEO.box, m.red, [s * 0.34, -0.55, 0.2], [0.05, 0.42, 0.32], [0, s * 0.25, 0]); // 尾翼
      if (L >= 6) part(b, W, m.red, [s * 0.1, 0.52, 0.04], [0.32, 0.4, 0.8]); // 前翼
      if (L >= 7) part(b, W, m.red, [s * 0.14, -0.2, 0.12], [span * 0.72, 0.8, 0.6], [0, 0, -s * 0.18]); // 上層翼
      if (L >= 10) part(b, GEO.cone, m.blue, [s * (0.6 + span * 0.55), -0.72, 0], [0.07, 0.9, 0.05], [0, 0, Math.PI - s * 0.55]); // 翼刃
    }
    if (L >= 9) part(b, GEO.cyl, M.shipTrim, [0, -0.72, 0], [0.12, 0.24, 0.12]);
  };
}

const HALO_GEO = new THREE.TorusGeometry(0.8, 0.035, 6, 36);
const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1) {
  const c = SHIP_LV[L - 1];
  const root = template(shipBody(m, L, c.span), [], 0.95 + 0.035 * (L - 1));
  const rig = root.getObjectByName('rig');
  // 引擎火焰不烤進去(每幀縮放閃爍)
  const fm = flat({ color: m.flame || PAL.engine, transparent: true, opacity: 0.95, depthWrite: false });
  for (const x of L >= 9 ? [-0.2, 0, 0.2] : [-0.2, 0.2]) {
    const f = part(rig, GEO.cone, fm, [x, -0.95, 0], [0.09, 0.3, 0.09], [0, 0, Math.PI]);
    f.name = 'flame';
  }
  if (L >= 8) {
    const h = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: c.accent, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    h.name = 'halo'; h.position.set(0, -0.15, -0.12); rig.add(h);
  }
  if (L >= 10) {
    const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
    a.name = 'aura'; a.scale.set(1.1, 1, 0.5); rig.add(a);
  }
  return root;
}
function evolvedShip(L) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: cel({ color: c.body }), red: cel({ color: c.accent }), blue: cel({ color: c.pod }), flame: c.flame }, L);
}

/* ---------------- 關底大 BOSS ---------------- */
const BM = {
  gold: cel({ color: 0xffc83a }), goldDark: cel({ color: 0xc88a1a }), glass: cel({ color: 0x70e0ff, bands: 2 }),
  hull: cel({ color: 0x8a7fb8 }), hullDark: cel({ color: 0x4a4270, bands: 2 }), light: flat({ color: 0xffe35a }),
  spot: flat({ color: 0xffe35a }), spot2: flat({ color: 0x1a1433 }),
};
function queenBody(b) {
  part(b, GEO.ico, M.bossHead, [0, 0.75, 0.05], [0.55, 0.48, 0.45]);
  part(b, GEO.ico, M.beeBody, [0, 0.12, 0], [0.62, 0.55, 0.5]);
  part(b, GEO.ico, M.beeBelly, [0, -0.85, 0], [0.62, 0.95, 0.52]);
  for (const [y, w] of [[-0.5, 0.6], [-0.9, 0.62], [-1.3, 0.48]]) part(b, GEO.cyl, M.beeBand, [0, y, 0], [w, 0.1, w * 0.84]);
  part(b, GEO.cone, M.beeBand, [0, -1.95, 0], [0.14, 0.45, 0.14], [0, 0, Math.PI]);
  for (let i = -2; i <= 2; i++) part(b, GEO.cone, BM.gold, [i * 0.2, 1.22 - Math.abs(i) * 0.06, 0.2], [0.09, 0.32 - Math.abs(i) * 0.05, 0.09], [0, 0, -i * 0.3]);
  for (const s of [-1, 1]) {
    part(b, GEO.ico, M.eye, [s * 0.25, 0.92, 0.3], 0.14);
    part(b, GEO.cone, M.bossBody, [s * 0.22, 1.2, -0.05], [0.07, 0.35, 0.07], [0, 0, -s * 0.5]);
  }
}
const queenWings = [
  { at: [0.45, 0.35, 0.2], build(g, s) { part(g, GEO.ico, M.beeWing, [s * 0.9, 0.3, 0], [1.0, 0.45, 0.05], [0, 0, s * 0.35]); part(g, GEO.ico, M.beeWingRim, [s * 0.85, 0.3, 0.03], [0.7, 0.28, 0.05], [0, 0, s * 0.35]); } },
  { at: [0.4, -0.1, 0.15], build(g, s) { part(g, GEO.ico, M.beeWingRim, [s * 0.75, -0.35, 0], [0.75, 0.32, 0.05], [0, 0, -s * 0.4]); } },
];
function mothBody(b) {
  part(b, GEO.ico, M.bflyHead, [0, 0.95, 0.05], 0.42);
  part(b, GEO.ico, M.bflyBody, [0, 0.25, 0], [0.45, 0.62, 0.45]);
  part(b, GEO.ico, M.bflyBody, [0, -0.85, 0], [0.34, 0.8, 0.34]);
  for (const y of [-0.55, -1.0]) part(b, GEO.cyl, M.bflyHead, [0, y, 0], [0.33, 0.08, 0.33]);
  for (const s of [-1, 1]) {
    part(b, GEO.ico, M.eye, [s * 0.2, 1.15, 0.3], 0.13);
    part(b, GEO.cyl, M.bflyRim, [s * 0.3, 1.55, 0.1], [0.04, 0.9, 0.04], [0, 0, -s * 0.45]);
    part(b, GEO.ico, BM.gold, [s * 0.52, 1.95, 0.1], 0.12);
  }
}
const mothWings = [
  { at: [0.35, 0.35, 0.15], build(g, s) {
    part(g, GEO.ico, M.bflyRim, [s * 1.15, 0.45, 0], [1.25, 0.8, 0.05], [0, 0, s * 0.4]);
    part(g, GEO.ico, M.bflyWing, [s * 1.12, 0.45, 0.03], [1.0, 0.6, 0.06], [0, 0, s * 0.4]);
    part(g, GEO.ico, BM.spot, [s * 1.3, 0.62, 0.08], [0.3, 0.3, 0.04]);
    part(g, GEO.ico, BM.spot2, [s * 1.3, 0.62, 0.11], [0.14, 0.14, 0.04]);
  } },
  { at: [0.3, -0.35, 0.1], build(g, s) {
    part(g, GEO.ico, M.bflyRim, [s * 0.85, -0.55, 0], [0.85, 0.55, 0.05], [0, 0, -s * 0.5]);
    part(g, GEO.ico, M.bflyWing, [s * 0.82, -0.55, 0.03], [0.65, 0.4, 0.06], [0, 0, -s * 0.5]);
  } },
];
function ufoBody(mat, dark) {
  return (b) => {
    part(b, GEO.ico, mat, [0, 0, 0], [1.6, 1.25, 0.42]);
    part(b, GEO.cyl, dark, [0, 0, 0.05], [1.62, 0.14, 1.28], [Math.PI / 2, 0, 0]);
    part(b, GEO.ico, BM.glass, [0, 0.15, 0.35], [0.62, 0.55, 0.45]);
    for (const s of [-1, 1]) part(b, GEO.cone, dark, [s * 0.7, -1.05, 0], [0.16, 0.5, 0.16], [0, 0, Math.PI]);
    part(b, GEO.cone, dark, [0, -1.25, 0], [0.2, 0.6, 0.2], [0, 0, Math.PI]);
  };
}
function bigTemplate(kind) {
  if (kind === 'queen') return template(queenBody, queenWings, 1.35);
  if (kind === 'moth') return template(mothBody, mothWings, 1.35);
  const gold = kind === 'gold';
  const root = template(ufoBody(gold ? BM.gold : BM.hull, gold ? BM.goldDark : BM.hullDark), [], gold ? 1.1 : 1.5);
  // 一圈會轉的燈(不烤,整組轉)
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    part(spin, GEO.ico, BM.light, [Math.cos(a) * 1.35, Math.sin(a) * 1.05, 0.28], 0.1);
  }
  root.getObjectByName('rig').add(spin);
  return root;
}

/* ---------------- 隕石(METEOR 關卡) ---------------- */
const ROCK = { a: cel({ color: 0x8a6a55 }), b: cel({ color: 0x5e4a40, bands: 2 }), c: cel({ color: 0xa58a70 }) };
function rockBody(b) {
  part(b, GEO.ico, ROCK.a, [0, 0, 0], [0.85, 0.75, 0.7], [0.3, 0.5, 0.2]);
  part(b, GEO.ico0, ROCK.b, [0.45, 0.3, 0.2], 0.42, [0.8, 0.1, 0.4]);
  part(b, GEO.ico0, ROCK.c, [-0.4, -0.35, 0.15], 0.38, [0.2, 0.9, 0.1]);
  part(b, GEO.ico0, ROCK.b, [-0.2, 0.45, -0.1], 0.3);
}
function rockTemplate() {
  const root = template(rockBody, [], 1);
  // 拖在後面的火焰尾巴(機頭 = 前進方向,尾巴在 -y)
  const tail = part(root, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    [0, -1.3, -0.1], [0.55, 1.6, 0.3]);
  tail.name = 'tail';
  return root;
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

const TEMPLATES = {
  bee: template(beeBody, beeWings, 1.0),
  bfly: template(bflyBody, bflyWings, 1.0),
  boss: template(bossBody, bossWings, 1.1),
  ship: shipTemplate({ white: M.shipWhite, red: M.shipRed, blue: M.shipBlue }),
  captive: shipTemplate({ white: M.capWhite, red: M.capRed, blue: M.capBlue }),
  rock: rockTemplate(),
};
function lazyTemplate(type) {
  if (TEMPLATES[type]) return TEMPLATES[type];
  if (type.startsWith('ship')) TEMPLATES[type] = evolvedShip(+type.slice(4));
  else if (type.startsWith('big_')) TEMPLATES[type] = bigTemplate(type.slice(4));
  else if (type.startsWith('item_')) TEMPLATES[type] = itemTemplate(type.slice(5));
  return TEMPLATES[type];
}

/**
 * 產生一個角色。回傳 { root, rig, wings[], flames[], meshes[], halo, aura, spin }。
 * clone 共用 geometry / material;要換色(王被打)就換單一 mesh 的 material。
 */
export function spawnModel(type) {
  const root = lazyTemplate(type).clone(true);
  const rig = root.getObjectByName('rig');
  const wings = [], flames = [], meshes = [];
  root.traverse((o) => {
    if (o.name && o.name[0] === 'w' && o.userData.side) wings.push(o);
    if (o.name === 'flame') flames.push(o);
    if (o.isMesh || o.isSprite) meshes.push(o);
  });
  return {
    root, rig, wings, flames, meshes, type,
    halo: root.getObjectByName('halo'), aura: root.getObjectByName('aura'), spin: root.getObjectByName('spin'),
  };
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具 ----------------
 * 旋轉的寶石 + 外圈光環 + 點陣字(自己畫的 5x7 字型,不依賴網路字型)。 */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: 'POWER UP' },
  R: { label: 'R', color: 0x5ff0ff, name: 'RAPID FIRE' },
  S: { label: 'S', color: 0x5aff8a, name: 'SHIELD' },
  B: { label: 'B', color: 0xc77dff, name: 'BOMB' },
  L: { label: '1UP', color: 0xffd23a, name: '1UP' },
};
const GLYPH = {
  P: ['1110', '1001', '1001', '1110', '1000', '1000', '1000'],
  R: ['1110', '1001', '1001', '1110', '1010', '1001', '1001'],
  S: ['0111', '1000', '1000', '0110', '0001', '0001', '1110'],
  B: ['1110', '1001', '1001', '1110', '1001', '1001', '1110'],
  1: ['010', '110', '010', '010', '010', '010', '111'],
  U: ['1001', '1001', '1001', '1001', '1001', '1001', '0110'],
};
function labelTex(text) {
  const cw = [...text].reduce((a, ch) => a + GLYPH[ch][0].length + 1, 1);
  const W = Math.max(cw, 9), H = 9;
  const c = document.createElement('canvas'); c.width = W * 4; c.height = H * 4;
  const g = c.getContext('2d');
  const draw = (color, ox, oy) => {
    g.fillStyle = color;
    let x = Math.floor((W - cw) / 2) + 1;
    for (const ch of text) {
      GLYPH[ch].forEach((row, y) => [...row].forEach((v, i) => { if (v === '1') g.fillRect((x + i) * 4 + ox, (y + 1) * 4 + oy, 4, 4); }));
      x += GLYPH[ch][0].length + 1;
    }
  };
  draw('#1a1433', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const gem = new THREE.Mesh(GEO.ico0, cel({ color: it.color, bands: 2 })); gem.scale.set(0.5, 0.5, 0.5); gem.name = 'gem';
  rig.add(gem);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 6, 28), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'halo'; root.add(ring);
  // 字不跟著寶石轉(放在 root),永遠正對鏡頭、疊在寶石正上方
  const { t, aspect } = labelTex(it.label);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.95 * aspect, 0.95, 1); sp.renderOrder = 5;
  root.add(sp);
  return root;
}

/* ---------------- 子彈:InstancedMesh,一整批只要 2 個 draw call ---------------- */
const SHOT_MAT = flat({ color: PAL.shot, transparent: true, depthWrite: false });
const SHOT_TIP = flat({ color: PAL.shotTip, transparent: true, depthWrite: false });
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

function geoAt(geo, pos, scl) {
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
export function shotBatch(scene, cap) {
  const tip = mergeGeometries([
    geoAt(GEO.cone, [0, 0.4, 0], [0.085, 0.22, 0.085]).toNonIndexed(),
    geoAt(GEO.box, [-0.07, -0.22, 0], [0.05, 0.2, 0.03]).toNonIndexed(),
    geoAt(GEO.box, [0.07, -0.22, 0], [0.05, 0.2, 0.03]).toNonIndexed(),
  ].map((g) => { for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n); return g; }));
  return new Batch(scene, [[geoAt(GEO.cyl, [0, 0, 0], [0.06, 0.62, 0.06]), SHOT_MAT], [tip, SHOT_TIP]], cap);
}
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico0, [0, 0, 0], [0.14, 0.3, 0.14]), EB_MAT],
    [geoAt(GEO.ico0, [0, 0.02, 0.05], [0.07, 0.16, 0.07]), EB_CORE],
  ], cap);
}
