# CLAUDE.md — 漫畫英雄 POW! COMIC HERO(comic-hero/)

美式彩色漫畫(網點 + 粗線 + 狀聲詞)主題 3D 手機射擊(地面縱向捲軸),由 sengoku 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `comic-hero/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/comic-hero/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md,「畫風 hook」一節),這個目錄只放「皮」。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5191。
- 【2026-09-29 使用者選題】「更跳脫的風格 1~5 都做」的第 2 款:美漫網點。
- **網點在材質裡**:src/core/palette.js `TOON.patch` 在賽璐璐光照裡記下直射光落在第幾階(`gCelSum / gCelW`,
  0.36 / 0.7 / 1.0),最後上色時亮面平塗、中間一階小網點、最暗一階大網點(螢幕座標 9px 一格)。
  不要用「最後亮度 / 固有色」來判斷明暗:半球光很亮,算出來每一面都 >1,網點會全部消失。
- 最後一道 pass(src/skin.js `LOOK.style` = `PRINT`):新聞紙 + 套色偏移(`uFilter`,標題「印刷感」鈕)+ 漫畫格黑框。
  共用的 `#crt` 紙紋在 index.html 用 CSS 關掉。
- 狀聲詞:src/skin.js `FEEL.boomWord`(大爆炸一定有、打死敵人一半機率,最多每 0.18 秒一個),
  樣式是 index.html 的 `.pop.boom`(clip-path 爆炸框 + Bangers 字型)。
- 子彈(黃色能量星 / 洋紅能量彈)是不透明平塗,會被描上黑框。
- 城市的大樓屋頂畫在地面 shader 裡(sea.js `SEA_FS` 的 grid 段:每個街廓一種顏色 + 女兒牆 + 網點陰影 + 冷氣機 / 水塔);
  3D 的 `roof` 物件只是點綴。看板的字是 `comicTex`(canvas,太長會自動縮小)。
- 內部型別沿用 star-bees 的名字:`bee` = 機器人小兵、`bfly` = 噴射背包打手(飛在半空)、`boss` = 大塊頭打手(打兩下)、
  `rock` = 油桶;`rescue` 流程 = 道具 W 超級狗狗(`callWingman`,模型 `ally${evo}`)。
- 英雄的眼罩(`mask()`)要放在臉的球面外面(z ≈ 0.3),放進去會被臉蓋掉,看起來像下垂的眼睛。

## 路由
| 要改 | 位置 |
|---|---|
| 三十話關卡表 / 場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS` |
| 文字 / 手感 / 狀聲詞 / 印刷 pass | src/skin.js `TEXT` / `FEEL`(`boomWord`)/ `LOOK`(`PRINT`) |
| 網點材質 | src/core/palette.js `TOON` |
| 大魔頭 | src/game/boss.js;模型 models.js `bigTemplate`(`mechBody` / `brainBody` / `kaijuBody` / `truckBody` + 各自的 ring) |
| 驚奇小子 10 段 / 超級狗狗 / 敵人 / 徽章道具 | src/game/models.js(`SHIP_LV`、`heroBody`、`mask`、`robot` / `goon` / `thug`、`rockTemplate`、`itemTemplate`) |
| 地面 / 屋頂 / 看板 / 車 / 場景主題 | src/game/sea.js(`SEA_FS`、`makeProp`、`ADS`);配色與物件清單 palette.js `THEMES` |
| 音效(銅管 `brass`、定音鼓 `timpani`、警報) | src/core/audio.js |
| 標題的漫畫封面 / 狀聲詞樣式 | index.html `<style>` |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 角色在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。
- 背景裡「立著」的東西(看板、吊車)往畫面上方仰倒 `LEAN`(sea.js),出場用 scale.y。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
