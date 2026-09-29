import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 平安京三十夜:名字 / 陣型 / 機制 / 進場軌跡 / 關底大妖怪 + 每夜場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 夜的第 3 夜(3, 8, 13, 18, 23, 28)是獎勵關(祭典),最後是不會攻擊的招財貓。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['raijin', 'kitsune', 'skull'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '陣中的妖怪會瞄準你吐人魂',
  meteors: '小心滾過來的輪入道',
  meteors2: '輪入道橫衝直撞!',
  escort: '赤鬼會帶著小妖一起衝',
  kamikaze: '提燈妖會高速撲過來,但不攻擊',
  beam: '赤鬼會停在你前方連發人魂,而且更耐打',
  swarm: '妖怪又快又多',
  armored: '妖怪戴上了能面,要打兩下',
  zigzag: '衝過來時會左右飄忽',
  barrage: '整排妖怪一起往下吐',
};

export const STAGE_TABLE = [
  S('平安京', 'grid', [], ['top', 'side']),                                                                      // 1
  S('朱雀大路', 'arch', [], ['topLoop', 'diag', 'diag']),                                                        // 2
  C('夏祭', 0),                                                                                                    // 3
  S('羅生門', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                         // 4
  S('一條戾橋', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['skull']),                            // 5
  S('千本鳥居', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['kitsune']),             // 6
  S('竹林小徑', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('花火大會', 1),                                                                                                // 8
  S('鴨川夜櫻', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['raijin']),              // 9
  S('大江山', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['raijin', 'kitsune']),                   // 10
  S('百鬼夜行', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['skull']),                 // 11
  S('鬼門', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                           // 12
  C('七夕', 2),                                                                                                    // 13
  S('神奈川沖', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['raijin']),   // 14
  S('狐之嫁入', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral'], ['kitsune']),                   // 15
  S('雪女之夜', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['skull']),           // 16
  S('土蜘蛛', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                             // 17
  C('月見', 3),                                                                                                    // 18
  S('丑時參', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                        // 19
  S('酒吞童子', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['kitsune', 'skull']), // 20
  S('雷雲', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['raijin']),                // 21
  S('紅葉狩', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['kitsune']),        // 22
  C('初詣', 4),                                                                                                    // 23
  S('骸骨原', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral'], ['skull']),        // 24
  S('黃泉比良坂', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['skull']),        // 25
  S('怒濤', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral'], ['raijin']),    // 26
  S('妖狐之森', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag'], ['kitsune']), // 27
  C('節分撒豆', 5),                                                                                                // 28
  S('鬼之城', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                   // 29
  S('夜明', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['raijin', 'kitsune', 'skull']), // 30
];
/** 每一夜的場景(palette.js THEMES):0 平安京 1 千本鳥居 2 竹林 3 夜櫻 4 浪裏 5 雪夜 6 紅葉 */
export const STAGE_THEME = [0, 0, 3, 0, 4, 1, 2, 3, 3, 6, 0, 1, 3, 4, 1, 5, 2, 6, 1, 6, 4, 6, 5, 2, 5, 4, 2, 0, 1, 0];
