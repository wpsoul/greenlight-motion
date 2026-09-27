// The storyboard: 2–3 variants of the film side by side, one key frame per shot, so the user picks a
// direction before the preview, the voice-over and the render.
//   node tools/storyboard.mjs <project> [--artifact] [--standalone] [--board <id>] [--api <url>]
//   node tools/storyboard.mjs <project> --pick <id>        the user's choice becomes the scenario
// Variants live in scenario.json → "storyboard": { "variants": [{ "id": "a", "name", "note", "motion",
// "scenes": [...] }, …] }; everything else (size, theme, accent, background) is shared. Without
// variants the storyboard shows the scenario itself. A scene may set "keyframe": seconds into the scene
// for its storyboard frame (default: 72 % of it, where most items have settled).
// Standalone → <project>/storyboard.html (+ storyboard.artifact.html with --artifact). Under a board → the
// card in the film's pipeline (the Storyboard lane), updated in place; --pick approves the Storyboard step.
// The card also lists the GL Motion items: the directions' items, the alternatives, the ones built new.
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, check, pageScripts, sources, board, boardState, upsertHtmlCard, mapImages, isUrl, dataUri, arg } from './project.mjs';
import { pageStills } from './frames.mjs';
import { findPython } from './render.mjs';
import { showCard, setStep } from './pipeline.mjs';
import { boardAssets, libraryItems } from './build.mjs';
import { build } from './page.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api', '--pick'].includes(argv[i - 1]))) || '.';
const project = loadProject(dir);
const { K, MU, raw } = project;
const scenarioFile = path.join(project.dir, 'scenario.json');

const list = (raw.storyboard && Array.isArray(raw.storyboard.variants) && raw.storyboard.variants.length)
  ? raw.storyboard.variants : [{ id: 'a', name: raw.name || 'The scenario', scenes: raw.scenes, motion: raw.motion }];
const variants = list.map((v, i) => ({
  id: String(v.id || String.fromCharCode(97 + i)).toLowerCase(),
  name: v.name || `Variant ${String.fromCharCode(65 + i)}`,
  note: v.note || '',
  motion: v.motion != null ? v.motion : raw.motion,
  scenes: Array.isArray(v.scenes) && v.scenes.length ? v.scenes : raw.scenes,
}));
const scenarioOf = (v) => Object.assign({}, raw, { scenes: v.scenes, motion: v.motion });
/** The card's height at 1400 px: the header, a row per variant, the items (5 tiles a row). */
const storyboardHeight = (nVariants, nItems) => 360 + nVariants * 330 + (nItems ? 170 + Math.ceil(nItems / 5) * 225 : 0);

// ── the user's choice ──
const pick = arg(argv, 'pick', null);
if (pick) {
  const v = variants.find((x) => x.id === String(pick).toLowerCase());
  if (!v) { console.log(JSON.stringify({ ok: false, error: `no variant "${pick}" — have ${variants.map((x) => x.id).join(', ')}` })); process.exit(1); }
  const next = Object.assign({}, raw, { scenes: v.scenes });
  if (v.motion != null) next.motion = v.motion;
  next.storyboard = Object.assign({}, raw.storyboard || {}, { picked: v.id });
  fs.writeFileSync(scenarioFile, JSON.stringify(next, null, 2) + '\n');
  // under a board: the pick is the Storyboard step's approval
  const Bp = await board(argv);
  if (Bp) { const st = boardState(project, Bp.id); if (st.st.pipeline) await setStep(Bp, st, 'storyboard', { approval: 'approved' }); }
  console.log(JSON.stringify({ ok: true, picked: v.id, name: v.name, scenes: v.scenes.length, motion: next.motion || 'spring' }));
  process.exit(0);
}

// ── problems per variant (unknown items, text ids, pictures) ──
let problems = 0;
for (const v of variants) {
  for (const p of check(project.dir, MU.normalize(scenarioOf(v)), K)) { console.warn(`! variant ${v.id}: ${p}`); problems += 1; }
}

// a 3D-engine film: its shots are HTML pages — the card shows each one as a rendered still (the app records them under a
// board, the render engine standalone), and there are no library items
const ENGINE3D = project.scenario.engine === '3d';
const B = await board(argv);
if (ENGINE3D) {
  const src = sources(project);
  const inline = (p) => (isUrl(p) || !fs.existsSync(path.join(project.dir, p)) ? p : dataUri(path.join(project.dir, p)));
  for (const v of variants) {
    const sc = MU.normalize(scenarioOf(v));
    const docs = sc.scenes.map((s) => { const f = s.html ? path.join(project.dir, s.html) : null; return f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; });
    const html = MU.pageHtml(B ? mapImages(sc, inline) : sc, Object.assign({}, src, { scenes: docs }));
    const tm = MU.timing(sc);
    const times = tm.map((t, i) => +(t.start + (Number.isFinite(+sc.scenes[i].keyframe) ? +sc.scenes[i].keyframe : 0.72 * t.duration)).toFixed(3));
    v.stills = await pageStills({ B, html, width: sc.size.w, height: sc.size.h, times, dir: project.dir, python: findPython(argv) });
  }
}
// the GL Motion items: every variant's, the alternatives per shot, the ones built new (the gallery's list)
const items = ENGINE3D ? [] : libraryItems(project, variants.length > 1 ? variants : null, () => {});
// every item any variant uses, and the listed ones
const files = [...new Set([...variants.flatMap((v) => v.scenes.map((s) => s.item)), ...items.map((it) => it.id)]
  .map((id) => { const el = K.elements.find((e) => e.id === id); return el && el.file; }).filter(Boolean))];
const scripts = pageScripts(project, { files }).filter(([name]) => !['converter.js', 'html-export.js', 'ae-export.js', 'three.js', 'scene.js'].includes(name));
const picturesOf = (sc, target, rel = (p) => p) => mapImages(sc, (src) => {
  if (isUrl(src)) return src;
  const f = path.join(project.dir, src);
  if (target === 'artifact' && fs.existsSync(f)) return dataUri(f);
  return rel(src);
});
const page = (target, rel) => build('storyboard.html', {
  title: `${raw.name || 'Film'} — storyboard`, target, appClass: 'musb-app', scripts,
  data: {
    name: raw.name || 'Film', picked: (raw.storyboard && raw.storyboard.picked) || null, target, items,
    variants: variants.map((v) => ({ id: v.id, name: v.name, note: v.note, scenario: picturesOf(scenarioOf(v), target, rel), ...(v.stills ? { stills: v.stills } : {}) })),
  },
});

if (!B) {
  const out = path.join(project.dir, 'storyboard.html');
  fs.writeFileSync(out, page('local'));
  console.log(`storyboard: ${out}`);
  if (argv.includes('--artifact')) {
    const art = path.join(project.dir, 'storyboard.artifact.html');
    fs.writeFileSync(art, page('artifact'));
    console.log(`artifact page: ${art} (publish it with the Artifact tool)`);
  }
  console.log(JSON.stringify({ ok: true, mode: 'standalone', file: out, variants: variants.map((v) => v.id), shots: variants.map((v) => v.scenes.length), problems }));
} else {
  const state = boardState(project, B.id);
  // every variant's pictures go up with the film's other assets
  const all = Object.assign({}, raw, { scenes: variants.flatMap((v) => v.scenes) });
  const A = await boardAssets(B, Object.assign({}, project, { scenario: MU.normalize(all) }), state);   // raw stays: the scenario record is the real one
  const html = page('board', A.map);
  // the card in the pipeline's Storyboard lane: the Script gate approved, this one waiting for the pick
  const h = storyboardHeight(variants.length, items.length);
  const cardId = await upsertHtmlCard(B, state, 'storyboard', { title: `${raw.name || 'Film'} — storyboard`, html, width: 1400, height: h });
  await showCard(B, project, state, 'storyboard', cardId, 1400, h);
  console.log(JSON.stringify({ ok: true, mode: 'board', board: B.id, card: cardId, variants: variants.map((v) => v.id), problems }));
}
