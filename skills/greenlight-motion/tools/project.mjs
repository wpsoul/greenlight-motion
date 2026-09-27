// A GreenLight Motion project = a folder with scenario.json (+ scenes/, assets/, audio/). Shared by every tool:
//   loadProject(dir)      → { dir, scenario, K, MU, sceneDocs, problems } (every page's elements get their data-gl ids)
//   sources(project)      → the script texts the pages need
//   board(argv)           → the GreenLight Dash board this runs under, or null (see references/board-mode.md)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadKit, LIB_DIR, RUNTIME, CORE, TAIL, arg } from './kit.mjs';
export { arg };

export const readJSON = (f, def) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } };
export const writeJSON = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n'); };
export const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
export const isUrl = (s) => /^(https?:|data:|blob:)/i.test(String(s || ''));

/** The brief's workflow mode ('quick' | 'guided' | 'agent' | null): quick goes straight to the preview — no storyboard,
 *  no Scenario gate, and the preview's Render / Export are the agent's (it asks for the approval). */
export const workflowMode = (dir) => { const b = readJSON(path.join(dir, 'brief.json'), null); return (b && b.workflow && b.workflow.mode) || null; };
export const isQuick = (dir) => workflowMode(dir) === 'quick';

// ── element ids: every element in a scene page's <body> gets data-gl="<n>" once, so the user's edits (and the preview's
// picker) can address it. Ids already there are kept, new elements get the next numbers.
const NO_ID = new Set(['html', 'head', 'body', 'script', 'style', 'link', 'meta', 'title', 'template', 'noscript', 'br', 'wbr', 'base']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);
export function stampIds(html) {
  const src = String(html || '');
  let next = 0;
  src.replace(/\sdata-gl="(\d+)"/g, (m, n) => { next = Math.max(next, +n); return m; });
  next += 1;
  const n = src.length; let out = ''; let i = 0;
  let inBody = !/<body[\s>]/i.test(src);   // a fragment: all of it is the body
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) { out += src.slice(i); break; }
    out += src.slice(i, lt); i = lt;
    if (src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); const stop = e < 0 ? n : e + 3; out += src.slice(i, stop); i = stop; continue; }
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(src.slice(i, i + 80));
    if (!m) { out += '<'; i += 1; continue; }   // a closing tag, <!doctype …>, a lone "<"
    const name = m[1].toLowerCase();
    let j = i + m[0].length, q = null;
    for (; j < n; j++) { const c = src[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; }
    let tag = src.slice(i, Math.min(n, j + 1));
    if (name === 'body') inBody = true;
    else if (inBody && !NO_ID.has(name) && !/\sdata-gl\s*=/.test(tag) && tag.endsWith('>')) {
      const self = /\/\s*>$/.test(tag);
      tag = tag.slice(0, self ? tag.lastIndexOf('/') : tag.length - 1).replace(/\s+$/, '') + ` data-gl="${next++}"` + (self ? ' />' : '>');
    }
    out += tag; i = j + 1;
    if (RAW.has(name)) { const close = src.toLowerCase().indexOf(`</${name}`, i); const stop = close < 0 ? n : close; out += src.slice(i, stop); i = stop; }
  }
  return out;
}
const idsIn = (html) => new Set([...String(html || '').matchAll(/\sdata-gl="([^"]+)"/g)].map((m) => m[1]));

/** The project in `dir`: its scenario, its scene pages (ids stamped) and the loaded library.
 *  optional: a folder without scenario.json is fine (library work: stills of any item). */
export function loadProject(dir, { optional = false } = {}) {
  dir = path.resolve(dir || '.');
  const file = path.join(dir, 'scenario.json');
  if (!fs.existsSync(file) && !optional) throw new Error(`no scenario.json in ${dir} (see references/scenario.md)`);
  const raw = fs.existsSync(file) ? readJSON(file, null) : { name: 'Library', scenes: [] };
  if (!raw) throw new Error(`${file} is not valid JSON`);
  const K = loadKit();
  const MU = globalThis.MU;
  const scenario = MU.normalize(raw);
  // each scene page (relative to the project), its elements given their ids
  const sceneDocs = scenario.scenes.map((sc) => {
    const f = sc.html ? path.join(dir, sc.html) : null;
    if (!f || !fs.existsSync(f)) return '';
    const doc = fs.readFileSync(f, 'utf8'); const stamped = stampIds(doc);
    if (stamped !== doc) fs.writeFileSync(f, stamped);
    return stamped;
  });
  return { dir, file, raw, scenario, K, MU, sceneDocs, problems: raw.scenes && raw.scenes.length ? check(dir, scenario, K, raw, sceneDocs) : [] };
}

// what an edit (or the agent's `style`) may change on an element; the controls a panel may name
export const STYLE_PROPS = new Set(['color', 'fill', 'stroke', 'size', 'weight', 'ls', 'upper', 'italic', 'font', 'r', 'x', 'y', 'scale', 'rotate', 'hide']);
const CONTROL_PROPS = new Set([...STYLE_PROPS, 'text', 'image', 'colour', 'tracking', 'radius', 'corners', 'case', 'picture', 'move']);
const PARAM_TYPES = new Set(['slider', 'number', 'toggle', 'select', 'color']);

/** Everything wrong with a scenario that would make a tool fail or a scene look unfinished. */
export function check(dir, scenario, K, raw = scenario, docs = []) {
  const out = [];
  const obj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const film = (f, where) => {
    if (!obj(f)) return;
    for (const k of Object.keys(obj(f.colors) ? f.colors : {})) if (!/^[a-z][a-z0-9-]*$/i.test(k)) out.push(`${where}colors: "${k}" is not a colour name (letters, digits, dashes)`);
    for (const k of Object.keys(obj(f.recolor) ? f.recolor : {})) if (!/^#[0-9a-f]{3,8}$/i.test(k)) out.push(`${where}recolor: "${k}" is not a #hex colour`);
    if (f.font != null && !(K.FONTS && K.FONTS[f.font])) out.push(`${where}font "${f.font}" is not one of ${Object.keys(K.FONTS || {}).join(', ')}`);
  };
  film(raw, '');
  if (raw.edits != null) {
    if (!obj(raw.edits)) out.push('edits must be an object: { film, scenes }');
    else {
      film(raw.edits.film, 'edits.film.');
      for (const k of Object.keys(obj(raw.edits.scenes) ? raw.edits.scenes : {})) if (!(/^\d+$/.test(k) && +k >= 1 && +k <= scenario.scenes.length)) out.push(`edits.scenes: "${k}" is not a scene number (1–${scenario.scenes.length})`);
    }
  }
  if (!scenario.scenes.length) out.push('the scenario has no scenes');
  const presets = Object.keys(K.MOTION_PRESETS || {});
  const badMotion = (m) => m != null && !presets.includes(m);
  if (badMotion(scenario.motion)) out.push(`motion "${scenario.motion}" is not one of ${presets.join(', ')}`);
  // a brand-new film (the brief's look.source "new"): its art direction first, and every scene its own page
  const brief = readJSON(path.join(dir, 'brief.json'), null);
  if (brief && brief.look && brief.look.source === 'new') {
    if (!(obj(raw.direction) && typeof raw.direction.idea === 'string' && raw.direction.idea.trim()))
      out.push('no direction: a brand-new film writes its art direction first (scenario.json → direction: idea, references, look, type, motion, signature — references/original-films.md)');
    scenario.scenes.forEach((sc, i) => { if (sc.item) out.push(`scene ${i + 1}: "${sc.item}" is a library scene, but the brief asks for brand-new motion graphics — write this scene as a page (references/scenes.md)`); });
  }
  const styleProps = (n, st, where) => { for (const p of Object.keys(obj(st) ? st : {})) if (!STYLE_PROPS.has(p)) out.push(`${n}: ${where}.${p} is not a style (${[...STYLE_PROPS].join(', ')})`); };
  scenario.scenes.forEach((sc, i) => {
    const n = `scene ${i + 1}`;
    if (sc.transition && !['cut', 'fade'].includes(sc.transition)) out.push(`${n}: transition must be "cut" or "fade"`);
    if (badMotion(sc.motion)) out.push(`${n}: motion "${sc.motion}" is not one of ${presets.join(', ')}`);
    for (const [key, st] of Object.entries(obj(sc.style) ? sc.style : {})) styleProps(n, st, `style "${key}"`);
    if (sc.html) {
      // a scene page: it exists, its pictures and the files it names do; the user's edits still match its elements
      if (sc.item) out.push(`${n}: a scene is either a page ("html") or a library scene ("item"), not both`);
      const f = path.join(dir, sc.html);
      if (!fs.existsSync(f)) { out.push(`${n}: page not found: ${sc.html}`); return; }
      const ids = idsIn(docs[i]);
      for (const [key, src] of Object.entries(sc.images || {})) if (!isUrl(src) && !fs.existsSync(path.join(dir, src))) out.push(`${n}: image not found: ${src} (${key})`);
      for (const r of docRefs(dir, sc.html, docs[i])) if (!r.path) out.push(`${n}: ${sc.html} names ${r.ref}, which isn't in the project (paths are relative to the project or to the page)`);
      for (const k of ['style', 'text']) for (const id of Object.keys(obj(sc[k]) ? sc[k] : {})) if (!ids.has(id.split('/')[0])) out.push(`${n}: ${k} for element "${id}", which ${sc.html} no longer has`);
      return;
    }
    const spec = K.elements.find((e) => e.id === sc.item);
    if (!spec) { out.push(`${n}: unknown library scene "${sc.item}" (search: node tools/registry.mjs --search …)`); return; }
    const ids = new Set(); const keys = new Set(); const textKeys = new Set(); let photos = 0, canvas = false;
    const walk = (L, p) => { const key = L.id != null && L.id !== '' ? String(L.id) : '~' + p; if (L.id) ids.add(L.id); if (L.src) ids.add(L.src); keys.add(key); if (L.type === 'text') textKeys.add(key); if (L.media != null) ids.add('#' + (++photos)); if (L.type === 'canvas') canvas = true; (L.ch || []).forEach((c, j) => walk(c, p + '.' + j)); };
    try { K.build(spec, sc.params).forEach((L, j) => walk(L, String(j))); } catch (e) { out.push(`${n}: ${sc.item} fails to build: ${e.message}`); }
    const defs = spec.params || {};
    if (sc.params != null && !obj(sc.params)) out.push(`${n}: params must be an object`);
    for (const p of Object.keys(obj(sc.params) ? sc.params : {})) if (!Object.prototype.hasOwnProperty.call(defs, p)) out.push(`${n}: ${sc.item} has no parameter "${p}"${Object.keys(defs).length ? ` (has ${Object.keys(defs).join(', ')})` : ''}`);
    for (const key of Object.keys(obj(sc.style) ? sc.style : {})) if (!keys.has(key)) out.push(`${n}: style "${key}": ${sc.item} has no such element`);
    for (const [p, d] of Object.entries(defs)) if (!obj(d) || !PARAM_TYPES.has(d.type || 'slider')) out.push(`${n}: ${sc.item} parameter "${p}": type must be one of ${[...PARAM_TYPES].join(', ')}`);
    // the agent's panels: the item's own (a layer's ui) and the scene's (ui: [{ layer, label, controls }])
    const own = []; const collect = (L, p) => { if (L.ui) for (const u of Array.isArray(L.ui) && L.ui.length && obj(L.ui[0]) && L.ui[0].controls ? L.ui : [L.ui]) own.push(Object.assign({ layer: L.id != null && L.id !== '' ? String(L.id) : '~' + p }, typeof u === 'string' ? { controls: [u] } : Array.isArray(u) ? { controls: u } : u)); (L.ch || []).forEach((c, j) => collect(c, p + '.' + j)); };
    try { K.build(spec, sc.params).forEach((L, j) => collect(L, String(j))); } catch { /* reported above */ }
    for (const card of own.concat(sc.ui == null ? [] : Array.isArray(sc.ui) ? sc.ui : [sc.ui])) {
      if (!obj(card) || card.layer == null) { out.push(`${n}: ui panels are { layer, label, controls }`); continue; }
      if (!keys.has(String(card.layer))) out.push(`${n}: ui panel "${card.label || card.layer}": no element "${card.layer}"`);
      for (const c of [].concat(card.controls || [])) {
        const x = typeof c === 'string' ? { prop: c } : c;
        if (!obj(x)) continue;
        if (x.param != null) { if (!Object.prototype.hasOwnProperty.call(defs, x.param)) out.push(`${n}: ui panel "${card.label || card.layer}": no parameter "${x.param}"`); continue; }
        if (!CONTROL_PROPS.has(x.prop)) out.push(`${n}: ui panel "${card.label || card.layer}": "${x.prop}" is not a control`);
        for (const l of [].concat(x.layer || [])) if (!keys.has(String(l))) out.push(`${n}: ui panel "${card.label || card.layer}": no element "${l}"`);
      }
    }
    for (const id of Object.keys(sc.text || {})) if (!ids.has(id) && !textKeys.has(id)) out.push(`${n}: ${sc.item} has no text "${id}"`);
    // a library scene drawn on a canvas layer takes an image LIST (an array, or '#1', '#2' …); the others fill photo slots
    for (const [id, src] of Object.entries(sc.images || {})) {
      if (!canvas && !ids.has(id) && !keys.has(id)) out.push(`${n}: ${sc.item} has no photo "${id}"`);
      if (!isUrl(src) && !fs.existsSync(path.join(dir, src))) out.push(`${n}: image not found: ${src}`);
    }
  });
  // long takes: a take's parts run over the next scenes, which have no voice of their own
  scenario.scenes.forEach((sc, i) => {
    const v = sc.voice;
    if (!(v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.take))) return;
    if (v.take.length > scenario.scenes.length - i) out.push(`scene ${i + 1}: its take has ${v.take.length} parts but only ${scenario.scenes.length - i} scenes follow`);
    for (let k = 1; k < v.take.length && i + k < scenario.scenes.length; k++) {
      if (scenario.scenes[i + k].voice) out.push(`scene ${i + k + 1}: it is inside the take that starts at scene ${i + 1}, so its own voice is ignored (put the words in the take's part ${k + 1})`);
    }
  });
  return out;
}

/** The script texts the pages need: the player, the page clock, the edits, the scene kit, three.js (for a scene that uses
 *  it), the library (for library scenes), and every scene page. */
export function sources(project, scenario = project.scenario, { map = (p) => p } = {}) {
  const read = (f) => fs.readFileSync(path.join(LIB_DIR, f), 'utf8');
  const files = {};
  for (const sc of scenario.scenes) {
    const el = sc.item && project.K.elements.find((e) => e.id === sc.item);
    if (el && !files[el.file]) files[el.file] = read(el.file);
  }
  // another scenario's scenes (a storyboard variant): their own pages. The files a page names go where map puts them
  const docs = (scenario === project.scenario ? project.sceneDocs : scenario.scenes.map((sc) => {
    const f = sc.html ? path.join(project.dir, sc.html) : null;
    return f && fs.existsSync(f) ? stampIds(fs.readFileSync(f, 'utf8')) : '';
  })).map((d, i) => (d ? mapDoc(project.dir, scenario.scenes[i].html, d, map) : d));
  const usesThree = docs.some((d) => /\bTHREE\b/.test(d));
  return {
    clock: read('clock.js'), overrides: read('overrides.js'), kit: read('scene.js'), player: read('player.js'),
    ...(usesThree ? { three: read('vendor/three.js') } : {}),
    easings: read('easings.js'), engine: read('engine.js'), film: read('film.js'), files,
    scenes: docs,
  };
}
// ── the files a scene page names (src, href, poster, url()) ──
// written relative to the project (assets/x.png) or to the page's own folder (../assets/x.png); either way the page is
// played from the project, so every reference becomes project-relative — or goes where map(path) puts it (a data URI
// when the page must stand alone, an uploaded copy under a board)
const REF = /(\s(?:src|href|poster|xlink:href)\s*=\s*)(["'])([^"']*)\2|url\(\s*(["']?)([^"')]+)\4\s*\)/gi;
const isLocalRef = (u) => !!u && !isUrl(u) && !/^(#|\/|[a-z][a-z0-9+.-]*:)/i.test(u) && !u.includes('${') && !u.includes('{{');
/** Every local file a page names → [{ ref, path }] (path: project-relative, or null when it isn't there). */
export function docRefs(dir, file, doc) {
  const base = path.dirname(path.join(dir, file || 'x'));
  const out = []; const seen = new Set();
  for (const m of String(doc).matchAll(REF)) {
    const ref = m[3] ?? m[5];
    if (!isLocalRef(ref) || seen.has(ref)) continue;
    seen.add(ref);
    const clean = decodeURI(ref.split(/[?#]/)[0]);
    const hit = [path.resolve(base, clean), path.resolve(dir, clean)].find((f) => f.startsWith(dir + path.sep) && fs.existsSync(f) && fs.statSync(f).isFile());
    out.push({ ref, path: hit ? path.relative(dir, hit).split(path.sep).join('/') : null });
  }
  return out;
}
export function mapDoc(dir, file, doc, map = (p) => p) {
  const to = new Map(docRefs(dir, file, doc).filter((r) => r.path).map((r) => [r.ref, map(r.path)]));
  if (!to.size) return doc;
  return String(doc).replace(REF, (m, a, q, u, q2, u2) => {
    const ref = u ?? u2; if (!to.has(ref)) return m;
    return u != null ? `${a}${q}${to.get(ref)}${q}` : `url(${q2}${to.get(ref)}${q2})`;
  });
}

/** A page's visible words (its text outside scripts and styles), line by line — the storyboard's copy for a scene page. */
export function pageWords(html) {
  const body = String(html || '').replace(/<(script|style|template|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|h[1-6]|li|span|section|article|header|footer|figcaption|button|a)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const seen = new Set(); const out = [];
  for (const l of body.split('\n').map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)) if (!seen.has(l)) { seen.add(l); out.push(l); }
  return out.slice(0, 12);
}

/** Scripts a page that runs the runtime itself (the preview, the gallery) inlines: name → text [, type], in load order.
 *  The library's element files for its scenes (and opt.files) run (UIK); the scene-page scripts ride along unexecuted
 *  (type text/plain): the page puts them into the scene pages it makes (MU.pageSources). */
export function pageScripts(project, opt = {}) {
  const read = (f) => fs.readFileSync(path.join(LIB_DIR, f), 'utf8');
  const out = [];
  for (const f of CORE) out.push([f, read(f)]);
  const need = [...new Set([...project.scenario.scenes.map((sc) => { const el = sc.item && project.K.elements.find((e) => e.id === sc.item); return el && el.file; }), ...(opt.files || [])].filter(Boolean))];
  for (const f of need) out.push([f, read(f)]);
  for (const f of TAIL) out.push([f, read(f)]);
  out.push(['motion.js', fs.readFileSync(RUNTIME, 'utf8')]);
  for (const f of ['clock.js', 'overrides.js', 'scene.js', 'editor.js']) if (fs.existsSync(path.join(LIB_DIR, f))) out.push([f, read(f), 'text/plain']);
  if (project.sceneDocs.some((d) => /\bTHREE\b/.test(d))) out.push(['three.js', read('vendor/three.js'), 'text/plain']);
  return out;
}

// ── files ──
export const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.html': 'text/html', '.json': 'application/json', '.zip': 'application/zip',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.js': 'text/javascript', '.jsx': 'text/plain' };
export const dataUri = (file) => `data:${MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;
/** The scenario with every picture path passed through fn(path) → new path / URL. */
export function mapImages(scenario, fn) {
  return Object.assign({}, scenario, { scenes: scenario.scenes.map((sc) => (sc.images ? Object.assign({}, sc, { images: Object.fromEntries(Object.entries(sc.images).map(([k, v]) => [k, fn(v)])) }) : sc)) });
}
/** A scene voice that is a take: { take: [part, …] } — one recording spoken over this scene and the next ones,
 *  part k over scene +k (references/voiceover.md → Long takes). */
export const isTake = (v) => !!(v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.take));
/** Every voice-over line of the film: [{ scene, line, text, at?, parts?, through? }]. scene.voice is a string,
 *  a list of strings / { text, at } (at = seconds into the scene), or a take ({ take: [part, …], at? }): ONE
 *  line whose parts run over the following scenes up to `through`. Scenes inside a take have no lines. */
export const voiceLines = (scenes) => {
  const out = []; let covered = 0;
  (scenes || []).forEach((s, i) => {
    if (i + 1 <= covered) return;
    const v = s && s.voice;
    if (isTake(v)) {
      const parts = v.take.map((p) => String((typeof p === 'string' ? p : p && p.text) || '').trim()).slice(0, scenes.length - i);
      const text = parts.filter(Boolean).join(' ');
      if (!text) return;
      covered = i + parts.length;
      out.push({ scene: i + 1, line: 0, text, parts, through: i + parts.length, ...(v.at != null ? { at: Number(v.at) } : {}) });
      return;
    }
    const list = Array.isArray(v) ? v : v ? [v] : [];
    list.map((l) => (typeof l === 'string' ? { text: l } : l || {}))
      .forEach((l, j) => { const text = String(l.text || '').trim(); if (text) out.push({ scene: i + 1, line: j, text, ...(l.at != null ? { at: Number(l.at) } : {}) }); });
  });
  return out;
};
/** A scene's voice as one readable string (cards, notes); a take reads as its whole text. */
export const voiceText = (v) => (isTake(v) ? v.take.map((p) => (typeof p === 'string' ? p : (p && p.text) || '')).filter(Boolean).join(' ')
  : Array.isArray(v) ? v.map((l) => (typeof l === 'string' ? l : (l && l.text) || '')).filter(Boolean).join(' ') : String(v || ''));
/** Voice-over clips with their files (scenario.voiceover.clips, written by tools/voiceover.mjs). */
export const voiceClips = (project) => ((project.scenario.voiceover && project.scenario.voiceover.clips) || []).filter((c) => c && c.file && c.duration > 0);

// ── the board ──
/** The GreenLight Dash board this runs under: --board <id> / --api <url>, else the app's terminal env
 *  (GREENLIGHT_API_BASE_URL) and its current board. null = standalone. --standalone forces null. */
export async function board(argv = []) {
  if (argv.includes('--standalone')) return null;
  const api = (arg(argv, 'api') || process.env.GREENLIGHT_API_BASE_URL || '').replace(/\/+$/, '');
  if (!api) return null;
  const headers = process.env.GREENLIGHT_API_TOKEN ? { Authorization: `Bearer ${process.env.GREENLIGHT_API_TOKEN}` } : {};
  let id = arg(argv, 'board');
  try {
    if (!id) { const r = await fetch(`${api}/api/moodboards/current`, { headers }); if (r.ok) id = (await r.json()).id; }
  } catch { return null; }
  if (!id) return null;
  // opts.timeout (ms): give up on a request that has not answered (AbortSignal → TimeoutError)
  const call = async (method, p, body, extraHeaders = {}, opts = {}) => {
    const init = { method, headers: { ...headers, ...extraHeaders }, ...(opts.timeout ? { signal: AbortSignal.timeout(opts.timeout) } : {}) };
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) { init.body = JSON.stringify(body); init.headers['Content-Type'] = 'application/json'; }
    // a pooled keep-alive connection the server already closed (uvicorn drops idle ones after 5 s, e.g. during a
    // long render) fails before any reply: the request never reached the app, so it is sent again
    let r;
    for (let attempt = 0; ; attempt++) {
      try { r = await fetch(api + p, init); break; } catch (err) {
        const code = err && err.cause && err.cause.code;
        if (attempt >= 2 || !['ECONNRESET', 'UND_ERR_SOCKET', 'EPIPE'].includes(code)) throw err;
        await new Promise((ok) => setTimeout(ok, 250 * (attempt + 1)));
      }
    }
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${text.slice(0, 300)}`);
    try { return JSON.parse(text); } catch { return text; }
  };
  /** Upload bytes into the board's media (folder = a subfolder of the board folder) → { url, filename } */
  const upload = async (name, data, folder, type) => {
    const fd = new FormData();
    fd.append('file', new Blob([data], { type: type || MIME[path.extname(name).toLowerCase()] || 'application/octet-stream' }), name);
    return call('POST', `/api/upload?board_id=${encodeURIComponent(id)}&defer_derivatives=true&folder=${encodeURIComponent(folder || '')}`, fd);
  };
  return { api, id, headers, call, upload };
}

/** Board uploads are never overwritten (a second upload gets a new name), so each project remembers
 *  what it put on the board: .board.json = { boardId, files: { key: { sha, url } }, cards: {…} }. */
export function boardState(project, boardId) {
  const f = path.join(project.dir, '.board.json');
  const st = readJSON(f, {});
  if (st.boardId !== boardId) Object.assign(st, { boardId, files: {}, cards: {} });
  st.files = st.files || {}; st.cards = st.cards || {};
  return { st, save: () => writeJSON(f, st) };
}
/** Upload once per content: returns the board URL of `data` under `key`. */
export async function ensureUpload(B, state, key, name, data, folder) {
  const sha = sha1(data);
  const have = state.st.files[key];
  if (have && have.sha === sha) return have.url;
  const r = await B.upload(name, data, folder);
  state.st.files[key] = { sha, url: r.url }; state.save();
  return r.url;
}
/** The board media URL prefix and a board-dir-relative path from an uploaded URL. */
/** The film's one folder on the board (uploads take a single folder segment): greenlight-motion-<id> */
export const boardFolder = (scenario) => `greenlight-motion-${scenario.id}`;
export const boardRel = (url, folder) => { const i = url.indexOf('/' + folder + '/'); return i >= 0 ? url.slice(i + 1) : url; };
export const boardPrefix = (url, folder) => { const i = url.indexOf('/' + folder + '/'); return i >= 0 ? url.slice(0, i) : ''; };

/** Create or update an HTML card on the board: remembers the card id per key in .board.json. */
export async function upsertHtmlCard(B, state, key, { title, html, width, height, x, y, data = {} }) {
  let el = null;
  const known = state.st.cards[key];
  if (known) { try { el = await B.call('GET', `/api/moodboards/${B.id}/elements/${known}`); } catch { el = null; } }
  if (!el || !el.id) {
    el = await B.call('POST', `/api/moodboards/${B.id}/elements`, { type: 'html', x: x ?? 0, y: y ?? 0, width, height, data: { title, ...data } });
    state.st.cards[key] = el.id; state.save();
  }
  await B.call('PUT', `/api/moodboards/${B.id}/elements/${el.id}/html`, { html });
  return el.id;
}
// ── the user's edits from the preview (scenario.json → edits; references/scenario.md → Edits) ──
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
/** An edits overlay without empty parts, or null. */
export function cleanEdits(e) {
  if (!isObj(e)) return null;
  const clean = (o) => { for (const k of Object.keys(o)) { const v = o[k]; if (isObj(v)) { clean(v); if (!Object.keys(v).length) delete o[k]; } else if (v === undefined) delete o[k]; } return o; };
  const out = clean(JSON.parse(JSON.stringify({ film: e.film || {}, scenes: e.scenes || {} })));
  return Object.keys(out).length ? Object.assign({ film: {}, scenes: {} }, out) : null;
}
/** Write the edits into scenario.json (null removes them); the project is reloaded when they changed. */
export function saveEdits(project, edits) {
  const next = cleanEdits(edits);
  const raw = readJSON(project.file, null) || project.raw;
  if (JSON.stringify(raw.edits || null) === JSON.stringify(next)) return { project, changed: false };
  if (next) raw.edits = next; else delete raw.edits;
  writeJSON(project.file, raw);
  return { project: loadProject(project.dir), changed: true };
}
/** Under a board: the edits the preview card saved (its element data → muEdits) become scenario.json's. */
export async function pullEdits(B, project) {
  const id = boardState(project, B.id).st.cards.preview;
  if (!id) return { project, changed: false };
  let el = null;
  try { el = await B.call('GET', `/api/moodboards/${B.id}/elements/${id}`); } catch { return { project, changed: false }; }
  const saved = el && el.data && el.data.muEdits;
  if (!saved) return { project, changed: false };
  return saveEdits(project, saved.edits || null);
}
/** Under a board: set (or clear, with null) the preview card's saved edits — after the agent folded or reset them. */
export async function pushEdits(B, project, edits) {
  const id = boardState(project, B.id).st.cards.preview;
  if (!id) return false;
  for (let k = 0; k < 3; k++) {
    const el = await B.call('GET', `/api/moodboards/${B.id}/elements/${id}`);
    const data = Object.assign({}, el.data || {});
    const next = cleanEdits(edits);
    if (next) data.muEdits = { edits: next, at: Date.now(), by: 'agent' }; else delete data.muEdits;
    try { await B.call('PUT', `/api/moodboards/${B.id}/elements/${id}`, { data, expected_version: el.version }); return true; } catch (e) { if (!/409/.test(String(e.message))) throw e; }
  }
  return false;
}

/** A board position to the right of everything already there (so new cards never cover old ones). */
export async function freeSpot(B) {
  try {
    const els = await B.call('GET', `/api/moodboards/${B.id}/elements`);
    if (!Array.isArray(els) || !els.length) return { x: 0, y: 0 };
    const right = Math.max(...els.map((e) => (e.x || 0) + (e.width || 0)));
    const top = Math.min(...els.map((e) => e.y || 0));
    return { x: Math.round(right + 120), y: Math.round(top) };
  } catch { return { x: 0, y: 0 }; }
}
