// The gallery: every scene playing with the user's copy + every GL Motion item the film uses, the
// alternatives offered per scene, and the items built new for it. Optional: the workflow's visual check is
// the storyboard (it lists the same items); use the gallery when the user wants to browse or swap items, or
// when there is no storyboard and no board.
//   node tools/gallery.mjs <project> [--artifact] [--standalone] [--board <id>] [--api <url>]
// Standalone → <project>/gallery.html (open it in a browser); --artifact also writes
// <project>/gallery.artifact.html for the Artifact tool. Under a GreenLight Dash board → an HTML card
// "<name> — gallery" in free space, updated in place on the next run.
// Scenario fields it reads: gallery.brief (one line under the title), gallery.alternatives
// ({ "<scene number>": ["item-id", …] }) and the project's own items (items/*.js → "Built new").
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, pageScripts, board, boardState, freeSpot, upsertHtmlCard } from './project.mjs';
import { boardAssets, libraryItems } from './build.mjs';
import { build, picturesFor } from './page.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api'].includes(argv[i - 1]))) || '.';
const project = loadProject(dir);
const { K, scenario } = project;
if (scenario.engine === '3d') {
  console.log(JSON.stringify({ ok: false, error: 'a 3D-engine film has no gallery (it uses no GL Motion items): the storyboard and the preview show its scenes' }));
  process.exit(1);
}
for (const p of project.problems) console.warn('! ' + p);

// the items to show: used (with their scene numbers), alternatives, built new
const items = libraryItems(project, null, (m) => console.warn(m.replace('! ', '! gallery: ')));

const files = [...new Set(items.map((it) => K.elements.find((e) => e.id === it.id).file))];
const scripts = pageScripts(project, { files }).filter(([name]) => !['converter.js', 'html-export.js', 'ae-export.js'].includes(name));
const page = (target, sc) => build('gallery.html', {
  title: scenario.name, target, appClass: 'mugl-app', scripts,
  data: { scenario: sc, items, brief: (scenario.gallery && scenario.gallery.brief) || '' },
});

const B = await board(argv);
if (!B) {
  const out = path.join(project.dir, 'gallery.html');
  fs.writeFileSync(out, page('local', picturesFor(project, 'local')));
  console.log(`gallery: ${out}`);
  if (argv.includes('--artifact')) {
    const art = path.join(project.dir, 'gallery.artifact.html');
    fs.writeFileSync(art, page('artifact', picturesFor(project, 'artifact')));
    console.log(`artifact page: ${art} (publish it with the Artifact tool)`);
  }
  console.log(JSON.stringify({ ok: true, mode: 'standalone', file: out, items: items.length, scenes: scenario.scenes.length }));
} else {
  // pictures go to the film's board folder; the card sits at the board folder's root, so board-relative
  // paths work in it
  const state = boardState(project, B.id);
  const A = await boardAssets(B, project, state);
  const html = page('board', picturesFor(project, 'board', A.map));
  const at = state.st.cards.gallery ? {} : await freeSpot(B);
  const W = 1400; const Hh = 980;
  const cardId = await upsertHtmlCard(B, state, 'gallery', { title: `${scenario.name} — gallery`, html, width: W, height: Hh, ...at });
  console.log(JSON.stringify({ ok: true, mode: 'board', board: B.id, card: cardId, items: items.length, scenes: scenario.scenes.length }));
}
