// Exports.
//   node tools/export.mjs <project> --format glea-layers | glea-html | ae  [--standalone] [--board <id>]
// glea-layers  every shape, text and keyframe as its own Video Editor layer (recommended)
// glea-html    one HTML clip per scene (each scene page self-contained)
// ae           an After Effects .jsx (+ the pictures it imports)
// Standalone → files in <project>/exports/: a GLEA bundle (.zip — import it in GreenLight Dash:
// Video Editor ▸ Projects ▸ Import, or POST /api/moodboards/{id}/video-projects/import) and, for AE,
// a folder with the .jsx next to its assets/ (+ the same as a .zip). Under a board → the Video Editor
// project is created on the board (GLEA), or the AE .zip is saved into the board folder.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject, board, boardState, imageSizes, voiceClips, isUrl, ensureUpload, arg, pullEdits } from './project.mjs';
import { ensurePipeline, addOutput } from './pipeline.mjs';
import { sfxCues } from './audio.mjs';
import { boardAssets, scenePage } from './build.mjs';
import { renderPage, findPython } from './render.mjs';

/** An HTML-only scene recorded as ProRes 4444 (alpha) for After Effects: the local render engine, or —
 *  under a board — the app's own renderer (nothing to install). r = one of MU.aeScript's renders. */
async function sceneFootage(project, r, dest, B) {
  const { scenario } = project;
  const html = scenePage(project, r.scene);   // its pictures inlined: it records anywhere
  const size = { width: scenario.size.w, height: scenario.size.h, fps: scenario.fps, duration: r.duration };
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (B) {
    const out = await B.call('POST', '/api/html/render', { html, ...size, format: 'mov', board_id: B.id, title: `${scenario.name} scene ${r.scene + 1}` });
    const res = await fetch(B.api + out.url, { headers: B.headers });
    if (!res.ok) throw new Error(`scene ${r.scene + 1}: could not fetch its render (${res.status})`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return dest;
  }
  const page = path.join(project.dir, `.scene-${r.scene + 1}.html`);
  fs.writeFileSync(page, html);
  try { return await renderPage(page, dest, { ...size, format: 'mov', python: findPython() }); } finally { fs.rmSync(page, { force: true }); }
}

export const FORMATS = { 'glea-layers': 'GLEA with layers', 'glea-html': 'GLEA with HTML cards', ae: 'After Effects' };

/** Standalone export → { file, hint } (paths inside <project>/exports). B: record HTML-only scenes
 *  (After Effects footage) through that board's app instead of the local render engine. */
// a 3D-engine film: its scenes are HTML pages — the Video Editor gets them as HTML clips, After Effects nothing
const engineFormat = (scenario, format) => {
  if (scenario.engine !== '3d') return format;
  if (format === 'ae') throw new Error('a 3D-engine film has no After Effects export (its scenes are HTML pages): render it, or export glea-html');
  return 'glea-html';
};
export async function exportLocal(project, format, B = null) {
  const { scenario, MU, dir } = project;
  format = engineFormat(scenario, format);
  const out = path.join(dir, 'exports'); fs.mkdirSync(out, { recursive: true });
  const sizes = imageSizes(project);
  // the bundle's media live at /media/greenlight-motion/<id>/<name>; the import copies them into the board
  const media = []; const names = new Set();
  const mediaUrl = (src) => {
    if (isUrl(src)) return src;
    const f = path.join(dir, src); if (!fs.existsSync(f)) return src;
    let m = media.find((x) => x.src === src);
    if (!m) {
      let name = path.basename(f); while (names.has(name)) name = '1-' + name;
      names.add(name); m = { src, rel: `greenlight-motion/${scenario.id}/${name}`, data: fs.readFileSync(f) }; media.push(m);
    }
    return '/media/' + m.rel;
  };
  const voice = voiceClips(project).map((c) => ({ url: mediaUrl(c.file), start: c.start || 0, duration: c.duration, name: c.name || `Voice ${c.scene || ''}`.trim() }));
  const sfx = sfxCues(project).map((c) => ({ url: mediaUrl(c.file), start: c.start, duration: c.length || 1, gain: c.gain, name: c.label || c.role }));
  // a scene page in the bundle (self-contained: its pictures inlined)
  const scenePageUrl = (i) => {
    const rel = `greenlight-motion/${scenario.id}/scene-${i + 1}.html`;
    if (!media.find((m) => m.rel === rel)) media.push({ src: rel, rel, data: Buffer.from(scenePage(project, i)) });
    return '/media/' + rel;
  };
  if (format === 'glea-layers') {
    // HTML-only scenes (items too heavy for editor layers) go in as their HTML clip
    const htmlUrls = []; for (const i of MU.htmlOnlyScenes(scenario)) htmlUrls[i] = scenePageUrl(i);
    const p = MU.veLayers(scenario, { imageSizes: sizes, url: mediaUrl, voice, sfx, htmlUrls });
    const file = path.join(out, `${scenario.id}-glea-layers.zip`);
    fs.writeFileSync(file, MU.veBundle(p, media));
    return { file, layers: p.data.channels.length, approx: p.approx, hint: 'Import it in GreenLight Dash: Video Editor › Projects › Import project.' };
  }
  if (format === 'glea-html') {
    const urls = project.MU.timing(scenario).map((_, i) => scenePageUrl(i));
    const p = MU.veHtmlCards(scenario, { htmlUrls: urls, voice, sfx });
    const file = path.join(out, `${scenario.id}-glea-html.zip`);
    fs.writeFileSync(file, MU.veBundle({ name: `${p.name} (HTML)`, data: p.data }, media));
    return { file, scenes: urls.length, hint: 'Import it in GreenLight Dash: Video Editor › Projects › Import project.' };
  }
  if (format === 'ae') {
    const ae = MU.aeScript(scenario, { imageSizes: sizes });
    const folder = path.join(out, `${scenario.id}-after-effects`);
    fs.mkdirSync(path.join(folder, 'assets'), { recursive: true });
    const entries = [{ name: `${scenario.id}.jsx`, data: ae.jsx }];
    fs.writeFileSync(path.join(folder, `${scenario.id}.jsx`), ae.jsx);
    for (const [src, rel] of Object.entries(ae.files)) {
      const f = path.join(dir, src); if (!fs.existsSync(f)) continue;
      fs.copyFileSync(f, path.join(folder, rel)); entries.push({ name: rel, data: fs.readFileSync(f) });
    }
    for (const r of ae.renders) {   // HTML-only scenes: pre-rendered footage beside the script
      const dest = path.join(folder, r.file);
      await sceneFootage(project, r, dest, B);
      entries.push({ name: r.file, data: fs.readFileSync(dest) });
    }
    const file = path.join(out, `${scenario.id}-after-effects.zip`);
    fs.writeFileSync(file, MU.zip(entries));
    return { file, folder, jsx: path.join(folder, `${scenario.id}.jsx`), layers: ae.layers, footage: ae.renders.length, approx: ae.approx,
      hint: `Run ${scenario.id}.jsx in After Effects: File › Scripts › Run Script File (keep assets/ next to it).` };
  }
  throw new Error(`unknown format "${format}" — use ${Object.keys(FORMATS).join(', ')}`);
}

/** Under a board → { project | file, … } */
export async function exportBoard(project, format, B) {
  const { scenario, MU } = project;
  format = engineFormat(scenario, format);
  const state = boardState(project, B.id);
  const A = await boardAssets(B, project, state);
  const url = (p) => (isUrl(p) || p.startsWith('/') ? p : `${A.prefix}/${A.map(p)}`);
  const sizes = {}; for (const [p, z] of Object.entries(imageSizes(project))) sizes[p] = z;
  const voice = voiceClips(project).map((c) => ({ url: url(c.file), start: c.start || 0, duration: c.duration, name: c.name || `Voice ${c.scene || ''}`.trim() }));
  const sfx = sfxCues(project).map((c) => ({ url: url(c.file), start: c.start, duration: c.length || 1, gain: c.gain, name: c.label || c.role }));
  const scenePageBoard = async (i) => ensureUpload(B, state, `scene:${i + 1}`, `scene-${i + 1}.html`, Buffer.from(scenePage(project, i)), A.folder);
  if (format === 'glea-layers') {
    const htmlUrls = []; for (const i of MU.htmlOnlyScenes(scenario)) htmlUrls[i] = await scenePageBoard(i);
    const p = MU.veLayers(scenario, { imageSizes: sizes, url, voice, sfx, htmlUrls });
    const made = await B.call('POST', `/api/moodboards/${B.id}/video-projects`, { name: p.name, data: p.data });
    return { project: made.id, name: made.name, layers: p.data.channels.length, approx: p.approx };
  }
  if (format === 'glea-html') {
    const urls = [];
    for (let i = 0; i < MU.timing(scenario).length; i++) urls.push(await scenePageBoard(i));
    const p = MU.veHtmlCards(scenario, { htmlUrls: urls, voice, sfx });
    const made = await B.call('POST', `/api/moodboards/${B.id}/video-projects`, { name: `${p.name} (HTML)`, data: p.data });
    return { project: made.id, name: made.name, scenes: urls.length };
  }
  if (format === 'ae') {
    const local = await exportLocal(project, 'ae', B);
    const up = await B.upload(path.basename(local.file), fs.readFileSync(local.file), A.folder);
    return { ...local, boardUrl: up.url };
  }
  throw new Error(`unknown format "${format}" — use ${Object.keys(FORMATS).join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api', '--format'].includes(argv[i - 1]))) || '.';
  const format = arg(argv, 'format', 'glea-layers');
  let project = loadProject(dir);
  const B = await board(argv);
  // the user's edits saved on the preview card first (scenario.json → edits): the export carries them
  if (B) ({ project } = await pullEdits(B, project));
  for (const p of project.problems) console.warn('! ' + p);
  let res;
  try { res = B ? await exportBoard(project, format, B) : await exportLocal(project, format); } catch (e) { console.log(JSON.stringify({ ok: false, format, error: e.message })); process.exit(1); }
  if (project.scenario.engine === '3d' && format !== 'glea-html') res = Object.assign({ note: 'a 3D-engine film exports its scenes as HTML clips (glea-html)' }, res);
  if (B) {
    const state = boardState(project, B.id);
    await ensurePipeline(B, project, state);
    await addOutput(B, state, format === 'ae' ? `After Effects: ${path.basename(res.file || '')} (in the film's board folder)` : `Video Editor project: ${res.name}`);
  }
  console.log(JSON.stringify({ ok: true, mode: B ? 'board' : 'standalone', format, ...res }));
}
