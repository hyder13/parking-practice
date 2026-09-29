import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 回)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'inkwuxia.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 回`,
  intro: (n, name) => [[`第 ${n} 回`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['仗劍江湖!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一回是比武切磋,對手不會出招,盡量全部打下來!',
  reinforce: [['援兵到 !', 'red cjk']],
  goldEscaped: '秘笈飛走了…',
  nextBoss: (name) => [['又一位高手!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['武功秘笈現世 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['強敵現身', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 回 勝`, 'yellow cjk big'],
  allClear: '三十回全勝 · 武林盟主',
  promote: '功力大增 !',
  power: (w, max) => max ? '劍氣 MAX' : `劍氣 Lv.${w}`,
  rapid: '快劍',
  shield: '金鐘罩',
  oneUp: '包子 1UP',
  wingman: '仙鶴來助 !',
  dual: '人鶴合一',
  praise: [[5, '好!', 'cyan'], [10, '妙!', 'cyan'], [20, '好劍法!', 'yellow'], [35, '出神入化!', 'yellow'],
    [50, '以一敵百!', 'red'], [75, '天下無敵!', 'red'], [100, '劍聖!', 'red']],
  ach: {
    firstBoss: '首戰告捷', combo10: '連擊 x10', combo50: '以一敵百', evo5: '名門弟子', evo10: '武林盟主',
    power: '劍氣 MAX', rescue: '人鶴合一', noMiss5: '無傷 x5', perfect: '一網打盡',
    stage10: '第十回', stage20: '第二十回', stage30: '三十回全勝',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動發出劍氣<br>另一指點一下 / <b>輕功</b>鈕 = 躍起閃避(每回 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 發出劍氣<br><b>X / SHIFT</b> 輕功閃避(每回 3 次) · <b>P</b> 暫停',
  crt: '宣紙', // 畫面質感濾鏡按鈕的名字(紙紋 + 墨暈)
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:「輕功」往鏡頭方向躍起
  gait: [8, 0.1],       // 走路一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.5,          // 雙機:仙鶴在右邊多遠
  ally: 'ally',         // 雙機第二位 = 仙鶴
  // 飛賊用輕功飄在半空、山賊和鐵頭陀小碎步
  hop: (e) => e.type === 'bfly'
    ? 0.7 + Math.sin(e.flap * 0.4) * 0.3
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.22,
  rockSpin: () => [rand(5, 9), 0], // 酒罈往前滾
};

/* ---------------- 畫風:水墨 ----------------
 * 描線:毛筆 —— 粗細沿著畫面忽粗忽細(提按),偶爾斷開(飛白)。
 * 最後一道 pass:整個畫面換成墨色(焦 / 濃 / 淡 / 清的幾層,邊緣柔柔地暈開)+ 宣紙底色 + 紙紋、
 * 朱紅保留(印章、紅繩、飛鏢)、其他顏色只留一點點淡彩。「宣紙」鈕(uFilter)關掉紙紋和墨暈。 */
const INK_HOOKS = {
  pre: /* glsl */ `
    float brush = inkNoise( vUv * vec2( 26.0, 34.0 ) ) * 0.7 + inkNoise( vUv * 90.0 ) * 0.3;
    t *= 0.55 + brush * 1.5;
  `,
  post: /* glsl */ `
    // 飛白:墨不夠的地方線條斷斷續續
    float dry = inkNoise( vUv / uTexel * vec2( 0.09, 0.03 ) );
    edge *= 0.35 + 0.65 * smoothstep( 0.18, 0.42, dry );
    line = vec3( 0.06, 0.06, 0.065 );
  `,
};

const INK = {
  uniforms: { uRedKeep: 1.0, uTint: 0.14 },
  frag: /* glsl */ `
    void main() {
      // 墨暈:取樣位置跟著紙的纖維微微歪,邊緣不會是死板的直線
      vec2 px = vUv * uRes;
      vec2 wv = vec2( noise( px * 0.035 ), noise( px * 0.035 + 17.0 ) ) - 0.5;
      vec2 uv = vUv + wv * uTexel * 3.5 * uFilter;
      vec3 c = texture2D( tDiffuse, uv ).rgb;
      float l = dot( c, vec3( 0.299, 0.587, 0.114 ) );
      // 墨分五色:把亮度收成幾層(柔邊),再保留一點原本的漸層
      float L = l * 4.0;
      float Lq = ( floor( L ) + smoothstep( 0.35, 0.65, fract( L ) ) ) / 4.0;
      float v = mix( l, Lq, 0.65 );
      // 中間調的墨有顆粒(宣紙吸墨不均)
      float gran = noise( px * 0.6 ) * 0.6 + noise( px * 0.18 ) * 0.4;
      v += ( gran - 0.5 ) * 0.14 * ( 1.0 - abs( v * 2.0 - 1.0 ) ) * uFilter;
      // 宣紙:暖白 + 纖維
      float fib = noise( px * vec2( 0.25, 0.04 ) ) * 0.5 + noise( px * vec2( 0.05, 0.3 ) ) * 0.5;
      vec3 paper = vec3( 0.955, 0.925, 0.86 ) * ( 1.0 - fib * 0.05 * uFilter );
      vec3 ink = vec3( 0.07, 0.07, 0.075 );
      vec3 col = mix( ink, paper, clamp( v, 0.0, 1.0 ) );
      // 淡彩:其他顏色只留一點點
      vec3 hue = c / max( l, 0.04 );
      col *= mix( vec3( 1.0 ), clamp( hue, 0.6, 1.4 ), uTint );
      // 朱紅:紅色的東西保留成朱砂色(印泥的紅)
      float red = smoothstep( 0.12, 0.3, c.r - max( c.g, c.b ) ) * uRedKeep;
      vec3 zhu = vec3( 0.78, 0.17, 0.12 ) * ( 0.75 + 0.35 * l );
      col = mix( col, zhu, red );
      // 四邊像畫卷一樣微微泛黃變暗
      vec2 q = vUv - 0.5;
      col *= 1.0 - 0.18 * pow( clamp( length( q * vec2( 1.0, uRes.y / uRes.x * 0.5 + 0.5 ) ) * 1.4, 0.0, 1.0 ), 3.0 );
      gl_FragColor = vec4( col, 1.0 );
    }
  `,
};

// 水墨:先照常調色(彩度保留,朱紅要靠它判斷),描線用毛筆 hook,最後交給水墨 pass
export const LOOK = {
  grade: { uLift: 0.0, uVignette: 0.0, uSaturation: 1.1, uWarmth: 0.0, uShadowTint: 0xd8d8d8, uLightTint: 0xffffff },
  ink: { uFadeStart: 260, uFadeEnd: 420, uSens: 0.0034, uConcaveAmount: 0.55 },
  inkHooks: INK_HOOKS,
  style: INK,
};
