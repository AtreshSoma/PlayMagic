// ---------------------------------------------------------------------------
// Always-visible "Home" button, top-left, in every game and the tutorial.
//   mouse / touch  click or tap
//   keyboard       Tab to it + Enter (Esc also goes back everywhere)
//   camera hand    pinch it; during live play the pinch must be HELD for
//                  HOLD seconds (a ring fills) so a stray pinch never ends a round
// Its rectangle is cached and re-measured a few times a second.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';

const HOLD = 0.5;

export class BackButton {
  constructor() {
    this.el = document.getElementById('back');
    this.el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6l-6 6 6 6"/></svg><span>Home</span><i class="back-ring" aria-hidden="true"></i>';
    this.el.addEventListener('click', (e) => { if (e.detail === 0) this.go(); }); // keyboard / screen readers; pointers arrive via the gesture UI
    this.shown = null; this.boxFrame = -99;
  }

  go() {
    app.audio.click();
    if (app.scenes.name === 'initiation') app.actions.back(); // skips the tutorial, then Home
    else app.actions.goHub();
  }

  update() {
    const sc = app.scenes.current, n = app.scenes.name;
    const show = !!sc?.isGame || n === 'initiation';
    if (show !== this.shown) {
      this.shown = show;
      this.el.classList.toggle('show', show);
      this.el.tabIndex = show ? 0 : -1;
      this.el.setAttribute('aria-hidden', String(!show));
      this.boxFrame = -99;
    }
    if (!show || app.overlays.active || app.scenes.trans) return;
    if (app.frame - this.boxFrame > 10) { this.boxFrame = app.frame; this.box = this.el.getBoundingClientRect(); }
    const playing = !!sc.isGame && sc.state === 'play', hand = app.input.cursor.source === 'hand';
    const hold = playing && hand ? HOLD : 0;
    const st = app.ui.targetEl('back', this.el, { layer: 'global', box: this.box, hold, release: !hold, gaze: false, tip: 'go Home' });
    if (st.selected) this.go();
  }
}
