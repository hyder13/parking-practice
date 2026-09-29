# CLAUDE.md — 彩窗騎士 STAINED GLASS KNIGHT(stained-glass/)

教堂彩繪玻璃風格的童話騎士 3D 手機射擊(地面縱向捲軸),由 sengoku 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `stained-glass/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/stained-glass/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md,「畫風 hook」一節),這個目錄只放「皮」。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5194。
- 【2026-09-29 使用者選題】「更跳脫的風格 1~5 都做」的第 5 款:彩繪玻璃。
- **玻璃地面**在 sea.js `SEA_FS`:世界座標的 Voronoi(1.7 單位一塊,3×3 找最近 / 第二近),顏色用「這塊玻璃的中心」決定
  (小路 / 河也是整塊換色,不會切半塊);最後整體壓暗到 0.62、彩度收 20%(太亮的話角色和子彈會被吃掉)。
  不要把 Voronoi 做在最後的畫面 pass(螢幕座標):世界在動、玻璃格不動,會變成「隔著浴室玻璃看」的效果,子彈也會糊掉。
- **角色的玻璃感**在 palette.js `TOON.patch`:用 `normal`·`vViewPosition` 算正對程度,正對最亮、斜面深而飽和,暗面不變灰。
- 描線 = 鉛條(src/skin.js `INK_HOOKS`:加粗、純黑)。最後一道 pass(`GLASS`)= 光暈 + 光束 + 彩色小玻璃窗框;「光束」鈕 = `uFilter`。
- 大物件(塔、教堂、村屋、城門)往畫面上方仰倒 `LEAN`,出場用 scale.y。
- 內部型別沿用 star-bees 的名字:`bee` = 哥布林、`bfly` = 蝙蝠(飛在半空,翅膀是 'flag' + `userData.side`)、`boss` = 黑騎士(打兩下)、
  `rock` = 火球;`rescue` 流程 = 道具 W 獨角獸(`callWingman`,模型 `ally${evo}`)。

## 路由
| 要改 | 位置 |
|---|---|
| 三十章關卡表 / 場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS` |
| 文字 / 手感 / 光暈光束 pass / 鉛條描線 | src/skin.js `TEXT` / `FEEL` / `LOOK`(`GLASS`、`INK_HOOKS`) |
| 角色的玻璃材質 | src/core/palette.js `TOON` |
| 大魔物 | src/game/boss.js;模型 models.js `bigTemplate`(`golemBody` / `dragonBody` + `dragonExtras` / `witchBody` + `potionRing` / `grailBody`) |
| 小騎士 10 段 / 獨角獸 / 敵人 / 寶石道具 | src/game/models.js(`SHIP_LV`、`knightBody`、`unicornBody`、`goblin` / `bat` + `batWings` / `blackKnight`、`rockTemplate`、`itemTemplate`) |
| 玻璃地面 / 樹 / 塔 / 教堂 / 場景主題 | src/game/sea.js(`SEA_FS`、`makeTree` / `makeProp`);配色與物件清單 palette.js `THEMES` |
| 音效(鐘 `bell`、管風琴 `organ`、魯特琴 `lute`、號角 `horn`) | src/core/audio.js |
| 標題的玫瑰花窗 / HUD | index.html `<style>`(選擇器加 `html` 前綴才蓋得過 hud.css) |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 角色在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
