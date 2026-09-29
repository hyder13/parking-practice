import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(招牌料理)、game/stages.js(三十攤)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'nightmarket.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 攤`,
  intro: (n, name) => [[`第 ${n} 攤`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['開吃!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '夜市遊戲時間,小吃不會攻擊,盡量全部打下來!',
  reinforce: [['又來一批 !', 'red cjk']],
  goldEscaped: '棉花糖飄走了…',
  nextBoss: (name) => [['下一道招牌!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['棉花糖出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['招牌料理來了', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 攤 吃光光 !`, 'yellow cjk big'],
  allClear: '三十攤全部吃完!夜市之王',
  promote: '吃貨升級 !',
  power: (w, max) => max ? '加料 MAX' : `加料 Lv.${w}`,
  rapid: '手速',
  shield: '保溫袋',
  oneUp: '雞蛋糕 1UP',
  wingman: '外送員到 !',
  dual: '雙人開吃',
  praise: [[5, '讚!', 'cyan'], [10, '好吃!', 'cyan'], [20, '夠味!', 'yellow'], [35, '呷飽未?', 'yellow'],
    [50, '吃貨魂!', 'red'], [75, '大胃王!', 'red'], [100, '神級吃貨!', 'red']],
  ach: {
    firstBoss: '招牌拿下', combo10: '連吃 x10', combo50: '吃到飽', evo5: '大廚', evo10: '夜市之王',
    power: '全部加料', rescue: '外送到', noMiss5: '無傷 x5', perfect: '一掃而空',
    stage10: '第十攤', stage20: '第二十攤', stage30: '吃遍夜市',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動發射珍珠<br>另一指點一下 / <b>借過</b>鈕 = 跳起來閃避(每攤 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 發射珍珠<br><b>X / SHIFT</b> 借過閃避(每攤 3 次) · <b>P</b> 暫停',
  crt: '紙紋', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:「借過!」往鏡頭方向跳起來
  gait: [8, 0.1],       // 小吃貨走路一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.45,         // 雙人:外送員在右邊多遠
  ally: 'ally',         // 雙人第二位 = 外送員
  // 臭豆腐一蹦一蹦跳、雞排在半空飄、刈包小碎步
  hop: (e) => e.type === 'bee'
    ? Math.pow(Math.abs(Math.sin(e.flap * (e.state === 'form' ? 0.3 : 0.55))), 0.6) * (e.state === 'form' ? 0.28 : 0.5)
    : e.type === 'bfly' ? 0.4 + Math.sin(e.flap * 0.35) * 0.2
      : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.22,
  rockSpin: () => [0, rand(4, 8) * (Math.random() < 0.5 ? -1 : 1)], // 貢丸串沿著竹籤轉
};

// 夜市:霓虹燈下彩度高一點、暗角重一點、陰影偏紫
export const LOOK = {
  grade: { uLift: 0.03, uVignette: 0.3, uSaturation: 1.15, uWarmth: 0.04, uShadowTint: 0x9a7ab8 },
  ink: { uFadeStart: 220, uFadeEnd: 380, uSens: 0.0036, uThickness: 1.6 },
};
