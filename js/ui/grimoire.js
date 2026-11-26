// ---------------------------------------------------------------------------
// The Spellbook: the four basics, plus every magic — lit once discovered,
// dimmed (with how-to) until then. Open from the hub orb or with G.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { ICONS } from './icons.js';
import { MAGICS, isFound, howTo, foundCount } from './discovery.js';

export class Grimoire {
  constructor() { this.el = document.getElementById('grimoire'); }

  render() {
    const cam = app.mode === 'camera', n = foundCount();
    const basics = cam
      ? [['point', 'Move', 'Point one finger. The light follows it.'], ['pinch', 'Choose', 'Pinch thumb and finger together.'], ['palm', 'Let go', 'Open your hand.'], ['swipe', 'Go back', 'Pinch the Home button, top-left (hold it during play).']]
      : [['point', 'Move', 'Move the mouse. The light follows it.'], ['pinch', 'Choose', 'Click.'], ['palm', 'Let go', 'Release the click.'], ['swipe', 'Go back', 'Home button, top-left, or Esc.']];
    this.el.innerHTML = `<div class="panel glass narrow">
      <div class="panel-head">
        <h1>SPELLBOOK<small>Magic you have found, and how to find the rest</small></h1>
        <div class="orb-wrap"><div class="orb" id="grim-close">✕</div><span>Close</span></div>
      </div>
      <div class="section-title">THE BASICS</div>
      <div class="basics">${basics.map(([i, b, t]) => `<div>${ICONS[i]}<span><b>${b}</b><br>${t}</span></div>`).join('')}</div>
      <div class="section-title">MAGIC · ${n} OF ${MAGICS.length} FOUND</div>
      <div class="progress" style="--p:${n / MAGICS.length}"><i></i></div>
      <div class="spell-grid">${MAGICS.map((m) => {
        const f = isFound(m.id);
        return `<div class="spell ${f ? 'found' : 'locked'}">${ICONS[m.icon]}<div><span class="tag">${f ? 'FOUND' : 'NOT YET FOUND'}</span><b>${m.name}</b><p>${howTo(m)}</p></div></div>`;
      }).join('')}</div>
    </div>`;
    this.closeEl = this.el.querySelector('#grim-close');
  }

  open() { this.render(); this.el.hidden = false; app.audio.swell(330, { vel: 0.4 }); }
  close() { this.el.hidden = true; }
  update() {
    const st = app.ui.targetEl('grim-close', this.closeEl, { layer: 'grimoire', tip: 'close' });
    if (st.selected) app.overlays.close();
  }
}
