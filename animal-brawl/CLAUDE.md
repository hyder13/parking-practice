# CLAUDE.md — 動物大亂鬥 ANIMAL BRAWL(animal-brawl/)

卡通動物主題 3D 手機射擊(地面縱向捲軸),由 three-kingdoms 換皮。玩法 / 關卡見 README.md。
住在 https://github.com/hyder13/parking-practice 的 `animal-brawl/` 子資料夾;上層 deploy.yml 會一起 build,
公開網址 https://hyder13.github.io/parking-practice/animal-brawl/(`vite.config.js` base './' 不可拿掉)。

## 事實卡
- 共用引擎在 `../arcade-core`(見 arcade-core/CLAUDE.md),這個目錄只放「皮」:src/skin.js(文字 / 手感 / 調色)、
  core/(palette、pixel、audio)、game/(models、sea、boss、stages)。改引擎會影響所有換皮 → 每款都要 build + 測。
- Vite 6 + three ^0.180,純前端、無圖檔音檔。`npm run dev` → port 5188。
- 【2026-09-29 使用者選題】「動物大亂鬥」。背景用 three-kingdoms 的野外(草地 + 小路 + 河),模型基礎(`chibi` 有 `hg` 頭部群組)用 temple-fair 的。
- 發光物(子彈、光環、陰影、塵土)用 flat / Basic + `depthWrite:false`,不然會被描線 pass 描黑。
- 內部型別沿用 star-bees 的名字:`bee` = 兔子(一蹦一蹦)、`bfly` = 鸚鵡(飄在半空、拍翅膀)、`boss` = 野豬(打兩下,被打發紅)、
  `rock` = 刺蝟球(往前滾);跳法在 src/skin.js `FEEL.hop`。
  `beam` 狀態 = 野豬停在玩家前方連丟橡實;`rescue` 流程 = 道具 W 三花貓(`callWingman`,模型 `ally${evo}`)。
  背景類別名稱沿用 `Sea`(src/game/sea.js),內容是野外。
- 鸚鵡的翅膀是 `parrotWings` 在 extras 加的 'flag' 群組(不烤),`flapWings` 看 `userData.amp / freq / side` 左右對稱拍動。
- 動物臉的教訓:臉(face)跟頭(head)同色、只把「嘴筒 / 臉頰」做成白色,才不會看起來像「橘色頭髮的小孩」。
- 樹 / 大物件每一個都先把所有樣式蓋好(`makeTree` 5 種、`makeProp` 7 種),出場時依 THEMES 的 `tree` / `props` 只顯示一種。
- SMART bot 6 次到第 2 / 5 / 6 / 6 / 6 / 6 回合。

## 路由
| 要改 | 位置 |
|---|---|
| 三十回合關卡表 / 每回合場景 / 機制提示 | src/game/stages.js `STAGE_TABLE` / `STAGE_THEME` / `TWIST_HINTS`;機制數值在 arcade-core/engine/field.js |
| 文字訊息 / 誇獎 / 成就 / 手感 | src/skin.js `TEXT` / `FEEL`;描線調色 `LOOK` |
| 猛獸(衝進來、落地震畫面、紙片退場) | src/game/boss.js;模型 models.js `bigTemplate`(`lionBody` / `crocBody` / `gorillaBody` + `bananaRing` / `hamsterBody` + `seedRing`) |
| 柴犬 10 段 / 三花貓 / 小動物 / 寵物罐頭道具 | src/game/models.js(`SHIP_LV`、`shibaBody`、`chibi`、`rabbit` / `parrot` / `boar`、`rockTemplate`、`itemTemplate`) |
| 地面 / 樹形 / 大物件 / 石頭 / 落葉 / 場景主題 | src/game/sea.js(`makeTree` / `makeProp`);配色與樹形 / 物件清單 palette.js `THEMES` |
| 音效(汪 `bark`、木琴 `marimba`、鼓 `drum`、鳥叫 `chirp`) | src/core/audio.js(合成器 + 共用音效在 arcade-core/audio/synth.js) |
| HUD / 觸控 / 翻滾鈕 / 紙紋 | arcade-core/engine/main.js、arcade-core/ui/hud.css、index.html |

## 座標慣例
- 遊戲平面 = 世界 XY(z=0,z 朝鏡頭)。地面在 z = −GROUND_Z(1.6),角色腳下的陰影貼在地面上。
- 動物(`chibi` / `standing`)在自己的座標系站立(頭 +y、臉 +z),再往後仰 LEAN;`upright` 不跟著前進方向轉。
- 鱷魚趴在地上(不仰):頭 / 大嘴朝 −y(朝玩家),尾巴朝 +y。

## 測試
- `window.__game.step(秒, dt, draw)`、`__game.start(n)`、`__game.spawn(type)`(圖鑑截圖用)、`__game.game.input.loop = true`。
- 2026-09-29 驗證(Playwright + Chromium 390x844 / 844x390 / 1280x720 / 360x640):
  無敵 bot 從第 1 / 11 / 21 / 29 回合連打無 console error;SMART bot 6 次到第 2~6 回合。
