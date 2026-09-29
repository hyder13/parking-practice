import { S, C } from '@arcade/engine/stage-dsl.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的 30 關:名字 / 陣型 / 機制 / 進場軌跡 / 關底 BOSS + 每關場景。
 * 欄位說明與數值難度在 arcade-core/engine/field.js(所有換皮共用)。
 * 每 5 關的第 3 關(3, 8, 13, 18, 23, 28)是獎勵關,最後是不會攻擊的金蟠桃。
 * ------------------------------------------------------------------ */
export const BOSS_KINDS = ['bull', 'bone', 'horn'];

/** 關卡機制的提示文字(開場顯示一次;機制本身在 field.js TWISTS) */
export const TWIST_HINTS = {
  snipers: '編隊中的妖怪會瞄準你開火',
  meteors: '小心滾過來的妖火石',
  meteors2: '妖火石雨!',
  escort: '天兵會帶著護衛一起俯衝',
  kamikaze: '妖怪會高速衝撞,但不開火',
  beam: '天兵會停在你上方連擲長槍,而且更耐打',
  swarm: '妖怪又快又多',
  armored: '妖怪披上鐵甲,要打兩下',
  zigzag: '俯衝時會左右蛇行',
  barrage: '編隊會整排往下齊射',
};

export const STAGE_TABLE = [
  S('花果山', 'grid', [], ['top', 'side']),                                                                    // 1
  S('水簾洞', 'arch', [], ['topLoop', 'diag', 'diag']),                                                        // 2
  C('蟠桃園', 0),                                                                                               // 3
  S('天兵天將', 'v', ['snipers'], ['top', 'sideHigh', 'sideHigh', 'diag']),                                     // 4
  S('火雲洞', 'grid', ['meteors'], ['dropIn', 'side', 'side', 'spiral']),                                       // 5
  S('黑風山', 'arch', ['escort'], ['topLoop', 'loopBig', 'loopBig', 'diag', 'diag']),                           // 6
  S('群魔亂舞', 'wave', ['kamikaze'], ['zig', 'side', 'side', 'spiral', 'spiral']),                            // 7
  C('人參果園', 1),                                                                                             // 8
  S('天羅地網', 'peak', ['beam'], ['top', 'sideHigh', 'sideHigh', 'dropIn', 'dropIn']),                         // 9
  S('平頂山', 'grid', [], ['topLoop', 'diag', 'diag', 'spiral', 'zig'], ['horn', 'bone']),                      // 10
  S('盤絲洞', 'wave', ['swarm'], ['zig', 'loopBig', 'loopBig', 'spiral', 'spiral']),                            // 11
  S('金兜山', 'v', ['armored'], ['top', 'side', 'side', 'diag', 'diag']),                                       // 12
  C('瑤池', 2),                                                                                                 // 13
  S('火焰山', 'arch', ['meteors', 'snipers'], ['dropIn', 'sideHigh', 'sideHigh', 'zig', 'zig']),                // 14
  S('流沙河', 'wave', ['zigzag'], ['zig', 'diag', 'diag', 'spiral', 'spiral']),                                 // 15
  S('通天河', 'grid', ['barrage'], ['topLoop', 'loopBig', 'loopBig', 'dropIn', 'dropIn']),                      // 16
  S('獅駝嶺', 'v', ['kamikaze', 'escort'], ['top', 'side', 'side', 'spiral', 'zig']),                           // 17
  C('蓬萊仙島', 3),                                                                                             // 18
  S('無底洞', 'peak', ['beam', 'swarm'], ['zig', 'sideHigh', 'sideHigh', 'diag', 'diag']),                      // 19
  S('小雷音寺', 'arch', ['snipers'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['bone', 'bull']),  // 20
  S('車遲國', 'wave', ['armored', 'meteors'], ['dropIn', 'side', 'side', 'zig', 'zig']),                        // 21
  S('比丘國', 'v', ['snipers', 'zigzag'], ['top', 'sideHigh', 'sideHigh', 'spiral', 'diag']),                   // 22
  C('廣寒宮', 4),                                                                                               // 23
  S('黃風嶺', 'grid', ['barrage', 'swarm'], ['zig', 'loopBig', 'loopBig', 'dropIn', 'spiral']),                 // 24
  S('寶象國', 'arch', ['kamikaze', 'armored'], ['topLoop', 'diag', 'diag', 'zig', 'zig']),                      // 25
  S('翠雲山', 'wave', ['meteors2', 'beam'], ['dropIn', 'sideHigh', 'sideHigh', 'spiral', 'spiral']),            // 26
  S('真假美猴王', 'peak', ['snipers', 'zigzag', 'escort'], ['zig', 'loopBig', 'loopBig', 'diag', 'diag']),      // 27
  C('天竺', 5),                                                                                                 // 28
  S('凌雲渡', 'v', ['barrage', 'armored', 'swarm'], ['top', 'side', 'side', 'spiral', 'zig']),                  // 29
  S('大雷音寺', 'grid', ['snipers', 'zigzag', 'meteors'], ['topLoop', 'loopBig', 'loopBig', 'spiral', 'spiral'], ['bull', 'bone', 'horn']), // 30
];
/** 每一關的場景(palette.js THEMES):0 花果山 1 天宮 2 水墨 3 火焰山 4 流沙河 5 雪山 6 盤絲洞 */
export const STAGE_THEME = [0, 0, 1, 1, 3, 2, 6, 0, 1, 2, 6, 5, 1, 3, 4, 4, 2, 0, 6, 1, 5, 2, 6, 4, 5, 3, 2, 1, 4, 1];
