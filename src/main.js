import * as THREE from 'three';
import { PAL } from './core/palette.js';
import { Pipeline } from './core/post.js';
import { buildSky } from './core/sky.js';
import { ensureAudio, beep, thud, chime } from './core/audio.js';
import { clamp, wrapPi, corners, toLocal, localToWorld2, overlap, pointDist } from './core/geom.js';
import { CARS, buildCar, buildPerson } from './game/cars.js';
import { SCEN, DIFF, buildScenario } from './game/world.js';
import { Mirrors } from './game/mirrors.js';
import { IS_TOUCH, T, initTouch, syncTouchUI } from './game/touch.js';

const $ = (id) => document.getElementById(id);
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

/* ================= renderer / scene / light(配置沿用 sakura-crossing) ================= */
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(new THREE.Color(PAL.fog), 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 70, 260);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 700);
camera.rotation.order = 'YXZ';

const sun = new THREE.DirectionalLight(PAL.sun, 2.25);
sun.castShadow = true; sun.shadow.mapSize.set(IS_TOUCH ? 1024 : 2048, IS_TOUCH ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight(PAL.fill, 1.05); fill.position.set(48, 26, -44); scene.add(fill);
const bounce = new THREE.DirectionalLight(0xd8cbe8, 0.34); bounce.position.set(10, -18, 40); scene.add(bounce);
scene.add(new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.12));
buildSky(scene);

// 手機:限制後製解析度(描線 + 調色 + FXAA 三趟全螢幕),保住幀率
const pipeline = new Pipeline(renderer, scene, camera, { pixelBudget: IS_TOUCH ? 1.1e6 : 4.6e6 });
const mirrors = new Mirrors();

/* ================= state ================= */
const S = {
  carIdx: 1, scenIdx: 0, diffIdx: 1, started: false, mode: 'walk', view: 'fp', top: false, topZoom: 1,
  headYaw: 0, headPitch: -0.05, chaseYaw: 0, autoCenter: true, muted: false, menu: true, result: false,
};
let world = null, obstacles = [], spot = null, start = null, spotFill = null;
let car = null, person = null, stats = null, trail = null, outline = null;
const player = { x: 0, z: 0, yaw: 0, pitch: 0 };
const topCam = { x: 0, z: 0, h: 30, init: false };

function newScenario() {
  if (world) { scene.remove(world); world.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
  const r = buildScenario(S);
  world = r.root; obstacles = r.obstacles; spot = r.spot; start = r.start; spotFill = r.spotFill;
  scene.add(world);

  const b = r.bounds, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const ext = Math.min(90, Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 12);
  sun.target.position.set(cx, 0, cz); sun.position.set(cx - 40, 62, cz + 44);
  const sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 1; sc.far = 220; sc.updateProjectionMatrix();

  const sp = CARS[S.carIdx];
  const m = buildCar(sp, sp.color, true); world.add(m.group);
  car = { ...m, spec: sp, x: start.x, z: start.z, a: start.a, v: 0, steer: 0, gear: 'P', braking: false };

  const og = new THREE.BufferGeometry().setFromPoints([[1, 1], [1, -1], [-1, -1], [-1, 1], [1, 1]].map(([i, j]) => new THREE.Vector3(i * sp.W / 2, 0.05, j * sp.L / 2)));
  outline = new THREE.Line(og, new THREE.LineBasicMaterial({ color: PAL.targetFill, depthTest: false }));
  outline.renderOrder = 10; car.group.add(outline);

  const mk = (col) => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6000 * 3), 3)); g.setDrawRange(0, 0);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.95 }));
    l.renderOrder = 9; l.frustumCulled = false; world.add(l); return l;
  };
  trail = { rear: mk(0x3d7fe0), front: mk(0xff8a30), n: 0, lx: 1e9, lz: 1e9 };
  person = buildPerson(); world.add(person);
  topCam.init = false;
}

function newRun(inCar) {
  Object.assign(car, { x: start.x, z: start.z, a: start.a, v: 0, steer: 0, gear: 'P' });
  stats = { t: 0, running: false, collisions: 0, shifts: 0, lastHit: -9, submitted: false };
  trail.n = 0; trail.lx = 1e9; trail.rear.geometry.setDrawRange(0, 0); trail.front.geometry.setDrawRange(0, 0);
  Object.assign(S, { headYaw: 0, headPitch: -0.05, chaseYaw: 0, top: false, topZoom: 1 });
  syncCar();
  if (inCar) S.mode = 'drive'; else { S.mode = 'walk'; placeOutside(true); }
  toast(SCEN[S.scenIdx].name + ':' + SCEN[S.scenIdx].tip);
}

/* ================= UI ================= */
let toastT = 0;
function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.className = bad ? 'bad' : ''; t.style.opacity = 1; toastT = performance.now() + 1800; }
const bestKey = () => `parking.best.${CARS[S.carIdx].id}.${SCEN[S.scenIdx].id}.${DIFF[S.diffIdx].id}`;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function renderMenu() {
  $('carList').innerHTML = CARS.map((c, i) => `<button class="opt ${i === S.carIdx ? 'sel' : ''}" data-car="${i}"><b><span class="sw" style="background:${hex(c.color)}"></span>${c.name}</b><small>${c.desc}</small></button>`).join('');
  $('scenList').innerHTML = SCEN.map((c, i) => `<button class="opt ${i === S.scenIdx ? 'sel' : ''}" data-scen="${i}"><b>${c.name}</b><small>${c.desc}</small></button>`).join('');
  $('diffList').innerHTML = DIFF.map((c, i) => `<button class="opt ${i === S.diffIdx ? 'sel' : ''}" data-diff="${i}"><b>${c.name}</b></button>`).join('');
  const b = lsGet(bestKey());
  $('bestTxt').textContent = b ? `此組合最佳:${b.grade}(${b.score} 分)` : '此組合尚無紀錄';
}
$('menu').addEventListener('click', (e) => {
  const o = e.target.closest('.opt'); if (!o) return;
  if (o.dataset.car) S.carIdx = +o.dataset.car;
  if (o.dataset.scen) S.scenIdx = +o.dataset.scen;
  if (o.dataset.diff) S.diffIdx = +o.dataset.diff;
  renderMenu();
});
function showMenu(v) {
  S.menu = v; $('menu').classList.toggle('hidden', !v);
  if (v) { renderMenu(); $('resumeBtn').classList.toggle('hidden', !S.started); if (document.pointerLockElement) document.exitPointerLock(); }
}
function closeResult() { S.result = false; $('result').classList.add('hidden'); }
function goFullscreen() {
  if (!IS_TOUCH || document.fullscreenElement) return;
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen?.({ navigationUI: 'hide' });
    p?.then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  } catch (e) { /* iOS Safari 沒有全螢幕 API */ }
}
$('startBtn').onclick = () => { ensureAudio(); goFullscreen(); newScenario(); newRun(false); S.started = true; showMenu(false); };
$('resumeBtn').onclick = () => { goFullscreen(); showMenu(false); };
$('rRetry').onclick = () => { closeResult(); newRun(true); };
$('rTop').onclick = () => { closeResult(); S.top = true; };
$('rMenu').onclick = () => { closeResult(); showMenu(true); };

/* ================= input ================= */
const keys = {};
const K = (...c) => c.some((k) => keys[k]);
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  keys[e.code] = true; if (e.repeat) return; ensureAudio(); onKey(e.code);
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function onKey(code) {
  if (code === 'Escape') { if (S.result) { closeResult(); return; } if (S.started) showMenu(!S.menu); return; }
  if (S.menu) { if (code === 'Enter') $('startBtn').click(); return; }
  if (S.result) { if (code === 'KeyR') { closeResult(); newRun(true); } if (code === 'Enter' || code === 'KeyT') $('rTop').click(); return; }
  switch (code) {
    case 'KeyE':
      if (S.mode === 'drive') {
        if (Math.abs(car.v) > 0.3) { toast('先停車再下車', true); break; }
        car.v = 0; car.gear = 'P'; placeOutside(false); S.mode = 'walk';
      } else if (nearCar()) { S.mode = 'drive'; S.headYaw = 0; S.headPitch = -0.05; }
      break;
    case 'KeyV': if (S.mode === 'drive') { S.view = S.view === 'fp' ? 'chase' : 'fp'; S.chaseYaw = 0; } break;
    case 'KeyT': S.top = !S.top; break;
    case 'KeyR': newRun(true); break;
    case 'Enter': case 'NumpadEnter': submit(); break;
    case 'KeyB': S.muted = !S.muted; toast(S.muted ? '雷達聲音:關' : '雷達聲音:開'); break;
    case 'KeyC': S.autoCenter = !S.autoCenter; toast(S.autoCenter ? '方向盤自動回正:開' : '方向盤自動回正:關(放開會停在原角度)'); break;
    case 'KeyF': S.headYaw = 0; S.headPitch = -0.05; S.chaseYaw = 0; break;
  }
}
const cvs = renderer.domElement; let dragging = false;
cvs.addEventListener('mousedown', () => {
  ensureAudio(); dragging = true;
  if (!IS_TOUCH && !S.menu && !S.result && !document.pointerLockElement && !S.top) {
    try { const p = cvs.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* 不支援就用拖曳 */ }
  }
});
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (S.menu || S.result || S.top) return;
  if (!document.pointerLockElement && !dragging) return;
  if (IS_TOUCH) return; // 觸控的轉頭由 touch.js 累積到 T.look
  applyLook(e.movementX * 0.0022, e.movementY * 0.0022);
});
function applyLook(mx, my) {
  if (S.mode === 'walk') { player.yaw -= mx; player.pitch = clamp(player.pitch - my, -1.45, 1.45); }
  else if (S.view === 'fp') { S.headYaw = clamp(S.headYaw - mx, -2.5, 2.5); S.headPitch = clamp(S.headPitch - my, -1.1, 0.8); }
  else S.chaseYaw -= mx;
}
addEventListener('wheel', (e) => { if (S.top) S.topZoom = clamp(S.topZoom * (e.deltaY > 0 ? 1.1 : 1 / 1.1), 0.35, 2.5); }, { passive: true });

/* ================= walking ================= */
const PR = 0.3;
const carBox = () => ({ x: car.x, z: car.z, hw: car.spec.W / 2, hl: car.spec.L / 2, a: car.a });
function freeAt(x, z) {
  if (pointDist(carBox(), x, z) < PR) return false;
  for (const o of obstacles) if (pointDist(o, x, z) < PR) return false;
  return true;
}
const nearCar = () => pointDist(carBox(), player.x, player.z) < 1.3;
function placeOutside(initial) {
  const sp = car.spec, dz = car.eye.z;
  const cands = [['駕駛側', sp.W / 2 + 0.55, dz], ['副駕側', -sp.W / 2 - 0.55, dz], ['車尾', 0, -sp.L / 2 - 0.7], ['車頭', 0, sp.L / 2 + 0.7]];
  for (let i = 0; i < cands.length; i++) {
    const [name, lx, lz] = cands[i], [x, z] = localToWorld2(car.x, car.z, car.a, lx, lz);
    if (freeAt(x, z)) {
      player.x = x; player.z = z; player.yaw = Math.atan2(-(car.x - x), -(car.z - z)); player.pitch = -0.15;
      if (!initial && i > 0) toast('駕駛側空間不足,改從' + name + '下車', true);
      return;
    }
  }
  const [x, z] = localToWorld2(car.x, car.z, car.a, 0, -sp.L / 2 - 1.5); player.x = x; player.z = z;
}
function updateWalk(dt) {
  let f = 0, s = 0;
  if (K('KeyW', 'ArrowUp')) f += 1; if (K('KeyS', 'ArrowDown')) f -= 1; if (K('KeyD')) s += 1; if (K('KeyA')) s -= 1;
  if (K('ArrowLeft')) player.yaw += 2 * dt; if (K('ArrowRight')) player.yaw -= 2 * dt;
  const jm = Math.hypot(T.joy.x, T.joy.y);
  if (jm > 0.12) { f -= T.joy.y; s += T.joy.x; }
  // 搖桿推到底 = 跑步;半推 = 慢走
  const run = K('ShiftLeft', 'ShiftRight') || jm > 0.92;
  const v = (run ? 5.5 : 2.4 * (jm > 0.12 ? Math.min(1, jm * 1.3) : 1)) * dt, n = Math.max(1, Math.hypot(f, s));
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw), rx = Math.cos(player.yaw), rz = -Math.sin(player.yaw);
  const dx = (fx * f + rx * s) / n * v, dz = (fz * f + rz * s) / n * v;
  if (freeAt(player.x + dx, player.z)) player.x += dx;
  if (freeAt(player.x, player.z + dz)) player.z += dz;
}

/* ================= driving:後軸為基準的自行車模型 ================= */
function setGear(g) { if (g !== car.gear) { if (car.gear !== 'P') stats.shifts++; car.gear = g; } }
function updateCar(dt, now) {
  const sp = car.spec, bus = sp.id === 'bus';
  let thr = 0, brake = 0;
  if (S.mode === 'drive') {
    const fwd = K('KeyW', 'ArrowUp') || (T.gas && T.gear === 'D'), back = K('KeyS', 'ArrowDown') || (T.gas && T.gear === 'R');
    if (fwd) { if (car.v < -0.05) brake = 1; else { thr = 1; setGear('D'); } }
    if (back) { if (car.v > 0.05) brake = 1; else { thr = -1; setGear('R'); } }
    if (K('Space')) brake = 1.6;
    if (T.brake) brake = Math.max(brake, 1.2);
    const tgt = (K('KeyA', 'ArrowLeft') ? 1 : 0) - (K('KeyD', 'ArrowRight') ? 1 : 0), rate = bus ? 1.1 : 1.45;
    if (T.steer !== null) { // 觸控方向盤:直接追手指角度(比鍵盤快,像真的方向盤)
      const want = T.steer * sp.steer, d = want - car.steer;
      car.steer += Math.sign(d) * Math.min(Math.abs(d), rate * 2.2 * dt);
    } else if (tgt) car.steer += tgt * rate * dt;
    else if (S.autoCenter && Math.abs(car.v) > 0.05) car.steer -= Math.sign(car.steer) * Math.min(Math.abs(car.steer), rate * 0.9 * dt);
    car.steer = clamp(car.steer, -sp.steer, sp.steer);
  }
  car.v = clamp(car.v + thr * (bus ? 1.5 : 2.4) * dt, bus ? -2.2 : -2.8, bus ? 4.5 : 5.6);
  const dec = brake * 7 + (thr === 0 ? 1.3 : 0);
  if (dec > 0 && car.v !== 0) { const s = Math.sign(car.v); car.v -= s * dec * dt; if (Math.sign(car.v) !== s) car.v = 0; }
  car.braking = brake > 0;
  if (car.v !== 0) {
    if (!stats.running && !stats.submitted) stats.running = true;
    const Lw = sp.wb, ds = car.v * dt;
    let rx = car.x - Math.sin(car.a) * Lw / 2, rz = car.z - Math.cos(car.a) * Lw / 2;
    const na = car.a + ds * Math.tan(car.steer) / Lw;
    rx += Math.sin((car.a + na) / 2) * ds; rz += Math.cos((car.a + na) / 2) * ds;
    const nx = rx + Math.sin(na) * Lw / 2, nz = rz + Math.cos(na) * Lw / 2;
    const ob = { x: nx, z: nz, hw: sp.W / 2, hl: sp.L / 2, a: na };
    let hit = false;
    for (const o of obstacles) if (Math.abs(o.x - nx) + Math.abs(o.z - nz) < o.hw + o.hl + sp.L && overlap(ob, o)) { hit = true; break; }
    if (hit) {
      if (now - stats.lastHit > 0.9 && Math.abs(car.v) > 0.15) { stats.collisions++; toast('碰撞!', true); thud(); navigator.vibrate?.([60, 40, 60]); }
      stats.lastHit = now; car.v = 0;
    } else {
      car.x = nx; car.z = nz; car.a = na;
      for (const w of car.spin) w.rotation.x += ds / sp.r;
      addTrail();
    }
  }
  if (stats.running) stats.t += dt;
}
function syncCar() {
  car.group.position.set(car.x, 0, car.z); car.group.rotation.y = car.a;
  for (const p of car.front) p.rotation.y = car.steer;
  car.steerWheel.rotation.z = -car.steer * 7;
  car.tail.emissiveIntensity = car.braking ? 1.6 : 0.25;
  car.rev.emissiveIntensity = car.gear === 'R' ? 1.2 : 0;
}
function addTrail() {
  const sp = car.spec, f = [Math.sin(car.a), Math.cos(car.a)];
  const rx = car.x - f[0] * sp.wb / 2, rz = car.z - f[1] * sp.wb / 2;
  if (Math.hypot(rx - trail.lx, rz - trail.lz) < 0.15 || trail.n >= 6000) return;
  trail.lx = rx; trail.lz = rz;
  const pa = trail.rear.geometry.attributes.position, pb = trail.front.geometry.attributes.position;
  pa.setXYZ(trail.n, rx, 0.05, rz); pb.setXYZ(trail.n, car.x + f[0] * sp.wb / 2, 0.05, car.z + f[1] * sp.wb / 2);
  trail.n++; pa.needsUpdate = pb.needsUpdate = true;
  trail.rear.geometry.setDrawRange(0, trail.n); trail.front.geometry.setDrawRange(0, trail.n);
}

/* 雷達:前/後保險桿各 5 點到障礙物的最短距離 */
function radar() {
  const sp = car.spec, near = obstacles.filter((o) => Math.abs(o.x - car.x) + Math.abs(o.z - car.z) < o.hw + o.hl + sp.L + 4);
  const side = (zl) => {
    let m = 9;
    for (const t of [-1, -0.5, 0, 0.5, 1]) { const [x, z] = localToWorld2(car.x, car.z, car.a, t * sp.W / 2, zl); for (const o of near) m = Math.min(m, pointDist(o, x, z)); }
    return m;
  };
  return { f: side(sp.L / 2), r: side(-sp.L / 2) };
}
let beepAcc = 0;
function radarBeep(dt, rd) {
  if (S.mode !== 'drive' || S.muted || S.menu) return;
  const d = car.gear === 'R' ? rd.r : car.gear === 'D' ? rd.f : 9;
  if (d > 1.5) { beepAcc = 0; return; }
  const iv = d < 0.3 ? 0.09 : 0.12 + d * 0.38; beepAcc += dt;
  if (beepAcc >= iv) { beepAcc = 0; beep(d < 0.3 ? 2300 : 1900, d < 0.3 ? 0.08 : 0.06); }
}

/* ================= evaluation ================= */
function evaluate() {
  const sp = car.spec, sc = SCEN[S.scenIdx];
  let worst = -9;
  for (const [x, z] of corners(carBox())) { const [lx, lz] = toLocal(spot, x, z); worst = Math.max(worst, Math.abs(lx) - spot.hw, Math.abs(lz) - spot.hl); }
  const inside = worst <= 0.02;
  const [clx, clz] = toLocal(spot, car.x, car.z);
  const d = Math.abs(wrapPi(car.a - spot.a)), angErr = (d > Math.PI / 2 ? Math.PI - d : d) * 180 / Math.PI;
  const rightDir = Math.abs(wrapPi(car.a - spot.expect)) < Math.PI / 2;
  const gap = (sgn) => {
    let m = 9;
    for (const t of [-0.3, 0, 0.4]) { const [x, z] = localToWorld2(car.x, car.z, car.a, sgn * sp.W / 2, car.eye.z + t); for (const o of obstacles) m = Math.min(m, pointDist(o, x, z)); }
    return m;
  };
  const doorL = gap(1), doorR = gap(-1);
  const corr = Math.max(0, stats.shifts - sc.expectShift);
  const latCm = Math.abs(clx) * 100, lonCm = Math.abs(clz) * 100;
  let score = 100; const notes = [];
  if (!inside) { score -= 40 + Math.min(20, worst * 100 / 5); notes.push(`車身超出車格 ${Math.round(worst * 100)} cm`); }
  score -= Math.min(25, Math.max(0, angErr - 1.5) * 2.5); if (angErr > 3) notes.push(`車身歪了 ${angErr.toFixed(1)}°,入格前早點把方向盤回正`);
  score -= Math.min(15, Math.max(0, latCm - 10) / 4);
  if (sc.id !== 'parallel' && latCm > 15) notes.push(`左右偏 ${latCm.toFixed(0)} cm(置中兩側都好開門)`);
  if (sc.id === 'parallel' && latCm > 15) notes.push(`離路緣不夠近(偏 ${latCm.toFixed(0)} cm)`);
  score -= Math.min(10, Math.max(0, lonCm - 30) / 10);
  score -= Math.min(45, stats.collisions * 15); if (stats.collisions) notes.push(`碰撞 ${stats.collisions} 次`);
  score -= Math.min(15, corr * 3); if (corr) notes.push(`多修正了 ${corr} 次(換檔 ${stats.shifts} 次)`);
  if (!rightDir) { score -= 10; notes.push(sc.id === 'perp' ? '建議倒車入庫、車頭朝外(離場較安全)' : sc.id === 'parallel' ? '車頭應與車流同向' : '斜角格應順向車頭朝內'); }
  if (doorL < 0.55) { score -= 5; notes.push(`駕駛側只剩 ${Math.round(doorL * 100)} cm,車門不好開`); }
  if (Math.abs(car.v) > 0.05) notes.push('車子還在動');
  score = Math.round(clamp(score, 0, 100));
  const grade = !inside ? '未入格' : score >= 95 ? 'S' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  if (inside && !notes.length) notes.push('完美!');
  return { inside, worst, angErr, latCm, lonCm, rightDir, doorL, doorR, score, grade, notes, corr };
}
const cls = (v, g, y) => (v <= g ? 'g' : v <= y ? 'y' : 'r');
function evalHTML(e) {
  const m = (v) => (v > 5 ? '>5' : v.toFixed(2));
  return `<div class="kv"><span>入格</span><b class="${e.inside ? 'g' : 'r'}">${e.inside ? '✔ 完全在格內' : '✘ 超出 ' + Math.round(e.worst * 100) + ' cm'}</b></div>
  <div class="kv"><span>角度偏差</span><b class="${cls(e.angErr, 1.5, 4)}">${e.angErr.toFixed(1)}°</b></div>
  <div class="kv"><span>左右偏移</span><b class="${cls(e.latCm, 10, 25)}">${e.latCm.toFixed(0)} cm</b></div>
  <div class="kv"><span>前後偏移</span><b class="${cls(e.lonCm, 30, 60)}">${e.lonCm.toFixed(0)} cm</b></div>
  <div class="kv"><span>車頭方向</span><b class="${e.rightDir ? 'g' : 'y'}">${e.rightDir ? '正確' : '相反'}</b></div>
  <div class="kv"><span>駕駛側 / 副駕側空間</span><b class="${e.doorL >= 0.7 ? 'g' : e.doorL >= 0.5 ? 'y' : 'r'}">${m(e.doorL)} / ${m(e.doorR)} m</b></div>
  <div class="kv"><span>碰撞</span><b class="${stats.collisions ? 'r' : 'g'}">${stats.collisions}</b></div>
  <div class="kv"><span>換檔 / 多餘修正</span><b class="${cls(e.corr, 0, 2)}">${stats.shifts} / ${e.corr}</b></div>
  <div class="kv"><span>用時</span><b>${stats.t.toFixed(1)} s</b></div>`;
}
function submit() {
  if (Math.abs(car.v) > 0.2) { toast('先停妥再評分', true); return; }
  const e = evaluate(); stats.running = false; stats.submitted = true;
  const b = lsGet(bestKey()), isBest = e.inside && (!b || e.score > b.score);
  if (isBest) lsSet(bestKey(), { score: e.score, grade: e.grade });
  $('resultTitle').textContent = `${SCEN[S.scenIdx].name} · ${car.spec.name} · ${DIFF[S.diffIdx].name}${isBest ? ' · 🏆 新紀錄' : ''}`;
  const gb = $('gradeBig');
  gb.textContent = e.grade; gb.style.fontSize = e.inside ? '72px' : '48px';
  gb.style.color = !e.inside ? 'var(--bad)' : e.score >= 85 ? 'var(--ok)' : e.score >= 70 ? 'var(--accent)' : 'var(--warn)';
  $('scoreBig').textContent = `${e.score} 分`;
  $('resultList').innerHTML = evalHTML(e);
  $('resultNotes').innerHTML = e.notes.map((n) => `<li>${n}</li>`).join('');
  S.result = true; S.top = true; $('result').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  chime(e.inside);
}

/* ================= camera ================= */
const V3 = new THREE.Vector3();
function lens(fov, near) {
  if (camera.fov !== fov || camera.near !== near) {
    camera.fov = fov; camera.near = near; camera.updateProjectionMatrix();
    pipeline.ink.mat.uniforms.uNear.value = near;
  }
}
function updateCamera(dt) {
  const sp = car.spec;
  if (S.top) {
    const ex = S.mode === 'drive' ? car.x : player.x, ez = S.mode === 'drive' ? car.z : player.z;
    const cx = (spot.x + ex) / 2, cz = (spot.z + ez) / 2, dist = Math.hypot(ex - spot.x, ez - spot.z);
    const base = Math.max(spot.hl * 2, sp.L) * 2.3 + 6, h = Math.max(base, dist * 1.5 + base * 0.55) * S.topZoom;
    const k = topCam.init ? 1 - Math.exp(-5 * dt) : 1; topCam.init = true;
    topCam.x += (cx - topCam.x) * k; topCam.z += (cz - topCam.z) * k; topCam.h += (h - topCam.h) * k;
    lens(50, 0.5); pipeline.setInkFade(160, 260);
    camera.up.set(0, 0, -1); camera.position.set(topCam.x, topCam.h, topCam.z + 0.001); camera.lookAt(topCam.x, 0, topCam.z);
    return;
  }
  topCam.init = false; camera.up.set(0, 1, 0); pipeline.setInkFade(40, 98);
  if (S.mode === 'walk') { lens(72, 0.1); camera.position.set(player.x, 1.65, player.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ'); }
  else if (S.view === 'fp') {
    lens(78, 0.05);
    V3.set(car.eye.x, car.eye.y, car.eye.z); car.group.localToWorld(V3); camera.position.copy(V3);
    camera.rotation.set(S.headPitch, car.a + Math.PI + S.headYaw, 0, 'YXZ');
  } else {
    lens(60, 0.25);
    const ang = car.a + Math.PI + S.chaseYaw, dist = sp.L * 0.75 + 5;
    V3.set(car.x + Math.sin(ang) * dist, sp.H + 2.2, car.z + Math.cos(ang) * dist);
    camera.position.lerp(V3, 1 - Math.exp(-6 * dt)); camera.lookAt(car.x, sp.H * 0.5, car.z);
  }
}

/* ================= HUD ================= */
const HINT = {
  walk: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 走路 · <kbd>Shift</kbd> 跑 · 滑鼠 轉頭 · <kbd>E</kbd> 上車 · <kbd>T</kbd> 俯視圖 · <kbd>Enter</kbd> 評分 · <kbd>R</kbd> 重來 · <kbd>Esc</kbd> 選單',
  drive: '<kbd>W</kbd> 前進 · <kbd>S</kbd> 煞車/倒車 · <kbd>A</kbd><kbd>D</kbd> 轉向 · <kbd>Space</kbd> 手煞車 · <kbd>E</kbd> 下車 · <kbd>V</kbd> 車內/外 · <kbd>F</kbd> 視線回正 · <kbd>T</kbd> 俯視 · <kbd>Enter</kbd> 評分 · <kbd>R</kbd> 重來',
};
let hudAcc = 0, lastHint = '';
function updateHUD(dt, rd) {
  const drive = S.mode === 'drive', fp = drive && S.view === 'fp' && !S.top && !S.menu;
  $('dash').classList.toggle('hidden', !drive);
  $('cross').classList.toggle('hidden', !(S.mode === 'walk' && !S.top));
  $('lockhint').classList.toggle('hidden', !!document.pointerLockElement || S.top || S.menu || S.result);
  const pm = S.mode === 'walk' && nearCar() ? '按 <kbd>E</kbd> 上車' : '';
  $('prompt').innerHTML = pm; $('prompt').classList.toggle('hidden', !pm);
  const h = HINT[S.mode] + (S.top ? ' · 滾輪 縮放' : ''); if (h !== lastHint) { $('hint').innerHTML = h; lastHint = h; }
  mirrors.set('rear', fp); mirrors.set('left', fp); mirrors.set('right', fp); mirrors.set('back', fp && car.gear === 'R');
  if (toastT && performance.now() > toastT) { $('toast').style.opacity = 0; toastT = 0; }

  hudAcc += dt; if (hudAcc < 0.1) return; hudAcc = 0;
  $('tbScen').textContent = `${SCEN[S.scenIdx].name} · ${car.spec.name} · ${DIFF[S.diffIdx].name}`;
  const t = stats.t;
  $('tbTime').textContent = `⏱ ${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  $('tbCol').innerHTML = `<span class="lb">碰撞 </span><span class="ic">💥</span><b class="${stats.collisions ? 'r' : 'g'}">${stats.collisions}</b>`;
  $('tbShift').innerHTML = `<span class="lb">換檔 </span><span class="ic">⇄</span>${stats.shifts}`;
  if (drive) {
    $('spd').textContent = Math.round(Math.abs(car.v) * 3.6);
    [...$('gear').children].forEach((s) => s.classList.toggle('on', s.textContent === car.gear));
    $('steerG').setAttribute('transform', `rotate(${(-car.steer * 7 * 180 / Math.PI).toFixed(1)})`);
    $('acTag').textContent = S.autoCenter ? '' : '(不回正)'; $('muteTag').textContent = S.muted ? '🔇' : '';
    for (const [k, v] of [['F', rd.f], ['R', rd.r]]) {
      $('rv' + k).textContent = v > 2.5 ? '-' : v.toFixed(2) + ' m';
      const b = $('rb' + k);
      b.style.width = (v > 2.5 ? 0 : clamp(100 - v / 2.5 * 100, 4, 100)) + '%';
      b.style.background = v < 0.35 ? 'var(--bad)' : v < 0.9 ? 'var(--warn)' : 'var(--ok)';
    }
  }
  const ep = $('evalPanel'); ep.classList.toggle('hidden', !S.top || S.result || S.menu);
  if (S.top) {
    const e = evaluate();
    ep.innerHTML = `<h4>${IS_TOUCH ? (ep.classList.contains('collapsed') ? '▸ ' : '▾ ') : ''}俯視檢查 ${e.inside ? '<span class="g">入格</span>' : '<span class="r">未入格</span>'} · 預估 ${e.score} 分</h4>${evalHTML(e)}
      <div class="legend"><i style="background:#3d7fe0"></i>後軸軌跡 <i style="background:#ff8a30"></i>前軸軌跡</div>
      <div class="muted"><kbd>Enter</kbd> 提交評分 · <kbd>T</kbd> 返回 · 滾輪縮放</div>`;
    outline.material.color.set(e.inside ? 0x3ecf8e : 0xff5a5a);
    spotFill.material.color.set(e.inside ? 0x3ecf8e : 0xf0c341); spotFill.material.opacity = e.inside ? 0.3 : 0.2;
  }
}

/* ================= loop ================= */
let last = performance.now();
let simT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  tick(Math.min(0.05, (now - last) / 1000)); last = now;
}
function tick(dt, draw = true) {
  simT += dt; const now = simT * 1000;
  let rd = { f: 9, r: 9 };
  if (IS_TOUCH) {
    if (!S.menu && !S.result) {
      if (S.top) { S.topZoom = clamp(S.topZoom * T.zoom, 0.35, 2.5); }
      else if (T.look.dx || T.look.dy) applyLook(T.look.dx * 0.006, T.look.dy * 0.006);
    }
    T.look.dx = T.look.dy = 0; T.zoom = 1;
  }
  if (!S.menu && !S.result) { if (S.mode === 'walk') updateWalk(dt); updateCar(dt, now / 1000); }
  syncCar();
  rd = radar(); radarBeep(dt, rd);
  person.visible = S.mode === 'walk' && S.top;
  person.position.set(player.x, 0, player.z); person.rotation.y = player.yaw;
  outline.visible = S.top; trail.rear.visible = trail.front.visible = S.top;
  updateCamera(dt);
  updateHUD(dt, rd);
  if (IS_TOUCH) syncTouchUI({ mode: S.mode, menu: S.menu, result: S.result, top: S.top, steerNorm: car.steer / car.spec.steer,
    near: S.mode === 'walk' && nearCar(), canExit: Math.abs(car.v) < 0.3, gear: car.gear });

  if (!draw) return;
  renderer.shadowMap.needsUpdate = true;
  pipeline.render();
  mirrors.render(renderer, scene, car);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  pipeline.setSize(innerWidth, innerHeight);
  mirrors.layout();
}
addEventListener('resize', onResize);
// 手機:網址列收合、旋轉後 innerHeight 會延遲更新
window.visualViewport?.addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 250));
if (IS_TOUCH) {
  initTouch({ onKey, canvas: renderer.domElement });
  $('evalPanel').addEventListener('pointerdown', (e) => { if (e.target.closest('h4')) $('evalPanel').classList.toggle('collapsed'); });
  const ios = /iP(hone|od|ad)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
  if (ios && !standalone) { const t = $('iosTip'); t.style.display = 'block'; t.innerHTML = '📱 iPhone:點 Safari 的「分享 → 加入主畫面」,從主畫面開啟即可<b>全螢幕</b>遊玩(沒有網址列)。'; }
}
onResize();

// 開場:背景先放一局預設場景
newScenario(); newRun(false); player.yaw += 0.6;
renderMenu();
requestAnimationFrame(loop);

// 除錯 / 自動測試用
window.__game = { S, step(sec, dt = 1 / 60, draw = true) { for (let t = 0; t < sec; t += dt) tick(dt, draw && t + dt >= sec); }, get car() { return car; }, get spot() { return spot; }, player, evaluate, keys, onKey, get obstacles() { return obstacles; } };
