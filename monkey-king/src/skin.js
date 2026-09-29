/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 站)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'monkeyking.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 難`,
  intro: (n, name) => [[`第 ${n} 難`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['取經路上', 'cyan cjk'], ['PLAYER 1', 'white small']],
  challengeHint: '這一關妖怪不會攻擊,盡量全部打下來!',
  reinforce: [['妖兵增援 !', 'red cjk']],
  goldEscaped: '蟠桃飛走了…',
  nextBoss: (name) => [['又一個大妖!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['蟠桃出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['妖氣沖天', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 難 渡過 !`, 'yellow cjk big'],
  allClear: '三十難全部渡過!功德圓滿',
  promote: '修為提升 !',
  power: (w, max) => max ? '法力 MAX' : `法力 Lv.${w}`,
  rapid: '疾風',
  shield: '金光罩',
  oneUp: '蟠桃 1UP',
  wingman: '身外身 !',
  dual: '分身合體',
  praise: [[5, '好!', 'cyan'], [10, '妙哉!', 'cyan'], [20, '厲害!', 'yellow'], [35, '神通廣大!', 'yellow'],
    [50, '法力無邊!', 'red'], [75, '天下無敵!', 'red'], [100, '齊天大聖!', 'red']],
  ach: {
    firstBoss: '降妖除魔', combo10: '連擊 x10', combo50: '連擊宗師', evo5: '齊天大聖', evo10: '鬥戰勝佛',
    power: '法力無邊', rescue: '身外身法', noMiss5: '無傷 x5', perfect: '一網打盡',
    stage10: '渡過十難', stage20: '渡過二十難', stage30: '功德圓滿',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動發射<br>另一指點一下 / <b>筋斗</b>鈕 = 翻筋斗閃避(每關 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 發射<br><b>X / SHIFT</b> 翻筋斗閃避(每關 3 次) · <b>P</b> 暫停',
  crt: '宣紙', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: false,         // 雲上飛行:不做立體書的 Q 彈
  dodge: 'flip',        // 閃避動作:翻筋斗一圈
  gait: [0, 0],
  groundZ: 0,           // 沒有地面影子
  dualDx: 1.15,         // 分身:第二隻在右邊多遠
  ally: 'ship',         // 分身 = 跟自己一樣
  hop: (e) => Math.sin(e.flap * 0.35) * 0.12, // 飄浮
  rockSpin: () => [rand(-3, 3), rand(-3, 3)], // 妖火石滾著飛過來
};

// 水墨風:彩度壓低一點、偏暖(宣紙色)、暗角重一點;描線加粗,一路畫到遠方的仙山
export const LOOK = {
  grade: { uLift: 0.03, uVignette: 0.34, uSaturation: 1.0, uWarmth: 0.05, uShadowTint: 0xb8b0c8 },
  ink: { uFadeStart: 220, uFadeEnd: 380, uSens: 0.0036, uThickness: 1.7 },
};
