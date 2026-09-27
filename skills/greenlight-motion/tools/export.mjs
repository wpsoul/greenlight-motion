// Exports.
//   node tools/export.mjs <project> --format glea | ae  [--standalone] [--board <id>]
// glea  the GreenLight Dash Video Editor: one HTML clip per scene (each scene page self-contained), the voice-over and
//       the sound effects on their own channels. Standalone → <project>/exports/<id>-glea.zip (import it: Video Editor ›
//       Projects › Import project, or POST /api/moodboards/{id}/video-projects/import); under a board → the project.
// ae    After Effects: a package an agent uses to rebuild the film as a native, editable project
//       (references/after-effects.md) — PROMPT.md, timeline.json, the scene pages, reference stills, the pictures and
//       audio, and the script runner. After Effects must be installed and open to build it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject, board, boardState, voiceClips, isUrl, ensureUpload, arg, pullEdits, mapImages, sources } from './project.mjs';
import { ensurePipeline, addOutput } from './pipeline.mjs';
import { sfxCues } from './audio.mjs';
import { boardAssets, scenePage } from './build.mjs';
import { findPython } from './render.mjs';
import { pageStills } from './frames.mjs';
import { SKILL_DIR } from './kit.mjs';

export const FORMATS = { glea: 'GLEA with HTML scenes', ae: 'After Effects (an agent builds it)' };
export const AE_NOTICE = 'After Effects must be installed and open: an agent builds the project in it with the package (PROMPT.md). Nothing runs in After Effects until you ask for it.';

/** Standalone export → { file, hint, … } (paths inside <project>/exports). */
export async function exportLocal(project, format, B = null) {
  const { scenario, MU, dir } = project;
  const out = path.join(dir, 'exports'); fs.mkdirSync(out, { recursive: true });
  if (format === 'glea') {
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
    const urls = MU.timing(scenario).map((_, i) => {
      const rel = `greenlight-motion/${scenario.id}/scene-${i + 1}.html`;
      media.push({ src: rel, rel, data: Buffer.from(scenePage(project, i)) });
      return '/media/' + rel;
    });
    const p = MU.glea(scenario, { htmlUrls: urls, voice, sfx });
    const file = path.join(out, `${scenario.id}-glea.zip`);
    fs.writeFileSync(file, MU.gleaBundle(p, media));
    return { file, scenes: urls.length, hint: 'Import it in GreenLight Dash: Video Editor › Projects › Import project.' };
  }
  if (format === 'ae') return aePackage(project, out, B);
  throw new Error(`unknown format "${format}" — use ${Object.keys(FORMATS).join(', ')}`);
}

/** The After Effects package: everything an agent needs to rebuild the film natively, and the task. */
async function aePackage(project, out, B) {
  const { scenario, MU, dir } = project;
  const folder = path.join(out, `${scenario.id}-after-effects`);
  fs.rmSync(folder, { recursive: true, force: true });
  for (const d of ['scenes', 'reference', 'assets', 'scripts/ae']) fs.mkdirSync(path.join(folder, d), { recursive: true });
  const timing = MU.timing(scenario);
  // the pictures and the audio, by name in assets/
  const taken = new Set(); const asset = {};
  const copy = (src) => {
    if (!src || isUrl(src) || asset[src]) return asset[src] || src;
    const f = path.join(dir, src); if (!fs.existsSync(f)) return src;
    let name = path.basename(f); while (taken.has(name)) name = '1-' + name;
    taken.add(name); fs.copyFileSync(f, path.join(folder, 'assets', name));
    return (asset[src] = 'assets/' + name);
  };
  // every scene as a self-contained page (its pictures inlined): the ground truth
  const pages = timing.map((_, i) => { const rel = `scenes/scene-${i + 1}.html`; fs.writeFileSync(path.join(folder, rel), scenePage(project, i)); return rel; });
  // reference stills: three moments of every scene, drawn by the render engine (the app under a board)
  const times = timing.flatMap((tm) => [0.25, 0.6, 0.95].map((f) => +(tm.start + f * tm.duration).toFixed(3)));
  const stills = {}; let stillsNote = null;
  try {
    const src = sources(project);
    const film = MU.pageHtml(mapImages(scenario, (p) => (isUrl(p) || !fs.existsSync(path.join(dir, p)) ? p : 'data:' + mime(p) + ';base64,' + fs.readFileSync(path.join(dir, p)).toString('base64'))), src);
    const shots = await pageStills({ B, html: film, width: scenario.size.w, height: scenario.size.h, times, dir, python: findPython() });
    shots.forEach((uri, k) => {
      const i = Math.floor(k / 3); const rel = `reference/scene-${i + 1}-${['a', 'b', 'c'][k % 3]}.jpg`;
      fs.writeFileSync(path.join(folder, rel), Buffer.from(uri.split(',')[1], 'base64'));
      (stills[i] = stills[i] || []).push({ file: rel, t: times[k], local: +(times[k] - timing[i].start).toFixed(3) });
    });
  } catch (e) { stillsNote = `no reference stills (${e.message.split('\n')[0]}): take them from the scene pages yourself`; }
  // the latest render, when the film was rendered
  const renders = path.join(dir, 'renders');
  const latest = fs.existsSync(renders) ? fs.readdirSync(renders).filter((f) => /\.mp4$/i.test(f)).map((f) => ({ f, t: fs.statSync(path.join(renders, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0] : null;
  if (latest) fs.copyFileSync(path.join(renders, latest.f), path.join(folder, 'reference/film.mp4'));
  const voice = voiceClips(project).map((c) => ({ file: copy(c.file), start: c.start || 0, duration: c.duration, text: c.text || '' }));
  const sfx = sfxCues(project).map((c) => ({ file: copy(c.file), start: c.start, duration: c.length || 1, gain: c.gain, label: c.label || c.role || '' }));
  for (const sc of scenario.scenes) for (const src of Object.values(sc.images || {})) copy(src);
  const tl = {
    name: scenario.name, size: scenario.size, fps: scenario.fps, duration: timing.length ? timing[timing.length - 1].end : 0,
    background: scenario.background, font: scenario.font || 'Helvetica Neue', fontPostScript: project.K.fontOf(scenario.font || 'Helvetica Neue').ps || null,
    colors: MU.sceneTheme(scenario).tokens,
    scenes: timing.map((tm, i) => ({ n: i + 1, title: scenario.scenes[i].title || '', kind: MU.kindOf(scenario.scenes[i]), start: tm.start, end: tm.end, from: tm.from, to: tm.to,
      transition: scenario.scenes[i].transition || 'cut', page: pages[i], stills: stills[i] || [] })),
    voice, sfx, ...(latest ? { reference: 'reference/film.mp4' } : {}),
  };
  fs.writeFileSync(path.join(folder, 'timeline.json'), JSON.stringify(tl, null, 2));
  for (const f of ['gl-ae-run.sh', 'gl-ae-prelude.jsx']) fs.copyFileSync(path.join(SKILL_DIR, 'scripts/ae', f), path.join(folder, 'scripts/ae', f));
  fs.chmodSync(path.join(folder, 'scripts/ae/gl-ae-run.sh'), 0o755);
  fs.copyFileSync(path.join(SKILL_DIR, 'references/after-effects.md'), path.join(folder, 'after-effects.md'));
  fs.writeFileSync(path.join(folder, 'PROMPT.md'), aePrompt(tl, folder, stillsNote));
  const entries = [];
  const walk = (d) => { for (const n of fs.readdirSync(d)) { const f = path.join(d, n); if (fs.statSync(f).isDirectory()) walk(f); else entries.push({ name: path.relative(folder, f), data: fs.readFileSync(f) }); } };
  walk(folder);
  const file = path.join(out, `${scenario.id}-after-effects.zip`);
  fs.writeFileSync(file, MU.zip(entries));
  return { file, folder, prompt: path.join(folder, 'PROMPT.md'), scenes: timing.length, stills: Object.values(stills).reduce((a, s) => a + s.length, 0),
    notice: AE_NOTICE, hint: `Give an agent ${path.join(folder, 'PROMPT.md')} with After Effects open.` };
}
const mime = (p) => ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(p).toLowerCase()] || 'application/octet-stream';

/** The task for the agent that builds the After Effects project. */
function aePrompt(tl, folder, stillsNote) {
  const fmt = (t) => `${t.toFixed(2)} s`;
  return `# Rebuild "${tl.name}" in After Effects

You are a senior motion designer rebuilding a finished film in Adobe After Effects as a native, editable project:
shape and text layers, keyframes and precomps a motion designer can open and change, not a video pasted in.
Everything is in this folder (${folder}).

**After Effects must be installed and open** (macOS). Don't launch it yourself, and ask the user before you run
anything in it: a script that raises a dialog blocks their session. Read [after-effects.md](after-effects.md) first:
it is how to run scripts safely (\`scripts/ae/gl-ae-run.sh\`) and how CSS maps to After Effects.

## The film

- ${tl.size.w}×${tl.size.h}, ${tl.fps} fps, ${fmt(tl.duration)}; background ${tl.background || 'transparent'}; font ${tl.font}${tl.fontPostScript ? ` (PostScript ${tl.fontPostScript})` : ''}
- Colours: ${Object.entries(tl.colors).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(', ')}
- Scenes (the page is the ground truth; the stills are what your comps must match):
${tl.scenes.map((s) => `  ${s.n}. ${s.title || `Scene ${s.n}`} — ${fmt(s.start)}–${fmt(s.end)}${s.transition === 'fade' ? ' (fades in over the last 0.35 s of the scene before)' : ''} · ${s.page}${s.stills.length ? ` · stills ${s.stills.map((x) => x.file.split('/').pop()).join(', ')}` : ''}`).join('\n')}
- Audio: ${tl.voice.length ? `${tl.voice.length} voice-over clip${tl.voice.length > 1 ? 's' : ''}` : 'no voice-over'}${tl.sfx.length ? `, ${tl.sfx.length} sound effect${tl.sfx.length > 1 ? 's' : ''}` : ''} (assets/, start times in timeline.json)${tl.reference ? '\n- The rendered film: reference/film.mp4' : ''}
${stillsNote ? `\nNote: ${stillsNote}.\n` : ''}
## Do

1. \`scripts/ae/gl-ae-run.sh --probe\`. Exit 3: ask the user to open After Effects and wait. Exit 2: ask them to dismiss the open dialog.
2. For every scene, open its page in a browser, seek it with \`window.__glSeek(t)\` and measure it (after-effects.md → From a scene page to a comp).
3. Write one build script per scene (a comp named after the scene), run it, check the log, and compare a render of the comp with the stills.
4. Build the main comp: every scene comp at its window, fades as opacity ramps over the overlap, the audio at its start times.
5. Save \`${tl.name.replace(/[/\\\\:]/g, '-')}.aep\` into this folder and tell the user what could not be rebuilt natively (and how you approximated it).
`;
}

/** Under a board → { project | file, … } */
export async function exportBoard(project, format, B) {
  const { scenario, MU } = project;
  const state = boardState(project, B.id);
  const A = await boardAssets(B, project, state);
  if (format === 'glea') {
    const url = (p) => (isUrl(p) || p.startsWith('/') ? p : `${A.prefix}/${A.map(p)}`);
    const voice = voiceClips(project).map((c) => ({ url: url(c.file), start: c.start || 0, duration: c.duration, name: c.name || `Voice ${c.scene || ''}`.trim() }));
    const sfx = sfxCues(project).map((c) => ({ url: url(c.file), start: c.start, duration: c.length || 1, gain: c.gain, name: c.label || c.role }));
    const urls = [];
    for (let i = 0; i < MU.timing(scenario).length; i++) urls.push(await ensureUpload(B, state, `scene:${i + 1}`, `scene-${i + 1}.html`, Buffer.from(scenePage(project, i)), A.folder));
    const p = MU.glea(scenario, { htmlUrls: urls, voice, sfx });
    const made = await B.call('POST', `/api/moodboards/${B.id}/video-projects`, { name: p.name, data: p.data });
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
  const format = arg(argv, 'format', 'glea');
  let project = loadProject(dir);
  const B = await board(argv);
  // the user's edits saved on the preview card first (scenario.json → edits): the export carries them
  if (B) ({ project } = await pullEdits(B, project));
  for (const p of project.problems) console.warn('! ' + p);
  let res;
  try { res = B ? await exportBoard(project, format, B) : await exportLocal(project, format); } catch (e) { console.log(JSON.stringify({ ok: false, format, error: e.message })); process.exit(1); }
  if (B) {
    const state = boardState(project, B.id);
    await ensurePipeline(B, project, state);
    await addOutput(B, state, format === 'ae' ? `After Effects package: ${path.basename(res.file || '')} (in the film's board folder) — an agent builds it with After Effects open` : `Video Editor project: ${res.name}`);
  }
  console.log(JSON.stringify({ ok: true, mode: B ? 'board' : 'standalone', format, ...res }));
}
