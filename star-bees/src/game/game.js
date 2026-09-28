import { PAL } from '../core/palette.js';
import { FW, PLAYER_Y, TOP_SPAWN, BOTTOM_OUT, ROWS, ROW0, DY_TOP, slotOf, SCORE, EXTRA_LIFE, stageCfg } from './config.js';
import { Path, ENTRY, diveBee, diveBfly, diveBoss, diveBeam, exitDown } from './paths.js';
import { spawnModel, buildShot, buildEnemyShot, BOSS_HIT_SWAP } from './models.js';

/* ------------------------------------------------------------------ *
 * 遊戲規則(純邏輯 + 擺放模型),畫面 / 聲音 / HUD 透過 hooks 交給 main.js。
 *
 * phase:title → intro → play → (clear | result) → intro … ;死光 → over → ended
 * 敵人 state:
 *   wait     還沒輪到進場(隱藏)
 *   enter    照進場軌跡飛             home   自己飛回陣型格子
 *   form     在陣型裡(跟著陣型擺動)   dive   俯衝攻擊中
 *   escort   當王的護衛(跟著王飛)     beamdive / beam  王下來放牽引光束
 *   exit     放完光束往下離場          fly    獎勵關:飛完軌跡就離場
 * ------------------------------------------------------------------ */

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrapPi = (a) => { a = (a + Math.PI) % (Math.PI * 2); if (a < 0) a += Math.PI * 2; return a - Math.PI; };
const turnToward = (a, b, step) => { const d = wrapPi(b - a); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; };
const lerp = (a, b, k) => a + (b - a) * k;

export const COLORS = {
  bee: [PAL.beeBody, PAL.beeBelly, PAL.beeWing, PAL.white],
  bfly: [PAL.bflyBody, PAL.bflyWing, PAL.bflyRim, PAL.white],
  boss: [PAL.bossBody, PAL.bossWing, PAL.bossHead, PAL.white],
  bossHit: [PAL.bossHit, PAL.bossWing, PAL.bossHitHead, PAL.white],
  ship: [PAL.shipWhite, PAL.shipRed, PAL.shipBlue, PAL.engine, PAL.shipCyan],
  captive: [PAL.captive, PAL.white, PAL.captiveDark],
};

const DUAL_DX = 1.15;          // 雙機:第二台在右邊多遠
const MAX_VOLLEYS = 2;         // 畫面上最多 2 輪子彈(原作限制)
const SHOT_SPEED = 34;
const HIT_R = { bee: 0.78, bfly: 0.82, boss: 0.95 };
const CAPTIVE_OFF = 1.25;      // 被抓的戰機掛在王身後多遠
const BEAM_LEN = 8.2;
const ATTACKING = new Set(['dive', 'escort', 'beamdive', 'beam', 'exit']);
const MOVING = new Set(['enter', 'home', 'dive', 'escort', 'beamdive', 'beam', 'exit', 'fly']);

export class Game {
  constructor(scene, hooks) {
    this.scene = scene;
    this.h = hooks;
    this.enemies = [];
    this.pathCache = new Map();
    this.shots = Array.from({ length: 8 }, () => {
      const m = buildShot(); m.visible = false; scene.add(m);
      return { m, x: 0, y: 0, on: false, vol: 0 };
    });
    this.ebs = Array.from({ length: 48 }, () => {
      const m = buildEnemyShot(); m.visible = false; scene.add(m);
      return { m, x: 0, y: 0, vx: 0, vy: 0, on: false };
    });
    this.ship = spawnModel('ship'); this.ship2 = spawnModel('ship');
    scene.add(this.ship.root, this.ship2.root);
    this.ship.root.visible = this.ship2.root.visible = false;

    this.player = { x: 0, vx: 0, roll: 0, state: 'none', dual: false, t: 0, lives: 0, fireCd: 0, readyAt: -1 };
    this.input = { move: 0, drag: 0, fire: false };
    this.score = 0;
    this.hi = hooks.loadHi();
    this.stageN = 1;
    this.cfg = stageCfg(1);
    this.form = { t: 0, breathe: 1 };
    this.volley = 0;
    this.captive = null;   // 身上掛著被抓戰機的那隻王
    this.capture = null;   // 正在被光束吸上去
    this.rescue = null;    // 救回 / 逃走中的戰機
    this.phase = 'title'; this.phaseT = 0;
    this.attract();
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
    this.waves = []; this.startedWaves = 0;
    this.phase = 'title'; this.phaseT = 0;
  }

  start(stageN = 1) {
    this.clearAll();
    const P = this.player;
    Object.assign(P, { x: 0, vx: 0, state: 'play', dual: false, t: 0, lives: 2, fireCd: 0, readyAt: -1 });
    this.score = 0;
    this.nextExtra = EXTRA_LIFE[0];
    this.stats = { shots: 0, hits: 0 };
    this.stageN = stageN;
    this.overShown = false;
    this.beginStage(true);
    this.pushHUD();
  }

  toTitle() { this.attract(); this.pushHUD(); }

  beginStage(first) {
    const cfg = this.cfg = stageCfg(this.stageN);
    this.clearEnemies();
    this.ebs.forEach((b) => this.offEB(b));
    const P = this.player;
    if (P.state !== 'play' && P.state !== 'capturing') {
      if (P.lives > 0) { P.lives--; P.state = 'play'; P.x = 0; P.readyAt = -1; }
    }
    this.form = { t: 0, breathe: 0 };
    this.waves = cfg.waves.map((w) => ({ def: w, members: [], started: false }));
    this.startedWaves = 0;
    this.chHits = 0; this.chTotal = 0;
    this.diveT = 2.5;
    for (const w of this.waves) {
      const d = w.def;
      const n = d.slots ? d.slots.length : d.types.length;
      for (let i = 0; i < n; i++) {
        const s = d.pair ? (i < n / 2 ? -1 : 1) : d.s;
        const slot = d.slots ? slotOf(d.slots[i]) : null;
        const e = this.makeEnemy(slot ? slot.type : d.types[i], slot);
        e.path = this.path(d.path, s);
        e.stream = d.pair ? i % (n / 2) : i;
        e.speed = cfg.enterSpeed;
        e.entryShot = cfg.kind === 'normal' && Math.random() < (cfg.enterFire || 0);
        e.path.at(0, e);
        w.members.push(e);
        if (!slot) this.chTotal++;
      }
    }
    this.phase = 'intro'; this.phaseT = 0;
    this.introDur = first ? 3.6 : 2.4;
    const title = cfg.kind === 'challenge' ? 'CHALLENGING STAGE' : `STAGE ${this.stageN}`;
    this.introTitle = title; this.introMsg = first;
    if (first) this.h.msg([['PLAYER 1', 'cyan']], 1.5);
    else this.h.msg([[title, 'cyan']], 2.2);
    this.h.sfx(first ? 'start' : cfg.kind === 'challenge' ? 'challenge' : 'stage');
    this.h.stage(this.stageN);
    this.pushHUD();
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
      type, slot, mdl, hp: type === 'boss' && this.cfg.kind === 'normal' ? 2 : 1,
      state: 'wait', started: false, delay: 0, alive: true,
      x: 0, y: TOP_SPAWN, vx: 0, vy: -1, ang: Math.PI, roll: 0, hd: -Math.PI / 2,
      d: 0, path: null, speed: 10, homeSpeed: 10, stream: 0,
      flap: Math.random() * 6, shotsLeft: 0, nextShotY: 0, entryShot: false,
      leader: null, side: 0, escorts: [], escKilled: 0, captive: null, bt: 0,
    };
    if (slot) { const [x, y] = this.slotPos(slot); e.x = x; e.y = y; }
    this.enemies.push(e);
    return e;
  }

  clearEnemies() {
    for (const e of this.enemies) this.scene.remove(e.mdl.root);
    this.enemies = [];
    this.captive = null; this.capture = null;
    if (this.rescue) { this.scene.remove(this.rescue.m.root); this.rescue = null; }
    this.h.setBeam(false);
  }

  clearAll() {
    this.clearEnemies();
    this.shots.forEach((s) => { s.on = false; s.m.visible = false; });
    this.ebs.forEach((b) => this.offEB(b));
    this.player.state = 'none'; this.player.dual = false;
    this.ship.root.visible = this.ship2.root.visible = false;
  }

  startWave(i) {
    const w = this.waves[i];
    w.started = true; this.startedWaves++;
    const spacing = 2.0 / this.cfg.enterSpeed;
    for (const e of w.members) { e.started = true; e.delay = e.stream * spacing; }
  }

  updateWaves() {
    const i = this.startedWaves;
    if (i >= this.waves.length) return;
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
  update(dt) {
    this.phaseT += dt;
    this.form.t += dt;
    if (this.phase !== 'title' && this.allEntered) this.form.breathe = Math.min(1, this.form.breathe + dt * 0.5);

    switch (this.phase) {
      case 'intro':
        if (this.introMsg && this.phaseT > 1.5) { this.introMsg = false; this.h.msg([[this.introTitle, 'cyan']], 1.9); }
        if (this.phaseT >= this.introDur) { this.phase = 'play'; this.phaseT = 0; }
        break;
      case 'play':
        this.updateWaves();
        this.maybeDive(dt);
        this.checkClear();
        break;
      case 'clear':
        if (this.phaseT > 1.6) { this.stageN++; this.beginStage(false); }
        break;
      case 'result': this.updateResult(); break;
      case 'over':
        if (this.phaseT > 3.2 && !this.overShown) { this.overShown = true; this.phase = 'ended'; this.h.gameOver(this.stats, this.score); }
        break;
    }

    if (this.phase !== 'title') { this.updatePlayer(dt); this.updateShots(dt); }
    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
    this.updateEnemyShots(dt);
    if (this.phase !== 'title') this.collide();
    this.updateCapture(dt);
    this.updateRescue(dt);
    if (this.enemies.some((e) => !e.alive)) this.enemies = this.enemies.filter((e) => e.alive);
  }

  checkClear() {
    if (this.startedWaves < this.waves.length || this.enemies.length || this.rescue || this.capture) return;
    if (this.cfg.kind === 'challenge') { this.phase = 'result'; this.phaseT = 0; this.resultStep = 0; return; }
    this.phase = 'clear'; this.phaseT = 0;
    this.h.warp(1.4);
  }

  updateResult() {
    const t = this.phaseT;
    if (this.resultStep === 0) {
      this.resultStep = 1;
      this.h.msg([['NUMBER OF HITS', 'cyan'], [String(this.chHits), 'white']], 2.0);
    } else if (this.resultStep === 1 && t > 2.1) {
      this.resultStep = 2;
      if (this.chHits >= this.chTotal) {
        this.h.msg([['PERFECT !', 'red'], ['SPECIAL BONUS 10000 PTS', 'yellow']], 2.4);
        this.addScore(10000); this.h.sfx('perfect');
      } else {
        this.h.msg([['BONUS', 'cyan'], [String(this.chHits * 100), 'white']], 2.2);
        this.addScore(this.chHits * 100);
      }
    } else if (this.resultStep === 2 && t > 4.7) {
      this.stageN++; this.h.warp(1.2); this.beginStage(false);
    }
  }

  /* ================= 陣型 ================= */
  /** 格子的目前位置:進場時整排左右擺,全部到齊後改成「呼吸」(一脹一縮) */
  slotPos(slot) {
    const F = this.form, b = F.breathe;
    const sway = Math.sin(F.t * 0.9) * 1.5 * (1 - b);
    const s = 1 + b * 0.12 * (0.5 - 0.5 * Math.cos(F.t * 1.9));
    // 以最上排上方一點為中心縮放(by 是相對最上排的高度)
    return [slot.bx * s + sway, ROW0 + 1 + (slot.by - 1) * (1 + (s - 1) * 0.8)];
  }

  /* ================= 出擊 ================= */
  maybeDive(dt) {
    const cfg = this.cfg;
    if (cfg.kind !== 'normal' || this.player.state !== 'play') return;
    if (!(this.allEntered || this.startedWaves > cfg.diveFrom)) return;
    this.diveT -= dt;
    if (this.diveT > 0) return;
    const few = this.enemies.length <= 6;
    this.diveT = cfg.diveEvery * rand(0.6, 1.3) * (few ? 0.45 : 1);
    const active = this.enemies.filter((e) => ATTACKING.has(e.state)).length;
    if (active >= cfg.maxDivers + (few ? 2 : 0)) return;
    const form = this.enemies.filter((e) => e.state === 'form');
    if (!form.length) return;
    const r = Math.random();
    let pool = form.filter((e) => e.type === (r < 0.48 ? 'bee' : r < 0.8 ? 'bfly' : 'boss'));
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
      this.startDive(e, diveBoss(e.x, e.y, P.x));
      e.escorts = []; e.escKilled = 0;
      if (Math.random() < cfg.escort) {
        const c = this.enemies.filter((o) => o.state === 'form' && o.type === 'bfly' && o.slot.row === 1)
          .sort((a, b) => Math.abs(a.slot.bx - e.slot.bx) - Math.abs(b.slot.bx - e.slot.bx)).slice(0, 2)
          .sort((a, b) => a.slot.bx - b.slot.bx);
        c.forEach((o, i) => {
          o.state = 'escort'; o.leader = e;
          o.side = c.length === 2 ? (i ? 1 : -1) : (o.slot.bx < e.slot.bx ? -1 : 1);
          o.shotsLeft = cfg.shots; o.nextShotY = o.y - 3; o.speed = e.speed;
          e.escorts.push(o);
        });
      }
    } else if (e.type === 'bee') this.startDive(e, diveBee(e.x, e.y, P.x, Math.random() < cfg.beeLoop));
    else this.startDive(e, diveBfly(e.x, e.y, P.x));
    this.h.sfx('dive');
  }

  startDive(e, pts, state = 'dive') {
    e.state = state; e.path = new Path(pts); e.d = 0;
    e.speed = this.cfg.diveSpeed * (e.type === 'boss' ? 0.92 : 1);
    e.shotsLeft = this.cfg.shots; e.nextShotY = e.y - 2.5;
  }

  toHome(e, hd) {
    e.state = 'home';
    e.hd = hd !== undefined ? hd : Math.atan2(e.vy, e.vx);
    e.homeSpeed = Math.max(9, e.speed);
  }

  /** 從畫面下方飛出去 → 從上方回來歸位 */
  wrapTop(e) {
    e.x = this.slotPos(e.slot)[0]; e.y = TOP_SPAWN; e.vx = 0; e.vy = -1;
    this.toHome(e, -Math.PI / 2);
  }

  pathDone(e) {
    switch (e.state) {
      case 'enter': this.toHome(e); break;
      case 'fly': this.removeEnemy(e); break;
      case 'dive': case 'exit':
        if (e.path.loop) this.toHome(e); else this.wrapTop(e);
        break;
      case 'beamdive': e.state = 'beam'; e.bt = 0; this.h.sfx('beam'); break;
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
        if (dist < 0.06) { e.state = 'form'; e.x = tx; e.y = ty; break; }
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

    const { root, rig, wings } = e.mdl;
    root.position.set(e.x, e.y, Math.sin(e.flap * 0.35) * 0.12);
    root.rotation.z = e.ang;
    rig.rotation.y = e.roll;
    // 翅膀:近似方波的兩段式拍動(原作 2 格動畫的味道,但在 3D 裡有過渡)
    const sq = Math.tanh(Math.sin(e.flap) * 3);
    for (const w of wings) {
      const s = w.userData.side;
      w.rotation.y = -s * (0.25 + 0.35 * sq);
      w.rotation.z = s * 0.1 * sq;
    }
  }

  releaseEscort(e) {
    e.leader = null;
    if (e.y < -13) this.wrapTop(e);
    else { e.state = 'dive'; e.path = new Path(exitDown(e.x, e.y)); e.d = 0; e.speed = this.cfg.diveSpeed; }
  }

  updateBeam(e, dt) {
    e.bt += dt;
    const holding = this.capture && this.capture.boss === e;
    let len;
    if (e.bt < 0.7) len = BEAM_LEN * e.bt / 0.7;
    else if (e.bt < 3.6 || holding) len = BEAM_LEN;
    else len = BEAM_LEN * Math.max(0, 1 - (e.bt - 3.6) / 0.5);
    this.h.setBeam(true, e.x, e.y, len);
    const P = this.player;
    if (!this.capture && e.bt > 0.7 && e.bt < 3.6 && P.state === 'play' && !P.dual && !this.captive
      && Math.abs(P.x - e.x) < 1.45) this.startCapture(e);
    if (holding) return;
    if (e.bt > 4.1) {
      this.h.setBeam(false);
      e.state = 'exit'; e.path = new Path(exitDown(e.x, e.y)); e.d = 0;
    }
  }

  enemyFire(e) {
    const P = this.player;
    if (this.cfg.kind !== 'normal' || P.state !== 'play' || this.phase !== 'play') return;
    if ((e.state === 'dive' || e.state === 'escort') && e.shotsLeft > 0 && e.y < e.nextShotY && e.y > -5.5 && e.vy < 0) {
      this.fireAt(e); e.shotsLeft--; e.nextShotY = e.y - 1.6;
    }
    if (e.state === 'enter' && e.entryShot && e.y < 5 && e.y > -4 && e.vy < 0) { e.entryShot = false; this.fireAt(e); }
  }

  fireAt(e) {
    const b = this.ebs.find((o) => !o.on);
    if (!b) return;
    let dx = this.player.x - e.x + rand(-1.2, 1.2), dy = PLAYER_Y - e.y;
    if (dy > -2) return;
    let L = Math.hypot(dx, dy); dx /= L; dy /= L;
    if (dy > -0.62) { dy = -0.62; dx = Math.sign(dx) * Math.sqrt(1 - dy * dy); }
    const v = this.cfg.bulletSpeed;
    Object.assign(b, { on: true, x: e.x, y: e.y - 0.5, vx: dx * v, vy: dy * v });
    b.m.visible = true;
    b.m.rotation.z = Math.atan2(-dx, dy) + Math.PI;
  }

  removeEnemy(e) {
    e.alive = false;
    this.scene.remove(e.mdl.root);
    if (e.state === 'beam') this.h.setBeam(false);
  }

  hitEnemy(e, crash = false) {
    if (e.type === 'boss' && e.hp > 1 && !crash) {
      e.hp--;
      for (const m of e.mdl.meshes) { const s = BOSS_HIT_SWAP.get(m.material); if (s) m.material = s; }
      this.h.sfx('bossHit');
      this.h.explode(e.x, e.y, COLORS.boss, { n: 6, life: 0.35 });
      return;
    }
    const moving = e.state !== 'form';
    let pts = SCORE[e.type][moving ? 1 : 0];
    if (e.type === 'boss' && moving && e.escorts.length) pts = [400, 800, 1600][Math.min(2, e.escKilled)];
    if (e.leader) e.leader.escKilled++;
    this.addScore(pts);
    if (pts >= 400 || this.cfg.kind === 'challenge') this.h.popup(e.x, e.y, pts, pts >= 800 ? 'yellow' : 'cyan');
    const boss = e.type === 'boss';
    this.h.explode(e.x, e.y, boss ? COLORS.bossHit : COLORS[e.type], { n: boss ? 24 : 16 });
    this.h.sfx(boss ? 'bossKill' : 'hit');
    this.h.shake(boss ? 0.35 : 0.12);
    if (this.cfg.kind === 'challenge') this.chHits++;
    if (e.captive) {
      if (e.state === 'form' || e.state === 'home') this.freeCaptive(e, 'flee');
      else this.freeCaptive(e, 'rescue');
    }
    if (this.capture && this.capture.boss === e) this.cancelCapture();
    this.removeEnemy(e);
  }

  /* ================= 牽引光束 / 救援 ================= */
  startCapture(e) {
    const P = this.player;
    P.state = 'capturing';
    this.capture = { boss: e, t: 0, x0: P.x };
    this.h.vibrate(60);
  }

  cancelCapture() {
    // 王在吸的途中被打掉:戰機掉回原位,繼續玩
    const P = this.player;
    this.capture = null;
    P.state = 'play';
    this.ship.root.rotation.set(0, 0, 0);
  }

  updateCapture(dt) {
    const C = this.capture;
    if (!C) return;
    const e = C.boss, P = this.player, S = this.ship.root;
    C.t += dt;
    const k = Math.min(1, C.t / 2.3), ease = k * k * (3 - 2 * k);
    S.position.set(lerp(C.x0, e.x, ease), lerp(PLAYER_Y, e.y - CAPTIVE_OFF, ease), 0);
    S.rotation.z += dt * (14 - 9 * k);
    if (k < 1) return;
    // 吸上去了:掛到王身後,戰機變紅色
    this.capture = null;
    const cap = spawnModel('captive');
    e.mdl.root.add(cap.root); cap.root.position.set(0, -CAPTIVE_OFF, 0);
    e.captive = cap; this.captive = e;
    S.rotation.set(0, 0, 0);
    P.state = 'lost'; P.t = 0; P.readyAt = -1;
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
    const m = spawnModel(mode === 'rescue' ? 'ship' : 'captive');
    m.root.position.set(x, y, 0); this.scene.add(m.root);
    this.rescue = { m, x, y, t: 0, mode };
    if (mode === 'rescue') this.h.msg([['FIGHTER RESCUED', 'cyan']], 2);
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
    if (R.t < 1.1) { root.rotation.z += dt * 12; return; }
    root.rotation.z = turnToward(wrapPi(root.rotation.z), 0, dt * 6);
    let tx = 0, ty = -8, dock = false;
    if (P.state === 'play') {
      const maxX = FW / 2 - 0.9;
      dock = true;
      tx = P.x + DUAL_DX <= maxX ? P.x + DUAL_DX : P.x - DUAL_DX;
      ty = PLAYER_Y;
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
    }
  }

  /* ================= 玩家 ================= */
  updatePlayer(dt) {
    const P = this.player;
    if (P.state === 'play') {
      const maxX = FW / 2 - 0.9 - (P.dual ? DUAL_DX : 0);
      const nx = clamp(P.x + this.input.move * 13 * dt + this.input.drag, -FW / 2 + 0.9, maxX);
      P.vx = dt > 0 ? (nx - P.x) / dt : 0; P.x = nx;
      P.fireCd -= dt;
      if (this.input.fire && P.fireCd <= 0 && this.phase !== 'over') this.fire();
    } else P.vx = 0;
    this.input.drag = 0;

    if ((P.state === 'dead' || P.state === 'lost') && this.phase === 'play') { P.t += dt; if (P.t > 2.2) this.tryRespawn(); }
    else if (P.state === 'dead' || P.state === 'lost') P.t += dt;

    P.roll += (clamp(P.vx * 0.045, -0.6, 0.6) - P.roll) * Math.min(1, dt * 10);
    const show = P.state === 'play' || P.state === 'capturing';
    const S = this.ship, S2 = this.ship2;
    S.root.visible = show;
    if (P.state === 'play') S.root.position.set(P.x, PLAYER_Y, 0);
    S.rig.rotation.y = P.state === 'play' ? P.roll : 0;
    S2.root.visible = P.state === 'play' && P.dual;
    S2.root.position.set(P.x + DUAL_DX, PLAYER_Y, 0);
    S2.rig.rotation.y = P.roll;
    for (const f of [...S.flames, ...S2.flames]) f.scale.y = 0.24 + Math.random() * 0.16;
  }

  tryRespawn() {
    const P = this.player;
    if (P.lives <= 0) { this.gameOver(); return; }
    const busy = this.enemies.some((e) => ATTACKING.has(e.state)) || this.capture;
    if (busy && P.t < 8) return;
    if (P.readyAt < 0) { P.readyAt = P.t; this.h.msg([['READY', 'cyan']], 1.4); return; }
    if (P.t - P.readyAt < 1.4) return;
    P.lives--; P.state = 'play'; P.x = 0; P.readyAt = -1;
    this.pushHUD();
  }

  gameOver() {
    if (this.phase === 'over' || this.phase === 'ended') return;
    this.phase = 'over'; this.phaseT = 0;
    this.player.state = 'none';
    this.h.msg([['GAME OVER', 'red']], 3.2);
    this.h.sfx('gameOver');
    this.h.saveHi(this.hi);
  }

  fire() {
    const P = this.player;
    const live = new Set(this.shots.filter((s) => s.on).map((s) => s.vol));
    if (live.size >= MAX_VOLLEYS) return;
    const xs = P.dual ? [P.x, P.x + DUAL_DX] : [P.x];
    const free = this.shots.filter((s) => !s.on);
    if (free.length < xs.length) return;
    this.volley++;
    xs.forEach((x, i) => {
      const s = free[i];
      Object.assign(s, { on: true, x, y: PLAYER_Y + 0.9, vol: this.volley });
      s.m.visible = true; s.m.position.set(x, s.y, 0);
    });
    this.stats.shots += xs.length;
    P.fireCd = 0.15;
    this.h.sfx('shot');
  }

  updateShots(dt) {
    for (const s of this.shots) {
      if (!s.on) continue;
      s.y += SHOT_SPEED * dt;
      if (s.y > 16.5) { s.on = false; s.m.visible = false; continue; }
      s.m.position.set(s.x, s.y, 0);
    }
  }

  offEB(b) { b.on = false; b.m.visible = false; }

  updateEnemyShots(dt) {
    for (const b of this.ebs) {
      if (!b.on) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < BOTTOM_OUT || Math.abs(b.x) > FW) { this.offEB(b); continue; }
      b.m.position.set(b.x, b.y, 0.1);
      b.m.rotation.y += dt * 9;
    }
  }

  shipHit(i) {
    const P = this.player;
    this.h.explode(P.x + i * DUAL_DX, PLAYER_Y, COLORS.ship, { big: true });
    this.h.sfx('playerBoom'); this.h.vibrate(180); this.h.shake(0.8);
    if (P.dual) { P.dual = false; if (i === 0) P.x += DUAL_DX; return; }
    P.state = 'dead'; P.t = 0; P.readyAt = -1;
    this.pushHUD();
  }

  /* ================= 碰撞 ================= */
  collide() {
    for (const s of this.shots) {
      if (!s.on) continue;
      for (const e of this.enemies) {
        if (!e.alive || e.state === 'wait') continue;
        const r = HIT_R[e.type], dx = s.x - e.x, dy = s.y - e.y;
        if (dx * dx + dy * dy < r * r) {
          s.on = false; s.m.visible = false; this.stats.hits++;
          this.hitEnemy(e);
          break;
        }
        if (e.captive) {
          const [cx, cy] = this.captivePos(e);
          if ((s.x - cx) ** 2 + (s.y - cy) ** 2 < 0.5) {
            // 打到被抓的自己人:戰機毀了
            s.on = false; s.m.visible = false;
            this.h.explode(cx, cy, COLORS.captive, { n: 18 });
            this.h.sfx('hit');
            e.mdl.root.remove(e.captive.root); e.captive = null; this.captive = null;
            break;
          }
        }
      }
    }

    const P = this.player;
    if (P.state !== 'play') return;
    const ships = P.dual ? [P.x, P.x + DUAL_DX] : [P.x];
    for (const b of this.ebs) {
      if (!b.on) continue;
      for (let i = 0; i < ships.length; i++) {
        if (Math.abs(b.x - ships[i]) < 0.55 && Math.abs(b.y - PLAYER_Y) < 0.62) {
          this.offEB(b); this.shipHit(i); return;
        }
      }
    }
    for (const e of this.enemies) {
      if (!e.alive || !MOVING.has(e.state)) continue;
      for (let i = 0; i < ships.length; i++) {
        const dx = e.x - ships[i], dy = e.y - PLAYER_Y;
        if (dx * dx + dy * dy < 1.0) { this.hitEnemy(e, true); this.shipHit(i); return; }
      }
    }
  }

  /* ================= 分數 / HUD ================= */
  addScore(p) {
    this.score += p;
    if (this.score >= this.nextExtra) {
      this.player.lives++;
      this.nextExtra = this.nextExtra < EXTRA_LIFE[1] ? EXTRA_LIFE[1] : this.nextExtra + 70000;
      this.h.sfx('extra');
    }
    if (this.score > this.hi) this.hi = this.score;
    this.pushHUD();
  }

  pushHUD() {
    this.h.hud({ score: this.score, hi: this.hi, lives: this.phase === 'title' ? 0 : this.player.lives, stage: this.phase === 'title' ? 0 : this.stageN });
  }
}
