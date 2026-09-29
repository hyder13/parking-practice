# CLAUDE.md — 夜市美食大戰 NIGHT MARKET(night-market/)

台灣夜市主題 3D 手機射擊(地面縱向捲軸),由 temple-fair 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `night-market/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/night-market/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md),這個目錄只放「皮」:src/skin.js(文字 / 手感 / 調色)、
  core/(palette、pixel、audio)、game/(models、sea、boss、stages)。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5187。
- 【2026-09-29 使用者選題】「夜市美食大戰」(從我提的風格清單裡選的)。
- 發光物(子彈、辣椒、霓虹招牌、燈泡、蒸氣)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字:`bee` = 臭豆腐(一蹦一蹦)、`bfly` = 雞排(飄在半空)、`boss` = 刈包(打兩下,被打發紅)、
  `rock` = 貢丸串(沿竹籤轉);跳法在 src/skin.js `FEEL.hop`。
  `beam` 狀態 = 刈包停在玩家前方連丟辣椒;`rescue` 流程 = 道具 W 外送員(`callWingman`,模型 `ally${evo}`)。
  背景類別名稱沿用 `Sea`(src/game/sea.js),內容是夜市走道。
- 珍珠是深色的,暗色地面上會看不見 → 子彈多一圈奶茶色外圈(models.js `shotBatch`)。
- 大腸包小腸身形窄、容易打不中 → 碰撞範圍放寬(boss.js `BOSS_INFO` rx 2.9),血量只乘 1.05~1.2;
  SMART bot 6 次到第 5 / 5 / 6 / 6 / 7 / 10 攤。
- 標題六個字:index.html 用 `#title .logo.big` 把字縮小才不換行。

## 路由
| 要改 | 位置 |
|---|---|
| 三十攤關卡表 / 每攤場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS`;機制數值在 arcade-core/engine/field.js |
| 文字訊息 / 誇獎 / 成就 / 手感 | src/skin.js `TEXT` / `FEEL`;描線調色 `LOOK` |
| 招牌料理(衝進來、落地震畫面、紙片退場) | src/game/boss.js;模型 models.js `bigTemplate`(`sausageBody` / `omeletteBody` / `hotpotBody` / `candyBody`) |
| 小吃貨 10 段 / 外送員 / 小吃 / 手搖杯道具 | src/game/models.js(`SHIP_LV`、`kidBody`、`bubbleTea`、`chibi`、`tofu` / `cutlet` / `guabao`、`rockTemplate`、`itemTemplate`) |
| 走道 / 店屋 + 霓虹招牌 / 小吃攤 / 夜市遊戲 / 燈泡串 / 場景主題 | src/game/sea.js(`makeHouse` + `signMat`(`SHOPS`、`NEON`)、`makeStall`(`STALLS`、`boardMat`)、`makeTemple`、`makeLanterns`);配色 palette.js `THEMES`(`wet` = 雨夜倒影) |
| 音效(鐵板 `sizzle`、收銀機 `register`、搖鈴 `gong`) | src/core/audio.js(合成器 + 共用音效在 arcade-core/audio/synth.js) |
| HUD / 觸控 / 借過鈕 / 紙紋 / 標題的霓虹「營業中」 | arcade-core/engine/main.js、arcade-core/ui/hud.css、index.html(`.open`) |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6)。走道半寬 7.4(sea.js `ROAD`),兩側房子放在走道外面。
- 人物(`chibi`)和小吃(`standing`)在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。
- 小吃攤不旋轉:正面(招牌)一律朝畫面下方,招牌字才是正的。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
- 2026-09-29 驗證(Playwright + Chromium 390x844 / 844x390 / 1280x720 / 360x640):
  無敵 bot 從第 1 / 11 / 21 / 29 攤連打無 console error;SMART bot 6 次到第 5~10 攤。
