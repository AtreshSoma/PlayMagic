// ---------------------------------------------------------------------------
// Peace-sign snapshots. After a frame is rendered, the three canvases
// (WebGL tapestry, camera mirror, effects) are composited into one image with
// a soft frame and caption. A polaroid thumbnail slides in at the top-right
// for a few seconds; pinch / click it to save the PNG.
// Capture must happen in the same task as rendering (the WebGL buffer is not
// preserved), which is why main.js calls capture() right after drawing.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';

export class Snapshots {
  constructor() {
    this.el = document.getElementById('snap');
    // The <img> is created here, not in the HTML, so the page never ships an empty image tag.
    this.img = new Image();
    this.img.alt = 'Snapshot of your scene';
    this.el.prepend(this.img);
    this.url = null; this.hideT = 0;
  }

  capture() {
    const W = app.W, H = app.H, k = Math.min(1, 1600 / W);
    const c = document.createElement('canvas');
    c.width = Math.round(W * k); c.height = Math.round(H * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = app.theme.shader[0]; ctx.fillRect(0, 0, c.width, c.height);
    for (const id of ['tapestry', 'mirror', 'fx']) {
      const src = document.getElementById(id);
      if (!src || !src.width) continue;
      const cs = getComputedStyle(src);
      ctx.globalAlpha = id === 'mirror' ? parseFloat(cs.opacity) || 0 : 1;
      ctx.globalCompositeOperation = id === 'mirror' && app.mirror.mode === 'ethereal' ? 'screen' : 'source-over';
      try { ctx.drawImage(src, 0, 0, c.width, c.height); } catch { /* tainted or lost context: skip layer */ }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // stylised frame + caption
    const pad = Math.round(c.width * 0.018);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.strokeRect(pad, pad, c.width - pad * 2, c.height - pad * 2);
    ctx.font = `600 ${Math.round(c.width * 0.014)}px Sora, Inter, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(`AETHERIA · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`, c.width - pad * 2, c.height - pad * 2);
    try { this.url = c.toDataURL('image/png'); } catch { this.url = null; }
    if (!this.url) return;
    this.img.src = this.url;
    this.el.hidden = false;
    this.el.classList.remove('show'); void this.el.offsetWidth; this.el.classList.add('show');
    this.hideT = 5;
    app.fx.flash('#ffffff', 0.5);
  }

  save() {
    if (!this.url) return;
    const a = document.createElement('a');
    a.href = this.url; a.download = `aetheria-snapshot-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    app.audio.select();
    app.hud.toast('Snapshot saved to your downloads', '◉');
    this.hideT = 0.6;
  }

  update(dt) {
    if (this.el.hidden) return;
    this.hideT -= dt;
    const st = app.ui.targetEl('snapshot', this.el, { layer: 'global', tip: 'save the snapshot', gaze: false });
    if (st.selected) this.save();
    if (this.hideT <= 0) { this.el.classList.remove('show'); if (this.hideT < -0.5) this.el.hidden = true; }
  }
}
