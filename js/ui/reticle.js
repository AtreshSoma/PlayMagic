// ---------------------------------------------------------------------------
// The Astral Reticle (gaze) with its constellation trail, the fingertip
// cursors (pinch tension ring, rune-arming ring), the live rune stroke and the
// two-hand expansion band.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { TAU, rgba, dist } from '../core/util.js';

export class Reticle {
  constructor() { this.trail = []; this.trailT = 0; this.blink = 0; this.closedLook = 0; }

  update(dt) {
    const inp = app.input, g = inp.gaze;
    if (inp.has('blink')) this.blink = 1;
    this.blink = Math.max(0, this.blink - dt * 2.5);
    this.trailT += dt;
    if (g.valid && this.trailT > 0.07) {
      this.trailT = 0;
      const last = this.trail[this.trail.length - 1];
      if (!last || dist(last.x, last.y, g.x, g.y) > 14) this.trail.push({ x: g.x, y: g.y, t: app.t });
      if (this.trail.length > 10) this.trail.shift();
    }
    while (this.trail.length && app.t - this.trail[0].t > 1.6) this.trail.shift();
  }

  /** visionOS-style hover: a soft light on the focused target, cursor gently pulled toward it. */
  _hover(ctx) {
    const sn = app.ui.snap && app.scenes.name !== 'hub' ? app.ui.snap : null, c = app.input.cursor;
    this.hoverA = (this.hoverA || 0) + ((sn && c.active ? 1 : 0) - (this.hoverA || 0)) * 0.25;
    if (!sn || this.hoverA < 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * this.hoverA;
    if (sn.rect) {
      const { left, top, right, bottom } = sn.rect, gx = Math.max(left, Math.min(right, c.x)), gy = Math.max(top, Math.min(bottom, c.y)), R = Math.max(60, (right - left) * 0.45);
      ctx.drawImage(app.particles.spriteCanvas('#ffffff'), gx - R, gy - R, R * 2, R * 2);
    } else {
      const R = sn.r * 1.9;
      ctx.drawImage(app.particles.spriteCanvas(app.theme.accent), sn.x - R, sn.y - R, R * 2, R * 2);
    }
    ctx.restore();
  }

  draw(ctx) {
    const inp = app.input;
    this._hover(ctx);
    this._twoHand(ctx);
    this._rune(ctx);
    const eyeScene = !!app.scenes.current?.allow?.gaze;
    if (inp.gaze.valid && eyeScene) this._gaze(ctx);
    for (const h of inp.allHands()) {
      if (eyeScene && h.source === 'mouse' && inp.gaze.source === 'mouse') continue; // the reticle *is* the mouse here
      this._hand(ctx, h);
    }
    this._tip(ctx);
  }

  /** Contextual "Pinch to play" pill beside the cursor. */
  _tip(ctx) {
    const tip = app.ui.tip, c = app.input.cursor;
    if (!tip || !c.active) return;
    ctx.save();
    ctx.font = '600 13px Inter, sans-serif';
    const w = ctx.measureText(tip.text).width + 24, h = 28;
    let x = c.x + 26, y = c.y - 44;
    if (x + w > app.W - 8) x = c.x - 26 - w;
    if (y < 8) y = c.y + 22;
    ctx.fillStyle = 'rgba(10, 9, 32, 0.82)';
    ctx.strokeStyle = rgba(app.theme.accent, 0.7); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, 14) : ctx.rect(x, y, w, h); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(tip.text, x + 12, y + h / 2 + 0.5);
    ctx.restore();
  }

  _gaze(ctx) {
    const g = app.input.gaze, t = app.t, acc = app.theme.accent, focus = app.ui.gazeFocus;
    const closed = app.input.face.eyesClosed;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // constellation trail
    ctx.lineWidth = 0.8;
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1], b = this.trail[i], k = i / this.trail.length;
      ctx.strokeStyle = rgba(acc, 0.25 * k);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.6 * k);
      ctx.beginPath(); ctx.arc(b.x, b.y, 1.4 + k, 0, TAU); ctx.fill();
    }
    const R = 22 + this.blink * 14, rot = t * 0.8;
    const col = focus.primed ? '#ffffff' : acc;
    ctx.globalAlpha = closed ? 0.35 : 0.9;
    ctx.strokeStyle = rgba(col, 0.8); ctx.lineWidth = 1.4;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(g.x, g.y, R, rot + k * TAU / 4 + 0.25, rot + (k + 1) * TAU / 4 - 0.25); ctx.stroke(); }
    ctx.strokeStyle = rgba(col, 0.45); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(g.x, g.y, 9, 0, TAU); ctx.stroke();
    // four star points
    ctx.fillStyle = rgba(col, 0.95);
    for (let k = 0; k < 4; k++) {
      const a = -rot * 0.6 + k * TAU / 4, px = g.x + Math.cos(a) * (R + 6), py = g.y + Math.sin(a) * (R + 6);
      ctx.beginPath(); ctx.moveTo(px, py - 3); ctx.lineTo(px + 1, py); ctx.lineTo(px, py + 3); ctx.lineTo(px - 1, py); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(g.x, g.y, 2, 0, TAU); ctx.fill();
    // dwell progress
    if (focus.dwell > 0.02) {
      ctx.strokeStyle = rgba(focus.primed ? '#ffffff' : acc, 1); ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(g.x, g.y, R + 12, -Math.PI / 2, -Math.PI / 2 + focus.dwell * TAU); ctx.stroke();
      if (focus.primed) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.font = '600 9px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = rgba('#ffffff', 0.7 + 0.3 * Math.sin(t * 6));
        ctx.fillText(app.mode === 'camera' ? 'BLINK' : 'SPACE', g.x, g.y + R + 28);
      }
    }
    if (this.blink > 0) {
      ctx.strokeStyle = rgba('#ffffff', this.blink); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(g.x, g.y, R + (1 - this.blink) * 30, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  _hand(ctx, h) {
    const t = app.t, acc = app.theme.accent, T = h.tension;
    // magnetic snap: the primary camera cursor leans toward the focused target's centre
    const sn = app.ui.snap;
    if (h.primary && h.source !== 'mouse' && sn) {
      const cx = sn.rect ? (sn.rect.left + sn.rect.right) / 2 : sn.x, cy = sn.rect ? (sn.rect.top + sn.rect.bottom) / 2 : sn.y;
      const k = sn.rect && sn.rect.right - sn.rect.left > 160 ? 0.12 : 0.3; // big cards: a gentler lean
      h = { ...h, x: h.x + (cx - h.x) * k, y: h.y + (cy - h.y) * k };
    }
    const small = !h.primary;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = (18 - 10 * T) * (small ? 0.7 : 1);
    const spr = app.particles.spriteCanvas(h.pinch ? '#ffffff' : acc);
    const s = h.pinch ? 22 : 12 + T * 6;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(spr, h.x - s, h.y - s, s * 2, s * 2);
    ctx.strokeStyle = rgba(h.pinch ? '#ffffff' : acc, 0.5 + T * 0.5); ctx.lineWidth = 1.2 + T * 1.5;
    ctx.beginPath(); ctx.arc(h.x, h.y, R, 0, TAU); ctx.stroke();
    if (T > 0.55 && !h.pinch) { // crackle as fingers near
      ctx.strokeStyle = rgba('#ffffff', (T - 0.55) * 1.6); ctx.lineWidth = 1;
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * TAU;
        ctx.beginPath(); ctx.moveTo(h.x + Math.cos(a) * R, h.y + Math.sin(a) * R);
        ctx.lineTo(h.x + Math.cos(a + 0.3) * (R + 6), h.y + Math.sin(a + 0.3) * (R + 6)); ctx.stroke();
      }
    }
    // rune arming ring
    const rc = app.input.rune;
    if (h.primary && h.pointing && rc.holdProgress > 0 && !rc.drawing) {
      ctx.strokeStyle = rgba(app.theme.accent2, 0.95); ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(h.x, h.y, 28, -Math.PI / 2 + t * 2, -Math.PI / 2 + t * 2 + rc.holdProgress * TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (h.primary && rc.drawing) {
      ctx.strokeStyle = rgba(app.theme.accent2, 0.8); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(h.x, h.y, 26 + Math.sin(t * 10) * 2, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  _rune(ctx) {
    const rc = app.input.rune;
    if (!rc.drawing || rc.pts.length < 2) return;
    const pts = rc.pts, acc = app.theme.accent, acc2 = app.theme.accent2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); };
    path(); ctx.strokeStyle = rgba(acc2, 0.25); ctx.lineWidth = 14; ctx.stroke();
    path(); ctx.strokeStyle = rgba(acc, 0.9); ctx.lineWidth = 3; ctx.stroke();
    path(); ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 1; ctx.stroke();
    const head = pts[pts.length - 1], s = 18 + Math.sin(app.t * 14) * 4;
    ctx.drawImage(app.particles.spriteCanvas('#ffffff'), head.x - s, head.y - s, s * 2, s * 2);
    ctx.restore();
  }

  _twoHand(ctx) {
    const th = app.input.twoHand;
    if (!th.active) return;
    const acc = app.theme.accent, t = app.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const dx = th.bx - th.ax, dy = th.by - th.ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let strand = 0; strand < 3; strand++) {
      ctx.strokeStyle = rgba(strand ? '#ffffff' : acc, strand ? 0.35 : 0.8); ctx.lineWidth = strand ? 1 : 2.5;
      ctx.beginPath();
      for (let s = 0; s <= 40; s++) {
        const u = s / 40, w = Math.sin(u * Math.PI) * Math.sin(u * 18 - t * 9 + strand * 2) * (10 + strand * 4) / th.ratio;
        const px = th.ax + dx * u + nx * w, py = th.ay + dy * u + ny * w;
        s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.font = '600 14px Sora, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = rgba('#ffffff', 0.9);
    ctx.fillText(`× ${app.zoom.toFixed(2)}`, (th.ax + th.bx) / 2, (th.ay + th.by) / 2 - 24);
    ctx.restore();
  }
}
