/* ------------------------------------------------------------------ *
 * 遊戲常數 + 100 關的關卡生成。
 *
 * 座標:遊戲平面 = 世界 XY 平面(z = 0),+x 向右、+y 向上(畫面上方),
 * z 朝向鏡頭。場地 x ∈ ±FW/2、y ∈ ±FH/2,比例接近原作直立街機 (7:9.5)。
 * 模型 local:+y = 機頭,所以 heading θ 的前方 = (−sin θ, cos θ),
 * 面朝下(朝玩家)= θ = π。
 * ------------------------------------------------------------------ */
export const FW = 22;
/*
 * 場地高度會依螢幕比例調整(直立手機比較長):寬度固定 22,高度 30 ~ 42。
 * 多出來的高度平均加在上下:陣型 / 進場軌跡跟著「上緣」走(DY_TOP),
 * 玩家 / 俯衝軌跡跟著「下緣」走(DY_BOT)。ESM 的 export let 是 live binding,
 * 其他模組 import 進去的值會跟著 setFieldHeight 更新。
 */
export let FH = 30;
export let DY_TOP = 0, DY_BOT = 0;
export let PLAYER_Y = -12.4;
export let TOP_SPAWN = 18.5;   // 從畫面上方外面回來的高度
export let BOTTOM_OUT = -17.5; // 低於這個高度 = 已經飛出畫面
export let ROW0 = 10.2;        // 陣型最上排(王)的高度
export const FH_MIN = 30, FH_MAX = 42;
export function setFieldHeight(h) {
  FH = Math.max(FH_MIN, Math.min(FH_MAX, h));
  const d = (FH - 30) / 2;
  DY_TOP = d; DY_BOT = -d;
  PLAYER_Y = -12.4 - d; TOP_SPAWN = 18.5 + d; BOTTOM_OUT = -17.5 - d; ROW0 = 10.2 + d;
}

// 陣型:5 列,王 4 / 蝶 8 / 蝶 8 / 蜂 10 / 蜂 10 = 40 隻(與原作相同)
export const SX = 1.85, SY = 1.5;
export const ROWS = [
  { type: 'boss', cols: [3, 4, 5, 6] },
  { type: 'bfly', cols: [1, 2, 3, 4, 5, 6, 7, 8] },
  { type: 'bfly', cols: [1, 2, 3, 4, 5, 6, 7, 8] },
  { type: 'bee', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { type: 'bee', cols: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
];
export function slotOf(id) {
  const [row, col] = id.split(':').map(Number);
  // by = 相對最上排的高度(實際位置 = ROW0 + by,ROW0 會隨場地高度變)
  return { id, row, col, type: ROWS[row].type, bx: (col - 4.5) * SX, by: -row * SY };
}

// 分數(沿用原作的配分):陣型中 / 俯衝中
export const SCORE = {
  bee: [50, 100],
  bfly: [80, 160],
  boss: [150, 400], // 俯衝中帶護衛:先打掉 1 隻護衛 800、2 隻 1600
};
export const EXTRA_LIFE = [20000, 70000]; // 之後每 70000 加一台

/* ---------------- 進場波次 ----------------
 * 每關 5 波、每波 8 隻。pair = 左右兩條隊伍同時進場(前 4 隻走 s=-1、後 4 隻 s=+1),
 * 否則單一隊伍走 s。slots 決定每隻最後歸位到哪一格。 */
const W = {
  w0: { slots: ['1:4', '1:5', '2:4', '2:5', '3:4', '3:5', '4:4', '4:5'] },
  w1: { slots: ['0:3', '1:3', '0:4', '1:6', '0:5', '1:2', '0:6', '1:7'] },
  w2: { slots: ['1:1', '1:8', '2:1', '2:8', '2:2', '2:7', '2:3', '2:6'] },
  w3: { slots: ['3:0', '3:1', '3:2', '3:3', '3:6', '3:7', '3:8', '3:9'] },
  w4: { slots: ['4:0', '4:1', '4:2', '4:3', '4:6', '4:7', '4:8', '4:9'] },
};
const wave = (base, path, s, pair = false) => ({ ...W[base], path, s, pair });

export const MAX_STAGE = 100;

/* ---------------- 100 關程序生成 ----------------
 * t = 0..1 難度進度(第 1 關 0、第 100 關 1)。前期很快結束(2 波 16 隻 + 小 BOSS),
 * 之後波數增加到 5 波 40 隻,第 12 關起還有「增援」:陣型剩不多時再補滿一輪,關卡越後面越長。
 * 每 5 關的第 3 關(3, 8, 13 …)是獎勵關,最後出現不會攻擊的黃金飛碟。
 *
 * 難度參數
 *   enterSpeed  進場速度(單位 / 秒)     enterFire  進場時開火的機率(每隻)
 *   diveEvery   平均幾秒派一隻出擊        maxDivers  同時最多幾隻在俯衝
 *   diveSpeed   俯衝速度                  shots      每次俯衝最多發幾顆子彈
 *   bulletSpeed 敵彈速度                  beamChance 王出擊時放牽引光束的機率
 *   escort      王出擊時帶護衛的機率      beeLoop    蜂俯衝後在下方繞圈回頭的機率
 *   diveFrom    開始第 diveFrom+1 波進場時就開始俯衝(5 = 等全部進場完)
 *   reinforce   增援輪數                  boss       BOSS 種類 / 血量
 */
const lerpT = (a, b, t) => a + (b - a) * t;
function rng(seed) { // mulberry32:每關固定的亂數,同一關每次玩都一樣
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const BOSS_KINDS = ['queen', 'moth', 'ufo'];
export const isChallenge = (n) => n % 5 === 3;

export function stageCfg(n) {
  const t = Math.min(1, (n - 1) / (MAX_STAGE - 1));
  const r = rng(n * 7919 + 13);
  const pick = (a) => a[Math.floor(r() * a.length)];
  if (isChallenge(n)) {
    const nw = n < 10 ? 3 : n < 30 ? 4 : 5;
    const types = [['bee'], ['bfly'], ['boss', 'bfly'], ['bee', 'bfly']];
    const waves = [];
    for (let i = 0; i < nw; i++) {
      const tp = pick(types);
      const w = { path: i === 0 ? 'c1' : pick(['c2', 'c3']), s: i === 0 ? 0 : (i % 2 ? 1 : -1), pair: i === 0, types: [] };
      for (let k = 0; k < 8; k++) w.types.push(tp[k % tp.length]);
      waves.push(w);
    }
    return {
      n, t, kind: 'challenge', name: 'CHALLENGING STAGE', waves, enterSpeed: lerpT(14, 19, t), reinforce: 0,
      boss: { kind: 'gold', hp: Math.round(18 + n * 1.5) },
    };
  }
  const nw = n <= 2 ? 2 : n <= 6 ? 3 : n <= 10 ? 4 : 5;
  const early = n < 4;
  const order = ['w0', 'w1', 'w2', 'w3', 'w4'];
  const waves = order.slice(0, nw).map((base, i) => {
    if (i === 0) return wave(base, early ? 'top' : pick(['top', 'topLoop', 'zig']), 0, true);
    if (i <= 2) return wave(base, early ? 'side' : pick(['side', 'sideHigh', 'diag']), i % 2 ? 1 : -1);
    const p = pick(['diag', 'spiral', 'zig']);
    return p === 'diag' ? wave(base, p, i % 2 ? 1 : -1) : wave(base, p, 0, true);
  });
  const bk = BOSS_KINDS[(n - 1) % BOSS_KINDS.length];
  return {
    n, t, kind: 'normal', name: `STAGE ${n}`, waves,
    enterSpeed: lerpT(12.5, 19, t), enterFire: n < 3 ? 0 : lerpT(0.08, 0.5, t),
    diveEvery: lerpT(3.0, 0.8, Math.sqrt(t)), maxDivers: Math.round(lerpT(n < 3 ? 1 : 2, 7, t)),
    diveSpeed: lerpT(9.5, 17, t), shots: Math.round(lerpT(1, 4, t)), bulletSpeed: lerpT(10, 18, t),
    beamChance: n < 3 ? 0.15 : lerpT(0.3, 0.6, t), escort: lerpT(0.2, 0.8, t), beeLoop: lerpT(0.1, 0.7, t),
    diveFrom: n < 6 ? 5 : n < 30 ? 4 : n < 60 ? 3 : 2,
    reinforce: n < 12 ? 0 : 1 + Math.floor((n - 12) / 22),
    boss: { kind: bk, hp: Math.round(14 + 7 * (n - 1) + 0.22 * (n - 1) ** 2) },
  };
}
