/* GreenLight Motion — the scene kit, loaded into every scene page before its own scripts.
 *
 * A scene is any HTML page: HTML, CSS, SVG, canvas, WebGL (window.THREE, three.js, when the page uses it). The page
 * clock (clock.js) makes every animation frame-exact, so the page animates the way any web page does: CSS keyframes and
 * transitions, the Web Animations API, requestAnimationFrame, timers.
 *
 * What the kit adds (from window.__glScene, which the tools write: { theme, images, params, duration, frame }):
 *   · the film's colours and font as CSS variables on :root: --gl-bg, --gl-ink, --gl-acc … (every theme token) and
 *     --gl-font; window.__glSetTheme(theme) changes them live
 *   · pictures: <img data-image="logo"> (or any element: its background) gets the scene's picture "logo" — the tools map
 *     the keys to files wherever the film plays; window.glImage(key) → its URL
 *   · the agent's controls for the preview: elements with data-ui-label="Headline" are listed as panels; `params`
 *     (declared with GLScene) are the scene's effect controls
 *   · GLScene({ duration, params, setup(ctx), draw(t, ctx) }) — optional, for scenes drawn in code (canvas, WebGL):
 *     draw(t) is called with the scene's time, setup(ctx) once (again after a theme change or a `rebuild` param).
 *     ctx = { THREE, renderer (a WebGLRenderer on a full-frame canvas, made on first use), W, H, P (the params), state,
 *     color(token) → THREE.Color, css(token, alpha%), ease(name)(u), tween(t, t0, t1, a, b, ease), random(seed),
 *     image(key), load(key | url) → Promise<THREE.Texture> }
 */
(function () {
'use strict';
const W0 = window;
if (W0.__glKit) return;
W0.__glKit = true;
const doc = W0.document;
const boot = W0.__glScene || {};
let theme = boot.theme || { tokens: {}, font: null };
let images = boot.images || {};
const frameW = (boot.frame && boot.frame.w) || 1920, frameH = (boot.frame && boot.frame.h) || 1080;
const pending = new Set();

// ── the film's colours and font ──
const applyTheme = () => {
  const root = doc.documentElement.style;
  for (const [k, v] of Object.entries(theme.tokens || {})) root.setProperty('--gl-' + k, v);
  if (theme.font && theme.font.stack) root.setProperty('--gl-font', theme.font.stack);
  if (theme.font && theme.font.url && !doc.querySelector(`link[data-gl-font="${theme.font.url}"]`)) {
    const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = theme.font.url; l.setAttribute('data-gl-font', theme.font.url);
    pending.add(new Promise((ok) => { l.onload = () => (doc.fonts ? doc.fonts.ready.then(ok, ok) : ok()); l.onerror = ok; setTimeout(ok, 8000); }));
    (doc.head || doc.documentElement).appendChild(l);
  }
};
// ── pictures ──
// a picture's own src is kept the first time one of the scene's pictures replaces it (dropping that picture puts it back)
const keepPic = (el, v) => { if (W0.__glKeep) W0.__glKeep(el, 'image', v); };
const applyImages = () => {
  for (const el of doc.querySelectorAll('[data-image]')) {
    const url = images[el.getAttribute('data-image')];
    const kind = el.tagName === 'IMG' ? 'img' : el.tagName.toLowerCase() === 'image' ? 'svg' : 'bg';
    const now = kind === 'img' ? el.getAttribute('src') : kind === 'svg' ? el.getAttribute('href') : el.style.backgroundImage;
    const back = ((W0.__glOriginal && W0.__glOriginal(el)) || {}).image;
    if (!url) {
      if (back != null && now !== back) { if (kind === 'img') el.setAttribute('src', back); else if (kind === 'svg') el.setAttribute('href', back); else el.style.backgroundImage = back; }
      continue;
    }
    keepPic(el, now || '');
    if (kind === 'img') { if (el.getAttribute('src') !== url) { el.src = url; if (!el.complete) pending.add(new Promise((ok) => { el.onload = el.onerror = ok; })); } }
    else if (kind === 'svg') el.setAttribute('href', url);
    else el.style.backgroundImage = `url("${String(url).replace(/"/g, '%22')}")`;
  }
};
W0.glImage = (key) => images[key] || null;
applyTheme();
// the agent's panels: elements it named for the user (data-ui-label), listed by the preview
const defs = () => ({
  duration: scene ? scene.duration : boot.duration || null, params: scene ? scene.defs : {},
  elements: [...doc.querySelectorAll('[data-ui-label]')].map((el) => ({ id: el.getAttribute('data-gl'), label: el.getAttribute('data-ui-label'), controls: (el.getAttribute('data-ui') || '').split(',').map((s) => s.trim()).filter(Boolean) })).filter((e) => e.id),
});
const onReady = () => { applyImages(); W0.__glSceneDefs = defs(); };
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', onReady); else onReady();
W0.__glSetTheme = (th) => { theme = th || theme; applyTheme(); if (scene) scene.rebuild(); };
W0.__glSetImages = (im) => { images = im || {}; applyImages(); if (scene) scene.rebuild(); };
W0.__glWait = () => (pending.size ? Promise.all([...pending]).then(() => undefined) : Promise.resolve());

// ── time: window.__glSeek(t) (seconds), the one entry every host uses ──
// On the scene's own clock it steps the clock to t at 60 frames a second, so scripts that keep state from frame to
// frame see every frame; going back jumps (the player reloads the page first for an exact frame). A page that draws
// any moment directly (GLScene, a library item) replaces it and sets __glStateless. Under a host's clock (the Video
// Editor bakes its clips on its own) this does nothing: the host steps the page.
const STEP = 1000 / 60;
if (W0.__glClockFromScene && W0.__glHtmlClipSeek) {
  const clipSeek = W0.__glHtmlClipSeek;
  let nowMs = 0, driven = false;
  W0.__glHtmlClipSeek = (ms, o) => { driven = true; nowMs = Math.max(0, Number(ms) || 0); return clipSeek(ms, o); };
  const stepTo = async (ms) => {
    if (ms < nowMs) { nowMs = ms; return clipSeek(ms); }
    while (nowMs + STEP < ms - 0.01) { nowMs += STEP; await clipSeek(nowMs, { media: false }); }
    nowMs = ms; return clipSeek(ms);
  };
  let queue = Promise.resolve();
  W0.__glSeek = (t) => { driven = true; const ms = Math.max(0, Number(t) || 0) * 1000; queue = queue.then(() => W0.__glWait()).then(() => stepTo(ms)); return queue; };
  W0.__glTime = () => nowMs / 1000;
  W0.__glMarkDriven = () => { driven = true; };
  // opened on its own (no host seeks it within two frames): play in real time
  if (!boot.hosted && W0.__glNativeRaf) {
    let start = null;
    const tick = (ts) => { if (driven) return; if (start === null) start = ts; clipSeek(ts - start); W0.__glNativeRaf(tick); };
    W0.__glNativeRaf(() => W0.__glNativeRaf((ts) => { if (!driven) tick(ts); }));
  }
}

// ── GLScene: a scene drawn in code ──
const bez = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (u) => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    let t = u; for (let i = 0; i < 8; i++) { const e = X(t) - u; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let a = 0, b = 1; t = u; for (let i = 0; i < 40; i++) { const x = X(t); if (Math.abs(x - u) < 1e-6) break; if (x < u) a = t; else b = t; t = (a + b) / 2; }
    return Y(t);
  };
};
const EASE = {
  linear: (u) => u, spring: bez(0.28, 0.3495, 0.1369, 1), smooth: bez(0.374, 0.0291, 0.1826, 1), pop: bez(0.2888, 0.351, 0.1271, 1.1633),
  out: bez(0.215, 0.61, 0.355, 1), in: bez(0.55, 0.055, 0.675, 0.19), inOut: bez(0.645, 0.045, 0.355, 1), expoOut: bez(0.16, 1, 0.3, 1),
};
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const mulberry = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hex = (c) => { const s = String(c || '#000').trim(); if (/^#[0-9a-f]{3}$/i.test(s)) return '#' + s.slice(1).split('').map((x) => x + x).join(''); return s.slice(0, 7); };
const rgba = (c, a) => { const h = hex(c); const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
let scene = null;

W0.GLScene = function GLScene(def) {
  const defsP = def.params || {};
  const P = {};
  const fill = (vals) => { for (const [n, d] of Object.entries(defsP)) P[n] = d && d.default !== undefined ? d.default : null; Object.assign(P, vals || {}); };
  fill(boot.params);
  const duration = Number(boot.duration) > 0 ? Number(boot.duration) : Number(def.duration) > 0 ? Number(def.duration) : 4;
  const THREE = W0.THREE;
  const tokens = () => theme.tokens || {};
  let renderer = null, state = null, cur = 0, broken = null;
  const ctx = {
    THREE, W: frameW, H: frameH, P, duration,
    get state() { return state; },
    get renderer() {
      if (renderer || !THREE) return renderer;
      const cv = doc.createElement('canvas'); cv.id = 'gl-canvas';
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;';
      doc.body.insertBefore(cv, doc.body.firstChild);
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(2, W0.devicePixelRatio || 1));
      renderer.setSize(frameW, frameH, false);
      renderer.setClearColor(0x000000, 0);
      return renderer;
    },
    color: (name) => (THREE ? new THREE.Color(hex(tokens()[name] || name)) : hex(tokens()[name] || name)),
    css: (name, alpha) => (alpha != null && alpha < 100 ? rgba(tokens()[name] || name, alpha / 100) : (tokens()[name] || name)),
    ease: (name) => (typeof name === 'function' ? name : EASE[name] || EASE.spring),
    tween: (t, t0, t1, a, b, e) => a + (b - a) * ctx.ease(e)(clamp01((t - t0) / ((t1 - t0) || 1e-6))),
    random: (seed) => mulberry(seed == null ? 1 : seed),
    image: (key) => images[key] || null,
    load: (key) => {
      const url = images[key] || key;
      if (!THREE) return Promise.reject(new Error('no THREE'));
      const p = new Promise((ok, bad) => new THREE.TextureLoader().load(url, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; ok(tx); }, undefined, bad));
      pending.add(p.catch(() => null)); return p;
    },
  };
  const fail = (e) => {
    broken = e; console.error('[GLScene]', e);
    let box = doc.getElementById('gl-error');
    if (!box) { box = doc.createElement('pre'); box.id = 'gl-error'; box.style.cssText = 'position:fixed;left:16px;top:16px;z-index:99;color:#ff4d4f;font:14px/1.4 sans-serif;white-space:pre-wrap;max-width:80%'; doc.body.appendChild(box); }
    box.textContent = 'Scene error: ' + (e && e.message ? e.message : e);
  };
  const build = () => {
    try { if (state && typeof state.dispose === 'function') state.dispose(); state = typeof def.setup === 'function' ? def.setup(ctx) || {} : {}; broken = null; } catch (e) { fail(e); }
  };
  const draw = (t) => { cur = Math.max(0, Math.min(duration, t)); if (broken) return; try { if (typeof def.draw === 'function') def.draw(cur, ctx); } catch (e) { fail(e); } };
  scene = { duration, defs: defsP, rebuild: () => { build(); draw(cur); } };
  build(); draw(0);
  W0.__glSceneDefs = defs();
  // it draws any moment directly: the player (and a render) seek it without stepping the clock
  W0.__glSeek = (t) => { if (W0.__glMarkDriven) W0.__glMarkDriven(); draw(t); return W0.__glWait().then(() => draw(t)); };
  W0.__glStateless = true;
  W0.__glSetParams = (vals) => {
    const before = Object.assign({}, P); fill(vals);
    if (Object.entries(defsP).some(([n, d]) => d && d.rebuild && before[n] !== P[n])) build();
    draw(cur);
  };
  // played on its own (a Video Editor clip, a plain browser): the clock's frames drive it
  const frame = (ts) => { draw(ts / 1000); W0.requestAnimationFrame(frame); };
  W0.requestAnimationFrame(frame);
  return ctx;
};
})();
