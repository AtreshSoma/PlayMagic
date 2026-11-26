// ---------------------------------------------------------------------------
// HUD: toast captions, the coach (one short instruction at a time, with a
// warning when the camera loses your hand), the "new magic discovered"
// celebration. (Tracking status now lives in the gesture pill, ui/pill.js.)
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { ICONS } from './icons.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.toastEl = $('toast');
    this.coachEl = $('coach'); this.coachIcon = this.coachEl.querySelector('.coach-icon'); this.coachText = this.coachEl.querySelector('.coach-text');
    this.celEl = $('celebrate');
    this.toastTimer = 0; this.celTimer = 0;
    this.base = null;        // the current scene's standing instruction
    this.shown = '';         // key of what the coach currently shows
    this.noHandT = 0;
  }

  toast(text, glyph = '✦', ms = 2200) {
    this.toastEl.innerHTML = `<span class="g">${glyph}</span>${text}`;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  /** Set the scene's standing instruction. `html` may contain <b> and <small>. */
  hint(html, icon = '') { this.base = html ? { html, icon } : null; }

  /** Big, brief "new magic" moment. */
  celebrate(magic, n, total) {
    this.celEl.querySelector('.cel-icon').innerHTML = ICONS[magic.icon] || '';
    this.celEl.querySelector('.cel-name').textContent = magic.name;
    this.celEl.querySelector('.cel-count').textContent = `${n} of ${total} magics found`;
    this.celEl.classList.add('show');
    clearTimeout(this.celTimer);
    this.celTimer = setTimeout(() => this.celEl.classList.remove('show'), 2600);
    app.audio.victory();
    app.particles.emit({ x: app.W / 2, y: app.H * 0.26, count: 50, speed: [80, 340], life: [0.8, 1.6], size: [2, 5] });
  }

  _setCoach(msg) {
    const key = msg ? msg.icon + msg.html + (msg.warn ? '!' : '') : '';
    if (key === this.shown) return;
    this.shown = key;
    if (!msg) { this.coachEl.classList.add('empty'); return; }
    this.coachIcon.innerHTML = msg.icon ? ICONS[msg.icon] || '' : '';
    this.coachText.innerHTML = msg.html;
    this.coachEl.classList.toggle('warn', !!msg.warn);
    this.coachEl.classList.remove('empty', 'swap'); void this.coachEl.offsetWidth; this.coachEl.classList.add('swap');
  }

  update(dt) {
    const inp = app.input, sc = app.scenes.current;
    const camera = app.mode === 'camera';

    // Coach: warning about a missing hand beats the scene's instruction
    let msg = null;
    if (camera && sc?.needsHand && !app.overlays.active && !app.scenes.trans) {
      const seen = inp.cameraHandsPresent || (inp.mouseHand.present && app.t - inp.fb.lastMove < 1);
      this.noHandT = seen ? 0 : this.noHandT + dt;
      if (this.noHandT > 2.5) msg = { icon: 'palm', html: 'Raise your hand so the camera can see it<small>Palm facing the screen, about an arm’s length away</small>', warn: true };
    } else this.noHandT = 0;
    // During play the coach line fades after 7 s so the canvas stays clear (warnings still show).
    const quiet = sc?.isGame && sc.state === 'play' && sc.stateT > 7;
    if (!msg && !quiet) msg = (sc?.coach && sc.coach()) || this.base;
    this._setCoach(msg);
  }
}

/** "Pinch" or "Click", depending on what is steering the cursor. */
export function verb() { return app.mode === 'camera' && app.input.cursor.source !== 'mouse' ? 'Pinch' : 'Click'; }
