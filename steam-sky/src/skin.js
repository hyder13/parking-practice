import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景 + 黃銅材質)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 段航程)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'steamsky.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 航段`,
  intro: (n, name) => [[`第 ${n} 航段`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['全速起飛!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一段是飛行競速,對手不會攻擊,盡量全部打下來!',
  reinforce: [['援軍來了 !', 'red cjk']],
  goldEscaped: '懷錶飛走了…',
  nextBoss: (name) => [['還有一個!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['黃金懷錶 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['巨大機械接近', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 航段 完`, 'yellow cjk big'],
  allClear: '三十航段完 · 天空恢復晴朗',
  promote: '飛行員晉升 !',
  power: (w, max) => max ? '火力 MAX' : `火力 Lv.${w}`,
  rapid: '連發',
  shield: '護盾',
  oneUp: '紅茶 1UP',
  wingman: '機械貓頭鷹來了 !',
  dual: '雙人飛行',
  praise: [[5, '好!', 'cyan'], [10, '漂亮!', 'cyan'], [20, '全速!', 'yellow'], [35, '過熱!', 'yellow'],
    [50, '傳說!', 'red'], [75, '蒸汽爆發!', 'red'], [100, '天空之王!', 'red']],
  ach: {
    firstBoss: '第一台巨大機械', combo10: '連擊 x10', combo50: '連擊 x50', evo5: '王牌飛行員', evo10: '天空之王',
    power: '火力 MAX', rescue: '雙人飛行', noMiss5: '無傷 x5', perfect: '全部打下來',
    stage10: '第十航段', stage20: '第二十航段', stage30: '三十航段完',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動發射鉚釘<br>另一指點一下 / <b>噴</b>鈕 = 蒸汽噴射閃避(每段 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 發射鉚釘<br><b>X / SHIFT</b> 蒸汽噴射閃避(每段 3 次) · <b>P</b> 暫停',
  crt: '蒸汽', // 畫面質感濾鏡按鈕的名字(蒸汽 + 黃銅框)
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:「噴」蒸汽噴射往鏡頭方向跳
  gait: [8, 0.1],       // 走路一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.5,          // 雙機:貓頭鷹在右邊多遠
  ally: 'ally',         // 雙機第二位 = 機械貓頭鷹
  // 發條蜻蜓飛在半空、發條兵和蒸汽機器人一步一步走
  hop: (e) => e.type === 'bfly'
    ? 0.7 + Math.sin(e.flap * 0.5) * 0.3
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.18,
  rockSpin: () => [rand(5, 9), 0], // 齒輪往前滾
};

/* ---------------- 畫風:蒸汽龐克 ----------------
 * 描線 = 深棕色、稍粗(像銅版畫的墨線)。材質 = 會反光的黃銅(palette.js TOON)。
 * 最後一道 pass:整體偏琥珀色 + 亮部微微泛光、一團團蒸汽慢慢飄過、四周一圈黃銅框 + 鉚釘。
 * 「蒸汽」鈕(uFilter)關掉蒸汽和黃銅框,琥珀色保留。 */
const INK_HOOKS = {
  pre: 't *= 1.25;',
  post: /* glsl */ `
    line = vec3( 0.13, 0.08, 0.045 );
  `,
};

const STEAM = {
  uniforms: { uBorder: 0.02 },
  frag: /* glsl */ `
    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      // 琥珀色調:暗部偏深棕、亮部偏奶油黃,彩度收一點
      float l = dot( c, vec3( 0.299, 0.587, 0.114 ) );
      vec3 amber = mix( vec3( 0.16, 0.09, 0.04 ), vec3( 1.0, 0.9, 0.7 ), l );
      c = mix( c, amber * ( 0.55 + 0.6 * c ), 0.22 );
      // 泛光:亮的金屬微微往外亮
      vec3 b = vec3( 0.0 );
      for ( int i = 0; i < 6; i++ ) { float a = float( i ) * 1.0472; b += texture2D( tDiffuse, vUv + vec2( cos( a ), sin( a ) ) * uTexel * 5.0 ).rgb; }
      c += max( b / 6.0 - 0.62, 0.0 ) * vec3( 0.7, 0.55, 0.3 );
      // 蒸汽:一團團往下飄(畫面上方比較濃)
      vec2 asp = vec2( uRes.x / uRes.y, 1.0 );
      vec2 sp = vUv * asp * 2.2 + vec2( uTime * 0.03, uTime * 0.09 );
      float st = noise( sp ) * 0.6 + noise( sp * 2.3 + 4.0 ) * 0.4;
      st = smoothstep( 0.55, 0.85, st ) * ( 0.35 + 0.65 * smoothstep( 0.3, 1.0, vUv.y ) );
      c = mix( c, vec3( 0.95, 0.92, 0.86 ), st * 0.3 * uFilter );
      // 四周暗角
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot( d, d ) * 0.5;
      // 黃銅框 + 鉚釘
      vec2 e = min( vUv, 1.0 - vUv ) * asp;
      float m = min( e.x, e.y );
      if ( m < uBorder && uFilter > 0.5 ) {
        float k = m / uBorder;
        vec3 brass = mix( vec3( 0.42, 0.26, 0.08 ), vec3( 0.95, 0.75, 0.38 ), 0.5 + 0.5 * sin( k * 3.1416 ) );
        brass *= 0.85 + 0.15 * noise( vUv * uRes * 0.15 );
        float along = ( e.x < e.y ? vUv.y : vUv.x * asp.x ) / ( uBorder * 3.0 );
        vec2 rv = vec2( fract( along ) - 0.5, ( k - 0.5 ) * 0.33 );
        float r = length( rv );
        brass = mix( brass, vec3( 0.25, 0.14, 0.05 ), smoothstep( 0.14, 0.1, r ) );             // 鉚釘的影子
        brass = mix( brass, vec3( 1.0, 0.88, 0.55 ), smoothstep( 0.11, 0.07, length( rv + vec2( 0.02, -0.02 ) ) ) ); // 鉚釘
        brass = mix( brass, vec3( 0.12, 0.07, 0.03 ), smoothstep( 0.9, 1.0, k ) );              // 內側的暗邊
        c = brass;
      }
      gl_FragColor = vec4( c, 1.0 );
    }
  `,
};

// 蒸汽龐克:暖色、暗部偏棕、對比稍強
export const LOOK = {
  grade: { uLift: 0.02, uVignette: 0.25, uSaturation: 1.08, uWarmth: 0.1, uShadowTint: 0xe8d8c0 },
  ink: { uFadeStart: 260, uFadeEnd: 420, uSens: 0.0034, uConcaveAmount: 0.8 },
  inkHooks: INK_HOOKS,
  style: STEAM,
};
