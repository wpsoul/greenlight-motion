/* GL Motion — the 3D engine's scene runtime. A 3D-engine film is a list of HTML scenes: pages the agent writes
 * (any HTML / CSS / JS, three.js for real 3D). Every scene page loads this runtime and describes itself once:
 *
 *   MUScene({
 *     duration: 4,                                  // seconds (the scenario's scene duration wins)
 *     params: { glow: { label: 'Glow', type: 'slider', min: 0, max: 2, step: 0.05, default: 0.8 } },
 *     setup(ctx) { … build the scene … return state },   // once — again after a theme change or a `rebuild` param
 *     draw(t, ctx) { … },                           // every frame: t = seconds into the scene, a pure function of t
 *   });
 *
 * ctx = { THREE, renderer (a WebGLRenderer on a full-frame canvas, made on first use), W, H, P (the params), state,
 *         color(token) → THREE.Color, css(token, alpha%) → CSS colour, ease(name)(u), tween(t, t0, t1, a, b, ease),
 *         random(seed) → () => 0…1 (seeded), image(key) → the scene's picture URL, load(key | url) → Promise<THREE.Texture>
 *         (renders wait for it) }
 * Pictures come from the scene's `images` in scenario.json (key → file): ctx.image('logo'), or <img data-image="logo">
 * in the page — the tools map them wherever the film plays (a board, a file, an artifact).
 * Colours are the film's tokens (ink, card, panel, acc, muted, line, soft, dim, shade, white, bg, inv, bad…) with the
 * user's edits applied; the page also gets them as CSS variables (--mu-ink, --mu-acc …) and the font as --mu-font.
 * Elements with data-ui-id (and data-ui="text,color,size", data-ui-label="Title") are editable in the preview.
 *
 * The host (lib/scene-host.js, a render, the Video Editor's HTML clip) drives time with window.__glSeek(t); without
 * one, the scene plays on its own clock. Frames must be a pure function of t: no Date, no Math.random, no timers.
 */
(function () {
'use strict';
const W0 = typeof window !== 'undefined' ? window : globalThis;
if (W0.MUScene) return;
// the kit's springs and a few classics (cubic-bezier)
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

W0.MUScene = function MUScene(def) {
  const doc = W0.document;
  const host = W0.__muScene || {};
  const defs = def.params || {};
  const P = {};
  const fillParams = (vals) => { for (const [n, d] of Object.entries(defs)) P[n] = d && d.default !== undefined ? d.default : null; Object.assign(P, vals || {}); };
  fillParams(host.params);
  let theme = host.theme || { tokens: {}, font: null };
  let edits = host.edits || {};
  let images = host.images || {};
  const duration = Number(host.duration) > 0 ? Number(host.duration) : Number(def.duration) > 0 ? Number(def.duration) : 4;
  const W = (host.frame && host.frame.w) || W0.innerWidth || 1920, H = (host.frame && host.frame.h) || W0.innerHeight || 1080;
  const pending = new Set();
  let renderer = null, state = null, cur = 0, manual = false, broken = null;
  const THREE = W0.THREE;

  // the film's colours and font on :root, for the page's own CSS
  const applyTheme = () => {
    const root = doc.documentElement.style;
    for (const [k, v] of Object.entries(theme.tokens || {})) root.setProperty('--mu-' + k, v);
    if (theme.font && theme.font.stack) root.setProperty('--mu-font', theme.font.stack);
    if (theme.font && theme.font.url && !doc.querySelector('link[data-mu-font]')) {
      const l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = theme.font.url; l.dataset.muFont = '1';
      pending.add(new Promise((ok) => { l.onload = () => (doc.fonts ? doc.fonts.ready.then(ok, ok) : ok()); l.onerror = ok; setTimeout(ok, 8000); }));
      doc.head.appendChild(l);
    }
  };
  // the scene's pictures: <img data-image="key"> (or any element: its background)
  const applyImages = () => {
    for (const el of doc.querySelectorAll('[data-image]')) {
      const url = images[el.getAttribute('data-image')]; if (!url) continue;
      if (el.tagName === 'IMG') { if (el.getAttribute('src') !== url) { el.src = url; if (!el.complete) pending.add(new Promise((ok) => { el.onload = el.onerror = ok; })); } }
      else el.style.backgroundImage = `url("${String(url).replace(/"/g, '%22')}")`;
    }
  };
  // the user's edits on the page's editable elements (data-ui-id)
  const applyEdits = () => {
    for (const el of doc.querySelectorAll('[data-ui-id]')) {
      const id = el.getAttribute('data-ui-id');
      if (el.__muOrig == null) {
        const cs = W0.getComputedStyle(el);   // the page's own look, before any edit (the preview's "agent value")
        el.__muOrig = { text: el.textContent, color: el.style.color, size: el.style.fontSize, weight: el.style.fontWeight, upper: el.style.textTransform,
          ccolor: cs.color, csize: parseFloat(cs.fontSize) || null };
      }
      const t = edits.text && Object.prototype.hasOwnProperty.call(edits.text, id) ? edits.text[id] : null;
      el.textContent = t != null ? String(t) : el.__muOrig.text;
      const st = (edits.style && edits.style[id]) || {};
      el.style.color = st.color != null ? (theme.tokens[st.color] || st.color) : el.__muOrig.color;
      el.style.fontSize = st.size != null ? st.size + 'px' : el.__muOrig.size;
      el.style.fontWeight = st.weight != null ? String(st.weight) : el.__muOrig.weight;
      el.style.textTransform = st.upper != null ? (st.upper ? 'uppercase' : 'none') : el.__muOrig.upper;
    }
  };
  const tokens = () => theme.tokens || {};
  const ctx = {
    THREE, W, H, P,
    get state() { return state; },
    get renderer() {
      if (renderer || !THREE) return renderer;
      const cv = doc.createElement('canvas'); cv.id = 'mu-gl';
      cv.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:0;pointer-events:none;';
      doc.body.insertBefore(cv, doc.body.firstChild);
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(Math.min(2, W0.devicePixelRatio || 1));
      renderer.setSize(W, H, false);
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
    duration,
  };
  const fail = (e) => {
    broken = e; console.error('[MUScene]', e);
    let box = doc.getElementById('mu-error');
    if (!box) { box = doc.createElement('pre'); box.id = 'mu-error'; box.style.cssText = 'position:fixed;left:16px;top:16px;z-index:99;color:#ff4d4f;font:14px/1.4 sans-serif;white-space:pre-wrap;max-width:80%'; doc.body.appendChild(box); }
    box.textContent = 'Scene error: ' + (e && e.message ? e.message : e);
  };
  const build = () => {
    try {
      if (state && typeof state.dispose === 'function') state.dispose();
      state = typeof def.setup === 'function' ? def.setup(ctx) || {} : {};
      broken = null;
    } catch (e) { fail(e); }
  };
  const draw = (t) => {
    cur = Math.max(0, Math.min(duration, t));
    if (broken) return;
    try { if (typeof def.draw === 'function') def.draw(cur, ctx); } catch (e) { fail(e); }
  };
  const ready = () => (pending.size ? Promise.all([...pending]).then(() => undefined) : null);

  applyTheme(); applyImages(); applyEdits(); build();
  // what the preview can edit: the params, the page's data-ui elements, the length
  W0.__muSceneDefs = {
    duration, params: defs,
    elements: [...doc.querySelectorAll('[data-ui-id]')].map((el) => ({ id: el.getAttribute('data-ui-id'), label: el.getAttribute('data-ui-label') || el.getAttribute('data-ui-id'),
      controls: (el.getAttribute('data-ui') || 'text').split(',').map((s) => s.trim()).filter(Boolean), text: el.__muOrig ? el.__muOrig.text : el.textContent,
      color: el.__muOrig ? el.__muOrig.ccolor : null, size: el.__muOrig ? el.__muOrig.csize : null, image: el.getAttribute('data-image') || null })),
  };
  // the host's hooks: time, and live changes from the preview (params · theme · edits)
  W0.__glSeek = (t) => {
    manual = true; draw(t);
    const r = ready(); if (r) return r.then(() => draw(t));
    return undefined;
  };
  W0.__uikSeek = W0.__glSeek;
  W0.__uikDuration = duration;
  W0.__muSet = (o) => {
    let rebuild = false;
    if (o.theme) { theme = o.theme; applyTheme(); rebuild = true; }
    if (o.edits) { edits = o.edits; applyEdits(); }
    if (o.images && JSON.stringify(o.images) !== JSON.stringify(images)) { images = o.images; applyImages(); rebuild = true; }
    if (o.params) {
      const before = Object.assign({}, P); fillParams(o.params);
      for (const [n, d] of Object.entries(defs)) if (d && d.rebuild && before[n] !== P[n]) rebuild = true;
    }
    if (rebuild) build();
    draw(cur);
  };
  // no host driving it: play on the page's clock (the Video Editor's HTML clip clock is the clip time)
  const t0 = { v: null };
  const frame = (ts) => {
    if (!manual) {
      if (t0.v === null) t0.v = ts;
      draw(W0.__glHtmlClipClockInstalled ? ts / 1000 : (ts - t0.v) / 1000);
    }
    W0.requestAnimationFrame(frame);
  };
  draw(0);
  W0.requestAnimationFrame(frame);
  W0.__muSceneReady = true;
  return ctx;
};
})();
