# CLAUDE.md — 停車練習場(C:\Users\hyder\car)

3D 網頁停車練習遊戲:第一人稱開車 → 下車 → 俯視圖看成果 + 評分。玩法 / 操作見 README.md。

## 事實卡
- 技術:Vite 6 + three ^0.180(npm),純前端,無圖檔無音檔(全部程序生成)。
- 啟動:`npm run dev`(port 5180,`.claude/launch.json` 名稱 `parking`);`npm run build` → dist/。
- 風格來源:使用者指定「善用類似 sakura-crossing 的技術」
  (https://github.com/Kenton-GMI/sakura-crossing)。toon.js / post.js 改編自它(MIT,見 THIRD_PARTY_NOTICES.md)。
  新增視覺元素一律用 `cel()` / `flat()`(src/core/toon.js),顏色一律取 `PAL`(src/core/palette.js)。
- git:公開庫 https://github.com/hyder13/parking-practice(main)。push main → `.github/workflows/deploy.yml`
  自動部署 GitHub Pages:https://hyder13.github.io/parking-practice/(`vite.config.js` base './' 不可拿掉)。
- 同一個 repo 的 `star-bees/` 是另一款遊戲(星際小蜜蜂 3D,獨立 Vite 專案,見 star-bees/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/star-bees/。
- 同一個 repo 的 `sky-aces/` 是星際小蜜蜂換皮成二戰空戰的版本(蒼空王牌 1945,見 sky-aces/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/sky-aces/。
- 同一個 repo 的 `monkey-king/` 是西遊記主題換皮(齊天大聖,見 monkey-king/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/monkey-king/。
- 同一個 repo 的 `three-kingdoms/` 是三國主題換皮(三國英雄,見 three-kingdoms/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/three-kingdoms/。
- 同一個 repo 的 `temple-fair/` 是台灣廟會主題換皮(鬧熱廟會,見 temple-fair/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/temple-fair/。
- 同一個 repo 的 `yokai-night/` 是浮世繪百鬼夜行主題換皮(百鬼夜行,見 yokai-night/CLAUDE.md),第一款用共用引擎做的,
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/yokai-night/。
- 同一個 repo 的 `night-market/` 是台灣夜市主題換皮(夜市美食大戰,見 night-market/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/night-market/。
- 同一個 repo 的 `animal-brawl/` 是動物大亂鬥主題換皮(見 animal-brawl/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/animal-brawl/。
- 同一個 repo 的 `sengoku/` 是日本戰國(織田信長)主題換皮(天下布武,見 sengoku/CLAUDE.md),
  deploy.yml 會一起 build 並放到 https://hyder13.github.io/parking-practice/sengoku/。
- 同一個 repo 的 `arcade-core/` 是上面八款換皮(sky-aces / monkey-king / three-kingdoms / temple-fair / yokai-night / night-market / animal-brawl / sengoku)的共用引擎
  (不是獨立專案,各款 vite.config.js 用 `@arcade` alias 引入;見 arcade-core/CLAUDE.md)。star-bees 不用它。
  改 arcade-core = 八款一起變 → 每款都要 build + 實測。

## 授權邊界
- 【使用者授權 2026-09-28】本專案 `git push` 到 origin main(= 自動部署 GitHub Pages 公開網站)不用再問;
  push 前仍須 build 通過 + 實測。force push、改 repo 設定 / 可見度、刪分支仍要先問。

## 路由(要改什麼 → 看哪裡)
| 要改 | 檔案 / 區塊 |
|---|---|
| 車型尺寸、軸距、轉向角 | src/game/cars.js `CARS` |
| 車輛外觀 / 內裝 / 駕駛眼位 | src/game/cars.js `buildCar` |
| 場景、車格大小(難度餘裕) | src/game/world.js `buildLot` / `buildStreet` |
| 物理、換檔、碰撞 | src/main.js `updateCar` |
| 評分規則與扣分 | src/main.js `evaluate` |
| 後照鏡 / 倒車影像 | src/game/mirrors.js |
| 手機觸控操作 / 版面 | src/game/touch.js;index.html 的「觸控 / 手機版」CSS 區塊(`--edge-*` = 安全區 + 手勢區邊距) |
| 描線 / 調色 | src/core/post.js(俯視圖的描線淡出距離在 main.js `updateCamera` 呼叫 `setInkFade`) |

## 座標慣例(改錯會整個反掉)
- 車身 local:+z = 車頭,**+x = 駕駛側(左駕)**。heading `a`:前方 = (sin a, cos a),a 增加 = 左轉。
- OBB `{x,z,hw,hl,a}`:hw 沿右軸 (cos a, −sin a),hl 沿前軸。所有碰撞 / 雷達 / 評分共用 src/core/geom.js。
- `spot.a` = 車頭朝內進格的方向;`spot.expect` = 期望停妥的車頭方向(倒車入庫 = a+π)。
- 倒車時轉向反應相反:v<0 時要讓 heading 變小得打**左**(steer > 0)。

## 測試方法
- 瀏覽器分頁隱藏時 requestAnimationFrame 會暫停 → 用 `window.__game.step(秒, dt, draw)` 手動推進模擬。
  `__game` 還有 `S`、`car`、`spot`、`keys`(設 `keys.KeyW=true` 模擬按鍵)、`onKey`、`evaluate`、`obstacles`。
- 2026-09-26 驗證:7 車 × 3 場景 × 3 難度 = 63 組,起點無碰撞、完美停放不撞且評分入格;
  腳本實際倒車入庫(普通難度)轎車 / 休旅 / 貨卡 / 廂型 / 巴士皆 S 或 A、零碰撞。

- 手機版面驗證(2026-09-28):8 種檢查(568x320、667x375、740x360、844x390、932x430,後三者再加模擬瀏海
  safe-area 59px)× 走路 / 開車 D / 開車 R / 俯視 4 種狀態,控制之間零重疊、離側邊 ≥24px(瀏海時 ≥59)、離底 ≥24px。
  觸控用 `?touch=1` 強制,合成 PointerEvent 模擬按壓(見 touch.js 的 `cap()` 包 setPointerCapture)。

## 雷區
1. three r180 的 `MeshToonMaterial` 建構子不收 `flatShading`(每個材質噴 warning)→ 建構後再 `mat.flatShading = …`。
2. 起點必須在場地牆內:大巴士很長,`buildLot` 的 minX 依起點動態加長(否則一開局就卡牆)。
3. 鏡子 render target 不走描線後製;HUD quad 用 `scale.x = -1` 做鏡像,位置對齊 HTML `.mirror` 框
   (框用 `visibility:hidden` 而非 `display:none`,不然量不到尺寸)。
4. 【2026-09-28】Windows 應用程式控制會擋 rollup 原生檔 `rollup.win32-x64-msvc.node` → `npm run dev` 掛掉
   (錯誤訊息誤導成 npm optional deps bug)。已在 package.json 用 `overrides` 換成 `@rollup/wasm-node`,
   **不要移除**;重裝請刪 node_modules + package-lock 再 `npm install`。
