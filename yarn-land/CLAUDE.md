# CLAUDE.md — 毛線小世界 YARN LAND(yarn-land/)

毛線娃娃 / 布偶世界主題 3D 手機射擊(地面縱向捲軸),由 sengoku 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `yarn-land/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/yarn-land/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md,「畫風 hook」一節),這個目錄只放「皮」。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5193。
- 【2026-09-29 使用者選題】「更跳脫的風格 1~5 都做」的第 4 款:毛線娃娃。
- **針織紋在材質裡**:src/core/palette.js `TOON.patch` 在 vertex shader 加 `vKnitP`(物件座標 × modelMatrix 的縮放)、
  `vKnitN`(物件法線),fragment 用三平面挑兩個軸畫 V 字針目。用物件座標 → 紋路黏在角色身上不會「游泳」;
  乘縮放 → 大小不同的東西針目一樣大。只影響 cel 材質(flat 的發光物、子彈不受影響)。
- 描線是「深一點的同色毛線」(src/skin.js `INK_HOOKS.post`:`line = col * 0.45`)+ 取樣位置微抖(毛茸茸)。
- 最後一道 pass(`FABRIC`):布紋 + 柔光 + 四周虛線縫邊。「布紋」鈕 = `uFilter`。共用的 `#crt` 紙紋在 index.html 關掉。
- 地面布料 7 種在 sea.js `fabric(k, p)`;換場景時顏色慢慢過渡、花樣直接切(兩種花樣混在一起會很怪)。
- 內部型別沿用 star-bees 的名字:`bee` = 襪子怪、`bfly` = 小飛蛾(飛在半空,翅膀是 'flag' + `userData.side`)、
  `boss` = 剪刀螃蟹(打兩下)、`rock` = 大鈕扣(軸朝 x,像輪子一樣滾);`rescue` 流程 = 道具 W 泰迪熊(`callWingman`,模型 `ally${evo}`)。
- 臉的零件:models.js `buttonEye()`(鈕扣眼)、`stitchMouth()`(縫線嘴,smile = -1 是生氣)。

## 路由
| 要改 | 位置 |
|---|---|
| 三十段關卡表 / 場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS` |
| 文字 / 手感 / 布紋 pass / 毛線描線 | src/skin.js `TEXT` / `FEEL` / `LOOK`(`FABRIC`、`INK_HOOKS`) |
| 針織紋材質 | src/core/palette.js `TOON` |
| 大魔王 | src/game/boss.js;模型 models.js `bigTemplate`(`machineBody` / `queenBody` + `queenExtras` / `tangleBody` + `needleRing` / `goldButtonBody`) |
| 小毛 10 段 / 泰迪熊 / 敵人 / 徽章道具 | src/game/models.js(`SHIP_LV`、`dollBody`、`sockPuppet` / `moth` + `mothWings` / `scissorCrab`、`rockTemplate`、`itemTemplate`) |
| 地面布料 / 樹 / 鈕扣 / 線軸 / 小屋 / 場景主題 | src/game/sea.js(`SEA_FS` 的 `fabric()`、`makeTree` / `makeProp`);配色與物件清單 palette.js `THEMES` |
| 音效(音樂盒 `box`、啵 `pop`、玩具鼓) | src/core/audio.js |
| 標題的毛氈補丁 / HUD | index.html `<style>`(選擇器加 `html` 前綴才蓋得過 hud.css) |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 角色在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。
- 毛氈小屋往畫面上方仰倒 `LEAN`(sea.js),出場用 scale.y。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
