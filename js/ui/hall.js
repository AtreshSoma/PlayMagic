// ---------------------------------------------------------------------------
// Hall of Weavers: leaderboard (fictional challengers + your local bests),
// caster profile (emblem / title / name), lifetime stats, and the one-gesture
// "Export Runic Card" — a stylised PNG of your scores, mood aura and moon.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { CHALLENGERS } from '../data/challengers.js';
import { GAMES, SCORED_GAMES } from '../games/catalog.js';
import { TITLES, EMBLEMS, randomName } from '../core/store.js';
import { MOODS } from '../input/mood.js';
import { moonPhase } from '../core/celestial.js';
import { drawMoon } from './astrolabe.js';
import { TAU, fmt, rgba, rgbStr } from '../core/util.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Hall {
  constructor() {
    this.el = document.getElementById('hall');
    this.tab = SCORED_GAMES[0].id;
    this.el.innerHTML = `<div class="panel glass">
      <div class="panel-head">
        <h1>LEADERBOARD<small>Your best scores against players around the world</small></h1>
        <div class="orb-wrap"><div class="orb" data-orb="close">✕</div><span>Close</span></div>
      </div>
      <div class="hall-grid">
        <div class="profile">
          <div class="emblem" data-f="emblem"></div>
          <div class="pname" data-f="name" contenteditable="true" spellcheck="false"></div>
          <div class="ptitle" data-f="title"></div>
          <div class="stats" data-f="stats"></div>
          <div class="orbs">
            <div class="orb-wrap"><div class="orb" data-orb="emblem">⟳</div><span>Emblem</span></div>
            <div class="orb-wrap"><div class="orb" data-orb="title">❦</div><span>Title</span></div>
            <div class="orb-wrap"><div class="orb" data-orb="name">✎</div><span>Name</span></div>
            <div class="orb-wrap"><div class="orb" data-orb="card">⎙</div><span>Save card</span></div>
          </div>
          <div class="card-preview" data-f="preview"><p>Saved to your downloads as a PNG.</p></div>
        </div>
        <div>
          <div class="board-tabs">
            ${SCORED_GAMES.map((g) => `<div class="tab-chip" data-tab="${g.id}" data-orb="tab-${g.id}"><i style="background:${g.accent}"></i>${g.name}</div>`).join('')}
          </div>
          <table class="board" data-f="board"></table>
        </div>
      </div>
    </div>`;
    this.f = {};
    this.el.querySelectorAll('[data-f]').forEach((n) => (this.f[n.dataset.f] = n));
    this.orbs = {};
    this.el.querySelectorAll('[data-orb]').forEach((n) => (this.orbs[n.dataset.orb] = n));
    this.f.name.addEventListener('input', () => {
      app.store.data.profile.name = this.f.name.textContent.trim().slice(0, 24) || randomName();
      app.store.save();
    });
    this.f.name.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this.f.name.blur(); } });
  }

  open() { this.el.hidden = false; this.f.preview.classList.remove('show'); this.render(); app.audio.swell(262, { vel: 0.4 }); }
  close() { this.el.hidden = true; this.f.name.blur(); }

  render() {
    const d = app.store.data, p = d.profile;
    this.f.emblem.textContent = EMBLEMS[p.emblem % EMBLEMS.length];
    if (document.activeElement !== this.f.name) this.f.name.textContent = p.name;
    this.f.title.textContent = TITLES[p.title % TITLES.length];
    const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
    this.f.stats.innerHTML = [
      stat(fmt(d.totals.runes), 'Runes cast'),
      stat(`${d.streak.days} ${d.streak.days === 1 ? 'day' : 'days'}`, 'Daily streak'),
      stat(d.bestCombo, 'Best combo'),
      stat(fmt(d.totals.games), 'Games played'),
    ].join('');
    this.el.querySelectorAll('[data-tab]').forEach((n) => n.classList.toggle('active', n.dataset.tab === this.tab));
    const you = { name: p.name, city: 'You', emblem: EMBLEMS[p.emblem % EMBLEMS.length], score: d.best[this.tab] || 0, you: true };
    const rows = CHALLENGERS.map((c) => ({ ...c, score: c.scores[this.tab] || 0 }));
    if (you.score > 0) rows.push(you);
    rows.sort((a, b) => b.score - a.score);
    this.f.board.innerHTML = rows.slice(0, 15).map((r, i) =>
      `<tr class="${r.you ? 'you' : ''}"><td class="rank">${i + 1}</td><td class="em">${r.emblem}</td><td class="nm"><b>${esc(r.name)}</b><small>${esc(r.city)}</small></td><td class="sc">${fmt(r.score)}</td></tr>`).join('')
      + (you.score === 0 ? `<tr class="you"><td class="rank">—</td><td class="em">${you.emblem}</td><td class="nm"><b>${esc(you.name)}</b><small>Play ${GAMES[this.tab].name} to get on the board</small></td><td class="sc">0</td></tr>` : '');
  }

  update() {
    const ui = app.ui, d = app.store.data, p = d.profile;
    const TIPS = { close: 'close', emblem: 'change emblem', title: 'change title', name: 'new name', card: 'save your card' };
    const hit = (id) => ui.targetEl('hall-' + id, this.orbs[id], { layer: 'hall', tip: TIPS[id] || 'show' }).selected;
    if (hit('close')) { app.overlays.close(); return; }
    if (hit('emblem')) { p.emblem = (p.emblem + 1) % EMBLEMS.length; app.store.save(); this.render(); }
    if (hit('title')) { p.title = (p.title + 1) % TITLES.length; app.store.save(); this.render(); }
    if (hit('name')) { p.name = randomName(); app.store.save(); this.render(); }
    if (hit('card')) this.exportCard();
    for (const g of SCORED_GAMES) if (hit('tab-' + g.id)) { this.tab = g.id; this.render(); }
  }

  /** Render and download the Runic Card. */
  exportCard() {
    const url = renderRunicCard();
    let img = this.f.preview.querySelector('img');
    if (!img) { img = new Image(); img.alt = 'Your runic card'; this.f.preview.prepend(img); }
    img.src = url;
    this.f.preview.classList.add('show');
    const a = document.createElement('a');
    a.href = url; a.download = `aetheria-runic-card-${Date.now()}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    app.audio.select();
    app.hud.toast('Card saved to your downloads', '⎙');
  }
}

export function renderRunicCard() {
  const W = 1200, H = 675, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d'), th = app.theme, d = app.store.data, p = d.profile;
  const mood = MOODS[app.mood.dominant], phase = moonPhase(new Date());
  // backdrop
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, th.shader[0]); bg.addColorStop(0.55, th.shader[1]); bg.addColorStop(1, th.shader[2]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // mood aura
  const aura = ctx.createRadialGradient(300, 330, 20, 300, 330, 380);
  aura.addColorStop(0, rgbStr(app.mood.color, 0.55)); aura.addColorStop(1, rgbStr(app.mood.color, 0));
  ctx.fillStyle = aura; ctx.fillRect(0, 0, W, H);
  // stars
  for (let i = 0; i < 260; i++) {
    const x = (Math.sin(i * 91.7) * 0.5 + 0.5) * W, y = (Math.sin(i * 47.3 + 1) * 0.5 + 0.5) * H, r = (i % 7 === 0 ? 1.8 : 0.9);
    ctx.fillStyle = rgba('#ffffff', 0.25 + (i % 5) * 0.12); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // silk filaments
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) {
    ctx.strokeStyle = rgba(th.accent, 0.12 + k * 0.02); ctx.lineWidth = 1 + k * 0.4;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) { const y = H * 0.78 + Math.sin(x * 0.006 + k * 0.9) * (40 + k * 10) - k * 18; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  // frame
  ctx.strokeStyle = rgba(th.accent, 0.6); ctx.lineWidth = 2; ctx.strokeRect(24, 24, W - 48, H - 48);
  ctx.strokeStyle = rgba('#ffffff', 0.15); ctx.lineWidth = 1; ctx.strokeRect(34, 34, W - 68, H - 68);
  // emblem + identity
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = th.accent; ctx.shadowBlur = 30;
  ctx.fillStyle = th.accent; ctx.font = '120px Sora, serif';
  ctx.fillText(EMBLEMS[p.emblem % EMBLEMS.length], 300, 260);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff'; ctx.font = '600 44px Sora, sans-serif';
  ctx.fillText(p.name, 300, 400);
  ctx.fillStyle = rgba('#ffffff', 0.7); ctx.font = '400 26px Inter, sans-serif';
  ctx.fillText(TITLES[p.title % TITLES.length], 300, 445);
  ctx.font = '600 15px Inter, sans-serif'; ctx.fillStyle = rgba('#ffffff', 0.6);
  ctx.fillText(`MOOD AURA · ${mood.label.toUpperCase()}   ·   ${th.name.toUpperCase()}`, 300, 500);
  // right column: scores
  ctx.textAlign = 'left';
  ctx.fillStyle = th.accent; ctx.font = '600 18px Inter, sans-serif';
  ctx.fillText('AETHERIA · RUNIC CARD', 620, 96);
  const rows = [
    ...SCORED_GAMES.map((g) => [g.name, fmt(d.best[g.id] || 0)]),
    ['Resonance streak', `${d.streak.days} day${d.streak.days === 1 ? '' : 's'}`],
    ['Games played', fmt(d.totals.games)],
  ];
  rows.forEach(([k, v], i) => {
    const y = 150 + i * 50;
    ctx.fillStyle = rgba('#ffffff', 0.65); ctx.font = '400 20px Inter, sans-serif'; ctx.fillText(k, 620, y);
    ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.font = '600 26px Sora, sans-serif'; ctx.fillText(v, 1130, y);
    ctx.textAlign = 'left';
    ctx.strokeStyle = rgba('#ffffff', 0.1); ctx.beginPath(); ctx.moveTo(620, y + 22); ctx.lineTo(1130, y + 22); ctx.stroke();
  });
  // moon
  drawMoon(ctx, 660, 580, 26, phase.frac);
  ctx.fillStyle = rgba('#ffffff', 0.8); ctx.font = '500 17px Inter, sans-serif';
  ctx.fillText(`${phase.name} · ${Math.round(phase.illum * 100)}% lit`, 700, 574);
  ctx.fillStyle = rgba('#ffffff', 0.5); ctx.font = '400 14px Inter, sans-serif';
  ctx.fillText(new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }), 700, 596);
  return c.toDataURL('image/png');
}
