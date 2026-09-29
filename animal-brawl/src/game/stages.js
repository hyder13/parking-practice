import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 動物大亂鬥三十回合:名字 / 陣型 / 機制 / 進場軌跡 / 關底猛獸 + 每回合場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 回合的第 3 回合(3, 8, 13, 18, 23, 28)是獎勵關,最後是不會攻擊的黃金倉鼠。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['lion', 'croc', 'gorilla'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '陣中的動物會瞄準你丟橡實',
  meteors: '小心滾過來的刺蝟球',
  meteors2: '刺蝟球滿地滾!',
  escort: '野豬會帶著兔子一起衝',
  kamikaze: '鸚鵡會高速俯衝,但不丟橡實',
  beam: '野豬會停在你前方連丟橡實,而且更耐打',
  swarm: '動物又快又多',
  armored: '動物戴上了頭盔,要打兩下',
  zigzag: '衝過來時會左右亂竄',
  barrage: '整排動物一起往下丟',
};

export const STAGE_TABLE = [
  S('出發!', 'grid', [], ['top', 'side']),                                                                      // 1
  S('大草原', 'arch', [], ['topLoop', 'diag', 'diag']),                                                          // 2
  C('追蝴蝶', 0),                                                                                                  // 3
  S('兔子窩', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                        // 4
  S('香蕉林', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral'], ['gorilla']),                           // 5
  S('鱷魚河', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag'], ['croc']),                  // 6
  S('鸚鵡俯衝', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                              // 7
  C('撿骨頭', 1),                                                                                                  // 8
  S('獅子領地', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn'], ['lion']),                // 9
  S('雙王對決', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['lion', 'croc']),                      // 10
  S('動物大遷徙', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['gorilla']),            // 11
  S('鐵甲野豬', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                       // 12
  C('泥巴浴', 2),                                                                                                  // 13
  S('沙漠綠洲', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig'], ['lion']),     // 14
  S('刺蝟之谷', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                 // 15
  S('冰原', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn'], ['gorilla']),             // 16
  S('野豬狂奔', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                           // 17
  C('海灘排球', 3),                                                                                                // 18
  S('暴風雨', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                        // 19
  S('叢林之王', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['croc', 'gorilla']), // 20
  S('泥沼', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig'], ['croc']),                  // 21
  S('月夜草原', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag'], ['lion']),         // 22
  C('森林野餐', 4),                                                                                                // 23
  S('大亂鬥', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                   // 24
  S('猛獸谷', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig'], ['gorilla']),           // 25
  S('刺蝟雨', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),              // 26
  S('百獸圍攻', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),         // 27
  C('慶功宴', 5),                                                                                                  // 28
  S('最終決戰', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                 // 29
  S('動物之王', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['lion', 'croc', 'gorilla']), // 30
];
/** 每一回合的場景(palette.js THEMES):0 草原 1 叢林 2 農場 3 冰原 4 沙漠 5 森林 6 海灘 */
export const STAGE_THEME = [2, 0, 5, 2, 1, 1, 0, 2, 0, 0, 0, 5, 6, 4, 5, 3, 0, 6, 1, 1, 5, 0, 5, 4, 3, 4, 1, 6, 3, 0];
