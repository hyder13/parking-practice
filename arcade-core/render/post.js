// Adapted from Kenton-GMI/sakura-crossing (MIT) src/core/post.js
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { PAL } from '@skin/core/palette.js';

/* ------------------------------------------------------------------ *
 * The 3D-to-2D pipeline.
 *
 *   scene  ->  rtScene (colour + depth texture)
 *          ->  ink pass      : screen-space line work from the depth buffer
 *          ->  grade pass    : anime colour grade + linear->sRGB
 *          ->  fxaa pass     : clean up the line work, straight to screen
 *
 * Lines come from a *second difference* of linearised depth.  A first
 * difference would smear ink across the road wherever the surface is
 * grazing the camera; the second difference is flat across any planar
 * surface no matter how oblique, so it only fires on real silhouettes and
 * real creases.  Positive curvature (the near side of a silhouette, a
 * convex ridge) inks strongly; negative curvature (inside corners) inks
 * faintly, which mimics the lighter contact lines an animator draws.
 * ------------------------------------------------------------------ */

const INK_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.25 },
    uFar: { value: 600 },
    uInk: { value: new THREE.Color(PAL.ink) },
    uThickness: { value: 1.35 },
    uSens: { value: 0.0042 },
    uConcave: { value: 0.026 },
    uConcaveAmount: { value: 0.42 },
    uFadeStart: { value: 40.0 },
    uFadeEnd: { value: 98.0 },
    uStrength: { value: 1.0 },
    uSkyDepth: { value: 420.0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4( position.xy, 0.0, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uNear, uFar;
    uniform vec3 uInk;
    uniform float uThickness, uSens, uConcave, uConcaveAmount;
    uniform float uFadeStart, uFadeEnd, uStrength, uSkyDepth, uTime;
    varying vec2 vUv;
    float inkHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
    float inkNoise( vec2 p ) {
      vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
      return mix( mix( inkHash( i ), inkHash( i + vec2( 1, 0 ) ), f.x ), mix( inkHash( i + vec2( 0, 1 ) ), inkHash( i + vec2( 1, 1 ) ), f.x ), f.y );
    }
    /*@INK_FNS@*/

    float linearDepth( vec2 uv ) {
      float d = texture2D( tDepth, uv ).x;
      return -perspectiveDepthToViewZ( d, uNear, uFar );
    }

    void main() {
      vec3 col = texture2D( tDiffuse, vUv ).rgb;

      vec2 t = uTexel * uThickness;
      vec2 suv = vUv;
      /*@INK_PRE@*/
      float dc = linearDepth( suv );

      if ( dc > uSkyDepth ) {
        // pure sky: nothing to ink
        gl_FragColor = vec4( col, 1.0 );
        return;
      }

      float dl = linearDepth( suv - vec2( t.x, 0.0 ) );
      float dr = linearDepth( suv + vec2( t.x, 0.0 ) );
      float du = linearDepth( suv + vec2( 0.0, t.y ) );
      float dd = linearDepth( suv - vec2( 0.0, t.y ) );

      // second difference of linear depth, normalised by distance
      float sx = ( dl + dr - 2.0 * dc ) / dc;
      float sy = ( du + dd - 2.0 * dc ) / dc;

      float convex  = max( 0.0,  sx ) + max( 0.0,  sy );
      float concave = max( 0.0, -sx ) + max( 0.0, -sy );

      float edge = smoothstep( uSens * 0.32, uSens, convex );
      edge = max( edge, smoothstep( uConcave, uConcave * 3.4, concave ) * uConcaveAmount );

      // let the background dissolve into the haze instead of getting busy
      edge *= 1.0 - smoothstep( uFadeStart, uFadeEnd, dc );
      edge *= uStrength;

      // ink keeps a whisper of the underlying hue so it never looks pasted on
      vec3 line = mix( uInk, col * 0.42, 0.22 );
      /*@INK_POST@*/
      gl_FragColor = vec4( mix( col, line, clamp( edge, 0.0, 1.0 ) ), 1.0 );
    }
  `,
};

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uShadowTint: { value: new THREE.Color(0xada8d0) },
    uLightTint: { value: new THREE.Color(0xfff7e8) },
    uSaturation: { value: 1.12 },
    uLift: { value: 0.032 },
    uVignette: { value: 0.15 },
    uWarmth: { value: 0.05 },
  },
  vertexShader: INK_SHADER.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uShadowTint, uLightTint;
    uniform float uSaturation, uLift, uVignette, uWarmth;
    varying vec2 vUv;

    vec3 linearToSRGB( vec3 c ) {
      return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0031308 ) ), vec3( 1.0 / 2.4 ) ) - 0.055,
                  step( 0.0031308, c ) );
    }

    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb;
      float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );

      // split-tone: cool violet in the darks, warm paper white in the lights
      float k = smoothstep( 0.02, 0.55, l );
      c *= mix( uShadowTint, uLightTint, k );

      // gentle overall warmth, like late afternoon light through blossom
      c += vec3( uWarmth, uWarmth * 0.45, 0.0 ) * l * 0.35;

      // keep shadows readable -- never crushed to black
      c = c + uLift * ( 1.0 - k );

      c = mix( vec3( l ), c, uSaturation );

      float r = length( vUv - 0.5 ) * 1.42;
      c *= 1.0 - uVignette * pow( clamp( r, 0.0, 1.0 ), 2.6 );

      gl_FragColor = vec4( linearToSRGB( max( c, vec3( 0.0 ) ) ), 1.0 );
    }
  `,
};

const FXAA_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2() },
  },
  vertexShader: INK_SHADER.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    varying vec2 vUv;

    float luma( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }

    void main() {
      vec3 cM = texture2D( tDiffuse, vUv ).rgb;
      vec3 cNW = texture2D( tDiffuse, vUv + vec2( -uTexel.x, -uTexel.y ) ).rgb;
      vec3 cNE = texture2D( tDiffuse, vUv + vec2(  uTexel.x, -uTexel.y ) ).rgb;
      vec3 cSW = texture2D( tDiffuse, vUv + vec2( -uTexel.x,  uTexel.y ) ).rgb;
      vec3 cSE = texture2D( tDiffuse, vUv + vec2(  uTexel.x,  uTexel.y ) ).rgb;

      float lM = luma( cM ), lNW = luma( cNW ), lNE = luma( cNE ),
            lSW = luma( cSW ), lSE = luma( cSE );
      float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) );
      float lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );

      vec2 dir = vec2(
        -( ( lNW + lNE ) - ( lSW + lSE ) ),
         ( ( lNW + lSW ) - ( lNE + lSE ) )
      );
      float reduce = max( ( lNW + lNE + lSW + lSE ) * 0.25 * 0.18, 1.0 / 128.0 );
      float rcp = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + reduce );
      dir = clamp( dir * rcp, vec2( -8.0 ), vec2( 8.0 ) ) * uTexel;

      vec3 rgbA = 0.5 * (
        texture2D( tDiffuse, vUv + dir * ( 1.0 / 3.0 - 0.5 ) ).rgb +
        texture2D( tDiffuse, vUv + dir * ( 2.0 / 3.0 - 0.5 ) ).rgb );
      vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture2D( tDiffuse, vUv - dir * 0.5 ).rgb +
        texture2D( tDiffuse, vUv + dir * 0.5 ).rgb );

      float lB = luma( rgbB );
      gl_FragColor = vec4( ( lB < lMin || lB > lMax ) ? rgbA : rgbB, 1.0 );
    }
  `,
};

/**
 * 各款自己的「畫風」pass(skin.js LOOK.style):在調色 + FXAA 之後、上螢幕之前跑一次全螢幕 shader。
 *   LOOK.style = { uniforms: { 名字: 值 }, frag: 'GLSL,要寫 void main()' }
 * 內建可用:tDiffuse(已調色的 sRGB 畫面)、tDepth、uTexel、uRes(像素大小)、uTime(秒)、
 * uFilter(標題畫面「濾鏡」鈕:1 開 / 0 關)、linearDepth(uv)、hash / noise(vec2)。
 */
const STYLE_HEAD = /* glsl */ `
  #include <packing>
  uniform sampler2D tDiffuse;
  uniform sampler2D tDepth;
  uniform vec2 uTexel, uRes;
  uniform float uTime, uFilter, uNear, uFar;
  varying vec2 vUv;
  float linearDepth( vec2 uv ) { return -perspectiveDepthToViewZ( texture2D( tDepth, uv ).x, uNear, uFar ); }
  float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float noise( vec2 p ) {
    vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y );
  }
`;
function styleShader(style) {
  const uniforms = {
    tDiffuse: { value: null }, tDepth: { value: null },
    uTexel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2() },
    uTime: { value: 0 }, uFilter: { value: 1 }, uNear: { value: 0.25 }, uFar: { value: 600 },
  };
  const decl = [];
  for (const [k, v] of Object.entries(style.uniforms || {})) {
    const isColor = typeof v === 'object' && v !== null && 'color' in v;
    if (isColor) { uniforms[k] = { value: new THREE.Color(v.color) }; decl.push(`uniform vec3 ${k};`); }
    else if (Array.isArray(v)) { uniforms[k] = { value: new THREE.Vector2(...v) }; decl.push(`uniform vec2 ${k};`); }
    else { uniforms[k] = { value: v }; decl.push(`uniform float ${k};`); }
  }
  return { uniforms, vertexShader: INK_SHADER.vertexShader, fragmentShader: STYLE_HEAD + decl.join('\n') + '\n' + style.frag };
}

function setUniforms(u, vals) {
  for (const [k, v] of Object.entries(vals)) {
    if (!u[k]) continue;
    if (u[k].value && u[k].value.isColor) u[k].value.set(v); else u[k].value = v;
  }
}

function makeQuad(def) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(def.uniforms),
    vertexShader: def.vertexShader,
    fragmentShader: def.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  return { quad: new FullScreenQuad(mat), mat };
}

export class Pipeline {
  /**
   * gradeOpts / inkOpts:覆寫對應 pass 的 uniform(例如太空背景要把 uLift 設 0,黑色才不會變灰)。
   */
  constructor(renderer, scene, camera, { pixelBudget = 4.6e6, gradeOpts = {}, inkOpts = {}, inkHooks = null, style = null } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.pixelBudget = pixelBudget;
    this.size = new THREE.Vector2(1, 1);

    const opts = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      colorSpace: THREE.NoColorSpace,
    };
    this.rtScene = new THREE.WebGLRenderTarget(2, 2, opts);
    this.rtScene.depthTexture = new THREE.DepthTexture(2, 2);
    this.rtScene.depthTexture.format = THREE.DepthFormat;
    this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.rtScene.depthTexture.minFilter = THREE.NearestFilter;
    this.rtScene.depthTexture.magFilter = THREE.NearestFilter;

    this.rtA = new THREE.WebGLRenderTarget(2, 2, { ...opts, depthBuffer: false });
    this.rtB = new THREE.WebGLRenderTarget(2, 2, {
      ...opts, type: THREE.UnsignedByteType, depthBuffer: false,
    });

    // 描線的客製點(skin.js LOOK.inkHooks):fns = 輔助函式、pre = 改取樣位置 suv / 粗細 t、post = 改 edge / line
    const inkDef = inkHooks ? {
      ...INK_SHADER,
      fragmentShader: INK_SHADER.fragmentShader
        .replace('/*@INK_FNS@*/', inkHooks.fns || '')
        .replace('/*@INK_PRE@*/', inkHooks.pre || '')
        .replace('/*@INK_POST@*/', inkHooks.post || ''),
    } : INK_SHADER;
    const ink = makeQuad(inkDef);
    const grade = makeQuad(GRADE_SHADER);
    const fxaa = makeQuad(FXAA_SHADER);
    this.ink = ink;
    this.grade = grade;
    this.fxaa = fxaa;

    ink.mat.uniforms.tDepth.value = this.rtScene.depthTexture;
    setUniforms(grade.mat.uniforms, gradeOpts);
    setUniforms(ink.mat.uniforms, inkOpts);
    this.style = null;
    if (style) {
      this.style = makeQuad(styleShader(style));
      this.style.mat.uniforms.tDepth.value = this.rtScene.depthTexture;
      this.rtC = new THREE.WebGLRenderTarget(2, 2, { ...opts, type: THREE.UnsignedByteType, depthBuffer: false });
    }
    this.enabled = { ink: true, grade: true, fxaa: true };
    this.time = 0;
  }

  /** 標題畫面的「濾鏡」鈕(畫風 pass 裡用 uFilter 決定雜訊 / 刮痕之類要不要畫) */
  setFilter(on) { if (this.style) this.style.mat.uniforms.uFilter.value = on ? 1 : 0; }

  /** Resolution scale: supersample a little on low-DPI screens for clean ink. */
  setSize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    let scale = this.forceScale || (dpr < 1.5 ? 1.5 : Math.min(dpr, 2));
    if (w * h * scale * scale > this.pixelBudget) {
      scale = Math.max(1, Math.sqrt(this.pixelBudget / (w * h)));
    }
    this.scale = scale;
    const rw = Math.max(2, Math.floor(w * scale));
    const rh = Math.max(2, Math.floor(h * scale));
    this.size.set(rw, rh);

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, true);

    this.rtScene.setSize(rw, rh);
    this.rtA.setSize(rw, rh);
    this.rtB.setSize(rw, rh);
    if (this.rtC) {
      this.rtC.setSize(rw, rh);
      const su = this.style.mat.uniforms;
      su.uTexel.value.set(1 / rw, 1 / rh); su.uRes.value.set(rw, rh);
      su.uNear.value = this.camera.near; su.uFar.value = this.camera.far;
    }

    const texel = new THREE.Vector2(1 / rw, 1 / rh);
    this.ink.mat.uniforms.uTexel.value.copy(texel);
    this.fxaa.mat.uniforms.uTexel.value.copy(texel);
    this.ink.mat.uniforms.uNear.value = this.camera.near;
    this.ink.mat.uniforms.uFar.value = this.camera.far;
    // scale ink weight with resolution so lines stay ~2 device px
    this.ink.mat.uniforms.uThickness.value = 1.05 + 0.55 * scale;
  }

  /** 描線隨距離淡出的範圍(俯視圖鏡頭很高,要拉遠才看得到線)。 */
  setInkFade(start, end) {
    this.ink.mat.uniforms.uFadeStart.value = start;
    this.ink.mat.uniforms.uFadeEnd.value = end;
  }

  /** this.time(秒)由呼叫端推進(main.js tick),畫風 / 描線 shader 的 uTime 用它 */
  render() {
    const r = this.renderer;
    this.ink.mat.uniforms.uTime.value = this.time;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);

    let src = this.rtScene.texture;

    if (this.enabled.ink) {
      this.ink.mat.uniforms.tDiffuse.value = src;
      r.setRenderTarget(this.rtA);
      this.ink.quad.render(r);
      src = this.rtA.texture;
    }

    const last = this.enabled.fxaa || this.style ? this.rtB : null;
    this.grade.mat.uniforms.tDiffuse.value = src;
    r.setRenderTarget(last);
    this.grade.quad.render(r);

    if (this.enabled.fxaa) {
      this.fxaa.mat.uniforms.tDiffuse.value = this.rtB.texture;
      r.setRenderTarget(this.style ? this.rtC : null);
      this.fxaa.quad.render(r);
    }
    if (this.style) {
      const su = this.style.mat.uniforms;
      su.tDiffuse.value = this.enabled.fxaa ? this.rtC.texture : this.rtB.texture;
      su.uTime.value = this.time;
      r.setRenderTarget(null);
      this.style.quad.render(r);
    }
    r.setRenderTarget(null);
  }

  dispose() {
    [this.rtScene, this.rtA, this.rtB, this.rtC].forEach((rt) => rt && rt.dispose());
    [this.ink, this.grade, this.fxaa, this.style].filter(Boolean).forEach((p) => {
      p.quad.dispose();
      p.mat.dispose();
    });
  }
}
