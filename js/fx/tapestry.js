// ---------------------------------------------------------------------------
// The Living Tapestry: a full-screen WebGL fragment shader of domain-warped
// fbm "silk" with thin light filaments. Theme style layers blend in:
//   astral twinkling stars · ember heat shimmer & rising glow
//   tide voronoi caustics  · void iridescent fractures
// Rendered at reduced resolution and upscaled (it is soft by nature).
// Ripples (pinches, spells) displace the silk; gravity steers its drift.
// ---------------------------------------------------------------------------
import { app } from '../core/app.js';
import { hexToRgb, alphaFor } from '../core/util.js';

const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform float u_flow;
uniform vec3 u_c0; uniform vec3 u_c1; uniform vec3 u_c2; uniform vec3 u_c3;
uniform vec3 u_mood; uniform float u_bright; uniform vec4 u_style;
uniform vec2 u_ptr; uniform vec3 u_rip[6]; uniform float u_bloom; uniform float u_zoom; uniform vec2 u_grav;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ v += a * noise(p); p = m * p; a *= 0.5; } return v; }
vec2 voronoi(vec2 p){ vec2 n = floor(p), f = fract(p); float m1 = 8.0, m2 = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
    vec2 g = vec2(float(i), float(j)); vec2 o = vec2(hash(n + g), hash(n + g + 19.19));
    o = 0.5 + 0.5 * sin(u_time * 0.4 + 6.2831 * o);
    vec2 r = g + o - f; float d = dot(r, r);
    if (d < m1){ m2 = m1; m1 = d; } else if (d < m2){ m2 = d; } }
  return vec2(sqrt(m1), sqrt(m2)); }

void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  p /= u_zoom;
  // pinch / spell ripples
  for (int i = 0; i < 6; i++){
    vec3 r = u_rip[i];
    if (r.z < 0.0 || r.z > 2.5) continue;
    vec2 rp = (r.xy * u_res - 0.5 * u_res) / u_res.y / u_zoom;
    vec2 d = p - rp; float l = length(d) + 1e-4;
    float front = r.z * 0.9;
    float w = sin((l - front) * 38.0) * exp(-abs(l - front) * 9.0) * exp(-r.z * 1.6);
    p += d / l * w * 0.025;
  }
  // ember heat distortion
  p.x += sin(p.y * 24.0 - u_time * 5.0) * 0.004 * u_style.y;
  float t = u_flow;
  vec2 drift = vec2(u_grav.x, -u_grav.y) * t * 0.025;
  vec2 q = vec2(fbm(p * 1.3 + drift + vec2(0.0, t * 0.05)), fbm(p * 1.3 + drift + vec2(5.2, -t * 0.04)));
  vec2 r = vec2(fbm(p * 1.7 + 3.0 * q + vec2(1.7, 9.2) + t * 0.06), fbm(p * 1.7 + 3.0 * q + vec2(8.3, 2.8) - t * 0.05));
  float f = fbm(p * 1.1 + 2.4 * r);

  float silk = p.y * 1.3 + p.x * 0.35 + r.x * 1.2 + f * 0.8;
  float s1 = pow(0.5 + 0.5 * sin(silk * 8.0 + t * 0.6), 10.0);
  float s2 = pow(0.5 + 0.5 * sin(silk * 13.0 - t * 0.4 + q.y * 4.0), 18.0);
  vec3 col = mix(u_c0, u_c1, smoothstep(0.15, 0.85, f));
  col = mix(col, u_c2, clamp(length(q) * 0.55 - 0.15, 0.0, 1.0));
  float fil = (s1 * 0.9 + s2 * 0.6) * (0.4 + 0.9 * f);
  col += u_c3 * fil * u_bright * (0.6 + u_bloom * 0.8);

  if (u_style.x > 0.01){ // astral stars
    vec2 sp = p * 34.0; vec2 id = floor(sp); float h = hash(id);
    vec2 fp = fract(sp) - 0.5 - (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
    float star = smoothstep(0.09, 0.0, length(fp)) * step(0.935, h) * (0.5 + 0.5 * sin(u_time * 2.0 + h * 60.0));
    col += vec3(1.0, 0.94, 0.8) * star * 0.9 * u_style.x;
  }
  if (u_style.y > 0.01){ // rising heat glow
    float heat = pow(fbm(vec2(p.x * 3.0, p.y * 2.0 - u_time * 0.5)), 3.0) * (1.2 - uv.y);
    col += u_c3 * heat * 0.9 * u_style.y;
  }
  if (u_style.z > 0.01){ // caustics
    vec2 v = voronoi(p * 3.2 + q * 1.2 + vec2(t * 0.04, t * 0.03));
    float c = pow(clamp(1.0 - (v.y - v.x) * 2.2, 0.0, 1.0), 6.0);
    col += u_c3 * c * 0.35 * u_style.z;
  }
  if (u_style.w > 0.01){ // iridescent fractures
    vec2 v = voronoi(p * 3.6 + r * 0.6);
    float edge = 1.0 - smoothstep(0.0, 0.045, v.y - v.x);
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (f + vec3(0.0, 0.33, 0.67)) + u_time * 0.3);
    col += irid * edge * 0.45 * u_style.w;
  }
  col += u_mood * (0.05 + 0.18 * f) * 0.6;
  vec2 pp = (u_ptr * u_res - 0.5 * u_res) / u_res.y / u_zoom;
  col += u_c3 * 0.018 / (0.04 + length(p - pp)) * u_bright;
  col *= u_bright * (1.0 + u_bloom * 0.35);
  col *= smoothstep(1.35, 0.25, length(p * vec2(0.75, 1.0)));
  col = col / (1.0 + col * 0.35);
  col += (hash(gl_FragCoord.xy + fract(u_time)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export class Tapestry {
  constructor(canvas) {
    this.canvas = canvas;
    this.scale = 0.5;
    this.flowT = 0;
    this.rip = new Float32Array(18).fill(-1);
    this.ripIdx = 0;
    this.cur = { c0: [0, 0, 0], c1: [0, 0, 0], c2: [0, 0, 0], c3: [0, 0, 0], style: [1, 0, 0, 0] };
    this.target = null;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) { this.ctx2d = canvas.getContext('2d'); return; }
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      this.prog = prog;
    } catch (e) {
      console.warn('[Aetheria] tapestry shader failed, using 2D fallback', e);
      this.gl = null;
      return;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['u_res', 'u_time', 'u_flow', 'u_c0', 'u_c1', 'u_c2', 'u_c3', 'u_mood', 'u_bright', 'u_style', 'u_ptr', 'u_rip', 'u_bloom', 'u_zoom', 'u_grav'])
      this.u[n] = gl.getUniformLocation(this.prog, n);
  }

  setTheme(theme, instant = false) {
    const cols = theme.shader.map((h) => hexToRgb(h).map((v) => v / 255));
    const style = [0, 0, 0, 0]; style[theme.style] = 1;
    this.target = { c0: cols[0], c1: cols[1], c2: cols[2], c3: cols[3], style };
    if (instant) for (const k of Object.keys(this.target)) this.cur[k] = [...this.target[k]];
  }

  resize(W, H) {
    const area = W * H;
    // base resolution by screen size, times the adaptive quality factor (main.js governor)
    this.scale = (area > 2.5e6 ? 0.4 : area > 1.2e6 ? 0.5 : 0.65) * (app.qualityScale ?? 1);
    this.canvas.width = Math.max(2, Math.round(W * this.scale));
    this.canvas.height = Math.max(2, Math.round(H * this.scale));
    if (this.gl) this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  ripple(x, y) {
    const i = this.ripIdx = (this.ripIdx + 1) % 6;
    this.rip[i * 3] = x / app.W; this.rip[i * 3 + 1] = 1 - y / app.H; this.rip[i * 3 + 2] = 0;
  }

  render(dt, s) {
    // ease palette toward the active theme
    const a = alphaFor(dt, 0.8);
    if (this.target) for (const k of Object.keys(this.target)) for (let i = 0; i < this.target[k].length; i++) this.cur[k][i] += (this.target[k][i] - this.cur[k][i]) * a;
    for (let i = 0; i < 6; i++) if (this.rip[i * 3 + 2] >= 0) this.rip[i * 3 + 2] += dt;
    this.flowT += dt * s.flow;

    const gl = this.gl, c = this.cur;
    if (!gl) return this._render2d(c);
    const u = this.u;
    gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_time, app.t);
    gl.uniform1f(u.u_flow, this.flowT);
    gl.uniform3fv(u.u_c0, c.c0); gl.uniform3fv(u.u_c1, c.c1); gl.uniform3fv(u.u_c2, c.c2); gl.uniform3fv(u.u_c3, c.c3);
    gl.uniform3f(u.u_mood, s.mood[0] / 255, s.mood[1] / 255, s.mood[2] / 255);
    gl.uniform1f(u.u_bright, s.bright);
    gl.uniform4fv(u.u_style, c.style);
    gl.uniform2f(u.u_ptr, s.ptrX / app.W, 1 - s.ptrY / app.H);
    gl.uniform3fv(u.u_rip, this.rip);
    gl.uniform1f(u.u_bloom, s.bloom);
    gl.uniform1f(u.u_zoom, s.zoom);
    gl.uniform2f(u.u_grav, app.gravity.x, app.gravity.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _render2d(c) {
    const ctx = this.ctx2d; if (!ctx) return;
    const w = this.canvas.width, h = this.canvas.height;
    const col = (v) => `rgb(${v.map((x) => (x * 255) | 0).join(',')})`;
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    g.addColorStop(0, col(c.c2)); g.addColorStop(0.5, col(c.c1)); g.addColorStop(1, col(c.c0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}
