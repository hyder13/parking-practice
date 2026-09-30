import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { FW, ROW0, TOP_SPAWN, BOTTOM_OUT } from '@arcade/engine/field.js';
import { spawnModel, flapWings, squash, GROUND_Z, FLASH_MAT } from './models.js';

/* ------------------------------------------------------------------ *
 * 古老的守護者。敵人全滅 → WARNING → 守護者從畫面上方衝進來(進場中打不到),到定位後震一下畫面開打。
 *   sphinx    人面獅身:扇形彈 + 瞄準連射 + 叫木乃伊來幫忙(一圈生命之符繞著轉)
 *   snake     巨蛇:旋轉彈幕 + 扇形彈 + 毒液雨(張開的頸部會動、一圈鬼火繞著轉)
 *   scorpion  巨蠍:環狀彈 + 瞄準連射 + 放出聖甲蟲(一圈火球繞著轉)
 *   gold      黃金面具(獎勵關):不攻擊,到處飛,打得到就大賺,10 秒後飛走
 * 血量低於一半進入「暴走」:攻擊間隔變短、彈數變多。
 * 被打敗時像壁畫上剝落的一塊一樣被壓扁、往後倒下。
 * ------------------------------------------------------------------ */

export const BOSS_INFO = {
  sphinx: { name: '人面獅身', rx: 3.3, ry: 3.4, colors: [0xdcaa5a, 0x2a5ab8, 0xe8b830, PAL.smoke] },
  snake: { name: '巨蛇', rx: 3.0, ry: 3.6, colors: [0x3a8a4a, 0xe8b830, 0x6af0e0, PAL.smoke] },
  scorpion: { name: '巨蠍', rx: 3.4, ry: 3.2, colors: [0x8a3a1a, 0xe8b830, 0xff8a2a, PAL.fire] },
  gold: { name: '黃金面具', rx: 2.2, ry: 2.6, colors: [0xe8b830, 0x2a5ab8, 0x3ab8a8, PAL.white] },
};

const lerp = (a, b, k) => a + (b - a) * k;

export class BigBoss {
  constructor(game, cfg) {
    this.g = game;
    this.kind = cfg.boss.kind;
    this.info = BOSS_INFO[this.kind];
    this.n = cfg.n; this.t = cfg.t;
    this.mdl = spawnModel('big_' + this.kind);
    game.scene.add(this.mdl.root);
    this.orig = this.mdl.meshes.map((m) => m.material);
    // 大魔物的碰撞範圍很寬(散射容易全中)→ 血量依種類加權,戰鬥時間才跟小蜜蜂版差不多
    this.hp = this.hpMax = Math.round(cfg.boss.hp * ({ sphinx: 1.2, snake: 1.2, scorpion: 1.15 }[this.kind] || 1));
    this.state = 'enter';
    // 從上方衝進來(貼著地面),到定位才開打
    this.x = 0; this.y0 = TOP_SPAWN + 7; this.y = this.y0; this.z = 0.2; this.vx = 0; this.et = 0;
    this.spin = 0;
    this.ft = 0; this.life = 0; this.atkT = 1.6; this.atkI = 0;
    this.flashT = 0; this.dieT = 0; this.boomT = 0;
    this.queue = [];      // 延遲發射(連射)
    this.stream = null;   // 旋轉彈幕
    this.done = false; this.escaped = false;
    this.flap = 0;
  }

  get hoverY() { return ROW0 - (this.kind === 'gold' ? 4 : 3.6); }
  get enraged() { return this.hp < this.hpMax * 0.5; }
  get hittable() { return this.state === 'fight'; }
  /** 進場中飛在玩家上空:子彈從底下穿過去(BOSS 一定會先飛到定位才開打) */
  get shielded() { return false; }

  /** 橢圓碰撞 */
  contains(x, y, pad = 0) {
    const dx = (x - this.x) / (this.info.rx + pad), dy = (y - this.y) / (this.info.ry + pad);
    return dx * dx + dy * dy < 1;
  }

  update(dt) {
    const G = this.g;
    this.life += dt; this.flap += dt * 7;
    const px = this.x;
    if (this.state === 'enter') {
      this.et += dt;
      const k = Math.min(1, this.et / 3.2), e = 1 - (1 - k) ** 3;
      this.y = lerp(this.y0, this.hoverY, e);
      this.x = Math.sin(k * Math.PI) * 2.5;
      if (k >= 1) {
        this.state = 'fight'; this.atkT = 0.5; this.pT = 1.4; this.ft = 0;
        this.sq = this.life; this.sqK = 1; G.h.shake(0.6); G.h.sfx('bossLand'); // 到定位:畫面一震、Q 彈落地
      }
    } else if (this.state === 'fight') {
      this.ft += dt;
      if (this.kind === 'gold') {
        // 8 字形亂飛,給玩家「追得到」的刺激感
        const w = 1.1;
        this.x = Math.sin(this.ft * w) * (FW / 2 - 2.5);
        this.y = this.hoverY - 3 + Math.sin(this.ft * w * 2) * 3.5;
        if (this.ft > 10) this.state = 'escape';
      } else {
        const w = 0.45 + this.t * 0.35 + (this.enraged ? 0.15 : 0);
        this.x = lerp(this.x, Math.sin(this.ft * w) * (FW / 2 - this.info.rx - 1), Math.min(1, dt * 3));
        this.y = lerp(this.y, this.hoverY + Math.sin(this.ft * w * 2) * 1.1, Math.min(1, dt * 3));
        if (G.player.state === 'play') {
          this.atkT -= dt;
          if (this.atkT <= 0) { this.attack(); this.atkT = lerp(3.0, 0.8, this.t) * (this.enraged ? 0.7 : 1) * (this.n <= 3 ? 1.3 : 1); } // 前 3 關慢一點
          // 主要招式之外,持續補瞄準彈(不讓玩家有空檔站著不動)
          // 第 4 關以後才有(前幾關的 BOSS 讓新手先學會看招)
          if (this.n >= 4) this.pT -= dt;
          if (this.pT <= 0) {
            this.pT = lerp(3.2, 0.8, this.t) * (this.enraged ? 0.7 : 1);
            this.shoot(this.aimAngle(), lerp(9.5, 16.5, this.t));
          }
        }
      }
    } else if (this.state === 'escape') {
      this.y += dt * 14;
      if (this.y > TOP_SPAWN + 4) { this.escaped = true; this.done = true; }
    } else if (this.state === 'dying') {
      this.dieT += dt; this.boomT -= dt;
      this.x += Math.sin(this.dieT * 40) * 0.03;
      // 退場:一邊爆炸一邊壓扁、往後倒下
      if (this.boomT <= 0) {
        this.boomT = 0.11;
        G.h.explode(this.x + (Math.random() - 0.5) * this.info.rx * 1.6, this.y + (Math.random() - 0.5) * this.info.ry * 1.6, this.info.colors, { n: 12, z: this.z + 0.6 });
        G.h.sfx('hit', 8);
      }
      if (this.dieT > 1.5) this.finish();
    }
    this.vx = dt > 0 ? (this.x - px) / dt : 0;

    // 延遲發射 / 旋轉彈幕
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const q = this.queue[i]; q.t -= dt;
      if (q.t <= 0) { if (this.state === 'fight') q.fn(); this.queue.splice(i, 1); }
    }
    if (this.stream) {
      const S = this.stream; S.t -= dt; S.k -= dt;
      if (S.k <= 0 && this.state === 'fight') {
        S.k = S.every; S.a += S.step;
        for (let j = 0; j < S.arms; j++) this.shoot(S.a + j * Math.PI * 2 / S.arms, S.v);
      }
      if (S.t <= 0) this.stream = null;
    }

    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.mdl.meshes.forEach((m, i) => { m.material = this.orig[i]; });
    }
    const { root, rig } = this.mdl;
    const march = this.state === 'fight' || this.state === 'enter' ? Math.abs(Math.sin(this.life * (this.kind === 'gold' ? 2.5 : 6))) * 0.18 : 0;
    root.position.set(this.x, this.y, 0.2 + march);
    root.rotation.z = Math.max(-0.2, Math.min(0.2, -this.vx * 0.02)); // 面朝玩家,只微微傾斜
    if (this.state === 'dying') {
      const k = Math.min(1, this.dieT / 1.2);
      root.scale.set(1 + k * 0.15, 1 - k * 0.2, Math.max(0.03, 1 - k));
      rig.rotation.x = -k * 1.1;
    } else {
      squash(root, this.life - (this.sq ?? -9), 0.7 * (this.sqK ?? 1));
      rig.rotation.x = 0;
    }
    rig.rotation.y = this.state === 'dying' ? 0 : Math.max(-0.2, Math.min(0.2, -this.vx * 0.03));
    if (this.mdl.shadow) this.mdl.shadow.position.z = -GROUND_Z + 0.04 - march;
    flapWings(this.mdl, this.life * 6);
    if (this.mdl.spin) this.mdl.spin.rotation.z += dt * (this.enraged ? 2.5 : 1.1);
    // 暴走:揚起沙塵和火花
    if (this.enraged && this.state === 'fight' && (this.smokeT = (this.smokeT || 0) - dt) <= 0) {
      this.smokeT = 0.35;
      const s = Math.random() < 0.5 ? -1 : 1;
      G.h.explode(this.x + s * this.info.rx * 0.45, this.y + this.info.ry * 0.3, [PAL.smoke, PAL.fire], { n: 2, life: 0.6, z: 0.9 });
    }
  }

  /** 從大魔物身上射一發:a = 0 往正下方,正值往右。輪流從中間 / 左右兩側射出 */
  shoot(a, v) {
    this.gun = ((this.gun || 0) + 1) % 3;
    const gx = [0, -0.6, 0.6][this.gun] * this.info.rx;
    this.g.fireBullet(this.x + gx, this.y - this.info.ry * (this.gun ? 0.35 : 0.7), Math.sin(a) * v, -Math.cos(a) * v, true);
  }
  aimAngle() {
    const P = this.g.player;
    return Math.atan2(P.x - this.x, -(P.y - this.y));
  }

  attack() {
    const t = this.t, rage = this.enraged ? 2 : 0;
    const v = lerp(8, 15.5, t) * (this.enraged ? 1.12 : 1);
    const moves = {
      sphinx: ['fan', 'aim', 'fan', 'summon'],
      snake: ['spiral', 'fan', 'rain', 'aim'],
      scorpion: ['ring', 'aim', 'summon', 'ring'],
    }[this.kind];
    const m = moves[this.atkI++ % moves.length];
    if (m === 'fan') {
      const n = 4 + Math.floor(t * 9) + rage, spread = 0.16, a0 = this.aimAngle() * 0.6;
      for (let i = 0; i < n; i++) this.shoot(a0 + (i - (n - 1) / 2) * spread, v);
      this.g.h.sfx('bossShot');
    } else if (m === 'aim') {
      const k = 3 + Math.floor(t * 4) + (rage ? 1 : 0);
      for (let i = 0; i < k; i++) this.queue.push({ t: i * 0.13, fn: () => { this.shoot(this.aimAngle(), v * 1.15); this.g.h.sfx('bossShot'); } });
    } else if (m === 'ring') {
      const n = 12 + Math.floor(t * 14) + rage * 2, off = Math.random();
      for (let i = 0; i < n; i++) this.shoot(off + i * Math.PI * 2 / n, v * 0.8);
      this.g.h.sfx('bossShot');
    } else if (m === 'spiral') {
      this.stream = { t: 1.4 + t, k: 0, every: lerp(0.16, 0.05, Math.sqrt(t)), a: Math.random() * 6, step: 0.42, arms: 2 + (rage ? 1 : 0), v: v * 0.8 };
    } else if (m === 'rain') {
      const n = 8 + Math.floor(t * 8) + rage;
      for (let i = 0; i < n; i++) this.queue.push({ t: i * 0.07, fn: () => {
        const x = (Math.random() - 0.5) * (FW - 2);
        this.g.fireBullet(x, this.y, 0, -v * 0.75, true);
      } });
    } else if (m === 'summon') {
      const k = 2 + Math.floor(t * 3);
      for (let i = 0; i < k; i++) this.queue.push({ t: i * 0.25, fn: () => this.g.spawnMinion(this.x + (i % 2 ? 1.5 : -1.5), this.y - 1, t > 0.4 && i % 2 ? 'bfly' : 'bee') });
    }
  }

  /** 回傳 true = 這一下打死了 */
  hit(dmg) {
    if (!this.hittable) return false;
    this.hp -= dmg;
    // 受擊閃白:最多每 0.2 秒閃一下,不然連射時整隻一直是白的、看不到造型
    if (this.flashT <= 0 && this.life - (this.lastFlash || -1) > 0.2) {
      this.lastFlash = this.life; this.flashT = 0.04;
      this.mdl.meshes.forEach((m) => { if (!m.isSprite) m.material = FLASH_MAT; });
    }
    if (this.life - (this.sq ?? -9) > 0.25) { this.sq = this.life - 0.02; this.sqK = 0.3; } // 被打中微微 Q 彈(不要一直抖)
    if (this.hp <= 0) {
      this.state = 'dying'; this.dieT = 0; this.queue = []; this.stream = null;
      this.g.slow(0.9, 0.35);
      return true;
    }
    return false;
  }

  finish() {
    const G = this.g;
    for (let i = 0; i < 3; i++) G.h.explode(this.x + (i - 1) * 1.2, this.y + (i % 2) * 0.6, this.info.colors, { big: true, z: Math.max(-8, this.z) });
    G.h.flash(0.8); G.h.shake(1.3); G.h.sfx('bossDie'); G.h.vibrate(250);
    G.bossDefeated(this);
    this.remove();
    this.done = true;
  }

  remove() { this.g.scene.remove(this.mdl.root); }
}
