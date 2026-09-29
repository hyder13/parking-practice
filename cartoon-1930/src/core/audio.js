import { baseSfx, tone, noise, melody, throttle, hz } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 音效:全部用 WebAudio 即時合成,沒有音檔。
 * 1930 年代卡通的味道:小喇叭、滑哨(往上 / 往下滑)、彈簧「啵嚶」、木琴、大號的「嗯吧嗯吧」低音。
 * 旋律是原創的拉格泰姆(ragtime)短句,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
const TOOT = [72, 74, 76, 79, 81, 84]; // 大調五聲音階:每一聲音符隨機挑一個
let tootI = 0;
export const sfx = {
  ...baseSfx,
  /** 喇叭吹一個音符(短、帶一點抖音) */
  shot() {
    if (!throttle('sh', 0.08)) return;
    const n = TOOT[(tootI = (tootI + 1 + Math.floor(Math.random() * 2)) % TOOT.length)];
    tone({ type: 'square', f0: hz(n) * 0.99, f1: hz(n) * 1.01, dur: 0.07, vol: 0.035 });
    tone({ type: 'sawtooth', f0: hz(n - 12), dur: 0.06, vol: 0.015 });
  },
  /** 蹦!滑哨往上再往下 */
  loop() {
    tone({ type: 'sine', f0: 700, f1: 2200, dur: 0.28, vol: 0.09, a: 0.01 });
    tone({ type: 'sine', f0: 2200, f1: 800, at: 0.28, dur: 0.3, vol: 0.08 });
  },
  /** 彈簧:「啵嚶~」 */
  boing(at = 0, vol = 1) {
    for (let i = 0; i < 6; i++) tone({ type: 'triangle', f0: 180 + (i % 2) * 90, f1: 260 + (i % 2) * 60, at: at + i * 0.05, dur: 0.06, vol: 0.07 * vol * (1 - i / 7) });
  },
  /** 木琴一聲(骷髏的骨頭) */
  xylo(n, at = 0, vol = 1) {
    tone({ type: 'sine', f0: hz(n), at, dur: 0.18, vol: 0.07 * vol, a: 0.002 });
    tone({ type: 'sine', f0: hz(n) * 4, at, dur: 0.05, vol: 0.03 * vol, a: 0.001 });
  },
  /** 大號:嗯吧 */
  tuba(n, at = 0, dur = 0.2, vol = 1) {
    tone({ type: 'sawtooth', f0: hz(n), at, dur, vol: 0.05 * vol, a: 0.02 });
    tone({ type: 'sine', f0: hz(n), at, dur, vol: 0.06 * vol, a: 0.02 });
  },
  /** 大鈸 */
  crash(at = 0, vol = 1) { noise({ at, dur: 0.9, vol: 0.12 * vol, f0: 9000, f1: 3000, q: 0.5 }); },
  /** 大反派落地:「碰!」+ 彈簧 */
  bossLand() {
    tone({ type: 'sine', f0: 120, f1: 40, dur: 0.4, vol: 0.25 });
    noise({ dur: 0.3, vol: 0.18, f0: 900, f1: 100, q: 1 });
    sfx.boing(0.15, 1.2);
  },
  rocket() { throttle('rk', 0.3) && tone({ type: 'sine', f0: 1800, f1: 400, dur: 0.5, vol: 0.05 }); },
  /** WARNING:汽笛兩聲(火車頭的「嗚嗚——」)+ 大鼓 */
  warning() {
    for (const at of [0, 0.7]) for (const f of [392, 494, 587]) tone({ type: 'sawtooth', f0: f * 0.98, f1: f, at, dur: 0.55, vol: 0.03, a: 0.04 });
    for (let i = 0; i < 4; i++) tone({ type: 'sine', f0: 110, f1: 50, at: 1.4 + i * 0.18, dur: 0.2, vol: 0.18 });
  },
  /** 大炸彈:卡通的「咚轟——」 */
  bomb() {
    noise({ dur: 1.1, vol: 0.5, f0: 4000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 180, f1: 30, dur: 0.9, vol: 0.25 });
    sfx.crash(0.05, 1);
  },
  /** 升咖:木琴往上跑 + 鈸 */
  levelUp() {
    [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => sfx.xylo(n, i * 0.07));
    sfx.tuba(48, 0, 0.3); sfx.tuba(55, 0.3, 0.4);
    sfx.crash(0.5, 0.7);
  },
  /** 骷髏停下來準備連發:骨頭木琴兩下 */
  beam() { sfx.xylo(84); sfx.xylo(79, 0.12); },
  /** 開場曲(原創拉格泰姆):左手大號嗯吧、右手小喇叭切分音,約 3 秒 */
  start() {
    const b = 0.15; // 一拍 = 八分音符
    const lead = [[76, 1], [77, 1], [78, 1], [79, 2], [76, 1], [79, 2], [76, 1], [79, 3], [null, 1],
      [72, 1], [74, 1], [76, 1], [77, 1], [79, 1], [81, 2], [79, 2], [84, 4]];
    melody(lead, { bpm: 400, type: 'square', vol: 0.04, at: 0 });
    const bass = [48, 55, 43, 55, 48, 55, 43, 55, 53, 57, 48, 55, 48];
    bass.forEach((n, i) => sfx.tuba(n, i * b * 2, 0.18, i % 2 ? 0.6 : 1));
    for (let i = 0; i < 13; i++) if (i % 2) noise({ at: i * b * 2, dur: 0.05, vol: 0.05, f0: 7000, f1: 5000, q: 1 }); // 小鼓的「恰」
    sfx.crash(2.6, 0.8);
  },
  /** 每一集開始:「噹噹!」 + 彈簧 */
  stage() {
    sfx.xylo(79, 0); sfx.xylo(84, 0.12, 1.2);
    sfx.boing(0.3, 0.6);
  },
};
