import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 蒸汽天空三十航段:名字 / 陣型 / 機制 / 進場軌跡 / 巨大機械 + 每一段的場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 段的第 3 段(3, 8, 13, 18, 23, 28)是獎勵關(飛行競速),最後是不會攻擊的黃金懷錶。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['clock', 'whale', 'zeppelin'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '發條兵會瞄準你丟煤球',
  meteors: '小心滾過來的大齒輪',
  meteors2: '齒輪滿地滾!',
  escort: '蒸汽機器人會帶著發條兵一起衝過來',
  kamikaze: '發條蜻蜓會高速撲過來,但不丟煤球',
  beam: '蒸汽機器人會停在你前方連發,而且更耐打',
  swarm: '又快又多,一大群衝過來',
  armored: '大家裝上鐵甲,要打兩下',
  zigzag: '衝過來時會左右閃來閃去',
  barrage: '整排一起丟煤球',
};

export const STAGE_TABLE = [
  S('起飛', 'grid', [], ['top', 'side']),                                                                        // 1
  S('煙囪上空', 'arch', [], ['topLoop', 'diag', 'diag']),                                                        // 2
  C('飛行競速', 0),                                                                                                // 3
  S('發條兵來襲', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                   // 4
  S('齒輪坡道', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['zeppelin']),                       // 5
  S('鐘樓廣場', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['clock']),             // 6
  S('蜻蜓之群', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('蒸汽博覽會', 1),                                                                                              // 8
  S('鐵工廠', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['clock']),                // 9
  S('雙重警報', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['clock', 'whale']),                 // 10
  S('運河碼頭', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['whale']),              // 11
  S('鐵甲部隊', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                      // 12
  C('下午茶時間', 2),                                                                                              // 13
  S('煤礦山谷', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['clock']),   // 14
  S('鐵道追擊', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                // 15
  S('海盜空域', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['zeppelin']),     // 16
  S('雲上工廠', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                          // 17
  C('齒輪嘉年華', 3),                                                                                              // 18
  S('熔爐', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                          // 19
  S('巨鯨與飛艇', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['whale', 'zeppelin']), // 20
  S('濃霧運河', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['whale']),          // 21
  S('鐘塔保衛戰', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['clock']),   // 22
  C('煙火之夜', 4),                                                                                                // 23
  S('機械大軍', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                 // 24
  S('風暴要塞', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['zeppelin']),     // 25
  S('過熱警報', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),            // 26
  S('主控室', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),          // 27
  C('凱旋遊行', 5),                                                                                                // 28
  S('最終決戰', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                // 29
  S('天空之王', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['clock', 'whale', 'zeppelin']), // 30
];
/** 每一段的場景(palette.js THEMES):0 煙囪城 1 鐘樓廣場 2 運河碼頭 3 煤礦山谷 4 鐵道平原 5 雲上工廠 6 風暴要塞 */
export const STAGE_THEME = [0, 0, 1, 0, 3, 1, 4, 1, 5, 0, 2, 2, 1, 3, 4, 2, 5, 1, 5, 2, 2, 1, 5, 6, 6, 5, 6, 1, 6, 6];
