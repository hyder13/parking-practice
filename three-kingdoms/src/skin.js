import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 站)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'sanguo.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 回`,
  intro: (n, name) => [[`第 ${n} 回`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['出陣!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一回敵軍不會攻擊,盡量全部打下來!',
  reinforce: [['敵軍增援 !', 'red cjk']],
  goldEscaped: '草船順流而去…',
  nextBoss: (name) => [['又一員大將!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['草船出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['敵將來襲', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 回 大捷 !`, 'yellow cjk big'],
  allClear: '三十回全部完成!天下歸一',
  promote: '升官 !',
  power: (w, max) => max ? '武力 MAX' : `武力 Lv.${w}`,
  rapid: '神速',
  shield: '藤甲',
  oneUp: '包子 1UP',
  wingman: '援軍 關羽 !',
  dual: '雙將合擊',
  praise: [[5, '好!', 'cyan'], [10, '勇猛!', 'cyan'], [20, '萬夫莫敵!', 'yellow'], [35, '一騎當千!', 'yellow'],
    [50, '威震天下!', 'red'], [75, '常勝不敗!', 'red'], [100, '天下無雙!', 'red']],
  ach: {
    firstBoss: '斬將奪旗', combo10: '連斬 x10', combo50: '一騎當千', evo5: '官拜校尉', evo10: '常勝將軍',
    power: '武力全開', rescue: '援軍到來', noMiss5: '無傷 x5', perfect: '滿載而歸',
    stage10: '第十回', stage20: '第二十回', stage30: '三分歸一',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動出槍<br>另一指點一下 / <b>躍馬</b>鈕 = 躍馬閃避(每回 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 出槍<br><b>X / SHIFT</b> 躍馬閃避(每回 3 次) · <b>P</b> 暫停',
  crt: '宣紙', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:'hop' 往鏡頭跳起(的盧躍檀溪)/ 'flip' 翻筋斗一圈
  gait: [9, 0.12],      // 馬蹄一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.45,         // 雙將:第二位在右邊多遠
  ally: 'ally',         // 雙將第二位 = 援軍關羽
  // 走路 / 跑步的上下彈跳(移動中比較大)
  hop: (e) => e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.22,
  rockSpin: () => [rand(-3, 3), rand(-3, 3)], // 巨石滾著飛過來
};

// 立體繪本:色彩柔和偏暖、暗角輕一點;描線粗一點(紙藝人偶的輪廓)
export const LOOK = {
  grade: { uLift: 0.03, uVignette: 0.26, uSaturation: 1.05, uWarmth: 0.05, uShadowTint: 0xb8b0c8 },
  ink: { uFadeStart: 220, uFadeEnd: 380, uSens: 0.0036, uThickness: 1.6 },
};
