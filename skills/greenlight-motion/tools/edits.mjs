// The user's changes from the preview — design tokens, element options, the controls you declared — as
// scenario.json → edits (references/scenario.md → Edits). Every tool applies them (render, exports, stills);
// this one shows them in words, makes them the film's own values, or drops them.
//   node tools/edits.mjs <project> [--json] [--board <id>] [--api <url>]   what changed (under a board: pulled from the preview card first)
//   node tools/edits.mjs <project> --fold     keep them as the film's own values (scene text / images / style / params,
//                                             film colors / recolor / font …); the edits are cleared
//   node tools/edits.mjs <project> --clear    drop them: the film as you made it
// Fold before you rebuild or reorder scenes (edits are keyed by scene number).
import { loadProject, board, pullEdits, pushEdits, readJSON, writeJSON } from './project.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api'].includes(argv[i - 1]))) || '.';
let project = loadProject(dir);
const B = await board(argv);
if (B) ({ project } = await pullEdits(B, project));
const { K, MU } = project;
const edits = project.raw.edits || null;

// ── what changed, in words ──
const base = MU.normalize(project.raw, { edits: false });
const layersOf = (i) => {
  const map = new Map();
  const walk = (L) => { if (L._scene === i) map.set(L._key, L); (L.ch || []).forEach(walk); };
  try { K.build(K.compose(base, { scene: i })).forEach(walk); } catch { /* an unknown item: the scenario check says so */ }
  return map;
};
const show = (v) => (v == null ? 'none' : typeof v === 'string' ? (v.startsWith('data:') ? 'a picture chosen in the preview' : JSON.stringify(v)) : JSON.stringify(v));
const lines = [];
if (edits) {
  const f = edits.film || {};
  for (const k of ['theme', 'accent', 'background', 'font']) if (k in f) lines.push({ scope: 'film', what: k, from: base[k] ?? null, to: f[k] });
  for (const [k, v] of Object.entries(f.colors || {})) lines.push({ scope: 'film', what: `token ${k}`, from: (base.colors && base.colors[k]) || K.THEMES[base.theme][k], to: v });
  for (const [k, v] of Object.entries(f.recolor || {})) lines.push({ scope: 'film', what: `item colour ${k}`, from: k, to: v });
  for (const [n, e] of Object.entries(edits.scenes || {})) {
    const i = +n - 1, sc = base.scenes[i]; if (!sc) continue;
    const L = layersOf(i), scope = `scene ${n} (${sc.title || sc.item})`;
    for (const [k, v] of Object.entries(e.text || {})) lines.push({ scope, what: `${k} text`, from: (sc.text && sc.text[k]) ?? (L.get(k) && L.get(k).text) ?? null, to: v });
    for (const [k, v] of Object.entries(e.images || {})) lines.push({ scope, what: `${k} picture`, from: (sc.images && sc.images[k]) ?? null, to: v });
    for (const [k, st] of Object.entries(e.style || {})) for (const [p, v] of Object.entries(st)) lines.push({ scope, what: `${k} ${p}`, from: L.get(k) ? K.style.restOf(L.get(k), p) : null, to: v });
    const P = K.paramsOf(K.elements.find((x) => x.id === sc.item), sc.params);
    for (const [p, v] of Object.entries(e.params || {})) lines.push({ scope, what: `param ${p}`, from: P[p] ?? null, to: v });
  }
}

if (argv.includes('--fold') || argv.includes('--clear')) {
  const fold = argv.includes('--fold');
  if (!edits) { console.log(JSON.stringify({ ok: true, changes: 0, note: 'no edits' })); process.exit(0); }
  const raw = readJSON(project.file, null);
  const next = fold ? MU.applyEdits(Object.assign({}, raw, { edits: undefined }), edits) : raw;
  delete next.edits;
  writeJSON(project.file, next);
  if (B) await pushEdits(B, project, null);   // the card starts clean too (a later pull would bring them back)
  console.log(JSON.stringify({ ok: true, [fold ? 'folded' : 'cleared']: lines.length, board: !!B }));
  process.exit(0);
}

if (argv.includes('--json')) { console.log(JSON.stringify({ edits, changes: lines }, null, 2)); process.exit(0); }
if (!lines.length) { console.log('No edits: the film is as you made it.'); process.exit(0); }
console.log(`${lines.length} change${lines.length > 1 ? 's' : ''} from the preview (scenario.json → edits):`);
let last = '';
for (const l of lines) {
  if (l.scope !== last) { console.log(`  ${l.scope}`); last = l.scope; }
  console.log(`    ${l.what}: ${show(l.from)} → ${show(l.to)}`);
}
