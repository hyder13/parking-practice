import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景 + 網點材質)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 話)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const META = { store: 'comichero.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 話`,
  intro: (n, name) => [[`第 ${n} 話`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['正義出動!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一話是訓練,敵人不會攻擊,盡量全部打下來!',
  reinforce: [['援軍來了 !', 'red cjk']],
  goldEscaped: '運鈔車開走了…',
  nextBoss: (name) => [['還有一個!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['運鈔車出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['大魔頭現身', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 話 完`, 'yellow cjk big'],
  allClear: '城市和平了!全三十話完',
  promote: '英雄升級 !',
  power: (w, max) => max ? '能量 MAX' : `能量 Lv.${w}`,
  rapid: '超音速',
  shield: '力場護盾',
  oneUp: '漢堡 1UP',
  wingman: '超級狗狗來了 !',
  dual: '英雄搭檔',
  praise: [[5, 'NICE!', 'cyan'], [10, 'GREAT!', 'cyan'], [20, 'AMAZING!', 'yellow'], [35, 'SUPER!', 'yellow'],
    [50, 'HEROIC!', 'red'], [75, 'LEGENDARY!', 'red'], [100, 'UNSTOPPABLE!', 'red']],
  ach: {
    firstBoss: '第一個大魔頭', combo10: '連擊 x10', combo50: '連擊 x50', evo5: '超級英雄', evo10: '究極英雄',
    power: '能量 MAX', rescue: '英雄搭檔', noMiss5: '無傷 x5', perfect: '一網打盡',
    stage10: '第十話', stage20: '第二十話', stage30: '全三十話',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動發射能量<br>另一指點一下 / <b>飛</b>鈕 = 飛起來躲開(每話 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 發射能量<br><b>X / SHIFT</b> 飛起來閃避(每話 3 次) · <b>P</b> 暫停',
  crt: '印刷感', // 畫面質感濾鏡按鈕的名字(新聞紙 + 套色偏移)
};

const BOOM_BIG = ['KABOOM!', 'BOOM!', 'KRAKOOM!'];
const BOOM_HIT = ['POW!', 'BAM!', 'ZAP!', 'WHAM!', 'SMASH!', 'BIFF!', 'KRAK!', 'THWACK!'];
let lastBoom = 0;

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:「飛」往鏡頭方向飛起來
  gait: [8, 0.1],       // 跑步一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.45,         // 雙機:超級狗狗在右邊多遠
  ally: 'ally',         // 雙機第二位 = 超級狗狗
  // 噴射背包打手飛在半空、機器人和打手小碎步
  hop: (e) => e.type === 'bfly'
    ? 0.6 + Math.sin(e.flap * 0.45) * 0.25
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.2,
  rockSpin: () => [rand(5, 9), 0], // 油桶往前滾
  /** 爆炸跳出狀聲詞(漫畫的 POW!):大爆炸一定有,打死敵人有一半機率,最多每 0.18 秒一個 */
  boomWord(o) {
    const now = performance.now();
    if (o.big) { lastBoom = now; return [pick(BOOM_BIG), 'boom big']; }
    if ((o.n || 0) >= 16 && now - lastBoom > 180 && Math.random() < 0.55) { lastBoom = now; return [pick(BOOM_HIT), 'boom']; }
    return null;
  },
};

/* ---------------- 畫風:彩色漫畫的印刷 ----------------
 * 陰影 = 網點(palette.js TOON)、描線很粗。最後一道 pass:
 *   新聞紙的泛黃 + 紙纖維、套色偏移(紅 / 藍版各歪一點點)、畫面外圍一圈漫畫格的粗黑框。
 *   「印刷感」鈕(uFilter)關掉紙張和套色偏移,網點和黑框保留。 */
const PRINT = {
  uniforms: { uFrame: 0.012 },
  frag: /* glsl */ `
    void main() {
      vec2 off = uTexel * vec2( 1.6, -1.0 ) * uFilter;
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      vec3 mis = vec3( texture2D( tDiffuse, vUv + off ).r, c.g, texture2D( tDiffuse, vUv - off ).b );
      c = mix( c, mis, 0.85 );
      // 新聞紙:偏黃的白 + 細纖維(只影響亮的地方,黑線還是黑)
      float fib = noise( vUv * uRes * vec2( 0.35, 0.08 ) ) * 0.5 + noise( vUv * uRes * 0.9 ) * 0.5;
      vec3 paper = vec3( 1.0, 0.965, 0.88 ) * ( 0.95 + fib * 0.07 );
      c *= mix( vec3( 1.0 ), paper, uFilter );
      // 漫畫格的黑框(外面一圈白邊)
      vec2 e = min( vUv, 1.0 - vUv ) * vec2( uRes.x / uRes.y, 1.0 );
      float m = min( e.x, e.y );
      c = mix( c, vec3( 0.06, 0.06, 0.09 ), 1.0 - smoothstep( uFrame * 0.55, uFrame * 0.6, m ) );
      c = mix( c, vec3( 0.99, 0.97, 0.92 ), 1.0 - smoothstep( uFrame * 0.25, uFrame * 0.28, m ) );
      gl_FragColor = vec4( c, 1.0 );
    }
  `,
};

// 美漫:彩度拉高、陰影不偏紫(網點會處理)、描線很粗、不淡出
export const LOOK = {
  grade: { uLift: 0.0, uVignette: 0.0, uSaturation: 1.3, uWarmth: 0.0, uShadowTint: 0xffffff, uLightTint: 0xffffff },
  ink: { uFadeStart: 260, uFadeEnd: 420, uSens: 0.0032, uConcaveAmount: 0.75 },
  inkHooks: { pre: 't *= 1.45;' },
  style: PRINT,
};
