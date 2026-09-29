import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { flat } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * 特效:爆炸(像素方塊碎片 + 衝擊環)、牽引光束。
 * 全部用不受光的 flat 材質 + depthWrite:false → 不會被描線 pass 描黑,
 * 看起來像 80 年代街機的發光像素,但在 3D 空間裡飛散。
 * ------------------------------------------------------------------ */

const shardGeo = new THREE.BoxGeometry(1, 1, 1);
const ringGeo = new THREE.RingGeometry(0.62, 0.8, 28);
const coreGeo = new THREE.CircleGeometry(0.6, 20);
const MAX_SHARDS = 30;
const MAX_SMOKE = 7;
const smokeGeo = new THREE.IcosahedronGeometry(1, 1);
const FIRE = [0xffe35a, 0xff9a2a, 0xff5a2a];
const WHITE = new THREE.Color(0xffffff);
const SMOKE_C = new THREE.Color(PAL.smoke);
const rand = (a, b) => a + Math.random() * (b - a);

function stripeTex() {
  const c = document.createElement('canvas'); c.width = 8; c.height = 64;
  const g = c.getContext('2d');
  for (let y = 0; y < 64; y += 16) {
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(0, y, 8, 6);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y + 6, 8, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function trapezoid(top, bottom) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-top, 0, 0, top, 0, 0, bottom, -1, 0, -bottom, -1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  return g;
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.booms = [];
    for (let i = 0; i < 18; i++) this.booms.push(this.makeBoom());
    this.makeBeam();
  }

  makeBoom() {
    const g = new THREE.Group(); g.visible = false; this.scene.add(g);
    const shards = [];
    for (let i = 0; i < MAX_SHARDS; i++) {
      const m = new THREE.Mesh(shardGeo, flat({ color: 0xffffff, transparent: true, depthWrite: false }));
      g.add(m); shards.push({ m, vx: 0, vy: 0, vz: 0, s: 0, spin: 0 });
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringGeo, ringMat); g.add(ring);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const core = new THREE.Mesh(coreGeo, coreMat); core.position.z = 0.2; g.add(core);
    // 煙:灰色的球慢慢脹大、往上飄、淡掉(二戰空戰的爆炸一定要有黑煙)
    const smokes = [];
    for (let i = 0; i < MAX_SMOKE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: PAL.smoke, transparent: true, opacity: 0.5, depthWrite: false });
      const m = new THREE.Mesh(smokeGeo, mat); m.renderOrder = 1; g.add(m);
      smokes.push({ m, mat, vx: 0, vy: 0, s: 1, d: 0 });
    }
    return { g, shards, ring, ringMat, core, coreMat, smokes, t: 0, life: 1, big: false, on: false };
  }

  /** colors:碎片顏色(取自角色的配色);opt.big = 玩家爆炸 */
  explode(x, y, colors, { big = false, n = null, life = null, z = 0.4 } = {}) {
    let b = this.booms.find((o) => !o.on);
    if (!b) b = this.booms.reduce((a, o) => (o.t / o.life > a.t / a.life ? o : a));
    b.on = true; b.t = 0; b.big = big; b.life = life || (big ? 1.4 : 0.85);
    const count = Math.min(MAX_SHARDS, n || (big ? 30 : 16));
    b.shards.forEach((s, i) => {
      s.m.visible = i < count;
      if (i >= count) return;
      // 碎片:一半是機體的顏色、一半是火花
      s.m.material = flat({ color: i % 2 ? FIRE[i % FIRE.length] : colors[i % colors.length], transparent: true, depthWrite: false });
      const a = Math.random() * Math.PI * 2, sp = (3 + Math.random() * 8) * (big ? 1.35 : 1);
      s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp; s.vz = -2 + Math.random() * 7;
      s.s = (0.12 + Math.random() * 0.16) * (big ? 1.35 : 1);
      s.spin = (Math.random() - 0.5) * 20;
      s.m.position.set(0, 0, 0); s.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    });
    b.ringMat.color.set(0xffc26a).multiplyScalar(1.4);
    b.coreMat.color.set(0xfff0c0);
    const ns = big ? MAX_SMOKE : Math.min(MAX_SMOKE, Math.max(2, Math.round(count / 4)));
    b.smokes.forEach((m, i) => {
      m.m.visible = i < ns;
      const a = Math.random() * Math.PI * 2, sp = rand(0.6, 2.2) * (big ? 1.5 : 1);
      m.vx = Math.cos(a) * sp; m.vy = Math.sin(a) * sp;
      m.s = (big ? 0.75 : 0.45) * rand(0.7, 1.3); m.d = Math.random() * 0.12;
      m.m.position.set(m.vx * 0.1, m.vy * 0.1, -0.2 - i * 0.02);
      m.mat.color.set(i % 3 === 0 ? FIRE[i % FIRE.length] : PAL.smoke);
    });
    b.g.position.set(x, y, z); b.g.visible = true;
  }

  makeBeam() {
    const tex = stripeTex();
    const mk = (top, bottom, color, opacity, texRef) => {
      const mat = new THREE.MeshBasicMaterial({ map: texRef, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      return new THREE.Mesh(trapezoid(top, bottom), mat);
    };
    const tex2 = tex.clone(); tex2.needsUpdate = true;
    const g = new THREE.Group(); g.visible = false;
    const outer = mk(0.55, 2.0, PAL.beam2, 0.45, tex2);
    const inner = mk(0.4, 1.55, PAL.beam, 0.85, tex);
    inner.position.z = 0.05;
    g.add(outer, inner); this.scene.add(g);
    this.beam = { g, outer, inner, tex, tex2 };
  }

  /** 牽引光束:x,y = 王的位置;len = 目前長度(0 = 收起) */
  setBeam(on, x = 0, y = 0, len = 0) {
    const B = this.beam;
    B.g.visible = on && len > 0.05;
    if (!B.g.visible) return;
    B.g.position.set(x, y - 0.55, 0.1);
    B.g.scale.set(0.35 + 0.65 * Math.min(1, len / 3), len, 1);
    B.tex.repeat.set(1, len / 1.4); B.tex2.repeat.set(1, len / 1.9);
  }

  update(dt) {
    const B = this.beam;
    B.tex.offset.y += dt * 2.6; B.tex2.offset.y += dt * 1.7;
    for (const b of this.booms) {
      if (!b.on) continue;
      b.t += dt;
      const k = b.t / b.life;
      if (k >= 1) { b.on = false; b.g.visible = false; continue; }
      const drag = Math.max(0, 1 - 2.4 * dt);
      for (const s of b.shards) {
        if (!s.m.visible) continue;
        s.vx *= drag; s.vy *= drag; s.vz *= drag;
        s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
        s.m.rotation.x += s.spin * dt; s.m.rotation.y += s.spin * 0.7 * dt;
        s.m.scale.setScalar(Math.max(0.001, s.s * (1 - k * k)));
      }
      const rs = 0.4 + k * (b.big ? 5 : 3);
      b.ring.scale.set(rs, rs, 1);
      b.ringMat.opacity = 1 - k;
      const cs = (b.big ? 1.8 : 1.1) * (1 - k * 2.5);
      b.core.visible = cs > 0.02; b.core.scale.set(Math.max(0.01, cs), Math.max(0.01, cs), 1);
      b.coreMat.opacity = Math.max(0, 1 - k * 2.5);
      const tt = b.t * (b.big ? 0.8 : 1.1);
      for (const m of b.smokes) {
        if (!m.m.visible) continue;
        const kk = Math.max(0, tt - m.d);
        m.m.position.x += m.vx * dt * Math.max(0, 1 - kk); m.m.position.y += (m.vy * Math.max(0, 1 - kk) - 1.6) * dt;
        const sc = m.s * (0.4 + kk * 1.4);
        m.m.scale.set(sc, sc, sc * 0.6);
        m.mat.opacity = Math.max(0, 0.55 * (1 - k)) * Math.min(1, kk * 12);
        if (kk > 0.25 && m.mat.color.getHex() !== PAL.smoke) m.mat.color.lerp(SMOKE_C, Math.min(1, dt * 6));
      }
    }
  }
}
