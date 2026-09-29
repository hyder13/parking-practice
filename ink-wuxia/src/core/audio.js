import { baseSfx, tone, noise, melody, throttle, hz } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 音效:全部用 WebAudio 即時合成,沒有音檔。
 * 武俠的味道:劍氣「唰」、古琴 / 琵琶的撥弦、竹笛、大鼓、銅鑼。
 * 旋律是原創的五聲音階(宮商角徵羽 = C D E G A)短句,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 劍氣:短短的「唰」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    noise({ dur: 0.07, vol: 0.08, f0: 7000, f1: 2500, q: 1.2 });
  },
  /** 輕功:衣袂帶風的「呼——」+ 一聲高音 */
  loop() {
    noise({ dur: 0.5, vol: 0.14, f0: 600, f1: 3500, q: 0.8 });
    tone({ type: 'sine', f0: 1320, f1: 1320, at: 0.18, dur: 0.3, vol: 0.03 });
  },
  /** 撥弦(琵琶 / 古琴):很快的起音 + 慢慢消失,帶一點泛音 */
  pluck(n, at = 0, vol = 1) {
    tone({ type: 'triangle', f0: hz(n) * 1.004, f1: hz(n), at, dur: 0.5, vol: 0.07 * vol, a: 0.002 });
    tone({ type: 'sine', f0: hz(n) * 2, at, dur: 0.25, vol: 0.025 * vol, a: 0.002 });
  },
  /** 竹笛:柔和的長音 */
  flute(n, at = 0, dur = 0.4, vol = 1) {
    tone({ type: 'sine', f0: hz(n) * 0.995, f1: hz(n), at, dur, vol: 0.05 * vol, a: 0.05 });
    noise({ at, dur: dur * 0.6, vol: 0.01 * vol, f0: hz(n) * 2, f1: hz(n) * 2, q: 8 });
  },
  /** 大鼓 */
  drum(at = 0, vol = 1) {
    tone({ type: 'sine', f0: 100, f1: 45, at, dur: 0.35, vol: 0.22 * vol });
    noise({ at, dur: 0.1, vol: 0.08 * vol, f0: 600, f1: 90 });
  },
  /** 銅鑼 */
  gong(at = 0, vol = 1) {
    tone({ type: 'triangle', f0: 180, f1: 150, at, dur: 1.6, vol: 0.08 * vol, a: 0.004 });
    tone({ type: 'sine', f0: 410, f1: 380, at, dur: 1.1, vol: 0.03 * vol, a: 0.004 });
    noise({ at, dur: 0.6, vol: 0.05 * vol, f0: 3000, f1: 800, q: 1.5 });
  },
  /** 強敵落地:大鼓 + 銅鑼 */
  bossLand() {
    sfx.drum(0, 1.4);
    sfx.gong(0.05, 1);
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.5, vol: 0.12, f0: 3000, f1: 800, q: 1.5 }); },
  /** WARNING:大鼓越打越快 + 銅鑼 */
  warning() {
    let t = 0;
    for (let i = 0; i < 9; i++) { sfx.drum(t, i % 3 === 0 ? 1 : 0.6); t += 0.2 - i * 0.012; }
    sfx.gong(t + 0.05, 1.3);
  },
  /** 霹靂彈:大爆炸 */
  bomb() {
    noise({ dur: 1.2, vol: 0.55, f0: 5000, f1: 50, q: 1 });
    tone({ type: 'triangle', f0: 160, f1: 28, dur: 1.0, vol: 0.26 });
  },
  /** 功力大增:琵琶掃弦往上 + 銅鑼 */
  levelUp() {
    [60, 62, 64, 67, 69, 72, 74, 76, 79].forEach((n, i) => sfx.pluck(n, i * 0.05, 0.9));
    sfx.gong(0.55, 0.7);
  },
  /** 鐵頭陀停下來準備連發:禪杖的鐵環「鏘鏘」 */
  beam() { tone({ type: 'square', f0: 2200, f1: 2100, dur: 0.08, vol: 0.02 }); tone({ type: 'square', f0: 2600, f1: 2500, at: 0.1, dur: 0.08, vol: 0.02 }); },
  /** 開場曲(原創):銅鑼 → 琵琶輪指 + 竹笛的五聲旋律 + 大鼓,約 3 秒 */
  start() {
    sfx.gong(0, 0.9);
    const lead = [[76, 2], [79, 1], [81, 1], [84, 3], [81, 1], [79, 2], [76, 2], [74, 1], [76, 1], [79, 2], [72, 4]];
    let t = 0.8;
    for (const [n, len] of lead) { sfx.flute(n, t, len * 0.14, 1); t += len * 0.14; }
    for (let i = 0; i < 12; i++) sfx.pluck([48, 55, 60, 55][i % 4], 0.8 + i * 0.19, 0.7);
    for (let i = 0; i < 4; i++) sfx.drum(0.8 + i * 0.57, i === 0 ? 1 : 0.6);
  },
  /** 每一回開始:鼓兩聲 + 琵琶 */
  stage() {
    sfx.drum(0); sfx.drum(0.22);
    sfx.pluck(67, 0.45); sfx.pluck(72, 0.55);
  },
};
