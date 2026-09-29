import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的 30 關:名字 / 陣型 / 機制 / 進場軌跡 / 關底 BOSS + 每關場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 關的第 3 關(3, 8, 13, 18, 23, 28)是獎勵關,最後是不會攻擊的黃金運輸機。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['fortress', 'flyingwing', 'zeppelin'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '編隊中的敵機會瞄準你開火',
  meteors: '小心斜飛過來的火箭',
  meteors2: '火箭彈幕!',
  escort: '重戰機會帶著護航機一起俯衝',
  kamikaze: '敵機會高速衝撞,但不開火',
  beam: '重戰機會停在你上方掃射,而且更耐打',
  swarm: '敵機又快又多',
  armored: '敵機加裝了裝甲,要打兩下',
  zigzag: '俯衝時會左右蛇行',
  barrage: '編隊會整排往下齊射',
};

export const STAGE_TABLE = [
  S('FIRST SORTIE', 'grid', [], ['top', 'side']),                                                        // 1
  S('ISLAND HOP', 'arch', [], ['topLoop', 'diag', 'diag']),                                           // 2
  C('BONUS STAGE', 0),                                                                                    // 3
  S('SNIPER SQUADRON', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                               // 4
  S('ROCKET RAIN', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral']),                        // 5
  S('ESCORT DUTY', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag']),             // 6
  S('RAMMERS', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                     // 7
  C('BONUS STAGE', 1),                                                                                    // 8
  S('STRAFING RUN', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn']),               // 9
  S('TWIN GIANTS', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['fortress', 'flyingwing']),       // 10
  S('SWARM', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral']),                     // 11
  S('IRON WINGS', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                              // 12
  C('BONUS STAGE', 2),                                                                                    // 13
  S('CROSSFIRE', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig']),  // 14
  S('ZIGZAG', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                         // 15
  S('FLAK CURTAIN', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn']),             // 16
  S('DEATH DIVE', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),            // 17
  C('BONUS STAGE', 3),                                                                                    // 18
  S('NIGHT RAIDERS', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),          // 19
  S('DOUBLE TROUBLE', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['zeppelin', 'fortress']), // 20
  S('STEEL RAIN', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig']),             // 21
  S('DEAD EYE', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag']),         // 22
  C('BONUS STAGE', 4),                                                                                    // 23
  S('BULLET STORM', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),    // 24
  S('STEEL RAMMERS', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig']),      // 25
  S('ROCKET STORM', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']), // 26
  S('ALL-OUT ATTACK', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']), // 27
  C('BONUS STAGE', 5),                                                                                    // 28
  S('SKY FORTRESS', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),        // 29
  S('FINAL MISSION', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['fortress', 'flyingwing', 'zeppelin']), // 30
];
/** 每一關的海域(palette.js THEMES,依序輪流) */
export const STAGE_THEME = Array.from({ length: 30 }, (_, i) => i);
