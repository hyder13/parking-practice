# CLAUDE.md — arcade-core(換皮射擊遊戲的共用引擎)

星際小蜜蜂式 3D 縱向射擊的引擎:陣型 / 俯衝 / 30 關 / 成長系統 / 道具 / BOSS 流程 / HUD / 觸控 / 描線後製。
**不是獨立專案**(沒有 package.json),由各款遊戲的 Vite 用 alias 引進來一起打包。

用的遊戲:`sky-aces/`、`monkey-king/`、`three-kingdoms/`、`temple-fair/`、`yokai-night/`(第一款直接用引擎做的換皮)、`night-market/`、`animal-brawl/`、`sengoku/`、
`cartoon-1930/`(第一款「換畫法」的:黑白底片)、`comic-hero/`(美漫網點)、`ink-wuxia/`(水墨)、`yarn-land/`(毛線針織)、`stained-glass/`(彩繪玻璃)、`steam-sky/`(蒸汽龐克黃銅)、`pharaoh/`(埃及壁畫平塗)。
`star-bees/` 是最早的原版,**不用** arcade-core(它另外有自己的 repo hyder13/star-bees)。

【2026-09-29 使用者要求「先抽離完全共用」】四款裡一模一樣、或只差文字 / 少數手感參數的程式都搬到這裡;
各款剩下的是「皮」。抽離前後用固定亂數種子比對過:遊戲狀態逐格相同(見下面「測試方法」)。

## 目錄
| 檔案 | 內容 |
|---|---|
| render/toon.js、render/post.js | `cel()` / `flat()` 材質、`Pipeline`(描線 + 調色 + FXAA)。改編自 sakura-crossing(MIT,見 THIRD_PARTY_NOTICES.md) |
| engine/main.js | 進入點:renderer / 鏡頭 fit / HUD / 輸入 / 選單 / `window.__game` 測試介面 |
| engine/game.js | 遊戲規則(陣型、俯衝、掃射、翻筋斗 / 跳躍閃避、僚機、道具、進化、連擊、成就)。障礙物(rock)模型裡有 'spin' 群組就每幀自轉(yokai-night 的輪入道) |
| engine/field.js | 場地常數(`FW` / `FH` / `setFieldHeight`…)、陣型格子、配分、機制 `TWISTS`、難度 `stageCfg` |
| engine/stage-dsl.js | `S()` / `C()`:各款 stages.js 寫關卡表用 |
| engine/paths.js | 進場 / 俯衝軌跡 |
| engine/fx.js | 爆炸碎片、火花、煙、掃射光 |
| engine/kit.js | 模型小工具:`geoAt`、`Batch`(InstancedMesh)、`armorize` / `unarmor`、`squash`、`elasticOut` |
| audio/synth.js | WebAudio 合成器(`tone` / `noise` / `melody` / `throttle`)+ 跟主題無關的共用音效 `baseSfx` |
| ui/sprite.js | HUD 點陣圖:字元陣列 → dataURL |
| ui/hud.css | HUD / 選單 / 觸控鈕版面(中文主題共用;sky-aces 是英文點陣字版,CSS 還在自己的 index.html) |

## 「皮」的介面(每款遊戲 src/ 底下要有這些)
引擎用 `@skin/...` import(`@skin` = 那款遊戲的 `src/`),所以**檔名和 export 名稱要一模一樣**:

| 檔案 | 要 export |
|---|---|
| src/skin.js | `META`(`store` localStorage 前綴)、`TEXT`(所有畫面文字)、`FEEL`(手感)、`LOOK`(`grade` / `ink` 後製參數) |
| src/core/palette.js | `PAL`(引擎用到 ink / sea / key / fill / rim / hemiSky / hemiGround / smoke / beam / beam2 / white / engine、ship* / bee* / bfly* / boss* / captive*)、`THEMES`、`TOON`(材質畫風,沒有就寫 `null`) |
| src/core/pixel.js | `SPRITES`(ship / bee / bfly / boss / flag / badge5 / badge10 / badge50)、`COLORS` |
| src/core/audio.js | `sfx` = `{ ...baseSfx, shot, loop, rocket, warning, bomb, levelUp, beam, start, stage, … }` |
| src/game/models.js | `spawnModel`、`spinProps`、`flapWings`(沒有就寫空函式)、`shotBatch`、`enemyShotBatch`、`BOSS_HIT_SWAP`、`SHIP_LV`、`ITEMS` |
| src/game/sea.js | `Sea` 類別:`new Sea(scene, { key, hemi })`、`update(dt)`、`setTheme(i)`、`fit(…)`、`speed`、`clearColor` |
| src/game/boss.js | `BigBoss`、`BOSS_INFO`(含 `gold` 獎勵目標) |
| src/game/stages.js | `BOSS_KINDS`、`TWIST_HINTS`、`STAGE_TABLE`(30 關)、`STAGE_THEME`(每關用哪個 THEMES) |
| src/main.js | 一兩行:`import '@arcade/ui/hud.css'`(要用共用 CSS 才加)+ `import '@arcade/engine/main.js'` |

`LOOK` 可選欄位(換畫法用,見下面「畫風 hook」):`inkHooks`、`style`。`FEEL` 可選:`boomWord(o)`(爆炸跳出狀聲詞)。

`FEEL` 欄位:`popup`(立體書 Q 彈)、`dodge`('flip' 翻筋斗 / 'hop' 往鏡頭跳)、`gait`([頻率, 高度] 走路顛)、
`groundZ`(地面影子深度,飛行版 0)、`dualDx`(雙機間距)、`ally`(雙機第二台的模型前綴 'ship' / 'ally')、
`hop(e)`(敵人上下起伏)、`rockSpin()`(障礙物旋轉)。`TEXT` 欄位照 temple-fair/src/skin.js 抄。

## 畫風 hook(【2026-09-29】為了「換畫法」的換皮加的,不用就是原本的賽璐璐 + 描線)
| hook | 在哪 | 做什麼 |
|---|---|---|
| `LOOK.style = { uniforms, frag }` | render/post.js `styleShader` | 調色 + FXAA 之後再跑一道全螢幕 shader(frag 寫 `void main()`)。內建 `tDiffuse`(sRGB 畫面)、`tDepth`、`uTexel`、`uRes`、`uTime`、`uFilter`(標題「濾鏡」鈕 = `TEXT.crt`)、`linearDepth(uv)`、`hash` / `noise`。uniforms:數字 → float、`[a, b]` → vec2、`{ color: 0x… }` → vec3 |
| `LOOK.inkHooks = { fns, pre, post }` | render/post.js 描線 shader 的 `/*@INK_FNS@*/` 等標記 | `pre` 可改取樣位置 `suv` 和粗細 `t`(手抖、毛筆粗細)、`post` 可改 `edge` / `line`;可用 `uTime`、`inkNoise(vec2)` |
| palette.js `TOON = { key, patch(shader, mat), flatPatch }` | render/toon.js | `cel()` 材質編譯時改 shader(網點陰影、毛線紋路…);`key` 會進 program cache key |
| `FEEL.boomWord(o)` | engine/main.js `explode` | 回傳 `[字, 'CSS class']` 就在爆炸位置跳字(美漫的 POW!) |
- 注意:`pipeline.setSize` 會重設 `uThickness`(依解析度),`LOOK.ink.uThickness` 其實蓋不過去 → 要更粗在 `inkHooks.pre` 乘 `t`。
- 各款 index.html 的 `<style>` 比 hud.css 早載入(hud.css 由 main.js import)→ 要蓋掉共用樣式,選擇器加 `html` 前綴(`html:root`、`html #hud`)。
- `pipeline.time` 由 main.js `tick` 推進(`__game.step` 也會),畫風 shader 的 `uTime` 用它。

## 各款的 vite.config.js(必要設定)
```js
resolve: {
  alias: { '@arcade': '../arcade-core 的絕對路徑', '@skin': './src 的絕對路徑' },
  dedupe: ['three'],             // arcade-core 裡的 import 'three' 也解析到這款的 node_modules(只打包一份)
},
server: { fs: { allow: ['..'] } } // dev server 才讀得到上一層的 arcade-core
```

## 做一款新的換皮
1. 複製最接近的一款(地面 + 立體書 → temple-fair / three-kingdoms;天空 → monkey-king;英文點陣 → sky-aces),
   不帶 dist、node_modules(node_modules 可以整包複製省下載)。改 package.json name、vite.config.js port。
2. 只改「皮」:skin.js、palette、pixel、audio、models、sea、boss、stages、index.html(標題 / 說明 / --loop-* 變數)。
3. 上層 `.github/workflows/deploy.yml` 加 build + cp 兩步;上層 CLAUDE.md 加一行。

## 改引擎的規矩
- 引擎裡不放主題文字、不 hardcode 某一款的造型;某款要不同行為 → 在 `FEEL` 加欄位(其他款給原本的值)。
- 改完每一款都要 `npm run build`,並跑 bot 測試(每款從第 1 / 11 / 21 / 29 關)確認沒有 console error。

## 測試方法
- `window.__game.step(秒, dt, draw)` 手動推進;`__game.start(n)` 從第 n 關開始;`__game.game` 是 Game 物件。
- 比對重構前後:Playwright `addInitScript` 換掉 `Math.random`(固定種子)+ 讓 `requestAnimationFrame` 不做事,
  兩版跑同一串操作比 `game` 狀態。temple-fair 11 個場景狀態全部相同;其他款前 7 個場景相同,
  後面長時間 bot 連舊版自己跟自己比都會分岔(測試環境的時序雜訊,不是程式差異)。截圖像素差來自 DOM 動畫(CSS 淡出),可忽略。
