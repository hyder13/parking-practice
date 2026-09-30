import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 小法老的角色:Q 版小法老、聖貓、木乃伊、聖甲蟲、胡狼守衛。全部用基本幾何體拼出來(沒有模型檔)。
 * 顏色只用壁畫的礦物顏料(赭黃 / 赭紅 / 埃及藍 / 孔雀石綠 / 金 / 黑 / 米白),palette.js TOON 會把它們壓成平塗。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:角色在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。角色模型「不跟著前進方向旋轉」(userData.upright)。
 * 內部型別沿用原本的名字:bee = 木乃伊、bfly = 聖甲蟲、boss = 胡狼守衛(打兩下)、rock = 滾來的石球。
 * ------------------------------------------------------------------ */

export const GROUND_Z = 1.6;
const LEAN = 0.62;

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  oct: new THREE.OctahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  thin: new THREE.TorusGeometry(1, 0.08, 5, 24),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
  disc: new THREE.CircleGeometry(1, 22),
};

const C = (color, bands = 2) => cel({ color, bands, tint: 0x8a6a4a });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair), eye: flat({ color: 0x14100c }), eyeW: flat({ color: 0xf4ecd8 }),
  linen: C(0xf4ecd8), gold: C(0xe8b830), gold2: C(0xc8902a), blue: C(0x2a5ab8), lapis: C(0x1a3a8a), turq: C(0x3ab8a8),
  green: C(0x3a8a4a), red: C(0xc83a1a), ochre: C(0xdcaa5a), stone: C(0xd8c098), stone2: C(0xb89a6a), dark: C(0x14100c),
  glowRed: flat({ color: 0xff3a1a }), glowGold: flat({ color: 0xffe070 }), glowTurq: flat({ color: 0x6af0e0 }),
  // 木乃伊
  wrap: C(PAL.beeBody), wrap2: C(PAL.beeBelly), wrap3: C(PAL.beeBand),
  // 聖甲蟲
  scarab: C(PAL.bflyBody), scarabHead: C(PAL.bflyHead),
  // 胡狼守衛(被打一下項圈掉色、眼睛變紅)
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0xc85a2a),
  capWhite: C(PAL.captive), capRed: C(0xf4ecd8), capBlue: C(PAL.captiveDark),
};

/** 胡狼守衛被打第一下之後換色用的對照表 */
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
/** 兩點之間的一根棒子,在 XY 平面上 */
function rod(parent, mat, a, b, r, z = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  return part(parent, GEO.cyl, mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [r, L, r], [0, 0, Math.atan2(-dx, dy)]);
}
/** 生命之符(ankh):上面一個圈 + 一橫 + 一直 */
function ankh(parent, mat, pos, s) {
  const g = new THREE.Group(); g.position.set(...pos); g.scale.setScalar(s); parent.add(g);
  part(g, GEO.torus, mat, [0, 0.32, 0], [0.16, 0.2, 0.5]);
  part(g, GEO.box, mat, [0, 0.1, 0], [0.5, 0.08, 0.08]);
  part(g, GEO.box, mat, [0, -0.2, 0], [0.09, 0.5, 0.08]);
  return g;
}
/** 荷魯斯之眼那種粗粗的眼線眼睛(面朝 +z) */
function paintedEye(parent, pos, s, x) {
  part(parent, GEO.ico2, M.eyeW, [pos[0], pos[1], pos[2]], [0.07 * s, 0.045 * s, 0.02 * s]);
  part(parent, GEO.ico, M.eye, [pos[0], pos[1], pos[2] + 0.015 * s], [0.035 * s, 0.035 * s, 0.02 * s]);
  part(parent, GEO.box, M.eye, [pos[0], pos[1] + 0.05 * s, pos[2] + 0.01 * s], [0.16 * s, 0.022 * s, 0.02 * s]);  // 眉線
  part(parent, GEO.box, M.eye, [pos[0] + x * 0.09 * s, pos[1] - 0.005 * s, pos[2] + 0.01 * s], [0.08 * s, 0.018 * s, 0.02 * s], [0, 0, -x * 0.15]); // 眼尾
}

function bake(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal' && n !== 'uv') g.deleteAttribute(n);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
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

/* ---------------- 地面陰影 ---------------- */
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x3a2410, transparent: true, opacity: 0.3, depthWrite: false });
function addShadow(root, rx, ry) {
  const s = new THREE.Mesh(GEO.disc, SHADOW_MAT);
  s.name = 'shadow'; s.scale.set(rx, ry, 1); s.position.z = -GROUND_Z + 0.04;
  s.userData.base = [rx, ry];
  root.add(s);
}

/**
 * 組樣板:body(fn)烤成一塊,extras(rig) 放不烤的零件(翅膀、光環…)。
 * opts.shadow = [rx, ry];opts.upright = 角色模型(不跟著前進方向轉)。
 */
function template(bodyFn, scale = 1, extras = null, opts = {}) {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; rig.scale.setScalar(scale); root.add(rig);
  const body = new THREE.Group(); bodyFn(body); rig.add(bake(body));
  if (extras) extras(rig);
  if (opts.shadow) addShadow(root, opts.shadow[0] * scale, opts.shadow[1] * scale);
  root.userData.upright = !!opts.upright;
  return root;
}

/* ---------------- Q 版人偶 ----------------
 * 在人偶自己的座標系裡蓋(站姿:頭 +y、臉 +z),最後整組往後仰 LEAN,放到 at。
 * o:{ body, pants, head(髮 / 頭巾)、face、boots、big、noFace、extra(g, hg) } */
function chibi(b, at, s, o) {
  const g = new THREE.Group();
  part(g, GEO.ico, o.pants || o.body, [0, -0.5, 0], [0.24, 0.2, 0.2]);
  part(g, GEO.ico, o.body, [0, -0.2, 0], [0.27, 0.26, 0.22]);
  for (const x of [-1, 1]) {
    part(g, GEO.ico, o.arms || o.body, [x * 0.29, -0.22, 0.02], [0.09, 0.17, 0.09], [0, 0, x * 0.35]);
    part(g, GEO.ico, o.boots || M.dark, [x * 0.11, -0.7, 0.02], [0.08, 0.08, 0.1]);
  }
  const hg = new THREE.Group(); hg.position.set(0, 0.28 + ((o.big || 1) - 1) * 0.22, 0); hg.scale.setScalar(o.big || 1); g.add(hg);
  part(hg, GEO.ico2, o.face || M.skin, [0, 0, 0.02], 0.3);
  part(hg, GEO.ico2, o.head || M.hair, [0, 0.08, -0.06], [0.32, 0.3, 0.3]);
  if (!o.noFace) for (const x of [-1, 1]) paintedEye(hg, [x * 0.1, 0.0, 0.29], 1, x);
  if (o.extra) o.extra(g, hg);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}
/** 在自己的座標系裡站著(臉朝 +z),最後整個往後仰 LEAN(跟人偶一樣) */
function standing(b, fn, at = [0, 0, 0.2], s = 1) {
  const g = new THREE.Group(); fn(g);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}
/** 法老頭巾(nemes):藍金條紋的頭巾 + 兩片垂到肩膀的布 */
function nemes(hg, cA, cB, s = 1) {
  part(hg, GEO.ico2, cA, [0, 0.1 * s, -0.04 * s], [0.34 * s, 0.3 * s, 0.32 * s]);
  for (let i = 0; i < 4; i++) part(hg, GEO.torus, cB, [0, (0.02 + i * 0.08) * s, -0.04 * s], [(0.34 - i * 0.03) * s, (0.33 - i * 0.03) * s, 0.25 * s], [Math.PI / 2 + 0.25, 0, 0]);
  part(hg, GEO.box, cB, [0, 0.2 * s, 0.22 * s], [0.5 * s, 0.05 * s, 0.1 * s]);                    // 額頭的金帶
  for (const x of [-1, 1]) {
    const lap = new THREE.Group(); lap.position.set(x * 0.28 * s, -0.22 * s, 0.05 * s); hg.add(lap);
    for (let i = 0; i < 4; i++) part(lap, GEO.box, i % 2 ? cB : cA, [0, -i * 0.07 * s, 0], [0.16 * s, 0.07 * s, 0.08 * s]); // 垂下來的條紋布
  }
}

/* ---------------- 木乃伊(bee):一圈圈的繃帶 + 繃帶縫裡發亮的眼睛 + 兩手往前伸 ---------------- */
function mummy(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.wrap, pants: M.wrap, face: M.wrap, head: M.wrap, boots: M.wrap2, noFace: true,
    extra(g, hg) {
      for (let i = 0; i < 5; i++) part(hg, GEO.torus, i % 2 ? M.wrap2 : M.wrap3, [0, -0.15 + i * 0.08, 0], [0.3 - Math.abs(i - 2) * 0.03, 0.3 - Math.abs(i - 2) * 0.03, 0.2], [Math.PI / 2 + (i % 2 ? 0.2 : -0.15), 0, 0]);
      part(hg, GEO.box, M.dark, [0, 0.02, 0.28], [0.3, 0.07, 0.02]);                                   // 繃帶的縫
      for (const x of [-1, 1]) part(hg, GEO.ico, M.glowGold, [x * 0.08, 0.02, 0.3], [0.04, 0.03, 0.02]); // 發亮的眼睛
      for (let i = 0; i < 4; i++) part(g, GEO.torus, i % 2 ? M.wrap2 : M.wrap3, [0, -0.1 - i * 0.12, 0], [0.26, 0.24, 0.2], [Math.PI / 2 + (i % 2 ? 0.25 : -0.2), 0, 0]);
      for (const x of [-1, 1]) {
        rod(g, M.wrap, [x * 0.2, -0.12], [x * 0.24, -0.1], 0.08, 0.25);                                // 往前伸的手
        part(g, GEO.ico, M.wrap2, [x * 0.24, -0.1, 0.34], 0.08);
      }
      part(g, GEO.box, M.wrap2, [0.18, -0.55, 0.12], [0.05, 0.25, 0.02], [0, 0, 0.3]);                 // 鬆掉的繃帶
    },
  });
}

/* ---------------- 聖甲蟲(bfly):藍綠色的圓殼 + 金色的頭和前腳 + 兩片翅膀 ---------------- */
function scarab(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.scarab, [0, -0.05, 0], [0.26, 0.3, 0.2]);                                    // 殼
    part(g, GEO.box, M.dark, [0, -0.05, 0.19], [0.02, 0.5, 0.02]);                                   // 殼中間的線
    part(g, GEO.ico2, M.scarabHead, [0, 0.28, 0.05], [0.16, 0.1, 0.12]);                             // 金色的頭
    for (let i = 0; i < 5; i++) part(g, GEO.box, M.scarabHead, [(i - 2) * 0.05, 0.37, 0.08], [0.03, 0.06, 0.03]); // 頭上的鋸齒
    for (const x of [-1, 1]) {
      part(g, GEO.ico, M.glowTurq, [x * 0.07, 0.28, 0.15], 0.03);
      for (let k = 0; k < 3; k++) rod(g, M.dark, [x * 0.18, 0.1 - k * 0.15], [x * 0.34, 0.2 - k * 0.2], 0.018, 0.02); // 腳
    }
    part(g, GEO.disc, M.red, [0, 0.55, -0.05], 0.12);                                                  // 推著的太陽
  }, [0, 0.1, 0.35]);
}
function scarabWingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.05); s.quadraticCurveTo(0.4, 0.3, 0.7, 0.1); s.lineTo(0.62, -0.02); s.lineTo(0.5, 0.04); s.lineTo(0.42, -0.08); s.lineTo(0.3, 0.0); s.quadraticCurveTo(0.12, -0.08, 0, -0.05);
  return new THREE.ShapeGeometry(s);
}
const SCARAB_WING = scarabWingGeo();
function scarabWings(rig, s = 1) {
  const wm = cel({ color: PAL.bflyWing, bands: 2, side: THREE.DoubleSide, tint: 0x8a6a4a });
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(SCARAB_WING, wm);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.6; f.userData.freq = 3.2;
    f.position.set(side * 0.18 * s, 0.1 * s, 0.3 * s); f.scale.set(side * s, s, 1); f.rotation.x = LEAN;
    rig.add(f);
  }
}

/* ---------------- 胡狼守衛(boss):黑色的胡狼頭(長吻 + 尖耳朵)+ 金色寬項圈 + 白色短裙 + 長矛,打兩下 ---------------- */
function jackal(b) {
  chibi(b, [0, 0, 0.25], 1.25, {
    body: M.bossBody, pants: M.linen, face: M.bossHead, head: M.bossHead, boots: M.bossBody, noFace: true,
    extra(g, hg) {
      part(hg, GEO.ico2, M.bossHead, [0, -0.02, 0.3], [0.13, 0.11, 0.22]);                              // 長吻
      part(hg, GEO.ico, M.dark, [0, 0.0, 0.5], 0.04);
      for (const x of [-1, 1]) {
        part(hg, GEO.cone4, M.bossHead, [x * 0.15, 0.4, -0.02], [0.08, 0.34, 0.05], [0, 0, -x * 0.12]); // 尖耳朵
        part(hg, GEO.cone4, M.bossInner, [x * 0.15, 0.38, 0.01], [0.04, 0.24, 0.02], [0, 0, -x * 0.12]);
        part(hg, GEO.ico, M.glowGold, [x * 0.1, 0.1, 0.26], [0.05, 0.025, 0.02]);                       // 金色的眼
      }
      part(hg, GEO.torus, M.bossInner, [0, -0.28, 0.02], [0.3, 0.3, 0.6], [Math.PI / 2, 0, 0]);        // 寬項圈
      part(hg, GEO.torus, M.blue, [0, -0.33, 0.02], [0.3, 0.3, 0.4], [Math.PI / 2, 0, 0]);
      part(g, GEO.cyl, M.bossInner, [0, -0.38, 0], [0.26, 0.06, 0.22]);                                   // 金腰帶
      rod(g, M.gold2, [0.38, -0.7], [0.4, 0.6], 0.025, 0.12);                                             // 長矛
      part(g, GEO.cone4, M.gold, [0.4, 0.7, 0.12], [0.06, 0.2, 0.03]);
      ankh(g, M.bossInner, [-0.38, -0.25, 0.14], 0.4);                                                   // 手上的生命之符
    },
  });
}

/* ---------------- 玩家:小法老(10 段) ----------------
 * 藍金條紋頭巾 + 白色亞麻短裙 + 金色腰帶 + 右手的太陽權杖。每一段加零件:
 *   Lv2 額頭的眼鏡蛇、Lv3 彩色寬項圈、Lv4 左手的彎鉤權杖、Lv5 金臂環、Lv6 背後的披風、
 *   Lv7 荷魯斯的翅膀、Lv8 太陽光暈、Lv9 頭上的太陽圓盤、Lv10 身後一圈帶翅膀的太陽光環。
 * 'ally' = 聖貓(黑貓 + 金耳環 + 項圈)。 */
export const SHIP_LV = [
  { name: '小王子', body: 0x2a5ab8, accent: 0xe8b830, pod: 0xc83a1a, flame: 0xfff0b0, span: 1.0 },
  { name: '王子', body: 0x2a5ab8, accent: 0xe8b830, pod: 0xc83a1a, flame: 0xfff0b0, span: 1.02 },
  { name: '王儲', body: 0x2a5ab8, accent: 0xe8b830, pod: 0xc83a1a, flame: 0xfff0b0, span: 1.04 },
  { name: '小法老', body: 0x2450a8, accent: 0xf0c040, pod: 0xb8301a, flame: 0xfff0b0, span: 1.06 },
  { name: '上下埃及之王', body: 0x2450a8, accent: 0xf0c040, pod: 0xb8301a, flame: 0xfff4c0, span: 1.08 },
  { name: '尼羅河之主', body: 0x1e4898, accent: 0xf0c040, pod: 0x3ab8a8, flame: 0xfff4c0, span: 1.1 },
  { name: '荷魯斯之子', body: 0x1e4898, accent: 0xffc848, pod: 0x3ab8a8, flame: 0xfff8d0, span: 1.12 },
  { name: '太陽的化身', body: 0x1a3a8a, accent: 0xffc848, pod: 0x3ab8a8, flame: 0xfff8d0, span: 1.14 },
  { name: '萬王之王', body: 0x1a3a8a, accent: 0xffd050, pod: 0xe8b830, flame: 0xffffff, span: 1.16 },
  { name: '太陽之子', body: 0x14307a, accent: 0xffe070, pod: 0xe8b830, flame: 0xffffff, span: 1.2 },
];

function pharaohBody(m, L) {
  return (b) => {
    chibi(b, [0, 0, 0.3], 1.25, {
      body: M.skin, arms: M.skin, pants: M.linen, face: M.skin, head: m.red, boots: M.gold2, big: 1.3,
      extra(g, hg) {
        nemes(hg, m.red, m.gold);                                                                             // 條紋頭巾
        part(hg, GEO.box, m.gold, [0, -0.36, 0.14], [0.05, 0.14, 0.04]);                                     // 假鬍子
        part(g, GEO.box, M.linen, [0, -0.45, 0.02], [0.52, 0.3, 0.42]);                                       // 白色短裙
        part(g, GEO.box, m.gold, [0, -0.45, 0.24], [0.1, 0.28, 0.02]);                                        // 裙子中間的金片
        part(g, GEO.cyl, m.gold, [0, -0.32, 0], [0.27, 0.05, 0.23]);                                          // 金腰帶
        part(g, GEO.torus, m.gold, [0, -0.02, 0.02], [0.2, 0.2, 0.5], [Math.PI / 2, 0, 0]);                  // 金項圈
        // 太陽權杖
        rod(g, m.gold, [0.36, -0.45], [0.4, 0.35], 0.025, 0.14);
        part(g, GEO.disc, M.red, [0.4, 0.46, 0.14], 0.08);
        part(g, GEO.thin, m.gold, [0.4, 0.46, 0.15], [0.08, 0.08, 0.4]);
        if (L >= 2) {                                                                                          // 額頭的眼鏡蛇
          part(hg, GEO.cyl, m.gold, [0, 0.27, 0.27], [0.03, 0.12, 0.03]);
          part(hg, GEO.ico2, m.gold, [0, 0.34, 0.28], [0.05, 0.04, 0.03]);
        }
        if (L >= 3) for (const [r, mat] of [[0.26, M.turq], [0.3, M.red], [0.34, M.lapis]]) part(g, GEO.torus, mat, [0, 0.02 - r * 0.3, 0.02], [r, r * 0.9, 0.35], [Math.PI / 2 - 0.2, 0, 0]); // 彩色寬項圈
        if (L >= 4) {                                                                                          // 彎鉤權杖
          rod(g, m.blue === M.capBlue ? M.gold : M.lapis, [-0.36, -0.4], [-0.34, 0.15], 0.025, 0.14);
          part(g, GEO.halfRing, m.gold, [-0.28, 0.16, 0.14], [0.07, 0.07, 0.3], [0, 0, 0]);
        }
        if (L >= 5) for (const x of [-1, 1]) part(g, GEO.cyl, m.gold, [x * 0.3, -0.18, 0.02], [0.08, 0.05, 0.08], [0, 0, x * 0.35]); // 金臂環
        if (L >= 6) part(g, GEO.box, m.blue, [0, -0.25, -0.2], [0.56, 0.62, 0.03], [0.2, 0, 0]);                         // 披風
        if (L >= 7) for (const x of [-1, 1]) {                                                                // 荷魯斯的翅膀(一層層的羽毛)
          for (let k = 0; k < 3; k++) part(g, GEO.box, [M.turq, M.lapis, m.gold][k], [x * (0.4 + k * 0.06), -0.1 - k * 0.07, -0.12], [0.34 - k * 0.04, 0.07, 0.03], [0, 0, -x * (0.55 - k * 0.1)]);
        }
        if (L >= 9) { part(hg, GEO.disc, M.red, [0, 0.5, -0.1], 0.14); part(hg, GEO.thin, m.gold, [0, 0.5, -0.09], [0.14, 0.14, 0.4]); } // 太陽圓盤
      },
    });
  };
}
/** 聖貓(僚機):坐著的黑貓 + 金耳環 + 藍金項圈 + 綠眼睛 */
function catBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.dark, [0, -0.35, -0.05], [0.28, 0.4, 0.3]);                                     // 坐著的身體
    part(g, GEO.ico2, M.dark, [0, 0.15, 0.05], [0.22, 0.2, 0.2]);                                       // 頭
    for (const x of [-1, 1]) {
      part(g, GEO.cone4, M.dark, [x * 0.13, 0.38, 0.02], [0.07, 0.18, 0.05], [0, 0, -x * 0.2]);        // 耳朵
      part(g, GEO.ico2, M.glowTurq, [x * 0.08, 0.17, 0.22], [0.045, 0.035, 0.02]);                     // 綠眼睛
      part(g, GEO.box, M.dark, [x * 0.08, 0.17, 0.24], [0.012, 0.035, 0.01]);
      part(g, GEO.ico2, M.dark, [x * 0.1, -0.7, 0.12], [0.07, 0.05, 0.1]);                             // 前腳
    }
    part(g, GEO.thin, M.gold, [0.2, 0.22, 0.02], [0.05, 0.05, 0.5], [0, Math.PI / 2, 0]);               // 金耳環
    part(g, GEO.torus, M.blue, [0, -0.02, 0.05], [0.16, 0.16, 0.4], [Math.PI / 2, 0, 0]);               // 項圈
    part(g, GEO.oct, M.gold, [0, -0.1, 0.2], 0.05);
    part(g, GEO.torus, M.dark, [0.28, -0.6, -0.05], [0.14, 0.12, 0.4], [0, 0, 0]);                     // 捲起來的尾巴
  }, [0, 0, 0.3], 1.3);
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1, ally = false) {
  return template(ally ? catBody : pharaohBody(m, L), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下的金色光
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], m.flame || 0xfff0b0, [0.1, L >= 8 ? 0.45 : 0.3, 0.08], L >= 8 ? 0.8 : 0.5);
    if (ally) return;
    if (L >= 10) {                                                                                         // 帶翅膀的太陽
      const h = new THREE.Group(); h.name = 'halo'; h.position.set(0, 0.4, -0.25); rig.add(h);
      part(h, GEO.disc, flat({ color: 0xd83a1a }), [0, 0, 0], 0.4);
      part(h, GEO.thin, flat({ color: 0xffd040 }), [0, 0, 0.01], [0.42, 0.42, 0.3]);
      for (const x of [-1, 1]) for (let k = 0; k < 4; k++) part(h, GEO.box, flat({ color: [0x3ab8a8, 0x2a5ab8, 0xffd040, 0xd83a1a][k] }), [x * (0.75 + k * 0.05), -0.05 - k * 0.1, 0], [0.8 - k * 0.12, 0.09, 0.02], [0, 0, x * 0.12]);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xfff0b0 : 0xffe080, transparent: true, opacity: L >= 10 ? 0.16 : 0.11, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(0.9, 1.1, 0.45); rig.add(a);
    }
  }, { shadow: [0.5, 0.4], upright: true });
}
function evolvedShip(L, ally = false) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: C(0xf4ecd8), red: C(c.body), blue: C(c.pod), gold: C(c.accent), flame: c.flame }, L, ally);
}
function addFlame(rig, pos, color, scl, opacity = 0.9) {
  const fm = flat({ color, transparent: true, opacity, depthWrite: false });
  const f = part(rig, GEO.cone, fm, pos, scl, [0, 0, Math.PI]);
  f.name = 'flame';
  return f;
}

/* ---------------- 古老的守護者(面朝玩家) ---------------- */
const BM = {
  lion: C(0xdcaa5a), lion2: C(0xb8843a), snake: C(0x3a8a4a), snake2: C(0xe8b830), belly: C(0xecd092),
  scorp: C(0x8a3a1a), scorp2: C(0x5a2410), mask: C(0xe8b830), mask2: C(0xc8902a),
  hood: cel({ color: 0x2a7a3a, bands: 2, side: THREE.DoubleSide, tint: 0x8a6a4a }),
  sand: C(0xdcb46e), fire: new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
};

/** 人面獅身:趴著的獅子身體 + 戴著條紋頭巾的人臉(正對玩家)+ 兩隻前爪 */
function sphinxBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.lion, [0, -0.6, -0.4], [1.1, 0.6, 1.0]);                                      // 趴著的身體
    for (const x of [-1, 1]) {
      part(g, GEO.box, BM.lion, [x * 0.6, -1.0, 0.5], [0.35, 0.3, 1.0]);                               // 前腳
      for (let k = 0; k < 3; k++) part(g, GEO.ico, BM.lion2, [x * 0.6 + (k - 1) * 0.1, -1.05, 1.02], 0.07); // 爪子
    }
    const hg = new THREE.Group(); hg.position.set(0, 0.35, 0.2); g.add(hg);
    part(hg, GEO.ico2, BM.lion, [0, 0, 0.1], [0.55, 0.62, 0.5]);                                         // 臉
    nemes(hg, M.blue, M.gold, 1.95);                                                                      // 頭巾
    for (const x of [-1, 1]) paintedEye(hg, [x * 0.2, 0.05, 0.56], 2.2, x);
    part(hg, GEO.box, BM.lion2, [0, -0.12, 0.6], [0.08, 0.2, 0.06]);                                     // 鼻子
    part(hg, GEO.box, M.red, [0, -0.3, 0.58], [0.22, 0.04, 0.03]);                                       // 嘴
    part(hg, GEO.box, M.gold, [0, -0.62, 0.45], [0.1, 0.28, 0.08]);                                      // 假鬍子
    part(hg, GEO.cyl, M.gold, [0, 0.52, 0.52], [0.05, 0.2, 0.05]);                                        // 額頭的眼鏡蛇
    part(hg, GEO.ico2, M.gold, [0, 0.64, 0.54], [0.08, 0.07, 0.05]);
  }, [0, 0.4, 0.8], 1.6);
}
function sandRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ankh(spin, i % 2 ? M.gold : M.turq, [Math.cos(a) * 3.1, Math.sin(a) * 2.9 + 0.4, 0.9], 0.8); }
  rig.add(spin);
}
/** 巨蛇:盤起來的綠色大蛇 + 張開的頸部(正對玩家)+ 金色的眼 + 分岔的舌頭 */
function snakeBody(b) {
  standing(b, (g) => {
    for (let i = 0; i < 3; i++) part(g, GEO.torus, i % 2 ? BM.snake2 : BM.snake, [0, -0.95 + i * 0.22, 0], [1.1 - i * 0.2, 1.0 - i * 0.18, 1.6], [Math.PI / 2, 0, 0]); // 盤起來的身體
    part(g, GEO.cyl, BM.snake, [0, -0.1, 0.1], [0.32, 1.2, 0.3], [0.25, 0, 0]);                          // 挺起來的脖子
    part(g, GEO.cyl, BM.belly, [0, -0.1, 0.35], [0.2, 1.1, 0.08], [0.25, 0, 0]);
    for (let i = 0; i < 5; i++) part(g, GEO.box, BM.snake2, [0, -0.5 + i * 0.2, 0.4 + i * 0.05], [0.3, 0.03, 0.03]);
    part(g, GEO.ico2, BM.snake, [0, 0.62, 0.35], [0.4, 0.3, 0.35]);                                       // 頭
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.glowGold, [x * 0.17, 0.68, 0.64], [0.08, 0.06, 0.04]);                           // 金色的眼
      part(g, GEO.box, M.dark, [x * 0.17, 0.68, 0.68], [0.02, 0.07, 0.01]);
      part(g, GEO.cone, M.linen, [x * 0.1, 0.45, 0.62], [0.03, 0.1, 0.03], [Math.PI, 0, 0]);            // 毒牙
    }
    rod(g, M.red, [0, 0.45], [0, 0.2], 0.02, 0.7);                                                       // 舌頭
    for (const x of [-1, 1]) rod(g, M.red, [0, 0.2], [x * 0.07, 0.1], 0.015, 0.7);
  }, [0, 0.4, 0.8], 1.6);
}
function hoodExtras(rig) {
  const s = new THREE.Shape();                                                                             // 張開的頸部(兩片)
  s.moveTo(0, 0.6); s.quadraticCurveTo(0.9, 0.5, 0.95, -0.2); s.quadraticCurveTo(0.7, -0.9, 0.1, -1.1); s.lineTo(0, -1.1);
  const hg = new THREE.ShapeGeometry(s);
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(hg, BM.hood);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.15; f.userData.freq = 1.6;
    f.position.set(side * 0.3, 1.2, 0.9); f.scale.set(side * 1.4, 1.4, 1); f.rotation.x = LEAN;
    rig.add(f);
  }
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; part(spin, GEO.ico2, M.glowTurq, [Math.cos(a) * 3.2, Math.sin(a) * 3.0 + 0.4, 0.9], 0.22); }
  rig.add(spin);
}
/** 巨蠍:紅棕色的殼 + 兩隻大鉗 + 翹起來的尾巴(毒針)+ 一排眼睛 */
function scorpionBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.scorp, [0, -0.5, 0], [0.9, 0.7, 0.55]);                                          // 身體
    for (let i = 0; i < 3; i++) part(g, GEO.box, BM.scorp2, [0, -0.25 - i * 0.2, 0.52], [1.1 - i * 0.15, 0.04, 0.03]);
    part(g, GEO.ico2, BM.scorp, [0, 0.0, 0.3], [0.55, 0.35, 0.4]);                                        // 頭
    for (let i = 0; i < 4; i++) part(g, GEO.ico, M.glowRed, [(i - 1.5) * 0.14, 0.1, 0.68], 0.05);          // 一排眼睛
    for (const x of [-1, 1]) {
      rod(g, BM.scorp, [x * 0.5, -0.1], [x * 1.05, 0.4], 0.12, 0.3);                                     // 鉗子的手
      part(g, GEO.ico2, BM.scorp2, [x * 1.15, 0.65, 0.35], [0.3, 0.38, 0.22]);                            // 大鉗
      part(g, GEO.cone4, BM.scorp2, [x * 1.0, 1.0, 0.38], [0.1, 0.4, 0.08], [0, 0, x * 0.35]);
      for (let k = 0; k < 3; k++) rod(g, BM.scorp2, [x * 0.6, -0.4 - k * 0.2], [x * 1.1, -0.6 - k * 0.3], 0.05, 0.05); // 腳
    }
    for (let i = 0; i < 5; i++) part(g, GEO.ico2, i % 2 ? BM.scorp2 : BM.scorp, [0, -0.2 + i * 0.28, -0.4 - Math.sin(i * 0.6) * 0.3], 0.2 - i * 0.015); // 翹起來的尾巴
    part(g, GEO.cone, M.gold, [0, 1.25, -0.3], [0.1, 0.3, 0.1], [0.6, 0, 0]);                             // 毒針
  }, [0, 0.4, 0.8], 1.6);
}
function fireRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; part(spin, GEO.ico, BM.fire, [Math.cos(a) * 3.2, Math.sin(a) * 3.0 + 0.4, 0.9], 0.3); }
  rig.add(spin);
}
/** 黃金面具(獎勵關):金色的法老面具 + 藍金條紋 + 粗眼線,周圍繞著一圈聖甲蟲 */
function maskBody(b) {
  standing(b, (g) => {
    const hg = new THREE.Group(); hg.position.set(0, 0, 0); g.add(hg);
    part(hg, GEO.ico2, BM.mask, [0, 0, 0.1], [0.55, 0.62, 0.45]);                                       // 臉
    nemes(hg, BM.mask, M.lapis, 1.95);
    for (const x of [-1, 1]) paintedEye(hg, [x * 0.2, 0.05, 0.5], 2.2, x);
    part(hg, GEO.box, BM.mask2, [0, -0.12, 0.55], [0.08, 0.2, 0.06]);
    part(hg, GEO.box, M.red, [0, -0.3, 0.52], [0.2, 0.04, 0.03]);
    for (const [r, mat] of [[0.6, M.turq], [0.7, M.red], [0.8, M.lapis]]) part(hg, GEO.torus, mat, [0, -0.55 - r * 0.2, 0.05], [r, r * 0.8, 0.3], [Math.PI / 2 - 0.3, 0, 0]); // 寬項圈
    part(hg, GEO.box, M.lapis, [0, -0.62, 0.4], [0.1, 0.28, 0.08]);
  }, [0, 0.3, 0.6], 1.5);
}
function scarabRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, p = new THREE.Group(); p.position.set(Math.cos(a) * 2.3, Math.sin(a) * 2.2, 0.5); p.rotation.z = a - Math.PI / 2; spin.add(p);
    part(p, GEO.ico2, i % 2 ? M.turq : M.lapis, [0, 0, 0], [0.16, 0.2, 0.1]);
    part(p, GEO.ico2, M.gold, [0, 0.2, 0.02], [0.09, 0.06, 0.06]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'sphinx') return template(sphinxBody, 1.5, sandRing, { shadow: [1.8, 1.4] });
  if (kind === 'snake') return template(snakeBody, 1.5, hoodExtras, { shadow: [1.7, 1.4] });
  if (kind === 'scorpion') return template(scorpionBody, 1.5, fireRing, { shadow: [1.8, 1.4] });
  return template(maskBody, 1.4, scarabRing, { shadow: [1.4, 1.1] });
}

/* ---------------- 滾來的石球(原本的隕石):砂岩大球 + 刻著的線 + 揚起的沙 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.ico, M.stone, [0, 0, 0], 0.46);
  for (const r of [0, 1.2]) part(body, GEO.torus, M.stone2, [0, 0, 0], [0.47, 0.47, 0.3], [r, 0, 0]);
  part(body, GEO.disc, M.red, [0, 0, 0.47], 0.12);
  rig.add(bake(body));
  const tail = part(rig, GEO.cone, flat({ color: 0xecd092, transparent: true, opacity: 0.6, depthWrite: false }), [0, -0.9, -0.2], [0.35, 0.9, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(mummy, 1.62, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(scarab, 1.6, (rig) => scarabWings(rig, 1), { shadow: [0.4, 0.3], upright: true }),
  boss: template(jackal, 1.42, null, { shadow: [0.55, 0.45], upright: true }),
  captive: shipTemplate({ white: M.capWhite, red: M.capBlue, blue: M.capBlue, gold: M.gold }),
  rock: rockTemplate(),
};
function lazyTemplate(type) {
  if (TEMPLATES[type]) return TEMPLATES[type];
  if (type.startsWith('ship')) TEMPLATES[type] = evolvedShip(+type.slice(4) || 1);
  else if (type.startsWith('ally')) TEMPLATES[type] = evolvedShip(+type.slice(4) || 1, true);
  else if (type.startsWith('big_')) TEMPLATES[type] = bigTemplate(type.slice(4));
  else if (type.startsWith('item_')) TEMPLATES[type] = itemTemplate(type.slice(5));
  return TEMPLATES[type];
}

/**
 * 產生一個角色。回傳 { root, rig, wings[], flames[], flags[], props[], meshes[], shadow, upright, halo, aura, spin }。
 * clone 共用 geometry / material;要換色(胡狼守衛被打)就換單一 mesh 的 material。
 */
export function spawnModel(type) {
  const root = lazyTemplate(type).clone(true);
  const rig = root.getObjectByName('rig');
  const wings = [], flames = [], meshes = [], props = [], flags = [];
  root.traverse((o) => {
    if (o.name === 'flame') flames.push(o);
    if (o.name === 'flag') { flags.push(o); o.userData.ph = Math.random() * 6; }
    if ((o.isMesh || o.isSprite) && o.name !== 'shadow' && o.name !== 'flag' && o.name !== 'pole') meshes.push(o);
  });
  return {
    root, rig, wings, flames, props, meshes, flags, type, upright: !!root.userData.upright,
    shadow: root.getObjectByName('shadow'),
    halo: root.getObjectByName('halo'), aura: root.getObjectByName('aura'), spin: root.getObjectByName('spin'),
  };
}
export function spinProps() {}
/** 翅膀拍動(沿用 flapWings 的呼叫點:t = 動畫相位)。翅膀有 userData.amp / freq / side */
export function flapWings(mdl, t) {
  for (const f of mdl.flags) {
    const u = f.userData, s = Math.sin(t * (u.freq || 0.8) + (u.side ? 0 : u.ph)) * (u.amp || 0.35);
    f.rotation.y = u.side ? -u.side * s : s;
  }
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:橢圓形的護身符(彩色寶石 + 金框 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xd83a1a, name: '太陽之力' },
  R: { label: 'R', color: 0x3ab8a8, name: '疾風' },
  S: { label: 'S', color: 0x3a8a4a, name: '護身符' },
  B: { label: 'B', color: 0x2a5ab8, name: '沙暴' },
  W: { label: 'W', color: 0x24201c, name: '聖貓' },
  L: { label: '1UP', color: 0xe8b830, name: '椰棗' },
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
  draw('#14100c', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.ico2, C(it.color, 2), [0, 0, 0.2], [0.34, 0.44, 0.2]);                                  // 橢圓寶石
  part(body, GEO.torus, M.gold, [0, 0, 0.22], [0.36, 0.46, 0.5]);                                        // 金框
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: kind === 'W' ? 0xe8b830 : it.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'halo'; root.add(ring);
  const { t, aspect } = labelTex(it.label);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.8 * aspect, 0.8, 1); sp.position.y = -0.08; sp.renderOrder = 5;
  root.add(sp);
  addShadow(root, 0.4, 0.3);
  return root;
}

/* ---------------- 子彈:InstancedMesh,一整批只要 2 個 draw call ---------------- */
const SHOT_MAT = flat({ color: PAL.shot });
const SHOT_TIP = flat({ color: PAL.shotTip });
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

/** 玩家:金色的太陽光(細長的菱形,不透明 → 會被描上黑線) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.oct, [0, 0.05, 0], [0.12, 0.34, 0.08]), SHOT_MAT],
    [geoAt(GEO.oct, [0, 0.1, 0.05], [0.05, 0.16, 0.04]), SHOT_TIP],
  ], cap);
}
/** 敵彈:赭紅色的詛咒火球(發光 + 黃色核心) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico2, [0, 0, 0], [0.21, 0.21, 0.14]), EB_MAT],
    [geoAt(GEO.ico, [0, 0, 0.08], [0.1, 0.1, 0.06]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
