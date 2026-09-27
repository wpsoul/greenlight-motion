// Checks without a browser: the scenario (every scene's page or library scene, pictures, the user's edits still matching
// their elements, voice takes), and — with --item <id> or --all — library scenes: does each build, with a unique id, a
// known category and a length. Any folder works for library checks; a project folder adds its scenario.
//   node tools/check.mjs <project|folder> [--item <id> | --all]
import { loadProject, arg } from './project.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--item')) || '.';
const project = loadProject(dir, { optional: true });
const { K } = project;
const ids = argv.includes('--all') ? K.elements.map((e) => e.id) : arg(argv, 'item') ? [arg(argv, 'item')] : [];
const out = { scenario: project.problems.length ? project.problems : 'ok', items: [] };
const seen = new Map();
for (const e of K.elements) seen.set(e.id, (seen.get(e.id) || 0) + 1);
for (const id of ids) {
  const spec = K.elements.find((e) => e.id === id);
  if (!spec) { out.items.push({ id, error: 'unknown library scene' }); continue; }
  const r = { id, name: spec.name, category: spec.cat, duration: spec.T, file: spec.file, problems: [] };
  if (seen.get(id) > 1) r.problems.push(`id "${id}" is used ${seen.get(id)} times — ids must be unique`);
  if (!K.CATS[spec.cat]) r.problems.push(`category "${spec.cat}" is not one of ${Object.keys(K.CATS).join(', ')}`);
  if (!(spec.T > 0)) r.problems.push('T (length in seconds) is missing');
  try {
    let n = 0; const walk = (L) => { n += 1; (L.ch || []).forEach(walk); };
    K.build(spec).forEach(walk); r.layers = n;
  } catch (e) { r.problems.push('build failed: ' + (e && e.message)); }
  out.items.push(r);
}
console.log(JSON.stringify(out, null, 1));
process.exit(out.items.some((r) => r.error || (r.problems && r.problems.length)) || project.problems.length ? 1 : 0);
