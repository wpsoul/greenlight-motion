/* GreenLight Motion — a library scene: a library item played on the film's clock, with the scene's copy, pictures,
 * parameters and motion preset. The player gives every library scene a page of its own: UIK.compose(scenario,
 * { scene: i }) is scene i alone, on its own clock (t = 0 is the start of its visible window).
 *
 *   scenario = {
 *     scenes: [{
 *       item: 'odometer',          // a library item id (the registry lists them)
 *       duration: 3.2,             // seconds on screen (default: the item's own length); longer holds the end
 *       text: { label: 'Orders' }, // copy: a text layer's id (or its key, ~0.2.1) → new text
 *       images: { hero: 'assets/shot.png', '#2': 'assets/b.jpg' },  // a photo's id, key or '#n' (n-th photo) → a picture
 *       transition: 'cut' | 'fade', // into THIS scene (fade = 0.35 s cross-fade)
 *       motion: 'spring',          // this scene's motion preset (default: the film's)
 *       params: { glow: 0.4 },     // the item's own parameters
 *       ui: [{ layer: 'card', label, controls }],   // the agent's panels for the preview (not drawn)
 *     }, …],                       // (a scene with `html` instead of `item` is a page of its own: only its timing counts here)
 *     motion: 'spring',            // the film's motion preset — K.MOTION_PRESETS ('authored' keeps every item's own easing)
 *     recolor: { '#FFFFFF': '#111111' },   // item colours: a literal colour swapped in every layer
 *     font: 'Inter',               // the film's font (K.FONTS) — the spec carries it
 *   }
 * (Token colours — scenario.colors — are the theme's: K.setTheme(theme, accent, colors) by whoever plays it.)
 * Every built layer carries _key (its id, or ~<path>: child indexes) — the engine puts it on its node as data-gl, which
 * the preview's element picker and the user's edits (CSS, per element) address — and _scene; a scene's `ui` panels sit
 * on their anchor layers as _ui. UIK.filmTiming(scenario) lists every scene's start / end and visible window.
 */
(function () {
'use strict';
const K = window.UIK;
const FADE = 0.35;
const r3 = (v) => Math.round(v * 1000) / 1000;

// a keyframe track (array form, as authored) shifted by dt: [init?, [t0, t1, v, e] | [t, v] …];
// ease(e) (optional) re-names each segment's easing — the film's motion preset
const shiftTrack = (arr, dt, ease) => (Array.isArray(arr) ? arr : [arr]).map((s) => {
  if (!Array.isArray(s)) return s;
  if (s.length === 2) return [r3(s[0] + dt), s[1]];
  const out = s.slice(); out[0] = r3(s[0] + dt); out[1] = r3(s[1] + dt);
  if (ease) out[3] = ease(s[3] || 'Power3 Out');
  return out;
});

// Motion presets: a film re-times nothing — it swaps each segment's easing by its ROLE, so every
// library item takes the film's feel. Roles: 'out' (enters, fades, decisive moves — the … Out curves),
// 'smooth' (travel, morphs, camera — the … Smooth curves, Natural), 'pop' (Back Out: small pops).
// In / Linear / Hold / Sine Smooth (scrubs) / AE / bouncy curves stay as authored. Bouncy presets bounce
// only transforms (x, y, scale, sx, sy, rot); other props (and the camera) take the calm spring curve.
const MOTION = {
  authored: null,
  spring: { out: 'Spring Out', smooth: 'Spring Smooth', pop: 'Spring Pop' },
  snappy: { out: 'Expo Out', smooth: 'Expo Smooth', pop: 'Back Out' },
  gentle: { out: 'Sine Out', smooth: 'Natural', pop: 'Power2 Out' },
  playful: { out: 'Back Out', smooth: 'Back Smooth', pop: 'Overshoot', bouncy: true },
  elastic: { out: 'Smooth Overshoot', smooth: 'Back Smooth', pop: 'Elastic', bouncy: true },
};
K.MOTION_PRESETS = MOTION;
K.MOTION_DEFAULT = 'spring';
const BOUNCE_PROPS = new Set(['x', 'y', 'scale', 'sx', 'sy', 'rot', 'rx', 'ry', 'depth']);
const roleOf = (e) => {
  if (e === 'Back Out' || e === 'Spring Pop') return 'pop';
  if (/^(Power[1-4]|Expo|Cubic|Circ|Sine|Spring) Out$|^Ease Out$|^Slow Down$/.test(e)) return 'out';
  if (/^(Power[1-4]|Expo|Cubic|Circ|Spring) Smooth$|^Smooth$|^Natural$/.test(e)) return 'smooth';
  return null;
};
// the easing re-namer for one preset: (easing, prop) → easing ('cam' = a camera track)
const motionEase = (name) => {
  const m = MOTION[name == null ? K.MOTION_DEFAULT : name];
  if (!m) return null;
  return (e, prop) => {
    const role = roleOf(e); if (!role) return e;
    const use = m.bouncy && (prop === 'cam' || !BOUNCE_PROPS.has(prop)) ? MOTION.spring : m;
    return use[role] || e;
  };
};
K.motionEase = motionEase;
// placeholder tokens start with the clip: give each one its scene's start
const shiftTokens = (text, dt) => String(text).replace(/\{\{\{\s*(COUNTER|TIMER)\s*:([^{}]*?)\}\}\}/gi, (m, type, body) => {
  const parts = body.split(';'); const main = parts[0];
  let found = false;
  const opts = parts.slice(1).map((p) => {
    const eq = p.indexOf('='); if (eq < 0) return p;
    const key = p.slice(0, eq).trim().toLowerCase();
    if (key !== 'start') return p;
    found = true; return ` start=${r3((Number(p.slice(eq + 1)) || 0) + dt)}`;
  });
  if (!found && dt > 0 && !parts.slice(1).some((p) => /^\s*kf\s*=/.test(p))) opts.push(` start=${r3(dt)}`);
  return `{{{${type}:${[main, ...opts].join(';')}}}}`;
});
// ── colours ──
const hasOwn = (o, k) => !!o && k != null && Object.prototype.hasOwnProperty.call(o, k);
const normHex = (c) => {
  const v = String(c == null ? '' : c).trim();
  if (!/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  let h = v.slice(1);
  if (h.length === 3 || h.length === 4) h = h.split('').map((x) => x + x).join('');
  return '#' + h.toUpperCase();
};
const COLORS = ['fill', 'stroke', 'color', 'caretColor'];
// a track's values mapped: [init?, [t0, t1, v, e] | [t, v] …]
const mapTrack = (tr, fn) => (Array.isArray(tr) ? tr : [tr]).map((x) => {
  if (!Array.isArray(x)) return fn(x);
  if (x.length === 2) return [x[0], fn(x[1])];
  const o = x.slice(); o[2] = fn(x[2]); return o;
});
// item colours: literal colours swapped wherever a layer uses them
const recolor = (o, map) => {
  const swap = (c) => (typeof c === 'string' && hasOwn(map, normHex(c)) ? map[normHex(c)] : c);
  for (const p of COLORS) {
    if (typeof o[p] === 'string') o[p] = swap(o[p]);
    if (o.k && o.k[p] !== undefined) o.k = Object.assign({}, o.k, { [p]: mapTrack(o.k[p], swap) });
  }
};
K.normHex = normHex;

// sc = { dt, text, images, photos, recolor, ui, scene } — one per scene; `photos` numbers the photo slots depth-first, so a
// slot without an id is still addressable as '#1', '#2' … (the registry lists them)
const hasKey = (o, k) => !!o && k != null && Object.prototype.hasOwnProperty.call(o, k);
const shiftLayer = (L, sc, path) => {
  const o = Object.assign({}, L); const dt = sc.dt;
  // its style key (id, or ~<path> — child indexes from the item's root) and scene; styles before the shift
  const key = L.id != null && L.id !== '' ? String(L.id) : '~' + path;
  o._key = key; o._scene = sc.scene;
  if (sc.recolor) recolor(o, sc.recolor);
  if (sc.ui && sc.ui[key]) o._ui = sc.ui[key];
  // images: photo / box id (or '#n') → the user's picture (the stand-in composition goes)
  const slot = L.media != null ? '#' + (++sc.photos) : null;
  // by id, by the shared picture name (src — every window / copy of it), or by slot number
  const pic = hasKey(sc.images, L.id) ? sc.images[L.id] : hasKey(sc.images, key) ? sc.images[key] : hasKey(sc.images, L.src) ? sc.images[L.src] : hasKey(sc.images, slot) ? sc.images[slot] : null;
  if (pic != null && (L.type === 'rect' || L.type === 'ellipse')) {
    o.img = String(pic); o.clip = true;
    if (L.media != null) { o.ch = (L.ch || []).slice(L._n || 0); o._n = 0; }
  }
  if (o.k) { const k = {}; for (const [p, tr] of Object.entries(o.k)) k[p] = shiftTrack(tr, dt, sc.ease && ((e) => sc.ease(e, p))); o.k = k; }
  // a canvas layer: its clock starts with the scene, and the scene's pictures are its image list
  // ('#1', '#2' … in order, or an array)
  if (L.type === 'canvas') {
    o.start = r3((L.start || 0) + dt);
    const imgs = Array.isArray(sc.images) ? sc.images : sc.images && typeof sc.images === 'object'
      ? Object.keys(sc.images).sort((a, b) => (parseInt(a.replace(/\D/g, ''), 10) || 0) - (parseInt(b.replace(/\D/g, ''), 10) || 0)).map((k) => sc.images[k]) : null;
    if (imgs && imgs.length) o.images = imgs.map(String);
  }
  if (L.caretFrom != null) o.caretFrom = r3(L.caretFrom + dt);
  if (L.caretUntil != null) o.caretUntil = r3(L.caretUntil + dt);
  if (hasKey(sc.text, L.id)) o.text = String(sc.text[L.id]);
  else if (hasKey(sc.text, key) && L.type === 'text') o.text = String(sc.text[key]);
  if (typeof o.text === 'string') o.text = shiftTokens(o.text, dt);
  if (o.ch) o.ch = o.ch.map((c, j) => shiftLayer(c, sc, path + '.' + j));
  return o;
};
// an item's camera as tracks from `t` on: its static values as steps at t, its segments shifted
const camOf = (spec) => (typeof spec.cam === 'number' ? { zoom: spec.cam } : (spec.cam || {}));

// every scene's timing: start / duration, and its visible window — a fade overlaps the neighbour by FADE
// (the incoming scene fades in over the last FADE of the outgoing one, which fades out after it)
const scenesOf = (scenario) => {
  const scenes = (scenario.scenes || []).map((sc, i) => {
    // a scene that is not built (compose(…, { scene })) only needs its duration, not its item
    const spec = K.elements.find((e) => e.id === sc.item) || null;
    if (!spec && !(Number(sc.duration) > 0)) throw new Error(`compose: scene ${i + 1} uses an unknown item "${sc.item}"`);
    return { ...sc, spec, dur: Math.max(0.2, Number(sc.duration) || spec.T) };
  });
  let t = 0;
  for (const s of scenes) { s.start = r3(t); t += s.dur; s.end = r3(t); }
  scenes.forEach((s, i) => {
    s.fadeIn = i > 0 && s.transition === 'fade';
    s.fadeOut = !!(scenes[i + 1] && scenes[i + 1].transition === 'fade');
    s.from = s.fadeIn ? r3(s.start - FADE) : s.start;
    s.to = s.fadeOut ? r3(s.end + FADE) : s.end;
  });
  return { scenes, T: r3(t) };
};
K.FILM_FADE = FADE;
K.filmTiming = (scenario) => scenesOf(scenario).scenes.map((s) => ({ item: s.item, start: s.start, end: s.end, from: s.from, to: s.to, duration: s.dur }));

// opt.scene = i → only that scene, on its own clock: t = 0 is the start of its visible window
// (spec.window = { start, end } in film time)
K.compose = function compose(scenario, opt = {}) {
  const all = scenesOf(scenario);
  const only = opt.scene != null ? all.scenes[opt.scene] : null;
  if (opt.scene != null && !only) throw new Error(`compose: no scene ${opt.scene + 1}`);
  const off = only ? only.from : 0;
  // each scene's motion preset: its own `motion`, else the film's, else the default (spring)
  const easeOf = (s) => motionEase(s.motion != null ? s.motion : scenario.motion);
  const scenes = only ? [only] : all.scenes;
  scenes.forEach((s) => { if (!s.spec) throw new Error(`compose: scene ${all.scenes.indexOf(s) + 1} uses an unknown item "${s.item}"`); });
  const T = only ? r3(only.to - only.from) : all.T;
  // item colours: keys as #RRGGBB(AA)
  let recolorMap = null;
  for (const [from, to] of Object.entries(scenario.recolor || {})) if (to) (recolorMap = recolorMap || {})[normHex(from)] = to;
  // the camera: each scene's own, from its start (a cut is a step; its moves are shifted)
  const cam = { zoom: 1, x: 0, y: 0, k: { zoom: [], x: [], y: [] } };
  const camProps = ['zoom', 'x', 'y'];
  scenes.forEach((s, i) => {
    const c = camOf(s.spec);
    for (const p of camProps) {
      const base = c[p] ?? (p === 'zoom' ? 1 : 0);
      if (i === 0) cam[p] = base; else cam.k[p].push([r3(s.start - off), base]);
      const ce = easeOf(s);
      if (c.k && c.k[p]) for (const seg of shiftTrack(c.k[p], s.start - off, ce && ((e) => ce(e, 'cam')))) if (Array.isArray(seg)) cam.k[p].push(seg);
    }
  });
  for (const p of camProps) if (!cam.k[p].length) delete cam.k[p];
  const spec = {
    id: (scenario.id || 'film') + (only ? `-scene${opt.scene + 1}` : ''),
    name: (scenario.name || 'Film') + (only ? ` · ${only.title || only.spec.name}` : ''), cat: 'film', T,
    desc: scenes.map((s) => s.spec.name).join(' → '),
    film: { scenario, ...(only ? { scene: opt.scene } : {}), scenes: scenes.map((s) => ({ item: s.item, name: s.title || s.spec.name, start: r3(s.start - off), duration: s.dur, file: s.spec.file })) },
    ...(only ? { window: { start: only.from, end: only.to } } : {}),
    ...(scenario.font && scenario.font !== K.FONT_DEFAULT ? { font: scenario.font } : {}),
    cam,
    build: (H) => scenes.map((s) => {
      const a = r3(s.start - off), b = r3(s.end - off);
      // visible only during its window
      const op = [0];
      const fe = easeOf(s) ? easeOf(s)('Power2 Smooth', 'opacity') : 'Power2 Smooth';   // the cross-fade takes the preset too
      if (s.fadeIn) op.push([r3(a - FADE), a, 1, fe]); else op.push([a, 1]);
      if (s.fadeOut) op.push([b, r3(b + FADE), 0, fe]); else if (!only && s !== all.scenes[all.scenes.length - 1]) op.push([b, 0]);
      const i = all.scenes.indexOf(s);
      const ui = {};
      for (const card of [].concat(s.ui || [])) if (card && card.layer != null) (ui[String(card.layer)] = ui[String(card.layer)] || []).push(card);
      const sc = { dt: a, text: s.text, images: s.images, photos: 0, ease: easeOf(s), scene: i,
        recolor: recolorMap, ui: Object.keys(ui).length ? ui : null };
      return H.group({ id: `scene${i + 1}`, k: { opacity: op }, ch: K.build(s.spec, s.params).map((L, j) => shiftLayer(L, sc, String(j))) });
    }),
  };
  return spec;
};
})();
