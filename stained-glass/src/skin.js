import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景 + 玻璃材質)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 章)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'stainedglass.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 章`,
  intro: (n, name) => [[`第 ${n} 章`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['為了王國!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一章是騎士比武,對手不會攻擊,盡量全部打下來!',
  reinforce: [['援軍來了 !', 'red cjk']],
  goldEscaped: '聖杯飛走了…',
  nextBoss: (name) => [['還有一個!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['聖杯出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['魔物來襲', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 章 完`, 'yellow cjk big'],
  allClear: '三十章完 · 王國和平了',
  promote: '騎士晉升 !',
  power: (w, max) => max ? '聖光 MAX' : `聖光 Lv.${w}`,
  rapid: '疾光',
  shield: '聖盾',
  oneUp: '蘋果派 1UP',
  wingman: '獨角獸來了 !',
  dual: '騎士與獨角獸',
  praise: [[5, '好!', 'cyan'], [10, '漂亮!', 'cyan'], [20, '英勇!', 'yellow'], [35, '光榮!', 'yellow'],
    [50, '傳說!', 'red'], [75, '聖光普照!', 'red'], [100, '王者之劍!', 'red']],
  ach: {
    firstBoss: '第一隻魔物', combo10: '連擊 x10', combo50: '連擊 x50', evo5: '聖騎士', evo10: '聖光王者',
    power: '聖光 MAX', rescue: '騎士與獨角獸', noMiss5: '無傷 x5', perfect: '全部打下來',
    stage10: '第十章', stage20: '第二十章', stage30: '三十章完',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動發射聖光<br>另一指點一下 / <b>盾</b>鈕 = 舉盾躍起閃避(每章 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 發射聖光<br><b>X / SHIFT</b> 舉盾閃避(每章 3 次) · <b>P</b> 暫停',
  crt: '光束', // 畫面質感濾鏡按鈕的名字(光束 + 玻璃邊框)
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:「盾」舉盾往鏡頭方向躍起
  gait: [8, 0.1],       // 走路一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.5,          // 雙機:獨角獸在右邊多遠
  ally: 'ally',         // 雙機第二位 = 獨角獸
  // 蝙蝠飛在半空、哥布林和黑騎士小碎步
  hop: (e) => e.type === 'bfly'
    ? 0.6 + Math.sin(e.flap * 0.5) * 0.3
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.35)) * 0.08 : Math.abs(Math.sin(e.flap * 0.9)) * 0.2,
  rockSpin: () => [rand(5, 9), 0], // 火球往前滾
};

/* ---------------- 畫風:彩繪玻璃 ----------------
 * 描線 = 粗粗的黑色鉛條(加粗、純黑)。材質 = 透光玻璃(palette.js TOON)。
 * 最後一道 pass:亮的玻璃往外透出光暈、斜斜的一道道光束慢慢移動、
 * 四周一圈彩色小玻璃的窗框(鉛條隔開)。「光束」鈕(uFilter)關掉光束和窗框,光暈保留。 */
const INK_HOOKS = {
  pre: 't *= 1.7;',
  post: /* glsl */ `
    line = vec3( 0.06, 0.055, 0.07 );
    edge = clamp( edge * 1.4, 0.0, 1.0 );
  `,
};

const GLASS = {
  uniforms: { uBorder: 0.035 },
  frag: /* glsl */ `
    vec3 tile( float i ) {
      float k = mod( i, 5.0 );
      return k < 1.0 ? vec3( 0.85, 0.12, 0.2 ) : k < 2.0 ? vec3( 0.95, 0.75, 0.2 ) : k < 3.0 ? vec3( 0.15, 0.35, 0.85 ) : k < 4.0 ? vec3( 0.2, 0.7, 0.35 ) : vec3( 0.55, 0.25, 0.8 );
    }
    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      // 光暈:亮的地方透出光(簡單的 8 點模糊,只加亮不加暗)
      vec3 b = vec3( 0.0 );
      for ( int i = 0; i < 8; i++ ) {
        float a = float( i ) * 0.7854;
        b += texture2D( tDiffuse, vUv + vec2( cos( a ), sin( a ) ) * uTexel * 7.0 ).rgb;
      }
      b /= 8.0;
      c += max( b - 0.55, 0.0 ) * 0.6;
      // 光束:斜斜的幾道光,慢慢飄移
      float ray = sin( ( vUv.x * 1.2 + vUv.y * 0.6 ) * 9.0 + uTime * 0.25 ) * 0.5 + 0.5;
      ray *= sin( ( vUv.x * 1.2 + vUv.y * 0.6 ) * 3.7 - uTime * 0.13 ) * 0.5 + 0.5;
      c += vec3( 1.0, 0.95, 0.8 ) * pow( ray, 3.0 ) * 0.1 * uFilter;
      // 窗框:四周一圈彩色小玻璃 + 鉛條
      vec2 asp = vec2( uRes.x / uRes.y, 1.0 );
      vec2 e = min( vUv, 1.0 - vUv ) * asp;
      float m = min( e.x, e.y );
      if ( m < uBorder && uFilter > 0.5 ) {
        float along = ( e.x < e.y ? vUv.y : vUv.x * asp.x ) / uBorder;
        float id = floor( along ) + ( e.x < e.y ? ( vUv.x < 0.5 ? 0.0 : 3.0 ) : ( vUv.y < 0.5 ? 1.0 : 2.0 ) );
        vec3 tc = tile( id ) * ( 0.75 + 0.35 * ( 1.0 - abs( fract( along ) - 0.5 ) * 2.0 ) );
        float lead = max( 1.0 - smoothstep( 0.0, 0.08, abs( fract( along ) ) ), 1.0 - smoothstep( 0.0, 0.08, abs( 1.0 - fract( along ) ) ) );
        lead = max( lead, 1.0 - smoothstep( 0.0, uBorder * 0.12, abs( m - uBorder ) ) );
        lead = max( lead, 1.0 - smoothstep( 0.0, uBorder * 0.1, m ) );
        c = mix( tc, vec3( 0.05, 0.05, 0.07 ), lead );
      }
      gl_FragColor = vec4( c, 1.0 );
    }
  `,
};

// 彩繪玻璃:彩度高、暗面不偏紫、四周稍暗、描線很粗
export const LOOK = {
  grade: { uLift: 0.02, uVignette: 0.25, uSaturation: 1.25, uWarmth: 0.03, uShadowTint: 0xe0d8f0 },
  ink: { uFadeStart: 260, uFadeEnd: 420, uSens: 0.0034, uConcaveAmount: 0.8 },
  inkHooks: INK_HOOKS,
  style: GLASS,
};
