import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 站)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'animalbrawl.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 回合`,
  intro: (n, name) => [[`第 ${n} 回合`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['大亂鬥開始!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '休息時間,動物不會攻擊,盡量全部打下來!',
  reinforce: [['又來一群 !', 'red cjk']],
  goldEscaped: '黃金倉鼠溜走了…',
  nextBoss: (name) => [['下一隻猛獸!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['黃金倉鼠出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['猛獸出沒', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 回合 勝利 !`, 'yellow cjk big'],
  allClear: '三十回合全勝!動物之王',
  promote: '升級 !',
  power: (w, max) => max ? '骨頭 MAX' : `骨頭 Lv.${w}`,
  rapid: '快腿',
  shield: '保護泡泡',
  oneUp: '大雞腿 1UP',
  wingman: '貓咪助陣 !',
  dual: '汪喵合體',
  praise: [[5, '汪!', 'cyan'], [10, '讚喔!', 'cyan'], [20, '好厲害!', 'yellow'], [35, '勢不可擋!', 'yellow'],
    [50, '猛獸級!', 'red'], [75, '叢林霸主!', 'red'], [100, '動物之王!', 'red']],
  ach: {
    firstBoss: '打倒猛獸', combo10: '連擊 x10', combo50: '大亂鬥', evo5: '超級柴', evo10: '傳說神柴',
    power: '骨頭全開', rescue: '貓咪助陣', noMiss5: '無傷 x5', perfect: '全部收服',
    stage10: '第十回合', stage20: '第二十回合', stage30: '動物之王',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動丟骨頭<br>另一指點一下 / <b>翻滾</b>鈕 = 翻滾閃避(每回合 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 丟骨頭<br><b>X / SHIFT</b> 翻滾閃避(每回合 3 次) · <b>P</b> 暫停',
  crt: '紙紋', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:往鏡頭方向跳起來翻滾
  gait: [10, 0.12],     // 小柴犬小跑步一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.45,         // 雙機:貓咪在右邊多遠
  ally: 'ally',         // 雙機第二位 = 三花貓
  // 兔子一蹦一蹦跳得高、鸚鵡飛在半空、野豬小碎步
  hop: (e) => e.type === 'bee'
    ? Math.pow(Math.abs(Math.sin(e.flap * (e.state === 'form' ? 0.32 : 0.6))), 0.6) * (e.state === 'form' ? 0.35 : 0.6)
    : e.type === 'bfly' ? 0.45 + Math.sin(e.flap * 0.4) * 0.15
      : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 1.1)) * 0.2,
  rockSpin: () => [rand(5, 9), 0], // 刺蝟球往前滾
};

// 卡通:明亮飽和、暗角輕、陰影偏藍紫
export const LOOK = {
  grade: { uLift: 0.03, uVignette: 0.22, uSaturation: 1.12, uWarmth: 0.04, uShadowTint: 0xa8a8d0 },
  ink: { uFadeStart: 220, uFadeEnd: 380, uSens: 0.0036, uThickness: 1.6 },
};
