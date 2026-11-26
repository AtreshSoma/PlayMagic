// ---------------------------------------------------------------------------
// <kids-realm-gateway> — a drop-in glowing gateway into the Wonderland Portal
// for any web page or framework (plain HTML, React, Vue, Svelte…).
//
//   <script type="module" src="/wonderland/kids-realm-gateway.js"></script>
//   <kids-realm-gateway href="/wonderland/"></kids-realm-gateway>
//
// Attributes:
//   href   portal route (default "/wonderland/")
//   size   diameter in px (default 132)
//   label  accessible name (default "Kids Realm")
// It is a real link, so keyboard, screen readers and middle-click all work.
// ---------------------------------------------------------------------------
const css = `
:host { display: inline-block; --size: 132px; }
a {
  position: relative; display: grid; place-items: center;
  width: var(--size); height: var(--size); border-radius: 50%;
  text-decoration: none; color: #fff; outline: none;
  font: 700 calc(var(--size) * 0.12)/1.05 Fredoka, "Baloo 2", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif;
  letter-spacing: 0.02em; text-align: center;
  background: radial-gradient(circle at 35% 30%, #fff 0 6%, #ffd6fb 14%, #b98cff 46%, #3a1d86 74%);
  box-shadow: 0 0 calc(var(--size) * 0.25) rgba(255, 158, 230, 0.7), inset 0 0 calc(var(--size) * 0.18) rgba(255, 255, 255, 0.55);
  animation: bob 3.4s ease-in-out infinite;
  transition: transform 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
}
a::before {
  content: ""; position: absolute; inset: -9%; border-radius: 50%;
  background: conic-gradient(#ff6b8b, #ffd84a, #7cf29c, #6fc8ff, #b48cff, #ff6b8b);
  mask: radial-gradient(circle, transparent 62%, #000 64%, #000 69%, transparent 71%);
  -webkit-mask: radial-gradient(circle, transparent 62%, #000 64%, #000 69%, transparent 71%);
  animation: spin 6s linear infinite; filter: drop-shadow(0 0 6px rgba(255,255,255,0.7));
}
a:hover, a:focus-visible { transform: scale(1.08); }
a:focus-visible::after { content: ""; position: absolute; inset: -18%; border-radius: 50%; border: 3px solid #7affd8; }
span { position: relative; text-shadow: 0 2px 8px rgba(60, 20, 120, 0.8); }
.star { display: block; font-size: 1.7em; line-height: 1; margin-bottom: 0.1em; }
@keyframes spin { to { transform: rotate(1turn); } }
@keyframes bob { 50% { translate: 0 -6px; } }
@media (prefers-reduced-motion: reduce) { a, a::before { animation: none; } }
`;

class KidsRealmGateway extends HTMLElement {
  static get observedAttributes() { return ['href', 'size', 'label']; }
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${css}</style><a part="gateway"><span><span class="star" aria-hidden="true">✦</span>Kids<br>Realm</span></a>`;
    this.link = root.querySelector('a');
  }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    this.link.href = this.getAttribute('href') || '/wonderland/';
    this.link.setAttribute('aria-label', this.getAttribute('label') || 'Kids Realm: open the Wonderland Portal');
    const size = parseInt(this.getAttribute('size'), 10);
    if (size > 0) this.style.setProperty('--size', size + 'px');
  }
}

if (!customElements.get('kids-realm-gateway')) customElements.define('kids-realm-gateway', KidsRealmGateway);
