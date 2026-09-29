import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 黑白卡通劇場三十集:名字 / 陣型 / 機制 / 進場軌跡 / 大反派 + 每一集的場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 集的第 3 集(3, 8, 13, 18, 23, 28)是獎勵關(舞會),最後是不會攻擊的錢袋先生。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['train', 'moon', 'wolf'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '隊伍裡的花會瞄準你丟派',
  meteors: '小心滾過來的炸彈',
  meteors2: '炸彈滿地滾!',
  escort: '骷髏會帶著花一起衝過來',
  kamikaze: '小幽靈會高速撲過來,但不丟派',
  beam: '骷髏會停在你前方連發,而且更耐打',
  swarm: '又快又多,整群跳過來',
  armored: '大家戴上鐵頭盔,要打兩下',
  zigzag: '衝過來時會左右扭來扭去',
  barrage: '整排一起丟派',
};

export const STAGE_TABLE = [
  S('開麥拉!', 'grid', [], ['top', 'side']),                                                                     // 1
  S('大街遊行', 'arch', [], ['topLoop', 'diag', 'diag']),                                                         // 2
  C('歡樂舞會', 0),                                                                                                 // 3
  S('農場騷動', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                      // 4
  S('午夜墓園', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['wolf']),                            // 5
  S('碼頭歷險', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['moon']),                 // 6
  S('幽靈派對', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                               // 7
  C('爵士之夜', 1),                                                                                                 // 8
  S('火車大追逐', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['train']),              // 9
  S('骷髏之舞', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['train', 'moon']),                     // 10
  S('馬戲團來了', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['wolf']),               // 11
  S('鐵頭盔', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                         // 12
  C('踢踏舞大賽', 2),                                                                                               // 13
  S('月光小夜曲', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['train']),  // 14
  S('穀倉狂歡', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                  // 15
  S('鬼屋驚魂', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['wolf']),            // 16
  S('大野狼來了', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                         // 17
  C('派對時間', 3),                                                                                                 // 18
  S('空中飛人', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                       // 19
  S('夢遊雲端', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['moon', 'wolf']),    // 20
  S('霧夜港口', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['moon']),               // 21
  S('大遊行', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['train']),           // 22
  C('謝幕舞會', 4),                                                                                                 // 23
  S('暴風雨', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                    // 24
  S('午夜列車', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['train']),           // 25
  S('骷髏樂團', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),             // 26
  S('最後一場秀', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),        // 27
  C('首映之夜', 5),                                                                                                 // 28
  S('大結局', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                    // 29
  S('THE END', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['train', 'moon', 'wolf']), // 30
];
/** 每一集的場景(palette.js THEMES):0 小鎮大街 1 快樂農場 2 午夜墓園 3 碼頭港口 4 馬戲團 5 雲上夢境 6 月夜狂歡 */
export const STAGE_THEME = [0, 0, 4, 1, 2, 3, 2, 6, 1, 2, 4, 0, 4, 6, 1, 2, 1, 4, 4, 5, 3, 0, 4, 3, 6, 2, 6, 5, 5, 6];
