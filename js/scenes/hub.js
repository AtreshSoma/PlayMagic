// ---------------------------------------------------------------------------
// Home. A calm, accessible HTML page layered over the living sky:
//   header   brand · camera toggle · How to play
//   left     the game under your pointer: art, what it needs, numbered
//            steps, best score and a Play button
//   right    filter chips and a list of every game
//
// One simple step, like Wonderland's bubbles:
//   • point at a game: the left panel previews it and a ring fills around
//     its icon; when the ring is full (DWELL s) the game starts
//   • or pinch (either hand), click or tap the game: it starts at once
//   • keyboard: arrows preview, Enter starts
// Safety without fuss: the ring is always visible, moving away cancels it,
// and after returning Home the hand must move to a game before a ring can
// fill. Only the game cards and Play fill; filters and the camera button
// need a pinch / click. No nods, winks, thumbs-ups or swipes act on Home.
//
// Accessibility: real buttons, a single-select listbox with roving focus
// (arrows / Home / End), aria-pressed filters, visible focus rings, inert
// while an overlay is open, and content that reflows down to phone width.
// Pinch-and-drag (or the wheel / a finger) scrolls the list.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { CATALOG, GROUPS, GROUP_LABEL } from '../games/catalog.js';
import { drawCue } from '../ui/signifiers.js';
import { TAU, rgba, fmt } from '../core/util.js';

const DWELL = 1.2;  // seconds a camera hand rests on a game (or Play) to start it

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SVG = {
  mark: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5l3.2 10.3L29.5 16l-10.3 3.2L16 29.5l-3.2-10.3L2.5 16l10.3-3.2z" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.53.85l10.2-6.4a1 1 0 0 0 0-1.7L9.53 4.75A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>',
  help: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><circle cx="12" cy="17.2" r=".6" fill="currentColor"/></svg>',
  cam: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="6.5" width="13" height="11" rx="2.5"/><path d="M16 10.5l5-3v9l-5-3z"/></svg>',
};

export class HubScene {
  constructor() {
    // Home is a menu: keep the gentle light effects, drop everything that reacts to stray movement.
    this.allow = { swipe: false, runes: false, chimes: false, magnet: false, snapshot: false, faceMagic: true, overlays: true };
    this.needsHand = true;
    this.t = 0; this.sel = 0; this.filter = 'all';
    this.built = false; this.dragFrom = null;
    this.dwellId = null; this.dwellT = 0; this.lockId = null; this.dirty = true; this.rects = new Map();
    this.shown = '';
  }

  // ------------------------------------------------------------------ DOM
  build() {
    this.built = true;
    const el = this.el = document.getElementById('home');
    el.innerHTML = `
    <div class="home-shell">
      <header class="home-top">
        <div class="brand">
          <span class="brand-mark">${SVG.mark}</span>
          <div><h1 class="brand-name">AETHERIA</h1><p class="brand-sub">Motion games for your hands, face and body</p></div>
        </div>
        <div class="home-actions">
          <button type="button" class="btn btn-cam" data-act="camera" aria-pressed="false"><i class="cam-dot" aria-hidden="true"></i>${SVG.cam}<span class="lbl">Camera off</span></button>
          <button type="button" class="btn" data-act="help" aria-label="How to play">${SVG.help}<span class="lbl">How to play</span></button>
        </div>
      </header>
      <div class="home-main">
        <section class="detail glass" aria-labelledby="det-name">
          <div class="det-art"><canvas aria-hidden="true"></canvas><span class="det-new" hidden>New</span></div>
          <div class="det-body">
            <p class="det-kicker"></p>
            <h2 id="det-name" class="det-name"></h2>
            <p class="det-blurb"></p>
            <h3 class="det-h" id="det-steps-h">How to play</h3>
            <ol class="det-steps" aria-labelledby="det-steps-h"></ol>
            <p class="det-alt"><span class="det-alt-k"></span><span class="det-alt-v"></span></p>
            <div class="det-actions">
              <button type="button" class="btn btn-play" data-act="play"><i class="btn-ring" aria-hidden="true"></i>${SVG.play}<span class="lbl">Play</span></button>
              <div class="det-best"><span class="det-best-k">Best</span><b class="det-best-v"></b></div>
            </div>
            <p class="det-hint" aria-live="polite"></p>
          </div>
        </section>
        <section class="library" aria-labelledby="lib-title">
          <div class="lib-head">
            <h2 id="lib-title" class="lib-title">Games <span class="lib-count"></span></h2>
            <div class="filters" role="toolbar" aria-label="Filter games">${GROUPS.map((g) => `<button type="button" class="chip" data-act="filter" data-filter="${g.id}" aria-pressed="false">${esc(g.label)}</button>`).join('')}</div>
          </div>
          <div class="grid" role="listbox" aria-labelledby="lib-title">${CATALOG.map((g, i) => `
            <div class="card" role="option" id="card-${g.id}" data-i="${i}" aria-selected="false" tabindex="-1" style="--acc:${g.accent}" aria-describedby="card-${g.id}-m card-${g.id}-b">
              <canvas class="card-art" aria-hidden="true"></canvas><i class="card-ring" aria-hidden="true"></i>
              <span class="card-text">
                <span class="card-name">${esc(g.name)}</span>
                <span class="card-meta" id="card-${g.id}-m">${esc(GROUP_LABEL[g.group] || '')} · ${esc(g.needs || '')}</span>
                <span class="card-best" id="card-${g.id}-b"></span>
              </span>
              ${g.tag === 'New' ? '<span class="card-new">New</span>' : ''}
            </div>`).join('')}
          </div>
        </section>
      </div>
      <p class="home-credit"><span class="credit-k">Created by</span> <span class="credit-n">Atresh Somayajula</span></p>
    </div>`;
    const q = (s) => el.querySelector(s);
    this.shell = q('.home-shell'); this.grid = q('.grid'); this.detail = q('.detail');
    this.art = q('.det-art canvas'); this.artCtx = this.art.getContext('2d');
    this.d = {
      kicker: q('.det-kicker'), name: q('.det-name'), blurb: q('.det-blurb'), steps: q('.det-steps'), isNew: q('.det-new'),
      best: q('.det-best'), bestV: q('.det-best-v'), hint: q('.det-hint'),
      altK: q('.det-alt-k'), altV: q('.det-alt-v'),
    };
    this.playBtn = q('.btn-play'); this.camBtn = q('.btn-cam'); this.count = q('.lib-count');
    this.buttons = [...el.querySelectorAll('button[data-act]')];
    this.cards = [...el.querySelectorAll('.card')].map((c, i) => ({ el: c, i, g: CATALOG[i], art: c.querySelector('canvas') }));

    // Keyboard and assistive tech. Pointer and hand presses arrive through the
    // gesture UI instead (see update), so only keyboard-made clicks count here.
    for (const b of this.buttons) b.addEventListener('click', (e) => { if (e.detail === 0) this.act(b); });
    for (const c of this.cards) {
      c.el.addEventListener('click', (e) => { if (e.detail === 0) this.start(c.i); });
      c.el.addEventListener('focus', () => { if (c.i !== this.sel) this.select(c.i); });
      c.el.addEventListener('mousedown', (e) => e.preventDefault()); // a press selects on release (gesture UI), not on focus
    }
    this.grid.addEventListener('keydown', (e) => this.onKey(e));
    // Layout is measured only when it can have changed (not every frame).
    const dirty = () => { this.dirty = true; };
    this.grid.addEventListener('scroll', dirty, { passive: true });
    this.shell.addEventListener('scroll', dirty, { passive: true });
    window.addEventListener('resize', dirty);
    if (window.ResizeObserver) { const ro = new ResizeObserver(dirty); ro.observe(this.grid); ro.observe(this.detail); }
    this.wideMq = matchMedia('(min-width: 961px)');
    this.paintCards();
  }

  /** Cached rectangles of the cards and buttons (refreshed when the layout is dirty). */
  measure() {
    this.dirty = false;
    const vr = this.grid.getBoundingClientRect();
    for (const c of this.cards) {
      const r = c.el.hidden ? null : c.el.getBoundingClientRect();
      c.rect = r && r.bottom > vr.top + 8 && r.top < vr.bottom - 8 ? r : null; // null = hidden or scrolled away
    }
    for (const b of this.buttons) b.rect = b.getBoundingClientRect();
  }

  /** Mirror a gesture state into CSS classes only when it changes. */
  mark(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }
  setDwell(el, p) { const v = p.toFixed(2); if (el._dw !== v) { el._dw = v; el.style.setProperty('--dwell', v); } }

  /** Static card icons, painted once (again only when the pixel ratio changes). */
  paintCards() {
    this.paintedDpr = app.dpr || 1;
    for (const c of this.cards) this.paintCard(c, false);
  }

  paintCard(c, anim) {
    const dpr = app.dpr || 1, cv = c.art, w = cv.clientWidth || 56, h = cv.clientHeight || 56;
    const PW = Math.round(w * dpr), PH = Math.round(h * dpr);
    if (cv.width !== PW || cv.height !== PH) { cv.width = PW; cv.height = PH; }
    const x = c.ctx || (c.ctx = cv.getContext('2d'));
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    drawCue(x, c.g.cue, w / 2, h / 2 + 1, Math.min(w, h) * 0.24, app.t + c.i * 0.3, { anim, accent: c.g.accent });
  }

  // ------------------------------------------------------------------ state
  enter() {
    if (!this.built) this.build();
    this.t = 0; app.zoom = 1;
    app.hud.hint('');
    const last = CATALOG.findIndex((g) => g.id === app.store.data.lastGame);
    this.sel = last >= 0 ? last : 0;
    this.el.inert = false;
    this.applyFilter(this.filter);
    this.refreshScores();
    this.render();
    this.dirty = true; this.dwellId = null; this.dwellT = 0; this.lockId = '*'; this.lockFrames = 0; this.lastHover = -1; // '*' = lock what the hand rests on
    this.showHelp = !app.store.data.helpSeen; // first visit: open How to Play once
    if (this.kbd) requestAnimationFrame(() => this.cards[this.sel].el.focus({ preventScroll: true }));
  }

  exit() {
    if (!this.built) return;
    this.kbd = this.el.contains(document.activeElement) && document.activeElement !== document.body && app.input.fb.lastKey > app.input.fb.lastMove;
    if (this.el.contains(document.activeElement)) document.activeElement.blur();
    this.el.inert = true;
    for (const b of this.buttons) this.setDwell(b, 0);
    for (const c of this.cards) this.setDwell(c.el, 0);
  }

  coach() { return null; } // Home explains itself; the coach only warns when the camera loses your hand

  refreshScores() {
    const best = app.store.data.best;
    for (const c of this.cards) {
      const b = best[c.g.id] || 0;
      c.el.querySelector('.card-best').textContent = c.g.scored ? (b ? `Best ${fmt(b)}` : 'Not played yet') : 'Free play';
    }
  }

  /** Preview a game in the left panel (keyboard focus, hover, filters). Starting is start(). */
  select(i, { focus = false, scroll = true } = {}) {
    if (i === this.sel && !focus) return;
    this.sel = i;
    this.render();
    const el = this.cards[i].el;
    if (focus) el.focus({ preventScroll: true });
    if (scroll) el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  /** Start game i (remembered as the one to preview next time). */
  start(i = this.sel) {
    const g = CATALOG[i];
    if (!g || app.scenes.trans) return;
    this.sel = i;
    app.store.data.lastGame = g.id; app.store.save();
    app.audio.select();
    const r = this.cards[i].el.getBoundingClientRect();
    app.actions.startGame(g.id, r.left + r.width / 2, r.top + r.height / 2);
  }

  applyFilter(id) {
    this.filter = id;
    for (const b of this.buttons) if (b.dataset.filter) b.setAttribute('aria-pressed', String(b.dataset.filter === id));
    let n = 0;
    for (const c of this.cards) { c.el.hidden = !(id === 'all' || c.g.group === id); if (!c.el.hidden) n++; }
    this.count.textContent = String(n);
    if (this.cards[this.sel].el.hidden) { const first = this.cards.find((c) => !c.el.hidden); if (first) this.select(first.i, { scroll: false }); }
    this.grid.scrollTop = 0;
    this.dirty = true;
  }

  /** Detail panel + roving tabindex for the selected game. */
  render() {
    const g = CATALOG[this.sel], cam = app.mode === 'camera', hand = app.input.cursor.source === 'hand';
    for (const c of this.cards) {
      const on = c.i === this.sel;
      c.el.setAttribute('aria-selected', String(on));
      c.el.tabIndex = on ? 0 : -1;
    }
    const d = this.d;
    this.detail.style.setProperty('--acc', g.accent);
    d.kicker.textContent = `${GROUP_LABEL[g.group] || ''}  ·  ${g.needs || ''}`;
    d.name.textContent = g.name;
    d.blurb.textContent = g.blurb;
    d.isNew.hidden = g.tag !== 'New';
    d.steps.innerHTML = (cam ? g.how : g.howMouse).split(' · ').map((s) => `<li>${esc(s)}</li>`).join('');
    d.altK.textContent = cam ? 'Without a camera' : 'With a camera';
    d.altV.textContent = cam ? g.howMouse : g.how;
    const best = app.store.data.best[g.id] || 0;
    d.best.hidden = false;
    d.best.querySelector('.det-best-k').textContent = g.scored ? 'Best' : 'Mode';
    d.bestV.textContent = g.scored ? (best ? fmt(best) : '—') : 'Free play';
    d.hint.textContent = cam ? 'Point at a game and hold still, or pinch it, to play' : 'Click a game to play it · Enter on the keyboard';
    this.playBtn.setAttribute('aria-label', `Play ${g.name}`);
    this.playBtn.style.setProperty('--acc', g.accent);
    this.camBtn.setAttribute('aria-pressed', String(cam));
    this.camBtn.querySelector('.lbl').textContent = cam ? 'Camera on' : 'Camera off';
    this.camBtn.setAttribute('aria-label', cam ? 'Camera on. Turn it off' : 'Camera off. Turn it on');
    this.shown = `${this.sel}|${cam}|${hand}`;
  }

  act(b) {
    const k = b.dataset.act;
    app.audio.click();
    if (k === 'play') this.play();
    else if (k === 'help') app.actions.toggleHelp();
    else if (k === 'camera') app.actions.toggleCamera();
    else if (k === 'filter') this.applyFilter(b.dataset.filter);
  }

  play() { this.start(this.sel); }

  /** Listbox keys: arrows move (by column for ↑ ↓), Home / End, Enter / Space plays the selected game. */
  onKey(e) {
    const vis = this.cards.filter((c) => !c.el.hidden);
    const at = vis.findIndex((c) => c.i === this.sel);
    if (at < 0) return;
    const top = vis[0].el.offsetTop, cols = Math.max(1, vis.filter((c) => c.el.offsetTop === top).length);
    let to = null;
    switch (e.key) {
      case 'ArrowRight': to = at + 1; break;
      case 'ArrowLeft': to = at - 1; break;
      case 'ArrowDown': to = at + cols; break;
      case 'ArrowUp': to = at - cols; break;
      case 'Home': to = 0; break;
      case 'End': to = vis.length - 1; break;
      case 'Enter': case ' ': e.preventDefault(); this.start(this.sel); return;
      default: return;
    }
    e.preventDefault();
    to = Math.max(0, Math.min(vis.length - 1, to));
    this.select(vis[to].i, { focus: true });
  }

  // ------------------------------------------------------------------ frame
  /** Which element scrolls: the list (wide layout) or the whole page (narrow). */
  scroller() { return this.shell.scrollHeight > this.shell.clientHeight + 1 ? this.shell : this.grid; }

  update(dt) {
    this.t += dt;
    if (!this.built) return;
    if (this.showHelp && this.t > 1 && !app.scenes.trans) {
      this.showHelp = false; app.store.data.helpSeen = true; app.store.save();
      app.actions.toggleHelp();
    }
    this.el.inert = !!app.overlays.active;
    if ((app.dpr || 1) !== this.paintedDpr) this.paintCards();
    const ui = app.ui, inp = app.input, hand = inp.cursor.source === 'hand', cam = app.mode === 'camera';
    if (`${this.sel}|${cam}|${hand}` !== this.shown) this.render();
    if (app.overlays.active || app.scenes.trans) return;

    // pinch-and-drag scrolls the list (a finger on a touch screen scrolls natively)
    const d = ui.drag, touch = inp.fb.pointerType === 'touch' && inp.cursor.source !== 'hand';
    if (d && !touch) {
      if (this.dragFrom === null) {
        const sc = this.scroller(), r = sc.getBoundingClientRect(), s = d.start;
        this.dragEl = sc;
        this.dragFrom = s.x0 >= r.left && s.x0 <= r.right && s.y0 >= r.top && s.y0 <= r.bottom ? sc.scrollTop : false;
      }
      if (this.dragFrom !== false) this.dragEl.scrollTop = this.dragFrom - d.dy;
      return; // no presses while dragging
    }
    this.dragFrom = null;

    if (this.dirty) this.measure();
    const pinching = inp.allHands().some((h) => h.pinch);
    let hoverCard = null, focusEl = null;

    // game cards: hover previews; pinch / click / tap starts; a resting hand fills the ring
    for (const c of this.cards) {
      if (!c.rect) { this.mark(c.el, 'hover', false); continue; }
      const r = c.rect;
      const st = ui.target('home-card-' + c.g.id, (r.left + r.right) / 2, (r.top + r.bottom) / 2, r.width / 2, { rect: r, release: true, gaze: false, tip: 'play' });
      this.mark(c.el, 'hover', st.hover > 0.5);
      if (st.handHover) { hoverCard = c; focusEl = c.el; }
      if (st.selected) { this.start(c.i); return; }
    }
    // Play / filters / camera / help: a pinch, click or tap; Play also fills by resting
    for (const b of this.buttons) {
      const k = b.dataset.act, r = b.rect;
      const st = ui.target('home-' + k + (b.dataset.filter || ''), (r.left + r.right) / 2, (r.top + r.bottom) / 2, r.width / 2, { rect: r, release: true, gaze: false, tip: k === 'play' ? 'play' : null });
      this.mark(b, 'hover', st.hover > 0.5);
      if (st.handHover && k === 'play') focusEl = b;
      if (st.selected) { this.act(b); return; }
    }
    // preview what the pointer moves onto (edge-triggered, so a resting mouse never overrides the keyboard;
    // two-column layout only, so the list never shifts under the hand)
    const hid = hoverCard ? hoverCard.i : -1;
    if (hid !== this.lastHover) { this.lastHover = hid; if (hoverCard && hoverCard.i !== this.sel && this.wideMq.matches) this.select(hoverCard.i, { scroll: false }); }

    // resting-hand ring (camera hands only; paused while pinching)
    const id = hand && focusEl && !pinching ? (focusEl === this.playBtn ? 'play' : hoverCard.g.id) : null;
    // back Home: whatever the hand rests on in the first few frames stays locked until it moves off
    if (this.lockId === '*') { if (id) this.lockId = id; else if (++this.lockFrames > 12) this.lockId = null; }
    else if (this.lockId && this.lockId !== id) this.lockId = null; // moved off it: unlocked
    if (id !== this.dwellId) { if (this.dwellEl) this.setDwell(this.dwellEl, 0); this.dwellId = id; this.dwellEl = focusEl; this.dwellT = 0; }
    if (id && !this.lockId) {
      this.dwellT += dt;
      this.setDwell(focusEl, Math.min(1, this.dwellT / DWELL));
      if (this.dwellT >= DWELL) {
        this.setDwell(focusEl, 0); this.lockId = id; this.dwellT = 0;
        this.start(id === 'play' ? this.sel : hoverCard.i);
      }
    }
  }

  // ------------------------------------------------------------------ art
  drawBack() {
    if (!this.built || app.scenes.name !== 'hub') return;
    const c = this.art, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const dpr = app.dpr || 1, PW = Math.round(w * dpr), PH = Math.round(h * dpr);
    if (c.width !== PW || c.height !== PH) { c.width = PW; c.height = PH; }
    const x = this.artCtx, g = CATALOG[this.sel], acc = g.accent, t = app.t;
    const cx = w / 2, cy = h / 2, s = Math.min(w * 0.5, h) * 0.26;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    x.save();
    x.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      x.strokeStyle = rgba(k ? '#ffffff' : acc, k ? 0.1 : 0.4); x.lineWidth = k ? 1 : 1.5;
      x.beginPath(); x.ellipse(cx, cy, s * (1.9 + k * 0.45), s * (0.62 + k * 0.14), t * 0.15 * (k % 2 ? -1 : 1), 0, TAU); x.stroke();
    }
    for (let k = 0; k < 6; k++) {
      const a = t * 0.5 + (k / 6) * TAU, rr = s * 1.9;
      x.drawImage(app.particles.spriteCanvas(k % 2 ? '#ffffff' : acc), cx + Math.cos(a) * rr - 5, cy + Math.sin(a) * rr * 0.33 - 5, 10, 10);
    }
    x.restore();
    drawCue(x, g.cue, cx, cy, s, t, { accent: acc });
    // the selected card's icon moves too; the one before it settles back to its still pose
    if (this.animI !== undefined && this.animI !== this.sel) this.paintCard(this.cards[this.animI], false);
    this.animI = this.sel;
    this.paintCard(this.cards[this.sel], true);
  }
}
