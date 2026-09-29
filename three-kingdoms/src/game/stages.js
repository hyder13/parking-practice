import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的 30 關:名字 / 陣型 / 機制 / 進場軌跡 / 關底 BOSS + 每關場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 關的第 3 關(3, 8, 13, 18, 23, 28)是獎勵關,最後是不會攻擊的草船。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['lubu', 'ship', 'elephant'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '敵陣中的弓兵會瞄準你放箭',
  meteors: '小心投石車丟來的巨石',
  meteors2: '巨石如雨!',
  escort: '騎兵會帶著步兵一起衝鋒',
  kamikaze: '敵兵捨命衝撞,但不放箭',
  beam: '騎兵會停在你前方連射弩箭,而且更耐打',
  swarm: '敵軍又快又多',
  armored: '敵兵穿上鐵甲,要打兩下',
  zigzag: '衝鋒時會左右迂迴',
  barrage: '敵陣會整排往下齊射',
};

export const STAGE_TABLE = [
  S('桃園結義', 'grid', [], ['top', 'side']),                                                                    // 1
  S('黃巾之亂', 'arch', [], ['topLoop', 'diag', 'diag']),                                                        // 2
  C('草船借箭', 0),                                                                                               // 3
  S('虎牢關', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag'], ['lubu']),                              // 4
  S('火燒博望坡', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral']),                                     // 5
  S('長坂坡', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['lubu']),                  // 6
  S('單騎救主', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('木牛流馬', 1),                                                                                               // 8
  S('連環計', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['ship']),                   // 9
  S('官渡之戰', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['lubu', 'elephant']),                   // 10
  S('三顧茅廬', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral']),                            // 11
  S('過五關', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                         // 12
  C('銅雀台', 2),                                                                                                 // 13
  S('火燒赤壁', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['ship']),      // 14
  S('華容道', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                   // 15
  S('定軍山', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn']),                        // 16
  S('單刀赴會', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig'], ['ship']),                 // 17
  C('煮酒論英雄', 3),                                                                                             // 18
  S('水淹七軍', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                      // 19
  S('夷陵之戰', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['ship', 'lubu']),    // 20
  S('七擒孟獲', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['elephant']),          // 21
  S('南蠻象陣', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['elephant']),     // 22
  C('七星燈', 4),                                                                                                 // 23
  S('失街亭', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                   // 24
  S('空城計', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig']),                        // 25
  S('木門道', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),              // 26
  S('出師表', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),           // 27
  C('天下三分', 5),                                                                                               // 28
  S('五丈原', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                    // 29
  S('三分歸一', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['lubu', 'ship', 'elephant']), // 30
];
/** 每一回的戰場(palette.js THEMES):0 桃園 1 黃巾平原 2 長坂坡 3 赤壁 4 關隘 5 南蠻 6 五丈原 */
export const STAGE_THEME = [0, 1, 3, 4, 1, 2, 2, 4, 3, 1, 6, 4, 1, 3, 2, 4, 3, 0, 3, 5, 5, 5, 6, 4, 4, 2, 6, 0, 6, 3];
