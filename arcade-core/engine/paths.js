import { BOTTOM_OUT, PLAYER_Y, DY_TOP, TOP_SPAWN } from './field.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ *
 * 飛行軌跡:控制點 → Catmull-Rom 曲線 → 依弧長取樣。
 * 敵人用「已飛行距離 d」查位置,所以速度固定、跟控制點疏密無關。
 * ------------------------------------------------------------------ */
export class Path {
  constructor(pts, res = 14) {
    const P = [pts[0], ...pts, pts[pts.length - 1]];
    const xs = [], ys = [];
    for (let i = 1; i < P.length - 2; i++) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      for (let k = 0; k < res; k++) {
        const t = k / res, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        xs.push(f(p0[0], p1[0], p2[0], p3[0]));
        ys.push(f(p0[1], p1[1], p2[1], p3[1]));
      }
    }
    const last = pts[pts.length - 1];
    xs.push(last[0]); ys.push(last[1]);
    const cum = new Float32Array(xs.length);
    for (let i = 1; i < xs.length; i++) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    this.xs = xs; this.ys = ys; this.cum = cum; this.len = cum[cum.length - 1];
    this.loop = !!pts.loop;
  }

  /** 距離 d 的位置,寫入 out(不配置新物件)。 */
  at(d, out) {
    const { cum, xs, ys } = this;
    if (d <= 0) { out.x = xs[0]; out.y = ys[0]; return out; }
    if (d >= this.len) { out.x = xs[xs.length - 1]; out.y = ys[ys.length - 1]; return out; }
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; }
    const t = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
    out.x = xs[lo] + (xs[hi] - xs[lo]) * t;
    out.y = ys[lo] + (ys[hi] - ys[lo]) * t;
    return out;
  }
}

/** 左右鏡像 + 跟著場地上緣平移(場地變高時,進場軌跡仍然對齊陣型) */
const mirror = (s, pts) => {
  const out = pts.map(([x, y]) => [x * s, y + DY_TOP]);
  // 最後一點若是往上 / 下飛出場,改成真正的場外(場地變高後原本的點可能還在畫面內)
  const last = out[out.length - 1];
  if (Math.abs(last[0]) < 12) {
    if (last[1] < -12) last[1] = BOTTOM_OUT - 2;
    else if (last[1] > 17) last[1] = TOP_SPAWN + 1;
  }
  return out;
};

/* ---------------- 進場軌跡(s = ±1 左右鏡像) ----------------
 * 最後一個點停在陣型下方附近,之後由 home 狀態自己飛回格子
 * (格子會跟著陣型左右擺動,所以不把格子寫死在曲線裡)。 */
export const ENTRY = {
  // 從上方中央成對衝下來,在下半場繞一圈再往上歸位
  top: (s) => mirror(s, [[1.2, 19], [1.4, 11], [3.5, 4], [7, -2], [7, -6.5], [3.5, -7.5], [1.5, -4], [2.5, 1], [4, 4]]),
  // 從左下 (s=1) / 右下 (s=-1) 切入,往上繞大圈
  side: (s) => mirror(s, [[-14, -8], [-7, -6], [-2, -3], [1, 1.5], [0, 5.5], [-3.5, 6], [-5.5, 3], [-4, 0.5], [-1.5, 1.5]]),
  // 從右上 (s=1) / 左上 (s=-1) 斜切下來,掃過中央再回頭
  diag: (s) => mirror(s, [[8.5, 19], [8, 11], [4, 3.5], [0, -1.5], [-4, -1.5], [-5, 2], [-2.5, 4.5]]),
  // 第 2 關起:在場地下方畫一個大圈
  topLoop: (s) => mirror(s, [[1, 19], [1, 9], [2.5, 3], [6, 0], [8, -3.5], [6, -7.5], [2, -7], [0.5, -3], [2, 1], [5, 2]]),
  // 從側邊中段水平切入,壓低到玩家附近再拉起
  sideHigh: (s) => mirror(s, [[-14, 3], [-7, 1.5], [-1, -2], [4, -6.5], [7.5, -4], [6.5, 0.5], [2.5, 1.5], [-1, 3]]),
  // 螺旋:從上角進來、在側邊轉一圈
  spiral: (s) => mirror(s, [[10, 19], [9, 9], [5, 4], [1.5, 0], [2.5, -4.5], [6.5, -5], [8, -1], [6, 2.5], [2.5, 2.5]]),
  // 從正上方直直掉下來,在陣型下方勾一下
  dropIn: (s) => mirror(s, [[4, 19], [4, 7], [2.5, 1.5], [5, -1.5], [7.5, 1.5], [5.5, 5]]),
  // 從側邊低處進來,在場地中間繞一個大圈
  loopBig: (s) => mirror(s, [[-14, -2], [-6, -3], [0, -4.5], [5, -2], [6, 3], [2, 6.5], [-3, 5], [-4, 1], [-1, -1], [2, 2]]),
  // 之字形:左右大幅擺盪一路壓到底
  zig: (s) => mirror(s, [[-9, 19], [-8, 12], [4, 7], [-4, 2], [5, -3], [1, -7], [-3, -5], [-2, -1], [1, 2]]),

  // 獎勵關:整段飛完就離場(不歸位)
  c1: (s) => mirror(s, [[1, 19], [1, 8], [-2.5, 1.5], [-6, 3], [-5, 7.5], [-1, 6], [3, -1], [6, -6], [4, -10], [0, -9], [-1, -5], [3, 0], [9, 3], [16, 4]]),
  c2: (s) => mirror(s, [[-14, -7], [-6, -4], [0, 0], [4, 4], [3, 8.5], [-1, 9], [-4, 5.5], [-2, 1], [3, -1], [6, -4.5], [4, -8], [0, -6], [2, -1], [8, 3], [15, 5]]),
  c3: (s) => mirror(s, [[6, 19], [6, 9], [2, 4], [-3, 4.5], [-5, 8], [-2, 10.5], [1, 8], [0, 3], [-3, -2], [-1, -6], [3, -5], [4, -1], [1, 1], [-4, -3], [-8, -10], [-10, -19]]),
};

const cx = (x) => clamp(x, -10, 10);
/* 俯衝軌跡的高度都相對玩家:py(k) = 玩家上方 k 單位 */
const py = (k) => PLAYER_Y + k;
const out = () => BOTTOM_OUT - 1.5;
export const beamY = () => PLAYER_Y + 8; // 王停下來放光束的高度

/** 俯衝起手式:先往上翻半圈、朝外側轉身,再往下衝(原作的招牌動作) */
function windup(x, y) {
  const s = x < 0 ? -1 : 1;
  return { s, pts: [[x, y], [cx(x + s * 1.1), y + 1.3], [cx(x + s * 2.3), y + 0.4], [cx(x + s * 2.2), y - 2]] };
}

/** 蜂:衝向玩家,loop = 在下方繞一圈回頭往上(之後 home 回陣型) */
export function diveBee(x, y, px, loop) {
  const { pts } = windup(x, y);
  const tx = clamp(px + rand(-2.5, 2.5), -8.5, 8.5);
  const lx = pts[3][0];
  pts.push([(lx + tx) / 2, (y - 2 + py(5.9)) / 2], [tx, py(5.9)]);
  if (loop) {
    const q = tx > 0 ? -1 : 1;
    pts.push([tx + q * 1.5, py(1.6)], [tx + q * 4, py(2.1)], [tx + q * 4.6, py(5.6)], [tx + q * 2.8, py(8.8)]);
    pts.loop = true;
  } else {
    pts.push([tx + rand(-2.5, 2.5), py(0.9)], [cx(tx + rand(-5, 5)), out()]);
  }
  return pts;
}

/** 蝶:衝下來之後往另一側大幅橫掃出場 */
export function diveBfly(x, y, px) {
  const { s, pts } = windup(x, y);
  const tx = clamp(px + rand(-2, 2), -8.5, 8.5);
  pts.push([(pts[3][0] + tx) / 2, (y - 2 + py(5.9)) / 2], [tx, py(5.9)], [cx(tx - s * 2.8), py(2.6)], [cx(tx - s * 3.6), py(-0.2)], [cx(tx - s * 1), out()]);
  return pts;
}

/** 王:直直壓向玩家(護衛跟在兩側) */
export function diveBoss(x, y, px) {
  const { pts } = windup(x, y);
  const tx = clamp(px + rand(-1.5, 1.5), -8.5, 8.5);
  pts.push([(pts[3][0] + tx) / 2, (y - 2 + py(6.4)) / 2], [tx, py(6.4)], [tx + rand(-2, 2), py(1.4)], [cx(tx + rand(-4, 4)), out()]);
  return pts;
}

/** 王:飛到玩家上方停住,準備放牽引光束 */
export function diveBeam(x, y, px) {
  const { pts } = windup(x, y);
  const tx = clamp(px, -8, 8);
  const by = beamY();
  pts.push([(pts[3][0] + tx) / 2, (y - 2 + by) / 2], [tx, by + 1.4], [tx, by]);
  return pts;
}

/** 從目前位置往下飛出畫面 */
/** 蛇行:俯衝段(起手式之後)每兩個控制點中間插一個左右交錯的點 */
export function weave(pts, amp) {
  const o = pts.slice(0, 4);
  for (let i = 4; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if (i < pts.length - 1) o.push([cx((ax + bx) / 2 + (o.length % 2 ? amp : -amp)), (ay + by) / 2]);
    o.push(pts[i]);
  }
  o.loop = pts.loop;
  return o;
}

/** 隕石:從上方斜斜穿過整個場地 */
export function meteorPath() {
  const x0 = rand(-10, 10), x1 = clamp(x0 + rand(-7, 7), -11, 11);
  return [[x0, TOP_SPAWN + 1], [(x0 + x1) / 2, 0], [x1, out() - 1]];
}

export function exitDown(x, y) {
  return [[x, y], [x, y - 3], [cx(x + rand(-3, 3)), out()]];
}
