import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * 所有角色都用基本幾何體拼出來(沒有模型檔),Q 版大頭比例、紙藝 / 黏土的圓潤感。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:人物在自己的座標系裡站立(頭 +y、臉 +z),整個人偶再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家 —— 像立體書裡立起來的紙板人偶。
 * 人物模型「不跟著前進方向旋轉」(userData.upright),只依速度左右微傾,臉才不會倒過來。
 * 馬匹用俯視畫(馬頭朝前進方向):玩家的馬頭朝上、敵騎的馬頭朝下(朝玩家)。
 *
 * 每個角色腳下有一塊地面陰影('shadow',貼在地面 z = -GROUND_Z),讓人一看就知道在地上。
 * 內部型別沿用原本的名字:bee = 黃巾兵、bfly = 魏軍弓兵、boss = 騎兵(打兩下)、rock = 投石。
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
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
  disc: new THREE.CircleGeometry(1, 22),
};

const C = (color, bands = 3) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair, 2), eye: flat({ color: 0x2a2226 }), cheek: flat({ color: 0xff9a8a }),
  white: C(0xf8f6f0), red: C(0xd8322e), gold: C(0xffc23a), silver: C(0xd0d8e4), wood: C(0x8a6040, 2), dark: C(0x2a2a30, 2),
  steel: C(0xb8c0cc, 2), straw: C(0xe8c870, 2), rope: C(0xc8a060, 2),
  // 黃巾兵
  beeBody: C(PAL.beeBody), beeBand: C(PAL.beeBand), beePants: C(PAL.beeWing, 2), shield: C(0xb8844a, 2),
  // 魏軍弓兵
  bflyBody: C(PAL.bflyBody), bflyHelm: C(PAL.bflyHead, 2), bflyBow: C(PAL.bflyRim, 2),
  // 騎兵
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner, 2), bossHorse: C(PAL.bossWing),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0x6a3a2a, 2),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 騎兵被打第一下之後換色用的對照表(盔甲被打裂變銅色) */
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

/* ---------------- 旗幟貼圖(蜀 / 魏 / 吳 / 黃 / 漢…):canvas 畫字 ---------------- */
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
  part(g, GEO.ico2, o.face || M.skin, [0, 0.28, 0.02], 0.3);                               // 大頭
  part(g, GEO.ico2, o.head || M.hair, [0, 0.36, -0.06], [0.32, 0.3, 0.3]);                 // 頭髮 / 頭盔(在後上方,露出臉)
  for (const x of [-1, 1]) {
    part(g, GEO.ico, M.eye, [x * 0.1, 0.27, 0.29], [0.035, 0.05, 0.03]);
    part(g, GEO.ico, M.cheek, [x * 0.17, 0.19, 0.26], [0.04, 0.025, 0.02]);
  }
  if (o.extra) o.extra(g);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}

/* ---------------- 俯視的馬(dir = +1 馬頭朝上、-1 朝下) ---------------- */
function horse(b, at, s, dir, coat, mane, extra) {
  const g = new THREE.Group();
  part(g, GEO.ico, coat, [0, -0.05 * dir, 0], [0.3, 0.6, 0.28]);
  part(g, GEO.ico, coat, [0, 0.62 * dir, 0.1], [0.17, 0.3, 0.19]);                  // 馬頭
  part(g, GEO.ico, coat, [0, 0.4 * dir, 0.1], [0.13, 0.18, 0.16]);                  // 脖子
  part(g, GEO.ico, mane, [0, 0.36 * dir, 0.24], [0.06, 0.3, 0.06]);                 // 鬃毛
  part(g, GEO.cone, mane, [0, -0.72 * dir, 0.1], [0.08, 0.36, 0.06], [0, 0, dir > 0 ? Math.PI : 0]); // 尾巴
  for (const x of [-1, 1]) {
    part(g, GEO.cone4, coat, [x * 0.08, 0.76 * dir, 0.22], [0.04, 0.1, 0.04]);      // 耳朵
    part(g, GEO.ico, M.eye, [x * 0.12, 0.66 * dir, 0.2], 0.03);
    for (const y of [0.32, -0.38]) part(g, GEO.cyl, coat, [x * 0.18, y * dir, -0.18], [0.05, 0.12, 0.05], [Math.PI / 2, 0, 0]);
  }
  part(g, GEO.box, M.red, [0, -0.05 * dir, 0.26], [0.34, 0.28, 0.06]);               // 馬鞍
  if (extra) extra(g);
  g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}

/* ---------------- 黃巾兵(bee):黃頭巾、短槍、木盾 ---------------- */
function yellowTurban(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.beeBody, pants: M.beePants,
    extra(g) {
      part(g, GEO.torus, M.beeBand, [0, 0.42, -0.02], [0.31, 0.31, 0.5], [Math.PI / 2 - 0.3, 0, 0]);  // 黃巾
      part(g, GEO.ico, M.beeBand, [0.22, 0.5, -0.12], [0.08, 0.14, 0.05], [0, 0, -0.6]);
      part(g, GEO.cyl, M.shield, [-0.33, -0.25, 0.14], [0.2, 0.05, 0.2], [Math.PI / 2, 0, 0]);         // 木盾
      part(g, GEO.ico, M.beeBand, [-0.33, -0.25, 0.18], 0.05);
      part(g, GEO.cyl, M.wood, [0.36, 0.0, 0.08], [0.025, 1.1, 0.025]);                                  // 短槍
      part(g, GEO.cone, M.steel, [0.36, 0.62, 0.08], [0.05, 0.16, 0.04]);
    },
  });
}

/* ---------------- 魏軍弓兵(bfly):深藍甲、黑盔、弓 ---------------- */
function weiArcher(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.bflyBody, head: M.bflyHelm,
    extra(g) {
      part(g, GEO.cone, M.bflyHelm, [0, 0.72, -0.06], [0.05, 0.16, 0.05]);                               // 盔尖
      part(g, GEO.box, M.bflyHelm, [0, 0.46, 0.2], [0.36, 0.05, 0.1]);                                    // 盔沿
      part(g, GEO.halfRing, M.bflyBow, [-0.34, -0.15, 0.14], [0.14, 0.42, 0.4], [0, 0, Math.PI / 2]);      // 弓
      part(g, GEO.cyl, M.white, [-0.34, -0.15, 0.14], [0.008, 0.82, 0.008]);
      part(g, GEO.cyl, M.bflyBow, [0.2, -0.1, -0.18], [0.07, 0.34, 0.07], [0.3, 0, 0.3]);                 // 箭袋
    },
  });
}

/* ---------------- 騎兵(boss):黑甲紅袍、戟,馬頭朝下 ---------------- */
function cavalry(b) {
  horse(b, [0, -0.1, 0], 1.05, -1, M.bossHorse, M.dark);
  chibi(b, [0, 0.2, 0.55], 0.82, {
    body: M.bossBody, pants: M.bossHead, head: M.bossInner,
    extra(g) {
      part(g, GEO.cone, M.bossHead, [0, 0.74, -0.06], [0.05, 0.18, 0.05]);
      part(g, GEO.cyl, M.dark, [0.4, 0.1, 0.1], [0.028, 1.5, 0.028]);                                    // 戟桿
      part(g, GEO.cone, M.steel, [0.4, 0.92, 0.1], [0.06, 0.2, 0.04]);
      part(g, GEO.halfRing, M.steel, [0.47, 0.72, 0.1], [0.1, 0.12, 0.3], [0, 0, -Math.PI / 2]);           // 戟刃
    },
  });
}

/* ---------------- 玩家:趙子龍 + 白馬(10 段官階) ----------------
 * 殺敵累積經驗 → 小兵 … 常勝將軍。每一段加零件、換顏色:
 *   Lv2 皮盔、Lv3 龍膽亮銀槍 + 白馬、Lv4 銀甲肩甲、Lv5 紅纓 + 馬鎧、Lv6 白披風、
 *   Lv7 背上四面靠旗、Lv8 金邊鎧甲、Lv9 槍身發光、Lv10 金龍光環。
 * 樣板第一次用到才建(spawnModel('ship3') …);'ally3' = 援軍關羽(綠袍紅臉、赤兔、青龍偃月刀)。 */
export const SHIP_LV = [
  { name: '小兵', body: 0x8a6a4a, accent: 0xd8322e, pod: 0x6a4a30, flame: 0xffffff, span: 1.0 },
  { name: '伍長', body: 0x8a6a4a, accent: 0xd8322e, pod: 0x7a5a3a, flame: 0xffffff, span: 1.02 },
  { name: '什長', body: 0x5a7ab0, accent: 0xd8322e, pod: 0xc8d0e0, flame: 0xffffff, span: 1.04 },
  { name: '百夫長', body: 0x4a6aa8, accent: 0xd8322e, pod: 0xd0d8e4, flame: 0xffffff, span: 1.06 },
  { name: '校尉', body: 0x3a5aa8, accent: 0xe8322e, pod: 0xd8e0ec, flame: 0xffffff, span: 1.08 },
  { name: '偏將軍', body: 0x2e4a98, accent: 0xe8322e, pod: 0xe0e8f4, flame: 0xffffff, span: 1.1 },
  { name: '將軍', body: 0x2a4a8a, accent: 0xe83a2e, pod: 0xe8eef8, flame: 0xffffff, span: 1.12 },
  { name: '大將軍', body: 0x243f80, accent: 0xff3a2a, pod: 0xfff2c0, flame: 0xfff6d8, span: 1.14 },
  { name: '五虎上將', body: 0x1e3878, accent: 0xff4a2a, pod: 0xffe070, flame: 0xfff0c0, span: 1.16 },
  { name: '常勝將軍', body: 0x1a3070, accent: 0xffffff, pod: 0xffd24a, flame: 0xffe8a0, span: 1.2 },
];

function riderBody(m, L, ally) {
  return (b) => {
    const coat = ally ? C(0xb8402a) : L >= 3 ? M.white : C(0x9a6a3a);
    horse(b, [0, -0.05, 0], 1.08, 1, coat, ally ? M.dark : L >= 3 ? C(0xd8dce4, 2) : M.dark, (g) => {
      if (L >= 5) for (const x of [-1, 1]) part(g, GEO.box, m.blue, [x * 0.27, -0.05, 0.08], [0.06, 0.6, 0.2]);  // 馬鎧
      if (L >= 8) part(g, GEO.box, M.gold, [0, 0.28, 0.24], [0.3, 0.06, 0.06]);
    });
    const armor = ally ? C(0x2e8a4a) : L >= 4 ? m.blue : m.white;
    chibi(b, [0, -0.02, 0.62], 0.86, {
      body: armor, pants: ally ? C(0x2e8a4a) : m.white,
      face: ally ? C(0xc8503a) : M.skin,
      head: ally ? C(0x2e8a4a) : L >= 2 ? (L >= 4 ? m.blue : C(0x8a6a4a, 2)) : M.hair,
      extra(g) {
        if (ally) {
          part(g, GEO.ico, M.hair, [0, 0.02, 0.22], [0.16, 0.24, 0.08]);                                   // 美髯
          part(g, GEO.cyl, M.dark, [0.42, 0.1, 0.08], [0.03, 1.7, 0.03]);                                    // 青龍偃月刀
          part(g, GEO.halfRing, C(0x6ac8a0), [0.5, 0.86, 0.08], [0.16, 0.24, 0.35], [0, 0, -Math.PI / 2]);
          return;
        }
        if (L >= 4) for (const x of [-1, 1]) part(g, GEO.ico, m.blue, [x * 0.3, -0.06, 0.04], [0.12, 0.1, 0.1]); // 肩甲
        if (L >= 8) part(g, GEO.box, M.gold, [0, -0.1, 0.22], [0.3, 0.05, 0.04]);
        if (L >= 5) part(g, GEO.cone, m.red, [0, 0.75, -0.06], [0.07, 0.24, 0.07]);                      // 紅纓
        if (L >= 2) part(g, GEO.box, L >= 4 ? m.blue : C(0x8a6a4a, 2), [0, 0.47, 0.22], [0.4, 0.05, 0.08]); // 盔沿
        if (L >= 6) part(g, GEO.box, M.white, [0, -0.3, -0.2], [0.5, 0.6, 0.04], [-0.2, 0, 0]);          // 白披風
      },
    });
    // 槍:Lv1~2 木槍,Lv3 起龍膽亮銀槍(槍尖 + 紅纓)
    const shaft = L >= 3 ? M.silver : M.wood;
    if (!ally) {
      rod(b, shaft, [0.42, -0.7], [0.42, 1.55], 0.035, 0.7);
      part(b, GEO.cone, L >= 9 ? C(0xfff2a0) : M.steel, [0.42, 1.7, 0.7], [0.07, 0.3, 0.05]);
      if (L >= 3) part(b, GEO.ico, m.red, [0.42, 1.45, 0.7], [0.08, 0.1, 0.08]);
    }
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
const HALO_GEO = new THREE.TorusGeometry(0.85, 0.045, 6, 36);
function shipTemplate(m, L = 1, ally = false) {
  return template(riderBody(m, L, ally), 1.4 + 0.025 * (L - 1), (rig) => {
    // 揚起的塵土(每幀閃爍;名稱 flame 沿用舊的尾焰機制)
    for (const x of [-0.18, 0.18]) addFlame(rig, [x, -0.95, -0.2], 0xe8d8b0, [0.12, 0.45, 0.08], 0.5);
    if (ally) { addFlag(rig, [-0.3, 0.55, 0.9], '關', '#2e8a4a', 0.8); return; }
    if (L >= 7) {
      // 背上四面靠旗
      const cols = ['#d8322e', '#2a4fa8', '#d8322e', '#2a4fa8'];
      [-0.36, -0.14, 0.14, 0.36].forEach((x, i) => {
        const f = new THREE.Mesh(FLAG_GEO, bannerMat(i % 2 ? '漢' : '趙', cols[i]));
        f.name = 'flag'; f.position.set(x - 0.1, 1.05, 0.72); f.scale.setScalar(0.55); f.rotation.z = -x * 0.8;
        rig.add(f);
      });
    } else addFlag(rig, [-0.34, 0.5, 0.9], L >= 5 ? '趙' : '漢', '#d8322e', 0.75);
    if (L >= 10) {
      const h = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.name = 'halo'; h.position.set(0, 0.3, 0.3); rig.add(h);
    }
    if (L >= 9) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: L >= 10 ? 0.14 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(1.0, 1.2, 0.45); rig.add(a);
    }
  }, { shadow: [0.55, 0.9], upright: true });
}
function evolvedShip(L, ally = false) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: C(0xf0f0f4), red: C(c.accent), blue: C(c.pod), flame: c.flame }, L, ally);
}
function addFlame(rig, pos, color, scl, opacity = 0.9) {
  const fm = flat({ color, transparent: true, opacity, depthWrite: false });
  const f = part(rig, GEO.cone, fm, pos, scl, [0, 0, Math.PI]);
  f.name = 'flame';
  return f;
}

/* ---------------- 關底敵將(面朝玩家 = 往 -y) ---------------- */
const BM = {
  redHorse: C(0xc8402a), gold: C(0xffc23a), cape: C(0xb8201e), feather: C(0xf0e0b0),
  hull: C(0x8a5a34), deck: C(0xc8a070, 2), wall: C(0xf2e6c8, 2), roof: C(0x3a3a48, 2), sail: C(0xf0e4c4, 2), sailBand: C(0x2a4fa8, 2),
  ele: C(0x8a8a94), eleDark: C(0x6a6a74, 2), tusk: C(0xfff8e8), howdah: C(0xb8282a), tribal: C(0x8a5a3a),
};

/** 呂布 + 赤兔馬:金甲、兩根長雉雞翎、紅披風、方天畫戟 */
function lubuBody(b) {
  part(b, GEO.box, BM.cape, [0, 1.1, 0.2], [2.4, 1.4, 0.08], [0.5, 0, 0]);
  horse(b, [0, -0.3, 0], 2.3, -1, BM.redHorse, C(0x6a1a14, 2));
  chibi(b, [0, 0.55, 1.2], 1.9, {
    body: BM.gold, pants: BM.cape, head: BM.gold,
    extra(g) {
      for (const x of [-1, 1]) part(g, GEO.cone, BM.feather, [x * 0.42, 0.95, -0.1], [0.035, 1.1, 0.035], [0, 0, -x * 0.55]);  // 雉雞翎
      part(g, GEO.box, BM.gold, [0, 0.47, 0.22], [0.42, 0.06, 0.08]);
      for (const x of [-1, 1]) part(g, GEO.ico, BM.gold, [x * 0.32, -0.06, 0.04], [0.13, 0.11, 0.1]);
      part(g, GEO.ico, M.eye, [0, 0.36, 0.3], [0.1, 0.02, 0.02]);   // 怒眉
    },
  });
  // 方天畫戟
  rod(b, M.dark, [1.5, -2.2], [1.5, 2.4], 0.07, 1.2);
  part(b, GEO.cone, M.steel, [1.5, -2.45, 1.2], [0.14, 0.45, 0.1], [0, 0, Math.PI]);
  for (const x of [-1, 1]) part(b, GEO.halfRing, M.steel, [1.5 + x * 0.22, -1.9, 1.2], [0.22, 0.3, 0.6], [0, 0, x > 0 ? 0 : Math.PI]);
}
/** 曹軍樓船:三層樓閣、藍帆、兩側長槳,船頭朝玩家 */
function shipBody(b) {
  part(b, GEO.box, BM.hull, [0, 0.2, 0], [2.6, 4.6, 0.8]);
  part(b, GEO.cone4, BM.hull, [0, -2.5, 0], [1.3, 1.2, 0.55], [0, 0, Math.PI]);
  part(b, GEO.box, BM.deck, [0, 0.2, 0.42], [2.3, 4.4, 0.06]);
  for (let k = 0; k < 3; k++) {
    const z = 0.8 + k * 0.62, s = 1 - k * 0.22, y = 0.8 - k * 0.1;
    part(b, GEO.box, BM.wall, [0, y, z], [1.9 * s, 2.0 * s, 0.5]);
    part(b, GEO.cone4, BM.roof, [0, y, z + 0.38], [1.55 * s, 0.3, 1.55 * s], [Math.PI / 2, Math.PI / 4, 0]);
  }
  part(b, GEO.cyl, M.wood, [0, -0.9, 1.6], [0.07, 0.07, 2.4], [Math.PI / 2, 0, 0]);
  part(b, GEO.box, BM.sail, [0, -0.9, 2.3], [2.2, 0.08, 1.5], [0.9, 0, 0]);
  for (const z of [1.9, 2.6]) part(b, GEO.box, BM.sailBand, [0, -0.9 + (z - 2.3) * -0.78, z], [2.22, 0.09, 0.12], [0.9, 0, 0]);
  for (const x of [-1, 1]) for (let i = 0; i < 5; i++) rod(b, M.wood, [x * 1.3, -1.3 + i * 0.75], [x * 2.1, -1.5 + i * 0.75], 0.05, 0.1); // 槳
}
/** 孟獲象兵:大象(長牙、大耳、長鼻朝玩家)+ 背上的紅色象轎 + 孟獲 */
function elephantBody(b) {
  part(b, GEO.ico2, BM.ele, [0, 0.5, 0], [1.5, 1.8, 1.1]);
  part(b, GEO.ico2, BM.ele, [0, -1.15, 0.35], [1.0, 0.9, 0.95]);
  for (const x of [-1, 1]) {
    part(b, GEO.ico, BM.eleDark, [x * 1.05, -0.9, 0.45], [0.75, 0.85, 0.1], [0, x * 0.3, 0]);       // 大耳
    part(b, GEO.cone, BM.tusk, [x * 0.35, -1.9, 0.3], [0.1, 0.7, 0.1], [0, 0, x * 0.35 + Math.PI]);  // 長牙
    part(b, GEO.ico, M.eye, [x * 0.35, -1.35, 1.05], 0.07);
    for (const y of [1.2, -0.3]) part(b, GEO.cyl, BM.ele, [x * 1.0, y, -0.7], [0.3, 0.6, 0.3], [Math.PI / 2, 0, 0]);
  }
  // 長鼻:三節往下捲
  part(b, GEO.cyl, BM.ele, [0, -1.85, 0.3], [0.22, 0.6, 0.2], [0.4, 0, 0]);
  part(b, GEO.cyl, BM.ele, [0, -2.3, 0.08], [0.17, 0.5, 0.16], [0.9, 0, 0]);
  part(b, GEO.ico, BM.ele, [0, -2.55, -0.1], 0.17);
  // 象轎 + 孟獲
  part(b, GEO.box, BM.howdah, [0, 0.55, 1.2], [1.3, 1.3, 0.55]);
  part(b, GEO.box, BM.gold, [0, 0.55, 1.5], [1.4, 1.4, 0.08]);
  chibi(b, [0, 0.45, 1.85], 1.4, {
    body: BM.tribal, face: C(0xb87a50), head: M.hair,
    extra(g) {
      for (let i = -2; i <= 2; i++) part(g, GEO.cone, i % 2 ? M.red : BM.gold, [i * 0.13, 0.66, -0.05], [0.05, 0.3, 0.03], [0, 0, -i * 0.3]); // 羽冠
      part(g, GEO.torus, BM.gold, [0, -0.02, 0.1], [0.2, 0.2, 0.3], [Math.PI / 2, 0, 0]);
    },
  });
}
/** 草船(獎勵關):船身紮滿稻草人,箭插滿了就大賺 */
function strawBoatBody(b) {
  part(b, GEO.box, BM.hull, [0, 0.2, 0], [1.8, 3.6, 0.6]);
  part(b, GEO.cone4, BM.hull, [0, -1.95, 0], [0.9, 0.8, 0.4], [0, 0, Math.PI]);
  for (const x of [-1, 1]) for (let i = 0; i < 4; i++) {
    part(b, GEO.cyl, M.straw, [x * 0.7, -1.1 + i * 0.8, 0.7], [0.22, 0.6, 0.22], [0.5, 0, 0]);           // 稻草人
    part(b, GEO.ico, M.straw, [x * 0.7, -0.8 + i * 0.8, 1.05], 0.17);
    for (let k = 0; k < 3; k++) rod(b, M.wood, [x * (0.75 + k * 0.08), -1.2 + i * 0.8 + k * 0.1], [x * (1.05 + k * 0.08), -1.25 + i * 0.8 + k * 0.1], 0.015, 0.8 + k * 0.08); // 插著的箭
  }
  part(b, GEO.box, BM.deck, [0, 0.9, 0.5], [0.9, 1.0, 0.5]);
}

function bigTemplate(kind) {
  if (kind === 'lubu') return template(lubuBody, 1.3, (rig) => addFlag(rig, [-1.3, 1.2, 2.5], '呂', '#b8201e', 1.5), { shadow: [1.6, 2.4] });
  if (kind === 'ship') return template(shipBody, 1.05, (rig) => { addFlag(rig, [0.9, 1.8, 2.6], '曹', '#2a4fa8', 1.4); addFlag(rig, [-1.2, -1.4, 1.3], '魏', '#2a4fa8', 1.1); }, { shadow: [2.0, 3.2] });
  if (kind === 'elephant') return template(elephantBody, 1.3, (rig) => addFlag(rig, [0.8, 1.2, 2.3], '蠻', '#8a5a2a', 1.3), { shadow: [1.8, 2.4] });
  return template(strawBoatBody, 1.1, (rig) => addFlag(rig, [0, 1.3, 1.3], '諸葛', '#d8322e', 1.1), { shadow: [1.3, 2.2] });
}

/* ---------------- 投石(原本的隕石):滾過來的大石頭 + 塵土尾巴 ---------------- */
const ROCK = { a: C(0x8a8478), b: C(0x6a665e, 2), c: C(0xa8a292) };
function rockBody(b) {
  part(b, GEO.ico, ROCK.a, [0, 0, 0], [0.8, 0.72, 0.68], [0.3, 0.5, 0.2]);
  part(b, GEO.ico0, ROCK.b, [0.42, 0.3, 0.2], 0.4, [0.8, 0.1, 0.4]);
  part(b, GEO.ico0, ROCK.c, [-0.38, -0.32, 0.15], 0.36, [0.2, 0.9, 0.1]);
}
function rockTemplate() {
  return template(rockBody, 1, (rig) => {
    const tail = part(rig, GEO.cone, flat({ color: 0xd8c8a0, transparent: true, opacity: 0.45, depthWrite: false }), [0, -1.3, -0.1], [0.55, 1.6, 0.3], [0, 0, Math.PI]);
    tail.name = 'flame';
  }, { shadow: [0.8, 0.8] });
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
  bee: template(yellowTurban, 1.32, (rig) => addFlag(rig, [-0.42, 0.25, 0.5], '黃', '#c8a02a', 0.6), { shadow: [0.45, 0.35], upright: true }),
  bfly: template(weiArcher, 1.32, null, { shadow: [0.45, 0.35], upright: true }),
  boss: template(cavalry, 1.22, (rig) => addFlag(rig, [-0.3, 0.5, 1.0], '魏', '#2a4fa8', 0.65), { shadow: [0.5, 0.85], upright: true }),
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
 * clone 共用 geometry / material;要換色(騎兵被打)就換單一 mesh 的 material。
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
/**
 * Q 彈壓扁回饋(Squash & Stretch):te = 觸發後經過的秒數,k = 力道。
 * 往下壓扁再彈回來,體積大致守恆(寬變大、高變小)。
 */
export function squash(root, te, k = 1) {
  if (te < 0 || te > 0.7) { root.scale.set(1, 1, 1); return; }
  const a = Math.exp(-te * 7) * Math.sin(te * 22) * 0.22 * k;
  root.scale.set(1 + a, 1 - a, 1 - a * 1.3);
}
/** 彈性出場(0 → 1,略微超過再回來) */
export function elasticOut(t) {
  if (t <= 0) return 0.001;
  if (t >= 1) return 1;
  return Math.pow(2, -9 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
}
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:錦囊(小布袋 + 金繩結 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: '武力' },
  R: { label: 'R', color: 0x3ad8ff, name: '神速' },
  S: { label: 'S', color: 0x3ae07a, name: '藤甲' },
  B: { label: 'B', color: 0xb86aff, name: '火攻' },
  W: { label: 'W', color: 0x2e8a4a, name: '援軍' },
  L: { label: '1UP', color: 0xffc23a, name: '包子' },
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
  part(body, GEO.ico2, cm, [0, -0.08, 0.2], [0.42, 0.4, 0.3]);                  // 錦囊
  part(body, GEO.cone, cm, [0, 0.42, 0.2], [0.2, 0.26, 0.16]);                  // 束口上的布
  part(body, GEO.torus, M.gold, [0, 0.28, 0.2], [0.18, 0.18, 0.4], [Math.PI / 2, 0, 0]); // 金繩
  for (const x of [-1, 1]) part(body, GEO.cone, M.gold, [x * 0.12, 0.1, 0.45], [0.04, 0.22, 0.03], [0, 0, x * 0.4 + Math.PI]); // 流蘇
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'halo'; root.add(ring);
  const { t, aspect } = labelTex(it.label);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.8 * aspect, 0.8, 1); sp.position.y = -0.05; sp.renderOrder = 5;
  root.add(sp);
  addShadow(root, 0.4, 0.3);
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
/** 玩家:銀白色的槍氣(細長 + 金色鋒頭) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico, [0, -0.08, 0], [0.1, 0.46, 0.1]), SHOT_MAT],
    [geoAt(GEO.cone, [0, 0.36, 0.02], [0.08, 0.2, 0.06]), SHOT_TIP],
  ], cap);
}
/** 敵彈:火箭(橘紅色發光的箭身 + 亮黃箭頭),方向跟著速度 */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico, [0, -0.05, 0], [0.15, 0.36, 0.15]), EB_MAT],
    [geoAt(GEO.cone, [0, 0.3, 0.06], [0.09, 0.18, 0.06]), EB_CORE],
  ], cap);
}
