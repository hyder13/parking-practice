import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { FW, ROW0, TOP_SPAWN, BOTTOM_OUT } from './config.js';
import { spawnModel, flapWings, FLASH_MAT } from './models.js';

/* ------------------------------------------------------------------ *
 * 關底大妖。陣型全滅 → WARNING → 大妖從畫面上方、靠近鏡頭的高空俯衝下來(進場中在玩家頭頂上,打不到),
 * 落到定位後正面迎戰,臉朝玩家。
 *   bull   牛魔王:扇形彈 + 瞄準連射 + 召喚小妖
 *   bone   白骨精:旋轉彈幕 + 扇形彈 + 骨雨(骨翼會拍動)
 *   horn   金角大王:環狀彈(葫蘆噴出)+ 瞄準連射 + 召喚(一圈金光珠繞著轉)
 *   gold   金蟠桃(獎勵關):不攻擊,到處亂飛,打得到就大賺,10 秒後飛走
 * 血量低於一半進入「暴走」:攻擊間隔變短、彈數變多。被打敗時一邊打轉一邊縮小(被打回原形)。
 * ------------------------------------------------------------------ */

export const BOSS_INFO = {
  bull: { name: '牛魔王', rx: 3.0, ry: 2.2, colors: [0x2a2226, 0x6a4030, 0xffc23a, PAL.fire] },
  bone: { name: '白骨精', rx: 3.6, ry: 1.9, colors: [0xeee6d2, 0x8a4ab0, 0x5a2a7a, 0xd070ff] },
  horn: { name: '金角大王', rx: 3.0, ry: 3.0, colors: [0x3a6ab8, 0xb8282a, 0xffc23a, 0x8a3aa8] },
  gold: { name: '金蟠桃', rx: 1.5, ry: 1.6, colors: [0xffc080, 0xff6a6a, 0xffe070, PAL.white] },
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
    // 大妖的碰撞範圍很寬(散射容易全中)→ 血量依種類加權,戰鬥時間才跟小蜜蜂版差不多
    this.hp = this.hpMax = Math.round(cfg.boss.hp * ({ bull: 1.2, bone: 1.15, horn: 0.95 }[this.kind] || 1));
    this.state = 'enter';
    // 從上方高空(靠近鏡頭)俯衝下來:進場中在玩家頭頂上,子彈打不到、也撞不到
    this.x = 0; this.y0 = TOP_SPAWN + 6; this.y = this.y0; this.z = 12; this.vx = 0; this.et = 0;
    this.spin = 0;
    this.ft = 0; this.life = 0; this.atkT = 1.6; this.atkI = 0;
    this.flashT = 0; this.dieT = 0; this.boomT = 0;
    this.queue = [];      // 延遲發射(連射)
    this.stream = null;   // 旋轉彈幕
    this.done = false; this.escaped = false;
    this.flap = 0;
  }

  get hoverY() { return ROW0 - (this.kind === 'gold' ? 4 : this.kind === 'horn' ? 3.8 : 3.0); }
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
      this.z = lerp(12, 0.2, Math.min(1, k * 1.25) ** 1.6);
      this.x = Math.sin(k * Math.PI) * 2.5;
      if (k >= 1) { this.state = 'fight'; this.z = 0.2; this.atkT = 0.5; this.pT = 1.4; this.ft = 0; }
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
          if (this.atkT <= 0) { this.attack(); this.atkT = lerp(3.0, 0.8, this.t) * (this.enraged ? 0.7 : 1); }
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
      // 被打回原形:打轉 + 縮小
      this.spin += dt * (2 + this.dieT * 6);
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
    root.position.set(this.x, this.y, this.state === 'fight' ? 0.2 + Math.sin(this.life * 1.3) * 0.15 : this.z);
    root.rotation.z = this.state === 'dying' ? this.spin : 0; // 臉朝玩家
    root.scale.setScalar(this.state === 'dying' ? Math.max(0.05, 1 - this.dieT / 1.5) : 1);
    rig.rotation.y = this.state === 'dying' ? 0 : Math.max(-0.3, Math.min(0.3, -this.vx * 0.04));
    rig.rotation.x = this.state === 'enter' ? 0.25 : 0;
    flapWings(this.mdl, this.flap * 0.6, 0.7);
    if (this.mdl.spin) this.mdl.spin.rotation.z += dt * (this.enraged ? 2.5 : 1.1);
    if (this.mdl.aura) this.mdl.aura.scale.setScalar(1 + Math.sin(this.life * 5) * 0.06);
    // 暴走:冒出妖氣
    if (this.enraged && this.state === 'fight' && (this.smokeT = (this.smokeT || 0) - dt) <= 0) {
      this.smokeT = 0.35;
      const s = Math.random() < 0.5 ? -1 : 1;
      G.h.explode(this.x + s * this.info.rx * 0.45, this.y + this.info.ry * 0.3, [0x5a2a7a, 0xd070ff], { n: 2, life: 0.6, z: 0.9 });
    }
  }

  /** 從大妖身上發一顆:a = 0 往正下方,正值往右。金角大王從葫蘆口、其他輪流從嘴 / 兩手 */
  shoot(a, v) {
    this.gun = ((this.gun || 0) + 1) % 3;
    if (this.kind === 'horn') { this.g.fireBullet(this.x, this.y - 3.0, Math.sin(a) * v, -Math.cos(a) * v, true); return; }
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
      bull: ['fan', 'aim', 'fan', 'summon'],
      bone: ['spiral', 'fan', 'rain', 'aim'],
      horn: ['ring', 'aim', 'summon', 'ring'],
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
      this.stream = { t: 1.4 + t, k: 0, every: lerp(0.1, 0.05, t), a: Math.random() * 6, step: 0.42, arms: 2 + (rage ? 1 : 0), v: v * 0.8 };
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
