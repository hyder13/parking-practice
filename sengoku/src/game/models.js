import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 所有角色都用基本幾何體拼出來(沒有模型檔),Q 版大頭比例、黏土 / 紙藝的圓潤感。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:人物在自己的座標系裡站立(頭 +y、臉 +z),整個人偶再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。人物模型「不跟著前進方向旋轉」(userData.upright)。
 *
 * 每個角色腳下有一塊地面陰影('shadow',貼在地面 z = -GROUND_Z),讓人一看就知道在地上。
 * 內部型別沿用原本的名字:bee = 足輕、bfly = 忍者、boss = 武將(打兩下)、rock = 焙烙玉。
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
  disc: new THREE.CircleGeometry(1, 22),
};

const C = (color, bands = 3) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair, 2), eye: flat({ color: 0x2a2226 }), cheek: flat({ color: 0xff9a8a }),
  white: C(0xf8f6f0), red: C(0xd8322e), gold: C(0xf2c23a), wood: C(0x8a6040, 2), dark: C(0x2a2a30, 2),
  steel: C(0xc8d0dc, 2), iron: C(0x3a3a44, 2),
  // 足輕
  beeBody: C(PAL.beeBody), beeBelly: C(PAL.beeBelly, 2), jingasa: C(PAL.beeBand, 2),
  // 忍者
  ninja: C(PAL.bflyBody),
  // 武將
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner, 2), bossWing: C(PAL.bossWing, 2),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0x8a5a3a, 2),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 武將被打第一下之後換色用的對照表(鎧甲裂開變銅色) */
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

/* ---------------- 字的貼圖(旗子):canvas 畫字 ---------------- */
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
const FLAG_GEO = new THREE.PlaneGeometry(0.5, 0.75).translate(0.25, -0.375, 0);
/** 插在背上 / 馬上的旗子(不烤,每幀飄動;名稱 'flag') */
function addFlag(rig, pos, ch, bg, s = 1) {
  const pole = part(rig, GEO.cyl, M.wood, [pos[0], pos[1] - 0.4 * s, pos[2]], [0.025 * s, 1.1 * s, 0.025 * s]);
  pole.name = 'pole';
  const f = new THREE.Mesh(FLAG_GEO, bannerMat(ch, bg));
  f.name = 'flag'; f.position.set(pos[0] + 0.02, pos[1] + 0.12 * s, pos[2]); f.scale.setScalar(s);
  rig.add(f);
  return f;
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


/** 在自己的座標系裡站著(臉朝 +z),最後整個往後仰 LEAN(跟人偶一樣) */
function standing(b, fn, at = [0, 0, 0.2], s = 1) {
  const g = new THREE.Group(); fn(g);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}
/** 直式旗(幟 / のぼり):底色 + 一到五個直書的字 */
const noboriTex = new Map();
export function noboriMat(text, bg, fg = '#fff8e8') {
  const k = text + bg + fg;
  if (!noboriTex.has(k)) {
    const n = text.length, c = document.createElement('canvas'); c.width = 48; c.height = 40 + n * 40;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = fg; g.fillRect(0, 0, c.width, 8);
    g.font = '900 34px "Noto Serif TC","Noto Serif JP","PingFang TC",serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    [...text].forEach((ch, i) => g.fillText(ch, 24, 32 + i * 40));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    noboriTex.set(k, { mat: new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }), aspect: c.width / c.height });
  }
  return noboriTex.get(k);
}
/** 插在背上的のぼり旗(不烤,名稱 'flag' → 每幀飄動) */
function addNobori(rig, pos, text, bg, h = 1.2, fg) {
  const { mat, aspect } = noboriMat(text, bg, fg);
  const pole = part(rig, GEO.cyl, M.wood, [pos[0], pos[1] - h * 0.3, pos[2]], [0.025, h * 1.5, 0.025]);
  pole.name = 'pole';
  const f = new THREE.Mesh(new THREE.PlaneGeometry(h * aspect, h).translate(h * aspect / 2, -h / 2, 0), mat);
  f.name = 'flag'; f.position.set(pos[0] + 0.02, pos[1] + h * 0.42, pos[2]);
  rig.add(f);
  return f;
}
/** 一把火繩槍(鐵砲):木托 + 黑色長槍管 */
function teppo(g, at, s = 1, rz = -0.5) {
  const t = new THREE.Group(); t.position.set(...at); t.scale.setScalar(s); t.rotation.z = rz; g.add(t);
  part(t, GEO.box, M.wood, [0, -0.12, 0], [0.07, 0.3, 0.06]);
  part(t, GEO.cyl, M.iron, [0, 0.2, 0.01], [0.025, 0.5, 0.025]);
  part(t, GEO.cyl, M.gold, [0, 0.0, 0.01], [0.032, 0.04, 0.032]);
}

/* ---------------- 足輕(bee):藍灰胴丸 + 陣笠 + 長槍,小碎步行軍 ---------------- */
function ashigaru(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.beeBody, pants: M.beeBody, face: M.skin, head: M.hair,
    extra(g, hg) {
      part(hg, GEO.cone, M.jingasa, [0, 0.28, -0.02], [0.4, 0.14, 0.38]);                                // 陣笠
      part(hg, GEO.ico, M.gold, [0, 0.3, 0.26], [0.05, 0.05, 0.02]);
      part(g, GEO.box, M.beeBelly, [0, -0.2, 0.21], [0.24, 0.1, 0.02]);                                   // 胴丸的帶
      rod(g, M.wood, [0.36, -0.7], [0.36, 0.7], 0.022, 0.1);                                              // 長槍
      part(g, GEO.cone, M.steel, [0.36, 0.82, 0.1], [0.04, 0.2, 0.03]);
    },
  });
}

/* ---------------- 忍者(bfly):全身黑、只露出眼睛、紅頭巾帶飄在後面,飛身撲過來 ---------------- */
function ninja(b) {
  chibi(b, [0, 0, 0.3], 1, {
    body: M.ninja, pants: M.ninja, face: M.ninja, head: M.ninja, boots: M.ninja,
    extra(g, hg) {
      part(hg, GEO.box, M.skin, [0, 0.0, 0.28], [0.3, 0.09, 0.04]);                                       // 露出的眼睛那一條
      for (const x of [-1, 1]) {
        part(hg, GEO.ico, M.eye, [x * 0.09, 0.0, 0.31], [0.035, 0.03, 0.02]);
        part(hg, GEO.box, M.dark, [x * 0.09, 0.06, 0.3], [0.09, 0.02, 0.02], [0, 0, x * 0.4]);
      }
      part(hg, GEO.cyl, M.red, [0, 0.12, 0.0], [0.31, 0.04, 0.3]);                                        // 紅頭巾帶
      for (const x of [-1, 1]) part(hg, GEO.box, M.red, [0.08 + x * 0.04, 0.1, -0.35], [0.04, 0.2, 0.02], [0.4, 0, x * 0.3]);
      part(g, GEO.box, M.steel, [0.32, -0.24, 0.12], [0.04, 0.18, 0.02], [0, 0, -0.4]);                   // 苦無
    },
  });
}

/* ---------------- 武將(boss):赤備鎧甲 + 金色鍬形前立的頭盔 + 舉起的刀,打兩下 ---------------- */
function bushou(b) {
  chibi(b, [0, 0, 0.25], 1.22, {
    body: M.bossBody, pants: M.bossBody, face: M.skin, head: M.bossHead,
    extra(g, hg) {
      part(hg, GEO.ico2, M.bossBody, [0, 0.12, -0.04], [0.34, 0.24, 0.32]);                               // 頭盔
      part(hg, GEO.cyl, M.bossBody, [0, 0.0, -0.08], [0.4, 0.06, 0.36]);                                   // 盔緣(しころ)
      for (const x of [-1, 1]) part(hg, GEO.box, M.bossWing, [x * 0.11, 0.38, 0.14], [0.04, 0.3, 0.02], [0, 0, -x * 0.45]); // 鍬形
      part(hg, GEO.ico, M.bossWing, [0, 0.24, 0.26], 0.04);
      for (const x of [-1, 1]) part(hg, GEO.box, M.dark, [x * 0.1, 0.07, 0.29], [0.1, 0.025, 0.02], [0, 0, x * 0.4]); // 怒眉
      part(hg, GEO.box, M.dark, [0, -0.12, 0.29], [0.14, 0.025, 0.02]);                                    // 鬍子
      for (const x of [-1, 1]) part(g, GEO.ico, M.bossBody, [x * 0.3, -0.06, 0.02], [0.13, 0.1, 0.11]);    // 大袖
      rod(g, M.steel, [0.36, -0.3], [0.5, 0.45], 0.02, 0.12);                                              // 刀
      part(g, GEO.box, M.bossInner, [0.36, -0.32, 0.12], [0.08, 0.03, 0.03]);
    },
  });
}

/* ---------------- 玩家:織田信長(10 段官位) ----------------
 * 殺敵累積經驗 → 吉法師 … 天下人。一開始就有黑漆鎧甲 + 髷 + 右手鐵砲,每一段加零件:
 *   Lv2 紅披風、Lv3 大袖(肩甲)、Lv4 腰上的刀、Lv5 胸前金色木瓜紋、Lv6 南蠻帽(寬邊 + 羽毛)、
 *   Lv7 金邊鎧甲、Lv8 魔王的紅色鬥氣、Lv9 金色前立的頭盔、Lv10 背後的火焰光輪。
 * 'ally' = 豐臣秀吉(猴臉、大耳朵、橘色鎧甲、背後的千成瓢簞)。 */
export const SHIP_LV = [
  { name: '吉法師', body: 0x3a3a44, accent: 0xffd24a, pod: 0xc8282a, flame: 0xffe0a0, span: 1.0 },
  { name: '尾張的傻瓜', body: 0x3a3a44, accent: 0xffd24a, pod: 0xc8282a, flame: 0xffe0a0, span: 1.02 },
  { name: '上總介', body: 0x2a2a34, accent: 0xffd24a, pod: 0xc8282a, flame: 0xffe0a0, span: 1.04 },
  { name: '尾張守', body: 0x2a2a34, accent: 0xffd24a, pod: 0xb8202a, flame: 0xffe0a0, span: 1.06 },
  { name: '天下布武', body: 0x22222c, accent: 0xffd24a, pod: 0xb8202a, flame: 0xffd890, span: 1.08 },
  { name: '岐阜城主', body: 0x22222c, accent: 0xffd24a, pod: 0x8a1a3a, flame: 0xffd890, span: 1.1 },
  { name: '右大臣', body: 0x1e1e28, accent: 0xffe07a, pod: 0x8a1a3a, flame: 0xffc070, span: 1.12 },
  { name: '安土城主', body: 0x1e1e28, accent: 0xffe07a, pod: 0x6a1a4a, flame: 0xff9a50, span: 1.14 },
  { name: '第六天魔王', body: 0x1a1a22, accent: 0xffe07a, pod: 0xb8102a, flame: 0xff7a3a, span: 1.16 },
  { name: '天下人', body: 0x1a1a22, accent: 0xffffff, pod: 0xd8202a, flame: 0xffd24a, span: 1.2 },
];

function nobunagaBody(m, L, ally) {
  return (b) => {
    if (ally) {
      // 豐臣秀吉:紅通通的猴臉 + 大耳朵 + 橘色鎧甲 + 手上的采配
      chibi(b, [0, 0, 0.3], 1.25, {
        body: C(0xe8902a), pants: C(0xa86a2a), face: C(0xf0b890), head: M.hair, big: 1.25,
        extra(g, hg) {
          for (const x of [-1, 1]) part(hg, GEO.ico2, C(0xf0b890), [x * 0.3, 0.0, 0.02], [0.09, 0.11, 0.05]); // 大耳朵
          part(hg, GEO.ico2, C(0xf8d8b8), [0, -0.1, 0.25], [0.15, 0.1, 0.07]);                               // 猴子嘴
          part(hg, GEO.box, M.dark, [0, -0.13, 0.31], [0.1, 0.02, 0.02]);
          part(hg, GEO.box, M.hair, [0, 0.32, -0.04], [0.06, 0.1, 0.06]);                                    // 髷
          rod(g, M.wood, [-0.34, -0.3], [-0.46, 0.05], 0.02, 0.1);                                            // 采配
          for (let i = 0; i < 4; i++) part(g, GEO.box, M.white, [-0.48 + (i - 1.5) * 0.03, 0.14, 0.1], [0.02, 0.14, 0.01], [0, 0, (i - 1.5) * 0.2]);
        },
      });
      return;
    }
    chibi(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: m.red, face: M.skin, head: M.hair, big: 1.3,
      extra(g, hg) {
        part(hg, GEO.box, M.hair, [0, 0.33, -0.08], [0.07, 0.16, 0.07], [-0.5, 0, 0]);                        // 髷(茶筅髷)
        part(hg, GEO.cyl, M.red, [0, 0.28, -0.06], [0.05, 0.04, 0.05]);                                        // 紅繩
        for (const x of [-1, 1]) {
          part(hg, GEO.box, M.dark, [x * 0.1, 0.07, 0.29], [0.1, 0.025, 0.02], [0, 0, x * 0.35]);              // 銳利的眉
          part(hg, GEO.box, M.hair, [x * 0.06, -0.12, 0.29], [0.07, 0.02, 0.02], [0, 0, -x * 0.35]);           // 八字鬍
        }
        part(g, GEO.box, M.gold, [0, -0.2, 0.215], [0.28, 0.05, 0.02]);                                        // 腰帶
        teppo(g, [0.38, -0.2, 0.16], 1.1);                                                                      // 右手的鐵砲
        if (L >= 2) part(g, GEO.box, m.blue, [0, -0.25, -0.2], [0.58, 0.64, 0.03], [0.2, 0, 0]);               // 紅披風
        if (L >= 3) for (const x of [-1, 1]) part(g, GEO.ico, m.red, [x * 0.3, -0.06, 0.02], [0.13, 0.1, 0.11]); // 大袖
        if (L >= 4) rod(g, M.dark, [-0.22, -0.34], [-0.5, -0.1], 0.02, 0.15);                                  // 腰上的刀
        if (L >= 5) {                                                                                           // 木瓜紋
          part(g, GEO.ico, M.gold, [0, -0.08, 0.23], [0.07, 0.07, 0.02]);
          part(g, GEO.ico, M.red, [0, -0.08, 0.24], [0.035, 0.035, 0.01]);
        }
        if (L >= 6 && L < 9) {                                                                                  // 南蠻帽
          part(hg, GEO.cyl, M.dark, [0, 0.3, -0.02], [0.4, 0.03, 0.38]);
          part(hg, GEO.cyl, M.dark, [0, 0.38, -0.04], [0.2, 0.14, 0.2]);
          part(hg, GEO.cone, M.white, [0.14, 0.46, -0.1], [0.04, 0.2, 0.03], [0, 0, -0.8]);
        }
        if (L >= 7) for (const x of [-1, 1]) part(g, GEO.cyl, M.gold, [x * 0.3, -0.14, 0.03], [0.12, 0.02, 0.11]); // 金邊
        if (L >= 9) {                                                                                           // 金色前立的頭盔
          part(hg, GEO.ico2, m.red, [0, 0.14, -0.04], [0.34, 0.24, 0.32]);
          part(hg, GEO.halfRing, M.gold, [0, 0.36, 0.18], [0.18, 0.16, 0.2]);
        }
      },
    });
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
const HALO_GEO = new THREE.TorusGeometry(0.9, 0.06, 6, 36);
function shipTemplate(m, L = 1, ally = false) {
  return template(nobunagaBody(m, L, ally), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下的塵土;第六天魔王之後是火
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], ally ? 0xf4e8d0 : m.flame, [0.1, L >= 8 ? 0.45 : 0.3, 0.08], L >= 8 ? 0.8 : 0.45);
    if (ally) {
      addNobori(rig, [-0.45, 0.4, 0.8], '羽柴', '#e8902a', 0.8);
      const hy = new THREE.Group(); hy.position.set(0.5, 0.6, 0.6); rig.add(hy);                                // 千成瓢簞
      part(hy, GEO.cyl, M.wood, [0, -0.3, 0], [0.02, 0.9, 0.02]);
      for (const [y, r] of [[0.1, 0.12], [0.3, 0.08]]) part(hy, GEO.ico2, M.gold, [0, y, 0], r);
      return;
    }
    addNobori(rig, [-0.5, 0.45, 0.8], L >= 10 ? '天下' : '永楽', '#e8e0c8', 0.8, '#2a2226');
    if (L >= 10) {
      const h = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.name = 'halo'; h.position.set(0, 0.35, 0.1); rig.add(h);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xffb03a : 0xff3a2a, transparent: true, opacity: L >= 10 ? 0.14 : 0.1, blending: THREE.AdditiveBlending, depthWrite: false }));
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

/* ---------------- 關底大名(面朝玩家) ---------------- */
const BM = {
  akazonae: C(0xb8282a), akaDark: C(0x7a1a1e), yak: C(0xf8f4ec), gunbai: C(0x2a2226),
  uesugiArmor: C(0xe8e8f0), uesugiBlue: C(0x3a5aa8), hood: C(0xfaf8f4),
  akechiArmor: C(0x4a3a7a), kikyo: C(0x6a8ae8), fire: new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  chest: C(0x6a3a22), chestBand: C(0x2a2226), koban: C(0xf2c23a),
};

/** 武田信玄:赤備鎧甲 + 諏訪法性兜(金角 + 往後披的白色長毛)+ 軍配團扇 + 「風林火山」旗 */
function takedaBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.7, {
    body: BM.akazonae, pants: BM.akaDark, face: M.skin, head: BM.akazonae,
    extra(g, hg) {
      for (let i = 0; i < 7; i++) part(hg, GEO.ico2, BM.yak, [(i - 3) * 0.08, 0.15 - Math.abs(i - 3) * 0.02, -0.22 - Math.abs(i - 3) * 0.02], [0.09, 0.3, 0.08], [0.6, 0, (i - 3) * 0.2]); // 白毛
      for (const x of [-1, 1]) part(hg, GEO.cone, M.gold, [x * 0.14, 0.34, 0.1], [0.04, 0.2, 0.04], [0, 0, -x * 0.4]); // 金角
      part(hg, GEO.cyl, BM.akazonae, [0, 0.0, -0.08], [0.4, 0.06, 0.36]);
      for (const x of [-1, 1]) part(hg, GEO.box, M.dark, [x * 0.1, 0.07, 0.29], [0.1, 0.03, 0.02], [0, 0, x * 0.4]);
      part(hg, GEO.ico, M.dark, [0, -0.17, 0.26], [0.14, 0.06, 0.04]);                                       // 鬍子
      rod(g, M.wood, [0.32, -0.3], [0.38, 0.0], 0.02, 0.12);                                                // 軍配
      part(g, GEO.cyl, BM.gunbai, [0.39, 0.12, 0.13], [0.16, 0.02, 0.14], [Math.PI / 2, 0, 0]);
      part(g, GEO.cyl, M.red, [0.39, 0.12, 0.145], [0.07, 0.02, 0.06], [Math.PI / 2, 0, 0]);
    },
  });
}
/** 上杉謙信:白色頭巾(只露出臉)+ 白藍鎧甲 + 拔出來的刀 + 「毘」旗 */
function uesugiBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.7, {
    body: BM.uesugiArmor, pants: BM.uesugiBlue, face: M.skin, head: BM.hood,
    extra(g, hg) {
      part(hg, GEO.ico2, BM.hood, [0, -0.04, -0.02], [0.35, 0.36, 0.3]);                                    // 包住頭的頭巾
      part(hg, GEO.cone, BM.hood, [0, -0.36, -0.05], [0.18, 0.3, 0.1], [Math.PI, 0, 0]);                   // 垂下來的布
      for (const x of [-1, 1]) part(hg, GEO.box, M.dark, [x * 0.09, 0.06, 0.3], [0.09, 0.02, 0.02], [0, 0, x * 0.2]);
      for (const x of [-1, 1]) part(g, GEO.ico, BM.uesugiBlue, [x * 0.3, -0.06, 0.02], [0.13, 0.1, 0.11]);
      rod(g, M.steel, [0.3, -0.3], [0.55, 0.5], 0.02, 0.12);                                                 // 刀
      part(g, GEO.box, M.gold, [0.31, -0.28, 0.12], [0.08, 0.03, 0.03]);
    },
  });
}
/** 明智光秀:紫藍鎧甲 + 胸前的桔梗紋 + 一圈燒起來的火(本能寺)+ 「敵在本能寺」旗 */
function akechiBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.7, {
    body: BM.akechiArmor, pants: BM.akechiArmor, face: M.skin, head: BM.akechiArmor,
    extra(g, hg) {
      part(hg, GEO.cyl, BM.akechiArmor, [0, 0.0, -0.08], [0.4, 0.06, 0.36]);
      part(hg, GEO.halfRing, M.gold, [0, 0.34, 0.1], [0.16, 0.14, 0.2]);                                     // 前立
      for (const x of [-1, 1]) part(hg, GEO.box, M.dark, [x * 0.1, 0.06, 0.29], [0.1, 0.025, 0.02], [0, 0, x * 0.25]);
      for (let i = 0; i < 5; i++) {                                                                            // 桔梗紋(五瓣)
        const a = i / 5 * Math.PI * 2;
        part(g, GEO.ico, BM.kikyo, [Math.sin(a) * 0.06, -0.12 + Math.cos(a) * 0.06, 0.23], [0.045, 0.045, 0.015]);
      }
      for (const x of [-1, 1]) part(g, GEO.ico, BM.akechiArmor, [x * 0.3, -0.06, 0.02], [0.13, 0.1, 0.11]);
      rod(g, M.wood, [0.34, -0.3], [0.4, 0.05], 0.02, 0.12);                                                 // 采配
    },
  });
}
function fireRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.cone, BM.fire, [Math.cos(a) * 2.9, Math.sin(a) * 2.6 + 0.4, 0.9], [0.22, 0.6, 0.18]);
  }
  rig.add(spin);
}
/** 千兩箱(獎勵關):木箱 + 黑鐵箍 + 打開的蓋子 + 滿滿的小判,旁邊繞著一圈小判 */
function chestBody(b) {
  part(b, GEO.box, BM.chest, [0, -0.1, 0.3], [2.2, 1.6, 0.9]);
  for (const x of [-0.8, 0.8]) part(b, GEO.box, BM.chestBand, [x, -0.1, 0.3], [0.12, 1.65, 0.95]);
  for (let i = 0; i < 9; i++) part(b, GEO.ico2, BM.koban, [-0.7 + (i % 3) * 0.7, -0.4 + Math.floor(i / 3) * 0.4, 0.8], [0.3, 0.18, 0.06], [0, 0, i]);
  part(b, GEO.box, BM.chest, [0, 0.95, 0.6], [2.2, 0.2, 0.9], [-0.6, 0, 0]);                                // 打開的蓋子
}
function chestExtras(rig) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9), new THREE.MeshBasicMaterial({ map: bannerTex('両', '#6a3a22', '#ffd24a'), transparent: true }));
  f.position.set(0, -0.45, 0.76); rig.add(f);
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.ico2, BM.koban, [Math.cos(a) * 2.1, Math.sin(a) * 2.0, 0.5], [0.24, 0.15, 0.05], [0, 0, a]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'takeda') return template(takedaBody, 1.5, (rig) => addNobori(rig, [-2.1, 1.8, 1.4], '風林火山', '#b8282a', 2.4), { shadow: [1.5, 1.3] });
  if (kind === 'uesugi') return template(uesugiBody, 1.5, (rig) => addNobori(rig, [-2.1, 1.8, 1.4], '毘', '#f4f0e8', 1.4, '#2a2226'), { shadow: [1.5, 1.3] });
  if (kind === 'akechi') return template(akechiBody, 1.5, (rig) => { addNobori(rig, [-2.1, 1.8, 1.4], '敵在本能寺', '#3a5aa8', 2.6); fireRing(rig); }, { shadow: [1.5, 1.3] });
  return template(chestBody, 1.4, chestExtras, { shadow: [1.6, 1.2] });
}

/* ---------------- 焙烙玉(原本的隕石):黑色的圓炸彈 + 引信 + 火花,滾著過來 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.ico2, C(0x2a2a30), [0, 0, 0], 0.45);
  part(body, GEO.cyl, C(0x8a6a40, 2), [0, 0.45, 0], [0.12, 0.12, 0.12]);
  for (const a of [0, 1.57]) part(body, GEO.torus, C(0xc8a060, 2), [0, 0, 0], [0.46, 0.46, 0.2], [0, a, 0]); // 綁的繩
  rod(body, C(0xc8a060, 2), [0, 0.5], [0.08, 0.72], 0.015, 0);                                              // 引信
  rig.add(bake(body));
  const spark = part(rig, GEO.ico, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), [0.08, 0.76, 0], 0.12);
  spark.name = 'flame';
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xd8d0c4, transparent: true, opacity: 0.35, depthWrite: false }), [0, -1.0, -0.2], [0.35, 1.1, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';                                                                                        // 揚起的煙
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(ashigaru, 1.65, (rig) => addNobori(rig, [-0.35, 0.3, 0.5], '足', '#3a4a6a', 0.45), { shadow: [0.45, 0.35], upright: true }),
  bfly: template(ninja, 1.6, null, { shadow: [0.4, 0.3], upright: true }),
  boss: template(bushou, 1.4, (rig) => addNobori(rig, [-0.45, 0.45, 0.6], '武', '#b8282a', 0.55), { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(武將被打)就換單一 mesh 的 material。
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
/** 旗子飄動 / 鸚鵡拍翅膀(沿用 flapWings 的呼叫點:t = 動畫相位)。翅膀有 userData.amp / freq / side */
export function flapWings(mdl, t) {
  for (const f of mdl.flags) {
    const u = f.userData, s = Math.sin(t * (u.freq || 0.8) + (u.side ? 0 : u.ph)) * (u.amp || 0.35);
    f.rotation.y = u.side ? -u.side * s : s;
  }
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:印籠(漆盒 + 繩 + 根付 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: '鐵砲' },
  R: { label: 'R', color: 0x3ad8ff, name: '疾風' },
  S: { label: 'S', color: 0x3ae07a, name: '南蠻鎧' },
  B: { label: 'B', color: 0xb86aff, name: '焙烙玉' },
  W: { label: 'W', color: 0xe8902a, name: '秀吉參上' },
  L: { label: '1UP', color: 0xffc23a, name: '飯糰' },
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
  const cm = C(it.color, 2);
  part(body, GEO.box, cm, [0, -0.08, 0.2], [0.5, 0.64, 0.2]);                                           // 漆盒
  for (const y of [0.1, -0.26]) part(body, GEO.box, M.gold, [0, y, 0.31], [0.52, 0.04, 0.02]);         // 金線
  part(body, GEO.cyl, M.red, [0, 0.42, 0.2], [0.02, 0.32, 0.02]);                                         // 繩
  part(body, GEO.ico2, M.gold, [0, 0.6, 0.2], 0.08);                                                      // 根付
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
const merged = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

/** 玩家:鐵砲的彈丸(亮黃色的圓 + 往後拖的火光尾巴) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [merged([geoAt(GEO.ico, [0, 0.08, 0], [0.13, 0.13, 0.13]), geoAt(GEO.cone, [0, -0.16, 0], [0.1, 0.4, 0.06]).rotateZ(Math.PI).translate(0, -0.32, 0)]), SHOT_MAT],
    [geoAt(GEO.ico0, [0, 0.09, 0.08], [0.07, 0.07, 0.05]), SHOT_TIP],
  ], cap);
}
/** 敵彈:手裏劍(四個尖角 + 中間的黑圓) */
export function enemyShotBatch(scene, cap) {
  const pts = [];
  for (let i = 0; i < 4; i++) pts.push(geoAt(GEO.cone, [0, 0.16, 0], [0.07, 0.22, 0.03]).rotateZ(i * Math.PI / 2 + Math.PI / 4));
  return new Batch(scene, [
    [merged(pts), EB_MAT],
    [geoAt(GEO.cyl, [0, 0, 0.02], [0.07, 0.03, 0.07]).rotateX(Math.PI / 2), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
