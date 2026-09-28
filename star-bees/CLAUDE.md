# CLAUDE.md — STAR BEES(star-bees/)

懷舊小蜜蜂 3D 手機射擊。玩法 / 關卡見 README.md。目前住在 https://github.com/hyder13/parking-practice 的 `star-bees/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/star-bees/(`vite.config.js` base './' 不可拿掉)。
本資料夾自帶 `.github/workflows/deploy.yml`,是之後搬去獨立 repo(hyder13/star-bees)時用的;在子資料夾裡不會被 GitHub 執行。


## 事實卡
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5181。
- 渲染核心來自上層停車專案:src/core/toon.js(`cel()` / `flat()`)、src/core/post.js(`Pipeline`,改成可傳 `gradeOpts` / `inkOpts`)。
  新視覺元素一律用 `cel()` / `flat()`,顏色取 `PAL`(src/core/palette.js)。
- 太空背景要純黑 → Pipeline 的 `uLift` 設 0。發光物(子彈、爆炸、光束、星星)用 flat + `depthWrite:false`,不然會被描線 pass 描黑。

## 路由
| 要改 | 位置 |
|---|---|
| 關卡難度 / 波次 / 分數 | src/game/config.js `STAGES` / `SCORE` |
| 進場 / 俯衝軌跡 | src/game/paths.js `ENTRY`、`dive*` |
| 遊戲規則(狀態機、光束、救援、碰撞) | src/game/game.js |
| 角色模型 | src/game/models.js |
| 背景(星星、星雲、行星、每關配色) | src/game/space.js、palette.js `THEMES` |
| 爆炸 / 光束特效 | src/game/fx.js |
| 音效(WebAudio 合成) | src/core/audio.js |
| HUD / 觸控 / 鏡頭 fit | src/main.js、index.html |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。寬 FW=22 固定;高 FH 依螢幕比例 30~42(`setFieldHeight`,ESM live binding)。
- 陣型 / 進場軌跡相對「上緣」(`DY_TOP`、`ROW0`);玩家 / 俯衝軌跡相對「下緣」(`PLAYER_Y`)。寫新軌跡要沿用這個規則。
- 模型 local +y = 機頭;heading θ 的前方 = (−sin θ, cos θ),面朝下 = π。

## 測試
- `window.__game.step(秒, dt, draw)` 手動推進(分頁隱藏時 rAF 會停);`__game.start(n)` 從第 n 關開始;
  `__game.game` 可直接呼叫 `launch(e)`、`hitEnemy(e)`。
- 2026-09-28 驗證:Playwright + Chromium(390x844 / 360x640 / 844x390 / 1280x720)五關全部跑完無 console error;
  光束捕獲 → 救回 → 雙機流程正常;獎勵關結算、第 5 關後循環正常。
