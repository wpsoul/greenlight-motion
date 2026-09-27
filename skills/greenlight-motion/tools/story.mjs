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
  // a brand-new film's art direction, with its palette as swatches (the film's own values)
  direction: raw.direction && typeof raw.direction === 'object' && raw.direction.idea ? raw.direction : null,
  swatches: [...new Set([raw.background, raw.accent, ...Object.values((raw.colors && typeof raw.colors === 'object') ? raw.colors : {})].filter((c) => typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)))].slice(0, 8),
  // quick mode: the story is the agent's plan and it goes straight on; otherwise the user approves it first
  call: brief && brief.workflow && brief.workflow.mode === 'quick' ? 'The agent’s plan.' : 'Read the story first.',
  foot: brief && brief.workflow && brief.workflow.mode === 'quick'
    ? 'Quick mode: the agent goes straight on to the preview. You edit the film there and approve it before the render.'
    : 'Nothing is built until you approve it: approve it, or tell the agent what to change. ' + (brief && brief.workflow && brief.workflow.storyboard === 0
      ? 'Then the agent builds the film as a preview: every scene with its copy, the voice-over and the timing.'
      : 'Then the storyboard follows: two or three directions, every shot with its frame, its copy, the voice-over and the timing.'),
};
const page = (target) => build('story.html', { title: `${name} — scenario`, target, appClass: 'musc-app', scripts: [], data });
/** The card's width, and its height for the content (measured on the page at 1200 px): the padding and header, the
 *  logline, a row of facts, the call to read it, then each act's title and its beats, 3 to a row (a beat: its number,
 *  title and idea at ~30 / ~38 characters a line). */
const W = 1200;
const lines = (t, n) => Math.max(1, Math.ceil(String(t || '').length / n));
// the direction block: its title, the idea (20 px, ~105 characters a line), a row per field (15 px, ~125 a line)
const dirH = (d) => 30 + 32 + 40 + 29 * lines(d.idea, 105) + ['look', 'type', 'motion', 'signature', 'references'].filter((k) => d[k]).reduce((h, k) => h + 14 + 22.5 * lines([].concat(d[k]).join(' · '), 125), 0);
const beatH = (b) => 16 + 26 + 6 + 23.4 * lines(b.title, 30) + (b.idea ? 6 + 22.5 * lines(b.idea, 38) : 0) + 18 + 2;
const height = Math.round(40 + 20 + 8 + 45 * lines(name, 48) + (data.logline ? 14 + 32.7 * lines(data.logline, 62) : 0) + (facts.length ? 20 + 31 : 0)
  + 30 + 86 + data.acts.reduce((h, a) => {
    const rows = []; for (let i = 0; i < a.beats.length; i += 3) rows.push(Math.max(...a.beats.slice(i, i + 3).map(beatH)));
    return h + 30 + (a.title ? 32 : 0) + rows.reduce((x, r) => x + r, 0) + 14 * Math.max(0, rows.length - 1);
  }, 0) + (data.direction ? dirH(data.direction) : 0) + 44 + 12);

const B = await board(argv);
if (!B) {
  const out = path.join(project.dir, 'story.html');
  fs.writeFileSync(out, page('local'));
  if (argv.includes('--artifact')) fs.writeFileSync(path.join(project.dir, 'story.artifact.html'), page('artifact'));
  console.log(JSON.stringify({ ok: true, mode: 'standalone', file: out, ...(argv.includes('--artifact') ? { artifact: path.join(project.dir, 'story.artifact.html') } : {}), beats, height }));
} else {
  const state = boardState(project, B.id);
  const card = await upsertHtmlCard(B, state, 'story', { title: `${name} — scenario`, html: page('board'), width: W, height });
  await showCard(B, project, state, 'scenario', card, W, height);
  console.log(JSON.stringify({ ok: true, mode: 'board', board: B.id, card, beats, pipeline: state.st.pipeline.container }));
}
