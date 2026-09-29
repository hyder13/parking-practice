import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 水墨江湖的角色:Q 版大頭的俠客、山賊、高手。全部用基本幾何體拼出來(沒有模型檔)。
 * 畫面最後會被轉成墨色(skin.js LOOK.style),所以配色只分「濃墨 / 淡墨 / 留白」,
 * 唯一保留的鮮色是朱紅(紅繩、印章、酒罈紅紙、敵人的飛鏢):要紅就用飽和的紅,其他不要帶紅。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:角色在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。角色模型「不跟著前進方向旋轉」(userData.upright)。
 * 內部型別沿用原本的名字:bee = 山賊、bfly = 飛賊(輕功)、boss = 鐵頭陀(打兩下)、rock = 滾來的酒罈。
 * ------------------------------------------------------------------ */

export const GROUND_Z = 1.6;
const LEAN = 0.62;

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
  crescent: new THREE.TorusGeometry(1, 0.22, 6, 18, Math.PI * 0.9),
  disc: new THREE.CircleGeometry(1, 22),
};

const C = (color, bands = 3) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair, 2), eye: flat({ color: 0x121212 }), cheek: flat({ color: 0xf0c8b8 }),
  white: C(0xf4f2ec), red: C(0xd02a1e), wood: C(0x5a5048, 2), dark: C(0x2a2a2c, 2), ink: C(0x161616, 2),
  steel: C(0xdcdcd8, 2), gray: C(0x8a8a88), gray2: C(0x5a5a5a), jade: C(0xb8c8b0, 2), straw: C(0xc8c0a8, 2),
  // 山賊
  beeBody: C(PAL.beeBody), beeBelly: C(PAL.beeBelly, 2), scarf: C(PAL.beeBand, 2),
  // 飛賊
  thief: C(PAL.bflyBody),
  // 鐵頭陀(灰袍 + 光頭;被打一下袍子變深、光頭氣紅)
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner, 2),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0x121212, 2),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 鐵頭陀被打第一下之後換色用的對照表 */
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
/** 兩點之間的一根棒子(劍、刀、禪杖、竹竿…),在 XY 平面上 */
function rod(parent, mat, a, b, r, z = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  return part(parent, GEO.cyl, mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z], [r, L, r], [0, 0, Math.atan2(-dx, dy)]);
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

/* ---------------- 地面陰影(淡墨) ---------------- */
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.2, depthWrite: false });
function addShadow(root, rx, ry) {
  const s = new THREE.Mesh(GEO.disc, SHADOW_MAT);
  s.name = 'shadow'; s.scale.set(rx, ry, 1); s.position.z = -GROUND_Z + 0.04;
  s.userData.base = [rx, ry];
  root.add(s);
}

/**
 * 組樣板:body(fn)烤成一塊,extras(rig) 放不烤的零件(旗子、光環…)。
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

/* ---------------- 字的貼圖(旗子 / 酒罈紅紙 / 秘笈):canvas 畫字,毛筆字 ---------------- */
const BRUSH_FONT = '"Noto Serif TC","Noto Serif SC","PingFang TC","Microsoft JhengHei",serif';
const texCache = new Map();
export function bannerTex(ch, bg, fg = '#141414') {
  const k = ch + bg + fg;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
  g.fillStyle = fg; g.font = `900 44px ${BRUSH_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 35);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}
/** 直式旗:底色 + 一到五個直書的字 */
const noboriTex = new Map();
export function noboriMat(text, bg, fg = '#f4f0e6') {
  const k = text + bg + fg;
  if (!noboriTex.has(k)) {
    const n = text.length, c = document.createElement('canvas'); c.width = 48; c.height = 40 + n * 40;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.font = `900 34px ${BRUSH_FONT}`;
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    [...text].forEach((ch, i) => g.fillText(ch, 24, 32 + i * 40));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    noboriTex.set(k, { mat: new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), aspect: c.width / c.height });
  }
  return noboriTex.get(k);
}
/** 插在背上 / 旁邊的直式旗(不烤,名稱 'flag' → 每幀飄動) */
function addNobori(rig, pos, text, bg, h = 1.2, fg) {
  const { mat, aspect } = noboriMat(text, bg, fg);
  const pole = part(rig, GEO.cyl, M.wood, [pos[0], pos[1] - h * 0.3, pos[2]], [0.025, h * 1.5, 0.025]);
  pole.name = 'pole';
  const f = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h).translate(h * aspect / 2, -h / 2, 0), mat);
  f.name = 'flag'; f.position.set(pos[0] + 0.02, pos[1] + h * 0.42, pos[2]);
  rig.add(f);
  return f;
}
/** 飄動的紅布條(頭帶 / 圍巾的尾巴,'flag' → flapWings 會讓它擺動) */
const RIBBON_GEO = new THREE.PlaneGeometry(0.1, 0.5).translate(0, -0.25, 0);
function ribbon(rig, pos, rz = 0.6, s = 1) {
  const f = new THREE.Mesh(RIBBON_GEO, flat({ color: 0xd02a1e, side: THREE.DoubleSide }));
  f.name = 'flag'; f.position.set(...pos); f.rotation.z = rz; f.scale.setScalar(s);
  f.userData.amp = 0.5; f.userData.freq = 1.3;
  rig.add(f);
  return f;
}

/* ---------------- Q 版人偶 ----------------
 * 在人偶自己的座標系裡蓋(站姿:頭 +y、臉 +z),最後整組往後仰 LEAN,放到 at。
 * o:{ body, pants, head(髮)、face(膚色)、boots、big、extra(g, hg) } */
function chibi(b, at, s, o) {
  const g = new THREE.Group();
  part(g, GEO.cone, o.pants || o.body, [0, -0.5, 0], [0.3, 0.42, 0.25]);                   // 長衫的下擺(往下張開)
  part(g, GEO.ico, o.body, [0, -0.2, 0], [0.27, 0.26, 0.22]);                             // 身體
  for (const x of [-1, 1]) {
    part(g, GEO.ico, o.body, [x * 0.29, -0.22, 0.02], [0.1, 0.17, 0.1], [0, 0, x * 0.35]);  // 寬袖
    part(g, GEO.ico, o.boots || M.ink, [x * 0.11, -0.72, 0.02], [0.08, 0.06, 0.1]);         // 布鞋
  }
  const hg = new THREE.Group(); hg.position.set(0, 0.28 + ((o.big || 1) - 1) * 0.22, 0); hg.scale.setScalar(o.big || 1); g.add(hg);
  part(hg, GEO.ico2, o.face || M.skin, [0, 0, 0.02], 0.3);
  part(hg, GEO.ico2, o.head || M.hair, [0, 0.08, -0.06], [0.32, 0.3, 0.3]);
  if (!o.noFace) for (const x of [-1, 1]) {
    part(hg, GEO.box, M.eye, [x * 0.1, -0.01, 0.3], [0.07, 0.022, 0.02], [0, 0, x * 0.12]);   // 細長的眼(工筆畫的鳳眼)
    part(hg, GEO.box, M.eye, [x * 0.1, 0.07, 0.29], [0.09, 0.018, 0.02], [0, 0, -x * 0.2]);   // 劍眉
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
/** 一把劍:劍身 + 劍格 + 劍柄 + 紅劍穗 */
function sword(g, a, b, s = 1, z = 0.12) {
  rod(g, M.steel, a, b, 0.018 * s, z);
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  const hx = a[0] + ux * 0.02, hy = a[1] + uy * 0.02;
  rod(g, M.ink, [hx - uy * 0.06, hy + ux * 0.06], [hx + uy * 0.06, hy - ux * 0.06], 0.018 * s, z);  // 劍格
  rod(g, M.ink, [a[0] - ux * 0.12, a[1] - uy * 0.12], [a[0], a[1]], 0.02 * s, z);                  // 劍柄
  part(g, GEO.cone, M.red, [a[0] - ux * 0.16, a[1] - uy * 0.2, z], [0.03, 0.1, 0.03]);             // 劍穗
}

/* ---------------- 山賊(bee):墨色短打 + 包頭巾 + 絡腮鬍 + 大刀 ---------------- */
function bandit(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.beeBody, pants: M.beeBody, head: M.scarf,
    extra(g, hg) {
      part(hg, GEO.ico2, M.scarf, [0, 0.12, -0.02], [0.33, 0.22, 0.31]);                                 // 包頭巾
      part(hg, GEO.box, M.scarf, [0.2, 0.02, -0.26], [0.08, 0.22, 0.03], [0.3, 0, -0.5]);                  // 頭巾尾
      part(hg, GEO.ico2, M.ink, [0, -0.16, 0.2], [0.24, 0.12, 0.12]);                                      // 絡腮鬍
      part(g, GEO.box, M.beeBelly, [0, -0.25, 0.21], [0.3, 0.06, 0.02]);                                    // 腰帶
      rod(g, M.wood, [0.36, -0.42], [0.38, -0.1], 0.025, 0.1);                                               // 大刀的柄
      part(g, GEO.box, M.steel, [0.42, 0.1, 0.1], [0.12, 0.44, 0.03], [0, 0, -0.12]);                      // 刀身
      part(g, GEO.box, M.ink, [0.38, -0.12, 0.11], [0.14, 0.03, 0.04]);
    },
  });
}

/* ---------------- 飛賊(bfly):一身黑衣 + 蒙面 + 紅圍巾飄在後面,張開手用輕功飛過來 ---------------- */
function thief(b) {
  chibi(b, [0, 0, 0.3], 1, {
    body: M.thief, pants: M.thief, face: M.thief, head: M.thief, boots: M.thief, noFace: true,
    extra(g, hg) {
      part(hg, GEO.box, M.skin, [0, 0.02, 0.28], [0.3, 0.08, 0.04]);                                      // 露出眼睛的一條
      for (const x of [-1, 1]) part(hg, GEO.box, M.eye, [x * 0.09, 0.02, 0.305], [0.07, 0.02, 0.02], [0, 0, x * 0.18]);
      for (const x of [-1, 1]) part(g, GEO.ico, M.thief, [x * 0.42, -0.08, 0.02], [0.18, 0.06, 0.08], [0, 0, x * 0.4]); // 張開的手
      part(g, GEO.cyl, M.red, [0, 0.05, 0], [0.19, 0.05, 0.17]);                                            // 紅圍巾
    },
  });
}

/* ---------------- 鐵頭陀(boss):光頭 + 灰色僧袍 + 大念珠 + 鐵禪杖,打兩下 ---------------- */
function ironMonk(b) {
  chibi(b, [0, 0, 0.25], 1.25, {
    body: M.bossBody, pants: M.bossBody, face: M.bossHead, head: M.bossHead, noFace: true,
    extra(g, hg) {
      for (const x of [-1, 1]) {
        part(hg, GEO.box, M.eye, [x * 0.1, 0.0, 0.3], [0.08, 0.03, 0.02], [0, 0, -x * 0.2]);             // 怒目
        part(hg, GEO.box, M.eye, [x * 0.11, 0.08, 0.29], [0.11, 0.035, 0.02], [0, 0, x * 0.35]);          // 粗眉
      }
      part(hg, GEO.box, M.eye, [0, -0.14, 0.29], [0.12, 0.025, 0.02]);                                     // 嘴
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) part(hg, GEO.ico, M.bossInner, [(k - 1) * 0.08, 0.16 + i * 0.05, 0.25 - i * 0.04], 0.012); // 戒疤
      for (let i = 0; i < 11; i++) {                                                                          // 大念珠
        const a = Math.PI * (0.15 + i * 0.07);
        part(g, GEO.ico2, M.bossInner, [Math.cos(a) * 0.24, -0.05 - Math.sin(a) * 0.22 + 0.22, 0.2], 0.045);
      }
      part(g, GEO.box, M.bossInner, [-0.12, -0.2, 0.22], [0.2, 0.46, 0.02], [0, 0, 0.5]);                   // 袈裟斜帶
      for (const x of [-1, 1]) part(g, GEO.ico2, M.bossBody, [x * 0.32, -0.08, 0.02], [0.14, 0.11, 0.12]); // 大肩膀
      rod(g, M.ink, [0.4, -0.75], [0.44, 0.5], 0.03, 0.12);                                                  // 鐵禪杖
      part(g, GEO.torus, M.ink, [0.44, 0.58, 0.12], [0.1, 0.1, 0.2]);
      for (const x of [-1, 1]) part(g, GEO.torus, M.gray2, [0.44 + x * 0.08, 0.5, 0.12], [0.04, 0.04, 0.2]);
    },
  });
}

/* ---------------- 玩家:少年劍客(10 段功力) ----------------
 * 白色長衫 + 墨色腰帶 + 髮髻上的紅髮帶 + 手上的劍,發出墨色的劍氣。每一段加零件:
 *   Lv2 紅頭帶的長尾巴、Lv3 背上的斗笠、Lv4 背上的第二把劍、Lv5 墨色外袍、Lv6 腰間酒葫蘆、
 *   Lv7 玉珮 + 長馬尾、Lv8 墨色真氣、Lv9 戴上斗笠、Lv10 身後一圈飛劍。
 * 'ally' = 仙鶴(白羽 + 黑頸 + 紅頂)。 */
export const SHIP_LV = [
  { name: '初出茅廬', body: 0xf0eee8, accent: 0xd02a1e, pod: 0x3a3a3c, flame: 0xffffff, span: 1.0 },
  { name: '江湖新秀', body: 0xf0eee8, accent: 0xd02a1e, pod: 0x3a3a3c, flame: 0xffffff, span: 1.02 },
  { name: '少年俠客', body: 0xeceae4, accent: 0xd02a1e, pod: 0x323234, flame: 0xffffff, span: 1.04 },
  { name: '青衫劍客', body: 0xeceae4, accent: 0xd02a1e, pod: 0x323234, flame: 0xffffff, span: 1.06 },
  { name: '名門弟子', body: 0xe8e6e0, accent: 0xd02a1e, pod: 0x2a2a2c, flame: 0xffffff, span: 1.08 },
  { name: '一流高手', body: 0xe8e6e0, accent: 0xd02a1e, pod: 0x2a2a2c, flame: 0xffffff, span: 1.1 },
  { name: '劍術名家', body: 0xe4e2dc, accent: 0xd02a1e, pod: 0x222224, flame: 0xffffff, span: 1.12 },
  { name: '一代宗師', body: 0xe4e2dc, accent: 0xd02a1e, pod: 0x222224, flame: 0xffffff, span: 1.14 },
  { name: '劍聖', body: 0xf4f2ec, accent: 0xd02a1e, pod: 0x1a1a1c, flame: 0xffffff, span: 1.16 },
  { name: '武林盟主', body: 0xf8f6f0, accent: 0xd02a1e, pod: 0x141416, flame: 0xffffff, span: 1.2 },
];

function heroBody(m, L) {
  return (b) => {
    chibi(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: m.red, face: M.skin, head: M.hair, big: 1.3,
      extra(g, hg) {
        part(hg, GEO.ico2, M.hair, [0, 0.34, -0.04], [0.1, 0.09, 0.1]);                                    // 髮髻
        part(hg, GEO.cyl, M.red, [0, 0.29, -0.04], [0.08, 0.04, 0.08]);                                     // 紅髮帶
        part(hg, GEO.box, M.hair, [-0.2, 0.12, 0.2], [0.05, 0.18, 0.04], [0, 0, 0.3]);                      // 瀏海
        part(hg, GEO.box, M.eye, [0, -0.13, 0.3], [0.06, 0.015, 0.02]);                                      // 抿著的嘴
        part(g, GEO.box, m.blue, [0, -0.28, 0.2], [0.34, 0.07, 0.04]);                                       // 墨色腰帶
        part(g, GEO.box, M.red, [0.08, -0.34, 0.22], [0.03, 0.12, 0.02], [0, 0, 0.2]);                       // 腰間的紅繩
        sword(g, [0.34, -0.24], [0.52, 0.42], 1.1);                                                           // 手上的劍
        if (L >= 3 && L < 9) part(g, GEO.cone, M.straw, [0, 0.05, -0.28], [0.42, 0.14, 0.42], [-1.2, 0, 0]); // 背上的斗笠
        if (L >= 4) rod(g, M.ink, [-0.3, -0.45], [0.2, 0.25], 0.025, -0.24);                                 // 背上的第二把劍(劍鞘)
        if (L >= 5) for (const x of [-1, 1]) part(g, GEO.box, m.blue, [x * 0.2, -0.3, 0.12], [0.12, 0.6, 0.18], [0, 0, x * -0.08]); // 墨色外袍
        if (L >= 6) { part(g, GEO.ico2, M.straw, [-0.26, -0.4, 0.14], [0.06, 0.07, 0.06]); part(g, GEO.ico2, M.straw, [-0.26, -0.3, 0.14], 0.045); } // 酒葫蘆
        if (L >= 7) {
          part(g, GEO.cyl, M.jade, [0.14, -0.44, 0.22], [0.05, 0.02, 0.05], [Math.PI / 2, 0, 0]);             // 玉珮
          part(hg, GEO.ico2, M.hair, [0, 0.2, -0.3], [0.06, 0.24, 0.05], [0.5, 0, 0]);                         // 長馬尾
        }
        if (L >= 9) {                                                                                         // 戴上斗笠
          part(hg, GEO.cone, M.straw, [0, 0.38, -0.02], [0.52, 0.18, 0.5]);
          part(hg, GEO.cyl, M.red, [0, 0.3, -0.02], [0.2, 0.02, 0.2]);
        }
      },
    });
  };
}
/** 仙鶴(僚機):白色身體 + S 形的長頸(上半黑)+ 紅頂 + 長嘴 + 黑色尾羽 + 細長腳 */
function craneBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.white, [0, -0.15, 0], [0.34, 0.28, 0.3]);                                      // 身體
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.white, [x * 0.3, -0.1, -0.05], [0.24, 0.12, 0.16], [0, 0, x * 0.5]);         // 收起來的翅膀
      part(g, GEO.ico2, M.ink, [x * 0.46, -0.2, -0.08], [0.1, 0.06, 0.1], [0, 0, x * 0.5]);            // 黑色翼尖
      rod(g, M.ink, [x * 0.08, -0.4], [x * 0.1, -0.85], 0.015);                                        // 細長腳
      part(g, GEO.box, M.ink, [x * 0.1, -0.87, 0.04], [0.1, 0.02, 0.1]);
    }
    for (let i = 0; i < 3; i++) part(g, GEO.cone, M.ink, [(i - 1) * 0.08, -0.3, -0.28], [0.05, 0.22, 0.04], [2.5, 0, (i - 1) * 0.4]); // 尾羽
    const pts = [[0, 0.05], [0.06, 0.2], [0.02, 0.36], [-0.04, 0.5], [0.0, 0.62]];                     // S 形的頸
    for (let i = 0; i < pts.length - 1; i++) rod(g, i < 2 ? M.white : M.ink, pts[i], pts[i + 1], 0.045, 0.05);
    part(g, GEO.ico2, M.white, [0.0, 0.68, 0.05], [0.09, 0.08, 0.09]);                                  // 頭
    part(g, GEO.ico, M.red, [0.0, 0.75, 0.05], [0.05, 0.03, 0.05]);                                     // 紅頂
    part(g, GEO.cone, M.gray, [0.0, 0.66, 0.2], [0.025, 0.2, 0.025], [Math.PI / 2, 0, 0]);              // 長嘴
    for (const x of [-1, 1]) part(g, GEO.ico, M.eye, [x * 0.05, 0.69, 0.12], 0.015);
  }, [0, 0, 0.3], 1.45);
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1, ally = false) {
  return template(ally ? craneBody : heroBody(m, L), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下揚起的淡墨(輕功的風)
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.95, -0.1], 0x8a8a8a, [0.1, L >= 8 ? 0.4 : 0.26, 0.08], 0.35);
    if (ally) return;
    if (L >= 2) { ribbon(rig, [0.1, 0.72, 0.2], 1.1, 1.1); ribbon(rig, [0.06, 0.7, 0.18], 0.7, 0.9); }      // 紅頭帶的長尾巴
    if (L >= 10) {                                                                                             // 身後一圈飛劍
      const h = new THREE.Group(); h.name = 'halo'; h.position.set(0, 0.35, -0.2); rig.add(h);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, s = new THREE.Group(); s.rotation.z = a; h.add(s);
        sword(s, [0, 0.65], [0, 1.15], 1.2, 0);
      }
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0x2a2a2a, transparent: true, opacity: L >= 10 ? 0.14 : 0.1, depthWrite: false }));
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
  const f = part(rig, GEO.cone, fm, pos, scl, [0, 0, Math.PI]);
  f.name = 'flame';
  return f;
}

/* ---------------- 大魔頭(面朝玩家) ---------------- */
const BM = {
  fur: C(0x6a6a68), furD: C(0x3a3a3a), robe: C(0x2a2a2c), beard: C(0x141414, 2),
  dragon: C(0x2a2a2c), dragon2: C(0x5a5a5c), horn: C(0xc8c4b8, 2), dEye: flat({ color: 0xe0301e }),
  demon: C(0x161618), demonFace: C(0xf8f6f0), demonRed: C(0xc8201a), hairLong: C(0x0e0e0e, 2),
  paper: C(0xf4efe2, 2), roller: C(0x4a3a2a, 2),
  talisman: new THREE.MeshBasicMaterial({ color: 0xd02a1e, side: THREE.DoubleSide }),
};

/** 山寨大王:虎皮背心 + 大鬍子 + 頭巾 + 青龍偃月刀似的長柄大刀 */
function banditKingBody(b) {
  chibi(b, [0, 0.2, 0.6], 3.0, {
    body: BM.robe, pants: BM.robe, face: M.skin, head: BM.furD, noFace: true,
    extra(g, hg) {
      for (const x of [-1, 1]) {
        part(hg, GEO.box, M.eye, [x * 0.1, 0.0, 0.3], [0.08, 0.035, 0.02], [0, 0, -x * 0.25]);          // 怒目
        part(hg, GEO.box, M.eye, [x * 0.11, 0.09, 0.29], [0.12, 0.04, 0.02], [0, 0, x * 0.4]);           // 粗眉
      }
      part(hg, GEO.ico2, BM.beard, [0, -0.2, 0.18], [0.28, 0.2, 0.14]);                                   // 大鬍子
      part(hg, GEO.cyl, M.red, [0, 0.1, -0.02], [0.33, 0.06, 0.31]);                                      // 紅頭巾
      for (let i = 0; i < 6; i++) part(g, GEO.box, i % 2 ? BM.furD : BM.fur, [(i - 2.5) * 0.09, -0.2, 0.2], [0.08, 0.34, 0.03]); // 虎皮紋背心
      for (const x of [-1, 1]) part(g, GEO.ico2, BM.fur, [x * 0.3, -0.06, 0.02], [0.14, 0.11, 0.12]);
      rod(g, M.wood, [0.36, -0.7], [0.4, 0.5], 0.025, 0.12);                                              // 長柄
      part(g, GEO.crescent, M.steel, [0.47, 0.5, 0.12], [0.16, 0.2, 0.2], [0, 0, 0.4]);                  // 月牙刀
    },
  });
}
/** 墨龍:面朝玩家的龍頭(長吻 + 鹿角 + 鬃毛 + 龍鬚 + 紅眼),身體是繞著牠轉的一圈(spin) */
function dragonBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.dragon, [0, 0.3, 0], [0.8, 0.7, 0.7]);                                        // 頭
    part(g, GEO.ico2, BM.dragon2, [0, 0.0, 0.5], [0.55, 0.36, 0.5]);                                   // 長吻
    part(g, GEO.box, M.ink, [0, -0.2, 0.78], [0.7, 0.08, 0.2]);                                        // 嘴縫
    for (let i = 0; i < 6; i++) part(g, GEO.cone, M.white, [(i - 2.5) * 0.11, -0.14, 0.86], [0.035, 0.09, 0.03], [Math.PI, 0, 0]); // 牙
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.white, [x * 0.3, 0.45, 0.5], [0.15, 0.11, 0.08]);                           // 眼白
      part(g, GEO.ico, BM.dEye, [x * 0.3, 0.44, 0.57], [0.08, 0.08, 0.03]);                           // 紅眼
      part(g, GEO.box, M.ink, [x * 0.3, 0.6, 0.52], [0.34, 0.07, 0.06], [0, 0, x * 0.4]);             // 怒眉
      part(g, GEO.ico, M.ink, [x * 0.14, 0.1, 0.92], 0.04);                                            // 鼻孔
      rod(g, BM.horn, [x * 0.35, 0.8], [x * 0.7, 1.5], 0.05);                                           // 鹿角
      rod(g, BM.horn, [x * 0.55, 1.15], [x * 0.85, 1.25], 0.035);
      rod(g, BM.horn, [x * 0.48, 1.05], [x * 0.4, 1.4], 0.03);
      for (let k = 0; k < 4; k++) part(g, GEO.cone, M.ink, [x * (0.7 + k * 0.08), 0.1 - k * 0.2, -0.1], [0.12, 0.45, 0.08], [0, 0, x * (1.8 + k * 0.2)]); // 鬃毛
      const w = [[x * 0.25, 0.05], [x * 0.7, -0.1], [x * 1.05, -0.4], [x * 1.25, -0.8]];              // 龍鬚
      for (let k = 0; k < 3; k++) rod(g, M.ink, w[k], w[k + 1], 0.02, 0.6);
    }
  }, [0, 0.4, 0.8], 1.85);
}
function dragonCoil(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 1.75, r = 3.1, s = 0.56 - i * 0.02;
    part(spin, GEO.ico2, i % 2 ? BM.dragon : BM.dragon2, [Math.cos(a) * r, Math.sin(a) * r * 0.9 + 0.4, 0.6], [s, s, s * 0.8]);
    part(spin, GEO.cone, M.ink, [Math.cos(a) * (r + s * 0.9), Math.sin(a) * (r + s * 0.9) * 0.9 + 0.4, 0.6], [0.1, 0.3, 0.06], [0, 0, a - Math.PI / 2]); // 背鰭
  }
  part(spin, GEO.cone, M.ink, [Math.cos(Math.PI * 1.78) * 3.0, Math.sin(Math.PI * 1.78) * 2.7 + 0.4, 0.6], [0.2, 0.6, 0.1], [0, 0, Math.PI * 1.78]); // 尾巴
  rig.add(spin);
}
/** 魔教教主:黑袍紅裡 + 白色的臉(紅眼影)+ 披散的長髮 + 爪子手 */
function demonBody(b) {
  chibi(b, [0, 0.2, 0.6], 3.0, {
    body: BM.demon, pants: BM.demon, face: BM.demonFace, head: BM.hairLong, noFace: true,
    extra(g, hg) {
      for (const x of [-1, 1]) {
        part(hg, GEO.box, BM.demonRed, [x * 0.1, 0.0, 0.29], [0.12, 0.05, 0.02], [0, 0, x * 0.3]);      // 紅眼影
        part(hg, GEO.box, M.eye, [x * 0.1, 0.0, 0.305], [0.07, 0.018, 0.02], [0, 0, x * 0.3]);
        part(hg, GEO.ico2, BM.hairLong, [x * 0.26, -0.3, -0.05], [0.1, 0.36, 0.1]);                     // 披散的長髮
        for (let k = 0; k < 3; k++) part(g, GEO.cone, M.ink, [x * (0.4 + k * 0.03), -0.4 - k * 0.02, 0.1], [0.015, 0.08, 0.015], [0, 0, Math.PI + x * (0.3 - k * 0.3)]); // 爪子
      }
      part(hg, GEO.box, BM.demonRed, [0, -0.13, 0.29], [0.08, 0.02, 0.02]);                             // 紅唇
      part(hg, GEO.ico2, BM.demonRed, [0, 0.18, 0.26], 0.03);                                            // 額頭的紅點
      part(g, GEO.box, BM.demonRed, [0, -0.25, 0.2], [0.06, 0.5, 0.03]);                                  // 紅色衣襟
      for (const x of [-1, 1]) part(g, GEO.ico2, BM.demon, [x * 0.32, -0.08, 0.02], [0.15, 0.11, 0.13]);
    },
  });
}
function talismanRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, new THREE.PlaneGeometry(0.28, 0.56), BM.talisman, [Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9], 1, [0, 0, a]);
  }
  rig.add(spin);
}
/** 武功秘笈(獎勵關):攤開的卷軸(兩根木軸 + 白紙 + 直書「武功秘笈」)+ 一圈飛舞的書頁 */
function scrollBody(b) {
  standing(b, (g) => {
    part(g, GEO.box, BM.paper, [0, 0, 0], [2.2, 1.6, 0.06]);
    for (const x of [-1, 1]) {
      part(g, GEO.cyl, BM.roller, [x * 1.15, 0, 0.02], [0.1, 1.9, 0.1]);
      for (const y of [-1, 1]) part(g, GEO.cyl, M.red, [x * 1.15, y * 0.98, 0.02], [0.12, 0.06, 0.12]);
    }
  }, [0, 0.2, 0.6], 1.9);
}
function scrollExtras(rig) {
  const { mat, aspect } = noboriMat('武功秘笈', '#f4efe2', '#141414');
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.3 * aspect * 1.6, 1.3 * 1.6), mat);
  f.scale.setScalar(1.25); f.position.set(0.18, 0.45, 1.1); f.rotation.x = LEAN; rig.add(f);
  const seal = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: bannerTex('印', '#d02a1e', '#f4efe2') }));
  seal.position.set(-1.0, -0.25, 0.9); seal.rotation.x = LEAN; rig.add(seal);
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, new THREE.PlaneGeometry(0.4, 0.55), flat({ color: 0xf4efe2, side: THREE.DoubleSide }), [Math.cos(a) * 2.3, Math.sin(a) * 2.2, 0.5], 1, [0.4, 0.3, a]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'bandit') return template(banditKingBody, 1.5, (rig) => addNobori(rig, [-2.3, 2.0, 1.4], '黑風寨', '#d02a1e', 2.2), { shadow: [1.5, 1.3] });
  if (kind === 'dragon') return template(dragonBody, 1.5, dragonCoil, { shadow: [1.7, 1.4] });
  if (kind === 'demon') return template(demonBody, 1.5, (rig) => { addNobori(rig, [-2.3, 2.0, 1.4], '天魔', '#161618', 1.8, '#d02a1e'); talismanRing(rig); }, { shadow: [1.5, 1.3] });
  return template(scrollBody, 1.4, scrollExtras, { shadow: [1.6, 1.2] });
}

/* ---------------- 滾來的酒罈(原本的隕石):圓圓的陶罈 + 紅紙「酒」+ 封口布,往前滾 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.ico2, C(0x6a625a), [0, 0, 0], [0.45, 0.45, 0.45]);
  part(body, GEO.cyl, C(0x4a4440, 2), [0, 0.42, 0], [0.22, 0.12, 0.22]);
  part(body, GEO.ico2, C(0xe8e4dc, 2), [0, 0.5, 0], [0.26, 0.08, 0.26]);                                   // 封口布
  part(body, new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ map: bannerTex('酒', '#d02a1e') }), [0, 0.02, 0.455], 1);
  rig.add(bake(body));
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.25, depthWrite: false }), [0, -1.0, -0.2], [0.35, 1.1, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';                                                                                        // 揚起的塵土(淡墨)
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(bandit, 1.62, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(thief, 1.6, (rig) => { ribbon(rig, [0.1, 0.32, -0.1], 1.3, 1.3); ribbon(rig, [-0.05, 0.3, -0.12], 1.0, 1.1); }, { shadow: [0.4, 0.3], upright: true }),
  boss: template(ironMonk, 1.42, null, { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(鐵頭陀被打)就換單一 mesh 的 material。
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
/** 旗子 / 紅布條飄動(沿用 flapWings 的呼叫點:t = 動畫相位)。零件有 userData.amp / freq / side */
export function flapWings(mdl, t) {
  for (const f of mdl.flags) {
    const u = f.userData, s = Math.sin(t * (u.freq || 0.8) + (u.side ? 0 : u.ph)) * (u.amp || 0.35);
    f.rotation.y = u.side ? -u.side * s : s;
  }
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:卷軸(兩根木軸 + 白紙 + 顏色綁繩 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xd02a1e, name: '劍氣' },
  R: { label: 'R', color: 0x5a5a5c, name: '快劍' },
  S: { label: 'S', color: 0x8a8a88, name: '金鐘罩' },
  B: { label: 'B', color: 0x2a2a2c, name: '霹靂彈' },
  W: { label: 'W', color: 0xf4f2ec, name: '仙鶴' },
  L: { label: '1UP', color: 0xd02a1e, name: '包子' },
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
  draw('#f4efe2', 3, 3); draw('#141414', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.box, C(0xf4efe2, 2), [0, -0.05, 0.2], [0.62, 0.5, 0.06], [-0.4, 0, 0]);                 // 紙
  for (const x of [-1, 1]) part(body, GEO.cyl, C(0x4a3a2a, 2), [x * 0.33, -0.05, 0.2], [0.05, 0.6, 0.05], [-0.4, 0, 0]); // 木軸
  part(body, GEO.cyl, C(it.color, 2), [0, -0.05, 0.25], [0.33, 0.03, 0.04], [0, 0, Math.PI / 2]);       // 綁繩
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.5, depthWrite: false }));
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
const merged = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

/** 玩家:墨色劍氣(一彎新月,開口朝後)+ 淡墨的尾 */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [GEO.crescent.clone().rotateZ(Math.PI * 0.05).scale(0.55, 0.38, 0.25), SHOT_MAT],
    [geoAt(GEO.cone, [0, -0.3, 0], [0.06, 0.4, 0.03]).rotateZ(0), SHOT_TIP],
  ], cap);
}
/** 敵彈:朱紅飛鏢(尖端朝前進方向 + 黑色尾巴) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [merged([geoAt(GEO.cone, [0, 0.05, 0], [0.12, 0.34, 0.06]), geoAt(GEO.ico, [0, -0.14, 0], [0.1, 0.1, 0.06])]), EB_MAT],
    [geoAt(GEO.box, [0, -0.28, 0], [0.04, 0.2, 0.02]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
