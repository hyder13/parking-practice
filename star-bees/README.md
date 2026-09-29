# STAR BEES 星際小蜜蜂 3D

懷舊「小蜜蜂」街機射擊的 3D 化手機版。沿用停車練習場的卡通渲染(cel 陰影 + 深度描線 + 調色),
但保留街機的純黑太空、彩色閃爍像素星、點陣字 HUD 與點陣小圖示。全部程序生成,沒有圖檔 / 音檔。

線上玩:https://hyder13.github.io/parking-practice/star-bees/

## 執行
```
npm install
npm run dev      # http://localhost:5181 (手機同網段可連 Network 位址)
npm run build    # → dist/
```
網址加 `?touch=1` 可在桌機強制觸控模式。

## 操作
- 手機:手指**拖曳**上下左右移動(相對移動,手指不會擋住戰機),**按著**自動連射
- 鍵盤:方向鍵 / WASD 移動,SPACE / Z 射擊,P 暫停,M 靜音
- 戰機可以在畫面下方約 40% 的範圍內自由移動

## 30 關(每關都有自己的名字和變化)
關卡表在 `src/game/config.js` 的 `STAGE_TABLE`。每關開場會顯示關卡名稱和這關要注意的機制。
難度照 30 關壓縮:前期一關 20 秒左右,越後面敵人越多、越快、BOSS 越硬(最後一關約 1 分半)。

| 關 | 名稱 | 陣型 | 機制 | 關 | 名稱 | 陣型 | 機制 |
|---|---|---|---|---|---|---|---|
| 1 | FIRST CONTACT | 方陣 | 基本 | 16 | BARRAGE | 方陣 | 整排齊射 |
| 2 | ARCH FORMATION | 拱形 | 基本 | 17 | SUICIDE SQUAD | V | 自殺俯衝 + 護衛 |
| 3 | BONUS | – | 獎勵關 | 18 | BONUS | – | 獎勵關 |
| 4 | SNIPERS | V | 陣型瞄準射擊 | 19 | DARK BEAMS | 倒 V | 光束 + 蜂群 |
| 5 | METEOR SHOWER | 方陣 | 隕石 | 20 | DOUBLE TROUBLE | 拱形 | 狙擊 + 雙 BOSS |
| 6 | ROYAL ESCORT | 拱形 | 王帶護衛 | 21 | IRON RAIN | 波浪 | 裝甲 + 隕石 |
| 7 | KAMIKAZE | 波浪 | 快速俯衝不開火 | 22 | DEAD EYE | V | 狙擊 + 蛇行 |
| 8 | BONUS | – | 獎勵關 | 23 | BONUS | – | 獎勵關 |
| 9 | BEAM NIGHT | 倒 V | 光束多、王更硬 | 24 | BULLET HELL | 方陣 | 齊射 + 蜂群 |
| 10 | TWIN MONARCHS | 方陣 | 雙 BOSS 連戰 | 25 | STEEL KAMIKAZE | 拱形 | 自殺俯衝 + 裝甲 |
| 11 | SWARM | 波浪 | 又快又多 | 26 | METEOR STORM | 波浪 | 隕石風暴 + 光束 |
| 12 | ARMORED | V | 裝甲(打兩下) | 27 | ALL-OUT ATTACK | 倒 V | 狙擊 + 蛇行 + 護衛 |
| 13 | BONUS | – | 獎勵關 | 28 | BONUS | – | 獎勵關 |
| 14 | ROCK & SNIPE | 拱形 | 隕石 + 狙擊 | 29 | FORTRESS | V | 齊射 + 裝甲 + 蜂群 |
| 15 | ZIGZAG | 波浪 | 蛇行俯衝 | 30 | FINAL BATTLE | 方陣 | 三 BOSS 連戰 |

- BOSS:女王蜂(扇形彈 / 瞄準連射 / 召喚)、帝王蛾(旋轉彈幕 / 彈雨)、母艦(環狀彈 / 召喚)輪流出現,血量低於一半會暴走;
  進場時有護盾打不動,降到定位才開打;第 4 關起還會持續補瞄準彈;
  獎勵關最後是不會攻擊的黃金飛碟。
- 第 12 關起有增援(陣型剩不多時再補滿一輪),第 20 關起兩輪。
- 每 5 關一個檢查點(1 / 6 / 11 / 16 / 21 / 26),標題畫面可以選(測試版全部開放)。
- 打完 30 關之後進入 EXTRA:30 關再輪一次、整體加速。

## 成長系統
| 系統 | 內容 |
|---|---|
| 火力 P | Lv.1 單發 → Lv.6 七向散射 + 兩翼砲;死掉只降 1 級 |
| 道具 | **P** 火力、**R** 連射 10 秒、**S** 護盾擋一次、**B** 炸彈(清彈幕 + 炸掉在飛的敵人)、**1UP**;靠近會被吸過來 |
| 進化 | 殺敵經驗累積,10 段外型:ROOKIE → SCOUT → FALCON → HAWK → RAPTOR → VALKYRIE → COMET → NOVA → SUPERNOVA → PHOENIX;射速、傷害跟著提升,死掉不會掉 |
| 雙機 | 被 BOSS 光束抓走的戰機,打下帶著它的王就能救回 |

## 小勝利(一直給回饋,但不擋畫面中央)
畫面中央只留流程訊息(STAGE / READY / WARNING / CLEAR),其他回饋都放在邊上:
- **右側連擊數字**:1.6 秒內連續擊墜,音高越來越高;5 / 10 / 20 / 35 / 50 / 75 / 100 連擊時「COMBO」字樣換成 NICE! … GODLIKE!;
  連擊結束顯示 +獎勵分數
- **戰機頭上小標籤**:吃道具(POWER Lv.3、RAPID、SHIELD、1UP)、進化(EVOLVED!)、雙機
- **底部狀態列**:火力格升級時閃一下、進化時 Lv 名稱與經驗條發光
- **左上角側欄**:成就(BOSS SLAYER、COMBO x10、MAX POWER、RESCUE HERO、STAGE 10/25/50/100 …,存在瀏覽器)
- 跳分只在大分數(400 以上)出現,跟原作一樣
- 過關評星:★ 過關、★★ 沒死、★★★ 沒死 + 最高連擊 ≥ 8,附加分
- 擊敗 BOSS / 進化時慢動作 + 大爆炸
- GAME OVER 顯示到達關卡、進化等級、最高連擊、擊墜數、命中率
