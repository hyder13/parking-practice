import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的 30 關:名字 / 陣型 / 機制 / 進場軌跡 / 關底 BOSS + 每關場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 關的第 3 關(3, 8, 13, 18, 23, 28)是獎勵關,最後是不會攻擊的大紅包。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['nian', 'granny', 'ghost'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '陣中的小鬼會瞄準你丟鬼火',
  meteors: '小心飄過來的鬼火',
  meteors2: '鬼火亂竄!',
  escort: '夜叉會帶著小鬼一起衝',
  kamikaze: '殭屍會高速跳過來,但不攻擊',
  beam: '夜叉會停在你前方連發鬼火,而且更耐打',
  swarm: '鬼怪又快又多',
  armored: '鬼怪戴了鐵面具,要打兩下',
  zigzag: '衝過來時會左右亂竄',
  barrage: '整排鬼怪一起往下丟',
};

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
