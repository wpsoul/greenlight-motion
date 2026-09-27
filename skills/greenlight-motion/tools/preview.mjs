// The preview: the film playing with a scene bar, and a right panel with the design tokens, the fonts,
// the voice-over, Render and Export.
//   node tools/preview.mjs <project> [--artifact] [--standalone] [--board <id>] [--api <url>]
// Standalone → <project>/preview.html + film.html (the page the render engine records). Open
// preview.html as a file to watch it; run `node tools/serve.mjs <project>` to get working Render and
// Export buttons. --artifact also writes preview.artifact.html (pictures inlined, buttons show the
// commands) for the Artifact tool. Under a GreenLight Dash board → an HTML card in the pipeline's Preview lane.
// Every target lets the user edit the design tokens and the elements (the Elements tab: your `ui` panels and
// `params`); the edits are saved to scenario.json → edits (serve.mjs), on the card (board), or in the browser
// (a file / an artifact: "Copy for the agent"). node tools/edits.mjs lists them.
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, board, boardState, upsertHtmlCard, pullEdits } from './project.mjs';
import { showCard } from './pipeline.mjs';
import { previewPage, filmPage, boardAssets } from './build.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api'].includes(argv[i - 1]))) || '.';
let project = loadProject(dir);
const B = await board(argv);
// under a board the user's edits live on the preview card: they come back into scenario.json → edits first
if (B) ({ project } = await pullEdits(B, project));
const { scenario } = project;
for (const p of project.problems) console.warn('! ' + p);
if (project.problems.some((p) => /unknown item|fails to build|no scenes/.test(p))) process.exit(1);

if (!B) {
  const out = path.join(project.dir, 'preview.html');
  fs.writeFileSync(out, previewPage(project, { target: 'local', mode: { kind: 'static' } }));
  fs.writeFileSync(path.join(project.dir, 'film.html'), filmPage(project));
  console.log(`preview: ${out}`);
  if (argv.includes('--artifact')) {
    const art = path.join(project.dir, 'preview.artifact.html');
    fs.writeFileSync(art, previewPage(project, { target: 'artifact', mode: { kind: 'static' } }));
    console.log(`artifact page: ${art} (publish it with the Artifact tool)`);
  }
  console.log(JSON.stringify({ ok: true, mode: 'standalone', file: out, film: path.join(project.dir, 'film.html') }));
} else {
  const state = boardState(project, B.id);
  const A = await boardAssets(B, project, state);
  let boardName = '';
  try { boardName = (await B.call('GET', `/api/moodboards/${B.id}`)).name || ''; } catch { /* optional */ }
  const W = 1600; const Hh = 1000;
  // app: where the app answers, for a copy of the card opened from the disk (it links to the served page)
  const mode = { kind: 'board', boardId: B.id, boardName, mediaPrefix: A.prefix, folder: A.folder, app: B.api };
  const cardId = await upsertHtmlCard(B, state, 'preview', { title: `${scenario.name} — preview`, width: W, height: Hh, html: '<!doctype html><title>…</title>' });
  // the card in the pipeline's Preview lane; the agent renders and exports once the user approves it (the card
  // has no Export under a board)
  await showCard(B, project, state, 'preview', cardId, W, Hh);
  mode.cardId = cardId;   // the page saves the user's edits on its own card (data.muEdits)
  await B.call('PUT', `/api/moodboards/${B.id}/elements/${cardId}/html`, { html: previewPage(project, { target: 'board', mode, map: A.map }) });
  console.log(JSON.stringify({ ok: true, mode: 'board', board: B.id, card: cardId, folder: A.folder, assets: Object.keys(A.rel).length }));
}
