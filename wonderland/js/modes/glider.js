// ---------------------------------------------------------------------------
// CLOUD GLIDER: nod & tilt quest, in gentle pseudo-3D.
//
//   move a hand left / right → steer (the easiest way; checked first)
//   tilt head left / right   → steer when no hand is up
//   make a fist, or nod      → rainbow speed boost
//   wave a hand, or shake    → barrel roll that magnetises nearby stars
//
// Glowing rings, treasure bubbles and stars drift toward the child from the
// horizon; flying through them fills the star jar. Nothing can be failed:
// missed rings simply fade away.
// Fallbacks: no face → steer with hand or pointer position, ←/→ keys; the
// boost and spin bubbles appear in the lower corners.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, clamp, rand, pick, damp, hsl, ease, noteFreq } from '../core/util.js';
import { Bubble, homeBubble } from '../ui/bubble.js';
import { icon, drawFace } from '../ui/icons.js';
import { VEHICLES, drawStar } from '../ui/props.js';
import { StarJar } from '../ui/hud.js';
import { glowSprite } from '../fx/sprites.js';

const LANE = 1.0;     // lateral world half-width
const NEAR = 0.035;   // z where objects reach the plane

export class GliderMode {
  constructor() {
    this.palette = 'glider';
    this.scenery = { islands: false, hills: false };
    this.coachAt = 'top'; // keep the hint clear of the plane
    this.vehicle = 'plane';
    this.home = homeBubble(icon.home);
    this.vehB = ['plane', 'boat'].map((v) => new Bubble({ id: v, hue: v === 'plane' ? 220 : 170, icon: icon[v], onSelect: () => { this.vehicle = v; app.sound.boing(1.2); } }));
    this.boostB = new Bubble({ id: 'boost', hue: 340, icon: icon.boost, onSelect: () => this.boost() });
    this.spinB = new Bubble({ id: 'spin', hue: 260, icon: icon.spin, onSelect: () => this.spin() });
    this.ui = [this.home, ...this.vehB, this.boostB, this.spinB];
    this.jar = new StarJar(12);
  }

  enter() {
    this.px = 0; this.bank = 0; this.objs = []; this.spawnZ = 0; this.path = 0; this.pathV = 0;
    this.boostT = 0; this.rollT = 0; this.magnetT = 0; this.speedMul = 1; this.floor = 0; this.noFaceT = 0;
    const noCam = app.input.cam.state === 'off' || app.input.cam.state === 'error';
    app.coach.show(noCam ? ['drag-steer'] : ['drag-steer', 'tilt', 'nod']);
    this.fistWas = false;
    this.jar.reset();
  }

  layout() {
    const u = app.u, r = clamp(Math.min(app.W, app.H) * 0.05, 26, 42), m = 18 * u;
    this.home.place(r * 1.1 + m, r * 1.1 + m, r * 1.1);
    this.vehB.forEach((b, i) => { b.place(app.W - r - m - i * r * 2.5, r + m + 60 * u, r * 0.9); b.active = b.id === this.vehicle; });
    const big = r * 1.3, showFallback = !app.input.face.present && this.noFaceT > 1.5;
    this.boostB.place(big + m + 10 * u, app.H - big - m - 20 * u, big);
    this.spinB.place(app.W - big - m - 70 * u, app.H - big - m - 20 * u, big);
    this.boostB.hidden = this.spinB.hidden = !showFallback;
  }

  boost() {
    if (this.boostT > 0.5) return;
    this.boostT = 2.6;
    app.sound.whoosh(1.2, true, 0.16); app.sound.sparkle();
    app.coach.tried('nod');
  }

  spin() {
    if (this.rollT > 0) return;
    this.rollT = 0.9; this.magnetT = 3.5;
    app.sound.boing(0.8); app.sound.whoosh(0.7, false);
  }

  spawn() {
    // rings follow a slowly wandering path so steering feels like flying a course
    this.pathV = damp(this.pathV, rand(-1.2, 1.2), 0.5, 0.5);
    this.path = clamp(this.path + this.pathV * 0.25, -0.75, 0.75);
    const r = Math.random();
    if (r < 0.45) this.objs.push({ type: 'ring', X: this.path, z: 1, hue: rand(360) });
    else if (r < 0.7) this.objs.push({ type: 'bubble', X: this.path + rand(-0.3, 0.3), z: 1, hue: rand(360) });
    else for (let k = 0; k < 3; k++) this.objs.push({ type: 'star', X: this.path + (k - 1) * 0.18, z: 1 + k * 0.04 });
    // decoration clouds outside the lane
    if (Math.random() < 0.8) this.objs.push({ type: 'cloud', X: pick([-1, 1]) * rand(1.3, 2.4), z: 1, alt: rand(-0.6, 0.5), s: rand(0.8, 1.6) });
  }

  /** world (X, z, alt) → screen. alt lifts objects above the flight line. */
  project(X, z, alt = 0) {
    const W = app.W, H = app.H, hy = H * 0.36, py = H * 0.74;
    const s = 1 / (1 + z * 7);
    return { x: W / 2 + (X - this.px * 0.6) * W * 0.42 * s, y: hy + (py - hy) * s - alt * H * 0.3 * s, s };
  }

  update(dt) {
    const inp = app.input, u = app.u, face = inp.face;
    this.noFaceT = face.present ? 0 : this.noFaceT + dt;
    this.layout();
    for (const b of this.ui) b.update(dt);

    // steering source: camera hand → keys → head tilt → pointer position
    let target = 0;
    const camHand = inp.hands.find((hh) => hh.src === 'cam' && !hh.lost);
    if (camHand) target = clamp((camHand.palm.x - app.W / 2) / (app.W * 0.34), -1, 1);
    else if (face.keySteer || face.present) target = face.steer;
    else {
      const h = inp.hands.find((hh) => hh.recent !== false);
      if (h) target = clamp((h.x - app.W / 2) / (app.W * 0.38), -1, 1);
    }
    // a fist boosts, a single waving hand spins
    const fist = inp.camHands.some((h) => h.pose === 'fist' && !h.lost);
    if (fist && !this.fistWas) { this.boost(); app.coach.tried('nod'); }
    this.fistWas = fist;
    if (inp.camHands.some((h) => h.waving)) this.spin();
    if (Math.abs(target) > 0.45) app.coach.tried('tilt'), app.coach.tried('drag-steer');
    const prev = this.px;
    this.px = damp(this.px, target * LANE * 0.95, 4.5, dt);
    this.bank = damp(this.bank, clamp((this.px - prev) / dt * 0.35 + target * 0.35, -0.9, 0.9), 8, dt);

    if (inp.has('nod')) this.boost();
    if (inp.has('shake')) this.spin();

    this.boostT = Math.max(0, this.boostT - dt);
    this.rollT = Math.max(0, this.rollT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.speedMul = damp(this.speedMul, this.boostT > 0 ? 2.3 : 1, 3, dt);
    this.jar.update(dt);

    const v = 0.27 * this.speedMul;
    this.floor += v * dt;
    this.spawnZ += v * dt;
    if (this.spawnZ > 0.2) { this.spawnZ = 0; this.spawn(); }

    const plane = this.project(this.px, 0);
    if (this.boostT > 0) {
      for (let k = 0; k < 3; k++) app.particles.spawn(plane.x + rand(-10, 10) * u, plane.y + 30 * u, rand(-40, 40) * u, rand(150, 300) * u, 0.7, rand(5, 9) * u, hsl(app.t * 300 + k * 120, 100, 65), 0, 0, 0.96);
    }

    for (const o of this.objs) {
      o.z -= v * dt;
      if (this.magnetT > 0 && (o.type === 'star' || o.type === 'bubble') && o.z < 0.55 && Math.abs(o.X - this.px) < 0.8) {
        o.X = damp(o.X, this.px, 5, dt);
      }
      if (!o.done && o.z <= NEAR && o.type !== 'cloud') {
        o.done = true;
        const d = Math.abs(o.X - this.px), p = this.project(o.X, o.z);
        if (o.type === 'ring' && d < 0.3) {
          app.sound.chime(1.1); app.sound.xylo(660);
          app.particles.burst(p.x, p.y - 30 * u, 30, hsl(o.hue, 100, 70), { kind: 1, speed: 380, size: 7 });
          this.addStar();
        } else if (o.type === 'bubble' && d < 0.24) {
          [0, 2, 4].forEach((n, k) => app.sound.marimba(noteFreq(7 + n), 0.18, k * 0.07));
          app.sound.pop(1.1);
          app.particles.confetti(p.x, p.y - 20 * u, 26, 0.8);
          this.addStar();
        } else if (o.type === 'star' && d < 0.2) {
          app.sound.sparkle(0.05);
          app.particles.burst(p.x, p.y, 12, '#ffe27a', { kind: 1, speed: 200, size: 5 });
          this.addStar();
        } else o.missed = true;
      }
    }
    this.objs = this.objs.filter((o) => o.z > -0.05);
    this.objs.sort((a, b) => b.z - a.z);
  }

  addStar() {
    if (this.jar.add()) {
      app.sound.fanfare();
      for (let k = 0; k < 4; k++) app.particles.confetti(app.W * (0.2 + k * 0.2), app.H * 0.7, 30, 1.2);
    }
  }

  draw(ctx) {
    const W = app.W, H = app.H, u = app.u, t = app.t, hy = H * 0.36;
    // glowing cloud-sea floor with perspective stripes rushing toward us
    ctx.save();
    const sea = ctx.createLinearGradient(0, hy, 0, H);
    sea.addColorStop(0, 'rgba(255,200,230,0.0)'); sea.addColorStop(0.25, 'rgba(255,190,220,0.25)'); sea.addColorStop(1, 'rgba(170,140,255,0.45)');
    ctx.fillStyle = sea; ctx.fillRect(0, hy, W, H - hy);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const z = k / 14 - (this.floor % (1 / 14));
      if (z <= 0) continue;
      const y = hy + (H - hy) / (1 + z * 7);
      ctx.globalAlpha = clamp(1 - z) * 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.globalAlpha = 0.25;
    for (let k = -6; k <= 6; k++) {
      ctx.beginPath(); ctx.moveTo(W / 2 + (k - this.px * 0.6) * W * 0.08, hy); ctx.lineTo(W / 2 + (k - this.px * 0.6) * W * 0.6, H); ctx.stroke();
    }
    ctx.restore();

    // speed lines during a boost
    if (this.boostT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      // streaks rush outward from the vanishing point, growing as they near
      const maxR = Math.hypot(W, H) * 0.7, fade = Math.min(1, this.boostT);
      ctx.lineCap = 'round';
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * TAU + Math.sin(k * 7.3) * 0.2, q = (t * 1.6 + ((k * 0.618) % 1)) % 1;
        const r0 = q * q * maxR, r1 = r0 + (30 + q * 260) * u;
        ctx.strokeStyle = hsl(k * 40, 100, 78, 0.45 * q * fade); ctx.lineWidth = (1 + q * 3) * u;
        ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, hy + Math.sin(a) * r0 * 0.75); ctx.lineTo(W / 2 + Math.cos(a) * r1, hy + Math.sin(a) * r1 * 0.75); ctx.stroke();
      }
      ctx.restore();
    }

    for (const o of this.objs) {
      if (o.z > 1.02) continue;
      const fadeIn = clamp((1.02 - o.z) * 6), fade = o.missed ? clamp(o.z / NEAR) : 1;
      const p = this.project(o.X, Math.max(0, o.z), o.alt || 0);
      ctx.save(); ctx.globalAlpha = fadeIn * fade;
      if (o.type === 'ring') this.drawRing(ctx, p, o.hue, t);
      else if (o.type === 'bubble') this.drawTreasure(ctx, p, o.hue, t);
      else if (o.type === 'star') { ctx.translate(p.x, p.y - 30 * u * p.s); drawStar(ctx, 34 * u * p.s, t); }
      else if (o.type === 'cloud') {
        const art = app.world.cloudArt[0], s = o.s * p.s * 2.2 * u;
        ctx.globalAlpha *= 0.85;
        ctx.drawImage(art, p.x - art.width * s / 2, p.y - art.height * s / 2, art.width * s, art.height * s);
      }
      ctx.restore();
    }

    // the vehicle
    const pp = this.project(this.px, 0);
    const roll = this.rollT > 0 ? ease.inOut(1 - this.rollT / 0.9) * TAU : 0;
    ctx.save();
    ctx.translate(pp.x, pp.y + Math.sin(t * 2.5) * 6 * u);
    if (this.magnetT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 10; k++) {
        const a = t * 4 + (k / 10) * TAU, r = 80 * u + Math.sin(t * 6 + k) * 8 * u;
        ctx.drawImage(glowSprite('#ffe27a'), Math.cos(a) * r - 8 * u, Math.sin(a) * r * 0.5 - 8 * u, 16 * u, 16 * u);
      }
      ctx.restore();
    }
    ctx.rotate(this.bank * 0.6);
    ctx.scale(Math.cos(roll) || 0.02, 1);
    VEHICLES[this.vehicle](ctx, 52 * u, t);
    ctx.restore();
  }

  drawRing(ctx, p, hue, t) {
    const u = app.u, R = 120 * u * p.s, cy = p.y - R * 0.3;
    ctx.globalCompositeOperation = 'lighter';
    for (let pass = 0; pass < 2; pass++) {
      ctx.lineWidth = (pass ? 9 : 26) * u * p.s;
      ctx.strokeStyle = hsl(hue + t * 60, 100, pass ? 75 : 60, pass ? 0.95 : 0.3);
      ctx.beginPath(); ctx.ellipse(p.x, cy, R, R * 0.92, 0, 0, TAU); ctx.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const a = t * 2 + (k / 6) * TAU, s = 10 * u * p.s;
      ctx.drawImage(glowSprite('#ffffff'), p.x + Math.cos(a) * R - s, cy + Math.sin(a) * R * 0.92 - s, s * 2, s * 2);
    }
  }

  drawTreasure(ctx, p, hue, t) {
    const u = app.u, R = 46 * u * p.s, cy = p.y - 30 * u * p.s + Math.sin(t * 2 + hue) * 6 * u * p.s;
    const g = ctx.createRadialGradient(p.x - R * 0.3, cy - R * 0.35, R * 0.1, p.x, cy, R);
    g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.6, hsl(hue, 100, 75, 0.25)); g.addColorStop(1, hsl(hue + 60, 100, 70, 0.85));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, cy, R, 0, TAU); ctx.fill();
    // gem inside
    ctx.save(); ctx.translate(p.x, cy); ctx.rotate(t);
    ctx.fillStyle = hsl(hue + 180, 100, 65);
    ctx.beginPath(); ctx.moveTo(0, -R * 0.45); ctx.lineTo(R * 0.35, 0); ctx.lineTo(0, R * 0.45); ctx.lineTo(-R * 0.35, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  drawTop(ctx) {
    const u = app.u;
    for (const b of this.ui) b.draw(ctx);
    this.jar.draw(ctx, this.home.x + this.home.r * 2.6, this.home.y + 6 * u, 26 * u);
    // tilt buddy: a little face at the top that tilts with yours
    const f = app.input.face;
    if (f.present) {
      ctx.save(); ctx.translate(app.W / 2, 44 * u); ctx.rotate(f.steer * 0.45); ctx.globalAlpha = 0.85;
      drawFace(ctx, 20 * u, { smile: 0.7, open: f.eyesClosed ? 0 : 1 });
      ctx.restore();
    }
  }
}
