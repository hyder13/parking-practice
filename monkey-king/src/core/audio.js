import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,只取「街機開場曲」的氣氛,不是原作的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
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
  /** 大妖出場:急促的鑼鼓 */
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
  /** 天兵停下來準備擲槍:戰鼓兩聲 */
  beam() {
    for (const at of [0, 0.18]) { tone({ type: 'sine', f0: 120, f1: 50, at, dur: 0.25, vol: 0.18 }); noise({ at, dur: 0.12, vol: 0.1, f0: 800, f1: 100 }); }
  },
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
};
