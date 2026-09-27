// GL Motion site capture: wait (at most ms) for the pictures in view to load — lazy images below the
// fold load once scrolled to. Run by render/capture.py, and sent to the app's /api/site-capture under a board.
async (ms) => {
  const vis = [...document.images].filter((im) => { const r = im.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 0; });
  const wait = vis.filter((im) => !im.complete).map((im) => new Promise((ok) => { im.addEventListener('load', ok, { once: true }); im.addEventListener('error', ok, { once: true }); }));
  await Promise.race([Promise.all(wait), new Promise((ok) => setTimeout(ok, ms))]);
  return vis.length;
}
