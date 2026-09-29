import { baseSfx, tone, noise, melody, throttle, hz } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 音效:全部用 WebAudio 即時合成,沒有音檔。
 * 毛線世界的味道:軟軟的「噗」、音樂盒、鐵琴、木琴、軟木塞「啵」、玩具喇叭。
 * 旋律是原創的搖籃曲風短句,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 丟毛線球:軟軟的「噗」 */
  shot() {
    if (!throttle('sh', 0.08)) return;
    tone({ type: 'sine', f0: 520, f1: 300, dur: 0.07, vol: 0.06 });
    noise({ dur: 0.04, vol: 0.03, f0: 1500, f1: 600, q: 0.8 });
  },
  /** 跳:彈簧床的「啵嚶」往上 */
  loop() {
    tone({ type: 'sine', f0: 300, f1: 1200, dur: 0.3, vol: 0.08, a: 0.01 });
    tone({ type: 'triangle', f0: 600, f1: 2400, at: 0.05, dur: 0.25, vol: 0.03 });
  },
  /** 音樂盒一聲(很亮的鐵片,慢慢消失) */
  box(n, at = 0, vol = 1) {
    tone({ type: 'sine', f0: hz(n), at, dur: 0.7, vol: 0.06 * vol, a: 0.002 });
    tone({ type: 'sine', f0: hz(n) * 3.01, at, dur: 0.25, vol: 0.015 * vol, a: 0.002 });
  },
  /** 軟木塞「啵」 */
  pop(at = 0, vol = 1) { tone({ type: 'sine', f0: 900, f1: 250, at, dur: 0.06, vol: 0.1 * vol }); },
  /** 玩具鼓(軟軟的) */
  drum(at = 0, vol = 1) {
    tone({ type: 'sine', f0: 160, f1: 80, at, dur: 0.2, vol: 0.16 * vol });
    noise({ at, dur: 0.05, vol: 0.04 * vol, f0: 1200, f1: 300 });
  },
  /** 大魔王落地:「噗通!」(軟軟的大東西掉下來)+ 彈簧 */
  bossLand() {
    tone({ type: 'sine', f0: 140, f1: 40, dur: 0.45, vol: 0.28 });
    noise({ dur: 0.25, vol: 0.12, f0: 800, f1: 120, q: 0.8 });
    for (let i = 0; i < 4; i++) tone({ type: 'triangle', f0: 220 + i * 40, f1: 300 + i * 40, at: 0.15 + i * 0.05, dur: 0.06, vol: 0.05 });
  },
  rocket() { throttle('rk', 0.3) && tone({ type: 'sine', f0: 1500, f1: 500, dur: 0.4, vol: 0.05 }); },
  /** WARNING:玩具喇叭「叭叭——」+ 鼓 */
  warning() {
    for (const at of [0, 0.4, 0.8]) tone({ type: 'square', f0: 440, f1: 430, at, dur: at === 0.8 ? 0.5 : 0.25, vol: 0.04 });
    for (let i = 0; i < 4; i++) sfx.drum(1.4 + i * 0.15, i === 3 ? 1.3 : 0.8);
  },
  /** 大毛球:軟軟的大爆炸 */
  bomb() {
    noise({ dur: 1.0, vol: 0.45, f0: 3000, f1: 60, q: 0.8 });
    tone({ type: 'sine', f0: 200, f1: 40, dur: 0.8, vol: 0.25 });
    for (let i = 0; i < 6; i++) sfx.pop(0.2 + i * 0.07, 0.7);
  },
  /** 變蓬鬆了:音樂盒往上跑 */
  levelUp() {
    [72, 76, 79, 84, 79, 84, 88, 91].forEach((n, i) => sfx.box(n, i * 0.08));
  },
  /** 剪刀螃蟹停下來準備連發:剪刀「喀嚓喀嚓」 */
  beam() { noise({ dur: 0.04, vol: 0.12, f0: 6000, f1: 3000, q: 3 }); noise({ at: 0.12, dur: 0.04, vol: 0.12, f0: 6000, f1: 3000, q: 3 }); },
  /** 開場曲(原創的搖籃曲風):音樂盒旋律 + 玩具鼓,約 3 秒 */
  start() {
    const lead = [[79, 2], [76, 1], [79, 1], [84, 2], [83, 1], [81, 1], [79, 2], [76, 2], [77, 1], [79, 1], [81, 1], [83, 1], [84, 4]];
    let t = 0;
    for (const [n, len] of lead) { sfx.box(n, t); t += len * 0.14; }
    melody([[48, 4], [55, 4], [53, 4], [48, 6]], { bpm: 430, type: 'triangle', vol: 0.07 });
    for (let i = 0; i < 4; i++) sfx.drum(i * 0.56, 0.6);
  },
  /** 每一段開始:啵啵 + 音樂盒 */
  stage() { sfx.pop(0); sfx.pop(0.12); sfx.box(84, 0.28); sfx.box(91, 0.4); },
};
