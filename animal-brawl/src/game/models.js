import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 所有角色都用基本幾何體拼出來(沒有模型檔),Q 版大頭比例、黏土的圓潤感。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:動物在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。動物模型「不跟著前進方向旋轉」(userData.upright)。
 *
 * 每個角色腳下有一塊地面陰影('shadow',貼在地面 z = -GROUND_Z),讓人一看就知道在地上。
 * 內部型別沿用原本的名字:bee = 兔子、bfly = 鸚鵡、boss = 野豬(打兩下)、rock = 刺蝟球。
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
  curl: new THREE.TorusGeometry(1, 0.32, 6, 14, Math.PI * 1.4),
  disc: new THREE.CircleGeometry(1, 22),
};

const C = (color, bands = 3) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair), eye: flat({ color: 0x2a2226 }), cheek: flat({ color: 0xff9a8a }),
  white: C(0xfaf6ee), red: C(0xe8322e), gold: C(0xffc23a), wood: C(0x8a6040, 2), dark: C(0x2a2a30, 2),
  pink: C(0xffa0b0, 2), nose: C(0x2a2226, 2), bone: C(0xfaf6ea, 2), lens: flat({ color: 0x6af0ff }), shades: C(0x1a1a22, 2),
  shiba: C(0xe89a48), cream: C(0xfff4e4), black: C(0x3a3440),
  carrot: C(0xff8a2a, 2), leaf: C(0x5ab84a, 2),
  // 兔子
  beeBody: C(PAL.beeBody),
  // 鸚鵡
  parrot: C(PAL.bflyBody), parrotY: C(PAL.bflyHead), parrotB: C(PAL.bflyWing), parrotG: C(PAL.bflyRim), beak: C(0xf4e8d0, 2),
  // 野豬
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner, 2),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0xff6a6a, 2),
  tusk: C(PAL.bossWing, 2),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 野豬被打第一下之後換色用的對照表(氣到全身發紅) */
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
/** 大眼睛(白底黑眼珠 + 一點亮光),angry = 加上倒八字眉 */
function eyes(g, y, z, s = 1, gap = 0.1, angry = false) {
  for (const x of [-1, 1]) {
    part(g, GEO.ico2, M.white, [x * gap * s, y, z], [0.06 * s, 0.07 * s, 0.03 * s]);
    part(g, GEO.ico, M.eye, [x * gap * s, y - 0.005 * s, z + 0.025 * s], 0.035 * s);
    if (angry) part(g, GEO.box, M.dark, [x * gap * s, y + 0.085 * s, z + 0.01 * s], [0.1 * s, 0.025 * s, 0.02 * s], [0, 0, x * 0.45]);
  }
}
/** 一根骨頭(兩端各兩顆圓頭) */
function bone(g, at, s = 1, rz = 0) {
  const t = new THREE.Group(); t.position.set(...at); t.scale.setScalar(s); t.rotation.z = rz; g.add(t);
  part(t, GEO.box, M.bone, [0, 0, 0], [0.06, 0.3, 0.05]);
  for (const y of [-1, 1]) for (const x of [-1, 1]) part(t, GEO.ico, M.bone, [x * 0.04, y * 0.16, 0], 0.045);
}

/* ---------------- 兔子(bee):白兔、長耳朵(粉紅內耳)、大門牙、抱著紅蘿蔔,一蹦一蹦 ---------------- */
function rabbit(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.beeBody, face: M.beeBody, head: M.beeBody, boots: M.pink,
    extra(g, hg) {
      for (const x of [-1, 1]) {
        part(hg, GEO.ico2, M.beeBody, [x * 0.1, 0.44, -0.02], [0.07, 0.24, 0.05], [0, 0, -x * 0.15]);   // 長耳朵
        part(hg, GEO.ico2, M.pink, [x * 0.1, 0.44, 0.02], [0.035, 0.18, 0.02], [0, 0, -x * 0.15]);
      }
      part(hg, GEO.ico, M.pink, [0, -0.06, 0.3], [0.04, 0.03, 0.02]);                                   // 鼻子
      part(hg, GEO.box, M.white, [0, -0.13, 0.29], [0.07, 0.07, 0.02]);                                 // 門牙
      part(g, GEO.cone, M.carrot, [0.3, -0.3, 0.15], [0.06, 0.26, 0.06], [0, 0, 2.6]);                  // 紅蘿蔔
      for (const a of [-0.3, 0, 0.3]) part(g, GEO.cone, M.leaf, [0.38 + a * 0.1, -0.16, 0.15], [0.025, 0.12, 0.02], [0, 0, -0.5 + a]);
      part(g, GEO.ico, M.beeBody, [0, -0.5, -0.2], 0.09);                                               // 圓尾巴
    },
  });
}

/* ---------------- 鸚鵡(bfly):紅身體、黃藍翅膀(每幀拍動)、彎彎的嘴、長尾羽,飛在半空 ---------------- */
function parrot(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.parrot, [0, -0.1, 0], [0.26, 0.32, 0.22]);
    part(g, GEO.ico2, M.parrot, [0, 0.28, 0.04], 0.22);                                                   // 頭
    part(g, GEO.ico2, M.white, [0, 0.28, 0.12], [0.14, 0.1, 0.12]);                                       // 白臉
    eyes(g, 0.31, 0.21, 0.9, 0.09, true);
    part(g, GEO.cone, M.beak, [0, 0.16, 0.24], [0.07, 0.16, 0.07], [Math.PI * 0.85, 0, 0]);             // 彎嘴
    part(g, GEO.ico, M.dark, [0, 0.12, 0.27], [0.04, 0.05, 0.04]);
    for (const [x, m] of [[-0.06, M.parrotB], [0, M.parrot], [0.06, M.parrotY]]) part(g, GEO.cone, m, [x, -0.55, -0.05], [0.05, 0.36, 0.03], [0, 0, Math.PI + x * 2]); // 尾羽
    part(g, GEO.ico, M.parrotY, [0, -0.18, 0.18], [0.14, 0.12, 0.05]);                                    // 黃肚子
    for (const x of [-1, 1]) part(g, GEO.cone, M.dark, [x * 0.08, -0.42, 0.06], [0.03, 0.08, 0.03], [0, 0, Math.PI]); // 爪
  }, [0, 0, 0.35]);
}
/** 鸚鵡的翅膀:不烤,放在 'flag' 群組(每幀拍動) */
function parrotWings(rig) {
  const w = new THREE.Group(); w.rotation.x = LEAN; w.position.z = 0.35; rig.add(w);
  for (const x of [-1, 1]) {
    const f = new THREE.Group(); f.name = 'flag'; f.position.set(x * 0.2, -0.05, 0); f.userData.amp = 0.9; f.userData.freq = 2.2; f.userData.side = x; w.add(f);
    part(f, GEO.ico2, M.parrotB, [x * 0.24, 0.02, 0], [0.26, 0.14, 0.05], [0, 0, x * 0.25]);
    part(f, GEO.ico2, M.parrotY, [x * 0.16, 0.06, 0.02], [0.14, 0.1, 0.04], [0, 0, x * 0.25]);
    part(f, GEO.ico2, M.parrotG, [x * 0.42, -0.03, -0.01], [0.12, 0.08, 0.03], [0, 0, x * 0.25]);
  }
}

/* ---------------- 野豬(boss):咖啡色、粉紅大鼻子、往上翹的獠牙、背上一排鬃毛,打兩下 ---------------- */
function boar(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.bossBody, [0, -0.2, 0], [0.42, 0.38, 0.34]);
    part(g, GEO.ico2, M.bossHead, [0, 0.22, 0.06], [0.32, 0.28, 0.28]);                                 // 頭
    part(g, GEO.cyl, M.bossInner, [0, 0.14, 0.32], [0.14, 0.08, 0.1], [Math.PI / 2, 0, 0]);             // 大鼻子
    for (const x of [-1, 1]) {
      part(g, GEO.ico, M.dark, [x * 0.05, 0.14, 0.37], 0.025);                                             // 鼻孔
      part(g, GEO.cone, M.tusk, [x * 0.16, 0.12, 0.28], [0.03, 0.14, 0.03], [0, 0, -x * 0.5]);            // 獠牙
      part(g, GEO.cone, M.bossHead, [x * 0.2, 0.45, 0.0], [0.07, 0.12, 0.05], [0, 0, -x * 0.5]);          // 耳朵
      part(g, GEO.ico, M.bossHead, [x * 0.2, -0.56, 0.06], [0.08, 0.06, 0.08]);                           // 腳
    }
    eyes(g, 0.3, 0.3, 0.9, 0.11, true);
    for (let i = 0; i < 5; i++) part(g, GEO.cone, M.dark, [0, 0.42 - i * 0.14, -0.12 - i * 0.05], [0.05, 0.14, 0.04], [-0.6, 0, 0]); // 鬃毛
    part(g, GEO.ico, M.bossHead, [0, -0.5, -0.26], [0.05, 0.08, 0.05]);                                   // 小尾巴
  }, [0, 0, 0.25], 1.15);
}

/* ---------------- 玩家:小柴犬(10 段) ----------------
 * 殺敵累積經驗 → 小柴 … 傳說神柴。一開始就是橘白配色 + 麻呂眉 + 捲尾巴,每一段加零件:
 *   Lv2 紅領巾、Lv3 叼著骨頭、Lv4 飛行護目鏡、Lv5 英雄披風、Lv6 肩甲、Lv7 墨鏡、
 *   Lv8 火箭鞋(腳下噴火)、Lv9 皇冠、Lv10 光圈 + 光暈。
 * 'ally' = 三花貓(白底 + 橘 / 黑斑、長尾巴)。 */
export const SHIP_LV = [
  { name: '小柴', body: 0xe8322e, accent: 0xffd24a, pod: 0x3a8ad8, flame: 0xfff0d0, span: 1.0 },
  { name: '柴柴', body: 0xe8322e, accent: 0xffd24a, pod: 0x3a8ad8, flame: 0xfff0d0, span: 1.02 },
  { name: '勇敢柴', body: 0xe8322e, accent: 0xffd24a, pod: 0x3a8ad8, flame: 0xfff0d0, span: 1.04 },
  { name: '探險柴', body: 0x2a8ad8, accent: 0xffd24a, pod: 0x3a8ad8, flame: 0xfff0d0, span: 1.06 },
  { name: '超級柴', body: 0xd8282a, accent: 0xffd24a, pod: 0x3a6ab8, flame: 0xfff0d0, span: 1.08 },
  { name: '鋼鐵柴', body: 0xd8282a, accent: 0xffd24a, pod: 0xb8c0d0, flame: 0xfff0d0, span: 1.1 },
  { name: '酷炫柴', body: 0x8a3ad8, accent: 0xffd24a, pod: 0xb8c0d0, flame: 0xffe8a0, span: 1.12 },
  { name: '火箭柴', body: 0x8a3ad8, accent: 0xffd24a, pod: 0xffc23a, flame: 0xff8a2a, span: 1.14 },
  { name: '柴犬國王', body: 0xb8202a, accent: 0xffe07a, pod: 0xffc23a, flame: 0xff9a2a, span: 1.16 },
  { name: '傳說神柴', body: 0xb8202a, accent: 0xffffff, pod: 0xfff2c0, flame: 0xffd24a, span: 1.2 },
];

function shibaBody(m, L, ally) {
  return (b) => {
    if (ally) {
      // 三花貓:白身體 + 橘 / 黑的斑、尖耳朵、鬍鬚、長尾巴
      chibi(b, [0, 0, 0.3], 1.25, {
        body: M.white, pants: M.white, face: M.white, head: M.white, boots: M.white, big: 1.25,
        extra(g, hg) {
          for (const x of [-1, 1]) {
            part(hg, GEO.cone, x < 0 ? M.shiba : M.black, [x * 0.19, 0.36, -0.02], [0.13, 0.22, 0.08], [0, 0, -x * 0.38]); // 尖耳朵
            part(hg, GEO.cone, M.pink, [x * 0.19, 0.34, 0.04], [0.06, 0.12, 0.02], [0, 0, -x * 0.38]);
            for (const k of [-1, 1]) part(hg, GEO.box, M.dark, [x * 0.24, -0.08 + k * 0.03, 0.26], [0.16, 0.012, 0.01], [0, 0, x * k * 0.15]); // 鬍鬚
          }
          part(hg, GEO.ico2, M.black, [0.15, 0.16, 0.16], [0.15, 0.12, 0.12]);                             // 黑斑
          part(hg, GEO.ico2, M.shiba, [-0.16, 0.18, 0.12], [0.16, 0.13, 0.14]);                           // 橘斑
          part(hg, GEO.ico, M.pink, [0, -0.06, 0.3], [0.035, 0.025, 0.02]);
          part(g, GEO.ico, M.shiba, [-0.1, -0.15, 0.2], [0.1, 0.08, 0.03]);                                 // 身上的橘斑
          part(g, GEO.ico, M.black, [0.12, -0.35, 0.18], [0.08, 0.07, 0.03]);
          part(g, GEO.halfRing, M.white, [0.3, -0.4, -0.15], [0.25, 0.3, 0.4], [0, 0, -0.6]);             // 長尾巴
          part(g, GEO.ico, M.black, [0.52, -0.2, -0.15], 0.06);
          part(g, GEO.ico, M.gold, [0, -0.03, 0.24], 0.05);                                                 // 鈴鐺
        },
      });
      return;
    }
    chibi(b, [0, 0, 0.3], 1.25, {
      body: M.shiba, pants: M.cream, face: M.shiba, head: M.shiba, boots: M.cream, big: 1.3,
      extra(g, hg) {
        for (const x of [-1, 1]) {
          part(hg, GEO.cone, M.shiba, [x * 0.19, 0.36, -0.02], [0.13, 0.24, 0.08], [0, 0, -x * 0.38]);    // 大立耳
          part(hg, GEO.cone, M.pink, [x * 0.19, 0.34, 0.04], [0.065, 0.14, 0.02], [0, 0, -x * 0.38]);
          part(hg, GEO.ico, M.cream, [x * 0.1, 0.11, 0.285], [0.04, 0.028, 0.02]);                        // 麻呂眉
          part(hg, GEO.ico2, M.cream, [x * 0.13, -0.11, 0.2], [0.12, 0.1, 0.1]);                          // 白臉頰
        }
        part(hg, GEO.ico2, M.cream, [0, -0.13, 0.25], [0.15, 0.11, 0.1]);                                 // 白嘴筒
        part(hg, GEO.ico, M.nose, [0, -0.07, 0.35], [0.055, 0.04, 0.035]);                                 // 黑鼻子
        part(hg, GEO.box, M.pink, [0, -0.17, 0.32], [0.05, 0.04, 0.02]);                                   // 小舌頭
        part(g, GEO.ico, M.cream, [0, -0.22, 0.18], [0.16, 0.18, 0.05]);                                   // 白肚子
        part(g, GEO.curl, M.shiba, [0, -0.38, -0.22], [0.12, 0.12, 0.12], [0, 0, 0.6]);                   // 捲尾巴
        if (L >= 2) {                                                                                      // 紅領巾
          part(g, GEO.cyl, m.red, [0, 0.02, 0.02], [0.24, 0.06, 0.2]);
          part(g, GEO.cone, m.red, [0.06, -0.08, 0.2], [0.09, 0.14, 0.03], [0, 0, Math.PI - 0.3]);
        }
        if (L >= 3) bone(g, [0.33, -0.28, 0.16], 1.1, 0.4);                                                // 手上的骨頭
        if (L >= 4) {                                                                                      // 護目鏡(戴在額頭)
          part(hg, GEO.cyl, M.dark, [0, 0.16, 0.02], [0.31, 0.04, 0.28]);
          for (const x of [-1, 1]) part(hg, GEO.cyl, M.lens, [x * 0.09, 0.19, 0.27], [0.06, 0.04, 0.06], [Math.PI / 2, 0, 0]);
        }
        if (L >= 5) part(g, GEO.box, m.red, [0, -0.25, -0.2], [0.55, 0.62, 0.03], [0.2, 0, 0]);          // 披風
        if (L >= 6) for (const x of [-1, 1]) part(g, GEO.ico, m.blue, [x * 0.29, -0.08, 0.05], [0.12, 0.1, 0.1]); // 肩甲
        if (L >= 7) {                                                                                      // 墨鏡
          part(hg, GEO.box, M.shades, [0, 0.0, 0.3], [0.32, 0.07, 0.03]);
          for (const x of [-1, 1]) part(hg, GEO.ico, M.shades, [x * 0.1, -0.01, 0.31], [0.08, 0.06, 0.02]);
        }
        if (L >= 9) for (let i = -2; i <= 2; i++) part(hg, GEO.cone, M.gold, [i * 0.08, 0.38 - Math.abs(i) * 0.03, 0.02], [0.035, 0.13, 0.03], [0, 0, -i * 0.25]); // 皇冠
      },
    });
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
const HALO_GEO = new THREE.TorusGeometry(0.9, 0.05, 6, 36);
function shipTemplate(m, L = 1, ally = false) {
  return template(shibaBody(m, L, ally), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下揚起的塵土;Lv8 起是火箭鞋的火
    const rocket = L >= 8 && !ally;
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], rocket ? m.flame : 0xf4e8d0, rocket ? [0.1, 0.45, 0.08] : [0.1, 0.3, 0.08], rocket ? 0.85 : 0.4);
    if (ally) { addFlag(rig, [-0.45, 0.45, 0.8], '喵', '#ff8a2a', 0.7); return; }
    addFlag(rig, [-0.5, 0.45, 0.8], L >= 9 ? '王' : '汪', '#d8322e', 0.7);
    if (L >= 10) {
      const h = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.name = 'halo'; h.position.set(0, 0.35, 0.1); rig.add(h);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xffe07a : 0xffb06a, transparent: true, opacity: L >= 10 ? 0.14 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
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

/* ---------------- 關底猛獸(面朝玩家) ---------------- */
const BM = {
  lion: C(0xe8b05a), lionMane: C(0xb8602a), lionMane2: C(0xd8802a), lionCream: C(0xfff0d0),
  croc: C(0x4a9a3a), crocDark: C(0x2e6a2a, 2), crocBelly: C(0xd8e0a0), teeth: C(0xfaf6ee, 2), mouth: C(0xd8505a, 2),
  gorilla: C(0x3a3a44), gorillaFace: C(0x8a7a6a), gorillaChest: C(0x6a6a78), banana: C(0xffd24a, 2),
  hamster: C(0xf8d078), hamsterW: C(0xfff4e0), seed: C(0x3a3440, 2),
};

/** 獅子王:一大圈鬃毛 + 金冠 + 大臉,身體在下面 */
function lionBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.lion, [0, -1.0, -0.2], [1.1, 1.0, 0.85]);                                        // 身體
    for (const x of [-1, 1]) part(g, GEO.ico2, BM.lion, [x * 0.75, -1.75, 0.25], [0.35, 0.25, 0.35]);     // 前爪
    for (let i = 0; i < 16; i++) {                                                                          // 鬃毛
      const a = i / 16 * Math.PI * 2;
      part(g, GEO.ico2, i % 2 ? BM.lionMane : BM.lionMane2, [Math.cos(a) * 1.05, 0.45 + Math.sin(a) * 1.0, -0.15], 0.45);
    }
    part(g, GEO.ico2, BM.lion, [0, 0.45, 0.2], [0.9, 0.85, 0.7]);                                           // 臉
    part(g, GEO.ico2, BM.lionCream, [0, 0.1, 0.72], [0.45, 0.32, 0.25]);                                    // 嘴筒
    part(g, GEO.ico, M.nose, [0, 0.3, 0.92], [0.14, 0.09, 0.07]);
    part(g, GEO.box, M.dark, [0, 0.0, 0.92], [0.3, 0.04, 0.03]);
    for (const x of [-1, 1]) part(g, GEO.ico2, BM.lion, [x * 0.7, 1.15, 0.0], [0.2, 0.18, 0.12]);           // 耳朵
    eyes(g, 0.62, 0.78, 2.6, 0.12, true);
    for (let i = -2; i <= 2; i++) part(g, GEO.cone, M.gold, [i * 0.22, 1.42 - Math.abs(i) * 0.06, 0.1], [0.1, 0.36, 0.08], [0, 0, -i * 0.2]); // 金冠
    part(g, GEO.cyl, M.gold, [0, 1.25, 0.1], [0.55, 0.1, 0.3]);
    part(g, GEO.ico, M.red, [0, 1.3, 0.35], 0.09);
  }, [0, 0, 0.6]);
}
/** 鱷魚:趴在地上,張開的大嘴朝向玩家(上顎翹起來、滿口白牙),背上一排鱗甲、長尾巴往上 */
function crocBody(b) {
  part(b, GEO.ico2, BM.croc, [0, 1.0, 0.3], [1.05, 1.8, 0.6]);                                            // 身體
  part(b, GEO.cone, BM.croc, [0, 3.2, 0.15], [0.5, 1.8, 0.3], [0, 0, 0]);                                 // 尾巴
  for (let i = 0; i < 7; i++) part(b, GEO.cone, BM.crocDark, [0, 0.0 + i * 0.5, 0.85 - i * 0.05], [0.12, 0.25, 0.12], [Math.PI / 2, 0, 0]); // 鱗甲
  for (const x of [-1, 1]) for (const y of [0.1, 1.9]) part(b, GEO.ico2, BM.croc, [x * 1.05, y, 0.1], [0.32, 0.22, 0.2]); // 腳
  part(b, GEO.box, BM.croc, [0, -1.25, 0.2], [1.1, 1.6, 0.3]);                                            // 下顎
  part(b, GEO.box, BM.mouth, [0, -1.2, 0.37], [0.9, 1.4, 0.05]);                                          // 嘴巴裡
  const up = new THREE.Group(); up.position.set(0, -0.45, 0.45); up.rotation.x = -0.55; b.add(up);       // 上顎(翹起來)
  part(up, GEO.box, BM.croc, [0, -0.85, 0.15], [1.1, 1.7, 0.32]);
  part(up, GEO.box, BM.mouth, [0, -0.85, -0.03], [0.9, 1.5, 0.04]);
  for (const x of [-1, 1]) {
    part(up, GEO.ico2, BM.croc, [x * 0.35, 0.05, 0.45], [0.22, 0.22, 0.2]);                                 // 凸出來的眼睛
    part(up, GEO.ico2, M.white, [x * 0.35, 0.02, 0.58], [0.14, 0.14, 0.08]);
    part(up, GEO.ico, M.eye, [x * 0.35, 0.0, 0.64], 0.07);
    for (let i = 0; i < 6; i++) {
      part(up, GEO.cone, BM.teeth, [x * 0.5, -0.2 - i * 0.27, -0.08], [0.06, 0.16, 0.06], [Math.PI / 2 + 0.6, 0, 0]);
      part(b, GEO.cone, BM.teeth, [x * 0.5, -0.6 - i * 0.24, 0.42], [0.06, 0.16, 0.06], [-Math.PI / 2 + 0.3, 0, 0]);
    }
  }
  part(up, GEO.ico, M.dark, [0, -1.6, 0.33], [0.2, 0.06, 0.04]);                                          // 鼻孔
}
/** 大猩猩:巨大的深灰身體、灰色的臉和胸口、粗手臂 + 一圈會轉的香蕉 */
function gorillaBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.7, {
    body: BM.gorilla, pants: BM.gorilla, face: BM.gorillaFace, head: BM.gorilla, boots: BM.gorillaFace,
    extra(g, hg) {
      part(hg, GEO.box, BM.gorilla, [0, 0.1, 0.28], [0.3, 0.05, 0.04]);                                     // 粗眉骨
      part(hg, GEO.ico, BM.gorillaFace, [0, -0.1, 0.3], [0.12, 0.08, 0.05]);
      for (const x of [-1, 1]) part(hg, GEO.ico, M.dark, [x * 0.04, -0.08, 0.34], 0.02);                     // 鼻孔
      part(hg, GEO.box, M.dark, [0, -0.17, 0.3], [0.1, 0.02, 0.02]);
      part(g, GEO.ico2, BM.gorillaChest, [0, -0.2, 0.18], [0.2, 0.18, 0.06]);                               // 胸口
      for (const x of [-1, 1]) {
        part(g, GEO.ico2, BM.gorilla, [x * 0.34, -0.2, 0.05], [0.14, 0.24, 0.14], [0, 0, x * 0.3]);         // 粗手臂
        part(g, GEO.ico2, BM.gorillaFace, [x * 0.38, -0.44, 0.1], [0.1, 0.08, 0.09]);                       // 拳頭
      }
    },
  });
}
function bananaRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2, x = Math.cos(a) * 2.8, y = Math.sin(a) * 2.6 + 0.4;
    part(spin, GEO.halfRing, BM.banana, [x, y, 0.9], [0.4, 0.4, 1.6], [0, 0, a]);
  }
  rig.add(spin);
}
/** 黃金倉鼠(獎勵關):圓滾滾、塞滿的頰囊、抱著一顆葵花子,旁邊繞著一圈葵花子 */
function hamsterBody(b) {
  part(b, GEO.ico2, BM.hamster, [0, 0.3, 0.3], [1.3, 1.25, 1.0]);
  part(b, GEO.ico2, BM.hamsterW, [0, -0.25, 0.9], [0.8, 0.6, 0.4]);                                        // 白肚子
  for (const x of [-1, 1]) {
    part(b, GEO.ico2, BM.hamsterW, [x * 0.7, -0.1, 0.95], [0.45, 0.4, 0.35]);                               // 頰囊
    part(b, GEO.ico2, BM.hamster, [x * 0.75, 1.3, 0.5], [0.25, 0.22, 0.12]);                                // 小耳朵
    part(b, GEO.ico, M.pink, [x * 0.75, 1.3, 0.6], [0.14, 0.12, 0.05]);
    part(b, GEO.ico, M.eye, [x * 0.38, 0.45, 1.25], [0.1, 0.12, 0.05]);
    part(b, GEO.ico, BM.hamsterW, [x * 0.2, -0.55, 1.3], [0.14, 0.1, 0.08]);
  }
  part(b, GEO.ico, M.pink, [0, 0.18, 1.32], [0.1, 0.07, 0.05]);
  part(b, GEO.ico2, BM.seed, [0, -0.5, 1.4], [0.18, 0.3, 0.1]);                                            // 抱著的葵花子
}
function seedRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.ico2, BM.seed, [Math.cos(a) * 2.0, 0.3 + Math.sin(a) * 2.1, 0.5], [0.14, 0.24, 0.08], [0, 0, a]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'lion') return template(lionBody, 1.45, null, { shadow: [2.0, 1.8] });
  if (kind === 'croc') return template(crocBody, 1.5, null, { shadow: [1.8, 2.8] });
  if (kind === 'gorilla') return template(gorillaBody, 1.45, bananaRing, { shadow: [1.6, 1.3] });
  return template(hamsterBody, 1.4, seedRing, { shadow: [1.3, 1.2] });
}

/* ---------------- 刺蝟球(原本的隕石):縮成一團的刺蝟,滾著過來 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  const quill = C(0x6a4a30, 2), fur = C(0xa87a50), face = C(0xf4e0c0);
  part(body, GEO.ico2, fur, [0, 0, 0], 0.42);
  const dirs = new THREE.IcosahedronGeometry(1, 1).getAttribute('position');
  const seen = new Set();
  for (let i = 0; i < dirs.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(dirs, i).normalize();
    const k = v.toArray().map((n) => n.toFixed(2)).join();
    if (seen.has(k) || v.z > 0.55) continue; seen.add(k);                                                 // 正面留給臉
    const q = part(body, GEO.cone, quill, v.clone().multiplyScalar(0.46).toArray(), [0.07, 0.3, 0.07]);
    q.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
  }
  part(body, GEO.ico2, face, [0, 0, 0.3], [0.24, 0.22, 0.14]);
  for (const x of [-1, 1]) part(body, GEO.ico, M.eye, [x * 0.08, 0.04, 0.42], 0.035);
  part(body, GEO.ico, M.nose, [0, -0.05, 0.44], 0.035);
  rig.add(bake(body));
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xe8dcc0, transparent: true, opacity: 0.35, depthWrite: false }), [0, -1.0, -0.2], [0.35, 1.1, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';                                                                                      // 揚起的塵土
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(rabbit, 1.5, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(parrot, 1.5, parrotWings, { shadow: [0.4, 0.3], upright: true }),
  boss: template(boar, 1.55, null, { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(野豬被打)就換單一 mesh 的 material。
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

/* ---------------- 道具:寵物罐頭(彩色標籤 + 銀色蓋子 + 拉環 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: '骨頭' },
  R: { label: 'R', color: 0x3ad8ff, name: '快腿' },
  S: { label: 'S', color: 0x3ae07a, name: '泡泡' },
  B: { label: 'B', color: 0xb86aff, name: '大聲吠' },
  W: { label: 'W', color: 0xff8a2a, name: '貓咪助陣' },
  L: { label: '1UP', color: 0xffc23a, name: '大雞腿' },
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
  const cm = C(it.color, 2), tin = C(0xd0d8e4, 2);
  part(body, GEO.cyl, cm, [0, -0.05, 0.2], [0.34, 0.5, 0.3], [0.5, 0, 0]);                              // 罐身
  part(body, GEO.cyl, tin, [0, 0.2, 0.34], [0.35, 0.05, 0.31], [0.5, 0, 0]);                            // 蓋子
  part(body, GEO.cyl, tin, [0, -0.3, 0.06], [0.35, 0.05, 0.31], [0.5, 0, 0]);
  part(body, GEO.torus, tin, [0.1, 0.24, 0.38], [0.08, 0.06, 0.1], [0.5 + Math.PI / 2, 0, 0]);           // 拉環
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

/** 玩家:骨頭(中間一根 + 兩端各兩顆圓頭),順著飛行方向 */
export function shotBatch(scene, cap) {
  const knobs = [];
  for (const y of [-1, 1]) for (const x of [-1, 1]) knobs.push(geoAt(GEO.ico, [x * 0.07, y * 0.24, 0], [0.085, 0.085, 0.06]));
  return new Batch(scene, [
    [merged([geoAt(GEO.box, [0, 0, 0], [0.1, 0.46, 0.07]), ...knobs]), SHOT_MAT],
    [geoAt(GEO.box, [0.035, 0, 0.04], [0.025, 0.3, 0.01]), SHOT_TIP],
  ], cap);
}
/** 敵彈:橡實(尖端朝前進方向、咖啡色殼斗在後面) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [merged([geoAt(GEO.ico2, [0, -0.12, 0], [0.19, 0.12, 0.19]), geoAt(GEO.cyl, [0, -0.25, 0], [0.03, 0.12, 0.03])]), EB_MAT],
    [merged([geoAt(GEO.ico2, [0, 0.03, 0], [0.16, 0.2, 0.16]), geoAt(GEO.cone, [0, 0.22, 0], [0.06, 0.1, 0.06])]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
