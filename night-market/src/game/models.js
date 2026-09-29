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
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家 —— 像立體書裡立起來的紙板人偶。
 * 人物模型「不跟著前進方向旋轉」(userData.upright),只依速度左右微傾,臉才不會倒過來。
 * 小吃也一樣:在自己的座標系裡「站著」(臉朝 +z),再整個往後仰 LEAN。
 *
 * 每個角色腳下有一塊地面陰影('shadow',貼在地面 z = -GROUND_Z),讓人一看就知道在地上。
 * 內部型別沿用原本的名字:bee = 臭豆腐、bfly = 雞排、boss = 刈包(打兩下)、rock = 貢丸串。
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
  plane: new THREE.PlaneGeometry(1, 1),
};

const C = (color, bands = 3) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair, 2), eye: flat({ color: 0x2a2226 }), cheek: flat({ color: 0xff9a8a }),
  white: C(0xfaf6ee), red: C(0xe8322e), gold: C(0xffc23a), wood: C(0xc8a068, 2), dark: C(0x2a2a30, 2),
  paper: C(0xf4ecdc), paperRed: C(0xd8322e, 2), mouth: C(0x8a2a2a, 2), tongue: C(0xff7a8a, 2),
  // 珍奶
  tea: C(0xd8b088), pearl: C(0x3a2418, 2), lid: C(0xf4f4f8, 2), straw: C(0xff5a8a, 2), strawG: C(0x5ad8a0, 2),
  // 臭豆腐
  tofu: C(PAL.beeBody), tofuDark: C(PAL.beeBand, 2), kimchi: C(PAL.beeWing, 2), kimchiR: C(0xf08a4a, 2), stink: flat({ color: 0x9ae06a }),
  // 雞排
  cutlet: C(PAL.bflyBody), cutletDark: C(PAL.bflyWing, 2), bag: C(PAL.bflyHead, 2),
  // 刈包
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead, 2), bossInner: C(PAL.bossInner, 2),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead, 2), bossHitInner: C(0xc8904a, 2),
  cilantro: C(PAL.bossWing, 2),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 刈包被打第一下之後換色用的對照表(包子皮氣到發紅、滷肉燒焦) */
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

/* ---------------- 字的貼圖(旗子 / 招牌):canvas 畫字 ---------------- */
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


/** 小吃的「臉」:兩個大眼睛(白底黑眼珠)+ 嘴,z = 表面的位置 */
function face(g, y, z, s = 1, angry = false) {
  for (const x of [-1, 1]) {
    part(g, GEO.ico2, M.white, [x * 0.1 * s, y, z], [0.065 * s, 0.075 * s, 0.03]);
    part(g, GEO.ico, M.eye, [x * 0.1 * s, y - 0.005, z + 0.025], 0.035 * s);
    if (angry) part(g, GEO.box, M.dark, [x * 0.1 * s, y + 0.085 * s, z + 0.01], [0.1 * s, 0.025 * s, 0.02], [0, 0, x * 0.4]);
  }
  part(g, GEO.box, M.mouth, [0, y - 0.11 * s, z], [0.12 * s, 0.04 * s, 0.02]);
}
/** 小吃站在自己的座標系裡,最後整個往後仰 LEAN(跟人偶一樣) */
function standing(b, fn, at = [0, 0, 0.2], s = 1) {
  const g = new THREE.Group(); fn(g);
  g.rotation.x = LEAN; g.position.set(...at); g.scale.setScalar(s);
  b.add(g);
  return g;
}

/* ---------------- 臭豆腐(bee):炸得金黃的方塊 + 上面一坨泡菜 + 綠色臭氣,一跳一跳 ---------------- */
function tofu(b) {
  standing(b, (g) => {
    part(g, GEO.box, M.tofu, [0, -0.2, 0], [0.52, 0.5, 0.44]);
    for (const [x, y] of [[-0.18, -0.05], [0.16, -0.36], [0.2, 0.0], [-0.12, -0.38]]) part(g, GEO.ico, M.tofuDark, [x, y, 0.22], [0.05, 0.04, 0.02]); // 炸出來的小洞
    for (let i = 0; i < 6; i++) part(g, GEO.ico, i % 2 ? M.kimchi : M.kimchiR, [(i % 3 - 1) * 0.12, 0.1 + Math.floor(i / 3) * 0.06, -0.02 + (i % 2) * 0.06], [0.1, 0.05, 0.08]); // 泡菜
    for (const x of [-0.14, 0.02, 0.16]) part(g, GEO.cone, M.stink, [x, 0.32 + Math.abs(x) * 0.3, -0.05], [0.03, 0.14, 0.02], [0, 0, x * 2]); // 臭氣
    face(g, -0.16, 0.23, 1, false);
    part(g, GEO.box, M.tongue, [0, -0.3, 0.23], [0.06, 0.05, 0.02]);
    for (const x of [-1, 1]) part(g, GEO.ico, M.tofuDark, [x * 0.14, -0.5, 0.05], [0.07, 0.05, 0.08]);        // 小腳
  });
}

/* ---------------- 雞排(bfly):比臉還大的雞排插在紙袋裡,飛來飛去 ---------------- */
function cutlet(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.cutlet, [0, 0.08, 0], [0.5, 0.6, 0.11]);
    for (let i = 0; i < 9; i++) {                                                                       // 酥酥的表皮
      const a = i * 2.4, r = 0.12 + (i % 3) * 0.12;
      part(g, GEO.ico, M.cutletDark, [Math.cos(a) * r, 0.1 + Math.sin(a) * r * 1.2, 0.1], [0.05, 0.04, 0.02]);
    }
    part(g, GEO.box, M.bag, [0, -0.42, 0.02], [0.52, 0.34, 0.16]);                                     // 紙袋
    part(g, GEO.box, M.paperRed, [0, -0.4, 0.105], [0.3, 0.1, 0.01]);
    face(g, 0.12, 0.12, 1.1, true);
  }, [0, 0, 0.35]);
}

/* ---------------- 刈包(boss):白包子皮夾滷肉 + 香菜 + 花生粉,嘴巴一開一合,打兩下 ---------------- */
function guabao(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.bossBody, [0, -0.28, 0], [0.5, 0.2, 0.32]);                                    // 下片包子皮
    part(g, GEO.box, M.bossHead, [0, -0.08, 0.04], [0.8, 0.14, 0.34]);                                 // 滷肉
    for (let i = -2; i <= 2; i++) part(g, GEO.ico, M.cilantro, [i * 0.15, 0.0, 0.18], [0.06, 0.04, 0.04]); // 香菜
    part(g, GEO.box, M.bossInner, [0, -0.03, 0.12], [0.7, 0.05, 0.22]);                                // 花生粉
    part(g, GEO.ico2, M.bossBody, [0, 0.18, -0.04], [0.52, 0.28, 0.34]);                               // 上片包子皮
    face(g, 0.2, 0.3, 1.3, true);
    for (const x of [-1, 1]) {
      part(g, GEO.ico, M.bossBody, [x * 0.56, -0.12, 0.05], [0.08, 0.07, 0.07]);                         // 小手
      part(g, GEO.ico, M.bossBody, [x * 0.2, -0.52, 0.05], [0.08, 0.06, 0.08]);                          // 小腳
    }
  }, [0, 0, 0.25], 1.1);
}

/* ---------------- 玩家:小吃貨(10 段) ----------------
 * 殺敵累積經驗 → 小吃貨 … 夜市之王。一開始右手就拿一杯珍奶(子彈 = 珍珠),每一段加零件:
 *   Lv2 毛巾頭巾、Lv3 圍裙、Lv4 鍋鏟、Lv5 廚師帽、Lv6 左手也一杯、Lv7 米其林星星、
 *   Lv8 金色杯子、Lv9 金項鍊、Lv10 皇冠 + 光圈。
 * 'ally' = 外送員(安全帽、外套、四方形保溫箱)。 */
export const SHIP_LV = [
  { name: '小吃貨', body: 0xff5a4a, accent: 0xffd24a, pod: 0x3a8ad8, flame: 0xfff0d0, span: 1.0 },
  { name: '攤販學徒', body: 0xff7a2a, accent: 0xffd24a, pod: 0x3a8ad8, flame: 0xfff0d0, span: 1.02 },
  { name: '小老闆', body: 0xffb02a, accent: 0xffd24a, pod: 0x3a6ab8, flame: 0xfff0d0, span: 1.04 },
  { name: '鐵板燒手', body: 0x3ab86a, accent: 0xffd24a, pod: 0x2a4a8a, flame: 0xfff0d0, span: 1.06 },
  { name: '大廚', body: 0x2a9ad8, accent: 0xffffff, pod: 0x2a3a6a, flame: 0xfff0d0, span: 1.08 },
  { name: '夜市達人', body: 0x8a5ad8, accent: 0xffd24a, pod: 0x2a2a4a, flame: 0xfff0d0, span: 1.1 },
  { name: '米其林', body: 0xd83a8a, accent: 0xffd24a, pod: 0x2a2a3a, flame: 0xffe8a0, span: 1.12 },
  { name: '美食評審', body: 0x2a2a3a, accent: 0xffd24a, pod: 0x2a2a3a, flame: 0xffe8a0, span: 1.14 },
  { name: '夜市傳奇', body: 0x2a2a3a, accent: 0xffe07a, pod: 0xb8202a, flame: 0xffe070, span: 1.16 },
  { name: '夜市之王', body: 0xb8202a, accent: 0xffffff, pod: 0xffc23a, flame: 0xffe070, span: 1.2 },
];

/** 一杯珍奶:杯身(看得到底部的珍珠)+ 杯蓋 + 斜插的吸管 */
function bubbleTea(g, at, s = 1, gold = false) {
  const t = new THREE.Group(); t.position.set(...at); t.scale.setScalar(s); g.add(t);
  part(t, GEO.cyl, gold ? M.gold : M.tea, [0, 0, 0], [0.11, 0.26, 0.11]);
  for (let i = 0; i < 5; i++) part(t, GEO.ico, M.pearl, [(i - 2) * 0.04, -0.09 + (i % 2) * 0.03, 0.08], 0.03);
  part(t, GEO.cyl, M.lid, [0, 0.14, 0], [0.12, 0.03, 0.12]);
  part(t, GEO.cyl, (gold ? M.red : M.straw), [0.03, 0.26, 0], [0.018, 0.26, 0.018], [0, 0, -0.25]);
  return t;
}

function kidBody(m, L, ally) {
  return (b) => {
    if (ally) {
      // 外送員:橘色安全帽 + 外套 + 背後大大的四方形保溫箱
      chibi(b, [0, 0, 0.3], 1.25, {
        body: C(0xff8a2a), pants: C(0x2a3a5a), face: M.skin, head: C(0xff8a2a), big: 1.25,
        extra(g, hg) {
          part(hg, GEO.box, M.dark, [0, 0.05, 0.3], [0.34, 0.08, 0.03]);                                // 護目鏡
          part(hg, GEO.box, M.white, [0, 0.2, 0.2], [0.2, 0.04, 0.06]);
          part(g, GEO.box, C(0xff8a2a), [0, -0.05, -0.32], [0.62, 0.62, 0.42]);                           // 保溫箱
          part(g, GEO.box, M.white, [0, -0.05, -0.1], [0.4, 0.4, 0.02]);
          part(g, GEO.box, M.dark, [0, -0.3, 0.2], [0.36, 0.04, 0.02]);
        },
      });
      return;
    }
    chibi(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: m.blue, face: M.skin, head: M.hair, big: 1.3,
      extra(g, hg) {
        for (let i = 0; i < 3; i++) part(hg, GEO.cone, M.hair, [(i - 1) * 0.12, 0.3, 0.05], [0.05, 0.12, 0.05], [0, 0, (1 - i) * 0.4]); // 翹翹的頭髮
        if (L >= 2 && L < 5) part(hg, GEO.torus, M.white, [0, 0.16, 0], [0.31, 0.3, 0.2], [Math.PI / 2 - 0.3, 0, 0]); // 毛巾頭巾
        if (L >= 5) {                                                                                     // 廚師帽
          part(hg, GEO.cyl, L >= 8 ? M.gold : M.white, [0, 0.32, -0.04], [0.22, 0.2, 0.2], [-0.2, 0, 0]);
          part(hg, GEO.ico2, L >= 8 ? M.gold : M.white, [0, 0.5, -0.08], [0.28, 0.16, 0.24]);
          if (L >= 10) for (let i = -2; i <= 2; i++) part(hg, GEO.cone, M.gold, [i * 0.1, 0.66 - Math.abs(i) * 0.03, -0.08], [0.035, 0.12, 0.03], [0, 0, -i * 0.25]); // 皇冠
        }
        part(hg, GEO.box, M.mouth, [0, -0.13, 0.28], [0.1, 0.04, 0.02]);                                   // 開心的嘴
        if (L >= 3) {                                                                                     // 圍裙
          part(g, GEO.box, M.white, [0, -0.32, 0.21], [0.34, 0.4, 0.02]);
          part(g, GEO.box, m.red, [0, -0.3, 0.225], [0.2, 0.06, 0.01]);
        }
        if (L >= 7) part(g, GEO.ico, M.gold, [0.1, -0.12, 0.24], [0.06, 0.06, 0.02]);                      // 米其林星星
        if (L >= 9) for (let i = 0; i < 7; i++) part(g, GEO.ico, M.gold, [(i - 3) * 0.06, -0.02 - Math.abs(i - 3) * 0.03, 0.24], 0.025); // 金項鍊
        bubbleTea(g, [0.4, -0.2, 0.15], 1.1, L >= 8);                                                     // 右手的珍奶
        if (L >= 6) bubbleTea(g, [-0.4, -0.2, 0.15], 1.1, L >= 8);                                        // 左手也一杯
        else if (L >= 4) {                                                                                // 鍋鏟
          rod(g, M.wood, [-0.38, -0.4], [-0.38, 0.1], 0.02, 0.1);
          part(g, GEO.box, C(0xb8c0cc, 2), [-0.38, 0.2, 0.1], [0.16, 0.2, 0.02]);
        }
      },
    });
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
const HALO_GEO = new THREE.TorusGeometry(0.9, 0.05, 6, 36);
function shipTemplate(m, L = 1, ally = false) {
  return template(kidBody(m, L, ally), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下揚起的蒸氣 / 香味(每幀閃爍)
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], ally ? 0xffe0b0 : m.flame || 0xfff0d0, [0.1, 0.35, 0.08], 0.45);
    if (ally) { addFlag(rig, [-0.45, 0.45, 0.8], '送', '#ff8a2a', 0.7); return; }
    addFlag(rig, [-0.5, 0.45, 0.8], L >= 10 ? '王' : L >= 7 ? '讚' : '吃', '#d8322e', 0.7);
    if (L >= 10) {
      const h = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.name = 'halo'; h.position.set(0, 0.35, 0.1); rig.add(h);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xffe07a : 0xff9ad0, transparent: true, opacity: L >= 10 ? 0.14 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
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

/* ---------------- 關底招牌料理(面朝玩家) ---------------- */
const BM = {
  rice: C(0xf4ecd8), riceDark: C(0xd8ccb0, 2), sausage: C(0xd84a4a), sausageDark: C(0xa82a2a, 2),
  garlic: C(0xfaf6e8, 2), cucumber: C(0x5ab84a, 2), sauce: C(0x7a3a1e, 2),
  plate: C(0xf4f4f8), omelette: C(0xf2c060), omeletteDark: C(0xd89a3a, 2), orangeSauce: C(0xf07a4a), oyster: C(0x9aa0b0, 2), greens: C(0x4aa84a, 2),
  pot: C(0x3a3a44), potRim: C(0xb8b8c4, 2), soup: C(0xd8322a), tofuW: C(0xf8f4e8), meat: C(0xe89a9a, 2), chili: C(0xff3a2a, 2), stem: C(0x4ab83a, 2),
  candy: C(0xffb0d8), candy2: C(0xffd8ec), stick: C(0xf4e8d0, 2),
};

/** 大腸包小腸:白白的糯米腸剖開,夾一條紅通通的香腸 + 蒜片 + 小黃瓜 + 醬汁 */
function sausageBody(b) {
  standing(b, (g) => {
    for (const x of [-1, 1]) part(g, GEO.ico2, BM.rice, [x * 0.55, 0, 0], [0.55, 2.3, 0.6]);            // 糯米腸(左右兩半)
    part(g, GEO.ico2, BM.sausage, [0, 0.05, 0.35], [0.5, 2.2, 0.45]);                                   // 香腸
    for (let i = 0; i < 5; i++) part(g, GEO.box, BM.sausageDark, [0, -1.2 + i * 0.6, 0.78], [0.5, 0.04, 0.03], [0, 0, 0.5]); // 烤痕
    for (let i = 0; i < 4; i++) part(g, GEO.cyl, BM.garlic, [(i % 2 ? 0.2 : -0.22), -0.9 + i * 0.55, 0.82], [0.1, 0.02, 0.08], [Math.PI / 2, 0, 0]); // 蒜片
    for (let i = 0; i < 3; i++) part(g, GEO.box, BM.cucumber, [0.02, -0.6 + i * 0.7, 0.85], [0.22, 0.08, 0.04], [0, 0, 0.3]);
    for (let i = 0; i < 6; i++) part(g, GEO.box, BM.sauce, [(i % 2 ? 0.15 : -0.15), -1.5 + i * 0.55, 0.84], [0.35, 0.05, 0.02], [0, 0, i % 2 ? 0.7 : -0.7]); // 醬汁
    face(g, 1.25, 0.82, 3, true);
    for (const x of [-1, 1]) part(g, GEO.ico, BM.rice, [x * 1.25, 0.1, 0.1], [0.22, 0.18, 0.2]);          // 小手
  }, [0, 0, 0.6]);
}
/** 蚵仔煎:白盤子 + 金黃的煎蛋 + 橘紅醬 + 蚵仔 + 青菜,盤子旁邊繞著一圈蚵仔 */
function omeletteBody(b) {
  part(b, GEO.cyl, BM.plate, [0, 0, 0.2], [2.3, 0.2, 2.1], [Math.PI / 2, 0, 0]);
  part(b, GEO.ico2, BM.omelette, [0, 0, 0.45], [1.8, 1.65, 0.3]);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; part(b, GEO.ico, BM.omeletteDark, [Math.cos(a) * 1.1, Math.sin(a) * 1.0, 0.68], [0.25, 0.2, 0.05]); }
  part(b, GEO.ico2, BM.orangeSauce, [0.1, -0.2, 0.72], [1.2, 1.0, 0.08]);
  for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, r = 0.35 + (i % 3) * 0.3; part(b, GEO.ico2, BM.oyster, [Math.cos(a) * r, Math.sin(a) * r, 0.82], [0.18, 0.13, 0.08]); }
  for (let i = 0; i < 6; i++) { const a = i * 1.1; part(b, GEO.box, BM.greens, [Math.cos(a) * 1.3, Math.sin(a) * 1.15, 0.72], [0.3, 0.1, 0.05], [0, 0, a]); }
  for (const x of [-1, 1]) {
    part(b, GEO.ico2, M.white, [x * 0.42, 0.55, 0.9], [0.24, 0.26, 0.1]);
    part(b, GEO.ico, M.eye, [x * 0.42, 0.53, 0.98], 0.12);
    part(b, GEO.box, M.dark, [x * 0.42, 0.9, 0.92], [0.34, 0.07, 0.04], [0, 0, x * 0.4]);
  }
  part(b, GEO.box, M.mouth, [0, 0.05, 0.9], [0.5, 0.12, 0.04]);
}
function omeletteExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(spin, GEO.ico2, BM.oyster, [Math.cos(a) * 2.8, Math.sin(a) * 2.6, 0.6], [0.26, 0.2, 0.12]); }
  rig.add(spin);
}
/** 麻辣鍋:大黑鍋(往後仰看得到紅湯)+ 豆腐 / 肉片 / 辣椒 + 蒸氣,鍋外繞著一圈辣椒 */
function hotpotBody(b) {
  standing(b, (g) => {
    part(g, GEO.cyl, BM.pot, [0, 0, 0], [1.9, 1.3, 1.6]);                                               // 鍋身
    part(g, GEO.torus, BM.potRim, [0, 0.66, 0], [1.9, 1.6, 1.4], [Math.PI / 2, 0, 0]);                  // 鍋緣
    part(g, GEO.cyl, BM.soup, [0, 0.6, 0], [1.8, 0.08, 1.5]);                                           // 紅湯
    for (let i = 0; i < 5; i++) part(g, GEO.box, BM.tofuW, [-1.0 + i * 0.5, 0.72, (i % 2 ? 0.4 : -0.3)], [0.3, 0.2, 0.3]);    // 豆腐
    for (let i = 0; i < 4; i++) part(g, GEO.box, BM.meat, [-0.8 + i * 0.55, 0.7, (i % 2 ? -0.7 : 0.8)], [0.45, 0.06, 0.3], [0, i, 0]); // 肉片
    for (let i = 0; i < 6; i++) part(g, GEO.cone, BM.chili, [-1.2 + i * 0.48, 0.72, (i % 2 ? 0.9 : 0.1)], [0.08, 0.3, 0.08], [Math.PI / 2, 0, i]); // 辣椒
    for (const x of [-1, 1]) part(g, GEO.torus, BM.potRim, [x * 2.05, 0.2, 0], [0.3, 0.3, 0.6], [0, Math.PI / 2, 0]); // 把手
    face(g, -0.05, 1.6, 3.2, true);
  }, [0, 0, 0.6]);
}
function chiliRing(rig, n = 10, r = 3.0) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2;
    part(spin, GEO.cone, BM.chili, [Math.cos(a) * r, Math.sin(a) * r * 0.9, 0.8], [0.14, 0.5, 0.12], [0, 0, a]);
    part(spin, GEO.cyl, BM.stem, [Math.cos(a) * (r + 0.3), Math.sin(a) * (r + 0.3) * 0.9, 0.8], [0.04, 0.16, 0.04], [0, 0, a - Math.PI / 2]);
  }
  rig.add(spin);
}
/** 棉花糖(獎勵關):粉紅色一大朵 + 竹籤 + 可愛的臉,旁邊繞著一圈星星糖 */
function candyBody(b) {
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, r = i % 2 ? 1.0 : 0.75;
    part(b, GEO.ico2, i % 3 ? BM.candy : BM.candy2, [Math.cos(a) * r, 0.4 + Math.sin(a) * r * 1.1, 0.3], 0.62);
  }
  part(b, GEO.ico2, BM.candy2, [0, 0.4, 0.6], [1.2, 1.3, 0.6]);
  rod(b, BM.stick, [0, -1.0], [0, -2.4], 0.07, 0.3);
  for (const x of [-1, 1]) {
    part(b, GEO.ico, M.eye, [x * 0.35, 0.55, 1.2], [0.1, 0.12, 0.05]);
    part(b, GEO.ico, M.cheek, [x * 0.6, 0.25, 1.15], [0.14, 0.08, 0.04]);
  }
  part(b, GEO.box, M.mouth, [0, 0.2, 1.2], [0.2, 0.06, 0.03]);
}
function candyExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  const cols = [0xffd24a, 0x5af0ff, 0xff7ad0, 0x9aff6a];
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.ico0, C(cols[i % 4], 2), [Math.cos(a) * 2.0, 0.3 + Math.sin(a) * 2.2, 0.4], 0.22);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'sausage') return template(sausageBody, 1.5, (rig) => addFlag(rig, [-1.6, 1.8, 1.6], '招', '#d8322e', 1.2), { shadow: [1.6, 2.4] });
  if (kind === 'omelette') return template(omeletteBody, 1.45, omeletteExtras, { shadow: [2.4, 2.2] });
  if (kind === 'hotpot') return template(hotpotBody, 1.35, (rig) => chiliRing(rig), { shadow: [2.2, 1.8] });
  return template(candyBody, 1.4, candyExtras, { shadow: [1.2, 1.5] });
}

/* ---------------- 貢丸串(原本的隕石):竹籤串三顆貢丸,沿著長軸轉 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const ball = C(0xb89a7a), sauce = C(0x8a4a2a, 2);
  rod(rig, M.wood, [0, -1.1], [0, 1.0], 0.04, 0);
  for (const y of [-0.55, 0, 0.55]) {
    part(rig, GEO.ico2, ball, [0, y, 0], 0.3);
    part(rig, GEO.box, sauce, [0.1, y + 0.05, 0.24], [0.2, 0.05, 0.05], [0, 0, 0.5]);
  }
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xfff0e0, transparent: true, opacity: 0.35, depthWrite: false }), [0, -1.4, 0], [0.35, 1.2, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';                                                                                    // 熱騰騰的蒸氣尾巴
  addShadow(root, 0.4, 0.5);
  return root;
}

const TEMPLATES = {
  bee: template(tofu, 1.75, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(cutlet, 1.45, null, { shadow: [0.45, 0.35], upright: true }),
  boss: template(guabao, 1.35, null, { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(刈包被打)就換單一 mesh 的 material。
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

/* ---------------- 道具:手搖飲料杯(彩色杯身 + 杯蓋 + 吸管 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: '加料' },
  R: { label: 'R', color: 0x3ad8ff, name: '手速' },
  S: { label: 'S', color: 0x3ae07a, name: '保溫袋' },
  B: { label: 'B', color: 0xb86aff, name: '爆米香' },
  W: { label: 'W', color: 0xff8a2a, name: '外送員' },
  L: { label: '1UP', color: 0xffc23a, name: '雞蛋糕' },
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
  part(body, GEO.cyl, cm, [0, -0.1, 0.2], [0.3, 0.62, 0.22], [0.5, 0, 0]);                              // 杯身
  part(body, GEO.cyl, M.lid, [0, 0.22, 0.36], [0.33, 0.06, 0.24], [0.5, 0, 0]);                         // 杯蓋
  part(body, GEO.cyl, M.straw, [0.06, 0.42, 0.46], [0.035, 0.4, 0.035], [0.5, 0, -0.3]);                 // 吸管
  rig.add(bake(body));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 28), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  ring.name = 'halo'; root.add(ring);
  const { t, aspect } = labelTex(it.label);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false }));
  sp.scale.set(0.8 * aspect, 0.8, 1); sp.position.y = -0.1; sp.renderOrder = 5;
  root.add(sp);
  addShadow(root, 0.4, 0.3);
  return root;
}

/* ---------------- 子彈:InstancedMesh,一整批只要 2 個 draw call ---------------- */
const SHOT_MAT = flat({ color: PAL.shot, transparent: true, depthWrite: false });
const SHOT_TIP = flat({ color: PAL.shotTip, transparent: true, depthWrite: false });
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

/** 玩家:黑糖珍珠(QQ 的圓球 + 一點亮光 + 淡淡的奶茶色外圈,暗色地面上也看得到) */
const PEARL_RING = flat({ color: 0xf0d8b0, transparent: true, opacity: 0.85, depthWrite: false });
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico2, [0, 0, -0.02], [0.26, 0.26, 0.1]), PEARL_RING],
    [geoAt(GEO.ico2, [0, 0, 0], [0.2, 0.2, 0.2]), SHOT_MAT],
    [geoAt(GEO.ico0, [-0.06, 0.07, 0.17], [0.05, 0.05, 0.03]), SHOT_TIP],
  ], cap);
}
/** 敵彈:辣椒(紅色尖頭朝前進方向、綠色蒂在後面) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [mergeGeometries([geoAt(GEO.ico, [0, -0.05, 0], [0.15, 0.22, 0.15]), geoAt(GEO.cone, [0, 0.22, 0], [0.13, 0.3, 0.12])].map((g) => (g.index ? g.toNonIndexed() : g))), EB_MAT],
    [geoAt(GEO.cyl, [0, -0.3, 0.02], [0.05, 0.12, 0.05]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
