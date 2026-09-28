/* 程序合成音效(無音檔):雷達嗶聲、碰撞、評分提示音。 */
let ctx = null;

export function ensureAudio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function beep(freq = 1900, dur = 0.07, vol = 0.07, type = 'sine') {
  if (!ctx) return;
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}

export const thud = () => { beep(95, 0.28, 0.35, 'square'); beep(60, 0.35, 0.25, 'sine'); };
export const chime = (ok) => { beep(ok ? 1320 : 300, 0.22, 0.12, 'triangle'); if (ok) setTimeout(() => beep(1760, 0.25, 0.1, 'triangle'), 140); };
