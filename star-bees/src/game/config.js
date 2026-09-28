/* ------------------------------------------------------------------ *
 * 遊戲常數 + 五個關卡的設定。
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

/*
 * 難度參數
 *   enterSpeed  進場速度(單位 / 秒)     enterFire  進場時開火的機率(每隻)
 *   diveEvery   平均幾秒派一隻出擊        maxDivers  同時最多幾隻在俯衝
 *   diveSpeed   俯衝速度                  shots      每次俯衝最多發幾顆子彈
 *   bulletSpeed 敵彈速度                  beamChance 王出擊時放牽引光束的機率
 *   escort      王出擊時帶護衛的機率      beeLoop    蜂俯衝後在下方繞圈回頭的機率
 *   diveFrom    開始第 diveFrom+1 波進場時就開始俯衝(5 = 等全部進場完)
 */
export const STAGES = [
  {
    name: 'STAGE 1', kind: 'normal',
    waves: [wave('w0', 'top', 0, true), wave('w1', 'side', 1), wave('w2', 'side', -1), wave('w3', 'diag', 1), wave('w4', 'diag', -1)],
    enterSpeed: 13, enterFire: 0, diveEvery: 2.8, maxDivers: 2, diveSpeed: 10.5, shots: 1, bulletSpeed: 11,
    beamChance: 0.4, escort: 0.35, beeLoop: 0.2, diveFrom: 5,
  },
  {
    name: 'STAGE 2', kind: 'normal',
    waves: [wave('w0', 'topLoop', 0, true), wave('w1', 'sideHigh', 1), wave('w2', 'sideHigh', -1), wave('w3', 'diag', 1), wave('w4', 'diag', -1)],
    enterSpeed: 14, enterFire: 0.12, diveEvery: 2.1, maxDivers: 3, diveSpeed: 12, shots: 2, bulletSpeed: 12.5,
    beamChance: 0.45, escort: 0.5, beeLoop: 0.35, diveFrom: 5,
  },
  {
    name: 'CHALLENGING STAGE', kind: 'challenge',
    // 獎勵關:敵人不開火也不俯衝,只照花式軌跡飛過,打中幾隻算幾隻
    waves: [
      { path: 'c1', s: 0, pair: true, types: ['bee', 'bee', 'bee', 'bee', 'bee', 'bee', 'bee', 'bee'] },
      { path: 'c2', s: 1, types: ['bfly', 'bfly', 'bfly', 'bfly', 'bfly', 'bfly', 'bfly', 'bfly'] },
      { path: 'c2', s: -1, types: ['boss', 'bfly', 'boss', 'bfly', 'boss', 'bfly', 'boss', 'bfly'] },
      { path: 'c3', s: 1, types: ['bee', 'bee', 'bee', 'bee', 'bee', 'bee', 'bee', 'bee'] },
      { path: 'c3', s: -1, types: ['bfly', 'bfly', 'bfly', 'bfly', 'bfly', 'bfly', 'bfly', 'bfly'] },
    ],
    enterSpeed: 15,
  },
  {
    name: 'STAGE 4', kind: 'normal',
    waves: [wave('w0', 'topLoop', 0, true), wave('w1', 'side', 1), wave('w2', 'side', -1), wave('w3', 'spiral', 0, true), wave('w4', 'spiral', 0, true)],
    enterSpeed: 15, enterFire: 0.25, diveEvery: 1.6, maxDivers: 4, diveSpeed: 13.5, shots: 2, bulletSpeed: 14,
    beamChance: 0.5, escort: 0.6, beeLoop: 0.5, diveFrom: 4,
  },
  {
    name: 'STAGE 5', kind: 'normal',
    waves: [wave('w0', 'zig', 0, true), wave('w1', 'sideHigh', 1), wave('w2', 'sideHigh', -1), wave('w3', 'spiral', 0, true), wave('w4', 'zig', 0, true)],
    enterSpeed: 16, enterFire: 0.35, diveEvery: 1.15, maxDivers: 5, diveSpeed: 15, shots: 3, bulletSpeed: 15.5,
    beamChance: 0.55, escort: 0.7, beeLoop: 0.6, diveFrom: 3,
  },
];

/** 第 n 關(1 起算)的設定:五關一輪,之後循環並逐輪加速。 */
export function stageCfg(n) {
  const base = STAGES[(n - 1) % STAGES.length];
  const loop = Math.floor((n - 1) / STAGES.length);
  if (!loop) return { ...base, n, loop };
  const k = 1 + 0.1 * loop;
  return {
    ...base, n, loop,
    enterSpeed: base.enterSpeed * k,
    diveSpeed: base.diveSpeed && base.diveSpeed * k,
    bulletSpeed: base.bulletSpeed && base.bulletSpeed * k,
    diveEvery: base.diveEvery && base.diveEvery / (1 + 0.25 * loop),
    maxDivers: base.maxDivers && base.maxDivers + loop,
    enterFire: base.enterFire !== undefined ? Math.min(0.7, base.enterFire + 0.15 * loop) : undefined,
    diveFrom: base.diveFrom && Math.max(2, base.diveFrom - loop),
  };
}
