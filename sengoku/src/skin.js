import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 站)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'sengoku.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 戰`,
  intro: (n, name) => [[`第 ${n} 戰`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['天下布武!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一戰是宴會,敵兵不會攻擊,盡量全部打下來!',
  reinforce: [['敵軍增援 !', 'red cjk']],
  goldEscaped: '千兩箱被搬走了…',
  nextBoss: (name) => [['又一位大名!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['千兩箱出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['敵將來襲', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 戰 大勝 !`, 'yellow cjk big'],
  allClear: '三十戰全勝!天下統一',
  promote: '官位提升 !',
  power: (w, max) => max ? '鐵砲 MAX' : `鐵砲 Lv.${w}`,
  rapid: '疾風',
  shield: '南蠻鎧',
  oneUp: '飯糰 1UP',
  wingman: '秀吉參上 !',
  dual: '主從合擊',
  praise: [[5, '好!', 'cyan'], [10, '見事!', 'cyan'], [20, '天晴!', 'yellow'], [35, '一騎當千!', 'yellow'],
    [50, '天下布武!', 'red'], [75, '第六天魔王!', 'red'], [100, '天下無雙!', 'red']],
  ach: {
    firstBoss: '首級一番', combo10: '連擊 x10', combo50: '一騎當千', evo5: '天下布武', evo10: '天下人',
    power: '鐵砲三段擊', rescue: '秀吉參上', noMiss5: '無傷 x5', perfect: '一網打盡',
    stage10: '第十戰', stage20: '第二十戰', stage30: '天下統一',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動開鐵砲<br>另一指點一下 / <b>一閃</b>鈕 = 閃身躲開(每戰 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 開鐵砲<br><b>X / SHIFT</b> 一閃閃避(每戰 3 次) · <b>P</b> 暫停',
  crt: '和紙', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:「一閃」往鏡頭方向跳起
  gait: [8, 0.1],       // 行軍一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.45,         // 雙機:秀吉在右邊多遠
  ally: 'ally',         // 雙機第二位 = 豐臣秀吉
  // 忍者飛身在半空、足輕和武將行軍小碎步
  hop: (e) => e.type === 'bfly'
    ? 0.5 + Math.sin(e.flap * 0.45) * 0.25
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.22,
  rockSpin: () => [rand(5, 9), 0], // 焙烙玉往前滾
};

// 戰國:彩度正常、偏暖、暗角重一點、描線粗一點
export const LOOK = {
  grade: { uLift: 0.03, uVignette: 0.3, uSaturation: 1.02, uWarmth: 0.06, uShadowTint: 0x9a90b0 },
  ink: { uFadeStart: 220, uFadeEnd: 380, uSens: 0.0036, uThickness: 1.8 },
};
