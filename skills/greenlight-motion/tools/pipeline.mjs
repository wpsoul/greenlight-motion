// The film as a GreenLight Dash pipeline on its board (board mode): the steps in order with their approval
// gates, and a review lane under them where every card sits at full size in its own frame, wired from its step.
//   node tools/pipeline.mjs <project>                             create it, or bring it up to date (idempotent)
//   node tools/pipeline.mjs <project> --step <key> --status <s>   in_progress | finished | waiting | error
//   node tools/pipeline.mjs <project> --approve <key>             the user approved that step's result
//   node tools/pipeline.mjs <project> --require <key>             a gate opens again (the user wants changes)
//   node tools/pipeline.mjs <project> --done                      the film is finished
//   node tools/pipeline.mjs <project> --json                      the pipeline as it is recorded
// Steps: brief (the starter: the brief and its pictures) · capture · scenario · script · storyboard · preview ·
// render (Render & export) · final (Final film). capture is there when the brief names a website (or the site
// is captured), storyboard unless the brief skips it. The card tools fill it themselves: capture.mjs, story.mjs,
// script.mjs, storyboard.mjs and preview.mjs put their card in its lane and set their step finished with its
// gate "Requires Approval" (every open gate before it becomes "Approved", a step that never ran "Skipped");
// render.mjs and export.mjs fill Render &
// export and the Final film. Pictures in the pipeline are uploaded COPIES (<film>-pipeline folder): deleting a
// card, or the app's "reset run", never touches the project's own files.
// Geometry and data follow the app's pipeline model (skills/greenlight-dash/references/pipelines.md).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProject, board, boardState, freeSpot, readJSON, ensureUpload, arg } from './project.mjs';

export const STEP_KEYS = ['capture', 'scenario', 'script', 'storyboard', 'preview', 'render'];
const STEPS = {
  capture: { name: 'Capture the site', lane: 'Site capture', size: [1134, 1382] },
  scenario: { name: 'Scenario', lane: 'Scenario', size: [600, 980], gate: true,
    instr: 'Write the story first: a logline and the beats, in words only. No items or layouts yet. You approve it.', inputs: 'The brief · the site capture' },
  script: { name: 'Script', lane: 'Script', size: [600, 1400], gate: true,
    instr: 'Turn the story into the script: an item per scene, every line of copy, the voice-over and the timing. You approve it.', inputs: 'The approved scenario · the GL Motion library' },
  storyboard: { name: 'Storyboard', lane: 'Storyboard', size: [1400, 1020], gate: true,
    instr: 'Two or three visual directions for the script, one frame per shot. You pick one, or mix them.', inputs: 'The approved script' },
  preview: { name: 'Preview', lane: 'Preview', size: [1600, 1000], gate: true,
    instr: 'Build the film from the picked direction: the player preview with design tokens and fonts. You approve it before anything is rendered.', inputs: 'The picked direction · the voice-over' },
  render: { name: 'Render & export',
    instr: 'After your approval: render the film and export it for editing.', inputs: 'The approved preview' },
};
const LANE_NOTE = (k) => ({ capture: 'The screenshots and site.json: in the review lane below ↓', scenario: 'The story: in the review lane below ↓', script: 'The script: in the review lane below ↓',
  storyboard: 'The directions: in the review lane below ↓', preview: 'The film: in the review lane below ↓' }[k]);

// the app's geometry (frontend/src/pipelines/pipelineUtils.js)
const PAD = 22, LABEL = 34, GAP = 30, BOTTOM = 20, MINF = 0.12, M = 16, CPAD = 28, HEAD = 40, NGAP = 56, LANE_T = 44, LGAP = 80, ROWGAP = 140;
function nodeGeom(heights) {
  const need = heights.map((h) => h + 2 * M);
  let hs = need.slice(); let avail = hs.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 6; i++) { const min = Math.ceil(MINF * avail) + 2; hs = need.map((h) => Math.max(h, min)); avail = hs.reduce((a, b) => a + b, 0); }
  return { width: 460, height: LABEL + avail + GAP * (heights.length - 1) + BOTTOM, splits: hs.map((h) => h / avail), heights: hs };
}
const geomOf = (key) => (key === 'final' ? { width: 460, height: 420 } : key === 'brief' ? nodeGeom([150, 120]) : nodeGeom([110, key === 'capture' ? 120 : 60, 96]));
const paneRects = (x, y, g) => { let top = y + LABEL; return g.heights.map((h) => { const r = { x: x + PAD, y: top, w: 460 - 2 * PAD, h }; top += h + GAP; return r; }); };
const PANES = { brief: ['instruction', 'assets'], final: [] };
const paneRoles = (key) => PANES[key] || ['instruction', 'assets', 'results'];
const PANE_NAME = { instruction: 'Instructions', assets: 'Assets', results: 'Results' };

/** What the pipeline shows about the film: its name, the brief, the website, which steps it has. */
function context(project) {
  const brief = readJSON(path.join(project.dir, 'brief.json'), null);
  const site = readJSON(path.join(project.dir, 'site.json'), null);
  const hasScenario = fs.existsSync(path.join(project.dir, 'scenario.json'));
  const name = (hasScenario && project.raw.name) || (brief && brief.product && brief.product.name) || path.basename(project.dir);
  const url = (brief && brief.product && brief.product.url) || (site && site.url) || '';
  const steps = STEP_KEYS.filter((k) => (k === 'capture' ? !!url : k === 'storyboard' ? !(brief && brief.workflow && brief.workflow.storyboard === 0) : true));
  return { brief, site, name, url, steps, slug: path.basename(project.dir).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'film' };
}
function briefText(ctx, project) {
  const b = ctx.brief; const f = (b && b.film) || {}; const l = (b && b.look) || {}; const w = (b && b.workflow) || {};
  const agent = (v) => (v == null || v === 'agent' || v === '' ? 'agent decides' : v);
  if (!b) {
    const sc = project.scenario;
    return `${ctx.name}\n${sc.size.w}×${sc.size.h} · ${sc.fps} fps · ${sc.theme} theme\nMotion: ${sc.motion || 'spring'}`;
  }
  return [
    `${(b.product && b.product.name) || ctx.name} — ${agent(f.goal)} · ${f.duration ? f.duration + ' s' : 'length: agent decides'} · ${f.format || '16:9'} · ${f.language || 'en'}`,
    `Call to action: ${f.cta ? `“${f.cta}”` : 'agent decides'}`,
    `Look: ${agent(l.source)} · ${agent(l.theme)} theme · accent ${agent(l.accent)}`,
    `Motion: ${agent((b.motion || {}).preset)} · storyboard: ${w.storyboard === 0 ? 'skip' : (w.storyboard || 2) + ' directions'} · voice-over: ${agent(w.voiceover)}`,
    `Deliver: ${(b.output || []).join(', ') || 'agent decides'}`,
  ].join('\n');
}

/** The pipeline of this project on this board, created or brought up to date → its record (in .board.json). */
export async function ensurePipeline(B, project, state = boardState(project, B.id)) {
  const ctx = context(project);
  const els = await B.call('GET', `/api/moodboards/${B.id}/elements`);
  const byId = new Map(els.map((e) => [e.id, e]));
  let pl = state.st.pipeline;
  if (pl && !byId.has(pl.container)) pl = null;               // deleted on the board: start again
  const nodeKeys = ['brief', ...ctx.steps, 'final'];
  const laneKeys = ctx.steps.filter((k) => STEPS[k].lane);
  const fresh = !pl;
  if (fresh) {
    const spot = await freeSpot(B);
    pl = state.st.pipeline = { container: null, origin: { x: spot.x, y: spot.y }, nodes: {}, lanes: {}, edges: {}, pics: {} };
  }
  pl.lanes = pl.lanes || {}; pl.nodes = pl.nodes || {}; pl.edges = pl.edges || {}; pl.pics = pl.pics || {};
  const note = async (text, r, o = {}) => {
    const n = await B.call('POST', `/api/moodboards/${B.id}/notes`, { text, x: r.x, y: r.y, width: r.w, height: r.h, font_size: o.size || 16, ...(o.color ? { text_color: o.color } : {}), ...(o.bg === false ? { background: false } : {}) });
    if (o.pane) await B.call('PUT', `/api/moodboards/${B.id}/elements/${n.id}`, { data: { ...(n.data || {}), parentPaneId: o.pane } });
    return n.id;
  };
  const frame = async (name, r, data) => {
    const f = await B.call('POST', `/api/moodboards/${B.id}/frames`, { name, x: r.x, y: r.y, width: r.w, height: r.h });
    await B.call('PUT', `/api/moodboards/${B.id}/elements/${f.id}`, { data: { ...(f.data || {}), name, ...data } });
    return f.id;
  };

  // ── the layout: the steps in a row, the review lane under them ──
  const lay = () => {
    const o = pl.origin; const pos = {}; let x = o.x + CPAD;
    for (const k of nodeKeys) { const g = geomOf(k); pos[k] = { x, y: o.y + HEAD, w: g.width, h: g.height }; x += g.width + NGAP; }
    const flowW = x - NGAP - o.x - CPAD; const flowH = Math.max(...nodeKeys.map((k) => geomOf(k).height));
    const lanes = {}; let lx = o.x + CPAD; const ly = o.y + HEAD + flowH + ROWGAP;
    for (const k of laneKeys) {
      const [w, h] = (pl.lanes[k] && pl.lanes[k].size) || STEPS[k].size;
      lanes[k] = { x: lx, y: ly, w: w + 2 * M, h: h + 2 * M + LANE_T }; lx += w + 2 * M + LGAP;
    }
    const laneW = lx - LGAP - o.x - CPAD; const laneH = Math.max(0, ...Object.values(lanes).map((r) => r.h));
    return { pos, lanes, box: { x: o.x, y: o.y, w: CPAD * 2 + Math.max(flowW, laneW), h: HEAD + flowH + (laneKeys.length ? ROWGAP + laneH : 0) + CPAD } };
  };
  const L = lay();

  // ── create what is missing (container → steps → panes → notes → lanes: each frame under what it holds) ──
  if (!pl.container) pl.container = await frame(`${ctx.name} — GL Motion film`, L.box, { pipeline: true, pipelineStatus: 'in_progress' });
  for (const k of nodeKeys) {
    if (pl.nodes[k] && byId.has(pl.nodes[k].id)) continue;
    const r = L.pos[k]; const g = geomOf(k);
    const role = k === 'brief' ? 'starter' : k === 'final' ? 'final' : 'step';
    const name = k === 'brief' ? 'Brief' : k === 'final' ? 'Final film' : STEPS[k].name;
    const id = await frame(name, r, { frameRole: role, pipelineId: pl.container, ...(role === 'step' ? { pipelineStatus: 'waiting' } : {}), ...(g.splits ? { paneSplits: g.splits } : {}) });
    const rec = { id, panes: {}, members: [] };
    const rects = g.heights ? paneRects(r.x, r.y, g) : [];
    for (const [i, role2] of paneRoles(k).entries()) { rec.panes[role2] = await frame(PANE_NAME[role2], rects[i], { frameRole: role2, parentStepId: id, pipelineId: pl.container }); rec.members.push(rec.panes[role2]); }
    const pr = Object.fromEntries(paneRoles(k).map((role2, i) => [role2, { x: rects[i].x + M, y: rects[i].y + M, w: rects[i].w - 2 * M, h: rects[i].h - 2 * M }]));
    const grey = { color: '#8F8B84' };
    if (k === 'brief') {
      rec.members.push(await note(briefText(ctx, project), pr.instruction, { pane: rec.panes.instruction }));
      rec.members.push(...(await briefPictures(B, project, state, ctx, pl, pr.assets, rec.panes.assets)));
    } else if (k === 'final') {
      rec.members.push(await note('The final film lands here.', { x: r.x + M + 6, y: r.y + 46, w: g.width - 2 * M - 12, h: 60 }, { ...grey, bg: false }));
    } else {
      const S = STEPS[k];
      const instr = k === 'capture' ? `Capture ${ctx.url || 'the product site'}: desktop and phone screenshots, the copy, colours and logo.` : S.instr;
      rec.members.push(await note(instr, pr.instruction, { pane: rec.panes.instruction, size: 17 }));
      rec.members.push(await note(k === 'capture' ? (ctx.url || 'The product site') : S.inputs, pr.assets, { pane: rec.panes.assets, ...grey }));
      rec.members.push(rec.results = await note(LANE_NOTE(k) || 'The rendered film and the project for editing appear here.', pr.results, { pane: rec.panes.results, ...grey }));
      if (S.gate) { /* the gate appears when the step's card is shown (setStep) */ }
    }
    pl.nodes[k] = rec; state.save();
  }
  for (const k of laneKeys) {
    if (pl.lanes[k] && byId.has(pl.lanes[k].id)) continue;
    const r = L.lanes[k];
    pl.lanes[k] = { id: await frame(STEPS[k].lane, r, { frameRole: 'frame', pipelineId: pl.container }), size: (pl.lanes[k] && pl.lanes[k].size) || STEPS[k].size, content: [] };
    state.save();
  }
  // ── the arrows: the steps in order, every step to its lane ──
  const want = {};
  for (let i = 0; i < nodeKeys.length - 1; i++) want[`${nodeKeys[i]}>${nodeKeys[i + 1]}`] = [pl.nodes[nodeKeys[i]].id, pl.nodes[nodeKeys[i + 1]].id];
  for (const k of laneKeys) want[`${k}>lane`] = [pl.nodes[k].id, pl.lanes[k].id];
  const arrows = await B.call('GET', `/api/moodboards/${B.id}/arrows`).catch(() => []);
  const have = new Set((Array.isArray(arrows) ? arrows : arrows.arrows || []).map((a) => a.id));
  for (const [edge, id] of Object.entries(pl.edges)) if (!want[edge] || !have.has(id)) { if (!want[edge] && have.has(id)) await B.call('DELETE', `/api/moodboards/${B.id}/arrows/${id}`).catch(() => {}); delete pl.edges[edge]; }
  for (const [edge, [a, b]] of Object.entries(want)) if (!pl.edges[edge]) pl.edges[edge] = (await B.call('POST', `/api/moodboards/${B.id}/arrows`, { from_element_id: a, to_element_id: b, from_port: 'out', to_port: 'in', color: '#818cf8' })).id;
  state.save();
  if (!fresh) await reflow(B, state, lay());
  return pl;
}

/** Move every group to where the layout puts it (a step with its panes and notes, a lane with its contents)
 *  and fit the container around them. */
async function reflow(B, state, L) {
  const pl = state.st.pipeline;
  const els = await B.call('GET', `/api/moodboards/${B.id}/elements`);
  const byId = new Map(els.map((e) => [e.id, e]));
  const moves = [];
  const shift = (anchor, target, ids) => {
    const a = byId.get(anchor); if (!a) return;
    const dx = target.x - a.x, dy = target.y - a.y;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    for (const id of [anchor, ...ids]) { const e = byId.get(id); if (e) moves.push({ id, x: e.x + dx, y: e.y + dy }); }
  };
  for (const [k, r] of Object.entries(L.pos)) if (pl.nodes[k]) shift(pl.nodes[k].id, r, pl.nodes[k].members || []);
  for (const [k, r] of Object.entries(L.lanes)) if (pl.lanes[k]) shift(pl.lanes[k].id, r, pl.lanes[k].content || []);
  if (moves.length) await B.call('PUT', `/api/moodboards/${B.id}/elements`, { elements: moves });
  // lanes resize in place (the element endpoint: a frame endpoint would re-sink them under the container);
  // the container fits around everything through the frame endpoint, which keeps it under all it holds
  const sizes = [];
  for (const [k, r] of Object.entries(L.lanes)) { const f = byId.get(pl.lanes[k] && pl.lanes[k].id); if (f && (Math.abs(f.height - r.h) > 0.5 || Math.abs(f.width - r.w) > 0.5)) sizes.push({ id: f.id, width: r.w, height: r.h }); }
  if (sizes.length) await B.call('PUT', `/api/moodboards/${B.id}/elements`, { elements: sizes });
  const c = byId.get(pl.container);
  if (c && (Math.abs(c.width - L.box.w) > 0.5 || Math.abs(c.height - L.box.h) > 0.5 || Math.abs(c.x - L.box.x) > 0.5 || Math.abs(c.y - L.box.y) > 0.5)) {
    await B.call('PUT', `/api/moodboards/${B.id}/frames/${c.id}`, { x: L.box.x, y: L.box.y, width: L.box.w, height: L.box.h });
  }
}

/** The brief's pictures in the starter's Assets pane: uploaded copies of the project's files named in the brief. */
async function briefPictures(B, project, state, ctx, pl, r, paneId) {
  const names = ((ctx.brief && ctx.brief.product && ctx.brief.product.assets) || []).map((a) => a.name).filter(Boolean);
  const files = names.map((n) => path.join(project.dir, 'assets', path.basename(n))).filter((f) => fs.existsSync(f) && /\.(png|jpe?g|webp|gif|svg)$/i.test(f)).slice(0, 3);
  const ids = []; let x = r.x;
  for (const f of files) {
    const url = await pictureCopy(B, state, ctx, f);
    const el = await B.call('POST', `/api/moodboards/${B.id}/media/place`, { url, x, y: r.y, width: 120, height: 120, title: path.basename(f) });
    ids.push((el.element || el).id); x += 136;
  }
  const n = await B.call('POST', `/api/moodboards/${B.id}/notes`, { text: files.length ? 'From the brief' : 'No pictures in the brief', x, y: r.y, width: Math.max(160, r.x + r.w - x), height: 44, font_size: 16, text_color: '#8F8B84', background: false });
  await B.call('PUT', `/api/moodboards/${B.id}/elements/${n.id}`, { data: { ...(n.data || {}), parentPaneId: paneId } });
  return [...ids, n.id];
}
/** An uploaded copy of a project file for the pipeline (once per content). */
async function pictureCopy(B, state, ctx, file) {
  return ensureUpload(B, state, `pipeline:${path.basename(file)}`, path.basename(file), fs.readFileSync(file), `greenlight-motion-${ctx.slug}-pipeline`);
}

/** Put elements in a step's lane at full size. items: [{ id, x, y, w, h }] relative to the lane's content box.
 *  The lane grows or shrinks to them, the pipeline reflows, and each item is raised above the lane frame.
 *  Elements the lane held before and no longer does are pipeline copies: they are removed. */
export async function placeInLane(B, project, state, key, items) {
  const pl = await ensurePipeline(B, project, state);
  const lane = pl.lanes[key]; if (!lane) return null;
  const w = Math.max(...items.map((i) => i.x + i.w)); const h = Math.max(...items.map((i) => i.y + i.h));
  const keep = new Set(items.map((i) => i.id));
  for (const id of lane.content || []) if (!keep.has(id)) {
    const e = await B.call('GET', `/api/moodboards/${B.id}/elements/${id}`).catch(() => null);
    if (e && ['image', 'video'].includes(e.type)) await B.call('DELETE', `/api/moodboards/${B.id}/elements/${id}`).catch(() => {});
  }
  lane.content = items.map((i) => i.id); lane.size = [w, h]; state.save();
  await ensurePipeline(B, project, state);                    // reflow with the new size
  const els = await B.call('GET', `/api/moodboards/${B.id}/elements`);
  const f = els.find((e) => e.id === lane.id);
  const top = Math.max(...els.map((e) => e.z_index || 0));
  const moves = items.map((it, i) => ({ id: it.id, x: f.x + M + it.x, y: f.y + LANE_T + M + it.y, width: it.w, height: it.h, ...((els.find((e) => e.id === it.id) || {}).z_index <= f.z_index ? { z_index: top + 1 + i } : {}) }));
  await B.call('PUT', `/api/moodboards/${B.id}/elements`, { elements: moves });
  return lane.id;
}

/** A step's status and gate: status 'in_progress' | 'finished' | 'waiting' | 'error'; approval 'required' |
 *  'approved' | null (no gate). The container follows: finished when Final film has the film. */
export async function setStep(B, state, key, { status, approval, meta } = {}) {
  const pl = state.st.pipeline; if (!pl) return;
  const id = key === 'container' ? pl.container : pl.nodes[key] && pl.nodes[key].id; if (!id) return;
  const e = await B.call('GET', `/api/moodboards/${B.id}/elements/${id}`).catch(() => null); if (!e) return;
  const data = { ...(e.data || {}) };
  if (status) data.pipelineStatus = status;
  if (approval === null) delete data.humanApproval; else if (approval) data.humanApproval = approval;
  if (meta !== undefined) { if (meta) data.meta = meta; else delete data.meta; }
  await B.call('PUT', `/api/moodboards/${B.id}/elements/${id}`, { data });
  // the container says which step waits for the user
  if (key !== 'container' && approval && STEPS[key]) {
    await setStep(B, state, 'container', { meta: approval === 'required' ? `Waiting for your approval: ${STEPS[key].name}` : '' });
  }
}
/** Everything before `key` is behind the user: every open gate before it is approved (the agent only moves on
 *  once the user approved), and a step that never ran (the storyboard skipped, say) is finished as "Skipped". */
export async function approveBefore(B, state, key) {
  const pl = state.st.pipeline; if (!pl) return;
  const i = STEP_KEYS.indexOf(key);
  for (const k of STEP_KEYS.filter((x) => pl.nodes[x] && STEP_KEYS.indexOf(x) < i)) {
    const e = await B.call('GET', `/api/moodboards/${B.id}/elements/${pl.nodes[k].id}`).catch(() => null);
    if (!e || !e.data) continue;
    if (e.data.humanApproval === 'required') await setStep(B, state, k, { approval: 'approved' });
    else if (e.data.pipelineStatus === 'waiting') await setStep(B, state, k, { status: 'finished', meta: 'Skipped' });
  }
}
/** A card is shown for its step: the step is finished and waits for the user (its gate), the gate before it is
 *  approved, the card sits in the step's lane. */
export async function showCard(B, project, state, key, cardId, w, h) {
  await placeInLane(B, project, state, key, [{ id: cardId, x: 0, y: 0, w, h }]);
  await approveBefore(B, state, key);
  await setStep(B, state, key, { status: 'finished', approval: STEPS[key].gate ? 'required' : undefined });
}
/** Text in a step's Results pane (Render & export lists what it made). */
export async function setResults(B, state, key, text) {
  const pl = state.st.pipeline; const id = pl && pl.nodes[key] && pl.nodes[key].results; if (!id) return;
  const e = await B.call('GET', `/api/moodboards/${B.id}/elements/${id}`).catch(() => null); if (!e) return;
  await B.call('PUT', `/api/moodboards/${B.id}/elements/${id}`, { data: { ...(e.data || {}), text } });
}
/** The finished film in the Final film node (a video element placed on the board). */
export async function showFinal(B, state, videoId, ratio) {
  const pl = state.st.pipeline; if (!pl || !pl.nodes.final) return;
  const node = await B.call('GET', `/api/moodboards/${B.id}/elements/${pl.nodes.final.id}`).catch(() => null); if (!node) return;
  const spot = await finalSpot(B, state, ratio);
  const top = Math.max(...(await B.call('GET', `/api/moodboards/${B.id}/elements`)).map((e) => e.z_index || 0));
  await B.call('PUT', `/api/moodboards/${B.id}/elements`, { elements: [{ id: videoId, x: spot.x, y: spot.y, width: spot.w, height: spot.h, z_index: top + 1 }] });
  pl.nodes.final.members = [...new Set([...(pl.nodes.final.members || []), videoId])]; state.save();
  await setStep(B, state, 'container', { status: 'finished' });
}
/** Pictures in a step's lane at full size (uploaded copies of project files; list: [{ file, x, y, w, h }]); the
 *  step is finished. */
export async function showPictures(B, project, state, key, list) {
  const ctx = context(project);
  await ensurePipeline(B, project, state);
  const items = [];
  for (const p of list) {
    const url = await pictureCopy(B, state, ctx, p.file);
    const el = await B.call('POST', `/api/moodboards/${B.id}/media/place`, { url, x: 0, y: 0, width: p.w, height: p.h, title: path.basename(p.file) });
    items.push({ id: (el.element || el).id, x: p.x, y: p.y, w: p.w, h: p.h });
  }
  await placeInLane(B, project, state, key, items);
  await setStep(B, state, key, { status: 'finished' });
}
/** Where a render from the preview card's own button lands: inside the Final film node, at its size. */
export async function finalSpot(B, state, ratio) {
  const pl = state.st.pipeline; if (!pl || !pl.nodes.final) return null;
  const node = await B.call('GET', `/api/moodboards/${B.id}/elements/${pl.nodes.final.id}`).catch(() => null); if (!node) return null;
  const maxW = node.width - 2 * M, maxH = node.height - 96 - M;
  let w = maxW, h = w / ratio; if (h > maxH) { h = maxH; w = h * ratio; }
  return { x: Math.round(node.x + (node.width - w) / 2), y: Math.round(node.y + 96), w: Math.round(w), h: Math.round(h) };
}
/** One more thing Render & export made (listed in its Results pane); the step is finished, the preview approved. */
export async function addOutput(B, state, line) {
  const pl = state.st.pipeline; if (!pl || !pl.nodes.render) return;
  pl.outputs = [...new Set([...(pl.outputs || []), line])]; state.save();
  await approveBefore(B, state, 'render');
  await setResults(B, state, 'render', pl.outputs.join('\n'));
  await setStep(B, state, 'render', { status: 'finished' });
}
export { STEPS as PIPELINE_STEPS, M as LANE_PAD };

// ── the CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const VALUE = ['--board', '--api', '--step', '--status', '--approve', '--require'];
  const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1]))) || '.';
  const project = loadProject(dir, { optional: true });
  const B = await board(argv);
  if (!B) { console.log(JSON.stringify({ ok: false, error: 'the pipeline lives on a GreenLight Dash board (GREENLIGHT_API_BASE_URL); standalone there is none' })); process.exit(1); }
  const state = boardState(project, B.id);
  const pl = await ensurePipeline(B, project, state);
  const step = arg(argv, 'step'); const status = arg(argv, 'status');
  if (step && status) await setStep(B, state, step, { status });
  if (arg(argv, 'approve')) await setStep(B, state, arg(argv, 'approve'), { approval: 'approved' });
  if (arg(argv, 'require')) await setStep(B, state, arg(argv, 'require'), { approval: 'required' });
  if (argv.includes('--done')) await setStep(B, state, 'container', { status: 'finished' });
  console.log(JSON.stringify(argv.includes('--json') ? { ok: true, pipeline: pl } : { ok: true, board: B.id, container: pl.container, steps: Object.keys(pl.nodes), lanes: Object.keys(pl.lanes) }));
}
