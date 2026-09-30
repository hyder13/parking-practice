# CLAUDE.md — 蒸汽天空 STEAM SKY(steam-sky/)

蒸汽龐克風格的小飛行員 3D 手機射擊(地面縱向捲軸),由 stained-glass 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `steam-sky/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/steam-sky/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md,「畫風 hook」一節),這個目錄只放「皮」。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5195。
- 【2026-09-30 使用者選題】影片要排滿 16 格、「用 1 你自己挑」→ 挑了清單第 9 個:蒸汽龐克飛艇。
- **黃銅材質**在 palette.js `TOON.patch`:只有「暖色」(r − b > 0.3 左右,黃銅 / 紅銅 / 皮革 / 紅磚)才變成金屬
  (對比很大的明暗 + 一條環境反光 + 小亮點);布、皮膚、玻璃只加一顆小亮點。要讓某個零件不反光 → 換成不那麼暖的顏色。
- **城市地面**在 sea.js `SEA_FS`:9 單位一格街區(街寬 1.7),街區切成 2 x 2 棟,每棟一種屋頂(THEMES 的 deep / sea / foam),
  斜屋頂一半亮一半暗 + 瓦片橫紋 + 煙囪口 + 偶爾亮的天窗;街道是石板 + 路口的煤氣燈光 + 房子落在街上的影子。
  `city`(0..1)= 有幾成街區是城市,其他是荒地(郊外 / 煤礦山谷);鐵軌沿 `roadX`,運河沿 `riverX`。最後整體壓暗到 0.72。
- 描線 = 深棕色、稍粗(src/skin.js `INK_HOOKS`)。最後一道 pass(`STEAM`)= 琥珀色調 + 亮部泛光 + 飄過的蒸汽 + 黃銅框(鉚釘);「蒸汽」鈕 = `uFilter`。
- 大物件(工廠、鐘樓、幫浦、起重機、水塔、要塞)往畫面上方仰倒 `LEAN`,出場用 scale.y;儲氣槽平放。
- 內部型別沿用 star-bees 的名字:`bee` = 發條兵、`bfly` = 發條蜻蜓(飛在半空,四片翅膀是 'flag' + `userData.side`)、
  `boss` = 蒸汽機器人(打兩下)、`rock` = 滾來的齒輪;`rescue` 流程 = 道具 W 機械貓頭鷹(`callWingman`,模型 `ally${evo}`)。

## 路由
| 要改 | 位置 |
|---|---|
| 三十航段關卡表 / 場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS` |
| 文字 / 手感 / 蒸汽 pass / 描線 | src/skin.js `TEXT` / `FEEL` / `LOOK`(`STEAM`、`INK_HOOKS`) |
| 黃銅材質 | src/core/palette.js `TOON` |
| 巨大機械 | src/game/boss.js;模型 models.js `bigTemplate`(`whaleBody` + `whaleExtras` / `clockBody` + `gearRing` / `zeppelinBody` + `zeppelinExtras` / `watchBody`) |
| 小飛行員 10 段 / 貓頭鷹 / 敵人 / 齒輪幣道具 | src/game/models.js(`SHIP_LV`、`pilotBody`、`owlBody`、`tinSoldier` / `dragonfly` + `flyWings` / `steamBot`、`rockTemplate`、`itemTemplate`、`gear()`) |
| 城市地面 / 路燈 / 工廠 / 場景主題 | src/game/sea.js(`SEA_FS`、`makeTree` / `makeProp`);配色與物件清單 palette.js `THEMES` |
| 音效(汽笛 `whistle`、汽笛風琴 `calliope`、大號 `tuba`、金屬撞擊 `clank`) | src/core/audio.js |
| 標題的大齒輪 / HUD | index.html `<style>`(選擇器加 `html` 前綴才蓋得過 hud.css) |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 角色在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
