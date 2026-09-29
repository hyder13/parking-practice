/** 關卡表的小工具(給各遊戲的 stages.js 用)。欄位說明見 field.js。 */
export const S = (name, shape, twists, paths, bosses = null) => ({ name, shape, twists, paths, bosses });
export const C = (name, level) => ({ name, challenge: level });
