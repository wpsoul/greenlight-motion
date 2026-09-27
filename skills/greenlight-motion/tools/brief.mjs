// The onboarding page that collects the brief (references/brief.md): product, film, look, motion,
// workflow, then a review — the user's answers to SKILL.md step 1, written as <project>/brief.json.
//   node tools/brief.mjs <project> [--port 4818] [--agent]   → a local page (127.0.0.1, printed as JSON). Its
//        last button writes <project>/brief.json (and prints { event: 'brief', … }); uploads go to <project>/assets/.
//        With --agent (an agent started it and waits for that event) the page says the agent is picking it up.
//        Without it (the user started it: no agent yet) the button is "Copy for your agent": it saves, then
//        copies a prompt with the paths to SKILL.md, brief.json and the project, for any agent the user runs.
//        Keeps running; the page is rebuilt on every load, prefilled from an existing brief.json.
//   node tools/brief.mjs <project> --artifact      → <project>/brief.artifact.html for the Artifact tool:
//        the same page, no network — it ends with the same prompt, the brief inline as JSON, to copy.
//   node tools/brief.mjs --check <file|project>    → { ok, problems, open }; exit 1 on problems.
// import { validateBrief } from './brief.mjs' — the same check the server runs on every Start.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadKit, libSource, SKILL_DIR, CORE, arg } from './kit.mjs';
import { readJSON, writeJSON, MIME } from './project.mjs';
import { tokens, inlineScripts, jsonForScript } from './page.mjs';

export const BRIEF_KIND = 'greenlight-motion-brief';
export const MAX_UPLOAD = 50 * 1024 * 1024;
/** Every value brief.md allows (plus "agent" = left to the agent, on any answer). */
export const BRIEF_VALUES = {
  goal: ['promo', 'explainer', 'tutorial', 'launch', 'social', 'agent'],
  format: ['16:9', '9:16', '1:1'],
  source: ['library', 'new', 'mix', 'agent'],
  theme: ['light', 'dark', 'agent'],
  // brief.md's six, plus the kit's 'authored' (every item's own easing — easing.md)
  preset: ['spring', 'snappy', 'gentle', 'playful', 'elastic', 'agent', 'authored'],
  // quick: straight to the preview (the agent decides, the preview is the one approval); guided: approve the story
  // and a storyboard direction first
  mode: ['quick', 'guided', 'agent'],
  storyboard: [0, 2, 3],
  voiceover: ['yes', 'no', 'agent'],
  output: ['render', 'video-editor', 'after-effects'],
  assetType: ['image', 'video'],
};
const SECTIONS = { product: ['name', 'url', 'about', 'assets'], film: ['goal', 'cta', 'duration', 'format', 'language'],
  look: ['source', 'picks', 'theme', 'accent'], motion: ['preset'], workflow: ['mode', 'storyboard', 'voiceover'] };
const TOP = ['kind', 'version', 'source', 'createdAt', ...Object.keys(SECTIONS), 'output'];
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov', '.m4v'];

let kitIds = null;
const libraryIds = () => (kitIds || (kitIds = new Set(loadKit().elements.map((e) => e.id))));
const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const isWebUrl = (s) => { try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) && !!u.hostname; } catch { return false; } };

/** Check a brief against references/brief.md.
 *  → { ok, problems: ['film.goal: "movie" is not one of …', …], open: ['film.cta', …] }
 *  `open` = the answers left to the agent: missing, empty, or "agent". ids = the item ids picks may use
 *  (default: the library's). */
export function validateBrief(b, { ids } = {}) {
  const problems = []; const open = [];
  if (!isObj(b)) return { ok: false, problems: ['the brief is not a JSON object'], open: [] };
  const known = ids ? new Set(ids) : libraryIds();
  const bad = (f, msg) => problems.push(`${f}: ${msg}`);
  const show = (v) => JSON.stringify(v);
  const isOpen = (v) => v == null || v === 'agent' || v === '' || (Array.isArray(v) && v.length === 0);

  if (b.kind !== BRIEF_KIND) bad('kind', b.kind == null ? `missing (must be "${BRIEF_KIND}")` : `${show(b.kind)} must be "${BRIEF_KIND}"`);
  if (b.version !== 1) bad('version', b.version == null ? 'missing (must be 1)' : `${show(b.version)} must be 1`);
  if (b.source != null && typeof b.source !== 'string') bad('source', 'must be text');
  if (b.createdAt != null && (typeof b.createdAt !== 'string' || Number.isNaN(Date.parse(b.createdAt)))) bad('createdAt', 'must be an ISO date');
  for (const k of Object.keys(b)) if (!TOP.includes(k)) bad(k, 'unknown field');
  for (const [sec, fields] of Object.entries(SECTIONS)) {
    if (b[sec] != null && !isObj(b[sec])) { bad(sec, 'must be an object'); continue; }
    for (const k of Object.keys(b[sec] || {})) if (!fields.includes(k)) bad(`${sec}.${k}`, 'unknown field');
  }
  const P = isObj(b.product) ? b.product : {}; const F = isObj(b.film) ? b.film : {}; const L = isObj(b.look) ? b.look : {};
  const M = isObj(b.motion) ? b.motion : {}; const Wf = isObj(b.workflow) ? b.workflow : {};
  const text = (f, v) => { if (isOpen(v)) { open.push(f); return; } if (typeof v !== 'string') bad(f, `must be text, not ${show(v)}`); };
  const oneOf = (f, v, list) => { if (isOpen(v)) { open.push(f); return; } if (!list.includes(v)) bad(f, `${show(v)} is not one of ${list.map(show).join(', ')}`); };

  // product
  text('product.name', P.name);
  if (isOpen(P.url)) open.push('product.url');
  else if (typeof P.url !== 'string' || !isWebUrl(P.url)) bad('product.url', `${show(P.url)} is not a web address (https://…)`);
  text('product.about', P.about);
  if (isOpen(P.assets)) open.push('product.assets');
  else if (!Array.isArray(P.assets)) bad('product.assets', 'must be a list of { url, name, type }');
  else P.assets.forEach((a, i) => {
    const f = `product.assets[${i}]`;
    if (!isObj(a)) { bad(f, 'must be { url, name, type }'); return; }
    if (typeof a.url !== 'string' || !a.url.trim()) bad(`${f}.url`, 'missing');
    if (a.name != null && typeof a.name !== 'string') bad(`${f}.name`, 'must be text');
    if (a.type != null && !BRIEF_VALUES.assetType.includes(a.type)) bad(`${f}.type`, `${show(a.type)} is not one of "image", "video"`);
    for (const k of Object.keys(a)) if (!['url', 'name', 'type'].includes(k)) bad(`${f}.${k}`, 'unknown field');
  });
  // film
  oneOf('film.goal', F.goal, BRIEF_VALUES.goal);
  text('film.cta', F.cta);
  if (isOpen(F.duration)) open.push('film.duration');
  else if (typeof F.duration !== 'number' || !Number.isFinite(F.duration)) bad('film.duration', `must be seconds (a number), not ${show(F.duration)}`);
  else if (F.duration < 10 || F.duration > 90) bad('film.duration', `${F.duration} s is outside 10–90 s`);
  oneOf('film.format', F.format, BRIEF_VALUES.format);
  if (isOpen(F.language)) open.push('film.language');
  else if (typeof F.language !== 'string' || !/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(F.language)) bad('film.language', `${show(F.language)} is not a language code (en, de, pt-BR …)`);
  // look
  oneOf('look.source', L.source, BRIEF_VALUES.source);
  if (L.source !== 'new') {
    if (isOpen(L.picks)) open.push('look.picks');
    else if (!Array.isArray(L.picks)) bad('look.picks', 'must be a list of item ids');
    else for (const id of L.picks) {
      if (typeof id !== 'string') bad('look.picks', `${show(id)} is not a library scene id`);
      else if (!known.has(id)) bad('look.picks', `unknown library scene "${id}" (node tools/registry.mjs --search …)`);
    }
  } else if (L.picks != null && !Array.isArray(L.picks)) bad('look.picks', 'must be a list of item ids');
  oneOf('look.theme', L.theme, BRIEF_VALUES.theme);
  if (isOpen(L.accent)) open.push('look.accent');
  else if (typeof L.accent !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(L.accent)) bad('look.accent', `${show(L.accent)} is not a hex colour (#3E63DD) or "agent"`);
  // motion, workflow, output
  oneOf('motion.preset', M.preset, BRIEF_VALUES.preset);
  oneOf('workflow.mode', Wf.mode, BRIEF_VALUES.mode);
  // quick mode has no storyboard: the question isn't open
  if (Wf.mode === 'quick') { if (Wf.storyboard != null && Wf.storyboard !== 0 && Wf.storyboard !== 'agent') bad('workflow.storyboard', 'quick mode goes straight to the preview: no storyboard (0)'); }
  else oneOf('workflow.storyboard', Wf.storyboard, BRIEF_VALUES.storyboard);
  oneOf('workflow.voiceover', Wf.voiceover, BRIEF_VALUES.voiceover);
  if (isOpen(b.output)) open.push('output');
  else if (!Array.isArray(b.output)) bad('output', `must be a list of ${BRIEF_VALUES.output.map(show).join(', ')}`);
  else for (const o of b.output) if (!BRIEF_VALUES.output.includes(o)) bad('output', `${show(o)} is not one of ${BRIEF_VALUES.output.map(show).join(', ')}`);
  return { ok: problems.length === 0, problems, open };
}

// ── the page ──
/** The onboarding page. target: 'local' (served by this tool: uploads + Start) | 'artifact' (no
 *  document skeleton, no network: ends with the prompt + JSON to copy). agent: an agent launched the local
 *  page and waits for the brief (no hand-off prompt). */
export function briefPage(dir, { target = 'local', agent = false } = {}) {
  const K = loadKit();
  // the whole library: every library scene plays in the Look step, and the motion presets on a sample (film.js)
  const scripts = [...CORE, ...K.FILES, 'film.js'].map((f) => [f, libSource(f)]);
  const file = path.join(dir, 'brief.json');
  const brief = fs.existsSync(file) ? readJSON(file, null) : null;
  const data = {
    target, agent: target === 'local' && !!agent, project: path.basename(dir), brief: brief && typeof brief === 'object' ? brief : null,
    // what the hand-off prompt names, so an agent the user starts later finds everything
    paths: { skill: path.join(SKILL_DIR, 'SKILL.md'), project: path.resolve(dir), brief: path.resolve(file) },
    stamp: (brief && brief.createdAt) || null, maxUpload: MAX_UPLOAD, values: BRIEF_VALUES,
  };
  let html = fs.readFileSync(path.join(SKILL_DIR, 'templates', 'brief.html'), 'utf8');
  // light + dark palettes on :root for both targets (this page is a whole page, not a board card)
  html = html.replace('@@TITLE@@', () => 'GL Motion Brief').replace('@@TOKENS@@', () => tokens('artifact'))
    .replace('@@SCRIPTS@@', () => inlineScripts(scripts)).replace('@@DATA@@', () => jsonForScript(data));
  if (target === 'artifact') {
    const part = (tag) => { const open = `<!--MU:${tag}-->`; const a = html.indexOf(open); const b = html.indexOf(`<!--/MU:${tag}-->`); return html.slice(a + open.length, b); };
    html = part('HEAD').trim() + '\n' + part('BODY').trim() + '\n';
  }
  return html;
}

// ── the local server ──
const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readJsonBody = (req, limit = 2 * 1024 * 1024) => new Promise((resolve, reject) => {
  let size = 0; const parts = [];
  req.on('data', (d) => { size += d.length; if (size > limit) { reject(Object.assign(new Error('the brief is too large'), { code: 413 })); req.destroy(); } else parts.push(d); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(parts).toString('utf8') || '{}')); } catch { reject(Object.assign(new Error('not JSON'), { code: 400 })); } });
  req.on('error', reject);
});
/** "My Screen (1).PNG" → "my-screen-1.png", unique in dir. */
export function assetName(dir, original) {
  const ext = path.extname(original || '').toLowerCase();
  const base = path.basename(original || 'file', path.extname(original || '')).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  let name = base + ext; let n = 2;
  while (fs.existsSync(path.join(dir, name))) name = `${base}-${n++}${ext}`;
  return name;
}

export function serveBrief(dir, { port = 4818, agent = false, log = (o) => console.log(JSON.stringify(o)) } = {}) {
  dir = path.resolve(dir);
  const assets = path.join(dir, 'assets');
  const briefFile = path.join(dir, 'brief.json');
  const mine = new Set();   // files uploaded through this server (the only ones Remove deletes)
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      // writes come from this page only
      if (req.method === 'POST' && req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.origin)) return send(res, 403, { ok: false, detail: 'forbidden' });
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/brief.html')) return send(res, 200, briefPage(dir, { target: 'local', agent }), 'text/html; charset=utf-8');
      if (req.method === 'POST' && url.pathname === '/mu/brief') {
        const body = await readJsonBody(req);
        const brief = { kind: BRIEF_KIND, version: 1, source: 'onboarding-page', createdAt: new Date().toISOString() };
        for (const k of TOP) if (!(k in brief) && body[k] !== undefined) brief[k] = body[k];
        for (const k of Object.keys(body)) if (!TOP.includes(k)) brief[k] = body[k];   // unknown fields reach the check
        const v = validateBrief(brief);
        if (!v.ok) return send(res, 400, { ok: false, problems: v.problems });
        writeJSON(briefFile, brief);
        log({ event: 'brief', ok: true, file: briefFile, open: v.open });
        return send(res, 200, { ok: true, file: 'brief.json', open: v.open, createdAt: brief.createdAt });
      }
      if (req.method === 'POST' && url.pathname === '/mu/brief/asset') {
        const original = String(url.searchParams.get('name') || 'file').slice(0, 200);
        const ext = path.extname(original).toLowerCase();
        const type = IMAGE_EXT.includes(ext) ? 'image' : VIDEO_EXT.includes(ext) ? 'video' : null;
        if (!type) { req.resume(); return send(res, 415, { ok: false, detail: `Only pictures (${IMAGE_EXT.join(' ')}) and videos (${VIDEO_EXT.join(' ')})` }); }
        if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD) { req.resume(); return send(res, 413, { ok: false, detail: 'Larger than 50 MB' }); }
        fs.mkdirSync(assets, { recursive: true });
        const tmp = path.join(assets, `.upload-${crypto.randomBytes(6).toString('hex')}`);
        const out = fs.createWriteStream(tmp);
        let size = 0; let over = false;
        await new Promise((resolve, reject) => {
          req.on('data', (d) => {
            size += d.length;
            if (size > MAX_UPLOAD && !over) { over = true; req.unpipe(out); out.destroy(); resolve(); }
          });
          req.pipe(out);
          out.on('finish', resolve); out.on('error', reject); req.on('error', reject);
        });
        if (over || size === 0) { fs.rmSync(tmp, { force: true }); return send(res, over ? 413 : 400, { ok: false, detail: over ? 'Larger than 50 MB' : 'Empty file' }); }
        const name = assetName(assets, original);
        fs.renameSync(tmp, path.join(assets, name));
        mine.add(name);
        return send(res, 200, { ok: true, asset: { url: `assets/${name}`, name: original, type }, size });
      }
      if (req.method === 'POST' && url.pathname === '/mu/brief/asset/remove') {
        const body = await readJsonBody(req);
        const name = path.basename(String(body.url || ''));
        const deleted = String(body.url || '') === `assets/${name}` && mine.has(name) && fs.existsSync(path.join(assets, name));
        if (deleted) { fs.rmSync(path.join(assets, name)); mine.delete(name); }
        return send(res, 200, { ok: true, deleted });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
        const f = path.resolve(assets, decodeURIComponent(url.pathname.slice('/assets/'.length)));
        if (!f.startsWith(assets + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, { detail: 'not found' });
        const type = MIME[path.extname(f).toLowerCase()] || (path.extname(f).toLowerCase() === '.avif' ? 'image/avif' : 'application/octet-stream');
        const stat = fs.statSync(f);
        const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
        if (range) {
          const a = range[1] ? +range[1] : 0; const e = range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
          res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${e}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': e - a + 1 });
          return fs.createReadStream(f, { start: a, end: e }).pipe(res);
        }
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
        return fs.createReadStream(f).pipe(res);
      }
      if (req.method === 'GET' && url.pathname === '/favicon.ico') return send(res, 204, '');
      send(res, 404, { detail: 'not found' });
    } catch (err) {
      send(res, err.code === 413 || err.code === 400 ? err.code : 500, { ok: false, detail: String(err.message || err) });
    }
  });
  return new Promise((resolve, reject) => {
    let p = Number(port); let tries = 0;
    const listen = () => server.listen(p, '127.0.0.1');
    server.on('error', (e) => { if (e.code === 'EADDRINUSE' && p !== 0 && tries++ < 20) { p += 1; listen(); } else reject(e); });
    server.on('listening', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
    listen();
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const VALUE = ['--port', '--check'];
  const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1])));
  if (argv.includes('--check')) {
    let f = arg(argv, 'check');
    if (!f || f.startsWith('--')) f = dir || '.';
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'brief.json');
    let res;
    if (!fs.existsSync(f)) res = { ok: false, problems: [`no such file: ${f}`], open: [] };
    else {
      let b;
      try { b = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { b = undefined; res = { ok: false, problems: [`${f} is not valid JSON: ${e.message}`], open: [] }; }
      if (!res) res = validateBrief(b);
    }
    console.log(JSON.stringify({ file: path.resolve(f), ...res }));
    process.exit(res.ok ? 0 : 1);
  }
  if (!dir) { console.log(JSON.stringify({ ok: false, error: 'usage: node tools/brief.mjs <project> [--port 4818] [--agent] | <project> --artifact | --check <file>' })); process.exit(1); }
  const project = path.resolve(dir);
  fs.mkdirSync(project, { recursive: true });
  if (argv.includes('--artifact')) {
    const out = path.join(project, 'brief.artifact.html');
    fs.writeFileSync(out, briefPage(project, { target: 'artifact' }));
    console.log(JSON.stringify({ ok: true, file: out, hint: 'publish it with the Artifact tool; the user copies the finished brief back to you' }));
  } else {
    const agent = argv.includes('--agent');
    const { url } = await serveBrief(project, { port: Number(arg(argv, 'port', 4818)), agent });
    console.log(JSON.stringify({ ok: true, url, project, brief: path.join(project, 'brief.json'),
      hint: agent ? 'open the URL; Start writes brief.json and prints {"event":"brief",…}'
        : 'open the URL; its last button saves brief.json and copies a prompt for your agent (paths to the skill, the brief and the project)' }));
  }
}
