import { baseSfx, tone, noise, melody, throttle, hz } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 音效:全部用 WebAudio 即時合成,沒有音檔。
 * 童話騎士的味道:聖光「叮」、教堂鐘聲、管風琴和弦、魯特琴撥弦、號角。
 * 旋律是原創的中世紀風短句(多利安調式),不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 聖光碎片:清脆的「叮」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'sine', f0: 1760, f1: 1700, dur: 0.06, vol: 0.035 });
    tone({ type: 'sine', f0: 2640, f1: 2600, dur: 0.04, vol: 0.015 });
  },
  /** 舉盾躍起:金屬「鏘——」+ 往上的光 */
  loop() {
    tone({ type: 'triangle', f0: 880, f1: 870, dur: 0.4, vol: 0.05, a: 0.002 });
    tone({ type: 'sine', f0: 600, f1: 1800, dur: 0.35, vol: 0.04 });
    noise({ dur: 0.1, vol: 0.05, f0: 6000, f1: 3000, q: 2 });
  },
  /** 教堂鐘:低音 + 不和諧的泛音(鐘的味道) */
  bell(n, at = 0, vol = 1) {
    for (const [k, v] of [[1, 1], [2.4, 0.4], [3.0, 0.25], [4.2, 0.15]]) tone({ type: 'sine', f0: hz(n) * k, at, dur: 1.4 / k + 0.3, vol: 0.05 * vol * v, a: 0.002 });
  },
  /** 管風琴和弦 */
  organ(notes, at = 0, dur = 0.6, vol = 1) {
    for (const n of notes) { tone({ type: 'square', f0: hz(n), at, dur, vol: 0.015 * vol, a: 0.03 }); tone({ type: 'sine', f0: hz(n) / 2, at, dur, vol: 0.02 * vol, a: 0.03 }); }
  },
  /** 魯特琴撥弦 */
  lute(n, at = 0, vol = 1) { tone({ type: 'triangle', f0: hz(n), at, dur: 0.35, vol: 0.06 * vol, a: 0.002 }); },
  /** 號角 */
  horn(n, at = 0, dur = 0.4, vol = 1) { tone({ type: 'sawtooth', f0: hz(n) * 0.99, f1: hz(n), at, dur, vol: 0.035 * vol, a: 0.03 }); },
  /** 大魔物落地:大鐘 + 重擊 */
  bossLand() {
    tone({ type: 'sine', f0: 110, f1: 40, dur: 0.5, vol: 0.26 });
    noise({ dur: 0.3, vol: 0.18, f0: 900, f1: 100, q: 1 });
    sfx.bell(43, 0.05, 1.3);
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.5, vol: 0.12, f0: 3000, f1: 800, q: 1.5 }); },
  /** WARNING:鐘樓的警鐘連敲 + 管風琴小調和弦 */
  warning() {
    for (let i = 0; i < 4; i++) sfx.bell(57, i * 0.3, 0.9);
    sfx.organ([50, 53, 57, 62], 1.3, 1.0, 1.2);
  },
  /** 光之爆:大爆炸 + 閃亮 */
  bomb() {
    noise({ dur: 1.2, vol: 0.5, f0: 5000, f1: 50, q: 1 });
    tone({ type: 'triangle', f0: 150, f1: 28, dur: 1.0, vol: 0.26 });
    [84, 88, 91, 96].forEach((n, i) => tone({ type: 'sine', f0: hz(n), at: 0.3 + i * 0.06, dur: 0.4, vol: 0.03 }));
  },
  /** 騎士晉升:號角往上 + 管風琴大和弦 */
  levelUp() {
    [62, 65, 69, 74].forEach((n, i) => sfx.horn(n, i * 0.12, 0.14));
    sfx.organ([62, 66, 69, 74], 0.5, 0.8, 1.2);
  },
  /** 黑騎士停下來準備連發:劍出鞘「鏘」 */
  beam() { noise({ dur: 0.3, vol: 0.1, f0: 2000, f1: 8000, q: 2 }); tone({ type: 'triangle', f0: 2200, f1: 2100, at: 0.2, dur: 0.3, vol: 0.03 }); },
  /** 開場曲(原創的中世紀風):號角 → 魯特琴 + 管風琴,約 3 秒 */
  start() {
    sfx.horn(62, 0, 0.2); sfx.horn(69, 0.22, 0.2); sfx.horn(74, 0.44, 0.5, 1.2);
    const lead = [[74, 1], [76, 1], [77, 2], [76, 1], [74, 1], [72, 2], [74, 1], [69, 1], [72, 2], [74, 4]];
    let t = 1.0;
    for (const [n, len] of lead) { sfx.lute(n, t); t += len * 0.15; }
    sfx.organ([50, 57, 62], 1.0, 1.2, 0.9); sfx.organ([48, 55, 60], 2.2, 0.9, 0.9);
    sfx.bell(62, 2.9, 0.8);
  },
  /** 每一章開始:號角兩聲 + 鐘 */
  stage() { sfx.horn(69, 0, 0.14); sfx.horn(74, 0.18, 0.3); sfx.bell(74, 0.4, 0.6); },
};
