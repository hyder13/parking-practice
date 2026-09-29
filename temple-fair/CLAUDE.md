# CLAUDE.md — 鬧熱廟會 TEMPLE FESTIVAL(temple-fair/)

台灣廟會遶境主題 3D 手機射擊(地面縱向捲軸),由 three-kingdoms 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `temple-fair/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/temple-fair/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5185。
- 渲染核心:src/core/toon.js(`cel()` / `flat()`)、src/core/post.js(`Pipeline`,ink `uThickness` 1.6)。
- 發光物(子彈、鬼火、燈籠、陰影、煙)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字:`bee` = 小鬼、`bfly` = 殭屍(game.js `updateEnemy` 裡跳得特別高)、`boss` = 夜叉(打兩下)、`rock` = 鬼火;
  `beam` 狀態 = 夜叉停在玩家前方連發;`rescue` 流程 = 道具 W 七爺助陣(`callWingman`,模型 `ally${evo}`)。
  背景類別名稱沿用 `Sea`(src/game/sea.js),內容是遶境街道。
- 【2026-09-29 使用者決定】star-bees / sky-aces / monkey-king / three-kingdoms / temple-fair 是複製出來的五份程式,先衝版本、之後再考慮共用核心。
- 前 3 站的大魔頭出招間隔放慢 30%、旋轉彈幕前期比較疏(boss.js),讓新手有小勝利;SMART bot 從第 1~2 站陣亡 → 第 4~6 站。

## 路由
| 要改 | 位置 |
|---|---|
| 三十站關卡表 / 每站場景 / 機制 | src/game/config.js `STAGE_TABLE` / `STAGE_THEME` / `TWISTS` / `stageCfg` |
| 風火輪、七爺、連發、Q 彈、殭屍跳、文字訊息 | src/game/game.js `startLoop`、`callWingman`、`updateBeam`、`updateEnemy`、`beginStage` |
| 大魔頭(從上方衝進來、落地震畫面、紙片退場) | src/game/boss.js;模型 models.js `bigTemplate`(`nianBody` / `grannyBody` / `ghostKingBody` / `packetBody`) |
| 三太子 10 段神格 / 七爺 / 鬼怪 / 平安符 | src/game/models.js(`SHIP_LV`、`princeBody`、`chibi`(`o.big` 大頭、`extra(g, hg)` 頭部座標)、`imp` / `jiangshi` / `yaksha`、`itemTemplate`) |
| 街道 / 店屋 / 廟 / 攤販 / 燈籠 / 場景主題 | src/game/sea.js(`makeHouse` / `makeTemple` / `makeStall` / `makeLanterns`、招牌字 `SHOPS`);配色 palette.js `THEMES` |
| 音效(鞭炮 `crackle`、嗩吶 `suona`、銅鑼 `gong`) | src/core/audio.js |
| HUD / 觸控 / 風火輪鈕 / 宣紙紋理 | src/main.js、index.html |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6)。街道半寬 7.4(sea.js `ROAD`),兩側房子放在街道外面。
- 人物(`chibi`)在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;人物模型 `upright` 不跟著前進方向轉。
- 店屋的招牌 / 廟的香爐在 spawn 時移到朝街道的那一側(左右兩邊都放得對)。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.game.input.loop = true`。
- 2026-09-29 驗證(Playwright + Chromium 390x844 / 844x390 / 1280x720 / 360x640):
  無敵 bot 從第 1 / 11 / 21 / 29 站連打到第 40 站無 console error;SMART bot(不會用風火輪)6 次都到第 4~6 站。
