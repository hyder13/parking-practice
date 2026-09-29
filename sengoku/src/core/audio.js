import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,用日本的五聲音階(陽音階 D E G A B),只取「出陣」的氣氛,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 鐵砲:短促的「砰」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    noise({ dur: 0.08, vol: 0.09, f0: 4000, f1: 400, q: 0.7 });
    tone({ type: 'sine', f0: 180, f1: 70, dur: 0.07, vol: 0.06 });
  },
  /** 一閃:刀劃過的「咻——鏘」 */
  loop() {
    noise({ dur: 0.35, vol: 0.12, f0: 2000, f1: 9000, q: 1.5 });
    tone({ type: 'triangle', f0: 2600, f1: 2500, at: 0.25, dur: 0.5, vol: 0.05 });
    tone({ type: 'sine', f0: 3900, f1: 3800, at: 0.25, dur: 0.4, vol: 0.025 });
  },
  /** 法螺貝:低沉的「嗚——」,帶一點顫音 */
  horagai(at = 0, dur = 1.2, vol = 1) {
    for (let i = 0; i < 6; i++) {
      const w = i % 2 ? 1.012 : 0.992;
      tone({ type: 'sawtooth', f0: 196 * w, f1: 185 * w, at: at + i * dur / 6, dur: dur / 6 + 0.04, vol: 0.05 * vol, a: 0.03 });
    }
    tone({ type: 'sine', f0: 392, f1: 370, at, dur, vol: 0.03 * vol, a: 0.1 });
  },
  /** 陣太鼓 */
  taiko(at = 0, vol = 1) {
    tone({ type: 'sine', f0: 110, f1: 45, at, dur: 0.35, vol: 0.22 * vol });
    noise({ at, dur: 0.12, vol: 0.1 * vol, f0: 700, f1: 90 });
  },
  /** 大名落地:大太鼓 */
  bossLand() {
    sfx.taiko(0, 1.3);
    noise({ dur: 0.35, vol: 0.2, f0: 900, f1: 100, q: 1 });
  },
  /** 陣鐘 */
  gong(at = 0, vol = 1) {
    tone({ type: 'triangle', f0: 330, f1: 320, at, dur: 1.2, vol: 0.08 * vol, a: 0.003 });
    tone({ type: 'sine', f0: 660, f1: 650, at, dur: 0.8, vol: 0.04 * vol, a: 0.003 });
    noise({ at, dur: 0.15, vol: 0.06 * vol, f0: 3000, f1: 600, q: 2 });
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.6, vol: 0.12, f0: 3000, f1: 800, q: 1.5 }); },
  /** 敵將來襲:太鼓連打 + 法螺貝 */
  warning() {
    for (let i = 0; i < 8; i++) sfx.taiko(i * 0.12, i % 4 === 0 ? 1 : 0.55);
    sfx.horagai(0.96, 1.2, 1.2);
  },
  /** 焙烙玉:大爆炸 */
  bomb() {
    noise({ dur: 1.2, vol: 0.55, f0: 5000, f1: 50, q: 1 });
    tone({ type: 'triangle', f0: 160, f1: 28, dur: 1.0, vol: 0.26 });
  },
  /** 官位提升:五聲音階往上 + 陣鐘 */
  levelUp() {
    melody([[62, 1], [64, 1], [67, 1], [69, 1], [71, 1], [74, 1], [76, 1], [79, 1], [81, 3]], { bpm: 800, type: 'triangle', vol: 0.07 });
    melody([[50, 4], [55, 4], [62, 6]], { bpm: 560, type: 'triangle', vol: 0.12 });
    sfx.gong(0.6, 0.8);
  },
  /** 武將停下來準備連發:太鼓兩聲 */
  beam() { sfx.taiko(0); sfx.taiko(0.18); },
  /** 出陣曲(原創):法螺貝 → 太鼓 + 陽音階的笛聲旋律,約 3 秒 */
  start() {
    sfx.horagai(0, 1.0, 1);
    const lead = [[74, 1], [76, 1], [79, 2], [81, 1], [79, 1], [76, 1], [74, 1], [71, 2], [74, 1], [76, 1], [79, 1], [83, 1], [81, 4]];
    melody(lead, { bpm: 440, type: 'square', vol: 0.045, at: 1.0 });
    for (let i = 0; i < 8; i++) sfx.taiko(1.0 + i * 0.273, i % 4 === 0 ? 1 : 0.5);
    melody([[50, 4], [55, 4], [57, 4], [50, 6]], { bpm: 440, type: 'triangle', vol: 0.08, at: 1.0 });
  },
  /** 每一戰開始:太鼓兩聲 + 短法螺 */
  stage() {
    sfx.taiko(0); sfx.taiko(0.25);
    sfx.horagai(0.45, 0.6, 0.8);
  },
};
