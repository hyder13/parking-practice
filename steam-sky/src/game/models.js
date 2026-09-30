import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 蒸汽天空的角色:Q 版小飛行員、機械貓頭鷹、發條兵、發條蜻蜓、蒸汽機器人。全部用基本幾何體拼出來(沒有模型檔)。
 * 暖色(黃銅 / 紅銅 / 皮革)會被 palette.js TOON 變成會反光的金屬 → 這裡的黃銅零件用 BRASS / COPPER。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:角色在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。角色模型「不跟著前進方向旋轉」(userData.upright)。
 * 內部型別沿用原本的名字:bee = 發條兵、bfly = 發條蜻蜓、boss = 蒸汽機器人(打兩下)、rock = 滾來的齒輪。
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
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
  torus: new THREE.TorusGeometry(1, 0.16, 6, 20),
  thin: new THREE.TorusGeometry(1, 0.08, 5, 24),
  halfRing: new THREE.TorusGeometry(1, 0.09, 5, 14, Math.PI),
  disc: new THREE.CircleGeometry(1, 22),
};

const C = (color, bands = 3) => cel({ color, bands, tint: 0x6a4a3a });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair), eye: flat({ color: 0x1e140c }), cheek: flat({ color: 0xff8a7a }),
  white: C(0xf0e8d8), cream: C(0xf4e8c8), iron: C(0x6a6a72), iron2: C(0x4a4a52), dark: C(0x2a2420, 2),
  brass: C(0xc8902a), brass2: C(0xe8b84a), copper: C(0xb8602a), gold: C(0xffc830), leather: C(0x6a3a1e), leather2: C(0x4a2a14),
  red: C(0xc83a2a), green: C(0x3a7a5a), glass: flat({ color: 0x9ae8f0 }), lamp: flat({ color: 0xffe08a }),
  glowRed: flat({ color: 0xff4a1a }), glowAmber: flat({ color: 0xffc040 }),
  // 發條兵
  tin: C(0xe8c8a8), soldier: C(PAL.beeBody), belt: C(PAL.beeBelly), shako: C(PAL.beeBand),
  // 發條蜻蜓
  fly: C(PAL.bflyBody), flyHead: C(PAL.bflyHead),
  // 蒸汽機器人(被打一下鍋爐燒紅)
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0xc84a2a),
  capWhite: C(PAL.captive), capRed: C(0xfff0e8), capBlue: C(PAL.captiveDark),
};

/** 蒸汽機器人被打第一下之後換色用的對照表 */
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
/** 齒輪(面朝 +z):一片圓盤 + 一圈齒 + 中間的軸 */
function gear(parent, mat, pos, r, teeth = 8, thick = 0.08, hub = null) {
  const g = new THREE.Group(); g.position.set(...pos); parent.add(g);
  part(g, GEO.cyl, mat, [0, 0, 0], [r * 0.82, thick, r * 0.82], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < teeth; i++) {
    const a = i / teeth * Math.PI * 2;
    part(g, GEO.box, mat, [Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, 0], [r * 0.26, r * 0.26, thick], [0, 0, a]);
  }
  part(g, GEO.cyl, hub || M.dark, [0, 0, thick * 0.5], [r * 0.22, thick * 0.6, r * 0.22], [Math.PI / 2, 0, 0]);
  return g;
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
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x140c06, transparent: true, opacity: 0.32, depthWrite: false });
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
 * o:{ body, pants, head(髮 / 帽)、face、boots、big、noFace、extra(g, hg) } */
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

/* ---------------- 發條兵(bee):藍色軍裝 + 白色交叉皮帶 + 高高的黑軍帽(黃銅帽徽)+ 背上的發條鑰匙 ---------------- */
function tinSoldier(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.soldier, pants: M.shako, face: M.tin, head: M.shako, boots: M.shako,
    extra(g, hg) {
      part(hg, GEO.cyl, M.shako, [0, 0.3, -0.02], [0.22, 0.4, 0.22]);                                   // 高軍帽
      part(hg, GEO.cyl, M.brass, [0, 0.18, 0.02], [0.235, 0.04, 0.235]);
      part(hg, GEO.oct, M.brass2, [0, 0.33, 0.21], [0.06, 0.08, 0.03]);                                 // 帽徽
      part(hg, GEO.ico, M.red, [0, 0.54, 0], [0.06, 0.08, 0.06]);                                       // 帽頂紅球
      for (const x of [-1, 1]) part(hg, GEO.disc, M.red, [x * 0.16, -0.1, 0.27], 0.045, [0, x * 0.4, 0]); // 紅臉頰(錫兵)
      for (const x of [-1, 1]) rod(g, M.belt, [x * -0.2, -0.05], [x * 0.2, -0.38], 0.03, 0.2);         // 白色交叉皮帶
      part(g, GEO.cyl, M.brass, [0, -0.36, 0], [0.26, 0.04, 0.22]);                                      // 腰帶
      for (let i = 0; i < 3; i++) part(g, GEO.ico, M.brass2, [0, -0.1 - i * 0.09, 0.21], 0.025);       // 黃銅扣子
      // 發條鑰匙(背上)
      part(g, GEO.cyl, M.brass, [0, -0.2, -0.3], [0.03, 0.18, 0.03], [Math.PI / 2, 0, 0]);
      for (const x of [-1, 1]) part(g, GEO.torus, M.brass, [x * 0.1, -0.2, -0.4], [0.08, 0.1, 0.3], [0, Math.PI / 2, 0]);
      rod(g, M.iron2, [0.36, -0.4], [0.4, 0.2], 0.025, 0.1);                                            // 小步槍
    },
  });
}

/* ---------------- 發條蜻蜓(bfly):綠色金屬身體 + 黃銅頭 + 一對大玻璃眼,四片透明翅膀 ---------------- */
function dragonfly(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.flyHead, [0, 0.2, 0.05], [0.2, 0.18, 0.18]);                                 // 黃銅頭
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.glass, [x * 0.12, 0.24, 0.14], [0.1, 0.1, 0.08]);                          // 大玻璃眼
      part(g, GEO.thin, M.brass, [x * 0.12, 0.24, 0.17], [0.1, 0.1, 0.4]);
    }
    part(g, GEO.ico2, M.fly, [0, -0.05, 0], [0.16, 0.2, 0.15]);                                      // 胸
    for (let i = 0; i < 4; i++) part(g, GEO.cyl, i % 2 ? M.brass : M.fly, [0, -0.3 - i * 0.13, -0.02], [0.07 - i * 0.008, 0.12, 0.07 - i * 0.008]); // 一節一節的尾巴
    part(g, GEO.ico, M.lamp, [0, -0.85, -0.02], 0.05);                                                // 尾燈
  }, [0, 0.1, 0.35]);
}
function flyWingGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.03); s.quadraticCurveTo(0.35, 0.14, 0.72, 0.08); s.quadraticCurveTo(0.8, 0.0, 0.72, -0.06); s.quadraticCurveTo(0.35, -0.08, 0, -0.03);
  return new THREE.ShapeGeometry(s);
}
const FLY_WING = flyWingGeo();
function flyWings(rig, s = 1) {
  const wm = cel({ color: PAL.bflyWing, bands: 2, side: THREE.DoubleSide, tint: 0x6a4a3a, transparent: true, opacity: 0.85 });
  for (const side of [-1, 1]) for (const k of [0, 1]) {
    const f = new THREE.Mesh(FLY_WING, wm);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.6; f.userData.freq = 5 + k * 0.7;
    f.position.set(side * 0.1 * s, (0.1 - k * 0.14) * s, 0.35 * s); f.scale.set(side * s, s * (1 - k * 0.15), 1);
    f.rotation.set(LEAN, 0, side * (k ? -0.25 : 0.15));
    rig.add(f);
  }
}

/* ---------------- 蒸汽機器人(boss):鐵灰方身體 + 黃銅圓頂頭 + 舷窗臉(兩顆亮眼)+ 頭上的煙囪 + 胸口壓力錶,打兩下 ---------------- */
function steamBot(b) {
  standing(b, (g) => {
    part(g, GEO.box, M.bossBody, [0, -0.3, 0], [0.62, 0.55, 0.44]);                                   // 鍋爐身體
    for (const y of [-0.12, -0.48]) part(g, GEO.box, M.bossInner, [0, y, 0.01], [0.66, 0.05, 0.48]);  // 鐵箍
    part(g, GEO.cyl, M.cream, [0, -0.28, 0.23], [0.13, 0.03, 0.13], [Math.PI / 2, 0, 0]);             // 壓力錶
    part(g, GEO.thin, M.brass, [0, -0.28, 0.25], [0.13, 0.13, 0.4]);
    rod(g, M.red, [0, -0.28], [0.06, -0.22], 0.012, 0.26);
    part(g, GEO.ico2, M.bossHead, [0, 0.18, 0.02], [0.3, 0.26, 0.28]);                                 // 黃銅圓頂頭
    part(g, GEO.cyl, M.dark, [0, 0.16, 0.24], [0.17, 0.04, 0.17], [Math.PI / 2, 0, 0]);               // 舷窗
    part(g, GEO.thin, M.brass2, [0, 0.16, 0.27], [0.17, 0.17, 0.5]);
    for (const x of [-1, 1]) part(g, GEO.ico, M.glowAmber, [x * 0.07, 0.17, 0.27], [0.04, 0.04, 0.02]); // 亮眼
    part(g, GEO.cyl, M.bossInner, [0.1, 0.5, -0.02], [0.06, 0.24, 0.06]);                            // 煙囪
    part(g, GEO.cyl, M.dark, [0.1, 0.63, -0.02], [0.08, 0.04, 0.08]);
    for (const x of [-1, 1]) {
      rod(g, M.bossInner, [x * 0.34, -0.12], [x * 0.46, -0.45], 0.06, 0.04);                        // 管子手臂
      part(g, GEO.ico, M.bossHead, [x * 0.47, -0.5, 0.05], 0.1);                                       // 鉗子手
      part(g, GEO.box, M.bossInner, [x * 0.18, -0.7, 0.02], [0.14, 0.2, 0.16]);                        // 腳
      for (let k = 0; k < 3; k++) part(g, GEO.ico, M.brass2, [x * 0.26, -0.18 - k * 0.14, 0.23], 0.022); // 鉚釘
    }
  }, [0, 0, 0.3], 1.25);
}

/* ---------------- 玩家:小飛行員(10 段) ----------------
 * 皮夾克 + 飛行帽 + 帽子上的黃銅護目鏡 + 右手鉚釘槍。每一段加零件:
 *   Lv2 紅圍巾、Lv3 背上的蒸汽背包、Lv4 黃銅肩甲、Lv5 胸前的壓力錶 + 金腰帶、Lv6 背包上的螺旋槳、
 *   Lv7 紅銅小翅膀、Lv8 蒸汽光暈、Lv9 帽子上的金齒輪、Lv10 身後一圈大齒輪光環。
 * 'ally' = 機械貓頭鷹(黃銅身體 + 兩顆大玻璃眼)。 */
export const SHIP_LV = [
  { name: '見習飛行員', body: 0x8a5a3a, accent: 0xc8902a, pod: 0xc83a2a, flame: 0xfff0d8, span: 1.0 },
  { name: '學徒飛行員', body: 0x8a5a3a, accent: 0xc8902a, pod: 0xc83a2a, flame: 0xfff0d8, span: 1.02 },
  { name: '三等飛行員', body: 0x7a4a2e, accent: 0xc8902a, pod: 0xc83a2a, flame: 0xfff0d8, span: 1.04 },
  { name: '二等飛行員', body: 0x7a4a2e, accent: 0xd8a03a, pod: 0xb8302a, flame: 0xfff0d8, span: 1.06 },
  { name: '一等飛行員', body: 0x6a3e26, accent: 0xd8a03a, pod: 0xb8302a, flame: 0xfff4e0, span: 1.08 },
  { name: '王牌飛行員', body: 0x6a3e26, accent: 0xe8b84a, pod: 0xa82a3a, flame: 0xfff4e0, span: 1.1 },
  { name: '飛行隊長', body: 0x5a3420, accent: 0xe8b84a, pod: 0xa82a3a, flame: 0xfff8e8, span: 1.12 },
  { name: '天空艦長', body: 0x5a3420, accent: 0xffc850, pod: 0x8a2a4a, flame: 0xfff8e8, span: 1.14 },
  { name: '傳說艦長', body: 0x4a2a1a, accent: 0xffd060, pod: 0x8a2a4a, flame: 0xffffff, span: 1.16 },
  { name: '天空之王', body: 0x3a2014, accent: 0xffe070, pod: 0x6a1a5a, flame: 0xffffff, span: 1.2 },
];

function pilotBody(m, L) {
  return (b) => {
    chibi(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: M.leather2, face: M.skin, head: M.leather, boots: M.dark, big: 1.3,
      extra(g, hg) {
        part(hg, GEO.ico2, M.leather, [0, 0.09, -0.03], [0.33, 0.3, 0.31]);                               // 飛行帽
        for (const x of [-1, 1]) part(hg, GEO.ico2, M.leather, [x * 0.27, -0.08, 0.02], [0.08, 0.16, 0.12]); // 護耳
        for (const x of [-1, 1]) part(hg, GEO.ico2, M.hair, [x * 0.2, -0.16, 0.14], [0.07, 0.07, 0.06]);    // 露出的頭髮
        part(hg, GEO.box, M.leather2, [0, 0.2, 0.2], [0.5, 0.05, 0.1]);                                     // 護目鏡帶
        for (const x of [-1, 1]) {
          part(hg, GEO.cyl, m.brass, [x * 0.1, 0.21, 0.26], [0.085, 0.07, 0.085], [Math.PI / 2 - 0.3, 0, 0]); // 黃銅護目鏡
          part(hg, GEO.disc, M.glass, [x * 0.1, 0.225, 0.3], 0.06, [-0.3, 0, 0]);
        }
        part(g, GEO.box, M.cream, [0, -0.12, 0.2], [0.14, 0.26, 0.02]);                                      // 襯衫
        // 鉚釘槍
        const gun = new THREE.Group(); gun.position.set(0.36, -0.3, 0.12); g.add(gun);
        part(gun, GEO.cyl, m.brass, [0, 0.12, 0], [0.05, 0.3, 0.05]);
        part(gun, GEO.cyl, M.dark, [0, 0.29, 0], [0.035, 0.05, 0.035]);
        part(gun, GEO.ico, M.leather2, [0, -0.04, 0], [0.05, 0.08, 0.05]);
        if (L >= 2) {                                                                                        // 紅圍巾
          part(hg, GEO.torus, m.blue, [0, -0.3, 0.03], [0.22, 0.22, 0.5], [Math.PI / 2, 0, 0]);
          part(g, GEO.box, m.blue, [-0.22, -0.02, 0.1], [0.1, 0.3, 0.03], [0.2, 0, 0.5]);
        }
        if (L >= 3) for (const x of [-1, 1]) {                                                               // 蒸汽背包
          part(g, GEO.cyl, m.brass, [x * 0.12, -0.16, -0.26], [0.1, 0.42, 0.1]);
          part(g, GEO.cone, M.iron2, [x * 0.12, -0.42, -0.26], [0.08, 0.1, 0.08], [Math.PI, 0, 0]);
        }
        if (L >= 4) for (const x of [-1, 1]) part(g, GEO.ico2, m.brass, [x * 0.3, -0.07, 0.02], [0.13, 0.09, 0.12]); // 黃銅肩甲
        if (L >= 5) {
          part(g, GEO.cyl, M.gold, [0, -0.36, 0], [0.27, 0.05, 0.23]);                                       // 金腰帶
          part(g, GEO.cyl, M.cream, [0.12, -0.18, 0.22], [0.06, 0.02, 0.06], [Math.PI / 2, 0, 0]);         // 壓力錶
          part(g, GEO.thin, M.gold, [0.12, -0.18, 0.23], [0.06, 0.06, 0.3]);
        }
        if (L >= 6) {                                                                                        // 背包上的螺旋槳
          part(g, GEO.cyl, M.iron2, [0, 0.12, -0.3], [0.025, 0.2, 0.025]);
          for (let i = 0; i < 3; i++) part(g, GEO.box, m.brass, [0, 0.23, -0.3], [0.5, 0.02, 0.07], [0, i * 1.047, 0]);
        }
        if (L >= 7) for (const x of [-1, 1]) part(g, GEO.cone, M.copper, [x * 0.38, 0.02, -0.18], [0.1, 0.4, 0.03], [0, 0, -x * 1.1]); // 紅銅小翅膀
        if (L >= 9) gear(hg, M.gold, [0, 0.3, 0.12], 0.12, 8, 0.05, M.red);                                   // 帽子上的金齒輪
      },
    });
  };
}
/** 機械貓頭鷹(僚機):黃銅圓身體 + 兩顆大玻璃眼 + 耳羽 + 摺起來的翅膀 + 胸口齒輪 */
function owlBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, M.brass, [0, -0.25, 0], [0.34, 0.4, 0.3]);                                     // 身體
    part(g, GEO.ico2, M.cream, [0, -0.3, 0.18], [0.22, 0.28, 0.15]);                                // 肚子
    for (let i = 0; i < 3; i++) part(g, GEO.halfRing, M.copper, [0, -0.2 - i * 0.12, 0.3], [0.12, 0.06, 0.2], [0, 0, Math.PI]); // 羽毛紋
    part(g, GEO.ico2, M.brass, [0, 0.22, 0.02], [0.3, 0.26, 0.26]);                                  // 頭
    for (const x of [-1, 1]) {
      part(g, GEO.cyl, M.copper, [x * 0.13, 0.24, 0.2], [0.12, 0.08, 0.12], [Math.PI / 2, 0, 0]);   // 眼框
      part(g, GEO.disc, M.lamp, [x * 0.13, 0.24, 0.25], 0.085);                                      // 玻璃眼(會亮)
      part(g, GEO.disc, M.eye, [x * 0.13, 0.24, 0.26], 0.035);
      part(g, GEO.cone, M.copper, [x * 0.2, 0.46, 0], [0.06, 0.18, 0.05], [0, 0, -x * 0.4]);        // 耳羽
      part(g, GEO.ico2, M.copper, [x * 0.32, -0.25, -0.02], [0.08, 0.3, 0.16], [0, 0, x * 0.15]);   // 摺起來的翅膀
      part(g, GEO.box, M.iron2, [x * 0.1, -0.68, 0.06], [0.1, 0.05, 0.12]);                          // 爪子
    }
    part(g, GEO.cone, M.gold, [0, 0.14, 0.28], [0.04, 0.08, 0.04], [Math.PI + 0.4, 0, 0]);           // 嘴
    gear(g, M.gold, [0, -0.08, 0.3], 0.08, 8, 0.04);                                                  // 胸口齒輪
  }, [0, 0, 0.3], 1.3);
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1, ally = false) {
  return template(ally ? owlBody : pilotBody(m, L), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下的蒸汽噴射
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], m.flame || 0xfff0d8, [0.1, L >= 8 ? 0.45 : 0.3, 0.08], L >= 8 ? 0.8 : 0.5);
    if (ally) return;
    if (L >= 10) {                                                                                         // 大齒輪光環
      const h = new THREE.Group(); h.name = 'halo'; h.position.set(0, 0.4, -0.25); rig.add(h);
      gear(h, flat({ color: 0xffd060 }), [0, 0, 0], 0.95, 16, 0.04, flat({ color: 0xc8902a }));
      part(h, GEO.disc, flat({ color: 0x3a2014 }), [0, 0, 0.03], 0.62);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xfff0d0 : 0xffe0a0, transparent: true, opacity: L >= 10 ? 0.16 : 0.11, blending: THREE.AdditiveBlending, depthWrite: false }));
      a.name = 'aura'; a.scale.set(0.9, 1.1, 0.45); rig.add(a);
    }
  }, { shadow: [0.5, 0.4], upright: true });
}
function evolvedShip(L, ally = false) {
  const c = SHIP_LV[L - 1];
  return shipTemplate({ white: C(0xf0e8d8), red: C(c.body), blue: C(c.pod), brass: C(c.accent), flame: c.flame }, L, ally);
}
function addFlame(rig, pos, color, scl, opacity = 0.9) {
  const fm = flat({ color, transparent: true, opacity, depthWrite: false });
  const f = part(rig, GEO.cone, fm, pos, scl, [0, 0, Math.PI]);
  f.name = 'flame';
  return f;
}

/* ---------------- 巨大機械(面朝玩家) ---------------- */
const BM = {
  whale: C(0x4a6478), whale2: C(0x2e4252), belly: C(0xc8c0a8), fin: cel({ color: 0x3a5468, bands: 2, side: THREE.DoubleSide, tint: 0x6a4a3a }),
  brick: C(0x9a4a32), brick2: C(0x6a3024), roof: C(0x3a5a5a), face: C(0xf4e8c8),
  balloon: C(0x8a3a2a), balloon2: C(0x6a2a20), gondola: C(0x5a3a22), sail: cel({ color: 0x2a2420, bands: 2, side: THREE.DoubleSide, tint: 0x6a4a3a }),
  watch: C(0xffc830), watch2: C(0xd89a20), bomb: C(0x2a2a30),
  steam: new THREE.MeshBasicMaterial({ color: 0xfff4e8, transparent: true, opacity: 0.55, depthWrite: false }),
  fire: new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
};

/** 機械巨鯨:鐵灰藍的大鯨魚面朝玩家(黃銅箍 + 一排亮著的舷窗 + 大嘴),尾鰭和胸鰭會拍,頭上噴蒸汽 */
function whaleBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.whale, [0, 0, 0], [1.25, 1.05, 1.0]);                                            // 大身體
    part(g, GEO.ico2, BM.belly, [0, -0.45, 0.45], [0.95, 0.55, 0.55]);                                    // 肚子
    for (let i = 0; i < 5; i++) part(g, GEO.box, BM.whale2, [0, -0.25 - i * 0.12, 0.93 - i * 0.03], [0.9 - i * 0.12, 0.025, 0.03]); // 肚子的溝
    for (const y of [0.25, -0.1]) part(g, GEO.torus, M.brass, [0, y, 0], [1.2, 1.2, 0.35], [Math.PI / 2, 0, 0]); // 黃銅箍
    for (let i = 0; i < 5; i++) {                                                                           // 一排舷窗
      const x = (i - 2) * 0.38;
      part(g, GEO.disc, M.lamp, [x, 0.5, 0.86 - Math.abs(i - 2) * 0.12], 0.1);
      part(g, GEO.thin, M.brass2, [x, 0.5, 0.87 - Math.abs(i - 2) * 0.12], [0.11, 0.11, 0.4]);
    }
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.cream, [x * 0.55, 0.1, 0.85], [0.14, 0.12, 0.08]);                              // 眼
      part(g, GEO.ico, M.eye, [x * 0.55, 0.1, 0.92], 0.06);
      part(g, GEO.box, BM.whale2, [x * 0.55, 0.25, 0.88], [0.26, 0.05, 0.04], [0, 0, x * 0.3]);
    }
    part(g, GEO.halfRing, M.dark, [0, -0.12, 0.95], [0.6, 0.25, 0.4], [0, 0, Math.PI]);                   // 大嘴
    part(g, GEO.cyl, M.iron2, [0, 1.05, 0], [0.15, 0.3, 0.15]);                                            // 頭上的噴氣孔
    part(g, GEO.cyl, M.brass, [0, 1.2, 0], [0.2, 0.06, 0.2]);
  }, [0, 0.4, 0.8], 1.6);
}
function whaleExtras(rig) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.15); s.quadraticCurveTo(0.9, 0.4, 1.4, -0.1); s.quadraticCurveTo(0.9, -0.2, 0.7, -0.5); s.quadraticCurveTo(0.4, -0.15, 0, -0.15);
  const fg = new THREE.ShapeGeometry(s);
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(fg, BM.fin);
    f.name = 'flag'; f.userData.side = side; f.userData.amp = 0.35; f.userData.freq = 1.1;
    f.position.set(side * 1.7, -0.2, 0.6); f.scale.set(side * 1.3, 1.3, 1); f.rotation.x = LEAN;
    rig.add(f);
  }
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) {                                                                             // 一圈小螺旋槳
    const a = i / 8 * Math.PI * 2, p = new THREE.Group(); p.position.set(Math.cos(a) * 3.2, Math.sin(a) * 3.0 + 0.4, 0.9); spin.add(p);
    part(p, GEO.cyl, M.iron2, [0, 0, 0], [0.1, 0.18, 0.1], [Math.PI / 2, 0, 0]);
    for (let k = 0; k < 3; k++) part(p, GEO.box, M.brass, [0, 0, 0.1], [0.55, 0.08, 0.03], [0, 0, k * 1.047 + a]);
  }
  rig.add(spin);
  for (const x of [-0.25, 0.25]) part(rig, GEO.cone, BM.steam, [x, 2.4, 0.9], [0.25, 0.8, 0.2]);       // 噴出來的蒸汽
}
/** 鐘樓巨人:紅磚的高塔身體 + 大鐘面(指針)+ 綠銅尖頂 + 鐘面上方兩顆亮眼 + 管子手臂 */
function clockBody(b) {
  standing(b, (g) => {
    part(g, GEO.box, BM.brick, [0, -0.35, 0], [1.3, 1.9, 0.9]);                                            // 塔身
    for (let i = 0; i < 6; i++) part(g, GEO.box, BM.brick2, [0, -1.2 + i * 0.3, 0.46], [1.32, 0.03, 0.02]); // 磚縫
    part(g, GEO.box, BM.brick2, [0, 0.7, 0], [1.45, 0.2, 1.0]);                                           // 塔簷
    part(g, GEO.cone, BM.roof, [0, 1.35, 0], [0.95, 1.1, 0.75], [0, Math.PI / 4, 0]);                     // 綠銅尖頂
    part(g, GEO.ico, M.gold, [0, 1.95, 0], 0.1);
    part(g, GEO.cyl, BM.face, [0, 0.0, 0.48], [0.52, 0.06, 0.52], [Math.PI / 2, 0, 0]);                   // 大鐘面
    part(g, GEO.torus, M.brass, [0, 0.0, 0.52], [0.54, 0.54, 0.4]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; part(g, GEO.box, M.dark, [Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0.53], [i % 3 ? 0.03 : 0.06, 0.09, 0.02], [0, 0, a + Math.PI / 2]); }
    rod(g, M.dark, [0, 0], [0.0, 0.34], 0.03, 0.55);                                                       // 指針
    rod(g, M.dark, [0, 0], [0.26, -0.08], 0.035, 0.55);
    part(g, GEO.ico, M.red, [0, 0, 0.57], 0.05);
    for (const x of [-1, 1]) {
      part(g, GEO.disc, M.glowAmber, [x * 0.3, 0.72, 0.52], 0.1);                                          // 亮眼
      rod(g, M.iron, [x * 0.65, 0.2], [x * 1.25, -0.5], 0.12, 0.2);                                       // 管子手臂
      part(g, GEO.torus, M.brass, [x * 0.95, -0.15, 0.2], [0.14, 0.14, 0.4], [0, 0, x * 0.85]);
      part(g, GEO.ico2, M.iron2, [x * 1.3, -0.62, 0.25], [0.28, 0.24, 0.24]);                             // 大拳頭
      part(g, GEO.box, BM.brick2, [x * 0.4, -1.45, 0.05], [0.4, 0.3, 0.6]);                               // 腳
    }
  }, [0, 0.4, 0.8], 1.6);
}
function gearRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; gear(spin, i % 2 ? M.brass : M.copper, [Math.cos(a) * 3.1, Math.sin(a) * 2.9 + 0.4, 0.9], 0.34, 8, 0.1); }
  rig.add(spin);
}
/** 海盜飛艇:紅棕色的大氣球 + 黃銅肋條 + 骷髏徽章 + 吊艙 + 尾翼 */
function zeppelinBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.balloon, [0, 0.35, 0], [1.3, 0.9, 1.0]);                                          // 氣球
    for (const x of [-0.7, 0, 0.7]) part(g, GEO.torus, M.brass, [x, 0.35, 0], [0.9 - Math.abs(x) * 0.35, 0.9 - Math.abs(x) * 0.35, 0.3], [0, Math.PI / 2, 0]); // 肋條
    part(g, GEO.box, BM.balloon2, [0, 0.35, 0.99], [1.2, 0.04, 0.03]);
    part(g, GEO.disc, M.white, [0, 0.45, 1.0], 0.28);                                                      // 骷髏徽章
    for (const x of [-1, 1]) part(g, GEO.disc, M.dark, [x * 0.1, 0.5, 1.01], 0.07);
    part(g, GEO.box, M.dark, [0, 0.33, 1.01], [0.2, 0.04, 0.01]);
    part(g, GEO.box, BM.gondola, [0, -0.72, 0.25], [1.2, 0.36, 0.6]);                                     // 吊艙
    for (let i = 0; i < 4; i++) part(g, GEO.disc, M.lamp, [(i - 1.5) * 0.28, -0.7, 0.56], 0.07);         // 吊艙的窗
    for (const x of [-0.45, 0.45]) rod(g, M.dark, [x, -0.55], [x * 1.4, 0.0], 0.02, 0.25);               // 吊索
    for (const x of [-1, 1]) {
      part(g, GEO.cyl, M.iron, [x * 0.75, -0.72, 0.4], [0.1, 0.4, 0.1], [Math.PI / 2, 0, 0]);             // 大砲
      part(g, GEO.cone, BM.balloon2, [x * 1.35, 0.35, -0.3], [0.1, 0.6, 0.4], [0, 0, -x * Math.PI / 2]);  // 尾翼
    }
  }, [0, 0.4, 0.8], 1.6);
}
function zeppelinExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; part(spin, GEO.ico2, BM.bomb, [Math.cos(a) * 3.2, Math.sin(a) * 3.0 + 0.4, 0.9], 0.24); part(spin, GEO.cone, BM.fire, [Math.cos(a) * 3.2, Math.sin(a) * 3.0 + 0.7, 0.9], [0.06, 0.15, 0.06]); }
  rig.add(spin);
  for (const side of [-1, 1]) {                                                                            // 兩面黑帆(會飄)
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7).translate(0.45, 0, 0), BM.sail);
    f.name = 'flag'; f.userData.amp = 0.3; f.userData.freq = 2;
    f.position.set(side * 1.9, -0.8, 0.8); f.scale.set(side, 1, 1); f.rotation.x = LEAN;
    rig.add(f);
  }
}
/** 黃金懷錶(獎勵關):金色的大懷錶 + 奶油色錶面 + 指針 + 上面的龍頭和鍊子,周圍繞著一圈小齒輪 */
function watchBody(b) {
  standing(b, (g) => {
    part(g, GEO.cyl, BM.watch2, [0, 0, 0], [1.0, 0.24, 1.0], [Math.PI / 2, 0, 0]);                        // 錶殼
    part(g, GEO.torus, BM.watch, [0, 0, 0.13], [1.0, 1.0, 0.5]);
    part(g, GEO.disc, BM.face, [0, 0, 0.13], 0.86);                                                       // 錶面
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; part(g, GEO.box, M.dark, [Math.cos(a) * 0.72, Math.sin(a) * 0.72, 0.15], [0.04, 0.12, 0.02], [0, 0, a + Math.PI / 2]); }
    rod(g, M.dark, [0, 0], [0.0, 0.6], 0.03, 0.17);
    rod(g, M.dark, [0, 0], [0.42, -0.1], 0.04, 0.17);
    gear(g, BM.watch2, [-0.35, -0.35, 0.14], 0.18, 8, 0.03);                                             // 錶面上看得到的小齒輪
    part(g, GEO.cyl, BM.watch, [0, 1.12, 0], [0.14, 0.26, 0.14]);                                          // 龍頭
    part(g, GEO.torus, BM.watch, [0, 1.38, 0], [0.18, 0.18, 0.5]);                                        // 吊環
  }, [0, 0.2, 0.6], 1.5);
}
function smallGearRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; gear(spin, i % 2 ? BM.watch : BM.watch2, [Math.cos(a) * 2.3, Math.sin(a) * 2.2, 0.5], 0.22, 8, 0.06); }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'whale') return template(whaleBody, 1.5, whaleExtras, { shadow: [1.8, 1.4] });
  if (kind === 'clock') return template(clockBody, 1.5, gearRing, { shadow: [1.6, 1.3] });
  if (kind === 'zeppelin') return template(zeppelinBody, 1.5, zeppelinExtras, { shadow: [1.8, 1.4] });
  return template(watchBody, 1.4, smallGearRing, { shadow: [1.4, 1.1] });
}

/* ---------------- 滾來的齒輪(原本的隕石):黃銅大齒輪 + 冒出來的蒸汽 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  gear(body, M.brass, [0, 0, 0], 0.5, 10, 0.2, M.copper);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; part(body, GEO.box, M.copper, [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.1], [0.08, 0.2, 0.04], [0, 0, a + Math.PI / 2]); }
  rig.add(bake(body));
  const tail = part(rig, GEO.cone, BM.steam, [0, -0.9, -0.2], [0.3, 0.9, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';
  addShadow(root, 0.5, 0.45);
  return root;
}

const TEMPLATES = {
  bee: template(tinSoldier, 1.62, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(dragonfly, 1.6, (rig) => flyWings(rig, 1), { shadow: [0.4, 0.3], upright: true }),
  boss: template(steamBot, 1.42, null, { shadow: [0.55, 0.45], upright: true }),
  captive: shipTemplate({ white: M.capWhite, red: M.capRed, blue: M.capBlue, brass: M.brass }),
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
 * clone 共用 geometry / material;要換色(機器人被打)就換單一 mesh 的 material。
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

/* ---------------- 道具:黃銅齒輪幣(彩色的琺瑯 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xe8402a, name: '火力' },
  R: { label: 'R', color: 0x3ac8c8, name: '連發' },
  S: { label: 'S', color: 0x5ab84a, name: '護盾' },
  B: { label: 'B', color: 0x9a5ad8, name: '蒸汽炸彈' },
  W: { label: 'W', color: 0xf0e8d8, name: '機械貓頭鷹' },
  L: { label: '1UP', color: 0xffc830, name: '紅茶' },
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
  draw('#1e140c', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  gear(body, M.brass, [0, 0, 0.2], 0.42, 10, 0.12);                                                       // 黃銅齒輪
  part(body, GEO.cyl, C(it.color, 2), [0, 0, 0.28], [0.3, 0.04, 0.3], [Math.PI / 2, 0, 0]);              // 彩色琺瑯
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

/** 玩家:黃銅鉚釘(圓柱 + 亮亮的釘頭,不透明 → 會被描上深棕色的線) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.cyl6, [0, 0.0, 0], [0.08, 0.36, 0.08]), SHOT_MAT],
    [geoAt(GEO.ico, [0, 0.2, 0.02], [0.12, 0.08, 0.08]), SHOT_TIP],
  ], cap);
}
/** 敵彈:燒紅的煤球(發光 + 黃色核心) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico2, [0, 0, 0], [0.21, 0.21, 0.14]), EB_MAT],
    [geoAt(GEO.ico, [0, 0, 0.08], [0.1, 0.1, 0.06]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
