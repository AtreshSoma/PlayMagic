// ---------------------------------------------------------------------------
// Shared game scaffolding.
//   intro    3-second visual-only onboarding: animated gesture signifiers
//            (plus keycaps for keyboard players) and a radial countdown ring.
//            Pinch, click, thumbs up, nod, blink or Enter starts at once.
//   play     score / combo / lives / time HUD (kept to the top edge)
//   results  glass panel with Play again / Home orbs. Thumbs up (or Enter) plays
//            again; a head shake goes back Home.
// Leaving mid-game is the dock's Home button (pinch-hold for hands).
//
// Subclasses set: duration (Infinity = sandbox), maxLives (0 = none),
// cues [{ cue, key }], allow flags, and override reset / play / draw*.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { rankFor } from '../data/challengers.js';
import { GAMES } from './catalog.js';
import { drawOrb, glassPanel, glowText, drawCredit } from '../ui/draw.js';
import { drawCue, drawKey, CUE_FOR_ICON } from '../ui/signifiers.js';
import { verb } from '../ui/hud.js';
import { TAU, rgba, clamp, fmt, approach, easeOutBack } from '../core/util.js';

export const ONBOARD_SECONDS = 3;
/** Top of the in-game HUD, just below the gesture status pill. */
export const HUD_Y = 58;
/** Baseline for a game's own small status line under the score. */
export const HUD_SUB_Y = HUD_Y + 84;
const START_EVENTS = new Set(['thumbsUp', 'nod', 'blink']);

export class GameBase {
  constructor(id, title) {
    this.id = id; this.title = title; this.isGame = true;
    this.meta = GAMES[id] || { accent: '#ffffff', scored: true };
    this.allow = { swipe: false, runes: true, faceMagic: true, chimes: false, overlays: true };
    this.duration = 60; this.maxLives = 3;
    this.rules = [];          // legacy: [icon, camera text, mouse text]
    this.cues = null;         // [{ cue: signifier kind, key: keycap label }]
    this.credit = this.meta.credit || null; // optional creator signature, small script in the results corner
    this.needsHand = true;
  }

  get accent() { return this.meta.accent || app.theme.accent; }

  enter() {
    this.state = 'intro'; this.stateT = 0;
    this.score = 0; this.combo = 0; this.bestCombo = 0;
    this.lives = this.maxLives; this.time = this.duration; this.result = null;
    this.reset();
    app.hud.hint('');
    app.bloom = 0;
  }
  exit() { app.bloom = 0; }
  reset() {}
  play() {}
  isOver() { return false; }

  get mult() { return 1 + Math.floor(this.combo / 5); }

  /** One short line under the play field (overridden per game). */
  playCoach() { return null; }
  coach() {
    if (this.state === 'intro') return null; // onboarding is visual-only
    if (this.state === 'results') return { icon: 'thumbsUp', html: `<b>Thumbs up</b> or ${verb().toLowerCase()} to play again<small>Shake your head to go back</small>` };
    return this.playCoach();
  }

  hit() {
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (this.combo % 5 === 0) {
      app.fx.text(app.W / 2, app.H * 0.22, `Combo ×${this.mult}`, { color: this.accent, size: 30, dur: 1.4 });
      app.fx.flash(this.accent, 0.18);
      app.tapestry.ripple(app.W / 2, app.H / 2);
    }
  }
  breakCombo() {
    if (this.combo >= 5) app.fx.text(app.W / 2, app.H * 0.22, 'combo lost', { color: '#b9b3ff', size: 15, font: 'Inter', weight: 500 });
    this.combo = 0;
  }
  loseLife(x, y) {
    this.lives--;
    this.breakCombo();
    app.fx.flash('#5b16ff', 0.35);
    app.fx.shake = 1;
    app.audio.miss();
    if (x !== undefined) app.fx.text(x, y, '−1 life', { color: '#c9a8ff', size: 16, font: 'Inter', weight: 600 });
  }

  update(dt) {
    const ui = app.ui, inp = app.input;
    if (app.overlays.active) return; // paused
    this.stateT += dt;
    if (this.state === 'intro') {
      const start = this.stateT > 0.5 && inp.events.some((e) => (e.type === 'pinchStart' && e.primary) || START_EVENTS.has(e.type) || (e.type === 'cmd' && e.name === 'confirm'));
      if (this.stateT > ONBOARD_SECONDS || start) { this.state = 'play'; this.stateT = 0; app.audio.select(); this.onStart?.(); }
      return;
    }
    if (this.state === 'play') {
      if (Number.isFinite(this.duration)) this.time -= dt;
      this.play(dt);
      app.bloom = approach(app.bloom, Math.min(1, this.combo / 20), dt, 0.5);
      if (this.time <= 0 || (this.maxLives > 0 && this.lives <= 0) || this.isOver()) this.finish();
      return;
    }
    if (this.state === 'results') {
      const W = app.W, H = app.H, y = H / 2 + 70;
      this.againSt = ui.target(this.id + '-again', W / 2 - 110, y, 32, { dwell: 0.7, tip: 'play again' });
      this.homeSt = ui.target(this.id + '-home', W / 2 + 110, y, 32, { dwell: 0.7, tip: 'go back' });
      // Only deliberate signals act here. Swipes and nods happen naturally as a round ends
      // (Comet Slice, Neon Rails), so they no longer replay or leave by accident.
      if (this.stateT > 1.2) {
        const yes = inp.has('thumbsUp') || inp.cmd('confirm');
        const no = inp.has('shake');
        if (this.againSt.selected || yes) { app.audio.select(); this.enter(); }
        else if (this.homeSt.selected || no) app.actions.goHub();
      }
    }
  }

  finish() {
    this.state = 'results'; this.stateT = 0;
    const r = app.store.recordScore(this.id, this.score, { combo: this.bestCombo });
    this.result = { ...r, rank: rankFor(this.id, this.score) };
    if (r.isBest && this.score > 0) { app.audio.victory(); app.fx.flash(this.accent, 0.4); }
    else app.audio.select();
    app.bloom = 0;
  }

  drawFront(ctx) {
    const W = app.W, H = app.H;
    if (this.state === 'play') this.drawHud(ctx);
    if (this.state === 'intro') this.drawIntro(ctx);
    if (this.state === 'results') this.drawResults(ctx);
    if (app.overlays.active && this.state === 'play') glowText(ctx, 'PAUSED', W / 2, H * 0.14, { size: 14, font: 'Inter', spacing: 4 });
  }

  /** Top HUD (below the gesture pill): thin time bar, score, combo; lives top-right. */
  drawHud(ctx) {
    const W = app.W, acc = this.accent, Y = HUD_Y;
    glowText(ctx, fmt(this.score), W / 2, Y + 30, { size: 32, spacing: 1, glow: acc });
    if (this.combo > 1) glowText(ctx, `${this.combo} chain · ×${this.mult}`, W / 2, Y + 60, { size: 12, font: 'Inter', weight: 600, spacing: 2, color: acc, blur: 8 });
    if (Number.isFinite(this.duration)) {
      const p = clamp(this.time / this.duration), w = Math.min(W * 0.4, 420);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba('#ffffff', 0.1); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(W / 2 - w / 2, Y); ctx.lineTo(W / 2 + w / 2, Y); ctx.stroke();
      ctx.strokeStyle = rgba(this.time < 10 ? '#ff7a9a' : acc, 0.9);
      ctx.beginPath(); ctx.moveTo(W / 2 - (w / 2) * p, Y); ctx.lineTo(W / 2 + (w / 2) * p, Y); ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < this.maxLives; i++) {
      const x = W - 32 - i * 20, y = 32, on = i < this.lives; // top-right (the Home button sits top-left)
      ctx.save();
      ctx.translate(x, y); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = on ? rgba(acc, 0.95) : rgba('#ffffff', 0.12);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }

  /** The cue list, deriving from legacy rules when a game has none. */
  getCues() {
    if (this.cues) return this.cues;
    return this.rules.map(([icon]) => ({ cue: CUE_FOR_ICON[icon] || icon, key: '' }));
  }

  /** 3-second visual onboarding card: big looping signifiers + countdown ring. */
  drawIntro(ctx) {
    const W = app.W, H = app.H, cues = this.getCues(), n = Math.max(1, cues.length);
    const cam = app.mode === 'camera', acc = this.accent;
    const a = clamp(this.stateT * 4), s = easeOutBack(clamp(this.stateT * 3));
    const cell = clamp(Math.min(W - 48, 760) / n, 120, 200), pw = cell * n + 40, ph = cell + (cam ? 70 : 104);
    const x = (W - pw) / 2, y = H / 2 - ph / 2;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(0.92 + 0.08 * s, 0.92 + 0.08 * s); ctx.translate(-W / 2, -H / 2);
    glassPanel(ctx, x, y, pw, ph, { alpha: a, r: 28 });
    glowText(ctx, this.title.toUpperCase(), W / 2, y + 34, { size: 13, font: 'Inter', weight: 600, spacing: 4, color: acc, glow: acc, blur: 8, alpha: a });
    cues.forEach((c, i) => {
      const cx = x + 20 + cell * (i + 0.5), cy = y + 54 + cell * 0.48;
      drawCue(ctx, c.cue, cx, cy, cell * 0.27, app.t + i * 0.35, { alpha: a, accent: acc });
      if (!cam && c.key) drawKey(ctx, c.key, cx, y + cell + 76, 24, { alpha: a * 0.9 });
    });
    ctx.restore();
    // countdown ring
    const p = clamp(this.stateT / ONBOARD_SECONDS), rx = W / 2, ry = y + ph + 38;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba('#ffffff', 0.12); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(rx, ry, 14, 0, TAU); ctx.stroke();
    ctx.strokeStyle = acc;
    ctx.beginPath(); ctx.arc(rx, ry, 14, -Math.PI / 2, -Math.PI / 2 + p * TAU); ctx.stroke();
    ctx.restore();
    drawCue(ctx, cam ? 'thumbsUp' : 'pinch', rx + 44, ry, 11, app.t, { alpha: a * 0.7, glow: false });
  }

  drawResults(ctx) {
    const W = app.W, H = app.H, pw = Math.min(520, W - 32), ph = 380, x = (W - pw) / 2, y = H / 2 - 210;
    const a = clamp(this.stateT * 2.5), r = this.result, acc = this.accent;
    // dim the paused game behind the panel so the results read cleanly
    ctx.save(); ctx.fillStyle = `rgba(8, 6, 28, ${0.62 * a})`; ctx.fillRect(0, 0, W, H); ctx.restore();
    glassPanel(ctx, x, y, pw, ph, { alpha: a, r: 28 });
    glowText(ctx, this.resultTitle?.() || 'ROUND COMPLETE', W / 2, y + 42, { size: 13, font: 'Inter', weight: 600, spacing: 4, alpha: a, color: acc, glow: acc });
    glowText(ctx, fmt(this.score), W / 2, y + 104, { size: 60, spacing: 1, alpha: a, blur: 30, glow: acc });
    const line2 = r.isBest && this.score > 0 ? 'NEW PERSONAL BEST' : `Personal best ${fmt(Math.max(r.prev, this.score))}`;
    glowText(ctx, line2, W / 2, y + 152, { size: r.isBest ? 13 : 16, font: 'Inter', weight: 600, spacing: r.isBest ? 3 : 0, alpha: a, color: r.isBest ? acc : '#fff', blur: 0 });
    glowText(ctx, `#${r.rank} on the leaderboard  ·  best combo ${this.bestCombo}`, W / 2, y + 184, { size: 15, font: 'Inter', weight: 400, alpha: a * 0.75, blur: 0 });
    if (this.resultExtra) glowText(ctx, this.resultExtra(), W / 2, y + 210, { size: 14, font: 'Inter', weight: 400, alpha: a * 0.65, blur: 0 });
    if (this.credit) drawCredit(ctx, this.credit, x + pw - 22, y + ph - 14, { size: 17, alpha: a * 0.8, align: 'right' });
    if (this.againSt) {
      drawOrb(ctx, W / 2 - 110, H / 2 + 70, 32, this.againSt, { glyph: '↻', label: 'Play again', glyphSize: 26, color: acc });
      drawOrb(ctx, W / 2 + 110, H / 2 + 70, 32, this.homeSt, { glyph: '⌂', label: 'Home', glyphSize: 24, color: acc });
      if (app.mode === 'camera') {
        drawCue(ctx, 'thumbsUp', W / 2 - 110, H / 2 + 136, 12, app.t, { alpha: a * 0.6, glow: false });
        drawCue(ctx, 'shake', W / 2 + 110, H / 2 + 136, 12, app.t, { alpha: a * 0.6, glow: false });
      }
    }
  }
}
