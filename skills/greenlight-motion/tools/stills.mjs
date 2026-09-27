// Review sheets: frames of an item, a scene or the whole film side by side in one PNG — look at them.
//   node tools/stills.mjs <project> --item <id>  [--t 0.4,1.2,2 | --n 6] [--theme dark] [--w 480] [--out sheet.png]
//   node tools/stills.mjs <project> --scene <n>  […]
//   node tools/stills.mjs <project> --film       […]
// Items are drawn on their theme's canvas colour; --w is each frame's width in the sheet (text needs
// 480 or more to judge). Default out: <project>/stills/<what>.png. Under a GreenLight Dash board the app
// records the frames (POST /api/html/stills: nothing to install); standalone, the render engine (Python +
// Playwright) does. The sheet is put together with ffmpeg (the app's own, in its agent terminal).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SKILL_DIR } from './kit.mjs';
import { loadProject, sources, arg, board, mapImages, isUrl, dataUri } from './project.mjs';
import { filmPage } from './build.mjs';
import { findPython } from './render.mjs';

const argv = process.argv.slice(2);
const VALUE = ['--item', '--scene', '--t', '--n', '--theme', '--w', '--out', '--python', '--board', '--api'];
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1]))) || '.';
const project = loadProject(dir, { optional: !!(arg(argv, 'item')) });
const { K, MU, scenario } = project;
const theme = arg(argv, 'theme', scenario.theme);
const W = scenario.size.w; const H = scenario.size.h;

// map: where the page finds the project's pictures (relative to the project, or inlined for the app)
let T; let name; let pageFor;
const src = sources(project);
if (arg(argv, 'item')) {
  const spec = K.elements.find((e) => e.id === arg(argv, 'item'));
  if (!spec) throw new Error(`unknown item "${arg(argv, 'item')}"`);
  pageFor = () => K.toHTML(spec, { theme, accent: scenario.accent, background: K.THEMES[theme].bg,
    sources: { easings: src.easings, engine: src.engine, file: src.files[spec.file] } });
  T = spec.T; name = spec.id;
} else if (arg(argv, 'scene')) {
  const i = Number(arg(argv, 'scene')) - 1;
  const sc = Object.assign({}, scenario, { theme });
  pageFor = (map) => MU.pageHtml(mapImages(sc, map), src, { scene: i }).replace('</style>', `html, body { background: ${sc.background || K.THEMES[theme].bg}; }</style>`);
  T = MU.timing(sc)[i].to - MU.timing(sc)[i].from; name = `scene-${i + 1}`;
} else {
  pageFor = (map) => filmPage(project, { map }); T = MU.timing(scenario).at(-1).end; name = scenario.id;
}
const n = Number(arg(argv, 'n', 6));
const times = arg(argv, 't') ? String(arg(argv, 't')).split(',').map(Number) : Array.from({ length: n }, (_, k) => +((T * (k + 1)) / n - 0.001).toFixed(3));
const page = path.join(project.dir, `.stills-${name}.html`);   // next to the project, so its pictures resolve
const tmp = path.join(project.dir, '.stills-tmp');
fs.rmSync(tmp, { recursive: true, force: true });
const B = await board(argv);
try {
  let errors = [];
  if (B) {
    // the app records the page away from the project: one self-contained page, its pictures inlined
    const inline = (p) => (isUrl(p) || !fs.existsSync(path.join(project.dir, p)) ? p : dataUri(path.join(project.dir, p)));
    const res = await B.call('POST', '/api/html/stills', { html: pageFor(inline), width: W, height: H, fps: 60, times }, {}, { timeout: 600000 });
    fs.mkdirSync(tmp, { recursive: true });
    res.frames.forEach((f, k) => fs.writeFileSync(path.join(tmp, `still-${String(k).padStart(3, '0')}.png`), Buffer.from(f.png, 'base64')));
  } else {
    fs.writeFileSync(page, pageFor((p) => p));
    const py = findPython(argv);
    if (!py) throw new Error('no Python with Playwright: stills need it outside GreenLight Dash (node tools/doctor.mjs says what to install)');
    const r = spawnSync(py, [path.join(SKILL_DIR, 'render/render.py'), page, '--out', tmp, '--width', String(W), '--height', String(H), '--stills', times.join(',')], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr.slice(-1500));
    errors = (r.stderr.match(/pageerror:.*/g) || []);
  }
  const frames = fs.readdirSync(tmp).filter((f) => f.endsWith('.png')).sort();
  const w = Number(arg(argv, 'w', 480));
  const out = path.resolve(arg(argv, 'out', path.join(project.dir, 'stills', `${name}.png`)));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const cols = Math.min(frames.length, 3);
  const rows = Math.ceil(frames.length / cols);
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...frames.flatMap((f) => ['-i', path.join(tmp, f)]),
    // one frame: no tiling (xstack needs two inputs or more)
    '-filter_complex', frames.length === 1 ? `[0:v]scale=${w}:-2,pad=iw+8:ih+8:4:4:color=0x121211`
      : `${frames.map((_, i) => `[${i}:v]scale=${w}:-2,pad=iw+8:ih+8:4:4:color=0x121211[f${i}]`).join(';')};${frames.map((_, i) => `[f${i}]`).join('')}xstack=inputs=${frames.length}:layout=${frames.map((_, i) => `${(i % cols) ? Array.from({ length: i % cols }, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, () => 'h0').join('+') : '0'}`).join('|')}:fill=0x121211`,
    '-frames:v', '1', out], { encoding: 'utf8' });
  if (ff.error) throw new Error('no ffmpeg: the sheet needs it (node tools/doctor.mjs says how to install it)');
  if (ff.status !== 0) throw new Error(ff.stderr);
  console.log(JSON.stringify({ ok: true, mode: B ? 'board' : 'standalone', sheet: out, times, frames: frames.length, rows, pageErrors: errors }));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(page, { force: true });
}
