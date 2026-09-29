import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,只取「街機開場曲」的氣氛,不是原作的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 槍氣:短促的「咻」+ 一點金屬感 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'triangle', f0: 1500, f1: 700, dur: 0.06, vol: 0.05 });
    noise({ dur: 0.04, vol: 0.05, f0: 5000, f1: 2000, q: 0.5 });
  },
  /** 躍馬:馬嘶(鋸齒波抖音往下滑)+ 馬蹄 */
  loop() {
    for (let i = 0; i < 6; i++) tone({ type: 'sawtooth', f0: 1100 - i * 90, f1: 1000 - i * 110, at: i * 0.07, dur: 0.07, vol: 0.035 });
    for (const at of [0.55, 0.7, 0.95, 1.1]) tone({ type: 'sine', f0: 180, f1: 90, at, dur: 0.06, vol: 0.12 });
  },
  /** 敵將落地:重重一聲 */
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
  /** 敵將出場:急促的戰鼓 + 鑼 */
  warning() {
    for (let i = 0; i < 8; i++) noise({ at: i * 0.12, dur: 0.08, vol: i % 4 === 0 ? 0.2 : 0.1, f0: 900, f1: 120, q: 2 });
    sfx.gong(0.96, 1.1);
    melody([[63, 1], [66, 1], [68, 1], [70, 3]], { bpm: 480, vol: 0.05, at: 1.0 });
  },
  bomb() {
    noise({ dur: 1.0, vol: 0.5, f0: 5000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 180, f1: 30, dur: 0.9, vol: 0.25 });
  },
  levelUp() {
    melody([[72, 1], [74, 1], [76, 1], [79, 1], [81, 2], [84, 1], [86, 1], [88, 1], [91, 4]], { bpm: 560, type: 'triangle', vol: 0.07 });
    melody([[48, 4], [55, 4], [60, 6]], { bpm: 560, type: 'triangle', vol: 0.12 });
    tone({ type: 'sine', f0: 1760, f1: 1760, at: 0.5, dur: 0.8, vol: 0.04 }); // 磬
  },
  /** 騎兵停下來準備放弩:戰鼓兩聲 */
  beam() {
    for (const at of [0, 0.18]) { tone({ type: 'sine', f0: 120, f1: 50, at, dur: 0.25, vol: 0.18 }); noise({ at, dur: 0.12, vol: 0.1, f0: 800, f1: 100 }); }
  },
  /** 出陣曲(原創):一聲鑼 + 戰鼓 + 五聲音階的號角旋律,約 3 秒 */
  start() {
    sfx.gong(0, 1);
    for (let i = 0; i < 12; i++) tone({ type: 'sine', f0: i % 4 === 0 ? 110 : 150, f1: 50, at: 0.35 + i * 0.25, dur: 0.18, vol: i % 4 === 0 ? 0.2 : 0.1 });
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
};
