/* ------------------------------------------------------------------ *
 * 手機觸控操作。
 *   開車:左下方向盤(手指繞圈轉)、右下檔位 / 煞車 / 油門踏板
 *   走路:左下虛擬搖桿、右下「上車」
 *   其餘畫面:單指滑動 = 轉頭、雙擊 = 視線回正、兩指捏合 = 俯視圖縮放
 * 所有控制都用 Pointer Events + setPointerCapture,可多指同時操作
 * (一手方向盤一手油門)。
 * 狀態寫在 T,由 main.js 每幀讀取;按鈕類動作直接呼叫 onKey(code)。
 * ------------------------------------------------------------------ */

// ?touch=1 強制觸控介面(平板接鍵盤、或桌機測試手機版面用)
export const IS_TOUCH = new URLSearchParams(location.search).has('touch') ||
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;

export const T = {
  steer: null,          // null = 沒握方向盤;否則 -1..1(正 = 左轉)
  gas: false, brake: false,
  gear: 'D',            // 油門對應的方向
  joy: { x: 0, y: 0 },  // 走路搖桿,-1..1(y 正 = 往後)
  look: { dx: 0, dy: 0 }, // 累積的滑動量(px),main 讀完歸零
  zoom: 1,              // 累積的捏合倍率,main 讀完歸 1
};

export const WHEEL_MAX = Math.PI * 1.5; // 方向盤畫面轉角上限 ±270°

const $ = (id) => document.getElementById(id);
// setPointerCapture 對已結束的指標會丟例外;包起來避免中斷後續處理
const cap = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } };
const unwrap = (d) => (d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d);

export function initTouch({ onKey, canvas }) {
  document.body.classList.add('touch');

  // 擋掉瀏覽器預設手勢:長按選單、iOS 雙指縮放整頁
  addEventListener('contextmenu', (e) => e.preventDefault());
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault());
  document.addEventListener('touchmove', (e) => { if (!e.target.closest('.scroll')) e.preventDefault(); }, { passive: false });

  /* ---------- 方向盤 ---------- */
  const wheel = $('tWheel');
  let wId = null, wLast = 0, wAngle = 0;
  const ang = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
  wheel.addEventListener('pointerdown', (e) => {
    e.preventDefault(); cap(wheel, e);
    wId = e.pointerId; wLast = ang(e); wAngle = T.wheelVis || 0; wheel.classList.add('on');
  });
  wheel.addEventListener('pointermove', (e) => {
    if (e.pointerId !== wId) return;
    const a = ang(e);
    wAngle = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, wAngle + unwrap(a - wLast)));
    wLast = a;
    T.steer = -wAngle / WHEEL_MAX; // 螢幕順時針 = 右轉 = steer 負
  });
  const wEnd = (e) => { if (e.pointerId !== wId) return; wId = null; T.steer = null; wheel.classList.remove('on'); };
  wheel.addEventListener('pointerup', wEnd); wheel.addEventListener('pointercancel', wEnd);

  /* ---------- 踏板 ---------- */
  const hold = (el, key) => {
    const on = (e) => { e.preventDefault(); cap(el, e); T[key] = true; el.classList.add('on'); navigator.vibrate?.(8); };
    const off = () => { T[key] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off);
  };
  hold($('tGas'), 'gas'); hold($('tBrake'), 'brake');
  $('tGear').addEventListener('pointerdown', (e) => {
    e.preventDefault(); T.gear = T.gear === 'D' ? 'R' : 'D'; navigator.vibrate?.(15);
  });

  /* ---------- 走路搖桿 ---------- */
  const joy = $('tJoy'), knob = $('tKnob');
  let jId = null;
  const jMove = (e) => {
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let x = (e.clientX - (r.left + R)) / R, y = (e.clientY - (r.top + R)) / R;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    T.joy.x = x; T.joy.y = y;
    knob.style.transform = `translate(${x * R * 0.55}px, ${y * R * 0.55}px)`;
  };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); cap(joy, e); jId = e.pointerId; jMove(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jId) jMove(e); });
  const jEnd = (e) => { if (e.pointerId !== jId) return; jId = null; T.joy.x = T.joy.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerup', jEnd); joy.addEventListener('pointercancel', jEnd);

  /* ---------- 按鈕 ---------- */
  for (const b of document.querySelectorAll('[data-key]')) {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); navigator.vibrate?.(10); onKey(b.dataset.key); });
  }

  /* ---------- 畫面:轉頭 / 雙擊 / 捏合 ---------- */
  const pts = new Map(); let pinch = 0, lastTap = 0;
  const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    cap(canvas, e);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) pinch = dist();
    const now = performance.now();
    if (pts.size === 1 && now - lastTap < 300) onKey('KeyF');
    lastTap = now;
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 1) { T.look.dx += e.clientX - p.x; T.look.dy += e.clientY - p.y; }
    p.x = e.clientX; p.y = e.clientY;
    if (pts.size === 2) { const d = dist(); if (pinch > 0 && d > 0) T.zoom *= pinch / d; pinch = d; }
  });
  const cEnd = (e) => { pts.delete(e.pointerId); pinch = pts.size === 2 ? dist() : 0; };
  canvas.addEventListener('pointerup', cEnd); canvas.addEventListener('pointercancel', cEnd);
}

/** 每幀同步觸控 UI 的顯示狀態 */
let last = '';
export function syncTouchUI({ mode, menu, result, top, steerNorm, near, canExit, gear }) {
  const drive = mode === 'drive' && !menu && !result;
  const walk = mode === 'walk' && !menu && !result;
  const act = walk ? (near ? 'in' : '') : (drive && canExit ? 'out' : '');
  const key = [drive, walk, act, top, T.gear, gear].join('|');
  if (key !== last) {
    last = key;
    $('tWheel').classList.toggle('hidden', !drive);
    $('tPedals').classList.toggle('hidden', !drive);
    $('tJoy').classList.toggle('hidden', !walk);
    const a = $('tAct');
    a.classList.toggle('hidden', !act);
    a.textContent = act === 'in' ? '上車' : '下車';
    a.classList.toggle('walk', act === 'in');
    const g = $('tGear');
    g.querySelector('.d').classList.toggle('on', T.gear === 'D');
    g.querySelector('.r').classList.toggle('on', T.gear === 'R');
    g.classList.toggle('rev', T.gear === 'R');
    $('tBtns').classList.toggle('hidden', menu || result);
    $('tView').classList.toggle('hidden', !drive);
  }
  // 方向盤畫面角度:握住時跟手指,放開時跟車輪實際角度
  if (T.steer === null) T.wheelVis = -steerNorm * WHEEL_MAX;
  else T.wheelVis = -T.steer * WHEEL_MAX;
  $('tWheelImg').style.transform = `rotate(${T.wheelVis}rad)`;
}
