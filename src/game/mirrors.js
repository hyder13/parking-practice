import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * 後照鏡 / 倒車影像:每面鏡子一台相機 → render target → HUD 上的一片
 * quad(scale.x = -1 做鏡像)。鏡框本身是 HTML(index.html 的 .mirror),
 * quad 的位置跟著鏡框的 getBoundingClientRect 對齊。
 * 鏡子不走描線後製(省效能),顏色一樣來自卡通材質。
 * ------------------------------------------------------------------ */
export class Mirrors {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(0, innerWidth, innerHeight, 0, -1, 1);
    this.list = {};
    const defs = [['rear', 'mRear', 32], ['left', 'mLeft', 40], ['right', 'mRight', 40], ['back', 'mBack', 105]];
    for (const [key, id, fov] of defs) {
      const el = document.getElementById(id);
      const cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 300);
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: rt.texture }));
      q.visible = false; this.scene.add(q);
      this.list[key] = { el, cam, rt, q, on: false };
    }
    this._v = new THREE.Vector3(); this._t = new THREE.Vector3();
    this.frame = 0;
    this.buildGuides();
    this.layout();
  }

  layout() {
    this.cam.right = innerWidth; this.cam.top = innerHeight; this.cam.updateProjectionMatrix();
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    for (const m of Object.values(this.list)) {
      const r = m.el.getBoundingClientRect(), bw = 4, w = r.width - bw * 2, h = r.height - bw * 2;
      m.cam.aspect = w / h; m.cam.updateProjectionMatrix();
      m.rt.setSize(Math.max(4, Math.round(w * pr)), Math.max(4, Math.round(h * pr)));
      m.q.scale.set(-w, h, 1); // 水平翻轉 = 鏡像
      m.q.position.set(r.left + bw + w / 2, innerHeight - (r.top + bw + h / 2), 0);
    }
  }

  set(key, on) {
    const m = this.list[key];
    if (m.on !== on) { m.on = on; m.el.classList.toggle('off', !on); m.q.visible = on; }
  }
  get any() { return Object.values(this.list).some((m) => m.on); }

  aim(m, car, pos, tgt) {
    this._v.set(...pos); car.group.localToWorld(this._v);
    this._t.set(...tgt); car.group.localToWorld(this._t);
    m.cam.position.copy(this._v); m.cam.up.set(0, 1, 0); m.cam.lookAt(this._t); m.cam.updateMatrixWorld();
  }

  update(car) {
    const sp = car.spec, H = sp.H, belt = car.belt, L = this.list, mz = car.fb - 0.12;
    this.aim(L.rear, car, [0, H - 0.14, car.eye.z + 0.45], [0, H - 0.5, -sp.L]);
    this.aim(L.left, car, [sp.W / 2 + 0.16, belt + 0.1, mz], [sp.W / 2 + 0.38, belt - 0.05, mz - 1]);
    this.aim(L.right, car, [-sp.W / 2 - 0.16, belt + 0.1, mz], [-sp.W / 2 - 0.4, belt - 0.05, mz - 1]);
    this.aim(L.back, car, [0, belt - 0.05, -sp.L / 2 - 0.1], [0, -1.0, -sp.L / 2 - 2.2]);
  }

  render(renderer, scene, car) {
    if (!this.any) return;
    this.frame++;
    this.update(car);
    for (const [k, m] of Object.entries(this.list)) {
      if (!m.on) continue;
      if ((k === 'left' || k === 'right') && (this.frame % 2) !== (k === 'left' ? 0 : 1)) continue; // 側鏡隔幀更新
      renderer.setRenderTarget(m.rt); renderer.clear(); renderer.render(scene, m.cam);
    }
    if (this.list.back.on) this.updateGuides(car);
    renderer.setRenderTarget(null);
    renderer.autoClear = false; renderer.clearDepth(); renderer.render(this.scene, this.cam); renderer.autoClear = true;
  }

  /* 倒車影像的預測軌跡線:依目前方向盤角度往後模擬 3.2 m */
  buildGuides() {
    const svg = document.getElementById('bcSvg');
    svg.innerHTML = '<polyline id="gl" fill="none" stroke="#f0c341" stroke-width="3"/><polyline id="gr" fill="none" stroke="#f0c341" stroke-width="3"/>' +
      '<line id="m0" stroke="#ff4d4d" stroke-width="4"/><line id="m1" stroke="#f0c341" stroke-width="4"/><line id="m2" stroke="#3ecf8e" stroke-width="4"/>';
    this.g = ['gl', 'gr', 'm0', 'm1', 'm2'].map((id) => document.getElementById(id));
  }
  updateGuides(car) {
    const sp = car.spec, cam = this.list.back.cam, over = sp.L / 2 - sp.wb / 2, V = this._v;
    let a = car.a, rx = car.x - Math.sin(a) * sp.wb / 2, rz = car.z - Math.cos(a) * sp.wb / 2;
    const Lp = [], Rp = [], marks = { 5: null, 10: null, 20: null }, ds = -0.1;
    const proj = (x, z) => { V.set(x, 0.02, z).project(cam); if (V.z > 1 || V.z < -1) return null; return [(1 - (V.x + 1) / 2) * 420, (1 - (V.y + 1) / 2) * 236]; };
    for (let i = 0; i <= 32; i++) {
      const f = [Math.sin(a), Math.cos(a)], r = [Math.cos(a), -Math.sin(a)];
      const bx = rx - f[0] * over, bz = rz - f[1] * over;
      if (i >= 3) {
        const pl = proj(bx + r[0] * sp.W / 2, bz + r[1] * sp.W / 2), pr = proj(bx - r[0] * sp.W / 2, bz - r[1] * sp.W / 2);
        if (pl && pr) { Lp.push(pl); Rp.push(pr); if (i in marks) marks[i] = [pl, pr]; }
      }
      const a2 = a + ds * Math.tan(car.steer) / sp.wb;
      rx += Math.sin((a + a2) / 2) * ds; rz += Math.cos((a + a2) / 2) * ds; a = a2;
    }
    this.g[0].setAttribute('points', Lp.map((p) => p.join(',')).join(' '));
    this.g[1].setAttribute('points', Rp.map((p) => p.join(',')).join(' '));
    [5, 10, 20].forEach((k, i) => {
      const e = this.g[2 + i], m = marks[k] || [[0, 0], [0, 0]];
      e.setAttribute('x1', m[0][0]); e.setAttribute('y1', m[0][1]); e.setAttribute('x2', m[1][0]); e.setAttribute('y2', m[1][1]);
    });
  }
}
