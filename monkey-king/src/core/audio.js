/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,只取「街機開場曲」的氣氛,不是原作的曲子。
 * AudioContext 一定要在使用者第一次觸控 / 按鍵時才建立(iOS / Chrome 規定)。
 * ------------------------------------------------------------------ */
let ctx = null, master = null, noiseBuf = null, muted = false;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.45; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.45; }
export const isMuted = () => muted;

function env(g, t, a, dur, vol) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone({ type = 'square', f0, f1 = f0, at = 0, dur = 0.1, vol = 0.08, a = 0.005 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, a, dur, vol);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ at = 0, dur = 0.2, vol = 0.2, f0 = 2000, f1 = 300, q = 0.8 }) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, dur, vol);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const hz = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz
const lastT = {};
/** 同一種音效太密時略過(BOSS 被連續打中不會變成噪音) */
function throttle(k, gap) {
  if (!ctx) return false;
  const t = ctx.currentTime;
  if (lastT[k] && t - lastT[k] < gap) return false;
  lastT[k] = t; return true;
}

/** notes: [[midi|null, 拍數], ...];bpm 以八分音符計 */
function melody(notes, { bpm = 300, type = 'square', vol = 0.06, at = 0, gate = 0.85 } = {}) {
  const step = 60 / bpm;
  let t = at;
  for (const [n, len] of notes) {
    if (n !== null) tone({ type, f0: hz(n), at: t, dur: step * len * gate, vol, a: 0.004 });
    t += step * len;
  }
  return t;
}

export const sfx = {
  /** 法力彈:清脆的「咻」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'triangle', f0: 1900, f1: 900, dur: 0.07, vol: 0.05 });
    noise({ dur: 0.04, vol: 0.05, f0: 6000, f1: 2500, q: 0.5 });
  },
  /** 翻筋斗:一陣風聲 + 往上滑的笛音 */
  loop() {
    noise({ dur: 1.0, vol: 0.12, f0: 600, f1: 4000, q: 1.5 });
    melody([[72, 1], [74, 1], [76, 1], [79, 1], [81, 1], [84, 2]], { bpm: 900, type: 'triangle', vol: 0.05 });
  },
  /** 銅鑼:低音三角波 + 長尾的雜訊 */
  gong(at = 0, vol = 1) {
    tone({ type: 'triangle', f0: 110, f1: 92, at, dur: 1.6, vol: 0.14 * vol, a: 0.003 });
    tone({ type: 'sine', f0: 233, f1: 220, at, dur: 1.2, vol: 0.06 * vol, a: 0.003 });
    noise({ at, dur: 1.4, vol: 0.12 * vol, f0: 3200, f1: 400, q: 3 });
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.8, vol: 0.14, f0: 400, f1: 1600, q: 1 }); },
  /** combo 越高音越高(連擊的爽感),最多往上一個八度半 */
  hit(combo = 1) {
    const k = Math.pow(2, Math.min(combo - 1, 18) / 12);
    noise({ dur: 0.16, vol: 0.22, f0: 3800, f1: 400 });
    tone({ f0: 700 * k, f1: 110 * k, dur: 0.12, vol: 0.05 });
    if (combo >= 3) tone({ type: 'triangle', f0: 880 * k, at: 0.03, dur: 0.07, vol: 0.05 });
  },
  bossShot() { throttle('bs', 0.06) && tone({ type: 'square', f0: 260, f1: 120, dur: 0.1, vol: 0.035 }); },
  bossTick() { throttle('bt', 0.05) && tone({ type: 'square', f0: 1800, f1: 1400, dur: 0.03, vol: 0.02 }); },
  bossDie() {
    noise({ dur: 1.4, vol: 0.45, f0: 3000, f1: 50, q: 1.5 });
    tone({ type: 'triangle', f0: 400, f1: 30, dur: 1.2, vol: 0.2 });
    melody([[72, 1], [76, 1], [79, 1], [84, 1], [88, 1], [91, 1], [96, 4]], { bpm: 520, vol: 0.06, at: 0.5 });
  },
  /** 大妖出場:急促的鑼鼓 */
  warning() {
    for (let i = 0; i < 8; i++) noise({ at: i * 0.12, dur: 0.08, vol: i % 4 === 0 ? 0.2 : 0.1, f0: 900, f1: 120, q: 2 });
    sfx.gong(0.96, 1.1);
    melody([[63, 1], [66, 1], [68, 1], [70, 3]], { bpm: 480, vol: 0.05, at: 1.0 });
  },
  pickup() { melody([[84, 1], [91, 1], [96, 1]], { bpm: 900, vol: 0.05 }); },
  powerUp() { melody([[72, 1], [76, 1], [79, 1], [84, 1], [79, 1], [84, 2]], { bpm: 700, vol: 0.055, at: 0.1 }); },
  shield() { tone({ type: 'triangle', f0: 300, f1: 1200, dur: 0.35, vol: 0.08 }); },
  bomb() {
    noise({ dur: 1.0, vol: 0.5, f0: 5000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 180, f1: 30, dur: 0.9, vol: 0.25 });
  },
  levelUp() {
    melody([[72, 1], [74, 1], [76, 1], [79, 1], [81, 2], [84, 1], [86, 1], [88, 1], [91, 4]], { bpm: 560, type: 'triangle', vol: 0.07 });
    melody([[48, 4], [55, 4], [60, 6]], { bpm: 560, type: 'triangle', vol: 0.12 });
    tone({ type: 'sine', f0: 1760, f1: 1760, at: 0.5, dur: 0.8, vol: 0.04 }); // 磬
  },
  praise() { throttle('pr', 0.4) && melody([[88, 1], [91, 1], [96, 2]], { bpm: 720, vol: 0.045, type: 'triangle' }); },
  achieve() { melody([[79, 1], [84, 1], [88, 1], [91, 1], [96, 3]], { bpm: 600, vol: 0.05, type: 'triangle', at: 0.2 }); },
  /** 過關:每顆星一個「叮」 */
  clear(stars = 1) {
    melody([[72, 1], [76, 1], [79, 1], [84, 3]], { bpm: 500, vol: 0.055 });
    for (let i = 0; i < stars; i++) tone({ type: 'triangle', f0: hz(88 + i * 4), at: 0.6 + i * 0.28, dur: 0.25, vol: 0.09 });
  },
  bossHit() { tone({ f0: 330, f1: 660, dur: 0.07, vol: 0.06 }); tone({ f0: 660, f1: 990, at: 0.06, dur: 0.07, vol: 0.05 }); },
  bossKill() {
    noise({ dur: 0.4, vol: 0.28, f0: 2600, f1: 120 });
    tone({ type: 'triangle', f0: 520, f1: 70, dur: 0.35, vol: 0.12 });
  },
  playerBoom() {
    noise({ dur: 1.1, vol: 0.4, f0: 1800, f1: 60, q: 2 });
    tone({ type: 'triangle', f0: 300, f1: 40, dur: 0.9, vol: 0.18 });
  },
  /** 俯衝:往下掉的呼嘯聲(斯圖卡式的警笛感) */
  dive() { tone({ type: 'triangle', f0: 1500, f1: 420, dur: 1.0, vol: 0.035, a: 0.05 }); },
  /** 天兵停下來準備擲槍:戰鼓兩聲 */
  beam() {
    for (const at of [0, 0.18]) { tone({ type: 'sine', f0: 120, f1: 50, at, dur: 0.25, vol: 0.18 }); noise({ at, dur: 0.12, vol: 0.1, f0: 800, f1: 100 }); }
  },
  captured() {
    melody([[79, 1], [76, 1], [72, 1], [67, 1], [64, 1], [60, 2]], { bpm: 420, vol: 0.06 });
  },
  rescued() {
    melody([[60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [79, 1], [84, 3]], { bpm: 480, vol: 0.06 });
  },
  extra() { melody([[84, 1], [88, 1], [91, 1], [96, 2], [91, 1], [96, 3]], { bpm: 560, vol: 0.05 }); },
  /** 開場曲(原創):一聲鑼 + 五聲音階(宮商角徵羽)的旋律 + 木魚般的節奏,約 3 秒 */
  start() {
    sfx.gong(0, 1);
    const lead = [[74, 1], [76, 1], [79, 2], [81, 1], [79, 1], [76, 2], [74, 1], [72, 1], [74, 2],
      [79, 1], [81, 1], [84, 2], [81, 1], [79, 1], [76, 1], [79, 1], [74, 4]];
    melody(lead, { bpm: 420, type: 'triangle', vol: 0.07, at: 0.35 });
    melody([[50, 4], [55, 4], [57, 4], [50, 6]], { bpm: 420, type: 'square', vol: 0.03, at: 0.35 });
    for (let i = 0; i < 10; i++) tone({ type: 'sine', f0: 900, f1: 700, at: 0.35 + i * 0.285, dur: 0.05, vol: 0.05 });
  },
  stage() {
    sfx.gong(0, 0.6);
    melody([[74, 1], [76, 1], [79, 1], [81, 1], [84, 3]], { bpm: 520, type: 'triangle', vol: 0.06, at: 0.1 });
  },
  challenge() {
    const lead = [[72, 1], [74, 1], [76, 1], [79, 1], [76, 1], [79, 1], [84, 2], [83, 1], [81, 1], [79, 3]];
    melody(lead, { bpm: 400, vol: 0.055 });
    melody([[48, 4], [53, 4], [55, 4], [48, 3]], { bpm: 400, type: 'triangle', vol: 0.12 });
  },
  perfect() {
    melody([[84, 1], [79, 1], [84, 1], [88, 1], [91, 2], [88, 1], [91, 1], [96, 4]], { bpm: 420, vol: 0.06 });
  },
  gameOver() {
    melody([[72, 2], [71, 2], [69, 2], [67, 2], [65, 2], [64, 2], [62, 2], [60, 5]], { bpm: 300, vol: 0.055 });
    melody([[48, 8], [43, 8], [36, 7]], { bpm: 300, type: 'triangle', vol: 0.12 });
  },
};
