import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,用日本的「都節音階」(E F A B C)做出和風的味道,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 擲符:紙張劃過空氣的「唰」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    noise({ dur: 0.07, vol: 0.06, f0: 7000, f1: 3000, q: 0.6 });
    tone({ type: 'triangle', f0: 1900, f1: 1500, dur: 0.04, vol: 0.02 });
  },
  /** 飛躍:一陣風 + 尺八般往上滑的氣音 */
  loop() {
    noise({ dur: 0.8, vol: 0.12, f0: 400, f1: 2600, q: 1.4 });
    tone({ type: 'sine', f0: 440, f1: 880, at: 0.05, dur: 0.6, vol: 0.05, a: 0.08 });
  },
  /** 拍子木(歌舞伎開場「喀、喀」):n 聲、越打越快 */
  hyoshigi(at = 0, n = 2, gap = 0.28, accel = 1) {
    let t = at;
    for (let i = 0; i < n; i++) {
      noise({ at: t, dur: 0.03, vol: 0.22, f0: 6000, f1: 2500, q: 4 });
      tone({ type: 'square', f0: 1900, f1: 1700, at: t, dur: 0.03, vol: 0.05 });
      t += gap; gap *= accel;
    }
    return t;
  },
  /** 三味線:撥弦(三角波 + 鋸齒波,很快衰減、音頭微微往下彎) */
  shamisen(notes, at = 0, bpm = 400, vol = 0.07) {
    const step = 60 / bpm; let t = at;
    for (const [n, len] of notes) {
      if (n !== null) {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        tone({ type: 'sawtooth', f0: f * 1.03, f1: f, at: t, dur: Math.min(0.35, step * len), vol, a: 0.002 });
        tone({ type: 'triangle', f0: f * 2.02, f1: f * 2, at: t, dur: 0.12, vol: vol * 0.5, a: 0.002 });
      }
      t += step * len;
    }
    return t;
  },
  /** 太鼓:低沉的一聲 */
  taiko(at = 0, vol = 1) {
    tone({ type: 'sine', f0: 110, f1: 45, at, dur: 0.35, vol: 0.22 * vol });
    noise({ at, dur: 0.12, vol: 0.1 * vol, f0: 700, f1: 90 });
  },
  /** 大妖怪落地:大太鼓 */
  bossLand() {
    sfx.taiko(0, 1.3);
    noise({ dur: 0.35, vol: 0.2, f0: 900, f1: 100, q: 1 });
  },
  /** 梵鐘:很長的低音 + 泛音 */
  gong(at = 0, vol = 1) {
    tone({ type: 'sine', f0: 98, f1: 96, at, dur: 2.2, vol: 0.16 * vol, a: 0.004 });
    tone({ type: 'sine', f0: 262, f1: 259, at, dur: 1.6, vol: 0.05 * vol, a: 0.004 });
    tone({ type: 'triangle', f0: 523, f1: 520, at, dur: 0.9, vol: 0.03 * vol, a: 0.004 });
    noise({ at, dur: 0.3, vol: 0.06 * vol, f0: 2000, f1: 300, q: 2 });
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.8, vol: 0.14, f0: 300, f1: 1200, q: 1 }); },
  /** 大妖怪出場:太鼓連打 + 梵鐘 + 三味線低音 */
  warning() {
    for (let i = 0; i < 8; i++) sfx.taiko(i * 0.12, i % 4 === 0 ? 1 : 0.55);
    sfx.gong(0.96, 1.1);
    sfx.shamisen([[52, 1], [53, 1], [57, 1], [52, 3]], 1.0, 360, 0.08);
  },
  /** 爆符:一聲雷 */
  bomb() {
    noise({ dur: 1.2, vol: 0.5, f0: 5000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 160, f1: 30, dur: 1.0, vol: 0.25 });
    noise({ at: 0.25, dur: 0.8, vol: 0.2, f0: 1200, f1: 80, q: 0.8 });
  },
  /** 位階提升:琴的刮奏(都節音階往上)+ 鈴 */
  levelUp() {
    sfx.shamisen([[64, 1], [65, 1], [69, 1], [71, 1], [72, 1], [76, 1], [77, 1], [81, 1], [83, 1], [84, 4]], 0, 900, 0.05);
    melody([[52, 4], [57, 4], [64, 6]], { bpm: 560, type: 'triangle', vol: 0.1 });
    tone({ type: 'sine', f0: 2093, f1: 2093, at: 0.6, dur: 0.9, vol: 0.04 }); // 鈴
  },
  /** 赤鬼停下來準備連發:太鼓兩聲 */
  beam() { sfx.taiko(0); sfx.taiko(0.18); },
  /** 開場曲(原創):拍子木越打越快 → 梵鐘 → 三味線 + 太鼓,約 3 秒 */
  start() {
    const t = sfx.hyoshigi(0, 7, 0.22, 0.72);
    sfx.gong(t, 0.8);
    sfx.shamisen([[64, 1], [65, 1], [69, 2], [71, 1], [72, 1], [71, 1], [69, 1], [65, 2], [64, 1], [65, 1], [69, 4]], t + 0.1, 420);
    for (let i = 0; i < 8; i++) sfx.taiko(t + 0.1 + i * 0.285, i % 4 === 0 ? 0.9 : 0.45);
    melody([[40, 4], [45, 4], [47, 4], [40, 6]], { bpm: 420, type: 'triangle', vol: 0.06, at: t + 0.1 });
  },
  /** 每一夜開始:拍子木兩聲 + 短短的三味線 */
  stage() {
    const t = sfx.hyoshigi(0, 2, 0.25);
    sfx.shamisen([[64, 1], [69, 1], [71, 1], [72, 1], [76, 3]], t, 520);
  },
};
