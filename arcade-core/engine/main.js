import * as THREE from 'three';
import { PAL } from '@skin/core/palette.js';
import { Pipeline } from '../render/post.js';
import { initAudio, setMuted, isMuted } from '../audio/synth.js';
import { sfx } from '@skin/core/audio.js';
import { spriteURL } from '../ui/sprite.js';
import { FW, FH, PLAYER_Y, ROW0, MAX_STAGE, setFieldHeight, stageTheme } from './field.js';
import { Sea } from '@skin/game/sea.js';
import { FX } from './fx.js';
import { Game } from './game.js';
import { spawnModel } from '@skin/game/models.js';
import { META, TEXT, LOOK } from '@skin/skin.js';

/* ------------------------------------------------------------------ *
 * 進入點(所有換皮共用):renderer / 鏡頭 / HUD / 輸入 / 選單。
 * 各遊戲的 src/main.js 只有一行 import 這個檔;長相、文字、描線調色都從 @skin 拿。
 * ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const IS_TOUCH = Q.has('touch') || matchMedia('(pointer: coarse)').matches;
const store = {
  get(k, d) { try { const v = localStorage.getItem(META.store + k); return v === null ? d : v; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(META.store + k, v); } catch { /* 私密模式 */ } },
};

/* ================= renderer / scene / light ================= */
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(new THREE.Color(PAL.sea), 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 1, 900);

// 太陽從左上前方照下來(主題會改顏色 / 強度)、天空藍補光從右下、暖色輪廓光從後上方
const key = new THREE.DirectionalLight(PAL.key, 2.4); key.position.set(-6, 10, 18); scene.add(key);
const fill = new THREE.DirectionalLight(PAL.fill, 0.7); fill.position.set(10, -6, 10); scene.add(fill);
const rim = new THREE.DirectionalLight(PAL.rim, 0.6); rim.position.set(2, 14, -12); scene.add(rim);
const hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.0); scene.add(hemi);

const sea = new Sea(scene, { key, hemi });
const fx = new FX(scene);

// 調色 / 描線依各款風格(skin.js LOOK)
const pipeline = new Pipeline(renderer, scene, camera, {
  pixelBudget: IS_TOUCH ? 1.3e6 : 4.2e6,
  gradeOpts: LOOK.grade,
  inkOpts: LOOK.ink,
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
  // 中央訊息放在陣型下緣 ~ 戰機活動區上緣之間
  const mid = (ROW0 - 6 + game.yMax) / 2;
  $('msg').style.top = `${project(0, mid)[1]}px`;
  // 連擊數字貼在場地右側
  const [cx, cyy] = project(FW / 2 - 0.8, 1.5);
  $('combo').style.left = `${cx}px`; $('combo').style.top = `${cyy}px`;
  const [p0] = project(0, PLAYER_Y), [p1] = project(1, PLAYER_Y);
  view.upp = 1 / Math.max(1, p1 - p0);
  sea.fit(camera, view.dist, TILT, LOOK_Y);
}

/* ================= HUD / 訊息 / 跳字 ================= */
let msgT = 0;
function showMsg(lines, dur = 2) {
  $('msg').innerHTML = lines.map(([t, c]) => `<div class="${c}">${t}</div>`).join('');
  msgT = dur;
}
const pops = [];
function popup(x, y, text, color, tag = false) {
  if (pops.length > 24) pops.shift().el.remove();
  const el = document.createElement('div');
  el.className = `pop ${color}${tag ? ' tag' : ''}`; el.textContent = text;
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
    // 最多畫 4 台,再多就改成「×N」(不然會擠到狀態列)
    $('lives').innerHTML = `<img class="px" src="${spriteURL('ship')}" alt="">`.repeat(Math.min(lives, lives > 4 ? 1 : 4))
      + (lives > 4 ? `<span class="lx">×${lives}</span>` : '');
    hudCache.lives = lives;
  }
  if (hudCache.stage !== stage) {
    // 關卡徽章:50 / 10 / 5 / 1(原作的旗子,100 關最多 10 個圖示)
    let n = stage, html = '';
    for (const [v, name] of [[50, 'badge50'], [10, 'badge10'], [5, 'badge5'], [1, 'flag']]) {
      html += `<img class="px" src="${spriteURL(name)}" alt="">`.repeat(Math.floor(n / v)); n %= v;
    }
    $('badges').innerHTML = html;
    $('stageNo').textContent = stage ? TEXT.stage(stage) : '';
    hudCache.stage = stage;
  }
}

/* ---------- 戰機狀態:進化經驗條 + 火力格 ---------- */
let lastW = 0;
let lastLoops = -1;
function status({ evo, name, frac, w, maxW, rapid, shield, loops }) {
  if (loops !== lastLoops) {
    $('loops').innerHTML = Array.from({ length: 3 }, (_, i) => `<i class="${i < loops ? 'on' : ''}"></i>`).join('');
    $('btnLoop').classList.toggle('empty', !loops);
    lastLoops = loops;
  }
  if (w > lastW && lastW) bump($('pwr'));
  lastW = w;
  $('evoName').textContent = `Lv.${evo} ${name}`;
  $('xpFill').style.width = `${Math.round(frac * 100)}%`;
  $('pwr').innerHTML = Array.from({ length: maxW }, (_, i) => `<i class="${i < w ? 'on' : ''}"></i>`).join('')
    + (rapid ? '<b class="cyan">R</b>' : '') + (shield ? '<b class="green">S</b>' : '');
}

/* ---------- 連擊 / 側邊通知 / BOSS 血條 / 閃光 ----------
 * 畫面中央只留流程訊息(STAGE / READY / WARNING / CLEAR);
 * 連擊與誇獎集中在右側連擊數字,道具與進化是戰機頭上的小標籤,成就走左上角側欄。 */
const bump = (el, cls = 'bump') => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
let comboHide = 0;
function combo(n, word, color, bonus) {
  const el = $('combo');
  clearTimeout(comboHide);
  el.classList.remove('mile', 'pop');
  if (n >= 2) {
    el.innerHTML = `<b>${n}</b><span class="${word ? color : ''}">${word || 'COMBO'}</span>`;
    el.classList.add('on');
    el.classList.toggle('hot', n >= 20);
    bump(el, word ? 'mile' : 'pop');
  } else if (bonus) {
    // 連擊結束:數字換成獎勵分數,一秒後淡出
    el.innerHTML = `<b class="yellow">+${bonus}</b><span>BONUS</span>`;
    bump(el, 'pop');
    comboHide = setTimeout(() => el.classList.remove('on'), 1100);
  } else el.classList.remove('on');
}
function feed(text, color = 'white') {
  const box = $('feed');
  const el = document.createElement('div');
  el.className = `feed ${color}`; el.textContent = text;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), 3200);
}
function evolved() { bump($('status'), 'glow'); }
function bossBar(name, frac, gold) {
  const el = $('bossBar');
  if (!name) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden'); el.classList.toggle('gold', !!gold);
  $('bossName').textContent = name;
  $('bossFill').style.width = `${Math.max(0, frac * 100).toFixed(1)}%`;
}
function flash(k = 1) {
  const el = $('flash');
  el.style.transition = 'none'; el.style.opacity = String(0.5 * k); // 不要整片刷白(也顧及光敏感)
  void el.offsetWidth; el.style.transition = 'opacity .6s ease-out'; el.style.opacity = '0';
}
const achSet = new Set((store.get('ach', '') || '').split(',').filter(Boolean));
function achieve(id, label) {
  achSet.add(id); store.set('ach', [...achSet].join(','));
  feed(`★ ${label}`, 'yellow');
  sfx.achieve();
}
let best = Math.min(MAX_STAGE, +store.get('best', 1) || 1); // 舊版 100 關存的進度要夾回 30
function progress(n) { if (n > best) { best = Math.min(n, MAX_STAGE); store.set('best', best); renderCheckpoints(); } }

/* ================= 換關的「曲速」 ================= */
let warpT = 0, warpDur = 1;
function warp(d) { warpT = warpDur = d; }

/* ================= game ================= */
const game = new Game(scene, {
  loadHi: () => +store.get('hi', 20000) || 20000,
  saveHi: (v) => store.set('hi', v),
  msg: showMsg,
  popup,
  sfx: (n, a) => sfx[n] && sfx[n](a),
  loadAch: () => [...achSet], achieve, progress, status, combo, feed, evolved, bossBar, flash,
  explode: (x, y, c, o) => fx.explode(x, y, c, o),
  setBeam: (...a) => fx.setBeam(...a),
  shake: (a) => { view.shake = Math.max(view.shake, a); },
  vibrate: (ms) => { if (!isMuted()) try { navigator.vibrate && navigator.vibrate(ms); } catch { /* 不支援 */ } },
  hud,
  stage: (n) => { sea.setTheme(stageTheme(n)); warp(1.6); },
  warp,
  gameOver: (stats, score) => {
    $('rScore').textContent = score;
    $('rStage').textContent = stats.stage;
    $('rEvo').textContent = `Lv.${stats.evo}`;
    $('rCombo').textContent = stats.maxCombo;
    $('rKills').textContent = stats.kills;
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
function renderCheckpoints() {
  // 檢查點:每 5 關一個,打到過的才解鎖(測試版全部開放,鎖住的顯示暗色)
  const cps = Array.from({ length: MAX_STAGE / 5 }, (_, i) => i * 5 + 1);
  $('stageSel').innerHTML = cps.map((n) => `<button class="sbtn${n === selStage ? ' sel' : ''}${n > best ? ' locked' : ''}" data-s="${n}">${n}</button>`).join('');
  $('bestStage').textContent = best;
}
$('sBee').src = spriteURL('bee'); $('sBfly').src = spriteURL('bfly'); $('sBoss').src = spriteURL('boss');
$('hint').innerHTML = IS_TOUCH ? TEXT.hintTouch : TEXT.hintKeys;
const sel = $('stageSel');
renderCheckpoints();
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
const syncCrt = () => { $('crt').classList.toggle('hidden', !crt); $('btnCrt').textContent = `${TEXT.crt} ${crt ? 'ON' : 'OFF'}`; };
syncCrt();
$('btnCrt').addEventListener('click', () => { crt = !crt; store.set('crt', crt ? '1' : '0'); syncCrt(); });

const inGame = () => !['title', 'ended'].includes(game.phase);
function setPause(p) {
  if (p && !inGame()) return;
  paused = p; $('pause').classList.toggle('hidden', !p);
  game.input.fire = false; game.input.move = 0; game.input.moveY = 0;
}
$('btnPause').addEventListener('click', (e) => { e.stopPropagation(); setPause(!paused); });
$('btnResume').addEventListener('click', () => setPause(false));
$('btnQuit').addEventListener('click', () => { setPause(false); showTitle(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && inGame()) setPause(true); });

/* ================= input ================= */
const keys = {};
const LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], UP = ['ArrowUp', 'KeyW'], DOWN = ['ArrowDown', 'KeyS'];
const FIRE = ['Space', 'KeyZ', 'KeyJ', 'KeyK'];
const LOOP = ['KeyX', 'KeyC', 'KeyL', 'ShiftLeft', 'ShiftRight'];
const MOVE_KEYS = [...LEFT, ...RIGHT, ...UP, ...DOWN];
function syncKeys() {
  const any = (a) => a.some((k) => keys[k]);
  game.input.move = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
  game.input.moveY = (any(UP) ? 1 : 0) - (any(DOWN) ? 1 : 0);
  if (!touchId) game.input.fire = FIRE.some((k) => keys[k]);
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') { setPause(!paused); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && !$('title').classList.contains('hidden')) { e.preventDefault(); startGame(); return; }
  if ((e.code === 'Enter' || e.code === 'Space') && !$('over').classList.contains('hidden')) { e.preventDefault(); $('btnAgain').click(); return; }
  if (LOOP.includes(e.code) && inGame() && !paused) { game.input.loop = true; e.preventDefault(); return; }
  if (FIRE.includes(e.code) || MOVE_KEYS.includes(e.code)) e.preventDefault();
  syncKeys();
});
addEventListener('keyup', (e) => { keys[e.code] = false; syncKeys(); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; syncKeys(); });

// 觸控:整個畫面都是操作區。拖曳 = 相對移動(上下左右,手指不會擋住戰機),按著 = 自動連射
const SENS = 1.25;
let touchId = null, lastX = 0, lastY = 0;
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', (e) => {
  initAudio();
  if (paused || !inGame()) return;
  // 一指拖曳中,另一指點一下 = 翻筋斗
  if (touchId !== null) { if (e.pointerId !== touchId) game.input.loop = true; return; }
  touchId = e.pointerId; lastX = e.clientX; lastY = e.clientY;
  try { cvs.setPointerCapture(e.pointerId); } catch { /* 合成事件 */ }
  game.input.fire = true;
});
cvs.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touchId) return;
  game.input.drag += (e.clientX - lastX) * view.upp * SENS;
  game.input.dragY -= (e.clientY - lastY) * view.upp * SENS;
  lastX = e.clientX; lastY = e.clientY;
});
const endTouch = (e) => { if (e.pointerId !== touchId) return; touchId = null; game.input.fire = false; syncKeys(); };
cvs.addEventListener('pointerup', endTouch);
cvs.addEventListener('pointercancel', endTouch);
cvs.addEventListener('contextmenu', (e) => e.preventDefault());
$('btnLoop').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); initAudio(); if (inGame() && !paused) game.input.loop = true; });
$('btnLoop').classList.toggle('hidden', !IS_TOUCH);

/* ================= loop ================= */
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  tick(Math.min(0.05, (now - last) / 1000)); last = now;
}
function tick(dt, draw = true) {
  if (!paused) {
    const k = game.timeScale; // BOSS 爆炸 / 進化時的慢動作
    game.update(dt * k, dt);
    fx.update(dt * k);
    if (warpT > 0) warpT = Math.max(0, warpT - dt);
    sea.speed = 1 + 4 * Math.sin(Math.PI * (1 - warpT / warpDur)) * (warpT > 0 ? 1 : 0);
    sea.update(dt);
    renderer.setClearColor(sea.clearColor, 1);
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
  game, fx, sea, camera, keys, scene, spawn: spawnModel,
  step(sec, dt = 1 / 60, draw = false) { for (let t = 0; t < sec; t += dt) tick(dt, false); if (draw) tick(0, true); },
  start: (n = 1) => { selStage = n; startGame(); },
};
