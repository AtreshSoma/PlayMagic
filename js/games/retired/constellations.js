// ---------------------------------------------------------------------------
// II · GAZE CONSTELLATIONS
// Shimmering stars appear. Look at the pulsing next star (your reticle snaps
// to nearby stars), let the eye-lock ring close, then blink to bind it to the
// thread. Finish before the stars fade to unlock a named mythical
// constellation in your Star Codex. Five constellations per weaving.
// ---------------------------------------------------------------------------
import { app } from '../../core/app.js';
import { GameBase } from '../base.js';
import { CONSTELLATIONS } from '../../data/constellations.js';
import { glowText } from '../../ui/draw.js';
import { TAU, dist, rgba, clamp, easeOutCubic, rand } from '../../core/util.js';

const ROUNDS = 5, MAGNET = 140, LOCK_TIME = 0.28, AUTO_LOCK = 1.5;

export class ConstellationGame extends GameBase {
  constructor() {
    super('constellations', 'Gaze Constellations');
    this.duration = Infinity; this.maxLives = 0;
    this.allow = { swipe: false, runes: false, faceMagic: false, chimes: false, overlays: true, gaze: true };
    this.needsHand = false;
    this.cues = [{ cue: 'gaze', key: 'Point' }, { cue: 'blink', key: 'Space' }];
    this.rules = [
      ['gaze', 'Look at the glowing star until its ring fills', 'Point at the glowing star until its ring fills'],
      ['blink', 'Then blink slowly (or pinch) to connect it', 'Then press Space (or click) to connect it'],
    ];
  }

  playCoach() { return { icon: 'gaze', html: app.mode === 'camera' ? '<b>Look</b> at the glowing star, then <b>blink</b><small>A pinch works too</small>' : '<b>Point</b> at the glowing star, then press <b>Space</b>' }; }

  reset() {
    const codex = app.store.data.codex;
    const locked = CONSTELLATIONS.filter((c) => !codex.includes(c.id)).sort(() => Math.random() - 0.5);
    const known = CONSTELLATIONS.filter((c) => codex.includes(c.id)).sort(() => Math.random() - 0.5);
    this.queue = [...locked, ...known].slice(0, ROUNDS);
    this.round = -1; this.completed = 0; this.unlocked = [];
    this._nextConstellation();
  }

  _nextConstellation() {
    this.round++;
    if (this.round >= this.queue.length) { this.cur = null; return; }
    const c = this.queue[this.round], W = app.W, H = app.H;
    const sy = Math.min(H * 0.6, W * 0.55), sx = Math.min(W * 0.72, sy * 1.45);
    const ox = W / 2 - sx / 2, oy = H * 0.55 - sy / 2;
    this.cur = {
      def: c,
      stars: c.stars.map(([x, y], i) => ({ x: ox + x * sx, y: oy + y * sy, lit: false, ph: rand(TAU), i })),
      k: 0, lines: [], limit: 6 + (c.path.length - 1) * 2.3, timeLeft: 0, phase: 'appear', phaseT: 0, lockT: 0, focus: null,
    };
    this.cur.timeLeft = this.cur.limit;
    this.cur.stars[c.path[0]].lit = true;
  }

  isOver() { return !this.cur; }

  _bind(cur, target) {
    const from = cur.stars[cur.def.path[cur.k]];
    cur.lines.push({ a: from, b: target, t: 0 });
    target.lit = true;
    cur.k++; cur.lockT = 0;
    this.hit();
    const gain = Math.round(15 * (1 + this.combo * 0.1));
    this.score += gain;
    app.store.data.totals.stars++;
    app.audio.lock((target.x / app.W) * 2 - 1);
    app.audio.chime(app.audio.noteFromY(1 - cur.k / cur.def.path.length, 1), { vel: 0.35, bright: 0.9, when: 0.05 });
    app.particles.emit({ x: target.x, y: target.y, count: 24, speed: [60, 240], life: [0.6, 1.2] });
    app.fx.shockwave(target.x, target.y, { r1: 60 });
    app.fx.text(target.x, target.y - 30, `+${gain}`, { size: 16 });
    if (cur.k >= cur.def.path.length - 1) this._complete(cur);
  }

  _complete(cur) {
    cur.phase = 'reveal'; cur.phaseT = 0;
    this.completed++;
    const bonus = 100 + Math.ceil(cur.timeLeft) * 10;
    this.score += bonus;
    if (app.store.unlock(cur.def.id)) this.unlocked.push(cur.def.name);
    app.audio.victory();
    app.fx.flash(app.theme.accent, 0.3);
    for (const s of cur.stars) app.particles.emit({ x: s.x, y: s.y, count: 10, speed: [40, 160], life: [1, 2] });
    app.fx.text(app.W / 2, app.H * 0.86, `constellation bound  +${bonus}`, { size: 18, color: app.theme.accent, dur: 2 });
  }

  play(dt) {
    const cur = this.cur, inp = app.input;
    if (!cur) return;
    cur.phaseT += dt;
    for (const l of cur.lines) l.t += dt;
    if (cur.phase === 'appear') { if (cur.phaseT > 0.9) { cur.phase = 'active'; cur.phaseT = 0; } return; }
    if (cur.phase === 'reveal' || cur.phase === 'lost') { if (cur.phaseT > 3.2) this._nextConstellation(); return; }

    cur.timeLeft -= dt;
    if (cur.timeLeft <= 0) {
      cur.phase = 'lost'; cur.phaseT = 0;
      this.breakCombo();
      app.audio.miss();
      return;
    }
    const target = cur.stars[cur.def.path[cur.k + 1]];
    // magnetic gaze focus
    const g = inp.gaze;
    let focus = null, fd = MAGNET;
    if (g.valid) for (const s of cur.stars) { const d = dist(g.x, g.y, s.x, s.y); if (d < fd) { fd = d; focus = s; } }
    cur.focus = focus;
    if (focus === target) cur.lockT += dt; else cur.lockT = Math.max(0, cur.lockT - dt * 2);
    const locked = cur.lockT >= LOCK_TIME;
    const bindEvent = inp.has('blink') || inp.events.some((e) => e.type === 'pinchStart' && e.primary);
    if (bindEvent && focus) {
      if (focus === target && locked) return this._bind(cur, target);
      if (focus !== target) {
        cur.timeLeft -= 1.5; this.breakCombo();
        app.audio.fizzle();
        app.fx.text(focus.x, focus.y - 26, 'not that star', { color: '#b9b3ff', size: 13, font: 'Inter' });
      }
    }
    if (cur.lockT >= AUTO_LOCK) this._bind(cur, target);
  }

  drawBack(ctx) {
    const cur = this.cur;
    if (!cur || this.state === 'intro') return;
    const t = app.t, acc = app.theme.accent;
    const fadeK = cur.phase === 'lost' ? clamp(1 - cur.phaseT / 1.5) : cur.phase === 'appear' ? clamp(cur.phaseT / 0.9) : 1;
    const life = clamp(cur.timeLeft / cur.limit);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // bound threads
    for (const l of cur.lines) {
      const p = easeOutCubic(clamp(l.t / 0.35));
      const bx = l.a.x + (l.b.x - l.a.x) * p, by = l.a.y + (l.b.y - l.a.y) * p;
      ctx.strokeStyle = rgba(acc, 0.85 * fadeK); ctx.lineWidth = cur.phase === 'reveal' ? 3 : 2;
      ctx.shadowColor = acc; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(bx, by); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    const target = cur.phase === 'active' ? cur.stars[cur.def.path[cur.k + 1]] : null;
    const from = cur.phase === 'active' ? cur.stars[cur.def.path[cur.k]] : null;
    // guiding thread from the last bound star toward the reticle
    if (from && app.input.gaze.valid) {
      ctx.strokeStyle = rgba(acc, 0.18); ctx.setLineDash([2, 8]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(cur.focus ? cur.focus.x : app.input.gaze.x, cur.focus ? cur.focus.y : app.input.gaze.y); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const s of cur.stars) {
      const flicker = life < 0.25 && cur.phase === 'active' ? 0.5 + 0.5 * Math.sin(t * 20 + s.ph) : 1;
      const base = (s.lit ? 1 : 0.35 + 0.65 * life) * fadeK * flicker;
      const isT = s === target, sz = (s.lit ? 16 : 11) + (isT ? 6 + Math.sin(t * 6) * 4 : 0) + Math.sin(t * 2.5 + s.ph) * 1.5;
      ctx.globalAlpha = base;
      ctx.drawImage(app.particles.spriteCanvas(s.lit ? acc : '#cfd8ff'), s.x - sz * 1.6, s.y - sz * 1.6, sz * 3.2, sz * 3.2);
      ctx.drawImage(app.particles.spriteCanvas('#ffffff'), s.x - sz * 0.5, s.y - sz * 0.5, sz, sz);
      if (isT) {
        ctx.globalAlpha = fadeK;
        ctx.strokeStyle = rgba('#ffffff', 0.35 + 0.25 * Math.sin(t * 6)); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, TAU); ctx.stroke();
        if (cur.focus === s) {
          const p = clamp(cur.lockT / LOCK_TIME);
          ctx.strokeStyle = rgba(p >= 1 ? '#ffffff' : acc, 1); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(s.x, s.y, 38, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
          if (p >= 1) {
            const auto = clamp((cur.lockT - LOCK_TIME) / (AUTO_LOCK - LOCK_TIME));
            ctx.strokeStyle = rgba(acc, 0.4); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(s.x, s.y, 46, -Math.PI / 2, -Math.PI / 2 + auto * TAU); ctx.stroke();
          }
        }
      } else if (cur.focus === s && !s.lit) {
        ctx.strokeStyle = rgba('#b9b3ff', 0.4); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawHud(ctx) {
    super.drawHud(ctx);
    const cur = this.cur, W = app.W, H = app.H;
    if (!cur) return;
    glowText(ctx, `CONSTELLATION ${this.round + 1} / ${this.queue.length}`, W / 2, 110, { size: 11, font: 'Inter', weight: 600, spacing: 3, blur: 0, alpha: 0.7 });
    if (cur.phase === 'active') {
      const p = clamp(cur.timeLeft / cur.limit), w = Math.min(W * 0.4, 360);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba('#ffffff', 0.12); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W / 2 - w / 2, 126); ctx.lineTo(W / 2 + w / 2, 126); ctx.stroke();
      ctx.strokeStyle = rgba(p < 0.25 ? '#ff7a9a' : app.theme.accent, 0.9); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(W / 2 - (w / 2) * p, 126); ctx.lineTo(W / 2 + (w / 2) * p, 126); ctx.stroke();
      ctx.restore();
    }
    if (cur.phase === 'reveal') {
      const a = clamp(cur.phaseT * 2) * clamp((3.2 - cur.phaseT) * 2);
      glowText(ctx, cur.def.name, W / 2, H * 0.2, { size: Math.min(46, W * 0.06), spacing: 4, alpha: a, blur: 30 });
      glowText(ctx, cur.def.myth, W / 2, H * 0.2 + 46, { size: 19, font: 'Cormorant Garamond', weight: 400, alpha: a * 0.85, blur: 0 });
    }
    if (cur.phase === 'lost') {
      const a = clamp(cur.phaseT * 2) * clamp((3.2 - cur.phaseT) * 2);
      glowText(ctx, 'The stars slip away…', W / 2, H * 0.22, { size: 28, font: 'Cormorant Garamond', weight: 600, alpha: a, color: '#c9c3ff' });
    }
  }

  resultTitle() { return `${this.completed} OF ${this.queue.length} CONSTELLATIONS BOUND`; }
  resultExtra() { return this.unlocked.length ? `New in your Star Codex: ${this.unlocked.join(', ')}` : `Star Codex: ${app.store.data.codex.length} / ${CONSTELLATIONS.length}`; }
}
