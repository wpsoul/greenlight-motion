/* UI Motion Kit → a standalone HTML page (the "HTML" preset type).
 *
 * UIK.toHTML(spec, { theme, accent, colors, sources, background }) returns one self-contained page that plays the
 * element on a TRANSPARENT background (or `background`, a CSS colour, for a finished film): the kit's scripts are inlined (`sources` = { easings, engine, file } —
 * the text of easings.js, engine.js and the element's own elements-*.js file). The stage keeps the
 * element's 1:1 px size centred in whatever viewport the page gets, like the Video Editor layers do.
 *
 * Time: under the Video Editor's HTML-clip clock (window.__glHtmlClipClockInstalled — the virtual clock
 * the bake / live layer drives) the rAF timestamp IS the clip time, so every frame is exact; in a plain
 * browser the element plays from the first frame. After T it holds the last frame.
 * window.__uikSeek(t) — also window.__glSeek(seconds), the HTML card renderer's parallel-render contract —
 * seeks directly and takes over from the playing clock.
 */
(function () {
'use strict';
const K = window.UIK;

// the engine's stage rules (the lab page carries the same set), transparent and viewport-sized
const STAGE_CSS = `
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
#uik-host { position: fixed; inset: 0; }
.uik-stage { position: absolute; inset: 0; overflow: hidden; background: transparent; color: #0B0B0B;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
.uik-root { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.uik-n { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.uik-b { position: absolute; box-sizing: border-box; }
.uik-c { position: absolute; width: 0; height: 0; }
.uik-t { position: absolute; left: 0; top: 0; white-space: nowrap; line-height: 1.15; }
.uik-svg { position: absolute; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; }
.uik-dw { display: inline-grid; position: relative; justify-items: center; vertical-align: top; clip-path: inset(calc((1lh - 1.1em) / 2) -0.5em); }
.uik-dz { grid-area: 1 / 1; visibility: hidden; height: 1lh; overflow: hidden; }
.uik-ds { grid-area: 1 / 1; position: relative; }
.uik-d1 { position: absolute; left: 0; right: 0; top: 1.1em; text-align: center; }
.uik-caret { display: inline-block; width: .085em; height: 1.02em; vertical-align: -0.15em; margin: 0 .03em; border-radius: 2px; }
.uik-cursor svg { filter: drop-shadow(0 2px 3px rgba(0,0,0,.28)); }
`;
K.STAGE_CSS = STAGE_CSS;

// a script body can't contain "</script" (it would end the tag early)
const safe = (src) => String(src).replace(/<\/(script)/gi, '<\\/$1');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

K.toHTML = function toHTML(spec, opt = {}) {
  const src = opt.sources || {};
  // one item: its own elements file; a film (UIK.compose): every scene's file + film.js
  const files = [].concat(src.files || src.file || []);
  if (!src.easings || !src.engine || !files.length) throw new Error('toHTML: sources.easings / engine / file(s) are required');
  if (spec.film && !src.film) throw new Error('toHTML: a film needs sources.film (film.js)');
  const find = spec.film
    ? `K.compose(${JSON.stringify(spec.film.scenario)}${spec.film.scene != null ? `, { scene: ${spec.film.scene} }` : ''})`
    : `K.elements.find(function (e) { return e.id === ${JSON.stringify(spec.id)}; })`;
  const boot = `
(function () {
  var K = window.UIK;
  var spec = ${find};
  K.setTheme(${JSON.stringify(opt.theme || 'light')}, ${JSON.stringify(opt.accent || null)}, ${JSON.stringify(opt.colors || null)});
  var inst = new K.Instance(spec, document.getElementById('uik-host'));
  var T = spec.T, t0 = null, manual = false;
  var seek = function (t) { inst.seek(Math.max(0, Math.min(T, t))); };
  // a manual seek (tools, thumbnails) takes over from the playing clock. With canvas layers on the
  // page it returns a promise: their pictures load first (a render awaits it), then the frame
  window.__uikSeek = function (t) {
    manual = true; seek(t);
    if (K.media && K.media.pending.size) return K.media.ready().then(function () { seek(t); });
  };
  // the HTML card renderer's contract: a page that draws any moment directly renders in parallel
  window.__glSeek = window.__uikSeek;
  window.__uikDuration = T;
  function frame(ts) {
    var clock = window.__glHtmlClipClockInstalled;
    if (t0 === null) t0 = ts;
    if (!manual) seek(clock ? ts / 1000 : (ts - t0) / 1000);
    requestAnimationFrame(frame);
  }
  seek(0);
  requestAnimationFrame(frame);
})();`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.name)}</title>
<meta name="description" content="${esc(spec.desc || '')}">
<meta name="generator" content="UI Motion Kit · ${esc(spec.id)} · ${spec.T}s">
<style>${STAGE_CSS}${opt.background ? `html, body { background: ${String(opt.background).replace(/[<>;{}]/g, '')}; }` : ''}</style>
</head>
<body>
<div id="uik-host"></div>
<script>${safe(src.easings)}</script>
<script>${safe(src.engine)}</script>
${files.map((f) => `<script>${safe(f)}</script>`).join('\n')}
${spec.film ? `<script>${safe(src.film)}</script>` : ''}
<script>${boot}</script>
</body>
</html>
`;
};
})();
