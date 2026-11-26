// ---------------------------------------------------------------------------
// Settings: element, effect strength, mirror view, sound, and replays — all as
// big tiles you pinch (or click). Replaces the hidden radial wheel and the
// scattered corner orbs.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { THEMES, THEME_ORDER, INTENSITIES, MIRROR_MODES } from '../core/themes.js';

const VOLUMES = [{ key: 'off', label: 'Off', v: 0 }, { key: 'soft', label: 'Soft', v: 0.35 }, { key: 'medium', label: 'Medium', v: 0.7 }, { key: 'loud', label: 'Loud', v: 1 }];

export class Settings {
  constructor() { this.el = document.getElementById('settings'); }

  render() {
    const cam = app.mode === 'camera', s = app.store.data.settings, a = app.audio;
    const vol = a.muted ? 'off' : VOLUMES.slice(1).reduce((b, v) => (Math.abs(v.v - a.volume) < Math.abs(b.v - a.volume) ? v : b)).key;
    const tile = (k, title, sub, active, extra = '') => `<div class="choice ${active ? 'active' : ''}" data-k="${k}">${extra}<b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div>`;
    this.el.innerHTML = `<div class="panel glass narrow">
      <div class="panel-head">
        <h1>SETTINGS<small>Pinch a tile to choose</small></h1>
        <div class="orb-wrap"><div class="orb" data-k="close">✕</div><span>Close</span></div>
      </div>
      <div class="section-title">ELEMENT</div>
      <div class="choices">${THEME_ORDER.map((k) => { const t = THEMES[k]; return tile('theme:' + k, t.name, t.tagline, app.themeKey === k, `<div class="sw">${t.shader.slice(1).map((c) => `<i style="background:${c}"></i>`).join('')}</div>`); }).join('')}</div>
      <div class="section-title">EFFECTS</div>
      <div class="choices">${INTENSITIES.map((it, i) => tile('fx:' + i, it.label, ['Calm and minimal', 'Balanced', 'Maximum sparkle'][i], s.intensity === i)).join('')}</div>
      <div class="section-title">MIRROR VIEW${cam ? '' : ' · needs the camera'}</div>
      <div class="choices">${MIRROR_MODES.map((m) => tile('mirror:' + m.key, m.label, { full: 'See yourself clearly', ethereal: 'A glowing outline of you', void: 'Only the light, no camera image' }[m.key], app.mirror.mode === m.key)).join('')}</div>
      <div class="section-title">VISUAL QUALITY · NOW ${(app.qualityName || 'High').toUpperCase()}</div>
      <div class="choices">${[['auto', 'Auto', 'Adjusts itself to keep play smooth'], ['high', 'High', 'Sharpest, most sparkle'], ['saver', 'Battery saver', 'Lighter effects for older devices']].map(([k, t, sub]) => tile('quality:' + k, t, sub, (s.quality || 'auto') === k)).join('')}</div>
      <div class="section-title">SOUND</div>
      <div class="choices">${VOLUMES.map((v) => tile('vol:' + v.key, v.label, '', vol === v.key)).join('')}</div>
      <div class="section-title">MORE</div>
      <div class="choices">
        ${tile('tutorial', 'Replay tutorial', 'The 15-second introduction', false)}
        ${tile('reset-magic', 'Forget found magic', 'Rediscover every spell', false)}
        ${tile('swap-winks', 'Swap wink sides', s.swapWinks ? 'On: left and right winks are swapped' : 'If left and right winks feel reversed', !!s.swapWinks)}
      </div>
    </div>`;
    this.tiles = [...this.el.querySelectorAll('[data-k]')];
  }

  open() { this.render(); this.el.hidden = false; app.audio.swell(262, { vel: 0.4 }); }
  close() { this.el.hidden = true; }

  update() {
    for (const el of this.tiles) {
      const k = el.dataset.k;
      const st = app.ui.targetEl('set-' + k, el, { layer: 'settings', tip: k === 'close' ? 'close' : 'choose' });
      if (!st.selected) continue;
      app.audio.select();
      this.apply(k);
      return;
    }
  }

  apply(k) {
    const [kind, val] = k.split(':'), A = app.actions;
    if (kind === 'close') return app.overlays.close();
    if (kind === 'theme') A.setTheme(val);
    else if (kind === 'fx') A.setIntensity(+val);
    else if (kind === 'quality') app.setQuality(val);
    else if (kind === 'mirror') { app.mirror.setMode(val); app.store.setting('mirror', val); }
    else if (kind === 'vol') {
      const v = VOLUMES.find((x) => x.key === val);
      app.audio.setMuted(v.v === 0); app.store.setting('muted', v.v === 0);
      if (v.v) { app.audio.setVolume(v.v); app.store.setting('volume', v.v); }
    } else if (kind === 'tutorial') { app.overlays.close(); return app.scenes.go('initiation'); }
    else if (kind === 'swap-winks') { app.store.setting('swapWinks', !app.store.data.settings.swapWinks); }
    else if (kind === 'reset-magic') { app.store.data.discovered = []; app.store.save(); app.hud.toast('Every magic is waiting to be found again', '✦'); }
    this.render();
  }
}
