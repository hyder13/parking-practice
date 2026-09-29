/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 站)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'skyaces.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `MISSION ${n}`,
  intro: (n, name) => [[`MISSION ${n}`, 'cyan'], [name, 'yellow']],
  first: [['PLAYER 1', 'cyan']],
  challengeHint: '敵機不會攻擊,盡量全部打下來!',
  reinforce: [['REINFORCEMENTS !', 'red']],
  goldEscaped: 'GOLD TRANSPORT ESCAPED',
  nextBoss: (name) => [['NEXT BOSS', 'red blink'], [name, 'white']],
  bossAppear: (name, gold) => gold ? [['BONUS TARGET !', 'yellow blink'], [name, 'white']] : [['WARNING', 'red blink'], [name, 'white']],
  clear: (n) => [`MISSION ${n} COMPLETE !`, 'yellow'],
  allClear: 'ALL 30 MISSIONS COMPLETE !',
  promote: 'PROMOTED !',
  power: (w, max) => max ? 'POWER MAX' : `POWER Lv.${w}`,
  rapid: 'RAPID',
  shield: 'SHIELD',
  oneUp: '1UP',
  wingman: 'WINGMAN !',
  dual: 'DOUBLE FORMATION',
  praise: [[5, 'NICE!', 'cyan'], [10, 'GREAT!', 'cyan'], [20, 'EXCELLENT!', 'yellow'], [35, 'AMAZING!', 'yellow'],
    [50, 'UNSTOPPABLE!', 'red'], [75, 'LEGENDARY!', 'red'], [100, 'GODLIKE!', 'red']],
  ach: {
    firstBoss: 'GIANT KILLER', combo10: 'COMBO x10', combo50: 'COMBO MASTER', evo5: 'CAPTAIN RANK', evo10: 'LEGEND ACE',
    power: 'MAX POWER', rescue: 'WINGMAN', noMiss5: 'NO MISS x5', perfect: 'PERFECT BONUS',
    stage10: 'MISSION 10', stage20: 'MISSION 20', stage30: 'ALL 30 MISSIONS',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動連射<br>另一指點一下 / <b>LOOP</b> 鈕 = 翻筋斗閃避(每關 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 射擊<br><b>X / SHIFT</b> 翻筋斗閃避(每關 3 次) · <b>P</b> 暫停',
  crt: 'CRT', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: false,         // 空戰:不做立體書的 Q 彈
  dodge: 'flip',        // 閃避動作:翻筋斗一圈(1942 的招牌)
  gait: [0, 0],
  groundZ: 0,           // 沒有地面影子
  dualDx: 1.15,         // 雙機:僚機在右邊多遠
  ally: 'ship',         // 僚機 = 同型機
  hop: (e) => Math.sin(e.flap * 0.35) * 0.12, // 飛行中的浮動
  rockSpin: () => [0, rand(4, 8) * (Math.random() < 0.5 ? -1 : 1)], // 火箭只繞自己的長軸旋轉
};

// 白天的海:保留一點暗部提亮,描線一路畫到海面上的島嶼 / 軍艦(海面本身是平面,不會被描)
export const LOOK = {
  grade: { uLift: 0.02, uVignette: 0.28, uSaturation: 1.1, uWarmth: 0.03, uShadowTint: 0xb4c0e6 },
  ink: { uFadeStart: 200, uFadeEnd: 360, uSens: 0.004 },
};
