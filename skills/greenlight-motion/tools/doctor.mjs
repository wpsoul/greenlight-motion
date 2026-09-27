// What this machine can do with the skill, and exactly what to install for the rest. Run it once before
// the first capture, still or render. Never hunt the disk for a Python or install anything yourself:
// tell the user what doctor says.
//   node tools/doctor.mjs [--json | --text] [--python /path/to/python3] [--standalone]
// A terminal gets text, an agent (no TTY) one JSON line:
//   { ok, mode: 'board'|'standalone', node, python, browser, ffmpeg, ffprobe,
//     can: { preview, exports, capture: 'screenshots'|'text', stills, render, voiceover, sfx },
//     missing: [{ what, why, install: { macos, windows, linux }, link }] }
// Under a GreenLight Dash board the app captures, takes stills and renders (its own browser and ffmpeg):
// nothing is missing there.
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKILL_DIR } from './kit.mjs';
import { board } from './project.mjs';
import { findPython, VENV_PYTHON } from './render.mjs';

const run = (bin, args, opts = {}) => spawnSync(bin, args, { encoding: 'utf8', timeout: 60000, ...opts });
const firstLine = (s) => String(s || '').trim().split('\n')[0];

/** Every install step, per system, with the page that explains it. */
export function installSteps() {
  const req = path.join(SKILL_DIR, 'render', 'requirements.txt');
  const venv = path.dirname(path.dirname(VENV_PYTHON));
  return {
    python: {
      what: 'Python 3.9+ with Playwright',
      why: 'site screenshots, review stills and renders outside GreenLight Dash (the render engine)',
      install: {
        macos: `python3 -m venv ${venv} && ${venv}/bin/pip install -r "${req}" && ${venv}/bin/python -m playwright install chromium`,
        // PowerShell (Windows Terminal's default): ; not && (PowerShell 5.1), & to run a quoted path
        windows: `py -m venv "$HOME\\.greenlight-motion\\venv"; & "$HOME\\.greenlight-motion\\venv\\Scripts\\pip.exe" install -r "${req}"; & "$HOME\\.greenlight-motion\\venv\\Scripts\\python.exe" -m playwright install chromium`,
        linux: `python3 -m venv ${venv} && ${venv}/bin/pip install -r "${req}" && ${venv}/bin/python -m playwright install --with-deps chromium`,
      },
      link: 'https://www.python.org/downloads/ · https://playwright.dev/python/docs/intro',
      note: {
        macos: 'No Python yet? `brew install python` (Homebrew: https://brew.sh) or the installer from python.org. The tools find the venv by themselves.',
        windows: 'No Python yet? `winget install Python.Python.3.12`, or the installer from python.org (tick "Add python.exe to PATH"). The tools find the venv by themselves.',
        linux: 'No Python yet? `sudo apt install python3 python3-venv` (or your distribution\'s packages). The tools find the venv by themselves.',
      },
    },
    ffmpeg: {
      what: 'ffmpeg (with ffprobe)',
      why: 'encoding renders, mixing the voice-over and sound effects, review sheets',
      install: { macos: 'brew install ffmpeg', windows: 'winget install Gyan.FFmpeg', linux: 'sudo apt install ffmpeg' },
      link: 'https://ffmpeg.org/download.html',
      note: {
        macos: 'Homebrew first, if you have none: https://brew.sh',
        windows: 'Open a new terminal afterwards, so ffmpeg is on PATH. Or download a build from https://www.gyan.dev/ffmpeg/builds/ and add its bin folder to PATH.',
        linux: 'Or your distribution\'s ffmpeg package.',
      },
    },
  };
}

export async function doctor(argv = []) {
  const B = await board(argv);
  const node = process.versions.node;
  const nodeOk = Number(node.split('.')[0]) >= 18;
  const py = findPython(argv);
  let browser = null;
  if (py) {
    // the render engine's own browser discovery (Playwright's Chromium, else Chrome / Edge)
    const code = `import asyncio, sys\nsys.path.insert(0, ${JSON.stringify(path.join(SKILL_DIR, 'render'))})\nfrom render import launch\nfrom playwright.async_api import async_playwright\nasync def m():\n    async with async_playwright() as p:\n        b = await launch(p)\n        print(b.version)\n        await b.close()\nasyncio.run(m())`;
    const r = run(py, ['-c', code]);
    if (r.status === 0) browser = firstLine(r.stdout) || 'yes';
  }
  const ver = (bin) => { const r = run(bin, ['-version']); return r.status === 0 ? (firstLine(r.stdout).match(/version (\S+)/) || [, 'yes'])[1] : null; };
  const ffmpeg = ver('ffmpeg'); const ffprobe = ver('ffprobe');
  const engine = !!(py && browser);
  const boardMode = !!B;
  const can = {
    preview: nodeOk, exports: nodeOk,
    capture: boardMode || engine ? 'screenshots' : 'text',
    stills: (boardMode || engine) && !!ffmpeg,
    render: boardMode || (engine && !!ffmpeg),
    voiceover: !!(ffmpeg && ffprobe),
    sfx: !!ffmpeg,
  };
  const steps = installSteps();
  const missing = [];
  if (!nodeOk) missing.push({ what: 'Node.js 18+', why: 'every tool', install: { macos: 'brew install node', windows: 'winget install OpenJS.NodeJS.LTS', linux: 'https://nodejs.org/en/download/package-manager' }, link: 'https://nodejs.org/' });
  if (!boardMode && !engine) {
    missing.push({ ...steps.python, found: py ? `${py} imports Playwright, but no browser starts (run its "playwright install chromium", or install Chrome)` : 'no Python that imports Playwright' });
  }
  if (!ffmpeg || !ffprobe) missing.push({ ...steps.ffmpeg, found: ffmpeg ? 'ffmpeg without ffprobe' : 'no ffmpeg on PATH' });
  return { ok: missing.length === 0, mode: boardMode ? 'board' : 'standalone', ...(B ? { board: B.id } : {}), node, python: py, browser, ffmpeg, ffprobe, can, missing };
}

const OS = process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux';

function text(d) {
  const y = (v) => (v ? '✓' : '✗');
  const L = [`GL Motion · ${d.mode === 'board' ? `under a GreenLight Dash board (${d.board}): the app captures, takes stills and renders` : 'standalone'}`, ''];
  L.push(`${y(true)} Node ${d.node}`);
  if (d.mode !== 'board') L.push(`${y(d.python && d.browser)} Python + Playwright${d.python ? ` (${d.python}${d.browser ? `, browser ${d.browser}` : ', no browser starts'})` : ': not found'}`);
  L.push(`${y(d.ffmpeg && d.ffprobe)} ffmpeg${d.ffmpeg ? ` ${d.ffmpeg}` : ': not found'}${d.ffmpeg && !d.ffprobe ? ' (no ffprobe)' : ''}`);
  L.push('', 'What works:',
    `  scenario, gallery, storyboard, preview, Video Editor + After Effects exports  ${y(d.can.preview)}`,
    `  website capture  ${d.can.capture === 'screenshots' ? '✓ with screenshots' : '~ text only (no screenshots)'}`,
    `  review stills  ${y(d.can.stills)}`, `  render MP4 / WebM / ProRes  ${y(d.can.render)}`,
    `  voice-over and sound effects  ${y(d.can.voiceover && d.can.sfx)}`);
  for (const m of d.missing) {
    L.push('', `To add: ${m.what} — for ${m.why}.${m.found ? ` (${m.found})` : ''}`);
    L.push(`  ${m.install[OS]}`);
    if (m.note && m.note[OS]) L.push(`  ${m.note[OS]}`);
    L.push(`  More: ${m.link}`);
  }
  if (!d.missing.length) L.push('', 'Everything is ready.');
  return L.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const d = await doctor(argv);
  const asText = argv.includes('--text') || (!argv.includes('--json') && process.stdout.isTTY);
  console.log(asText ? text(d) : JSON.stringify(d));
  process.exit(0);
}
