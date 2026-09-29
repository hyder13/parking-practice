# CLAUDE.md — SKY ACES 1945(sky-aces/)

二戰縱向捲軸空戰 3D 手機射擊,由 star-bees(星際小蜜蜂 3D)整個換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `sky-aces/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/sky-aces/(`vite.config.js` base './' 不可拿掉)。
本資料夾的 `.github/workflows/deploy.yml` 是之後搬去獨立 repo 用的,在子資料夾裡不會被執行。

## 事實卡
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5182。
- 渲染核心:src/core/toon.js(`cel()` / `flat()`)、src/core/post.js(`Pipeline`)。新視覺元素一律用 `cel()` / `flat()`,顏色取 `PAL`。
- 發光物(子彈、爆炸、螺旋槳盤、航跡、浪花)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字(改名牽動太多):`bee` = 戰鬥機、`bfly` = 俯衝轟炸機、`boss` = 雙發重戰機、`rock` = 火箭;
  敵人 state `beamdive` / `beam` = 重戰機飛到玩家上方停住「掃射」(game.js `updateBeam`),不再抓人;
  `rescue` 流程改成道具 W 叫僚機(`callWingman`)。舊的 capture 程式碼還在但不會觸發。

## 路由
| 要改 | 位置 |
|---|---|
| 30 關關卡表 / 機制 / 難度參數 | src/game/config.js `STAGE_TABLE` / `TWISTS` / `stageCfg` |
| 關卡機制實作、翻筋斗、僚機、掃射 | src/game/game.js `updateTwists`、`startLoop`、`callWingman`、`updateBeam` |
| 關底 BOSS(進場從玩家背後爬升、墜海) | src/game/boss.js;模型 models.js `bigTemplate`;血量加權在 BigBoss constructor |
| 飛機模型 / 10 段晉升 / 螺旋槳 / 補給箱 | src/game/models.js(`SHIP_LV`、`shipBody`、`addProp`、`itemTemplate`) |
| 海面 / 島 / 船 / 浮冰 / 雲 / 天候 | src/game/sea.js;配色 palette.js `THEMES` |
| 爆炸(碎片 + 火花 + 黑煙) | src/game/fx.js |
| 音效 | src/core/audio.js |
| HUD / 觸控 / LOOP 鈕 / 鏡頭 fit | src/main.js、index.html |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。寬 FW=22;高 FH 30~42(`setFieldHeight`)。陣型相對上緣、玩家 / 俯衝相對下緣。
- 模型 local +y = 機頭;heading θ 的前方 = (−sin θ, cos θ)。敵機面朝下 = π;BOSS 機頭朝上(rotation 0)。
- 海面在 z = −62(`SEA_Z`),雲在 −18 ~ −42,薄霧在 +4 ~ +7。背景物件全部以同一世界速度往 −y 捲,視差來自透視。
  `Sea.frame(Z)` = 深度 Z 處的可視範圍(Z 為正 = 在遊戲平面下方)。

## 測試
- `window.__game.step(秒, dt, draw)` 手動推進;`__game.start(n)` 從第 n 關開始;`__game.game.input.loop = true` 觸發翻筋斗。
- 2026-09-29 換皮版驗證(Playwright + Chromium,390x844 / 360x640 / 844x390 / 1280x720):
  無敵 bot 從第 1 / 11 / 21 / 29 關連打到第 35 關(EXTRA)無 console error;BOSS 戰第 1 關 ~15 秒、中期 15~35 秒、第 30 關三連戰 ~2 分鐘。
  會閃躲的 SMART bot(不會用翻筋斗)到第 5~10 關(與 star-bees 最後一次調難度的結果相同)。
