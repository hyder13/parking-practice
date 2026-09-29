import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,只取「街機開場曲」的氣氛,不是原作的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 乾坤圈:清脆的「叮」(像小鈸) */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'triangle', f0: 2400, f1: 2100, dur: 0.06, vol: 0.04 });
    tone({ type: 'sine', f0: 3300, f1: 3200, dur: 0.05, vol: 0.02 });
  },
  /** 風火輪:呼一聲衝上去 + 劈哩啪啦的火花 */
  loop() {
    noise({ dur: 0.9, vol: 0.12, f0: 500, f1: 3500, q: 1.2 });
    sfx.crackle(0.3, 8, 0.07);
  },
  /** 鞭炮:一連串短促的爆音(n 聲、間隔 gap) */
  crackle(at = 0, n = 20, gap = 0.045, vol = 0.14) {
    for (let i = 0; i < n; i++) {
      const t = at + i * gap * (0.6 + Math.random() * 0.8);
      noise({ at: t, dur: 0.04, vol: vol * (0.6 + Math.random() * 0.5), f0: 4500, f1: 800, q: 0.7 });
    }
  },
  /** 嗩吶:鼻音很重的方波 + 快速抖音(五聲音階) */
  suona(notes, at = 0, bpm = 420, vol = 0.045) {
    const step = 60 / bpm; let t = at;
    for (const [n, len] of notes) {
      if (n !== null) {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        tone({ type: 'square', f0: f * 1.01, f1: f, at: t, dur: step * len * 0.9, vol, a: 0.01 });
        tone({ type: 'sawtooth', f0: f * 2, f1: f * 2, at: t, dur: step * len * 0.8, vol: vol * 0.35, a: 0.01 });
      }
      t += step * len;
    }
  },
  /** 大魔頭落地:重重一聲 */
  bossLand() {
    tone({ type: 'sine', f0: 90, f1: 40, dur: 0.4, vol: 0.25 });
    noise({ dur: 0.35, vol: 0.2, f0: 900, f1: 100, q: 1 });
  },
  /** 銅鑼:低音三角波 + 長尾的雜訊 */
  gong(at = 0, vol = 1) {
    tone({ type: 'triangle', f0: 110, f1: 92, at, dur: 1.6, vol: 0.14 * vol, a: 0.003 });
    tone({ type: 'sine', f0: 233, f1: 220, at, dur: 1.2, vol: 0.06 * vol, a: 0.003 });
    noise({ at, dur: 1.4, vol: 0.12 * vol, f0: 3200, f1: 400, q: 3 });
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.8, vol: 0.14, f0: 400, f1: 1600, q: 1 }); },
  /** 大魔頭出場:急促的鑼鼓陣 */
  warning() {
    for (let i = 0; i < 8; i++) noise({ at: i * 0.12, dur: 0.08, vol: i % 4 === 0 ? 0.2 : 0.1, f0: 900, f1: 120, q: 2 });
    sfx.gong(0.96, 1.1);
    melody([[63, 1], [66, 1], [68, 1], [70, 3]], { bpm: 480, vol: 0.05, at: 1.0 });
  },
  bomb() {
    sfx.crackle(0, 40, 0.03, 0.16);
    noise({ dur: 1.0, vol: 0.5, f0: 5000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 180, f1: 30, dur: 0.9, vol: 0.25 });
  },
  levelUp() {
    melody([[72, 1], [74, 1], [76, 1], [79, 1], [81, 2], [84, 1], [86, 1], [88, 1], [91, 4]], { bpm: 560, type: 'triangle', vol: 0.07 });
    melody([[48, 4], [55, 4], [60, 6]], { bpm: 560, type: 'triangle', vol: 0.12 });
    tone({ type: 'sine', f0: 1760, f1: 1760, at: 0.5, dur: 0.8, vol: 0.04 }); // 磬
  },
  /** 夜叉停下來準備連發:大鼓兩聲 */
  beam() {
    for (const at of [0, 0.18]) { tone({ type: 'sine', f0: 120, f1: 50, at, dur: 0.25, vol: 0.18 }); noise({ at, dur: 0.12, vol: 0.1, f0: 800, f1: 100 }); }
  },
  /** 起駕曲(原創):鞭炮 + 一聲鑼 + 大鼓 + 嗩吶五聲音階旋律,約 3 秒 */
  start() {
    sfx.crackle(0, 24, 0.035);
    sfx.gong(0.2, 1);
    sfx.suona([[74, 1], [76, 1], [79, 2], [81, 1], [79, 1], [76, 1], [74, 1], [72, 2], [74, 1], [76, 1], [79, 4]], 0.5, 440);
    for (let i = 0; i < 12; i++) tone({ type: 'sine', f0: i % 4 === 0 ? 110 : 150, f1: 50, at: 0.35 + i * 0.25, dur: 0.18, vol: i % 4 === 0 ? 0.2 : 0.1 });
    const lead = [[74, 1], [76, 1], [79, 2], [81, 1], [79, 1], [76, 2], [74, 1], [72, 1], [74, 2],
      [79, 1], [81, 1], [84, 2], [81, 1], [79, 1], [76, 1], [79, 1], [74, 4]];
    melody([[50, 4], [55, 4], [57, 4], [50, 6]], { bpm: 420, type: 'square', vol: 0.03, at: 0.35 });
    for (let i = 0; i < 10; i++) tone({ type: 'sine', f0: 900, f1: 700, at: 0.35 + i * 0.285, dur: 0.05, vol: 0.05 });
  },
  stage() {
    sfx.crackle(0, 10, 0.04, 0.1);
    sfx.gong(0, 0.6);
    melody([[74, 1], [76, 1], [79, 1], [81, 1], [84, 3]], { bpm: 520, type: 'triangle', vol: 0.06, at: 0.1 });
  },
};
