import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 1930 年代黑白卡通的角色:橡皮管手腳(軟軟彎彎、沒有關節)、派切眼(黑眼珠缺一角)、
 * 白色四指手套、大鞋子。全部用基本幾何體拼出來(沒有模型檔)。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:角色在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。角色模型「不跟著前進方向旋轉」(userData.upright)。
 * 畫面最後會被轉成黑白(skin.js LOOK.style),所以配色只看亮度:黑身體、白手套、奶油色的臉。
 *
 * 內部型別沿用原本的名字:bee = 跳舞的花、bfly = 小幽靈、boss = 骷髏(打兩下)、rock = 滾來的炸彈。
 * ------------------------------------------------------------------ */

export const GROUND_Z = 1.6;
const LEAN = 0.62;

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 10),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  halfRing: new THREE.TorusGeometry(1, 0.12, 5, 14, Math.PI),
  disc: new THREE.CircleGeometry(1, 22),
  // 派切眼的黑眼珠:圓形缺右上一角
  pie: new THREE.CircleGeometry(1, 20, 1.15, Math.PI * 2 - 0.85),
  star: starGeo(),
};
function starGeo() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }).translate(0, 0, -0.15);
}

const C = (color, bands = 2) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), black: C(0x24221e), white: C(0xf8f6f0), cream: C(0xf2e8d8), gray: C(0x8a847a), gray2: C(0x5a564e),
  eye: flat({ color: 0x141210 }), eyeW: flat({ color: 0xfffcf4 }), mouth: flat({ color: 0x1a1816 }), tongue: C(0x9a8a84),
  brass: C(0xe8dcc0), wood: C(0x6a6258), glove: C(0xfcfaf4),
  // 跳舞的花
  petal: C(PAL.beeBody), stem: C(PAL.beeBelly), leaf: C(PAL.beeWing), pot: C(0x8a7a6e),
  // 小幽靈
  ghost: C(PAL.bflyBody),
  // 骷髏
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0x2a2824),
  capWhite: C(PAL.captive), capRed: C(0xf0ece4), capBlue: C(PAL.captiveDark),
};

/** 骷髏被打第一下之後換色用的對照表(骨頭變暗、快散了) */
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
/** 橡皮管手腳:從 a 到 b 的一條彎彎的軟管(二次曲線,bend = 往側邊鼓出去多少),沒有關節 */
function hose(parent, mat, a, b, bend, r, z = 0) {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
  const c = [mx - dy / L * bend, my + dx / L * bend];
  const P = (t) => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const N = 5;
  for (let i = 0; i < N; i++) {
    const p = P(i / N), q = P((i + 1) / N);
    rod(parent, mat, p, q, r, z);
    part(parent, GEO.ico, mat, [q[0], q[1], z], r * 1.02);
  }
}
/** 派切眼:白色橢圓眼白 + 缺一角的黑眼珠(往 look 方向看) */
function pieEye(g, x, y, z, s = 1, look = [0, -0.2]) {
  part(g, GEO.ico2, M.eyeW, [x, y, z], [0.075 * s, 0.11 * s, 0.04 * s]);
  part(g, GEO.pie, M.eye, [x + look[0] * 0.03 * s, y + look[1] * 0.05 * s, z + 0.042 * s], [0.045 * s, 0.07 * s, 1]);
}
/** 白色四指手套:手掌 + 三根胖手指 + 袖口的一圈 */
function glove(g, pos, s = 1, rz = 0) {
  const h = new THREE.Group(); h.position.set(...pos); h.rotation.z = rz; h.scale.setScalar(s); g.add(h);
  part(h, GEO.ico2, M.glove, [0, 0, 0], [0.1, 0.09, 0.08]);
  for (let i = 0; i < 3; i++) part(h, GEO.ico, M.glove, [(i - 1) * 0.055, 0.08, 0.02], [0.035, 0.05, 0.035]);
  part(h, GEO.ico, M.glove, [0.1, 0.0, 0.02], [0.035, 0.03, 0.03]);                // 大拇指
  part(h, GEO.cyl, M.glove, [0, -0.08, 0], [0.075, 0.05, 0.07]);                    // 袖口
  for (const x of [-0.03, 0.03]) part(h, GEO.box, M.gray2, [x, 0.0, 0.08], [0.01, 0.07, 0.01]); // 手背的三條線
}
/** 大鞋子(往外側、往鏡頭方向鼓出來) */
function shoe(g, x, y, mat = M.black) {
  part(g, GEO.ico2, mat, [x * 1.3, y, 0.07], [0.15, 0.08, 0.14]);
  part(g, GEO.box, M.white, [x * 1.3, y - 0.06, 0.07], [0.22, 0.02, 0.18]);          // 鞋底的一條白
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
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x141210, transparent: true, opacity: 0.3, depthWrite: false });
function addShadow(root, rx, ry) {
  const s = new THREE.Mesh(GEO.disc, SHADOW_MAT);
  s.name = 'shadow'; s.scale.set(rx, ry, 1); s.position.z = -GROUND_Z + 0.04;
  s.userData.base = [rx, ry];
  root.add(s);
}

/**
 * 組樣板:body(fn)烤成一塊,extras(rig) 放不烤的零件(光環、會轉的東西…)。
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

/* ---------------- 字的貼圖(招牌 / 錢袋的 $):canvas 畫字 ---------------- */
const texCache = new Map();
export function signTex(text, bg, fg = '#141210', w = 128, h = 64, font = 'Georgia,"Times New Roman",serif') {
  const k = [text, bg, fg, w, h].join('|');
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); }
  g.fillStyle = fg; g.font = `900 ${Math.round(h * 0.6)}px ${font}`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

/* ---------------- 橡皮管卡通人偶 ----------------
 * 在人偶自己的座標系裡蓋(站姿:頭 +y、臉 +z),最後整組往後仰 LEAN,放到 at。
 * o:{ body, pants, head, limbs(手腳顏色), shoes, handL / handR(手的位置 [x, y]), noGloves, big(頭的倍率), extra(g, hg) } */
function toon(b, at, s, o) {
  const g = new THREE.Group();
  const limb = o.limbs || o.body;
  part(g, GEO.ico2, o.body, [0, -0.22, 0], [0.25, 0.28, 0.21]);                           // 梨形身體
  part(g, GEO.ico2, o.pants || o.body, [0, -0.44, 0], [0.26, 0.15, 0.22]);                // 短褲
  // 腳:兩條軟管 + 大鞋
  for (const x of [-1, 1]) {
    hose(g, limb, [x * 0.1, -0.5], [x * 0.14, -0.78], x * 0.05, 0.035);
    shoe(g, x * 0.14, -0.82, o.shoes || M.black);
  }
  // 手:兩條軟管(往外彎)+ 手套
  const hl = o.handL || [-0.46, -0.32], hr = o.handR || [0.46, -0.32];
  for (const [x, h] of [[-1, hl], [1, hr]]) {
    hose(g, limb, [x * 0.2, -0.12], h, x * (h[1] > -0.1 ? -0.1 : 0.1), 0.032, 0.03);
    if (!o.noGloves) glove(g, [h[0], h[1], 0.03], 1, x * 0.3);
    else part(g, GEO.ico, limb, [h[0], h[1], 0.03], 0.06);
  }
  const hg = new THREE.Group(); hg.position.set(0, 0.24 + ((o.big || 1) - 1) * 0.22, 0); hg.scale.setScalar(o.big || 1); g.add(hg);
  part(hg, GEO.ico2, o.head || o.body, [0, 0, 0], [0.3, 0.29, 0.28]);
  if (o.extra) o.extra(g, hg);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}
/** 大大的笑嘴(半圈黑 + 舌頭) */
function grin(hg, y, z, w = 0.12, tongue = true) {
  part(hg, GEO.halfRing, M.mouth, [0, y, z], [w, w * 0.8, 0.12], [0, 0, Math.PI]);
  if (tongue) part(hg, GEO.ico, M.tongue, [0, y - w * 0.55, z - 0.01], [w * 0.4, w * 0.22, 0.03]);
}

/** 在自己的座標系裡站著(臉朝 +z),最後整個往後仰 LEAN(跟人偶一樣) */
function standing(b, fn, at = [0, 0, 0.2], s = 1) {
  const g = new THREE.Group(); fn(g);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}

/* ---------------- 跳舞的花(bee):白花瓣 + 笑臉 + 莖當身體 + 葉子手 + 大鞋,跟著拍子蹦 ---------------- */
function flower(b) {
  standing(b, (g) => {
    const hg = new THREE.Group(); hg.position.set(0, 0.22, 0); g.add(hg);
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2;
      part(hg, GEO.ico2, M.petal, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.03], [0.13, 0.19, 0.06], [0, 0, a - Math.PI / 2]);
    }
    part(hg, GEO.ico2, M.cream, [0, 0, 0.02], [0.24, 0.23, 0.12]);
    for (const x of [-1, 1]) pieEye(hg, x * 0.08, 0.05, 0.12, 0.95);
    grin(hg, -0.07, 0.13, 0.09);
    rod(g, M.stem, [0, 0.0], [0, -0.55], 0.05);                                                       // 莖
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.leaf, [x * 0.22, -0.24, 0.02], [0.18, 0.07, 0.05], [0, 0, x * 0.5]);        // 葉子手臂
      glove(g, [x * 0.4, -0.12, 0.03], 0.8, x * 0.4);
      hose(g, M.stem, [0, -0.52], [x * 0.14, -0.78], x * 0.04, 0.03);
      shoe(g, x * 0.14, -0.82);
    }
  });
}

/* ---------------- 小幽靈(bfly):一條白床單 + 黑色大眼窩 + O 型嘴,飄在半空 ---------------- */
function ghost(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.ghost, [0, 0.12, 0], [0.33, 0.34, 0.3]);
    part(g, GEO.cone, M.ghost, [0, -0.28, 0], [0.4, 0.6, 0.32], [Math.PI, 0, 0]);
    for (let i = 0; i < 5; i++) part(g, GEO.ico, M.ghost, [(i - 2) * 0.16, -0.58, 0], [0.1, 0.08, 0.1]);   // 波浪的下擺
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.mouth, [x * 0.11, 0.18, 0.27], [0.07, 0.1, 0.03]);                              // 黑眼窩
      part(g, GEO.ico, M.eyeW, [x * 0.11 + 0.02, 0.21, 0.3], 0.022);                                       // 眼睛裡的亮點
      part(g, GEO.ico2, M.ghost, [x * 0.36, -0.08, 0.04], [0.1, 0.16, 0.08], [0, 0, x * 0.9]);             // 飄飄的手
    }
    part(g, GEO.ico2, M.mouth, [0, 0.0, 0.29], [0.06, 0.08, 0.03]);                                        // O 嘴
  }, [0, 0, 0.3]);
}

/* ---------------- 骷髏(boss):白色骷髏頭 + 黑身體上的白肋骨 + 骨頭手腳,打兩下 ---------------- */
function skeleton(b) {
  toon(b, [0, 0, 0.25], 1.22, {
    body: M.bossInner, pants: M.bossInner, head: M.bossHead, limbs: M.bossBody, shoes: M.bossBody, noGloves: true,
    handL: [-0.44, -0.02], handR: [0.46, -0.3],
    extra(g, hg) {
      for (let i = 0; i < 4; i++) part(g, GEO.box, M.bossBody, [0, -0.08 - i * 0.08, 0.2], [0.34 - i * 0.04, 0.035, 0.03]); // 肋骨
      part(g, GEO.box, M.bossBody, [0, -0.2, 0.22], [0.04, 0.34, 0.03]);                                                   // 脊椎
      part(g, GEO.ico2, M.bossBody, [0, -0.44, 0.18], [0.2, 0.08, 0.06]);                                                   // 骨盆
      for (const x of [-1, 1]) {
        part(hg, GEO.ico2, M.mouth, [x * 0.1, 0.03, 0.24], [0.08, 0.09, 0.04]);                                            // 眼窩
        part(hg, GEO.ico, M.eyeW, [x * 0.1, 0.02, 0.28], 0.025);
      }
      part(hg, GEO.cone, M.mouth, [0, -0.07, 0.27], [0.04, 0.06, 0.02], [Math.PI, 0, 0]);                                   // 鼻孔
      part(hg, GEO.box, M.bossHead, [0, -0.18, 0.2], [0.24, 0.08, 0.1]);                                                    // 牙齒
      for (let i = 0; i < 5; i++) part(hg, GEO.box, M.mouth, [(i - 2) * 0.045, -0.18, 0.255], [0.008, 0.07, 0.01]);
      // 拿一根骨頭當鼓棒
      rod(g, M.bossBody, [0.46, -0.3], [0.52, 0.02], 0.025, 0.08);
      for (const x of [-1, 1]) part(g, GEO.ico, M.bossBody, [0.52 + x * 0.03, 0.04, 0.08], 0.04);
      part(hg, GEO.cyl, M.black, [0.06, 0.3, -0.02], [0.2, 0.03, 0.2]);                                                     // 歪戴的小禮帽
      part(hg, GEO.cyl, M.black, [0.06, 0.4, -0.02], [0.13, 0.2, 0.13]);
      part(hg, GEO.cyl, M.white, [0.06, 0.33, -0.02], [0.135, 0.03, 0.135]);
    },
  });
}

/* ---------------- 玩家:小咚(10 段星途) ----------------
 * 黑身體 + 奶油色的臉 + 垂下來的長耳朵 + 派切眼 + 白手套 + 大鞋,舉著小喇叭吹音符。每一段加零件:
 *   Lv2 白色領結、Lv3 白襯衫前襟、Lv4 草編硬邊帽、Lv5 胸前的星星、Lv6 左手拐杖、
 *   Lv7 高禮帽(換掉草帽)、Lv8 聚光燈的光、Lv9 白色鞋套 + 胸花、Lv10 頭頂一圈音符光環。
 * 'ally' = 會走路的小鋼琴(黑色琴身、白琴鍵當牙齒、派切眼、橡皮管腳)。 */
export const SHIP_LV = [
  { name: '臨時演員', body: 0x24221e, accent: 0xf8f6f0, pod: 0x8a847a, flame: 0xfff8ec, span: 1.0 },
  { name: '跑龍套', body: 0x24221e, accent: 0xf8f6f0, pod: 0x8a847a, flame: 0xfff8ec, span: 1.02 },
  { name: '小配角', body: 0x22201c, accent: 0xf8f6f0, pod: 0x807a70, flame: 0xfff8ec, span: 1.04 },
  { name: '配角', body: 0x22201c, accent: 0xf8f6f0, pod: 0x807a70, flame: 0xfff8ec, span: 1.06 },
  { name: '男主角', body: 0x201e1a, accent: 0xffffff, pod: 0x6a665e, flame: 0xfff4e0, span: 1.08 },
  { name: '當家小生', body: 0x201e1a, accent: 0xffffff, pod: 0x6a665e, flame: 0xfff4e0, span: 1.1 },
  { name: '大明星', body: 0x1e1c18, accent: 0xffffff, pod: 0x5a564e, flame: 0xfff0d8, span: 1.12 },
  { name: '超級巨星', body: 0x1e1c18, accent: 0xffffff, pod: 0x4a4640, flame: 0xfff0d8, span: 1.14 },
  { name: '影壇傳奇', body: 0x1a1816, accent: 0xffffff, pod: 0x3a3834, flame: 0xffecd0, span: 1.16 },
  { name: '卡通之王', body: 0x1a1816, accent: 0xffffff, pod: 0x2a2824, flame: 0xffffff, span: 1.2 },
];

/** 小喇叭:管子 + 喇叭口(朝上,音符從這裡吹出去) */
function trumpet(g, at, s = 1) {
  const t = new THREE.Group(); t.position.set(...at); t.scale.setScalar(s); g.add(t);
  part(t, GEO.cyl, M.brass, [0, 0.1, 0], [0.025, 0.36, 0.025]);
  part(t, GEO.cone, M.brass, [0, 0.33, 0], [0.1, 0.14, 0.1], [Math.PI, 0, 0]);
  part(t, GEO.cyl, M.brass, [0.04, 0.05, 0.02], [0.018, 0.06, 0.018]);
  part(t, GEO.torus, M.brass, [0.03, 0.02, 0], [0.05, 0.08, 0.1], [0, Math.PI / 2, 0]);
}

function dogBody(m, L) {
  return (b) => {
    toon(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: m.blue, head: m.red, limbs: m.red, big: 1.3,
      handR: [0.34, 0.02], handL: L >= 6 ? [-0.44, -0.18] : [-0.46, -0.3],
      extra(g, hg) {
        part(hg, GEO.ico2, M.cream, [0, -0.07, 0.13], [0.24, 0.2, 0.18]);                                // 臉(奶油色面罩)
        part(hg, GEO.ico2, M.cream, [0, -0.1, 0.27], [0.15, 0.11, 0.15]);                                // 往前凸的狗鼻口
        part(hg, GEO.ico2, M.black, [0, -0.05, 0.43], [0.08, 0.065, 0.07]);                               // 大黑鼻頭
        part(hg, GEO.ico, M.eyeW, [0.02, -0.02, 0.495], 0.016);
        for (const x of [-1, 1]) {
          pieEye(hg, x * 0.075, 0.08, 0.27, 1.05, [x * 0.2, -0.2]);
          // 往兩邊翹出去、尾端垂下來的狗耳朵
          part(hg, GEO.ico2, m.red, [x * 0.34, 0.1, -0.02], [0.07, 0.17, 0.05], [0, 0, x * 1.1]);
          part(hg, GEO.ico2, m.red, [x * 0.47, -0.02, -0.02], [0.07, 0.11, 0.05], [0, 0, x * 0.2]);
        }
        grin(hg, -0.19, 0.3, 0.09);
        for (const x of [-1, 1]) part(g, GEO.ico, M.white, [x * 0.1, -0.42, 0.2], 0.035);               // 短褲的兩顆白扣子
        trumpet(g, [0.34, 0.08, 0.1], 1.1);
        if (L >= 2) for (const x of [-1, 1]) part(g, GEO.cone, M.white, [x * 0.06, 0.02, 0.19], [0.05, 0.08, 0.03], [0, 0, -x * Math.PI / 2]); // 領結
        if (L >= 3) part(g, GEO.ico2, M.white, [0, -0.15, 0.13], [0.13, 0.16, 0.09]);                    // 白襯衫前襟
        if (L >= 4 && L < 7) {                                                                           // 草編硬邊帽
          part(hg, GEO.cyl, M.cream, [0, 0.27, -0.02], [0.34, 0.025, 0.32]);
          part(hg, GEO.cyl, M.cream, [0, 0.34, -0.03], [0.2, 0.11, 0.19]);
          part(hg, GEO.cyl, M.black, [0, 0.31, -0.03], [0.205, 0.035, 0.195]);
        }
        if (L >= 5) part(g, GEO.star, M.white, [-0.1, -0.1, 0.22], [0.07, 0.07, 0.1]);                  // 胸前的星星
        if (L >= 6) { rod(g, M.black, [-0.44, -0.18], [-0.48, -0.78], 0.02, 0.08); part(g, GEO.ico, M.white, [-0.48, -0.8, 0.08], 0.035);
          part(g, GEO.halfRing, M.black, [-0.4, -0.16, 0.08], [0.05, 0.05, 0.2]); }                      // 拐杖
        if (L >= 7) {                                                                                    // 高禮帽
          part(hg, GEO.cyl, M.black, [0, 0.28, -0.03], [0.3, 0.03, 0.28]);
          part(hg, GEO.cyl, M.black, [0, 0.45, -0.04], [0.18, 0.32, 0.17]);
          part(hg, GEO.cyl, M.white, [0, 0.33, -0.04], [0.185, 0.05, 0.175]);
        }
        if (L >= 9) {
          for (const x of [-1, 1]) part(g, GEO.ico2, M.white, [x * 0.19, -0.8, 0.12], [0.1, 0.06, 0.08]); // 白色鞋套
          for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(g, GEO.ico, M.white, [0.13 + Math.cos(a) * 0.035, -0.02 + Math.sin(a) * 0.035, 0.2], 0.025); } // 胸花
        }
      },
    });
  };
}
/** 小鋼琴(僚機):直立鋼琴 + 白琴鍵嘴 + 派切眼 + 橡皮管腳 + 手套 */
function pianoBody(b) {
  standing(b, (g) => {
    part(g, GEO.box, M.black, [0, 0.0, 0], [0.8, 0.72, 0.34]);                                 // 琴身
    part(g, GEO.box, M.gray2, [0, 0.38, 0.02], [0.86, 0.06, 0.38]);                            // 琴蓋
    part(g, GEO.box, M.black, [0, -0.2, 0.22], [0.78, 0.07, 0.16]);                            // 鍵盤底座
    part(g, GEO.box, M.white, [0, -0.15, 0.24], [0.7, 0.07, 0.14]);                            // 白鍵(= 大白牙)
    for (let i = 0; i < 9; i++) part(g, GEO.box, M.black, [-0.28 + i * 0.07, -0.125, 0.3], [0.025, 0.035, 0.05]);
    for (let i = 0; i < 10; i++) part(g, GEO.box, M.gray2, [-0.315 + i * 0.07, -0.16, 0.315], [0.004, 0.06, 0.01]);
    for (const x of [-1, 1]) {
      pieEye(g, x * 0.13, 0.12, 0.18, 1.3, [x * 0.2, -0.3]);
      hose(g, M.black, [x * 0.25, -0.34], [x * 0.24, -0.62], x * 0.06, 0.035);
      shoe(g, x * 0.2, -0.66);
      hose(g, M.black, [x * 0.38, 0.0], [x * 0.52, -0.2], x * 0.08, 0.03, 0.05);
      glove(g, [x * 0.54, -0.22, 0.06], 1, x * 0.3);
      part(g, GEO.cyl, M.brass, [x * 0.3, 0.26, 0.2], [0.04, 0.08, 0.04], [Math.PI / 2, 0, 0]);  // 燭台
    }
    part(g, GEO.box, M.cream, [0, 0.52, 0.02], [0.24, 0.2, 0.02], [-0.2, 0, 0]);             // 樂譜
    for (let i = 0; i < 3; i++) part(g, GEO.box, M.black, [0, 0.47 + i * 0.05, 0.04], [0.18, 0.006, 0.01], [-0.2, 0, 0]);
  }, [0, 0, 0.3], 1.1);
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
const HALO_GEO = new THREE.TorusGeometry(0.9, 0.05, 6, 36);
function noteGeo() {
  // ♪:斜斜的橢圓音頭 + 直的符桿 + 一條旗
  return mergeGeometries([
    geoAt(GEO.ico, [0, 0, 0], [0.13, 0.095, 0.06]).rotateZ(0.4),
    geoAt(GEO.box, [0.1, 0.2, 0], [0.035, 0.42, 0.04]),
    geoAt(GEO.box, [0.17, 0.34, 0], [0.16, 0.05, 0.04]).rotateZ(-0.4).translate(0.12, 0.08, 0),
  ].map((g) => (g.index ? g.toNonIndexed() : g)));
}
const NOTE_GEO = noteGeo();
function shipTemplate(m, L = 1, ally = false) {
  return template(ally ? pianoBody : dogBody(m, L), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下揚起的小煙團(卡通跑步的「咻」)
    for (const x of [-0.22, 0.22]) addPuff(rig, [x, -1.0, -0.1], m.flame || 0xfff8ec);
    if (ally) return;
    if (L >= 10) {
      const h = new THREE.Group(); h.name = 'halo'; h.position.set(0, 0.8, 0.2); rig.add(h);
      const nm = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, n = new THREE.Mesh(NOTE_GEO, nm);
        n.position.set(Math.cos(a) * 0.75, Math.sin(a) * 0.3, 0); n.scale.setScalar(0.9); h.add(n);
      }
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: L >= 10 ? 0.16 : 0.11, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(0.9, 1.1, 0.45); rig.add(a);
    }
  }, { shadow: [0.5, 0.4], upright: true });
}
function evolvedShip(L, ally = false) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: C(0xf0f0f4), red: C(c.body), blue: C(c.pod), flame: c.flame }, L, ally);
}
function addPuff(rig, pos, color) {
  const fm = flat({ color, transparent: true, opacity: 0.85, depthWrite: false });
  const f = part(rig, GEO.ico, fm, pos, [0.12, 0.16, 0.1]);
  f.name = 'flame';
  return f;
}

/* ---------------- 大反派(面朝玩家) ---------------- */
const BM = {
  steel: C(0x3a3834), steel2: C(0x6a665e), face: C(0xf0e8da), lamp: flat({ color: 0xfffcec }), red: C(0x8a8076),
  moon: C(0xf4ecd8), crater: C(0xc8bea8), cap: C(0x5a564e), capW: C(0xf8f4ec),
  fur: C(0x8a8680), furL: C(0xd0cac0), suit: C(0x2a2824), shirt: C(0xf8f6f0),
  sack: C(0xd8ccb4), rope: C(0x6a6054), coin: C(0xf8f0d8),
  puff: new THREE.MeshBasicMaterial({ color: 0xf8f4ec, transparent: true, opacity: 0.85, depthWrite: false }),
  starM: new THREE.MeshBasicMaterial({ color: 0xfffcf0 }),
};

/** 火車頭老大:正面是一個圓圓的鍋爐,上面有一張臉 + 大燈 + 煙囪 + 排障器 + 兩側的大輪子 */
function trainBody(b) {
  standing(b, (g) => {
    part(g, GEO.cyl, BM.steel, [0, 0.1, -0.3], [1.0, 1.2, 1.0], [Math.PI / 2, 0, 0]);          // 鍋爐(圓筒朝鏡頭)
    part(g, GEO.cyl, BM.steel2, [0, 0.1, 0.32], [1.04, 0.08, 1.04], [Math.PI / 2, 0, 0]);       // 鍋爐前緣
    part(g, GEO.cyl, BM.face, [0, 0.1, 0.36], [0.9, 0.04, 0.9], [Math.PI / 2, 0, 0]);           // 臉
    for (const x of [-1, 1]) {
      pieEye(g, x * 0.3, 0.32, 0.4, 3.2, [x * 0.15, -0.3]);
      part(g, GEO.box, BM.steel, [x * 0.3, 0.72, 0.42], [0.36, 0.06, 0.04], [0, 0, x * 0.3]);   // 眉毛(兇)
      part(g, GEO.ico2, BM.steel, [x * 1.0, -0.75, 0.0], [0.22, 0.5, 0.5]);                    // 大輪子
      part(g, GEO.torus, BM.steel2, [x * 1.08, -0.75, 0.0], [0.5, 0.5, 0.8], [0, Math.PI / 2, 0]);
    }
    part(g, GEO.ico2, BM.steel, [0, -0.02, 0.44], [0.14, 0.11, 0.08]);                          // 鼻子(鉚釘)
    for (const x of [-1, 1]) part(g, GEO.ico2, BM.steel, [x * 0.28, -0.14, 0.44], [0.3, 0.1, 0.06], [0, 0, -x * 0.35]); // 八字大鬍子
    grin(g, -0.3, 0.41, 0.36);
    for (let i = 0; i < 5; i++) part(g, GEO.box, BM.shirt, [(i - 2) * 0.12, -0.26, 0.43], [0.1, 0.08, 0.02]); // 一排大白牙
    part(g, GEO.cyl, BM.steel, [0, 1.25, -0.2], [0.22, 0.6, 0.22]);                              // 煙囪
    part(g, GEO.cone, BM.steel, [0, 1.62, -0.2], [0.38, 0.3, 0.38], [Math.PI, 0, 0]);
    part(g, GEO.cyl, BM.lamp, [0, 0.95, 0.3], [0.16, 0.14, 0.16], [Math.PI / 2, 0, 0]);         // 大燈
    part(g, GEO.cone, BM.steel2, [0, -1.02, 0.5], [0.9, 0.5, 0.5], [Math.PI, 0, 0]);             // 排障器
    for (let i = 0; i < 7; i++) part(g, GEO.box, BM.steel, [(i - 3) * 0.2, -1.05, 0.72], [0.04, 0.36, 0.04], [0.4, 0, (i - 3) * -0.18]);
    for (const x of [-1, 1]) part(g, GEO.box, BM.steel, [x * 0.8, 0.95, -0.6], [0.35, 0.6, 0.6]); // 後面的駕駛室
    part(g, GEO.box, BM.steel2, [0, 1.3, -0.7], [1.9, 0.12, 0.7]);
  }, [0, 0.2, 0.7], 1.5);
}
function puffRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    part(spin, GEO.ico, BM.puff, [Math.cos(a) * 2.9, Math.sin(a) * 2.7 + 0.4, 0.9], [0.4, 0.34, 0.28]);
  }
  rig.add(spin);
}
/** 月亮先生:大圓月(坑洞)+ 瞇瞇眼 + 大笑 + 歪戴的睡帽(尾端一顆毛球) */
function moonBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.moon, [0, 0, 0], [1.3, 1.3, 0.9]);
    for (const [x, y, r] of [[-0.7, 0.5, 0.2], [0.75, -0.3, 0.16], [-0.5, -0.7, 0.13], [0.5, 0.7, 0.1], [0.9, 0.3, 0.08]]) part(g, GEO.ico2, BM.crater, [x, y, 0.95 - Math.hypot(x, y) * 0.3], [r, r, 0.05]);
    for (const x of [-1, 1]) {
      part(g, GEO.halfRing, M.mouth, [x * 0.38, 0.2, 0.88], [0.18, 0.12, 0.2]);                  // 瞇瞇眼(彎彎的)
      part(g, GEO.ico2, BM.crater, [x * 0.62, -0.18, 0.8], [0.16, 0.1, 0.05]);                   // 臉頰
    }
    part(g, GEO.ico2, BM.moon, [0, -0.05, 0.95], [0.18, 0.14, 0.12]);                            // 鼻子
    grin(g, -0.35, 0.88, 0.36);
    // 睡帽:從頭頂往右邊垂下來
    part(g, GEO.cone, BM.cap, [0.2, 1.3, -0.1], [0.75, 1.1, 0.6], [0, 0, -0.9]);
    part(g, GEO.torus, BM.capW, [-0.05, 1.05, -0.05], [0.85, 0.85, 1.6], [Math.PI / 2 - 0.3, 0, 0.35]);
    part(g, GEO.ico2, BM.capW, [1.08, 1.55, -0.1], 0.2);
    for (const x of [-1, 1]) {
      hose(g, M.black, [x * 1.05, -0.4], [x * 1.5, -0.8], -x * 0.1, 0.05, 0.1);
      glove(g, [x * 1.52, -0.84, 0.12], 1.6, x * 0.6);
    }
  }, [0, 0.2, 0.7], 1.45);
}
function starRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    part(spin, GEO.star, BM.starM, [Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.3, 0.9], [0.32, 0.32, 0.3], [0, 0, a]);
  }
  rig.add(spin);
}
/** 大野狼:灰毛 + 長嘴 + 尖耳朵 + 一排尖牙 + 黑西裝白襯衫 + 高禮帽 + 拐杖 */
function wolfBody(b) {
  toon(b, [0, 0.2, 0.6], 3.0, {
    body: BM.suit, pants: BM.suit, head: BM.fur, limbs: BM.suit, big: 1.2, handR: [0.48, -0.1], handL: [-0.46, -0.34],
    extra(g, hg) {
      part(g, GEO.ico2, BM.shirt, [0, -0.15, 0.13], [0.12, 0.17, 0.1]);                         // 白襯衫
      for (const x of [-1, 1]) part(g, GEO.cone, M.black, [x * 0.05, 0.0, 0.21], [0.04, 0.07, 0.03], [0, 0, -x * Math.PI / 2]); // 領結
      part(hg, GEO.ico2, BM.furL, [0, -0.08, 0.14], [0.22, 0.17, 0.16]);                        // 淺色的臉
      part(hg, GEO.cone, BM.fur, [0, -0.08, 0.34], [0.13, 0.32, 0.1], [Math.PI / 2 + 0.25, 0, 0]); // 長嘴
      part(hg, GEO.ico2, M.black, [0, -0.02, 0.5], [0.06, 0.05, 0.05]);                          // 鼻頭
      for (const x of [-1, 1]) {
        pieEye(hg, x * 0.09, 0.08, 0.24, 1.0, [x * 0.1, -0.4]);
        part(hg, GEO.box, M.black, [x * 0.09, 0.2, 0.26], [0.12, 0.025, 0.02], [0, 0, x * 0.4]);  // 壞壞的眉
        part(hg, GEO.cone, BM.fur, [x * 0.2, 0.32, -0.04], [0.09, 0.2, 0.06], [0, 0, -x * 0.35]); // 尖耳朵
      }
      part(hg, GEO.box, M.mouth, [0, -0.2, 0.3], [0.2, 0.05, 0.08]);                             // 嘴
      for (let i = 0; i < 5; i++) part(hg, GEO.cone, BM.shirt, [(i - 2) * 0.04, -0.19, 0.345], [0.015, 0.04, 0.01], [Math.PI, 0, 0]); // 尖牙
      part(hg, GEO.cyl, M.black, [0.04, 0.3, -0.04], [0.28, 0.03, 0.27]);                        // 高禮帽
      part(hg, GEO.cyl, M.black, [0.04, 0.48, -0.05], [0.17, 0.34, 0.16]);
      part(hg, GEO.cyl, BM.shirt, [0.04, 0.35, -0.05], [0.175, 0.05, 0.165]);
      rod(g, M.black, [0.48, -0.1], [0.56, -0.8], 0.02, 0.1);                                    // 拐杖
      part(g, GEO.halfRing, M.black, [0.44, -0.06, 0.1], [0.06, 0.06, 0.2]);
      part(g, GEO.ico2, BM.fur, [0, -0.5, -0.24], [0.1, 0.24, 0.08], [0.6, 0, 0.3]);            // 尾巴
    },
  });
}
function huffRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    part(spin, GEO.ico, BM.puff, [Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9], [0.24, 0.18, 0.16]);
  }
  rig.add(spin);
}
/** 錢袋先生(獎勵關):鼓鼓的麻布袋 + 繩子 + 大大的 $ + 派切眼 + 小短腿跑來跑去 */
function sackBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.sack, [0, -0.15, 0], [1.05, 1.0, 0.8]);
    part(g, GEO.cone, BM.sack, [0, 0.95, 0], [0.45, 0.5, 0.4]);
    part(g, GEO.cyl, BM.rope, [0, 0.72, 0], [0.32, 0.1, 0.28]);
    for (const x of [-1, 1]) {
      pieEye(g, x * 0.24, 0.3, 0.74, 2.2, [x * 0.2, -0.2]);
      hose(g, M.black, [x * 0.4, -1.0], [x * 0.5, -1.45], x * 0.08, 0.05);
      shoe(g, x * 0.42, -1.5);
      hose(g, M.black, [x * 0.95, -0.1], [x * 1.4, 0.2], x * 0.1, 0.05, 0.1);
      glove(g, [x * 1.42, 0.24, 0.12], 1.7, x * 0.4);
    }
    grin(g, 0.0, 0.76, 0.2);
    // 肚子上的大 $:兩個半圈接成 S + 一條直線
    const d = new THREE.Group(); d.position.set(0, -0.42, 0.8); g.add(d);
    part(d, GEO.halfRing, M.black, [0, 0.14, 0], [0.16, 0.15, 0.6], [0, 0, Math.PI / 2]);
    part(d, GEO.halfRing, M.black, [0, -0.14, 0], [0.16, 0.15, 0.6], [0, 0, -Math.PI / 2]);
    part(d, GEO.cyl, M.black, [0, 0, 0], [0.025, 0.8, 0.025]);
  }, [0, 0.2, 0.6], 1.4);
}
function sackExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.cyl, BM.coin, [Math.cos(a) * 2.2, Math.sin(a) * 2.1, 0.5], [0.24, 0.05, 0.24], [Math.PI / 2, 0, 0]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'train') return template(trainBody, 1.5, puffRing, { shadow: [1.7, 1.3] });
  if (kind === 'moon') return template(moonBody, 1.5, starRing, { shadow: [1.5, 1.2] });
  if (kind === 'wolf') return template(wolfBody, 1.5, huffRing, { shadow: [1.5, 1.3] });
  return template(sackBody, 1.4, sackExtras, { shadow: [1.6, 1.2] });
}

/* ---------------- 滾來的炸彈(原本的隕石):黑色圓炸彈 + 怒眼 + 引信 + 火花 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.ico2, C(0x24221e), [0, 0, 0], 0.45);
  part(body, GEO.ico, M.eyeW, [-0.16, 0.18, 0.36], [0.07, 0.04, 0.03]);                                      // 亮面
  part(body, GEO.cyl, C(0x6a665e), [0, 0.45, 0], [0.12, 0.12, 0.12]);
  for (const x of [-1, 1]) {
    pieEye(body, x * 0.14, 0.02, 0.4, 1.1, [0, -0.3]);
    part(body, GEO.box, M.black, [x * 0.14, 0.16, 0.44], [0.14, 0.03, 0.02], [0, 0, x * 0.5]);             // 怒眉
  }
  rod(body, C(0x9a948a), [0, 0.5], [0.08, 0.72], 0.015, 0);                                                  // 引信
  rig.add(bake(body));
  const spark = part(rig, GEO.star, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), [0.08, 0.78, 0], 0.14);
  spark.name = 'flame';
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xf0ece4, transparent: true, opacity: 0.4, depthWrite: false }), [0, -1.0, -0.2], [0.35, 1.1, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';                                                                                        // 揚起的塵土
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(flower, 1.6, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(ghost, 1.55, null, { shadow: [0.4, 0.3], upright: true }),
  boss: template(skeleton, 1.45, null, { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(骷髏被打)就換單一 mesh 的 material。
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
/** 會飄動的零件(這款沒有旗子;保留介面) */
export function flapWings(mdl, t) {
  for (const f of mdl.flags) {
    const u = f.userData, s = Math.sin(t * (u.freq || 0.8) + (u.side ? 0 : u.ph)) * (u.amp || 0.35);
    f.rotation.y = u.side ? -u.side * s : s;
  }
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:黑膠唱片(黑色唱片 + 白標籤 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xfff4e0, name: '喇叭' },
  R: { label: 'R', color: 0xd8d8e8, name: '快板' },
  S: { label: 'S', color: 0xe8f0e0, name: '泡泡糖' },
  B: { label: 'B', color: 0xe8dcf0, name: '大炸彈' },
  W: { label: 'W', color: 0xf0e4d8, name: '小鋼琴' },
  L: { label: '1UP', color: 0xfffcf0, name: '熱狗' },
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
  draw('#141210', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.cyl, M.black, [0, 0, 0.2], [0.46, 0.06, 0.46], [Math.PI / 2 - 0.4, 0, 0]);             // 唱片
  part(body, GEO.torus, M.gray2, [0, 0, 0.2], [0.34, 0.34, 0.3], [-0.4, 0, 0]);                          // 溝槽
  part(body, GEO.cyl, C(it.color), [0, 0, 0.21], [0.2, 0.08, 0.2], [Math.PI / 2 - 0.4, 0, 0]);           // 標籤
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'halo'; root.add(ring);
  const { t, aspect } = labelTex(it.label);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.8 * aspect, 0.8, 1); sp.position.y = -0.08; sp.renderOrder = 5;
  root.add(sp);
  addShadow(root, 0.4, 0.3);
  return root;
}

/* ---------------- 子彈:InstancedMesh,一整批只要 2 個 draw call ----------------
 * 黑白卡通:子彈是不透明的平塗(會被描線 pass 描上黑框,在灰色背景上也看得清楚)。 */
const SHOT_MAT = flat({ color: PAL.shot });
const SHOT_TIP = flat({ color: PAL.shotTip });
const EB_MAT = flat({ color: PAL.ebullet });
const EB_CORE = flat({ color: PAL.ebulletCore });
const merged = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

/** 玩家:喇叭吹出來的音符 ♪(白色 + 黑色的小中心) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [NOTE_GEO.clone().scale(2.3, 2.3, 1.5).translate(-0.2, -0.35, 0), SHOT_MAT],
    [geoAt(GEO.ico0, [-0.2, -0.35, 0.09], [0.1, 0.07, 0.03]), SHOT_TIP],
  ], cap);
}
/** 敵彈:奶油派(深色派皮 + 白色鼓鼓的奶油),朝你飛過來 */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [merged([geoAt(GEO.ico2, [0, 0.02, 0.06], [0.2, 0.2, 0.1]), geoAt(GEO.ico, [0.06, 0.1, 0.12], [0.08, 0.07, 0.06])]), EB_MAT],
    [geoAt(GEO.cyl, [0, -0.04, 0], [0.22, 0.08, 0.22]).rotateX(Math.PI / 2), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
