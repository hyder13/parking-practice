# CLAUDE.md — 齊天大聖 MONKEY KING(monkey-king/)

西遊記主題 3D 手機射擊,由 sky-aces(蒼空王牌 1945)換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `monkey-king/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/monkey-king/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5183。
- 渲染核心:src/core/toon.js(`cel()` / `flat()`)、src/core/post.js(`Pipeline`,這版 ink `uThickness` 1.7)。新視覺元素一律用 `cel()` / `flat()`。
- 發光物(子彈、爆炸、雲尾、光環、霧)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字:`bee` = 蝙蝠精、`bfly` = 烏鴉精、`boss` = 天兵(打兩下)、`rock` = 妖火石;
  `beamdive` / `beam` = 天兵停在玩家上方連擲(game.js `updateBeam`);`rescue` 流程 = 道具 W 身外身(`callWingman`)。
  背景類別名稱沿用 `Sea`(src/game/sea.js),內容是雲海 + 仙山。
- 【2026-09-29 使用者決定】三款(star-bees / sky-aces / monkey-king)目前是複製出來的三份程式;
  使用者選「先衝一版」,之後再考慮抽成共用核心 + 皮膚包。改共同的 bug 時記得三份都要改。

## 路由
| 要改 | 位置 |
|---|---|
| 三十難關卡表 / 每關場景 / 機制 | src/game/config.js `STAGE_TABLE` / `STAGE_THEME` / `TWISTS` / `stageCfg` |
| 翻筋斗、身外身、擲槍、文字訊息 | src/game/game.js `startLoop`、`callWingman`、`updateBeam`、`beginStage` |
| 大妖(從上方落下、被打回原形) | src/game/boss.js;模型 models.js `bigTemplate`;血量加權在 BigBoss constructor |
| 大聖 10 段修為 / 小妖 / 道具 | src/game/models.js(`SHIP_LV`、`shipBody`、`batBody`、`crowBody`、`soldierBody`、`itemTemplate`) |
| 雲海 / 仙山 / 仙鶴 / 飄落物 / 場景主題 | src/game/sea.js;配色 palette.js `THEMES` |
| 音效 | src/core/audio.js(`gong` 銅鑼) |
| HUD / 觸控 / 筋斗鈕 / 宣紙紋理(#crt) | src/main.js、index.html |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。模型 local +y = 前方;小妖面朝下 = π;大妖模型本身就做成面朝 -y(臉在 +z),rotation 0。
- 大聖做成「臉朝鏡頭」(臉在 +z、頭在 +y),翎羽往上翹,從正上方看才認得出來。
- 雲海在 z = −62,仙山從雲海往上長(z −62 → 約 −46),雲 −16 ~ −40,飄落物 −8 ~ −30。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.game.input.loop = true`。
- 2026-09-29 驗證(Playwright + Chromium 390x844):無敵 bot 從第 1 / 11 / 21 / 29 關連打到第 40 關無 console error;
  SMART bot(不會翻筋斗)到第 4~11 關。
