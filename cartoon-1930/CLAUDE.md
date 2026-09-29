# CLAUDE.md — 黑白卡通劇場 CARTOON REEL 1930(cartoon-1930/)

1930 年代黑白橡皮管卡通主題 3D 手機射擊(地面縱向捲軸),由 sengoku 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `cartoon-1930/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/cartoon-1930/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md),這個目錄只放「皮」。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5190。
- 【2026-09-29 使用者選題】「更跳脫的風格 1~5 都做」的第 1 款:1930 年代黑白卡通(換畫法,不只換題材)。
- **畫風在 shader 裡**:src/skin.js `LOOK.style`(最後一道全螢幕 pass:黑白 + 對比 + 顆粒 / 刮痕 / 灰塵 / 晃動 / 暗角 / 圓角片框)
  和 `LOOK.inkHooks`(描線每 1/12 秒抖一次)。標題「老膠卷」鈕 = `uFilter`(關掉顆粒刮痕,黑白保留)。
  共用的 `#crt` 紙紋在 index.html 用 CSS 關掉。HUD 用 CSS `filter: grayscale` 一起變黑白。
- 畫面最後一定是黑白 → **配色只看亮度**:角色黑身體 / 白手套 / 奶油臉,背景中灰;樹冠要比地面亮才不會變成黑團。
- 子彈(音符 / 奶油派)是不透明平塗,會被描線描上黑框(其他款的子彈是 depthWrite:false 的發光物)。
  背景飄的東西不要用音符(會跟子彈搞混)。
- 內部型別沿用 star-bees 的名字:`bee` = 跳舞的花、`bfly` = 小幽靈(飄在半空)、`boss` = 骷髏(打兩下,被打骨頭變暗)、
  `rock` = 滾動炸彈;`rescue` 流程 = 道具 W 小鋼琴(`callWingman`,模型 `ally${evo}`)。
- 角色零件:models.js `toon()`(橡皮管人偶)、`hose()`(彎彎的軟管手腳)、`pieEye()`(派切眼)、`glove()`、`shoe()`、`grin()`。
- 背景物件(樹 / 房子 / 帳篷…)出場後跟著 `BEAT` 一起壓扁彈起 + 左右晃(sea.js `step`)。

## 路由
| 要改 | 位置 |
|---|---|
| 三十集關卡表 / 場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS` |
| 文字 / 手感 / 底片畫風 / 描線抖動 | src/skin.js `TEXT` / `FEEL` / `LOOK`(`FILM`、`INK_HOOKS`) |
| 大反派 | src/game/boss.js;模型 models.js `bigTemplate`(`trainBody` / `moonBody` / `wolfBody` / `sackBody` + 各自的 ring) |
| 小咚 10 段星途 / 小鋼琴 / 敵人 / 唱片道具 | src/game/models.js(`SHIP_LV`、`dogBody`、`pianoBody`、`flower` / `ghost` / `skeleton`、`rockTemplate`、`itemTemplate`) |
| 地面 / 樹 / 房子 / 帳篷 / 墓碑 / 場景主題 | src/game/sea.js(`makeTree` / `makeProp` / `face`);配色與物件清單 palette.js `THEMES` |
| 音效(滑哨、彈簧、木琴、大號、汽笛) | src/core/audio.js |
| 標題的同心圓片頭 / HUD 黑白 | index.html `<style>` |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 角色在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。
- 背景裡「立著」的東西(房子、穀倉、墓碑)往畫面上方仰倒 `LEAN`(sea.js),出場用 scale.y。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
- 底片的時間 = `pipeline.time`(main.js tick 推進),`step()` 裡也會跑,截圖每次的顆粒 / 刮痕不同是正常的。
