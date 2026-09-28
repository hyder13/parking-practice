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
  shot() { tone({ f0: 1500, f1: 380, dur: 0.075, vol: 0.045 }); },
  hit() {
    noise({ dur: 0.16, vol: 0.22, f0: 3800, f1: 400 });
    tone({ f0: 700, f1: 110, dur: 0.12, vol: 0.05 });
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
  dive() { tone({ type: 'triangle', f0: 1400, f1: 260, dur: 0.9, vol: 0.035, a: 0.05 }); },
  beam() {
    // 光束的「嗡嗡」聲:兩個三角波來回滑音
    for (let i = 0; i < 6; i++) {
      tone({ type: 'triangle', f0: 520, f1: 780, at: i * 0.5, dur: 0.25, vol: 0.05 });
      tone({ type: 'triangle', f0: 780, f1: 520, at: i * 0.5 + 0.25, dur: 0.25, vol: 0.05 });
    }
  },
  captured() {
    melody([[79, 1], [76, 1], [72, 1], [67, 1], [64, 1], [60, 2]], { bpm: 420, vol: 0.06 });
  },
  rescued() {
    melody([[60, 1], [64, 1], [67, 1], [72, 1], [76, 1], [79, 1], [84, 3]], { bpm: 480, vol: 0.06 });
  },
  extra() { melody([[84, 1], [88, 1], [91, 1], [96, 2], [91, 1], [96, 3]], { bpm: 560, vol: 0.05 }); },
  /** 遊戲開場曲(原創):主旋律方波 + 三角波低音,約 3 秒 */
  start() {
    const lead = [[72, 1], [76, 1], [79, 1], [84, 2], [83, 1], [79, 1], [76, 1],
      [77, 1], [81, 1], [84, 1], [89, 2], [88, 1], [84, 1], [81, 1],
      [79, 1], [83, 1], [86, 1], [91, 2], [89, 1], [86, 1], [83, 1], [84, 4]];
    const bass = [[48, 2], [55, 2], [48, 2], [55, 2], [53, 2], [60, 2], [53, 2], [60, 2],
      [55, 2], [62, 2], [55, 2], [62, 2], [48, 4]];
    melody(lead, { bpm: 440, vol: 0.055 });
    melody(bass, { bpm: 440, type: 'triangle', vol: 0.12 });
  },
  stage() { melody([[76, 1], [79, 1], [84, 2]], { bpm: 480, vol: 0.05 }); },
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
