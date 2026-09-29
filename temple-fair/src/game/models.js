import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from '../core/palette.js';
import { cel, flat } from '@arcade/render/toon.js';
import { geoAt, Batch, armorize, unarmor, squash, elasticOut } from '@arcade/engine/kit.js';

/* ------------------------------------------------------------------ *
 * 所有角色都用基本幾何體拼出來(沒有模型檔),Q 版大頭比例、紙藝 / 黏土的圓潤感。
 * local:+y = 畫面上方、+x = 右、+z = 朝鏡頭。
 *
 * 「立體書人偶」:人物在自己的座標系裡站立(頭 +y、臉 +z),整個人偶再往後仰 LEAN 弧度,
 * 從俯視鏡頭看起來頭在上、腳在下、臉朝玩家 —— 像立體書裡立起來的紙板人偶。
 * 人物模型「不跟著前進方向旋轉」(userData.upright),只依速度左右微傾,臉才不會倒過來。
 *
 * 每個角色腳下有一塊地面陰影('shadow',貼在地面 z = -GROUND_Z),讓人一看就知道在地上。
 * 內部型別沿用原本的名字:bee = 小鬼、bfly = 殭屍、boss = 夜叉(打兩下)、rock = 鬼火。
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
  pale: C(0xd8e4d8), tiger: C(0xf0a030, 2), horn: C(0xfff4e0), talisman: C(0xffe04a, 2), flame: C(0xff7a2a),
  pink: C(0xff9ac0), shades: C(0x1a1a22, 2), led: flat({ color: 0x6af0ff }),
  // 小鬼
  beeBody: C(PAL.beeBody), beeBand: C(PAL.beeBand), beePants: C(PAL.beeWing, 2),
  // 殭屍
  bflyBody: C(PAL.bflyBody), bflyHelm: C(PAL.bflyHead, 2),
  // 夜叉
  bossBody: C(PAL.bossBody), bossHead: C(PAL.bossHead), bossInner: C(PAL.bossInner, 2),
  bossHit: C(PAL.bossHit), bossHitHead: C(PAL.bossHitHead), bossHitInner: C(0x6a3a2a, 2),
  capWhite: C(PAL.captive), capRed: C(0xfff0f0), capBlue: C(PAL.captiveDark),
};

/** 夜叉被打第一下之後換色用的對照表(氣得臉色發紫) */
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

/* ---------------- 小鬼(bee):青綠皮膚、獨角、虎皮裙、狼牙棒 ---------------- */
function imp(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.beeBody, pants: M.tiger, face: M.beeBody, head: C(0x3a2a3a, 2),
    extra(g, hg) {
      part(hg, GEO.cone, M.horn, [0, 0.36, 0.02], [0.06, 0.2, 0.06]);                                   // 獨角
      for (const x of [-1, 1]) part(hg, GEO.cone, M.white, [x * 0.07, -0.16, 0.27], [0.025, 0.07, 0.02], [0, 0, Math.PI]); // 獠牙
      rod(g, M.wood, [0.36, -0.45], [0.36, 0.25], 0.03, 0.08);
      part(g, GEO.ico, M.wood, [0.36, 0.32, 0.08], [0.09, 0.14, 0.09]);                                  // 狼牙棒
    },
  });
}

/* ---------------- 殭屍(bfly):清朝官帽 + 黃符 + 雙手平舉,一跳一跳 ---------------- */
function jiangshi(b) {
  chibi(b, [0, 0, 0.2], 1, {
    body: M.bflyBody, face: M.pale, head: M.bflyHelm,
    extra(g, hg) {
      part(hg, GEO.cyl, M.bflyHelm, [0, 0.16, -0.02], [0.36, 0.05, 0.34]);                             // 帽沿
      part(hg, GEO.ico, M.red, [0, 0.33, -0.04], 0.06);                                                  // 頂珠
      part(hg, GEO.box, M.talisman, [0, 0.02, 0.32], [0.12, 0.3, 0.02], [-0.2, 0, 0]);                   // 黃符
      part(hg, GEO.box, M.red, [0, 0.03, 0.335], [0.03, 0.22, 0.01], [-0.2, 0, 0]);
      part(g, GEO.box, M.red, [0, -0.2, 0.22], [0.08, 0.4, 0.02]);                                       // 官服紅邊
      for (const x of [-1, 1]) part(g, GEO.cyl, M.bflyBody, [x * 0.16, -0.12, 0.3], [0.07, 0.36, 0.07], [Math.PI / 2, 0, 0]); // 平舉的雙手
    },
  });
}

/* ---------------- 夜叉(boss):藍皮膚、火焰紅髮、三叉戟,打兩下 ---------------- */
function yaksha(b) {
  chibi(b, [0, 0, 0.25], 1.22, {
    body: M.bossBody, pants: M.tiger, face: M.bossBody, head: M.bossHead,
    extra(g, hg) {
      for (let i = -2; i <= 2; i++) part(hg, GEO.cone, i % 2 ? M.bossHead : M.flame, [i * 0.09, 0.3 + (2 - Math.abs(i)) * 0.03, -0.06], [0.07, 0.26, 0.06], [0, 0, -i * 0.3]); // 火焰髮
      for (const x of [-1, 1]) part(hg, GEO.cone, M.white, [x * 0.08, -0.16, 0.27], [0.03, 0.08, 0.02], [0, 0, Math.PI]);
      part(hg, GEO.box, M.dark, [0, 0.08, 0.3], [0.3, 0.04, 0.02]);                                      // 怒眉
      rod(g, M.dark, [0.42, -0.6], [0.42, 0.6], 0.03, 0.1);                                              // 三叉戟
      for (const x of [-0.1, 0, 0.1]) part(g, GEO.cone, M.steel, [0.42 + x, 0.7 + (x ? 0 : 0.05), 0.1], [0.03, 0.18, 0.03]);
      part(g, GEO.box, M.steel, [0.42, 0.6, 0.1], [0.26, 0.04, 0.04]);
    },
  });
}

/* ---------------- 玩家:電音三太子(10 段) ----------------
 * 殺敵累積經驗 → 小太子 … 神威太子。每一段加零件:
 *   Lv2 乾坤圈、Lv3 混天綾、Lv4 火尖槍、Lv5 金甲、Lv6 風火輪、Lv7 墨鏡(電音!)、
 *   Lv8 LED 螢光棒、Lv9 金冠、Lv10 神光圈 + 光暈。奶嘴從一開始就有(三太子的招牌)。
 * 'ally3' = 援軍七爺(白袍白臉、高帽、長舌、羽扇)。 */
export const SHIP_LV = [
  { name: '小太子', body: 0xd8322e, accent: 0xffc23a, pod: 0xffc23a, flame: 0xff8a2a, span: 1.0 },
  { name: '童子', body: 0xd8322e, accent: 0xffc23a, pod: 0xffc23a, flame: 0xff8a2a, span: 1.02 },
  { name: '神童', body: 0xe8322e, accent: 0xffc23a, pod: 0xffc23a, flame: 0xff8a2a, span: 1.04 },
  { name: '小將', body: 0xe8322e, accent: 0xffd24a, pod: 0xffd24a, flame: 0xff9a2a, span: 1.06 },
  { name: '將軍', body: 0xd8282a, accent: 0xffd24a, pod: 0xffd24a, flame: 0xffa030, span: 1.08 },
  { name: '元帥', body: 0xd8282a, accent: 0xffd86a, pod: 0xffd86a, flame: 0xffa030, span: 1.1 },
  { name: '中壇元帥', body: 0xc8202a, accent: 0xffe07a, pod: 0xffe07a, flame: 0xffb03a, span: 1.12 },
  { name: '太子爺', body: 0xc8202a, accent: 0xffe07a, pod: 0xffe07a, flame: 0xffc040, span: 1.14 },
  { name: '電音太子', body: 0xb81a2a, accent: 0xfff2a0, pod: 0xfff2a0, flame: 0xffd24a, span: 1.16 },
  { name: '神威太子', body: 0xb81a2a, accent: 0xffffff, pod: 0xfff6c0, flame: 0xffe070, span: 1.2 },
];

function princeBody(m, L, ally) {
  return (b) => {
    if (ally) {
      // 七爺:白袍、高帽、長舌、羽扇
      chibi(b, [0, 0, 0.3], 1.25, {
        body: M.white, pants: M.white, face: M.pale, head: M.dark, big: 1.25,
        extra(g, hg) {
          part(hg, GEO.cyl, M.white, [0, 0.42, -0.05], [0.2, 0.55, 0.2]);                                // 高帽
          part(hg, GEO.box, M.red, [0, 0.42, 0.16], [0.08, 0.36, 0.02]);
          part(hg, GEO.box, M.red, [0, -0.2, 0.28], [0.05, 0.16, 0.02]);                                 // 長舌
          part(g, GEO.cyl, M.white, [-0.36, -0.1, 0.12], [0.16, 0.02, 0.2], [Math.PI / 2, 0, 0]);        // 羽扇
        },
      });
      return;
    }
    const armor = L >= 5 ? m.blue : m.red;
    chibi(b, [0, 0, 0.3], 1.25, {
      body: armor, pants: m.red, face: M.skin, head: M.hair, big: 1.3,
      extra(g, hg) {
        for (const x of [-1, 1]) part(hg, GEO.ico, M.hair, [x * 0.24, 0.24, -0.04], 0.12);               // 雙髻
        part(hg, GEO.box, M.gold, [0, 0.2, 0.18], [0.3, 0.05, 0.06]);                                    // 金額帶
        part(hg, GEO.ico, M.pink, [0, -0.16, 0.31], [0.07, 0.05, 0.05]);                                  // 奶嘴
        part(hg, GEO.torus, M.pink, [0, -0.2, 0.34], [0.05, 0.05, 0.05]);
        if (L >= 7) {                                                                                     // 墨鏡
          part(hg, GEO.box, M.shades, [0, 0.0, 0.3], [0.34, 0.08, 0.03]);
          for (const x of [-1, 1]) part(hg, GEO.ico, M.shades, [x * 0.1, -0.01, 0.31], [0.08, 0.06, 0.02]);
        }
        if (L >= 9) for (let i = -2; i <= 2; i++) part(hg, GEO.cone, M.gold, [i * 0.09, 0.34 - Math.abs(i) * 0.03, 0.04], [0.035, 0.14, 0.03], [0, 0, -i * 0.25]); // 金冠
        if (L >= 2) part(g, GEO.torus, M.gold, [-0.34, -0.25, 0.08], [0.12, 0.12, 0.12]);                // 乾坤圈
        if (L >= 3) part(g, GEO.halfRing, m.red, [0, -0.15, -0.12], [0.55, 0.42, 0.5], [0, 0, Math.PI]);  // 混天綾
        if (L >= 4) {                                                                                     // 火尖槍
          rod(g, M.gold, [0.4, -0.6], [0.4, 0.75], 0.025, 0.08);
          part(g, GEO.cone, M.flame, [0.4, 0.86, 0.08], [0.06, 0.2, 0.04]);
        }
        if (L >= 5) for (const x of [-1, 1]) part(g, GEO.ico, m.blue, [x * 0.29, -0.08, 0.05], [0.12, 0.1, 0.1]); // 肩甲
        if (L >= 8) for (const x of [-1, 1]) part(g, GEO.cyl, M.led, [x * 0.36, -0.32, 0.14], [0.03, 0.28, 0.03], [0.6, 0, x * 0.3]); // 螢光棒
      },
    });
    if (L >= 6) for (const x of [-1, 1]) {                                                               // 風火輪
      part(b, GEO.torus, M.gold, [x * 0.2, -0.62, -0.02], [0.2, 0.2, 0.3]);
      part(b, GEO.ico, M.flame, [x * 0.2, -0.62, -0.02], [0.1, 0.1, 0.05]);
    }
  };
}

const AURA_GEO = new THREE.IcosahedronGeometry(1.25, 2);
const HALO_GEO = new THREE.TorusGeometry(0.9, 0.05, 6, 36);
function shipTemplate(m, L = 1, ally = false) {
  return template(princeBody(m, L, ally), 1.45 + 0.025 * (L - 1), (rig) => {
    // 腳下揚起的香煙 / 風火輪的火(每幀閃爍)
    const fc = L >= 6 && !ally ? m.flame || 0xff8a2a : 0xf0e8d8;
    for (const x of [-0.2, 0.2]) addFlame(rig, [x, -0.9, -0.1], fc, [0.1, 0.4, 0.08], L >= 6 ? 0.8 : 0.45);
    if (ally) { addFlag(rig, [-0.45, 0.4, 0.8], '謝', '#2a2226', 0.7); return; }
    addFlag(rig, [-0.5, 0.45, 0.8], L >= 7 ? '電' : '令', '#d8322e', 0.7);
    if (L >= 10) {
      const h = new THREE.Mesh(HALO_GEO, new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.name = 'halo'; h.position.set(0, 0.35, 0.1); rig.add(h);
    }
    if (L >= 8) {
      const a = new THREE.Mesh(AURA_GEO, new THREE.MeshBasicMaterial({ color: L >= 10 ? 0xffe07a : 0x6af0ff, transparent: true, opacity: L >= 10 ? 0.14 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false }));
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

/* ---------------- 關底大 BOSS(面朝玩家) ---------------- */
const BM = {
  nian: C(0xd8402a), nianDark: C(0xa82a1e), mane: C(0xffc23a), maneW: C(0xfff2c8), mouth: C(0x6a1a1a, 2),
  tiger: C(0xf09a2a), tigerW: C(0xfff4e0), stripe: C(0x2a2226, 2), robe: C(0x6a4a8a), robe2: C(0xb8a0d0), grey: C(0xd8d8e0),
  ghost: C(0x7ad89a), ghostRobe: C(0x4a3a6a), ghostTrim: C(0xb83ab8),
  packet: C(0xd8202a), coin: C(0xffc23a),
};

/** 年獸:紅色大獸、金色鬃毛(像舞獅)、大眼、獨角、血盆大口 —— 最怕鞭炮 */
function nianBody(b) {
  part(b, GEO.ico2, BM.nian, [0, 0.8, 0], [1.6, 1.4, 1.0]);
  for (let i = 0; i < 12; i++) {                                                                        // 鬃毛一圈
    const a = i / 12 * Math.PI * 2;
    part(b, GEO.ico, i % 2 ? BM.mane : BM.maneW, [Math.cos(a) * 1.25, -0.4 + Math.sin(a) * 1.1, 0.5], 0.42);
  }
  part(b, GEO.ico2, BM.nian, [0, -0.45, 0.7], [1.15, 1.0, 0.95]);
  for (const x of [-1, 1]) {
    part(b, GEO.ico2, M.white, [x * 0.42, -0.35, 1.5], 0.3);
    part(b, GEO.ico2, M.dark, [x * 0.42, -0.4, 1.76], 0.14);
    part(b, GEO.ico, BM.mane, [x * 0.45, -0.02, 1.55], [0.3, 0.1, 0.1]);                                 // 金眉
    part(b, GEO.ico, BM.nianDark, [x * 1.2, 1.9, 0], [0.35, 0.3, 0.3]);                                  // 後腳
    part(b, GEO.ico, BM.nianDark, [x * 1.35, -0.3, -0.2], [0.35, 0.3, 0.3]);                             // 前爪
  }
  part(b, GEO.cone, BM.mane, [0, 0.05, 1.7], [0.16, 0.6, 0.16], [Math.PI / 2, 0, 0]);                  // 獨角
  part(b, GEO.ico, BM.mane, [0, -0.85, 1.55], 0.2);                                                      // 鼻
  part(b, GEO.box, BM.mouth, [0, -1.2, 1.3], [1.0, 0.3, 0.2]);                                           // 大口
  for (let i = -3; i <= 3; i++) part(b, GEO.cone, M.white, [i * 0.13, -1.1, 1.42], [0.05, 0.12, 0.04], [0, 0, Math.PI]);
  part(b, GEO.ico, BM.mane, [0, 2.2, 0.3], [0.4, 0.5, 0.3]);                                             // 尾巴
}
/** 虎姑婆:老婆婆的衣服 + 虎頭(條紋、白嘴)+ 灰髮髻插紅花 + 拐杖 */
function grannyBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.7, {
    body: BM.robe, pants: BM.robe2, face: BM.tiger, head: BM.grey,
    extra(g, hg) {
      part(hg, GEO.ico, BM.grey, [0, 0.3, -0.1], 0.14);                                                  // 髮髻
      part(hg, GEO.ico, M.red, [0.12, 0.32, 0.0], 0.06);                                                 // 紅花
      part(hg, GEO.cyl, M.gold, [-0.08, 0.34, -0.08], [0.01, 0.3, 0.01], [0, 0, 1.2]);                   // 髮簪
      for (const x of [-1, 1]) {
        part(hg, GEO.ico, BM.tiger, [x * 0.24, 0.2, 0.0], [0.08, 0.08, 0.05]);                           // 虎耳
        part(hg, GEO.box, BM.stripe, [x * 0.2, 0.06, 0.22], [0.1, 0.025, 0.02], [0, 0, x * 0.4]);        // 條紋
        part(hg, GEO.box, BM.stripe, [x * 0.23, -0.04, 0.2], [0.08, 0.02, 0.02], [0, 0, x * 0.2]);
        part(hg, GEO.cone, M.white, [x * 0.06, -0.16, 0.3], [0.02, 0.06, 0.02], [0, 0, Math.PI]);
      }
      part(hg, GEO.ico, BM.tigerW, [0, -0.1, 0.27], [0.14, 0.09, 0.06]);                                // 白嘴
      part(hg, GEO.box, BM.stripe, [0, 0.16, 0.26], [0.03, 0.1, 0.02]);
      part(g, GEO.box, BM.tigerW, [0, -0.3, 0.2], [0.26, 0.3, 0.02]);                                     // 圍裙
      rod(g, M.wood, [0.38, -0.75], [0.38, 0.1], 0.025, 0.1);                                             // 拐杖
      part(g, GEO.torus, M.wood, [0.33, 0.13, 0.1], [0.06, 0.06, 0.1], [0, 0, 0]);
    },
  });
}
/** 鬼王:綠臉、金冠、黑袍紫邊、令牌 + 一圈繞著轉的鬼火 */
function ghostKingBody(b) {
  chibi(b, [0, 0.2, 0.6], 2.7, {
    body: BM.ghostRobe, pants: BM.ghostTrim, face: BM.ghost, head: M.dark,
    extra(g, hg) {
      part(hg, GEO.box, M.gold, [0, 0.24, 0.05], [0.4, 0.1, 0.3]);                                       // 金冠
      for (let i = -2; i <= 2; i++) part(hg, GEO.cone, M.gold, [i * 0.08, 0.36, 0.05], [0.03, 0.12, 0.03]);
      part(hg, GEO.ico, M.red, [0, 0.26, 0.21], 0.04);
      for (const x of [-1, 1]) {
        part(hg, GEO.ico, M.red, [x * 0.1, 0.0, 0.3], [0.04, 0.03, 0.02]);                               // 紅眼
        part(hg, GEO.cone, M.white, [x * 0.07, -0.17, 0.27], [0.025, 0.08, 0.02], [0, 0, Math.PI]);
      }
      part(hg, GEO.ico, M.dark, [0, -0.25, 0.2], [0.14, 0.1, 0.08]);                                     // 黑鬍
      part(g, GEO.box, BM.ghostTrim, [0, -0.2, 0.22], [0.1, 0.5, 0.02]);
      part(g, GEO.box, M.gold, [0.36, -0.2, 0.2], [0.14, 0.3, 0.03]);                                     // 令牌
      part(g, GEO.box, M.red, [0.36, -0.2, 0.22], [0.06, 0.2, 0.01]);
    },
  });
}
function ghostKingExtras(rig) {
  const spin = new THREE.Group(); spin.name = 'spin';
  const fm = new THREE.MeshBasicMaterial({ color: 0x5affd0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    part(spin, GEO.ico, fm, [Math.cos(a) * 2.6, Math.sin(a) * 2.2, 0.8], [0.16, 0.22, 0.16]);
  }
  rig.add(spin);
}
/** 大紅包(獎勵關):金邊紅包 + 福字 + 一圈金幣 */
function packetBody(b) {
  part(b, GEO.box, BM.packet, [0, 0, 0.2], [2.0, 2.8, 0.25]);
  for (const [x, y, w, h] of [[0, 1.3, 2.0, 0.12], [0, -1.3, 2.0, 0.12], [0.94, 0, 0.12, 2.8], [-0.94, 0, 0.12, 2.8], [0, 0.55, 2.0, 0.08]]) part(b, GEO.box, M.gold, [x, y, 0.34], [w, h, 0.04]);
}
function packetExtras(rig) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.6), new THREE.MeshBasicMaterial({ map: bannerTex('福', '#d8202a', '#ffd24a'), transparent: true }));
  f.position.set(0, -0.35, 0.37); rig.add(f);
  const spin = new THREE.Group(); spin.name = 'spin';
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    part(spin, GEO.cyl, BM.coin, [Math.cos(a) * 1.9, Math.sin(a) * 2.1, 0.4], [0.2, 0.05, 0.2], [Math.PI / 2, 0, 0]);
  }
  rig.add(spin);
}

function bigTemplate(kind) {
  if (kind === 'nian') return template(nianBody, 1.35, (rig) => addFlag(rig, [-1.6, 1.4, 1.6], '年', '#d8202a', 1.2), { shadow: [2.0, 2.2] });
  if (kind === 'granny') return template(grannyBody, 1.2, null, { shadow: [1.4, 1.2] });
  if (kind === 'ghost') return template(ghostKingBody, 1.2, ghostKingExtras, { shadow: [1.4, 1.2] });
  return template(packetBody, 1.3, packetExtras, { shadow: [1.2, 1.5] });
}

/* ---------------- 鬼火(原本的隕石):青綠色的火球 + 火尾 ---------------- */
function rockTemplate() {
  const root = new THREE.Group(); root.name = 'root';
  const rig = new THREE.Group(); rig.name = 'rig'; root.add(rig);
  const glow = new THREE.MeshBasicMaterial({ color: 0x3ae0b0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  part(rig, GEO.ico2, glow, [0, 0, 0], [0.6, 0.7, 0.5]);
  part(rig, GEO.ico2, flat({ color: 0xe8fff8 }), [0, 0.05, 0.2], 0.28);
  const tail = part(rig, GEO.cone, new THREE.MeshBasicMaterial({ color: 0x3ae0b0, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }), [0, -1.1, 0], [0.45, 1.5, 0.3], [0, 0, Math.PI]);
  tail.name = 'flame';
  addShadow(root, 0.5, 0.4);
  return root;
}

const TEMPLATES = {
  bee: template(imp, 1.3, null, { shadow: [0.45, 0.35], upright: true }),
  bfly: template(jiangshi, 1.3, (rig) => addFlag(rig, [-0.45, 0.25, 0.5], '符', '#c8a02a', 0.5), { shadow: [0.45, 0.35], upright: true }),
  boss: template(yaksha, 1.2, null, { shadow: [0.55, 0.45], upright: true }),
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
export const FLASH_MAT = flat({ color: 0xffffff });

/* ---------------- 道具:平安符(符袋 + 紅繩 + 點陣字) ---------------- */
export const ITEMS = {
  P: { label: 'P', color: 0xff5a3a, name: '神力' },
  R: { label: 'R', color: 0x3ad8ff, name: '疾速' },
  S: { label: 'S', color: 0x3ae07a, name: '平安符' },
  B: { label: 'B', color: 0xb86aff, name: '鞭炮' },
  W: { label: 'W', color: 0xf0f0f0, name: '七爺助陣' },
  L: { label: '1UP', color: 0xffc23a, name: '紅龜粿' },
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
  // 平安符:扁扁的符袋 + 金色邊 + 上面一條紅繩
  part(body, GEO.box, cm, [0, -0.05, 0.2], [0.56, 0.7, 0.14]);
  part(body, GEO.box, M.gold, [0, -0.05, 0.28], [0.6, 0.06, 0.02]);
  part(body, GEO.box, M.gold, [0, 0.28, 0.28], [0.6, 0.06, 0.02]);
  part(body, GEO.torus, M.red, [0, 0.42, 0.2], [0.14, 0.14, 0.3]);
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

/** 玩家:金色乾坤圈(面向鏡頭的圓環 + 中間一點亮光) */
const RING_GEO = new THREE.TorusGeometry(0.2, 0.06, 6, 16);
export function shotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(RING_GEO, [0, 0, 0], [1, 1.1, 1]), SHOT_MAT],
    [geoAt(GEO.ico0, [0, 0, 0.02], [0.08, 0.08, 0.05]), SHOT_TIP],
  ], cap);
}
/** 敵彈:青綠色的鬼火,方向跟著速度 */
export function enemyShotBatch(scene, cap) {
  return new Batch(scene, [
    [geoAt(GEO.ico, [0, -0.05, 0], [0.19, 0.28, 0.19]), EB_MAT],
    [geoAt(GEO.ico0, [0, 0.03, 0.08], [0.09, 0.11, 0.09]), EB_CORE],
  ], cap);
}

export { armorize, unarmor, squash, elasticOut };
