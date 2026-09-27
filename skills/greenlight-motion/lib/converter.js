/* UI Motion Kit → Video Editor converter.
 *
 * UIK.toVE(spec, { theme, accent }) turns one kit element into a Video Editor SEQUENCE
 * PRESET — { version: 1, kind: 've-sequence-preset', name, duration, videoSize, sequence }
 * — the file format of the editor's Presets tab (import it there as Sequence or Layers,
 * or POST it to /api/video-presets).
 *
 * How the lab maps onto the editor:
 *   - every lab node with children, a clip or an off-centre pivot becomes a JOINT: an
 *     invisible 1 px shape the node's children are parented to (keyframeParenting,
 *     additive) — the editor's parenting composes position/rotation/scale exactly like
 *     the lab's nested transforms, so each layer keeps its OWN clean keyframes;
 *   - rect/ellipse → shape, text → text, path → line/path shape (SVG → bezier anchors),
 *     icon → custom-SVG shape, cursor → two custom-SVG shapes, photo → ONE image layer matted
 *     by the photo box: its stand-in composition as an svg placeholder the user replaces (identical
 *     pictures share one clip), or with `img` that picture cover-scaled from opt.imageSizes;
 *     opt.photos = 'shapes' keeps the stand-in as shapes (the After Effects export);
 *   - `clip: true` → a hidden matte shape + trackMatte on every clipped layer; a clip
 *     inside a clip chains (the inner matte is itself matted by the outer one);
 *   - a node's opacity/blur is pushed down onto the layers under it (the editor's
 *     parenting passes only position/rotation/scale);
 *   - the camera → a root joint (scale = zoom, position = −zoom × focus);
 *   - keyframe segments → two editor keys each with the SAME easing name; segments
 *     that interrupt one another, and values that combine two animated tracks, are
 *     sampled into Linear keys (UIK.h.sample).
 * The report lists every approximation made.
 */
(function () {
'use strict';
const K = window.UIK;
const { normTrack, evalTrack, resolve, css } = K._int;
const H = K.h;
const W = 1920; const HH = 1080;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r4 = (v) => Math.round(v * 10000) / 10000;
// the Video Editor's default text font (types.js DEFAULT_TEXT_FONT_FAMILY) — the lab stage uses it too
const TEXT_FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
// letter-spacing in em (the stage has none by default). NB the editor draws text with any non-zero
// spacing glyph by glyph — without kerning pairs — so tracked text comes out a little wider there.
const lsEm = (ls) => ls || 0;
// the editor clamps rotateZ to ±180 — a static angle must be folded into that range
const normDeg = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
// 2D affine [a, b, c, d, e, f]: (x, y) → (a·x + c·y + e, b·x + d·y + f)
const mMul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const mT = (x, y) => [1, 0, 0, 1, x, y];
const mRS = (deg, sx, sy) => { const r = (deg * Math.PI) / 180; const c = Math.cos(r); const s = Math.sin(r); return [c * sx, s * sx, -s * sy, c * sy, 0, 0]; };
const mApply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const TEXT_DY = 0.137;   // Helvetica: the editor sets a line 0.137 em higher than the CSS line box

// ───────────────────── colours, shadows ─────────────────────
const colorStr = (c) => { const rgba = resolve(c); return rgba ? css(rgba) : 'rgba(0,0,0,0)'; };
const SHADOW_SETS = {
  1: [[0, 1, 2, 0, 0.06], [0, 10, 30, -8, 0.16]],
  2: [[0, 2, 4, 0, 0.06], [0, 24, 60, -12, 0.26]],
  3: [[0, 1, 1, 0, 0.08], [0, 3, 8, -2, 0.18]],
};
const shadowsFor = (lvl) => {
  const set = SHADOW_SETS[lvl]; if (!set) return undefined;
  const rgb = K.theme().shadow;
  return set.map(([x, y, blur, spread, a]) => ({ x, y, blur, spread, color: `rgba(${rgb},${a})`, inset: false }));
};

// ───────────────────── tracks → editor keys ─────────────────────
// A "value" is { base, tr } — a lab track (normalised) with its base value — or a
// function of time when it combines several tracks. `map` turns a lab value into the
// editor's unit. Exact when one plain track drives it and its segments don't overlap.
const TRC = new WeakMap();
const trackOf = (L, p) => {
  if (!L.k || L.k[p] === undefined) return null;
  let m = TRC.get(L); if (!m) TRC.set(L, (m = {}));
  return m[p] || (m[p] = normTrack(L.k[p], p));
};
const valAt = (L, p, def, t) => { const tr = trackOf(L, p); const b = baseOf(L, p, def); return tr ? evalTrack(tr, b, t, false) : b; };
// A lab node's matrix at t (the engine's CSS: translate(x + o) rotate scale about `origin`), and the
// frame its children sit in (box centre, or the pinned point with chAt: 'pin')
const nodeFrames = (L, parentM) => {
  const geo = (t) => {
    let w = valAt(L, 'w', 0, t); let h = valAt(L, 'h', 0, t);
    if (L.type === 'icon' || L.type === 'cursor') w = h = valAt(L, 'size', L.type === 'cursor' ? 46 : 40, t);
    const pin = L.pin || 'c';
    const ox = pin.includes('l') ? w / 2 : pin.includes('r') ? -w / 2 : 0; const oy = pin.includes('t') ? h / 2 : pin.includes('b') ? -h / 2 : 0;
    return { w, h, ox, oy };
  };
  const self = (t) => {
    const { w, h, ox, oy } = geo(t);
    const org = L.origin || [-ox / (w || 1), -oy / (h || 1)]; const o = [org[0] * w, org[1] * h];
    const sc = valAt(L, 'scale', 1, t);
    const local = mMul(mT(valAt(L, 'x', 0, t) + ox + o[0], valAt(L, 'y', 0, t) + oy + o[1]),
      mMul(mRS(valAt(L, 'rot', 0, t), valAt(L, 'sx', 1, t) * sc, valAt(L, 'sy', 1, t) * sc), mT(-o[0], -o[1])));
    return mMul(parentM(t), local);
  };
  const kids = (t) => { if (L.chAt !== 'pin') return self(t); const { ox, oy } = geo(t); return mMul(self(t), mT(-ox, -oy)); };
  // the clip box in comp px (centre = 0), or null while it is rotated / sheared
  const box = (t) => {
    const m = self(t); if (Math.abs(m[1]) > 1e-6 || Math.abs(m[2]) > 1e-6) return null;
    const { w, h } = geo(t);
    const [ax, ay] = mApply(m, -w / 2, -h / 2); const [bx, by] = mApply(m, w / 2, h / 2);
    const x0 = Math.min(ax, bx); const x1 = Math.max(ax, bx); const y0 = Math.min(ay, by); const y1 = Math.max(ay, by);
    const r = L.type === 'ellipse' ? null : Math.min(valAt(L, 'r', 0, t) * Math.abs(m[0]), (x1 - x0) / 2, (y1 - y0) / 2);
    return { x0, y0, x1, y1, r };
  };
  return { self, kids, box };
};
// does rounded box `a` sit inside rounded box `b`? (each corner circle of a inside b)
const fitsIn = (a, b) => {
  if (a.x1 - a.x0 < 0.5 || a.y1 - a.y0 < 0.5) return true;
  if (a.x0 < b.x0 - 0.5 || a.x1 > b.x1 + 0.5 || a.y0 < b.y0 - 0.5 || a.y1 > b.y1 + 0.5) return false;
  const ri = a.r || 0; const ro = b.r || 0;
  if (ro <= ri + 0.5) return true;
  for (const [px, py] of [[a.x0 + ri, a.y0 + ri], [a.x1 - ri, a.y0 + ri], [a.x0 + ri, a.y1 - ri], [a.x1 - ri, a.y1 - ri]]) {
    const qx = clamp(px, b.x0 + ro, b.x1 - ro); const qy = clamp(py, b.y0 + ro, b.y1 - ro);
    if (Math.hypot(px - qx, py - qy) > ro - ri + 0.5) return false;
  }
  return true;
};
// a track's start value (`[init, …segments]`) IS the layer's value until its first segment — and a
// track that is only a start value (`sx: [0.46]`) is simply a static value
const baseOf = (L, p, def) => {
  const tr = trackOf(L, p);
  if (tr && tr.init !== undefined) return tr.init;
  return L[p] !== undefined && L[p] !== null ? L[p] : def;
};
const overlaps = (tr) => tr.segs.some((s, i) => i > 0 && s.t0 < tr.segs[i - 1].t1 - 1e-6);

// Sampling tolerance per editor track, in its own unit (opacity 0–1, scale ×, px, deg …).
const TOL = { opacity: 0.004, scale: 0.002, scaleX: 0.002, scaleY: 0.002, rotate: 0.1, blur: 0.08, letterSpacing: 0.05 };
const tolFor = (key) => TOL[key] ?? 0.3;
// A curve on [a, b] → the fewest Linear keys [[t, v]…] (a excluded, b included) staying within
// tol at 60 fps. v is a number, or an rgba array for colours (tol = 2 levels per channel).
function sampleCurve(f, a, b, tol, isColor) {
  const n = Math.max(1, Math.ceil((b - a) * 60)); const ts = []; const vs = [];
  for (let j = 0; j <= n; j++) { const t = a + ((b - a) * j) / n; ts.push(t); vs.push(f(t)); }
  const lerp = (x, y, u) => (isColor ? x.map((c, k) => c + (y[k] - c) * u) : x + (y - x) * u);
  const off = (x, y) => (isColor ? Math.max(...x.map((c, k) => Math.abs(c - y[k]) / (k === 3 ? 1 / 255 : 1))) / 2 : Math.abs(x - y) / tol);
  const out = [];
  for (let i = 0; i < n;) {
    let j = i + 1;
    for (let jj = j + 1; jj <= n; jj++) {
      let ok = true;
      for (let q = i + 1; q < jj && ok; q++) ok = off(lerp(vs[i], vs[jj], (ts[q] - ts[i]) / (ts[jj] - ts[i])), vs[q]) <= 1;
      if (!ok) break;
      j = jj;
    }
    out.push([ts[j], vs[j]]); i = j;
  }
  return out;
}
const dedupKeys = (keys) => {
  const out = [];
  for (const k of keys) { if (out.length && out[out.length - 1].position === k.position) out[out.length - 1] = k; else out.push(k); }
  return out;
};
// A lab track → editor keys. Each segment is two keys with its own easing (exact). A segment
// interrupted by the next one (or cut by the clip end) is exact up to its start, its cut-short
// curve is sampled into Linear keys, and the next segment eases on from where it got to —
// exactly how the lab evaluates it. Steps become 'Hold' keys.
function keysFromTrack(tr, base, T, map, isColor, tol = 0.3) {
  const init = tr.init !== undefined ? tr.init : base;
  const at = (t) => evalTrack(tr, base, t, isColor);
  const pos = (t) => r4(clamp(t / T, 0, 1) * 100);
  const val = (v) => (isColor ? colorStr(v) : String(r4(map(v))));   // a lab value
  const valR = (v) => (isColor ? css(v) : String(r4(map(v))));       // an evaluated value
  const out = [{ position: 0, value: val(init), easing: 'Linear' }];
  let lastT = 0;
  const segs = tr.segs;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.t0 >= T) break;
    if (s.t1 <= s.t0) {                                              // a step: hold, then jump
      out[out.length - 1].easing = 'Hold';
      const tt = s.t0 > lastT + 1e-4 ? s.t0 : lastT + 0.001;
      out.push({ position: pos(tt), value: val(s.v), easing: 'Linear' }); lastT = tt; continue;
    }
    if (s.t0 > lastT + 1e-4) out.push({ position: pos(s.t0), value: valR(at(s.t0)), easing: s.e });
    else out[out.length - 1].easing = s.e;
    const next = segs[i + 1];
    const tEnd = Math.min(next && next.t0 < s.t1 ? next.t0 : s.t1, T);
    if (tEnd < s.t1 - 1e-6) {
      out[out.length - 1].easing = 'Linear';
      const f = isColor ? at : (t) => map(at(t));
      for (const [t, v] of sampleCurve(f, Math.max(s.t0, lastT), tEnd, isColor ? 1 : tol, isColor)) {
        out.push({ position: pos(t), value: isColor ? css(v) : String(r4(v)), easing: 'Linear' });
      }
      lastT = tEnd;
      if (tEnd >= T) break;
      continue;
    }
    out.push({ position: pos(s.t1), value: val(s.v), easing: 'Linear' }); lastT = s.t1;
  }
  return dedupKeys(out).map(veKey);
}
// the kit's own curves (easings.js, custom: true — the springs) → the editor's Custom key + its bezier
const veKey = (k) => {
  const c = (window.UIK_EASINGS || {})[k.easing];
  return c && c.custom && c.b ? Object.assign({}, k, { easing: 'Custom', bezier: c.b.slice() }) : k;
};
function keysFromFn(fn, T, map = (v) => v, tol = 0.3) {
  const f = (t) => map(fn(t));
  const out = [{ position: 0, value: String(r4(f(0))), easing: 'Linear' }];
  for (const [t, v] of sampleCurve(f, 0, T, tol, false)) out.push({ position: r4(clamp(t / T, 0, 1) * 100), value: String(r4(v)), easing: 'Linear' });
  return dedupKeys(out);
}
const isStatic = (keys) => keys.every((k) => k.value === keys[0].value);

// ───────────────────── SVG path → editor anchors ─────────────────────
function parsePath(d) {
  const toks = String(d).match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  let i = 0; let cmd = null; let x = 0; let y = 0; let sx = 0; let sy = 0; let lcx = null; let lcy = null; let lqx = null; let lqy = null;
  const subs = []; let cur = null;
  const num = () => Number.parseFloat(toks[i++]);
  const move = (nx, ny) => { cur = { start: [nx, ny], segs: [], closed: false }; subs.push(cur); x = sx = nx; y = sy = ny; };
  const cubic = (c1x, c1y, c2x, c2y, ex, ey) => { if (!cur) move(x, y); cur.segs.push([x, y, c1x, c1y, c2x, c2y, ex, ey]); x = ex; y = ey; };
  const line = (ex, ey) => cubic(x, y, ex, ey, ex, ey);
  const arc = (rx, ry, rot, large, sweep, ex, ey) => {
    // SVG arc → cubic beziers (≤ 90° each)
    if (rx === 0 || ry === 0) { line(ex, ey); return; }
    const phi = (rot * Math.PI) / 180; const cos = Math.cos(phi); const sin = Math.sin(phi);
    const dx = (x - ex) / 2; const dy = (y - ey) / 2;
    const x1p = cos * dx + sin * dy; const y1p = -sin * dx + cos * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const sign = large === sweep ? -1 : 1;
    const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const coef = sign * Math.sqrt(Math.max(0, num2 / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
    const cxp = coef * ((rx * y1p) / ry); const cyp = coef * (-(ry * x1p) / rx);
    const cx = cos * cxp - sin * cyp + (x + ex) / 2; const cy = sin * cxp + cos * cyp + (y + ey) / 2;
    const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    const th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dth > 0) dth -= 2 * Math.PI; else if (sweep && dth < 0) dth += 2 * Math.PI;
    const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2) - 1e-9));
    const step = dth / n; const kk = (4 / 3) * Math.tan(step / 4);
    const pt = (t) => [cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos];
    const dv = (t) => [-rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos];
    let t = th1;
    for (let s = 0; s < n; s++) {
      const p0 = pt(t); const p1 = pt(t + step); const d0 = dv(t); const d1 = dv(t + step);
      const last = s === n - 1;
      cubic(p0[0] + kk * d0[0], p0[1] + kk * d0[1], p1[0] - kk * d1[0], p1[1] - kk * d1[1], last ? ex : p1[0], last ? ey : p1[1]);
      t += step;
    }
  };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(); const C = cmd.toUpperCase();
    const ax = (v) => (rel ? x + v : v); const ay = (v) => (rel ? y + v : v);
    if (C === 'M') { const nx = ax(num()); const ny = ay(num()); move(nx, ny); cmd = rel ? 'l' : 'L'; lcx = lqx = null; }
    else if (C === 'L') { line(ax(num()), ay(num())); lcx = lqx = null; }
    else if (C === 'H') { const v = num(); line(rel ? x + v : v, y); lcx = lqx = null; }
    else if (C === 'V') { const v = num(); line(x, rel ? y + v : v); lcx = lqx = null; }
    else if (C === 'C') { const a = [num(), num(), num(), num(), num(), num()]; const c1x = ax(a[0]); const c1y = ay(a[1]); const c2x = ax(a[2]); const c2y = ay(a[3]); const ex = ax(a[4]); const ey = ay(a[5]); cubic(c1x, c1y, c2x, c2y, ex, ey); lcx = c2x; lcy = c2y; lqx = null; }
    else if (C === 'S') { const a = [num(), num(), num(), num()]; const c1x = lcx !== null ? 2 * x - lcx : x; const c1y = lcx !== null ? 2 * y - lcy : y; const c2x = ax(a[0]); const c2y = ay(a[1]); const ex = ax(a[2]); const ey = ay(a[3]); cubic(c1x, c1y, c2x, c2y, ex, ey); lcx = c2x; lcy = c2y; lqx = null; }
    else if (C === 'Q' || C === 'T') {
      let qx; let qy;
      if (C === 'Q') { qx = ax(num()); qy = ay(num()); } else { qx = lqx !== null ? 2 * x - lqx : x; qy = lqx !== null ? 2 * y - lqy : y; }
      const ex = ax(num()); const ey = ay(num());
      cubic(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
      lqx = qx; lqy = qy; lcx = null;
    } else if (C === 'A') { const a = [num(), num(), num(), num(), num(), num(), num()]; arc(a[0], a[1], a[2], a[3], a[4], ax(a[5]), ay(a[6])); lcx = lqx = null; }
    else if (C === 'Z') { if (cur) { if (Math.hypot(x - sx, y - sy) > 1e-6) line(sx, sy); cur.closed = true; } x = sx; y = sy; lcx = lqx = null; }
    else { i++; }
  }
  return subs.filter((s) => s.segs.length);
}
// One subpath → { box: {cx, cy, w, h}, points } in the editor's box-fraction space.
function subpathToShape(sub) {
  const anchors = [{ x: sub.start[0], y: sub.start[1], hIn: [0, 0], hOut: [0, 0] }];
  for (const s of sub.segs) {
    const a = anchors[anchors.length - 1];
    a.hOut = [s[2] - s[0], s[3] - s[1]];
    anchors.push({ x: s[6], y: s[7], hIn: [s[4] - s[6], s[5] - s[7]], hOut: [0, 0] });
  }
  if (sub.closed && anchors.length > 2) {
    const f = anchors[0]; const l = anchors[anchors.length - 1];
    if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-4) { f.hIn = l.hIn; anchors.pop(); }
  }
  // the box = the CURVE's bounds (not just the anchors: a flat-ended bulge would make its handles
  // many times the box height)
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const grow = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const g of sub.segs) {
    for (let i = 0; i <= 24; i++) {
      const u = i / 24; const v = 1 - u;
      grow(v * v * v * g[0] + 3 * v * v * u * g[2] + 3 * v * u * u * g[4] + u * u * u * g[6],
        v * v * v * g[1] + 3 * v * v * u * g[3] + 3 * v * u * u * g[5] + u * u * u * g[7]);
    }
  }
  // the box is at least 16 px each way: a straight line's 1 px box draws stray end ticks in the
  // editor (its plate is only as tall as the stroke) — points are box fractions, so a taller box
  // leaves the line exactly where it is
  const w = Math.max(16, x1 - x0); const h = Math.max(16, y1 - y0); const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const pts = anchors.map((a) => ({
    x: r4((a.x - cx) / w), y: r4((a.y - cy) / h),
    hIn: { x: r4(a.hIn[0] / w), y: r4(a.hIn[1] / h) }, hOut: { x: r4(a.hOut[0] / w), y: r4(a.hOut[1] / h) },
    manual: true,
  }));
  return { box: { cx, cy, w, h }, points: pts, closed: !!sub.closed };
}

// A notched rect's outline as SVG path data, clockwise: the rounded rect's perimeter (per-corner radii
// from `radii`, else `r`), where every bite replaces the stretch of perimeter it covers — ±r along the
// edge from its centre — with the arc inside the box (a semicircle mid-edge, a quarter at a square corner).
function notchedOutline(w, h, L) {
  const x0 = -w / 2; const x1 = w / 2; const y0 = -h / 2; const y1 = h / 2;
  const rr = L.radii ? String(L.radii).match(/-?\d*\.?\d+/g).map(Number) : [L.r || 0, L.r || 0, L.r || 0, L.r || 0];
  const [rTL, rTR, rBR, rBL] = [0, 1, 2, 3].map((i) => Math.max(0, Math.min(rr[i] ?? rr[0], w / 2, h / 2)));
  // perimeter pieces, clockwise from the top-left corner's end: straight edges and corner arcs
  const segs = [];
  const line = (ax, ay, bx, by) => segs.push({ kind: 'L', a: [ax, ay], b: [bx, by], len: Math.hypot(bx - ax, by - ay) });
  const arc = (r, bx, by, ax, ay) => { if (r > 0) segs.push({ kind: 'A', r, a: [ax, ay], b: [bx, by], len: (Math.PI / 2) * r }); };
  line(x0 + rTL, y0, x1 - rTR, y0); arc(rTR, x1, y0 + rTR, x1 - rTR, y0);
  line(x1, y0 + rTR, x1, y1 - rBR); arc(rBR, x1 - rBR, y1, x1, y1 - rBR);
  line(x1 - rBR, y1, x0 + rBL, y1); arc(rBL, x0, y1 - rBL, x0 + rBL, y1);
  line(x0, y1 - rBL, x0, y0 + rTL); arc(rTL, x0 + rTL, y0, x0, y0 + rTL);
  let acc = 0; for (const g of segs) { g.s0 = acc; acc += g.len; }
  const P = acc;
  const at = (sv) => { sv = ((sv % P) + P) % P; for (const g of segs) if (sv <= g.s0 + g.len + 1e-9) { const u = g.len ? (sv - g.s0) / g.len : 0; return [g.a[0] + (g.b[0] - g.a[0]) * u, g.a[1] + (g.b[1] - g.a[1]) * u]; } return segs[0].a; };
  // a bite's centre → its arclength (nearest point on a straight edge)
  const sOf = (px, py) => {
    let best = null;
    for (const g of segs) { if (g.kind !== 'L') continue;
      const dx = g.b[0] - g.a[0]; const dy = g.b[1] - g.a[1]; const u = clamp(((px - g.a[0]) * dx + (py - g.a[1]) * dy) / (g.len * g.len || 1), 0, 1);
      const d = Math.hypot(g.a[0] + dx * u - px, g.a[1] + dy * u - py);
      if (!best || d < best.d - 1e-6) best = { d, s: g.s0 + u * g.len }; }
    return best.s;
  };
  const bites = K._int.notchList(L).map((o) => {
    const c = o.side === 't' ? [o.at, y0] : o.side === 'b' ? [o.at, y1] : o.side === 'l' ? [x0, o.at] : [x1, o.at];
    const sc = sOf(c[0], c[1]); return { r: o.r, sA: sc - o.r, sB: sc + o.r };
  });
  // start somewhere no bite covers
  const inside = (sv) => bites.some((q) => { const d = ((sv - q.sA) % P + P) % P; return d < q.sB - q.sA; });
  let s0 = [0.5, 1.5, 2.5, 3.5].map((k) => segs[Math.min(segs.length - 1, Math.round(k))]).map((g) => g.s0 + g.len / 2).find((v) => !inside(v)) ?? 0;
  for (const q of bites) { q.a = ((q.sA - s0) % P + P) % P; }
  bites.sort((m, n) => m.a - n.a);
  const pt = (v) => `${r4(v[0])} ${r4(v[1])}`;
  // the pieces in walking order from s0 (the piece holding s0 — a straight edge — splits in two)
  const ring = [];
  for (const g of segs) {
    const rs = g.s0 - s0; const re = rs + g.len;
    if (rs < 0 && re > 0) { ring.push({ ...g, rs: 0, re }); ring.push({ ...g, rs: P + rs, re: P }); }
    else if (re <= 0) ring.push({ ...g, rs: rs + P, re: re + P });
    else ring.push({ ...g, rs, re });
  }
  ring.sort((m, n) => m.rs - n.rs);
  let d = `M${pt(at(s0))} `; let cur = 0;   // cur = arclength walked from s0
  const walk = (to) => {   // the perimeter from cur to `to`: lines, and whole corner arcs
    for (const g of ring) {
      if (g.re <= cur + 1e-6 || g.rs >= to - 1e-6) continue;
      const end = Math.min(g.re, to);
      if (g.kind === 'A' && end >= g.re - 1e-6 && g.rs >= cur - 1e-6) d += `A${r4(g.r)} ${r4(g.r)} 0 0 1 ${pt(g.b)} `;
      else d += `L${pt(at(s0 + end))} `;
    }
    cur = Math.max(cur, to);
  };
  for (const q of bites) { walk(q.a); d += `A${q.r} ${q.r} 0 0 0 ${pt(at(s0 + q.a + (q.sB - q.sA)))} `; cur = q.a + (q.sB - q.sA); }
  walk(P);
  return d + 'Z';
}
const notchedShape = (L, w, h) => subpathToShape(parsePath(notchedOutline(w, h, L))[0]);

// ───────────────────── icons → custom SVG data URIs ─────────────────────
const svgUri = (svg) => 'data:image/svg+xml;base64,' + (typeof btoa === 'function' ? btoa(svg) : Buffer.from(svg).toString('base64'));
const iconUri = (paths, size, sw, filled) => {
  const s = (sw * 24) / Math.max(1, size);
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">`
    + paths.map((d) => `<path d="${d}" fill="${filled ? '#000' : 'none'}" stroke="#000" stroke-width="${r4(s)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('') + '</svg>');
};
const CURSOR_D = 'M3 2.2 L3 22.6 L8.4 17.4 L12 25.4 L15.6 23.8 L12.1 16 L19.6 16 Z';
const cursorUri = (outline) => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="112" height="112"><path d="${CURSOR_D}" fill="#000" stroke="#000" stroke-width="${outline ? 3.4 : 0}" stroke-linejoin="round"/></svg>`);

// ───────────────────── photo stand-ins → one SVG picture ─────────────────────
// A photo's stand-in composition (rects, circles, ellipses, filled paths around the box centre) drawn
// as ONE svg the size of the box: in the editor it is an ordinary image layer the user replaces with
// their own picture, instead of a pile of shapes nobody can swap.
const rrPath = (x, y, w, h, r) => {   // r = [tl, tr, br, bl]
  const [a, b, c, d] = r.map((v) => Math.max(0, Math.min(v, w / 2, h / 2)));
  return `M${x + a} ${y}H${x + w - b}${b ? `A${b} ${b} 0 0 1 ${x + w} ${y + b}` : ''}V${y + h - c}${c ? `A${c} ${c} 0 0 1 ${x + w - c} ${y + h}` : ''}`
    + `H${x + d}${d ? `A${d} ${d} 0 0 1 ${x} ${y + h - d}` : ''}V${y + a}${a ? `A${a} ${a} 0 0 1 ${x + a} ${y}` : ''}Z`;
};
const photoSvg = (L, w, h) => {
  const n = (v) => r4(Number(v) || 0);
  const col = (c) => colorStr(c == null ? 'ink' : c);
  const out = [`<rect x="${n(-w / 2)}" y="${n(-h / 2)}" width="${n(w)}" height="${n(h)}" fill="${colorStr(L.fill ?? 'skel')}"/>`];
  for (const c of (L.ch || []).slice(0, L._n || 0)) {
    const pin = c.pin || 'c';
    const cw = c.type === 'circle' ? (c.d ?? c.w ?? 0) : (c.w ?? 0); const ch = c.type === 'circle' ? (c.d ?? c.h ?? 0) : (c.h ?? 0);
    const cx = (c.x || 0) + (pin.includes('l') ? cw / 2 : pin.includes('r') ? -cw / 2 : 0);
    const cy = (c.y || 0) + (pin.includes('t') ? ch / 2 : pin.includes('b') ? -ch / 2 : 0);
    const rot = c.rot ? ` transform="rotate(${n(c.rot)} ${n(cx)} ${n(cy)})"` : '';
    const f = ` fill="${col(c.fill)}"`;
    if (c.type === 'path') out.push(`<path d="${[].concat(c.d).join(' ')}"${f} transform="translate(${n(c.x)} ${n(c.y)})${c.rot ? ` rotate(${n(c.rot)})` : ''}"/>`);
    else if (c.type === 'ellipse' || c.type === 'circle' || c.d != null) out.push(`<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(cw / 2)}" ry="${n(ch / 2)}"${f}${rot}/>`);
    else if (c.radii) { const r = String(c.radii).match(/-?\d*\.?\d+/g) || []; out.push(`<path d="${rrPath(n(cx - cw / 2), n(cy - ch / 2), n(cw), n(ch), [0, 1, 2, 3].map((i) => +r[i] || 0))}"${f}${rot}/>`); }
    else out.push(`<rect x="${n(cx - cw / 2)}" y="${n(cy - ch / 2)}" width="${n(cw)}" height="${n(ch)}" rx="${n(Math.min(c.r || 0, cw / 2, ch / 2))}"${f}${rot}/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}" height="${n(h)}" viewBox="${n(-w / 2)} ${n(-h / 2)} ${n(w)} ${n(h)}" overflow="hidden">${out.join('')}</svg>`;
};

// shared with the After Effects export (ae-export.js)
K._int.svg = { parsePath, subpathToShape };
K._int.photoSvg = photoSvg;

// ───────────────────── the converter ─────────────────────
// Past this an item is too heavy to edit as layers (timeline rows, keyframes to scrub): it should
// declare formats: ['html'] (tools/check.mjs reports items that cross it without)
K.VE_LIMITS = { layers: 100, keys: 1500 };

K.toVE = function toVE(spec, opt = {}) {
  if (opt.theme || opt.accent || opt.colors) K.setTheme(opt.theme || 'light', opt.accent || null, opt.colors || null);
  // the project's frame: positions are stored as % of it, sizes stay px — so an element keeps its
  // pixel layout around the centre of any frame (a vertical project too)
  const W = Math.max(16, Math.round((opt.videoSize && opt.videoSize.w) || 1920));
  const HH = Math.max(16, Math.round((opt.videoSize && opt.videoSize.h) || 1080));
  const T = spec.T;
  const report = { approx: new Set(), items: 0, keys: 0 };
  const layers = K.build(spec);
  // a film may pick its own font (scenario.font): the editor loads it by name
  const TEXT_STACK = spec.font ? K.fontOf(spec.font).stack : TEXT_FONT;
  const clips = []; const items = []; // items in paint order
  const picClips = new Map();          // picture key → its clip id (shared media, see the image layers)
  let n = 0; const nid = (p) => `${spec.id}-${p}${++n}`;
  const clipFor = (type, name) => { const id = nid('c'); clips.push({ id, source: 'LOCAL', mediaType: type, url: '', proxyUrl: null, name, duration: T }); return id; };
  const mkItem = (type, name, extra) => {
    const it = {
      id: nid('i'), clipId: clipFor(type, name), customName: name, transition: 'None', transitionDuration: 0, trimStart: 0, trimEnd: T,
      speedPoints: [{ x: 0, y: 1 }, { x: 1, y: 1 }], zoom: 1, scaleX: 1, scaleY: 1, panX: 0, panY: 0, panZ: 0,
      rotateX: 0, rotateY: 0, rotateZ: 0, rotation: 0, opacity: 100, blendMode: 'normal', propertyKeyframes: {}, layerEffects: [], effects: [],
      ...extra,
    };
    items.push(it); return it;
  };
  const nullItem = (name, parentId) => mkItem('shape', name, {
    shapeType: 'rectangle', shapeSizeUnit: 'px', shapeWidthPx: 1, shapeHeightPx: 1, shapeFillColor: 'rgba(0,0,0,0)',
    ...(parentId ? { keyframeParenting: { parentItemId: parentId, type: 'additive' } } : {}),
  });
  const setTrack = (it, key, keys) => { if (keys && keys.length > 1 && !isStatic(keys)) it.propertyKeyframes[key] = keys; };

  // A value that may combine several lab tracks: parts [{ tr, base }] → combine(values[]).
  // `at(t)` evaluates it; `with(part, v)` = the value with that one part at v, the rest static.
  const combo = (parts, combine) => {
    const live = parts.filter((p) => p.tr && p.tr.segs.length);
    const mp = (p, v) => (p.map ? p.map(v) : v);
    const stat = (p) => mp(p, p.tr && p.tr.init !== undefined ? p.tr.init : p.base);
    const at = (t) => combine(parts.map((p) => mp(p, p.tr ? evalTrack(p.tr, p.base, t, false) : p.base)));
    return { live, at, v0: at(0), exact: parts.every((p) => !p.map), with: (part, v) => combine(parts.map((p) => (p === part ? mp(p, v) : stat(p)))) };
  };
  // Write a value to an editor track: EXACT (two keys per segment, same easing) when one part
  // animates, its segments don't interrupt each other and the value is affine in it; otherwise
  // sampled into Linear keys.
  const writeScalar = (it, key, s, map, affine = true) => {
    if (!s.live.length) return;
    if (s.live.length === 1 && affine && s.exact !== false) {
      const p = s.live[0];
      if (overlaps(p.tr)) report.approx.add(`${key}: interrupted segments — the cut-short part sampled`);
      setTrack(it, key, keysFromTrack(p.tr, p.base, T, (v) => map(s.with(p, v)), false, tolFor(key)));
      return;
    }
    report.approx.add(`${key}: sampled into Linear keys (${s.exact === false ? 'fades out under 1 px' : 'combines several animated values'})`);
    setTrack(it, key, keysFromFn(s.at, T, map, tolFor(key)));
  };
  const partOf = (L, p, def) => { const tr = trackOf(L, p); return { tr: tr && tr.segs.length ? tr : null, base: baseOf(L, p, def) }; };

  // Position (lab px, relative to the parent's origin) → panX/panY % + translate tracks (px).
  const writePosition = (it, sx, sy) => {
    it.panX = r4((sx.v0 / W) * 100); it.panY = r4((sy.v0 / HH) * 100);
    writeScalar(it, 'translateX', sx, (v) => v - sx.v0);
    writeScalar(it, 'translateY', sy, (v) => v - sy.v0);
  };
  // Rotation / scale / per-axis scale (static bases + multiplier tracks).
  // (the editor: rotate track ADDS to rotateZ, scale track MULTIPLIES zoom, scaleX/Y multiply)
  const writeTransform = (it, L) => {
    const rot = partOf(L, 'rot', 0);
    it.rotateZ = r4(normDeg(rot.base));
    if (rot.tr && rot.tr.segs.length) writeScalar(it, 'rotate', combo([rot], (v) => v[0]), (v) => v - rot.base);
    const scS = combo([partOf(L, 'scale', 1)], (v) => v[0]);
    if (!scS.live.length) it.zoom = r4(scS.v0);
    else writeScalar(it, 'scale', scS, (v) => v);
    for (const [p, f] of [['sx', 'scaleX'], ['sy', 'scaleY']]) {
      const part = partOf(L, p, 1);
      if (!part.tr) { it[f] = r4(part.base); continue; }
      writeScalar(it, f, combo([part], (v) => v[0]), (v) => v);
    }
    write3d(it, L);
  };
  const own3d = (L) => !!(L.rx || L.ry || L.depth || (L.k && (L.k.rx || L.k.ry || L.k.depth)));
  // 3D space: rx / ry → rotateX / rotateY (the engine uses the editor's senses), depth → panZ (+ toward the camera);
  // their tracks add to the static value, like rotate. Static angles fold into ±180, depth stays within ±3000.
  const write3d = (it, L) => {
    for (const [p, f, key, fold] of [['rx', 'rotateX', 'rotateX', true], ['ry', 'rotateY', 'rotateY', true], ['depth', 'panZ', 'translateZ', false]]) {
      const part = partOf(L, p, 0);
      if (!part.tr && !part.base) continue;
      const base = fold ? normDeg(part.base) : clamp(part.base, -3000, 3000);
      if (!fold && base !== part.base) report.approx.add(`depth ${part.base}: the editor keeps a layer's depth within ±3000`);
      it[f] = r4(base);
      if (part.tr) writeScalar(it, key, combo([part], (v) => v[0]), (v) => v - part.base);
    }
  };
  // Opacity × every ancestor's, blur + every ancestor's — pushed down onto a visual layer.
  const writeFade = (it, L, inh, extra = []) => {
    const ops = [partOf(L, 'opacity', 1), ...inh.ops, ...extra];
    const s = combo(ops, (v) => v.reduce((a, b) => a * b, 1));
    if (!s.live.length) it.opacity = r4(clamp(s.v0, 0, 1) * 100);
    else writeScalar(it, 'opacity', s, (v) => clamp(v, 0, 1));
    const blurs = [partOf(L, 'blur', 0), ...inh.blurs];
    const b = combo(blurs, (v) => v.reduce((a, c) => a + c, 0));
    if (b.live.length) writeScalar(it, 'blur', b, (v) => Math.max(0, v));
    else if (b.v0 > 0.05) it.propertyKeyframes.blur = [0, 100].map((position) => ({ position, value: String(r4(b.v0)), easing: 'Linear' }));
  };
  const colorTrack = (it, key, L, p) => {
    const tr = trackOf(L, p); if (!tr || !tr.segs.length) return;
    if (overlaps(tr)) report.approx.add(`${key}: interrupted colour segments — the cut-short part sampled`);
    // text and icons are ink unless told otherwise (the engine's rule) — a colour track starts there
    const base = baseOf(L, p, null) ?? (p === 'color' && (L.type === 'text' || L.type === 'icon') ? 'ink' : null);
    setTrack(it, key, keysFromTrack(tr, base, T, (v) => v, true));
  };
  const matte = (it, matteId) => { if (matteId) it.trackMatte = { sourceId: matteId, mode: 'alpha' }; };

  // ── walk ──
  const walk = (L, ctx) => {
    const type = L.type;
    // a photo without a real picture: ONE image layer drawing its stand-in (unless opt.photos = 'shapes')
    const standIn = L.media != null && !L.img && (type === 'rect' || type === 'ellipse') && opt.photos !== 'shapes';
    const kids = (standIn ? (L.ch || []).slice(L._n || 0) : (L.ch || []).slice()).sort((a, b) => (a.z || 0) - (b.z || 0));
    const isBox = type === 'rect' || type === 'ellipse' || (type === 'group' && L.clip);
    // box geometry
    const w = partOf(L, 'w', 0); const h = partOf(L, 'h', 0);
    let size = null;
    if (type === 'icon' || type === 'cursor') size = partOf(L, 'size', type === 'cursor' ? 46 : 40);
    const pin = L.pin || 'c';
    // the box centre sits at (x, y) + k·size; the cursor's box hangs from its arrow tip (3, 2.2 of 28),
    // which is (x, y) — so its centre is (½ − 3/28, ½ − 2.2/28) of its size below-right of the tip
    const kx = type === 'cursor' ? 0.5 - 3 / 28 : pin.includes('l') ? 0.5 : pin.includes('r') ? -0.5 : 0; // ox = kx·w
    const ky = type === 'cursor' ? 0.5 - 2.2 / 28 : pin.includes('t') ? 0.5 : pin.includes('b') ? -0.5 : 0;
    // pivot (lab transform origin) relative to the box centre, as a fraction of w/h
    const org = type === 'cursor' ? [3 / 28 - 0.5, 2.2 / 28 - 0.5] : (L.origin || [-kx, -ky]);
    const bw = size || w; const bh = size || h;
    // pivot position P = (x, y) + o + org·(w, h); box centre C = (x, y) + o
    const px = combo([partOf(L, 'x', 0), bw], (v) => v[0] + (kx + org[0]) * v[1]);
    const py = combo([partOf(L, 'y', 0), bh], (v) => v[0] + (ky + org[1]) * v[1]);
    const rotated = !!(trackOf(L, 'rot') || baseOf(L, 'rot', 0) || trackOf(L, 'rx') || baseOf(L, 'rx', 0) || trackOf(L, 'ry') || baseOf(L, 'ry', 0));
    const scaled = !!(trackOf(L, 'scale') || trackOf(L, 'sx') || trackOf(L, 'sy') || baseOf(L, 'scale', 1) !== 1 || baseOf(L, 'sx', 1) !== 1 || baseOf(L, 'sy', 1) !== 1);
    const pivotOff = Math.abs(org[0]) > 1e-6 || Math.abs(org[1]) > 1e-6;
    const needsJoint = kids.length > 0 || L.clip || type === 'text' || type === 'path' || type === 'cursor' || (pivotOff && (rotated || scaled));
    // children inherit this node's opacity / blur (pushed down)
    const inhKids = { ops: [partOf(L, 'opacity', 1), ...ctx.inh.ops], blurs: [partOf(L, 'blur', 0), ...ctx.inh.blurs] };
    const inhSelf = ctx.inh;
    let parentForVisual = ctx.parentId; let joint = null;
    if (needsJoint) {
      joint = nullItem(`${L.id || type} ▸ joint`, ctx.parentId);
      writePosition(joint, px, py);
      if (type === 'cursor' && ctx.camZoom) {
        // the cursor keeps one screen size: its scale ÷ the camera zoom
        const s = combo([partOf(L, 'scale', 1), ctx.camZoom], (v) => v[0] / v[1]);
        if (!s.live.length) joint.zoom = r4(s.v0); else writeScalar(joint, 'scale', s, (v) => v, !(ctx.camZoom.tr && ctx.camZoom.tr.segs.length));
        joint.rotateZ = r4(normDeg(baseOf(L, 'rot', 0)));
      } else writeTransform(joint, L);
      parentForVisual = joint.id;
    }
    // the visual's centre relative to its parent: C − P (joint) or C (direct)
    const cxRel = needsJoint ? combo([bw], (v) => -org[0] * v[0]) : combo([partOf(L, 'x', 0), bw], (v) => v[0] + kx * v[1]);
    const cyRel = needsJoint ? combo([bh], (v) => -org[1] * v[0]) : combo([partOf(L, 'y', 0), bh], (v) => v[0] + ky * v[1]);
    const place = (it, extraOps) => {
      if (parentForVisual) it.keyframeParenting = { parentItemId: parentForVisual, type: 'additive' };
      writePosition(it, cxRel, cyRel);
      if (!needsJoint) writeTransform(it, L);
      writeFade(it, L, inhSelf, extraOps);
      matte(it, ctx.matteId);
      if (L.blend) it.blendMode = L.blend;
    };

    if (type === 'rect' || type === 'ellipse') {
      const fill = baseOf(L, 'fill', null); const stroke = baseOf(L, 'stroke', null);
      // a stand-in photo's own fill is inside its picture: its box only draws when it casts a shadow / has a border
      const visible = (standIn ? (stroke || L.shadow) : (fill || stroke || L.shadow || trackOf(L, 'fill') || trackOf(L, 'stroke'))) && (w.tr || w.base >= 0.5) && (h.tr || h.base >= 0.5);
      if (visible) {
        const it = mkItem('shape', L.id || type, {
          shapeType: type === 'ellipse' ? 'ellipse' : 'rectangle', shapeSizeUnit: 'px',
          shapeWidthPx: r4(Math.max(1, w.base)), shapeHeightPx: r4(Math.max(1, h.base)),
          shapeFillColor: fill ? colorStr(fill) : 'rgba(0,0,0,0)',
        });
        // the editor's shapes are ≥ 1 px: while the lab's box is thinner, fade it instead
        const thin = (pt) => pt.base < 1 || (pt.tr && (pt.tr.init < 1 || pt.tr.segs.some((g) => g.v < 1)));
        place(it, [w, h].filter(thin).map((pt) => ({ tr: pt.tr, base: pt.base, map: (v) => clamp(v, 0, 1) })));
        if (w.tr) setTrack(it, 'shapeWidthPx', keysFromTrack(w.tr, w.base, T, (v) => Math.max(1, v), false));
        if (h.tr) setTrack(it, 'shapeHeightPx', keysFromTrack(h.tr, h.base, T, (v) => Math.max(1, v), false));
        if (type === 'rect' && L.notches) {
          // a notched ticket: one closed path — the bites are really cut, never painted over
          const shp = notchedShape(L, w.base, h.base);
          Object.assign(it, { shapeType: 'path', shapePath: { points: shp.points, closed: true } });
          if (w.tr || h.tr || trackOf(L, 'r')) report.approx.add('notched rect: outline is static (w / h / r tracks ignored)');
        } else if (type === 'rect') {
          if (L.radii) {
            const r = String(L.radii).match(/-?\d*\.?\d+/g) || [];
            Object.assign(it, { borderRadiusLinked: false, borderRadiusTL: +r[0] || 0, borderRadiusTR: +r[1] || 0, borderRadiusBR: +r[2] || 0, borderRadiusBL: +r[3] || 0 });
          } else it.borderRadius = r4(baseOf(L, 'r', 0));
          const rt = trackOf(L, 'r'); if (rt) setTrack(it, 'borderRadius', keysFromTrack(rt, baseOf(L, 'r', 0), T, (v) => Math.max(0, v), false));
        }
        colorTrack(it, 'shapeFill', L, 'fill');
        const sw = partOf(L, 'sw', 0);
        if (stroke || trackOf(L, 'stroke')) {
          it.borderWidth = r4(sw.base); it.borderColor = colorStr(stroke || '#ffffff'); it.borderStyle = L.dash ? 'dashed' : 'solid';
          if (sw.tr) setTrack(it, 'borderWidth', keysFromTrack(sw.tr, sw.base, T, (v) => Math.max(0, v), false));
          colorTrack(it, 'borderColor', L, 'stroke');
        }
        const sh = shadowsFor(L.shadow); if (sh) it.shadows = sh;
      }
    } else if (type === 'text') {
      const fs = baseOf(L, 'size', 40); const ax = L.ax ?? 0.5;
      const raw = L.num ? null : String(L.text ?? '');
      // the editor draws text on a frame-sized plate: a no-wrap text sits in a box of 86 % of the
      // frame width (textNoWrap), a wrapping one in its own width — ax anchors to that box's edge
      const est = L.wrap ? Math.min(W, L.wrap) : 0.86 * W;
      let content = raw;
      const it = mkItem('text', L.id || (raw || 'Text').slice(0, 24), {
        textColor: colorStr(baseOf(L, 'color', null) || 'ink'), textFontFamily: TEXT_STACK, textFontWeight: L.weight || 400,
        textFontSizeUnit: 'px', textFontSize: fs, textLineHeight: L.lh || 1.15,
        textLetterSpacing: r4(lsEm(baseOf(L, 'ls', 0)) * fs), textAlign: L.align || (ax === 0 ? 'left' : ax === 1 ? 'right' : 'center'),
        textWidthUnit: 'px', textWidthPx: r4(est), textNoWrap: !L.wrap,
        ...(L.italic ? { textFontStyle: 'italic' } : {}), ...(L.upper ? { textLetterCase: 'uppercase' } : {}),
      });
      // the text box's centre sits (0.5 − ax) × box width to the right of the anchor
      // and the editor sets a line 0.165 em higher than the lab's CSS line box (measured, every size)
      const boxOff = (0.5 - ax) * est;
      const cxT = combo([], () => boxOff); const cyT = combo([], () => TEXT_DY * fs);
      if (parentForVisual) it.keyframeParenting = { parentItemId: parentForVisual, type: 'additive' };
      writePosition(it, cxT, cyT);
      writeFade(it, L, inhSelf); matte(it, ctx.matteId); if (L.blend) it.blendMode = L.blend;
      colorTrack(it, 'textColor', L, 'color');
      const ls = trackOf(L, 'ls'); if (ls) setTrack(it, 'letterSpacing', keysFromTrack(ls, baseOf(L, 'ls', 0), T, (v) => lsEm(v) * fs, false));
      if (trackOf(L, 'size')) report.approx.add('font-size animation dropped (no editor track)');
      // {{{COUNTER}}} / {{{TIMER}}} tokens are the editor's own syntax: the text goes over as is,
      // and each keyed one's 'ph:<id>' track becomes the editor's 'ph:<id>' progress track
      for (const p of Object.keys(L.k || {})) {
        if (!/^ph:/.test(p)) continue;
        const tr = trackOf(L, p);
        it.propertyKeyframes[p] = keysFromTrack(tr, 0, T, (v) => clamp(v, 0, 100), false);
      }
      if (L.num) {
        // the lab's older `num` counter → the COUNTER token the lab itself draws it with
        const vt = trackOf(L, 'value'); const nt = K.placeholders.numToken(L, vt);
        if (nt) {
          content = nt.text;
          it.propertyKeyframes['ph:1'] = keysFromTrack(vt, baseOf(L, 'value', 0), T, nt.map, false);
          if (!nt.monotonic) report.approx.add('counter goes back and forth: keyed over its min…max range');
        } else {
          content = K._int.fmtNum(vt && vt.init !== undefined ? vt.init : baseOf(L, 'value', 0), L.num);
        }
      }
      it.textContent = content;
      const rv = trackOf(L, 'reveal');
      if (rv && rv.segs.length) {
        Object.assign(it, {
          textSplitEnabled: true, textSplitMode: 'symbols', textSplitStagger: 0.03, textSplitMask: 'none', textSplitTiming: 'progress',
          splitInEnabled: true, splitInDuration: 0.05, splitInEasing: 'EASE_OUT', splitInOpacity: 0, splitInX: 0, splitInY: 0, splitInScale: 1,
          splitInRotate: 0, splitInRotateX: 0, splitInRotateY: 0, splitInBlur: 0, splitOutEnabled: false,
        });
        it.propertyKeyframes.textRevealProgress = keysFromTrack(rv, baseOf(L, 'reveal', 1), T, (v) => v * 100, false);
      }
      if (L.caret) {
        // a caret needs the split units; Keyframes timing with the text fully revealed keeps the
        // layer's own keyframes (fades, moves) on the whole layer instead of per glyph
        if (!it.textSplitEnabled) {
          Object.assign(it, { textSplitEnabled: true, textSplitMode: 'symbols', textSplitTiming: 'progress', splitInEnabled: false, splitOutEnabled: false });
          it.propertyKeyframes.textRevealProgress = [0, 100].map((position) => ({ position, value: '100', easing: 'Linear' }));
        }
        Object.assign(it, { textCaretEnabled: true, textCaretColor: colorStr(L.caretColor || 'acc') });
        if (L.caretUntil != null) {
          const end = rv ? (rv.segs.length ? rv.segs[rv.segs.length - 1].t1 : 0) : 0;
          it.textCaretHideAfter = r4(Math.max(0, L.caretUntil - end));
        }
        if (L.caretFrom != null) report.approx.add('caret shows from the start (no caret-from in the editor)');
      }
    } else if (type === 'path') {
      const subs = [].concat(L.d).flatMap((d) => parsePath(d));
      const fill = baseOf(L, 'fill', null); const strokeC = baseOf(L, 'stroke', null);
      const stroked = !!(strokeC || trackOf(L, 'stroke') || !fill);
      if (subs.length > 1 && (trackOf(L, 'trimE') || trackOf(L, 'trimS'))) report.approx.add('multi-part path trimmed per part');
      for (const sub of subs) {
        const shp = subpathToShape(sub);
        const mk = (asLine) => {
          const it = mkItem('shape', `${L.id || 'path'}${asLine ? '' : ' fill'}`, {
            shapeType: asLine ? 'line' : 'path', shapeSizeUnit: 'px', shapeWidthPx: r4(shp.box.w), shapeHeightPx: r4(shp.box.h),
            shapePath: { points: shp.points, closed: asLine ? false : true },
            shapeFillColor: asLine ? colorStr(strokeC || 'ink') : colorStr(fill),
          });
          if (parentForVisual) it.keyframeParenting = { parentItemId: parentForVisual, type: 'additive' };
          writePosition(it, combo([], () => shp.box.cx), combo([], () => shp.box.cy));
          writeFade(it, L, inhSelf); matte(it, ctx.matteId); if (L.blend) it.blendMode = L.blend;
          if (asLine) {
            const sw = partOf(L, 'sw', 4);
            Object.assign(it, { lineWidth: r4(sw.base || 4), lineCap: L.cap || 'round', lineJoin: L.join || 'round', lineDash: 'solid' });
            if (sw.tr) setTrack(it, 'lineWidth', keysFromTrack(sw.tr, sw.base, T, (v) => Math.max(0, v), false));
            if (L.dash) { const dd = [].concat(L.dash); Object.assign(it, { lineDash: 'custom', lineDashPattern: [dd[0] || 10, dd[1] ?? dd[0] ?? 10, dd[2] || 0, dd[3] || 0] }); }
            for (const [p, key, def] of [['trimS', 'lineTrimStart', 0], ['trimE', 'lineTrimEnd', 100], ['trimO', 'lineTrimOffset', 0]]) {
              const part = partOf(L, p, def);
              if (part.base !== def) it[key] = r4(part.base);
              if (part.tr) setTrack(it, key, keysFromTrack(part.tr, part.base, T, (v) => v, false));
            }
            colorTrack(it, 'shapeFill', L, 'stroke');
          } else colorTrack(it, 'shapeFill', L, 'fill');
          return it;
        };
        if (fill) mk(false);
        if (stroked && (strokeC || trackOf(L, 'stroke') || !fill)) mk(true);
      }
    } else if (type === 'icon') {
      const paths = L.paths || K.ICONS[L.icon] || K.ICONS.dot;
      const sz = size.base;
      const it = mkItem('shape', L.id || L.icon || 'icon', {
        shapeType: 'custom', shapeSvgUrl: iconUri(paths, sz, L.sw ?? 2.2, !!L.filled), shapeSizeUnit: 'px', shapeWidthPx: sz, shapeHeightPx: sz,
        shapeFillColor: colorStr(L.filled ? (baseOf(L, 'fill', null) || baseOf(L, 'color', null) || 'ink') : (baseOf(L, 'color', null) || 'ink')),
      });
      place(it);
      colorTrack(it, 'shapeFill', L, 'color');
      if (size.tr) report.approx.add('icon size animation dropped (use scale)');
      if (trackOf(L, 'trimE') || trackOf(L, 'trimS')) report.approx.add('icon draw-on dropped (icons are silhouettes)');
    } else if (type === 'cursor') {
      const sz = size.base;
      for (const outline of [true, false]) {
        const it = mkItem('shape', outline ? 'cursor outline' : 'cursor', {
          shapeType: 'custom', shapeSvgUrl: cursorUri(outline), shapeSizeUnit: 'px', shapeWidthPx: sz, shapeHeightPx: sz,
          shapeFillColor: outline ? '#FFFFFF' : '#0B0B0B',
          ...(outline ? {} : { shadows: [{ x: 0, y: 2, blur: 3, spread: 0, color: 'rgba(0,0,0,0.25)', inset: false }] }),
        });
        place(it);
      }
    }

    // clip: a hidden matte shape the clipped layers read. The editor doesn't resolve a matte that
    // is itself matted, so a clip inside a clip is solved geometrically: when this box stays inside
    // the outer clip at every frame its own matte is exact; otherwise ONE matte = the two boxes'
    // intersection (world space, sampled) — or, while either box is rotated, this box alone.
    const frames = nodeFrames(L, ctx.M);
    let matteId = ctx.matteId; let region = ctx.region;
    if (L.clip && isBox) {
      const ts = []; for (let t = 0; t <= T + 1e-9; t += 1 / 30) ts.push(Math.min(t, T));
      const inner = ts.map((t) => frames.box(t));
      const outer = ctx.region ? ts.map((t) => ctx.region(t)) : null;
      const contained = !outer || inner.every((a, i) => a && outer[i] && fitsIn(a, outer[i]));
      const aligned = outer && inner.every(Boolean) && outer.every(Boolean) && type !== 'ellipse';
      // in 3D space the boxes are planes: the world-space intersection (a flat 2D matte) doesn't apply there
      const in3d = ctx.d3 || own3d(L);
      if (contained || !aligned || in3d) {
        if (!contained) report.approx.add(in3d ? 'clip inside a clip in 3D space: clipped by the inner box only' : 'clip inside a rotated clip: clipped by the inner box only');
        const m = mkItem('shape', `${L.id || type} ▸ matte`, { _matte: true,
          shapeType: type === 'ellipse' ? 'ellipse' : 'rectangle', shapeSizeUnit: 'px',
          shapeWidthPx: r4(Math.max(1, w.base)), shapeHeightPx: r4(Math.max(1, h.base)), shapeFillColor: '#FFFFFF',
          borderRadius: r4(baseOf(L, 'r', 0)),
          ...(L.notches ? { shapeType: 'path', shapePath: { points: notchedShape(L, w.base, h.base).points, closed: true } } : {}),
        });
        if (parentForVisual) m.keyframeParenting = { parentItemId: parentForVisual, type: 'additive' };
        writePosition(m, cxRel, cyRel);
        if (w.tr) setTrack(m, 'shapeWidthPx', keysFromTrack(w.tr, w.base, T, (v) => Math.max(1, v), false));
        if (h.tr) setTrack(m, 'shapeHeightPx', keysFromTrack(h.tr, h.base, T, (v) => Math.max(1, v), false));
        const rt = trackOf(L, 'r'); if (rt) setTrack(m, 'borderRadius', keysFromTrack(rt, baseOf(L, 'r', 0), T, (v) => Math.max(0, v), false));
        matteId = m.id; region = frames.box;
      } else {
        // the intersection of this box and the outer clip, in comp px
        const isect = (t) => {
          const a = frames.box(t); const b = ctx.region(t); if (!a || !b) return null;
          const x0 = Math.max(a.x0, b.x0); const x1 = Math.min(a.x1, b.x1); const y0 = Math.max(a.y0, b.y0); const y1 = Math.min(a.y1, b.y1);
          if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return null;
          return { x0, y0, x1, y1, a, b };
        };
        // each corner takes the radius of the box that owns both its edges (majority over time)
        const votes = { TL: [0, 0, 0], TR: [0, 0, 0], BR: [0, 0, 0], BL: [0, 0, 0] }; const rIn = []; const rOut = [];
        for (const t of ts) {
          const q = isect(t); if (!q) continue;
          rIn.push(q.a.r || 0); rOut.push(q.b.r || 0);
          const own = (x, y) => { const ia = Math.abs(x - (x === q.x0 ? q.a.x0 : q.a.x1)) < 0.5 && Math.abs(y - (y === q.y0 ? q.a.y0 : q.a.y1)) < 0.5;
            const ib = Math.abs(x - (x === q.x0 ? q.b.x0 : q.b.x1)) < 0.5 && Math.abs(y - (y === q.y0 ? q.b.y0 : q.b.y1)) < 0.5;
            return ia ? 0 : ib ? 1 : 2; };
          votes.TL[own(q.x0, q.y0)]++; votes.TR[own(q.x1, q.y0)]++; votes.BR[own(q.x1, q.y1)]++; votes.BL[own(q.x0, q.y1)]++;
        }
        const avg = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : 0);
        const cr = (v) => { const k = v.indexOf(Math.max(...v)); return r4(k === 0 ? avg(rIn) : k === 1 ? avg(rOut) : 0); };
        const cx = (t) => { const q = isect(t); return q ? (q.x0 + q.x1) / 2 : 0; }; const cy = (t) => { const q = isect(t); return q ? (q.y0 + q.y1) / 2 : 0; };
        const qw = (t) => { const q = isect(t); return q ? q.x1 - q.x0 : 1; }; const qh = (t) => { const q = isect(t); return q ? q.y1 - q.y0 : 1; };
        const m = mkItem('shape', `${L.id || type} ▸ matte (∩ outer clip)`, { _matte: true,
          shapeType: 'rectangle', shapeSizeUnit: 'px', shapeWidthPx: r4(Math.max(1, qw(0))), shapeHeightPx: r4(Math.max(1, qh(0))), shapeFillColor: '#FFFFFF',
          borderRadiusLinked: false, borderRadiusTL: cr(votes.TL), borderRadiusTR: cr(votes.TR), borderRadiusBR: cr(votes.BR), borderRadiusBL: cr(votes.BL),
        });
        m.panX = r4((cx(0) / W) * 100); m.panY = r4((cy(0) / HH) * 100);
        setTrack(m, 'translateX', keysFromFn(cx, T, (v) => v - cx(0)));
        setTrack(m, 'translateY', keysFromFn(cy, T, (v) => v - cy(0)));
        setTrack(m, 'shapeWidthPx', keysFromFn(qw, T, (v) => Math.max(1, v)));
        setTrack(m, 'shapeHeightPx', keysFromFn(qh, T, (v) => Math.max(1, v)));
        if (ts.some((t) => !isect(t))) setTrack(m, 'opacity', keysFromFn((t) => (isect(t) ? 1 : 0), T, (v) => v, 0.001));
        report.approx.add('clip inside clip: one matte = the intersection of both boxes (sampled)');
        matteId = m.id;
        region = (t) => { const q = isect(t); return q ? { x0: q.x0, y0: q.y0, x1: q.x1, y1: q.y1, r: Math.min(q.a.r || 0, q.b.r || 0) } : { x0: 0, y0: 0, x1: 0, y1: 0, r: 0 }; };
      }
    }
    if (L.media != null && !L.img && !standIn) report.approx.add('photo → its stand-in composition (shapes); swap in an image layer');
    // img: the picture as an editor IMAGE layer, cover/contain-scaled into the box and matted by it.
    // The editor draws an image at its own pixel size while it fits the frame (fit-contained beyond),
    // so the scale needs the file's size: opt.imageSizes = { [url]: { w, h } }. A stand-in photo is
    // the same, with its composition as an svg of exactly the box's size. Identical pictures (tiles,
    // slats, copies of one photo) share ONE clip: the user replaces that media once. Layers with the same
    // `src` share one clip; a screen stand-in (v 'desktop' / 'phone' — every screen looks alike, each is
    // its own screenshot) shares only with its copies (the same id).
    // a photo's picture has the photo's own size (w / h tracks CROP it — they never re-lay it out)
    const picW = Number.isFinite(L.w) ? L.w : w.base; const picH = Number.isFinite(L.h) ? L.h : h.base;
    const pic = L.img ? String(L.img) : standIn ? svgUri(photoSvg(L, picW, picH)) : null;
    if (pic && isBox) {
      const im = mkItem('image', `${L.id || (standIn ? 'photo' : 'image')} · picture`, {});
      const clip = clips[clips.length - 1];
      const key = L.src ? `src:${L.src}` : standIn && typeof L.media === 'string' ? (L.id ? `id:${L.id}` : null) : `url:${pic}`;
      const shared = key ? picClips.get(key) : null;   // { id, nat }: a copy scales the SHARED picture
      if (shared) { clips.pop(); im.clipId = shared.id; }
      else if (key) picClips.set(key, { id: clip.id, nat: standIn ? { w: picW, h: picH } : null });
      if (!shared) Object.assign(clip, { source: 'REMOTE', url: pic, name: standIn ? `Photo ${L.id || ''}`.trim() + ' (placeholder — replace it)' : pic.split('/').pop() });
      const nat = (shared && shared.nat) || (standIn ? { w: picW, h: picH } : (opt.imageSizes || {})[L.img]);
      if (nat && nat.w > 0 && nat.h > 0) {
        const m = Math.min(1, W / nat.w, HH / nat.h);
        im.zoom = r4((L.fit === 'contain' ? Math.min : Math.max)(picW / (nat.w * m), picH / (nat.h * m)));
      } else report.approx.add(`image "${L.img}": size unknown — placed at its own size (pass opt.imageSizes)`);
      // the editor keeps every item's zoom within [0.1, 20] (its sanitiser): a big picture in a small box
      // (an avatar, a thumbnail, a nested screen) needs less — the rest of its scale goes to size nulls
      // placed where the picture sits, the picture at their origin
      let imParent = parentForVisual; let sized = false;
      const Z0 = 0.1, Z1 = 20;
      if (im.zoom != null && (im.zoom < Z0 || im.zoom > Z1)) {
        let rest = im.zoom / Math.min(Z1, Math.max(Z0, im.zoom));
        im.zoom = r4(Math.min(Z1, Math.max(Z0, im.zoom)));
        while (Math.abs(rest - 1) > 1e-9) {
          const f = Math.min(Z1, Math.max(Z0, rest));
          const nul = nullItem(`${L.id || 'picture'} ▸ size`, imParent);
          if (!sized) writePosition(nul, cxRel, cyRel);
          nul.zoom = r4(f); imParent = nul.id; rest /= f; sized = true;
        }
      }
      if (imParent) im.keyframeParenting = { parentItemId: imParent, type: 'additive' };
      if (sized) writePosition(im, combo([], () => 0), combo([], () => 0)); else writePosition(im, cxRel, cyRel);
      writeFade(im, L, inhSelf); matte(im, L.clip ? matteId : ctx.matteId);
    }

    // children: parented to the joint, positioned from the children container
    if (kids.length) {
      let kidParent = parentForVisual;
      const chAtPin = L.chAt === 'pin';
      // children origin relative to the pivot: box centre (C − P) or the pin point
      const ccx = chAtPin ? combo([bw], (v) => -(kx + org[0]) * v[0]) : cxRel;
      const ccy = chAtPin ? combo([bh], (v) => -(ky + org[1]) * v[0]) : cyRel;
      const needsHub = (ccx.live.length || ccx.v0 !== 0 || ccy.live.length || ccy.v0 !== 0);
      if (needsHub) {
        const hub = nullItem(`${L.id || type} ▸ children`, parentForVisual);
        writePosition(hub, ccx, ccy);
        kidParent = hub.id;
      }
      for (const ch of kids) walk(ch, { parentId: kidParent, inh: inhKids, matteId, region, M: frames.kids, camZoom: ctx.camZoom, d3: ctx.d3 || own3d(L) });
    }
  };

  // camera → root joint
  let rootId = null; let camZoom = null; let tiltId = null;
  const cam = typeof spec.cam === 'number' ? { zoom: spec.cam } : (spec.cam || null);
  if (cam) {
    const z = { tr: cam.k && cam.k.zoom ? normTrack(cam.k.zoom, 'x') : null, base: cam.zoom ?? 1 };
    const cx = { tr: cam.k && cam.k.x ? normTrack(cam.k.x, 'x') : null, base: cam.x ?? 0 };
    const cy = { tr: cam.k && cam.k.y ? normTrack(cam.k.y, 'x') : null, base: cam.y ?? 0 };
    // a camera that tilts or dollies: a joint above the root (rotateX / rotateY / panZ) — the world turns around the
    // framed point, like the lab's translate3d(0, 0, dolly) rotateX rotateY above scale(zoom) translate(−focus)
    if (['tiltX', 'tiltY', 'dolly'].some((p) => cam[p] || (cam.k && cam.k[p]))) {
      const tilt = nullItem('camera ▸ tilt', null);
      write3d(tilt, { rx: cam.tiltX || 0, ry: cam.tiltY || 0, depth: cam.dolly || 0, k: { ...(cam.k && cam.k.tiltX ? { rx: cam.k.tiltX } : {}), ...(cam.k && cam.k.tiltY ? { ry: cam.k.tiltY } : {}), ...(cam.k && cam.k.dolly ? { depth: cam.k.dolly } : {}) } });
      tiltId = tilt.id;
    }
    const root = nullItem('camera', tiltId);
    const sz = combo([z], (v) => v[0]);
    if (!sz.live.length) root.zoom = r4(sz.v0); else writeScalar(root, 'scale', sz, (v) => v);
    writePosition(root, combo([z, cx], (v) => -v[0] * v[1]), combo([z, cy], (v) => -v[0] * v[1]));
    rootId = root.id; camZoom = z;
  }
  // the lab root: scale(zoom) translate(−focus) — comp px, centre = 0
  const camM = (t) => {
    if (!cam) return mT(0, 0);
    const g = (p, d) => (cam.k && cam.k[p] ? evalTrack(normTrackC(p), cam[p] ?? d, t, false) : (cam[p] ?? d));
    const z = g('zoom', 1); return mMul(mRS(0, z, z), mT(-g('x', 0), -g('y', 0)));
  };
  const camTr = {}; const normTrackC = (p) => camTr[p] || (camTr[p] = normTrack(cam.k[p], 'x'));
  for (const L of layers) walk(L, { parentId: rootId, inh: { ops: [], blurs: [] }, matteId: null, region: null, M: camM, camZoom, d3: !!tiltId });

  // a matte nothing reads is not hidden by the editor — it would paint as a white box (e.g. a clip box
  // whose only content is a photo that brings its own matte): drop it, and its clip
  const used = new Set(items.map((it) => it.trackMatte && it.trackMatte.sourceId).filter(Boolean));
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]; const isMatte = it._matte; delete it._matte;
    if (isMatte && !used.has(it.id)) { items.splice(i, 1); const ci = clips.findIndex((c) => c.id === it.clipId); if (ci >= 0) clips.splice(ci, 1); }
  }
  // one channel per item, in paint order (channels[0] draws at the bottom)
  const channels = items.map((it, i) => ({ id: `${spec.id}-ch${i + 1}`, name: it.customName || `Layer ${i + 1}`, visible: true, items: [it] }));
  report.items = items.length;
  report.keys = items.reduce((a, it) => a + Object.values(it.propertyKeyframes).reduce((b, k) => b + k.length, 0), 0);
  return {
    preset: { version: 1, kind: 've-sequence-preset', name: spec.name, duration: T, videoSize: { w: W, h: HH }, sequence: { clips, channels } },
    report: { items: report.items, keys: report.keys, approx: [...report.approx] },
  };
};
})();
