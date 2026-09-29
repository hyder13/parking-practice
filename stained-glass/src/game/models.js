import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 彩窗騎士的角色:Q 版小騎士、獨角獸、哥布林、蝙蝠、黑騎士。全部用基本幾何體拼出來(沒有模型檔)。
 * 每個 cel 材質都會變成透光的彩色玻璃(palette.js TOON):平面著色的每一面是一片玻璃,
 * 所以這裡用寶石一樣飽和的顏色,描線(粗黑)就是玻璃之間的鉛條。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:角色在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。角色模型「不跟著前進方向旋轉」(userData.upright)。
 * 內部型別沿用原本的名字:bee = 哥布林、bfly = 蝙蝠、boss = 黑騎士(打兩下)、rock = 滾來的火球。
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
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
  disc: new THREE.CircleGeometry(1, 22),
};

const C = (color, bands = 3) => cel({ color, bands, tint: 0x5a4a8a });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair), eye: flat({ color: 0x14121a }), cheek: flat({ color: 0xff8a9a }),
  white: C(0xf0f0f8), silver: C(0xc8d0e0), steel: C(0x9aa8c0), gold: C(0xffc830), red: C(0xe8203a), blue: C(0x2a5ad8),
  green: C(0x3ab84a), purple: C(0x8a3ad8), dark: C(0x2a2a3a, 2), brown: C(0x8a5a2a), light: flat({ color: 0xfff4b0 }),
  glowRed: flat({ color: 0xff3a3a }), glowCyan: flat({ color: 0x6af4ff }),
  // 哥布林
  goblin: C(PAL.beeBody), leather: C(PAL.beeBelly), leather2: C(PAL.beeBand),
  // 蝙蝠
  bat: C(PAL.bflyBody), bat2: C(PAL.bflyHead),
  // 黑騎士(被打一下盔甲裂開、露出紅光)
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0xe86a3a),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 黑騎士被打第一下之後換色用的對照表 */
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
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x0a0a14, transparent: true, opacity: 0.3, depthWrite: false });
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
 * o:{ body, pants, head(髮 / 頭盔)、face、boots、big、noFace、extra(g, hg) } */
function chibi(b, at, s, o) {
  const g = new THREE.Group();
  part(g, GEO.ico, o.pants || o.body, [0, -0.5, 0], [0.24, 0.2, 0.2]);
  part(g, GEO.ico, o.body, [0, -0.2, 0], [0.27, 0.26, 0.22]);
  for (const x of [-1, 1]) {
    part(g, GEO.ico, o.body, [x * 0.29, -0.22, 0.02], [0.09, 0.17, 0.09], [0, 0, x * 0.35]);
    part(g, GEO.ico, o.boots || M.dark, [x * 0.11, -0.7, 0.02], [0.08, 0.08, 0.1]);
  }
  const hg = new THREE.Group(); hg.position.set(0, 0.28 + ((o.big || 1) - 1) * 0.22, 0); hg.scale.setScalar(o.big || 1); g.add(hg);
  part(hg, GEO.ico2, o.face || M.skin, [0, 0, 0.02], 0.3);
  part(hg, GEO.ico2, o.head || M.hair, [0, 0.08, -0.06], [0.32, 0.3, 0.3]);
  if (!o.noFace) for (const x of [-1, 1]) {
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

/* ---------------- 哥布林(bee):綠皮膚 + 尖耳朵 + 大鼻子 + 皮革背心 + 小匕首 ---------------- */
function goblin(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.leather, pants: M.leather2, face: M.goblin, head: M.goblin, boots: M.leather2, noFace: true,
    extra(g, hg) {
      for (const x of [-1, 1]) {
        part(hg, GEO.cone, M.goblin, [x * 0.36, 0.05, -0.02], [0.08, 0.3, 0.05], [0, 0, -x * 1.3]);     // 尖耳朵
        part(hg, GEO.ico2, M.gold, [x * 0.1, 0.02, 0.28], [0.05, 0.045, 0.03]);                         // 黃眼睛
        part(hg, GEO.ico, M.eye, [x * 0.1, 0.02, 0.31], 0.02);
        part(hg, GEO.box, M.eye, [x * 0.1, 0.1, 0.29], [0.09, 0.02, 0.02], [0, 0, x * 0.4]);
      }
      part(hg, GEO.ico2, M.goblin, [0, -0.07, 0.32], [0.07, 0.06, 0.07]);                              // 大鼻子
      part(hg, GEO.box, M.eye, [0, -0.16, 0.28], [0.12, 0.02, 0.02]);
      for (const x of [-1, 1]) part(hg, GEO.cone, M.white, [x * 0.04, -0.15, 0.29], [0.015, 0.04, 0.01]); // 小獠牙
      for (const x of [-1, 1]) part(g, GEO.ico, M.goblin, [x * 0.33, -0.36, 0.05], 0.07);             // 綠色的手
      part(g, GEO.box, M.silver, [0.38, -0.24, 0.1], [0.04, 0.22, 0.02], [0, 0, -0.3]);               // 匕首
    },
  });
}

/* ---------------- 蝙蝠(bfly):紫色圓身體 + 大耳朵 + 紅眼睛 + 小尖牙,兩片扇形翅膀 ---------------- */
function bat(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.bat, [0, 0, 0], [0.26, 0.28, 0.24]);
    for (const x of [-1, 1]) {
      part(g, GEO.cone, M.bat2, [x * 0.15, 0.3, 0], [0.09, 0.22, 0.06], [0, 0, -x * 0.3]);            // 大耳朵
      part(g, GEO.ico, M.glowRed, [x * 0.09, 0.06, 0.22], [0.05, 0.06, 0.03]);                        // 紅眼睛
      part(g, GEO.cone, M.white, [x * 0.04, -0.08, 0.22], [0.02, 0.06, 0.02], [Math.PI, 0, 0]);       // 尖牙
      part(g, GEO.ico, M.bat2, [x * 0.08, -0.3, 0.02], [0.05, 0.06, 0.05]);                           // 小腳
    }
  }, [0, 0, 0.3]);
}
function batWingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.12); s.lineTo(0.55, 0.28); s.quadraticCurveTo(0.5, 0.05, 0.62, -0.1);
  s.quadraticCurveTo(0.45, -0.05, 0.4, -0.2); s.quadraticCurveTo(0.28, -0.08, 0.18, -0.18); s.quadraticCurveTo(0.12, -0.02, 0, -0.08);
  return new THREE.ShapeGeometry(s);
}
const BAT_WING = batWingGeo();
function batWings(rig, s = 1, mat = null) {
  const wm = mat || cel({ color: PAL.bflyWing, bands: 2, side: THREE.DoubleSide, tint: 0x5a4a8a });
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(BAT_WING, wm);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.7; f.userData.freq = 2.6;
    f.position.set(side * 0.18 * s, 0.05 * s, 0.25 * s); f.scale.set(side * s, s, 1); f.rotation.x = LEAN;
    rig.add(f);
  }
}

/* ---------------- 黑騎士(boss):深色全身盔甲 + T 字面甲裡的紅光 + 角 + 紅披風 + 大劍,打兩下 ---------------- */
function blackKnight(b) {
  chibi(b, [0, 0, 0.25], 1.25, {
    body: M.bossBody, pants: M.bossBody, face: M.bossHead, head: M.bossHead, boots: M.bossInner, noFace: true,
    extra(g, hg) {
      part(hg, GEO.ico2, M.bossHead, [0, 0.03, 0.02], [0.33, 0.33, 0.32]);                            // 頭盔
      part(hg, GEO.box, M.eye, [0, 0.02, 0.32], [0.3, 0.05, 0.03]);                                   // T 字面甲
      part(hg, GEO.box, M.eye, [0, -0.08, 0.32], [0.05, 0.18, 0.03]);
      for (const x of [-1, 1]) {
        part(hg, GEO.ico, M.glowRed, [x * 0.08, 0.02, 0.34], [0.04, 0.02, 0.02]);                     // 紅光的眼
        part(hg, GEO.cone, M.bossInner, [x * 0.26, 0.3, 0], [0.05, 0.2, 0.05], [0, 0, -x * 0.6]);     // 角
      }
      for (const x of [-1, 1]) part(g, GEO.ico2, M.bossInner, [x * 0.31, -0.07, 0.02], [0.14, 0.1, 0.12]); // 肩甲
      part(g, GEO.box, M.red, [0, -0.25, -0.2], [0.56, 0.66, 0.03], [0.2, 0, 0]);                     // 紅披風
      part(g, GEO.cyl, M.red, [0, -0.2, 0.2], [0.07, 0.03, 0.07], [Math.PI / 2, 0, 0]);               // 胸前紅寶石
      rod(g, M.steel, [0.36, -0.3], [0.44, 0.55], 0.03, 0.12);                                          // 大劍
      rod(g, M.bossInner, [0.28, -0.3], [0.44, -0.3], 0.03, 0.12);
    },
  });
}

/* ---------------- 玩家:小騎士(10 段) ----------------
 * 銀色盔甲 + 開口頭盔(露出臉)+ 右手光之劍 + 左手盾。每一段加零件:
 *   Lv2 紅色羽飾、Lv3 藍披風、Lv4 盾上的金色菱紋、Lv5 金邊盔甲、Lv6 肩甲、
 *   Lv7 頭盔上的白翅膀、Lv8 聖光、Lv9 頭盔上的王冠、Lv10 身後一圈玫瑰花窗光環。
 * 'ally' = 獨角獸(白馬 + 金色螺旋角 + 彩虹鬃毛)。 */
export const SHIP_LV = [
  { name: '見習侍從', body: 0xc8d0e0, accent: 0xffc830, pod: 0x2a5ad8, flame: 0xfff4c8, span: 1.0 },
  { name: '小侍從', body: 0xc8d0e0, accent: 0xffc830, pod: 0x2a5ad8, flame: 0xfff4c8, span: 1.02 },
  { name: '見習騎士', body: 0xd0d8e8, accent: 0xffc830, pod: 0x2a5ad8, flame: 0xfff4c8, span: 1.04 },
  { name: '騎士', body: 0xd0d8e8, accent: 0xffc830, pod: 0x2a4ac8, flame: 0xfff4c8, span: 1.06 },
  { name: '聖騎士', body: 0xd8e0f0, accent: 0xffd040, pod: 0x2a4ac8, flame: 0xfff0b0, span: 1.08 },
  { name: '圓桌騎士', body: 0xd8e0f0, accent: 0xffd040, pod: 0x3a3ab8, flame: 0xfff0b0, span: 1.1 },
  { name: '皇家騎士', body: 0xe0e8f8, accent: 0xffd850, pod: 0x3a3ab8, flame: 0xffe8a0, span: 1.12 },
  { name: '光之騎士', body: 0xe0e8f8, accent: 0xffd850, pod: 0x4a2aa8, flame: 0xffe8a0, span: 1.14 },
  { name: '傳說騎士', body: 0xe8f0ff, accent: 0xffe070, pod: 0x4a2aa8, flame: 0xffe090, span: 1.16 },
  { name: '聖光王者', body: 0xf0f4ff, accent: 0xffffff, pod: 0x5a1a98, flame: 0xffffff, span: 1.2 },
];

function knightBody(m, L) {
  return (b) => {
    chibi(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: m.red, face: M.skin, head: m.red, boots: M.steel, big: 1.3,
      extra(g, hg) {
        part(hg, GEO.ico2, m.red, [0, 0.08, -0.03], [0.33, 0.3, 0.31]);                                  // 頭盔
        part(hg, GEO.box, M.steel, [0, 0.19, 0.24], [0.34, 0.06, 0.1]);                                   // 盔緣
        for (const x of [-1, 1]) part(hg, GEO.box, M.steel, [x * 0.25, -0.05, 0.16], [0.06, 0.24, 0.12]); // 護頰
        part(hg, GEO.ico2, M.hair, [0, 0.12, 0.2], [0.16, 0.06, 0.06]);                                   // 露出的金色瀏海
        part(g, GEO.cyl, M.gold, [0, -0.36, 0], [0.26, 0.05, 0.22]);                                       // 腰帶
        // 光之劍(發光的劍身)+ 盾
        rod(g, M.light, [0.34, -0.28], [0.52, 0.45], 0.028, 0.12);
        rod(g, M.gold, [0.28, -0.3], [0.42, -0.24], 0.025, 0.12);
        const sh = new THREE.Group(); sh.position.set(-0.36, -0.22, 0.14); g.add(sh);
        part(sh, GEO.cyl, m.blue, [0, 0, 0], [0.2, 0.05, 0.2], [Math.PI / 2, 0, 0]);
        part(sh, GEO.torus, M.gold, [0, 0, 0.03], [0.2, 0.2, 0.3]);
        if (L >= 2) for (let i = 0; i < 3; i++) part(hg, GEO.ico2, M.red, [0, 0.36 - i * 0.02, -0.08 - i * 0.1], [0.05, 0.1, 0.07], [0.6 + i * 0.3, 0, 0]); // 紅色羽飾
        if (L >= 3) part(g, GEO.box, m.blue, [0, -0.25, -0.2], [0.58, 0.64, 0.03], [0.2, 0, 0]);                 // 藍披風
        if (L >= 4) part(sh, GEO.oct, M.gold, [0, 0, 0.05], [0.09, 0.13, 0.03]);                                   // 盾上的金色菱紋
        if (L >= 5) for (const y of [-0.08, -0.3]) part(g, GEO.cyl, M.gold, [0, y, 0], [0.275, 0.025, 0.23]);    // 金邊
        if (L >= 6) for (const x of [-1, 1]) part(g, GEO.ico2, M.silver, [x * 0.31, -0.07, 0.02], [0.13, 0.09, 0.12]); // 肩甲
        if (L >= 7) for (const x of [-1, 1]) part(hg, GEO.cone, M.white, [x * 0.33, 0.14, -0.05], [0.07, 0.24, 0.04], [0, 0, -x * 1.0]); // 白翅膀
        if (L >= 9) {                                                                                               // 王冠
          part(hg, GEO.cyl, M.gold, [0, 0.36, 0], [0.18, 0.06, 0.17]);
          for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(hg, GEO.cone, M.gold, [Math.cos(a) * 0.15, 0.42, Math.sin(a) * 0.14], [0.04, 0.1, 0.04]); }
          part(hg, GEO.oct, M.red, [0, 0.38, 0.17], 0.035);
        }
      },
    });
  };
}
/** 獨角獸(僚機):白色小馬 + 金色螺旋角 + 彩虹鬃毛 + 彩虹尾巴 */
function unicornBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.white, [0, -0.3, -0.1], [0.32, 0.26, 0.4]);                                   // 身體
    for (const [x, z] of [[-0.18, 0.1], [0.18, 0.1], [-0.15, -0.28], [0.15, -0.28]]) {
      part(g, GEO.cyl, M.white, [x, -0.58, z], [0.06, 0.34, 0.06]);                                    // 腳
      part(g, GEO.cyl, M.gold, [x, -0.76, z], [0.07, 0.05, 0.07]);                                     // 蹄
    }
    part(g, GEO.cyl, M.white, [0, -0.02, 0.1], [0.12, 0.34, 0.12], [0.35, 0, 0]);                     // 脖子
    part(g, GEO.ico2, M.white, [0, 0.2, 0.18], [0.2, 0.2, 0.2]);                                      // 頭
    part(g, GEO.ico2, M.white, [0, 0.12, 0.34], [0.12, 0.1, 0.12]);                                   // 鼻口
    for (const x of [-1, 1]) {
      part(g, GEO.ico, M.eye, [x * 0.09, 0.22, 0.34], [0.03, 0.045, 0.02]);
      part(g, GEO.ico, M.cheek, [x * 0.12, 0.13, 0.33], [0.03, 0.02, 0.02]);
      part(g, GEO.cone, M.white, [x * 0.1, 0.4, 0.12], [0.05, 0.12, 0.04], [0, 0, -x * 0.3]);          // 耳朵
    }
    part(g, GEO.cone, M.gold, [0, 0.5, 0.24], [0.045, 0.3, 0.045], [0.3, 0, 0]);                       // 金色的角
    const rainbow = [M.red, C(0xff8a20), M.gold, M.green, M.blue, M.purple];
    rainbow.forEach((mat, i) => part(g, GEO.ico2, mat, [0, 0.34 - i * 0.07, 0.02 - i * 0.04], [0.06, 0.08, 0.06]));  // 彩虹鬃毛
    rainbow.forEach((mat, i) => part(g, GEO.ico2, mat, [(i - 2.5) * 0.04, -0.3 - i * 0.03, -0.52], [0.05, 0.09, 0.05])); // 彩虹尾巴
  }, [0, 0, 0.3], 1.3);
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1, ally = false) {
  return template(ally ? unicornBody : knightBody(m, L), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下的光粒
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], m.flame || 0xfff4c8, [0.1, L >= 8 ? 0.45 : 0.3, 0.08], L >= 8 ? 0.8 : 0.5);
    if (ally) return;
    if (L >= 10) {                                                                                         // 玫瑰花窗光環
      const h = new THREE.Group(); h.name = 'halo'; h.position.set(0, 0.4, -0.25); rig.add(h);
      const cols = [0xe8203a, 0xffc830, 0x2a5ad8, 0x3ab84a, 0x8a3ad8, 0x3ac8e8];
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        part(h, GEO.oct, flat({ color: cols[i % 6] }), [Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0], [0.13, 0.2, 0.04], [0, 0, a - Math.PI / 2]);
      }
      part(h, GEO.torus, flat({ color: 0xffe070 }), [0, 0, 0], [0.9, 0.9, 0.3]);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xfff0b0 : 0xffe070, transparent: true, opacity: L >= 10 ? 0.16 : 0.11, blending: THREE.AdditiveBlending, depthWrite: false }));
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

/* ---------------- 大魔物(面朝玩家) ---------------- */
const BM = {
  dragon: C(0xd8202a), dragon2: C(0x8a1020), belly: C(0xffc830), horn: C(0xf0e8d0), wing: cel({ color: 0xc8302a, bands: 2, side: THREE.DoubleSide, tint: 0x5a4a8a }),
  witch: C(0x6a2ab8), witch2: C(0x3a1a6a), witchSkin: C(0x9ae08a), witchHair: C(0xd8dce8), potion: [0x3ae8c8, 0xe8203a, 0xffc830, 0x8a3ad8].map((c) => flat({ color: c })),
  stone: C(0xd8c8a0), stone2: C(0xa89070), rune: flat({ color: 0x6af4ff }),
  grail: C(0xffc830), grail2: C(0xe89a20), gem: [0xe8203a, 0x2a5ad8, 0x3ab84a, 0x8a3ad8].map((c) => C(c)),
  fire: new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
};

/** 紅龍:面朝玩家的龍頭(角 + 長吻 + 金色的眼)+ 胸口的金色鱗片,兩片大翅膀(會拍) */
function dragonBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.dragon, [0, -0.5, -0.1], [0.8, 0.8, 0.6]);                                     // 身體
    part(g, GEO.ico2, BM.belly, [0, -0.55, 0.4], [0.5, 0.6, 0.2]);
    for (let i = 0; i < 4; i++) part(g, GEO.box, BM.dragon2, [0, -0.25 - i * 0.18, 0.58], [0.5 - i * 0.05, 0.03, 0.02]);
    part(g, GEO.ico2, BM.dragon, [0, 0.45, 0.2], [0.6, 0.5, 0.55]);                                     // 頭
    part(g, GEO.ico2, BM.dragon, [0, 0.28, 0.65], [0.38, 0.26, 0.35]);                                  // 長吻
    part(g, GEO.box, M.dark, [0, 0.14, 0.92], [0.5, 0.06, 0.1]);
    for (let i = 0; i < 5; i++) part(g, GEO.cone, M.white, [(i - 2) * 0.1, 0.19, 0.95], [0.03, 0.08, 0.03], [Math.PI, 0, 0]);
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, BM.belly, [x * 0.24, 0.58, 0.6], [0.12, 0.09, 0.06]);                          // 金色的眼
      part(g, GEO.box, M.eye, [x * 0.24, 0.58, 0.66], [0.03, 0.1, 0.02]);
      part(g, GEO.box, BM.dragon2, [x * 0.26, 0.72, 0.58], [0.28, 0.06, 0.06], [0, 0, x * 0.4]);
      part(g, GEO.cone, BM.horn, [x * 0.35, 0.95, 0.0], [0.09, 0.45, 0.09], [-0.4, 0, -x * 0.5]);      // 角
      part(g, GEO.ico, M.dark, [x * 0.12, 0.32, 0.98], 0.04);                                          // 鼻孔
      part(g, GEO.ico2, BM.dragon, [x * 0.55, -1.05, 0.2], [0.26, 0.2, 0.3]);                          // 腳
    }
    for (let i = 0; i < 4; i++) part(g, GEO.cone, BM.belly, [0, 0.95 - i * 0.35, -0.4 - i * 0.05], [0.1, 0.25, 0.06], [-0.9, 0, 0]); // 背刺
  }, [0, 0.4, 0.8], 1.6);
}
function dragonExtras(rig) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.3); s.lineTo(1.9, 1.0); s.quadraticCurveTo(1.7, 0.4, 2.1, -0.2); s.quadraticCurveTo(1.5, 0, 1.3, -0.5);
  s.quadraticCurveTo(0.9, -0.1, 0.6, -0.5); s.quadraticCurveTo(0.4, -0.1, 0, -0.2);
  const wg = new THREE.ShapeGeometry(s);
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(wg, BM.wing);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.45; f.userData.freq = 1.3;
    f.position.set(side * 0.9, 0.3, 0.3); f.scale.set(side * 1.3, 1.3, 1); f.rotation.x = LEAN;
    rig.add(f);
  }
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; part(spin, GEO.ico, BM.fire, [Math.cos(a) * 3.2, Math.sin(a) * 3.0 + 0.4, 0.9], 0.3); }
  rig.add(spin);
}
/** 女巫:紫袍 + 大尖帽(金扣)+ 綠皮膚 + 銀白長髮 + 水晶法杖 */
function witchBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.9, {
    body: BM.witch, pants: BM.witch2, face: BM.witchSkin, head: BM.witchHair, noFace: true,
    extra(g, hg) {
      part(hg, GEO.cyl, BM.witch2, [0, 0.24, 0], [0.48, 0.04, 0.46]);                                    // 帽簷
      part(hg, GEO.cone, BM.witch, [0.05, 0.62, -0.05], [0.26, 0.75, 0.26], [0.15, 0, -0.25]);          // 尖帽
      part(hg, GEO.box, M.gold, [0, 0.3, 0.22], [0.1, 0.08, 0.02]);                                      // 金扣
      for (const x of [-1, 1]) {
        part(hg, GEO.ico2, BM.witchHair, [x * 0.28, -0.25, -0.04], [0.1, 0.3, 0.1]);                     // 長髮
        part(hg, GEO.ico, M.gold, [x * 0.1, 0.0, 0.29], [0.04, 0.03, 0.02]);                             // 眼
        part(hg, GEO.box, M.eye, [x * 0.1, 0.08, 0.29], [0.09, 0.02, 0.02], [0, 0, x * 0.4]);
      }
      part(hg, GEO.cone, BM.witchSkin, [0, -0.06, 0.34], [0.05, 0.14, 0.05], [Math.PI / 2 + 0.4, 0, 0]); // 尖鼻子
      part(hg, GEO.halfRing, M.eye, [0, -0.16, 0.28], [0.06, 0.04, 0.1]);
      rod(g, M.brown, [0.36, -0.7], [0.4, 0.4], 0.025, 0.12);                                            // 法杖
      part(g, GEO.oct, M.glowCyan, [0.41, 0.5, 0.12], [0.08, 0.12, 0.08]);
    },
  });
}
function potionRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, p = new THREE.Group(); p.position.set(Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9); spin.add(p);
    part(p, GEO.ico2, BM.potion[i % 4], [0, 0, 0], 0.22);
    part(p, GEO.cyl, BM.potion[(i + 1) % 4], [0, 0.26, 0], [0.07, 0.14, 0.07]);
  }
  rig.add(spin);
}
/** 石巨人:一塊塊的石頭拼成的大個子 + 發光的藍色符文 + 胸口的水晶核心 + 大拳頭 */
function golemBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico0, BM.stone, [0, -0.2, 0], [1.1, 0.95, 0.7]);                                       // 身體
    part(g, GEO.ico0, BM.stone2, [0, 0.75, 0.05], [0.55, 0.45, 0.45]);                                  // 頭
    for (const x of [-1, 1]) {
      part(g, GEO.ico, BM.rune, [x * 0.2, 0.78, 0.45], [0.08, 0.05, 0.03]);                            // 發光的眼
      part(g, GEO.ico0, BM.stone2, [x * 1.1, 0.2, 0], [0.45, 0.4, 0.4]);                               // 肩
      part(g, GEO.ico0, BM.stone, [x * 1.25, -0.5, 0.1], [0.35, 0.55, 0.35]);                          // 手臂
      part(g, GEO.ico0, BM.stone2, [x * 1.3, -1.05, 0.25], [0.45, 0.4, 0.4]);                          // 大拳頭
      part(g, GEO.ico0, BM.stone2, [x * 0.45, -1.15, 0], [0.35, 0.35, 0.35]);                          // 腳
      for (let k = 0; k < 3; k++) part(g, GEO.box, BM.rune, [x * (0.35 + k * 0.12), -0.3 + k * 0.2, 0.62 - k * 0.05], [0.18, 0.03, 0.02], [0, 0, x * 0.6]); // 符文
    }
    part(g, GEO.oct, BM.rune, [0, -0.1, 0.62], [0.2, 0.28, 0.12]);                                     // 水晶核心
  }, [0, 0.4, 0.8], 1.6);
}
function rockRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; part(spin, GEO.ico0, i % 2 ? BM.stone : BM.stone2, [Math.cos(a) * 3.1, Math.sin(a) * 2.9 + 0.4, 0.9], [0.32, 0.28, 0.26], [a, a * 2, 0]); }
  rig.add(spin);
}
/** 聖杯(獎勵關):金色的杯子 + 一圈寶石 + 杯口的光,周圍繞著一圈寶石 */
function grailBody(b) {
  standing(b, (g) => {
    part(g, GEO.cyl, BM.grail2, [0, -1.0, 0], [0.7, 0.14, 0.7]);                                        // 杯底
    part(g, GEO.cyl, BM.grail, [0, -0.55, 0], [0.12, 0.8, 0.12]);                                       // 杯腳
    part(g, GEO.ico2, BM.grail2, [0, -0.25, 0], [0.2, 0.15, 0.2]);
    part(g, GEO.cone, BM.grail, [0, 0.35, 0], [0.8, 1.1, 0.8], [Math.PI, 0, 0]);                        // 杯身
    part(g, GEO.torus, BM.grail2, [0, 0.9, 0], [0.8, 0.8, 0.8], [Math.PI / 2, 0, 0]);                  // 杯緣
    for (let i = 0; i < 4; i++) part(g, GEO.oct, BM.gem[i], [(i - 1.5) * 0.3, 0.35, 0.55 - Math.abs(i - 1.5) * 0.12], [0.1, 0.14, 0.06]);
    part(g, GEO.disc, M.light, [0, 0.92, 0.02], 0.72, [-Math.PI / 2 + 0.3, 0, 0]);                     // 杯口的光
  }, [0, 0.2, 0.6], 1.5);
}
function gemRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; part(spin, GEO.oct, BM.gem[i % 4], [Math.cos(a) * 2.3, Math.sin(a) * 2.2, 0.5], [0.18, 0.26, 0.12], [0, 0, a]); }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'dragon') return template(dragonBody, 1.5, dragonExtras, { shadow: [1.7, 1.4] });
  if (kind === 'witch') return template(witchBody, 1.5, potionRing, { shadow: [1.5, 1.3] });
  if (kind === 'golem') return template(golemBody, 1.5, rockRing, { shadow: [1.8, 1.4] });
  return template(grailBody, 1.4, gemRing, { shadow: [1.4, 1.1] });
}

/* ---------------- 滾來的火球(原本的隕石):橘色的玻璃球 + 一圈火焰 + 拖著火尾 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.ico, C(0xff7a1a), [0, 0, 0], 0.42);
  part(body, GEO.ico, C(0xffd040), [0, 0.1, 0.22], 0.2);
  rig.add(bake(body));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    const f = part(rig, GEO.cone, BM.fire, [Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0], [0.12, 0.3, 0.12], [0, 0, a - Math.PI / 2]);
    f.name = 'flame';
  }
  const tail = part(rig, GEO.cone, BM.fire, [0, -1.0, -0.2], [0.35, 1.1, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(goblin, 1.62, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(bat, 1.6, (rig) => batWings(rig, 1), { shadow: [0.4, 0.3], upright: true }),
  boss: template(blackKnight, 1.42, null, { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(黑騎士被打)就換單一 mesh 的 material。
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

/* ---------------- 道具:寶石(多面體水晶 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xe8203a, name: '聖光' },
  R: { label: 'R', color: 0x3ac8e8, name: '疾光' },
  S: { label: 'S', color: 0x3ab84a, name: '聖盾' },
  B: { label: 'B', color: 0x8a3ad8, name: '光之爆' },
  W: { label: 'W', color: 0xf0f0f8, name: '獨角獸' },
  L: { label: '1UP', color: 0xffc830, name: '蘋果派' },
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
  draw('#14121a', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.oct, C(it.color, 2), [0, 0, 0.2], [0.34, 0.46, 0.26]);                                  // 寶石
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
const EB_MAT = flat({ color: PAL.ebullet, transparent: true, depthWrite: false });
const EB_CORE = flat({ color: PAL.ebulletCore, transparent: true, depthWrite: false });

/** 玩家:金色的光之碎片(細長的菱形水晶,不透明 → 被描上鉛條的黑框) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.oct, [0, 0.05, 0], [0.12, 0.34, 0.08]), SHOT_MAT],
    [geoAt(GEO.oct, [0, 0.1, 0.05], [0.05, 0.16, 0.04]), SHOT_TIP],
  ], cap);
}
/** 敵彈:紫紅色的魔法彈(發光 + 白色核心) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico2, [0, 0, 0], [0.21, 0.21, 0.14]), EB_MAT],
    [geoAt(GEO.ico, [0, 0, 0.08], [0.1, 0.1, 0.06]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
