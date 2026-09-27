/* GreenLight Motion — the player: a film's scenes on one timeline, each scene a page in its own frame.
 *
 *   new GLPlayer(plan, host)   plan = { W, H, T, background, scenes: [{ page, start, end, from, to, fadeIn, fadeOut }] }
 *                              (MU.plan builds it: each page is a scene with its clock, kit and edits)
 *   player.seek(t)             film seconds → a promise that resolves when every scene on screen has drawn t
 *   player.setPage(i, page, { reload })   a scene's new page (reload: false keeps the one playing: an edit it already shows)
 *   player.update(plan)        new timing / pages; player.win(i), player.frame(i), player.defs(i), player.destroy()
 *   GLPlayer.filmPage(plan, player)   the whole film as ONE page (window.__glSeek, window.__glDuration): what renders record
 *
 * Time: every scene page answers window.__glSeek(t). A page that draws any moment directly (a library item, a GLScene)
 * sets __glStateless; any other page steps its clock forward, so going back needs a fresh copy: the player loads one
 * off screen, brings it to t and swaps it in, so scrubbing back never shows a blank frame.
 * Scenes joined by a fade overlap for 0.35 s: the incoming scene holds its first frame while it fades in.
 */
(function () {
'use strict';
const G = typeof window !== 'undefined' ? window : globalThis;
const FADE = 0.35;
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const safe = (src) => String(src).replace(/<\/(script)/gi, '<\\/$1');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

class GLPlayer {
  constructor(plan, host, opt = {}) {
    this.plan = plan; this.opt = opt; this.T = plan.T; this.t = 0;
    const doc = this.doc = host.ownerDocument || document;
    const stage = this.stage = doc.createElement('div');
    stage.className = 'gl-stage';
    stage.style.cssText = `position:absolute;left:0;top:0;width:${plan.W}px;height:${plan.H}px;overflow:hidden;transform-origin:0 0;`;
    host.appendChild(stage);
    this.recs = plan.scenes.map((sc, i) => this.make(i));
    this.ready = Promise.all(this.recs.map((r) => r.ready));
  }
  iframe(page) {
    const f = this.doc.createElement('iframe');
    f.setAttribute('title', 'scene'); f.setAttribute('scrolling', 'no');
    f.style.cssText = `position:absolute;left:0;top:0;width:${this.plan.W}px;height:${this.plan.H}px;border:0;background:transparent;display:none;pointer-events:none;color-scheme:normal;`;
    const loaded = new Promise((ok) => { f.onload = () => ok(f); });
    f.srcdoc = page;
    this.stage.appendChild(f);
    return { f, loaded };
  }
  make(i) {
    const { f, loaded } = this.iframe(this.plan.scenes[i].page);
    const rec = { i, f, page: this.plan.scenes[i].page, t: 0, target: null, running: null, gen: 0 };
    rec.ready = loaded.then(() => undefined);
    return rec;
  }
  win(i) { const r = this.recs[i]; return r && r.f.contentWindow; }
  frame(i) { const r = this.recs[i]; return r && r.f; }
  defs(i) { const w = this.win(i); return (w && w.__glSceneDefs) || null; }
  // scene i to its own time lt: the latest request wins while one is being drawn
  seekScene(i, lt) {
    const rec = this.recs[i];
    rec.target = lt;
    if (!rec.running) rec.running = this.run(rec).finally(() => { rec.running = null; });
    return rec.running;
  }
  async run(rec) {
    await rec.ready;
    while (rec.target != null) {
      const t = rec.target; rec.target = null;
      const w = rec.f.contentWindow;
      if (!w || typeof w.__glSeek !== 'function') { rec.t = t; continue; }
      if (rec.reload || (t < rec.t - 1e-3 && !w.__glStateless)) {
        // back in time on a page that steps (or a new page): a fresh copy, off screen, brought to t, then swapped in
        const gen = ++rec.gen; rec.reload = false;
        const { f, loaded } = this.iframe(rec.page);
        await loaded;
        if (gen !== rec.gen) { f.remove(); continue; }
        try { await f.contentWindow.__glSeek(t); } catch (e) { /* the page's own error */ }
        f.style.opacity = rec.f.style.opacity; f.style.zIndex = rec.f.style.zIndex; f.style.display = rec.f.style.display;
        f.style.pointerEvents = rec.f.style.pointerEvents;
        rec.f.remove(); rec.f = f; rec.t = t;
        if (this.opt.onSwap) this.opt.onSwap(rec.i, f);
        continue;
      }
      try { await w.__glSeek(t); } catch (e) { /* the page's own error */ }
      rec.t = t;
    }
  }
  // film time t: each scene on screen at its own time (it holds its first frame while it fades in)
  seek(t) {
    this.t = t;
    const scenes = this.plan.scenes; const waits = [];
    scenes.forEach((sc, i) => {
      const r = this.recs[i];
      const on = t >= sc.from - 1e-6 && (t < sc.to - 1e-6 || (i === scenes.length - 1 && t <= sc.to + 1e-6));
      if (!on) { if (r.f.style.display !== 'none') r.f.style.display = 'none'; return; }
      if (r.f.style.display !== '') r.f.style.display = '';
      let op = 1;
      if (sc.fadeIn && t < sc.start) op = smooth((t - sc.from) / FADE);
      if (sc.fadeOut && t > sc.end) op = 1 - smooth((t - sc.end) / FADE);
      r.f.style.opacity = op >= 0.999 ? '' : op.toFixed(4);
      r.f.style.zIndex = String(i);
      waits.push(this.seekScene(i, Math.max(0, Math.min(sc.end - sc.start, t - sc.start))));
    });
    return Promise.all(waits).then(() => undefined);
  }
  // a scene's page changed (an edit, a theme): reload shows the new page at the scene's current time; without reload the
  // page playing already shows the change (applied to it live) and the new page is only kept for the next reload
  setPage(i, page, { reload = true } = {}) {
    const rec = this.recs[i]; if (!rec || rec.page === page) return;
    rec.page = page; this.plan.scenes[i].page = page;
    if (!reload) return;
    rec.reload = true;   // a fresh copy of the new page, brought to the scene's current time
    return this.seekScene(i, rec.t);
  }
  update(plan) {
    const pages = plan.scenes.map((s) => s.page);
    this.plan = Object.assign({}, plan, { scenes: plan.scenes.map((s, i) => Object.assign({}, s, { page: this.recs[i] ? this.recs[i].page : s.page })) });
    this.T = plan.T;
    pages.forEach((p, i) => this.setPage(i, p));
    return this.seek(Math.min(this.t, this.T));
  }
  destroy() { this.stage.remove(); }
}

// the whole film as one page: the player with every scene page inside, window.__glSeek(t) for renders
GLPlayer.filmPage = (plan, playerSrc) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>film</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${plan.background ? String(plan.background).replace(/[<>;{}]/g, '') : 'transparent'}}</style>
</head><body>
<script>${safe(playerSrc)}</script>
<script>
(function () {
  var plan = ${json(plan)};
  var player = new GLPlayer(plan, document.body);
  player.stage.style.left = '50%'; player.stage.style.top = '50%';
  player.stage.style.marginLeft = (-plan.W / 2) + 'px'; player.stage.style.marginTop = (-plan.H / 2) + 'px';
  var manual = false, t0 = null;
  window.__glDuration = plan.T;
  window.__glSeek = function (t) { manual = true; return player.ready.then(function () { return player.seek(Math.max(0, Math.min(plan.T, t))); }); };
  // opened on its own: it plays; a host that seeks it takes over
  function frame(ts) { if (manual) return; if (t0 === null) t0 = ts; player.seek(Math.min(plan.T, (ts - t0) / 1000)); requestAnimationFrame(frame); }
  player.ready.then(function () { if (!manual) { player.seek(0); requestAnimationFrame(frame); } window.__glReady = true; });
})();
</script>
</body></html>
`;
G.GLPlayer = GLPlayer;
})();
