// The preview with working buttons, for standalone use: serves the project folder and runs the render
// engine and the exports when the preview's Render / Export are pressed.
//   node tools/serve.mjs <project> [--port 4817] [--python /path/to/python3]
// Open the printed URL. The page is rebuilt on every load, so edit scenario.json or a scene page and reload. The
// preview's edits (the film's colours and font, every element changed on a scene) are saved into scenario.json → edits;
// a picture chosen there goes to assets/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, MIME, arg, saveEdits, sha1, isQuick } from './project.mjs';
import { previewPage } from './build.mjs';
import { renderLocal, findPython } from './render.mjs';
import { exportLocal } from './export.mjs';

const argv = process.argv.slice(2);
const dir = path.resolve(argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--port', '--python'].includes(argv[i - 1]))) || '.');
const port = Number(arg(argv, 'port', 4817));
const python = findPython(argv);
let jobs = 0;

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (d) => { b += d; }); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
// fresh on every request: the agent edits scenario.json and the scene pages while the page is open
const fresh = () => loadProject(dir);
const rel = (f) => '/' + path.relative(dir, f).split(path.sep).map(encodeURIComponent).join('/');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/preview.html')) {
      // quick mode: the page saves the user's edits here, but Render / Export are the agent's (after the approval)
      return send(res, 200, previewPage(fresh(), { target: 'local', mode: { kind: 'local', agent: isQuick(dir) } }), 'text/html; charset=utf-8');
    }
    // the user's edits from the preview → scenario.json → edits (null clears them)
    if (req.method === 'POST' && url.pathname === '/mu/edits') {
      const body = await readBody(req);
      const { changed } = saveEdits(fresh(), body.edits || null);
      return send(res, 200, { ok: true, changed });
    }
    // a picture chosen in the preview: saved once into assets/, its project path back
    if (req.method === 'POST' && url.pathname === '/mu/upload') {
      const chunks = []; for await (const c of req) chunks.push(c);
      const data = Buffer.concat(chunks);
      const ext = (path.extname(url.searchParams.get('name') || '').toLowerCase().match(/^\.(png|jpe?g|webp|gif|svg)$/) || ['.png'])[0];
      const rel = `assets/edit-${sha1(data).slice(0, 10)}${ext}`;
      fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), data);
      return send(res, 200, { path: rel });
    }
    if (req.method === 'POST' && url.pathname === '/mu/render') {
      const body = await readBody(req);
      if (jobs) return send(res, 409, { detail: 'A render is already running.' });
      jobs++;
      try {
        const out = await renderLocal(fresh(), { format: body.format || 'mp4', motionBlur: body.motionBlur ? 4 : 1, python, onLog: (s) => process.stderr.write(s) });
        return send(res, 200, { file: path.relative(dir, out.file), url: rel(out.file), audio: out.audio });
      } finally { jobs--; }
    }
    if (req.method === 'POST' && url.pathname === '/mu/export') {
      const body = await readBody(req);
      const out = await exportLocal(fresh(), body.format || 'glea');
      return send(res, 200, { file: path.relative(dir, out.file), url: rel(out.file), hint: out.hint,
        ...(out.prompt ? { prompt: path.relative(dir, out.prompt), notice: out.notice } : {}) });
    }
    if (req.method === 'GET') {
      const f = path.resolve(dir, decodeURIComponent(url.pathname.slice(1)));
      if (!f.startsWith(dir + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, { detail: 'not found' });
      const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
      const stat = fs.statSync(f);
      // media seek (voice-over <audio>, rendered <video>) needs ranges
      const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
      if (range) {
        const a = range[1] ? +range[1] : 0; const b = range[2] ? Math.min(+range[2], stat.size - 1) : stat.size - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1 });
        return fs.createReadStream(f, { start: a, end: b }).pipe(res);
      }
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Accept-Ranges': 'bytes' });
      return fs.createReadStream(f).pipe(res);
    }
    send(res, 405, { detail: 'method not allowed' });
  } catch (err) {
    send(res, 500, { detail: String(err.message || err) });
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`GL Motion preview: http://127.0.0.1:${port}/`);
  if (!python) console.log('! no Python with Playwright found — Render will fail until you install it (render/README.md) or pass --python');
});
