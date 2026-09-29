# CLAUDE.md — 百鬼夜行 HYAKKI YAGYO(yokai-night/)

浮世繪風格的日本妖怪 3D 手機射擊(地面縱向捲軸),由 temple-fair 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `yokai-night/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/yokai-night/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md),這個目錄只放「皮」:src/skin.js(文字 / 手感 / 調色)、
  core/(palette、pixel、audio)、game/(models、sea、boss、stages)。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5186。
- 【2026-09-29 使用者選題】「浮世繪百鬼夜行」—— 第一款用共用引擎做出來的換皮;重點是測「換畫風」:
  cel 只分 2 階(models.js / sea.js 的 `C()`)、描線 `uThickness` 2.0、陰影偏藍紫、#crt = 和紙紋理。
- 發光物(子彈、人魂、提燈、狐火、石燈籠的火、霞)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字:`bee` = 唐傘妖(單腳跳)、`bfly` = 提燈妖(飄浮)、`boss` = 赤鬼(打兩下,被打變青鬼)、
  `rock` = 輪入道(車輪在 'spin' 群組,引擎會讓它轉);跳法在 src/skin.js `FEEL.hop`。
  `beam` 狀態 = 赤鬼停在玩家前方連發;`rescue` 流程 = 道具 W 式神白狐(`callWingman`,模型 `ally${evo}`)。
  背景類別名稱沿用 `Sea`(src/game/sea.js),內容是平安京夜路。
- 高的東西(鳥居、五重塔、竹子)往畫面上方仰倒 `TORII_LEAN`,從俯視鏡頭才看得到剪影;
  它們的「立起來」動畫用 scale.y(從底邊往上展開),其他物件用 scale.z。
- 大妖怪放大過(template 1.5~1.6),血量乘 1.45~1.55;SMART bot 6 次到第 2 / 4 / 5 / 6 / 6 / 7 夜。

## 路由
| 要改 | 位置 |
|---|---|
| 三十夜關卡表 / 每夜場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS`;機制數值在 arcade-core/engine/field.js |
| 文字訊息 / 誇獎 / 成就 / 手感(跳法、雙機間距) | src/skin.js `TEXT` / `FEEL`;描線調色 `LOOK` |
| 大妖怪(衝進來、落地震畫面、紙片退場、九尾狐擺尾) | src/game/boss.js;模型 models.js `bigTemplate`(`kitsuneBody` / `skullBody` / `raijinBody` / `manekiBody`) |
| 陰陽師 10 段位階 / 白狐 / 妖怪 / 繪馬 | src/game/models.js(`SHIP_LV`、`onmyojiBody`、`chibi`、`kasa` / `chochin` / `oni`、`rockTemplate`、`itemTemplate`) |
| 五芒星 / 三つ巴 / 符的貼圖 | src/game/models.js `starTex` / `tomoeTex` / `fudaTex`(canvas 即時畫) |
| 夜路 / 町家 / 五重塔 / 神社 / 樹 / 鳥居 / 霞 / 場景主題 | src/game/sea.js(`makeHouse` / `makePagoda` / `makeShrine` / `makeTree` / `makeGate` / `makeKasumi`、暖簾字 `SHOPS`);配色 palette.js `THEMES` |
| 音效(拍子木 `hyoshigi`、三味線 `shamisen`、太鼓 `taiko`、梵鐘 `gong`) | src/core/audio.js(合成器 + 共用音效在 arcade-core/audio/synth.js) |
| HUD / 觸控 / 飛躍鈕 / 和紙紋理 / 標題的落款印章 | arcade-core/engine/main.js、arcade-core/ui/hud.css、index.html(`.seal`) |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6)。街道半寬 7.4(sea.js `ROAD`),兩側房子放在街道外面。
- 人物(`chibi`)在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;人物模型 `upright` 不跟著前進方向轉。
- 輪入道不是 upright:模型 +y = 前進方向,所以和尚頭的頭頂畫在 −y。
- 町家的暖簾 / 格子窗、神社的賽錢箱在 spawn 時移到朝街道的那一側。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
- 2026-09-29 驗證(Playwright + Chromium 390x844 / 844x390 / 1280x720 / 360x640):
  無敵 bot 從第 1 / 11 / 21 / 29 夜連打無 console error;SMART bot 6 次到第 2~7 夜。
