import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 所有角色都用基本幾何體拼出來(沒有模型檔)。
 * local:+y = 前方(頭)、+x = 右、+z = 朝鏡頭(背 / 頭頂)。
 * 結構:root(位置 + heading)→ rig(傾斜 / 翻筋斗)→ 身體(依材質烤成少數 mesh)
 *       + 翅膀 pivot 'wL' / 'wR'(拍動)+ 雲尾 'flame'(閃爍)。
 * 每種角色先做一份樣板,之後用 clone() 共用 geometry / material。
 * 內部型別沿用原本的名字:bee = 蝙蝠精、bfly = 烏鴉精、boss = 天兵(打兩下)、rock = 妖火石。
 * ------------------------------------------------------------------ */

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  torus: new THREE.TorusGeometry(1, 0.18, 6, 20),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
};

const M = {
  fur: cel({ color: PAL.fur }),
  face: cel({ color: PAL.face }),
  gold: cel({ color: 0xffc23a }),
  red: cel({ color: 0xd8322e }),
  tiger: cel({ color: 0xf0a030, bands: 2 }),
  black: cel({ color: 0x23202a, bands: 2 }),
  white: cel({ color: 0xfaf6ee }),
  wood: cel({ color: 0x6a4a30, bands: 2 }),
  plume: cel({ color: 0xff5aa8 }),
  // 蝙蝠精
  beeBody: cel({ color: PAL.beeBody }),
  beeWing: cel({ color: PAL.beeWing, bands: 2 }),
  beeBone: cel({ color: PAL.beeWingRim, bands: 2 }),
  eye: flat({ color: PAL.eye }),
  eyeGold: flat({ color: 0xffe070 }),
  // 烏鴉精
  bflyBody: cel({ color: PAL.bflyBody }),
  bflyMask: cel({ color: PAL.bflyHead }),
  bflyWing: cel({ color: PAL.bflyWing, bands: 2 }),
  bflyRim: cel({ color: PAL.bflyRim, bands: 2 }),
  beak: cel({ color: 0xffb03a, bands: 2 }),
  // 天兵
  bossBody: cel({ color: PAL.bossBody }),
  bossHead: cel({ color: PAL.bossHead }),
  bossInner: cel({ color: PAL.bossInner, bands: 2 }),
  bossCloud: cel({ color: PAL.bossWing, bands: 'soft' }),
  bossHit: cel({ color: PAL.bossHit }),
  bossHitHead: cel({ color: PAL.bossHitHead }),
  bossHitInner: cel({ color: 0x6a3a2a, bands: 2 }),
  // 被抓走的戰機(保留舊機制的樣板,目前玩法用不到)
  capWhite: cel({ color: PAL.captive }),
  capRed: cel({ color: 0xfff0f0 }),
  capBlue: cel({ color: PAL.captiveDark }),
};

/** 天兵被打第一下之後換色用的對照表(盔甲裂開變銅色) */
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
/** 兩點之間的一根棒子(骨頭、槍桿…),在 XY 平面上 */
function rod(parent, geo, mat, a, b, r, z = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  return part(parent, geo, mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [r, L, r], [0, 0, Math.atan2(-dx, dy)]);
}

/** 把一個 group 底下的 mesh 依材質合併(draw call:~30 → 4~8) */
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

/** 組樣板:body(fn)烤成一塊,extras(rig) 放不烤的零件(翅膀、雲尾、光環…) */
function template(bodyFn, scale = 1, extras = null) {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; rig.scale.setScalar(scale); root.add(rig);
  const body = new THREE.Group(); bodyFn(body); rig.add(bake(body));
  if (extras) extras(rig);
  return root;
}
/** 左右一對會拍動的翅膀(pivot 名稱 wL / wR,userData.side = ±1) */
function addWings(rig, at, build) {
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.name = `w${s > 0 ? 'R' : 'L'}`; piv.userData.side = s;
    piv.position.set(at[0] * s, at[1], at[2]);
    const g = new THREE.Group(); build(g, s); piv.add(bake(g));
    rig.add(piv);
  }
}

/* ---------------- 平面多邊形擠出(翅膀、葉子…,左右鏡像各一份) ---------------- */
const shapeCache = new Map();
function slab(key, pts, s = 1, depth = 0.06) {
  const k = `${key}:${s}`;
  if (shapeCache.has(k)) return shapeCache.get(k);
  const sh = new THREE.Shape();
  const P = pts.map(([x, y]) => [x * s, y]);
  sh.moveTo(...P[0]);
  P.slice(1).forEach((p) => sh.lineTo(...p));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  shapeCache.set(k, g);
  return g;
}

function addFlame(rig, pos, color, scl, opacity = 0.9) {
  const fm = flat({ color, transparent: true, opacity, depthWrite: false });
  const f = part(rig, GEO.cone, fm, pos, scl, [0, 0, Math.PI]);
  f.name = 'flame';
  return f;
}

/* ---------------- 蝙蝠精(bee) ---------------- */
const BAT_WING = [[0, 0.12], [0.35, 0.3], [0.75, 0.28], [1.0, 0.05], [0.85, -0.05], [0.7, -0.26], [0.52, -0.08], [0.32, -0.24], [0.14, -0.1], [0, -0.12]];
function batBody(b) {
  part(b, GEO.ico, M.beeBody, [0, -0.08, 0], [0.2, 0.3, 0.18]);
  part(b, GEO.ico, M.beeBody, [0, 0.3, 0.04], 0.17);
  for (const s of [-1, 1]) {
    part(b, GEO.cone, M.beeBody, [s * 0.1, 0.44, 0.1], [0.06, 0.2, 0.05], [0, 0, -s * 0.45]);
    part(b, GEO.ico, M.eye, [s * 0.065, 0.4, 0.17], 0.045);
  }
  part(b, GEO.cone, M.beeBody, [0, -0.45, 0], [0.06, 0.22, 0.05], [0, 0, Math.PI]);
}
function batExtras(rig) {
  addWings(rig, [0.13, 0.05, 0.03], (g, s) => {
    part(g, slab('bat', BAT_WING, s), M.beeWing, [0, 0, 0], [0.95, 1.1, 1]);
    for (const tip of [[0.75, 0.28], [1.0, 0.05], [0.7, -0.26]]) rod(g, GEO.cyl, M.beeBone, [0, 0], [tip[0] * s * 0.95, tip[1] * 1.1], 0.02, 0.03);
  });
}

/* ---------------- 烏鴉精(bfly):紅色天狗面具 + 黃嘴 + 扇形尾羽 ---------------- */
const CROW_WING = [[0, 0.15], [0.5, 0.22], [0.95, 0.12], [1.1, -0.05], [0.95, -0.12], [0.85, -0.02], [0.75, -0.18], [0.62, -0.05], [0.5, -0.22], [0.35, -0.1], [0, -0.14]];
const CROW_TAIL = [[0, 0.02], [0.24, -0.42], [0.1, -0.5], [0, -0.46], [-0.1, -0.5], [-0.24, -0.42]];
function crowBody(b) {
  part(b, GEO.ico, M.bflyBody, [0, -0.05, 0], [0.22, 0.38, 0.19]);
  part(b, GEO.ico, M.bflyBody, [0, 0.36, 0.05], 0.17);
  part(b, GEO.ico, M.bflyMask, [0, 0.44, 0.12], [0.12, 0.1, 0.08]);
  part(b, GEO.cone, M.beak, [0, 0.62, 0.08], [0.06, 0.2, 0.05]);
  for (const s of [-1, 1]) part(b, GEO.ico, M.eyeGold, [s * 0.07, 0.47, 0.19], 0.035);
  part(b, slab('ctail', CROW_TAIL), M.bflyWing, [0, -0.35, 0.02], 1);
  part(b, GEO.box, M.bflyMask, [0, 0.12, 0.17], [0.22, 0.06, 0.04]); // 紅色披肩
}
function crowExtras(rig) {
  addWings(rig, [0.14, 0.1, 0.03], (g, s) => {
    part(g, slab('crow', CROW_WING, s), M.bflyWing, [0, 0, 0], [0.95, 1.1, 1]);
    part(g, slab('crowr', [[0.05, 0.12], [0.9, 0.1], [0.9, 0.02], [0.05, 0.02]], s, 0.07), M.bflyRim, [0, 0, 0.01], [0.95, 1.1, 1]);
  });
}

/* ---------------- 天兵(boss):踩著小雲、銀盔藍袍、長槍 + 圓盾,打兩下 ---------------- */
function soldierBody(b) {
  for (const [x, y, s] of [[0, -0.15, 0.55], [-0.45, -0.25, 0.35], [0.45, -0.25, 0.35], [0, -0.55, 0.35]]) part(b, GEO.ico, M.bossCloud, [x, y, 0], [s * 1.2, s, s * 0.5]);
  part(b, GEO.box, M.bossHead, [0, -0.2, 0.32], [0.34, 0.34, 0.12]);        // 藍袍下擺
  part(b, GEO.ico, M.bossBody, [0, 0.02, 0.42], [0.22, 0.24, 0.2]);         // 胸甲
  for (const s of [-1, 1]) part(b, GEO.ico, M.bossInner, [s * 0.2, 0.08, 0.5], [0.1, 0.1, 0.07]);
  part(b, GEO.ico, M.bossBody, [0, 0.28, 0.56], 0.16);                        // 頭盔
  part(b, GEO.cone, M.red, [0, 0.24, 0.76], [0.05, 0.14, 0.05], [Math.PI / 2, 0, 0]); // 紅纓
  // 長槍(朝前方 = 朝玩家)
  part(b, GEO.cyl, M.wood, [0.26, 0.35, 0.45], [0.03, 1.5, 0.03]);
  part(b, GEO.cone, M.bossBody, [0.26, 1.18, 0.45], [0.06, 0.22, 0.04]);
  part(b, GEO.ico, M.red, [0.26, 1.0, 0.45], [0.06, 0.05, 0.06]);
  // 圓盾
  part(b, GEO.cyl, M.bossInner, [-0.3, 0.1, 0.48], [0.22, 0.04, 0.22], [Math.PI / 2, 0, 0]);
  part(b, GEO.ico, M.gold, [-0.3, 0.1, 0.51], 0.06);
}

/* ---------------- 玩家:大聖 + 筋斗雲(10 段修為) ----------------
 * 殺敵累積經驗 → 石猴 … 鬥戰勝佛。每一段加零件、換雲的顏色:
 *   Lv2 金箍、Lv3 金箍棒 + 虎皮裙、Lv4 黃金甲、Lv5 鳳翅紫金冠(兩根翎羽)、Lv6 紅披風、
 *   Lv7 金色祥雲、Lv8 火眼金睛、Lv9 金身、Lv10 佛光圈 + 光暈。
 * 樣板第一次用到才建(spawnModel('ship3') …)。 */
export const SHIP_LV = [
  { name: '石猴', body: 0xfffaf0, accent: 0xd8322e, pod: 0xd8a040, flame: 0xffffff, span: 1.0 },
  { name: '美猴王', body: 0xfffaf0, accent: 0xd8322e, pod: 0xe8b040, flame: 0xffffff, span: 1.03 },
  { name: '孫悟空', body: 0xfff8e8, accent: 0xd8322e, pod: 0xffc23a, flame: 0xffffff, span: 1.06 },
  { name: '弼馬溫', body: 0xfff6e0, accent: 0xe8402e, pod: 0xffc23a, flame: 0xfffaf0, span: 1.08 },
  { name: '齊天大聖', body: 0xfff2cc, accent: 0xd8322e, pod: 0xffc23a, flame: 0xfff6e0, span: 1.1 },
  { name: '大鬧天宮', body: 0xffeebb, accent: 0xe8322e, pod: 0xffc23a, flame: 0xfff2d0, span: 1.12 },
  { name: '孫行者', body: 0xffe6a0, accent: 0xd8322e, pod: 0xffcc40, flame: 0xffeebb, span: 1.15 },
  { name: '火眼金睛', body: 0xffe090, accent: 0xff3a2a, pod: 0xffd24a, flame: 0xffe8a0, span: 1.18 },
  { name: '金身羅漢', body: 0xffda78, accent: 0xff4a2a, pod: 0xffe070, flame: 0xffe080, span: 1.21 },
  { name: '鬥戰勝佛', body: 0xffd060, accent: 0xffffff, pod: 0xfff2a0, flame: 0xfff6c0, span: 1.25 },
];

function shipBody(m, L = 1, span = 1) {
  const fur = L >= 9 ? cel({ color: 0xd8a040 }) : M.fur;
  const chest = L >= 4 ? m.blue : L >= 3 ? M.tiger : fur;
  return (b) => {
    // 筋斗雲
    const cloud2 = m.cloud2;
    part(b, GEO.ico, m.white, [0, -0.15, 0], [0.62 * span, 0.5, 0.28]);
    for (const s of [-1, 1]) {
      part(b, GEO.ico, m.white, [s * 0.55 * span, -0.25, -0.02], [0.42, 0.36, 0.22]);
      part(b, GEO.ico, cloud2, [s * 0.3 * span, 0.2, -0.02], [0.32, 0.26, 0.18]);
      if (L >= 7) part(b, GEO.torus, m.blue, [s * 0.5 * span, -0.35, 0.2], [0.14, 0.14, 0.14]); // 祥雲紋
    }
    part(b, GEO.ico, cloud2, [0, -0.62, -0.03], [0.4, 0.34, 0.2]);
    // 大聖:站在雲上、臉朝鏡頭(頭在畫面上方),鳳翅翎羽往上翹 = 一眼認得出來的輪廓
    for (const s of [-1, 1]) {
      part(b, GEO.ico, L >= 3 ? M.tiger : fur, [s * 0.13, -0.22, 0.3], [0.1, 0.16, 0.12]);        // 腿
      part(b, GEO.ico, fur, [s * 0.22, 0.02, 0.5], [0.07, 0.15, 0.07], [0, 0, s * 0.5]);           // 手臂
      part(b, GEO.ico, fur, [s * 0.22, 0.28, 0.62], [0.07, 0.07, 0.06]);                              // 耳朵
      part(b, GEO.ico, M.black, [s * 0.065, 0.3, 0.83], 0.032);                                       // 眼睛
      if (L >= 4) part(b, GEO.ico, m.blue, [s * 0.2, 0.08, 0.56], [0.1, 0.09, 0.07]);                // 肩甲
      if (L >= 8) part(b, GEO.ico, M.eyeGold, [s * 0.065, 0.3, 0.855], 0.028);                       // 火眼金睛
      if (L >= 5) part(b, GEO.cone, M.plume, [s * 0.3, 0.78, 0.66], [0.045, 1.0, 0.045], [0, 0, -s * 0.46]); // 翎羽
    }
    part(b, GEO.ico, chest, [0, 0.0, 0.46], [0.2, 0.22, 0.18]);                         // 身體
    if (L >= 3) part(b, GEO.cyl, M.tiger, [0, -0.13, 0.42], [0.2, 0.08, 0.17]);        // 虎皮裙
    part(b, GEO.ico, fur, [0, 0.3, 0.62], 0.2);                                         // 頭
    part(b, GEO.ico, M.face, [0, 0.26, 0.76], [0.14, 0.12, 0.07]);                      // 臉(桃心形)
    part(b, GEO.ico, M.face, [0, 0.2, 0.79], [0.08, 0.05, 0.04]);                       // 嘴
    if (L >= 2) part(b, GEO.torus, M.gold, [0, 0.36, 0.62], [0.2, 0.2, 0.2], [Math.PI / 2 - 0.35, 0, 0]); // 金箍
    if (L >= 3) {                                                                        // 金箍棒(橫拿)
      const len = L >= 8 ? 1.25 : 1.05;
      part(b, GEO.cyl, M.gold, [0, 0.08, 0.6], [0.045, 2.1 * len, 0.045], [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) part(b, GEO.cyl, M.red, [s * 1.05 * len, 0.08, 0.6], [0.06, 0.14, 0.06], [0, 0, Math.PI / 2]);
    }
    if (L >= 6) part(b, GEO.box, m.red, [0, -0.2, 0.34], [0.44, 0.5, 0.03], [0.2, 0, 0]);  // 紅披風
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
const HALO_GEO = new THREE.TorusGeometry(0.78, 0.04, 6, 36);
function shipTemplate(m, L = 1) {
  const c = SHIP_LV[L - 1];
  return template(shipBody(m, L, c.span), 1.28 + 0.03 * (L - 1), (rig) => {
    // 雲尾:幾道往後拖的白色雲氣(每幀閃爍)
    for (const [x, sx] of [[-0.35, 0.14], [0, 0.18], [0.35, 0.14]]) addFlame(rig, [x * c.span, -0.95, -0.05], c.flame, [sx, 0.7, 0.08], 0.65);
    if (L >= 10) {
      const h = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.name = 'halo'; h.position.set(0, 0.1, 0.2); rig.add(h);
    }
    if (L >= 9) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: L >= 10 ? 0.14 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(1.1, 1.0, 0.45); rig.add(a);
    }
  });
}
function evolvedShip(L) {
  const c = SHIP_LV[L - 1];
  const white = cel({ color: c.body, bands: 'soft' });
  const cloud2 = cel({ color: new THREE.Color(c.body).multiplyScalar(0.93).getHex(), bands: 'soft' });
  return shipTemplate({ white, cloud2, red: cel({ color: c.accent }), blue: cel({ color: c.pod }), flame: c.flame }, L);
}

/* ---------------- 關底大 BOSS(面朝玩家 = local -y;臉在 +z,從上方俯衝下來) ---------------- */
const BM = {
  bullBody: cel({ color: 0x2a2226 }), bullHead: cel({ color: 0x6a4030 }), snout: cel({ color: 0xa06a50 }),
  horn: cel({ color: 0xefe2c0 }), cape: cel({ color: 0xa8201e }), iron: cel({ color: 0x3a3a44, bands: 2 }),
  bone: cel({ color: 0xeee6d2 }), socket: cel({ color: 0x1a1020, bands: 2 }), robe: cel({ color: 0x5a2a7a }),
  membrane: cel({ color: 0x8a4ab0, bands: 2 }), glow: flat({ color: 0xd070ff }),
  blue: cel({ color: 0x3a6ab8 }), robeRed: cel({ color: 0xb8282a }), gourd: cel({ color: 0x8a3aa8 }), gourdBand: cel({ color: 0xff4a3a }),
  peach: cel({ color: 0xffc080 }), blush: cel({ color: 0xff6a6a }), leaf: cel({ color: 0x4aa040 }),
};

/** 牛魔王:黑袍金肩甲、大彎角、鼻環、混鐵棍 */
function bullBody(b) {
  part(b, GEO.box, BM.cape, [0, 1.35, -0.35], [3.8, 1.5, 0.1], [0.35, 0, 0]);
  part(b, GEO.ico, BM.bullBody, [0, 0.7, 0], [2.0, 1.2, 0.9]);
  for (const s of [-1, 1]) {
    part(b, GEO.ico, M.gold, [s * 1.55, 0.75, 0.45], [0.75, 0.6, 0.45]);
    part(b, GEO.ico, BM.bullBody, [s * 2.0, 0.0, 0.2], [0.45, 0.8, 0.45]);
    part(b, GEO.ico, BM.bullHead, [s * 2.15, -0.75, 0.3], 0.45);
    // 大彎角:往外 + 往後翹
    part(b, GEO.cone, BM.horn, [s * 1.3, -0.15, 1.1], [0.28, 1.4, 0.28], [0, 0, -s * 1.107]);
    part(b, GEO.cone, BM.horn, [s * 2.05, 0.45, 1.2], [0.17, 0.9, 0.17], [0, 0, -s * 0.45]);
    part(b, GEO.ico, M.eye, [s * 0.4, -0.62, 1.42], [0.14, 0.1, 0.08]);
    part(b, GEO.box, M.black, [s * 0.4, -0.45, 1.45], [0.34, 0.08, 0.08], [0, 0, s * 0.35]);   // 怒眉
    part(b, GEO.ico, M.black, [s * 0.2, -1.45, 1.05], 0.08);                                     // 鼻孔
  }
  part(b, GEO.ico, BM.bullHead, [0, -0.35, 0.75], [0.95, 1.05, 0.85]);
  part(b, GEO.ico, BM.snout, [0, -1.2, 0.8], [0.62, 0.45, 0.45]);
  part(b, GEO.torus, M.gold, [0, -1.58, 0.75], [0.22, 0.22, 0.22], [Math.PI / 2, 0, 0]);         // 鼻環
  // 混鐵棍
  rod(b, GEO.cyl, BM.iron, [1.6, -1.8], [3.3, 1.8], 0.16, 0.4);
  part(b, GEO.ico, BM.iron, [1.6, -1.8, 0.4], 0.3);
}
/** 白骨精:骷髏頭 + 肋骨 + 紫色長髮 + 會拍動的骨翼 */
const BONE_WING = [[0, 0.2], [1.2, 0.9], [2.4, 0.6], [2.9, -0.1], [2.2, -0.3], [1.6, -0.9], [1.0, -0.4], [0.4, -0.8], [0, -0.2]];
function boneBody(b) {
  part(b, GEO.ico, BM.robe, [0, 0.45, 0], [1.1, 1.4, 0.5]);
  for (let i = 0; i < 4; i++) part(b, GEO.halfRing, BM.bone, [0, 0.25 + i * 0.32, 0.45], [0.72 - i * 0.08, 0.32, 1], [0, 0, Math.PI]);
  part(b, GEO.cyl, BM.bone, [0, 0.7, 0.5], [0.07, 1.4, 0.07]);
  part(b, GEO.ico, BM.bone, [0, -0.5, 0.7], [0.85, 0.95, 0.8]);
  part(b, GEO.ico, BM.bone, [0, -1.22, 0.5], [0.55, 0.35, 0.4]);
  for (const s of [-1, 1]) {
    part(b, GEO.ico, BM.socket, [s * 0.3, -0.75, 1.3], [0.22, 0.2, 0.1]);
    part(b, GEO.ico, BM.glow, [s * 0.3, -0.8, 1.38], 0.08);
    part(b, GEO.ico, BM.robe, [s * 0.95, 0.9, 0], [0.4, 1.1, 0.2]);   // 飄帶
  }
  for (let i = -2; i <= 2; i++) part(b, GEO.box, BM.bone, [i * 0.12, -1.42, 0.75], [0.08, 0.12, 0.08]); // 牙
  part(b, GEO.ico, BM.socket, [0, -1.05, 1.28], [0.08, 0.1, 0.06]);
}
function boneExtras(rig) {
  addWings(rig, [0.55, 0.55, 0.3], (g, s) => {
    part(g, slab('bonew', BONE_WING, s, 0.05), BM.membrane, [0, 0, 0], 1);
    for (const tip of [[1.2, 0.9], [2.9, -0.1], [1.6, -0.9]]) rod(g, GEO.cyl, BM.bone, [0, 0], [tip[0] * s, tip[1]], 0.07, 0.05);
  });
}
/** 金角大王:藍臉金角、紅袍、手捧紫金紅葫蘆(葫蘆口朝玩家)+ 一圈繞著轉的金光珠 */
function hornBody(b) {
  part(b, GEO.ico, BM.robeRed, [0, 0.7, 0], [1.35, 1.1, 0.8]);
  for (const s of [-1, 1]) {
    part(b, GEO.ico, M.gold, [s * 0.95, 0.7, 0.4], [0.55, 0.45, 0.3]);
    part(b, GEO.ico, BM.blue, [s * 1.0, -0.4, 0.5], [0.3, 0.6, 0.3]);
    part(b, GEO.ico, M.eyeGold, [s * 0.25, -0.55, 1.35], [0.12, 0.09, 0.06]);
    part(b, GEO.cone, M.white, [s * 0.15, -0.75, 1.05], [0.05, 0.14, 0.05], [0, 0, Math.PI]);
  }
  part(b, GEO.ico, BM.blue, [0, -0.2, 0.95], [0.7, 0.7, 0.6]);
  part(b, GEO.cone, M.gold, [0, -0.05, 1.7], [0.2, 0.8, 0.2], [Math.PI / 2, 0, 0]);
  // 紫金紅葫蘆
  part(b, GEO.ico2, BM.gourd, [0, -1.3, 0.75], 0.6);
  part(b, GEO.cyl, BM.gourdBand, [0, -1.78, 0.75], [0.3, 0.12, 0.3]);
  part(b, GEO.ico2, BM.gourd, [0, -2.05, 0.75], 0.4);
  part(b, GEO.cyl, M.gold, [0, -2.45, 0.75], [0.12, 0.16, 0.12]);
}
function hornExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    part(spin, GEO.ico, flat({ color: 0xffe070 }), [Math.cos(a) * 2.3, Math.sin(a) * 2.0, 0.6], 0.14);
  }
  rig.add(spin);
}
/** 金蟠桃(獎勵關):不攻擊,到處亂飛,打得到就大賺 */
function peachBody(b) {
  part(b, GEO.ico2, BM.peach, [0, 0, 0], [1.1, 1.2, 1.0]);
  part(b, GEO.ico2, BM.blush, [0.3, -0.25, 0.3], [0.8, 0.85, 0.75]);
  part(b, GEO.cone, BM.peach, [0, -1.15, 0], [0.35, 0.5, 0.35], [0, 0, Math.PI]);
  part(b, GEO.cyl, M.wood, [0, 1.25, 0.1], [0.06, 0.3, 0.06]);
  for (const s of [-1, 1]) part(b, slab('leaf', [[0, 0], [0.4, 0.25], [0.9, 0.2], [0.5, -0.1]], s, 0.05), BM.leaf, [0, 1.15, 0.35], 1);
}

function bigTemplate(kind) {
  if (kind === 'bull') return template(bullBody, 1);
  if (kind === 'bone') return template(boneBody, 1, boneExtras);
  if (kind === 'horn') return template(hornBody, 1.25, hornExtras);
  return template(peachBody, 1, (rig) => {
    const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    a.name = 'aura'; a.scale.set(1.3, 1.35, 0.6); rig.add(a);
  });
}

/* ---------------- 妖火石(ROCKET 關卡:原本的隕石) ---------------- */
const ROCK = { a: cel({ color: 0x4a3030 }), b: cel({ color: 0x2a1a1a, bands: 2 }), c: flat({ color: 0xff8a2a }) };
function rockBody(b) {
  part(b, GEO.ico, ROCK.a, [0, 0, 0], [0.8, 0.72, 0.68], [0.3, 0.5, 0.2]);
  part(b, GEO.ico0, ROCK.b, [0.42, 0.3, 0.2], 0.4, [0.8, 0.1, 0.4]);
  part(b, GEO.ico0, ROCK.b, [-0.38, -0.32, 0.15], 0.36, [0.2, 0.9, 0.1]);
  part(b, GEO.ico0, ROCK.c, [0.1, 0.1, 0.5], 0.22); // 裂縫裡的火光
}
function rockTemplate() {
  return template(rockBody, 1, (rig) => {
    const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
      [0, -1.3, -0.1], [0.55, 1.6, 0.3], [0, 0, Math.PI]);
    tail.name = 'flame';
  });
}

const TEMPLATES = {
  bee: template(batBody, 1.05, batExtras),
  bfly: template(crowBody, 1.05, crowExtras),
  boss: template(soldierBody, 1.1),
  captive: shipTemplate({ white: M.capWhite, cloud2: M.capWhite, red: M.capRed, blue: M.capBlue }),
  rock: rockTemplate(),
};
function lazyTemplate(type) {
  if (TEMPLATES[type]) return TEMPLATES[type];
  if (type.startsWith('ship')) TEMPLATES[type] = evolvedShip(+type.slice(4) || 1);
  else if (type.startsWith('big_')) TEMPLATES[type] = bigTemplate(type.slice(4));
  else if (type.startsWith('item_')) TEMPLATES[type] = itemTemplate(type.slice(5));
  return TEMPLATES[type];
}

/**
 * 產生一個角色。回傳 { root, rig, wings[], flames[], props[], meshes[], halo, aura, spin }。
 * clone 共用 geometry / material;要換色(天兵被打)就換單一 mesh 的 material。
 */
export function spawnModel(type) {
  const root = lazyTemplate(type).clone(true);
  const rig = root.getObjectByName('rig');
  const wings = [], flames = [], meshes = [], props = [];
  root.traverse((o) => {
    if (o.name && o.name[0] === 'w' && o.userData.side) wings.push(o);
    if (o.name === 'flame') flames.push(o);
    if (o.isMesh || o.isSprite) meshes.push(o);
  });
  return {
    root, rig, wings, flames, props, meshes, type,
    halo: root.getObjectByName('halo'), aura: root.getObjectByName('aura'), spin: root.getObjectByName('spin'),
  };
}
/** 保留 sky-aces 的介面(這一版沒有螺旋槳) */
export function spinProps() {}
/** 翅膀拍動:近似方波的兩段式拍動(k = 速度倍率) */
export function flapWings(mdl, t, amp = 1) {
  const sq = Math.tanh(Math.sin(t) * 3);
  for (const w of mdl.wings) {
    const s = w.userData.side;
    w.rotation.y = -s * (0.25 + 0.35 * sq) * amp;
    w.rotation.z = s * 0.1 * sq * amp;
  }
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:小祥雲托著一顆仙丹 ----------------
 * 仙丹(道具色)+ 雲 + 點陣字(自己畫的 5x7 字型,不依賴網路字型)。 */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: '法力' },
  R: { label: 'R', color: 0x3ad8ff, name: '疾風' },
  S: { label: 'S', color: 0x3ae07a, name: '金光罩' },
  B: { label: 'B', color: 0xb86aff, name: '天雷' },
  W: { label: 'W', color: 0xffa030, name: '身外身' },
  L: { label: '1UP', color: 0xffc23a, name: '蟠桃' },
};
const GLYPH = {
  P: ['1110', '1001', '1001', '1110', '1000', '1000', '1000'],
  R: ['1110', '1001', '1001', '1110', '1010', '1001', '1001'],
  S: ['0111', '1000', '1000', '0110', '0001', '0001', '1110'],
  B: ['1110', '1001', '1001', '1110', '1001', '1001', '1110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
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
  draw('#1e1a24', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  const cm = cel({ color: 0xffffff, bands: 'soft' });
  for (const [x, y, s] of [[0, -0.3, 0.42], [-0.38, -0.36, 0.28], [0.38, -0.36, 0.28]]) part(body, GEO.ico, cm, [x, y, 0], [s * 1.25, s * 0.8, s * 0.5]);
  part(body, GEO.ico2, cel({ color: it.color, bands: 2 }), [0, 0.05, 0.3], 0.36);
  part(body, GEO.ico, cel({ color: 0xffffff, bands: 2 }), [-0.12, 0.17, 0.58], 0.08); // 反光
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'halo'; ring.position.y = 0.05; root.add(ring);
  const { t, aspect } = labelTex(it.label);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.85 * aspect, 0.85, 1); sp.position.y = 0.05; sp.renderOrder = 5;
  root.add(sp);
  return root;
}

/* ---------------- 子彈:InstancedMesh,一整批只要 2 個 draw call ---------------- */
const SHOT_MAT = flat({ color: PAL.shot, transparent: true, depthWrite: false });
const SHOT_TIP = flat({ color: PAL.shotTip, transparent: true, depthWrite: false });
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

/** 玩家:金色法力彈(水滴形) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico, [0, -0.05, 0], [0.11, 0.42, 0.11]), SHOT_MAT],
    [geoAt(GEO.ico0, [0, 0.22, 0.03], [0.07, 0.14, 0.07]), SHOT_TIP],
  ], cap);
}
/** 敵彈:紫紅色妖氣彈 */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico, [0, 0, 0], [0.2, 0.24, 0.2]), EB_MAT],
    [geoAt(GEO.ico0, [0, 0.02, 0.08], [0.09, 0.12, 0.09]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
