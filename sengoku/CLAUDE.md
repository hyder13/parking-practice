# CLAUDE.md — 天下布武 TENKA FUBU(sengoku/)

日本戰國(織田信長)主題 3D 手機射擊(地面縱向捲軸),由 animal-brawl 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `sengoku/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/sengoku/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md),這個目錄只放「皮」:src/skin.js(文字 / 手感 / 調色)、
  core/(palette、pixel、audio)、game/(models、sea、boss、stages)。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5189。
- 【2026-09-29 使用者選題】「日本戰國的題材(織田信長系列)」。
- 發光物(子彈、光環、陰影、火、硝煙)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字:`bee` = 足輕、`bfly` = 忍者(飛在半空)、`boss` = 武將(打兩下,被打變銅色)、
  `rock` = 焙烙玉(往前滾);跳法在 src/skin.js `FEEL.hop`。
  `beam` 狀態 = 武將停在玩家前方連發;`rescue` 流程 = 道具 W 秀吉參上(`callWingman`,模型 `ally${evo}`)。
  背景類別名稱沿用 `Sea`(src/game/sea.js),內容是戰場。
- のぼり旗 / 陣幕的字與家紋是 canvas 即時畫的:models.js `noboriMat`(直書,一到五個字)、sea.js `makuMat`。
- 俯視鏡頭看不到「立著的薄東西」:陣幕改成面朝鏡頭的布幕;天守閣 / 馬防柵往畫面上方仰倒 `CASTLE_LEAN`,
  出場動畫用 scale.y(從底邊往上展開),其他物件用 scale.z。
- SMART bot 6 次到第 2 / 5 / 5 / 5 / 6 / 6 戰。

## 路由
| 要改 | 位置 |
|---|---|
| 三十戰關卡表 / 每一戰的戰場 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS`;機制數值在 arcade-core/engine/field.js |
| 文字訊息 / 誇獎 / 成就 / 手感 | src/skin.js `TEXT` / `FEEL`;描線調色 `LOOK` |
| 大名(衝進來、落地震畫面、紙片退場) | src/game/boss.js;模型 models.js `bigTemplate`(`takedaBody` / `uesugiBody` / `akechiBody` + `fireRing` / `chestBody`) |
| 信長 10 段官位 / 秀吉 / 敵軍 / 印籠道具 | src/game/models.js(`SHIP_LV`、`nobunagaBody`、`teppo`、`chibi`、`ashigaru` / `ninja` / `bushou`、`rockTemplate`、`itemTemplate`) |
| 地面 / 樹 / 陣幕 / 馬防柵 / 天守閣 / 寺 / 殘骸 / 戰場主題 | src/game/sea.js(`makeTree` / `makeProp`、家的旗 `CLANS`);配色與物件清單 palette.js `THEMES` |
| 音效(法螺貝 `horagai`、陣太鼓 `taiko`、陣鐘 `gong`) | src/core/audio.js(合成器 + 共用音效在 arcade-core/audio/synth.js) |
| HUD / 觸控 / 一閃鈕 / 和紙 / 標題的「天下布武」印 | arcade-core/engine/main.js、arcade-core/ui/hud.css、index.html(`.seal`) |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 人物(`chibi`)在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
- 2026-09-29 驗證(Playwright + Chromium 390x844 / 844x390 / 1280x720 / 360x640):
  無敵 bot 從第 1 / 11 / 21 / 29 戰連打無 console error;SMART bot 6 次到第 2~6 戰。
