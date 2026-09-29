import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 毛線小世界三十段:名字 / 陣型 / 機制 / 進場軌跡 / 大魔王 + 每一段的場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 段的第 3 段(3, 8, 13, 18, 23, 28)是獎勵關(遊戲時間),最後是不會攻擊的金鈕扣。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['machine', 'queen', 'tangle'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '襪子怪會瞄準你丟大頭針',
  meteors: '小心滾過來的大鈕扣',
  meteors2: '大鈕扣滿地滾!',
  escort: '剪刀螃蟹會帶著襪子怪一起衝過來',
  kamikaze: '飛蛾會高速撲過來,但不丟大頭針',
  beam: '剪刀螃蟹會停在你前方連發,而且更耐打',
  swarm: '又快又多,一大群衝過來',
  armored: '大家穿上鐵頂針盔甲,要打兩下',
  zigzag: '衝過來時會左右扭來扭去',
  barrage: '整排一起丟大頭針',
};

export const STAGE_TABLE = [
  S('野餐出發', 'grid', [], ['top', 'side']),                                                                     // 1
  S('格子布大道', 'arch', [], ['topLoop', 'diag', 'diag']),                                                       // 2
  C('捉迷藏', 0),                                                                                                   // 3
  S('襪子大軍', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                      // 4
  S('鈕扣滾滾', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['tangle']),                          // 5
  S('牛仔布田野', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['queen']),             // 6
  S('飛蛾來襲', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                               // 7
  C('毛球派對', 1),                                                                                                 // 8
  S('縫紉機工廠', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['machine']),            // 9
  S('毛氈森林', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['machine', 'queen']),                  // 10
  S('線團大亂', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['tangle']),               // 11
  S('鐵頂針', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                         // 12
  C('跳房子', 2),                                                                                                   // 13
  S('拼布小鎮', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['machine']),  // 14
  S('雪地毛衣', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                 // 15
  S('絲絨夜空', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['tangle']),          // 16
  S('女王的宮殿', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                         // 17
  C('下午茶', 3),                                                                                                   // 18
  S('剪刀海岸', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                       // 19
  S('雙重麻煩', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['queen', 'tangle']), // 20
  S('緞帶河', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['queen']),              // 21
  S('針線盒探險', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['machine']),   // 22
  C('枕頭大戰', 4),                                                                                                 // 23
  S('亮片風暴', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                  // 24
  S('拆線危機', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['tangle']),        // 25
  S('大頭針之雨', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),          // 26
  S('最後一針', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),         // 27
  C('睡前故事', 5),                                                                                                 // 28
  S('大團圓', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                   // 29
  S('毛線之王', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['machine', 'queen', 'tangle']), // 30
];
/** 每一段的場景(palette.js THEMES):0 野餐格子布 1 牛仔布田野 2 毛氈森林 3 拼布小鎮 4 針織雪地 5 絲絨夜空 6 針線盒 */
export const STAGE_THEME = [0, 0, 3, 0, 1, 1, 2, 3, 6, 2, 2, 3, 3, 3, 4, 5, 5, 0, 1, 4, 1, 6, 5, 5, 6, 6, 5, 3, 4, 6];
