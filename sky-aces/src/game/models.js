import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 所有飛機都用基本幾何體拼出來(沒有模型檔)。
 * local:+y = 機頭、+x = 右翼、+z = 朝鏡頭(機背)。
 * 結構:root(位置 + heading)→ rig(傾斜 / 翻筋斗)→ 機身(依材質烤成少數 mesh)
 *       + 螺旋槳 'prop'(不烤,每幀轉)+ 排氣火焰 'flame'。
 * 每種飛機先做一份樣板,之後用 clone() 共用 geometry / material。
 * 內部型別沿用原本的名字:bee = 戰鬥機、bfly = 俯衝轟炸機、boss = 雙發重戰機、rock = 火箭。
 * ------------------------------------------------------------------ */

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  fuse: new THREE.CylinderGeometry(0.72, 1, 1, 10),   // 機身:機頭端略細
  tail: new THREE.CylinderGeometry(1, 0.28, 1, 10),   // 機尾:往後收尖
};

const M = {
  glass: cel({ color: 0x8fe0ff, bands: 2 }),
  glassDark: cel({ color: 0x3a6a8a, bands: 2 }),
  metal: cel({ color: 0x3a3f4a, bands: 2 }),
  gun: cel({ color: 0x2a2d34, bands: 2 }),
  white: cel({ color: 0xf4f4f0 }),
  black: cel({ color: 0x23262e, bands: 2 }),
  yellow: cel({ color: 0xf2c23a }),
  red: cel({ color: 0xd8322e }),
  // 戰鬥機
  beeBody: cel({ color: PAL.beeBody }),
  beeWing: cel({ color: PAL.beeWing }),
  beeBand: cel({ color: PAL.beeBand }),
  beeBelly: cel({ color: PAL.beeBelly }),
  beeCowl: cel({ color: PAL.antenna, bands: 2 }),
  // 俯衝轟炸機
  bflyBody: cel({ color: PAL.bflyHead }),
  bflyWing: cel({ color: PAL.bflyBody }),
  bflyRim: cel({ color: PAL.bflyRim, bands: 2 }),
  // 重戰機
  bossBody: cel({ color: PAL.bossBody }),
  bossHead: cel({ color: PAL.bossHead }),
  bossInner: cel({ color: PAL.bossInner, bands: 2 }),
  bossHit: cel({ color: PAL.bossHit }),
  bossHitHead: cel({ color: PAL.bossHitHead }),
  bossHitInner: cel({ color: 0x5a2a1a, bands: 2 }),
  // 被抓走的戰機(保留舊機制的樣板,目前玩法用不到)
  capWhite: cel({ color: PAL.captive }),
  capRed: cel({ color: 0xfff0f0 }),
  capBlue: cel({ color: PAL.captiveDark }),
};

/** 重戰機被打第一發之後換色用的對照表(冒火變焦橘) */
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

/** 組樣板:body(fn)烤成一塊,extras(rig) 放不烤的零件(螺旋槳、火焰…) */
function template(bodyFn, scale = 1, extras = null) {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; rig.scale.setScalar(scale); root.add(rig);
  const body = new THREE.Group(); bodyFn(body); rig.add(bake(body));
  if (extras) extras(rig);
  return root;
}

/* ---------------- 翼面:平面多邊形擠出(左右鏡像各一份,依參數快取) ---------------- */
const shapeCache = new Map();
/**
 * pts:右翼(s=+1)的輪廓 [[x, y]...],x 從翼根往外。depth = 厚度。
 * 左翼用鏡像的點重做一份(ExtrudeGeometry 會自己修正繞向)。
 */
function slab(key, pts, s, depth = 0.08) {
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
// 圓弧翼尖的主翼(單位翼展 1,弦長約 0.5)
const WING_PTS = [[0, 0.24], [0.62, 0.17], [0.88, 0.1], [1, -0.02], [0.96, -0.14], [0.8, -0.2], [0, -0.26]];
// 直線翼(轟炸機 / 重戰機)
const WING_STRAIGHT = [[0, 0.28], [1, 0.12], [1.02, -0.06], [0.98, -0.12], [0, -0.28]];
// 水平尾翼
const TAIL_PTS = [[0, 0.14], [0.8, 0.06], [1, -0.04], [0.9, -0.12], [0, -0.14]];
const wing = (s, pts = WING_PTS, key = 'w') => slab(key, pts, s);

/* ---------------- 螺旋槳 ----------------
 * 半透明的旋轉盤 + 3 片槳葉,整組繞 local y 軸轉(機頭方向)。depthWrite:false → 不描黑邊。 */
const DISC_GEO = new THREE.CircleGeometry(1, 24).rotateX(Math.PI / 2);
const DISC_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
const BLADE_GEO = new THREE.BoxGeometry(1, 0.04, 0.12);
function addProp(rig, pos, r, blades = 3, mat = M.gun) {
  const p = new THREE.Group(); p.name = 'prop'; p.position.set(...pos);
  const disc = new THREE.Mesh(DISC_GEO, DISC_MAT); disc.scale.setScalar(r); p.add(disc);
  for (let i = 0; i < blades; i++) {
    const b = new THREE.Mesh(BLADE_GEO, mat);
    b.scale.set(r, 1, 1); b.position.set(Math.cos(i / blades * Math.PI * 2) * r * 0.5, 0, Math.sin(i / blades * Math.PI * 2) * r * 0.5);
    b.rotation.y = -i / blades * Math.PI * 2;
    p.add(b);
  }
  rig.add(p);
  return p;
}
function addFlame(rig, pos, color, scl = [0.07, 0.3, 0.07]) {
  const fm = flat({ color, transparent: true, opacity: 0.9, depthWrite: false });
  const f = part(rig, GEO.cone, fm, pos, scl, [0, 0, Math.PI]);
  f.name = 'flame';
  return f;
}

/* ---------------- 戰鬥機(bee) ---------------- */
function fighterBody(b) {
  part(b, GEO.fuse, M.beeBody, [0, 0.12, 0], [0.18, 1.0, 0.17]);
  part(b, GEO.cyl, M.beeCowl, [0, 0.68, 0], [0.165, 0.17, 0.16]);
  part(b, GEO.cone, M.metal, [0, 0.82, 0], [0.06, 0.12, 0.06]);
  part(b, GEO.tail, M.beeBody, [0, -0.62, 0], [0.155, 0.48, 0.145]);
  part(b, GEO.cyl, M.beeBand, [0, -0.5, 0], [0.152, 0.07, 0.142]);
  part(b, GEO.ico, M.glass, [0, 0.12, 0.13], [0.095, 0.22, 0.09]);
  part(b, GEO.box, M.beeBody, [0, -0.8, 0.13], [0.03, 0.2, 0.2]);
  for (const s of [-1, 1]) {
    part(b, wing(s), M.beeWing, [s * 0.1, 0.16, -0.03], [0.8, 1.05, 1]);
    part(b, GEO.box, M.beeBand, [s * 0.54, 0.32, -0.01], [0.26, 0.035, 0.07], [0, 0, -s * 0.12]); // 黃色前緣
    part(b, wing(s, TAIL_PTS, 't'), M.beeWing, [s * 0.04, -0.8, 0.02], [0.36, 1, 1]);
  }
}
function fighterExtras(rig) { addProp(rig, [0, 0.8, 0], 0.34); }

/* ---------------- 俯衝轟炸機(bfly):長座艙 + 固定起落架 + 掛彈 ---------------- */
function bomberBody(b) {
  part(b, GEO.fuse, M.bflyBody, [0, 0.08, 0], [0.19, 1.15, 0.18]);
  part(b, GEO.cyl, M.bflyRim, [0, 0.7, 0], [0.175, 0.18, 0.17]);
  part(b, GEO.cone, M.metal, [0, 0.84, 0], [0.06, 0.12, 0.06]);
  part(b, GEO.tail, M.bflyBody, [0, -0.7, 0], [0.16, 0.5, 0.15]);
  part(b, GEO.ico, M.glass, [0, 0.02, 0.14], [0.1, 0.36, 0.09]);
  part(b, GEO.box, M.bflyWing, [0, -0.9, 0.15], [0.035, 0.24, 0.26]);
  part(b, GEO.ico, M.metal, [0, 0.1, -0.2], [0.07, 0.24, 0.07]); // 腹下炸彈
  for (const s of [-1, 1]) {
    part(b, wing(s, WING_STRAIGHT, 'ws'), M.bflyWing, [s * 0.1, 0.12, -0.03], [0.8, 1.0, 1]);
    part(b, GEO.box, M.bflyRim, [s * 0.8, 0.1, -0.01], [0.1, 0.44, 0.09]);      // 翼尖
    part(b, GEO.ico, M.bflyRim, [s * 0.34, 0.28, -0.12], [0.06, 0.13, 0.07]);   // 起落架整流罩
    part(b, wing(s, TAIL_PTS, 't'), M.bflyWing, [s * 0.04, -0.9, 0.02], [0.4, 1.05, 1]);
  }
}
function bomberExtras(rig) { addProp(rig, [0, 0.82, 0], 0.36); }

/* ---------------- 雙發重戰機(boss):2 顆引擎、玻璃機鼻、打兩下 ---------------- */
function heavyBody(b) {
  part(b, GEO.fuse, M.bossHead, [0, 0.06, 0], [0.17, 1.2, 0.16]);
  part(b, GEO.ico, M.glass, [0, 0.7, 0.02], [0.13, 0.2, 0.12]);
  part(b, GEO.tail, M.bossHead, [0, -0.72, 0], [0.15, 0.5, 0.14]);
  part(b, GEO.ico, M.glassDark, [0, 0.28, 0.12], [0.09, 0.26, 0.08]);
  part(b, GEO.box, M.bossInner, [0, -0.92, 0.14], [0.035, 0.24, 0.26]);
  for (const s of [-1, 1]) {
    part(b, wing(s, WING_STRAIGHT, 'ws'), M.bossBody, [s * 0.1, 0.1, -0.03], [0.8, 1.0, 1]);
    part(b, GEO.fuse, M.bossInner, [s * 0.5, 0.22, 0.02], [0.12, 0.62, 0.12]); // 引擎艙
    part(b, GEO.cyl, M.metal, [s * 0.5, 0.52, 0.02], [0.11, 0.06, 0.11]);
    part(b, wing(s, TAIL_PTS, 't'), M.bossBody, [s * 0.04, -0.92, 0.02], [0.44, 1.05, 1]);
  }
}
function heavyExtras(rig) { for (const s of [-1, 1]) addProp(rig, [s * 0.5, 0.58, 0.02], 0.3); }

/* ---------------- 玩家戰機(10 段晉升) ----------------
 * 殺敵累積經驗 → 軍階 CADET … LEGEND。每一段加零件、換塗裝:
 *   Lv3 翼砲、Lv4 副油箱、Lv5 起變成雙發雙尾桁(P-38 風格)、Lv6 火箭、Lv7 進攻條紋、
 *   Lv8 三發 + 翼尖凝結尾、Lv9 紅色塗裝 + 排氣火焰、Lv10 金色傳說機 + 光環。
 * 樣板第一次用到才建(spawnModel('ship3') …)。 */
export const SHIP_LV = [
  { name: 'CADET', body: 0xe9edf2, accent: 0xe8322e, pod: 0x2a3f8a, flame: 0xffa53a, span: 1.0 },
  { name: 'ENSIGN', body: 0xe9edf2, accent: 0xff4a2a, pod: 0x2a3f8a, flame: 0xffa53a, span: 1.04 },
  { name: 'PILOT', body: 0xdfe8f2, accent: 0xffc23a, pod: 0x2a4fa8, flame: 0xffb03a, span: 1.08 },
  { name: 'LIEUT.', body: 0xd0dcea, accent: 0xe8322e, pod: 0x2a3f8a, flame: 0xffb03a, span: 1.1 },
  { name: 'CAPTAIN', body: 0x4a6ab8, accent: 0xf4f4f0, pod: 0xffd23a, flame: 0xffc23a, span: 1.12 },
  { name: 'MAJOR', body: 0x34508f, accent: 0xffd23a, pod: 0xe8322e, flame: 0xffc23a, span: 1.14 },
  { name: 'COLONEL', body: 0x8a96a8, accent: 0xe8322e, pod: 0x23262e, flame: 0xffd86a, span: 1.17 },
  { name: 'ACE', body: 0xf0f2f6, accent: 0x23262e, pod: 0xffd23a, flame: 0xfff2a0, span: 1.2 },
  { name: 'TOP ACE', body: 0xc8322e, accent: 0xffe35a, pod: 0xf4f4f0, flame: 0xffffff, span: 1.23 },
  { name: 'LEGEND', body: 0xffc23a, accent: 0xffffff, pod: 0xe8322e, flame: 0xffffff, span: 1.27 },
];

function shipBody(m, L = 1, span = 1) {
  const twin = L >= 5;
  return (b) => {
    // 機身
    part(b, GEO.fuse, m.white, [0, 0.12, 0], [0.19, twin ? 1.05 : 1.15, 0.18]);
    if (twin) {
      part(b, GEO.cone, m.red, [0, 0.82, 0], [0.13, 0.32, 0.12]);            // 機鼻砲艙
    } else {
      part(b, GEO.cyl, m.red, [0, 0.76, 0], [0.18, 0.18, 0.17]);             // 紅色機鼻
      part(b, GEO.cone, m.red, [0, 0.9, 0], [0.065, 0.12, 0.065]);
      part(b, GEO.tail, m.white, [0, -0.7, 0], [0.165, 0.52, 0.155]);
      part(b, GEO.box, m.white, [0, -0.88, 0.14], [0.035, 0.22, 0.24]);
      part(b, GEO.box, m.red, [0, -0.93, 0.25], [0.04, 0.12, 0.06]);
    }
    part(b, GEO.ico, M.glass, [0, 0.2, 0.14], L >= 9 ? [0.12, 0.3, 0.11] : [0.1, 0.24, 0.09]);
    part(b, GEO.box, m.blue, [0, -0.22, 0.17], [0.07, 0.4, 0.02]);            // 機背條紋
    for (const s of [-1, 1]) {
      part(b, wing(s), m.white, [s * 0.1, 0.16, -0.03], [span, 1.05, 1]);
      part(b, GEO.box, m.blue, [s * (0.1 + 0.8 * span), 0.12, 0.02], [0.14, 0.4, 0.05]); // 翼尖色塊
      if (!twin) part(b, wing(s, TAIL_PTS, 't'), m.white, [s * 0.04, -0.86, 0.02], [0.38, 1.05, 1]);
      if (L >= 2) part(b, GEO.box, m.red, [s * 0.36, 0.16, 0.03], [0.16, 0.44, 0.03]);   // 機翼識別帶
      if (L >= 3) for (const gx of [0.48, 0.58]) part(b, GEO.cyl, M.gun, [s * gx * span, 0.42, 0], [0.022, 0.26, 0.022]); // 翼砲
      if (L >= 4 && !twin) part(b, GEO.ico, m.blue, [s * 0.44, 0.08, -0.13], [0.06, 0.22, 0.06]); // 副油箱
      if (twin) {
        // 雙尾桁:引擎艙一路延伸到尾部,兩片垂直尾翼 + 中間的水平尾翼
        const bx = s * 0.5;
        part(b, GEO.fuse, m.white, [bx, 0.1, 0], [0.12, 0.75, 0.12]);
        part(b, GEO.cyl, m.red, [bx, 0.5, 0], [0.115, 0.1, 0.115]);
        part(b, GEO.tail, m.white, [bx, -0.68, 0], [0.1, 0.9, 0.1]);
        part(b, GEO.box, m.white, [bx, -1.04, 0.13], [0.03, 0.22, 0.24]);
        part(b, GEO.box, m.red, [bx, -1.08, 0.24], [0.035, 0.12, 0.06]);
        part(b, GEO.ico, M.gun, [bx, 0.28, 0.1], [0.05, 0.12, 0.05]);         // 增壓器
      }
      if (L >= 6) for (let i = 0; i < 3; i++) {                                 // 翼下火箭
        const rx = s * (0.64 + i * 0.11) * span;
        part(b, GEO.cyl, M.white, [rx, 0.1, -0.08], [0.022, 0.3, 0.022]);
        part(b, GEO.cone, M.red, [rx, 0.28, -0.08], [0.024, 0.06, 0.024]);
      }
      if (L >= 7) for (let i = 0; i < 4; i++)                                   // 進攻條紋(黑白相間)
        part(b, GEO.box, i % 2 ? M.white : M.black, [s * (0.14 + 0.62 * span), 0.06 + (i - 1.5) * 0.08, 0.035], [0.26 * span, 0.075, 0.02]);
    }
    if (twin) part(b, slab('tp', [[-0.55, 0.08], [0.55, 0.08], [0.55, -0.08], [-0.55, -0.08]], 1), m.white, [0, -1.02, 0.02], 1);
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1) {
  const c = SHIP_LV[L - 1];
  const span = c.span, twin = L >= 5;
  return template(shipBody(m, L, span), 1.08 + 0.03 * (L - 1), (rig) => {
    const pm = cel({ color: 0x2a2d34, bands: 2 });
    if (!twin || L >= 8) addProp(rig, [0, twin ? 1.0 : 0.94, 0], twin ? 0.3 : 0.38);
    if (twin) for (const s of [-1, 1]) addProp(rig, [s * 0.5, 0.58, 0], 0.34, 3, pm);
    // 排氣火焰(每幀縮放閃爍):Lv9 以後才明顯
    if (L >= 9) for (const x of twin ? [-0.5, 0.5] : [0]) addFlame(rig, [x, twin ? -1.2 : -1.0, 0], m.flame || PAL.engine, [0.05, 0.26, 0.05]);
    // Lv8 以上:翼尖的白色凝結尾(用 flame 的機制一起閃)
    if (L >= 8) for (const s of [-1, 1]) {
      const t = part(rig, GEO.cone, flat({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
        [s * (0.1 + 0.98 * span), -0.55, 0], [0.025, 1.0, 0.025], [0, 0, Math.PI]);
      t.name = 'flame';
    }
    if (L >= 10) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(1.25, 1.05, 0.45); rig.add(a);
    }
  });
}
function evolvedShip(L) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: cel({ color: c.body }), red: cel({ color: c.accent }), blue: cel({ color: c.pod }), flame: c.flame }, L);
}

/* ---------------- 關底大 BOSS(機頭朝上 = 從玩家後方追上來、被玩家追著打) ---------------- */
const BM = {
  fort: cel({ color: 0x7f8c6c }), fortWing: cel({ color: 0x6c7a5c }), fortDark: cel({ color: 0x3f4838, bands: 2 }),
  wingBody: cel({ color: 0x3a4050 }), wingRed: cel({ color: 0xc83a3a }), wingDark: cel({ color: 0x23262e, bands: 2 }),
  zep: cel({ color: 0xb8bcc8 }), zepBand: cel({ color: 0xc8322e }), zepDark: cel({ color: 0x5a5e6a, bands: 2 }),
  gold: cel({ color: 0xffc83a }), goldDark: cel({ color: 0xc88a1a }), goldLight: cel({ color: 0xfff0a0 }),
};

/** 四發重轟炸機(空中堡壘) */
function fortressBody(b) {
  part(b, GEO.fuse, BM.fort, [0, 0.3, 0], [0.5, 4.2, 0.48]);
  part(b, GEO.ico, M.glass, [0, 2.45, 0.02], [0.4, 0.5, 0.38]);
  part(b, GEO.tail, BM.fort, [0, -2.5, 0], [0.46, 1.4, 0.44]);
  part(b, GEO.ico, M.glass, [0, -3.25, 0.05], [0.18, 0.25, 0.18]);            // 尾砲塔
  part(b, GEO.ico, M.glassDark, [0, 1.3, 0.42], [0.26, 0.26, 0.2]);           // 上砲塔
  part(b, GEO.ico, M.glassDark, [0, -1.0, 0.4], [0.22, 0.22, 0.18]);
  part(b, GEO.box, BM.fort, [0, -2.9, 0.7], [0.1, 0.9, 1.1]);                  // 垂直尾翼
  part(b, GEO.box, M.red, [0, -3.05, 1.15], [0.11, 0.5, 0.25]);
  part(b, GEO.cyl, M.red, [0, -1.7, 0], [0.47, 0.18, 0.45]);                   // 紅色尾帶
  for (const s of [-1, 1]) {
    part(b, wing(s, WING_STRAIGHT, 'ws'), BM.fortWing, [s * 0.35, 0.6, -0.05], [4.4, 2.6, 2]);
    for (const x of [1.35, 2.65]) {
      part(b, GEO.fuse, BM.fortDark, [s * x, 1.05, 0.02], [0.24, 1.2, 0.24]);
      part(b, GEO.cyl, M.metal, [s * x, 1.62, 0.02], [0.22, 0.1, 0.22]);
    }
    part(b, GEO.box, M.red, [s * 4.2, 0.45, 0.05], [0.5, 0.8, 0.12]);
    part(b, wing(s, TAIL_PTS, 't'), BM.fortWing, [s * 0.2, -2.8, 0.05], [1.5, 2.6, 2]);
    part(b, GEO.cyl, M.gun, [s * 0.18, -3.5, 0.05], [0.04, 0.4, 0.04]);        // 尾砲管
  }
}
function fortressExtras(rig) { for (const s of [-1, 1]) for (const x of [1.35, 2.65]) addProp(rig, [s * x, 1.72, 0.02], 0.62); }

/** 飛翼轟炸機:巨大的 V 形翼,後緣 6 具推進式螺旋槳 */
const FW_PTS = [[0, 1.7], [2.2, 0.35], [4.9, -1.25], [5.0, -1.75], [3.8, -1.5], [2.6, -0.95], [1.3, -1.45], [0, -1.2]];
function flyingWingBody(b) {
  for (const s of [-1, 1]) {
    part(b, slab('fw', FW_PTS, s, 0.34), BM.wingBody, [0, 0, 0], 1);
    part(b, slab('fwr', [[0.2, 0.2], [4.6, -1.25], [4.85, -1.6], [0.2, -0.05]], s, 0.36), BM.wingRed, [0, 0, 0.01], 1); // 紅色斜紋
    for (const x of [0.9, 2.0, 3.1]) {
      part(b, GEO.ico, BM.wingDark, [s * x, -0.1 - x * 0.28, 0.18], [0.22, 0.5, 0.14]);   // 引擎隆起
      part(b, GEO.cyl, M.gun, [s * x, 0.2 - x * 0.62, 0.1], [0.05, 0.3, 0.05]);
    }
    part(b, GEO.box, BM.wingRed, [s * 4.75, -1.45, 0.25], [0.08, 0.5, 0.45]);   // 翼尖垂直板
  }
  part(b, GEO.ico, BM.wingDark, [0, 0.4, 0.2], [0.55, 1.2, 0.28]);
  part(b, GEO.ico, M.glass, [0, 1.0, 0.3], [0.28, 0.42, 0.18]);
  part(b, GEO.ico, M.glassDark, [0, -0.5, 0.3], [0.2, 0.2, 0.16]);
}
function flyingWingExtras(rig) {
  for (const s of [-1, 1]) for (const x of [0.9, 2.0, 3.1]) addProp(rig, [s * x, -0.62 - x * 0.28 - 0.35, 0.12], 0.42, 4);
}

/** 飛行船:銀色氣囊 + 紅色環帶 + 砲塔 + 兩側引擎 */
function zeppelinBody(b) {
  part(b, GEO.ico, BM.zep, [0, 0, 0], [1.9, 4.3, 1.5]);
  for (const y of [2.2, 0, -2.2]) part(b, GEO.cyl, BM.zepBand, [0, y, 0], [1.9 * Math.sqrt(1 - (y / 4.3) ** 2) + 0.02, 0.22, 1.5 * Math.sqrt(1 - (y / 4.3) ** 2) + 0.02]);
  part(b, GEO.ico, BM.zepDark, [0, 0.4, 1.35], [0.45, 1.3, 0.25]);             // 背上的艦橋
  for (const y of [1.6, -0.9]) {
    part(b, GEO.ico, M.gun, [0, y, 1.45], [0.28, 0.28, 0.22]);
    part(b, GEO.cyl, M.gun, [0, y + 0.45, 1.5], [0.05, 0.6, 0.05]);
  }
  for (const s of [-1, 1]) {
    part(b, GEO.box, BM.zepBand, [s * 1.35, -3.6, 0], [1.1, 1.0, 0.1], [0, 0, s * 0.15]);   // 尾翼
    part(b, GEO.ico, BM.zepDark, [s * 2.05, 0.9, 0], [0.28, 0.6, 0.28]);            // 引擎艙
    part(b, GEO.ico, BM.zepDark, [s * 2.05, -1.8, 0], [0.26, 0.55, 0.26]);
    part(b, GEO.box, BM.zepDark, [s * 1.85, 0.9, 0], [0.4, 0.12, 0.06]);
    part(b, GEO.box, BM.zepDark, [s * 1.85, -1.8, 0], [0.4, 0.12, 0.06]);
  }
  part(b, GEO.box, BM.zepBand, [0, -3.6, 0.9], [0.1, 1.0, 1.1]);
}
function zeppelinExtras(rig) {
  for (const s of [-1, 1]) for (const y of [0.9, -1.8]) addProp(rig, [s * 2.05, y - 0.7, 0], 0.5, 4);
}

/** 黃金運輸機(獎勵關):不攻擊,打得到就大賺 */
function goldBody(b) {
  part(b, GEO.fuse, BM.gold, [0, 0.2, 0], [0.42, 2.8, 0.4]);
  part(b, GEO.ico, M.glass, [0, 1.65, 0.12], [0.3, 0.35, 0.25]);
  part(b, GEO.tail, BM.gold, [0, -1.75, 0], [0.38, 1.0, 0.36]);
  part(b, GEO.box, BM.goldDark, [0, -2.1, 0.55], [0.08, 0.6, 0.8]);
  part(b, GEO.box, BM.goldLight, [0, 0.2, 0.4], [0.1, 1.8, 0.04]);
  for (const s of [-1, 1]) {
    part(b, wing(s, WING_STRAIGHT, 'ws'), BM.goldDark, [s * 0.3, 0.45, -0.03], [2.6, 1.9, 1.5]);
    part(b, GEO.fuse, BM.gold, [s * 1.2, 0.75, 0.02], [0.22, 1.0, 0.22]);
    part(b, wing(s, TAIL_PTS, 't'), BM.goldDark, [s * 0.1, -2.1, 0.03], [1.0, 1.8, 1.5]);
  }
}
function goldExtras(rig) { for (const s of [-1, 1]) addProp(rig, [s * 1.2, 1.32, 0.02], 0.55); }

function bigTemplate(kind) {
  if (kind === 'fortress') return template(fortressBody, 1, fortressExtras);
  if (kind === 'flyingwing') return template(flyingWingBody, 1, flyingWingExtras);
  if (kind === 'zeppelin') return template(zeppelinBody, 1, zeppelinExtras);
  return template(goldBody, 1, goldExtras);
}

/* ---------------- 火箭(ROCKET 關卡:原本的隕石) ---------------- */
function rocketBody(b) {
  part(b, GEO.cyl, cel({ color: 0x8a9098 }), [0, 0, 0], [0.22, 1.5, 0.22]);
  part(b, GEO.cone, M.red, [0, 0.95, 0], [0.22, 0.42, 0.22]);
  part(b, GEO.cyl, M.yellow, [0, 0.45, 0], [0.225, 0.12, 0.225]);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    part(b, GEO.box, M.black, [Math.cos(a) * 0.28, -0.6, Math.sin(a) * 0.28], [0.3, 0.4, 0.04], [0, -a, 0]);
  }
}
function rocketTemplate() {
  return template(rocketBody, 1, (rig) => {
    const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
      [0, -1.35, 0], [0.2, 0.9, 0.2], [0, 0, Math.PI]);
    tail.name = 'flame';
  });
}

const TEMPLATES = {
  bee: template(fighterBody, 1.0, fighterExtras),
  bfly: template(bomberBody, 1.0, bomberExtras),
  boss: template(heavyBody, 1.04, heavyExtras),
  captive: shipTemplate({ white: M.capWhite, red: M.capRed, blue: M.capBlue }),
  rock: rocketTemplate(),
};
function lazyTemplate(type) {
  if (TEMPLATES[type]) return TEMPLATES[type];
  if (type.startsWith('ship')) TEMPLATES[type] = evolvedShip(+type.slice(4) || 1);
  else if (type.startsWith('big_')) TEMPLATES[type] = bigTemplate(type.slice(4));
  else if (type.startsWith('item_')) TEMPLATES[type] = itemTemplate(type.slice(5));
  return TEMPLATES[type];
}

/**
 * 產生一架飛機。回傳 { root, rig, wings[], flames[], props[], meshes[], halo, aura, spin }。
 * clone 共用 geometry / material;要換色(重戰機被打)就換單一 mesh 的 material。
 */
export function spawnModel(type) {
  const root = lazyTemplate(type).clone(true);
  const rig = root.getObjectByName('rig');
  const wings = [], flames = [], meshes = [], props = [];
  root.traverse((o) => {
    if (o.name === 'flame') flames.push(o);
    if (o.name === 'prop') { props.push(o); o.rotation.y = Math.random() * 6; }
    if ((o.isMesh || o.isSprite) && !o.parent?.name?.startsWith('prop') && o.material !== DISC_MAT) meshes.push(o);
  });
  return {
    root, rig, wings, flames, props, meshes, type,
    halo: root.getObjectByName('halo'), aura: root.getObjectByName('aura'), spin: root.getObjectByName('spin'),
  };
}
/** 螺旋槳轉動(每幀呼叫) */
export function spinProps(mdl, dt, k = 1) { for (const p of mdl.props) p.rotation.y += dt * 38 * k; }
export function flapWings() {}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:降落傘補給箱 ----------------
 * 箱子(道具色)+ 白色降落傘 + 點陣字(自己畫的 5x7 字型,不依賴網路字型)。 */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: 'POWER UP' },
  R: { label: 'R', color: 0x3ad8ff, name: 'RAPID FIRE' },
  S: { label: 'S', color: 0x3ae07a, name: 'SHIELD' },
  B: { label: 'B', color: 0xb86aff, name: 'AIR STRIKE' },
  W: { label: 'W', color: 0x4a8aff, name: 'WINGMAN' },
  L: { label: '1UP', color: 0xffc23a, name: '1UP' },
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
  draw('#14203a', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
const CHUTE_GEO = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2);
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.box, cel({ color: it.color, bands: 2 }), [0, -0.1, 0], [0.62, 0.62, 0.62]);
  part(body, GEO.box, cel({ color: 0xffffff, bands: 2 }), [0, -0.1, 0], [0.66, 0.14, 0.66]);
  // 降落傘:從上方看是一個圓頂(機頭方向 = 畫面上方),四條傘繩
  const chuteMat = cel({ color: 0xf4f4f0, bands: 2 });
  part(body, CHUTE_GEO, chuteMat, [0, 0.95, 0.35], [0.85, 0.5, 0.5]);
  part(body, GEO.box, cel({ color: it.color, bands: 2 }), [0, 0.95, 0.62], [0.18, 0.5, 0.18]);
  for (const s of [-1, 1]) part(body, GEO.cyl, M.gun, [s * 0.4, 0.45, 0.18], [0.015, 0.75, 0.015], [0, 0, s * 0.45]);
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'halo'; ring.position.y = -0.1; root.add(ring);
  // 字不跟著箱子晃(放在 root),永遠正對鏡頭、疊在箱子正上方
  const { t, aspect } = labelTex(it.label);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.85 * aspect, 0.85, 1); sp.position.y = -0.1; sp.renderOrder = 5;
  root.add(sp);
  return root;
}

/* ---------------- 子彈:InstancedMesh,一整批只要 2 個 draw call ---------------- */
const SHOT_MAT = flat({ color: PAL.shot, transparent: true, depthWrite: false });
const SHOT_TIP = flat({ color: PAL.shotTip, transparent: true, depthWrite: false });
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

/** 玩家:機槍曳光彈(細長黃色 + 橘色彈頭) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.cyl, [0, -0.1, 0], [0.055, 0.8, 0.055]), SHOT_MAT],
    [geoAt(GEO.cone, [0, 0.38, 0], [0.075, 0.2, 0.075]), SHOT_TIP],
  ], cap);
}
/** 敵彈:橘紅色發光彈 */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico, [0, 0, 0], [0.19, 0.24, 0.19]), EB_MAT],
    [geoAt(GEO.ico0, [0, 0.02, 0.08], [0.09, 0.12, 0.09]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
