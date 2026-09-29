import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 水墨江湖三十回:名字 / 陣型 / 機制 / 進場軌跡 / 強敵 + 每一回的場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 回的第 3 回(3, 8, 13, 18, 23, 28)是獎勵關(比武切磋),最後是不會攻擊的武功秘笈。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['bandit', 'dragon', 'demon'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '山賊會瞄準你丟飛鏢',
  meteors: '小心滾過來的酒罈',
  meteors2: '酒罈滿地滾!',
  escort: '鐵頭陀會帶著山賊一起衝過來',
  kamikaze: '飛賊會用輕功撲過來,但不丟飛鏢',
  beam: '鐵頭陀會停在你前方連發,而且更耐打',
  swarm: '又快又多,一擁而上',
  armored: '大家練了鐵布衫,要打兩下',
  zigzag: '衝過來時會左右閃身',
  barrage: '整排一起丟飛鏢',
};

export const STAGE_TABLE = [
  S('初入江湖', 'grid', [], ['top', 'side']),                                                                   // 1
  S('竹林小徑', 'arch', [], ['topLoop', 'diag', 'diag']),                                                       // 2
  C('以武會友', 0),                                                                                               // 3
  S('悅來客棧', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                    // 4
  S('黑風寨', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['bandit']),                          // 5
  S('江上夜渡', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['dragon']),            // 6
  S('飛簷走壁', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                             // 7
  C('山頂論劍', 1),                                                                                               // 8
  S('鐵頭陀', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['bandit']),              // 9
  S('山水之間', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['bandit', 'dragon']),               // 10
  S('雪地追蹤', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['demon']),              // 11
  S('鐵布衫', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                       // 12
  C('少林比武', 2),                                                                                               // 13
  S('荷塘月色', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['bandit']), // 14
  S('踏雪無痕', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                               // 15
  S('懸崖古寺', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['demon']),         // 16
  S('墨龍出淵', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                         // 17
  C('煮酒論英雄', 3),                                                                                             // 18
  S('千軍萬馬', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                     // 19
  S('龍爭虎鬥', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['dragon', 'demon']), // 20
  S('煙雨江南', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['dragon']),           // 21
  S('劍氣縱橫', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['bandit']),     // 22
  C('武林大會', 4),                                                                                               // 23
  S('群魔亂舞', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                // 24
  S('魔教總壇', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['demon']),        // 25
  S('血雨腥風', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),           // 26
  S('正邪之戰', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),        // 27
  C('把酒言歡', 5),                                                                                               // 28
  S('天下第一', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                // 29
  S('武林盟主', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['bandit', 'dragon', 'demon']), // 30
];
/** 每一回的場景(palette.js THEMES):0 竹林 1 客棧小鎮 2 山水 3 雪山 4 荷花湖 5 懸崖古寺 6 魔教總壇 */
export const STAGE_THEME = [1, 0, 0, 1, 0, 2, 1, 2, 5, 2, 3, 1, 5, 4, 3, 5, 2, 4, 3, 5, 4, 0, 2, 6, 6, 6, 5, 4, 3, 6];
