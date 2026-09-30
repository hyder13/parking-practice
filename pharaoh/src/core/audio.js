import { baseSfx, tone, noise, melody, throttle, hz } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 音效:全部用 WebAudio 即時合成,沒有音檔。
 * 古埃及的味道:太陽光「叮」、豎琴撥弦、叉鈴(sistrum)的沙沙聲、蘆笛、大鼓。
 * 旋律是原創的短句(用「弗里吉亞屬音階」那種帶異國感的音階),不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 太陽光:清脆的「叮」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'triangle', f0: 1568, f1: 1500, dur: 0.05, vol: 0.035 });
  },
  /** 捲起風沙閃避:「咻——」+ 叉鈴 */
  loop() {
    noise({ dur: 0.5, vol: 0.1, f0: 1500, f1: 6000, q: 0.8 });
    sfx.sistrum(0.05, 0.8);
  },
  /** 叉鈴(sistrum):一串細碎的金屬沙沙聲 */
  sistrum(at = 0, vol = 1) {
    for (let i = 0; i < 4; i++) noise({ at: at + i * 0.035, dur: 0.05, vol: 0.05 * vol, f0: 9000, f1: 7000, q: 6 });
  },
  /** 豎琴撥弦 */
  harp(n, at = 0, vol = 1) {
    tone({ type: 'triangle', f0: hz(n), at, dur: 0.6, vol: 0.06 * vol, a: 0.002 });
    tone({ type: 'sine', f0: hz(n) * 2, at, dur: 0.3, vol: 0.02 * vol, a: 0.002 });
  },
  /** 蘆笛(ney):正弦 + 一點氣音 */
  flute(n, at = 0, dur = 0.3, vol = 1) {
    tone({ type: 'sine', f0: hz(n) * 0.99, f1: hz(n), at, dur, vol: 0.05 * vol, a: 0.04 });
    noise({ at, dur: dur * 0.8, vol: 0.012 * vol, f0: 3000, f1: 2500, q: 2 });
  },
  /** 大鼓 */
  drum(at = 0, vol = 1) {
    tone({ type: 'sine', f0: 120, f1: 50, at, dur: 0.25, vol: 0.2 * vol });
    noise({ at, dur: 0.05, vol: 0.06 * vol, f0: 1500, f1: 300, q: 1 });
  },
  /** 守護者落地:重擊 + 沙石崩落 + 鼓 */
  bossLand() {
    tone({ type: 'sine', f0: 100, f1: 36, dur: 0.5, vol: 0.26 });
    noise({ dur: 0.6, vol: 0.2, f0: 1200, f1: 100, q: 1 });
    sfx.drum(0.25, 1.2);
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.5, vol: 0.12, f0: 3000, f1: 800, q: 1.5 }); },
  /** WARNING:大鼓連打 + 低低的蘆笛 */
  warning() {
    for (let i = 0; i < 6; i++) sfx.drum(i * 0.2, i % 2 ? 0.7 : 1.1);
    [52, 53, 56, 53].forEach((n, i) => sfx.flute(n, 1.3 + i * 0.25, 0.24, 1.3));
  },
  /** 沙暴:大爆炸 + 呼嘯的風 */
  bomb() {
    noise({ dur: 1.2, vol: 0.5, f0: 5000, f1: 50, q: 1 });
    tone({ type: 'triangle', f0: 150, f1: 28, dur: 1.0, vol: 0.26 });
    noise({ at: 0.2, dur: 1.2, vol: 0.12, f0: 800, f1: 3000, q: 3 });
  },
  /** 小法老晉升:豎琴往上 + 叉鈴 */
  levelUp() {
    [64, 65, 68, 69, 71, 72, 76].forEach((n, i) => sfx.harp(n, i * 0.06, 0.8));
    sfx.sistrum(0.45, 1.2);
  },
  /** 胡狼守衛停下來準備連發:低吼 + 叉鈴 */
  beam() { tone({ type: 'sawtooth', f0: 90, f1: 70, dur: 0.4, vol: 0.05 }); sfx.sistrum(0.2, 0.8); },
  /** 開場曲(原創):大鼓 → 蘆笛的主旋律 + 豎琴,約 3 秒 */
  start() {
    sfx.drum(0); sfx.drum(0.3, 0.7); sfx.sistrum(0.3);
    const lead = [[64, 1], [65, 1], [68, 2], [69, 1], [68, 1], [65, 2], [64, 1], [65, 1], [64, 4]];
    let t = 0.6;
    for (const [n, len] of lead) { sfx.flute(n + 12, t, len * 0.15); t += len * 0.16; }
    for (let i = 0; i < 7; i++) { sfx.harp(i % 2 ? 57 : 52, 0.6 + i * 0.36, 0.7); if (i % 2 === 0) sfx.drum(0.6 + i * 0.36, 0.6); }
    sfx.sistrum(3.0, 1.2);
  },
  /** 每一關開始:大鼓兩下 + 叉鈴 */
  stage() { sfx.drum(0); sfx.drum(0.22); sfx.sistrum(0.4); },
};
