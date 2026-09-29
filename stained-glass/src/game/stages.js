import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 彩窗騎士三十章:名字 / 陣型 / 機制 / 進場軌跡 / 大魔物 + 每一章的場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 章的第 3 章(3, 8, 13, 18, 23, 28)是獎勵關(騎士比武),最後是不會攻擊的聖杯。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['golem', 'dragon', 'witch'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '哥布林會瞄準你丟魔法彈',
  meteors: '小心滾過來的火球',
  meteors2: '火球滿地滾!',
  escort: '黑騎士會帶著哥布林一起衝過來',
  kamikaze: '蝙蝠會高速撲過來,但不丟魔法彈',
  beam: '黑騎士會停在你前方連發,而且更耐打',
  swarm: '又快又多,一大群衝過來',
  armored: '大家穿上鐵甲,要打兩下',
  zigzag: '衝過來時會左右閃來閃去',
  barrage: '整排一起丟魔法彈',
};

export const STAGE_TABLE = [
  S('騎士出發', 'grid', [], ['top', 'side']),                                                                    // 1
  S('城堡花園', 'arch', [], ['topLoop', 'diag', 'diag']),                                                        // 2
  C('比武大會', 0),                                                                                                // 3
  S('哥布林入侵', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                   // 4
  S('火球山坡', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['witch']),                          // 5
  S('魔法森林', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['dragon']),             // 6
  S('蝙蝠洞窟', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('王宮舞會', 1),                                                                                                // 8
  S('石巨人甦醒', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['golem']),            // 9
  S('雙重試煉', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['golem', 'dragon']),                 // 10
  S('童話村莊', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['witch']),               // 11
  S('鐵甲軍團', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                      // 12
  C('收穫祭', 2),                                                                                                  // 13
  S('大教堂', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['golem']),     // 14
  S('湖畔之戰', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                // 15
  S('魔女之塔', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['witch']),         // 16
  S('龍之山谷', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                          // 17
  C('騎士晚宴', 3),                                                                                                // 18
  S('熔岩橋', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                        // 19
  S('龍與魔女', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['dragon', 'witch']), // 20
  S('迷霧湖', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['dragon']),            // 21
  S('城門保衛戰', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['golem']),    // 22
  C('星光慶典', 4),                                                                                                // 23
  S('魔物大軍', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                 // 24
  S('暗黑王城', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['witch']),        // 25
  S('火之試煉', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),            // 26
  S('王座之間', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),        // 27
  C('加冕典禮', 5),                                                                                                // 28
  S('最終決戰', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                // 29
  S('聖光王者', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['golem', 'dragon', 'witch']), // 30
];
/** 每一章的場景(palette.js THEMES):0 城堡花園 1 魔法森林 2 童話村莊 3 大教堂 4 湖畔 5 龍之山谷 6 暗黑王城 */
export const STAGE_THEME = [0, 0, 3, 0, 5, 1, 1, 3, 3, 1, 2, 2, 2, 3, 4, 6, 5, 3, 5, 6, 4, 0, 3, 5, 6, 5, 6, 3, 6, 6];
