import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,只取「街機開場曲」的氣氛,不是原作的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 機槍:短促的雜訊「噠」+ 一點低音衝擊 */
  shot() {
    if (!throttle('sh', 0.065)) return;
    noise({ dur: 0.05, vol: 0.13, f0: 2600, f1: 500, q: 1.2 });
    tone({ type: 'square', f0: 180, f1: 70, dur: 0.045, vol: 0.03 });
  },
  /** 翻筋斗:引擎拉高轉速的呼嘯 */
  loop() {
    tone({ type: 'sawtooth', f0: 110, f1: 330, dur: 0.6, vol: 0.05, a: 0.05 });
    tone({ type: 'sawtooth', f0: 330, f1: 120, at: 0.6, dur: 0.6, vol: 0.04 });
    noise({ dur: 1.1, vol: 0.08, f0: 1200, f1: 3000, q: 0.6 });
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.8, vol: 0.12, f0: 800, f1: 3500, q: 2 }); },
  warning() {
    for (let i = 0; i < 3; i++) {
      tone({ type: 'square', f0: 440, f1: 880, at: i * 0.6, dur: 0.3, vol: 0.05 });
      tone({ type: 'square', f0: 880, f1: 440, at: i * 0.6 + 0.3, dur: 0.3, vol: 0.05 });
    }
  },
  bomb() {
    noise({ dur: 1.0, vol: 0.5, f0: 5000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 180, f1: 30, dur: 0.9, vol: 0.25 });
  },
  levelUp() {
    melody([[67, 1], [72, 1], [76, 1], [79, 1], [84, 2], [83, 1], [84, 1], [88, 1], [91, 4]], { bpm: 560, vol: 0.06 });
    melody([[48, 4], [55, 4], [60, 6]], { bpm: 560, type: 'triangle', vol: 0.12 });
  },
  /** 重戰機停下來準備掃射:引擎低吼 */
  beam() {
    tone({ type: 'sawtooth', f0: 70, f1: 140, dur: 0.9, vol: 0.06, a: 0.08 });
    tone({ type: 'square', f0: 880, f1: 660, at: 0.1, dur: 0.12, vol: 0.03 });
    tone({ type: 'square', f0: 880, f1: 660, at: 0.3, dur: 0.12, vol: 0.03 });
  },
  /** 出擊號角(原創):軍號風的分解和弦 + 小鼓 + 進行曲低音,約 3 秒 */
  start() {
    const lead = [[67, 1], [72, 1], [76, 1], [79, 3], [76, 1], [79, 3],
      [67, 1], [72, 1], [76, 1], [79, 2], [76, 1], [72, 2], [76, 1], [79, 1], [84, 5]];
    const bass = [[48, 2], [55, 2], [48, 2], [55, 2], [48, 2], [55, 2], [53, 2], [55, 2], [48, 6]];
    melody(lead, { bpm: 400, type: 'square', vol: 0.05 });
    melody(bass, { bpm: 400, type: 'triangle', vol: 0.12 });
    for (let i = 0; i < 12; i++) noise({ at: i * 0.3, dur: 0.06, vol: i % 4 === 3 ? 0.12 : 0.06, f0: 5000, f1: 1500, q: 0.5 });
  },
  stage() {
    melody([[67, 1], [72, 1], [76, 1], [79, 3]], { bpm: 460, vol: 0.05 });
    for (let i = 0; i < 4; i++) noise({ at: i * 0.13, dur: 0.05, vol: 0.06, f0: 5000, f1: 1500, q: 0.5 });
  },
};
