import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景 + 針織材質)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 段)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'yarnland.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 段`,
  intro: (n, name) => [[`第 ${n} 段`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['出發囉!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一段是遊戲時間,大家不會攻擊,盡量全部打下來!',
  reinforce: [['又來一群 !', 'red cjk']],
  goldEscaped: '金鈕扣滾走了…',
  nextBoss: (name) => [['還有一個!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['金鈕扣出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['大魔王來了', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 段 織好了!`, 'yellow cjk big'],
  allClear: '三十段全部織好!毛線世界和平了',
  promote: '變得更蓬鬆了 !',
  power: (w, max) => max ? '毛線球 MAX' : `毛線球 Lv.${w}`,
  rapid: '快快織',
  shield: '棉花護盾',
  oneUp: '甜甜圈 1UP',
  wingman: '泰迪熊來了 !',
  dual: '好朋友',
  praise: [[5, '好棒!', 'cyan'], [10, '厲害!', 'cyan'], [20, '好厲害!', 'yellow'], [35, '超級棒!', 'yellow'],
    [50, '織神!', 'red'], [75, '毛線大師!', 'red'], [100, '宇宙無敵!', 'red']],
  ach: {
    firstBoss: '第一個大魔王', combo10: '連擊 x10', combo50: '連擊 x50', evo5: '鈕扣小騎士', evo10: '毛線之王',
    power: '毛線球 MAX', rescue: '好朋友', noMiss5: '無傷 x5', perfect: '全部打下來',
    stage10: '第十段', stage20: '第二十段', stage30: '全部織好',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動丟毛線球<br>另一指點一下 / <b>跳</b>鈕 = 跳起來躲開(每段 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 丟毛線球<br><b>X / SHIFT</b> 跳起來閃避(每段 3 次) · <b>P</b> 暫停',
  crt: '布紋', // 畫面質感濾鏡按鈕的名字(布紋 + 縫線框)
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來(布偶軟軟的)
  dodge: 'hop',         // 閃避動作:「跳」往鏡頭方向跳起來
  gait: [8, 0.12],      // 走路一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.5,          // 雙機:泰迪熊在右邊多遠
  ally: 'ally',         // 雙機第二位 = 泰迪熊
  // 飛蛾飛在半空、襪子怪和剪刀螃蟹一跳一跳
  hop: (e) => e.type === 'bfly'
    ? 0.6 + Math.sin(e.flap * 0.45) * 0.3
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.1 : Math.abs(Math.sin(e.flap * 0.9)) * 0.24,
  rockSpin: () => [rand(5, 9), 0], // 大鈕扣像輪子一樣往前滾
};

/* ---------------- 畫風:毛線 / 布偶 ----------------
 * 材質疊上針織紋(palette.js TOON)。描線不是黑線,是「深一點的同色毛線」,而且毛毛的(一直微微抖)。
 * 最後一道 pass:整個畫面蓋上一層很淡的布紋、暖暖的柔光、四周一圈縫線框(虛線的針腳)。
 * 「布紋」鈕(uFilter)關掉布紋和縫線框。 */
const INK_HOOKS = {
  pre: /* glsl */ `
    vec2 fz = vec2( inkNoise( vUv * 220.0 ), inkNoise( vUv * 220.0 + 9.0 ) ) - 0.5;
    suv += fz * uTexel * 1.6;
    t *= 1.25;
  `,
  post: /* glsl */ `
    line = col * 0.45;                        // 深一點的同色毛線
    edge *= 0.8 + 0.2 * inkNoise( vUv * 400.0 );
  `,
};

const FABRIC = {
  uniforms: { uStitch: 0.03 },
  frag: /* glsl */ `
    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      vec2 px = vUv * uRes;
      // 很淡的布紋(經線 / 緯線交錯)
      float wx = sin( px.x * 1.4 ) * 0.5 + 0.5, wy = sin( px.y * 1.4 ) * 0.5 + 0.5;
      float weave = mix( wx, wy, step( 0.5, fract( floor( px.x / 4.5 ) * 0.5 + floor( px.y / 4.5 ) * 0.5 ) ) );
      c *= 1.0 - ( weave - 0.5 ) * 0.07 * uFilter;
      // 暖暖的柔光:亮的地方微微往外溢(毛茸茸)
      vec3 blur = ( texture2D( tDiffuse, vUv + uTexel * vec2( 3.0, 0.0 ) ).rgb + texture2D( tDiffuse, vUv - uTexel * vec2( 3.0, 0.0 ) ).rgb
                  + texture2D( tDiffuse, vUv + uTexel * vec2( 0.0, 3.0 ) ).rgb + texture2D( tDiffuse, vUv - uTexel * vec2( 0.0, 3.0 ) ).rgb ) * 0.25;
      c = max( c, mix( c, blur, 0.45 ) );
      // 四周一圈縫線框:布邊 + 虛線針腳
      vec2 asp = vec2( uRes.x / uRes.y, 1.0 );
      vec2 e = min( vUv, 1.0 - vUv ) * asp;
      float m = min( e.x, e.y );
      float along = ( e.x < e.y ? vUv.y : vUv.x * asp.x ) * uRes.y / 11.0;
      float dash = step( 0.45, fract( along ) );
      float stitch = ( 1.0 - smoothstep( 0.0015, 0.0035, abs( m - uStitch ) ) ) * dash;
      c = mix( c, c * 0.72, ( 1.0 - smoothstep( uStitch * 0.4, uStitch * 0.45, m ) ) * uFilter );
      c = mix( c, vec3( 1.0, 0.97, 0.92 ), stitch * uFilter );
      gl_FragColor = vec4( c, 1.0 );
    }
  `,
};

// 毛線世界:彩度高一點、陰影偏暖粉紫、不要暗角、描線稍粗
export const LOOK = {
  grade: { uLift: 0.05, uVignette: 0.0, uSaturation: 1.15, uWarmth: 0.05, uShadowTint: 0xd8b0c8 },
  ink: { uFadeStart: 260, uFadeEnd: 420, uSens: 0.004, uConcaveAmount: 0.3 },
  inkHooks: INK_HOOKS,
  style: FABRIC,
};
