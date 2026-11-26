// ---------------------------------------------------------------------------
// I · STARDUST WEAVER
// Celestial orbs fall along the gravity vector (tilt your head to bend it).
// Pinch near an orb to catch it; sweep an open palm through void shards to
// deflect them before they reach the far edge. Combos raise the tempo and the
// tapestry's bloom. Runes help: ◯ shatters every shard (cooldown),
// △ burns a spectral lane, ꩜ inhales nearby orbs.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { GameBase } from './base.js';
import { TAU, rand, pick, dist, rgba, alphaFor, angleWrap } from '../core/util.js';

export class WeaverGame extends GameBase {
  constructor() {
    super('weaver', 'Stardust Weaver');
    this.duration = 60; this.maxLives = 3;
    this.cues = [{ cue: 'pinch', key: 'Click' }, { cue: 'open', key: 'Sweep' }, { cue: 'tilt', key: 'A / D' }];
    this.rules = [
      ['pinch', 'Pinch the falling stars to catch them', 'Click the falling stars to catch them'],
      ['palm', 'Swat dark shards away with an open hand', 'Sweep the cursor over dark shards'],
    ];
  }

  playCoach() { return { icon: 'pinch', html: app.mode === 'camera' ? '<b>Pinch</b> stars · <b>open hand</b> on dark shards<small>Tilt your head to bend gravity</small>' : '<b>Click</b> stars · <b>sweep</b> over dark shards' }; }

  reset() { this.objs = []; this.spawnT = 0.6; this.level = 0; this.shieldCD = 0; this.vortex = null; }

  spawn() {
    const W = app.W, H = app.H, g = app.gravity, perp = { x: -g.y, y: g.x };
    const half = Math.abs(g.x) * W / 2 + Math.abs(g.y) * H / 2 + 50;
    const spread = (Math.abs(g.y) * W + Math.abs(g.x) * H) * 0.42;
    const off = rand(-spread, spread);
    const x = W / 2 - g.x * half + perp.x * off, y = H / 2 - g.y * half + perp.y * off;
    const shard = Math.random() < Math.min(0.5, 0.22 + this.level * 0.025);
    if (shard) {
      const n = 6 + (Math.random() * 3 | 0), r = rand(22, 30);
      const verts = Array.from({ length: n }, (_, k) => ({ a: (k / n) * TAU + rand(-0.2, 0.2), r: r * rand(0.6, 1.15) }));
      this.objs.push({ type: 'shard', x, y, vx: 0, vy: 0, r, verts, rot: rand(TAU), spin: rand(-1.5, 1.5), sp: rand(0.85, 1.2), drift: rand(-30, 30), t: 0 });
    } else {
      this.objs.push({ type: 'orb', x, y, vx: 0, vy: 0, r: rand(19, 27), col: pick(app.theme.particles), sp: rand(0.8, 1.2), drift: rand(-25, 25), t: 0, ph: rand(TAU) });
    }
  }

  catch(o, viaSpell = false) {
    o.dead = true;
    this.hit();
    const gain = 10 * this.mult;
    this.score += gain;
    app.store.data.totals.orbs++;
    app.particles.emit({ x: o.x, y: o.y, count: 26, speed: [80, 320], life: [0.5, 1.1], size: [1.5, 4.5], colors: [o.col, '#ffffff'] });
    app.fx.shockwave(o.x, o.y, { color: o.col, r1: 70, dur: 0.5 });
    app.fx.text(o.x, o.y - 10, `+${gain}`, { color: o.col, size: 18 });
    if (!viaSpell) app.audio.combo(this.combo);
  }

  deflect(o, fromX, fromY, hvx = 0, hvy = 0) {
    o.deflected = true;
    const dx = o.x - fromX, dy = o.y - fromY, d = Math.hypot(dx, dy) || 1;
    o.vx = (dx / d) * 720 + hvx * 0.45; o.vy = (dy / d) * 720 + hvy * 0.45;
    o.spin *= 6;
    this.hit();
    const gain = 5 * this.mult;
    this.score += gain;
    app.particles.emit({ x: o.x, y: o.y, count: 18, speed: [120, 380], life: [0.4, 0.9], size: [1.5, 3.5], colors: ['#b48cff', '#6a3dff', '#ffffff'], kind: 3 });
    app.fx.text(o.x, o.y - 10, `deflect +${gain}`, { color: '#c9a8ff', size: 14, font: 'Inter', weight: 600 });
    app.audio.chime(220 + this.combo * 20, { vel: 0.35, bright: 0.3, dur: 0.9 });
  }

  spell(e) {
    const W = app.W;
    if (e.shape === 'circle') {
      if (this.shieldCD > 0) { app.fx.text(e.x, e.y - 40, `shield returns in ${Math.ceil(this.shieldCD)}s`, { color: '#b9b3ff', size: 14, font: 'Inter' }); return; }
      this.shieldCD = 7;
      for (const o of this.objs) if (o.type === 'shard' && !o.deflected && !o.dead) { this.deflect(o, e.x, e.y); this.score += 3; }
    } else if (e.shape === 'triangle') {
      const dir = e.x < W / 2 ? 0 : Math.PI;
      for (const o of this.objs) {
        if (o.dead || o.deflected) continue;
        const a = Math.abs(angleWrap(Math.atan2(o.y - e.y, o.x - e.x) - dir));
        if (a < 0.32) { if (o.type === 'orb') this.catch(o, true); else { o.dead = true; this.score += 8; app.particles.emit({ x: o.x, y: o.y, count: 16, colors: ['#ff6ad5', '#6ae3ff', '#fff'], kind: 3 }); } }
      }
    } else if (e.shape === 'spiral') {
      this.vortex = { x: e.x, y: e.y, t: 2.6 };
    }
  }

  play(dt) {
    const W = app.W, H = app.H, g = app.gravity, inp = app.input;
    this.level = Math.min(12, Math.floor(this.combo / 5) + Math.floor((this.duration - this.time) / 12));
    this.shieldCD = Math.max(0, this.shieldCD - dt);
    this.spawnT -= dt;
    if (this.spawnT <= 0) { this.spawn(); this.spawnT = Math.max(0.26, 0.95 - this.level * 0.055) * rand(0.7, 1.3); }

    for (const e of inp.events) {
      if (e.type === 'pinchStart') {
        let best = null, bd = Infinity;
        for (const o of this.objs) {
          if (o.type !== 'orb' || o.dead) continue;
          const d = dist(e.x, e.y, o.x, o.y);
          if (d < o.r + 52 && d < bd) { bd = d; best = o; }
        }
        if (best) this.catch(best);
      } else if (e.type === 'rune') this.spell(e);
    }

    const speed = 120 + this.level * 14, perp = { x: -g.y, y: g.x }, hands = inp.allHands();
    if (this.vortex) { this.vortex.t -= dt; if (this.vortex.t <= 0) this.vortex = null; }
    for (const o of this.objs) {
      if (o.dead) continue;
      o.t += dt;
      if (!o.deflected) {
        const tvx = g.x * speed * o.sp + perp.x * o.drift, tvy = g.y * speed * o.sp + perp.y * o.drift;
        const a = alphaFor(dt, 0.5);
        o.vx += (tvx - o.vx) * a; o.vy += (tvy - o.vy) * a;
        if (this.vortex && o.type === 'orb') {
          const dx = this.vortex.x - o.x, dy = this.vortex.y - o.y, d = Math.hypot(dx, dy);
          if (d < 420) { o.vx += (dx / d) * 1600 * dt - (dy / d) * 600 * dt; o.vy += (dy / d) * 1600 * dt + (dx / d) * 600 * dt; }
          if (d < 34) { this.catch(o, true); continue; }
        }
        if (o.type === 'shard') {
          for (const h of hands) {
            if (!h.open) continue;
            if (dist(h.palmX, h.palmY, o.x, o.y) < o.r + 62) { this.deflect(o, h.palmX, h.palmY, h.vx, h.vy); break; }
          }
        }
      }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (o.rot !== undefined) o.rot += o.spin * dt;
      if (o.x < -90 || o.x > W + 90 || o.y < -140 || o.y > H + 90) {
        if (o.t > 0.8 && !o.deflected) {
          if (o.type === 'shard') this.loseLife(Math.max(30, Math.min(W - 30, o.x)), Math.max(40, Math.min(H - 40, o.y)));
          else this.breakCombo();
        }
        o.dead = true;
      }
    }
    this.objs = this.objs.filter((o) => !o.dead);
  }

  drawBack(ctx) {
    if (this.state === 'intro') return;
    const t = app.t;
    ctx.save();
    for (const o of this.objs) {
      if (o.type === 'orb') {
        const s = o.r * 2.6 + Math.sin(t * 5 + o.ph) * 3;
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(app.particles.spriteCanvas(o.col), o.x - s, o.y - s, s * 2, s * 2);
        ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.7, 0, TAU); ctx.stroke();
        ctx.strokeStyle = rgba(o.col, 0.6);
        ctx.beginPath(); ctx.arc(o.x, o.y, o.r, t * 2 + o.ph, t * 2 + o.ph + 4); ctx.stroke();
      } else {
        const fade = o.deflected ? Math.max(0, 1 - o.t * 0.4) : 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(o.x, o.y); ctx.rotate(o.rot);
        ctx.globalAlpha = fade;
        ctx.beginPath();
        o.verts.forEach((v, k) => (k ? ctx.lineTo(Math.cos(v.a) * v.r, Math.sin(v.a) * v.r) : ctx.moveTo(Math.cos(v.a) * v.r, Math.sin(v.a) * v.r)));
        ctx.closePath();
        ctx.fillStyle = 'rgba(8, 0, 20, 0.92)'; ctx.fill();
        ctx.shadowColor = '#8a3dff'; ctx.shadowBlur = 16;
        ctx.strokeStyle = o.deflected ? 'rgba(200,170,255,0.6)' : 'rgba(170, 90, 255, 0.95)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(o.verts[0].r * 0.6 * Math.cos(o.verts[0].a), o.verts[0].r * 0.6 * Math.sin(o.verts[0].a)); ctx.lineTo(0, 0);
        ctx.lineTo(o.verts[3].r * 0.5 * Math.cos(o.verts[3].a), o.verts[3].r * 0.5 * Math.sin(o.verts[3].a)); ctx.stroke();
        ctx.restore();
      }
    }
    if (this.vortex) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(app.theme.accent2, 0.3); ctx.setLineDash([3, 9]);
      ctx.beginPath(); ctx.arc(this.vortex.x, this.vortex.y, 420, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    if (this.state === 'play' && this.shieldCD <= 0) {
      ctx.save(); ctx.font = '600 9px Inter, sans-serif'; ctx.fillStyle = rgba(app.theme.accent, 0.7); ctx.textAlign = 'left';
      ctx.fillText('◯ SHIELD READY', 24, 58); ctx.restore();
    }
  }
}
