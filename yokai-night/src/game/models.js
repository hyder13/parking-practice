import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 所有角色都用基本幾何體拼出來(沒有模型檔),Q 版大頭比例 + 浮世繪的平塗色塊(cel 只分 2 階)。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:人物在自己的座標系裡站立(頭 +y、臉 +z),整個人偶再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家 —— 像立體書裡立起來的紙板人偶。
 * 人物模型「不跟著前進方向旋轉」(userData.upright),只依速度左右微傾,臉才不會倒過來。
 *
 * 每個角色腳下有一塊地面陰影('shadow',貼在地面 z = -GROUND_Z),讓人一看就知道在地上。
 * 內部型別沿用原本的名字:bee = 唐傘妖、bfly = 提燈妖、boss = 赤鬼(打兩下,被打一下變青鬼)、rock = 輪入道。
 * ------------------------------------------------------------------ */

export const GROUND_Z = 1.6;
const LEAN = 0.62;

const GEO = {
  ico: new THREE.IcosahedronGeometry(1, 1),
  ico2: new THREE.IcosahedronGeometry(1, 2),
  ico0: new THREE.IcosahedronGeometry(1, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 8),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cyl16: new THREE.CylinderGeometry(1, 1, 1, 16),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
  disc: new THREE.CircleGeometry(1, 22),
  plane: new THREE.PlaneGeometry(1, 1),
};

// 浮世繪:色塊平塗 → 預設只分 2 階
const C = (color, bands = 2) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair), eye: flat({ color: 0x1a1a22 }), cheek: flat({ color: 0xff9a8a }),
  white: C(0xf8f4ea), red: C(0xc8323a), gold: C(0xf2b83a), wood: C(0x7a5238), dark: C(0x22222c), iron: C(0x5a5a66),
  paper: C(0xfaf4e4), ivory: C(0xf6ecd0), indigo: C(0x2a3a6a), pink: C(0xf4a0b0), tongue: C(0xe8505a),
  eboshi: C(0x16161e), tiger: C(0xf2b83a), stripe: C(0x22222c),
  fox: C(0xfaf6ee), foxFur: C(0xf2e2c4), foxGold: C(0xf2c860), foxEar: C(0xe8903a),
  robe: C(0xc8d4f0), robeCord: C(0xc8323a),
  // 唐傘妖
  beeBody: C(PAL.beeBody), beeRib: C(PAL.beeBand), beeHandle: C(PAL.beeWing),
  // 提燈妖(紙發光 → flat 不吃光)
  lantern: flat({ color: 0xfff0c8 }), lanternRib: C(0x2a2226),
  // 赤鬼
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0x4a4a6a),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 赤鬼被打第一下之後換色用的對照表(赤鬼 → 青鬼) */
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
/** 兩點之間的一根棒子(槍桿、戟、槳…),在 XY 平面上 */
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

/* ---------------- 地面陰影 ---------------- */
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x1a1a10, transparent: true, opacity: 0.24, depthWrite: false });
function addShadow(root, rx, ry) {
  const s = new THREE.Mesh(GEO.disc, SHADOW_MAT);
  s.name = 'shadow'; s.scale.set(rx, ry, 1); s.position.z = -GROUND_Z + 0.04;
  s.userData.base = [rx, ry];
  root.add(s);
}

/**
 * 組樣板:body(fn)烤成一塊,extras(rig) 放不烤的零件(旗子、光環…)。
 * opts.shadow = [rx, ry];opts.upright = 人物模型(不跟著前進方向轉)。
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

/* ---------------- 字的貼圖(暖簾 / 招牌 / 小判…):canvas 畫字 ---------------- */
const texCache = new Map();
export function bannerTex(ch, bg, fg = '#fff8e8') {
  const k = ch + bg;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = 64; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 64, 96);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 84, 64, 12);
  g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(5, 5, 54, 74);
  g.fillStyle = fg; g.font = '900 44px "Noto Serif TC","PingFang TC","Microsoft JhengHei",serif';
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}
const bannerMats = new Map();
export function bannerMat(ch, bg) {
  const k = ch + bg;
  if (!bannerMats.has(k)) bannerMats.set(k, new THREE.MeshBasicMaterial({ map: bannerTex(ch, bg), side: THREE.DoubleSide }));
  return bannerMats.get(k);
}

/* ---------------- Q 版人偶 ----------------
 * 在人偶自己的座標系裡蓋(站姿:頭 +y、臉 +z),最後整組往後仰 LEAN,放到 at。
 * o:{ body, pants, head(帽 / 髮)、face(膚色)、extra(g) } */
function chibi(b, at, s, o) {
  const g = new THREE.Group();
  part(g, GEO.ico, o.pants || o.body, [0, -0.5, 0], [0.24, 0.2, 0.2]);                    // 下半身(袍 / 褲)
  part(g, GEO.ico, o.body, [0, -0.2, 0], [0.27, 0.26, 0.22]);                             // 身體
  for (const x of [-1, 1]) {
    part(g, GEO.ico, o.body, [x * 0.29, -0.22, 0.02], [0.09, 0.17, 0.09], [0, 0, x * 0.35]); // 手臂
    part(g, GEO.ico, o.boots || M.dark, [x * 0.11, -0.7, 0.02], [0.08, 0.07, 0.09]);        // 腳
  }
  // 大頭:放在自己的 group(hg,原點 = 頭中心),o.big 可以再放大(神將的頭本來就特別大)
  const hg = new THREE.Group(); hg.position.set(0, 0.28 + ((o.big || 1) - 1) * 0.22, 0); hg.scale.setScalar(o.big || 1); g.add(hg);
  part(hg, GEO.ico2, o.face || M.skin, [0, 0, 0.02], 0.3);
  part(hg, GEO.ico2, o.head || M.hair, [0, 0.08, -0.06], [0.32, 0.3, 0.3]);                // 頭髮 / 頭盔(在後上方,露出臉)
  for (const x of [-1, 1]) {
    part(hg, GEO.ico, M.eye, [x * 0.1, -0.01, 0.29], [0.035, 0.05, 0.03]);
    part(hg, GEO.ico, M.cheek, [x * 0.17, -0.09, 0.26], [0.04, 0.025, 0.02]);
  }
  if (o.extra) o.extra(g, hg);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}


/* ---------------- 畫在紙上的圖樣(canvas):晴明桔梗(五芒星)、三つ巴、符 ---------------- */
const drawCache = new Map();
function canvasTex(key, w, h, draw) {
  if (drawCache.has(key)) return drawCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  drawCache.set(key, t);
  return t;
}
/** 晴明桔梗印:一筆畫的五芒星 + 外圈 */
export function starTex(color = '#c8323a', ring = true) {
  return canvasTex('star' + color + ring, 128, 128, (g) => {
    g.strokeStyle = color; g.lineWidth = 9; g.lineJoin = 'round';
    g.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 4 / 5;
      const x = 64 + Math.cos(a) * 46, y = 64 + Math.sin(a) * 46;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    if (ring) { g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.stroke(); }
  });
}
/** 三つ巴(太鼓面):三個逗點繞圈 */
export function tomoeTex() {
  return canvasTex('tomoe', 128, 128, (g) => {
    g.fillStyle = '#f2e6c8'; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a2226'; g.lineWidth = 5; g.stroke();
    g.fillStyle = '#c8323a'; g.strokeStyle = '#c8323a';
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3;
      g.beginPath(); g.arc(64 + Math.cos(a) * 20, 64 + Math.sin(a) * 20, 15, 0, Math.PI * 2); g.fill();
      g.lineWidth = 12; g.lineCap = 'round';
      g.beginPath(); g.arc(64, 64, 34, a + 0.25, a + 1.9); g.stroke();
    }
  });
}
/** 符:白紙 + 朱色直書 */
export function fudaTex(ch = '符') {
  return canvasTex('fuda' + ch, 48, 112, (g) => {
    g.fillStyle = '#faf4e4'; g.fillRect(0, 0, 48, 112);
    g.strokeStyle = '#c8323a'; g.lineWidth = 3; g.strokeRect(4, 4, 40, 104);
    g.fillStyle = '#c8323a'; g.font = '900 30px "Noto Serif TC","Noto Serif JP","PingFang TC",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 24, 34);
    g.fillStyle = '#2a2226'; g.font = '700 14px serif';
    ['急', '急', '如', '律', '令'].forEach((c, i) => g.fillText(c, 24, 60 + i * 11));
  });
}
const texMats = new Map();
function texMat(tex, additive = false) {
  const k = tex.uuid + additive;
  if (!texMats.has(k)) {
    texMats.set(k, new THREE.MeshBasicMaterial({
      map: tex, transparent: true, side: THREE.DoubleSide,
      ...(additive ? { blending: THREE.AdditiveBlending, depthWrite: false } : {}),
    }));
  }
  return texMats.get(k);
}
/** 飄在身後的符(不烤,名稱 'flag' → 每幀飄動) */
function addFuda(rig, pos, ch, s = 1) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.7).translate(0, -0.3, 0), texMat(fudaTex(ch)));
  f.name = 'flag'; f.position.set(...pos); f.scale.setScalar(s);
  rig.add(f);
  return f;
}

/* ---------------- 唐傘妖(bee):朱紅油紙傘 + 大獨眼 + 長舌 + 一隻腳踩木屐,單腳跳 ---------------- */
function kasa(b) {
  const g = new THREE.Group();
  part(g, GEO.cone, M.beeBody, [0, 0.1, 0], [0.6, 0.85, 0.5]);                                        // 傘面
  for (let i = 0; i < 4; i++) {                                                                          // 傘骨(一條條淺色線)
    const a = (i / 4) * Math.PI - Math.PI / 2 + Math.PI / 8;
    part(g, GEO.box, M.beeRib, [Math.sin(a) * 0.26, 0.1, Math.cos(a) * 0.22], [0.025, 0.8, 0.02], [0.5 * Math.cos(a), 0, -0.55 * Math.sin(a)]);
  }
  part(g, GEO.cyl, M.beeRib, [0, -0.32, 0], [0.61, 0.04, 0.51]);                                         // 傘緣
  part(g, GEO.ico, M.beeHandle, [0, 0.52, 0], 0.05);                                                     // 傘頂
  part(g, GEO.ico2, M.white, [0, 0.0, 0.25], [0.14, 0.16, 0.07]);                                       // 大獨眼
  part(g, GEO.ico, M.eye, [0, -0.01, 0.3], [0.065, 0.075, 0.03]);
  part(g, GEO.box, M.tongue, [0.02, -0.27, 0.36], [0.1, 0.26, 0.03], [-0.6, 0, 0.15]);                  // 長舌
  for (const x of [-1, 1]) part(g, GEO.ico, M.beeBody, [x * 0.48, -0.2, 0.06], [0.08, 0.06, 0.06]);    // 小手
  rod(g, M.beeHandle, [0, -0.32], [0, -0.74], 0.035, 0);                                                 // 一隻腳(傘柄)
  part(g, GEO.box, M.wood, [0, -0.78, 0.05], [0.16, 0.05, 0.24]);                                        // 木屐
  part(g, GEO.box, M.red, [0, -0.745, 0.05], [0.04, 0.02, 0.16]);
  g.rotation.x = LEAN; g.position.set(0, 0, 0.2);
  b.add(g);
}

/* ---------------- 提燈妖(bfly):裂開的紙燈籠 + 一隻眼 + 舌頭,飄在半空 ---------------- */
function chochin(b) {
  const g = new THREE.Group();
  part(g, GEO.ico2, M.lantern, [0, 0, 0], [0.34, 0.44, 0.32]);
  for (const y of [-0.32, -0.16, 0.16, 0.32]) {                                                          // 竹骨
    const k = Math.sqrt(1 - (y / 0.44) ** 2);
    part(g, GEO.cyl16, M.lanternRib, [0, y, 0], [0.345 * k, 0.018, 0.325 * k]);
  }
  for (const y of [-1, 1]) part(g, GEO.cyl16, M.lanternRib, [0, y * 0.43, 0], [0.17, 0.07, 0.16]);        // 上下黑框
  rod(g, M.wood, [0, 0.46], [0, 0.78], 0.02, 0);                                                         // 提把
  part(g, GEO.ico2, M.white, [0.02, 0.12, 0.29], [0.1, 0.11, 0.05]);                                    // 一隻眼
  part(g, GEO.ico, M.eye, [0.03, 0.11, 0.33], [0.05, 0.055, 0.02]);
  part(g, GEO.box, M.dark, [0, -0.1, 0.3], [0.26, 0.06, 0.03], [0, 0, -0.12]);                          // 裂開的嘴
  part(g, GEO.box, M.tongue, [-0.04, -0.26, 0.31], [0.09, 0.26, 0.02], [-0.3, 0, -0.2]);
  g.rotation.x = LEAN; g.position.set(0, 0, 0.4); g.scale.setScalar(1.3);
  b.add(g);
}

/* ---------------- 赤鬼(boss):紅皮膚、雙角、捲毛、虎皮褲、狼牙棒(金棒),打兩下 ---------------- */
function oni(b) {
  chibi(b, [0, 0, 0.25], 1.22, {
    body: M.bossBody, pants: M.tiger, face: M.bossBody, head: M.bossHead,
    extra(g, hg) {
      for (const x of [-1, 1]) {
        part(hg, GEO.cone, M.ivory, [x * 0.15, 0.32, 0.02], [0.055, 0.18, 0.055], [0, 0, -x * 0.35]);   // 雙角
        part(hg, GEO.cone, M.white, [x * 0.08, -0.13, 0.28], [0.025, 0.07, 0.02]);                       // 往上翹的獠牙
        part(hg, GEO.box, M.dark, [x * 0.1, 0.07, 0.29], [0.14, 0.035, 0.02], [0, 0, x * 0.35]);         // 怒眉
      }
      for (let i = 0; i < 5; i++) part(hg, GEO.ico, M.bossHead, [(i - 2) * 0.12, 0.24 - Math.abs(i - 2) * 0.04, -0.12], 0.1); // 捲毛
      for (const y of [-0.46, -0.56]) part(g, GEO.box, M.stripe, [0, y, 0.17], [0.4, 0.03, 0.02]);          // 虎皮紋
      rod(g, M.iron, [0.42, -0.6], [0.42, 0.1], 0.03, 0.1);                                                   // 金棒
      part(g, GEO.cyl, M.iron, [0.42, 0.35, 0.1], [0.09, 0.55, 0.09]);
      for (let i = 0; i < 6; i++) part(g, GEO.cone, M.gold, [0.42 + (i % 2 ? 0.09 : -0.09), 0.15 + i * 0.08, 0.12], [0.03, 0.06, 0.03], [0, 0, i % 2 ? -Math.PI / 2 : Math.PI / 2]);
    },
  });
}

/* ---------------- 玩家:少年陰陽師(10 段) ----------------
 * 殺敵累積經驗 → 見習童子 … 天照加護。一開始就有白狩衣 + 黑烏帽子 + 手上一張符,每一段加零件:
 *   Lv2 三張符扇開、Lv3 胸前晴明桔梗印、Lv4 肩上的紙人式神、Lv5 金邊袖、Lv6 頭側的狐面、
 *   Lv7 念珠 + 金烏帽帶、Lv8 兩團青白狐火、Lv9 身後三條狐尾、Lv10 背後轉動的五芒星光輪 + 光暈。
 * 'ally' = 式神白狐(白毛、朱紅隈取、大尾巴、鈴鐺)。 */
export const SHIP_LV = [
  { name: '見習童子', body: 0x8a6ab8, accent: 0xf4f0e6, pod: 0xc8323a, flame: 0xa8d0ff, span: 1.0 },
  { name: '陰陽生', body: 0x7a5aa8, accent: 0xf4f0e6, pod: 0xc8323a, flame: 0xa8d0ff, span: 1.02 },
  { name: '陰陽師', body: 0x6a4a9a, accent: 0xf4f0e6, pod: 0xc8323a, flame: 0xa8d0ff, span: 1.04 },
  { name: '式神使', body: 0x5a3a8a, accent: 0xf4f0e6, pod: 0xc8323a, flame: 0xb8d8ff, span: 1.06 },
  { name: '天文博士', body: 0x3a3a7a, accent: 0xf2c860, pod: 0xc8323a, flame: 0xb8d8ff, span: 1.08 },
  { name: '陰陽助', body: 0x2a3a6a, accent: 0xf2c860, pod: 0xc8323a, flame: 0xc8e0ff, span: 1.1 },
  { name: '陰陽頭', body: 0x8a2a3a, accent: 0xf2c860, pod: 0xf2c860, flame: 0xc8e0ff, span: 1.12 },
  { name: '大陰陽師', body: 0x7a1a2a, accent: 0xf2c860, pod: 0xf2c860, flame: 0x8ad0ff, span: 1.14 },
  { name: '晴明再世', body: 0x2a2a3a, accent: 0xffe08a, pod: 0xffe08a, flame: 0x8ad0ff, span: 1.16 },
  { name: '天照加護', body: 0x2a2a3a, accent: 0xffffff, pod: 0xfff2c0, flame: 0xffe8a0, span: 1.2 },
];

function onmyojiBody(m, L, ally) {
  return (b) => {
    if (ally) {
      // 式神白狐:白毛、尖嘴、大耳、朱紅隈取、紅袴、一條大尾巴
      chibi(b, [0, 0, 0.3], 1.25, {
        body: M.fox, pants: M.red, face: M.fox, head: M.foxFur, big: 1.25,
        extra(g, hg) {
          for (const x of [-1, 1]) {
            part(hg, GEO.cone, M.foxFur, [x * 0.19, 0.4, -0.02], [0.13, 0.34, 0.08], [0, 0, -x * 0.32]);  // 大耳朵
            part(hg, GEO.cone, M.foxEar, [x * 0.215, 0.5, 0.0], [0.07, 0.16, 0.05], [0, 0, -x * 0.32]);   // 耳尖
            part(hg, GEO.cone, M.pink, [x * 0.185, 0.38, 0.04], [0.06, 0.2, 0.02], [0, 0, -x * 0.32]);
            part(hg, GEO.box, M.red, [x * 0.12, 0.07, 0.3], [0.13, 0.035, 0.02], [0, 0, x * 0.5]);  // 隈取
            part(hg, GEO.cone, M.fox, [x * 0.27, -0.1, 0.12], [0.07, 0.14, 0.05], [0, 0, x * 1.9]);      // 臉頰的毛
          }
          part(hg, GEO.cone, M.fox, [0, -0.1, 0.32], [0.13, 0.28, 0.11], [Math.PI / 2, 0, 0]);         // 尖嘴
          part(hg, GEO.ico, M.dark, [0, -0.1, 0.47], 0.04);
          part(hg, GEO.ico, M.red, [0, 0.2, 0.26], 0.035);                                              // 額頭的寶珠
          part(g, GEO.ico2, M.fox, [0.34, -0.38, -0.12], [0.2, 0.36, 0.17], [0, 0, -0.7]);              // 大尾巴
          part(g, GEO.ico, M.foxGold, [0.56, -0.12, -0.12], [0.1, 0.12, 0.1]);
          part(g, GEO.ico, M.gold, [0, -0.08, 0.24], 0.06);                                              // 鈴鐺
          part(g, GEO.box, M.red, [0, -0.02, 0.22], [0.3, 0.03, 0.02]);
        },
      });
      return;
    }
    chibi(b, [0, 0, 0.3], 1.25, {
      body: M.robe, pants: m.red, face: M.skin, head: M.hair, big: 1.3,
      extra(g, hg) {
        // 黑烏帽子:高高的、往後斜
        part(hg, GEO.cyl, M.eboshi, [0, 0.38, -0.08], [0.19, 0.42, 0.16], [-0.3, 0, 0]);
        part(hg, GEO.ico, M.eboshi, [0, 0.58, -0.15], [0.19, 0.08, 0.16]);
        if (L >= 7) part(hg, GEO.cyl, M.gold, [0, 0.24, -0.03], [0.2, 0.03, 0.17], [-0.3, 0, 0]);      // 金帽帶
        for (const x of [-1, 1]) part(hg, GEO.box, M.dark, [x * 0.09, 0.02, 0.29], [0.08, 0.018, 0.02], [0, 0, x * 0.2]); // 細長的眉
        // 寬大的狩衣袖子 + 胸前的藍色衣領
        for (const x of [-1, 1]) {
          part(g, GEO.ico, M.robe, [x * 0.34, -0.3, 0.02], [0.14, 0.21, 0.13]);
          part(g, GEO.cyl, M.robeCord, [x * 0.35, -0.46, 0.03], [0.12, 0.025, 0.11]);                   // 袖口的紅繩
          if (L >= 5) part(g, GEO.cyl, M.gold, [x * 0.36, -0.48, 0.02], [0.13, 0.03, 0.12]);           // 金邊袖
        }
        part(g, GEO.box, M.white, [0, -0.08, 0.215], [0.16, 0.2, 0.02]);                                 // 白色內衣
        part(g, GEO.box, m.blue, [0, -0.1, 0.225], [0.05, 0.28, 0.02], [0, 0, 0]);
        // 右手的符(Lv2 起三張扇開)
        const n = L >= 2 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          const a = (i - (n - 1) / 2) * 0.35;
          part(g, GEO.box, M.paper, [0.4 + Math.sin(a) * 0.08, -0.26, 0.18], [0.09, 0.22, 0.01], [0, 0, -a]);
          part(g, GEO.box, M.red, [0.4 + Math.sin(a) * 0.08, -0.26, 0.19], [0.025, 0.14, 0.005], [0, 0, -a]);
        }
        if (L >= 3) {                                                                                     // 晴明桔梗印
          const st = new THREE.Mesh(GEO.plane, texMat(starTex('#c8323a', true)));
          st.position.set(0, -0.3, 0.23); st.scale.setScalar(0.2); g.add(st);
        }
        if (L >= 4) {                                                                                     // 紙人式神
          part(g, GEO.ico, M.paper, [-0.44, 0.08, 0.1], [0.06, 0.06, 0.02]);
          part(g, GEO.box, M.paper, [-0.44, -0.06, 0.1], [0.14, 0.16, 0.015]);
          part(g, GEO.box, M.red, [-0.44, -0.04, 0.11], [0.02, 0.1, 0.005]);
        }
        if (L >= 6) {                                                                                     // 狐面(戴在頭側)
          part(hg, GEO.ico2, M.fox, [0.27, 0.1, 0.06], [0.12, 0.13, 0.08]);
          part(hg, GEO.cone, M.fox, [0.3, 0.24, 0.04], [0.04, 0.09, 0.03], [0, 0, -0.3]);
          part(hg, GEO.box, M.red, [0.29, 0.12, 0.14], [0.08, 0.02, 0.01], [0, 0, 0.4]);
        }
        if (L >= 7) for (let i = 0; i < 9; i++) {                                                        // 念珠
          const a = -0.9 + i * 0.225;
          part(g, GEO.ico, M.dark, [Math.sin(a) * 0.2, -0.05 - Math.cos(a) * 0.12, 0.22], 0.03);
        }
        if (L >= 9) for (let i = -1; i <= 1; i++) {                                                     // 三條狐尾
          part(g, GEO.ico2, M.fox, [i * 0.28, -0.25, -0.28], [0.1, 0.34, 0.1], [0.3, 0, -i * 0.6]);
          part(g, GEO.ico, M.foxGold, [i * 0.5, 0.05, -0.34], [0.07, 0.09, 0.07]);
        }
      },
    });
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1, ally = false) {
  return template(onmyojiBody(m, L, ally), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下的靈氣(每幀閃爍)
    const fc = ally ? 0xffe0b0 : m.flame || 0xa8d0ff;
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], fc, [0.1, 0.35, 0.08], 0.5);
    if (ally) { addFuda(rig, [-0.5, 0.55, 0.7], '狐', 0.8); return; }
    addFuda(rig, [-0.5, 0.55, 0.7], L >= 9 ? '晴' : '符', 0.8);
    if (L >= 5) addFuda(rig, [0.5, 0.5, 0.7], '令', 0.7);
    if (L >= 8) for (const x of [-0.75, 0.75]) {                                                         // 狐火
      const f = part(rig, GEO.ico2, new THREE.MeshBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), [x, 0.1, 0.5], [0.12, 0.16, 0.12]);
      f.name = 'flame';
    }
    if (L >= 10) {                                                                                       // 五芒星光輪
      const h = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), texMat(starTex('#ffd86a', true), true));
      h.name = 'halo'; h.position.set(0, 0.3, -0.35); rig.add(h);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xffe07a : 0x8ad0ff, transparent: true, opacity: L >= 10 ? 0.14 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(0.9, 1.1, 0.45); rig.add(a);
    }
  }, { shadow: [0.5, 0.4], upright: true });
}
function evolvedShip(L, ally = false) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: C(0xf4f0e6), red: C(c.body), blue: C(c.pod), flame: c.flame }, L, ally);
}
function addFlame(rig, pos, color, scl, opacity = 0.9) {
  const fm = flat({ color, transparent: true, opacity, depthWrite: false });
  const f = part(rig, GEO.cone, fm, pos, scl, [0, 0, Math.PI]);
  f.name = 'flame';
  return f;
}

/* ---------------- 關底大妖怪(面朝玩家) ---------------- */
const BM = {
  fox: C(0xfaf4e4), foxShade: C(0xe8dcc0), foxGold: C(0xf2c860), foxRed: C(0xc8323a),
  bone: C(0xece2c8), boneDark: C(0x3a3440), boneEye: flat({ color: 0xff3a3a }),
  raijin: C(0xf0e4c8), raijinHair: C(0x2a2a3a), sash: C(0xc8323a), drum: C(0xb8402a), drumRim: C(0x2a2226),
  cat: C(0xfaf6ee), catPink: C(0xf4a0b0), collar: C(0xc8323a), coin: C(0xf2c23a),
};

/** 九尾狐:白金色的大狐狸趴著面朝玩家,背後九條尾巴像扇子一樣張開(尾巴在 'tails' 群組,boss.js 讓它擺動) */
function kitsuneBody(b) {
  part(b, GEO.ico2, BM.fox, [0, 0.5, 0], [1.3, 1.5, 1.0]);                                              // 身體
  part(b, GEO.ico2, BM.foxShade, [0, -0.3, 0.55], [0.95, 0.8, 0.65]);                                   // 胸前的毛
  part(b, GEO.ico2, BM.fox, [0, -0.85, 1.1], [1.0, 0.88, 0.85]);                                        // 頭
  part(b, GEO.cone, BM.fox, [0, -1.25, 1.75], [0.32, 0.75, 0.28], [Math.PI / 2 + 0.35, 0, 0]);          // 尖嘴
  part(b, GEO.ico, M.dark, [0, -1.45, 2.1], 0.1);
  for (const x of [-1, 1]) {
    part(b, GEO.cone, BM.fox, [x * 0.58, -0.35, 1.5], [0.28, 0.75, 0.2], [0.7, 0, -x * 0.35]);           // 耳朵
    part(b, GEO.cone, BM.catPink, [x * 0.58, -0.33, 1.58], [0.14, 0.5, 0.1], [0.7, 0, -x * 0.35]);
    part(b, GEO.box, M.dark, [x * 0.36, -0.72, 1.88], [0.3, 0.06, 0.06], [0.3, 0, x * 0.35]);            // 細長的眼
    part(b, GEO.box, BM.foxRed, [x * 0.4, -0.58, 1.86], [0.34, 0.06, 0.05], [0.3, 0, x * 0.5]);          // 隈取
    part(b, GEO.box, BM.foxRed, [x * 0.5, -1.05, 1.72], [0.3, 0.05, 0.05], [0.4, 0, -x * 0.3]);
    part(b, GEO.ico2, BM.fox, [x * 0.75, -1.25, 0.45], [0.35, 0.3, 0.3]);                               // 前爪
  }
  part(b, GEO.ico, BM.foxRed, [0, -0.45, 1.9], 0.1);                                                     // 額頭寶珠
}
function kitsuneExtras(rig) {
  const tails = new THREE.Group(); tails.name = 'tails'; tails.position.set(0, 1.2, -0.3);
  for (let i = 0; i < 9; i++) {
    const a = (i - 4) * 0.34, dx = -Math.sin(a), dy = Math.cos(a);
    part(tails, GEO.ico2, BM.fox, [dx * 1.5, dy * 1.5, -0.1 + Math.abs(i - 4) * 0.05], [0.36, 1.35, 0.3], [0, 0, a]);
    part(tails, GEO.ico2, BM.foxGold, [dx * 2.75, dy * 2.75, -0.05], [0.28, 0.4, 0.25], [0, 0, a]);
  }
  rig.add(tails);
  // 飄在身邊的狐火
  const spin = new THREE.Group(); spin.name = 'spin';
  const fm = new THREE.MeshBasicMaterial({ color: 0x8ad0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; part(spin, GEO.ico, fm, [Math.cos(a) * 2.4, Math.sin(a) * 2.2, 1.0], [0.16, 0.22, 0.16]); }
  rig.add(spin);
}

/** がしゃどくろ:從地面爬出來的巨大骷髏 —— 大頭骨(紅光眼窩)+ 肋骨 + 兩隻伸向玩家的骨手 */
function skullBody(b) {
  part(b, GEO.ico2, BM.bone, [0, -0.3, 1.0], [1.3, 1.25, 1.1]);                                        // 頭骨
  part(b, GEO.box, BM.bone, [0, -1.3, 1.15], [1.0, 0.45, 0.8]);                                          // 下顎
  part(b, GEO.box, BM.boneDark, [0, -1.08, 1.56], [0.95, 0.05, 0.06]);
  for (let i = -3; i <= 3; i++) part(b, GEO.box, M.ivory, [i * 0.13, -1.0, 1.58], [0.1, 0.15, 0.05]);  // 牙齒
  for (const x of [-1, 1]) {
    part(b, GEO.ico2, BM.boneDark, [x * 0.45, -0.35, 1.92], [0.32, 0.3, 0.14]);                         // 眼窩
    part(b, GEO.ico, BM.boneEye, [x * 0.45, -0.38, 2.04], 0.1);                                          // 紅光
    part(b, GEO.box, BM.boneDark, [x * 0.6, 0.35, 1.85], [0.04, 0.4, 0.04], [0.4, 0, x * 0.5]);          // 裂痕
    part(b, GEO.ico2, BM.bone, [x * 1.55, 0.7, 0.6], 0.42);                                              // 肩
    rod(b, BM.bone, [x * 1.55, 0.7], [x * 2.35, -0.7], 0.2, 0.8);                                        // 上臂
    rod(b, BM.bone, [x * 2.35, -0.7], [x * 1.85, -2.0], 0.17, 1.0);                                      // 前臂
    part(b, GEO.ico2, BM.bone, [x * 2.35, -0.7, 0.9], 0.24);                                             // 手肘
    part(b, GEO.ico2, BM.bone, [x * 1.85, -2.05, 1.1], [0.38, 0.3, 0.2]);                                // 手掌
    for (let f = 0; f < 4; f++) part(b, GEO.cone, BM.bone, [x * 1.85 + (f - 1.5) * 0.17, -2.45, 1.15], [0.07, 0.45, 0.07], [0, 0, Math.PI + (f - 1.5) * 0.12]);
  }
  part(b, GEO.cone, BM.boneDark, [0, -0.78, 2.02], [0.12, 0.22, 0.08], [0, 0, Math.PI]);               // 鼻孔
  for (let i = 0; i < 4; i++) part(b, GEO.halfRing, BM.bone, [0, 0.9 + i * 0.42, 0.35], [1.25 - i * 0.12, 0.7, 1], [Math.PI / 2, 0, 0]); // 肋骨
  for (let i = 0; i < 5; i++) part(b, GEO.ico, BM.bone, [0, 0.7 + i * 0.38, 0.3], [0.14, 0.12, 0.12]);  // 脊椎
}
function skullExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  const fm = new THREE.MeshBasicMaterial({ color: 0x7ab8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(spin, GEO.ico, fm, [Math.cos(a) * 2.8, Math.sin(a) * 2.5, 0.9], [0.17, 0.24, 0.17]); }
  rig.add(spin);
}

/** 雷神:白皮膚、捲髮、雙角、虎皮褲、兩手鼓棒 + 背後一圈會轉的太鼓(三つ巴) */
function raijinBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.7, {
    body: BM.raijin, pants: M.tiger, face: BM.raijin, head: BM.raijinHair,
    extra(g, hg) {
      for (let i = 0; i < 7; i++) {                                                                        // 往上炸開的捲髮
        const a = (i - 3) * 0.42;
        part(hg, GEO.cone, BM.raijinHair, [Math.sin(a) * 0.26, 0.24 + Math.cos(a) * 0.1, -0.1], [0.07, 0.2, 0.06], [0, 0, -a]);
      }
      for (const x of [-1, 1]) {
        part(hg, GEO.cone, M.gold, [x * 0.12, 0.34, 0.06], [0.04, 0.13, 0.04], [0, 0, -x * 0.3]);         // 雙角
        part(hg, GEO.ico2, M.white, [x * 0.1, 0.0, 0.28], [0.065, 0.07, 0.03]);                           // 瞪大的眼
        part(hg, GEO.ico, M.eye, [x * 0.1, -0.005, 0.305], 0.032);
        part(hg, GEO.box, M.dark, [x * 0.1, 0.08, 0.29], [0.1, 0.03, 0.02], [0, 0, x * 0.4]);
        part(hg, GEO.cone, M.white, [x * 0.07, -0.15, 0.28], [0.022, 0.06, 0.02], [0, 0, Math.PI]);
        rod(g, M.wood, [x * 0.3, -0.25], [x * 0.52, 0.1], 0.025, 0.12);                                  // 鼓棒
        part(g, GEO.ico, M.red, [x * 0.53, 0.12, 0.12], 0.04);
      }
      part(hg, GEO.box, M.red, [0, -0.13, 0.28], [0.16, 0.05, 0.02]);                                      // 咧開的嘴
      for (const y of [-0.46, -0.56]) part(g, GEO.box, M.stripe, [0, y, 0.17], [0.4, 0.025, 0.02]);
      part(g, GEO.halfRing, BM.sash, [0, 0.0, -0.15], [0.55, 0.5, 0.5]);                                    // 飄帶(天衣)
    },
  });
}
function raijinExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  const face = texMat(tomoeTex());
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, x = Math.cos(a) * 2.5, y = Math.sin(a) * 2.3 + 0.4;
    part(spin, GEO.cyl, BM.drum, [x, y, 0.6], [0.32, 0.26, 0.32], [Math.PI / 2, 0, 0]);
    part(spin, GEO.cyl, BM.drumRim, [x, y, 0.6], [0.34, 0.06, 0.34], [Math.PI / 2, 0, 0]);
    const d = new THREE.Mesh(GEO.disc, face); d.position.set(x, y, 0.74); d.scale.setScalar(0.3); spin.add(d);
  }
  // 鼓與鼓之間的金色圈
  part(spin, GEO.torus, M.gold, [0, 0.4, 0.55], [2.5, 2.3, 0.2]);
  rig.add(spin);
}

/** 招財貓(獎勵關):白貓、舉起右手、紅項圈 + 金鈴鐺、抱著小判 + 一圈金幣 */
function manekiBody(b) {
  part(b, GEO.ico2, BM.cat, [0, 0.55, 0.2], [1.25, 1.35, 1.0]);                                        // 身體
  part(b, GEO.ico2, BM.cat, [0, -0.65, 0.95], [1.05, 0.92, 0.85]);                                      // 頭
  for (const x of [-1, 1]) {
    part(b, GEO.cone, BM.cat, [x * 0.62, -0.1, 1.3], [0.28, 0.55, 0.2], [0.7, 0, -x * 0.4]);             // 耳朵
    part(b, GEO.cone, BM.catPink, [x * 0.62, -0.08, 1.38], [0.15, 0.36, 0.1], [0.7, 0, -x * 0.4]);
    part(b, GEO.box, M.dark, [x * 0.35, -0.62, 1.78], [0.26, 0.06, 0.05], [0.3, 0, -x * 0.25]);          // 瞇瞇眼
    for (const k of [-1, 1]) part(b, GEO.box, M.dark, [x * 0.75, -0.95 + k * 0.08, 1.6], [0.45, 0.025, 0.02], [0, 0, x * k * 0.15]); // 鬍鬚
  }
  part(b, GEO.ico, BM.catPink, [0, -0.88, 1.8], [0.1, 0.07, 0.06]);                                    // 鼻子
  part(b, GEO.cyl, BM.collar, [0, -0.08, 0.95], [0.95, 0.12, 0.7]);                                      // 紅項圈
  part(b, GEO.ico2, BM.coin, [0, -0.1, 1.72], 0.2);                                                      // 金鈴鐺
  part(b, GEO.ico2, BM.cat, [0.95, -1.35, 1.2], [0.28, 0.35, 0.25]);                                    // 舉起的招手
  part(b, GEO.ico2, BM.coin, [-0.35, 0.55, 1.25], [0.62, 0.42, 0.14]);                                  // 小判
}
function manekiExtras(rig) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.9), new THREE.MeshBasicMaterial({ map: bannerTex('福', '#c8a02a', '#fff4d0'), transparent: true }));
  f.position.set(-0.35, 0.55, 1.42); rig.add(f);
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.ico2, BM.coin, [Math.cos(a) * 1.9, Math.sin(a) * 2.1, 0.5], [0.24, 0.16, 0.06]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'kitsune') return template(kitsuneBody, 1.6, kitsuneExtras, { shadow: [2.0, 2.2] });
  if (kind === 'skull') return template(skullBody, 1.5, skullExtras, { shadow: [2.6, 2.0] });
  if (kind === 'raijin') return template(raijinBody, 1.55, raijinExtras, { shadow: [1.4, 1.2] });
  return template(manekiBody, 1.6, manekiExtras, { shadow: [1.2, 1.5] });
}

/* ---------------- 輪入道(原本的隕石):燃燒的牛車輪 + 中間一顆瞪人的和尚頭 ----------------
 * 模型 +y = 前進方向(往下飛時 +y 朝畫面下方),所以頭頂畫在 -y、火尾也在 -y(後面)。
 * 車輪放在 'spin' 群組,引擎會讓它自己轉。 */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const spin = new THREE.Group(); spin.name = 'spin';
  const wood = C(0x5a3a28), fire = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  part(spin, GEO.torus, wood, [0, 0, 0], [0.62, 0.62, 0.9]);
  for (let i = 0; i < 4; i++) part(spin, GEO.box, wood, [0, 0, -0.02], [0.06, 1.2, 0.06], [0, 0, i * Math.PI / 4]);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const f = part(spin, GEO.cone, fire, [Math.cos(a) * 0.78, Math.sin(a) * 0.78, 0], [0.12, 0.34, 0.1], [0, 0, a - Math.PI / 2]);
    f.name = 'flame';
  }
  rig.add(spin);
  part(rig, GEO.ico2, M.skin, [0, 0, 0.16], [0.3, 0.3, 0.26]);                                         // 和尚頭
  for (const x of [-1, 1]) {
    part(rig, GEO.ico, M.white, [x * 0.1, -0.03, 0.4], [0.06, 0.05, 0.03]);
    part(rig, GEO.ico, M.eye, [x * 0.1, -0.03, 0.43], 0.03);
    part(rig, GEO.box, M.dark, [x * 0.1, -0.12, 0.4], [0.1, 0.03, 0.02], [0, 0, -x * 0.4]);             // 怒眉(頭頂在 -y)
  }
  part(rig, GEO.box, M.tongue, [0, 0.12, 0.4], [0.14, 0.05, 0.02]);
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), [0, -1.15, 0], [0.45, 1.5, 0.3], [0, 0, Math.PI]);
  tail.name = 'flame';
  addShadow(root, 0.55, 0.45);
  return root;
}

const TEMPLATES = {
  bee: template(kasa, 1.5, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(chochin, 1.4, null, { shadow: [0.4, 0.3], upright: true }),
  boss: template(oni, 1.35, null, { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(赤鬼被打)就換單一 mesh 的 material。
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
/** 旗子飄動(沿用 flapWings 的呼叫點:t = 動畫相位) */
export function flapWings(mdl, t) {
  for (const f of mdl.flags) f.rotation.y = Math.sin(t * 0.8 + f.userData.ph) * 0.35;
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:繪馬(五角形木牌 + 色塊 + 紅繩 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: '靈力' },
  R: { label: 'R', color: 0x3ad8ff, name: '疾風' },
  S: { label: 'S', color: 0x3ae07a, name: '結界' },
  B: { label: 'B', color: 0xb86aff, name: '爆符' },
  W: { label: 'W', color: 0xf0f0f0, name: '式神白狐' },
  L: { label: '1UP', color: 0xffc23a, name: '三色糰子' },
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
  draw('#2a2018', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  const cm = C(it.color), plank = C(0xe8c890);
  part(body, GEO.box, plank, [0, -0.08, 0.2], [0.74, 0.52, 0.08]);                                     // 木牌
  for (const x of [-1, 1]) part(body, GEO.box, plank, [x * 0.19, 0.25, 0.2], [0.46, 0.1, 0.08], [0, 0, -x * 0.5]); // 屋頂形的上緣
  part(body, GEO.box, cm, [0, -0.08, 0.25], [0.6, 0.4, 0.02]);                                          // 色塊
  part(body, GEO.torus, M.red, [0, 0.46, 0.2], [0.1, 0.1, 0.3]);                                         // 紅繩
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
const SHOT_MAT = flat({ color: PAL.shot, transparent: true, depthWrite: false });
const SHOT_TIP = flat({ color: PAL.shotTip, transparent: true, depthWrite: false });
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

/** 玩家:符札(白紙長條 + 中間一道朱印),順著飛行方向 */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.box, [0, 0, 0], [0.2, 0.46, 0.03]), SHOT_MAT],
    [geoAt(GEO.box, [0, 0.03, 0.02], [0.06, 0.3, 0.01]), SHOT_TIP],
  ], cap);
}
/** 敵彈:人魂(青白色的鬼火,頭圓尾尖,尾巴拖在後面) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [mergeGeometries([geoAt(GEO.ico, [0, 0.04, 0], [0.2, 0.22, 0.2]), geoAt(GEO.cone, [0, -0.26, 0], [0.14, 0.4, 0.1]).rotateZ(Math.PI).translate(0, -0.52, 0)].map((g) => (g.index ? g.toNonIndexed() : g))), EB_MAT],
    [geoAt(GEO.ico0, [0, 0.07, 0.08], [0.09, 0.1, 0.09]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
