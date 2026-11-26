// ---------------------------------------------------------------------------
// Live gesture status pill (top centre). Two tiny dots show whether the
// camera sees a hand and a face; beside them, the gesture recognised right
// now ("Pinch", "Peace", "Left Wink", "Head Tilt"…). One-shot gestures flash
// the pill brighter for a moment. With no camera it reads "Mouse & keys".
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { ICONS } from './icons.js';
import { GESTURE_INFO } from '../input/gestures.js';

export class GesturePill {
  constructor() {
    this.el = document.getElementById('pill');
    this.el.innerHTML = '<span class="pill-dots"><i class="pd-hand" title="Hand"></i><i class="pd-face" title="Face"></i></span><span class="pill-ic"></span><span class="pill-lb"></span>';
    this.ic = this.el.querySelector('.pill-ic'); this.lb = this.el.querySelector('.pill-lb');
    this.dh = this.el.querySelector('.pd-hand'); this.df = this.el.querySelector('.pd-face');
    this.shown = null; this.lastFlash = null;
  }

  update() {
    const inp = app.input, g = inp.gest, cam = app.mode === 'camera';
    this.el.classList.toggle('hidden', app.scenes.name === 'intro');
    this.el.classList.toggle('camera', cam);
    if (cam) {
      this.dh.classList.toggle('on', inp.cameraHandsPresent);
      this.df.classList.toggle('on', inp.face.present);
    }
    const key = g.current;
    const label = key ? GESTURE_INFO[key]?.[0] : cam ? (inp.cameraHandsPresent || inp.face.present ? 'Tracking' : 'Looking for you') : 'Mouse & keys';
    if (label !== this.shown) {
      this.shown = label;
      const icon = key ? GESTURE_INFO[key]?.[1] : null;
      this.ic.innerHTML = icon && ICONS[icon] ? ICONS[icon] : '';
      this.lb.textContent = label;
      this.el.classList.toggle('lit', !!key);
    }
    // retrigger the flash animation on every new one-shot
    if (g.isFlash && g.flash !== this.lastFlash) {
      this.lastFlash = g.flash;
      this.el.classList.remove('flash'); void this.el.offsetWidth; this.el.classList.add('flash');
    }
  }
}
