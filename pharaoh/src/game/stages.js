import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 小法老三十關:名字 / 陣型 / 機制 / 進場軌跡 / 守護者 + 每一關的場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 關的第 3 關(3, 8, 13, 18, 23, 28)是獎勵關(尼羅河慶典),最後是不會攻擊的黃金面具。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['sphinx', 'snake', 'scorpion'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '木乃伊會瞄準你丟詛咒火球',
  meteors: '小心滾過來的石球',
  meteors2: '石球滿地滾!',
  escort: '胡狼守衛會帶著木乃伊一起衝過來',
  kamikaze: '聖甲蟲會高速撲過來,但不丟火球',
  beam: '胡狼守衛會停在你前方連發,而且更耐打',
  swarm: '又快又多,一大群衝過來',
  armored: '大家戴上金甲,要打兩下',
  zigzag: '衝過來時會左右閃來閃去',
  barrage: '整排一起丟詛咒火球',
};

export const STAGE_TABLE = [
  S('日出', 'grid', [], ['top', 'side']),                                                                        // 1
  S('金色沙丘', 'arch', [], ['topLoop', 'diag', 'diag']),                                                        // 2
  C('尼羅河慶典', 0),                                                                                              // 3
  S('木乃伊甦醒', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                   // 4
  S('石球坡道', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['scorpion']),                       // 5
  S('尼羅河畔', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['snake']),             // 6
  S('聖甲蟲之群', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                            // 7
  C('豐收祭', 1),                                                                                                  // 8
  S('金字塔', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['sphinx']),               // 9
  S('雙重試煉', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['sphinx', 'snake']),                 // 10
  S('神殿大道', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['scorpion']),           // 11
  S('金甲軍團', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                      // 12
  C('太陽節', 2),                                                                                                  // 13
  S('帝王谷', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['sphinx']),    // 14
  S('綠洲', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                    // 15
  S('蛇之神殿', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['snake']),         // 16
  S('沙暴', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                              // 17
  C('月光宴', 3),                                                                                                  // 18
  S('烈日', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                          // 19
  S('蛇與蠍', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['snake', 'scorpion']), // 20
  S('河上迷霧', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['snake']),           // 21
  S('神殿保衛戰', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['sphinx']),  // 22
  C('星空祭', 4),                                                                                                  // 23
  S('亡者大軍', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                 // 24
  S('冥界之門', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['scorpion']),     // 25
  S('火之審判', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),            // 26
  S('心之秤', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),          // 27
  C('加冕典禮', 5),                                                                                                // 28
  S('最終決戰', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                // 29
  S('太陽之子', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['sphinx', 'snake', 'scorpion']), // 30
];
/** 每一關的場景(palette.js THEMES):0 金色沙漠 1 尼羅河畔 2 金字塔群 3 神殿大道 4 綠洲 5 帝王谷 6 冥界 */
export const STAGE_THEME = [0, 0, 1, 0, 2, 1, 4, 1, 2, 2, 3, 3, 1, 5, 4, 3, 0, 4, 5, 1, 1, 3, 4, 6, 6, 5, 6, 3, 6, 6];
