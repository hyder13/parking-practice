import * as THREE from 'three';
import { PAL } from '@skin/core/palette.js';
import { FW, FH, PLAYER_Y, TOP_SPAWN, BOTTOM_OUT, ROWS, ROW0, DY_TOP, slotOf, SCORE, EXTRA_LIFE, MAX_STAGE, TWISTS, stageCfg } from './field.js';
import { Path, ENTRY, diveBee, diveBfly, diveBoss, diveBeam, exitDown, weave, meteorPath } from './paths.js';
import { armorize, unarmor, squash, elasticOut } from './kit.js';
import { spawnModel, spinProps, flapWings, shotBatch, enemyShotBatch, BOSS_HIT_SWAP, SHIP_LV, ITEMS } from '@skin/game/models.js';
import { BigBoss, BOSS_INFO } from '@skin/game/boss.js';
import { TEXT, FEEL } from '@skin/skin.js';

/* ------------------------------------------------------------------ *
 * 遊戲規則(純邏輯 + 擺放模型),畫面 / 聲音 / HUD 透過 hooks 交給 main.js。所有換皮共用:
 * 模型 / BOSS / 背景 / 文字 / 手感從各遊戲的 @skin(src/)拿,介面見 arcade-core/CLAUDE.md。
 *
 * phase:title → intro → play → warn → boss → (clear | result) → intro … ;死光 → over → ended
 * 敵人 state:
 *   wait     還沒輪到進場(隱藏)
 *   enter    照進場軌跡飛             home   自己飛回陣型格子
 *   form     在陣型裡(跟著陣型擺動)   dive   俯衝攻擊中
 *   escort   當王的護衛(跟著王飛)     beamdive / beam  王下來放牽引光束
 *   exit     放完光束往下離場          fly    獎勵關:飛完軌跡就離場
 * 沒有 slot 的敵人 = 獎勵關的過場敵人或 BOSS 召喚的小兵(飛完就消失)。
 *
 * 成長系統(「小勝利」一直來):
 *   火力 w 1~6   吃 P 升級,死掉只降 1 級
 *   進化 evo 1~10 殺敵經驗累積,換戰機外型、射速 / 傷害提升,死掉不會掉
 *   連擊 combo    1.6 秒內連續擊墜,加分 + 音高越來越高 + 里程碑誇獎
 * ------------------------------------------------------------------ */

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const turnToward = (a, b, step) => { const d = wrapPi(b - a); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; };
const lerp = (a, b, k) => a + (b - a) * k;

export const COLORS = {
  bee: [PAL.beeBody, PAL.beeWing, PAL.beeBand, PAL.smoke],
  bfly: [PAL.bflyBody, PAL.bflyHead, PAL.bflyRim, PAL.smoke],
  boss: [PAL.bossBody, PAL.bossHead, PAL.bossInner, PAL.smoke],
  bossHit: [PAL.bossHit, PAL.bossHitHead, PAL.smoke, PAL.bossInner],
  ship: [PAL.shipWhite, PAL.shipRed, PAL.shipBlue, PAL.engine, PAL.smoke],
  captive: [PAL.captive, PAL.white, PAL.captiveDark],
  rock: [0x8a9098, 0xd8322e, 0xf2c23a, PAL.smoke],
  steel: [0x9aa4c0, 0xffffff, 0xcfd6ea],
};

const DUAL_DX = FEEL.dualDx;   // 雙機:第二台在右邊多遠
const SHOT_SPEED = 34;
const HIT_R = { bee: 0.78, bfly: 0.82, boss: 0.95, rock: 0.95 };
const CAPTIVE_OFF = 1.25;      // 被抓的戰機掛在王身後多遠
const BEAM_LEN = 8.2;
const ATTACKING = new Set(['dive', 'escort', 'beamdive', 'beam', 'exit']);
const MOVING = new Set(['enter', 'home', 'dive', 'escort', 'beamdive', 'beam', 'exit', 'fly']);
const COMBO_WINDOW = 1.6;
// 翻筋斗(1942 的招牌):按一下 → 往鏡頭方向拉起翻一圈,期間無敵、不能射擊。每關 3 次
const LOOP_DUR = 1.25, LOOPS_PER_STAGE = 3;

// 火力等級:每一發 [x 偏移, 角度(度)]
const PATTERNS = [
  null,
  [[0, 0]],
  [[-0.28, 0], [0.28, 0]],
  [[0, 0], [-0.22, -8], [0.22, 8]],
  [[0, 0], [-0.2, -7], [0.2, 7], [-0.35, -15], [0.35, 15]],
  [[0, 0], [-0.2, -7], [0.2, 7], [-0.35, -15], [0.35, 15], [-0.95, 0], [0.95, 0]],
  [[0, 0], [-0.2, -6], [0.2, 6], [-0.3, -12], [0.3, 12], [-0.4, -20], [0.4, 20], [-0.95, 0], [0.95, 0]],
];
export const MAX_POWER = PATTERNS.length - 1;
// 進化需要的累積擊墜數:前面很快(第 1 關就升 Lv.2),後面拉長,Lv.10 大約在第 24 關
export const EVO_XP = [0, 10, 35, 80, 150, 250, 400, 600, 850, 1150];
// 從檢查點開始時,依關卡給大約應有的進化等級(第 n 關之前能累積的擊墜數)
const EVO_AT_STAGE = [1, 2, 3, 4, 6, 9, 12, 16, 20, 24];
const PRAISE = TEXT.praise;     // [[連擊數, 字, 顏色], ...]
export const ACH = TEXT.ach;

/** 排氣火焰 / 凝結尾 / 火箭尾焰:以樣板的長度為基準隨機閃爍 */
function flicker(flames, k = 1) {
  for (const f of flames) {
    if (f.userData.base === undefined) f.userData.base = f.scale.y;
    f.scale.y = f.userData.base * k * (0.8 + Math.random() * 0.4);
  }
}

export class Game {
  constructor(scene, hooks) {
    this.scene = scene;
    this.h = hooks;
    this.enemies = [];
    this.items = [];
    this.big = null;
    this.pathCache = new Map();
    this.shots = Array.from({ length: 220 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, dmg: 1, on: false }));
    this.ebs = Array.from({ length: 260 }, () => ({ x: 0, y: 0, vx: 0, vy: 0, big: false, on: false }));
    this.shotB = shotBatch(scene, this.shots.length);
    this.ebB = enemyShotBatch(scene, this.ebs.length);
    this.shield = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, 2), new THREE.MeshBasicMaterial({
      color: 0x5affc0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.shield.scale.set(1, 1, 0.45); this.shield.visible = false; scene.add(this.shield);

    this.player = { x: 0, y: PLAYER_Y, vx: 0, vy: 0, roll: 0, state: 'none', dual: false, t: 0, lives: 0, fireCd: 0,
      readyAt: -1, w: 1, evo: 1, xp: 0, rapidT: 0, shieldT: 0, inv: 0, loops: LOOPS_PER_STAGE, loopT: 0 };
    this.shipEvo = 0;
    this.setShipModels(1);
    this.input = { move: 0, moveY: 0, drag: 0, dragY: 0, fire: false, loop: false };
    this.score = 0;
    this.hi = hooks.loadHi();
    this.ach = new Set(hooks.loadAch());
    this.stageN = 1;
    this.cfg = stageCfg(1);
    this.form = { t: 0, breathe: 1 };
    this.captive = null;   // 身上掛著被抓戰機的那隻王
    this.capture = null;   // 正在被光束吸上去
    this.rescue = null;    // 救回 / 逃走中的戰機
    this.clock = 0;
    this.combo = { n: 0, t: -9 };
    this.slowT = 0; this.slowK = 1;
    this.phase = 'title'; this.phaseT = 0;
    this.attract();
  }

  get timeScale() { return this.slowT > 0 ? this.slowK : 1; }
  /** 短暫慢動作(擊敗 BOSS、進化的瞬間) */
  slow(dur, k) { this.slowT = Math.max(this.slowT, dur); this.slowK = k; }

  /** 換成對應進化等級的戰機模型 */
  setShipModels(evo) {
    if (this.shipEvo === evo) return;
    const keep = this.ship && { vis: this.ship.root.visible, vis2: this.ship2.root.visible };
    if (this.ship) this.scene.remove(this.ship.root, this.ship2.root);
    this.ship = spawnModel(`ship${evo}`); this.ship2 = spawnModel(`${FEEL.ally}${evo}`); // 雙機:第二台(可以是另一個角色)
    this.scene.add(this.ship.root, this.ship2.root);
    this.ship.root.visible = keep ? keep.vis : false; this.ship2.root.visible = keep ? keep.vis2 : false;
    this.shipEvo = evo;
  }

  /* ================= 流程 ================= */

  /** 標題畫面:整個陣型排好在後面拍翅膀 */
  attract() {
    this.clearAll();
    this.cfg = stageCfg(1);
    ROWS.forEach((r, ri) => r.cols.forEach((c) => {
      const e = this.makeEnemy(slotOf(`${ri}:${c}`).type, slotOf(`${ri}:${c}`));
      e.state = 'form'; e.mdl.root.visible = true;
    }));
    this.form.breathe = 1;
    this.waves = []; this.startedWaves = 0; this.reinfLeft = 0;
    this.phase = 'title'; this.phaseT = 0;
  }

  start(stageN = 1) {
    this.clearAll();
    const P = this.player;
    Object.assign(P, { x: 0, y: PLAYER_Y, vx: 0, vy: 0, state: 'play', dual: false, t: 0, lives: 2, fireCd: 0, readyAt: -1,
      w: 1, evo: 1, xp: 0, rapidT: 0, shieldT: 0, inv: 0, loops: LOOPS_PER_STAGE, loopT: 0 });
    // 從後面的關卡(檢查點)開始:直接給對應的進化 / 火力,不然會太痛苦
    if (stageN > 1) {
      P.evo = EVO_AT_STAGE.filter((s) => stageN >= s).length;
      P.xp = EVO_XP[P.evo - 1]; P.w = Math.min(MAX_POWER, 1 + Math.floor(stageN / 4));
    }
    this.setShipModels(P.evo);
    this.score = 0;
    this.nextExtra = EXTRA_LIFE[0];
    this.stats = { shots: 0, hits: 0, kills: 0, maxCombo: 0, startStage: stageN };
    this.noMissRun = 0;
    this.stageN = stageN;
    this.overShown = false;
    this.beginStage(true);
    this.pushHUD(); this.pushStatus();
  }

  toTitle() { this.attract(); this.pushHUD(); }

  beginStage(first) {
    const cfg = this.cfg = stageCfg(this.stageN);
    this.clearEnemies();
    this.ebs.forEach((b) => { b.on = false; });
    const P = this.player;
    if (P.state !== 'play' && P.state !== 'capturing') {
      if (P.lives > 0) { P.lives--; P.state = 'play'; P.x = 0; P.y = PLAYER_Y; P.readyAt = -1; P.inv = 2; }
    }
    this.form = { t: 0, breathe: 0 };
    this.waves = []; this.startedWaves = 0;
    this.reinfLeft = cfg.reinforce;
    this.addWaves(cfg.waves, new Set());
    this.chHits = 0;
    this.chTotal = this.enemies.filter((e) => !e.slot).length;
    this.diveT = 2.5;
    this.st = { deaths: 0, maxCombo: 0, kills: 0 };
    this.bossQueue = [...cfg.bosses];
    this.formFireT = 3; this.barrageT = 4; this.meteorT = 2.5;
    P.loops = LOOPS_PER_STAGE; // 翻筋斗每關補滿
    this.phase = 'intro'; this.phaseT = 0;
    this.introDur = first ? 3.8 : 2.4;
    // 開場:關卡編號 + 這關的名字 + 機制提示(每關不一樣,玩家一看就知道這關要注意什麼)
    const hint = cfg.kind === 'challenge' ? TEXT.challengeHint : cfg.twists.map((k) => TWISTS[k].hint).join(' / ');
    this.introLines = [...TEXT.intro(this.stageN, cfg.name), ...(hint ? [[hint, 'white hint']] : []),
      [this.stageN <= MAX_STAGE ? `${this.stageN} / ${MAX_STAGE}` : 'EXTRA', 'white small']];
    this.introMsg = first;
    if (first) this.h.msg(TEXT.first, 1.5);
    else this.h.msg(this.introLines, 2.4);
    this.h.sfx(first ? 'start' : cfg.kind === 'challenge' ? 'challenge' : 'stage');
    this.h.stage(this.stageN);
    this.h.bossBar(null);
    this.pushHUD();
  }

  /** 建立波次;occupied = 已經有人的格子(增援只補空位) */
  addWaves(defs, occupied) {
    for (const d of defs) {
      const w = { def: d, members: [], started: false };
      const n = d.slots ? d.slots.length : d.types.length;
      const cnt = { '-1': 0, 1: 0, 0: 0 };
      for (let i = 0; i < n; i++) {
        if (d.slots && occupied.has(d.slots[i])) continue;
        const s = d.pair ? (i < n / 2 ? -1 : 1) : d.s;
        const slot = d.slots ? slotOf(d.slots[i]) : null;
        const e = this.makeEnemy(slot ? slot.type : d.types[i], slot);
        e.path = this.path(d.path, s);
        e.stream = cnt[d.pair ? s : 0]++;
        e.speed = this.cfg.enterSpeed;
        e.entryShot = this.cfg.kind === 'normal' && Math.random() < (this.cfg.enterFire || 0);
        e.path.at(0, e);
        w.members.push(e);
      }
      if (w.members.length) this.waves.push(w);
    }
  }

  path(name, s) {
    const k = `${name}:${s}:${DY_TOP}`;
    if (!this.pathCache.has(k)) this.pathCache.set(k, new Path(ENTRY[name](s)));
    return this.pathCache.get(k);
  }

  makeEnemy(type, slot) {
    const mdl = spawnModel(type);
    mdl.root.visible = false;
    this.scene.add(mdl.root);
    const e = {
      type, slot, mdl, hp: type === 'boss' && this.cfg.kind === 'normal' ? this.cfg.bossHp || 2 : 1, hazard: false, armored: false,
      state: 'wait', started: false, delay: 0, alive: true, minion: false,
      x: 0, y: TOP_SPAWN, vx: 0, vy: -1, ang: Math.PI, roll: 0, hd: -Math.PI / 2,
      d: 0, path: null, speed: 10, homeSpeed: 10, stream: 0,
      flap: Math.random() * 6, shotsLeft: 0, nextShotY: 0, entryShot: false,
      leader: null, side: 0, escorts: [], escKilled: 0, captive: null, bt: 0,
    };
    if (slot) { const [x, y] = this.slotPos(slot); e.x = x; e.y = y; }
    if (this.cfg.armored && slot) { e.hp++; e.armored = true; armorize(mdl); } // 裝甲關:多一條命、鋼灰色
    this.enemies.push(e);
    return e;
  }

  /** BOSS 召喚的小兵:直接俯衝,飛完就消失 */
  spawnMinion(x, y, type) {
    const e = this.makeEnemy(type, null);
    e.minion = true; e.x = x; e.y = y; e.mdl.root.visible = true; e.hp = 1;
    this.startDive(e, type === 'bee' ? diveBee(x, y, this.player.x, false) : diveBfly(x, y, this.player.x));
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mdl.root);
    this.enemies = [];
    this.captive = null; this.capture = null;
    if (this.rescue) { this.scene.remove(this.rescue.m.root); this.rescue = null; }
    if (this.big) { this.big.remove(); this.big = null; }
    this.h.setBeam(false);
  }

  clearAll() {
    this.clearEnemies();
    this.shots.forEach((s) => { s.on = false; });
    this.ebs.forEach((b) => { b.on = false; });
    for (const it of this.items) this.scene.remove(it.m.root);
    this.items = [];
    this.player.state = 'none'; this.player.dual = false;
    this.ship.root.visible = this.ship2.root.visible = false;
    this.shield.visible = false;
    this.combo.n = 0; this.h.combo(0);
    this.h.bossBar(null);
    this.drawBullets();
  }

  startWave(i) {
    const w = this.waves[i];
    w.started = true; this.startedWaves++;
    const spacing = 2.0 / this.cfg.enterSpeed;
    for (const e of w.members) { e.started = true; e.delay = e.stream * spacing; }
  }

  updateWaves() {
    const i = this.startedWaves;
    if (i >= this.waves.length) {
      // 增援:陣型剩沒幾隻時,空位再補滿一輪
      if (this.reinfLeft > 0 && this.allEntered && this.enemies.filter((e) => e.slot).length <= 12) {
        this.reinfLeft--;
        this.addWaves(this.cfg.waves, new Set(this.enemies.filter((e) => e.slot).map((e) => e.slot.id)));
        this.form.breathe = 0;
        this.h.msg(TEXT.reinforce, 1.4);
      }
      return;
    }
    if (i === 0) { this.startWave(0); return; }
    const k = this.cfg.kind === 'challenge' ? 0.4 : 0.58;
    const prev = this.waves[i - 1].members;
    const ready = prev.every((e) => !e.alive || (e.state !== 'wait' && ((e.state !== 'enter' && e.state !== 'fly') || e.d > e.path.len * k)));
    if (ready) this.startWave(i);
  }

  get allEntered() {
    return this.startedWaves === this.waves.length && this.enemies.every((e) => e.state !== 'wait' && e.state !== 'enter');
  }

  /* ================= 主更新 ================= */
  update(dt, realDt = dt) {
    this.clock += dt;
    if (this.slowT > 0) this.slowT -= realDt;
    this.phaseT += dt;
    this.form.t += dt;
    if (this.phase !== 'title' && this.allEntered) this.form.breathe = Math.min(1, this.form.breathe + dt * 0.5);

    switch (this.phase) {
      case 'intro':
        if (this.introMsg && this.phaseT > 1.5) { this.introMsg = false; this.h.msg(this.introLines, 2.3); }
        if (this.phaseT >= this.introDur) { this.phase = 'play'; this.phaseT = 0; }
        break;
      case 'play':
        this.updateWaves();
        this.maybeDive(dt);
        this.updateTwists(dt);
        this.checkClear();
        break;
      case 'warn':
        if (this.phaseT > 2.0) {
          const kind = this.bossQueue.shift();
          this.big = new BigBoss(this, { ...this.cfg, boss: { kind, hp: this.cfg.boss.hp } });
          this.phase = 'boss'; this.phaseT = 0;
          this.pushBoss();
        }
        break;
      case 'boss':
        this.updateTwists(dt);
        if (this.big) {
          this.big.update(dt);
          if (this.big.done) {
            const escaped = this.big.escaped;
            if (escaped) { this.big.remove(); this.h.feed(TEXT.goldEscaped, 'white'); }
            this.big = null; this.h.bossBar(null);
            if (!escaped && this.bossQueue.length) this.bossWarn(true); // 連戰:下一隻
            else if (this.cfg.kind === 'challenge') { this.phase = 'result'; this.phaseT = 0; this.resultStep = 0; }
            else this.startClear();
          }
        }
        break;
      case 'clear':
        if (this.phaseT > (this.stageN < 10 ? 2.6 : 3.2)) this.nextStage();
        break;
      case 'result': this.updateResult(); break;
      case 'over':
        if (this.phaseT > 3.2 && !this.overShown) {
          this.overShown = true; this.phase = 'ended';
          this.h.gameOver({ ...this.stats, stage: this.stageN, evo: this.player.evo }, this.score);
        }
        break;
    }

    if (this.phase !== 'title') { this.updatePlayer(dt); this.updateShots(dt); this.updateItems(dt); }
    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
    this.updateEnemyShots(dt);
    if (this.phase !== 'title') this.collide();
    this.updateCapture(dt);
    this.updateRescue(dt);
    this.updateCombo();
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
    this.drawBullets();
  }

  checkClear() {
    if (this.startedWaves < this.waves.length || this.reinfLeft > 0 || this.enemies.some((e) => !e.hazard) || this.rescue || this.capture) return;
    this.bossWarn(false);
  }

  /** WARNING → 下一隻 BOSS(next = 連戰的第 2、3 隻) */
  bossWarn(next) {
    this.phase = 'warn'; this.phaseT = next ? 0.6 : 0;
    const gold = this.cfg.kind === 'challenge';
    const info = BOSS_INFO[this.bossQueue[0]];
    if (next) {
      this.h.msg(TEXT.nextBoss(info.name), 1.4);
      this.h.sfx('warning');
      return;
    }
    this.h.msg(TEXT.bossAppear(info.name, gold), 2.0);
    this.h.sfx(gold ? 'challenge' : 'warning');
    this.h.vibrate(80);
  }

  pushBoss() {
    const B = this.big;
    if (!B) return;
    this.h.bossBar(`${B.info.name}  Lv.${this.stageN}`, Math.max(0, B.hp / B.hpMax), B.kind === 'gold');
  }

  bossDefeated(B) {
    const n = this.stageN, gold = B.kind === 'gold';
    const pts = gold ? 5000 + n * 100 : 2000 + 300 * n;
    this.addScore(pts);
    this.h.popup(B.x, B.y, pts, 'yellow');
    // 火力還低時 BOSS 一定掉 P;之後改成隨機,火力大約第 8~10 關才會滿
    const first = this.player.w < 3 ? 'P' : Math.random() < 0.2 ? 'L' : this.randomItem();
    const drops = gold ? [first, this.randomItem()] : [first];
    drops.forEach((k, i) => this.dropItem(B.x + (i - (drops.length - 1) / 2) * 1.6, B.y, k));
    // 殘留的小兵一起炸掉
    for (const e of this.enemies) if (e.alive && e.minion) this.hitEnemy(e, true);
    this.ebs.forEach((b) => { b.on = false; });
    this.achieve('firstBoss');
    this.h.bossBar(null);
  }

  startClear() {
    const n = this.stageN, S = this.st;
    const stars = 1 + (S.deaths === 0 ? 1 : 0) + (S.deaths === 0 && S.maxCombo >= 8 ? 1 : 0);
    const bonus = stars * 500 * (1 + Math.floor(n / 10));
    this.phase = 'clear'; this.phaseT = 0;
    this.h.msg([TEXT.clear(n), ['★'.repeat(stars) + '☆'.repeat(3 - stars), 'yellow stars'],
      [`${S.deaths === 0 ? 'NO MISS  ' : ''}BONUS ${bonus}`, 'white']], this.stageN < 10 ? 2.5 : 3.1);
    this.addScore(bonus);
    this.h.sfx('clear', stars);
    this.h.warp(1.4);
    this.noMissRun = S.deaths === 0 ? this.noMissRun + 1 : 0;
    if (this.noMissRun >= 5) this.achieve('noMiss5');
    for (const [k, id] of [[10, 'stage10'], [20, 'stage20'], [30, 'stage30']]) if (n >= k) this.achieve(id);
    this.h.progress(n + 1);
  }

  nextStage() {
    if (this.stageN === MAX_STAGE) this.h.feed(TEXT.allClear, 'yellow');
    this.stageN++;
    this.beginStage(false);
  }

  updateResult() {
    const t = this.phaseT;
    if (this.resultStep === 0) {
      this.resultStep = 1;
      this.h.msg([['NUMBER OF HITS', 'cyan'], [`${this.chHits} / ${this.chTotal}`, 'white']], 2.0);
    } else if (this.resultStep === 1 && t > 2.1) {
      this.resultStep = 2;
      if (this.chHits >= this.chTotal) {
        this.h.msg([['PERFECT !', 'red'], ['SPECIAL BONUS 10000 PTS', 'yellow']], 2.4);
        this.addScore(10000); this.h.sfx('perfect'); this.achieve('perfect');
      } else {
        this.h.msg([['BONUS', 'cyan'], [String(this.chHits * 100), 'white']], 2.2);
        this.addScore(this.chHits * 100);
      }
      this.h.progress(this.stageN + 1);
    } else if (this.resultStep === 2 && t > 4.7) {
      this.h.warp(1.2); this.nextStage();
    }
  }

  /* ================= 關卡機制(twists) ================= */
  updateTwists(dt) {
    const cfg = this.cfg, P = this.player;
    if (cfg.kind !== 'normal') return;
    const shooting = P.state === 'play';
    const form = () => this.enemies.filter((e) => e.state === 'form');
    if (cfg.formFire && shooting && this.phase === 'play' && (this.formFireT -= dt) <= 0) {
      // 狙擊手:陣型裡隨機一隻瞄準開火
      this.formFireT = cfg.formFire * rand(0.7, 1.3);
      const f = form(); if (f.length) this.fireAt(f[Math.floor(Math.random() * f.length)]);
    }
    if (cfg.barrage && shooting && this.phase === 'play' && (this.barrageT -= dt) <= 0) {
      // 齊射:同一排的幾隻一起往正下方打
      this.barrageT = cfg.barrage * rand(0.8, 1.2);
      const f = form();
      if (f.length) {
        const row = f[Math.floor(Math.random() * f.length)].slot.row;
        const v = (cfg.bulletSpeed || 12) * 0.7;
        f.filter((e) => e.slot.row === row).forEach((e, i) => { if (i % 2 === 0) this.fireBullet(e.x, e.y - 0.5, 0, -v, false); });
        this.h.sfx('bossShot');
      }
    }
    if (cfg.meteors && (this.meteorT -= dt) <= 0) {
      this.meteorT = cfg.meteors * rand(0.6, 1.4);
      this.spawnRock();
    }
  }

  /** 隕石類障礙物(火箭 / 巨石 / 鬼火…):斜斜穿過場地,打 2 下才破,撞到會死 */
  spawnRock() {
    const e = this.makeEnemy('rock', null);
    e.hazard = true; e.hp = 2; e.mdl.root.visible = true;
    e.path = new Path(meteorPath()); e.d = 0; e.speed = rand(7, 10) * (1 + this.cfg.t * 0.5);
    e.state = 'fly'; e.path.at(0, e);
    const s = rand(0.9, 1.2); e.mdl.rig.scale.setScalar(s); e.r = 0.85 * s;
    e.spin = FEEL.rockSpin(); // [繞 x, 繞 y] 每秒轉幾弧度
    this.h.sfx('rocket');
  }

  /* ================= 陣型 ================= */
  /** 格子的目前位置:進場時整排左右擺,全部到齊後改成「呼吸」(一脹一縮) */
  slotPos(slot) {
    const F = this.form, b = F.breathe;
    const sway = Math.sin(F.t * 0.9) * 1.5 * (1 - b);
    const s = 1 + b * 0.12 * (0.5 - 0.5 * Math.cos(F.t * 1.9));
    // 以最上排上方一點為中心縮放(by 是相對最上排的高度)
    const x = slot.bx * s + sway;
    let y = ROW0 + 1 + (slot.by - 1) * (1 + (s - 1) * 0.8);
    // 陣型形狀(每關不同):邊緣往下 / V 字 / 倒 V / 會動的波浪
    const ax = Math.abs(slot.bx);
    switch (this.cfg.shape) {
      case 'arch': y -= 0.035 * slot.bx * slot.bx; break;
      case 'v': y -= 2.5 - 0.3 * ax; break;   // 中間最低 = V
      case 'peak': y -= 0.3 * ax; break;      // 兩側下垂 = 倒 V
      case 'wave': y += Math.sin(slot.bx * 0.55 + F.t * 1.6) * 0.9 - 0.6; break;
    }
    return [x, y];
  }

  /* ================= 出擊 ================= */
  maybeDive(dt) {
    const cfg = this.cfg;
    if (cfg.kind !== 'normal' || this.player.state !== 'play') return;
    if (!(this.allEntered || this.startedWaves > cfg.diveFrom)) return;
    this.diveT -= dt;
    if (this.diveT > 0) return;
    const few = this.enemies.filter((e) => !e.hazard).length <= 6;
    this.diveT = cfg.diveEvery * rand(0.6, 1.3) * (few ? 0.45 : 1);
    const active = this.enemies.filter((e) => ATTACKING.has(e.state)).length;
    if (active >= cfg.maxDivers + (few ? 2 : 0)) return;
    const form = this.enemies.filter((e) => e.state === 'form');
    if (!form.length) return;
    const r = Math.random();
    const pb = cfg.bossDive || 0.2, pBee = (1 - pb) * 0.6;
    let pool = form.filter((e) => e.type === (r < pBee ? 'bee' : r < 1 - pb ? 'bfly' : 'boss'));
    if (!pool.length) pool = form;
    // 外側的比較容易先脫隊(原作的感覺)
    const w = pool.map((e) => 1 + Math.abs(e.slot.bx) / 3);
    let pickN = Math.random() * w.reduce((a, b) => a + b, 0), e = pool[0];
    for (let i = 0; i < pool.length; i++) { pickN -= w[i]; if (pickN <= 0) { e = pool[i]; break; } }
    this.launch(e);
  }

  launch(e) {
    const P = this.player, cfg = this.cfg;
    if (e.type === 'boss') {
      const canBeam = !this.captive && !this.capture && !this.rescue && !P.dual && !e.captive
        && !this.enemies.some((o) => o.state === 'beamdive' || o.state === 'beam');
      if (canBeam && Math.random() < cfg.beamChance) {
        this.startDive(e, diveBeam(e.x, e.y, P.x), 'beamdive');
        e.shotsLeft = 0;
        this.h.sfx('dive');
        return;
      }
      this.startDive(e, this.snake(diveBoss(e.x, e.y, P.x)));
      e.escorts = []; e.escKilled = 0;
      if (Math.random() < cfg.escort) {
        const c = this.enemies.filter((o) => o.state === 'form' && o.type === 'bfly' && o.slot.row === 1)
          .sort((a, b) => Math.abs(a.slot.bx - e.slot.bx) - Math.abs(b.slot.bx - e.slot.bx)).slice(0, 2)
          .sort((a, b) => a.slot.bx - b.slot.bx);
        c.forEach((o, i) => {
          o.state = 'escort'; o.leader = e;
          o.side = c.length === 2 ? (i ? 1 : -1) : (o.slot.bx < e.slot.bx ? -1 : 1);
          o.shotsLeft = cfg.diveShots !== undefined ? cfg.diveShots : cfg.shots; o.nextShotY = o.y - 3; o.speed = e.speed;
          e.escorts.push(o);
        });
      }
    } else if (e.type === 'bee') this.startDive(e, this.snake(diveBee(e.x, e.y, P.x, Math.random() < cfg.beeLoop)));
    else this.startDive(e, this.snake(diveBfly(e.x, e.y, P.x)));
    this.h.sfx('dive');
  }

  snake(pts) { return this.cfg.weave ? weave(pts, this.cfg.weave) : pts; }

  startDive(e, pts, state = 'dive') {
    const cfg = this.cfg;
    e.state = state; e.path = new Path(pts); e.d = 0;
    e.speed = (cfg.diveSpeed || 12) * (e.type === 'boss' ? 0.92 : 1) * (cfg.diveMul || 1);
    e.shotsLeft = cfg.diveShots !== undefined ? cfg.diveShots : cfg.shots || 1; e.nextShotY = e.y - 2.5;
  }

  toHome(e, hd) {
    e.state = 'home';
    e.hd = hd !== undefined ? hd : Math.atan2(e.vy, e.vx);
    e.homeSpeed = Math.max(9, e.speed);
  }

  /** 從畫面下方飛出去 → 從上方回來歸位 */
  wrapTop(e) {
    if (!e.slot) { this.removeEnemy(e); return; }
    e.x = this.slotPos(e.slot)[0]; e.y = TOP_SPAWN; e.vx = 0; e.vy = -1;
    this.toHome(e, -Math.PI / 2);
  }

  pathDone(e) {
    switch (e.state) {
      case 'enter': this.toHome(e); break;
      case 'fly': this.removeEnemy(e); break;
      case 'dive': case 'exit':
        if (e.path.loop && e.slot) this.toHome(e); else this.wrapTop(e);
        break;
      case 'beamdive': e.state = 'beam'; e.bt = 0; e.strafeT = 0.5; this.h.sfx('beam'); break;
    }
  }

  /* ================= 敵人 ================= */
  updateEnemy(e, dt) {
    const px = e.x, py = e.y;
    e.flap += dt * (e.state === 'form' ? 6 : 12);
    switch (e.state) {
      case 'wait':
        if (!e.started) break;
        e.delay -= dt;
        if (e.delay <= 0) {
          e.state = e.slot ? 'enter' : 'fly'; e.d = 0; e.mdl.root.visible = true;
          const q = e.path.at(0.4, { x: 0, y: 0 }); e.path.at(0, e);
          e.ang = Math.atan2(-(q.x - e.x), q.y - e.y);
        }
        break;
      case 'enter': case 'fly': case 'dive': case 'beamdive': case 'exit':
        e.d += e.speed * dt; e.path.at(e.d, e);
        if (e.d >= e.path.len) this.pathDone(e);
        break;
      case 'home': {
        const [tx, ty] = this.slotPos(e.slot);
        const dx = tx - e.x, dy = ty - e.y, dist = Math.hypot(dx, dy);
        if (dist < 0.06) { e.state = 'form'; e.x = tx; e.y = ty; e.sq = this.clock; break; } // 到位時 Q 彈一下
        const sp = Math.min(e.homeSpeed, 2 + dist * 5);
        if (dist < 1.3) {
          const st = Math.min(dist, sp * dt); e.x += dx / dist * st; e.y += dy / dist * st;
        } else {
          e.hd = turnToward(e.hd, Math.atan2(dy, dx), 5 * dt);
          e.x += Math.cos(e.hd) * sp * dt; e.y += Math.sin(e.hd) * sp * dt;
        }
        break;
      }
      case 'form': { const [tx, ty] = this.slotPos(e.slot); e.x = tx; e.y = ty; break; }
      case 'escort': {
        const L = e.leader;
        if (!L || !L.alive || L.state !== 'dive') { this.releaseEscort(e); break; }
        // 在王的 local 座標:兩側 1.2、稍微落後
        const fx = -Math.sin(L.ang), fy = Math.cos(L.ang), rx = Math.cos(L.ang), ry = Math.sin(L.ang);
        const tx = L.x + rx * e.side * 1.2 - fx * 0.6, ty = L.y + ry * e.side * 1.2 - fy * 0.6;
        const k = Math.min(1, dt * 7);
        e.x = lerp(e.x, tx, k); e.y = lerp(e.y, ty, k);
        break;
      }
      case 'beam': this.updateBeam(e, dt); break;
    }
    if (!e.alive) return;

    if (dt > 0) { e.vx = (e.x - px) / dt; e.vy = (e.y - py) / dt; }
    let want = e.ang;
    if (e.state === 'form' || e.state === 'beam') want = Math.PI;
    else if (e.vx * e.vx + e.vy * e.vy > 0.25) want = Math.atan2(-e.vx, e.vy);
    const prev = e.ang;
    e.ang = turnToward(e.ang, want, (e.state === 'form' ? 5 : 13) * dt);
    const av = dt > 0 ? wrapPi(e.ang - prev) / dt : 0;
    e.roll += (clamp(-av * 0.16, -0.9, 0.9) - e.roll) * Math.min(1, dt * 8);

    this.enemyFire(e);

    const { root, rig } = e.mdl;
    // 上下起伏(飛行的浮動 / 走路的彈跳),每款自己定
    const hop = FEEL.hop(e);
    root.position.set(e.x, e.y, hop);
    // 立體書人偶不跟著方向轉(臉才不會倒過來),只依水平速度左右傾
    root.rotation.z = e.mdl.upright ? clamp(-e.vx * 0.025, -0.35, 0.35) : e.ang;
    if (e.mdl.shadow) e.mdl.shadow.position.z = -FEEL.groundZ + 0.04 - hop;
    if (FEEL.popup) squash(root, this.clock - (e.sq ?? -9));
    flicker(e.mdl.flames);
    if (e.hazard) {
      rig.rotation.x += e.spin[0] * dt; rig.rotation.y += e.spin[1] * dt;
      if (e.mdl.spin) e.mdl.spin.rotation.z += dt * 7; // 模型裡有 'spin' 群組(例如輪入道的車輪)就讓它自己轉
      return;
    }
    rig.rotation.y = e.mdl.upright ? e.roll * 0.3 : e.roll;
    spinProps(e.mdl, dt);
    flapWings(e.mdl, e.flap);
  }

  releaseEscort(e) {
    e.leader = null;
    if (e.y < PLAYER_Y - 0.5) this.wrapTop(e);
    else { e.state = 'dive'; e.path = new Path(exitDown(e.x, e.y)); e.d = 0; e.speed = this.cfg.diveSpeed; }
  }

  /** 重戰機停在玩家上方「掃射」:左右擺動的機槍連發(原本的牽引光束) */
  updateBeam(e, dt) {
    e.bt += dt;
    const P = this.player, cfg = this.cfg;
    if (P.state === 'play') e.x += clamp(P.x - e.x, -1, 1) * dt * 1.2; // 慢慢對準玩家
    if (e.bt > 0.45 && e.bt < 3.3 && P.state === 'play' && (this.phase === 'play' || this.phase === 'boss')) {
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafeT = lerp(0.46, 0.24, cfg.t);
        const base = Math.sin(e.bt * 2.3) * 0.5, v = (cfg.bulletSpeed || 12) * 0.85, n = cfg.t > 0.45 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.17;
          this.fireBullet(e.x, e.y - 0.7, Math.sin(a) * v, -Math.cos(a) * v, false);
        }
        this.h.sfx('bossShot');
      }
    }
    if (e.bt > 3.8) { e.state = 'exit'; e.path = new Path(exitDown(e.x, e.y)); e.d = 0; }
  }

  enemyFire(e) {
    const P = this.player;
    if (this.cfg.kind !== 'normal' || P.state !== 'play' || (this.phase !== 'play' && this.phase !== 'boss')) return;
    if ((e.state === 'dive' || e.state === 'escort') && e.shotsLeft > 0 && e.y < e.nextShotY && e.y > P.y + 4 && e.vy < 0) {
      this.fireAt(e); e.shotsLeft--; e.nextShotY = e.y - 1.6;
    }
    if (e.state === 'enter' && e.entryShot && e.y < ROW0 - 5 && e.y > P.y + 6 && e.vy < 0) { e.entryShot = false; this.fireAt(e); }
  }

  fireAt(e) {
    const P = this.player;
    let dx = P.x - e.x + rand(-0.9, 0.9), dy = P.y - e.y; // 比舊版瞄得準一點
    if (dy > -2) return;
    const L = Math.hypot(dx, dy); dx /= L; dy /= L;
    if (dy > -0.62) { dy = -0.62; dx = Math.sign(dx) * Math.sqrt(1 - dy * dy); }
    const v = this.cfg.bulletSpeed || 12;
    this.fireBullet(e.x, e.y - 0.5, dx * v, dy * v, false);
  }

  fireBullet(x, y, vx, vy, big) {
    const b = this.ebs.find((o) => !o.on);
    if (!b) return;
    Object.assign(b, { on: true, x, y, vx, vy, big });
  }

  removeEnemy(e) {
    e.alive = false;
    this.scene.remove(e.mdl.root);
    if (e.state === 'beam') this.h.setBeam(false);
  }

  hitEnemy(e, crash = false, dmg = 1) {
    if (e.hp > dmg && !crash) {
      e.hp -= dmg;
      if (e.armored) {
        // 裝甲被打掉:換回原色
        e.armored = false; unarmor(e.mdl);
        this.h.explode(e.x, e.y, COLORS.steel, { n: 8, life: 0.35 });
      } else if (e.type === 'boss') {
        for (const m of e.mdl.meshes) { const s = BOSS_HIT_SWAP.get(m.material); if (s) m.material = s; }
        this.h.explode(e.x, e.y, COLORS.boss, { n: 6, life: 0.35 });
      } else this.h.explode(e.x, e.y, COLORS[e.type], { n: 5, life: 0.3 });
      e.sq = this.clock; // 被打中:壓扁彈回
      this.h.sfx('bossHit');
      return;
    }
    const moving = e.state !== 'form';
    let pts = SCORE[e.type][moving ? 1 : 0];
    if (e.type === 'boss' && moving && e.escorts.length) pts = [400, 800, 1600][Math.min(2, e.escKilled)];
    if (e.leader) e.leader.escKilled++;
    const boss = e.type === 'boss';
    this.h.explode(e.x, e.y, boss ? COLORS.bossHit : COLORS[e.type], { n: boss ? 24 : 16 });
    this.h.shake(boss ? 0.35 : 0.12);
    if (this.cfg.kind === 'challenge' && !e.slot) this.chHits++;
    if (e.captive) {
      if (e.state === 'form' || e.state === 'home') this.freeCaptive(e, 'flee');
      else this.freeCaptive(e, 'rescue');
    }
    if (this.capture && this.capture.boss === e) this.cancelCapture();
    this.onKill(e, pts);
    this.removeEnemy(e);
  }

  /* ================= 擊墜的獎勵:連擊 / 經驗 / 掉寶 ================= */
  onKill(e, pts) {
    this.stats.kills++; this.st.kills++;
    const C = this.combo;
    C.n = this.clock - C.t < COMBO_WINDOW ? C.n + 1 : 1;
    C.t = this.clock;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, C.n); this.st.maxCombo = Math.max(this.st.maxCombo, C.n);
    const bonus = Math.min(C.n - 1, 50) * 10;
    this.addScore(pts + bonus);
    // 跳分只給大分數(原作也只有王帶護衛時才跳字),一般擊墜的分數交給右邊的連擊顯示
    if (pts >= 400) this.h.popup(e.x, e.y, pts, pts >= 800 ? 'yellow' : 'cyan');
    const milestone = PRAISE.find(([k]) => k === C.n);
    this.h.combo(C.n, milestone && milestone[1], milestone && milestone[2]);
    this.h.sfx(e.type === 'boss' ? 'bossKill' : 'hit', C.n);
    if (milestone) this.h.sfx('praise');
    if (C.n >= 10) this.achieve('combo10');
    if (C.n >= 50) this.achieve('combo50');
    this.addXP(1);
    this.maybeDrop(e);
  }

  updateCombo() {
    const C = this.combo;
    if (C.n > 0 && this.clock - C.t > COMBO_WINDOW) {
      const bonus = C.n >= 8 ? C.n * 20 : 0;
      if (bonus) this.addScore(bonus);
      C.n = 0; this.h.combo(0, null, null, bonus);
    }
  }

  addXP(k) {
    const P = this.player;
    P.xp += k;
    if (P.evo < SHIP_LV.length && P.xp >= EVO_XP[P.evo]) this.evolve();
    this.pushStatus();
  }

  evolve() {
    const P = this.player;
    P.evo++;
    this.setShipModels(P.evo);
    const lv = SHIP_LV[P.evo - 1];
    this.h.explode(P.x, P.y, [lv.body, lv.accent, lv.pod, 0xffffff], { big: true, n: 26 });
    this.tag(TEXT.promote, 'yellow');
    this.h.evolved();
    this.h.sfx('levelUp');
    this.slow(0.45, 0.45);
    if (P.evo >= 5) this.achieve('evo5');
    if (P.evo >= 10) this.achieve('evo10');
  }

  randomItem() {
    const r = Math.random(), P = this.player;
    if (r < 0.33) return 'P';
    if (r < 0.53) return 'R';
    if (r < 0.72) return 'S';
    if (r < 0.86) return 'B';
    if (r < 0.96) return P.dual || this.rescue ? 'P' : 'W';
    return 'L';
  }

  maybeDrop(e) {
    const early = this.stageN <= 3;
    this.dropPity = (this.dropPity || 0) + 1;
    const chance = e.minion ? 0.015 : e.type === 'boss' ? 0.15 : early ? 0.045 : 0.025;
    // 新手引導:第一次玩第 6 隻一定掉 P;太久沒掉也保底
    let kind = null;
    if (!this.gotFirstP && this.stats.kills === 6) kind = 'P';
    else if (this.dropPity >= 55 || Math.random() < chance) kind = this.randomItem();
    if (!kind) return;
    this.dropPity = 0;
    this.dropItem(e.x, e.y, kind);
  }

  dropItem(x, y, kind) {
    if (this.items.length >= 10) return;
    const m = spawnModel(`item_${kind}`);
    m.root.position.set(x, y, 0.4); this.scene.add(m.root);
    this.items.push({ kind, m, x, y, t: Math.random() * 6, vy: 2.4, pop: 0 });
    if (kind === 'P') this.gotFirstP = true;
  }

  updateItems(dt) {
    const P = this.player;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      let got = false;
      if (P.state === 'play') {
        const cx = P.dual ? P.x + DUAL_DX / 2 : P.x;
        const dx = cx - it.x, dy = P.y - it.y, d = Math.hypot(dx, dy);
        if (d < 3.2) { const k = Math.min(1, dt * (14 / Math.max(0.6, d))); it.x += dx * k * 0.5; it.y += dy * k * 0.5; } // 磁吸
        got = d < 1.15;
      }
      if (!got) { it.y -= it.vy * dt; it.x += Math.sin(it.t * 2.2) * 0.8 * dt; }
      it.x = clamp(it.x, -FW / 2 + 0.6, FW / 2 - 0.6);
      const { root, rig, halo } = it.m;
      root.position.set(it.x, it.y, 0.4);
      if (FEEL.popup) { it.pop += dt; root.scale.setScalar(elasticOut(it.pop / 0.5)); } // 彈出來
      rig.rotation.z = Math.sin(it.t * 2.4) * 0.28;
      if (halo) { halo.rotation.x = 0.35; halo.rotation.z = it.t * 3; halo.scale.setScalar(1 + Math.sin(it.t * 6) * 0.08); }
      root.visible = it.y > BOTTOM_OUT + 3 || Math.floor(it.t * 8) % 2 === 0;
      if (got) { this.applyItem(it.kind, it.x, it.y); this.scene.remove(root); this.items.splice(i, 1); }
      else if (it.y < BOTTOM_OUT) { this.scene.remove(root); this.items.splice(i, 1); }
    }
  }

  applyItem(kind, x, y) {
    const P = this.player, it = ITEMS[kind];
    this.playerSq = this.clock;
    this.h.explode(x, y, [it.color, 0xffffff], { n: 10, life: 0.4 });
    this.h.sfx('pickup');
    this.h.vibrate(20);
    if (kind === 'P') {
      if (P.w < MAX_POWER) {
        P.w++;
        this.tag(TEXT.power(P.w, P.w === MAX_POWER), 'red');
        this.h.sfx('powerUp');
        if (P.w === MAX_POWER) this.achieve('power');
      } else { this.addScore(1000); this.h.popup(x, y, 1000, 'yellow'); }
    } else if (kind === 'R') { P.rapidT = 8; this.tag(TEXT.rapid, 'cyan'); }
    else if (kind === 'S') { P.shieldT = 10; this.tag(TEXT.shield, 'green'); this.h.sfx('shield'); }
    else if (kind === 'B') this.bomb();
    else if (kind === 'L') { P.lives++; this.tag(TEXT.oneUp, 'yellow'); this.h.sfx('extra'); this.pushHUD(); }
    else if (kind === 'W') this.callWingman(x, y);
    this.pushStatus();
  }

  /** 僚機:從畫面下方飛上來、貼到身邊變成雙機(沿用舊的救援 → 雙機流程) */
  callWingman(x, y) {
    const P = this.player;
    if (P.dual || this.rescue) { this.addScore(1000); this.h.popup(x, y, 1000, 'yellow'); return; }
    const m = spawnModel(`${FEEL.ally}${P.evo}`);
    const sx = clamp(P.x + DUAL_DX, -FW / 2 + 1, FW / 2 - 1);
    m.root.position.set(sx, BOTTOM_OUT, 0); this.scene.add(m.root);
    this.rescue = { m, x: sx, y: BOTTOM_OUT, t: 1.1, mode: 'rescue' };
    this.tag(TEXT.wingman, 'cyan');
    this.achieve('rescue');
  }

  /** 空襲支援(B):清光敵彈、炸掉所有在飛的敵人、BOSS 受重傷 */
  bomb() {
    this.h.flash(1); this.h.shake(1.0); this.h.sfx('bomb'); this.h.vibrate(120);
    this.ebs.forEach((b) => { b.on = false; });
    for (const e of this.enemies) if (e.alive && e.state !== 'wait' && e.state !== 'form') this.hitEnemy(e, true);
    if (this.big && this.big.hittable) {
      const dead = this.big.hit(8 + this.stageN * 2);
      this.pushBoss();
      if (dead) this.h.bossBar(null);
    }
  }

  achieve(id) {
    if (this.ach.has(id)) return;
    this.ach.add(id);
    this.h.achieve(id, ACH[id]);
  }

  /* ================= 牽引光束 / 救援 ================= */
  startCapture(e) {
    const P = this.player;
    P.state = 'capturing';
    this.capture = { boss: e, t: 0, x0: P.x, y0: P.y };
    this.h.vibrate(60);
  }

  cancelCapture() {
    // 王在吸的途中被打掉:戰機掉回原位,繼續玩
    const P = this.player;
    this.capture = null;
    P.state = 'play'; P.inv = 1;
    this.ship.root.rotation.set(0, 0, 0);
  }

  updateCapture(dt) {
    const C = this.capture;
    if (!C) return;
    const e = C.boss, P = this.player, S = this.ship.root;
    C.t += dt;
    const k = Math.min(1, C.t / 2.3), ease = k * k * (3 - 2 * k);
    S.position.set(lerp(C.x0, e.x, ease), lerp(C.y0, e.y - CAPTIVE_OFF, ease), 0);
    S.rotation.z += dt * (14 - 9 * k);
    if (k < 1) return;
    // 吸上去了:掛到王身後,戰機變紅色
    this.capture = null;
    const cap = spawnModel('captive');
    e.mdl.root.add(cap.root); cap.root.position.set(0, -CAPTIVE_OFF, 0);
    e.captive = cap; this.captive = e;
    S.rotation.set(0, 0, 0);
    P.state = 'lost'; P.t = 0; P.readyAt = -1;
    this.st.deaths++;
    this.combo.n = 0; this.h.combo(0);
    this.h.setBeam(false);
    this.h.msg([['FIGHTER CAPTURED', 'red']], 2.6);
    this.h.sfx('captured');
    this.toHome(e, Math.PI / 2);
    this.pushHUD();
  }

  captivePos(e) {
    return [e.x + CAPTIVE_OFF * Math.sin(e.ang), e.y - CAPTIVE_OFF * Math.cos(e.ang)];
  }

  /** mode = 'rescue'(王在攻擊中被打掉 → 救回變雙機)/ 'flee'(王在陣型中被打掉 → 戰機逃走) */
  freeCaptive(e, mode) {
    const [x, y] = this.captivePos(e);
    e.mdl.root.remove(e.captive.root);
    e.captive = null; this.captive = null;
    const m = spawnModel(mode === 'rescue' ? `ship${this.player.evo}` : 'captive');
    m.root.position.set(x, y, 0); this.scene.add(m.root);
    this.rescue = { m, x, y, t: 0, mode };
    if (mode === 'rescue') { this.h.msg([['FIGHTER RESCUED', 'cyan']], 2); this.achieve('rescue'); }
  }

  updateRescue(dt) {
    const R = this.rescue;
    if (!R) return;
    R.t += dt;
    const P = this.player, root = R.m.root;
    if (R.mode === 'flee') {
      R.y += dt * 9; root.rotation.z += dt * 8;
      root.position.set(R.x, R.y, 0);
      if (R.y > TOP_SPAWN) { this.scene.remove(root); this.rescue = null; }
      return;
    }
    spinProps(R.m, dt);
    if (R.t < 1.1) { root.rotation.z += dt * 12; return; }
    root.rotation.z = turnToward(wrapPi(root.rotation.z), 0, dt * 6);
    let tx = 0, ty = PLAYER_Y + 4, dock = false;
    if (P.state === 'play') {
      const maxX = FW / 2 - 0.9;
      dock = true;
      tx = P.x + DUAL_DX <= maxX ? P.x + DUAL_DX : P.x - DUAL_DX;
      ty = P.y;
    }
    const dx = tx - R.x, dy = ty - R.y, dist = Math.hypot(dx, dy);
    const st = Math.min(dist, dt * 15);
    if (dist > 1e-4) { R.x += dx / dist * st; R.y += dy / dist * st; }
    root.position.set(R.x, R.y, 0);
    if (dock && dist < 0.2) {
      if (tx < P.x) P.x -= DUAL_DX;
      P.dual = true;
      this.scene.remove(root); this.rescue = null;
      this.h.sfx('rescued');
      this.tag(TEXT.dual, 'cyan');
    }
  }

  /* ================= 玩家 ================= */
  get yMax() { return PLAYER_Y + Math.min(14, FH * 0.38); }

  updatePlayer(dt) {
    const P = this.player, I = this.input;
    if (P.state === 'play') {
      const maxX = FW / 2 - 0.9 - (P.dual ? DUAL_DX : 0);
      const nx = clamp(P.x + I.move * 14 * dt + I.drag, -FW / 2 + 0.9, maxX);
      const ny = clamp(P.y + I.moveY * 12 * dt + I.dragY, PLAYER_Y, this.yMax);
      P.vx = dt > 0 ? (nx - P.x) / dt : 0; P.vy = dt > 0 ? (ny - P.y) / dt : 0;
      P.x = nx; P.y = ny;
      P.fireCd -= dt;
      if (I.loop) this.startLoop();
      if (I.fire && P.fireCd <= 0 && P.loopT <= 0 && this.phase !== 'over' && this.phase !== 'warn') this.fire();
    } else { P.vx = 0; P.vy = 0; }
    I.loop = false;
    if (P.loopT > 0) P.loopT = Math.max(0, P.loopT - dt);
    I.drag = 0; I.dragY = 0;
    if (P.rapidT > 0) { P.rapidT -= dt; if (P.rapidT <= 0) this.pushStatus(); }
    if (P.shieldT > 0) { P.shieldT -= dt; if (P.shieldT <= 0) this.pushStatus(); }
    if (P.inv > 0) P.inv -= dt;

    const live = ['play', 'boss', 'warn', 'clear', 'result', 'intro'].includes(this.phase);
    if ((P.state === 'dead' || P.state === 'lost') && live) { P.t += dt; if (P.t > 2.2) this.tryRespawn(); }

    P.roll += (clamp(P.vx * 0.045, -0.6, 0.6) - P.roll) * Math.min(1, dt * 10);
    const blink = P.inv > 0 && Math.floor(P.inv * 12) % 2 === 0;
    const show = (P.state === 'play' && !blink) || P.state === 'capturing';
    const S = this.ship, S2 = this.ship2;
    const lk = P.loopT > 0 ? 1 - P.loopT / LOOP_DUR : 0, lz = Math.sin(lk * Math.PI);
    S.root.visible = show;
    S2.root.visible = P.state === 'play' && P.dual && !blink;
    let jz;
    if (FEEL.dodge === 'flip') {
      // 翻筋斗:機頭往鏡頭方向拉起翻一整圈,同時爬高(z)再落回來
      jz = lz * 4.5;
      if (P.state === 'play') S.root.position.set(P.x, P.y + lz * 1.2, jz);
      S.rig.rotation.y = P.state === 'play' ? P.roll : 0;
      S.rig.rotation.x = -lk * Math.PI * 2;
      S2.root.position.set(P.x + DUAL_DX, P.y + lz * 1.2, jz);
      S2.rig.rotation.y = P.roll; S2.rig.rotation.x = -lk * Math.PI * 2;
    } else {
      // 跳躍(躍馬 / 風火輪…):往鏡頭方向高高跳起再落地、身體前傾;平常走路一顛一顛
      const [gf, ga] = FEEL.gait;
      jz = lz * 4.2 + (P.state === 'play' ? Math.abs(Math.sin(this.clock * gf)) * ga : 0);
      if (P.state === 'play') S.root.position.set(P.x, P.y + lz * 0.8, jz);
      S.rig.rotation.y = P.state === 'play' ? P.roll * 0.5 : 0;
      S.rig.rotation.x = -Math.sin(lk * Math.PI) * 0.55;
      S2.root.position.set(P.x + DUAL_DX, P.y + lz * 0.8, jz);
      S2.rig.rotation.y = P.roll * 0.5; S2.rig.rotation.x = S.rig.rotation.x;
    }
    // 地面上的影子(只有立體書 / 地面系列的模型有):留在地上、跳越高越小
    for (const m of [S, S2]) {
      if (!m.shadow) continue;
      m.shadow.position.z = -FEEL.groundZ + 0.04 - jz;
      const k = 1 - lz * 0.45, [bx, by] = m.shadow.userData.base; m.shadow.scale.set(bx * k, by * k, 1);
      squash(m.root, this.clock - (this.playerSq ?? -9), 0.8);
      flapWings(m, this.clock * 7);
    }
    flicker(S.flames, 1 + Math.max(0, P.vy) * 0.03); flicker(S2.flames, 1 + Math.max(0, P.vy) * 0.03);
    const pk = 1 + Math.max(0, P.vy) * 0.03;
    for (const m of [S, S2]) {
      spinProps(m, dt, pk);
      if (m.halo) m.halo.rotation.z += dt * 1.5;
      if (m.aura) m.aura.scale.setScalar(1 + Math.sin(this.clock * 6) * 0.05);
    }
    const sh = this.shield;
    sh.visible = P.state === 'play' && P.shieldT > 0 && (P.shieldT > 2 || Math.floor(P.shieldT * 8) % 2 === 0);
    if (sh.visible) {
      sh.position.set(P.dual ? P.x + DUAL_DX / 2 : P.x, P.y, 0.1);
      sh.scale.set(P.dual ? 1.5 : 1, 1, 0.45);
      sh.rotation.z += dt;
    }
  }

  startLoop() {
    const P = this.player;
    if (P.state !== 'play' || P.loopT > 0 || P.loops <= 0 || this.phase === 'over') return;
    P.loops--; P.loopT = LOOP_DUR;
    this.h.sfx('loop'); this.h.vibrate(25);
    this.pushStatus();
  }

  tryRespawn() {
    const P = this.player;
    if (P.lives <= 0) { this.gameOver(); return; }
    const busy = this.phase === 'play' && (this.enemies.some((e) => ATTACKING.has(e.state)) || this.capture);
    if (busy && P.t < 6) return;
    if (P.readyAt < 0) { P.readyAt = P.t; this.h.msg([['READY', 'cyan']], 1.2); return; }
    if (P.t - P.readyAt < 1.2) return;
    P.lives--; P.state = 'play'; P.x = 0; P.y = PLAYER_Y; P.readyAt = -1; P.inv = 2.2; P.loopT = 0;
    this.pushHUD();
  }

  gameOver() {
    if (this.phase === 'over' || this.phase === 'ended') return;
    this.phase = 'over'; this.phaseT = 0;
    this.player.state = 'none';
    this.h.msg([['GAME OVER', 'red']], 3.2);
    this.h.sfx('gameOver');
    this.h.saveHi(this.hi);
    this.h.bossBar(null);
  }

  get fireRate() {
    const P = this.player;
    return (1 + 0.05 * (P.evo - 1)) * (P.rapidT > 0 ? 1.7 : 1);
  }
  get damage() { return 1 + Math.floor((this.player.evo - 1) / 3); }

  fire() {
    const P = this.player;
    const pat = PATTERNS[P.w];
    const xs = P.dual ? [P.x, P.x + DUAL_DX] : [P.x];
    const dmg = this.damage;
    let n = 0;
    for (const x0 of xs) for (const [ox, deg] of pat) {
      const s = this.shots.find((o) => !o.on);
      if (!s) break;
      const a = deg * Math.PI / 180;
      Object.assign(s, { on: true, x: x0 + ox, y: P.y + 0.9, vx: Math.sin(a) * SHOT_SPEED, vy: Math.cos(a) * SHOT_SPEED, dmg });
      n++;
    }
    this.stats.shots += n;
    P.fireCd = 0.2 / this.fireRate;
    this.h.sfx('shot');
  }

  updateShots(dt) {
    for (const s of this.shots) {
      if (!s.on) continue;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y > TOP_SPAWN || Math.abs(s.x) > FW / 2 + 1) s.on = false;
    }
  }

  updateEnemyShots(dt) {
    for (const b of this.ebs) {
      if (!b.on) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < BOTTOM_OUT || b.y > TOP_SPAWN + 2 || Math.abs(b.x) > FW) b.on = false;
    }
  }

  drawBullets() {
    const A = this.shotB; A.begin();
    for (const s of this.shots) if (s.on) A.add(s.x, s.y, 0, Math.atan2(-s.vx, s.vy));
    A.end();
    const B = this.ebB; B.begin();
    for (const b of this.ebs) if (b.on) B.add(b.x, b.y, 0.1, Math.atan2(-b.vx, b.vy), b.big ? 1.45 : 1);
    B.end();
  }

  shipHit(i) {
    const P = this.player;
    if (P.shieldT > 0) {
      // 護盾擋一下
      P.shieldT = 0; P.inv = 1.2;
      this.h.explode(P.x + i * DUAL_DX, P.y, [0x5affc0, 0xffffff], { n: 18 });
      this.h.sfx('shield'); this.h.vibrate(40);
      this.pushStatus();
      return;
    }
    this.h.explode(P.x + i * DUAL_DX, P.y, COLORS.ship, { big: true });
    this.h.sfx('playerBoom'); this.h.vibrate(180); this.h.shake(0.8);
    this.combo.n = 0; this.h.combo(0);
    if (P.dual) { P.dual = false; if (i === 0) P.x += DUAL_DX; P.inv = 1.2; return; }
    P.state = 'dead'; P.t = 0; P.readyAt = -1;
    P.w = Math.max(1, P.w - 1); P.rapidT = 0;
    this.st.deaths++;
    this.pushHUD(); this.pushStatus();
  }

  /* ================= 碰撞 ================= */
  collide() {
    const B = this.big;
    for (const s of this.shots) {
      if (!s.on) continue;
      if (B && B.shielded && B.contains(s.x, s.y)) {
        // 進場護盾:子彈被擋掉
        s.on = false;
        if (Math.random() < 0.25) this.h.explode(s.x, s.y, [0x9fe8ff, 0xffffff], { n: 3, life: 0.2 });
        continue;
      }
      if (B && B.hittable && B.contains(s.x, s.y)) {
        s.on = false; this.stats.hits++;
        const dead = B.hit(s.dmg);
        this.addScore(B.kind === 'gold' ? 50 : 10);
        this.h.sfx('bossTick');
        if (Math.random() < 0.3) this.h.explode(s.x, s.y, B.info.colors, { n: 4, life: 0.25 });
        this.pushBoss();
        if (dead) this.h.bossBar(null);
        continue;
      }
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'wait') continue;
        const r = e.r || HIT_R[e.type], dx = s.x - e.x, dy = s.y - e.y;
        if (dx * dx + dy * dy < r * r) {
          s.on = false; this.stats.hits++;
          this.hitEnemy(e, false, s.dmg);
          break;
        }
        if (e.captive) {
          const [cx, cy] = this.captivePos(e);
          if ((s.x - cx) ** 2 + (s.y - cy) ** 2 < 0.5) {
            // 打到被抓的自己人:戰機毀了
            s.on = false;
            this.h.explode(cx, cy, COLORS.captive, { n: 18 });
            this.h.sfx('hit');
            e.mdl.root.remove(e.captive.root); e.captive = null; this.captive = null;
            break;
          }
        }
      }
    }

    const P = this.player;
    if (P.state !== 'play' || P.inv > 0 || P.loopT > 0) return; // 翻筋斗中無敵
    const ships = P.dual ? [P.x, P.x + DUAL_DX] : [P.x];
    for (const b of this.ebs) {
      if (!b.on) continue;
      const r = b.big ? 0.62 : 0.5;
      for (let i = 0; i < ships.length; i++) {
        if (Math.abs(b.x - ships[i]) < r && Math.abs(b.y - P.y) < r + 0.1) {
          b.on = false; this.shipHit(i); return;
        }
      }
    }
    for (const e of this.enemies) {
      if (!e.alive || !MOVING.has(e.state)) continue;
      for (let i = 0; i < ships.length; i++) {
        const dx = e.x - ships[i], dy = e.y - P.y;
        if (dx * dx + dy * dy < 1.0) { this.hitEnemy(e, true); this.shipHit(i); return; }
      }
    }
    if (B && B.hittable) for (let i = 0; i < ships.length; i++) if (B.contains(ships[i], P.y, -0.3)) { this.shipHit(i); return; }
  }

  /* ================= 分數 / HUD ================= */
  addScore(p) {
    this.score += p;
    if (this.score >= this.nextExtra) {
      this.player.lives++;
      this.nextExtra = this.nextExtra < EXTRA_LIFE[1] ? EXTRA_LIFE[1] : this.nextExtra + 100000;
      this.h.sfx('extra');
      this.tag('1UP', 'yellow');
    }
    if (this.score > this.hi) this.hi = this.score;
    this.pushHUD();
  }

  /** 戰機頭上的小標籤(道具、進化…):不佔畫面中央 */
  tag(text, color) {
    const P = this.player;
    this.h.popup(P.x + (P.dual ? DUAL_DX / 2 : 0), P.y + 1.4, text, color, true);
  }

  pushHUD() {
    this.h.hud({ score: this.score, hi: this.hi, lives: this.phase === 'title' ? 0 : this.player.lives, stage: this.phase === 'title' ? 0 : this.stageN });
  }

  pushStatus() {
    const P = this.player, lv = SHIP_LV[P.evo - 1];
    const cur = EVO_XP[P.evo - 1], nxt = EVO_XP[P.evo];
    this.h.status({
      evo: P.evo, name: lv.name, frac: nxt ? clamp((P.xp - cur) / (nxt - cur), 0, 1) : 1,
      w: P.w, maxW: MAX_POWER, rapid: P.rapidT > 0, shield: P.shieldT > 0, loops: P.loops,
    });
  }
}
