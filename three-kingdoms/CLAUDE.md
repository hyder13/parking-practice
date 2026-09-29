# CLAUDE.md — 三國英雄 THREE KINGDOMS(three-kingdoms/)

三國主題 3D 手機射擊(地面縱向捲軸),由 monkey-king 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `three-kingdoms/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/three-kingdoms/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5184。
- 渲染核心:src/core/toon.js(`cel()` / `flat()`)、src/core/post.js(`Pipeline`,ink `uThickness` 1.6)。
- 發光物(子彈、爆炸、塵土、光環、陰影)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字:`bee` = 黃巾兵、`bfly` = 魏軍弓兵、`boss` = 騎兵(打兩下)、`rock` = 投石;
  `beam` 狀態 = 騎兵停在玩家前方連弩;`rescue` 流程 = 道具 W 援軍關羽(`callWingman`,模型 `ally${evo}`,雙將時 ship2 也是關羽)。
  背景類別名稱沿用 `Sea`(src/game/sea.js),內容是地面戰場。
- 【2026-09-29 使用者決定】star-bees / sky-aces / monkey-king / three-kingdoms 是複製出來的四份程式,先衝版本、之後再考慮共用核心。
- 【2026-09-29】使用者給了一份「三國志 3D 立體繪本」提示詞當參考。採用了:Q 版大頭、立體書人偶、紙面彈起、Q 彈、紙片退場、敵將落地震畫面;
  沒採用:GSAP / OrbitControls CDN、three r128、單一 HTML、滑鼠粒子拖尾(手機沒有滑鼠)。繪本本身(書架 → 翻頁 → 問答)是另一款產品,尚未做。

## 路由
| 要改 | 位置 |
|---|---|
| 三十回關卡表 / 每回戰場 / 機制 | src/game/config.js `STAGE_TABLE` / `STAGE_THEME` / `TWISTS` / `stageCfg` |
| 躍馬、援軍、連弩、Q 彈、文字訊息 | src/game/game.js `startLoop`、`callWingman`、`updateBeam`、`updateEnemy`(squash / upright)、`beginStage` |
| 敵將(從上方衝進來、落地震畫面、紙片退場) | src/game/boss.js;模型 models.js `bigTemplate` |
| 趙雲 10 段官階 / 關羽 / 敵兵 / 錦囊 / 旗幟貼圖 | src/game/models.js(`SHIP_LV`、`riderBody`、`chibi`、`horse`、`bannerTex`、`itemTemplate`) |
| 地面 / 樹 / 軍營 / 石頭 / 落花 / 戰場主題 | src/game/sea.js;配色 palette.js `THEMES` |
| 音效 | src/core/audio.js |
| HUD / 觸控 / 躍馬鈕 / 宣紙紋理 | src/main.js、index.html |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 人物(`chibi`)在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;人物模型 `upright` 不跟著前進方向轉。
- 馬用俯視畫:玩家馬頭朝 +y、敵騎 / 呂布馬頭朝 −y。敵將模型本身就做成面朝 −y。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.game.input.loop = true`。
- 2026-09-29 驗證(Playwright + Chromium 390x844 / 844x390 / 1280x720 / 360x640):
  無敵 bot 從第 1 / 11 / 21 / 29 回連打到第 37 回無 console error;SMART bot(不會躍馬)6 次中 5 次到第 4~6 回、1 次倒在第 1 回的呂布。
