import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 天下布武三十戰:名字 / 陣型 / 機制 / 進場軌跡 / 關底大名 + 每一戰的戰場。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 戰的第 3 戰(3, 8, 13, 18, 23, 28)是獎勵關(宴會),最後是不會攻擊的千兩箱。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['takeda', 'uesugi', 'akechi'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '陣中的足輕會瞄準你丟手裏劍',
  meteors: '小心滾過來的焙烙玉',
  meteors2: '焙烙玉滿地滾!',
  escort: '武將會帶著足輕一起衝鋒',
  kamikaze: '忍者會高速撲過來,但不丟手裏劍',
  beam: '武將會停在你前方連發,而且更耐打',
  swarm: '敵軍又快又多',
  armored: '敵兵穿上鐵甲,要打兩下',
  zigzag: '衝鋒時會左右迂迴',
  barrage: '整排敵軍一起齊射',
};

export const STAGE_TABLE = [
  S('尾張統一', 'grid', [], ['top', 'side']),                                                                    // 1
  S('桶狹間', 'arch', [], ['topLoop', 'diag', 'diag']),                                                          // 2
  C('賞櫻宴', 0),                                                                                                  // 3
  S('稻葉山城', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                     // 4
  S('金崎撤退', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['akechi']),                         // 5
  S('姊川之戰', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['uesugi']),              // 6
  S('伊賀忍者', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('茶之湯', 1),                                                                                                  // 8
  S('甲斐之虎', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['takeda']),              // 9
  S('龍虎相爭', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['takeda', 'uesugi']),                  // 10
  S('長島一揆', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['akechi']),               // 11
  S('鐵甲船', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                         // 12
  C('相撲大會', 2),                                                                                                // 13
  S('長篠之戰', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['takeda']),   // 14
  S('三段擊', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                   // 15
  S('比叡山', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['akechi']),            // 16
  S('越後之龍', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                           // 17
  C('南蠻貿易', 3),                                                                                                // 18
  S('手取川', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                        // 19
  S('天王山', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['uesugi', 'akechi']),  // 20
  S('石山本願寺', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['uesugi']),          // 21
  S('雜賀眾', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['takeda']),         // 22
  C('安土祭', 4),                                                                                                  // 23
  S('甲州征伐', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                 // 24
  S('本能寺前夜', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['akechi']),        // 25
  S('火之海', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),              // 26
  S('敵在本能寺', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),       // 27
  C('天下茶會', 5),                                                                                                // 28
  S('天下統一', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                 // 29
  S('天下人', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['takeda', 'uesugi', 'akechi']), // 30
];
/** 每一戰的戰場(palette.js THEMES):0 尾張 1 桶狹間 2 長篠 3 川中島 4 安土城 5 比叡山 6 本能寺 */
export const STAGE_THEME = [0, 1, 0, 4, 0, 3, 1, 4, 2, 3, 1, 3, 0, 2, 2, 5, 3, 4, 3, 4, 5, 2, 4, 2, 6, 5, 6, 4, 4, 6];
