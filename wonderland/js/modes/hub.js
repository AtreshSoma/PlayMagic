// ---------------------------------------------------------------------------
// Wonderland Home. The same calm layout as the AETHERIA Home, in storybook
// colours: a clear header, a big "chosen world" card on the left (living
// picture, name, what it needs, simple steps, one big Play button) and the
// seven worlds as picture cards on the right. Pictures do the talking for
// children; the words are there for grown-ups reading along.
//
// One simple step, just like the old jelly bubbles:
//   camera hand  rest it on a world: the big card previews it and a rainbow
//                ring fills; when it's full (DWELL s) the world opens.
//                A pinch opens it at once
//   mouse/touch  tap a world to open it (hovering previews it)
//   keyboard     Tab to the list, arrows preview, Enter opens
// Play opens the previewed world the same ways. After returning Home the
// hand must move before a ring can fill, so nothing reopens by accident.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { clamp } from '../core/util.js';
import { icon } from '../ui/icons.js';
import { drawRainbowRing } from '../ui/bubble.js';
import { glowSprite } from '../fx/sprites.js';

const DWELL = 1.0;  // seconds a camera hand rests on a world (or Play) to open it; a pinch is instant

const WORLDS = [
  { id: 'painter', hue: 320, icon: icon.paint, name: 'Sky Painter', blurb: 'Paint glowing doodles in the air', needs: 'One finger',
    how: ['Point a finger to paint in the sky', 'Open your hand to make doodles dance', 'Touch the bubbles for colours, brushes and stamps'],
    howTouch: ['Press and drag to paint', 'Tap the bubbles for colours, brushes and stamps', 'Tap the hand bubble to make doodles dance'] },
  { id: 'boop', hue: 110, icon: icon.boopIcon, name: 'Bunny Boop', blurb: 'Boop the bunnies as they peek out', needs: 'Hands', fresh: true,
    how: ['Reach out and touch a bunny to boop it', 'Golden bunnies give three stars'], howTouch: ['Tap a bunny to boop it', 'Golden bunnies give three stars'] },
  { id: 'basket', hue: 20, icon: icon.basketIcon, name: 'Fruit Basket', blurb: 'Catch fruit falling from the trees', needs: 'One hand', fresh: true,
    how: ['Move your hand side to side to steer the basket', 'Catch the falling fruit'], howTouch: ['Move the mouse or a finger to steer', '← → keys work too'] },
  { id: 'monster', hue: 270, icon: icon.monsterIcon, name: 'Hungry Monster', blurb: 'Feed a fluffy, hungry friend', needs: 'Hands + mouth', fresh: true,
    how: ['Touch a snack to feed the monster', 'Open your mouth wide: the monster slurps too'], howTouch: ['Tap a snack to feed the monster', 'Hold the mouth bubble (or 1) to slurp'] },
  { id: 'firefly', hue: 95, icon: icon.firefly, name: 'Firefly Hop', blurb: 'Flap through a magical sky', needs: 'One hand',
    how: ['Swoop your hand up to flap', 'Collect the golden stars'], howTouch: ['Tap (or press Space) to flap', 'Collect the golden stars'] },
  { id: 'glider', hue: 30, icon: icon.plane, name: 'Cloud Glider', blurb: 'Glide through rings in the clouds', needs: 'One hand',
    how: ['Move your hand left and right to steer', 'Make a fist to zoom · wave to spin'], howTouch: ['Move the mouse, or ← →, to steer', 'Tap the corner bubbles to zoom and spin'] },
  { id: 'symphony', hue: 195, icon: icon.bubbles, name: 'Bubble Symphony', blurb: 'Pop bubbles to make music', needs: 'Hands + face',
    how: ['Touch the bubbles to play notes', 'Open your mouth for bubbles · smile for flowers'], howTouch: ['Tap the bubbles to play notes', 'Hold the face bubbles for magic'] },
];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>';
const LAST_KEY = 'wonderland.lastWorld';

export class HubMode {
  constructor() {
    this.palette = 'hub';
    this.worlds = WORLDS;
    this.sel = 0; this.built = false; this.dirty = true;
    this.dwell = new Map(); // element key → { p, locked }
  }

  // ------------------------------------------------------------------ DOM
  build() {
    this.built = true;
    const el = this.el = document.getElementById('home');
    el.innerHTML = `
    <div class="home-shell">
      <header class="home-top">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true"></span>
          <div><h1 class="brand-name">Wonderland</h1><p class="brand-sub">Playful worlds for little hands and big smiles</p></div>
        </div>
        <div class="top-actions">
          <p class="cam-chip" role="status"><i aria-hidden="true"></i><span></span></p>
          <a class="w-back" href="${esc(document.body.dataset.exitUrl || '../')}" aria-label="Back to AETHERIA">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6l-6 6 6 6"/></svg><span>AETHERIA</span>
          </a>
        </div>
      </header>
      <div class="home-main">
        <section class="detail" aria-labelledby="w-name">
          <div class="det-art"><canvas aria-hidden="true"></canvas><span class="det-new" hidden>New</span></div>
          <div class="det-body">
            <p class="det-kicker"></p>
            <h2 id="w-name" class="det-name"></h2>
            <p class="det-blurb"></p>
            <ol class="det-steps" aria-label="How to play"></ol>
            <p class="det-alt"><span class="det-alt-k"></span><span class="det-alt-v"></span></p>
          </div>
          <div class="det-foot">
            <div class="det-actions">
              <button type="button" class="btn-play" data-act="play">${PLAY_SVG}<span>Play</span></button>
              <p class="det-hint" aria-live="polite"></p>
            </div>
          </div>
        </section>
        <section class="library" aria-labelledby="w-lib">
          <h2 id="w-lib" class="lib-title">Worlds <span class="lib-count">${WORLDS.length}</span></h2>
          <div class="grid" role="listbox" aria-labelledby="w-lib">${WORLDS.map((w, i) => `
            <div class="card" role="option" id="w-${w.id}" data-i="${i}" aria-selected="false" tabindex="-1" style="--hue:${w.hue}" aria-describedby="w-${w.id}-d">
              <canvas class="card-art" aria-hidden="true"></canvas>
              <span class="card-name">${esc(w.name)}</span>
              <span class="card-meta" id="w-${w.id}-d">${esc(w.blurb)}</span>
              ${w.fresh ? '<span class="card-new">New</span>' : ''}
            </div>`).join('')}
          </div>
        </section>
      </div>
      <p class="home-credit"><span class="credit-k">Created by</span> <span class="credit-n">Atresh Somayajula</span></p>
    </div>`;
    const q = (s) => el.querySelector(s);
    this.shell = q('.home-shell'); this.grid = q('.grid'); this.detail = q('.detail');
    this.art = q('.det-art canvas'); this.artCtx = this.art.getContext('2d');
    this.d = { kicker: q('.det-kicker'), name: q('.det-name'), blurb: q('.det-blurb'), steps: q('.det-steps'), isNew: q('.det-new'), hint: q('.det-hint'), altK: q('.det-alt-k'), altV: q('.det-alt-v') };
    this.play = q('.btn-play'); this.chip = q('.cam-chip');
    this.cards = [...el.querySelectorAll('.card')].map((c, i) => ({ el: c, i, w: WORLDS[i], art: c.querySelector('canvas'), ctx: null }));

    // Mouse, touch, keyboard and screen readers all arrive as clicks.
    this.play.addEventListener('click', () => this.start());
    q('.w-back').addEventListener('click', () => { app.input.stopCamera(); app.sound.whoosh?.(0.7, true); });
    this.wideMq = matchMedia('(min-width: 901px)');
    for (const c of this.cards) {
      c.el.addEventListener('click', () => this.start(c.i));
      c.el.addEventListener('focus', () => { if (c.i !== this.sel) this.select(c.i); });
      // hovering previews (two-column layout only, so nothing shifts under the pointer)
      c.el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && this.wideMq.matches && c.i !== this.sel) this.select(c.i, { scroll: false }); });
    }
    this.grid.addEventListener('keydown', (e) => this.onKey(e));
    // positions are measured only when the layout can have changed
    const dirty = () => { this.dirty = true; };
    this.grid.addEventListener('scroll', dirty, { passive: true });
    this.shell.addEventListener('scroll', dirty, { passive: true });
    window.addEventListener('resize', dirty);
    if (window.ResizeObserver) { const ro = new ResizeObserver(dirty); ro.observe(this.grid); ro.observe(this.detail); }
    try { const last = WORLDS.findIndex((w) => w.id === localStorage.getItem(LAST_KEY)); if (last >= 0) this.sel = last; } catch { /* storage blocked */ }
  }

  enter() {
    if (!this.built) this.build();
    this.el.inert = false;
    document.body.dataset.scene = 'hub';
    // a resting hand must move before anything fills (keys created up front so the first visit is covered too)
    for (const k of [...WORLDS.map((w) => w.id), 'play']) this.dwell.set(k, { p: 0, locked: true, was: false });
    this.dirty = true;
    this.render();
    if (this.kbd) requestAnimationFrame(() => this.cards[this.sel].el.focus({ preventScroll: true }));
  }

  exit() {
    if (!this.built) return;
    this.kbd = this.el.contains(document.activeElement) && document.activeElement !== document.body;
    if (this.el.contains(document.activeElement)) document.activeElement.blur();
    this.el.inert = true;
    document.body.dataset.scene = '';
  }

  /** Preview a world in the big card. Opening it is start(). */
  select(i, { focus = false, scroll = true } = {}) {
    if (i === this.sel && !focus) return;
    this.sel = i;
    this.render();
    const el = this.cards[i].el;
    if (focus) el.focus({ preventScroll: true });
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  start(i = this.sel) {
    if (app.scenes.busy) return;
    this.sel = i;
    try { localStorage.setItem(LAST_KEY, WORLDS[i].id); } catch { /* storage blocked */ }
    const w = WORLDS[i], r = this.cards[i].el.getBoundingClientRect();
    app.sound.chime(1, 0.09); app.sound.pop(1.2, 0.08);
    app.particles.burst(r.left + r.width / 2, r.top + r.height / 2, 26, null, { kind: 1, speed: 340, size: 6, life: 0.8 });
    app.scenes.go(w.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  onKey(e) {
    const n = WORLDS.length, at = this.sel;
    const top = this.cards[0].el.offsetTop, cols = Math.max(1, this.cards.filter((c) => c.el.offsetTop === top).length);
    let to = null;
    switch (e.key) {
      case 'ArrowRight': to = at + 1; break;
      case 'ArrowLeft': to = at - 1; break;
      case 'ArrowDown': to = at + cols; break;
      case 'ArrowUp': to = at - cols; break;
      case 'Home': to = 0; break;
      case 'End': to = n - 1; break;
      case 'Enter': case ' ': e.preventDefault(); this.start(); return;
      default: return;
    }
    e.preventDefault();
    this.select(clamp(to, 0, n - 1), { focus: true });
  }

  render() {
    const w = WORLDS[this.sel], cam = app.input.camOn, d = this.d;
    for (const c of this.cards) {
      const on = c.i === this.sel;
      c.el.setAttribute('aria-selected', String(on));
      c.el.tabIndex = on ? 0 : -1;
    }
    this.detail.style.setProperty('--hue', w.hue);
    d.kicker.textContent = w.needs;
    d.name.textContent = w.name;
    d.blurb.textContent = w.blurb;
    d.isNew.hidden = !w.fresh;
    d.steps.innerHTML = (cam ? w.how : w.howTouch).map((s) => `<li>${esc(s)}</li>`).join('');
    d.altK.textContent = cam ? 'With touch or a mouse' : 'With the camera';
    d.altV.textContent = (cam ? w.howTouch : w.how).join(' · ');
    d.hint.textContent = cam ? 'Rest your hand on a world, or pinch it, to play' : 'Tap a world to play';
    this.play.setAttribute('aria-label', `Play ${w.name}`);
    this.shown = `${this.sel}|${cam}|${app.input.cam.state}`;
    const st = app.input.cam.state;
    this.chip.dataset.state = st;
    this.chip.querySelector('span').textContent = st === 'on' ? (app.input.camHands.length ? 'I can see your hand' : 'Camera on · show a hand') : st === 'starting' || st === 'mirror' ? 'Camera waking up…' : 'Touch & mouse';
    this.chipHands = app.input.camHands.length > 0;
  }

  // ------------------------------------------------------------------ frame
  /** Camera hands: is any hand over rect r, and did a pinch land on it this frame? */
  handOn(r, pad) {
    let over = false, pinched = false;
    for (const h of app.input.camHands) if (!h.lost && h.x > r.left - pad && h.x < r.right + pad && h.y > r.top - pad && h.y < r.bottom + pad) over = true;
    for (const tp of app.input.taps) {
      if (tp.used || tp.type !== 'pinch') continue;
      if (tp.x > r.left - pad && tp.x < r.right + pad && tp.y > r.top - pad && tp.y < r.bottom + pad) { tp.used = true; pinched = true; }
    }
    return { over, pinched };
  }

  /** Rest-to-fill ring for one element. Returns true when it should open. */
  dwellOn(key, el, over, pinched) {
    let s = this.dwell.get(key);
    if (!s) { s = { p: 0, locked: false, was: false }; this.dwell.set(key, s); }
    if (over && !s.was) app.sound.wobble();
    s.was = over;
    if (el.classList.contains('hover') !== over) el.classList.toggle('hover', over);
    if (!over) s.locked = false;
    if (over && !s.locked && !app.scenes.busy) s.p += app.dt / DWELL; else s.p = Math.max(0, s.p - app.dt * 3);
    if (pinched || s.p >= 1) { s.p = 0; s.locked = true; return true; }
    return false;
  }

  measure() {
    this.dirty = false;
    const vr = this.grid.getBoundingClientRect();
    for (const c of this.cards) { const r = c.el.getBoundingClientRect(); c.rect = r.bottom > vr.top && r.top < vr.bottom ? r : null; }
    this.playRect = this.play.getBoundingClientRect();
  }

  update() {
    if (!this.built) return;
    const inp = app.input;
    if (`${this.sel}|${inp.camOn}|${inp.cam.state}` !== this.shown || (inp.camHands.length > 0) !== this.chipHands) this.render();
    app.world.touchFireflies(inp.hands);
    this.el.inert = !!app.parent?.isOpen;
    if (app.parent?.isOpen || app.scenes.busy) { for (const t of inp.taps) t.used = true; return; }
    // camera hands only; pointer presses arrive as DOM clicks
    if (inp.camHands.length || inp.taps.some((t) => t.type === 'pinch')) {
      if (this.dirty) this.measure();
      for (const c of this.cards) {
        if (!c.rect) continue;
        const { over, pinched } = this.handOn(c.rect, 8);
        if (over && c.i !== this.sel && this.wideMq.matches) this.select(c.i, { scroll: false });
        if (this.dwellOn(c.w.id, c.el, over, pinched)) { this.start(c.i); break; }
      }
      const { over, pinched } = this.handOn(this.playRect, 12);
      if (this.dwellOn('play', this.play, over, pinched)) this.start();
    } else if (this.anyHover) {
      for (const c of this.cards) c.el.classList.remove('hover');
      this.play.classList.remove('hover');
    }
    this.anyHover = inp.camHands.length > 0;
    for (const t of inp.taps) t.used = true; // nothing else on Home reacts to taps
  }

  // ------------------------------------------------------------------ pictures
  paint(cv, w, anim, glow) {
    const dpr = app.dpr || 1, cw = cv.clientWidth, ch = cv.clientHeight;
    if (!cw || !ch) return;
    const PW = Math.round(cw * dpr), PH = Math.round(ch * dpr);
    if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
    const x = cv.getContext('2d'), t = anim ? app.t : 0.6;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, cw, ch);
    const s = Math.min(cw, ch) * (glow ? 0.42 : 0.5);
    if (glow) {
      x.globalCompositeOperation = 'lighter';
      x.globalAlpha = 0.55;
      const g = s * 3.2;
      x.drawImage(glowSprite(`hsl(${w.hue}, 100%, 65%)`), cw / 2 - g, ch / 2 - g, g * 2, g * 2);
      x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
    }
    x.save(); x.translate(cw / 2, ch / 2 + (glow ? Math.sin(app.t * 1.6) * s * 0.06 : 0));
    w.icon(x, s, t, { hover: 0, r: s, active: false });
    x.restore();
  }

  draw() {
    if (!this.built || app.scenes.name !== 'hub') return;
    const dpr = app.dpr || 1;
    if (dpr !== this.paintedDpr) { this.paintedDpr = dpr; for (const c of this.cards) this.paint(c.art, c.w, false, false); }
    this.paint(this.art, WORLDS[this.sel], true, true);
    // the chosen card and any card under a hand come alive; the one before settles
    for (const c of this.cards) {
      const live = c.i === this.sel || c.el.classList.contains('hover');
      if (live || c.live) this.paint(c.art, c.w, live, false);
      c.live = live;
    }
  }

  /** Drawn on the overlay canvas (above the HTML page). */
  drawOverlay(ctx) {
    // rainbow rings over cards / Play while a camera hand rests on them
    for (const [key, s] of this.dwell) {
      if (s.p < 0.02) continue;
      const r = key === 'play' ? this.playRect : this.cards.find((c) => c.w.id === key)?.rect;
      if (!r) continue;
      const R = Math.min(r.width, r.height) * 0.42;
      drawRainbowRing(ctx, r.left + r.width / 2, r.top + r.height / 2, key === 'play' ? r.height * 0.75 : R, s.p, Math.max(5, R * 0.1));
    }
  }
}

export { WORLDS };
