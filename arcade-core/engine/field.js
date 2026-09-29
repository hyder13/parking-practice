import { BOSS_KINDS, TWIST_HINTS, STAGE_TABLE, STAGE_THEME } from '@skin/game/stages.js';

export { BOSS_KINDS, STAGE_TABLE, STAGE_THEME };
/* ------------------------------------------------------------------ *
 * 遊戲常數 + 關卡邏輯(所有換皮共用)。關卡表 / 名字 / BOSS 種類在各遊戲的 src/game/stages.js。
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
export const SX = 1.85, SY = 1.7; // 飛機比蜜蜂長,列距拉開一點
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
  rock: [30, 30],   // 火箭(打 2 下)
};
export const EXTRA_LIFE = [30000, 100000]; // 之後每 100000 加一台

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

export const MAX_STAGE = 30;

/* ---------------- 30 關(每一關都有自己的名字、陣型、變化;表在 stages.js) ----------------
 * 【使用者回饋 2026-09-29】100 關每關差不多 → 濃縮成 30 關,重點是每關都有變化、難度明顯往上。
 *   shape   陣型形狀:grid 方陣 / arch 拱形 / v V 字 / peak 倒 V / wave 會動的波浪
 *   twists  關卡機制(可疊加,見 TWISTS)
 *   paths   每一波的進場軌跡(第 0 波左右成對;第 3、4 波若是 spiral/zig 也成對)
 *   bosses  關底 BOSS,多隻 = 連戰(第 10、20 關兩隻,第 30 關三隻 BOSS RUSH)
 * 每 5 關的第 3 關(3, 8, 13, 18, 23, 28)是獎勵關,最後是不會攻擊的金色目標(BOSS_INFO.gold)。
 * 第 31 關以後:30 關再輪一次,整體再加速(EXTRA)。
 *
 * 數值參數(依難度進度 t = 0..1 內插,再被 twists 修改)
 *   enterSpeed  進場速度                  enterFire  進場時開火的機率(每隻)
 *   diveEvery   平均幾秒派一隻出擊        maxDivers  同時最多幾隻在俯衝
 *   diveSpeed   俯衝速度                  shots      每次俯衝最多發幾顆子彈
 *   bulletSpeed 敵彈速度                  beamChance 王出擊時放牽引光束的機率
 *   escort      王出擊時帶護衛的機率      beeLoop    蜂俯衝後在下方繞圈回頭的機率
 *   diveFrom    開始第 diveFrom+1 波進場時就開始俯衝(5 = 等全部進場完)
 *   reinforce   增援輪數(陣型剩不多時再補滿一輪)
 */
const lerpT = (a, b, t) => a + (b - a) * t;
/** 關卡機制(數值);提示文字在各遊戲的 stages.js TWIST_HINTS,開場顯示一次 */
const TWIST_APPLY = {
  snipers: { apply: (c) => { c.formFire = lerpT(2.4, 1.0, c.t); c.diveEvery *= 1.25; } },
  meteors: { apply: (c) => { c.meteors = lerpT(1.7, 0.9, c.t); } },
  meteors2: { apply: (c) => { c.meteors = 0.45; } },
  escort: { apply: (c) => { c.escort = 1; c.beamChance = 0; c.bossDive = 0.4; } },
  kamikaze: { apply: (c) => { c.diveShots = 0; c.diveMul = 1.3; c.beeLoop = 0.85; c.maxDivers += 2; c.diveEvery *= 0.7; } },
  beam: { apply: (c) => { c.beamChance = 0.9; c.bossHp = 3; c.bossDive = 0.35; } },
  swarm: { apply: (c) => { c.enterSpeed *= 1.2; c.enterFire = Math.min(0.8, (c.enterFire || 0) + 0.3); c.maxDivers += 2; c.diveEvery *= 0.7; c.diveFrom = Math.min(c.diveFrom, 2); } },
  armored: { apply: (c) => { c.armored = true; } },
  zigzag: { apply: (c) => { c.weave = 1.8 + c.t; } },
  barrage: { apply: (c) => { c.barrage = lerpT(3.2, 1.6, c.t); } },
};

export const TWISTS = Object.fromEntries(Object.entries(TWIST_APPLY).map(([k, v]) => [k, { ...v, hint: TWIST_HINTS[k] || '' }]));

export const stageTheme = (n) => STAGE_THEME[(n - 1) % MAX_STAGE];
export const isChallenge = (n) => STAGE_TABLE[(n - 1) % MAX_STAGE].challenge !== undefined;

/** 獎勵關:等級越高波數越多、越快、敵人越雜 */
function challengeWaves(level) {
  const T = [['bee'], ['bfly'], ['boss', 'bfly'], ['bee', 'bfly'], ['boss', 'bee']];
  const paths = [['c1', 0], ['c2', 1], ['c3', -1], ['c2', -1], ['c3', 1]];
  const nw = Math.min(5, 3 + Math.floor(level / 2) + (level >= 3 ? 1 : 0));
  return paths.slice(0, nw).map(([path, s], i) => {
    const tp = T[(i + level) % T.length];
    return { path, s, pair: i === 0, types: Array.from({ length: 8 }, (_, k) => tp[k % tp.length]) };
  });
}

// 【使用者回饋 2026-09-29】BOSS 太弱、還沒攻擊就死 → 血量約 3 倍(第 1 關 45、第 10 關 ~650、第 30 關 ~3400)
const bossHp = (n) => Math.round(45 + 45 * (n - 1) + 2.5 * (n - 1) ** 2);

export function stageCfg(n) {
  if (n > MAX_STAGE) {
    // EXTRA:30 關再輪一次,每一輪再加速
    const loop = Math.floor((n - 1) / MAX_STAGE), c = stageCfg(((n - 1) % MAX_STAGE) + 1), k = 1 + 0.12 * loop;
    for (const key of ['enterSpeed', 'diveSpeed', 'bulletSpeed']) if (c[key]) c[key] *= k;
    if (c.diveEvery) c.diveEvery /= k;
    if (c.maxDivers) c.maxDivers += loop;
    c.boss.hp = Math.round(c.boss.hp * (1 + 0.4 * loop));
    return { ...c, n, name: `EX ${c.name}` };
  }
  const def = STAGE_TABLE[n - 1];
  const t = (n - 1) / (MAX_STAGE - 1);
  if (def.challenge !== undefined) {
    return {
      n, t, kind: 'challenge', name: def.name, twists: [], shape: 'grid', waves: challengeWaves(def.challenge),
      enterSpeed: lerpT(16, 21, t), reinforce: 0,
      boss: { kind: 'gold', hp: 30 + 5 * n }, bosses: ['gold'],
    };
  }
  const waves = def.paths.map((p, i) => {
    const base = ['w0', 'w1', 'w2', 'w3', 'w4'][i];
    if (i === 0) return wave(base, p, 0, true);
    if (i >= 3 && (p === 'spiral' || p === 'zig')) return wave(base, p, 0, true);
    return wave(base, p, i % 2 ? 1 : -1);
  });
  const normalIdx = STAGE_TABLE.slice(0, n).filter((d) => d.challenge === undefined).length - 1;
  const bosses = def.bosses || [BOSS_KINDS[normalIdx % BOSS_KINDS.length]];
  const c = {
    n, t, kind: 'normal', name: def.name, shape: def.shape, twists: def.twists, waves,
    // 【使用者回饋 2026-09-29】整體太簡單 → 全面提升一級(更快、更多、更準)
    enterSpeed: lerpT(14, 21, t), enterFire: n < 3 ? 0.03 : lerpT(0.1, 0.55, t),
    diveEvery: lerpT(2.6, 0.7, Math.sqrt(t)), maxDivers: Math.round(lerpT(2, 7, t)),
    diveSpeed: lerpT(10.5, 18, t), shots: Math.round(lerpT(1, 4, t)), bulletSpeed: lerpT(11, 19, t),
    beamChance: n < 3 ? 0.25 : lerpT(0.35, 0.55, t), escort: lerpT(0.35, 0.8, t), beeLoop: lerpT(0.25, 0.7, t),
    diveFrom: n < 3 ? 5 : n < 8 ? 4 : n < 15 ? 3 : 2,
    reinforce: n < 8 ? 0 : n < 16 ? 1 : n < 26 ? 2 : 3,
    formFire: n >= 5 ? lerpT(6, 2.5, t) : 0, // 基本的陣型冷槍(SNIPERS 關會更密)
    bosses,
  };
  // 連戰時每隻血量打七五折
  c.boss = { kind: bosses[0], hp: Math.round(bossHp(n) * (bosses.length > 1 ? 0.75 : 1)) };
  for (const tw of def.twists) TWISTS[tw].apply(c);
  c.maxDivers = Math.round(c.maxDivers);
  return c;
}
