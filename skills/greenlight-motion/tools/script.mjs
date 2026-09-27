// The script: every scene with its timing, item, transition, copy and voice-over, as a readable document
// (templates/script.html; no player, so it needs no kit). The step after the story (story.mjs).
//   node tools/script.mjs <project> [--artifact] [--standalone] [--board <id>] [--api <url>]
// Standalone → <project>/script.html (+ script.artifact.html with --artifact, for the Artifact tool). Under a
// GreenLight Dash board → the "<name> — script" card in the film's pipeline (the Script lane): the Scenario
// gate becomes approved, the Script step finished and waiting for the user's approval; re-running updates the
// card in place. A scenario note or script card left by an older version is reused / replaced.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject, board, boardState, upsertHtmlCard } from './project.mjs';
import { build } from './page.mjs';
import { showCard } from './pipeline.mjs';

/** What the script card shows: every scene's timing, item, copy and voice-over. */
export function scriptData(project) {
  const { K, scenario } = project;
  const timing = project.MU.timing(scenario);
  const voices = project.MU.sceneVoices(scenario);   // a take's parts go to their own scenes
  const scenes = timing.map((tm, i) => {
    const s = scenario.scenes[i]; const spec = K.elements.find((e) => e.id === s.item);
    return { n: i + 1, title: s.title || spec?.name || s.item, item: spec?.name || s.item, start: tm.start, end: tm.end, duration: tm.duration,
      transition: s.transition === 'fade' ? 'fade' : 'cut', text: Object.entries(s.text || {}).map(([k, v]) => [k, String(v)]), voice: voices[i] || '', pictures: Object.keys(s.images || {}).length };
  });
  let accent = scenario.accent;
  try { K.setTheme(scenario.theme, scenario.accent); accent = K.theme().acc; } catch { /* the scenario's own value */ }
  return { name: scenario.name, brief: (scenario.gallery && scenario.gallery.brief) || (scenario.story && scenario.story.logline) || '', w: scenario.size.w, h: scenario.size.h, fps: scenario.fps,
    T: timing.length ? timing[timing.length - 1].end : 0, theme: scenario.theme, accent: accent || null, scenes };
}
/** The script card's height for its content at 600 px wide (measured: the header ~190 + the brief, the footer ~110). */
export function scriptHeight(sd) {
  const lines = (t, n = 60) => Math.max(1, Math.ceil(String(t || '').length / n));
  let h = 190 + (sd.brief ? 21 * lines(sd.brief, 72) : 0) + 110;
  for (const s of sd.scenes) h += 88 + s.text.reduce((a, [, v]) => a + 20 * lines(v, 52), 0) + (s.voice ? 26 + 20 * lines(s.voice) : 0);
  return Math.max(420, Math.min(3200, Math.round(h)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api'].includes(argv[i - 1]))) || '.';
  const project = loadProject(dir);
  for (const p of project.problems) console.warn('! ' + p);
  const sd = scriptData(project);
  const page = (target) => build('script.html', { title: `${project.scenario.name} — script`, target, appClass: 'musc-app', scripts: [], data: sd });
  const B = await board(argv);
  if (!B) {
    const out = path.join(project.dir, 'script.html');
    fs.writeFileSync(out, page('local'));
    if (argv.includes('--artifact')) fs.writeFileSync(path.join(project.dir, 'script.artifact.html'), page('artifact'));
    console.log(JSON.stringify({ ok: true, mode: 'standalone', file: out, ...(argv.includes('--artifact') ? { artifact: path.join(project.dir, 'script.artifact.html') } : {}), scenes: sd.scenes.length }));
  } else {
    const state = boardState(project, B.id);
    const h = scriptHeight(sd);
    const card = await upsertHtmlCard(B, state, 'script', { title: `${project.scenario.name} — script`, html: page('board'), width: 600, height: h });
    // an older version's scenario note: the script card replaces it
    if (state.st.cards.note) {
      try { await B.call('DELETE', `/api/moodboards/${B.id}/elements/${state.st.cards.note}`); } catch { /* already gone */ }
      delete state.st.cards.note; state.save();
    }
    await showCard(B, project, state, 'script', card, 600, h);
    console.log(JSON.stringify({ ok: true, mode: 'board', board: B.id, card, scenes: sd.scenes.length, pipeline: state.st.pipeline.container }));
  }
}
