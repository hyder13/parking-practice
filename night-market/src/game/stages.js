import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 夜市三十攤:名字 / 陣型 / 機制 / 進場軌跡 / 關底招牌料理 + 每攤場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 攤的第 3 攤(3, 8, 13, 18, 23, 28)是獎勵關(夜市遊戲),最後是不會攻擊的棉花糖。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['sausage', 'omelette', 'hotpot'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '攤位上的小吃會瞄準你丟辣椒',
  meteors: '小心滾過來的貢丸串',
  meteors2: '貢丸串滿天飛!',
  escort: '刈包會帶著臭豆腐一起衝',
  kamikaze: '雞排會高速撲過來,但不丟辣椒',
  beam: '刈包會停在你前方連丟辣椒,而且更耐打',
  swarm: '人潮又多又擠',
  armored: '小吃裹了一層酥炸粉,要打兩下',
  zigzag: '衝過來時會左右亂竄',
  barrage: '整排小吃一起往下丟',
};

export const STAGE_TABLE = [
  S('開吃', 'grid', [], ['top', 'side']),                                                                        // 1
  S('小吃街', 'arch', [], ['topLoop', 'diag', 'diag']),                                                          // 2
  C('撈金魚', 0),                                                                                                  // 3
  S('臭豆腐攤', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                     // 4
  S('麻辣鍋', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['hotpot']),                           // 5
  S('蚵仔煎', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['omelette']),             // 6
  S('雞排飛來', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('射氣球', 1),                                                                                                  // 8
  S('大腸包小腸', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['sausage']),          // 9
  S('雙拼套餐', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['sausage', 'omelette']),              // 10
  S('人擠人', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['hotpot']),                  // 11
  S('酥炸攤', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                         // 12
  C('套圈圈', 2),                                                                                                  // 13
  S('烤玉米', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['sausage']),    // 14
  S('河濱夜市', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                 // 15
  S('滷味攤', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['hotpot']),            // 16
  S('排隊名店', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                           // 17
  C('夾娃娃', 3),                                                                                                  // 18
  S('下雨天', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                        // 19
  S('雙人套餐', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['omelette', 'hotpot']), // 20
  S('胡椒餅', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['omelette']),            // 21
  S('鹽酥雞', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['sausage']),        // 22
  C('抽抽樂', 4),                                                                                                  // 23
  S('宵夜場', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                   // 24
  S('章魚燒', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['hotpot']),            // 25
  S('大火快炒', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),            // 26
  S('米其林', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),           // 27
  C('刮刮樂', 5),                                                                                                  // 28
  S('收攤前', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                   // 29
  S('夜市之王', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['sausage', 'omelette', 'hotpot']), // 30
];
/** 每一攤的場景(palette.js THEMES):0 小吃街 1 霓虹街 2 遊戲區 3 廟口 4 河濱 5 雨夜 6 過年夜市 */
export const STAGE_THEME = [0, 0, 2, 0, 3, 1, 0, 2, 1, 3, 1, 0, 2, 4, 4, 3, 1, 2, 5, 6, 0, 1, 2, 5, 3, 4, 1, 2, 5, 6];
