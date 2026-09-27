/* UI Motion Kit → After Effects (ExtendScript .jsx).
 *
 * UIK.toAE(spec, { theme, accent, fps, name, videoSize, imageSizes, files }) returns ONE .jsx: run it in After Effects
 * (File ▸ Scripts ▸ Run Script File…, or an agent's runner) and it builds a comp with native layers —
 * no plug-ins (pictures, if any, are imported from next to it). It works from the Video Editor preset the converter makes (converter.js),
 * so the two exports can never disagree about structure:
 *   parent nulls (anchor at their origin)      → AE nulls, parented
 *   rectangle / ellipse / notched path / line   → shape layers (rect roundness, path tangents, Trim Paths)
 *   custom-SVG icons and the cursor             → shape layers from the SVG path data
 *   text                                         → text layers (Helvetica Neue; tracking; justification);
 *                                                  typing = a Text Animator (opacity, range Start keyed);
 *                                                  COUNTER / TIMER placeholders = a Source Text expression
 *                                                  reading a keyed "Progress" slider
 *   pictures (img)                                → footage layers (the files sit next to the .jsx:
 *                                                  opt.files = { url: 'assets/x.png' }, sizes from opt.imageSizes)
 *   track mattes                                  → setTrackMatte(alpha), matte layers disabled
 *   blur / drop shadow                            → Gaussian Blur (3.55 σ) / Drop Shadow
 * Keyframe easings become AE temporal ease (exact cubic-bezier maths); curves that aren't one bezier
 * (bounce, elastic) are baked into linear keys.
 */
(function () {
'use strict';
const K = window.UIK;
const r4 = (v) => Math.round(v * 10000) / 10000;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ── easings → cubic bezier (fitted once from the editor's own curves) ──
const bezierY = (x1, y1, x2, y2) => {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = (t) => ((ax * t + bx) * t + cx) * t, Y = (t) => ((ay * t + by) * t + cy) * t, dX = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (u) => { if (u <= 0) return 0; if (u >= 1) return 1; let t = u; for (let i = 0; i < 8; i++) { const e = X(t) - u; if (Math.abs(e) < 1e-6) return Y(t); const d = dX(t); if (Math.abs(d) < 1e-6) break; t -= e / d; } let a = 0, b = 1; t = u; for (let i = 0; i < 40; i++) { const x = X(t); if (Math.abs(x - u) < 1e-6) break; if (x < u) a = t; else b = t; t = (a + b) / 2; } return Y(t); };
};
const FIT = {};
function easingBezier(name) {
  if (!name || name === 'Linear') return 'linear';
  if (name === 'Hold') return 'hold';
  if (FIT[name] !== undefined) return FIT[name];
  const c = (window.UIK_EASINGS || {})[name];
  if (!c) return (FIT[name] = 'linear');
  if (c.b) return (FIT[name] = c.b.slice());
  const f = K.ease(name); const xs = []; for (let i = 1; i < 40; i++) xs.push(i / 40);
  const err = (p) => { const g = bezierY(p[0], p[1], p[2], p[3]); let e = 0; for (const x of xs) { const d = g(x) - f(x); e += d * d; } return e; };
  // Nelder–Mead over (x1, y1, x2, y2), x kept in [0, 1]
  const fix = (p) => [clamp(p[0], 0.001, 1), p[1], clamp(p[2], 0, 0.999), p[3]];
  let simplex = [[0.4, 0, 0.2, 1], [0.7, 0, 0.3, 1], [0.3, 0.3, 0.7, 0.9], [0.5, 0.1, 0.5, 0.9], [0.2, 0.8, 0.4, 1]].map(fix);
  for (let it = 0; it < 900; it++) {
    simplex.sort((a, b) => err(a) - err(b));
    const best = simplex[0], worst = simplex[4];
    const cen = [0, 1, 2, 3].map((d) => simplex.slice(0, 4).reduce((s, p) => s + p[d], 0) / 4);
    const refl = fix(cen.map((c2, d) => c2 + (c2 - worst[d])));
    if (err(refl) < err(best)) { const exp = fix(cen.map((c2, d) => c2 + 2 * (c2 - worst[d]))); simplex[4] = err(exp) < err(refl) ? exp : refl; }
    else if (err(refl) < err(simplex[3])) simplex[4] = refl;
    else { const con = fix(cen.map((c2, d) => c2 + 0.5 * (worst[d] - c2))); if (err(con) < err(worst)) simplex[4] = con; else simplex = simplex.map((p) => fix(p.map((v, d) => best[d] + 0.5 * (v - best[d])))); }
  }
  simplex.sort((a, b) => err(a) - err(b));
  const p = simplex[0]; const g = bezierY(...p);
  const worstErr = Math.max(...xs.map((x) => Math.abs(g(x) - f(x))));
  return (FIT[name] = worstErr < 0.012 ? p.map(r4) : 'bake');
}

// ── Video Editor keys → AE keys ──
// A track = { keys: [[t, v]…], segs: ['linear' | 'hold' | [x1,y1,x2,y2]…] }. `bake` segments are
// expanded into linear keys sampled from the editor's own easing (bounce, elastic…).
function trackFrom(veKeys, T, map = (v) => Number(v)) {
  if (!Array.isArray(veKeys) || !veKeys.length) return null;
  const pts = veKeys.slice().sort((a, b) => a.position - b.position);
  const keys = []; const segs = [];
  for (let i = 0; i < pts.length; i++) {
    const t = r4((pts[i].position / 100) * T); const v = map(pts[i].value);
    keys.push([t, v]);
    if (i === pts.length - 1) break;
    const e = easingBezier(pts[i].easing);
    if (e !== 'bake') { segs.push(e); continue; }
    const t1 = (pts[i + 1].position / 100) * T; const v1 = map(pts[i + 1].value); const f = K.ease(pts[i].easing);
    const n = Math.max(4, Math.ceil((t1 - t) * 30));
    for (let j = 1; j < n; j++) {
      const u = f(j / n);
      keys.push([r4(t + ((t1 - t) * j) / n), Array.isArray(v) ? v.map((a, d) => a + (v1[d] - a) * u) : v + (v1 - v) * u]); segs.push('linear');
    }
    segs.push('linear');
  }
  return keys.length > 1 ? { keys, segs } : null;
}
const rgba = (c) => {
  const m = String(c || '').match(/[\d.]+/g) || [0, 0, 0, 0];
  if (/^#/.test(String(c))) { let h = String(c).slice(1); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255, h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1]; }
  return [(+m[0] || 0) / 255, (+m[1] || 0) / 255, (+m[2] || 0) / 255, m[3] != null ? +m[3] : 1];
};
const col3 = (c) => rgba(c).slice(0, 3).map(r4);
// a property that is static or keyed (one track), in AE units
const prop = (v, track) => (track ? { v, ...track } : { v });

// ── SVG data URI (custom shapes) → path list ──
function svgPaths(uri, w, h) {
  let svg = '';
  const b64 = String(uri).split('base64,')[1];
  if (b64) svg = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
  else svg = decodeURIComponent(String(uri).split(',').slice(1).join(','));
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1];
  const [vx, vy, vw, vh] = vb ? vb.split(/[\s,]+/).map(Number) : [0, 0, 24, 24];
  const k = Math.min(w / vw, h / vh);
  const out = [];
  const re = /<path\b([^>]*)\/?>/g; let m;
  while ((m = re.exec(svg))) {
    const attr = (n) => (m[1].match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1];
    const d = attr('d'); if (!d) continue;
    const fill = attr('fill'); const stroke = attr('stroke'); const sw = Number(attr('stroke-width') || 0);
    for (const sub of K._int.svg.parsePath(d)) {
      const vs = []; const ins = []; const outs = [];
      const pt = (x, y) => [r4((x - vx - vw / 2) * k), r4((y - vy - vh / 2) * k)];
      vs.push(pt(sub.start[0], sub.start[1])); ins.push([0, 0]); outs.push([0, 0]);
      for (const g of sub.segs) {
        outs[outs.length - 1] = [r4((g[2] - g[0]) * k), r4((g[3] - g[1]) * k)];
        vs.push(pt(g[6], g[7])); ins.push([r4((g[4] - g[6]) * k), r4((g[5] - g[7]) * k)]); outs.push([0, 0]);
      }
      if (sub.closed && vs.length > 2) { const a = vs[0], b = vs[vs.length - 1]; if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01) { ins[0] = ins.pop(); vs.pop(); outs.pop(); } }
      out.push({ v: vs, i: ins, o: outs, closed: !!sub.closed, fill: fill && fill !== 'none', stroke: stroke && stroke !== 'none' && sw > 0 ? r4(sw * k) : 0 });
    }
  }
  return out;
}

// ── placeholder tokens → a Source Text expression + its progress sliders ──
const TOKEN_RE = /\{\{\{\s*(COUNTER|TIMER)\s*:([^{}]*?)\}\}\}/gi;
function numberExpression(text, item, T, sliders) {
  const P = K.placeholders; if (!P) return null;
  const parts = []; let last = 0; let m; let n = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text))) {
    const units = P.parse(m[0]); const u = units && units.find((x) => x.spec); if (!u) continue;
    if (m.index > last) parts.push(JSON.stringify(text.slice(last, m.index)));
    n += 1; const name = `Progress ${n}`; const s = u.s; const sp = u.spec;
    // the slider carries the eased 0–100 progress: the ph track, or start / duration / easing
    const ph = s.kf && item.propertyKeyframes && item.propertyKeyframes[`ph:${s.kf}`];
    sliders.push({ name, ...(ph ? trackFrom(ph, T) : { keys: [[r4(s.delay), 0], [r4(s.delay + s.duration), 100]], segs: [easingBezier(s.ease)] }) });
    const cols = sp.cols.slice().reverse();
    // the editor's Count: floor counting up, ceil counting down, then the column format
    parts.push(`(function(){var p=clamp(effect(${JSON.stringify(name)})("Slider")/100,0,1);var raw=${sp.from}+(${sp.to - sp.from})*p;`
      + `var v=${sp.to >= sp.from ? 'Math.floor(raw+1e-6)' : 'Math.ceil(raw-1e-6)'};var u=Math.abs(v);var cols=${JSON.stringify(cols.map((c) => [c.place, c.radix, c.lead ? 1 : 0]))};`
      + `var seps=${JSON.stringify(sp.sepRight)};var out='';for(var j=0;j<cols.length;j++){var c=cols[j];var idx=cols.length-1-j;if(c[2]&&u<c[0])continue;`
      + `out+=Math.floor(u/c[0])%c[1];if(idx>0&&seps[idx])out+=seps[idx];}return (v<0?'-':'')+out;})()`);
    last = m.index + m[0].length;
  }
  if (!n) return null;
  if (last < text.length) parts.push(JSON.stringify(text.slice(last)));
  return parts.join('+');
}
const plainText = (text) => String(text).replace(TOKEN_RE, (m) => {
  const units = K.placeholders && K.placeholders.parse(m); const u = units && units.find((x) => x.spec);
  return u ? '0'.repeat(Math.max(1, u.spec.cols.length)) : m;
});

// ── the converter's preset → the AE layer list ──
function layersFrom(preset, W, H, T, files = {}, sizes = {}) {
  const items = preset.sequence.channels.map((c) => c.items[0]).filter(Boolean);
  const clipOf = new Map(preset.sequence.clips.map((c) => [c.id, c]));
  const index = new Map(items.map((it, i) => [it.id, i]));
  const isNull = (it) => it.shapeType === 'rectangle' && it.shapeWidthPx <= 1 && it.shapeHeightPx <= 1 && /rgba\(0,\s*0,\s*0,\s*0\)/.test(String(it.shapeFillColor));
  const kf = (it, k) => it.propertyKeyframes && it.propertyKeyframes[k];
  return items.map((it) => {
    const parented = !!(it.keyframeParenting && index.has(it.keyframeParenting.parentItemId));
    // position: % of the frame from its centre (+ px translate tracks); children: an offset from the parent
    const px = ((Number(it.panX) || 0) / 100) * W + (parented ? 0 : W / 2);
    const py = ((Number(it.panY) || 0) / 100) * H + (parented ? 0 : H / 2);
    const clip = clipOf.get(it.clipId) || {};
    // an image: AE shows footage at its own pixels, the editor at min(1, frame / picture) of them
    const nat = clip.mediaType === 'image' ? sizes[clip.url] : null;
    const plate = nat && nat.w > 0 && nat.h > 0 ? Math.min(1, W / nat.w, H / nat.h) : 1;
    const L = {
      name: it.customName || it.id, kind: clip.mediaType === 'image' ? 'image' : isNull(it) ? 'null' : it.shapeType ? 'shape' : 'text',
      parent: parented ? index.get(it.keyframeParenting.parentItemId) : null,
      matte: it.trackMatte && index.has(it.trackMatte.sourceId) ? index.get(it.trackMatte.sourceId) : null,
      x: prop(r4(px), trackFrom(kf(it, 'translateX'), T, (v) => r4(px + Number(v)))),
      y: prop(r4(py), trackFrom(kf(it, 'translateY'), T, (v) => r4(py + Number(v)))),
      rot: prop(r4(Number(it.rotateZ) || 0), trackFrom(kf(it, 'rotate'), T, (v) => r4((Number(it.rotateZ) || 0) + Number(v)))),
      scale: prop(r4((Number(it.zoom) || 1) * plate * 100), trackFrom(kf(it, 'scale'), T, (v) => r4((Number(it.zoom) || 1) * plate * Number(v) * 100))),
      sx: prop(r4((Number(it.scaleX) || 1) * 100), trackFrom(kf(it, 'scaleX'), T, (v) => r4(Number(v) * 100))),
      sy: prop(r4((Number(it.scaleY) || 1) * 100), trackFrom(kf(it, 'scaleY'), T, (v) => r4(Number(v) * 100))),
      opacity: prop(r4(Number(it.opacity ?? 100)), trackFrom(kf(it, 'opacity'), T, (v) => r4(clamp(Number(v), 0, 1) * 100))),
      // 3D space: After Effects' axes point right / down / INTO the screen, so from the editor's rotateX (+ top away),
      // rotateY (+ right edge toward the viewer) and panZ (+ toward the camera): X rotation = −rotateX, Y rotation =
      // rotateY, z = −panZ (the editor's keys add to its static value)
      rx: prop(r4(-(Number(it.rotateX) || 0)), trackFrom(kf(it, 'rotateX'), T, (v) => r4(-((Number(it.rotateX) || 0) + Number(v))))),
      ry: prop(r4(Number(it.rotateY) || 0), trackFrom(kf(it, 'rotateY'), T, (v) => r4((Number(it.rotateY) || 0) + Number(v)))),
      z: prop(r4(-(Number(it.panZ) || 0)), trackFrom(kf(it, 'translateZ'), T, (v) => r4(-((Number(it.panZ) || 0) + Number(v))))),
      blur: kf(it, 'blur') ? trackFrom(kf(it, 'blur'), T, (v) => r4(Number(v) * 3.55)) || { v: r4(Number(kf(it, 'blur')[0].value) * 3.55) } : null,
    };
    if (L.kind === 'image') {
      // the file sits next to the .jsx (files: url → path relative to the script)
      L.src = files[clip.url] || 'assets/' + String(clip.url || '').split('/').pop();
    } else if (L.kind === 'shape') {
      const w = Number(it.shapeWidthPx) || 1; const h = Number(it.shapeHeightPx) || 1;
      const fill = { v: col3(it.shapeFillColor), a: rgba(it.shapeFillColor)[3], ...(trackFrom(kf(it, 'shapeFill'), T, (c) => col3(c)) || {}) };
      const S = { w, h, fill };
      if (it.shapeType === 'rectangle' || it.shapeType === 'ellipse') {
        S.type = it.shapeType === 'ellipse' ? 'ellipse' : 'rect';
        S.size = prop([w, h], null);
        const wT = trackFrom(kf(it, 'shapeWidthPx'), T); const hT = trackFrom(kf(it, 'shapeHeightPx'), T);
        if (wT || hT) {   // size keys: both dimensions on one property — sample when only one is keyed
          const at = (tr, base, t) => { if (!tr) return base; const ks = tr.keys; if (t <= ks[0][0]) return ks[0][1]; for (let i = 0; i < ks.length - 1; i++) if (t <= ks[i + 1][0]) { const u = (t - ks[i][0]) / (ks[i + 1][0] - ks[i][0]); const e = tr.segs[i]; const f = e === 'hold' ? () => 0 : Array.isArray(e) ? bezierY(...e) : (x) => x; return ks[i][1] + (ks[i + 1][1] - ks[i][1]) * f(u); } return ks[ks.length - 1][1]; };
          const src = wT && hT ? null : (wT || hT);
          if (src) S.size = { v: [w, h], keys: src.keys.map(([t]) => [t, [r4(at(wT, w, t)), r4(at(hT, h, t))]]), segs: src.segs };
          else { const ts = []; for (let t = 0; t <= T + 1e-6; t += 1 / 30) ts.push(r4(t)); S.size = { v: [w, h], keys: ts.map((t) => [t, [r4(at(wT, w, t)), r4(at(hT, h, t))]]), segs: ts.slice(1).map(() => 'linear') }; }
        }
        S.radius = prop(r4(Number(it.borderRadius) || 0), trackFrom(kf(it, 'borderRadius'), T));
        if (it.borderRadiusLinked === false) S.radii = [it.borderRadiusTL, it.borderRadiusTR, it.borderRadiusBR, it.borderRadiusBL].map((v) => Number(v) || 0);
      } else if ((it.shapeType === 'path' || it.shapeType === 'line') && it.shapePath) {
        S.type = 'path';
        const pts = it.shapePath.points || [];
        S.paths = [{ v: pts.map((p) => [r4(p.x * w), r4(p.y * h)]), i: pts.map((p) => [r4((p.hIn?.x || 0) * w), r4((p.hIn?.y || 0) * h)]), o: pts.map((p) => [r4((p.hOut?.x || 0) * w), r4((p.hOut?.y || 0) * h)]), closed: !!it.shapePath.closed, fill: it.shapeType !== 'line', stroke: 0 }];
        if (it.shapeType === 'line') {
          S.stroke = { width: prop(Number(it.lineWidth) || 4, trackFrom(kf(it, 'lineWidth'), T)), color: fill, cap: it.lineCap || 'round', join: it.lineJoin || 'round', dash: it.lineDash === 'custom' ? it.lineDashPattern : null };
          S.fill = null;
          S.trim = {
            start: prop(Number(it.lineTrimStart) || 0, trackFrom(kf(it, 'lineTrimStart'), T)),
            end: prop(it.lineTrimEnd != null ? Number(it.lineTrimEnd) : 100, trackFrom(kf(it, 'lineTrimEnd'), T)),
            offset: prop((Number(it.lineTrimOffset) || 0) * 3.6, trackFrom(kf(it, 'lineTrimOffset'), T, (v) => Number(v) * 3.6)),
          };
        }
      } else if (it.shapeType === 'custom' && it.shapeSvgUrl) {
        S.type = 'path'; S.paths = svgPaths(it.shapeSvgUrl, w, h);
        S.svgColor = true;
      }
      if (Number(it.borderWidth) > 0 && it.borderColor) {
        S.border = { width: prop(Number(it.borderWidth), trackFrom(kf(it, 'borderWidth'), T)), color: { v: col3(it.borderColor), ...(trackFrom(kf(it, 'borderColor'), T, (c) => col3(c)) || {}) }, dashed: it.borderStyle === 'dashed' };
      }
      if (Array.isArray(it.shadows) && it.shadows.length) {
        const s = it.shadows.reduce((a, b) => ((b.blur || 0) > (a.blur || 0) ? b : a));
        const c = rgba(s.color);
        L.shadow = { color: c.slice(0, 3).map(r4), opacity: r4(c[3] * 255), distance: r4(Math.hypot(s.x || 0, s.y || 0)), direction: r4(((Math.atan2(s.x || 0, -(s.y || 0)) * 180) / Math.PI + 360) % 360), softness: r4((s.blur || 0) * 2.53) };
      }
      L.shape = S;
    } else {
      const fs = Number(it.textFontSize) || 40; const wgt = Number(it.textFontWeight) || 400;
      const text = String(it.textContent ?? '');
      const sliders = [];
      const expr = numberExpression(text, it, T, sliders);
      L.text = {
        text: plainText(text), expr, sliders,
        font: psFont(it.textFontFamily, wgt),
        size: fs, color: { v: col3(it.textColor || '#0B0B0B'), ...(trackFrom(kf(it, 'textColor'), T, (c) => col3(c)) || {}) },
        tracking: r4(((Number(it.textLetterSpacing) || 0) / fs) * 1000),
        trackingKeys: trackFrom(kf(it, 'letterSpacing'), T, (v) => Number(v)),
        just: it.textAlign === 'left' ? 'left' : it.textAlign === 'right' ? 'right' : 'center',
        leading: r4((Number(it.textLineHeight) || 1.15) * fs),
        boxW: it.textNoWrap ? null : Number(it.textWidthPx) || null,
        // the editor's box centre → the AE text origin (baseline at the left / centre / right edge)
        dx: it.textAlign === 'left' ? -((Number(it.textWidthPx) || 0.86 * W) / 2) : it.textAlign === 'right' ? (Number(it.textWidthPx) || 0.86 * W) / 2 : 0,
        dy: r4(0.233 * fs),
        reveal: it.textSplitTiming === 'progress' && kf(it, 'textRevealProgress') ? trackFrom(kf(it, 'textRevealProgress'), T) : null,
      };
    }
    return L;
  });
}

// ── the ExtendScript side (ES3): builds the comp from DATA ──
const PRELUDE = `
var GL = GL || (function () {
  var logPath = (typeof GL_LOG_PATH !== 'undefined') ? GL_LOG_PATH : (Folder.temp.fsName + '/greenlight-motion-ae.log');
  function str(v) { try { if (v === null || v === undefined) return String(v); if (v instanceof Error) return String(v.name) + ': ' + String(v.message) + (v.line !== undefined ? ' (line ' + String(v.line) + ')' : ''); return String(v); } catch (e) { return '<unprintable>'; } }
  function log() { var p = []; for (var i = 0; i < arguments.length; i++) p.push(str(arguments[i])); try { var f = new File(logPath); f.encoding = 'UTF-8'; f.open('a'); f.writeln(p.join(' ')); f.close(); } catch (e) {} }
  function run(label, fn) { var undo = false; try { app.beginSuppressDialogs(); } catch (e0) {} try { app.beginUndoGroup(label); undo = true; fn(); } catch (e) { log('ERROR', e); } if (undo) { try { app.endUndoGroup(); } catch (e1) {} } try { app.endSuppressDialogs(false); } catch (e2) {} }
  function clampInfluence(v) { return Math.max(0.1, Math.min(100, v)); }
  function setKeys(prop, keys, segs) {
    var i, L = KeyframeInterpolationType.LINEAR, B = KeyframeInterpolationType.BEZIER, H = KeyframeInterpolationType.HOLD;
    for (i = 0; i < keys.length; i++) prop.setValueAtTime(keys[i][0], keys[i][1]);
    var first = prop.nearestKeyIndex(keys[0][0]);
    for (i = 0; i < keys.length; i++) prop.setInterpolationTypeAtKey(first + i, L, L);
    var vt = prop.propertyValueType, spatial = (vt === PropertyValueType.TwoD_SPATIAL || vt === PropertyValueType.ThreeD_SPATIAL);
    if (spatial) for (i = 0; i < keys.length; i++) { var z = [], n = prop.keyValue(first + i).length; for (var d0 = 0; d0 < n; d0++) z.push(0); prop.setSpatialTangentsAtKey(first + i, z, z); }
    for (var s = 0; s < keys.length - 1; s++) {
      var seg = segs[s], k1 = first + s, k2 = first + s + 1;
      if (seg === 'linear' || seg === undefined) continue;
      if (seg === 'hold') { prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), H); continue; }
      var T = keys[s + 1][0] - keys[s][0]; if (T <= 0) continue;
      var v1 = prop.keyValue(k1), v2 = prop.keyValue(k2);
      var inflOut = clampInfluence(seg[0] * 100), inflIn = clampInfluence((1 - seg[2]) * 100);
      var ro = seg[0] > 1e-4 ? seg[1] / seg[0] : 0, ri = (1 - seg[2]) > 1e-4 ? (1 - seg[3]) / (1 - seg[2]) : 0;
      var outE = [], inE = [];
      if (spatial) { var dd = 0; for (var q = 0; q < v1.length; q++) dd += (v2[q] - v1[q]) * (v2[q] - v1[q]); var avg = Math.sqrt(dd) / T; outE = [new KeyframeEase(avg * ro, inflOut)]; inE = [new KeyframeEase(avg * ri, inflIn)]; }
      else if (!(v1 instanceof Array)) { var a1 = (v2 - v1) / T; outE = [new KeyframeEase(a1 * ro, inflOut)]; inE = [new KeyframeEase(a1 * ri, inflIn)]; }
      else { var dims = prop.keyInTemporalEase(k1).length; for (var d = 0; d < dims; d++) { var ad = (v2[d] - v1[d]) / T; outE.push(new KeyframeEase(ad * ro, inflOut)); inE.push(new KeyframeEase(ad * ri, inflIn)); } }
      prop.setInterpolationTypeAtKey(k1, prop.keyInInterpolationType(k1), B);
      prop.setInterpolationTypeAtKey(k2, B, prop.keyOutInterpolationType(k2));
      prop.setTemporalEaseAtKey(k1, prop.keyInTemporalEase(k1), outE);
      prop.setTemporalEaseAtKey(k2, inE, prop.keyOutTemporalEase(k2));
    }
  }
  return { str: str, log: log, run: run, setKeys: setKeys };
})();
`;

const BUILDER = `
function MUI_apply(prop, p, fallback) {
  if (!p) { if (fallback !== undefined) prop.setValue(fallback); return; }
  if (p.keys && p.keys.length > 1) GL.setKeys(prop, p.keys, p.segs || []); else prop.setValue(p.v !== undefined ? p.v : fallback);
}
function MUI_scale(L) {
  // scale × per-axis scale — keyed when any of them is keyed (sampled together)
  var s = L.scale, x = L.sx, y = L.sy;
  function at(p, t) { if (!p.keys) return p.v; var k = p.keys; if (t <= k[0][0]) return k[0][1]; for (var i = 0; i < k.length - 1; i++) if (t <= k[i + 1][0]) return k[i][1] + (k[i + 1][1] - k[i][1]) * (t - k[i][0]) / (k[i + 1][0] - k[i][0]); return k[k.length - 1][1]; }
  // z scale = the uniform scale: a 3D parent's zoom scales its children's depth too (the editor's parenting does)
  var keyed = s.keys || x.keys || y.keys;
  if (!keyed) return { v: [s.v * x.v / 100, s.v * y.v / 100, s.v] };
  if (s.keys && !x.keys && !y.keys) { var ks = []; for (var i = 0; i < s.keys.length; i++) ks.push([s.keys[i][0], [s.keys[i][1] * x.v / 100, s.keys[i][1] * y.v / 100, s.keys[i][1]]]); return { keys: ks, segs: s.segs }; }
  var ts = [], out = [], segs = []; for (var t = 0; t <= DATA.T + 1e-6; t += 1 / 30) ts.push(t);
  for (var j = 0; j < ts.length; j++) { out.push([ts[j], [at(s, ts[j]) * at(x, ts[j]) / 100, at(s, ts[j]) * at(y, ts[j]) / 100, at(s, ts[j])]]); if (j) segs.push('linear'); }
  return { keys: out, segs: segs };
}
function MUI_pathShape(vs, ins, outs, closed) { var s = new Shape(); s.vertices = vs; s.inTangents = ins; s.outTangents = outs; s.closed = closed; return s; }
function MUI_roundRect(w, h, r) {   // per-corner radii [tl, tr, br, bl] as a path
  var k = 0.5523, x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, v = [], ins = [], outs = [];
  function c(px, py, ix, iy, ox, oy) { v.push([px, py]); ins.push([ix, iy]); outs.push([ox, oy]); }
  c(x0 + r[0], y0, -r[0] * k, 0, 0, 0); c(x1 - r[1], y0, 0, 0, r[1] * k, 0); c(x1, y0 + r[1], 0, -r[1] * k, 0, 0);
  c(x1, y1 - r[2], 0, 0, 0, r[2] * k); c(x1 - r[2], y1, r[2] * k, 0, 0, 0); c(x0 + r[3], y1, 0, 0, -r[3] * k, 0);
  c(x0, y1 - r[3], 0, r[3] * k, 0, 0); c(x0, y0 + r[0], 0, 0, 0, -r[0] * k);
  return MUI_pathShape(v, ins, outs, true);
}
var MUI_footage = {};
function MUI_build() {
  var comp = app.project.items.addComp(DATA.name, DATA.W, DATA.H, 1, DATA.T, DATA.fps);
  comp.bgColor = DATA.bg;
  var made = [];
  for (var i = 0; i < DATA.layers.length; i++) {
    var L = DATA.layers[i], lay;
    if (L.kind === 'null') {
      lay = comp.layers.addNull(DATA.T); lay.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([0, 0]);
    } else if (L.kind === 'image') {
      var file = new File(File($.fileName).parent.fsName + '/' + L.src);
      if (!file.exists) { GL.log('missing picture', L.src, '— a grey solid stands in'); lay = comp.layers.addSolid([0.8, 0.8, 0.8], L.name, 400, 300, 1, DATA.T); }
      else { var foot = MUI_footage[L.src] || (MUI_footage[L.src] = app.project.importFile(new ImportOptions(file))); lay = comp.layers.add(foot, DATA.T); }
    } else if (L.kind === 'text') {
      lay = L.text.boxW ? comp.layers.addBoxText([L.text.boxW, L.text.leading * 8], L.text.text) : comp.layers.addText(L.text.text);
      var st = lay.property('ADBE Text Properties').property('ADBE Text Document'), td = st.value;
      td.text = L.text.text; td.font = L.text.font; td.fontSize = L.text.size; td.applyFill = true; td.fillColor = L.text.color.v;
      td.applyStroke = false; td.tracking = L.text.tracking; td.autoLeading = false; td.leading = L.text.leading;
      td.justification = L.text.just === 'left' ? ParagraphJustification.LEFT_JUSTIFY : L.text.just === 'right' ? ParagraphJustification.RIGHT_JUSTIFY : ParagraphJustification.CENTER_JUSTIFY;
      if (L.text.boxW) { try { td.boxTextPos = [-L.text.boxW / 2, -L.text.leading * 0.8]; } catch (eb) {} }
      st.setValue(td);
      if (td.font !== L.text.font) GL.log('font substituted', L.name, L.text.font, '→', st.value.font);
      // the layer's position is the editor's box centre: in layer space that is (−dx, −dy) from the
      // baseline origin (left / centre / right edge of the line)
      lay.property('ADBE Transform Group').property('ADBE Anchor Point').setValue(L.text.boxW ? [0, L.text.dy - L.text.leading * 0.5] : [-L.text.dx, -L.text.dy]);
      var anims = lay.property('ADBE Text Properties').property('ADBE Text Animators');
      if (L.text.color.keys) { var an = anims.addProperty('ADBE Text Animator'); var fc = an.property('ADBE Text Animator Properties').addProperty('ADBE Text Fill Color'); GL.setKeys(fc, L.text.color.keys, L.text.color.segs); }
      if (L.text.trackingKeys) { var at2 = anims.addProperty('ADBE Text Animator'); var tr = at2.property('ADBE Text Animator Properties').addProperty('ADBE Text Tracking Amount'); GL.setKeys(tr, L.text.trackingKeys.keys, L.text.trackingKeys.segs); }
      if (L.text.reveal) {   // typing: characters from Start on are hidden
        var ar = anims.addProperty('ADBE Text Animator'); ar.name = 'Typing';
        ar.property('ADBE Text Animator Properties').addProperty('ADBE Text Opacity').setValue(0);
        var sel = ar.property('ADBE Text Selectors').addProperty('ADBE Text Selector');
        GL.setKeys(sel.property('ADBE Text Percent Start'), L.text.reveal.keys, L.text.reveal.segs);
      }
      if (L.text.expr) {
        for (var s = 0; s < L.text.sliders.length; s++) {
          var sl = lay.property('ADBE Effect Parade').addProperty('ADBE Slider Control'); sl.name = L.text.sliders[s].name;
          MUI_apply(sl.property('ADBE Slider Control-0001'), L.text.sliders[s], 0);
        }
        st.expression = L.text.expr;
      }
    } else {
      lay = comp.layers.addShape();
      var S = L.shape, grp = lay.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group'), vec = grp.property('ADBE Vectors Group');
      if (S.type === 'rect' && !S.radii) {
        var rc = vec.addProperty('ADBE Vector Shape - Rect'); MUI_apply(rc.property('ADBE Vector Rect Size'), S.size, [S.w, S.h]); MUI_apply(rc.property('ADBE Vector Rect Roundness'), S.radius, 0);
      } else if (S.type === 'rect') {
        vec.addProperty('ADBE Vector Shape - Group').property('ADBE Vector Shape').setValue(MUI_roundRect(S.w, S.h, S.radii));
      } else if (S.type === 'ellipse') {
        var el = vec.addProperty('ADBE Vector Shape - Ellipse'); MUI_apply(el.property('ADBE Vector Ellipse Size'), S.size, [S.w, S.h]);
      } else {
        for (var p = 0; p < S.paths.length; p++) vec.addProperty('ADBE Vector Shape - Group').property('ADBE Vector Shape').setValue(MUI_pathShape(S.paths[p].v, S.paths[p].i, S.paths[p].o, S.paths[p].closed));
      }
      if (S.trim) {   // an operator: it must sit ABOVE the stroke that renders the trimmed path
        var tm = vec.addProperty('ADBE Vector Filter - Trim');
        MUI_apply(tm.property('ADBE Vector Trim Start'), S.trim.start, 0); MUI_apply(tm.property('ADBE Vector Trim End'), S.trim.end, 100); MUI_apply(tm.property('ADBE Vector Trim Offset'), S.trim.offset, 0);
      }
      var svgStroke = S.svgColor && S.paths.length && S.paths[0].stroke;
      if (S.stroke || svgStroke) {
        var sk = vec.addProperty('ADBE Vector Graphic - Stroke');
        MUI_apply(sk.property('ADBE Vector Stroke Color'), S.stroke ? S.stroke.color : S.fill, S.fill ? S.fill.v : [0, 0, 0]);
        MUI_apply(sk.property('ADBE Vector Stroke Width'), S.stroke ? S.stroke.width : { v: S.paths[0].stroke }, 4);
        var cap = S.stroke ? S.stroke.cap : 'round'; sk.property('ADBE Vector Stroke Line Cap').setValue(cap === 'butt' ? 1 : cap === 'square' ? 3 : 2);
        sk.property('ADBE Vector Stroke Line Join').setValue(2);
      }
      if (S.fill && (!S.svgColor || !svgStroke || S.paths[0].fill)) {
        var fl = vec.addProperty('ADBE Vector Graphic - Fill'); MUI_apply(fl.property('ADBE Vector Fill Color'), S.fill, [0, 0, 0]);
        if (S.fill.a !== undefined && S.fill.a < 1) fl.property('ADBE Vector Fill Opacity').setValue(S.fill.a * 100);
      }
      if (S.border) {
        var bd = vec.addProperty('ADBE Vector Graphic - Stroke'); MUI_apply(bd.property('ADBE Vector Stroke Color'), S.border.color, [0, 0, 0]); MUI_apply(bd.property('ADBE Vector Stroke Width'), S.border.width, 1);
      }
    }
    lay.name = L.name;
    if (DATA.d3) lay.threeDLayer = true;   // 3D space: every layer, like the editor's (they all live in one 3D scene)
    made.push(lay);
    var tg = lay.property('ADBE Transform Group');
    if (L.shadow) { var ds = lay.property('ADBE Effect Parade').addProperty('ADBE Drop Shadow'); ds.property('ADBE Drop Shadow-0001').setValue(L.shadow.color); ds.property('ADBE Drop Shadow-0002').setValue(L.shadow.opacity); ds.property('ADBE Drop Shadow-0003').setValue(L.shadow.direction); ds.property('ADBE Drop Shadow-0004').setValue(L.shadow.distance); ds.property('ADBE Drop Shadow-0005').setValue(L.shadow.softness); }
    if (L.blur) { var gb = lay.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2'); MUI_apply(gb.property('ADBE Gaussian Blur 2-0001'), L.blur, 0); }
    L.__tg = tg;
  }
  // parenting BEFORE the transforms, so every value is read in the parent's space
  for (var j = 0; j < DATA.layers.length; j++) if (DATA.layers[j].parent !== null) made[j].parent = made[DATA.layers[j].parent];
  for (var k = 0; k < DATA.layers.length; k++) {
    var LL = DATA.layers[k], tg2 = made[k].property('ADBE Transform Group');
    var pos = tg2.property('ADBE Position'); pos.dimensionsSeparated = true;
    MUI_apply(tg2.property('ADBE Position_0'), LL.x, LL.x.v); MUI_apply(tg2.property('ADBE Position_1'), LL.y, LL.y.v);
    MUI_apply(tg2.property('ADBE Rotate Z'), LL.rot, 0);
    MUI_apply(tg2.property('ADBE Scale'), MUI_scale(LL), [100, 100, 100]);
    MUI_apply(tg2.property('ADBE Opacity'), LL.opacity, 100);
    if (DATA.d3) {
      MUI_apply(tg2.property('ADBE Position_2'), LL.z, 0);
      MUI_apply(tg2.property('ADBE Rotate X'), LL.rx, 0);
      MUI_apply(tg2.property('ADBE Rotate Y'), LL.ry, 0);
    }
  }
  // the editor's camera: vertical field of view 28° — zoom (px) = the distance at which z = 0 is 1:1
  if (DATA.d3) {
    var camL = comp.layers.addCamera('Camera', [DATA.W / 2, DATA.H / 2]);
    var camD = (DATA.H / 2) / Math.tan(14 * Math.PI / 180);
    camL.property('ADBE Camera Options Group').property('ADBE Camera Zoom').setValue(camD);
    camL.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([DATA.W / 2, DATA.H / 2, 0]);
    camL.property('ADBE Transform Group').property('ADBE Position').setValue([DATA.W / 2, DATA.H / 2, -camD]);
  }
  for (var m = 0; m < DATA.layers.length; m++) if (DATA.layers[m].matte !== null) { made[m].setTrackMatte(made[DATA.layers[m].matte], TrackMatteType.ALPHA); made[DATA.layers[m].matte].enabled = false; }
  for (var fi = 0; fi < (DATA.footage || []).length; fi++) {   // pre-rendered scenes, on top, each at its own time
    var FT = DATA.footage[fi], ff = new File(File($.fileName).parent.fsName + '/' + FT.file);
    if (!ff.exists) { GL.log('missing footage', FT.file); continue; }
    var fl = comp.layers.add(app.project.importFile(new ImportOptions(ff)));
    fl.name = FT.name; fl.startTime = FT.start; fl.outPoint = Math.min(DATA.T, FT.start + FT.duration);
  }
  comp.openInViewer();
  GL.log('built', DATA.name, DATA.layers.length, 'layers');
  return comp;
}
GL.run('GL Motion: ' + DATA.name, function () { MUI_build(); });
GL.log('END');
`;

// the PostScript name After Effects wants: Helvetica Neue's own, else <family>-<Weight> (the font must be installed)
const psFont = (stack, wgt) => {
  const name = String(stack || '').split(',')[0].replace(/['"]/g, '').trim();
  const f = K.FONTS[name];
  if (!f || f.ps === 'HelveticaNeue') return wgt >= 600 ? 'HelveticaNeue-Bold' : wgt >= 500 ? 'HelveticaNeue-Medium' : wgt <= 300 ? 'HelveticaNeue-Light' : 'HelveticaNeue';
  const W = { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold' };
  return `${f.ps}-${W[Math.min(800, Math.max(300, Math.round(wgt / 100) * 100))]}`;
};

K.toAE = function toAE(spec, opt = {}) {
  const W = (opt.videoSize && opt.videoSize.w) || 1920; const H = (opt.videoSize && opt.videoSize.h) || 1080;
  // stand-in photos stay shapes in AE (no svg footage needed; AE is fine with the layer count)
  const { preset, report } = K.toVE(spec, { theme: opt.theme, accent: opt.accent, colors: opt.colors, videoSize: { w: W, h: H }, imageSizes: opt.imageSizes, photos: 'shapes' });
  const T = preset.duration;
  const layers = layersFrom(preset, W, H, T, opt.files || {}, opt.imageSizes || {});
  // footage: pre-rendered clips placed on top at their time (HTML-only scenes of a film)
  const footage = (opt.footage || []).map((f) => ({ file: f.file, name: f.name || f.file, start: r4(f.start || 0), duration: r4(f.duration) }));
  // 3D space when any layer turns or moves in depth (the editor's items carry it)
  const d3 = layers.some((l) => ['rx', 'ry', 'z'].some((p) => l[p] && (l[p].keys || Math.abs(l[p].v || 0) > 1e-6)));
  const data = { name: opt.name || spec.name, W, H, T: r4(opt.T || T), fps: opt.fps || 30, bg: col3(K.theme().bg), layers, footage, d3 };
  const approx = report.approx.slice();
  if (layers.some((l) => l.text && l.text.expr)) approx.push('numbers (COUNTER / TIMER) show as counting digits in AE (no roll / odometer)');
  const jsx = `// GL Motion → After Effects: "${String(data.name).replace(/[\r\n]/g, ' ')}" — ${layers.length} layers, ${data.T}s, ${W}×${H}.
// Run it in After Effects: File ▸ Scripts ▸ Run Script File… (fonts: ${spec.font || 'Helvetica Neue'}, installed).
${PRELUDE}
var DATA = ${JSON.stringify(data)};
${BUILDER}`;
  return { jsx, layers: layers.length, approx };
};
})();
