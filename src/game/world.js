import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel, flat } from '../core/toon.js';
import { rand, pick, wrapPi, corners, localToWorld2 } from '../core/geom.js';
import { CARS, carById, buildCar } from './cars.js';

export const SCEN = [
  { id: 'perp', name: '倒車入庫', desc: '垂直車格,車頭朝外', expectShift: 1, tip: '開過黃色目標車格,再倒車停入,車頭朝外' },
  { id: 'parallel', name: '路邊停車', desc: '平行車位,靠右路緣', expectShift: 2, tip: '與前車並排後倒車切入,貼近右側路緣' },
  { id: 'angled', name: '斜角停車', desc: '45° 斜格,車頭朝內', expectShift: 0, tip: '順著車道方向,車頭直接開進斜角車格' },
];
export const DIFF = [{ id: 'easy', name: '簡單' }, { id: 'normal', name: '普通' }, { id: 'hard', name: '困難' }];

/* 程序生成的柏油顆粒貼圖(無圖檔) */
let _asphaltTex = null;
function asphaltTex() {
  if (_asphaltTex) return _asphaltTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 215 + Math.floor(Math.random() * 40);
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2.5, 1 + Math.random() * 2.5);
  }
  for (let i = 0; i < 14; i++) { // 補丁與油漬
    g.fillStyle = `rgba(200,198,210,${0.25 + Math.random() * 0.2})`;
    g.beginPath(); g.ellipse(Math.random() * 256, Math.random() * 256, 8 + Math.random() * 22, 5 + Math.random() * 12, Math.random() * 3, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  _asphaltTex = t; return t;
}

const LINE = () => cel({ color: PAL.lineWhite, bands: 2 });
const YELLOW = () => flat({ color: PAL.lineYellow });

/**
 * 建一局場景。回傳 { root, obstacles, spot, start, bounds }。
 *   spot   目標車格(OBB,a = 車頭朝內的方向),另帶 expect = 期望車頭朝向
 *   start  玩家車起點 {x,z,a}
 */
export function buildScenario({ carIdx, scenIdx, diffIdx }) {
  const root = new THREE.Group();
  const obstacles = [];
  const sp = CARS[carIdx];
  const ctx = { root, obstacles, sp };

  const res = SCEN[scenIdx].id === 'parallel' ? buildStreet(ctx, diffIdx) : buildLot(ctx, diffIdx, SCEN[scenIdx].id === 'angled');
  const { spot } = res;

  drawSpot(ctx, spot, YELLOW(), false, 0.16);
  const fg = new THREE.PlaneGeometry(spot.hw * 2, spot.hl * 2); fg.rotateX(-Math.PI / 2);
  const fill = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: PAL.targetFill, transparent: true, opacity: 0.18, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
  fill.position.set(spot.x, 0.006, spot.z); fill.rotation.y = spot.a; root.add(fill);

  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const cx = cv.getContext('2d');
  cx.fillStyle = 'rgba(240,195,65,.9)'; cx.font = 'bold 100px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('P', 64, 70);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const pg = new THREE.PlaneGeometry(1.2, 1.2); pg.rotateX(-Math.PI / 2);
  const pm = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  const [px, pz] = localToWorld2(spot.x, spot.z, spot.a, 0, spot.hl * 0.55);
  pm.position.set(px, 0.011, pz); pm.rotation.y = spot.a + Math.PI; root.add(pm);

  return { root, obstacles, spot, start: res.start, bounds: res.bounds, spotFill: fill };
}

/* ---------------- primitives ---------------- */
function box(ctx, w, h, d, x, y, z, mat, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  ctx.root.add(m); return m;
}
function plane(ctx, w, d, x, z, y, mat) {
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; ctx.root.add(m); return m;
}
function stripe(ctx, x1, z1, x2, z2, wid, mat) {
  const dx = x2 - x1, dz = z2 - z1, g = new THREE.PlaneGeometry(wid, Math.hypot(dx, dz)); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2); m.rotation.y = Math.atan2(dx, dz); m.receiveShadow = true;
  ctx.root.add(m); return m;
}
function drawSpot(ctx, s, mat, openEntry, wid = 0.12) {
  const c = corners(s);
  const edges = [[0, 1], [2, 3], [3, 0]]; // 兩條長邊 + 深處端(+f)
  if (!openEntry) edges.push([1, 2]);   // 入口端(-f)
  for (const [i, j] of edges) stripe(ctx, c[i][0], c[i][1], c[j][0], c[j][1], wid, mat);
}
function wall(ctx, x1, z1, x2, z2, h = 0.9, t = 0.3) {
  const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
  const m = box(ctx, t, h, len, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, cel({ color: PAL.concrete })); m.rotation.y = a;
  const cap = box(ctx, t + 0.08, 0.08, len, (x1 + x2) / 2, h + 0.04, (z1 + z2) / 2, cel({ color: PAL.concreteDark }), false); cap.rotation.y = a;
  ctx.obstacles.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, hw: t / 2, hl: len / 2, a });
}
function pole(ctx, x, z) {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 6, 8), cel({ color: PAL.pole })); p.position.set(x, 3, z); p.castShadow = true; ctx.root.add(p);
  box(ctx, 0.9, 0.14, 0.32, x, 6, z, flat({ color: PAL.lamp }), false);
  ctx.obstacles.push({ x, z, hw: 0.14, hl: 0.14, a: 0 });
}
function tree(ctx, x, z) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.8, 7), cel({ color: PAL.trunk })); t.position.set(x, 0.9, z); t.castShadow = true; ctx.root.add(t);
  // 卡通樹冠:幾顆低面數球疊成一團
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const r = rand(0.9, 1.4);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cel({ color: i % 2 ? PAL.leaf : PAL.leafDark }));
    b.position.set(x + rand(-0.7, 0.7), rand(2.4, 3.6), z + rand(-0.7, 0.7)); b.castShadow = true; ctx.root.add(b);
  }
}
function building(ctx, x, z, w, d, h, rotY) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), cel({ color: pick(PAL.building) })); body.position.y = h / 2; body.castShadow = true; g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), cel({ color: pick(PAL.roofTone) })); roof.position.y = h + 0.2; g.add(roof);
  const win = flat({ color: PAL.window });
  for (let y = 2.2; y < h - 1; y += 3) for (const side of [1, -1]) {
    const wm = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 1.1, 0.06), win); wm.position.set(0, y, side * (d / 2 + 0.03)); g.add(wm);
  }
  g.position.set(x, 0, z); g.rotation.y = rotY; ctx.root.add(g);
}
function scenery(ctx, b) {
  plane(ctx, 900, 900, 0, 0, -0.02, cel({ color: PAL.grass, bands: 2 }));
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const R0 = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
  for (let i = 0; i < 24; i++) {
    const ang = i / 24 * Math.PI * 2 + rand(-0.08, 0.08), R = R0 + rand(22, 55);
    building(ctx, cx + Math.cos(ang) * R, cz + Math.sin(ang) * R, rand(8, 18), rand(8, 16), rand(6, 24), -ang);
  }
  for (let i = 0; i < 20; i++) {
    const side = i % 4, t = Math.random();
    const x = side < 2 ? b.minX + (b.maxX - b.minX) * t : (side === 2 ? b.minX - 3.5 : b.maxX + 3.5);
    const z = side < 2 ? (side === 0 ? b.minZ - 3.5 : b.maxZ + 3.5) : b.minZ + (b.maxZ - b.minZ) * t;
    tree(ctx, x, z);
  }
}

const PARK_POOL = ['compact', 'sedan', 'suv', 'van', 'pickup'].map(carById);
function parkCar(ctx, s, headings) {
  const big = ctx.sp.id === 'bus';
  const pool = (big ? [carById('bus'), carById('bus'), carById('van')] : PARK_POOL).filter((c) => c.L <= s.hl * 2 - 0.3 && c.W <= s.hw * 2 - 0.2);
  const spec = pool.length ? pick(pool) : CARS[0];
  const a = pick(headings) + rand(-0.035, 0.035);
  const slackL = (s.hl * 2 - spec.L) / 2, slackW = (s.hw * 2 - spec.W) / 2;
  const [x, z] = localToWorld2(s.x, s.z, s.a, rand(-slackW, slackW) * 0.55, rand(-slackL, slackL) * 0.6);
  const c = buildCar(spec, pick(PAL.parked), false);
  c.group.position.set(x, 0, z); c.group.rotation.y = a; ctx.root.add(c.group);
  ctx.obstacles.push({ x, z, hw: spec.W / 2, hl: spec.L / 2, a });
}

/* ---------------- 停車場(垂直 / 斜角) ---------------- */
function buildLot(ctx, di, angled) {
  const sp = ctx.sp, t = angled ? Math.PI / 4 : 0;
  const w = sp.W + [1.0, 0.7, 0.45][di], l = sp.L + [1.4, 0.9, 0.5][di];
  const spacing = w / Math.cos(t), depth = l * Math.cos(t) + w * Math.sin(t);
  const aisle = Math.max(angled ? 5.5 : 6.5, sp.L * (angled ? 0.95 : 1.25));
  const N = 9, ti = 4, rowB = depth + aisle;
  const back = angled ? Math.max(15, sp.L * 2.2) : Math.max(12, sp.L * 1.6);
  // 起點(目標格左邊 back 公尺)一定要落在場內,大巴士時場地往左加長
  const b = { minX: Math.min(-ti * spacing - spacing / 2 - 9, -back - sp.L / 2 - 7), maxX: (N - 1 - ti) * spacing + spacing / 2 + 9, minZ: -depth / 2 - 1.2, maxZ: rowB + depth / 2 + 1.2 };
  scenery(ctx, b);
  const lot = plane(ctx, b.maxX - b.minX, b.maxZ - b.minZ, (b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2, 0,
    cel({ color: PAL.asphalt, bands: 2, map: asphaltTex(), cache: false }));
  const uv = lot.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b.maxX - b.minX) / 8, uv.getY(i) * (b.maxZ - b.minZ) / 8);
  wall(ctx, b.minX, b.minZ, b.maxX, b.minZ); wall(ctx, b.minX, b.maxZ, b.maxX, b.maxZ);
  wall(ctx, b.minX, b.minZ, b.minX, b.maxZ); wall(ctx, b.maxX, b.minZ, b.maxX, b.maxZ);
  pole(ctx, b.minX + 1, b.minZ + 1); pole(ctx, b.maxX - 1, b.minZ + 1); pole(ctx, b.minX + 1, b.maxZ - 1); pole(ctx, b.maxX - 1, b.maxZ - 1);
  const zc = depth / 2 + aisle / 2, L = LINE();
  for (let x = b.minX + 6; x < b.maxX - 6; x += 9) { // 車道箭頭(往 +x)
    stripe(ctx, x, zc, x + 2.2, zc, 0.18, L); stripe(ctx, x + 2.2, zc, x + 1.6, zc + 0.45, 0.16, L); stripe(ctx, x + 2.2, zc, x + 1.6, zc - 0.45, 0.16, L);
  }
  let spot = null;
  for (let i = 0; i < N; i++) {
    const x = (i - ti) * spacing;
    const sA = { x, z: 0, hw: w / 2, hl: l / 2, a: Math.PI - t };
    const sB = { x, z: rowB, hw: w / 2, hl: l / 2, a: t };
    if (i === ti) spot = sA;
    else { drawSpot(ctx, sA, L, true); if (Math.abs(i - ti) === 1 || Math.random() < 0.8) parkCar(ctx, sA, angled ? [sA.a] : [sA.a, sA.a + Math.PI]); }
    drawSpot(ctx, sB, L, true);
    if (Math.random() < 0.7) parkCar(ctx, sB, angled ? [sB.a] : [sB.a, sB.a + Math.PI]);
  }
  spot.expect = angled ? spot.a : wrapPi(spot.a + Math.PI);
  return { spot, start: { x: spot.x - back, z: zc, a: Math.PI / 2 }, bounds: b };
}

/* ---------------- 路邊(平行) ---------------- */
function buildStreet(ctx, di) {
  const sp = ctx.sp;
  const l = sp.L + [2.6, 1.8, 1.2][di], w = sp.W + [0.6, 0.45, 0.35][di];
  const roadW = Math.max(7.5, sp.W * 3.4);
  const K = 3, zOpp = w / 2 + roadW + w / 2;
  const b = { minX: -(K + 0.5) * l - 12, maxX: (K + 0.5) * l + 12, minZ: -w / 2 - 4, maxZ: zOpp + w / 2 + 4 };
  scenery(ctx, b);
  const road = plane(ctx, b.maxX - b.minX, zOpp + w, (b.minX + b.maxX) / 2, zOpp / 2, 0, cel({ color: PAL.road, bands: 2, map: asphaltTex(), cache: false }));
  const uv = road.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (b.maxX - b.minX) / 8, uv.getY(i) * (zOpp + w) / 8);
  // 人行道 + 路緣(輪胎壓到也算碰撞)
  for (const [zc, sg] of [[-w / 2 - 2, 1], [zOpp + w / 2 + 2, -1]]) {
    box(ctx, b.maxX - b.minX, 0.16, 4, (b.minX + b.maxX) / 2, 0.08, zc, cel({ color: PAL.sidewalk }));
    box(ctx, b.maxX - b.minX, 0.18, 0.22, (b.minX + b.maxX) / 2, 0.09, zc + sg * 1.9, cel({ color: PAL.curb }));
    ctx.obstacles.push({ x: (b.minX + b.maxX) / 2, z: zc, hw: (b.maxX - b.minX) / 2, hl: 2, a: 0 });
    for (let x = b.minX + 5; x < b.maxX; x += 11) tree(ctx, x, zc - sg * 1.1);
    for (let x = b.minX + 10; x < b.maxX; x += 22) pole(ctx, x, zc + sg * 1.4);
  }
  wall(ctx, b.minX, b.minZ, b.minX, b.maxZ, 1.1); wall(ctx, b.maxX, b.minZ, b.maxX, b.maxZ, 1.1);
  for (let x = b.minX + 2; x < b.maxX - 2; x += 6) stripe(ctx, x, w / 2 + roadW / 2, x + 3, w / 2 + roadW / 2, 0.15, YELLOW());
  const L = LINE();
  let spot = null;
  for (let k = -K; k <= K; k++) {
    const s = { x: k * l, z: 0, hw: w / 2, hl: l / 2, a: -Math.PI / 2 };
    const o = { x: k * l, z: zOpp, hw: w / 2, hl: l / 2, a: Math.PI / 2 };
    if (k === 0) spot = s;
    else { drawSpot(ctx, s, L, false); if (Math.abs(k) === 1 || Math.random() < 0.85) parkCar(ctx, s, [s.a]); }
    drawSpot(ctx, o, L, false); if (Math.random() < 0.75) parkCar(ctx, o, [o.a]);
  }
  spot.expect = spot.a;
  return { spot, start: { x: 1.5 * l + sp.L * 0.5 + 2, z: w / 2 + 0.9 + sp.W / 2, a: -Math.PI / 2 }, bounds: b };
}
