import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { FW, ROW0, TOP_SPAWN } from './config.js';
import { spawnModel, FLASH_MAT } from './models.js';

/* ------------------------------------------------------------------ *
 * 關底大 BOSS。陣型全滅 → WARNING → BOSS 從上方降下來。
 *   queen  女王蜂:扇形彈 + 瞄準連射 + 召喚小蜂
 *   moth   帝王蛾:旋轉彈幕 + 扇形彈 + 彈雨
 *   ufo    母艦:環狀彈 + 瞄準連射 + 召喚
 *   gold   黃金飛碟(獎勵關):不攻擊,到處亂飛,打得到就大賺,10 秒後逃走
 * 血量低於一半進入「暴走」:攻擊間隔變短、彈數變多。
 * ------------------------------------------------------------------ */

export const BOSS_INFO = {
  queen: { name: 'QUEEN BEE', rx: 2.4, ry: 2.6, colors: [PAL.beeBody, PAL.beeBelly, PAL.bossCrown, PAL.white] },
  moth: { name: 'EMPRESS MOTH', rx: 3.2, ry: 2.0, colors: [PAL.bflyBody, PAL.bflyWing, PAL.bflyRim, PAL.white] },
  ufo: { name: 'MOTHERSHIP', rx: 2.6, ry: 2.0, colors: [0x8a7fb8, 0x70e0ff, 0xffe35a, PAL.white] },
  gold: { name: 'GOLDEN SAUCER', rx: 1.9, ry: 1.5, colors: [0xffc83a, 0xffe35a, 0xc88a1a, PAL.white] },
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
    // 進場護盾(半透明泡泡),降到定位就消失
    this.bubble = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.bubble.scale.set(this.info.rx * 1.15, this.info.ry * 1.15, 1);
    game.scene.add(this.bubble);
    this.hp = this.hpMax = cfg.boss.hp;
    this.state = 'enter';
    this.x = 0; this.y = TOP_SPAWN + 4; this.vx = 0;
    this.ft = 0; this.life = 0; this.atkT = 1.6; this.atkI = 0;
    this.flashT = 0; this.dieT = 0; this.boomT = 0;
    this.queue = [];      // 延遲發射(連射)
    this.stream = null;   // 旋轉彈幕
    this.done = false; this.escaped = false;
    this.flap = 0;
  }

  get hoverY() { return ROW0 - (this.kind === 'gold' ? 4 : 3.2); }
  get enraged() { return this.hp < this.hpMax * 0.5; }
  get hittable() { return this.state === 'fight'; }
  /** 進場中有護盾:子彈打不進去(BOSS 一定會先降下來開打) */
  get shielded() { return this.state === 'enter'; }

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
      this.y = lerp(this.y, this.hoverY, Math.min(1, dt * 2.2));
      if (Math.abs(this.y - this.hoverY) < 0.15) { this.state = 'fight'; this.atkT = 0.4; this.pT = 1.2; }
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
      if (this.boomT <= 0) {
        this.boomT = 0.11;
        G.h.explode(this.x + (Math.random() - 0.5) * this.info.rx * 1.6, this.y + (Math.random() - 0.5) * this.info.ry * 1.6, this.info.colors, { n: 12 });
        G.h.sfx('hit', 8);
      }
      if (this.dieT > 1.2) this.finish();
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
    const { root, rig, wings, spin } = this.mdl;
    root.position.set(this.x, this.y, 0.2);
    this.bubble.visible = this.state === 'enter';
    if (this.bubble.visible) { this.bubble.position.set(this.x, this.y, 0.4); this.bubble.material.opacity = 0.14 + Math.sin(this.life * 12) * 0.05; }
    root.rotation.z = Math.PI;
    rig.rotation.y = Math.max(-0.4, Math.min(0.4, -this.vx * 0.05));
    const sq = Math.tanh(Math.sin(this.flap) * 2);
    for (const w of wings) { const s = w.userData.side; w.rotation.y = -s * (0.2 + 0.25 * sq); }
    if (spin) spin.rotation.z += dt * (this.enraged ? 3 : 1.4);
  }

  /** 從 BOSS 下緣發一顆:a = 0 往正下方,正值往右 */
  shoot(a, v) {
    this.g.fireBullet(this.x, this.y - this.info.ry * 0.6, Math.sin(a) * v, -Math.cos(a) * v, true);
  }
  aimAngle() {
    const P = this.g.player;
    return Math.atan2(P.x - this.x, -(P.y - this.y));
  }

  attack() {
    const t = this.t, rage = this.enraged ? 2 : 0;
    const v = lerp(8, 15.5, t) * (this.enraged ? 1.12 : 1);
    const moves = {
      queen: ['fan', 'aim', 'fan', 'summon'],
      moth: ['spiral', 'fan', 'rain', 'aim'],
      ufo: ['ring', 'aim', 'summon', 'ring'],
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
    for (let i = 0; i < 3; i++) G.h.explode(this.x + (i - 1) * 1.2, this.y + (i % 2) * 0.6, this.info.colors, { big: true });
    G.h.flash(0.8); G.h.shake(1.3); G.h.sfx('bossDie'); G.h.vibrate(250);
    G.bossDefeated(this);
    this.remove();
    this.done = true;
  }

  remove() { this.g.scene.remove(this.mdl.root, this.bubble); }
}
