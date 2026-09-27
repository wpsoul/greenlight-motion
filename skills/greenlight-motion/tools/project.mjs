// A GL Motion project = a folder with scenario.json (+ assets/, items/, audio/). Shared by every tool:
//   loadProject(dir)      → { dir, scenario, extra, K, MU, problems }
//   sources(project)      → the script texts a standalone page inlines
//   imageSize(file)       → { w, h } from the file header (png / jpeg / gif / webp / svg)
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

/** The project in `dir`: its scenario, its own item files (items/*.js) and the loaded library.
 *  optional: a folder without scenario.json is fine (library work: check / stills of any item). */
export function loadProject(dir, { optional = false } = {}) {
  dir = path.resolve(dir || '.');
  const file = path.join(dir, 'scenario.json');
  if (!fs.existsSync(file) && !optional) throw new Error(`no scenario.json in ${dir} (see references/scenario.md)`);
  const raw = fs.existsSync(file) ? readJSON(file, null) : { name: 'Library', scenes: [] };
  if (!raw) throw new Error(`${file} is not valid JSON`);
  const itemsDir = path.join(dir, 'items');
  const extra = fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(itemsDir, f)) : [];
  const K = loadKit({ extra });
  const MU = globalThis.MU;
  const scenario = MU.normalize(raw);
  // a 3D-engine film: each scene's page (scene.html, relative to the project)
  const sceneDocs = scenario.engine === '3d' ? scenario.scenes.map((sc) => {
    const f = sc.html ? path.join(dir, sc.html) : null;
    return f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  }) : null;
  return { dir, file, raw, scenario, extra, K, MU, sceneDocs, problems: raw.scenes && raw.scenes.length ? check(dir, scenario, K, raw) : [] };
}

/** Everything wrong with a scenario that would make a tool fail or a scene look unfinished. */
// what a style / a control may change on a layer (film.js applies them)
const STYLE_PROPS = new Set(['color', 'fill', 'stroke', 'size', 'weight', 'upper', 'italic', 'ls', 'r', 'sw', 'text']);
const CONTROL_PROPS = new Set([...STYLE_PROPS, 'image', 'colour', 'tracking', 'radius', 'corners', 'case', 'width', 'picture']);
const PARAM_TYPES = new Set(['slider', 'number', 'toggle', 'select', 'color']);

export function check(dir, scenario, K, raw = scenario) {
  const out = [];
  const obj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  // the film's tokens (and the same fields in the user's edits)
  const film = (f, where) => {
    if (!obj(f)) return;
    for (const k of Object.keys(obj(f.colors) ? f.colors : {})) if (!K.TOKENS.includes(k)) out.push(`${where}colors: "${k}" is not a token (${K.TOKENS.join(', ')})`);
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
  // a 3D-engine film: every scene is an HTML page (references/3d-engine.md)
  if (scenario.engine === '3d') {
    scenario.scenes.forEach((sc, i) => {
      const n = `scene ${i + 1}`;
      if (sc.item) out.push(`${n}: a 3D-engine film's scenes are pages — "html": "scenes/…html", not an item`);
      if (!sc.html) { out.push(`${n}: no "html" (the scene's page, e.g. "scenes/intro.html")`); return; }
      const f = path.join(dir, sc.html);
      if (!fs.existsSync(f)) { out.push(`${n}: page not found: ${sc.html}`); return; }
      const doc = fs.readFileSync(f, 'utf8');
      if (!/MUScene\s*\(/.test(doc)) out.push(`${n}: ${sc.html} never calls MUScene({ … }) — the runtime can't drive its time`);
      if (/Math\.random\s*\(|Date\.now\s*\(|new Date\s*\(|setTimeout\s*\(|setInterval\s*\(/.test(doc)) out.push(`${n}: ${sc.html} uses Math.random / Date / timers — frames must be a pure function of t (use ctx.random(seed))`);
      for (const [id, src] of Object.entries(sc.images || {})) if (!isUrl(src) && !fs.existsSync(path.join(dir, src))) out.push(`${n}: image not found: ${src} (${id})`);
      if (sc.transition && !['cut', 'fade'].includes(sc.transition)) out.push(`${n}: transition must be "cut" or "fade"`);
    });
    return out;
  }
  scenario.scenes.forEach((sc, i) => {
    const n = `scene ${i + 1}`;
    const spec = K.elements.find((e) => e.id === sc.item);
    if (!spec) { out.push(`${n}: unknown item "${sc.item}" (search: node tools/registry.mjs --search …)`); return; }
    const ids = new Set(); const keys = new Set(); let photos = 0, canvas = false;
    const walk = (L, path) => { if (L.id) ids.add(L.id); if (L.src) ids.add(L.src); keys.add(L.id != null && L.id !== '' ? String(L.id) : '~' + path); if (L.media != null) ids.add('#' + (++photos)); if (L.type === 'canvas') canvas = true; (L.ch || []).forEach((c, j) => walk(c, path + '.' + j)); };
    try { K.build(spec, sc.params).forEach((L, j) => walk(L, String(j))); } catch (e) { out.push(`${n}: ${sc.item} fails to build: ${e.message}`); }
    // the item's parameters, per-layer styles and the agent's controls
    const defs = spec.params || {};
    if (sc.params != null && !obj(sc.params)) out.push(`${n}: params must be an object`);
    for (const p of Object.keys(obj(sc.params) ? sc.params : {})) if (!Object.prototype.hasOwnProperty.call(defs, p)) out.push(`${n}: ${sc.item} has no parameter "${p}"${Object.keys(defs).length ? ` (has ${Object.keys(defs).join(', ')})` : ''}`);
    for (const [key, st] of Object.entries(obj(sc.style) ? sc.style : {})) {
      if (!keys.has(key)) out.push(`${n}: style "${key}": ${sc.item} has no such layer`);
      for (const p of Object.keys(obj(st) ? st : {})) if (!STYLE_PROPS.has(p)) out.push(`${n}: style "${key}".${p} is not a style (${[...STYLE_PROPS].join(', ')})`);
    }
    for (const [p, d] of Object.entries(defs)) if (!obj(d) || !PARAM_TYPES.has(d.type || 'slider')) out.push(`${n}: ${sc.item} parameter "${p}": type must be one of ${[...PARAM_TYPES].join(', ')}`);
    // panels the item's own layers carry (ui: { label, controls }) and the scene's (scenario ui: [{ layer, … }])
    const own = []; const collect = (L, path) => { if (L.ui) for (const u of Array.isArray(L.ui) && L.ui.length && obj(L.ui[0]) && L.ui[0].controls ? L.ui : [L.ui]) own.push(Object.assign({ layer: L.id != null && L.id !== '' ? String(L.id) : '~' + path }, typeof u === 'string' ? { controls: [u] } : Array.isArray(u) ? { controls: u } : u)); (L.ch || []).forEach((c, j) => collect(c, path + '.' + j)); };
    try { K.build(spec, sc.params).forEach((L, j) => collect(L, String(j))); } catch { /* reported above */ }
    for (const card of own.concat(sc.ui == null ? [] : Array.isArray(sc.ui) ? sc.ui : [sc.ui])) {
      if (!obj(card) || card.layer == null) { out.push(`${n}: ui panels are { layer, label, controls }`); continue; }
      if (!keys.has(String(card.layer))) out.push(`${n}: ui panel "${card.label || card.layer}": no layer "${card.layer}"`);
      for (const c of [].concat(card.controls || [])) {
        const x = typeof c === 'string' ? { prop: c } : c;
        if (!obj(x)) continue;
        if (x.param != null) { if (!Object.prototype.hasOwnProperty.call(defs, x.param)) out.push(`${n}: ui panel "${card.label || card.layer}": no parameter "${x.param}"`); continue; }
        if (!CONTROL_PROPS.has(x.prop)) out.push(`${n}: ui panel "${card.label || card.layer}": "${x.prop}" is not a control`);
        for (const l of [].concat(x.layer || [])) if (!keys.has(String(l))) out.push(`${n}: ui panel "${card.label || card.layer}": no layer "${l}"`);
      }
    }
    for (const id of Object.keys(sc.text || {})) if (!ids.has(id)) out.push(`${n}: ${sc.item} has no text layer "${id}"`);
    // an item drawn on a canvas layer takes an image LIST (an array, or '#1', '#2' …); the others fill photo slots
    for (const [id, src] of Object.entries(sc.images || {})) {
      if (!canvas && !ids.has(id)) out.push(`${n}: ${sc.item} has no photo "${id}"`);
      if (!isUrl(src) && !fs.existsSync(path.join(dir, src))) out.push(`${n}: image not found: ${src}`);
    }
    if (sc.transition && !['cut', 'fade'].includes(sc.transition)) out.push(`${n}: transition must be "cut" or "fade"`);
    if (badMotion(sc.motion)) out.push(`${n}: motion "${sc.motion}" is not one of ${presets.join(', ')}`);
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

/** The script texts a standalone page needs: easings, engine, film + every element file (library + own). */
export function sources(project) {
  const read = (f) => fs.readFileSync(path.join(LIB_DIR, f), 'utf8');
  const files = {};
  for (const f of project.K.FILES) files[f] = read(f);
  for (const f of project.extra) files[path.basename(f)] = fs.readFileSync(f, 'utf8');
  const out = { easings: read('easings.js'), engine: read('engine.js'), film: read('film.js'), files };
  // a 3D-engine film: its scene pages, the scene runtime and host, three.js
  if (project.sceneDocs) Object.assign(out, { scenes: project.sceneDocs, sceneRuntime: read('scene.js'), sceneHost: read('scene-host.js'), three: read('vendor/three.js') });
  return out;
}

/** Scripts to inline in a page that runs the whole toolchain (preview): name → text, in load order. */
export function pageScripts(project, { files } = {}) {
  const read = (f) => fs.readFileSync(path.join(LIB_DIR, f), 'utf8');
  const out = [];
  for (const f of CORE) out.push([f, read(f)]);
  // a 3D-engine film: no element files; the scene runtime and three.js ride along unexecuted (the scene frames run them)
  if (project.sceneDocs) {
    for (const f of TAIL) out.push([f, read(f)]);
    out.push(['motion.js', fs.readFileSync(RUNTIME, 'utf8')]);
    out.push(['scene.js', read('scene.js'), 'text/plain']);
    out.push(['three.js', read('vendor/three.js'), 'text/plain']);
    return out;
  }
  // each scene's element file
  const need = files || [...new Set(project.scenario.scenes.map((sc) => { const el = project.K.elements.find((e) => e.id === sc.item); return el && el.file; }).filter(Boolean))];
  for (const f of need) {
    const own = project.extra.find((x) => path.basename(x) === f);
    out.push([f, own ? fs.readFileSync(own, 'utf8') : read(f)]);
  }
  for (const f of TAIL) out.push([f, read(f)]);
  out.push(['motion.js', fs.readFileSync(RUNTIME, 'utf8')]);
  return out;
}

// ── images ──
export function imageSize(file) {
  const b = fs.readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 10 && b.toString('ascii', 0, 3) === 'GIF') return { w: b.readUInt16LE(6), h: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1]; const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  const s = b.toString('utf8', 0, Math.min(b.length, 4000));
  if (/<svg/i.test(s)) {
    const num = (re) => { const m = s.match(re); return m ? parseFloat(m[1]) : NaN; };
    const w = num(/<svg[^>]*\swidth="([\d.]+)(px)?"/i); const h = num(/<svg[^>]*\sheight="([\d.]+)(px)?"/i);
    if (w > 0 && h > 0) return { w, h };
    const vb = s.match(/viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/i);
    if (vb) return { w: +vb[1], h: +vb[2] };
    return { w: 300, h: 150 };
  }
  return null;
}
export const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.html': 'text/html', '.json': 'application/json', '.zip': 'application/zip',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.js': 'text/javascript', '.jsx': 'text/plain' };
export const dataUri = (file) => `data:${MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'};base64,${fs.readFileSync(file).toString('base64')}`;
/** Every picture the scenario uses (paths relative to the project) → its size. */
export function imageSizes(project) {
  const out = {};
  for (const sc of project.scenario.scenes) for (const src of Object.values(sc.images || {})) {
    if (isUrl(src) || out[src]) continue;
    const f = path.join(project.dir, src);
    if (fs.existsSync(f)) { const z = imageSize(f); if (z) out[src] = z; }
  }
  return out;
}
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
