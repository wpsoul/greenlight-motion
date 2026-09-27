// Render the film to video with the render engine (render/render.py — GreenLight Dash's own HTML→video
// engine), with its soundtrack: the voice-over and the sound effects (scenario.sfx), the effects ducked
// under the voice, loudness-normalised (tools/audio.mjs).
//   node tools/render.mjs <project> [--format mp4|webm-alpha|mov] [--motion-blur 4] [--out file]
//                        [--python /path/to/python3] [--standalone] [--board <id>]
//   node tools/render.mjs <project> --remix [--format …] [--out file]   the soundtrack again onto an existing
//                        render (after a voice-over or sound-effect change): the picture is not recorded again
// Standalone → <project>/renders/<id>-<format>.<ext> (needs Python 3 with Playwright, and ffmpeg).
// Under a board → the app renders it (POST /api/html/render) and the video is placed in the film pipeline's
// Final film node (Render & export lists it); with a voice-over or sound effects and ffmpeg on this machine,
// the mixed file is placed.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SKILL_DIR } from './kit.mjs';
import { loadProject, board, boardState, arg, pullEdits } from './project.mjs';
import { filmPage, boardAssets } from './build.mjs';
import { mixTrack, muxAudio } from './audio.mjs';
import { ensurePipeline, approveBefore, setStep, finalSpot, showFinal, addOutput } from './pipeline.mjs';

const EXT = { mp4: 'mp4', webm: 'webm', 'webm-alpha': 'webm', mov: 'mov' };
const which = (bin) => { const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { encoding: 'utf8' }); return r.status === 0 ? r.stdout.split('\n')[0].trim() : null; };

/** Where the README's setup puts the render engine's Python (a venv with Playwright). */
export const VENV_PYTHON = path.join(os.homedir(), '.greenlight-motion', 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
/** A Python that can import playwright: --python, GL_MOTION_PYTHON, the setup's venv, then python3 / python
 *  (and py on Windows). */
export function findPython(argv = []) {
  const tries = [arg(argv, 'python'), process.env.GL_MOTION_PYTHON, VENV_PYTHON, 'python3', 'python', ...(process.platform === 'win32' ? ['py'] : [])].filter(Boolean);
  for (const py of tries) {
    const r = spawnSync(py, ['-c', 'import playwright'], { encoding: 'utf8' });
    if (r.status === 0) return py;
  }
  return null;
}

/** Record one page with the render engine (render/render.py) → the file. audio = [[file, seconds], …] */
export function renderPage(page, file, { width, height, fps, duration, format = 'mp4', motionBlur = 1, audio = [], python, onLog } = {}) {
  const py = python || findPython();
  if (!py) throw new Error('no Python with Playwright: pip install -r render/requirements.txt && python3 -m playwright install chromium (or pass --python)');
  if (!which('ffmpeg')) throw new Error('ffmpeg is not on PATH — install it (brew install ffmpeg / apt install ffmpeg)');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const args = [path.join(SKILL_DIR, 'render/render.py'), page, '--out', file, '--width', String(width), '--height', String(height),
    '--fps', String(fps), '--duration', String(duration), '--format', format, '--motion-blur', String(Math.max(1, motionBlur | 0))];
  for (const [f, at] of audio) args.push('--audio', `${f}@${at || 0}`);
  return new Promise((resolve, reject) => {
    const p = spawn(py, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; if (onLog) onLog(String(d)); });
    p.on('close', (code) => (code === 0 && fs.existsSync(file) ? resolve(file) : reject(new Error(`render failed (${code}): ${err.slice(-1500)}`))));
  });
}

/** Standalone render → { file, audio } */
export async function renderLocal(project, { format = 'mp4', motionBlur = 1, out, python, onLog } = {}) {
  const { scenario, dir } = project;
  const film = path.join(dir, 'film.html');
  fs.writeFileSync(film, filmPage(project, { transparent: format === 'webm-alpha' || format === 'mov' }));
  const file = out ? path.resolve(out) : path.join(dir, 'renders', `${scenario.id}-${format}.${EXT[format] || 'mp4'}`);
  const T = project.MU.timing(scenario).at(-1).end;
  await renderPage(film, file, { width: scenario.size.w, height: scenario.size.h, fps: scenario.fps, duration: T, format, motionBlur, python, onLog });
  // the soundtrack: voice-over + sound effects, mixed and muxed onto the picture
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'greenlight-motion-'));
  let sound = null;
  try {
    sound = mixTrack(project, { T, out: path.join(tmp, 'mix.wav') });
    if (sound) { const muxed = path.join(tmp, 'film.' + (EXT[format] || 'mp4')); muxAudio(file, sound.file, muxed, format); fs.copyFileSync(muxed, file); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  return { file, audio: !!sound, ...(sound ? { voice: sound.voice, sfx: sound.sfx } : {}), frames: Math.round(T * scenario.fps) };
}

/** The soundtrack mixed again onto an existing render (its picture kept, its old sound replaced). */
export function remixLocal(project, { format = 'mp4', out } = {}) {
  const { scenario, dir } = project;
  const file = out ? path.resolve(out) : path.join(dir, 'renders', `${scenario.id}-${format}.${EXT[format] || 'mp4'}`);
  if (!fs.existsSync(file)) throw new Error(`--remix: no render at ${file} — render the film first`);
  const T = project.MU.timing(scenario).at(-1).end;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'greenlight-motion-'));
  try {
    const sound = mixTrack(project, { T, out: path.join(tmp, 'mix.wav') });
    if (!sound) throw new Error('--remix: the film has no voice-over or sound effects');
    const muxed = path.join(tmp, 'film.' + (EXT[format] || 'mp4')); muxAudio(file, sound.file, muxed, format); fs.copyFileSync(muxed, file);
    return { file, audio: true, voice: sound.voice, sfx: sound.sfx, remixed: true };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

/** Under a board → { url, placed, mixed? } */
export async function renderBoard(project, B, { format = 'mp4', motionBlur = 1 } = {}) {
  const { scenario, MU } = project;
  const state = boardState(project, B.id);
  // the pipeline: the preview is approved, Render & export is working
  const pl = await ensurePipeline(B, project, state);
  await approveBefore(B, state, 'render');
  await setStep(B, state, 'render', { status: 'in_progress' });
  const A = await boardAssets(B, project, state);
  const T = MU.timing(scenario).at(-1).end;
  // the app writes the page into the board folder before recording it: pictures relative to that folder
  const html = filmPage(project, { map: A.map, transparent: format === 'webm-alpha' || format === 'mov' });
  const out = await B.call('POST', '/api/html/render', { html, width: scenario.size.w, height: scenario.size.h, fps: scenario.fps, duration: T,
    format, motion_blur: Math.max(1, motionBlur | 0), board_id: B.id, title: scenario.name });
  let url = out.url; let mixed = false;
  if (which('ffmpeg')) {
    // the soundtrack is mixed here: fetch the app's render, mix voice-over + sound effects, upload the result
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'greenlight-motion-'));
    try {
      const sound = mixTrack(project, { T, out: path.join(tmp, 'mix.wav') });
      if (sound) {
        const src = path.join(tmp, 'render.' + EXT[format]); const dst = path.join(tmp, `${scenario.id}-sound.${EXT[format]}`);
        const r = await fetch(B.api + out.url, { headers: B.headers });
        fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
        muxAudio(src, sound.file, dst, format);
        const up = await B.upload(path.basename(dst), fs.readFileSync(dst), A.folder);
        url = up.url; mixed = true;
      }
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  // the film in the pipeline's Final film node; Render & export lists it
  let placed = false;
  const ratio = scenario.size.w / scenario.size.h;
  const spot = pl ? await finalSpot(B, state, ratio) : null;
  try {
    const el = await B.call('POST', `/api/moodboards/${B.id}/media/place`, { url, title: `${scenario.name} · render`, ...(spot ? { x: spot.x, y: spot.y, width: spot.w, height: spot.h } : {}) });
    placed = true;
    if (pl) await showFinal(B, state, (el.element || el).id, ratio);
  } catch { placed = false; }
  if (pl) await addOutput(B, state, `Rendered: ${format === 'mov' ? 'ProRes 4444' : format === 'webm-alpha' ? 'WebM alpha' : 'MP4'}${mixed ? ' with the soundtrack' : ''}`);
  return { url, placed, mixed, frames: Math.round(T * scenario.fps) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--board', '--api', '--format', '--motion-blur', '--out', '--python'].includes(argv[i - 1]))) || '.';
  let project = loadProject(dir);
  const opts = { format: arg(argv, 'format', 'mp4'), motionBlur: Number(arg(argv, 'motion-blur', 1)), out: arg(argv, 'out') };
  const B = argv.includes('--remix') ? null : await board(argv);
  // the user's edits saved on the preview card are the film's (scenario.json → edits) before it renders
  if (B) ({ project } = await pullEdits(B, project));
  for (const p of project.problems) console.warn('! ' + p);
  const res = argv.includes('--remix') ? remixLocal(project, opts)
    : B ? await renderBoard(project, B, opts) : await renderLocal(project, { ...opts, python: findPython(argv), onLog: (s) => process.stderr.write(s) });
  console.log(JSON.stringify({ ok: true, mode: B ? 'board' : 'standalone', ...res }));
}
