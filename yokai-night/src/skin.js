import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大妖怪)、game/stages.js(三十夜)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */

export const META = { store: 'yokainight.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 夜`,
  intro: (n, name) => [[`第 ${n} 夜`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['百鬼夜行!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '祭典之夜,妖怪不會攻擊,盡量全部打下來!',
  reinforce: [['妖怪又來了 !', 'red cjk']],
  goldEscaped: '招財貓溜走了…',
  nextBoss: (name) => [['又一個大妖怪!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['招財貓出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['妖氣逼近', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 夜 除妖成功 !`, 'yellow cjk big'],
  allClear: '三十夜全部平定!天下太平',
  promote: '位階提升 !',
  power: (w, max) => max ? '靈力 MAX' : `靈力 Lv.${w}`,
  rapid: '疾風',
  shield: '結界',
  oneUp: '糰子 1UP',
  wingman: '式神 白狐 !',
  dual: '式神合體',
  praise: [[5, '好!', 'cyan'], [10, '見事!', 'cyan'], [20, '天晴!', 'yellow'], [35, '一騎當千!', 'yellow'],
    [50, '百鬼退散!', 'red'], [75, '急急如律令!', 'red'], [100, '天下無雙!', 'red']],
  ach: {
    firstBoss: '除妖成功', combo10: '連擊 x10', combo50: '百鬼退散', evo5: '天文博士', evo10: '天照加護',
    power: '靈力全開', rescue: '式神召喚', noMiss5: '無傷 x5', perfect: '一網打盡',
    stage10: '第十夜', stage20: '第二十夜', stage30: '天下太平',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動擲符<br>另一指點一下 / <b>飛躍</b>鈕 = 飛躍閃避(每夜 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 擲符<br><b>X / SHIFT</b> 飛躍閃避(每夜 3 次) · <b>P</b> 暫停',
  crt: '和紙', // 畫面質感濾鏡按鈕的名字
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:往鏡頭方向飛躍
  gait: [6, 0.08],      // 陰陽師走路輕輕一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.45,         // 雙機:式神白狐在右邊多遠
  ally: 'ally',         // 雙機第二位 = 式神白狐
  // 唐傘妖單腳跳(跳得高)、提燈妖飄在半空慢慢上下、赤鬼小碎步
  hop: (e) => e.type === 'bee'
    ? Math.pow(Math.abs(Math.sin(e.flap * (e.state === 'form' ? 0.32 : 0.6))), 0.7) * (e.state === 'form' ? 0.28 : 0.5)
    : e.type === 'bfly' ? 0.35 + Math.sin(e.flap * 0.3) * 0.18
      : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.22,
  rockSpin: () => [0, 0], // 輪入道:車輪自己在轉('spin' 群組),整體不翻滾
};

// 浮世繪:彩度略低、偏暖(和紙色)、陰影偏藍紫;描線加粗(木版畫的墨線)
export const LOOK = {
  grade: { uLift: 0.04, uVignette: 0.28, uSaturation: 1.02, uWarmth: 0.07, uShadowTint: 0x7a7aa8 },
  ink: { uFadeStart: 220, uFadeEnd: 380, uSens: 0.0032, uThickness: 2.0 },
};
