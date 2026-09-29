import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 美漫英雄的角色:Q 版大頭、原色緊身衣、披風、胸前的徽章。全部用基本幾何體拼出來(沒有模型檔)。
 * 陰影面會自動變成網點(palette.js TOON),所以這裡只管固有色:用飽和的原色,不要灰撲撲的。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:角色在自己的座標系裡站立(頭 +y、臉 +z),整個再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家。角色模型「不跟著前進方向旋轉」(userData.upright)。
 * 內部型別沿用原本的名字:bee = 機器人小兵、bfly = 噴射背包打手、boss = 大塊頭打手(打兩下)、rock = 滾來的油桶。
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
  star: extrudeStar(0.42, 0.3),
  bolt: extrudeBolt(),
};
function extrudeStar(inner, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? inner : 1;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).translate(0, 0, -depth / 2);
}
/** 閃電徽章:一道斜斜的 Z 字閃電 */
function extrudeBolt() {
  const s = new THREE.Shape();
  [[0.25, 1], [-0.45, -0.05], [0.0, -0.05], [-0.25, -1], [0.45, 0.12], [0.02, 0.12], [0.25, 1]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }).translate(0, 0, -0.15);
}

const C = (color, bands = 3) => cel({ color, bands });
const M = {
  skin: C(PAL.skin), hair: C(PAL.hair, 2), eye: flat({ color: 0x101018 }), eyeW: flat({ color: 0xffffff }), cheek: flat({ color: 0xff8a8a }),
  white: C(0xf8f8f8), red: C(0xe8202a), blue: C(0x2050d8), yellow: C(0xffd020), gold: C(0xffc020), black: C(0x1a1a24, 2),
  steel: C(0xb8c4d8), dark: C(0x2a2a3a, 2), green: C(0x3ab04a), purple: C(0x8a3ad8), pink: C(0xff8ab8), orange: C(0xff8a20),
  visor: flat({ color: 0xff3a3a }), glow: flat({ color: 0x9af0ff }), lamp: flat({ color: 0xfff8c0 }),
  // 機器人小兵
  robot: C(PAL.beeBody), robot2: C(PAL.beeBelly),
  // 噴射背包打手
  goon: C(PAL.bflyBody), goon2: C(PAL.bflyHead),
  // 大塊頭打手(搶匪條紋衫 + 黑毛帽;被打一下衣服變粉紅、臉氣到發紅)
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.skin),
  bossHit: C(PAL.bossHit), bossHitHead: C(0x6a1a2a), bossHitInner: C(0xff5a4a),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 大塊頭被打第一下之後換色用的對照表 */
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
const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: 0x101018, transparent: true, opacity: 0.28, depthWrite: false });
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

/* ---------------- 字的貼圖(看板 / 運鈔車):canvas 畫字,漫畫字體 ---------------- */
const texCache = new Map();
export function comicTex(text, bg, fg = '#101018', w = 256, h = 128, stroke = null) {
  const k = [text, bg, fg, w, h, stroke].join('|');
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = '#101018'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); }
  let fs = Math.round(h * 0.62);
  g.font = `900 ${fs}px Bangers,"Arial Black",Impact,sans-serif`;
  const tw = g.measureText(text).width;
  if (tw > w * 0.86) { fs = Math.floor(fs * w * 0.86 / tw); g.font = `900 ${fs}px Bangers,"Arial Black",Impact,sans-serif`; } // 字太長就縮小,不要被切掉
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = h * 0.08; g.strokeStyle = stroke; g.strokeText(text, w / 2, h / 2 + 4); }
  g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

/* ---------------- Q 版人偶 ----------------
 * 在人偶自己的座標系裡蓋(站姿:頭 +y、臉 +z),最後整組往後仰 LEAN,放到 at。
 * o:{ body, pants, head(帽 / 髮)、face(膚色)、boots、gloves、big、extra(g, hg) } */
function chibi(b, at, s, o) {
  const g = new THREE.Group();
  part(g, GEO.ico, o.pants || o.body, [0, -0.5, 0], [0.24, 0.2, 0.2]);                    // 下半身
  part(g, GEO.ico, o.body, [0, -0.2, 0], [0.27, 0.26, 0.22]);                             // 身體
  for (const x of [-1, 1]) {
    part(g, GEO.ico, o.body, [x * 0.29, -0.22, 0.02], [0.09, 0.17, 0.09], [0, 0, x * 0.35]); // 手臂
    if (o.gloves) part(g, GEO.ico, o.gloves, [x * 0.34, -0.36, 0.04], [0.08, 0.08, 0.08]);  // 手套
    part(g, GEO.ico, o.boots || M.dark, [x * 0.11, -0.7, 0.02], [0.08, 0.09, 0.1]);         // 靴子
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
/** 眼罩(英雄的黑色面具,露出白色的眼睛) */
function mask(hg, mat = M.black, z = 0.3) {
  part(hg, GEO.box, mat, [0, 0.0, z], [0.4, 0.12, 0.08]);
  for (const x of [-1, 1]) {
    part(hg, GEO.cone, mat, [x * 0.2, 0.02, z - 0.02], [0.05, 0.1, 0.04], [0, 0, -x * Math.PI / 2]);   // 面具的尖角
    part(hg, GEO.ico, M.eyeW, [x * 0.09, 0.0, z + 0.042], [0.055, 0.04, 0.02]);
  }
}

/* ---------------- 機器人小兵(bee):方塊身體 + 圓頂頭 + 紅色眼罩燈 + 天線 + 夾子手 ---------------- */
function robot(b) {
  standing(b, (g) => {
    part(g, GEO.box, M.robot, [0, -0.25, 0], [0.5, 0.42, 0.34]);
    part(g, GEO.box, M.robot2, [0, -0.25, 0.18], [0.3, 0.24, 0.02]);                               // 胸前面板
    [0xff3a3a, 0xffd020, 0x3ad86a].forEach((c, i) => part(g, GEO.box, flat({ color: c }), [-0.08 + i * 0.08, -0.2, 0.2], [0.05, 0.05, 0.02]));
    part(g, GEO.ico2, M.robot, [0, 0.16, 0], [0.3, 0.26, 0.26]);                                    // 圓頂頭
    part(g, GEO.box, M.dark, [0, 0.16, 0.2], [0.42, 0.1, 0.12]);
    part(g, GEO.box, M.visor, [0, 0.16, 0.265], [0.36, 0.05, 0.02]);                                // 紅色眼罩燈
    rod(g, M.dark, [0, 0.4], [0.06, 0.62], 0.015);                                                  // 天線
    part(g, GEO.ico, M.visor, [0.07, 0.64, 0], 0.045);
    for (const x of [-1, 1]) {
      part(g, GEO.cyl, M.robot2, [x * 0.32, -0.25, 0.02], [0.06, 0.26, 0.06], [0, 0, x * 0.3]);   // 手臂
      for (const k of [-1, 1]) part(g, GEO.cone, M.dark, [x * 0.38 + k * 0.035, -0.42, 0.04], [0.03, 0.1, 0.03], [0, 0, Math.PI + k * 0.4]); // 夾子
      part(g, GEO.box, M.robot2, [x * 0.12, -0.55, 0], [0.12, 0.18, 0.14]);                        // 腳
      part(g, GEO.box, M.dark, [x * 0.12, -0.66, 0.03], [0.16, 0.06, 0.2]);
    }
  });
}

/* ---------------- 噴射背包打手(bfly):紫色連身衣 + 護目鏡 + 背上的噴射背包(噴火),飛過來 ---------------- */
function goon(b) {
  chibi(b, [0, 0, 0.3], 1, {
    body: M.goon, pants: M.goon2, head: M.goon2, gloves: M.yellow, boots: M.dark, noFace: true,
    extra(g, hg) {
      for (const x of [-1, 1]) {                                                                          // 護目鏡
        part(hg, GEO.cyl, M.dark, [x * 0.1, 0.0, 0.27], [0.08, 0.06, 0.08], [Math.PI / 2, 0, 0]);
        part(hg, GEO.cyl, M.glow, [x * 0.1, 0.0, 0.3], [0.06, 0.02, 0.06], [Math.PI / 2, 0, 0]);
      }
      part(hg, GEO.box, M.dark, [0, -0.13, 0.27], [0.12, 0.025, 0.02]);                                   // 壞笑
      part(g, GEO.box, M.yellow, [0, -0.2, 0.21], [0.12, 0.12, 0.02], [0, 0, Math.PI / 4]);             // 胸前的菱形徽章
      for (const x of [-1, 1]) part(g, GEO.cyl, M.steel, [x * 0.12, -0.2, -0.25], [0.09, 0.4, 0.09]);    // 噴射背包
    },
  });
}

/* ---------------- 大塊頭打手(boss):黑白條紋搶匪衫 + 黑毛帽 + 眼罩 + 大拳頭,打兩下 ---------------- */
function thug(b) {
  chibi(b, [0, 0, 0.25], 1.25, {
    body: M.bossBody, pants: M.dark, face: M.bossInner, head: M.bossHead, gloves: M.bossInner, noFace: true,
    extra(g, hg) {
      for (let i = 0; i < 4; i++) part(g, GEO.cyl, M.black, [0, -0.06 - i * 0.09, 0], [0.28 - Math.abs(i - 1.5) * 0.02, 0.035, 0.235]); // 條紋
      part(hg, GEO.ico2, M.bossHead, [0, 0.14, -0.04], [0.33, 0.24, 0.31]);                               // 毛帽
      part(hg, GEO.cyl, M.bossHead, [0, 0.06, -0.04], [0.33, 0.07, 0.31]);
      mask(hg, M.black);
      for (const x of [-1, 1]) part(hg, GEO.ico, M.eye, [x * 0.09, 0.0, 0.355], 0.022);
      part(hg, GEO.box, M.black, [0, -0.14, 0.3], [0.14, 0.03, 0.02]);                                   // 嘴
      part(hg, GEO.ico2, M.bossInner, [0, -0.2, 0.2], [0.2, 0.1, 0.12]);                                   // 大下巴
      for (const x of [-1, 1]) part(g, GEO.ico2, M.bossBody, [x * 0.32, -0.1, 0.02], [0.15, 0.12, 0.13]); // 大肩膀
      for (const x of [-1, 1]) part(g, GEO.ico2, M.bossInner, [x * 0.38, -0.38, 0.06], 0.12);             // 大拳頭
      part(g, GEO.ico2, M.white, [-0.46, -0.1, -0.1], [0.16, 0.2, 0.14]);                                  // 背著的錢袋
      part(g, GEO.box, M.green, [-0.46, -0.12, 0.05], [0.08, 0.08, 0.01]);
    },
  });
}

/* ---------------- 玩家:驚奇小子(10 段英雄等級) ----------------
 * 紅色緊身衣 + 黑色眼罩 + 胸前閃電徽章 + 黃手套。每一段加零件:
 *   Lv2 藍披風、Lv3 黃色腰帶、Lv4 黃色靴口、Lv5 徽章外一圈白圓、Lv6 肩甲、
 *   Lv7 頭側的小翅膀、Lv8 金色能量光、Lv9 金邊、Lv10 一圈星星光環。
 * 'ally' = 超級狗狗(白狗 + 紅披風 + 紅眼罩)。 */
export const SHIP_LV = [
  { name: '新手英雄', body: 0xe8202a, accent: 0xffd020, pod: 0x2050d8, flame: 0xfff080, span: 1.0 },
  { name: '見習英雄', body: 0xe8202a, accent: 0xffd020, pod: 0x2050d8, flame: 0xfff080, span: 1.02 },
  { name: '街頭英雄', body: 0xe8202a, accent: 0xffd020, pod: 0x1a44c8, flame: 0xfff080, span: 1.04 },
  { name: '城市守護者', body: 0xe01a24, accent: 0xffd020, pod: 0x1a44c8, flame: 0xfff080, span: 1.06 },
  { name: '超級英雄', body: 0xe01a24, accent: 0xffe040, pod: 0x1a3ab8, flame: 0xfff080, span: 1.08 },
  { name: '正義隊長', body: 0xd81420, accent: 0xffe040, pod: 0x1a3ab8, flame: 0xffe060, span: 1.1 },
  { name: '傳奇英雄', body: 0xd81420, accent: 0xffe040, pod: 0x2a2aa8, flame: 0xffe060, span: 1.12 },
  { name: '宇宙英雄', body: 0xd0101c, accent: 0xfff060, pod: 0x2a2aa8, flame: 0xffd040, span: 1.14 },
  { name: '無敵英雄', body: 0xd0101c, accent: 0xfff060, pod: 0x3a1a98, flame: 0xffd040, span: 1.16 },
  { name: '究極英雄', body: 0xc8081a, accent: 0xffffff, pod: 0x3a1a98, flame: 0xffffff, span: 1.2 },
];

function heroBody(m, L, ally) {
  return (b) => {
    if (ally) {
      // 超級狗狗:白狗 + 黑耳朵 + 紅眼罩 + 紅披風
      chibi(b, [0, 0, 0.3], 1.25, {
        body: M.white, pants: M.white, face: M.white, head: M.white, boots: M.white, gloves: M.white, big: 1.3, noFace: true,
        extra(g, hg) {
          for (const x of [-1, 1]) part(hg, GEO.ico2, M.black, [x * 0.3, 0.02, -0.02], [0.08, 0.2, 0.07], [0, 0, x * 0.3]); // 垂耳
          part(hg, GEO.ico2, M.white, [0, -0.1, 0.24], [0.15, 0.11, 0.12]);                                    // 鼻口
          part(hg, GEO.ico2, M.black, [0, -0.05, 0.35], [0.06, 0.045, 0.05]);
          part(hg, GEO.ico, M.pink, [0, -0.19, 0.3], [0.05, 0.05, 0.02]);                                       // 舌頭
          mask(hg, M.red);
          for (const x of [-1, 1]) part(hg, GEO.ico, M.eye, [x * 0.09, 0.0, 0.355], 0.022);
          part(g, GEO.box, M.red, [0, -0.25, -0.2], [0.56, 0.6, 0.03], [0.2, 0, 0]);                            // 紅披風
          part(g, GEO.cyl, M.red, [0, 0.02, 0], [0.2, 0.05, 0.19]);                                              // 紅項圈
          part(g, GEO.ico, M.yellow, [0, -0.02, 0.19], 0.05);
        },
      });
      return;
    }
    chibi(b, [0, 0, 0.3], 1.25, {
      body: m.red, pants: m.blue, face: M.skin, head: M.hair, boots: m.red, gloves: M.yellow, big: 1.3, noFace: true,
      extra(g, hg) {
        part(hg, GEO.ico2, M.hair, [0.04, 0.3, 0.12], [0.08, 0.08, 0.06], [0, 0, -0.5]);                      // 額前的捲毛
        mask(hg);
        for (const x of [-1, 1]) {
          part(hg, GEO.ico, M.eye, [x * 0.09, 0.0, 0.355], 0.022);
          part(hg, GEO.box, M.black, [x * 0.1, 0.1, 0.3], [0.1, 0.025, 0.02], [0, 0, -x * 0.25]);             // 帥氣的眉
        }
        part(hg, GEO.halfRing, M.black, [0, -0.13, 0.29], [0.07, 0.05, 0.1], [0, 0, Math.PI]);                // 自信的笑
        part(g, GEO.cyl, M.yellow, [0, -0.17, 0.2], [0.13, 0.03, 0.13], [Math.PI / 2, 0, 0]);                  // 徽章底
        part(g, GEO.bolt, m.red, [0, -0.17, 0.225], [0.09, 0.1, 0.1]);                                          // 閃電
        if (L >= 2) part(g, GEO.box, m.blue, [0, -0.25, -0.2], [0.6, 0.66, 0.03], [0.2, 0, 0]);                // 藍披風
        if (L >= 3) part(g, GEO.cyl, M.yellow, [0, -0.38, 0], [0.26, 0.05, 0.22]);                              // 腰帶
        if (L >= 4) for (const x of [-1, 1]) part(g, GEO.cyl, M.yellow, [x * 0.11, -0.64, 0.02], [0.085, 0.03, 0.09]); // 靴口
        if (L >= 5) part(g, GEO.torus, M.white, [0, -0.17, 0.215], [0.15, 0.15, 0.2]);                          // 徽章的白圈
        if (L >= 6) for (const x of [-1, 1]) part(g, GEO.ico2, m.blue, [x * 0.3, -0.08, 0.02], [0.13, 0.08, 0.12]); // 肩甲
        if (L >= 7) for (const x of [-1, 1]) part(hg, GEO.cone, M.white, [x * 0.32, 0.08, -0.04], [0.05, 0.18, 0.03], [0, 0, -x * 1.1]); // 頭側的小翅膀
        if (L >= 9) for (const x of [-1, 1]) part(g, GEO.cyl, M.gold, [x * 0.3, -0.15, 0.03], [0.12, 0.02, 0.11]); // 金邊
      },
    });
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
function shipTemplate(m, L = 1, ally = false) {
  return template(heroBody(m, L, ally), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下的衝刺氣流
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], ally ? 0xffffff : m.flame, [0.1, L >= 8 ? 0.45 : 0.3, 0.08], L >= 8 ? 0.8 : 0.45);
    if (ally) return;
    if (L >= 10) {
      const h = new THREE.Group(); h.name = 'halo'; h.position.set(0, 0.5, 0.2); rig.add(h);
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        part(h, GEO.star, M.yellow, [Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0], 0.13);
      }
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xfff060 : 0xffd020, transparent: true, opacity: L >= 10 ? 0.16 : 0.11, blending: THREE.AdditiveBlending, depthWrite: false }));
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
  mech: C(0xd82a2a), mech2: C(0x5a6278), mechD: C(0x2a2e3a), core: flat({ color: 0x6af4ff }),
  brain: C(0xff8ab0), brain2: C(0xe86a94), saucer: C(0x9aa8c0), saucer2: C(0x5a6278),
  dome: new THREE.MeshBasicMaterial({ color: 0xc8f4ff, transparent: true, opacity: 0.22, depthWrite: false }),
  lizard: C(0x3ab04a), lizard2: C(0x2a8a3a), belly: C(0xd8e88a), spike: C(0xffd020), teeth: C(0xffffff),
  truck: C(0x3a6ac8), truck2: C(0x2a4a8a), glass: C(0x9ae0ff, 2), tire: C(0x1a1a24, 2), cash: C(0x3ad86a), coin: C(0xffd020),
  orb: new THREE.MeshBasicMaterial({ color: 0xff3ad8, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
};

/** 巨型機器人:紅色方塊機甲 + 青色眼睛 + 胸口反應爐 + 肩上的飛彈艙 + 大鉗手 */
function mechBody(b) {
  standing(b, (g) => {
    part(g, GEO.box, BM.mech, [0, -0.1, 0], [1.6, 1.3, 0.9]);                                   // 胸
    part(g, GEO.box, BM.mech2, [0, -0.9, 0], [1.1, 0.4, 0.7]);                                  // 腰
    part(g, GEO.cyl, BM.mechD, [0, -0.05, 0.46], [0.36, 0.06, 0.36], [Math.PI / 2, 0, 0]);
    part(g, GEO.cyl, BM.core, [0, -0.05, 0.5], [0.26, 0.04, 0.26], [Math.PI / 2, 0, 0]);       // 反應爐
    part(g, GEO.box, BM.mech2, [0, 0.8, 0], [0.8, 0.55, 0.7]);                                  // 頭
    part(g, GEO.box, BM.mechD, [0, 0.82, 0.36], [0.66, 0.2, 0.04]);
    for (const x of [-1, 1]) part(g, GEO.ico, BM.core, [x * 0.18, 0.82, 0.39], [0.1, 0.07, 0.03]); // 眼睛
    part(g, GEO.box, BM.mech, [0, 1.15, 0], [0.12, 0.2, 0.3]);                                   // 頭上的鰭
    for (const x of [-1, 1]) {
      part(g, GEO.box, BM.mech2, [x * 1.05, 0.45, 0], [0.6, 0.5, 0.7]);                          // 肩上的飛彈艙
      for (let i = 0; i < 4; i++) part(g, GEO.cyl, BM.mechD, [x * 1.05 + ((i % 2) - 0.5) * 0.22, 0.45 + (Math.floor(i / 2) - 0.5) * 0.2, 0.36], [0.07, 0.05, 0.07], [Math.PI / 2, 0, 0]);
      part(g, GEO.box, BM.mech, [x * 1.1, -0.35, 0.05], [0.36, 0.8, 0.4]);                       // 手臂
      for (const k of [-1, 1]) part(g, GEO.box, BM.mechD, [x * 1.1 + k * 0.12, -0.9, 0.1], [0.12, 0.38, 0.2], [0, 0, k * 0.3]); // 鉗子
      part(g, GEO.box, BM.mech2, [x * 0.38, -1.4, 0], [0.4, 0.7, 0.5]);                          // 腳
      part(g, GEO.box, BM.mechD, [x * 0.38, -1.78, 0.12], [0.5, 0.14, 0.7]);
    }
    for (let i = 0; i < 3; i++) part(g, GEO.box, M.yellow, [(i - 1) * 0.45, -0.9, 0.36], [0.16, 0.3, 0.02], [0, 0, 0.5]); // 警示斜條
  }, [0, 0.4, 0.8], 1.5);
}
function missileRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, m = new THREE.Group();
    m.position.set(Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9); m.rotation.z = a; spin.add(m);
    part(m, GEO.cyl, M.white, [0, 0, 0], [0.1, 0.5, 0.1]);
    part(m, GEO.cone, M.red, [0, 0.33, 0], [0.1, 0.18, 0.1]);
    part(m, GEO.cone, flat({ color: 0xffd020 }), [0, -0.35, 0], [0.08, 0.2, 0.08], [0, 0, Math.PI]);
  }
  rig.add(spin);
}
/** 外星巨腦:粉紅色的大腦 + 生氣的眼睛,裝在透明玻璃罩裡,坐在飛碟上,下面垂著觸手 */
function brainBody(b) {
  standing(b, (g) => {
    for (const [x, y, s] of [[-0.45, 0.35, 0.6], [0.45, 0.35, 0.6], [-0.25, 0.75, 0.5], [0.25, 0.75, 0.5], [0, 0.2, 0.62]]) part(g, GEO.ico2, BM.brain, [x, y, 0], [s, s * 0.85, s * 0.8]);
    for (let i = 0; i < 6; i++) part(g, GEO.torus, BM.brain2, [(i % 3 - 1) * 0.45, 0.3 + Math.floor(i / 3) * 0.4, 0.3], [0.2, 0.14, 0.4], [0.3, 0, i]); // 皺褶
    part(g, GEO.box, BM.brain2, [0, 0.45, 0.4], [0.05, 0.9, 0.2]);                                   // 中間的溝
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.eyeW, [x * 0.26, 0.12, 0.52], [0.16, 0.12, 0.08]);                         // 生氣的眼睛
      part(g, GEO.ico, M.eye, [x * 0.24, 0.1, 0.59], [0.07, 0.07, 0.03]);
      part(g, GEO.box, M.black, [x * 0.26, 0.28, 0.58], [0.3, 0.05, 0.03], [0, 0, x * 0.4]);
    }
    part(g, GEO.cyl, BM.saucer, [0, -0.45, 0], [1.6, 0.25, 1.1]);                                    // 飛碟
    part(g, GEO.cyl, BM.saucer2, [0, -0.6, 0], [1.2, 0.16, 0.9]);
    for (let i = 0; i < 7; i++) part(g, GEO.ico, i % 2 ? M.yellow : BM.core, [(i - 3) * 0.42, -0.45, 1.02 - Math.abs(i - 3) * 0.08], 0.08); // 燈
    for (let i = 0; i < 5; i++) {                                                                      // 觸手
      const x = (i - 2) * 0.4;
      for (let k = 0; k < 5; k++) part(g, GEO.ico, BM.brain2, [x + Math.sin(k * 0.9 + i) * 0.12, -0.8 - k * 0.18, 0.2], 0.1 - k * 0.012);
    }
  }, [0, 0.4, 0.8], 1.55);
}
function brainExtras(rig) {
  const d = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), BM.dome);
  d.scale.set(1.75, 1.55, 1.2); d.position.set(0, 1.0, 1.2); rig.add(d);
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.ico, BM.orb, [Math.cos(a) * 3.0, Math.sin(a) * 2.8 + 0.4, 0.9], 0.24);
  }
  rig.add(spin);
}
/** 大怪獸:綠色的大蜥蜴 + 黃色背刺 + 淺色肚子 + 一排大白牙 + 小短手,在城市裡踩來踩去 */
function kaijuBody(b) {
  standing(b, (g) => {
    part(g, GEO.ico2, BM.lizard, [0, -0.3, 0], [1.0, 1.1, 0.8]);                                     // 身體
    part(g, GEO.ico2, BM.belly, [0, -0.35, 0.5], [0.62, 0.8, 0.35]);                                 // 肚子
    for (let i = 0; i < 4; i++) part(g, GEO.box, BM.lizard2, [0, -0.1 - i * 0.28, 0.82], [0.5 - Math.abs(i - 1.5) * 0.08, 0.03, 0.02]);
    part(g, GEO.ico2, BM.lizard, [0, 0.85, 0.15], [0.7, 0.6, 0.6]);                                  // 頭
    part(g, GEO.ico2, BM.lizard, [0, 0.7, 0.6], [0.5, 0.32, 0.4]);                                   // 嘴
    part(g, GEO.box, M.black, [0, 0.6, 0.9], [0.62, 0.1, 0.1]);
    for (let i = 0; i < 6; i++) part(g, GEO.cone, BM.teeth, [(i - 2.5) * 0.1, 0.66, 0.93], [0.04, 0.09, 0.03], [Math.PI, 0, 0]);
    for (const x of [-1, 1]) {
      part(g, GEO.ico2, M.yellow, [x * 0.26, 1.02, 0.55], [0.14, 0.1, 0.08]);                        // 眼睛
      part(g, GEO.ico, M.eye, [x * 0.26, 1.0, 0.62], [0.05, 0.08, 0.03]);
      part(g, GEO.box, BM.lizard2, [x * 0.26, 1.16, 0.6], [0.26, 0.06, 0.05], [0, 0, x * 0.5]);
      part(g, GEO.ico2, BM.lizard, [x * 0.9, 0.0, 0.3], [0.3, 0.16, 0.18], [0, 0, x * 0.5]);         // 小短手
      for (let k = -1; k <= 1; k++) part(g, GEO.cone, M.white, [x * 1.15, -0.1 + k * 0.07, 0.35], [0.03, 0.08, 0.03], [0, 0, -x * Math.PI / 2]);
      part(g, GEO.ico2, BM.lizard, [x * 0.55, -1.2, 0.1], [0.36, 0.32, 0.36]);                       // 大腳
    }
    for (let i = 0; i < 5; i++) part(g, GEO.cone, BM.spike, [0, 1.25 - i * 0.45, -0.55 - Math.sin(i) * 0.1], [0.18, 0.4, 0.12], [-0.6, 0, 0]); // 背刺
    for (let k = 0; k < 5; k++) part(g, GEO.ico2, BM.lizard2, [1.0 + k * 0.28, -1.2 + Math.sin(k) * 0.2, -0.3], 0.3 - k * 0.04); // 尾巴
  }, [0, 0.4, 0.8], 1.45);
}
function rubbleRing(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2;
    part(spin, GEO.ico0, i % 2 ? M.steel : C(0xc8a878), [Math.cos(a) * 3.1, Math.sin(a) * 2.9 + 0.4, 0.9], [0.3, 0.26, 0.24], [a, a * 2, 0]);
  }
  rig.add(spin);
}
/** 運鈔車(獎勵關):藍色的車頭 + 擋風玻璃 + 水箱護罩 + 車頂的 $ 招牌 + 撒出來的鈔票 */
function truckBody(b) {
  standing(b, (g) => {
    part(g, GEO.box, BM.truck, [0, 0.2, -0.3], [2.0, 1.6, 1.4]);                                     // 車廂
    part(g, GEO.box, BM.truck2, [0, -0.5, 0.2], [2.0, 0.9, 0.9]);                                    // 車頭
    part(g, GEO.box, BM.glass, [0, 0.1, 0.42], [1.7, 0.5, 0.05], [-0.3, 0, 0]);                      // 擋風玻璃
    part(g, GEO.box, M.steel, [0, -0.62, 0.66], [1.0, 0.44, 0.04]);                                  // 水箱護罩
    for (let i = 0; i < 5; i++) part(g, GEO.box, M.dark, [0, -0.46 - i * 0.08, 0.69], [0.9, 0.02, 0.02]);
    for (const x of [-1, 1]) {
      part(g, GEO.cyl, M.lamp, [x * 0.75, -0.6, 0.66], [0.16, 0.05, 0.16], [Math.PI / 2, 0, 0]);    // 大燈
      part(g, GEO.cyl, BM.tire, [x * 1.05, -0.95, 0.1], [0.36, 0.3, 0.36], [0, 0, Math.PI / 2]);     // 輪子
    }
    part(g, GEO.box, M.yellow, [0, 1.25, -0.3], [0.9, 0.5, 0.12]);                                   // 車頂招牌
    part(g, new THREE.PlaneGeometry(0.84, 0.42), new THREE.MeshBasicMaterial({ map: comicTex('$$$', null, '#1a8a3a', 256, 128, '#101018'), transparent: true }), [0, 1.25, -0.235], 1);
  }, [0, 0.3, 0.6], 1.4);
}
function truckExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, i % 2 ? GEO.box : GEO.cyl, i % 2 ? BM.cash : BM.coin, [Math.cos(a) * 2.3, Math.sin(a) * 2.2, 0.5], i % 2 ? [0.5, 0.26, 0.04] : [0.22, 0.05, 0.22], i % 2 ? [0, 0, a] : [Math.PI / 2, 0, 0]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'mech') return template(mechBody, 1.5, missileRing, { shadow: [1.6, 1.3] });
  if (kind === 'brain') return template(brainBody, 1.5, brainExtras, { shadow: [1.6, 1.2] });
  if (kind === 'kaiju') return template(kaijuBody, 1.5, rubbleRing, { shadow: [1.6, 1.3] });
  return template(truckBody, 1.4, truckExtras, { shadow: [1.6, 1.2] });
}

/* ---------------- 滾來的油桶(原本的隕石):黃色桶子 + 黑色警示條紋,橫著往前滾 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.cyl, C(0xffc020), [0, 0, 0], [0.4, 0.8, 0.4], [0, 0, Math.PI / 2]);
  for (const x of [-0.3, 0, 0.3]) part(body, GEO.cyl, C(0x1a1a24, 2), [x, 0, 0], [0.41, 0.06, 0.41], [0, 0, Math.PI / 2]);
  for (const x of [-0.41, 0.41]) part(body, GEO.cyl, C(0xd89a10, 2), [x, 0, 0], [0.34, 0.02, 0.34], [0, 0, Math.PI / 2]);
  rig.add(bake(body));
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), [0, -1.0, -0.2], [0.35, 1.1, 0.2], [0, 0, Math.PI]);
  tail.name = 'flame';                                                                                        // 速度線
  addShadow(root, 0.45, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(robot, 1.55, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(goon, 1.6, (rig) => {
    for (const x of [-0.18, 0.18]) addFlame(rig, [x, -0.55, -0.35], 0xffa020, [0.09, 0.4, 0.07], 0.9);
  }, { shadow: [0.4, 0.3], upright: true }),
  boss: template(thug, 1.45, null, { shadow: [0.55, 0.45], upright: true }),
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
 * clone 共用 geometry / material;要換色(大塊頭被打)就換單一 mesh 的 material。
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

/* ---------------- 道具:英雄徽章(彩色圓徽章 + 白邊 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff3a2a, name: '能量' },
  R: { label: 'R', color: 0x2ad8ff, name: '超音速' },
  S: { label: 'S', color: 0x3ae05a, name: '力場護盾' },
  B: { label: 'B', color: 0xb85aff, name: '大爆炸' },
  W: { label: 'W', color: 0xff8a20, name: '超級狗狗' },
  L: { label: '1UP', color: 0xffd020, name: '漢堡' },
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
  draw('#101018', 3, 3); draw('#ffffff', 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return { t, aspect: c.width / c.height };
}
function itemTemplate(kind) {
  const it = ITEMS[kind];
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const body = new THREE.Group();
  part(body, GEO.cyl, C(it.color, 2), [0, 0, 0.2], [0.42, 0.1, 0.42], [Math.PI / 2 - 0.4, 0, 0]);       // 徽章
  part(body, GEO.torus, M.white, [0, 0, 0.2], [0.42, 0.42, 0.4], [-0.4, 0, 0]);                           // 白邊
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

/** 玩家:黃色能量星(不透明平塗 → 會被描上黑框,像漫畫裡畫的能量) */
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [GEO.star.clone().scale(0.26, 0.26, 0.4), SHOT_MAT],
    [geoAt(GEO.ico0, [0, 0, 0.08], [0.08, 0.08, 0.04]), SHOT_TIP],
  ], cap);
}
/** 敵彈:洋紅色能量彈(白色的核心) */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico2, [0, 0, 0], [0.2, 0.2, 0.14]), EB_MAT],
    [geoAt(GEO.ico, [0.04, 0.05, 0.1], [0.08, 0.08, 0.05]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
