/* ------------------------------------------------------------------ *
 * 遊戲常數 + 30 關的關卡表。
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

/* ---------------- 30 關(每一關都有自己的名字、陣型、變化) ----------------
 * 【使用者回饋 2026-09-29】100 關每關差不多 → 濃縮成 30 關,重點是每關都有變化、難度明顯往上。
 *   shape   陣型形狀:grid 方陣 / arch 拱形 / v V 字 / peak 倒 V / wave 會動的波浪
 *   twists  關卡機制(可疊加,見 TWISTS)
 *   paths   每一波的進場軌跡(第 0 波左右成對;第 3、4 波若是 spiral/zig 也成對)
 *   bosses  關底 BOSS,多隻 = 連戰(第 10、20 關兩隻,第 30 關三隻 BOSS RUSH)
 * 每 5 關的第 3 關(3, 8, 13, 18, 23, 28)是獎勵關,最後是不會攻擊的大紅包。
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
export const BOSS_KINDS = ['nian', 'granny', 'ghost'];

/** 關卡機制:中文提示只在關卡開場顯示一次 */
export const TWISTS = {
  snipers: { hint: '陣中的小鬼會瞄準你丟鬼火', apply: (c) => { c.formFire = lerpT(2.4, 1.0, c.t); c.diveEvery *= 1.25; } },
  meteors: { hint: '小心飄過來的鬼火', apply: (c) => { c.meteors = lerpT(1.7, 0.9, c.t); } },
  meteors2: { hint: '鬼火亂竄!', apply: (c) => { c.meteors = 0.45; } },
  escort: { hint: '夜叉會帶著小鬼一起衝', apply: (c) => { c.escort = 1; c.beamChance = 0; c.bossDive = 0.4; } },
  kamikaze: { hint: '殭屍會高速跳過來,但不攻擊', apply: (c) => { c.diveShots = 0; c.diveMul = 1.3; c.beeLoop = 0.85; c.maxDivers += 2; c.diveEvery *= 0.7; } },
  beam: { hint: '夜叉會停在你前方連發鬼火,而且更耐打', apply: (c) => { c.beamChance = 0.9; c.bossHp = 3; c.bossDive = 0.35; } },
  swarm: { hint: '鬼怪又快又多', apply: (c) => { c.enterSpeed *= 1.2; c.enterFire = Math.min(0.8, (c.enterFire || 0) + 0.3); c.maxDivers += 2; c.diveEvery *= 0.7; c.diveFrom = Math.min(c.diveFrom, 2); } },
  armored: { hint: '鬼怪戴了鐵面具,要打兩下', apply: (c) => { c.armored = true; } },
  zigzag: { hint: '衝過來時會左右亂竄', apply: (c) => { c.weave = 1.8 + c.t; } },
  barrage: { hint: '整排鬼怪一起往下丟', apply: (c) => { c.barrage = lerpT(3.2, 1.6, c.t); } },
};

const S = (name, shape, twists, paths, bosses = null) => ({ name, shape, twists, paths, bosses });
const C = (name, level) => ({ name, challenge: level });
export const STAGE_TABLE = [
  S('起駕', 'grid', [], ['top', 'side']),                                                                        // 1
  S('老街', 'arch', [], ['topLoop', 'diag', 'diag']),                                                            // 2
  C('搶紅包', 0),                                                                                                  // 3
  S('夜市', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                           // 4
  S('鬼月普渡', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['ghost']),                            // 5
  S('稻田小路', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['granny']),              // 6
  S('殭屍出沒', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('發財金', 1),                                                                                                  // 8
  S('鞭炮陣', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['nian']),                   // 9
  S('年獸來了', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['nian', 'granny']),                    // 10
  S('城隍夜巡', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['ghost']),                 // 11
  S('鐵面鬼', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                         // 12
  C('元宵燈會', 2),                                                                                                // 13
  S('蜂炮', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['nian']),          // 14
  S('漁港', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                     // 15
  S('王船祭', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['ghost']),             // 16
  S('八家將', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                             // 17
  C('搶頭香', 3),                                                                                                  // 18
  S('陣頭大拼', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                      // 19
  S('虎姑婆', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['granny', 'ghost']),   // 20
  S('山邊小廟', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['granny']),            // 21
  S('炸寒單', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['nian']),           // 22
  C('放天燈', 4),                                                                                                  // 23
  S('廟口大街', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                 // 24
  S('夜半鐘聲', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['ghost']),           // 25
  S('燒王船', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),              // 26
  S('百鬼夜行', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),          // 27
  C('平安宴', 5),                                                                                                  // 28
  S('回鑾', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                      // 29
  S('遶境圓滿', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['nian', 'granny', 'ghost']), // 30
];
/** 每一站的場景(palette.js THEMES):0 廟埕 1 老街 2 夜市 3 鞭炮陣 4 鄉間 5 漁港 6 燈會 */
export const STAGE_THEME = [0, 1, 0, 2, 6, 4, 2, 1, 3, 3, 6, 1, 6, 3, 5, 5, 0, 0, 2, 4, 4, 3, 6, 1, 2, 5, 6, 0, 1, 0];
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
