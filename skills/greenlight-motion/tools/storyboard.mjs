// The storyboard: 2–3 variants of the film side by side, one frame per shot with every line of its copy and its part of
// the voice-over under it, so the user reads the words and picks a direction before the preview, the recorded
// voice-over and the render. It follows the approved scenario (story.mjs) directly.
//   node tools/storyboard.mjs <project> [--artifact] [--standalone] [--board <id>] [--api <url>]
//   node tools/storyboard.mjs <project> --pick <id>        the user's choice becomes the scenario
// Variants live in scenario.json → "storyboard": { "variants": [{ "id": "a", "name", "note", "motion",
// "scenes": [...] }, …] }; everything else (size, theme, accent, background) is shared. Without variants the
// storyboard shows the scenario itself. A scene may set "keyframe": seconds into the scene for its frame (default:
// 72 % of it, where most scenes have settled). The frames are stills the render engine draws (the app under a board).
// Standalone → <project>/storyboard.html (+ storyboard.artifact.html with --artifact). Under a board → the card in the
// film's pipeline (the Storyboard lane), updated in place; --pick approves the Storyboard step. The card also lists
// the library scenes the directions use and their alternatives.
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, check, pageScripts, sources, board, boardState, upsertHtmlCard, mapImages, isUrl, dataUri, arg, pageWords } from './project.mjs';
import { pageStills } from './frames.mjs';
import { findPython } from './render.mjs';
import { showCard, setStep } from './pipeline.mjs';
import { boardAssets, libraryItems } from './build.mjs';
import { build } from './page.mjs';
import { CORE, libSource } from './kit.mjs';

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
// a shot's words: a library scene's copy (its text overrides), a page's visible text
const docOf = (sc) => { const f = sc.html ? path.join(project.dir, sc.html) : null; return f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
const wordsOf = (v, i) => { const sc = v.scenes[i] || {}; return sc.html ? pageWords(docOf(sc)) : Object.values(sc.text || {}).map(String); };
/** The card's height at 1400 px (measured on the page): 242 for its padding and header; per variant 85 (+13 with a
 *  note) around rows of 5 shots, 14 apart — a shot is its frame + 67, every line of copy 20 (+8 for the block), the
 *  voice-over part 18 a line (+8); the variants 18 apart; the items list 26 + 108 + rows of 215, 18 apart. */
const storyboardHeight = (vs, nItems) => {
  const size = project.scenario.size; const colW = (1282 - 4 * 14) / 5; const frameH = colW * size.h / size.w;
  const lines = (t, n) => Math.max(1, Math.ceil(String(t || '').length / n));
  const varH = (v) => {
    const sc = MU.normalize(scenarioOf(v)); const vo = MU.sceneVoices(Object.assign({}, sc, { voiceover: null }));
    const shot = (s, i) => {
      const copy = wordsOf(v, i);
      return frameH + 67 + (copy.length ? 8 + copy.reduce((a, t) => a + 20 * lines(t, 42), 0) : 0) + (vo[i] ? 8 + 18 * lines(vo[i], 40) : 0);
    };
    const hs = sc.scenes.map(shot); let h = 0;
    for (let r = 0; r < hs.length; r += 5) h += Math.max(...hs.slice(r, r + 5)) + (r ? 14 : 0);
    return 85 + (v.note ? 13 * lines(v.note, 110) : 0) + h;
  };
  const rows = Math.ceil(nItems / 5);
  return Math.round(242 + vs.reduce((a, v) => a + varH(v), 0) + (vs.length - 1) * 18 + (nItems ? 26 + 108 + rows * 215 + (rows - 1) * 18 : 0) + 12);
};

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

// ── problems per variant (missing pages, unknown library scenes, text ids, pictures) ──
let problems = 0;
for (const v of variants) {
  const sc = MU.normalize(scenarioOf(v));
  for (const p of check(project.dir, sc, K, scenarioOf(v), sources(project, sc).scenes)) { console.warn(`! variant ${v.id}: ${p}`); problems += 1; }
}

// every shot as a still: the film page of each variant at its shots' settled moments (the app draws them under a board,
// the render engine standalone; without either, the rows show the words only)
const B = await board(argv);
let stillsNote = null;
for (const v of variants) {
  const sc = MU.normalize(scenarioOf(v));
  // under a board the app draws the page away from the project: its pictures go inline
  const inline = (p) => (!B || isUrl(p) || !fs.existsSync(path.join(project.dir, p)) ? p : dataUri(path.join(project.dir, p)));
  const html = MU.pageHtml(mapImages(sc, inline), sources(project, sc, { map: inline }));
  const tm = MU.timing(sc);
  const times = tm.map((t, i) => +(t.start + (Number.isFinite(+sc.scenes[i].keyframe) ? +sc.scenes[i].keyframe : 0.72 * t.duration)).toFixed(3));
  try { v.stills = await pageStills({ B, html, width: sc.size.w, height: sc.size.h, times, dir: project.dir, python: findPython(argv) }); }
  catch (e) { stillsNote = e.message.split('\n')[0]; v.stills = null; }
  v.T = tm.length ? tm[tm.length - 1].end : 0;
  v.shots = sc.scenes.map((s, i) => {
    const el = s.item && K.elements.find((e) => e.id === s.item);
    return { title: s.title || (el ? el.name : `Shot ${i + 1}`), kind: s.html ? 'page' : 'library', label: s.html || (el ? el.name : s.item), duration: tm[i].duration,
      transition: s.transition === 'fade' ? 'fade' : 'cut', words: wordsOf(v, i) };
  });
  v.voice = MU.sceneVoices(Object.assign({}, sc, { voiceover: null }));
}
if (stillsNote) console.warn(`! no frames: ${stillsNote} (node tools/doctor.mjs says what the render engine needs)`);
// the library scenes the directions use, and the alternatives listed per shot
const items = libraryItems(project, variants.length > 1 ? variants : null, () => {});
const files = [...new Set(items.map((it) => { const el = K.elements.find((e) => e.id === it.id); return el && el.file; }).filter(Boolean))];
const scripts = items.length ? [...CORE, ...files].map((f) => [f, libSource(f)]) : [];
const page = (target) => build('storyboard.html', {
  title: `${raw.name || 'Film'} — storyboard`, target, appClass: 'musb-app', scripts,
  data: {
    name: raw.name || 'Film', picked: (raw.storyboard && raw.storyboard.picked) || null, target, items,
    size: project.scenario.size, fps: project.scenario.fps, theme: project.scenario.theme, accent: project.scenario.accent, background: project.scenario.background,
    variants: variants.map((v) => ({ id: v.id, name: v.name, note: v.note, motion: v.motion, T: v.T, shots: v.shots, voice: v.voice, stills: v.stills })),
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
  console.log(JSON.stringify({ ok: true, mode: 'standalone', file: out, variants: variants.map((v) => v.id), shots: variants.map((v) => v.scenes.length), problems, height: storyboardHeight(variants, items.length) }));
} else {
  const state = boardState(project, B.id);
  // every variant's pictures go up with the film's other assets
  const all = Object.assign({}, raw, { scenes: variants.flatMap((v) => v.scenes) });
  const A = await boardAssets(B, Object.assign({}, project, { scenario: MU.normalize(all) }), state);   // raw stays: the scenario record is the real one
  const html = page('board');
  // the card in the pipeline's Storyboard lane: the Scenario gate approved, this one waiting for the pick
  const h = storyboardHeight(variants, items.length);
  const cardId = await upsertHtmlCard(B, state, 'storyboard', { title: `${raw.name || 'Film'} — storyboard`, html, width: 1400, height: h });
  await showCard(B, project, state, 'storyboard', cardId, 1400, h);
  console.log(JSON.stringify({ ok: true, mode: 'board', board: B.id, card: cardId, variants: variants.map((v) => v.id), problems }));
}
