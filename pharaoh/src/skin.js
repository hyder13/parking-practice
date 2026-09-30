import { GROUND_Z } from './game/models.js';

/* ------------------------------------------------------------------ *
 * 這款遊戲的「皮」:文字 / 手感 / 調色。共用引擎(arcade-core)從這裡拿。
 * 其他皮:core/palette.js(顏色 + 場景 + 壁畫平塗材質)、core/pixel.js(HUD 點陣圖)、core/audio.js(音效)、
 * game/models.js(角色造型)、game/sea.js(背景)、game/boss.js(大魔物)、game/stages.js(30 關)。
 * 訊息的格式:[[文字, 'CSS class'], ...](cyan / yellow / red / white + cjk / big / small / blink)
 * ------------------------------------------------------------------ */
const rand = (a, b) => a + Math.random() * (b - a);

export const META = { store: 'pharaoh.' }; // localStorage 前綴(每款分開存最佳紀錄)

export const TEXT = {
  stage: (n) => `第 ${n} 關`,
  intro: (n, name) => [[`第 ${n} 關`, 'cyan cjk'], [name, 'yellow cjk big']],
  first: [['太陽升起!', 'cyan cjk big'], ['PLAYER 1', 'white small']],
  challengeHint: '這一關是尼羅河慶典,對手不會攻擊,盡量全部打下來!',
  reinforce: [['援軍來了 !', 'red cjk']],
  goldEscaped: '黃金面具飛走了…',
  nextBoss: (name) => [['還有一個!', 'red blink cjk'], [name, 'white cjk big']],
  bossAppear: (name, gold) => gold ? [['黃金面具 !', 'yellow blink cjk'], [name, 'white cjk big']]
    : [['WARNING', 'red blink'], ['古老的守護者醒了', 'red cjk'], [name, 'white cjk big']],
  clear: (n) => [`第 ${n} 關 完`, 'yellow cjk big'],
  allClear: '三十關完 · 尼羅河恢復平靜',
  promote: '小法老晉升 !',
  power: (w, max) => max ? '太陽之力 MAX' : `太陽之力 Lv.${w}`,
  rapid: '疾風',
  shield: '護身符',
  oneUp: '椰棗 1UP',
  wingman: '聖貓來了 !',
  dual: '法老與聖貓',
  praise: [[5, '好!', 'cyan'], [10, '漂亮!', 'cyan'], [20, '勇敢!', 'yellow'], [35, '光榮!', 'yellow'],
    [50, '傳說!', 'red'], [75, '太陽普照!', 'red'], [100, '萬王之王!', 'red']],
  ach: {
    firstBoss: '第一個守護者', combo10: '連擊 x10', combo50: '連擊 x50', evo5: '上下埃及之王', evo10: '太陽之子',
    power: '太陽之力 MAX', rescue: '法老與聖貓', noMiss5: '無傷 x5', perfect: '全部打下來',
    stage10: '第十關', stage20: '第二十關', stage30: '三十關完',
  },
  hintTouch: '手指<b>拖曳</b>上下左右移動 · <b>按著</b>自動發射太陽光<br>另一指點一下 / <b>沙</b>鈕 = 捲起風沙閃避(每關 3 次)',
  hintKeys: '<b>方向鍵 / WASD</b> 移動 · <b>SPACE</b> 發射太陽光<br><b>X / SHIFT</b> 風沙閃避(每關 3 次) · <b>P</b> 暫停',
  crt: '壁畫', // 畫面質感濾鏡按鈕的名字(莎草紙紋 + 壁畫邊框)
};

export const FEEL = {
  popup: true,          // 立體書手感:到位 / 被打 Q 彈壓扁、道具彈出來
  dodge: 'hop',         // 閃避動作:「沙」捲起風沙往鏡頭方向跳
  gait: [7, 0.1],       // 走路一顛一顛:[頻率, 高度]
  groundZ: GROUND_Z,    // 地面在 z = -groundZ(影子貼在上面)
  dualDx: 1.5,          // 雙機:聖貓在右邊多遠
  ally: 'ally',         // 雙機第二位 = 聖貓
  // 聖甲蟲飛在半空、木乃伊搖搖晃晃地走、胡狼守衛小碎步
  hop: (e) => e.type === 'bfly'
    ? 0.6 + Math.sin(e.flap * 0.5) * 0.3
    : e.state === 'form' ? Math.abs(Math.sin(e.flap * 0.3)) * 0.08 : Math.abs(Math.sin(e.flap * 0.7)) * 0.2,
  rockSpin: () => [rand(5, 9), 0], // 石球往前滾
};

/* ---------------- 畫風:古埃及壁畫 ----------------
 * 描線 = 粗黑線,微微手抖(畫在牆上的筆觸)。材質 = 平塗(palette.js TOON)。
 * 最後一道 pass:顏色往礦物顏料靠(赭黃 / 赭紅 / 埃及藍 / 孔雀石綠 / 金 / 黑 / 米白)、
 * 疊上莎草紙一條條的纖維、四周一圈「藍紅綠金」重複的壁畫邊框。「壁畫」鈕(uFilter)關掉紙紋和邊框,顏料色保留。 */
const INK_HOOKS = {
  pre: /* glsl */ `
    t *= 1.45;
    suv += ( vec2( inkNoise( vUv * 40.0 ), inkNoise( vUv * 40.0 + 7.0 ) ) - 0.5 ) * uTexel * 1.4;
  `,
  post: /* glsl */ `
    line = vec3( 0.07, 0.055, 0.04 );
    edge = clamp( edge * 1.3, 0.0, 1.0 );
  `,
};

const MURAL = {
  uniforms: { uBorder: 0.024, uPigment: 0.5 },
  frag: /* glsl */ `
    vec3 pig( vec3 c ) {
      // 找最近的礦物顏料
      vec3 P[10];
      P[0] = vec3( 0.86, 0.66, 0.36 ); P[1] = vec3( 0.93, 0.83, 0.62 ); P[2] = vec3( 0.72, 0.28, 0.14 );
      P[3] = vec3( 0.16, 0.36, 0.72 ); P[4] = vec3( 0.18, 0.6, 0.55 ); P[5] = vec3( 0.93, 0.74, 0.2 );
      P[6] = vec3( 0.06, 0.05, 0.04 ); P[7] = vec3( 0.96, 0.93, 0.86 ); P[8] = vec3( 0.45, 0.3, 0.16 ); P[9] = vec3( 0.7, 0.5, 0.28 );
      vec3 best = P[0]; float bd = 9.0;
      for ( int i = 0; i < 10; i++ ) { vec3 d = c - P[i]; float e = dot( d, d ); if ( e < bd ) { bd = e; best = P[i]; } }
      return best;
    }
    vec3 band( float i ) {
      float k = mod( i, 4.0 );
      return k < 1.0 ? vec3( 0.16, 0.36, 0.72 ) : k < 2.0 ? vec3( 0.72, 0.28, 0.14 ) : k < 3.0 ? vec3( 0.18, 0.6, 0.55 ) : vec3( 0.93, 0.74, 0.2 );
    }
    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      // 往顏料色靠(保留一半原色,才不會整片變成色塊)
      c = mix( c, pig( c ) * ( 0.85 + 0.3 * dot( c, vec3( 0.333 ) ) ), uPigment );
      // 莎草紙:直的一條條纖維 + 橫的一層(紙莎草是兩層交叉壓起來的)
      vec2 px = vUv * uRes;
      float fib = noise( vec2( px.x * 0.05, px.y * 0.004 ) ) * 0.6 + noise( vec2( px.x * 0.004, px.y * 0.05 ) + 3.0 ) * 0.4;
      float grain = noise( px * 0.35 );
      c *= mix( 1.0, 0.9 + 0.14 * fib + 0.04 * grain, uFilter );
      c = mix( c, c * vec3( 1.03, 0.98, 0.9 ), 0.4 * uFilter );
      // 四周暗角(像油燈照著牆)
      vec2 d = vUv - 0.5;
      c *= 1.0 - dot( d, d ) * 0.45;
      // 壁畫邊框:外面一條黑線 + 藍紅綠金一格一格 + 米白 + 黑線
      vec2 asp = vec2( uRes.x / uRes.y, 1.0 );
      vec2 e = min( vUv, 1.0 - vUv ) * asp;
      float m = min( e.x, e.y );
      if ( m < uBorder && uFilter > 0.5 ) {
        float k = m / uBorder;
        float along = ( e.x < e.y ? vUv.y : vUv.x * asp.x ) / ( uBorder * 0.9 );
        vec3 bc = band( floor( along ) );
        float fa = fract( along );
        bc = mix( bc, vec3( 0.96, 0.93, 0.86 ), step( 0.78, fa ) );                         // 格子之間的米白
        bc = mix( bc, vec3( 0.06, 0.05, 0.04 ), step( abs( fa - 0.78 ), 0.04 ) );
        bc = k < 0.18 ? vec3( 0.06, 0.05, 0.04 ) : k > 0.86 ? ( k > 0.93 ? vec3( 0.06, 0.05, 0.04 ) : vec3( 0.93, 0.74, 0.2 ) ) : bc;
        c = bc * ( 0.92 + 0.12 * fib );
      }
      gl_FragColor = vec4( c, 1.0 );
    }
  `,
};

// 古埃及壁畫:暖、亮、彩度中等(礦物顏料不會太螢光)
export const LOOK = {
  grade: { uLift: 0.03, uVignette: 0.2, uSaturation: 1.05, uWarmth: 0.06, uShadowTint: 0xf0e0c8 },
  ink: { uFadeStart: 260, uFadeEnd: 420, uSens: 0.0034, uConcaveAmount: 0.8 },
  inkHooks: INK_HOOKS,
  style: MURAL,
};
