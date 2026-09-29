import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,輕快的大調(木琴 + 叢林鼓),不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 丟骨頭:輕輕的「咻」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'triangle', f0: 900, f1: 1500, dur: 0.05, vol: 0.04 });
    noise({ dur: 0.04, vol: 0.03, f0: 5000, f1: 2500, q: 0.6 });
  },
  /** 汪!(方波音高往下掉 + 一點雜訊) */
  bark(at = 0, vol = 1) {
    tone({ type: 'square', f0: 620, f1: 300, at, dur: 0.12, vol: 0.07 * vol, a: 0.005 });
    tone({ type: 'sawtooth', f0: 900, f1: 420, at, dur: 0.1, vol: 0.03 * vol, a: 0.005 });
    noise({ at, dur: 0.08, vol: 0.06 * vol, f0: 2500, f1: 800, q: 1.5 });
  },
  /** 翻滾:「咻——」+ 彈簧「啵嗡」 */
  loop() {
    noise({ dur: 0.7, vol: 0.1, f0: 600, f1: 2800, q: 1.2 });
    tone({ type: 'sine', f0: 300, f1: 900, at: 0.05, dur: 0.25, vol: 0.06 });
    tone({ type: 'sine', f0: 900, f1: 400, at: 0.3, dur: 0.3, vol: 0.05 });
  },
  /** 木琴(短促的三角波) */
  marimba(notes, at = 0, bpm = 480, vol = 0.07) {
    const step = 60 / bpm; let t = at;
    for (const [n, len] of notes) {
      if (n !== null) {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        tone({ type: 'triangle', f0: f, f1: f, at: t, dur: 0.14, vol, a: 0.002 });
        tone({ type: 'sine', f0: f * 4, f1: f * 4, at: t, dur: 0.05, vol: vol * 0.25, a: 0.002 });
      }
      t += step * len;
    }
    return t;
  },
  /** 叢林鼓 */
  drum(at = 0, vol = 1, f = 130) {
    tone({ type: 'sine', f0: f, f1: f * 0.45, at, dur: 0.22, vol: 0.2 * vol });
    noise({ at, dur: 0.06, vol: 0.06 * vol, f0: 900, f1: 200 });
  },
  /** 小鳥啾啾 */
  chirp(at = 0) {
    for (let i = 0; i < 3; i++) tone({ type: 'sine', f0: 2600 + i * 200, f1: 3400, at: at + i * 0.08, dur: 0.05, vol: 0.03 });
  },
  /** 猛獸落地:重重一聲 + 低吼 */
  bossLand() {
    tone({ type: 'sine', f0: 90, f1: 40, dur: 0.4, vol: 0.25 });
    noise({ dur: 0.35, vol: 0.2, f0: 900, f1: 100, q: 1 });
    tone({ type: 'sawtooth', f0: 140, f1: 90, at: 0.1, dur: 0.6, vol: 0.05, a: 0.05 });
  },
  gong(at = 0, vol = 1) { sfx.drum(at, vol, 90); },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.6, vol: 0.1, f0: 300, f1: 900, q: 1 }); },
  /** 猛獸出場:鼓聲 + 一聲吼 */
  warning() {
    for (let i = 0; i < 8; i++) sfx.drum(i * 0.12, i % 4 === 0 ? 1 : 0.5);
    tone({ type: 'sawtooth', f0: 220, f1: 70, at: 0.96, dur: 1.0, vol: 0.09, a: 0.08 });
    noise({ at: 0.96, dur: 1.0, vol: 0.12, f0: 700, f1: 150, q: 2 });
  },
  /** 大聲吠:超大聲的汪!震掉所有子彈 */
  bomb() {
    sfx.bark(0, 2.5); sfx.bark(0.18, 2.2);
    noise({ dur: 1.0, vol: 0.45, f0: 4000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 180, f1: 30, dur: 0.9, vol: 0.22 });
  },
  levelUp() {
    sfx.marimba([[72, 1], [74, 1], [76, 1], [79, 1], [81, 1], [84, 1], [86, 1], [88, 1], [91, 3]], 0, 720, 0.06);
    melody([[48, 4], [55, 4], [60, 6]], { bpm: 560, type: 'triangle', vol: 0.12 });
    sfx.bark(0.75, 0.8);
  },
  /** 野豬停下來準備連丟:鼓兩聲 */
  beam() { sfx.drum(0); sfx.drum(0.18); },
  /** 開場曲(原創):叢林鼓 + 木琴旋律 + 鳥叫 + 最後一聲「汪!」,約 3 秒 */
  start() {
    sfx.chirp(0);
    const lead = [[72, 1], [76, 1], [79, 2], [81, 1], [79, 1], [76, 1], [72, 1], [74, 2], [77, 1], [81, 1], [84, 2], [81, 1], [79, 1], [76, 1], [79, 3]];
    sfx.marimba(lead, 0.3, 440);
    melody([[48, 2], [52, 2], [55, 2], [52, 2], [53, 2], [57, 2], [55, 2], [48, 4]], { bpm: 440, type: 'triangle', vol: 0.1, at: 0.3 });
    for (let i = 0; i < 10; i++) sfx.drum(0.3 + i * 0.273, i % 4 === 0 ? 0.9 : 0.45, i % 2 ? 180 : 130);
    sfx.chirp(1.6);
    sfx.bark(3.0);
  },
  stage() {
    sfx.chirp(0);
    sfx.marimba([[72, 1], [76, 1], [79, 1], [84, 3]], 0.1, 560);
  },
};
