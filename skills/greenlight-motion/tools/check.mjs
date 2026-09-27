// Checks without a browser: the scenario, and every item the project built (or --item <id>, or --all
// = every library item — after an engine change): does it build, its layers and keyframes (Video
// Editor cost), what the editor can't do yet, and what the Video Editor / After Effects exports
// approximate. Any folder works for library items; a project folder adds its scenario and items/.
//   node tools/check.mjs <project|folder> [--item <id> | --all]
import path from 'node:path';
import { loadProject, arg } from './project.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--item')) || '.';
const project = loadProject(dir, { optional: true });
const { K } = project;
const own = K.elements.filter((e) => project.extra.some((f) => path.basename(f) === e.file));
const ids = argv.includes('--all') ? K.elements.map((e) => e.id) : arg(argv, 'item') ? [arg(argv, 'item')] : own.map((e) => e.id);
const out = { scenario: project.problems.length ? project.problems : 'ok', items: [] };
const seen = new Map();
for (const e of K.elements) seen.set(e.id, (seen.get(e.id) || 0) + 1);
for (const id of ids) {
  const spec = K.elements.find((e) => e.id === id);
  if (!spec) { out.items.push({ id, error: 'unknown item' }); continue; }
  const r = { id, name: spec.name, category: spec.cat, duration: spec.T, file: spec.file, problems: [] };
  if (seen.get(id) > 1) r.problems.push(`id "${id}" is used ${seen.get(id)} times — ids must be unique`);
  if (!K.CATS[spec.cat]) r.problems.push(`category "${spec.cat}" is not one of ${Object.keys(K.CATS).join(', ')}`);
  if (!(spec.T > 0)) r.problems.push('T (length in seconds) is missing');
  const d = K.describe(spec);
  if (d.error) { r.problems.push('build failed: ' + d.error); out.items.push(r); continue; }
  r.layers = d.rows.length; r.keys = d.keys; r.formats = K.formatsOf(spec);
  const layersOk = K.canLayers(spec);
  if (layersOk && d.gaps && d.gaps.length) r.problems.push('the Video Editor cannot animate: ' + d.gaps.join(', '));
  try {
    const rep = K.toVE(spec).report; r.editor = { layers: rep.items, keys: rep.keys };
    if (layersOk) r.approximations = rep.approx;
    // past the limit an item is too heavy to edit as layers: it must go as HTML
    const L = K.VE_LIMITS;
    if (layersOk && (rep.items > L.layers || rep.keys > L.keys)) r.problems.push(`${rep.items} editor layers / ${rep.keys} keyframes — over the limit (${L.layers} / ${L.keys}): simplify it, or declare formats: ['html']`);
  } catch (err) { if (layersOk) r.problems.push('Video Editor conversion failed: ' + err.message); }
  if (layersOk) { try { K.toAE(spec); } catch (err) { r.problems.push('After Effects export failed: ' + err.message); } }
  out.items.push(r);
}
console.log(JSON.stringify(out, null, 1));
process.exit(out.items.some((r) => r.error || (r.problems && r.problems.length)) || project.problems.length ? 1 : 0);
