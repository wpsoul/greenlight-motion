// The scenario, in words: the story before any item or layout — a logline and the beats, in acts
// (scenario.json → story: { logline, acts: [{ title, beats: [{ title, idea }] }] }, or { logline, beats }).
//   node tools/story.mjs <project> [--artifact] [--standalone] [--board <id>] [--api <url>]
// Standalone → <project>/story.html (+ story.artifact.html with --artifact, for the Artifact tool). Under a
// GreenLight Dash board → the "<name> — scenario" card in the film's pipeline (the Scenario lane): the step is
// finished and waits for the user's approval; re-running updates the card in place.
// The facts line comes from brief.json when the project has one (goal, length, format, language, call to
// action, look), else from the scenario.
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, board, boardState, upsertHtmlCard, readJSON } from './project.mjs';
import { build } from './page.mjs';
import { showCard } from './pipeline.mjs';

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api'].includes(argv[i - 1]))) || '.';
const project = loadProject(dir, { optional: true });
const raw = fs.existsSync(path.join(project.dir, 'scenario.json')) ? project.raw : {};
const story = raw.story || {};
const acts = Array.isArray(story.acts) && story.acts.length ? story.acts : Array.isArray(story.beats) ? [{ title: '', beats: story.beats }] : [];
const beats = acts.reduce((n, a) => n + ((a.beats || []).length), 0);
if (!story.logline && !beats) {
  console.log(JSON.stringify({ ok: false, error: 'no story yet: write scenario.json → story { logline, acts: [{ title, beats: [{ title, idea }] }] } (references/scenario.md → Story)' }));
  process.exit(1);
}
const brief = readJSON(path.join(project.dir, 'brief.json'), null);
const name = raw.name || (brief && brief.product && brief.product.name) || path.basename(project.dir);
const F = (brief && brief.film) || {}; const Lk = (brief && brief.look) || {};
const known = (v) => v != null && v !== '' && v !== 'agent';
const GOAL = { promo: 'Promo', explainer: 'Explainer', tutorial: 'Tutorial', launch: 'Launch teaser', social: 'Social clip' };
const facts = brief ? [
  known(F.goal) && [GOAL[F.goal] || F.goal, known(F.duration) ? `${F.duration} s` : 'film'],
  known(F.format) && [F.format, F.format === '9:16' ? 'vertical' : F.format === '1:1' ? 'square' : 'landscape'],
  known(F.language) && [F.language.toUpperCase(), 'language'],
  known(F.cta) && [`“${F.cta}”`, 'call to action'],
  known(Lk.theme) && [Lk.theme === 'dark' ? 'Dark' : 'Light', `${(brief.motion && known(brief.motion.preset)) ? brief.motion.preset : 'spring'} motion`],
].filter(Boolean) : [[`${project.scenario.size.w}×${project.scenario.size.h}`, 'format'], [project.scenario.theme === 'dark' ? 'Dark' : 'Light', `${project.scenario.motion || 'spring'} motion`]];
const data = {
  name, logline: story.logline || '', facts,
  acts: acts.map((a) => ({ title: a.title || '', beats: (a.beats || []).map((b) => (typeof b === 'string' ? { title: b, idea: '' } : { title: b.title || '', idea: b.idea || '' })) })),
  foot: 'The story in words. Once it is approved, the script follows: an item per scene, every line of copy, the voice-over and the timing.',
};
const page = (target) => build('story.html', { title: `${name} — scenario`, target, appClass: 'musc-app', scripts: [], data });
/** The card's height at 600 px (measured: the header ~230 + the logline, a row of facts ~34, a beat ~58). */
const lines = (t, n) => Math.max(1, Math.ceil(String(t || '').length / n));
const height = Math.max(420, Math.min(3200, Math.round(230 + (data.logline ? 26 * lines(data.logline, 58) : 0) + 34 * Math.ceil(facts.length / 3)
  + data.acts.reduce((h, a) => h + (a.title ? 32 : 0) + a.beats.reduce((x, b) => x + 38 + 20 * lines(b.idea, 62), 0), 0) + 110)));

const B = await board(argv);
if (!B) {
  const out = path.join(project.dir, 'story.html');
  fs.writeFileSync(out, page('local'));
  if (argv.includes('--artifact')) fs.writeFileSync(path.join(project.dir, 'story.artifact.html'), page('artifact'));
  console.log(JSON.stringify({ ok: true, mode: 'standalone', file: out, ...(argv.includes('--artifact') ? { artifact: path.join(project.dir, 'story.artifact.html') } : {}), beats }));
} else {
  const state = boardState(project, B.id);
  const card = await upsertHtmlCard(B, state, 'story', { title: `${name} — scenario`, html: page('board'), width: 600, height });
  await showCard(B, project, state, 'scenario', card, 600, height);
  console.log(JSON.stringify({ ok: true, mode: 'board', board: B.id, card, beats, pipeline: state.st.pipeline.container }));
}
