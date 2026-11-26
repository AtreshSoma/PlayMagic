// ---------------------------------------------------------------------------
// Floating dock (bottom centre). Navigation, overlays and toggles in one
// slim glass bar that stays out of the way:
//   • rests dimmed and slightly smaller; wakes smoothly (CSS spring) as the
//     hand cursor or mouse approaches, revealing labels
//   • every button is a gesture target (pinch / click). During a game, hand
//     users must pinch-HOLD so a stray pinch never quits the round
//   • buttons are real <button>s, so Tab + Enter works for keyboard users
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { DOCK_ICONS } from './icons.js';
import { clamp } from '../core/util.js';

const ITEMS = [
  { k: 'home', icon: 'home', label: 'Home', tip: 'go Home' },
  { k: 'grimoire', icon: 'book', label: 'Spellbook', tip: 'open the Spellbook' },
  { k: 'hall', icon: 'trophy', label: 'Leaderboard', tip: 'open the Leaderboard' },
  { k: 'settings', icon: 'gear', label: 'Settings', tip: 'open Settings' },
  { k: 'help', icon: 'help', label: 'How to play', tip: 'see how to play' },
  null,
  { k: 'camera', icon: 'camera', label: 'Camera', tip: 'toggle the camera' },
  { k: 'sound', icon: 'sound', label: 'Sound', tip: 'toggle sound' },
  null,
  { k: 'kids', icon: 'kids', label: 'Kids Realm', tip: 'enter the Kids Realm' },
];

export class Dock {
  constructor() {
    this.el = document.getElementById('dock');
    this.el.innerHTML = `<div class="dock-inner">${ITEMS.map((it) => it
      ? `<button class="dock-btn" type="button" data-k="${it.k}" aria-label="${it.label}"><span class="dock-ic">${DOCK_ICONS[it.icon]}</span><span class="dock-lb">${it.label}</span><i class="dock-ring"></i></button>`
      : '<span class="dock-sep" aria-hidden="true"></span>').join('')}</div>`;
    this.btns = [...this.el.querySelectorAll('.dock-btn')];
    this.prox = 0; this.idleT = 0;
    for (const b of this.btns) b.addEventListener('click', (e) => { if (e.detail === 0) this.activate(b.dataset.k); }); // keyboard activation only
    this.sync();
  }

  /** Reflect toggle states (camera / sound / current scene) in the icons. */
  sync() {
    const cam = this.btns.find((b) => b.dataset.k === 'camera'), snd = this.btns.find((b) => b.dataset.k === 'sound');
    const camOn = app.mode === 'camera';
    cam.querySelector('.dock-ic').innerHTML = camOn ? DOCK_ICONS.camera : DOCK_ICONS.cameraOff;
    cam.querySelector('.dock-lb').textContent = camOn ? 'Camera on' : 'Camera off';
    cam.classList.toggle('on', camOn);
    const muted = app.audio?.muted;
    snd.querySelector('.dock-ic').innerHTML = muted ? DOCK_ICONS.mute : DOCK_ICONS.sound;
    snd.querySelector('.dock-lb').textContent = muted ? 'Muted' : 'Sound';
    this.btns.forEach((b) => b.classList.toggle('active', (b.dataset.k === 'home' && app.scenes?.name === 'hub' && !app.overlays?.active) || b.dataset.k === app.overlays?.active));
    this.state = `${camOn}${muted}${app.scenes?.name}${app.overlays?.active}`;
  }

  activate(k) {
    const A = app.actions;
    app.audio.click();
    if (k === 'home') A.goHub();
    else if (k === 'grimoire') A.toggleGrimoire();
    else if (k === 'hall') A.toggleHall();
    else if (k === 'settings') A.toggleSettings();
    else if (k === 'help') A.toggleHelp();
    else if (k === 'camera') A.toggleCamera();
    else if (k === 'sound') A.toggleMute();
    else if (k === 'kids') A.enterKidsRealm();
    this.sync();
  }

  update(dt) {
    const hidden = app.scenes.name === 'intro' || app.scenes.name === 'calibration';
    if (this.el.classList.contains('hidden') !== hidden) this.el.classList.toggle('hidden', hidden);
    if (hidden) return;
    // Rectangles are re-measured a few times a second, or at once while the dock is scaling.
    const c = app.input.cursor;
    if (!this.boxes || app.frame - this.boxFrame > 8 || Math.abs(this.prox - this.boxProx) > 0.02) {
      this.boxFrame = app.frame; this.boxProx = this.prox;
      this.box = this.el.getBoundingClientRect();
      this.boxes = this.btns.map((b) => b.getBoundingClientRect());
    }
    const r = this.box;
    // proximity 0..1: distance from the cursor to the dock rectangle
    let near = 0;
    if (c.active) {
      const dx = Math.max(r.left - c.x, 0, c.x - r.right), dy = Math.max(r.top - c.y, 0, c.y - r.bottom);
      near = 1 - clamp(Math.hypot(dx, dy) / 170);
    }
    this.prox += (near - this.prox) * (1 - Math.exp(-dt / 0.12));
    const pv = this.prox.toFixed(3); // write only on change (avoids a style recalc every frame)
    if (pv !== this.pv) { this.pv = pv; this.el.style.setProperty('--prox', pv); }
    const awake = this.prox > 0.35;
    if (this.el.classList.contains('awake') !== awake) this.el.classList.toggle('awake', awake);

    const inGame = !!app.scenes.current?.isGame && app.scenes.current.state === 'play';
    const handHold = inGame && c.source === 'hand' ? 0.5 : 0;
    this.btns.forEach((b, i) => {
      const k = b.dataset.k, it = ITEMS.find((x) => x && x.k === k);
      const st = app.ui.targetEl('dock-' + k, b, { layer: 'global', hold: handHold, tip: it.tip, gaze: false, handPad: 1.1, box: this.boxes[i] });
      if (st.selected) this.activate(k);
    });
    const s = `${app.mode === 'camera'}${app.audio?.muted}${app.scenes?.name}${app.overlays?.active}`;
    if (s !== this.state) this.sync();
  }
}
