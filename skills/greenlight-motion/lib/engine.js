/* GreenLight Motion — the library's engine: it draws every library scene as DOM (each scene's own page, the lab, the
 * Presets tab in GreenLight Dash).
 *
 * A library scene is a tree of layers:
 *   rect / ellipse      → a box (border radius) or an ellipse; a picture fills it
 *   text                → words (reveal = typewriter, counters and timers)
 *   path / icon / cursor→ an SVG line or shape, an icon, the pointer
 *   group               → its children, moved, faded, blurred or clipped together
 * Every animated value is a keyframe TRACK of segments [t0, t1, value, easing]: hold the previous
 * value until t0, ease to `value` by t1, with an easing by name (window.UIK_EASINGS). Frames are a pure
 * function of t — no timers, no CSS transitions — so any frame draws on its own.
 */
(function () {
'use strict';
const K = window.UIK = window.UIK || {};
K.elements = [];
// each element remembers its source file (a <script src> load) — the HTML export inlines that file

// ───────────────────────── canvas layers ─────────────────────────
// Content drawn by code (a gallery written as plain canvas drawing): canvas({ w, h, start, images,
// draw(ctx, { width, height, t, images, scale }) }) — draw is a pure function of t (seconds since
// `start`, never below 0); `images` are the layer's pictures as { img, loaded, failed } entries. K.media.scale
// lowers the canvas resolution (galleries of small previews); renders await K.media.ready() before a frame.
K.media = {
  cache: new Map(), pending: new Set(), scale: 1,
  get(url) {
    if (!url) return null;
    let e = K.media.cache.get(url);
    if (!e) {
      const img = new Image();   // no crossOrigin: pages opened as files load their pictures too
      e = { img, loaded: false, failed: false };
      e.ready = new Promise((ok) => { img.onload = () => { e.loaded = true; ok(e); }; img.onerror = () => { e.failed = true; ok(e); }; });
      img.src = url;
      K.media.cache.set(url, e); K.media.pending.add(e.ready);
    }
    return e;
  },
  ready: () => Promise.all([...K.media.pending]).then(() => undefined),
};
K.define = (spec) => {
  const cs = typeof document !== 'undefined' ? document.currentScript : null;
  if (cs && cs.src && !spec.file) spec.file = cs.src.split('/').pop().split('?')[0];
  // an inlined script (a standalone page) names its file in data-mu-src
  if (cs && !spec.file && cs.dataset && cs.dataset.muSrc) spec.file = cs.dataset.muSrc;
  if (!spec.file && K.__loadingFile) spec.file = K.__loadingFile;   // node loaders set this per file
  K.elements.push(spec);
};

// ───────────────────────── easing (by name: window.UIK_EASINGS) ─────────────────────────
const bezier = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t;
  const dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (u) => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    let t = u;
    for (let i = 0; i < 8; i++) { const e = X(t) - u; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; }
    let a = 0, b = 1; t = u;
    for (let i = 0; i < 40; i++) { const x = X(t); if (Math.abs(x - u) < 1e-6) break; if (x < u) a = t; else b = t; t = (a + b) / 2; }
    return Y(t);
  };
};
const EZ_CACHE = {};
K.ease = (name) => {
  if (EZ_CACHE[name]) return EZ_CACHE[name];
  const c = (window.UIK_EASINGS || {})[name];
  let f;
  if (name === 'Hold') f = (u) => (u >= 1 ? 1 : 0);
  else if (!c || name === 'Linear') {
    if (!c && name !== 'Linear') console.warn('[uik] unknown easing', name);
    f = (u) => u;
  } else if (c.b) f = bezier(c.b[0], c.b[1], c.b[2], c.b[3]);
  else {
    const s = c.s, n = s.length - 1;
    f = (u) => { if (u <= 0) return 0; if (u >= 1) return 1; const x = u * n, i = Math.floor(x); return s[i] + (s[i + 1] - s[i]) * (x - i); };
  }
  return (EZ_CACHE[name] = f);
};

// ───────────────────────── colour + theme tokens ─────────────────────────
K.THEMES = {
  light: { bg: '#E9E7E2', card: '#FFFFFF', panel: '#F4F2EE', ink: '#0B0B0B', inv: '#FFFFFF', muted: '#8A8782',
           line: '#E2DFD9', skel: '#E6E3DE', soft: '#F1EFEB', dim: '#D6D3CE', acc: '#FF5A1F', bad: '#E5484D', shade: '#0B0B0B', white: '#FFFFFF', shadow: '20,18,14' },
  dark:  { bg: '#121211', card: '#1D1C1A', panel: '#191816', ink: '#F4F2EE', inv: '#0B0B0B', muted: '#8F8B84',
           line: '#2E2C29', skel: '#292724', soft: '#242320', dim: '#3A3835', acc: '#FF5A1F', bad: '#FF6369', shade: '#000000', white: '#FFFFFF', shadow: '0,0,0' },
};
K.ACCENTS = ['#FF5A1F', '#3E63DD', '#12A594', '#8E4EC6', '#E5484D'];
let THEME = Object.assign({}, K.THEMES.light), THEME_V = 1;
// colors: the film's own values for tokens ({ ink: '#111', card: '#FFF4E0' } — scenario.colors)
K.setTheme = (name, accent, colors) => {
  THEME = Object.assign({}, K.THEMES[name] || K.THEMES.light);
  if (accent) THEME.acc = accent;
  for (const [k, v] of Object.entries(colors || {})) if (k !== 'shadow' && Object.prototype.hasOwnProperty.call(THEME, k) && typeof v === 'string' && v) THEME[k] = v;
  THEME_V++;
};
K.theme = () => THEME;
K.TOKENS = Object.keys(K.THEMES.light).filter((k) => k !== 'shadow');

// ───────────────────────── fonts ─────────────────────────
// The stage font is Helvetica Neue (the library's scenes are measured in it). A film may pick another (scenario.font):
// a web font loads from Google Fonts (renders wait for it); After Effects needs it installed (ps = its PostScript family).
K.FONT_DEFAULT = 'Helvetica Neue';
K.FONTS = {
  'Helvetica Neue': { stack: "'Helvetica Neue', Helvetica, Arial, sans-serif", ps: 'HelveticaNeue', note: 'the library’s own type' },
  Inter: { stack: "Inter, 'Helvetica Neue', Arial, sans-serif", google: 'Inter:wght@300..800', ps: 'Inter' },
  Geist: { stack: "Geist, 'Helvetica Neue', Arial, sans-serif", google: 'Geist:wght@300..800', ps: 'Geist' },
  Manrope: { stack: "Manrope, 'Helvetica Neue', Arial, sans-serif", google: 'Manrope:wght@300..800', ps: 'Manrope' },
  'DM Sans': { stack: "'DM Sans', 'Helvetica Neue', Arial, sans-serif", google: 'DM+Sans:opsz,wght@9..40,300..800', ps: 'DMSans' },
  Fraunces: { stack: 'Fraunces, Georgia, serif', google: 'Fraunces:opsz,wght@9..144,300..800', ps: 'Fraunces' },
  // display faces for brand-new films (references/original-films.md): big type with a character of its own
  'Space Grotesk': { stack: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif", google: 'Space+Grotesk:wght@300..700', ps: 'SpaceGrotesk' },
  'Bricolage Grotesque': { stack: "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif", google: 'Bricolage+Grotesque:opsz,wght@12..96,200..800', ps: 'BricolageGrotesque' },
  Syne: { stack: "Syne, 'Helvetica Neue', Arial, sans-serif", google: 'Syne:wght@400..800', ps: 'Syne' },
  Unbounded: { stack: "Unbounded, 'Helvetica Neue', Arial, sans-serif", google: 'Unbounded:wght@200..900', ps: 'Unbounded' },
  Sora: { stack: "Sora, 'Helvetica Neue', Arial, sans-serif", google: 'Sora:wght@100..800', ps: 'Sora' },
  Outfit: { stack: "Outfit, 'Helvetica Neue', Arial, sans-serif", google: 'Outfit:wght@100..900', ps: 'Outfit' },
  Archivo: { stack: "Archivo, 'Helvetica Neue', Arial, sans-serif", google: 'Archivo:wght@100..900', ps: 'Archivo' },
  'Instrument Sans': { stack: "'Instrument Sans', 'Helvetica Neue', Arial, sans-serif", google: 'Instrument+Sans:wght@400..700', ps: 'InstrumentSans' },
  'Playfair Display': { stack: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@400..900', ps: 'PlayfairDisplay' },
};
K.fontOf = (name) => K.FONTS[name] || K.FONTS[K.FONT_DEFAULT];
K.fontUrl = (name) => { const f = K.FONTS[name]; return f && f.google ? `https://fonts.googleapis.com/css2?family=${f.google}&display=block` : null; };
// a browser page: the font's stylesheet once, its weights loaded before K.media.ready() resolves (offline → the fallback)
K.useFont = (name) => {
  const f = K.fontOf(name), url = K.fontUrl(name);
  if (!url || typeof document === 'undefined' || document.querySelector(`link[data-uik-font="${name}"]`)) return f.stack;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; link.dataset.uikFont = name;
  const family = name.includes(' ') ? `"${name}"` : name;
  K.media.pending.add(new Promise((ok) => {
    const done = () => (document.fonts && document.fonts.load
      ? Promise.all([300, 400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px ${family}`).catch(() => null))).then(() => ok(), () => ok())
      : ok());
    link.onload = done; link.onerror = () => ok();
    setTimeout(ok, 8000);
  }));
  document.head.appendChild(link);
  return f.stack;
};

const HEXC = {};
const parseColor = (c) => {
  if (c == null) return null;
  if (HEXC[c]) return HEXC[c];
  let r = 0, g = 0, b = 0, a = 1;
  if (c[0] === '#') {
    let h = c.slice(1);
    if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16) / 255;
  } else if (c === 'transparent') { a = 0; }
  else { const m = c.match(/[\d.]+/g) || []; r = +m[0] || 0; g = +m[1] || 0; b = +m[2] || 0; a = m[3] != null ? +m[3] : 1; }
  return (HEXC[c] = [r, g, b, a]);
};
// token ('ink'), token with alpha ('ink/40' = 40 %), or any CSS colour. `shade` stays dark in both
// themes — scrims, backdrops, crop dimming.
const resolve = (c) => {
  if (c == null) return null;
  if (typeof c !== 'string') return c;
  const sl = c.indexOf('/');
  if (sl > 0 && THEME[c.slice(0, sl)]) { const rgb = parseColor(THEME[c.slice(0, sl)]); return [rgb[0], rgb[1], rgb[2], rgb[3] * (+c.slice(sl + 1) / 100)]; }
  return parseColor(THEME[c] || c);
};
const css = (rgba) => (rgba ? `rgba(${Math.round(rgba[0])},${Math.round(rgba[1])},${Math.round(rgba[2])},${(+rgba[3]).toFixed(3)})` : 'transparent');
const mix = (a, b, u) => {
  if (!a) a = [b[0], b[1], b[2], 0]; if (!b) b = [a[0], a[1], a[2], 0];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
};

// ───────────────────────── icons (Lucide paths, ISC) ─────────────────────────
const CIRC = (cx, cy, r) => `M${cx} ${cy + r}a${r} ${r} 0 1 0 0-${2 * r} ${r} ${r} 0 0 0 0 ${2 * r}Z`;
K.ICONS = {
  arrow: ['M5 12h14', 'm12 5 7 7-7 7'], arrowUp: ['M12 19V5', 'm5 12 7-7 7 7'], arrowDown: ['M12 5v14', 'm19 12-7 7-7-7'],
  check: ['M20 6 9 17l-5-5'], x: ['M18 6 6 18', 'm6 6 12 12'], plus: ['M5 12h14', 'M12 5v14'], minus: ['M5 12h14'],
  chevronDown: ['m6 9 6 6 6-6'], chevronRight: ['m9 18 6-6-6-6'], chevronUp: ['m18 15-6-6-6 6'], chevronLeft: ['m15 18-6-6 6-6'],
  search: [CIRC(11, 11, 8), 'm21 21-4.3-4.3'],
  folder: ['M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z'],
  file: ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v4a2 2 0 0 0 2 2h4', 'M8 13h8', 'M8 17h5'],
  terminal: ['m4 17 6-6-6-6', 'M12 19h8'], clock: [CIRC(12, 12, 10), 'M12 6v6l4 2'],
  coin: [CIRC(12, 12, 10), 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 18V6'],
  chip: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M9 9h6v6H9z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M20 9h3', 'M20 14h3', 'M1 9h3', 'M1 14h3'],
  sparkle: ['M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  heart: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z'],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', CIRC(12, 7, 4)],
  users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', CIRC(9, 7, 4), 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'm22 6-10 7L2 6'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  play: ['M6 3l14 9-14 9V3z'], pause: ['M6 4h4v16H6z', 'M14 4h4v16h-4z'],
  calendar: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M16 2v4', 'M8 2v4', 'M3 10h18'],
  image: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z', CIRC(9, 9, 2), 'm21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21'],
  link: ['M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'],
  trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
  home: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'], trend: ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  sun: [CIRC(12, 12, 4), 'M12 2v2', 'M12 20v2', 'm4.93 4.93 1.41 1.41', 'm17.66 17.66 1.41 1.41', 'M2 12h2', 'M20 12h2', 'm6.34 17.66-1.41 1.41', 'm19.07 4.93-1.41 1.41'],
  pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', CIRC(12, 10, 3)],
  message: ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'], send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  zap: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'], shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z', CIRC(12, 12, 3)],
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54L22 3z'],
  command: ['M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3'],
  refresh: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  mic: ['M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z', 'M19 10v2a7 7 0 0 1-14 0v-2', 'M12 19v3'],
  globe: [CIRC(12, 12, 10), 'M2 12h20', 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  copy: ['M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Z', 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'],
  bag: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  volume: ['M11 5 6 9H2v6h4l5 4V5z', 'M15.54 8.46a5 5 0 0 1 0 7.07', 'M19.07 4.93a10 10 0 0 1 0 14.14'],
  flag: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'],
  info: [CIRC(12, 12, 10), 'M12 16v-4', 'M12 8h.01'],
  alert: ['M12 9v4', 'M12 17h.01', 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'],
  pencil: ['M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z', 'm15 5 4 4'],
  layers: ['m12 2 10 5-10 5L2 7l10-5Z', 'm2 17 10 5 10-5', 'm2 12 10 5 10-5'],
  video: ['m22 8-6 4 6 4V8Z', 'M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z'],
  cloud: ['M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z'],
  bookmark: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  settings: [CIRC(12, 12, 3), 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
  dot: [CIRC(12, 12, 1)],
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
  share: [CIRC(18, 5, 3), CIRC(6, 12, 3), CIRC(18, 19, 3), 'm8.59 13.51 6.83 3.98', 'm15.41 6.51-6.82 3.98'],
  archive: ['M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8', 'M10 12h4'],
  thumbsUp: ['M7 10v12', 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'],
  thumbsDown: ['M17 14V2', 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z'],
  card: ['M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z', 'M2 10h20'],
  maximize: ['M8 3H5a2 2 0 0 0-2 2v3', 'M21 8V5a2 2 0 0 0-2-2h-3', 'M3 16v3a2 2 0 0 0 2 2h3', 'M16 21h3a2 2 0 0 0 2-2v-3'],
  cube: ['M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z', 'm3.3 7 8.7 5 8.7-5', 'M12 22V12'],
};

// ───────────────────────── layer model ─────────────────────────
// numeric props with defaults; colour props; every one of them can carry a track in `k`
const NUM = { x: 0, y: 0, w: 0, h: 0, r: 0, opacity: 1, scale: 1, sx: 1, sy: 1, rot: 0, blur: 0, sw: 0,
              size: 40, ls: 0, trimS: 0, trimE: 100, trimO: 0, reveal: 1, value: 0 };
const COL = { fill: null, stroke: null, color: null };
K.PROPS = Object.keys(NUM).concat(Object.keys(COL));

// track normalisation: [init?, [t0,t1,v,ease?] | [t,v] …]  →  { init, segs:[{t0,t1,v,e}] }
const normTrack = (arr, prop) => {
  if (!Array.isArray(arr)) arr = [arr];
  const tr = { init: undefined, segs: [] };
  for (const s of arr) {
    if (!Array.isArray(s)) { tr.init = s; continue; }
    if (s.length === 2) tr.segs.push({ t0: s[0], t1: s[0], v: s[1], e: 'Hold' });
    else tr.segs.push({ t0: s[0], t1: s[1], v: s[2], e: s[3] || 'Power3 Out' });
  }
  tr.segs.sort((a, b) => a.t0 - b.t0);
  if (!(prop in NUM) && !(prop in COL) && !/^ph:[a-z0-9]{1,8}$/.test(prop)) console.warn('[uik] unknown animated prop', prop);
  return tr;
};
const isCol = (p) => p in COL;
// A segment that starts before the previous one ends INTERRUPTS it: it eases on from wherever the
// value had got to at its t0 (no jump).
const evalTrack = (tr, base, t, col) => {
  const segs = tr.segs;
  let from = col ? resolve(tr.init !== undefined ? tr.init : base) : (tr.init !== undefined ? tr.init : base);
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (t < s.t0) break;
    const to = col ? resolve(s.v) : s.v;
    const at = (tt) => {
      if (tt >= s.t1) return to;
      const u = K.ease(s.e)((tt - s.t0) / (s.t1 - s.t0));
      return col ? mix(from, to, u) : from + (to - from) * u;
    };
    const next = segs[i + 1];
    if (next && next.t0 < s.t1 && t >= next.t0) { from = at(next.t0); continue; }
    if (t >= s.t1) { from = to; continue; }
    return at(t);
  }
  return from;
};

// internals the film runtime and the preview use (colours, tracks)
K._int = { normTrack, evalTrack, resolve, css, NUM, COL };

// ───────────────────────── authoring helpers (UIK.h) ─────────────────────────
const H = K.h = {};
const layer = (type) => (o = {}) => Object.assign({ type }, o);
H.rect = layer('rect');
H.ellipse = layer('ellipse');
H.circle = (o = {}) => Object.assign({ type: 'ellipse' }, o, { w: o.d ?? o.w, h: o.d ?? o.h ?? o.w });
H.text = layer('text');
H.path = layer('path');
H.icon = layer('icon');
H.group = layer('group');
H.cursor = layer('cursor');

// merge keyframe objects: tracks concatenate, the first `init` wins
H.k = (...parts) => {
  const out = {};
  for (const p of parts) {
    if (!p) continue;
    for (const key of Object.keys(p)) {
      const arr = Array.isArray(p[key]) ? p[key] : [p[key]];
      if (!out[key]) { out[key] = arr.slice(); continue; }
      const hasInit = out[key].length && !Array.isArray(out[key][0]);
      for (const s of arr) { if (!Array.isArray(s)) { if (!hasInit) out[key].unshift(s); } else out[key].push(s); }
    }
  }
  return out;
};
// the reference's content swap: enter waits `d`, then un-blurs + fades + settles from 94 %;
// exit blurs out fast. y/x: travel in from that offset (relative to the layer's base x/y — pass it).
H.enter = (t, o = {}) => {
  const d = o.d ?? 0.07, dur = o.dur ?? 0.3, a = t + d, b = a + dur, out = {
    opacity: [0, [a, b, 1, 'Power2 Out']],
  };
  if ((o.blur ?? 10) > 0) out.blur = [o.blur ?? 10, [a, b, 0, 'Power2 Out']];
  if ((o.s ?? 0.94) !== 1) out.scale = [o.s ?? 0.94, [a, b + 0.08, 1, 'Power3 Out']];
  if (o.dy) out.y = [(o.y0 ?? 0) + o.dy, [a, b + 0.08, o.y0 ?? 0, 'Power3 Out']];
  if (o.dx) out.x = [(o.x0 ?? 0) + o.dx, [a, b + 0.08, o.x0 ?? 0, 'Power3 Out']];
  return out;
};
H.exit = (t, o = {}) => {
  const dur = o.dur ?? 0.14, out = { opacity: [[t, t + dur, 0, 'Power2 In']] };
  if ((o.blur ?? 8) > 0) out.blur = [[t, t + dur, o.blur ?? 8, 'Power2 In']];
  if (o.s) out.scale = [[t, t + dur, o.s, 'Power2 In']];
  return out;
};
// scale pop from `from` with Back Out (10 % overshoot) — badges, dots, knobs
H.pop = (t, o = {}) => ({
  scale: [o.from ?? 0, [t, t + (o.dur ?? 0.42), o.to ?? 1, o.e || 'Back Out']],
  opacity: [0, [t, t + 0.12, 1, 'Power2 Out']],
});
// popIn = the main shape's intro: scale `from` → 1 with Back Out + a quick fade-in
H.popIn = (t, o = {}) => ({
  scale: [o.from ?? 0.6, [t, t + (o.dur ?? 0.52), 1, 'Back Out']],
  opacity: [0, [t, t + 0.12, 1, 'Linear']],
});
// fadeIn = enter without blur or settle — plain fade (labels, captions)
H.fadeIn = (t, dur = 0.3) => H.enter(t, { blur: 0, s: 1, dur });
// ring = circle path data starting at 12 o'clock, clockwise — for trimmed rings, spinners, dials
H.ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// spinner = a 30 % arc spinning between t0 and t1 (about one turn per 0.7 s)
H.spinner = (o) => H.path({ id: o.id, x: o.x || 0, y: o.y || 0, d: H.ring(o.R), stroke: o.color || 'ink', sw: o.sw || 4, trimmed: true, trimE: 30,
  k: H.k({ rot: [[o.t0, o.t1, 360 * Math.max(1, Math.round((o.t1 - o.t0) / 0.7)), 'Linear']] }, o.k) });
// invEase = the time fraction at which an easing reaches progress p; cross = the absolute time a
// segment eased from a→b over t0…t1 passes value v (switch something the moment a moving edge
// crosses it: a knob passing a bar, a playhead crossing a frame)
H.invEase = (name, p) => { const f = K.ease(name); let a = 0, b = 1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < p) a = m; else b = m; } return (a + b) / 2; };
H.cross = (t0, t1, a, b, v, e = 'Power2 Smooth') => +(t0 + (t1 - t0) * H.invEase(e, (v - a) / (b - a))).toFixed(3);
// digitCol = one rolling digit column: a clip window h tall holding `digits` stacked; animate the
// column with k: { y: [[t0, t1, -h * index, 'Power3 Out']] }
H.digitCol = (o) => H.rect({ id: o.id, x: o.x, y: o.y || 0, w: o.w, h: o.h, clip: true, ch: [
  H.group({ id: (o.id || 'digit') + 'Col', k: o.k, ch: o.digits.map((d, i) => H.text({ text: String(d), y: i * o.h, size: o.size, weight: o.weight || 600, color: o.color, tnum: false })) }),
] });
// rnd = deterministic 0…1 noise per index — frames must stay a pure function of t
H.rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
// press = a quick squeeze at a click (buttons, the shape under the cursor)
H.press = (t, o = {}) => ({ scale: [[t - 0.07, t, o.to ?? 0.96, 'Power2 Out'], [t + 0.02, t + 0.3, o.back ?? 1, 'Back Out']] });
// cursor: keys [[t,x,y],…] travel with Power2 Smooth on x and Sine Smooth on y (a slight human arc);
// a key may carry a 4th element — the easing of the leg ARRIVING at it (drags/flicks that must match
// the dragged layer's easing). clicks [t…] and drags [[t0,t1]…] squeeze it.
H.cursorLayer = (keys, clicks = [], drags = [], o = {}) => {
  const x = [keys[0][1]], y = [keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    const [t0, x0, y0] = keys[i - 1], [t1, x1, y1, e] = keys[i];
    if (x1 !== x0) x.push([t0, t1, x1, e || o.ex || 'Power2 Smooth']);
    if (y1 !== y0) y.push([t0, t1, y1, e || o.ey || 'Sine Smooth']);
  }
  const sc = [1];
  const ev = clicks.map((c) => [c - 0.07, c + 0.03]).concat(drags.map((d) => [d[0] - 0.06, d[1]])).sort((a, b) => a[0] - b[0]);
  for (const [a, b] of ev) sc.push([a, a + 0.07, 0.84, 'Power2 Out'], [b, b + 0.22, 1, 'Back Out']);
  const k = { x, y, scale: sc };
  if (o.inAt != null) k.opacity = [0, [o.inAt, o.inAt + 0.2, 1, 'Power2 Out']];
  return H.cursor({ id: 'cursor', x: keys[0][1], y: keys[0][2], size: o.size || 46, k: H.k(k, o.k) });
};
// sample: turn motion computed by a formula (a point on an ellipse, a value derived from another
// track) into the fewest Linear segments that stay within `tol` of it.
//   k: { x: [f(0), ...sample((t) => f(t), 0.4, 2.0, { tol: 1 })] }
H.sample = (f, t0, t1, o = {}) => {
  const tol = o.tol ?? 1, fps = o.fps ?? 60, n = Math.max(1, Math.ceil((t1 - t0) * fps));
  const ts = [], vs = [];
  for (let j = 0; j <= n; j++) { const t = t0 + (t1 - t0) * j / n; ts.push(t); vs.push(f(t)); }
  const segs = [];
  for (let i = 0; i < n;) {
    let j = i + 1;
    for (let jj = j + 1; jj <= n; jj++) {
      let ok = true;
      for (let q = i + 1; q < jj && ok; q++) ok = Math.abs(vs[i] + (vs[jj] - vs[i]) * (ts[q] - ts[i]) / (ts[jj] - ts[i]) - vs[q]) <= tol;
      if (!ok) break;
      j = jj;
    }
    segs.push([+ts[i].toFixed(3), +ts[j].toFixed(3), +vs[j].toFixed(2), 'Linear']);
    i = j;
  }
  return segs;
};
// valueAt: evaluate a numeric track array (the same shape as in `k`) at time t — for layers that
// follow another layer (edge fades that depend on a strip's x, a dot that rides a bar).
H.valueAt = (arr, base, t) => evalTrack(normTrack(arr, 'x'), base, t, false);
// stagger helper: n items, first at t, `gap` apart
H.stagger = (n, t, gap) => Array.from({ length: n }, (_, i) => t + i * gap);

// photo: a stand-in picture for galleries — an abstract composition in the kit's palette, clipped to
// a rounded box: ONE picture slot a film fills with its own picture (scene images). v picks the composition
// (0…PHOTO_N-1, wraps). Copies / tiles of the SAME picture (blinds, mosaic, lens) share `src: 'name'`, so one
// picture fills them all.
//   photo({ id, x, y, w, h, r, v, src, k, ch })   — any rect prop works (k tracks, pin, shadow…)
const f2 = (n) => +n.toFixed(1);
const PHOTOS = [
  // 0 sun over hills
  (w, h) => ({ bg: 'soft', ch: [
    H.circle({ x: f2(w * 0.2), y: f2(-h * 0.16), d: f2(Math.min(w, h) * 0.24), fill: 'acc' }),
    H.ellipse({ x: f2(-w * 0.25), y: f2(h * 0.5), w: f2(w * 1.3), h: f2(h * 0.75), fill: 'dim' }),
    H.ellipse({ x: f2(w * 0.35), y: f2(h * 0.62), w: f2(w * 1.2), h: f2(h * 0.7), fill: 'ink/70' }),
  ] }),
  // 1 mountains + moon
  (w, h) => ({ bg: 'skel', ch: [
    H.circle({ x: f2(-w * 0.24), y: f2(-h * 0.22), d: f2(Math.min(w, h) * 0.16), fill: 'card' }),
    H.path({ d: `M${f2(-w * 0.6)} ${f2(h * 0.5)} L${f2(-w * 0.12)} ${f2(-h * 0.14)} L${f2(w * 0.3)} ${f2(h * 0.5)} Z`, fill: 'ink/45' }),
    H.path({ d: `M${f2(-w * 0.2)} ${f2(h * 0.5)} L${f2(w * 0.24)} ${f2(-h * 0.02)} L${f2(w * 0.62)} ${f2(h * 0.5)} Z`, fill: 'ink/80' }),
  ] }),
  // 2 portrait
  (w, h) => ({ bg: 'dim', ch: [
    H.circle({ y: f2(-h * 0.1), d: f2(Math.min(w, h) * 0.34), fill: 'ink/75' }),
    H.ellipse({ y: f2(h * 0.46), w: f2(w * 0.78), h: f2(h * 0.56), fill: 'ink/75' }),
  ] }),
  // 3 city skyline
  (w, h) => ({ bg: 'soft', ch: [[-0.36, 0.5, 0.2], [-0.16, 0.72, 0.18], [0.03, 0.38, 0.16], [0.2, 0.62, 0.18], [0.38, 0.45, 0.16]].map(([x, hh, ww], i) =>
    H.rect({ x: f2(w * x), y: f2(h * 0.5), pin: 'b', w: f2(w * ww), h: f2(h * hh), r: 4, fill: ['ink/55', 'ink/80', 'ink/40', 'ink/70', 'ink/50'][i] })) }),
  // 4 circles
  (w, h) => ({ bg: 'ink', ch: [
    H.circle({ x: f2(-w * 0.14), y: f2(h * 0.02), d: f2(Math.min(w, h) * 0.56), fill: 'dim' }),
    H.circle({ x: f2(w * 0.16), y: f2(-h * 0.08), d: f2(Math.min(w, h) * 0.42), fill: 'acc' }),
    H.circle({ x: f2(w * 0.1), y: f2(h * 0.24), d: f2(Math.min(w, h) * 0.22), fill: 'card' }),
  ] }),
  // 5 waves
  (w, h) => ({ bg: 'panel', ch: [0, 1, 2].map((i) => {
    const y = h * (0.02 + i * 0.16), a = h * 0.08;
    return H.path({ d: `M${f2(-w * 0.55)} ${f2(y)} Q${f2(-w * 0.28)} ${f2(y - a)} 0 ${f2(y)} T${f2(w * 0.55)} ${f2(y)} L${f2(w * 0.55)} ${f2(h * 0.55)} L${f2(-w * 0.55)} ${f2(h * 0.55)} Z`, fill: ['ink/18', 'ink/40', 'ink/75'][i] });
  }) }),
  // 6 product bottle
  (w, h) => ({ bg: 'soft', ch: [
    H.ellipse({ y: f2(h * 0.38), w: f2(Math.min(w, h) * 0.5), h: f2(h * 0.07), fill: 'ink/12' }),
    H.rect({ y: f2(h * 0.06), w: f2(Math.min(w, h) * 0.3), h: f2(h * 0.62), r: f2(Math.min(w, h) * 0.06), fill: 'ink' }),
    H.rect({ y: f2(-h * 0.3), w: f2(Math.min(w, h) * 0.16), h: f2(h * 0.14), r: 4, fill: 'ink/70' }),
    H.rect({ y: f2(h * 0.1), w: f2(Math.min(w, h) * 0.3), h: f2(h * 0.12), fill: 'card' }),
  ] }),
  // 7 plant
  (w, h) => ({ bg: 'skel', ch: [
    H.ellipse({ x: f2(-w * 0.09), y: f2(-h * 0.1), w: f2(Math.min(w, h) * 0.2), h: f2(h * 0.4), rot: -28, fill: 'ink/55' }),
    H.ellipse({ x: f2(w * 0.09), y: f2(-h * 0.14), w: f2(Math.min(w, h) * 0.2), h: f2(h * 0.44), rot: 24, fill: 'ink/70' }),
    H.ellipse({ y: f2(-h * 0.2), w: f2(Math.min(w, h) * 0.16), h: f2(h * 0.4), fill: 'ink/45' }),
    H.path({ d: `M${f2(-w * 0.16)} ${f2(h * 0.12)} L${f2(w * 0.16)} ${f2(h * 0.12)} L${f2(w * 0.12)} ${f2(h * 0.42)} L${f2(-w * 0.12)} ${f2(h * 0.42)} Z`, fill: 'ink/85' }),
  ] }),
  // 8 arch
  (w, h) => ({ bg: 'dim', ch: [
    H.rect({ y: f2(h * 0.14), w: f2(w * 0.44), h: f2(h * 0.86), radii: `${f2(w * 0.22)}px ${f2(w * 0.22)}px 0 0`, fill: 'card' }),
    H.circle({ x: f2(w * 0.06), y: f2(h * 0.3), d: f2(Math.min(w, h) * 0.1), fill: 'ink/80' }),
    H.rect({ x: f2(w * 0.06), y: f2(h * 0.44), w: f2(Math.min(w, h) * 0.08), h: f2(h * 0.16), r: 6, fill: 'ink/80' }),
  ] }),
  // 9 stripes + dot
  (w, h) => ({ bg: 'card', ch: [
    ...[-0.3, -0.1, 0.1, 0.3].map((x) => H.rect({ x: f2(w * x), w: f2(w * 0.08), h: f2(h * 1.6), rot: 20, fill: 'ink/10' })),
    H.circle({ x: f2(w * 0.18), y: f2(-h * 0.12), d: f2(Math.min(w, h) * 0.3), fill: 'ink' }),
  ] }),
];
K.PHOTO_N = PHOTOS.length;
// named stand-ins for product screens — v: 'desktop' (an app window: sidebar, header, stat cards, a
// chart) and v: 'phone' (a phone app: header, hero card, list, tab bar). They sit outside the numeric
// cycle, so items that wrap v over PHOTO_N keep their pictures.
const SCREENS = {
  desktop: (w, h) => {
    const L = -w / 2 + w * 0.22, R = w / 2 - w * 0.04, cw = R - L, gap = w * 0.02, sw = (cw - 2 * gap) / 3, rr = f2(h * 0.03);
    const bars = [0.42, 0.66, 0.5, 0.82, 0.58, 0.74, 0.9];
    const bw = (cw - w * 0.08) / bars.length;
    return { bg: 'card', ch: [
      H.rect({ x: f2(-w / 2 + w * 0.09), w: f2(w * 0.18), h: f2(h * 1.02), fill: 'panel' }),
      H.rect({ x: f2(-w / 2 + w * 0.055), y: f2(-h / 2 + h * 0.09), w: f2(w * 0.035), h: f2(w * 0.035), r: f2(w * 0.009), fill: 'ink' }),
      ...[0, 1, 2, 3].map((i) => H.rect({ x: f2(-w / 2 + w * 0.09), y: f2(-h / 2 + h * (0.24 + i * 0.09)), w: f2(w * 0.11), h: f2(h * 0.03), r: f2(h * 0.015), fill: i === 0 ? 'ink/70' : 'skel' })),
      H.rect({ x: f2(L + w * 0.1), y: f2(-h / 2 + h * 0.1), w: f2(w * 0.2), h: f2(h * 0.045), r: f2(h * 0.02), fill: 'ink/80' }),
      H.rect({ x: f2(R - w * 0.055), y: f2(-h / 2 + h * 0.1), w: f2(w * 0.11), h: f2(h * 0.065), r: f2(h * 0.032), fill: 'ink' }),
      ...[0, 1, 2].flatMap((i) => {
        const x = L + sw / 2 + i * (sw + gap), y = -h / 2 + h * 0.31;
        return [
          H.rect({ x: f2(x), y: f2(y), w: f2(sw), h: f2(h * 0.2), r: rr, fill: 'soft' }),
          H.rect({ x: f2(x - sw * 0.2), y: f2(y - h * 0.045), w: f2(sw * 0.44), h: f2(h * 0.025), r: f2(h * 0.012), fill: 'skel' }),
          H.rect({ x: f2(x - sw * 0.12), y: f2(y + h * 0.03), w: f2(sw * 0.6), h: f2(h * 0.05), r: f2(h * 0.02), fill: 'ink/70' }),
        ];
      }),
      H.rect({ x: f2(L + cw / 2), y: f2(-h / 2 + h * 0.7), w: f2(cw), h: f2(h * 0.44), r: rr, fill: 'soft' }),
      ...bars.map((b, i) => H.rect({ x: f2(L + w * 0.04 + bw * (i + 0.5)), y: f2(-h / 2 + h * 0.88), pin: 'b', w: f2(bw * 0.56), h: f2(h * 0.32 * b), r: f2(Math.min(bw * 0.16, h * 0.02)), fill: i === 6 ? 'ink/70' : 'ink/20' })),
    ] };
  },
  phone: (w, h) => {
    const L = -w / 2 + w * 0.08, cw = w * 0.84;
    return { bg: 'card', ch: [
      H.rect({ x: f2(L + w * 0.06), y: f2(-h / 2 + h * 0.03), w: f2(w * 0.12), h: f2(h * 0.014), r: f2(h * 0.007), fill: 'ink/70' }),
      H.rect({ x: f2(w / 2 - w * 0.14), y: f2(-h / 2 + h * 0.03), w: f2(w * 0.1), h: f2(h * 0.014), r: f2(h * 0.007), fill: 'ink/40' }),
      H.rect({ x: f2(L + w * 0.25), y: f2(-h / 2 + h * 0.1), w: f2(w * 0.5), h: f2(h * 0.028), r: f2(h * 0.012), fill: 'ink/80' }),
      H.rect({ x: f2(L + cw / 2), y: f2(-h / 2 + h * 0.25), w: f2(cw), h: f2(h * 0.2), r: f2(w * 0.06), fill: 'ink/85' }),
      H.rect({ x: f2(L + w * 0.2), y: f2(-h / 2 + h * 0.31), w: f2(w * 0.26), h: f2(h * 0.026), r: f2(h * 0.013), fill: 'inv/45' }),
      H.rect({ x: f2(L + w * 0.28), y: f2(-h / 2 + h * 0.2), w: f2(w * 0.44), h: f2(h * 0.022), r: f2(h * 0.011), fill: 'inv/80' }),
      ...[0, 1, 2, 3].flatMap((i) => {
        const y = -h / 2 + h * (0.44 + i * 0.1);
        return [
          H.circle({ x: f2(L + w * 0.07), y: f2(y), d: f2(w * 0.14), fill: 'skel' }),
          H.rect({ x: f2(L + w * 0.37), y: f2(y - h * 0.013), w: f2(w * 0.42), h: f2(h * 0.018), r: f2(h * 0.009), fill: 'ink/60' }),
          H.rect({ x: f2(L + w * 0.31), y: f2(y + h * 0.017), w: f2(w * 0.3), h: f2(h * 0.014), r: f2(h * 0.007), fill: 'skel' }),
        ];
      }),
      H.rect({ y: f2(h / 2 - h * 0.045), w: f2(w * 1.02), h: f2(h * 0.09), fill: 'panel' }),
      ...[0, 1, 2, 3].map((i) => H.rect({ x: f2(-w * 0.3 + i * w * 0.2), y: f2(h / 2 - h * 0.05), w: f2(w * 0.07), h: f2(w * 0.07), r: f2(w * 0.02), fill: i === 0 ? 'ink' : 'ink/30' })),
    ] };
  },
};
K.SCREENS = Object.keys(SCREENS);
H.photo = (o = {}) => {
  const w = o.w ?? 400, h = o.h ?? 300;
  const c = (typeof o.v === 'string' && SCREENS[o.v] ? SCREENS[o.v] : PHOTOS[(((Number(o.v) || 0) % PHOTOS.length) + PHOTOS.length) % PHOTOS.length])(w, h);
  // img: a real picture (a URL or a path next to the page) instead of the stand-in composition
  if (o.img) return Object.assign({ type: 'rect', r: 24 }, o, { w, h, clip: true, fill: o.fill ?? 'skel', media: o.v ?? 0, _n: 0, ch: o.ch || [] });
  return Object.assign({ type: 'rect', r: 24 }, o, { w, h, clip: true, fill: o.fill ?? c.bg, media: o.v ?? 0, _n: c.ch.length, ch: [...c.ch, ...(o.ch || [])] });
};
// canvas: code-drawn content on a canvas the size of the frame (w × h, default 1920 × 1080), centred on
// (x, y); `start` = the second its clock starts (films shift it per scene) — see K.media above.
//   canvas({ draw(ctx, { width, height, t, images, scale }) { … }, images: [...], w, h, start })
H.canvas = (o = {}) => Object.assign({ type: 'canvas', w: 1920, h: 1080, start: 0, images: [] }, o);
// image: a picture in a rounded box — photo() with your own file, for logos, screenshots, products
//   image({ img: 'assets/logo.png', w, h, r, fit: 'cover' | 'contain', … any rect prop })
H.image = (o = {}) => H.photo(Object.assign({ fill: 'rgba(0,0,0,0)', r: 0 }, o));

// ───────────────────────── instance (DOM) ─────────────────────────
const CURSOR_SVG = '<svg viewBox="0 0 28 28" width="100%" height="100%" style="display:block;overflow:visible"><path d="M3 2.2 L3 22.6 L8.4 17.4 L12 25.4 L15.6 23.8 L12.1 16 L19.6 16 Z" fill="#0B0B0B" stroke="#FFFFFF" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const svgNS = 'http://www.w3.org/2000/svg';
const put = (el, key, val) => { const c = el._s || (el._s = {}); if (c[key] !== val) { c[key] = val; el.style[key] = val; } };
const fmtNum = (v, o) => {
  const dec = o.dec || 0; if (o.floor) v = Math.floor(v * 10 ** dec + 1e-6) / 10 ** dec; let s = Math.abs(v).toFixed(dec);
  if (o.sep !== false) { const [i, f] = s.split('.'); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : ''); }
  if (o.pad) s = s.padStart(o.pad, '0');
  return (v < 0 ? '−' : '') + (o.pre || '') + s + (o.suf || '');
};
K._int.fmtNum = fmtNum;
// ───────────────────────── text placeholders: {{{COUNTER:…}}} / {{{TIMER:…}}} ─────────────────────────
// Dynamic numbers, ported from GreenLight Dash's text counters (frontend/src/components/videoEditor/textCounter.js:
// parse + frame math, verbatim; textPlaceholders.js: token options), so a number rolls exactly like it does in the
// Video Editor. Each token carries its own settings after `;`:
//   {{{COUNTER:0-2,480; style=odometer; start=0.45; duration=1.8; easing=power3_out}}}
//   {{{TIMER:00:10-00:00}}}                     a real clock: count style, 10 s, linear
//   {{{COUNTER:0-100; kf=1}}} + k: { 'ph:1': [0, [t0, t1, 100, 'Power3 Out']] }   keyed progress 0–100
// Not drawn here: spin blur, digits=natural.
const PH = (() => {
  const MAX_COLUMNS = 15;
  const RANGE_SEP = '\\s*(?:\\.\\.|→|–|—|to|-)\\s*';
  const NUM_SRC = '[-−]?\\d[\\d,]*(?:\\.\\d+)?';
  const COUNTER_RE = new RegExp(`^(${NUM_SRC})(?:${RANGE_SEP}(${NUM_SRC}))?$`, 'i');
  const TIME_SRC = '\\d+(?::\\d+){0,2}(?:\\.\\d+)?';
  const TIMER_RE = new RegExp(`^(${TIME_SRC})(?:${RANGE_SEP}(${TIME_SRC}))?$`, 'i');
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const clamp01 = (v) => clamp(v, 0, 1);
  const digitCount = (n) => String(Math.floor(Math.abs(n))).length;
  const parseLiteral = (raw) => {
    const s = raw.replace(/−/g, '-'); const neg = s[0] === '-'; const body = neg ? s.slice(1) : s;
    const dot = body.indexOf('.'); const intRaw = dot >= 0 ? body.slice(0, dot) : body; const frac = dot >= 0 ? body.slice(dot + 1) : '';
    const intDigits = intRaw.replace(/,/g, '') || '0';
    return { value: Number(`${neg ? '-' : ''}${intDigits}${frac ? `.${frac}` : ''}`), decimals: frac.length, sep: intRaw.includes(','),
      pad: intDigits.length > 1 && intDigits[0] === '0' ? intDigits.length : 0 };
  };
  const parseCounterRange = (body) => {
    const m = COUNTER_RE.exec(String(body ?? '').trim()); if (!m) return null;
    const single = m[2] == null;
    const a = single ? { value: 0, decimals: 0, sep: false, pad: 0 } : parseLiteral(m[1]);
    const b = parseLiteral(single ? m[1] : m[2]);
    if (!Number.isFinite(a.value) || !Number.isFinite(b.value)) return null;
    const decimals = Math.min(4, Math.max(a.decimals, b.decimals)); const scale = 10 ** decimals; const pad = Math.max(a.pad, b.pad);
    const from = Math.round(a.value * scale); const to = Math.round(b.value * scale);
    const intCols = Math.max(1, pad, digitCount(Math.abs(from) / scale), digitCount(Math.abs(to) / scale));
    if (intCols + decimals > MAX_COLUMNS) return null;
    const cols = [];
    for (let j = 0; j < intCols + decimals; j += 1) cols.push({ place: 10 ** j, radix: 10, lead: j - decimals >= Math.max(1, pad) });
    const sepRight = {};
    if (decimals > 0) sepRight[decimals] = '.';
    if (a.sep || b.sep) for (let i = 3; i < intCols; i += 3) sepRight[decimals + i] = ',';
    return { kind: 'counter', from, to, scale, cols, sepRight, signed: from < 0 || to < 0 };
  };
  const parseTime = (raw) => {
    const dot = raw.indexOf('.'); const main = dot >= 0 ? raw.slice(0, dot) : raw; const frac = dot >= 0 ? raw.slice(dot + 1) : '';
    const parts = main.split(':');
    for (let i = 1; i < parts.length; i += 1) if (parts[i].length > 2 || Number(parts[i]) >= 60) return null;
    let seconds = 0; for (const p of parts) seconds = seconds * 60 + Number(p);
    return { parts, frac, seconds: seconds + (frac ? Number(`0.${frac}`) : 0) };
  };
  const parseTimerRange = (body) => {
    const m = TIMER_RE.exec(String(body ?? '').trim()); if (!m) return null;
    const a = parseTime(m[1]); const b = m[2] != null ? parseTime(m[2]) : { parts: ['0'], frac: '', seconds: 0 };
    if (!a || !b) return null;
    const fields = Math.max(a.parts.length, b.parts.length); const decimals = Math.min(3, Math.max(a.frac.length, b.frac.length));
    const S = 10 ** decimals; const from = Math.round(a.seconds * S); const to = Math.round(b.seconds * S);
    const topPlace = fields === 3 ? 3600 * S : fields === 2 ? 60 * S : S;
    const typedTop = [a, b].filter((t) => t.parts.length === fields).map((t) => t.parts[0]);
    const pad = Math.max(0, ...typedTop.map((p) => (p.length > 1 && p[0] === '0' ? p.length : 0)));
    const topDigits = Math.max(1, pad, digitCount(Math.floor(from / topPlace)), digitCount(Math.floor(to / topPlace)));
    const cols = [];
    for (let k = 0; k < decimals; k += 1) cols.push({ place: 10 ** k, radix: 10, lead: false });
    const clockField = (place) => { cols.push({ place, radix: 10, lead: false }); cols.push({ place: place * 10, radix: 6, lead: false }); };
    if (fields >= 2) clockField(S);
    if (fields === 3) clockField(60 * S);
    for (let k = 0; k < topDigits; k += 1) cols.push({ place: topPlace * 10 ** k, radix: 10, lead: k >= Math.max(1, pad) });
    if (cols.length > MAX_COLUMNS) return null;
    const sepRight = {};
    if (decimals > 0) sepRight[decimals] = '.';
    if (fields >= 2) sepRight[decimals + 2] = ':';
    if (fields === 3) sepRight[decimals + 4] = ':';
    return { kind: 'timer', from, to, scale: S, cols, sepRight, signed: false };
  };
  const significant = (col, units) => !col.lead || units >= col.place;
  const pushSlots = (spec, colSlot, signAlpha) => {
    const slots = [];
    if (spec.signed) slots.push({ kind: 'sign', ch: '-', alpha: signAlpha, k: signAlpha });
    for (let j = spec.cols.length - 1; j >= 0; j -= 1) {
      const col = spec.cols[j]; const slot = colSlot(col, j); slot.radix = col.radix; slots.push(slot);
      const sep = j > 0 ? spec.sepRight[j] : null;
      if (sep) slots.push({ kind: 'sep', ch: sep, alpha: slot.alpha, k: slot.k });
    }
    return slots;
  };
  const countFrame = (spec, eased) => {
    const up = spec.to >= spec.from; const raw = spec.from + (spec.to - spec.from) * eased;
    const shown = clamp(up ? Math.floor(raw + 1e-6) : Math.ceil(raw - 1e-6), Math.min(spec.from, spec.to), Math.max(spec.from, spec.to));
    const u = Math.abs(shown);
    return pushSlots(spec, (col) => { const on = significant(col, u) ? 1 : 0; return { kind: 'digit', ch: String(Math.floor(u / col.place) % col.radix), alpha: on, k: on }; }, shown < 0 ? 1 : 0);
  };
  const rollFrame = (spec, eased) => {
    const v = spec.from + (spec.to - spec.from) * eased; const u = Math.abs(v);
    return pushSlots(spec, (col) => {
      const whole = Math.floor(u / col.place); const carry = clamp01((u % col.place) - (col.place - 1));
      const presence = col.lead ? clamp01(u - (col.place - 1)) : 1;
      return { kind: 'digit', pos: (whole % col.radix) + carry, alpha: presence, k: presence };
    }, clamp01(-v));
  };
  const odometerFrame = (spec, rawP, ease, s) => {
    const up = spec.to >= spec.from; const dir = up ? 1 : -1; const uFrom = Math.abs(spec.from); const uTo = Math.abs(spec.to); const n = spec.cols.length;
    const signFrom = spec.from < 0 ? 1 : 0; const signTo = spec.to < 0 ? 1 : 0;
    return pushSlots(spec, (col, j) => {
      const xPos = n > 1 ? 1 - j / (n - 1) : 1;
      const rank = s.land === 'together' ? 1 : s.land === 'right' ? 1 - xPos : xPos;
      const share = 1 - s.cascade * (1 - rank);
      const p = ease(clamp01(rawP / Math.max(1e-6, share)));
      const r = col.radix; const a = Math.floor(uFrom / col.place) % r; const b = Math.floor(uTo / col.place) % r;
      const turns = Math.round(s.turns * xPos);
      const steps = (up ? (b - a + r) % r : (a - b + r) % r) + r * turns;
      const abs = a + dir * steps * p;
      const presence = col.lead ? (significant(col, uFrom) ? 1 : 0) * (1 - p) + (significant(col, uTo) ? 1 : 0) * p : 1;
      return { kind: 'digit', pos: ((abs % r) + r) % r, alpha: presence, k: presence };
    }, signFrom + (signTo - signFrom) * ease(rawP));
  };
  // token options (textPlaceholders.js PLACEHOLDER_OPTIONS.number) — malformed ones are ignored
  const OPT = { style: ['odometer', 'roll', 'count'], start: [0, 3600], duration: [0.05, 36000], easing: 'easing', width: ['fixed', 'fit'],
    digits: ['tabular', 'natural'], turns: [0, 10], lands: ['left', 'right', 'together'], cascade: [0, 90], direction: ['auto', 'up', 'down'],
    blur: [0, 100], kf: 'kf' };
  const cleanOption = (key, raw) => {
    const sc = OPT[key]; const v = String(raw ?? '').trim().toLowerCase();
    if (!sc || !v) return null;
    if (sc === 'easing') return /^[a-z][a-z0-9_]{0,31}$/.test(v) ? v : null;
    if (sc === 'kf') return /^[a-z0-9]{1,8}$/.test(v) ? v : null;
    if (typeof sc[0] === 'string') return sc.includes(v) ? v : null;
    const n = Number(v); if (!Number.isFinite(n)) return null;
    const c = clamp(n, sc[0], sc[1]); return key === 'turns' ? Math.round(c) : Number(c.toFixed(3));
  };
  // TransitionEasing KEY (lowercase in tokens) → the keyframe easing name K.ease knows
  const EASE_KEY = { linear: 'Linear', ease_in: 'Ease In', ease_out: 'Ease Out', ease_in_out: 'Smooth', ae_in: 'AE In', ae_smooth: 'AE Smooth', ae_out: 'AE Out',
    sine_in: 'Sine In', sine_out: 'Sine Out', sine_in_out: 'Sine Smooth', cubic_in_out: 'Cubic Smooth', cubic_in: 'Cubic In', cubic_out: 'Cubic Out',
    expo_in: 'Expo In', expo_out: 'Expo Out', expo_in_out: 'Expo Smooth', circ_in: 'Circ In', circ_out: 'Circ Out', circ_in_out: 'Circ Smooth',
    back_in: 'Back In', back_out: 'Back Out', back_in_out: 'Back Smooth', bounce_out: 'Bounce Out', elastic_out: 'Elastic', natural: 'Natural',
    slow_down: 'Slow Down', overshoot: 'Overshoot', impulse: 'Impulse', swing: 'Swing', smooth_overshoot: 'Smooth Overshoot',
    power1_in: 'Power1 In', power1_out: 'Power1 Out', power1_in_out: 'Power1 Smooth', power2_in: 'Power2 In', power2_out: 'Power2 Out',
    power2_in_out: 'Power2 Smooth', power3_in: 'Power3 In', power3_out: 'Power3 Out', power3_in_out: 'Power3 Smooth', power4_in: 'Power4 In',
    power4_out: 'Power4 Out', power4_in_out: 'Power4 Smooth', hold: 'Hold' };
  K.EASE_KEY = EASE_KEY;
  // resolveUnitSettings: COUNTER base = COUNTER_DEFAULTS; TIMER base = a real clock (count, its own
  // span in seconds, linear); the token's options on top
  const settings = (spec, o = {}) => {
    const timer = spec.kind === 'timer';
    const base = timer
      ? { style: 'count', delay: 0, duration: Math.max(0.05, Math.abs(spec.to - spec.from) / (spec.scale || 1)), easing: 'linear' }
      : { style: 'odometer', delay: 0, duration: 1.8, easing: 'power3_out' };
    return {
      style: o.style ?? base.style, delay: o.start ?? base.delay, duration: o.duration ?? base.duration,
      ease: EASE_KEY[o.easing ?? base.easing] || 'Power2 Smooth',
      turns: o.turns ?? 3, land: o.lands ?? 'left', cascade: (o.cascade ?? 45) / 100, direction: o.direction ?? 'auto', kf: o.kf || null,
      fit: o.width === 'fit',
    };
  };
  // motionSign: +1 = a rising digit enters from below
  const motion = (spec, s) => { const dir = spec.to >= spec.from ? 1 : -1; return s.direction === 'up' ? dir : s.direction === 'down' ? -dir : 1; };
  // rawP 0…1; `ease` shapes it (the token's easing when timed, identity when keyed)
  const frame = (spec, s, rawP, ease = (p) => p) => {
    const p = clamp01(rawP);
    return s.style === 'count' ? countFrame(spec, ease(p)) : s.style === 'roll' ? rollFrame(spec, ease(p)) : odometerFrame(spec, p, ease, s);
  };
  const TOKEN_RE = /\{\{\{\s*(COUNTER|TIMER)\s*:\s*([^{}]*?)\s*\}\}\}/gi;
  // "Save {{{COUNTER:0-25}}}%" → [{ lit: 'Save ' }, { spec, s }, { lit: '%' }] — null when no token parses
  const parse = (text) => {
    const out = []; let last = 0; let any = false; let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(text))) {
      const parts = m[2].split(';'); const main = parts[0].trim(); const o = {};
      for (const part of parts.slice(1)) { const eq = part.indexOf('='); if (eq < 0) continue; const key = part.slice(0, eq).trim().toLowerCase(); const c = cleanOption(key, part.slice(eq + 1)); if (c !== null) o[key] = c; }
      const spec = m[1].toUpperCase() === 'TIMER' ? parseTimerRange(main) : parseCounterRange(main);
      if (!spec) continue;
      if (m.index > last) out.push({ lit: text.slice(last, m.index) });
      const s = settings(spec, o);
      out.push({ spec, s, motion: motion(spec, s) }); last = m.index + m[0].length; any = true;
    }
    if (last < text.length) out.push({ lit: text.slice(last) });
    return any ? out : null;
  };
  // A keyed counter — text({ num: { pre, suf, dec, sep, pad, floor }, k: { value } }) — as a COUNTER token:
  // Count style, keyed by 'ph:1' = map(value), drawn through the same token path (the same digits in the same cells).
  const numToken = (L, vtr) => {
    const o = L.num; const dec = o.dec || 0; const vb = L.value ?? 0;
    if (!vtr || !vtr.segs.length) return null;
    const a0 = vtr.init !== undefined ? vtr.init : vb;
    const vals = [a0, ...vtr.segs.map((g) => g.v)];
    const monotonic = vals.every((v, i) => i === 0 || (v - vals[i - 1]) * (vals[vals.length - 1] - a0) >= 0);
    const from = monotonic ? a0 : Math.min(...vals); const to = monotonic ? vals[vals.length - 1] : Math.max(...vals);
    const f = (v) => { let t = Math.abs(v).toFixed(dec); if (o.sep !== false) { const [x, y] = t.split('.'); t = x.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (y ? '.' + y : ''); } if (o.pad) t = t.padStart(o.pad, '0'); return (v < 0 ? '-' : '') + t; };
    const shown = (v) => Number(f(v).replace(/,/g, ''));
    const fr = shown(from); const to2 = shown(to); const step = 10 ** -dec;
    if (to2 === fr) return null;
    // Count shows floor(raw) counting up, ceil(raw) counting down; the lab rounds (or floors) —
    // shift raw so both print the same digit at every value
    const up = to2 > fr;
    const off = up ? (o.floor ? 0 : 0.5 * step) : (o.floor ? -(1 - 1e-4) * step : -0.5 * step);
    const map = (v) => clamp(((v + off - fr) / (to2 - fr)) * 100, 0, 100);
    return { text: `${o.pre || ''}{{{COUNTER:${f(from)}-${f(to)}; style=count; kf=1}}}${o.suf || ''}`, map, monotonic,
      track: { init: map(a0), segs: vtr.segs.map((g) => ({ ...g, v: map(g.v) })) } };
  };
  return { parse, settings, frame, numToken };
})();
K.placeholders = PH;

const SHADOWS = {
  1: (c) => `0 1px 2px rgba(${c},.06),0 10px 30px -8px rgba(${c},.16)`,
  2: (c) => `0 2px 4px rgba(${c},.06),0 24px 60px -12px rgba(${c},.26)`,
  3: (c) => `0 1px 1px rgba(${c},.08),0 3px 8px -2px rgba(${c},.18)`,
};
// the same shadows as filter drop-shadows (they follow a notched box's real outline; no spread)
const DROP_SHADOWS = {
  1: (c) => `drop-shadow(0 1px 1px rgba(${c},.06)) drop-shadow(0 6px 12px rgba(${c},.13))`,
  2: (c) => `drop-shadow(0 2px 2px rgba(${c},.06)) drop-shadow(0 14px 24px rgba(${c},.2))`,
  3: (c) => `drop-shadow(0 1px 1px rgba(${c},.08)) drop-shadow(0 2px 3px rgba(${c},.14))`,
};
// notches: semicircle bites in a rect's edges — the box is really cut (transparent), never painted
// over. [{ at, r, sides: 'tb' }] — `at` = px from the box centre along the edge (x for t/b, y for l/r)
const notchList = (L) => [].concat(L.notches || []).flatMap((o) => String(o.sides || 'tb').split('').map((side) => ({ side, at: o.at || 0, r: o.r || 24 })));
K._int.notchList = notchList;

// ───────────────────────── item parameters ─────────────────────────
// An item may declare its own controls: UIK.define({ params: { glow: { label, type: 'slider' | 'number' | 'toggle' |
// 'select' | 'color', min, max, step, unit, options, default } }, build: (H, P) => … }) — build gets every parameter
// (defaults filled; a film scene's `params` override them). Build items through K.build, never spec.build(H).
K.paramsOf = (spec, values) => {
  const P = {};
  for (const [n, d] of Object.entries((spec && spec.params) || {})) P[n] = d && d.default !== undefined ? d.default : null;
  return Object.assign(P, values || {});
};
K.build = (spec, values) => spec.build(H, K.paramsOf(spec, values));

class Instance {
  constructor(spec, host) {
    this.spec = spec; this.T = spec.T; this.host = host; this.tv = -1;
    const stage = this.stage = document.createElement('div');
    stage.className = 'uik-stage';
    const root = document.createElement('div');
    root.className = 'uik-root';
    stage.appendChild(root);
    host.appendChild(stage);
    this.recs = [];
    let layers;
    try { layers = K.build(spec); } catch (e) { console.error('[uik] build failed', spec.id, e); layers = []; this.error = e; }
    // a film's own font (scenario.font)
    if (spec.font && spec.font !== K.FONT_DEFAULT) stage.style.fontFamily = K.useFont(spec.font);
    this.layers = layers;
    this.root = root;
    // camera: spec.cam = zoom number, or { zoom, x, y, k: { … } } — x/y is the world point framed at the centre
    const cam = typeof spec.cam === 'number' ? { zoom: spec.cam } : (spec.cam || {});
    this.cam = { zoom: cam.zoom ?? 1, x: cam.x ?? 0, y: cam.y ?? 0, tracks: {} };
    for (const key of Object.keys(cam.k || {})) this.cam.tracks[key] = normTrack(cam.k[key], 'x');
    for (const L of layers) this.make(L, root, 0, null);
  }
  camAt(t) {
    const c = this.cam, g = (p) => (c.tracks[p] ? evalTrack(c.tracks[p], c[p], t, false) : c[p]);
    return { zoom: g('zoom'), x: g('x'), y: g('y') };
  }
  make(L, parent, depth, prec) {
    const n = document.createElement('div'); n.className = 'uik-n'; parent.appendChild(n);
    // a film's layer carries its key (its id, or ~<path>): the preview's element picker and the user's edits address it
    if (L._key != null) n.setAttribute('data-gl', L._key);
    const rec = { L, n, depth, tracks: {}, parent: prec };
    for (const key of Object.keys(L.k || {})) rec.tracks[key] = normTrack(L.k[key], key);
    let into = n;
    if (L.type === 'rect' || L.type === 'ellipse' || (L.type === 'group' && L.clip)) {
      const b = rec.box = document.createElement('div'); b.className = 'uik-b'; n.appendChild(b);
      if (L.clip) b.style.overflow = 'hidden';
      // img: a real picture, under the box's children. It has the photo's own size (w × h as built),
      // centred on the box — like the stand-in composition, so w / h tracks CROP it (the box clips)
      if (L.img) {
        const im = rec.img = document.createElement('div');
        const iw = Number.isFinite(L.w) ? L.w : 400; const ih = Number.isFinite(L.h) ? L.h : 300;
        im.style.cssText = `position:absolute;left:50%;top:50%;width:${iw}px;height:${ih}px;margin:${-ih / 2}px 0 0 ${-iw / 2}px;border-radius:inherit;`
          + `background:center / ${L.fit === 'contain' ? 'contain' : 'cover'} no-repeat url("${String(L.img).replace(/"/g, '%22')}")`;
        b.appendChild(im);
      }
      const c = rec.cen = document.createElement('div'); c.className = 'uik-c';
      b.appendChild(c);
      into = c;
    } else if (L.type === 'text') {
      const t = rec.txt = document.createElement('div'); t.className = 'uik-t'; n.appendChild(t);
      rec.tv = document.createElement('span'); rec.th = document.createElement('span'); rec.th.style.visibility = 'hidden';
      t.appendChild(rec.tv); t.appendChild(rec.th);
      if (L.caret) { rec.caret = document.createElement('i'); rec.caret.className = 'uik-caret'; t.insertBefore(rec.caret, rec.th); }
      // {{{COUNTER:…}}} / {{{TIMER:…}}}: literal runs + one span per digit slot (a clipped
      // two-digit strip that rolls), rebuilt only in seek's styles — the DOM is made once
      const nt = L.num ? PH.numToken(L, rec.tracks.value) : null;
      if (nt) rec.tracks['ph:1'] = nt.track;
      rec.ph = nt ? PH.parse(nt.text) : L.text != null && PH.parse(String(L.text));
      if (rec.ph) {
        rec.phUnits = [];
        for (const part of rec.ph) {
          if (part.lit != null) { rec.tv.appendChild(document.createTextNode(part.lit)); continue; }
          const slots = PH.frame(part.spec, part.s, 0).map((sl) => {
            const w = document.createElement('span');
            if (sl.kind !== 'digit') {
              w.textContent = sl.ch; rec.tv.appendChild(w);
              if (part.s.fit) { w.style.display = 'inline-flex'; w.style.justifyContent = 'center'; }
              return { w };
            }
            // a digit cell: as wide as the widest digit, the digit centred (an invisible
            // stack of 0–9 in the same grid cell sizes it)
            w.className = 'uik-dw';
            const sz = document.createElement('span'); sz.className = 'uik-dz'; sz.innerHTML = '0<br>1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9';
            const st = document.createElement('span'); st.className = 'uik-ds';
            const d0 = document.createTextNode('0'); const d1 = document.createElement('span'); d1.className = 'uik-d1';
            st.appendChild(d0); st.appendChild(d1); w.appendChild(sz); w.appendChild(st); rec.tv.appendChild(w);
            return { w, st, d0, d1 };
          });
          if (part.motion < 0) for (const d of slots) if (d.d1) d.d1.style.top = '-1.1em';
          rec.phUnits.push({ spec: part.spec, s: part.s, motion: part.motion, slots });
        }
      }
      if (L.weight) t.style.fontWeight = L.weight;
      if (L.italic) t.style.fontStyle = 'italic';
      if (L.upper) t.style.textTransform = 'uppercase';
      if (L.wrap) { t.style.whiteSpace = 'normal'; t.style.width = L.wrap + 'px'; t.style.textAlign = L.align || (L.ax === 0 ? 'left' : L.ax === 1 ? 'right' : 'center'); }
      if (L.lh) t.style.lineHeight = L.lh;
      // proportional digits (counters get their own digit cells below)
      if (L.tnum === true) t.style.fontFeatureSettings = '"tnum" 1';
    } else if (L.type === 'path' || L.type === 'icon') {
      const s = rec.svg = document.createElementNS(svgNS, 'svg'); s.setAttribute('class', 'uik-svg'); n.appendChild(s);
      // icon: a name from K.ICONS, or `paths` — your own 24-grid stroke paths (Lucide-style)
      const ds = L.type === 'icon' ? (L.paths || K.ICONS[L.icon] || (console.warn('[uik] unknown icon', L.icon), K.ICONS.dot)) : [].concat(L.d);
      if (L.type === 'icon') { s.setAttribute('viewBox', '0 0 24 24'); }
      rec.paths = ds.map((d) => {
        const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', d);
        p.setAttribute('stroke-linecap', L.cap || 'round'); p.setAttribute('stroke-linejoin', L.join || 'round');
        if (L.dash) p.setAttribute('stroke-dasharray', [].concat(L.dash).join(' '));   // not with trim
        if (L.trimmed || rec.tracks.trimE || rec.tracks.trimS || rec.tracks.trimO || L.trimE != null || L.trimS != null) p.setAttribute('pathLength', '100');
        s.appendChild(p); return p;
      });
    } else if (L.type === 'canvas') {
      const cv = rec.cv = document.createElement('canvas');
      cv.style.cssText = 'position:absolute;left:0;top:0;';
      n.appendChild(cv);
    } else if (L.type === 'cursor') {
      n.innerHTML = CURSOR_SVG; rec.cur = n.firstChild; n.classList.add('uik-cursor');
    }
    if (L.blend) n.style.mixBlendMode = L.blend;
    if (L.z != null) n.style.zIndex = L.z;
    this.recs.push(rec);
    for (const ch of L.ch || []) this.make(ch, into, depth + 1, rec);
  }
  val(rec, p, t) {
    const L = rec.L, tr = rec.tracks[p];
    let base = L[p] !== undefined ? L[p] : (p in NUM ? NUM[p] : p in COL ? COL[p] : 0);   // ph:<id> starts at 0
    // text and icons are ink unless told otherwise — so a colour track starts from ink, not transparent
    if (p === 'color' && base == null && (L.type === 'text' || L.type === 'icon')) base = 'ink';
    if (!tr) return isCol(p) ? resolve(base) : base;
    return evalTrack(tr, base, t, isCol(p));
  }
  seek(t) {
    this.t = t;
    const cam = this.camAt(t);
    put(this.root, 'transform', `scale(${cam.zoom.toFixed(5)}) translate(${(-cam.x).toFixed(2)}px,${(-cam.y).toFixed(2)}px)`);
    for (const rec of this.recs) {
      const L = rec.L, n = rec.n, v = (p) => this.val(rec, p, t);
      const op = v('opacity');
      if (op < 0.002) { put(n, 'display', 'none'); continue; }
      put(n, 'display', '');
      const x = v('x'), y = v('y'), rot = v('rot'), bl = v('blur');
      // the cursor keeps one size on screen whatever the camera zoom
      const sc = v('scale') / (L.type === 'cursor' ? cam.zoom : 1), sx = v('sx') * sc, sy = v('sy') * sc;
      let w = v('w'), h = v('h');
      if (L.type === 'cursor' || L.type === 'icon') { w = h = v('size'); }   // so origin/pin work on them
      // pin: which point of the box sits on (x, y) — 'c' centre (default), 'b' bottom, 't' top, 'l' left, 'r' right
      const pin = L.pin || 'c';
      let ox = pin.includes('l') ? w / 2 : pin.includes('r') ? -w / 2 : 0;
      let oy = pin.includes('t') ? h / 2 : pin.includes('b') ? -h / 2 : 0;
      if (L.type === 'cursor') {
        // the arrow's tip (3, 2.2 of 28) sits on (x, y) and is the squeeze origin
        ox = -w * 3 / 28; oy = -h * 2.2 / 28;
        put(n, 'width', w.toFixed(2) + 'px'); put(n, 'height', h.toFixed(2) + 'px');
      }
      put(n, 'transform', `translate(${(x + ox).toFixed(2)}px,${(y + oy).toFixed(2)}px)` +
        (rot ? ` rotate(${rot.toFixed(3)}deg)` : '') + (sx !== 1 || sy !== 1 ? ` scale(${sx.toFixed(4)},${sy.toFixed(4)})` : ''));
      // transform origin: the pin point unless `origin` says otherwise (fractions of the box, -0.5…0.5)
      const org = L.type === 'cursor' ? [3 / 28, 2.2 / 28] : L.origin || [-ox / (w || 1), -oy / (h || 1)];
      put(n, 'transformOrigin', `${(org[0] * w).toFixed(2)}px ${(org[1] * h).toFixed(2)}px`);
      const notched = rec.box && L.notches;
      const fx = [bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : '', notched && L.shadow ? DROP_SHADOWS[L.shadow](THEME.shadow) : ''].filter(Boolean).join(' ');
      put(n, 'opacity', op >= 0.999 ? '' : op.toFixed(4));
      put(n, 'filter', fx);
      if (rec.box) {
        const b = rec.box, r = L.type === 'ellipse' ? Math.min(w, h) / 2 : Math.min(v('r'), w / 2, h / 2);
        put(b, 'left', (-w / 2).toFixed(2) + 'px'); put(b, 'top', (-h / 2).toFixed(2) + 'px');
        put(b, 'width', w.toFixed(2) + 'px'); put(b, 'height', h.toFixed(2) + 'px');
        put(b, 'borderRadius', L.type === 'ellipse' ? '50%' : L.radii ? L.radii : r.toFixed(2) + 'px');
        put(b, 'background', css(v('fill')));
        const sw = v('sw'), st = v('stroke');
        // dash: true → a dashed border; otherwise the stroke is an inset ring
        if (L.dash) put(b, 'border', sw > 0 && st ? `${sw.toFixed(2)}px dashed ${css(st)}` : '');
        put(b, 'boxShadow', [sw > 0 && st && !L.dash ? `inset 0 0 0 ${sw.toFixed(2)}px ${css(st)}` : '', L.shadow && !notched ? SHADOWS[L.shadow](THEME.shadow) : ''].filter(Boolean).join(','));
        if (notched) {
          // one radial-gradient hole per bite, intersected (the box and its children are cut)
          const m = notchList(L).map((o) => {
            const cx = o.side === 't' || o.side === 'b' ? w / 2 + o.at : o.side === 'l' ? 0 : w;
            const cy = o.side === 'l' || o.side === 'r' ? h / 2 + o.at : o.side === 't' ? 0 : h;
            return `radial-gradient(circle at ${cx.toFixed(2)}px ${cy.toFixed(2)}px, transparent ${o.r}px, #000 ${o.r + 0.6}px)`;
          }).join(',');
          put(b, 'maskImage', m); put(b, 'webkitMaskImage', m);
          put(b, 'maskComposite', 'intersect'); put(b, 'webkitMaskComposite', 'source-in');
        }
        // children sit around the box centre — or, with chAt: 'pin', around the pinned point, so a
        // shape growing from one edge doesn't drag its content along
        const cp = L.chAt === 'pin' ? pin : 'c';
        put(rec.cen, 'left', (cp.includes('l') ? 0 : cp.includes('r') ? w : w / 2).toFixed(2) + 'px');
        put(rec.cen, 'top', (cp.includes('t') ? 0 : cp.includes('b') ? h : h / 2).toFixed(2) + 'px');
      } else if (rec.txt) {
        const el = rec.txt, ax = L.ax ?? 0.5;
        put(el, 'transform', `translate(${(-ax * 100).toFixed(1)}%,-50%)`);
        put(el, 'fontSize', v('size').toFixed(2) + 'px');
        put(el, 'letterSpacing', v('ls') ? v('ls').toFixed(4) + 'em' : '');
        put(el, 'color', css(v('color') || resolve('ink')));
        if (rec.ph) {
          // each unit: kf=<id> → its 'ph:<id>' track IS the eased progress (0–100); otherwise
          // start / duration / easing from its token
          for (const u of rec.phUnits) {
            const S = u.s, kt = S.kf && rec.tracks['ph:' + S.kf];
            const p = kt ? v('ph:' + S.kf) / 100 : (t - S.delay) / S.duration;
            PH.frame(u.spec, S, p, kt ? undefined : K.ease(S.ease)).forEach((sl, i) => {
              const d = u.slots[i]; if (!d) return;
              put(d.w, 'opacity', sl.alpha >= 0.999 ? '' : Math.max(0, sl.alpha).toFixed(3));
              // width=fit: a slot takes k × its room (leading columns close up as they fade)
              // (layout px: offsetWidth ignores the camera / parent transforms; the glyph stays centred)
              if (S.fit) {
                const k = sl.k ?? 1;
                d.w.style.width = '';
                if (k < 0.999) d.w.style.width = (d.w.offsetWidth * k).toFixed(2) + 'px';
              }
              if (sl.kind !== 'digit') return;
              const r = sl.radix || 10;
              const pos = sl.pos != null ? sl.pos : Number(sl.ch);
              const d0 = Math.floor(pos + 1e-9) % r, f = pos - Math.floor(pos + 1e-9);
              if (d.d0.data !== String(d0)) d.d0.data = String(d0);
              const n1 = String((d0 + 1) % r); if (d.d1.textContent !== n1) d.d1.textContent = n1;
              put(d.st, 'transform', f > 1e-4 ? `translateY(${(-f * 1.1 * u.motion).toFixed(4)}em)` : '');
            });
          }
          continue;
        }
        let s = L.text ?? '';
        if (L.num) s = fmtNum(v('value'), L.num);
        const rv = v('reveal');
        const cut = rv >= 1 ? s.length : Math.max(0, Math.round(rv * s.length));
        if (rec.tv._t !== s.slice(0, cut)) { rec.tv._t = s.slice(0, cut); rec.tv.textContent = rec.tv._t; }
        if (rec.th._t !== s.slice(cut)) { rec.th._t = s.slice(cut); rec.th.textContent = rec.th._t; }
        if (rec.caret) {
          // caret: solid while typing, blinks when idle; caretUntil hides it for good
          const tr = rec.tracks.reveal, typing = tr && tr.segs.some((g) => t >= g.t0 - 0.05 && t <= g.t1 + 0.05);
          const on = (L.caretFrom == null || t >= L.caretFrom) && (L.caretUntil == null || t < L.caretUntil) && (typing || Math.floor(t * 2.2) % 2 === 0);
          put(rec.caret, 'opacity', on ? '1' : '0');
          put(rec.caret, 'background', css(resolve(L.caretColor || 'acc')));
        }
      } else if (rec.cv) {
        const cv = rec.cv, k = K.media.scale;
        const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
        if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
        put(cv, 'width', w + 'px'); put(cv, 'height', h + 'px');
        put(cv, 'left', (-w / 2).toFixed(2) + 'px'); put(cv, 'top', (-h / 2).toFixed(2) + 'px');
        const g = cv.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
        if (typeof L.draw === 'function') {
          const images = (L.images || []).map((u) => K.media.get(u));
          try { L.draw(g, { width: cw, height: ch, t: Math.max(0, t - (L.start || 0)), images, scale: k }); }
          catch (err) { if (!rec.cvErr) { rec.cvErr = true; console.error('[uik] canvas draw', L.id || '', err); } }
        }
      } else if (rec.svg) {
        // a filled path with no stroke set draws no outline; an unfilled one defaults to an ink line
        const sv = v(L.type === 'icon' ? 'color' : 'stroke');
        const s = rec.svg, col = sv ? css(sv) : (L.type === 'path' && L.fill ? 'none' : css(resolve('ink')));
        if (L.type === 'icon') {
          const size = v('size'), sw = (L.sw ?? 2.2) * 24 / size;
          put(s, 'width', size.toFixed(2) + 'px'); put(s, 'height', size.toFixed(2) + 'px');
          put(s, 'left', (-size / 2).toFixed(2) + 'px'); put(s, 'top', (-size / 2).toFixed(2) + 'px');
          for (const p of rec.paths) { p.setAttribute('stroke', col); p.setAttribute('stroke-width', sw.toFixed(3)); p.setAttribute('fill', L.filled ? css(v('fill') || resolve('ink')) : 'none'); }
        } else {
          const fill = v('fill');
          for (const p of rec.paths) { p.setAttribute('stroke', col); p.setAttribute('stroke-width', v('sw') || 4); p.setAttribute('fill', fill ? css(fill) : 'none'); }
        }
        const ts = v('trimS'), te = v('trimE'), to = v('trimO');
        if (ts > 0 || te < 100 || rec.tracks.trimE || rec.tracks.trimS || rec.tracks.trimO) {
          const len = Math.max(0, te - ts);
          for (const p of rec.paths) {
            if (len <= 0.01) { p.style.strokeDasharray = '0 200'; p.style.strokeDashoffset = '0'; p.setAttribute('stroke-opacity', '0'); continue; }
            p.setAttribute('stroke-opacity', '1');
            p.style.strokeDasharray = `${len.toFixed(3)} ${200}`;
            p.style.strokeDashoffset = (-(ts + to)).toFixed(3);
          }
        }
      }
    }
  }
  destroy() { this.stage.remove(); }
}
K.Instance = Instance;

})();
