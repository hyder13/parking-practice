import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 音效:全部用 WebAudio 即時合成,沒有音檔。
 * 超級英雄的味道:能量「咻」、拳頭「碰」、銅管的英雄號角、定音鼓、城市警報。
 * 旋律是原創的英雄進行曲短句,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 能量星:短短的「咻」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'square', f0: 1400, f1: 2400, dur: 0.05, vol: 0.03 });
    tone({ type: 'sine', f0: 700, f1: 1200, dur: 0.06, vol: 0.03 });
  },
  /** 飛起來:往上衝的「咻——」 */
  loop() {
    noise({ dur: 0.45, vol: 0.12, f0: 800, f1: 6000, q: 1.2 });
    tone({ type: 'sawtooth', f0: 200, f1: 900, dur: 0.4, vol: 0.04 });
  },
  /** 銅管和弦(英雄號角):root 用 MIDI */
  brass(root, at = 0, dur = 0.4, vol = 1) {
    for (const k of [0, 4, 7]) {
      const f = 440 * Math.pow(2, (root + k - 69) / 12);
      tone({ type: 'sawtooth', f0: f, at, dur, vol: 0.03 * vol, a: 0.02 });
    }
  },
  /** 定音鼓 */
  timpani(at = 0, vol = 1) {
    tone({ type: 'sine', f0: 98, f1: 80, at, dur: 0.5, vol: 0.2 * vol });
    noise({ at, dur: 0.08, vol: 0.06 * vol, f0: 900, f1: 200 });
  },
  /** 大魔頭落地:碰!(重擊 + 定音鼓) */
  bossLand() {
    noise({ dur: 0.4, vol: 0.3, f0: 1200, f1: 80, q: 1 });
    tone({ type: 'sine', f0: 90, f1: 35, dur: 0.5, vol: 0.28 });
    sfx.timpani(0.1, 1.2);
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.6, vol: 0.12, f0: 3000, f1: 800, q: 1.5 }); },
  /** WARNING:城市警報(上下滑的警笛)+ 定音鼓 */
  warning() {
    for (let i = 0; i < 3; i++) {
      tone({ type: 'square', f0: 600, f1: 1100, at: i * 0.5, dur: 0.25, vol: 0.035 });
      tone({ type: 'square', f0: 1100, f1: 600, at: i * 0.5 + 0.25, dur: 0.25, vol: 0.035 });
    }
    for (let i = 0; i < 4; i++) sfx.timpani(1.5 + i * 0.16, i === 3 ? 1.3 : 0.7);
  },
  /** 大爆炸:KABOOM */
  bomb() {
    noise({ dur: 1.3, vol: 0.55, f0: 5000, f1: 50, q: 1 });
    tone({ type: 'triangle', f0: 150, f1: 28, dur: 1.0, vol: 0.26 });
  },
  /** 英雄升級:銅管往上 + 定音鼓 */
  levelUp() {
    sfx.brass(60, 0, 0.18); sfx.brass(65, 0.18, 0.18); sfx.brass(67, 0.36, 0.18); sfx.brass(72, 0.54, 0.6, 1.2);
    sfx.timpani(0.54, 1);
  },
  /** 大塊頭停下來準備連發:指關節「喀喀」 */
  beam() { noise({ dur: 0.05, vol: 0.12, f0: 3000, f1: 1500, q: 3 }); noise({ at: 0.12, dur: 0.05, vol: 0.12, f0: 3000, f1: 1500, q: 3 }); },
  /** 開場曲(原創的英雄進行曲):號角 + 小號旋律 + 定音鼓,約 3 秒 */
  start() {
    sfx.brass(60, 0, 0.25); sfx.brass(60, 0.3, 0.12); sfx.brass(67, 0.45, 0.6, 1.2);
    const lead = [[72, 2], [74, 1], [76, 1], [79, 3], [77, 1], [76, 2], [74, 2], [72, 1], [74, 1], [76, 1], [79, 1], [84, 4]];
    melody(lead, { bpm: 420, type: 'square', vol: 0.045, at: 1.1 });
    melody([[48, 4], [53, 4], [55, 4], [48, 6]], { bpm: 420, type: 'triangle', vol: 0.09, at: 1.1 });
    for (let i = 0; i < 4; i++) sfx.timpani(1.1 + i * 0.57, i === 3 ? 1.2 : 0.7);
  },
  /** 每一話開始:號角兩聲 */
  stage() {
    sfx.brass(67, 0, 0.14); sfx.brass(72, 0.18, 0.4);
    sfx.timpani(0.18, 0.8);
  },
};
