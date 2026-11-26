// ---------------------------------------------------------------------------
// III · ECHOES OF THE FACE
// Elemental spirits converge on your face. When the front spirit crosses the
// harmony ring, answer with the matching expression:
//   golden light wisp → smile      fire spirit → open mouth
//   earth rune        → raise brows
// Return to a neutral face between answers (the aura shows when you're
// ready). Wrong expressions rebuff the spirit; spirits that slip through
// cost a light. The tempo rises as you go.
// ---------------------------------------------------------------------------
import { app } from '../../core/app.js';
import { GameBase } from '../base.js';
import { drawExprIcon, glowText } from '../../ui/draw.js';
import { TAU, rand, pick, rgba, clamp, approach } from '../../core/util.js';

const TYPES = {
  wisp: { expr: 'smile', color: '#ffd479', label: 'SMILE' },
  fire: { expr: 'mouth', color: '#ff7a3d', label: 'OPEN' },
  earth: { expr: 'brows', color: '#8fe07a', label: 'RAISE' },
};
const EXPR_LABEL = { smile: 'SMILE', mouth: 'OPEN MOUTH', brows: 'RAISED BROWS' };

export class EchoesGame extends GameBase {
  constructor() {
    super('echoes', 'Echoes of the Face');
    this.duration = 60; this.maxLives = 5;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, puff: false };
    this.needsHand = false;
    this.cues = [{ cue: 'smile', key: '1' }, { cue: 'mouth', key: '2' }, { cue: 'brows', key: '3' }];
    this.rules = [
      ['smile', 'Copy the face shown above each spirit', 'Press 1 smile · 2 open mouth · 3 raise brows'],
      ['blink', 'Do it when the spirit reaches the ring', 'Do it when the spirit reaches the ring'],
    ];
  }

  playCoach() { return { icon: 'smile', html: app.mode === 'camera' ? '<b>Smile</b> · <b>open mouth</b> · <b>raise brows</b><small>Relax your face between answers</small>' : 'Press <b>1</b> smile · <b>2</b> open mouth · <b>3</b> raise brows' }; }

  reset() {
    this.spirits = []; this.spawnT = 1; this.level = 0; this.armed = true; this.lastArrival = 0;
    this.cx = app.W / 2; this.cy = app.H * 0.5; this.flashExpr = null; this.flashT = 0; this.pulse = 0;
  }

  get ringR() { return Math.min(app.W, app.H) * 0.16; }
  get band() { return this.ringR * 0.45; }

  activeExpr() {
    const on = app.input.on, v = app.input.vals;
    let best = null, bv = 0;
    for (const k of ['smile', 'mouth', 'brows']) if (on[k] && v[k] > bv) { bv = v[k]; best = k; }
    return best;
  }

  play(dt) {
    const inp = app.input, f = inp.face, W = app.W, H = app.H;
    this.level = Math.min(10, Math.floor((this.duration - this.time) / 7) + Math.floor(this.combo / 6));
    const tx = f.present ? clamp(f.x, W * 0.3, W * 0.7) : W / 2, ty = f.present ? clamp(f.y, H * 0.3, H * 0.7) : H * 0.5;
    this.cx = approach(this.cx, tx, dt, 0.3); this.cy = approach(this.cy, ty, dt, 0.3);
    this.flashT = Math.max(0, this.flashT - dt);
    this.pulse = Math.max(0, this.pulse - dt * 2);

    // spawn, keeping arrivals at least ~0.8 s apart
    const speed = 105 + this.level * 13, R0 = Math.min(W, H) * 0.55 + 90, travel = (R0 - this.ringR) / speed;
    this.spawnT -= dt;
    const now = this.duration - this.time;
    if (this.spawnT <= 0 && now + travel - this.lastArrival > 0.85) {
      const type = pick(Object.keys(TYPES));
      this.spirits.push({ type, a: rand(TAU), d: R0, speed: speed * rand(0.9, 1.1), t: 0, ph: rand(TAU), state: 'in' });
      this.lastArrival = now + travel;
      this.spawnT = Math.max(0.6, 1.7 - this.level * 0.1);
    }

    const expr = this.activeExpr();
    const v = inp.vals;
    if (!expr && v.smile < 0.3 && v.mouth < 0.25 && v.brows < 0.3) this.armed = true;
    if (expr && inp.events.some((e) => ['smile', 'mouthOpen', 'brows'].includes(e.type))) { this.flashExpr = expr; this.flashT = 0.8; }

    const front = this.spirits.filter((s) => s.state === 'in').sort((a, b) => a.d - b.d)[0];
    const inWindow = front && front.d < this.ringR + this.band && front.d > this.ringR - this.band * 0.65;
    if (front && inWindow && expr && this.armed) {
      this.armed = false;
      const sx = this.cx + Math.cos(front.a) * front.d, sy = this.cy + Math.sin(front.a) * front.d;
      if (TYPES[front.type].expr === expr) this.absorb(front, sx, sy);
      else this.rebuff(front, sx, sy, expr);
    }

    for (const s of this.spirits) {
      s.t += dt;
      if (s.state === 'in') {
        s.d -= s.speed * dt;
        s.a += Math.sin(s.t * 2 + s.ph) * 0.08 * dt;
        if (s.d < this.ringR - this.band * 0.65) {
          s.state = 'lost'; s.fadeT = 0.8;
          this.loseLife(this.cx, this.cy - this.ringR - 30);
        }
        // ambient trail particles
        if (Math.random() < 0.3) {
          const x = this.cx + Math.cos(s.a) * s.d, y = this.cy + Math.sin(s.a) * s.d, c = TYPES[s.type].color;
          app.particles.spawn(x, y, rand(-20, 20), s.type === 'fire' ? rand(-60, -20) : rand(-20, 20), rand(0.4, 0.8), rand(1, 2.5), c, s.type === 'fire' ? 1 : 0, 0, 0.95, 0.4);
        }
      } else {
        s.d += (s.state === 'rebuffed' ? 520 : 60) * dt;
        s.fadeT -= dt;
      }
    }
    this.spirits = this.spirits.filter((s) => s.state === 'in' || s.fadeT > 0);
  }

  absorb(s, x, y) {
    s.state = 'absorbed'; s.fadeT = 0.6;
    this.hit();
    const gain = 10 * this.mult;
    this.score += gain;
    app.store.data.totals.spirits++;
    this.pulse = 1;
    const c = TYPES[s.type].color;
    if (s.type === 'wisp') app.fx.bloom(x, y, { count: 18, reach: 220 });
    else if (s.type === 'fire') app.particles.emit({ x, y, count: 40, speed: [100, 360], colors: ['#ff7a3d', '#ffd27a', '#ff3d1f'], kind: 1, life: [0.6, 1.3] });
    else app.particles.emit({ x, y, count: 30, speed: [60, 200], colors: ['#8fe07a', '#c9b58a', '#e8ffd8'], angle: -Math.PI / 2, spread: 1.6, lev: 2, life: [0.8, 1.6] });
    app.fx.shockwave(x, y, { color: c, r1: 110 });
    app.fx.text(x, y - 24, `+${gain}`, { color: c, size: 18 });
    app.audio.absorb(s.type);
    app.audio.combo(this.combo);
  }

  rebuff(s, x, y, expr) {
    s.state = 'rebuffed'; s.fadeT = 0.8;
    this.breakCombo();
    app.fx.text(x, y - 24, `${EXPR_LABEL[expr].toLowerCase()}? it wanted ${TYPES[s.type].label.toLowerCase()}`, { color: '#c9b3ff', size: 13, font: 'Inter', weight: 500, dur: 1.4 });
    app.audio.fizzle();
  }

  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t, cx = this.cx, cy = this.cy, R = this.ringR, B = this.band, acc = app.theme.accent;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // harmony ring + window
    const g = ctx.createRadialGradient(cx, cy, R - B * 0.65, cx, cy, R + B);
    g.addColorStop(0, rgba(acc, 0)); g.addColorStop(0.45, rgba(acc, 0.1 + this.pulse * 0.25)); g.addColorStop(1, rgba(acc, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R + B, 0, TAU); ctx.fill();
    ctx.setLineDash([5, 9]); ctx.lineDashOffset = -t * 18;
    ctx.strokeStyle = rgba(acc, 0.55); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    // readiness aura
    ctx.strokeStyle = rgba(this.armed ? '#ffffff' : '#7a6aa8', this.armed ? 0.5 + 0.3 * Math.sin(t * 4) : 0.3);
    ctx.lineWidth = this.armed ? 2 : 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.45, 0, TAU); ctx.stroke();

    for (const s of this.spirits) {
      const ty = TYPES[s.type], x = cx + Math.cos(s.a) * s.d, y = cy + Math.sin(s.a) * s.d;
      const a = s.state === 'in' ? 1 : clamp(s.fadeT / 0.8);
      ctx.globalAlpha = a;
      if (s.type === 'wisp') {
        const sz = 26 + Math.sin(t * 6 + s.ph) * 4;
        ctx.drawImage(app.particles.spriteCanvas(ty.color), x - sz * 1.6, y - sz * 1.6, sz * 3.2, sz * 3.2);
        for (let k = 0; k < 3; k++) { const oa = t * 3 + k * 2.1 + s.ph; ctx.drawImage(app.particles.spriteCanvas('#ffffff'), x + Math.cos(oa) * 22 - 4, y + Math.sin(oa) * 22 - 4, 8, 8); }
      } else if (s.type === 'fire') {
        ctx.save(); ctx.translate(x, y);
        for (let k = 0; k < 3; k++) {
          const h = 34 - k * 9 + Math.sin(t * 14 + k + s.ph) * 4, w = 18 - k * 5;
          ctx.fillStyle = rgba(['#ff3d1f', '#ff8a3d', '#ffe08a'][k], 0.75);
          ctx.beginPath(); ctx.moveTo(0, -h); ctx.quadraticCurveTo(w, -h * 0.2, 0, 12 - k * 3); ctx.quadraticCurveTo(-w, -h * 0.2, 0, -h); ctx.fill();
        }
        ctx.restore();
      } else {
        ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6 + s.ph);
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const an = (k / 6) * TAU; k ? ctx.lineTo(Math.cos(an) * 22, Math.sin(an) * 22) : ctx.moveTo(Math.cos(an) * 22, Math.sin(an) * 22); }
        ctx.closePath(); ctx.fillStyle = 'rgba(52, 44, 30, 0.9)'; ctx.fill();
        ctx.strokeStyle = ty.color; ctx.lineWidth = 2; ctx.shadowColor = ty.color; ctx.shadowBlur = 12; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(0, -10); ctx.lineTo(8, 8); ctx.moveTo(0, -10); ctx.lineTo(0, 12); ctx.stroke();
        ctx.restore();
        ctx.globalCompositeOperation = 'lighter';
      }
      if (s.state === 'in') {
        ctx.globalCompositeOperation = 'source-over';
        drawExprIcon(ctx, ty.expr, x, y - 46, 11, ty.color, 0.95);
        ctx.font = '600 8.5px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = ty.color;
        ctx.fillText(ty.label, x, y - 62);
        ctx.globalCompositeOperation = 'lighter';
      }
    }
    ctx.restore();
  }

  drawHud(ctx) {
    super.drawHud(ctx);
    const cx = this.cx, cy = this.cy, R = this.ringR;
    if (this.flashT > 0 && this.flashExpr) glowText(ctx, EXPR_LABEL[this.flashExpr], cx, cy + R + 46, { size: 12, font: 'Inter', weight: 600, spacing: 3, alpha: clamp(this.flashT / 0.4) });
    glowText(ctx, this.armed ? 'READY' : 'RELAX YOUR FACE', cx, cy + R * 0.45 + 18, { size: 9, font: 'Inter', weight: 600, spacing: 2, alpha: 0.6, blur: 0 });
  }
}
