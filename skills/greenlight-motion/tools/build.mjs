// Page builders shared by preview.mjs, serve.mjs, gallery.mjs, render.mjs and export.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { SKILL_DIR } from './kit.mjs';
import { pageScripts, sources, imageSizes, mapImages, voiceClips, isUrl, dataUri, ensureUpload, boardRel, boardPrefix, boardFolder, readJSON, sha1 } from './project.mjs';
import { build } from './page.mjs';
import { sfxCues, dbToGain } from './audio.mjs';

const q = (s) => (/[\s"'$]/.test(s) ? JSON.stringify(s) : s);

/** Under a board: every picture, voice clip and sound-effect file uploaded once into the film's folder (greenlight-motion-<id>),
 *  plus the scenario itself (a record on the board, and how the media prefix is learnt). */
export async function boardAssets(B, project, state) {
  const { scenario } = project;
  const folder = boardFolder(scenario);
  const rel = {};
  const up = async (src) => {
    if (rel[src] || isUrl(src)) return;
    const f = path.join(project.dir, src);
    if (!fs.existsSync(f)) return;
    const url = await ensureUpload(B, state, 'asset:' + src, path.basename(f), fs.readFileSync(f), folder);
    rel[src] = boardRel(url, folder);
  };
  // the film's pictures, the ones the user's edits replaced too (a reset in the preview shows them again)
  for (const sc of scenario.scenes.concat(project.raw.scenes || [])) for (const src of Object.values(sc.images || {})) await up(src);
  for (const c of voiceClips(project)) await up(c.file);
  for (const c of sfxCues(project)) await up(c.file);
  const rec = await ensureUpload(B, state, 'scenario', 'scenario.json', Buffer.from(JSON.stringify(project.raw, null, 2)), folder);
  return { folder, rel, prefix: boardPrefix(rec, folder), map: (p) => rel[p] || p };
}

/** The preview page. target: 'local' | 'board' | 'artifact'; mode: what its buttons do. */
export function previewPage(project, { target, mode, map = (p) => p }) {
  const { scenario } = project;
  const sizes = imageSizes(project);
  const pic = (p) => (target === 'artifact' && !isUrl(p) && fs.existsSync(path.join(project.dir, p)) ? dataUri(path.join(project.dir, p)) : map(p));
  // the film as the agent made it, and the user's edits on top (the page shows both: green dots, reset, the list)
  const sc = mapImages(project.MU.normalize(project.raw, { edits: false }), pic);
  const edits = project.raw.edits ? JSON.parse(JSON.stringify(project.raw.edits)) : null;
  for (const e of Object.values((edits && edits.scenes) || {})) if (e.images) for (const k of Object.keys(e.images)) e.images[k] = pic(e.images[k]);
  const imageSizesOut = {};
  for (const [p, z] of Object.entries(sizes)) imageSizesOut[target === 'artifact' ? pic(p) : map(p)] = z;
  const voice = voiceClips(project).map((c) => ({ url: pic(c.file), start: c.start || 0, duration: c.duration, text: c.text || '', scene: c.scene || null, name: c.name || '', ...(c.parts ? { parts: c.parts } : {}) }));
  // sound effects: each file where it starts in the film, at its level (the preview plays them, unducked)
  const sfx = sfxCues(project).map((c) => ({ url: pic(c.file), start: c.start, duration: c.length || 1, vol: Math.min(1, dbToGain(c.gain)), label: c.label || c.role || '' }));
  const skill = path.relative(project.dir, SKILL_DIR) || '.';
  return build('preview.html', {
    title: scenario.name, target, appClass: 'mupv-app', scripts: pageScripts(project),
    data: {
      scenario: sc, edits, stamp: sha1(JSON.stringify(project.raw)).slice(0, 12), mode, voice, sfx, imageSizes: imageSizesOut,
      ...(project.sceneDocs ? { scenes: project.sceneDocs } : {}),
      cmd: { render: `node ${q(path.join(skill, 'tools/render.mjs'))} .`, export: `node ${q(path.join(skill, 'tools/export.mjs'))} .` },
    },
  });
}

/** The film as one standalone page (what the render engine records): pictures relative to the project
 *  (map(p) for another location), background painted unless transparent is asked for. */
export function filmPage(project, { map = (p) => p, transparent = false } = {}) {
  const sc = mapImages(project.scenario, map);
  return project.MU.pageHtml(sc, sources(project), transparent ? { background: null } : {});
}

/** One scene as a self-contained page (its pictures inlined) — the HTML-card export. */
export function scenePage(project, i) {
  const sc = mapImages(project.scenario, (p) => (isUrl(p) || !fs.existsSync(path.join(project.dir, p)) ? p : dataUri(path.join(project.dir, p))));
  return project.MU.pageHtml(sc, sources(project), { scene: i });
}

export const readScenario = (dir) => readJSON(path.join(dir, 'scenario.json'), null);

/** A film's GL Motion items, for its cards: 'used' (where: [{ v, scene }] — v = the variant id when there are
 *  several), 'alt' (scenario.gallery.alternatives: `for` = the scene) and 'new' (the project's own items/*.js).
 *  variants: [{ id, scenes }] (the storyboard's), else the scenario's scenes. → [{ id, role, where, for? }] */
export function libraryItems(project, variants = null, warn = (m) => console.warn(m)) {
  const { K, scenario } = project;
  const own = new Set(K.elements.filter((e) => project.extra.some((f) => path.basename(f) === e.file)).map((e) => e.id));
  const items = []; const seen = new Map();
  const add = (id, role, extra = {}) => {
    if (!K.elements.find((e) => e.id === id)) { warn(`! unknown item "${id}"`); return; }
    if (seen.has(id)) { const it = seen.get(id); if (extra.where) it.where.push(extra.where); return; }
    const it = { id, role: own.has(id) ? 'new' : role, where: extra.where ? [extra.where] : [], ...(extra.for ? { for: extra.for } : {}) };
    seen.set(id, it); items.push(it);
  };
  const vs = variants && variants.length ? variants : [{ id: null, scenes: scenario.scenes }];
  for (const v of vs) v.scenes.forEach((s, i) => add(s.item, 'used', { where: { v: vs.length > 1 ? v.id : null, scene: i + 1 } }));
  for (const [n, ids] of Object.entries((scenario.gallery && scenario.gallery.alternatives) || {})) for (const id of [].concat(ids)) add(id, 'alt', { for: Number(n) });
  for (const id of own) add(id, 'new');
  for (const it of items) if (it.where.length) it.role = own.has(it.id) ? 'new' : 'used';
  // the gallery's older shape: scene numbers
  for (const it of items) it.scenes = it.where.filter((w) => !w.v).map((w) => w.scene);
  return items;
}
