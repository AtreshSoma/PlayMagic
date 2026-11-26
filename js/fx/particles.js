// ---------------------------------------------------------------------------
// Pooled particle system (structure-of-arrays, swap-remove, zero GC churn).
// Drawn with cached radial-glow sprites and additive blending. Every particle
// feels the world: head-tilt gravity, brow levitation, spell forces and palm
// impulses. A population of slow "ambient" motes is kept alive at all times.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, rand, randRange, pick, hexToRgb, alphaFor } from '../core/util.js';

const CAP = 4500;
export const KIND = { DUST: 0, EMBER: 1, SPORE: 2, SHARD: 3, AMBIENT: 4, SPARK: 5 };

export class Particles {
  constructor() {
    const F = () => new Float32Array(CAP);
    this.x = F(); this.y = F(); this.vx = F(); this.vy = F();
    this.life = F(); this.max = F(); this.size = F(); this.drag = F();
    this.grav = F(); this.lev = F(); this.alpha = F(); this.seed = F();
    this.spr = new Uint16Array(CAP); this.kind = new Uint8Array(CAP);
    this.n = 0;
    this.sprites = []; this.spriteIndex = new Map();
    this.forces = [];
    this.chromaA = this.sprite('#ff3ad0'); this.chromaB = this.sprite('#3ae8ff');
  }

  /** Cached 64px glow sprite for a colour; returns its index. */
  sprite(hex) {
    let i = this.spriteIndex.get(hex);
    if (i !== undefined) return i;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), [r, gg, b] = hexToRgb(hex);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.16, `rgba(${r},${gg},${b},0.95)`);
    grd.addColorStop(0.42, `rgba(${r},${gg},${b},0.3)`);
    grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    i = this.sprites.push(c) - 1;
    this.spriteIndex.set(hex, i);
    return i;
  }
  spriteCanvas(hex) { return this.sprites[this.sprite(hex)]; }

  spawn(x, y, vx, vy, life, size, hex, kind = 0, grav = 0.3, drag = 0.97, lev = 1, alpha = 1) {
    if (this.n >= CAP) return -1;
    const i = this.n++;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.drag[i] = drag; this.grav[i] = grav; this.lev[i] = lev; this.alpha[i] = alpha;
    this.seed[i] = Math.random() * 1000; this.spr[i] = this.sprite(hex); this.kind[i] = kind;
    return i;
  }

  /** Burst emitter. Counts scale with the loadout intensity unless `raw`. */
  emit(o) {
    const fs = app.fxScale ?? 1, mult = o.raw ? Math.max(0.6, fs) : app.intensity * fs;
    const count = Math.round((o.count ?? 20) * mult);
    const colors = o.colors || app.theme.particles;
    const kind = o.kind ?? app.theme.kind;
    for (let k = 0; k < count; k++) {
      const a = (o.angle ?? 0) + (Math.random() - 0.5) * (o.spread ?? TAU);
      const sp = randRange(o.speed ?? [60, 220]);
      const j = o.jitter || 0;
      this.spawn(o.x + rand(-j, j), o.y + rand(-j, j),
        Math.cos(a) * sp + (o.vx || 0), Math.sin(a) * sp + (o.vy || 0),
        randRange(o.life ?? [0.6, 1.4]), randRange(o.size ?? [2, 5]), pick(colors),
        kind, o.grav ?? 0.25, o.drag ?? 0.965, o.lev ?? 1, o.alpha ?? 1);
    }
  }

  /** Instant radial push (palm scatter, shockwaves) plus optional momentum. */
  impulse(x, y, radius, strength, mvx = 0, mvy = 0) {
    const r2 = radius * radius;
    for (let i = 0; i < this.n; i++) {
      const dx = this.x[i] - x, dy = this.y[i] - y, d2 = dx * dx + dy * dy;
      if (d2 < r2 && d2 > 1) {
        const d = Math.sqrt(d2), fall = 1 - d / radius;
        this.vx[i] += (dx / d) * strength * fall + mvx * fall;
        this.vy[i] += (dy / d) * strength * fall + mvy * fall;
      }
    }
  }

  /**
   * Reflective energy barrier along segment A→B: particles approaching within
   * `thick` px bounce off (normal velocity reversed, slightly damped).
   */
  barrier(ax, ay, bx, by, thick = 16) {
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    if (L2 < 1) return;
    const L = Math.sqrt(L2), nx = -dy / L, ny = dx / L;
    for (let i = 0; i < this.n; i++) {
      const px = this.x[i] - ax, py = this.y[i] - ay;
      const u = (px * dx + py * dy) / L2;
      if (u < 0 || u > 1) continue;
      const d = px * nx + py * ny;
      if (d > thick || d < -thick) continue;
      const vn = this.vx[i] * nx + this.vy[i] * ny;
      if (vn * d >= 0) continue; // moving away already
      this.vx[i] -= 1.9 * vn * nx; this.vy[i] -= 1.9 * vn * ny;
      const push = (d >= 0 ? thick : -thick) - d;
      this.x[i] += nx * push; this.y[i] += ny * push;
    }
  }

  /** Persistent field: {x, y, radius, strength, type:'attract'|'repel'|'swirl', life}. */
  addForce(f) { this.forces.push(f); return f; }

  _kill(i) {
    const j = --this.n;
    if (i === j) return;
    this.x[i] = this.x[j]; this.y[i] = this.y[j]; this.vx[i] = this.vx[j]; this.vy[i] = this.vy[j];
    this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.size[i] = this.size[j];
    this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.lev[i] = this.lev[j];
    this.alpha[i] = this.alpha[j]; this.seed[i] = this.seed[j]; this.spr[i] = this.spr[j]; this.kind[i] = this.kind[j];
  }

  update(dt) {
    const W = app.W, H = app.H, t = app.t;
    // Keep the ambient mote population alive.
    let ambient = 0;
    for (let i = 0; i < this.n; i++) if (this.kind[i] === KIND.AMBIENT) ambient++;
    const want = Math.round(150 * app.intensity * (app.fxScale ?? 1));
    for (let k = 0; k < Math.min(6, want - ambient); k++) {
      this.spawn(rand(W), rand(H), rand(-8, 8), rand(-8, 8), rand(6, 13), rand(0.8, 2.4),
        pick(app.theme.particles), KIND.AMBIENT, 0.12, 0.985, 1.6, rand(0.25, 0.6));
    }

    for (let k = this.forces.length - 1; k >= 0; k--) {
      const f = this.forces[k]; f.life -= dt;
      if (f.life <= 0) this.forces.splice(k, 1);
    }
    const G = 70, gx = app.gravity.x * G, gy = app.gravity.y * G, lev = app.levitate;
    const forces = this.forces, fl = forces.length;

    for (let i = 0; i < this.n;) {
      const life = this.life[i] - dt;
      let x = this.x[i], y = this.y[i];
      if (life <= 0 || x < -200 || x > W + 200 || y < -260 || y > H + 200) { this._kill(i); continue; }
      this.life[i] = life;
      const kind = this.kind[i], s = this.seed[i];
      let ax = gx * this.grav[i], ay = gy * this.grav[i];
      ay -= this.lev[i] * lev * 150;
      if (kind === KIND.EMBER) { ay -= 85; ax += Math.sin(t * 5 + s) * 40; }
      else if (kind === KIND.SPORE) { ax += Math.sin(t * 1.1 + s) * 26; ay += Math.cos(t * 0.8 + s) * 14 - 8; }
      else if (kind === KIND.AMBIENT) { ax += Math.sin(t * 0.4 + s) * 6; ay += Math.cos(t * 0.33 + s * 1.3) * 6; }
      for (let k = 0; k < fl; k++) {
        const f = forces[k], dx = x - f.x, dy = y - f.y, d2 = dx * dx + dy * dy, r = f.radius;
        if (d2 > r * r || d2 < 4) continue;
        const d = Math.sqrt(d2), fall = 1 - d / r, str = f.strength * fall;
        if (f.type === 'repel') { ax += (dx / d) * str; ay += (dy / d) * str; }
        else if (f.type === 'attract') { ax -= (dx / d) * str; ay -= (dy / d) * str; }
        else { ax += (-dy / d) * str - (dx / d) * str * 0.45; ay += (dx / d) * str - (dy / d) * str * 0.45; }
      }
      const dr = Math.pow(this.drag[i], dt * 60);
      let vx = (this.vx[i] + ax * dt) * dr, vy = (this.vy[i] + ay * dt) * dr;
      this.vx[i] = vx; this.vy[i] = vy;
      this.x[i] = x + vx * dt; this.y[i] = y + vy * dt;
      i++;
    }
  }

  draw(ctx) {
    const t = app.t, sprites = this.sprites;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const p = this.life[i] / this.max[i];
      const kind = this.kind[i];
      let a = this.alpha[i] * Math.min(1, (1 - p) * 10) * Math.min(1, p * 2.5);
      if (kind === KIND.DUST || kind === KIND.AMBIENT) a *= 0.6 + 0.4 * Math.sin(t * 5 + this.seed[i]);
      else if (kind === KIND.EMBER) a *= 0.7 + 0.3 * Math.sin(t * 22 + this.seed[i]);
      if (a < 0.01) continue;
      const s = this.size[i] * (kind === KIND.EMBER ? 0.4 + 0.6 * p : 1) * 2;
      const x = this.x[i], y = this.y[i];
      ctx.globalAlpha = a;
      ctx.drawImage(sprites[this.spr[i]], x - s, y - s, s * 2, s * 2);
      if (kind === KIND.SHARD) { // chromatic aberration ghosts trailing the velocity
        const ox = this.vx[i] * 0.025, oy = this.vy[i] * 0.025;
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(sprites[this.chromaA], x - ox - s, y - oy - s, s * 2, s * 2);
        ctx.drawImage(sprites[this.chromaB], x + ox - s, y + oy - s, s * 2, s * 2);
      }
    }
    ctx.restore();
  }

  /** Pull particles toward a point for a moment (used by "levitate" visuals etc.). */
  drift(dt, x, y, radius, strength) {
    const a = alphaFor(dt, 1);
    for (let i = 0; i < this.n; i++) {
      const dx = x - this.x[i], dy = y - this.y[i];
      if (dx * dx + dy * dy < radius * radius) { this.vx[i] += dx * strength * a; this.vy[i] += dy * strength * a; }
    }
  }
}
