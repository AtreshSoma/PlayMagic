// ---------------------------------------------------------------------------
// Grown-up corner. A small, dim button in the bottom-right corner must be
// pressed and held for 1.5 s to open (children rarely do that by accident,
// and camera hands can't press DOM buttons at all). The panel holds:
// sound on/off + volume, camera mirror opacity, camera vs touch-only play,
// and an optional "leave the portal" link back to the host app.
// This is the only place in the portal that uses words.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { settings } from '../core/settings.js';

const HOLD_MS = 1500;

export class ParentPanel {
  constructor({ exitUrl = '' } = {}) {
    this.btn = document.getElementById('parent-btn');
    this.panel = document.getElementById('parent-panel');
    this.exitUrl = exitUrl;
    this.holdStart = 0; this.raf = 0;
    this.bindButton();
    this.bindPanel();
    this.sync();
  }

  bindButton() {
    const b = this.btn;
    const tick = () => {
      const p = Math.min(1, (performance.now() - this.holdStart) / HOLD_MS);
      b.style.setProperty('--p', p.toFixed(3));
      if (p >= 1) { this.cancelHold(); this.open(); return; }
      this.raf = requestAnimationFrame(tick);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.holdStart = performance.now();
      b.classList.add('holding');
      cancelAnimationFrame(this.raf); this.raf = requestAnimationFrame(tick);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => this.cancelHold()));
    // keyboard users (grown-ups) can open it directly
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.open(); } });
  }

  cancelHold() {
    cancelAnimationFrame(this.raf);
    this.btn.classList.remove('holding');
    this.btn.style.setProperty('--p', '0');
  }

  bindPanel() {
    const $ = (s) => this.panel.querySelector(s);
    this.el = {
      sound: $('#pp-sound'), volume: $('#pp-volume'), mirror: $('#pp-mirror'), mirrorOut: $('#pp-mirror-out'),
      camera: $('#pp-input-camera'), touch: $('#pp-input-touch'), status: $('#pp-cam-status'),
      exit: $('#pp-exit'), close: $('#pp-close'), done: $('#pp-done'),
    };
    const e = this.el;
    e.sound.addEventListener('change', () => { settings.set('sound', e.sound.checked); app.sound.setEnabled(e.sound.checked); this.sync(); });
    e.volume.addEventListener('input', () => { const v = +e.volume.value / 100; settings.set('volume', v); app.sound.setVolume(v); });
    e.volume.addEventListener('change', () => app.sound.chime(1, 0.1));
    e.mirror.addEventListener('input', () => { settings.set('mirror', +e.mirror.value / 100); this.sync(); });
    const setInput = (mode) => {
      settings.set('input', mode);
      if (mode === 'touch') app.input.stopCamera();
      else if (app.started) app.input.startCamera();
      this.sync();
    };
    e.camera.addEventListener('change', () => e.camera.checked && setInput('camera'));
    e.touch.addEventListener('change', () => e.touch.checked && setInput('touch'));
    e.close.addEventListener('click', () => this.close());
    e.done.addEventListener('click', () => this.close());
    if (this.exitUrl) { e.exit.href = this.exitUrl; e.exit.hidden = false; }
    this.panel.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') this.close(); });
    this.panel.addEventListener('pointerdown', (ev) => { if (ev.target === this.panel) this.close(); });
  }

  sync() {
    const d = settings.data, e = this.el;
    e.sound.checked = d.sound;
    e.volume.value = Math.round(d.volume * 100);
    e.volume.disabled = !d.sound;
    e.mirror.value = Math.round(d.mirror * 100);
    e.mirrorOut.textContent = d.mirror < 0.01 ? 'Hidden' : `${Math.round(d.mirror * 100)}%`;
    e.camera.checked = d.input === 'camera';
    e.touch.checked = d.input === 'touch';
    const st = app.input?.cam;
    const msg = {
      off: d.input === 'touch' ? 'Camera is off. Play with touch or the mouse.' : 'The camera starts when play begins.',
      starting: 'Starting the camera…', mirror: 'Loading hand and face tracking…', on: 'Camera on. Video is processed only on this device.',
      error: `Camera unavailable: ${st?.error?.message || 'unknown reason'} Touch and mouse still work.`,
    };
    e.status.textContent = msg[st?.state || 'off'];
  }

  get isOpen() { return !this.panel.hidden; }

  open() {
    this.sync();
    this.panel.hidden = false;
    this.lastFocus = document.activeElement;
    this.el.close.focus();
    this.timer = setInterval(() => this.sync(), 800);
  }

  close() {
    this.panel.hidden = true;
    clearInterval(this.timer);
    this.lastFocus?.focus?.();
  }
}
