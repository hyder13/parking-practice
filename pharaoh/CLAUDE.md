# CLAUDE.md — 小法老 LITTLE PHARAOH(pharaoh/)

古埃及墓室壁畫風格的小法老 3D 手機射擊(地面縱向捲軸),由 stained-glass 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `pharaoh/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/pharaoh/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md,「畫風 hook」一節),這個目錄只放「皮」。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5196。
- 【2026-09-30 使用者選題】影片要排滿 16 格、「用 1 你自己挑」→ 挑了清單第 10 個:埃及金字塔。
- **平塗材質**在 palette.js `TOON.patch`:正對鏡頭 = 原色、側面 = 深一階(0.74),沒有漸層和高光。
- **顏料色**在 src/skin.js `MURAL` 的 `pig()`:畫面每個顏色往最近的 10 種礦物顏料靠一半(`uPigment`)。
  沙地的暗色要有「深赭」(P[9])可以靠,不然會被靠成赭紅,沙丘變成一條條紅紋。
- **地面**在 sea.js `SEA_FS`:沙丘分三個平平的色階(色階交界一條深線)+ 細風紋 + 小石子;尼羅河 = 藍 + 壁畫畫水的黑色鋸齒紋,
  兩岸綠色紙莎草 + 一條條的田;神殿大道 = 石板。最後整體壓暗到 0.8。
- 描線 = 粗黑線 + 微微手抖(`INK_HOOKS`)。最後一道 pass(`MURAL`)= 顏料色 + 莎草紙纖維 + 藍紅綠金的壁畫邊框;「壁畫」鈕 = `uFilter`。
- 大物件(金字塔、方尖碑、神殿門、墓門、坐像)往畫面上方仰倒 `LEAN`,出場用 scale.y;小獅身像和冥界祭壇平放。
- 內部型別沿用 star-bees 的名字:`bee` = 木乃伊、`bfly` = 聖甲蟲(飛在半空,翅膀是 'flag' + `userData.side`)、
  `boss` = 胡狼守衛(打兩下)、`rock` = 滾來的石球;`rescue` 流程 = 道具 W 聖貓(`callWingman`,模型 `ally${evo}`)。

## 路由
| 要改 | 位置 |
|---|---|
| 三十關關卡表 / 場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS` |
| 文字 / 手感 / 壁畫 pass / 描線 | src/skin.js `TEXT` / `FEEL` / `LOOK`(`MURAL`、`INK_HOOKS`) |
| 平塗材質 | src/core/palette.js `TOON` |
| 守護者 | src/game/boss.js;模型 models.js `bigTemplate`(`sphinxBody` + `sandRing` / `snakeBody` + `hoodExtras` / `scorpionBody` + `fireRing` / `maskBody` + `scarabRing`) |
| 小法老 10 段 / 聖貓 / 敵人 / 護身符道具 | src/game/models.js(`SHIP_LV`、`pharaohBody`、`nemes()`、`catBody`、`mummy` / `scarab` + `scarabWings` / `jackal`、`rockTemplate`、`itemTemplate`) |
| 沙漠地面 / 棕櫚樹 / 金字塔 / 場景主題 | src/game/sea.js(`SEA_FS`、`makeTree` / `makeProp`);配色與物件清單 palette.js `THEMES` |
| 音效(豎琴 `harp`、叉鈴 `sistrum`、蘆笛 `flute`、大鼓 `drum`) | src/core/audio.js |
| 標題的金字塔 + 太陽 / HUD | index.html `<style>`(選擇器加 `html` 前綴才蓋得過 hud.css) |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 角色在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
