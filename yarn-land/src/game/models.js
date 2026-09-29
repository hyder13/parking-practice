import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 毛線世界的角色:毛線娃娃(amigurumi)、泰迪熊、襪子怪、飛蛾、剪刀螃蟹。全部用基本幾何體拼出來(沒有模型檔)。
 * 每個 cel 材質都會自動疊上針織紋(palette.js TOON),這裡只管形狀和顏色:圓滾滾、鈕扣眼睛、縫線嘴巴。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:角色在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。角色模型「不跟著前進方向旋轉」(userData.upright)。
 * 內部型別沿用原本的名字:bee = 襪子怪、bfly = 小飛蛾、boss = 剪刀螃蟹(打兩下)、rock = 滾來的大鈕扣。
 * ------------------------------------------------------------------ */

export const GROUND_Z = 1.6;
const LEAN = 0.62;

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
  disc: new THREE.CircleGeometry(1, 22),
  heart: heartGeo(),
};
function heartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9);
  s.bezierCurveTo(-0.2, -0.6, -1.0, -0.2, -1.0, 0.3);
  s.bezierCurveTo(-1.0, 0.9, -0.3, 1.0, 0, 0.55);
  s.bezierCurveTo(0.3, 1.0, 1.0, 0.9, 1.0, 0.3);
  s.bezierCurveTo(1.0, -0.2, 0.2, -0.6, 0, -0.9);
  return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -0.15);
}

const C = (color, bands = 3) => cel({ color, bands, tint: 0x9a6a9a });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair), eye: C(0x2a2030, 2), cheek: flat({ color: 0xff9ab0 }), shine: flat({ color: 0xffffff }),
  white: C(0xfff8f0), cream: C(0xfff0d8), pink: C(0xff8ab0), red: C(0xf04a5a), yellow: C(0xffd84a), brown: C(0xb07a50),
  brown2: C(0x8a5a3a), steel: C(0xd8dce8, 2), mint: C(0x8ae0c0), lilac: C(0xc8a8f0), stitch: C(0x5a3a48, 2),
  // 襪子怪
  sock: C(PAL.beeBody), sockBand: C(PAL.beeBand), sockCuff: C(PAL.beeBelly),
  // 小飛蛾
  moth: C(PAL.bflyBody), mothD: C(PAL.bflyHead), mothW: C(PAL.bflyWing), fluff: C(0xf4ece8),
  // 剪刀螃蟹
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0xffc0b0),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 剪刀螃蟹被打第一下之後換色用的對照表(殼氣到變紅) */
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
/** 鈕扣眼睛:黑色圓扣 + 一圈亮邊 + 反光點 */
function buttonEye(g, x, y, z, s = 1) {
  part(g, GEO.cyl, M.eye, [x, y, z], [0.055 * s, 0.03 * s, 0.055 * s], [Math.PI / 2, 0, 0]);
  part(g, GEO.torus, M.stitch, [x, y, z + 0.012 * s], [0.05 * s, 0.05 * s, 0.1 * s]);
  part(g, GEO.ico, M.shine, [x - 0.018 * s, y + 0.02 * s, z + 0.02 * s], 0.012 * s);
}
/** 縫線嘴巴:一排小小的針腳(微笑的弧線) */
function stitchMouth(g, y, z, w = 0.08, n = 4, smile = 1) {
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1;
    part(g, GEO.box, M.stitch, [t * w, y - smile * (1 - t * t) * w * 0.35, z], [w * 0.36, 0.012, 0.012], [0, 0, t * smile * 0.5]);
  }
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
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x5a3a48, transparent: true, opacity: 0.22, depthWrite: false });
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

/* ---------------- Q 版毛線娃娃 ----------------
 * 在人偶自己的座標系裡蓋(站姿:頭 +y、臉 +z),最後整組往後仰 LEAN,放到 at。
 * o:{ body, pants, head(髮)、face、boots、big、noFace、extra(g, hg) } */
function chibi(b, at, s, o) {
  const g = new THREE.Group();
  part(g, GEO.ico2, o.pants || o.body, [0, -0.5, 0], [0.25, 0.2, 0.21]);
  part(g, GEO.ico2, o.body, [0, -0.22, 0], [0.28, 0.27, 0.23]);
  for (const x of [-1, 1]) {
    part(g, GEO.ico2, o.body, [x * 0.3, -0.24, 0.02], [0.1, 0.16, 0.1], [0, 0, x * 0.4]);   // 軟軟的手
    part(g, GEO.ico2, o.boots || M.brown, [x * 0.12, -0.7, 0.03], [0.09, 0.07, 0.1]);        // 圓圓的腳
  }
  const hg = new THREE.Group(); hg.position.set(0, 0.28 + ((o.big || 1) - 1) * 0.22, 0); hg.scale.setScalar(o.big || 1); g.add(hg);
  part(hg, GEO.ico2, o.face || M.skin, [0, 0, 0.02], 0.3);
  part(hg, GEO.ico2, o.head || M.hair, [0, 0.08, -0.06], [0.32, 0.3, 0.3]);
  if (!o.noFace) {
    for (const x of [-1, 1]) {
      buttonEye(hg, x * 0.1, 0.0, 0.3);
      part(hg, GEO.ico, M.cheek, [x * 0.17, -0.08, 0.27], [0.045, 0.03, 0.02]);
    }
    stitchMouth(hg, -0.1, 0.31, 0.05, 3);
  }
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

/* ---------------- 襪子怪(bee):一隻條紋襪子,腳尖是頭(鈕扣眼 + 紅舌頭),一蹦一蹦 ---------------- */
function sockPuppet(b) {
  standing(b, (g) => {
    part(g, GEO.cyl, M.sock, [0, -0.3, -0.05], [0.2, 0.6, 0.2]);                                   // 襪筒
    for (const y of [-0.45, -0.3, -0.15]) part(g, GEO.cyl, M.sockBand, [0, y, -0.05], [0.205, 0.06, 0.205]); // 條紋
    part(g, GEO.cyl, M.sockCuff, [0, -0.62, -0.05], [0.22, 0.12, 0.22]);                           // 襪口的羅紋
    part(g, GEO.ico2, M.sock, [0, 0.08, 0.05], [0.26, 0.24, 0.3]);                                  // 腳跟 → 頭
    part(g, GEO.ico2, M.sockCuff, [0, 0.0, 0.3], [0.2, 0.14, 0.14]);                               // 腳尖(嘴巴)
    part(g, GEO.box, M.stitch, [0, -0.02, 0.43], [0.3, 0.02, 0.02]);                                // 嘴縫
    part(g, GEO.ico, M.red, [0.04, -0.07, 0.4], [0.07, 0.04, 0.03]);                                // 紅色毛氈舌頭
    for (const x of [-1, 1]) buttonEye(g, x * 0.1, 0.18, 0.28, 1.1);
    part(g, GEO.ico, M.yellow, [0, 0.3, 0.0], 0.06);                                                // 頭頂的小毛球
  });
}

/* ---------------- 小飛蛾(bfly):毛茸茸的身體 + 白色毛領 + 羽毛觸角,四片翅膀拍呀拍,專吃毛線 ---------------- */
function moth(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.moth, [0, -0.15, 0], [0.18, 0.3, 0.17]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(g, GEO.ico, M.fluff, [Math.cos(a) * 0.16, 0.08 + Math.sin(a) * 0.04, Math.sin(a) * 0.1], 0.08); } // 毛領
    part(g, GEO.ico2, M.mothD, [0, 0.2, 0.05], [0.16, 0.15, 0.15]);                                // 頭
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.eye, [x * 0.08, 0.2, 0.17], [0.06, 0.07, 0.04]);                         // 大黑眼
      part(g, GEO.ico, M.shine, [x * 0.08 - 0.02, 0.23, 0.2], 0.015);
      rod(g, M.mothD, [x * 0.05, 0.32], [x * 0.18, 0.55], 0.012);                                  // 羽毛觸角
      for (let k = 0; k < 3; k++) part(g, GEO.ico, M.mothD, [x * (0.09 + k * 0.035), 0.4 + k * 0.05, 0], [0.04, 0.02, 0.02], [0, 0, x * 0.8]);
    }
    part(g, GEO.ico, M.red, [0.02, 0.1, 0.18], [0.07, 0.03, 0.03]);                                // 嘴裡咬著一段紅毛線
  }, [0, 0, 0.3]);
}
const WING_GEO = new THREE.CircleGeometry(1, 16).scale(0.34, 0.26, 1).translate(0.3, 0.05, 0);
function mothWings(rig, s = 1, mat = null) {
  const wm = mat || new THREE.MeshToonMaterial({ color: PAL.bflyWing, side: THREE.DoubleSide });
  for (const side of [-1, 1]) for (const [dy, k] of [[0.12, 1], [-0.12, 0.75]]) {
    const f = new THREE.Mesh(WING_GEO, wm);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.6; f.userData.freq = 2.2;
    f.position.set(side * 0.1 * s, (0.02 + dy) * s, 0.12 * s); f.scale.set(side * k * s, k * s, 1); f.rotation.x = LEAN;
    rig.add(f);
    const spot = new THREE.Mesh(GEO.disc, flat({ color: 0x7a6a7a }));                                // 翅膀上的斑點
    spot.position.set(0.32, 0.05, 0.01); spot.scale.set(0.07, 0.07, 1); f.add(spot);
  }
}

/* ---------------- 剪刀螃蟹(boss):橘色圓殼 + 眼睛長在柄上 + 兩隻剪刀鉗 + 小短腳,打兩下 ---------------- */
function scissorCrab(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.bossBody, [0, -0.1, 0], [0.44, 0.32, 0.34]);                               // 殼
    part(g, GEO.ico2, M.bossInner, [0, -0.2, 0.22], [0.3, 0.18, 0.14]);                             // 淺色肚子
    for (const x of [-1, 1]) {
      rod(g, M.bossHead, [x * 0.12, 0.12], [x * 0.16, 0.36], 0.03, 0.1);                           // 眼柄
      part(g, GEO.ico2, M.white, [x * 0.16, 0.4, 0.12], 0.08);
      buttonEye(g, x * 0.16, 0.4, 0.2, 0.9);
      for (let k = 0; k < 3; k++) rod(g, M.bossHead, [x * 0.35, -0.2 - k * 0.08], [x * 0.55, -0.4 - k * 0.1], 0.03, 0);  // 小短腳
      rod(g, M.bossHead, [x * 0.4, 0.0], [x * 0.58, 0.2], 0.05, 0.05);                             // 手臂
      for (const k of [-1, 1]) part(g, GEO.box, M.steel, [x * 0.62 + k * 0.04, 0.4, 0.08], [0.06, 0.34, 0.03], [0, 0, k * 0.35 - x * 0.1]); // 剪刀刀片
      part(g, GEO.torus, M.red, [x * 0.58, 0.22, 0.08], [0.07, 0.07, 0.2]);                        // 剪刀握把
    }
    stitchMouth(g, -0.02, 0.33, 0.1, 5, -1);                                                       // 生氣的嘴
  });
}

/* ---------------- 玩家:小毛(10 段) ----------------
 * 橘色毛線頭髮 + 鈕扣眼 + 天藍毛衣 + 丟毛線球。每一段加零件:
 *   Lv2 粉紅條紋圍巾、Lv3 毛球帽、Lv4 黃色連指手套、Lv5 胸前的大鈕扣、Lv6 帽子上的鉤針小花、
 *   Lv7 拼布披風、Lv8 蓬蓬的棉花光、Lv9 鈕扣王冠、Lv10 一圈毛線球光環。
 * 'ally' = 泰迪熊(棕色 + 圓耳朵 + 補丁 + 紅領結)。 */
export const SHIP_LV = [
  { name: '新手娃娃', body: 0x5ab8e8, accent: 0xffd84a, pod: 0xff7a9a, flame: 0xfff4f8, span: 1.0 },
  { name: '小毛球', body: 0x5ab8e8, accent: 0xffd84a, pod: 0xff7a9a, flame: 0xfff4f8, span: 1.02 },
  { name: '毛線學徒', body: 0x4aaee8, accent: 0xffd84a, pod: 0xff6a90, flame: 0xfff4f8, span: 1.04 },
  { name: '針織好手', body: 0x4aaee8, accent: 0xffd84a, pod: 0xff6a90, flame: 0xfff4f8, span: 1.06 },
  { name: '鈕扣小騎士', body: 0x3aa4e0, accent: 0xffe07a, pod: 0xff5a88, flame: 0xfff0f8, span: 1.08 },
  { name: '拼布英雄', body: 0x3aa4e0, accent: 0xffe07a, pod: 0xff5a88, flame: 0xfff0f8, span: 1.1 },
  { name: '刺繡大師', body: 0x6a8ae8, accent: 0xffe07a, pod: 0xff4a80, flame: 0xffe8f8, span: 1.12 },
  { name: '羊毛勇者', body: 0x6a8ae8, accent: 0xffe07a, pod: 0xff4a80, flame: 0xffe8f8, span: 1.14 },
  { name: '絨毛之星', body: 0x8a7ae8, accent: 0xfff0a0, pod: 0xff3a78, flame: 0xffe0f8, span: 1.16 },
  { name: '毛線之王', body: 0x8a7ae8, accent: 0xffffff, pod: 0xff3a78, flame: 0xffffff, span: 1.2 },
];

function dollBody(m, L, ally) {
  return (b) => {
    if (ally) {
      // 泰迪熊:棕色 + 圓耳朵 + 淺色鼻口 + 縫線鼻子 + 愛心補丁 + 紅領結
      chibi(b, [0, 0, 0.3], 1.25, {
        body: M.brown, pants: M.brown, face: M.brown, head: M.brown, boots: M.brown2, big: 1.3, noFace: true,
        extra(g, hg) {
          for (const x of [-1, 1]) {
            part(hg, GEO.ico2, M.brown, [x * 0.24, 0.24, -0.02], [0.1, 0.1, 0.07]);                          // 圓耳朵
            part(hg, GEO.ico2, M.cream, [x * 0.24, 0.24, 0.03], [0.06, 0.06, 0.04]);
            buttonEye(hg, x * 0.1, 0.04, 0.29);
          }
          part(hg, GEO.ico2, M.cream, [0, -0.09, 0.24], [0.14, 0.1, 0.1]);                                     // 鼻口
          part(hg, GEO.ico2, M.brown2, [0, -0.05, 0.33], [0.05, 0.035, 0.03]);                                  // 鼻子
          stitchMouth(hg, -0.13, 0.33, 0.04, 3);
          part(g, GEO.ico2, M.cream, [0, -0.28, 0.18], [0.16, 0.16, 0.08]);                                    // 肚子
          part(g, GEO.heart, M.red, [0.14, -0.14, 0.22], 0.05);                                                 // 愛心補丁
          for (const x of [-1, 1]) part(g, GEO.cone, M.red, [x * 0.06, 0.0, 0.2], [0.05, 0.08, 0.03], [0, 0, -x * Math.PI / 2]); // 紅領結
        },
      });
      return;
    }
    chibi(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: m.red, face: M.skin, head: M.hair, boots: M.brown, big: 1.3,
      extra(g, hg) {
        for (let i = 0; i < 7; i++) { const a = Math.PI * (0.1 + i * 0.13); part(hg, GEO.ico2, M.hair, [Math.cos(a) * 0.3, 0.12 + Math.sin(a) * 0.2, 0.05], 0.09); } // 毛線頭髮的捲捲
        for (const x of [-1, 1]) part(hg, GEO.ico2, M.hair, [x * 0.34, -0.1, -0.04], [0.09, 0.12, 0.09]);          // 兩邊的小辮子
        for (let i = 0; i < 2; i++) part(g, GEO.cyl, M.white, [0, -0.14 - i * 0.14, 0], [0.285, 0.035, 0.235]);  // 毛衣上的白條紋
        if (L >= 2) {                                                                                           // 粉紅條紋圍巾
          part(g, GEO.torus, m.blue, [0, 0.02, 0], [0.2, 0.2, 0.35], [Math.PI / 2, 0, 0]);
          part(g, GEO.box, m.blue, [0.12, -0.12, 0.2], [0.09, 0.26, 0.04], [0, 0, 0.2]);
          part(g, GEO.box, M.white, [0.14, -0.2, 0.22], [0.09, 0.04, 0.04], [0, 0, 0.2]);
        }
        if (L >= 3) {                                                                                           // 毛球帽
          part(hg, GEO.ico2, m.blue, [0, 0.16, -0.02], [0.32, 0.22, 0.3]);
          part(hg, GEO.cyl, M.white, [0, 0.07, -0.02], [0.32, 0.07, 0.3]);
          part(hg, GEO.ico2, M.white, [0, 0.4, -0.04], 0.1);
        }
        if (L >= 4) for (const x of [-1, 1]) part(g, GEO.ico2, M.yellow, [x * 0.36, -0.38, 0.05], 0.085);         // 連指手套
        if (L >= 5) {                                                                                           // 胸前的大鈕扣
          part(g, GEO.cyl, M.yellow, [0, -0.2, 0.22], [0.09, 0.03, 0.09], [Math.PI / 2, 0, 0]);
          for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, GEO.cyl, M.stitch, [dx * 0.025, -0.2 + dy * 0.025, 0.24], [0.012, 0.01, 0.012], [Math.PI / 2, 0, 0]);
        }
        if (L >= 6) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(hg, GEO.ico, M.yellow, [0.18 + Math.cos(a) * 0.05, 0.24 + Math.sin(a) * 0.05, 0.2], 0.035); } // 鉤針小花
        if (L >= 7) for (let i = 0; i < 4; i++) part(g, GEO.box, [M.pink, M.mint, M.lilac, M.yellow][i], [(i % 2 - 0.5) * 0.3, -0.12 - Math.floor(i / 2) * 0.3, -0.2], [0.3, 0.3, 0.03], [0.2, 0, 0]); // 拼布披風
        if (L >= 9) for (let i = 0; i < 5; i++) part(hg, GEO.cyl, [M.yellow, M.pink, M.mint, M.lilac, M.yellow][i], [(i - 2) * 0.09, 0.42 - Math.abs(i - 2) * 0.03, 0], [0.05, 0.02, 0.05], [Math.PI / 2, 0, 0]); // 鈕扣王冠
      },
    });
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function yarnBallGeo(r = 0.13) {
  const parts = [geoAt(GEO.ico2, [0, 0, 0], [r, r, r])];
  for (let i = 0; i < 3; i++) parts.push(new THREE.TorusGeometry(r * 1.02, r * 0.1, 4, 16).rotateX(i * 1.1).rotateY(i * 0.7).toNonIndexed());
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
}
const YARN_GEO = yarnBallGeo();
function shipTemplate(m, L = 1, ally = false) {
  return template(dollBody(m, L, ally), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下蓬起來的棉花(跑步的煙)
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.95, -0.1], 0xffffff, [0.1, L >= 8 ? 0.4 : 0.26, 0.08], 0.6);
    if (ally) return;
    if (L >= 10) {
      const h = new THREE.Group(); h.name = 'halo'; h.position.set(0, 0.45, 0.2); rig.add(h);
      [M.pink, M.yellow, M.mint, M.lilac, M.red, M.white].forEach((mat, i) => {
        const a = i / 6 * Math.PI * 2; const y = new THREE.Mesh(YARN_GEO, mat); y.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0); y.scale.setScalar(1.1); h.add(y);
      });
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0xfff0f8, transparent: true, opacity: L >= 10 ? 0.2 : 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(0.9, 1.1, 0.45); rig.add(a);
    }
  }, { shadow: [0.5, 0.4], upright: true });
}
function evolvedShip(L, ally = false) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: C(0xf0f0f4), red: C(c.body), blue: C(c.pod), flame: c.flame }, L, ally);
}
function addFlame(rig, pos, color, scl, opacity = 0.9) {
  const fm = flat({ color, transparent: true, opacity, depthWrite: false });
  const f = part(rig, GEO.ico, fm, pos, [scl[0] * 1.3, scl[1] * 0.7, scl[2] * 1.3]);
  f.name = 'flame';
  return f;
}

/* ---------------- 大魔王(面朝玩家) ---------------- */
const BM = {
  queen: C(0x8a7a8a), queenD: C(0x5a4a5a), queenW: new THREE.MeshToonMaterial({ color: 0xd8c0d8, side: THREE.DoubleSide }), crown: C(0xffd84a),
  machine: C(0x3a3a4a), machine2: C(0x9ad0c0), chrome: C(0xe0e4ec), wheel: C(0xc8a050),
  tangle1: C(0xff5a8a), tangle2: C(0xffd84a), tangle3: C(0x7ad0f0),
  gold: C(0xffd040), gold2: C(0xe8a820),
  fluff: new THREE.MeshBasicMaterial({ color: 0xfff4f8, transparent: true, opacity: 0.85, depthWrite: false }),
};

/** 飛蛾女王:大大的毛茸茸身體 + 毛領 + 羽毛觸角 + 王冠 + 四片大翅膀(會拍) */
function queenBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.queen, [0, -0.35, 0], [0.55, 0.9, 0.5]);
    for (let i = 0; i < 4; i++) part(g, GEO.cyl, BM.queenD, [0, -0.2 - i * 0.28, 0], [0.5 - Math.abs(i - 1.2) * 0.08, 0.06, 0.46]);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(g, GEO.ico2, M.fluff, [Math.cos(a) * 0.5, 0.45 + Math.sin(a) * 0.1, Math.sin(a) * 0.3], 0.2); } // 毛領
    part(g, GEO.ico2, BM.queenD, [0, 0.8, 0.1], [0.45, 0.42, 0.42]);
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.eye, [x * 0.2, 0.82, 0.42], [0.14, 0.17, 0.08]);
      part(g, GEO.ico, M.shine, [x * 0.2 - 0.05, 0.9, 0.5], 0.04);
      rod(g, BM.queenD, [x * 0.15, 1.15], [x * 0.55, 1.75], 0.03);
      for (let k = 0; k < 5; k++) part(g, GEO.ico, BM.queenD, [x * (0.22 + k * 0.07), 1.25 + k * 0.1, 0], [0.1, 0.03, 0.03], [0, 0, x * 0.8]);
    }
    for (let i = 0; i < 5; i++) part(g, GEO.cone, BM.crown, [(i - 2) * 0.12, 1.25, 0.1], [0.06, 0.16, 0.06]);             // 王冠
    part(g, GEO.cyl, BM.crown, [0, 1.15, 0.1], [0.32, 0.08, 0.28]);
    stitchMouth(g, 0.6, 0.52, 0.12, 5, -1);
  }, [0, 0.3, 0.8], 1.6);
}
function queenExtras(rig) {
  const G2 = new THREE.CircleGeometry(1, 20).scale(1.3, 1.0, 1).translate(1.15, 0.2, 0);
  for (const side of [-1, 1]) for (const [dy, k] of [[0.7, 1], [-0.5, 0.75]]) {
    const f = new THREE.Mesh(G2, BM.queenW);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.4; f.userData.freq = 1.4;
    f.position.set(side * 0.4, dy, 0.6); f.scale.set(side * k * 1.2, k * 1.2, 1); f.rotation.x = LEAN;
    rig.add(f);
    for (const [x, y, r, c] of [[1.2, 0.3, 0.32, 0x5a4a5a], [1.2, 0.3, 0.18, 0xffd84a], [0.6, -0.2, 0.15, 0x8a7a8a]]) {  // 翅膀上的眼紋
      const s = new THREE.Mesh(GEO.disc, flat({ color: c })); s.position.set(x, y, 0.01 + r * 0.01); s.scale.set(r, r, 1); f.add(s);
    }
  }
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; part(spin, GEO.ico, BM.fluff, [Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9], 0.26); }
  rig.add(spin);
}
/** 縫紉機怪:黑色老式縫紉機(底座 + C 形機臂 + 壓腳 + 針 + 頂上的線軸 + 右邊的手輪),機臂上一張生氣的臉 */
function machineBody(b) {
  standing(b, (g) => {
    part(g, GEO.box, BM.machine2, [0, -1.1, 0], [2.6, 0.3, 1.2]);                                   // 底座
    part(g, GEO.box, BM.machine, [0.75, -0.3, 0], [0.55, 1.4, 0.6]);                                 // 直立的機柱
    part(g, GEO.box, BM.machine, [0, 0.45, 0], [2.1, 0.55, 0.6]);                                    // 橫的機臂
    part(g, GEO.box, BM.machine, [-0.9, -0.15, 0], [0.4, 0.8, 0.5]);                                 // 機頭
    rod(g, BM.chrome, [-0.9, -0.5], [-0.9, -0.95], 0.03, 0.1);                                       // 針
    part(g, GEO.box, BM.chrome, [-0.9, -0.97, 0.15], [0.3, 0.05, 0.25]);                             // 壓腳
    part(g, GEO.cyl, BM.wheel, [1.15, 0.4, 0], [0.45, 0.12, 0.45], [0, 0, Math.PI / 2]);           // 手輪
    part(g, GEO.cyl, M.pink, [0.2, 0.9, 0], [0.16, 0.35, 0.16]);                                     // 頂上的線軸
    for (let i = 0; i < 3; i++) part(g, GEO.box, BM.wheel, [-0.3 + i * 0.3, 0.45, 0.31], [0.18, 0.1, 0.02]); // 金色花紋
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.white, [x * 0.28 - 0.1, 0.5, 0.32], [0.14, 0.12, 0.05]);
      part(g, GEO.ico, M.eye, [x * 0.28 - 0.1, 0.48, 0.37], 0.06);
      part(g, GEO.box, M.eye, [x * 0.28 - 0.1, 0.66, 0.34], [0.22, 0.05, 0.03], [0, 0, x * 0.4]);
    }
    for (let i = 0; i < 6; i++) part(g, GEO.box, M.red, [-0.8 + i * 0.3, -0.93, 0.62], [0.15, 0.02, 0.02]);  // 車出來的一排縫線
  }, [0, 0.4, 0.8], 1.85);
}
function buttonRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  const mats = [M.pink, M.yellow, M.mint, M.lilac, M.red];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.cyl, mats[i % 5], [Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9], [0.24, 0.07, 0.24], [Math.PI / 2, 0, 0]);
  }
  rig.add(spin);
}
/** 毛線團怪:一大團亂七八糟纏在一起的毛線(三種顏色的圈圈)+ 生氣的眼睛 + 鋸齒嘴 + 散出來的線頭 */
function tangleBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.tangle1, [0, 0, 0], 1.25);
    const mats = [BM.tangle1, BM.tangle2, BM.tangle3];
    for (let i = 0; i < 14; i++) part(g, GEO.torus, mats[i % 3], [0, 0, 0], [1.26, 1.26, 1.26], [i * 0.7, i * 1.3, i * 0.4]); // 纏繞的毛線
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.white, [x * 0.38, 0.25, 1.1], [0.26, 0.22, 0.1]);
      part(g, GEO.ico, M.eye, [x * 0.36, 0.2, 1.2], 0.11);
      part(g, GEO.box, M.eye, [x * 0.38, 0.52, 1.14], [0.45, 0.08, 0.06], [0, 0, x * 0.45]);
      for (let k = 0; k < 3; k++) rod(g, mats[k], [x * 1.1, -0.3 + k * 0.4], [x * (1.6 + k * 0.1), -0.8 + k * 0.5], 0.04, 0.2); // 線頭
    }
    part(g, GEO.box, M.eye, [0, -0.35, 1.18], [0.8, 0.2, 0.06]);
    for (let i = 0; i < 6; i++) part(g, GEO.cone, M.white, [(i - 2.5) * 0.13, -0.3, 1.22], [0.05, 0.1, 0.03], [Math.PI, 0, 0]); // 鋸齒牙
  }, [0, 0.4, 0.8], 1.3);
}
function needleRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, n = new THREE.Group();
    n.position.set(Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9); n.rotation.z = a - Math.PI / 2; spin.add(n);
    part(n, GEO.cyl, BM.chrome, [0, 0, 0], [0.05, 0.9, 0.05]);                                        // 棒針
    part(n, GEO.cone, BM.chrome, [0, 0.52, 0], [0.05, 0.14, 0.05]);
    part(n, GEO.ico2, [M.pink, M.yellow, M.mint][i % 3], [0, -0.48, 0], 0.1);
  }
  rig.add(spin);
}
/** 金鈕扣(獎勵關):大大的金色鈕扣 + 四個扣眼 + 縫線笑臉 + 小短腳跑來跑去 */
function goldButtonBody(b) {
  standing(b, (g) => {
    part(g, GEO.cyl, BM.gold, [0, 0, 0], [1.2, 0.3, 1.2], [Math.PI / 2, 0, 0]);
    part(g, GEO.torus, BM.gold2, [0, 0, 0.15], [1.05, 1.05, 0.8]);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, GEO.cyl, BM.gold2, [dx * 0.28, dy * 0.28 + 0.05, 0.13], [0.12, 0.06, 0.12], [Math.PI / 2, 0, 0]);
    for (const [dx, dy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) part(g, GEO.box, M.red, [0, 0.05, 0.2], [0.8, 0.05, 0.04], [0, 0, Math.atan2(dy, dx)]); // 十字縫線
    for (const x of [-1, 1]) {
      rod(g, M.brown2, [x * 0.4, -1.1], [x * 0.5, -1.55], 0.06);
      part(g, GEO.ico2, M.brown2, [x * 0.55, -1.6, 0.08], [0.16, 0.08, 0.14]);
    }
  }, [0, 0.3, 0.6], 1.4);
}

function bigTemplate(kind) {
  if (kind === 'queen') return template(queenBody, 1.5, queenExtras, { shadow: [1.6, 1.3] });
  if (kind === 'machine') return template(machineBody, 1.5, buttonRing, { shadow: [1.8, 1.2] });
  if (kind === 'tangle') return template(tangleBody, 1.5, needleRing, { shadow: [1.6, 1.4] });
  return template(goldButtonBody, 1.4, buttonRing, { shadow: [1.5, 1.2] });
}

/* ---------------- 滾來的大鈕扣(原本的隕石):橫著像輪子一樣往前滾 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.cyl, C(0x7ad0f0), [0, 0, 0], [0.45, 0.2, 0.45], [0, 0, Math.PI / 2]);
  part(body, GEO.torus, C(0x5ab0d8), [0, 0, 0], [0.4, 0.4, 0.6], [0, Math.PI / 2, 0]);
  for (const s of [-1, 1]) for (const [dy, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(body, GEO.cyl, C(0x3a6a8a, 2), [s * 0.1, dy * 0.1, dz * 0.1], [0.05, 0.02, 0.05], [0, 0, Math.PI / 2]);
  rig.add(bake(body));
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), [0, -1.0, -0.2], [0.35, 1.1, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(sockPuppet, 1.6, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(moth, 1.6, (rig) => mothWings(rig, 1), { shadow: [0.4, 0.3], upright: true }),
  boss: template(scissorCrab, 1.45, null, { shadow: [0.6, 0.45], upright: true }),
  captive: shipTemplate({ white: M.capWhite, red: M.capRed, blue: M.capBlue }),
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
 * clone 共用 geometry / material;要換色(剪刀螃蟹被打)就換單一 mesh 的 material。
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

/* ---------------- 道具:刺繡徽章(毛氈圓片 + 白色縫線邊 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a8a, name: '毛線球' },
  R: { label: 'R', color: 0x5ac8f0, name: '快快織' },
  S: { label: 'S', color: 0x6ad88a, name: '棉花護盾' },
  B: { label: 'B', color: 0xb88af0, name: '大毛球' },
  W: { label: 'W', color: 0xc8905a, name: '泰迪熊' },
  L: { label: '1UP', color: 0xffd84a, name: '甜甜圈' },
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
  draw('#5a3a48', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.cyl, C(it.color, 2), [0, 0, 0.2], [0.44, 0.08, 0.44], [Math.PI / 2 - 0.4, 0, 0]);       // 毛氈圓片
  for (let i = 0; i < 12; i++) {                                                                          // 白色縫線邊
    const a = i / 12 * Math.PI * 2;
    part(body, GEO.box, M.white, [Math.cos(a) * 0.36, Math.sin(a) * 0.36 * Math.cos(0.4), 0.2 + Math.sin(a) * 0.36 * Math.sin(0.4) + 0.05], [0.1, 0.025, 0.02], [-0.4, 0, a + Math.PI / 2]);
  }
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
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
const EB_MAT = flat({ color: PAL.ebullet });
const EB_CORE = flat({ color: PAL.ebulletCore });

/** 玩家:粉紅毛線球(纏繞的線 + 後面拖著一條線頭) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [yarnBallGeo(0.17), SHOT_MAT],
    [geoAt(GEO.cyl, [0.05, -0.32, 0], [0.02, 0.36, 0.02]), SHOT_TIP],
  ], cap);
}
/** 敵彈:大頭針(銀色的針朝前 + 紅色的圓頭在後) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [mergeGeometries([geoAt(GEO.cyl, [0, 0.08, 0], [0.03, 0.4, 0.03]), geoAt(GEO.cone, [0, 0.32, 0], [0.03, 0.08, 0.03])].map((g) => (g.index ? g.toNonIndexed() : g))), EB_MAT],
    [geoAt(GEO.ico2, [0, -0.15, 0], [0.14, 0.14, 0.14]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
