import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔頭)、game/stages.js(30 集)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'cartoon1930.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 集`,
  intro: (n, name) => [[`第 ${n} 集`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['開麥拉!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一集是舞會,大家只跳舞不攻擊,盡量全部打下來!',
  reinforce: [['又來一群 !', 'red cjk']],
  goldEscaped: '錢袋先生溜走了…',
  nextBoss: (name) => [['還有一位!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['錢袋先生出現 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['大反派登場', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 集 完!`, 'yellow cjk big'],
  allClear: 'THE END · 全劇終',
  promote: '升咖 !',
  power: (w, max) => max ? '喇叭 MAX' : `喇叭 Lv.${w}`,
  rapid: '快板',
  shield: '泡泡糖',
  oneUp: '熱狗 1UP',
  wingman: '小鋼琴來了 !',
  dual: '二重奏',
  praise: [[5, '好耶!', 'cyan'], [10, '太棒啦!', 'cyan'], [20, '哇嗚!', 'yellow'], [35, '精彩!', 'yellow'],
    [50, '安可!', 'red'], [75, '全場起立!', 'red'], [100, '卡通之王!', 'red']],
  ach: {
    firstBoss: '第一位反派', combo10: '連擊 x10', combo50: '連擊 x50', evo5: '男主角', evo10: '卡通之王',
    power: '喇叭 MAX', rescue: '二重奏', noMiss5: '無傷 x5', perfect: '全部打下來',
    stage10: '第十集', stage20: '第二十集', stage30: '全劇終',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動吹喇叭<br>另一指點一下 / <b>蹦</b>鈕 = 彈起來躲開(每集 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 吹喇叭<br><b>X / SHIFT</b> 蹦!彈起來閃避(每集 3 次) · <b>P</b> 暫停',
  crt: '老膠卷', // 畫面質感濾鏡按鈕的名字(雜訊 / 刮痕 / 閃爍)
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來(橡皮管卡通本來就一直在彈)
  dodge: 'hop',         // 閃避動作:「蹦」往鏡頭方向彈起來
  gait: [9, 0.14],      // 走路一顛一顛:[頻率, 高度](跟著爵士樂的拍子)
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.5,          // 雙機:小鋼琴在右邊多遠
  ally: 'ally',         // 雙機第二位 = 會走路的小鋼琴
  // 幽靈飄在半空、花和骷髏跟著拍子一蹦一蹦
  hop: (e) => e.type === 'bfly'
    ? 0.6 + Math.sin(e.flap * 0.4) * 0.3
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.4)) * 0.16 : Math.abs(Math.sin(e.flap * 0.9)) * 0.3,
  rockSpin: () => [rand(5, 9), 0], // 炸彈往前滾
};

/* ---------------- 畫風:黑白老卡通 ----------------
 * 描線:加粗 + 「線條抖動」(每 1/12 秒換一次取樣偏移,像手繪動畫一格一格重描的線)。
 * 最後一道 pass:轉黑白(微微泛黃)、拉高對比、放映機的暗角 + 圓角片框、
 * 老膠卷濾鏡(可關):顆粒、閃爍、垂直刮痕、灰塵斑點、片子上下晃動。 */
const INK_HOOKS = {
  pre: /* glsl */ `
    float fr = floor( uTime * 12.0 );
    vec2 jit = vec2( inkNoise( vUv * 90.0 + fr * 7.31 ), inkNoise( vUv * 90.0 + fr * 3.17 + 11.0 ) ) - 0.5;
    suv += jit * uTexel * 2.2;
    t *= 0.85 + inkNoise( vUv * 40.0 + fr * 1.7 ) * 0.5;
  `,
};

const FILM = {
  uniforms: { uGrainAmt: 0.13, uVig: 0.62 },
  frag: /* glsl */ `
    void main() {
      float fr = floor( uTime * 16.0 );                         // 底片格數(16 fps 的老放映機)
      vec2 uv = vUv;
      // 片子在片門裡上下微微晃
      uv.y += ( hash( vec2( fr, 1.3 ) ) - 0.5 ) * 0.0035 * uFilter;
      uv.x += ( hash( vec2( fr, 7.9 ) ) - 0.5 ) * 0.0012 * uFilter;
      vec3 c = texture2D( tDiffuse, uv ).rgb;
      float l = dot( c, vec3( 0.299, 0.587, 0.114 ) );
      // 對比:黑更黑、白更白(當年的正片)
      l = smoothstep( 0.04, 0.96, l );
      l = pow( l, 0.95 );
      // 閃爍
      l *= 1.0 + ( hash( vec2( fr, 3.1 ) ) - 0.5 ) * 0.09 * uFilter;
      // 顆粒(每格換一次)
      vec2 px = floor( vUv * uRes / 1.5 );
      l += ( hash( px + fr * 17.0 ) - 0.5 ) * uGrainAmt * uFilter;
      // 垂直刮痕:每格 0 ~ 2 條,時有時無
      for ( int i = 0; i < 2; i++ ) {
        float fi = float( i );
        float on = step( 0.55, hash( vec2( floor( uTime * 5.0 + fi * 0.5 ), fi + 4.0 ) ) );
        float sx = hash( vec2( floor( uTime * 5.0 + fi * 0.5 ), fi + 9.0 ) );
        sx += sin( uTime * 3.0 + fi ) * 0.004;
        float d = abs( vUv.x - sx ) * uRes.x;
        float seg = step( 0.25, noise( vec2( fi * 13.0, vUv.y * 6.0 + fr ) ) );
        l = mix( l, fi < 0.5 ? 0.92 : 0.12, ( 1.0 - smoothstep( 0.6, 1.6, d ) ) * on * seg * 0.6 * uFilter );
      }
      // 灰塵 / 毛髮斑點:格子裡偶爾一顆黑點或白點
      vec2 cell = floor( vUv * vec2( 26.0, 26.0 * uRes.y / uRes.x ) );
      float hd = hash( cell + fr * 31.0 );
      if ( hd > 0.9965 ) {
        vec2 f = fract( vUv * vec2( 26.0, 26.0 * uRes.y / uRes.x ) ) - 0.5;
        float r = length( f * vec2( 1.0, 0.8 ) );
        float blob = 1.0 - smoothstep( 0.05, 0.12 + hash( cell ) * 0.12, r );
        l = mix( l, hash( cell + 3.0 ) > 0.5 ? 0.05 : 0.95, blob * 0.85 * uFilter );
      }
      // 放映機的暗角 + 圓角片框
      vec2 q = vUv - 0.5;
      float r = length( q * vec2( 1.0, uRes.y / uRes.x * 0.55 + 0.45 ) ) * 1.35;
      l *= 1.0 - uVig * pow( clamp( r, 0.0, 1.0 ), 2.4 );
      vec2 e = abs( q ) * 2.0;
      vec2 k = max( e - vec2( 0.965, 0.98 ), 0.0 ) / vec2( 0.035, 0.02 );
      l *= 1.0 - smoothstep( 0.7, 1.0, length( k ) );
      // 微微泛黃的黑白(不是純灰)
      vec3 col = mix( vec3( 0.07, 0.065, 0.06 ), vec3( 1.0, 0.975, 0.92 ), clamp( l, 0.0, 1.0 ) );
      gl_FragColor = vec4( col, 1.0 );
    }
  `,
};

// 黑白老卡通:先照常調色(去掉彩度、陰影不要偏紫),描線粗、不淡出,再交給底片 pass
export const LOOK = {
  grade: { uLift: 0.02, uVignette: 0.0, uSaturation: 0.0, uWarmth: 0.0, uShadowTint: 0xb4b0a8, uLightTint: 0xffffff },
  ink: { uFadeStart: 260, uFadeEnd: 420, uSens: 0.0034, uThickness: 2.1, uConcaveAmount: 0.6 },
  inkHooks: INK_HOOKS,
  style: FILM,
};
