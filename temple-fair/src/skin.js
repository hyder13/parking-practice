import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 站)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'templefair.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 站`,
  intro: (n, name) => [[`第 ${n} 站`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['起駕!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一站鬼怪不會攻擊,盡量全部打下來!',
  reinforce: [['鬼怪又來了 !', 'red cjk']],
  goldEscaped: '紅包飛走了…',
  nextBoss: (name) => [['又一個大魔頭!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['大紅包出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['邪氣來襲', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 站 平安 !`, 'yellow cjk big'],
  allClear: '三十站全部走完!遶境圓滿',
  promote: '升格 !',
  power: (w, max) => max ? '神力 MAX' : `神力 Lv.${w}`,
  rapid: '疾速',
  shield: '平安符',
  oneUp: '紅龜粿 1UP',
  wingman: '七爺助陣 !',
  dual: '神將合體',
  praise: [[5, '讚!', 'cyan'], [10, '水喔!', 'cyan'], [20, '猛!', 'yellow'], [35, '強強滾!', 'yellow'],
    [50, '神威顯赫!', 'red'], [75, '鬧熱滾滾!', 'red'], [100, '神明加持!', 'red']],
  ach: {
    firstBoss: '驅邪成功', combo10: '連擊 x10', combo50: '鬧熱滾滾', evo5: '升格將軍', evo10: '神威太子',
    power: '神力全開', rescue: '七爺助陣', noMiss5: '平安 x5', perfect: '紅包滿滿',
    stage10: '第十站', stage20: '第二十站', stage30: '遶境圓滿',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動丟乾坤圈<br>另一指點一下 / <b>風火輪</b>鈕 = 衝刺閃避(每站 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 丟乾坤圈<br><b>X / SHIFT</b> 風火輪閃避(每站 3 次) · <b>P</b> 暫停',
  crt: '宣紙', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:'hop' 往鏡頭跳起 / 'flip' 翻筋斗一圈
  gait: [7, 0.1],       // 走路一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.45,         // 雙機:第二位在右邊多遠
  ally: 'ally',         // 雙機第二位的模型前綴('ship' = 跟自己一樣)
  // 殭屍一跳一跳(跳得高、落地乾脆),其他鬼怪小碎步
  hop: (e) => e.type === 'bfly'
    ? Math.pow(Math.abs(Math.sin(e.flap * (e.state === 'form' ? 0.3 : 0.55))), 0.6) * (e.state === 'form' ? 0.3 : 0.55)
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.22,
  rockSpin: () => [0, 0], // 鬼火:火尾巴朝後、不打轉
};

// 立體繪本:色彩柔和偏暖、暗角輕一點;描線粗一點(紙藝人偶的輪廓)
export const LOOK = {
  grade: { uLift: 0.03, uVignette: 0.26, uSaturation: 1.05, uWarmth: 0.05, uShadowTint: 0xb8b0c8 },
  ink: { uFadeStart: 220, uFadeEnd: 380, uSens: 0.0036, uThickness: 1.6 },
};
