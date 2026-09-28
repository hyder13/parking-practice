import * as THREE from 'three';
import { PAL } from './core/palette.js';
import { Pipeline } from './core/post.js';
import { initAudio, setMuted, isMuted, sfx } from './core/audio.js';
import { spriteURL } from './core/pixel.js';
import { FW, FH, PLAYER_Y, setFieldHeight } from './game/config.js';
import { Space } from './game/space.js';
import { FX } from './game/fx.js';
import { Game } from './game/game.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const IS_TOUCH = Q.has('touch') || matchMedia('(pointer: coarse)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem('starbees.' + k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('starbees.' + k, v); } catch { /* 私密模式 */ } },
};

/* ================= renderer / scene / light ================= */
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(new THREE.Color(PAL.space), 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 900);

// 主光從左上前方、冷色補光從右下、粉紅輪廓光從後上方(讓角色在黑背景上有邊)
const key = new THREE.DirectionalLight(PAL.key, 2.5); key.position.set(-6, 10, 18); scene.add(key);
const fill = new THREE.DirectionalLight(PAL.fill, 0.85); fill.position.set(10, -6, 10); scene.add(fill);
const rim = new THREE.DirectionalLight(PAL.rim, 0.9); rim.position.set(2, 14, -12); scene.add(rim);
scene.add(new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.0));

const space = new Space(scene);
const fx = new FX(scene);

// 太空背景要純黑:拿掉暗部提亮(uLift),其他沿用停車場的描線 + 調色
const pipeline = new Pipeline(renderer, scene, camera, {
  pixelBudget: IS_TOUCH ? 1.3e6 : 4.2e6,
  gradeOpts: { uLift: 0.0, uVignette: 0.3, uSaturation: 1.16, uWarmth: 0.015, uShadowTint: 0xb8b2e6 },
  inkOpts: { uFadeStart: 170, uFadeEnd: 330, uSens: 0.004 },
});

/* ================= camera fit ================= */
// 微微傾斜的俯視:保留直立街機的構圖,但看得出 3D 厚度
const TILT = 0.2, LOOK_Y = -0.4;
const view = { dist: 60, sway: 0, shake: 0, upp: 0.03 };
const V = new THREE.Vector3();
function place(d, x = 0) {
  camera.position.set(x, LOOK_Y - d * Math.sin(TILT), d * Math.cos(TILT));
  camera.up.set(0, 1, 0);
  camera.lookAt(x * 0.5, LOOK_Y, 0);
  camera.updateMatrixWorld();
}
function project(x, y) {
  V.set(x, y, 0).project(camera);
  return [(V.x + 1) / 2 * innerWidth, (1 - V.y) / 2 * innerHeight];
}
function fitCamera() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  // 直立手機比較長:場地跟著拉高(30 ~ 42),畫面不留大片空白
  setFieldHeight(FW / camera.aspect * 0.94);
  const fits = () => [[-1, 1], [1, 1], [-1, -1], [1, -1]].every(([i, j]) => {
    V.set(i * FW / 2, j * FH / 2, 0).project(camera);
    return Math.abs(V.x) <= 0.985 && Math.abs(V.y) <= 0.985;
  });
  let lo = 10, hi = 400;
  for (let k = 0; k < 30; k++) { const d = (lo + hi) / 2; place(d); if (fits()) hi = d; else lo = d; }
  view.dist = hi; place(hi);

  // HUD 貼齊場地的上 / 下緣
  const [tlx, tly] = project(-FW / 2, FH / 2), [trx] = project(FW / 2, FH / 2);
  const [blx, bly] = project(-FW / 2, -FH / 2), [brx] = project(FW / 2, -FH / 2);
  const root = document.documentElement.style;
  const w = trx - tlx;
  root.setProperty('--fl', `${tlx}px`); root.setProperty('--fw', `${w}px`);
  root.setProperty('--ft', `${Math.max(0, tly)}px`);
  root.setProperty('--fbot', `${Math.max(0, innerHeight - bly)}px`);
  root.setProperty('--fs', `${Math.max(8, Math.min(20, Math.round(w / 25)))}px`);
  const bottom = $('hudB').style; bottom.left = `${blx}px`; bottom.width = `${brx - blx}px`;
  const [, cy] = project(0, 0.8);
  $('msg').style.top = `${cy}px`;
  const [p0] = project(0, PLAYER_Y), [p1] = project(1, PLAYER_Y);
  view.upp = 1 / Math.max(1, p1 - p0);
  space.fit(camera, view.dist, TILT, LOOK_Y, pipeline.scale || 1);
}

/* ================= HUD / 訊息 / 跳字 ================= */
let msgT = 0;
function showMsg(lines, dur = 2) {
  $('msg').innerHTML = lines.map(([t, c]) => `<div class="${c}">${t}</div>`).join('');
  msgT = dur;
}
const pops = [];
function popup(x, y, text, color) {
  const el = document.createElement('div');
  el.className = `pop ${color}`; el.textContent = text;
  document.body.appendChild(el);
  pops.push({ el, x, y, t: 0 });
}
function updatePops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t > 1.1) { p.el.remove(); pops.splice(i, 1); continue; }
    const [sx, sy] = project(p.x, p.y + p.t * 0.8);
    p.el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`;
    p.el.style.opacity = p.t > 0.8 ? (1.1 - p.t) / 0.3 : 1;
  }
}

const hudCache = {};
function hud({ score, hi, lives, stage }) {
  const fmt = (n) => (n ? String(n) : '00');
  if (hudCache.score !== score) { $('score').textContent = fmt(score); hudCache.score = score; }
  if (hudCache.hi !== hi) { $('hi').textContent = fmt(hi); $('tHi').textContent = hi; hudCache.hi = hi; }
  if (hudCache.lives !== lives) {
    $('lives').innerHTML = `<img class="px" src="${spriteURL('ship')}" alt="">`.repeat(Math.min(lives, 8));
    hudCache.lives = lives;
  }
  if (hudCache.stage !== stage) {
    const five = Math.floor(stage / 5), one = stage % 5;
    $('badges').innerHTML = `<img class="px" src="${spriteURL('badge5')}" alt="">`.repeat(five)
      + `<img class="px" src="${spriteURL('flag')}" alt="">`.repeat(one);
    hudCache.stage = stage;
  }
}

/* ================= 換關的「曲速」 ================= */
let warpT = 0, warpDur = 1;
function warp(d) { warpT = warpDur = d; }

/* ================= game ================= */
const game = new Game(scene, {
  loadHi: () => +store.get('hi', 20000) || 20000,
  saveHi: (v) => store.set('hi', v),
  msg: showMsg,
  popup,
  sfx: (n) => sfx[n] && sfx[n](),
  explode: (x, y, c, o) => fx.explode(x, y, c, o),
  setBeam: (...a) => fx.setBeam(...a),
  shake: (a) => { view.shake = Math.max(view.shake, a); },
  vibrate: (ms) => { if (!isMuted()) try { navigator.vibrate && navigator.vibrate(ms); } catch { /* 不支援 */ } },
  hud,
  stage: (n) => { space.setTheme(n - 1); warp(1.6); },
  warp,
  gameOver: (stats, score) => {
    $('rScore').textContent = score;
    $('rShots').textContent = stats.shots;
    $('rHits').textContent = stats.hits;
    $('rRatio').textContent = `${stats.shots ? (stats.hits / stats.shots * 100).toFixed(1) : '0.0'} %`;
    $('over').classList.remove('hidden');
  },
});
game.pushHUD();

/* ================= 標題 / 暫停 / 結算 ================= */
document.body.classList.add('title'); // 標題畫面時隱藏 HUD(artifact 版沒有自己的 <body> 標籤)
let selStage = 1, paused = false;
$('sBee').src = spriteURL('bee'); $('sBfly').src = spriteURL('bfly'); $('sBoss').src = spriteURL('boss');
$('hint').innerHTML = IS_TOUCH
  ? '手指<b>左右拖曳</b>移動 · <b>按著</b>自動連射<br>被光束抓走的戰機,打下帶著它的王就能救回 → <b>雙機</b>'
  : '<b>← →</b> / <b>A D</b> 移動 · <b>SPACE</b> 射擊 · <b>P</b> 暫停<br>被光束抓走的戰機,打下帶著它的王就能救回 → <b>雙機</b>';
const sel = $('stageSel');
sel.innerHTML = '<span class="small" style="margin:0;align-self:center">STAGE</span>' + [1, 2, 3, 4, 5]
  .map((n) => `<button class="sbtn${n === 1 ? ' sel' : ''}" data-s="${n}">${n === 3 ? '3★' : n}</button>`).join('');
sel.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  selStage = +b.dataset.s;
  sel.querySelectorAll('button').forEach((o) => o.classList.toggle('sel', o === b));
});

function startGame() {
  initAudio();
  $('title').classList.add('hidden'); $('over').classList.add('hidden');
  document.body.classList.remove('title');
  game.start(selStage);
}
$('btnStart').addEventListener('click', startGame);
// 標題畫面:點空白處也能開始(按鈕之外)
$('title').addEventListener('click', (e) => { if (!e.target.closest('button')) startGame(); });
function showTitle() { game.toTitle(); $('title').classList.remove('hidden'); document.body.classList.add('title'); }
$('btnAgain').addEventListener('click', () => { $('over').classList.add('hidden'); showTitle(); });

function syncSound() {
  $('btnSnd').textContent = isMuted() ? 'SOUND OFF' : 'SOUND ON';
  $('btnMute').textContent = isMuted() ? '×' : '♪';
}
setMuted(store.get('muted', '0') === '1'); syncSound();
const toggleMute = () => { initAudio(); setMuted(!isMuted()); store.set('muted', isMuted() ? '1' : '0'); syncSound(); };
$('btnSnd').addEventListener('click', toggleMute);
$('btnMute').addEventListener('click', (e) => { e.stopPropagation(); toggleMute(); });

let crt = store.get('crt', '1') === '1';
const syncCrt = () => { $('crt').classList.toggle('hidden', !crt); $('btnCrt').textContent = crt ? 'CRT ON' : 'CRT OFF'; };
syncCrt();
$('btnCrt').addEventListener('click', () => { crt = !crt; store.set('crt', crt ? '1' : '0'); syncCrt(); });

const inGame = () => !['title', 'ended'].includes(game.phase);
function setPause(p) {
  if (p && !inGame()) return;
  paused = p; $('pause').classList.toggle('hidden', !p);
  game.input.fire = false; game.input.move = 0;
}
$('btnPause').addEventListener('click', (e) => { e.stopPropagation(); setPause(!paused); });
$('btnResume').addEventListener('click', () => setPause(false));
$('btnQuit').addEventListener('click', () => { setPause(false); showTitle(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && inGame()) setPause(true); });

/* ================= input ================= */
const keys = {};
const LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], FIRE = ['Space', 'KeyZ', 'KeyJ', 'KeyK', 'ArrowUp'];
function syncKeys() {
  game.input.move = (RIGHT.some((k) => keys[k]) ? 1 : 0) - (LEFT.some((k) => keys[k]) ? 1 : 0);
  if (!touchId) game.input.fire = FIRE.some((k) => keys[k]);
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') { setPause(!paused); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && !$('title').classList.contains('hidden')) { e.preventDefault(); startGame(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && !$('over').classList.contains('hidden')) { e.preventDefault(); $('btnAgain').click(); return; }
  if (FIRE.includes(e.code) || LEFT.includes(e.code) || RIGHT.includes(e.code)) e.preventDefault();
  syncKeys();
});
addEventListener('keyup', (e) => { keys[e.code] = false; syncKeys(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; syncKeys(); });

// 觸控:整個畫面都是操作區。拖曳 = 相對移動(手指不會擋住戰機),按著 = 自動連射
const SENS = 1.25;
let touchId = null, lastX = 0;
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  initAudio();
  if (touchId !== null || paused || !inGame()) return;
  touchId = e.pointerId; lastX = e.clientX;
  try { cvs.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
  game.input.fire = true;
});
cvs.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touchId) return;
  game.input.drag += (e.clientX - lastX) * view.upp * SENS;
  lastX = e.clientX;
});
const endTouch = (e) => { if (e.pointerId !== touchId) return; touchId = null; game.input.fire = false; syncKeys(); };
cvs.addEventListener('pointerup', endTouch);
cvs.addEventListener('pointercancel', endTouch);
cvs.addEventListener('contextmenu', (e) => e.preventDefault());

/* ================= loop ================= */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  tick(Math.min(0.05, (now - last) / 1000)); last = now;
}
function tick(dt, draw = true) {
  if (!paused) {
    game.update(dt);
    fx.update(dt);
    if (warpT > 0) warpT = Math.max(0, warpT - dt);
    space.speed = 1 + 13 * Math.sin(Math.PI * (1 - warpT / warpDur)) * (warpT > 0 ? 1 : 0);
    space.update(dt);
    updatePops(dt);
    if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').innerHTML = ''; }
    // 鏡頭:跟著戰機微微平移(視差)+ 爆炸震動
    const px = game.player.state === 'play' ? game.player.x : 0;
    view.sway += (px * 0.08 - view.sway) * Math.min(1, dt * 3);
    view.shake = Math.max(0, view.shake - dt * 2.2);
    place(view.dist, view.sway);
    if (view.shake > 0) {
      const s = view.shake * view.shake * 0.6;
      camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s;
      camera.updateMatrixWorld();
    }
  }
  if (draw) pipeline.render();
}

function onResize() {
  pipeline.setSize(innerWidth, innerHeight);
  fitCamera();
}
addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);
addEventListener('orientationchange', () => setTimeout(onResize, 250));
onResize();
requestAnimationFrame(loop);

// 除錯 / 自動測試用(分頁隱藏時 rAF 會停,用 step 手動推進)
window.__game = {
  game, fx, space, camera, keys,
  step(sec, dt = 1 / 60, draw = false) { for (let t = 0; t < sec; t += dt) tick(dt, false); if (draw) tick(0, true); },
  start: (n = 1) => { selStage = n; startGame(); },
};
