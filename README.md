# 停車練習場 · Parking Practice

3D 網頁停車練習遊戲。走到車旁上車,用第一人稱(含三面後照鏡 + 倒車影像)停進黃色車格,
下車後用俯視圖檢查成果並評分。卡通渲染風格,全部程序生成,沒有任何圖檔 / 音檔。

**線上玩**:https://hyder13.github.io/parking-practice/(push 到 main 由 GitHub Actions 自動部署)

## 執行

```bash
npm install
npm run dev      # http://localhost:5180(.claude/launch.json 也用這個 port)
npm run build    # 輸出 dist/,任何靜態主機都能放
```

## 玩法

| 操作 | 按鍵 |
|---|---|
| 走路 / 開車 | `W` `A` `S` `D`(方向鍵也可) |
| 上車 / 下車(需停妥) | `E` |
| 前進(D 檔)/ 煞車・倒車(R 檔) | `W` / `S` —— 停住時按 `S` 自動入 R 檔 |
| 手煞車 | `Space` |
| 車內 / 車外視角 | `V` |
| 俯視圖(滾輪縮放) | `T` |
| 提交評分 | `Enter` |
| 重來(直接坐在車上) | `R` |
| 方向盤自動回正 開/關 | `C` |
| 雷達嗶聲 開/關 | `B` |
| 視線回正 | `F` |
| 選單 | `Esc` |

點一下畫面鎖定滑鼠即可轉頭(開車時可以回頭看後方);不鎖定時按住左鍵拖曳也行。

- **車型 7 種**:小型車、轎車、休旅車、跑車、廂型車、小貨卡、大巴士(軸距 / 轉向角 / 車身尺寸各不同,內輪差真實)。
- **場景 3 種**:倒車入庫(車頭朝外)、路邊停車(靠右路緣,車頭順向)、45° 斜角停車(車頭朝內)。
- **難度 3 級**:決定車格比車身多出多少空間。
- **駕駛輔助**:車內後視鏡、左右後照鏡、倒車影像(依方向盤角度畫預測軌跡 + 0.5 / 1 / 2 m 距離線)、前後雷達距離與嗶聲。
- **評分**:是否完全入格、角度偏差、左右 / 前後偏移、車頭方向、駕駛側開門空間、碰撞次數、多餘修正(換檔)次數。
  俯視圖同時畫出後軸(藍)與前軸(橘)軌跡,方便檢討路線。各組合最佳成績存在瀏覽器 localStorage。

## 技術

參考 [sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing) 的做法:

- **Vite + Three.js(npm)**,ES modules 分檔。
- **卡通渲染**:`MeshToonMaterial` + 手調色階 ramp,陰影面偏冷紫色(`src/core/toon.js`)。
- **3D→2D 後製**:以深度二階差分畫螢幕空間描線 → 動畫調色 → FXAA(`src/core/post.js`)。
- **程序生成**:天空漸層、雲、遠山、柏油貼圖、音效全部由程式產生。
- **幾何烘焙**:停放車輛依材質合併成少數 mesh,降低 draw call(後照鏡要把場景多畫 4 次)。

`src/core/toon.js`、`src/core/post.js` 改編自 sakura-crossing(MIT),授權見 `THIRD_PARTY_NOTICES.md`。

## 結構

```
src/main.js          狀態、輸入、車輛物理、評分、相機、HUD、主迴圈
src/core/            palette / toon / post / sky / geom(OBB 碰撞 + bake)/ audio
src/game/cars.js     車型規格 + 車輛模型(玩家車含內裝)
src/game/world.js    三種場景的生成
src/game/mirrors.js  後照鏡 / 倒車影像 render target 與 HUD 疊圖
```
