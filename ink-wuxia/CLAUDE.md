# CLAUDE.md — 水墨江湖 INK & SWORD(ink-wuxia/)

中國水墨畫風格的武俠 3D 手機射擊(地面縱向捲軸),由 sengoku 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `ink-wuxia/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/ink-wuxia/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md,「畫風 hook」一節),這個目錄只放「皮」。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5192。
- 【2026-09-29 使用者選題】「更跳脫的風格 1~5 都做」的第 3 款:水墨武俠。
- **畫風在 shader 裡**:src/skin.js `LOOK.style`(`INK`:墨分五色 + 宣紙 + 顆粒 + 墨暈 + 朱紅保留 + 一點淡彩)、
  `LOOK.inkHooks`(`INK_HOOKS`:毛筆粗細 + 飛白)。標題「宣紙」鈕 = `uFilter`(關紙紋和墨暈)。
- 畫面最後會被轉成墨色 → **配色只看亮度**;紅色要用飽和的朱紅(`c.r - max(c.g, c.b)` 夠大才會被保留成朱砂色),其他東西不要帶紅。
- 畫面是宣紙白 → HUD 改成墨色字 + 紙色光暈(index.html `<style>`)。hud.css 比 index.html 晚載入(main.js import),
  所以 index.html 的選擇器都加 `html` 前綴(`html:root`、`html #hud`…)才蓋得過去。
- 子彈:玩家 = 墨色新月劍氣、敵人 = 朱紅飛鏢(紅色 = 危險,一眼分得出來)。
- 內部型別沿用 star-bees 的名字:`bee` = 山賊、`bfly` = 飛賊(輕功,飛在半空)、`boss` = 鐵頭陀(打兩下)、
  `rock` = 酒罈;`rescue` 流程 = 道具 W 仙鶴(`callWingman`,模型 `ally${evo}`)。
- 字(旗子、酒罈紅紙、秘笈)是 canvas 畫的:models.js `bannerTex` / `noboriMat`;`addNobori(rig, pos, 字, 底色, 高度, 字色)` 參數順序別弄錯(曾經把字色傳進高度 → NaN)。
- 紅布條(頭帶、圍巾)是 'flag' 零件,`flapWings` 會讓它擺動(models.js `ribbon`)。

## 路由
| 要改 | 位置 |
|---|---|
| 三十回關卡表 / 場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS` |
| 文字 / 手感 / 水墨 pass / 毛筆描線 | src/skin.js `TEXT` / `FEEL` / `LOOK`(`INK`、`INK_HOOKS`) |
| 強敵 | src/game/boss.js;模型 models.js `bigTemplate`(`banditKingBody` / `dragonBody` + `dragonCoil` / `demonBody` + `talismanRing` / `scrollBody`) |
| 劍客 10 段 / 仙鶴 / 敵人 / 卷軸道具 | src/game/models.js(`SHIP_LV`、`heroBody`、`sword`、`craneBody`、`bandit` / `thief` / `ironMonk`、`rockTemplate`、`itemTemplate`) |
| 地面 / 竹松梅柳 / 亭子 / 客棧 / 荷塘 / 場景主題 | src/game/sea.js(`SEA_FS`、`makeTree` / `makeProp`);配色與物件清單 palette.js `THEMES` |
| 音效(琵琶 `pluck`、竹笛 `flute`、大鼓、銅鑼) | src/core/audio.js |
| 標題(毛筆字 + 紅印章)/ HUD 墨色 | index.html `<style>` |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 角色在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。
- 背景裡「立著」的東西(亭子、客棧)往畫面上方仰倒 `LEAN`(sea.js),出場用 scale.y。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
