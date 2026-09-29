import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 漫畫英雄三十話:名字 / 陣型 / 機制 / 進場軌跡 / 大魔頭 + 每一話的場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 話的第 3 話(3, 8, 13, 18, 23, 28)是獎勵關(訓練),最後是不會攻擊的運鈔車。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['mech', 'brain', 'kaiju'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '隊伍裡的機器人會瞄準你開火',
  meteors: '小心滾過來的油桶',
  meteors2: '油桶滿街滾!',
  escort: '大塊頭會帶著機器人一起衝過來',
  kamikaze: '噴射背包打手會高速撞過來,但不開火',
  beam: '大塊頭會停在你前方連發,而且更耐打',
  swarm: '又快又多,整群衝過來',
  armored: '大家穿上鋼鐵裝甲,要打兩下',
  zigzag: '衝過來時會左右閃來閃去',
  barrage: '整排一起開火',
};

export const STAGE_TABLE = [
  S('英雄誕生', 'grid', [], ['top', 'side']),                                                                    // 1
  S('城市上空', 'arch', [], ['topLoop', 'diag', 'diag']),                                                        // 2
  C('屋頂訓練', 0),                                                                                                // 3
  S('機器人入侵', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                   // 4
  S('碼頭大亂鬥', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['kaiju']),                        // 5
  S('化學工廠', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['brain']),              // 6
  S('噴射突擊', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('公園特訓', 1),                                                                                                // 8
  S('鋼鐵巨人', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['mech']),               // 9
  S('雙重危機', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['mech', 'brain']),                   // 10
  S('霓虹夜襲', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['kaiju']),              // 11
  S('裝甲部隊', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                      // 12
  C('英雄學院', 2),                                                                                                // 13
  S('怪獸登陸', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['mech']),    // 14
  S('閃電追擊', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                 // 15
  S('地下基地', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['kaiju']),          // 16
  S('天空之戰', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                          // 17
  C('慶功派對', 3),                                                                                                // 18
  S('腦波攻擊', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                      // 19
  S('雙雄對決', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['brain', 'kaiju']), // 20
  S('毒氣危機', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['brain']),             // 21
  S('城市保衛戰', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['mech']),      // 22
  C('英雄遊行', 4),                                                                                                // 23
  S('暴動之夜', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                 // 24
  S('潛入要塞', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['mech']),          // 25
  S('熔岩地獄', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),            // 26
  S('最終危機', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),         // 27
  C('頒獎典禮', 5),                                                                                                // 28
  S('無限戰爭', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                 // 29
  S('終極決戰', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['mech', 'brain', 'kaiju']), // 30
];
/** 每一話的場景(palette.js THEMES):0 市中心 1 港口碼頭 2 化學工廠 3 霓虹夜城 4 中央公園 5 秘密基地 6 火山要塞 */
export const STAGE_THEME = [0, 0, 4, 0, 1, 2, 1, 4, 2, 0, 3, 2, 4, 1, 3, 5, 0, 3, 5, 3, 2, 0, 4, 3, 5, 6, 6, 4, 5, 6];
