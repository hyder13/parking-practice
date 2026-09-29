# SKY ACES 1945 蒼空王牌 3D

二戰縱向捲軸空戰的 3D 化手機版(1942 / 1943 的味道)。由 STAR BEES 星際小蜜蜂 3D 整個換皮而來:
玩法骨架(陣型 → 俯衝 → 關底 BOSS、30 關、火力 / 晉升 / 連擊)沿用,
畫面換成從高空往下看的大海 + 島嶼 + 艦隊 + 雲,角色全部換成螺旋槳飛機。
沿用停車練習場的卡通渲染(cel 陰影 + 深度描線 + 調色)。全部程序生成,沒有圖檔 / 音檔。

## 執行
```
npm install
npm run dev      # http://localhost:5182 (手機同網段可連 Network 位址)
npm run build    # → dist/
```
網址加 `?touch=1` 可在桌機強制觸控模式。

## 操作
- 手機:手指**拖曳**上下左右移動,**按著**自動連射;**另一指點一下**或按右下 **LOOP** 鈕 = 翻筋斗
- 鍵盤:方向鍵 / WASD 移動,SPACE / Z 射擊,**X / SHIFT 翻筋斗**,P 暫停,M 靜音
- **翻筋斗(LOOP)**:1942 的招牌。飛機往鏡頭方向拉起翻一整圈,約 1.25 秒無敵(不能射擊),每關 3 次

## 從星際小蜜蜂換了什麼
| 星際小蜜蜂 | 蒼空王牌 |
|---|---|
| 純黑太空 + 像素星 + 行星 | 大海 shader(洋流色塊 + cel 浪花 + 反光)+ 島嶼 / 驅逐艦 / 巡洋艦 / 航艦(帶航跡)/ 浮冰 + 低空雲團,全部以同一速度捲動、透視產生視差 |
| 5 組星雲配色 | 7 種天候:早晨、熱帶、艦隊、夕陽、暴風雨、極地、夜晚(海色 + 光線一起換) |
| 蜂 / 蝶 / 王 | 戰鬥機(橄欖綠)/ 俯衝轟炸機(鐵鏽橘)/ 雙發重戰機(鐵灰,打兩下,冒火變色),螺旋槳會轉 |
| 牽引光束抓戰機 | 重戰機停在你上方**左右掃射**;雙機改由道具 **W 僚機**叫來 |
| 隕石 | 斜飛過來的**火箭**(打兩下) |
| 女王蜂 / 帝王蛾 / 母艦 / 黃金飛碟 | **空中堡壘**(四發重轟)/ **飛翼轟炸機** / **飛行船** / 黃金運輸機(獎勵關) |
| BOSS 從上方降下 + 護盾 | BOSS 從**玩家背後超車爬升**(1943 風格,進場中在玩家上空打不到),機頭朝上被你追著打;擊落時冒煙打轉墜海 |
| 進化 ROOKIE → PHOENIX | 晉升 CADET → ENSIGN → PILOT → LIEUT. → CAPTAIN → MAJOR → COLONEL → ACE → TOP ACE → LEGEND:Lv3 翼砲、Lv4 副油箱、Lv5 變成雙發雙尾桁(P-38 風格)、Lv6 翼下火箭、Lv7 進攻條紋、Lv8 三發 + 凝結尾、Lv9 紅色塗裝、Lv10 金色傳說機 |
| 寶石道具 | **降落傘補給箱**:P 火力 / R 連射 / S 護盾 / B 空襲(清彈幕)/ W 僚機 / 1UP |
| 雷射音效 | 機槍「噠噠」、俯衝呼嘯、引擎低吼、軍號出擊曲(全部 WebAudio 合成,原創旋律) |

## 30 個任務
關卡表在 `src/game/config.js` 的 `STAGE_TABLE`,每關的天候 = `THEMES[(n-1) % 7]`。

| # | 名稱 | 機制 | # | 名稱 | 機制 |
|---|---|---|---|---|---|
| 1 | FIRST SORTIE | 基本 | 16 | FLAK CURTAIN | 整排齊射 |
| 2 | ISLAND HOP | 基本 | 17 | DEATH DIVE | 衝撞 + 護航 |
| 3 | BONUS | 獎勵關 | 18 | BONUS | 獎勵關 |
| 4 | SNIPER SQUADRON | 編隊瞄準射擊 | 19 | NIGHT RAIDERS | 掃射 + 蜂群 |
| 5 | ROCKET RAIN | 火箭 | 20 | DOUBLE TROUBLE | 狙擊 + 雙 BOSS |
| 6 | ESCORT DUTY | 重戰機帶護航 | 21 | STEEL RAIN | 裝甲 + 火箭 |
| 7 | RAMMERS | 高速衝撞不開火 | 22 | DEAD EYE | 狙擊 + 蛇行 |
| 8 | BONUS | 獎勵關 | 23 | BONUS | 獎勵關 |
| 9 | STRAFING RUN | 掃射多、重戰機更硬 | 24 | BULLET STORM | 齊射 + 蜂群 |
| 10 | TWIN GIANTS | 雙 BOSS 連戰 | 25 | STEEL RAMMERS | 衝撞 + 裝甲 |
| 11 | SWARM | 又快又多 | 26 | ROCKET STORM | 火箭彈幕 + 掃射 |
| 12 | IRON WINGS | 裝甲(打兩下) | 27 | ALL-OUT ATTACK | 狙擊 + 蛇行 + 護航 |
| 13 | BONUS | 獎勵關 | 28 | BONUS | 獎勵關 |
| 14 | CROSSFIRE | 火箭 + 狙擊 | 29 | SKY FORTRESS | 齊射 + 裝甲 + 蜂群 |
| 15 | ZIGZAG | 蛇行俯衝 | 30 | FINAL MISSION | 三 BOSS 連戰 |

每 5 關一個檢查點(1 / 6 / 11 / 16 / 21 / 26);打完 30 關進入 EXTRA(再輪一次、整體加速)。

## 小勝利(不擋畫面中央)
右側連擊數字(NICE! … GODLIKE!)、戰機頭上小標籤(POWER Lv.3 / PROMOTED! / WINGMAN!)、
底部狀態列(火力格 / LOOP 剩餘次數 / 軍階經驗條)、左上角成就側欄(GIANT KILLER、CAPTAIN RANK、LEGEND ACE …)、
過關評星、擊落 BOSS 慢動作。

## 授權
渲染核心改編自 [sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing)(MIT),見 THIRD_PARTY_NOTICES.md。
