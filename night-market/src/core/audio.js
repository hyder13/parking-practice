import { baseSfx, tone, noise, melody, throttle } from '@arcade/audio/synth.js';

/* ------------------------------------------------------------------ *
 * 8-bit 音效:全部用 WebAudio 即時合成(方波 / 三角波 / 雜訊),沒有音檔。
 * 旋律是原創的短句,輕快的大調五聲音階,只取「逛夜市」的熱鬧氣氛,不是任何現成的曲子。
 * 合成器 + 共用音效在 arcade-core/audio/synth.js;這裡只放這款遊戲自己味道的音效。
 * ------------------------------------------------------------------ */
export const sfx = {
  ...baseSfx,
  /** 發射珍珠:QQ 的「啵」 */
  shot() {
    if (!throttle('sh', 0.07)) return;
    tone({ type: 'sine', f0: 520, f1: 1300, dur: 0.06, vol: 0.06 });
    noise({ dur: 0.02, vol: 0.02, f0: 3000, f1: 1500 });
  },
  /** 借過:機車喇叭「叭叭」+ 一陣風 */
  loop() {
    for (const at of [0, 0.16]) {
      tone({ type: 'square', f0: 440, f1: 440, at, dur: 0.1, vol: 0.05 });
      tone({ type: 'square', f0: 554, f1: 554, at, dur: 0.1, vol: 0.04 });
    }
    noise({ at: 0.2, dur: 0.6, vol: 0.1, f0: 500, f1: 2500, q: 1.2 });
  },
  /** 鐵板的「滋——」聲 */
  sizzle(at = 0, dur = 0.6, vol = 0.08) {
    noise({ at, dur, vol, f0: 9000, f1: 6000, q: 0.4 });
    for (let i = 0; i < 6; i++) noise({ at: at + Math.random() * dur, dur: 0.03, vol: vol * 0.8, f0: 7000, f1: 3000, q: 1 });
  },
  /** 收銀機「叮鈴」 */
  register(at = 0) {
    noise({ at, dur: 0.05, vol: 0.12, f0: 3000, f1: 1000, q: 2 });
    tone({ type: 'triangle', f0: 2093, f1: 2093, at: at + 0.05, dur: 0.4, vol: 0.05 });
    tone({ type: 'triangle', f0: 2637, f1: 2637, at: at + 0.12, dur: 0.5, vol: 0.045 });
  },
  /** 手搖鈴(攤販搖鈴招客) */
  gong(at = 0, vol = 1) {
    for (let i = 0; i < 4; i++) tone({ type: 'triangle', f0: 1760, f1: 1700, at: at + i * 0.07, dur: 0.18, vol: 0.05 * vol });
  },
  /** 招牌料理落地:大鍋「咚」+ 鍋蓋「匡」 */
  bossLand() {
    tone({ type: 'sine', f0: 100, f1: 42, dur: 0.4, vol: 0.25 });
    tone({ type: 'triangle', f0: 1200, f1: 900, at: 0.02, dur: 0.25, vol: 0.05 });
    noise({ dur: 0.35, vol: 0.18, f0: 1800, f1: 200, q: 2 });
  },
  rocket() { throttle('rk', 0.3) && noise({ dur: 0.6, vol: 0.1, f0: 600, f1: 1400, q: 1 }); },
  /** 招牌料理出場:炒鍋匡匡匡 + 鼓 */
  warning() {
    for (let i = 0; i < 8; i++) {
      noise({ at: i * 0.12, dur: 0.06, vol: i % 4 === 0 ? 0.18 : 0.1, f0: 2400, f1: 600, q: 3 });
      tone({ type: 'sine', f0: i % 4 === 0 ? 110 : 150, f1: 50, at: i * 0.12, dur: 0.15, vol: 0.12 });
    }
    sfx.sizzle(0.96, 0.8, 0.1);
    melody([[60, 1], [63, 1], [67, 1], [70, 3]], { bpm: 480, vol: 0.05, at: 1.0 });
  },
  /** 爆米香:「碰!」一大聲 + 米香劈哩啪啦 */
  bomb() {
    noise({ dur: 1.0, vol: 0.55, f0: 5000, f1: 60, q: 1 });
    tone({ type: 'triangle', f0: 180, f1: 30, dur: 0.9, vol: 0.25 });
    for (let i = 0; i < 30; i++) tone({ type: 'sine', f0: 700 + Math.random() * 900, f1: 1600, at: 0.2 + Math.random() * 0.9, dur: 0.03, vol: 0.03 });
  },
  levelUp() {
    melody([[72, 1], [74, 1], [76, 1], [79, 1], [81, 2], [84, 1], [86, 1], [88, 1], [91, 4]], { bpm: 560, type: 'square', vol: 0.05 });
    melody([[48, 4], [55, 4], [60, 6]], { bpm: 560, type: 'triangle', vol: 0.12 });
    sfx.register(0.6);
  },
  /** 刈包停下來準備連丟:鐵板滋兩聲 */
  beam() { sfx.sizzle(0, 0.2, 0.1); sfx.sizzle(0.22, 0.2, 0.1); },
  /** 開場曲(原創):搖鈴 + 鐵板滋滋 + 輕快的五聲音階旋律 + 收銀機,約 3 秒 */
  start() {
    sfx.gong(0, 1);
    sfx.sizzle(0.1, 0.5, 0.06);
    const lead = [[72, 1], [74, 1], [76, 2], [79, 1], [76, 1], [74, 1], [72, 1], [74, 2], [76, 1], [79, 1], [81, 2], [79, 1], [76, 1], [79, 4]];
    melody(lead, { bpm: 440, type: 'square', vol: 0.05, at: 0.35 });
    melody([[48, 2], [55, 2], [52, 2], [55, 2], [53, 2], [57, 2], [55, 2], [48, 4]], { bpm: 440, type: 'triangle', vol: 0.1, at: 0.35 });
    for (let i = 0; i < 10; i++) noise({ at: 0.35 + i * 0.273, dur: 0.04, vol: 0.06, f0: 6000, f1: 3000 });
    sfx.register(2.9);
  },
  stage() {
    sfx.gong(0, 0.7);
    melody([[72, 1], [76, 1], [79, 1], [84, 3]], { bpm: 520, type: 'square', vol: 0.05, at: 0.1 });
  },
};
