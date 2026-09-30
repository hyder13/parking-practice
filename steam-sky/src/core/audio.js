import { baseSfx, tone, noise, melody, throttle, hz } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 音效:全部用 WebAudio 即時合成,沒有音檔。
 * 蒸汽龐克的味道:鉚釘「叮」、蒸汽「嘶——」、汽笛、金屬撞擊「鏘」、手風琴 / 汽笛風琴(calliope)。
 * 旋律是原創的圓舞曲風短句,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 鉚釘:短短的金屬「叮」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'square', f0: 1400, f1: 1300, dur: 0.03, vol: 0.02 });
    noise({ dur: 0.03, vol: 0.02, f0: 5000, f1: 4000, q: 4 });
  },
  /** 蒸汽噴射閃避:「嘶——」+ 往上的哨音 */
  loop() {
    noise({ dur: 0.45, vol: 0.12, f0: 7000, f1: 2500, q: 0.8 });
    tone({ type: 'sine', f0: 700, f1: 1600, dur: 0.3, vol: 0.04 });
  },
  /** 蒸汽汽笛(兩個音一起,像火車的汽笛) */
  whistle(at = 0, dur = 0.5, vol = 1) {
    for (const f of [587, 698]) tone({ type: 'sawtooth', f0: f * 0.97, f1: f, at, dur, vol: 0.02 * vol, a: 0.04 });
    noise({ at, dur, vol: 0.03 * vol, f0: 3000, f1: 3000, q: 3 });
  },
  /** 汽笛風琴(calliope):方波 + 高八度的正弦 */
  calliope(n, at = 0, dur = 0.2, vol = 1) {
    tone({ type: 'square', f0: hz(n), at, dur, vol: 0.022 * vol, a: 0.01 });
    tone({ type: 'sine', f0: hz(n) * 2, at, dur, vol: 0.02 * vol, a: 0.01 });
  },
  /** 低音(大號) */
  tuba(n, at = 0, dur = 0.2, vol = 1) { tone({ type: 'triangle', f0: hz(n), at, dur, vol: 0.08 * vol, a: 0.01 }); },
  /** 金屬撞擊「鏘」 */
  clank(at = 0, vol = 1) {
    for (const [k, v] of [[1, 1], [2.7, 0.5], [4.1, 0.3]]) tone({ type: 'sine', f0: 320 * k, at, dur: 0.5 / k + 0.1, vol: 0.05 * vol * v, a: 0.002 });
    noise({ at, dur: 0.08, vol: 0.08 * vol, f0: 4000, f1: 1500, q: 1 });
  },
  /** 巨大機械落地:重擊 + 鏘 + 放蒸汽 */
  bossLand() {
    tone({ type: 'sine', f0: 100, f1: 38, dur: 0.5, vol: 0.26 });
    noise({ dur: 0.3, vol: 0.18, f0: 900, f1: 100, q: 1 });
    sfx.clank(0.02, 1.4);
    noise({ at: 0.2, dur: 0.8, vol: 0.1, f0: 6000, f1: 2000, q: 0.7 });
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.5, vol: 0.12, f0: 3000, f1: 800, q: 1.5 }); },
  /** WARNING:汽笛連響三聲 */
  warning() {
    for (let i = 0; i < 3; i++) sfx.whistle(i * 0.45, 0.35, 1.2);
    [45, 44, 43].forEach((n, i) => sfx.tuba(n, 1.4 + i * 0.25, 0.22, 1.2));
  },
  /** 蒸汽炸彈:大爆炸 + 一大口蒸汽 */
  bomb() {
    noise({ dur: 1.2, vol: 0.5, f0: 5000, f1: 50, q: 1 });
    tone({ type: 'triangle', f0: 150, f1: 28, dur: 1.0, vol: 0.26 });
    noise({ at: 0.3, dur: 1.0, vol: 0.12, f0: 7000, f1: 3000, q: 0.7 });
  },
  /** 飛行員晉升:汽笛風琴往上 + 汽笛 */
  levelUp() {
    [67, 71, 74, 79].forEach((n, i) => sfx.calliope(n, i * 0.1, 0.12));
    sfx.whistle(0.45, 0.4);
  },
  /** 蒸汽機器人停下來準備連發:鍋爐加壓的嘶聲 */
  beam() { noise({ dur: 0.4, vol: 0.1, f0: 2000, f1: 8000, q: 2 }); sfx.clank(0.3, 0.6); },
  /** 開場曲(原創的圓舞曲風):汽笛 → 大號 + 汽笛風琴,約 3 秒 */
  start() {
    sfx.whistle(0, 0.5);
    const lead = [[67, 2], [71, 1], [74, 1], [79, 2], [78, 1], [76, 1], [74, 2], [71, 1], [72, 1], [74, 4]];
    let t = 0.6;
    for (const [n, len] of lead) { sfx.calliope(n, t, len * 0.13); t += len * 0.14; }
    for (let i = 0; i < 6; i++) { const b = 0.6 + i * 0.42; sfx.tuba(i % 2 ? 50 : 43, b, 0.15); sfx.calliope(i % 2 ? 62 : 59, b + 0.14, 0.08, 0.5); sfx.calliope(i % 2 ? 62 : 59, b + 0.28, 0.08, 0.5); }
    sfx.clank(3.1, 0.7);
  },
  /** 每一段開始:汽笛兩聲 */
  stage() { sfx.whistle(0, 0.18); sfx.whistle(0.25, 0.35); },
};
