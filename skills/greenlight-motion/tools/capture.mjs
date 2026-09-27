// Capture the product's website for a film: desktop and phone screenshots into <project>/assets/, and
// what the page says about itself (name, description, headings, nav, colours, logo) into site.json.
//   node tools/capture.mjs <project> --url <url> [--timeout 30] [--python /path/to/python3] [--standalone] [--board <id>]
// → assets/site-desktop-1.png (1440×900, top) · -2 / -3 (scrolled one / two screens, when the page is
//   that tall) · assets/site-phone-1.png (390×844 at 2×) · site.json. Re-running overwrites them.
// Three ways, the first that is available:
//   · under a GreenLight Dash board: the app's own browser (POST /api/site-capture) — nothing to install
//   · standalone with Python 3 + Playwright: render/capture.py (the render engine's browser)
//   · neither: the page's HTML read by Node alone — site.json without screenshots (its "via" says "html")
// Both browsers run the same page code (render/capture-extract.js, render/capture-ready.js).
// Prints one JSON line: { ok, via: 'app'|'browser'|'html', site: 'site.json', screenshots: [...], title, warnings }
// or { ok: false, error }.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKILL_DIR, arg } from './kit.mjs';
import { board, loadProject, boardState } from './project.mjs';
import { ensurePipeline, showPictures, setStep } from './pipeline.mjs';
import { findPython } from './render.mjs';

const SHOTS = ['site-desktop-1.png', 'site-desktop-2.png', 'site-desktop-3.png', 'site-phone-1.png'];
const INSTALL = 'for screenshots, install Python 3 + Playwright (the README\'s Requirements), or run under GreenLight Dash';

/** "acme.com" → "https://acme.com"; null when it is not a web address. */
export function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
  try {
    const u = new URL(s);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname) return null;
    if (!u.hostname.includes('.') && u.hostname !== 'localhost' && !/^\[.*\]$/.test(u.hostname)) return null;
    return u.href;
  } catch { return null; }
}

/** A render/capture-*.js file without its leading // comment lines: one function expression. */
export function pageJs(name) {
  const lines = fs.readFileSync(path.join(SKILL_DIR, 'render', name), 'utf8').split('\n');
  while (lines.length && lines[0].startsWith('//')) lines.shift();
  return lines.join('\n').trim();
}

/** site.json — the same fields render/capture.py writes. */
function writeSite(dir, url, info, finalUrl, shots, via) {
  const site = {
    url, finalUrl: finalUrl || url, title: info.title || '', description: info.description || '',
    ogImage: info.ogImage ?? null, themeColor: info.themeColor ?? null, headings: info.headings || [], links: info.links || [],
    colors: info.colors || [], background: info.background ?? null, logo: info.logo ?? null, icon: info.icon ?? null,
    screenshots: shots.map((n) => `assets/${n}`), via, capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'site.json'), JSON.stringify(site, null, 2) + '\n');
  return site;
}

// ── 1. the app's browser (under a board) ──
/** → result, or null when this app has no /api/site-capture (an older GreenLight Dash). */
export async function captureViaApp(B, dir, url, { timeout = 30 } = {}) {
  let res;
  try {
    res = await B.call('POST', '/api/site-capture', { url, timeout, extract_js: pageJs('capture-extract.js'), ready_js: pageJs('capture-ready.js') },
      {}, { timeout: (timeout * 3 + 60) * 1000 });
  } catch (e) {
    if (/→ (404|405) /.test(String(e.message))) return null;
    return { ok: false, error: String(e.message || e).slice(0, 600) };
  }
  if (!res || !res.ok) return { ok: false, error: (res && res.error) || 'the app could not capture the page' };
  const assets = path.join(dir, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  const names = [];
  for (const s of res.screenshots || []) {
    if (!SHOTS.includes(s.name)) continue;
    fs.writeFileSync(path.join(assets, s.name), Buffer.from(s.png, 'base64'));
    names.push(s.name);
  }
  // a page that got shorter leaves no stale screenshot behind
  for (const n of SHOTS.slice(1, 3)) if (!names.includes(n)) fs.rmSync(path.join(assets, n), { force: true });
  names.sort((a, b) => SHOTS.indexOf(a) - SHOTS.indexOf(b));
  const site = writeSite(dir, url, res.info || {}, res.final_url, names, 'app');
  return { ok: true, via: 'app', site: 'site.json', screenshots: site.screenshots, title: site.title, warnings: res.warnings || [] };
}

// ── 2. the render engine's browser (Python + Playwright) ──
/** Run render/capture.py → its result ({ ok, site, screenshots, … } or { ok: false, error }). */
export function captureSite(dir, url, { python, timeout = 30, onLog } = {}) {
  return new Promise((resolve) => {
    const py = python || findPython();
    if (!py) return resolve({ ok: false, error: `no Python with Playwright: ${INSTALL}` });
    fs.mkdirSync(dir, { recursive: true });
    const p = spawn(py, [path.join(SKILL_DIR, 'render/capture.py'), '--url', url, '--out', dir, '--timeout', String(timeout)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; if (onLog) onLog(String(d)); });
    p.on('error', (e) => resolve({ ok: false, error: `could not start ${py}: ${e.message}` }));
    p.on('close', (code) => {
      const line = out.trim().split('\n').filter(Boolean).pop();
      try { return resolve({ via: 'browser', ...JSON.parse(line) }); } catch { /* not JSON: report stderr */ }
      resolve({ ok: false, error: `capture failed (${code}): ${(err || out).trim().split('\n').slice(-3).join(' | ').slice(0, 600)}` });
    });
  });
}

// ── 3. no browser: the HTML alone ──
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decode = (s) => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(n); } catch { return m; } }
  return ENT[e.toLowerCase()] ?? m;
});
const clean = (s) => decode(String(s || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim().replace(/^(.{3,}?) \1$/, '$1');
const short = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n) > n * 0.6 ? s.lastIndexOf(' ', n) : n).replace(/[\s,;:–—-]+$/, '') + '…');
const attr = (tag, name) => { const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag); return m ? decode(m[1] ?? m[2] ?? m[3]) : null; };
const hex6 = (s) => { const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(s || '').trim()); if (!m) return null; const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1]; return '#' + h.toUpperCase(); };
const rgbOf = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });
const isGrey = ({ r, g, b }) => Math.max(r, g, b) - Math.min(r, g, b) < 24;

/** site.json from the page's HTML (and its first stylesheets, for colours): no screenshots. */
export async function captureHtml(dir, url, { timeout = 30 } = {}) {
  const get = (u, ms) => fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36', Accept: 'text/html,text/css,*/*' } });
  let r;
  try { r = await get(url, timeout * 1000); } catch (e) {
    const why = e.name === 'TimeoutError' ? 'no answer in time' : (e.cause && (e.cause.code || e.cause.message)) || e.message;
    return { ok: false, error: `${url}: ${why}` };
  }
  if (r.status >= 400) return { ok: false, error: `${url} answered HTTP ${r.status}` };
  const finalUrl = r.url || url;
  const raw = (await r.text()).slice(0, 4e6);
  const abs = (u) => { if (!u) return null; try { return new URL(u, finalUrl).href; } catch { return null; } };
  const html = raw.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|noscript|template)\b[\s\S]*?<\/\1>/gi, '');
  const metas = {};
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) { const k = (attr(tag, 'name') || attr(tag, 'property') || '').toLowerCase(); if (k && !(k in metas)) metas[k] = attr(tag, 'content'); }
  const meta = (...ks) => { for (const k of ks) if (metas[k]) return clean(metas[k]); return ''; };
  const info = {};
  info.title = clean((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]) || meta('og:title');
  info.description = meta('description', 'og:description', 'twitter:description');
  info.ogImage = abs(meta('og:image', 'og:image:url', 'twitter:image'));
  info.themeColor = meta('theme-color') || null;
  const body = html.replace(/<(style|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  // headings: every h1, then h2s — up to 12, trimmed, no repeats
  const heads = []; const seenH = new Set();
  for (const lv of ['1', '2']) for (const m of body.matchAll(new RegExp(`<h${lv}\\b[^>]*>([\\s\\S]*?)<\\/h${lv}>`, 'gi'))) {
    const t = short(clean(m[1]), 140);
    if (heads.length < 12 && t && !seenH.has(t.toLowerCase())) { seenH.add(t.toLowerCase()); heads.push(t); }
  }
  info.headings = heads;
  // navigation link texts (nav, then the header)
  const links = []; const seenL = new Set();
  for (const m of body.matchAll(/<(nav|header)\b[^>]*>([\s\S]*?)<\/\1>/gi)) for (const a of m[2].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const t = clean(a[1]);
    if (links.length < 12 && t && t.length <= 40 && !seenL.has(t.toLowerCase())) { seenL.add(t.toLowerCase()); links.push(t); }
  }
  info.links = links;
  // icons: the apple-touch-icon, else the largest icon
  let touch = null; let icon = null; let iconSize = -1;
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = (attr(tag, 'rel') || '').toLowerCase(); const href = attr(tag, 'href');
    if (!href) continue;
    if (/apple-touch-icon/.test(rel) && !touch) touch = href;
    else if (/(^|\s)icon(\s|$)/.test(rel)) { const sz = parseInt((attr(tag, 'sizes') || '0').split('x')[0], 10) || 0; if (sz > iconSize) { iconSize = sz; icon = href; } }
  }
  info.icon = abs(touch) || abs(icon) || null;
  // logo: an <img> named "logo" / "wordmark" (class, id, alt, src), the header's first
  const logoIn = (s) => { for (const [tag] of s.matchAll(/<img\b[^>]*>/gi)) if (/logo|wordmark/i.test([attr(tag, 'class'), attr(tag, 'id'), attr(tag, 'alt'), attr(tag, 'src')].join(' '))) return abs(attr(tag, 'src')); return null; };
  info.logo = logoIn((/<header\b[\s\S]*?<\/header>/i.exec(html) || [''])[0]) || logoIn(html) || info.icon;
  // colours: the most used non-grey colours in the page's CSS (inline <style> + its first stylesheets)
  let css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n') + '\n' + [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(';');
  const sheets = [...html.matchAll(/<link\b[^>]*>/gi)].map(([t]) => t).filter((t) => /stylesheet/i.test(attr(t, 'rel') || '')).map((t) => abs(attr(t, 'href'))).filter(Boolean).slice(0, 3);
  for (const s of sheets) { try { const c = await get(s, 8000); if (c.ok) css += '\n' + (await c.text()).slice(0, 1.5e6); } catch { /* a stylesheet that doesn't answer adds no colours */ } }
  const tally = new Map();
  const add = (h, w = 1) => { const k = hex6(h); if (k) tally.set(k, (tally.get(k) || 0) + w); };
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) add(m[0]);
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) add('#' + [m[1], m[2], m[3]].map((v) => Math.min(255, +v).toString(16).padStart(2, '0')).join(''));
  if (info.themeColor) add(info.themeColor, 25);
  const merged = [];
  for (const [k, w] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    const c = rgbOf(k); if (isGrey(c)) continue;
    const near = merged.find((m) => Math.hypot(m.c.r - c.r, m.c.g - c.g, m.c.b - c.b) < 30);
    if (near) near.w += w; else merged.push({ k, c, w });
  }
  info.colors = merged.sort((a, b) => b.w - a.w).slice(0, 6).map((m) => m.k);
  const bg = /(?:^|[}\s,])(?:html|body)\s*\{[^}]*?background(?:-color)?\s*:\s*(#[0-9a-f]{3,6}\b)/i.exec(css);
  info.background = bg ? hex6(bg[1]) : null;
  const site = writeSite(dir, url, info, finalUrl, [], 'html');
  return { ok: true, via: 'html', site: 'site.json', screenshots: [], title: site.title,
    warnings: [`no screenshots: no browser here (${INSTALL}) — site.json was read from the page's HTML`] };
}

/** The best capture available: the app (B), else Python + Playwright, else the HTML alone. */
export async function capture(dir, url, { B = null, python = null, timeout = 30, onLog } = {}) {
  if (B) {
    const res = await captureViaApp(B, dir, url, { timeout });
    if (res) return res;
  }
  const py = python || findPython();
  if (py) {
    const res = await captureSite(dir, url, { python: py, timeout, onLog });
    if (res.ok) return res;
    // the browser itself may be what failed (no Chromium, no Chrome): the HTML may still answer
    const h = await captureHtml(dir, url, { timeout });
    return h.ok ? { ...h, warnings: [`the browser capture failed: ${res.error}`, ...h.warnings] } : res;
  }
  return captureHtml(dir, url, { timeout });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const VALUE = ['--url', '--python', '--timeout', '--board', '--api'];
  const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1])));
  const done = (res) => { console.log(JSON.stringify(res)); process.exit(res.ok ? 0 : 1); };
  if (!dir) done({ ok: false, error: 'usage: node tools/capture.mjs <project> --url <url> [--timeout 30] [--python <path>] [--standalone]' });
  const raw = arg(argv, 'url');
  if (!raw) done({ ok: false, error: '--url is missing' });
  const url = normalizeUrl(raw);
  if (!url) done({ ok: false, error: `not a web address: ${raw}` });
  const B = await board(argv);
  const res = await capture(path.resolve(dir), url, { B, python: arg(argv, 'python') ? findPython(argv) : null, timeout: Number(arg(argv, 'timeout', 30)) || 30, onLog: (s) => process.stderr.write(s) });
  // under a board: the screenshots at full size in the film pipeline's Capture lane
  if (B && res.ok) {
    try {
      const project = loadProject(path.resolve(dir), { optional: true });
      const state = boardState(project, B.id);
      const shots = (res.screenshots || []).map((s) => path.join(path.resolve(dir), s));
      const desk = shots.filter((f) => /site-desktop-/.test(f)); const phone = shots.find((f) => /site-phone-/.test(f));
      const list = [...desk.map((f, i) => ({ file: f, x: 0, y: i * 466, w: 720, h: 450 })), ...(phone ? [{ file: phone, x: desk.length ? 744 : 0, y: 0, w: 390, h: 844 }] : [])];
      if (list.length) await showPictures(B, project, state, 'capture', list);
      else { await ensurePipeline(B, project, state); await setStep(B, state, 'capture', { status: 'finished' }); }
    } catch (e) { (res.warnings = res.warnings || []).push(`the pipeline was not updated: ${String(e.message || e).slice(0, 200)}`); }
  }
  for (const w of res.warnings || []) console.warn('! ' + w);
  done(res.ok ? { ok: true, via: res.via, site: res.site, screenshots: res.screenshots, title: res.title, warnings: res.warnings || [] } : { ok: false, error: res.error });
}
