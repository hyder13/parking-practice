/**
 * 全場唯一的調色盤。
 * 大方向:台灣夜市。深紫藍的夜空色地面、霓虹招牌(桃紅 / 青 / 黃)、暖黃燈泡、
 * 金黃酥脆的炸物、紅通通的辣椒;角色是 Q 版大頭的小吃貨 + 長了臉的小吃,再交給 cel 陰影與描線。
 */
export const PAL = {
  sea: 0x2a2436,
  ink: 0x241a24,

  // light
  key: 0xfff0dc,
  fill: 0xc8b8ff,
  rim: 0xff9ad0,
  hemiSky: 0xfff4f0,
  hemiGround: 0x6a5a7a,

  // 小吃貨(玩家)
  shipWhite: 0xf8f4ec,
  shipRed: 0xff5a4a,     // T 恤
  shipBlue: 0x3a8ad8,    // 短褲
  shipCyan: 0xfff2c0,
  engine: 0xffe08a,
  captive: 0xe8322e,
  captiveDark: 0x8f1f2a,
  skin: 0xffe0c8,
  hair: 0x2a2226,

  // 臭豆腐(原本的蜂)
  beeBody: 0xd8a040,     // 炸得金黃
  beeBelly: 0xf0c870,
  beeBand: 0xa8682a,     // 焦脆的邊
  beeWing: 0x8ac860,     // 泡菜
  beeWingRim: 0x6a4020,
  eye: 0x2a2226,
  antenna: 0x2a2226,

  // 雞排(原本的蝶)
  bflyBody: 0xe0963a,
  bflyHead: 0xf4ecdc,    // 紙袋
  bflyWing: 0xc8762a,
  bflyRim: 0xd8322e,

  // 刈包(原本的王,打兩下;被打一下氣到發紅)
  bossBody: 0xf8f0e0,    // 白白的包子皮
  bossHead: 0x8a4a2a,    // 滷肉
  bossWing: 0x5ab84a,    // 香菜
  bossInner: 0xe0b878,   // 花生粉
  bossHit: 0xffa08a,
  bossHitHead: 0x6a2a1a,
  bossCrown: 0xffc23a,

  // shots / fx
  shot: 0x6a3a1e,        // 黑糖珍珠
  shotTip: 0xfff4e0,     // 珍珠上的亮點
  ebullet: 0xff3a2a,     // 辣椒
  ebulletCore: 0x4ab83a, // 辣椒蒂
  beam: 0xffe0a0,
  beam2: 0xff8a3a,
  white: 0xffffff,
  smoke: 0xf4f0ec,       // 攤子的蒸氣
  fire: 0xff7a2a,
};

/**
 * 夜市三十攤的場景。每一攤用 stages.js 的 STAGE_THEME 指定。
 *   side:街道兩側的地面(town = 屋頂群、harbor = 河濱的河水)
 *   deep / sea:兩側地面;road / grout:走道地磚與縫;petal:地上 / 空中的彩色紙屑;wet 1 = 下雨(地上有霓虹倒影)
 *   neon:招牌 / 燈串的主色;houses / temples / stalls / lanterns / petals / clouds:每 100 單位路程大約出現幾個(clouds = 蒸氣)
 */
export const THEMES = [
  { name: '小吃街', side: 'town', deep: 0x3a2c38, sea: 0x4a3a46, road: 0x8a8088, grout: 0x5a5058, petal: 0xffd24a, cloud: 0xf4f0ec, wet: 0,
    key: 0xffe0b8, keyI: 2.3, hemi: 0xffe8d8, houses: 6, temples: 0.3, stalls: 8, lanterns: 2.5, petals: 5, clouds: 3 },
  { name: '霓虹街', side: 'town', deep: 0x221a3a, sea: 0x30264e, road: 0x6a6480, grout: 0x443e58, petal: 0xff5ad0, cloud: 0xd8c8f0, wet: 0,
    key: 0xf0c8ff, keyI: 2.1, hemi: 0xd8b8f0, houses: 8, temples: 0.2, stalls: 6, lanterns: 3.5, petals: 6, clouds: 2 },
  { name: '遊戲區', side: 'town', deep: 0x2a2a44, sea: 0x3a3a5a, road: 0x8a8498, grout: 0x5a566a, petal: 0x5af0ff, cloud: 0xf0f0f8, wet: 0,
    key: 0xfff4e0, keyI: 2.4, hemi: 0xf0f0ff, houses: 5, temples: 0.2, stalls: 8, lanterns: 3, petals: 8, clouds: 1.5 },
  { name: '廟口', side: 'town', deep: 0x4a2a2a, sea: 0x6a3a34, road: 0xa89080, grout: 0x7a6258, petal: 0xff4a3a, cloud: 0xf4ece4, wet: 0,
    key: 0xffd8b0, keyI: 2.3, hemi: 0xffe4d0, houses: 4, temples: 1.4, stalls: 6, lanterns: 3, petals: 6, clouds: 2.5 },
  { name: '河濱', side: 'harbor', deep: 0x1a2a4a, sea: 0x2a4a7a, road: 0x908a90, grout: 0x605a64, petal: 0xffd24a, cloud: 0xe8eef8, wet: 0,
    key: 0xfff0e0, keyI: 2.3, hemi: 0xe8f0ff, houses: 1.5, temples: 0.3, stalls: 7, lanterns: 2, petals: 5, clouds: 2 },
  { name: '雨夜', side: 'town', deep: 0x1e2436, sea: 0x2a3248, road: 0x4a5264, grout: 0x343a4a, petal: 0xa8d8ff, cloud: 0xc8d4e8, wet: 1,
    key: 0xc8d8ff, keyI: 2.0, hemi: 0xb8c8e8, houses: 6, temples: 0.3, stalls: 6, lanterns: 2.5, petals: 14, clouds: 1.5 },
  { name: '過年夜市', side: 'town', deep: 0x4a1a22, sea: 0x6a2430, road: 0x9a7870, grout: 0x6a4a48, petal: 0xffd24a, cloud: 0xfff0e0, wet: 0,
    key: 0xffd8a0, keyI: 2.4, hemi: 0xffe0c8, houses: 6, temples: 0.8, stalls: 7, lanterns: 6, petals: 10, clouds: 2 },
];
