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

/* ---------------- 玩家戰機 ---------------- */
function wingShape(s) {
  const sh = new THREE.Shape();
  const P = [[0, 0.32], [0.92, -0.28], [0.92, -0.52], [0, -0.5]].map(([x, y]) => [x * s, y]);
  sh.moveTo(...P[0]);
  P.slice(1).forEach((p) => sh.lineTo(...p)); // 鏡像後變順時針,ExtrudeGeometry 會自己修正繞向
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false });
  g.translate(0, 0, -0.05);
  return g;
}
function shipBody(m) {
  return (b) => {
    part(b, new THREE.CylinderGeometry(0.15, 0.3, 1.3, 6), m.white, [0, 0.05, 0], 1);
    part(b, GEO.cone, m.red, [0, 0.9, 0], [0.15, 0.42, 0.15]);
    part(b, GEO.ico, M.shipCyan, [0, 0.26, 0.16], [0.13, 0.25, 0.11]);
    part(b, GEO.box, m.red, [0, -0.2, 0.22], [0.1, 0.5, 0.06]);
    for (const s of [-1, 1]) {
      part(b, wingShape(s), m.white, [s * 0.1, -0.12, 0], 1);
      part(b, GEO.cyl, m.blue, [s * 0.98, -0.32, 0.02], [0.09, 0.72, 0.09]);
      part(b, GEO.cone, m.red, [s * 0.98, 0.14, 0.02], [0.09, 0.22, 0.09]);
      part(b, GEO.cyl, M.shipTrim, [s * 0.2, -0.68, 0], [0.11, 0.24, 0.11]);
    }
  };
}

const TEMPLATES = {
  bee: template(beeBody, beeWings, 1.0),
  bfly: template(bflyBody, bflyWings, 1.0),
  boss: template(bossBody, bossWings, 1.1),
  ship: shipTemplate({ white: M.shipWhite, red: M.shipRed, blue: M.shipBlue }),
  captive: shipTemplate({ white: M.capWhite, red: M.capRed, blue: M.capBlue }),
};
function shipTemplate(m) {
  const root = template(shipBody(m), [], 0.95);
  const rig = root.getObjectByName('rig');
  // 引擎火焰不烤進去(每幀縮放閃爍)
  for (const s of [-1, 1]) {
    const f = part(rig, GEO.cone, M.engine, [s * 0.2, -0.95, 0], [0.09, 0.3, 0.09], [0, 0, Math.PI]);
    f.name = 'flame';
  }
  return root;
}

/**
 * 產生一個角色。回傳 { root, rig, wings[], flames[], meshes[] }。
 * clone 共用 geometry / material;要換色(王被打)就換單一 mesh 的 material。
 */
export function spawnModel(type) {
  const root = TEMPLATES[type].clone(true);
  const rig = root.getObjectByName('rig');
  const wings = [], flames = [], meshes = [];
  root.traverse((o) => {
    if (o.name && o.name[0] === 'w' && o.userData.side) wings.push(o);
    if (o.name === 'flame') flames.push(o);
    if (o.isMesh) meshes.push(o);
  });
  return { root, rig, wings, flames, meshes, type };
}

/* ---------------- 子彈 ---------------- */
const SHOT_MAT = flat({ color: PAL.shot, transparent: true, depthWrite: false });
const SHOT_TIP = flat({ color: PAL.shotTip, transparent: true, depthWrite: false });
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

export function buildShot() {
  const g = new THREE.Group();
  part(g, GEO.cyl, SHOT_MAT, [0, 0, 0], [0.06, 0.62, 0.06]);
  part(g, GEO.cone, SHOT_TIP, [0, 0.4, 0], [0.085, 0.22, 0.085]);
  for (const s of [-1, 1]) part(g, GEO.box, SHOT_TIP, [s * 0.07, -0.22, 0], [0.05, 0.2, 0.03]);
  return g;
}
export function buildEnemyShot() {
  const g = new THREE.Group();
  part(g, GEO.ico0, EB_MAT, [0, 0, 0], [0.14, 0.3, 0.14]);
  part(g, GEO.ico0, EB_CORE, [0, 0.02, 0.05], [0.07, 0.16, 0.07]);
  return g;
}
