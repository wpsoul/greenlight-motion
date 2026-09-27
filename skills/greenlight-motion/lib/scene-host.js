/* GL Motion — the 3D engine's host: plays a film whose scenes are HTML pages (lib/scene.js is their runtime).
 *
 *   UIK.scenePlan(scenario, docs)   → { W, H, T, background, scenes: [{ doc, boot, start, end, from, to, fadeIn, fadeOut }] }
 *                                     scenario normalized (the user's edits applied); docs[i] = scene i's page source
 *   new MUSceneFilm(plan, host, { three, runtime })   the player: one frame per scene (srcdoc, three.js and the runtime
 *                                     inlined), seek(t) → a promise while pictures / fonts load, update(plan) for live edits
 *   UIK.toSceneFilmHTML(plan, { three, runtime, host })   the whole film as ONE page (window.__glSeek) — what renders record
 *   UIK.toScenePageHTML(plan, i, { three, runtime })      scene i as a standalone page — the Video Editor's HTML clip
 * The page of a scene gets window.__muScene = { params, theme, edits, duration, frame } before its own code runs.
 */
(function () {
'use strict';
const G = typeof window !== 'undefined' ? window : globalThis;
const K = G.UIK || null;
const FADE = 0.35;
// "</script" inside an inlined script would end it early
const safe = (src) => String(src).replace(/<\/(script)/gi, '<\\/$1');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

// a scene page with its boot data, three.js and the runtime first in <head>
const prepare = (doc, boot, three, runtime) => {
  const head = `<script>window.__muScene = ${json(boot)};</script>`
    + (three ? `<script>${safe(three)}</script>` : '')
    + `<script>${safe(runtime)}</script>`
    + `<style>html,body{margin:0;background:transparent}</style>`;
  const src = String(doc || '');
  if (/<head[^>]*>/i.test(src)) return src.replace(/<head[^>]*>/i, (m) => m + head);
  if (/<html[^>]*>/i.test(src)) return src.replace(/<html[^>]*>/i, (m) => m + '<head>' + head + '</head>');
  return '<!doctype html><html><head>' + head + '</head><body>' + src + '</body></html>';
};

// ── the plan: timing (the film's own rules: cuts, 0.35 s cross-fades), the theme, each scene's boot data ──
if (K) {
  K.sceneTheme = (s) => {
    K.setTheme(s.theme, s.accent, s.colors);
    const th = K.theme(); const tokens = {};
    for (const k of K.TOKENS) tokens[k] = th[k];
    const font = s.font ? { stack: K.fontOf(s.font).stack, url: K.fontUrl(s.font) } : { stack: K.fontOf(null).stack, url: null };
    return { tokens, font };
  };
  K.scenePlan = (s, docs) => {
    const timing = K.filmTiming(s);
    const theme = K.sceneTheme(s);
    return {
      W: s.size.w, H: s.size.h, T: timing.length ? timing[timing.length - 1].end : 0, background: s.background || null,
      scenes: timing.map((tm, i) => {
        const sc = s.scenes[i];
        return { doc: (docs && docs[i]) || '', start: tm.start, end: tm.end, from: tm.from, to: tm.to, fadeIn: tm.from < tm.start, fadeOut: tm.to > tm.end,
          boot: { params: sc.params || {}, theme, edits: { text: sc.text || {}, style: sc.style || {} }, images: sc.images || {}, duration: tm.duration, frame: { w: s.size.w, h: s.size.h } } };
      }),
    };
  };
}

// ── the player ──
class MUSceneFilm {
  constructor(plan, host, opt = {}) {
    this.plan = plan; this.opt = opt; this.T = plan.T; this.recs = []; this.layers = []; this.is3d = false; this.scenes3d = true;
    const doc = host.ownerDocument || document;
    const stage = this.stage = doc.createElement('div');
    stage.className = 'uik-stage mu-scenes';
    stage.style.cssText = `position:absolute;left:0;top:0;width:${plan.W}px;height:${plan.H}px;overflow:hidden;transform-origin:0 0;`;
    host.appendChild(stage);
    this.frames = plan.scenes.map((sc) => {
      const f = doc.createElement('iframe');
      f.setAttribute('title', 'scene'); f.setAttribute('scrolling', 'no');
      f.style.cssText = `position:absolute;left:0;top:0;width:${plan.W}px;height:${plan.H}px;border:0;background:transparent;display:none;pointer-events:none;color-scheme:normal;`;
      const rec = { f, loaded: false, want: null };
      rec.ready = new Promise((ok) => { f.onload = () => { rec.loaded = true; ok(); }; });
      f.srcdoc = prepare(sc.doc, sc.boot, opt.three, opt.runtime);
      stage.appendChild(f);
      return rec;
    });
    this.ready = Promise.all(this.frames.map((r) => r.ready));
  }
  win(i) { const r = this.frames[i]; return r && r.loaded ? r.f.contentWindow : null; }
  // t in film seconds: each scene on screen at its own time (it holds its first frame while fading in)
  seek(t) {
    this.t = t;
    const waits = [];
    const ease = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
    this.plan.scenes.forEach((sc, i) => {
      const r = this.frames[i];
      const on = t >= sc.from - 1e-6 && (t < sc.to - 1e-6 || (i === this.plan.scenes.length - 1 && t <= sc.to + 1e-6));
      if (!on) { if (r.f.style.display !== 'none') r.f.style.display = 'none'; return; }
      if (r.f.style.display !== '') r.f.style.display = '';
      let op = 1;
      if (sc.fadeIn && t < sc.start) op = ease((t - sc.from) / FADE);
      if (sc.fadeOut && t > sc.end) op = 1 - ease((t - sc.end) / FADE);
      r.f.style.opacity = op >= 0.999 ? '' : op.toFixed(4);
      r.f.style.zIndex = String(i);
      const local = Math.max(0, t - sc.start);
      const w = this.win(i);
      if (w && typeof w.__glSeek === 'function') { const p = w.__glSeek(local); if (p && p.then) waits.push(p); }
      else waits.push(r.ready.then(() => { const w2 = this.win(i); const p = w2 && w2.__glSeek && w2.__glSeek(Math.max(0, this.t - sc.start)); return p && p.then ? p : undefined; }));
    });
    return waits.length ? Promise.all(waits).then(() => undefined) : undefined;
  }
  // live edits from the preview: each scene's params, the theme, its text / style
  update(plan) {
    this.plan = Object.assign({}, this.plan, { scenes: this.plan.scenes.map((sc, i) => Object.assign({}, sc, { boot: plan.scenes[i].boot })) });
    this.plan.scenes.forEach((sc, i) => { const w = this.win(i); if (w && w.__muSet) w.__muSet({ params: sc.boot.params, theme: sc.boot.theme, edits: sc.boot.edits, images: sc.boot.images }); });
  }
  defs(i) { const w = this.win(i); return (w && w.__muSceneDefs) || null; }
  // a still of scene i at local time lt: its WebGL canvas (preserveDrawingBuffer) — or null
  capture(i, lt) {
    const w = this.win(i); if (!w) return null;
    try {
      if (w.__glSeek) w.__glSeek(lt);
      const cv = w.document.getElementById('mu-gl') || w.document.querySelector('canvas');
      const url = cv ? cv.toDataURL('image/png') : null;
      if (w.__glSeek && this.t != null) w.__glSeek(Math.max(0, this.t - this.plan.scenes[i].start));
      return url;
    } catch (e) { return null; }
  }
  destroy() { this.stage.remove(); }
}
G.MUSceneFilm = MUSceneFilm;
if (K) K.SceneFilm = MUSceneFilm;

// ── pages ──
const toSceneFilmHTML = (plan, src) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>film</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${plan.background ? String(plan.background).replace(/[<>;{}]/g, '') : 'transparent'}}</style>
</head><body>
<script type="text/plain" id="mu-three">${safe(src.three || '')}</script>
<script type="text/plain" id="mu-runtime">${safe(src.runtime)}</script>
<script>${safe(src.host)}</script>
<script>
(function () {
  var plan = ${json(plan)};
  var film = new MUSceneFilm(plan, document.body, { three: document.getElementById('mu-three').textContent, runtime: document.getElementById('mu-runtime').textContent });
  film.stage.style.left = '50%'; film.stage.style.top = '50%'; film.stage.style.marginLeft = (-plan.W / 2) + 'px'; film.stage.style.marginTop = (-plan.H / 2) + 'px';
  window.__uikDuration = plan.T;
  window.__glSeek = function (t) { return film.ready.then(function () { return film.seek(Math.max(0, Math.min(plan.T, t))); }); };
  window.__uikSeek = window.__glSeek;
  var t0 = null, manual = false;
  var s0 = window.__glSeek; window.__glSeek = window.__uikSeek = function (t) { manual = true; return s0(t); };
  function frame(ts) { if (!manual) { if (t0 === null) t0 = ts; film.seek(Math.min(plan.T, (window.__glHtmlClipClockInstalled ? ts : ts - t0) / 1000)); } requestAnimationFrame(frame); }
  film.ready.then(function () { film.seek(0); requestAnimationFrame(frame); window.__muReady = true; });
})();
</script>
</body></html>
`;
const toScenePageHTML = (plan, i, src) => prepare(plan.scenes[i].doc, plan.scenes[i].boot, src.three, src.runtime);
G.MUScenePages = { toSceneFilmHTML, toScenePageHTML, prepare };
if (K) { K.toSceneFilmHTML = toSceneFilmHTML; K.toScenePageHTML = toScenePageHTML; }
})();
