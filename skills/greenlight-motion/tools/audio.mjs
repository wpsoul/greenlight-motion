// Sound for films: where the sound effects come from (the GreenLight Dash Sound Library), what each file is
// like (length, where its peak lands), and the final mix (voice-over + sound effects → one track).
// Used by tools/sfx.mjs (sound design), render.mjs (the mix), build.mjs / export.mjs (preview, exports).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { voiceClips } from './project.mjs';

export const SR = 48000;
const AUDIO = /\.(wav|mp3|m4a|aac|ogg|oga|flac|aif|aiff)$/i;

// ── the Sound Library ──
/** The app's library folders on this machine (userData/libraries): LIBRARY_DIR / GREENLIGHT_LIBRARY_DIR win. */
export function localLibraryRoots() {
  const env = [process.env.GREENLIGHT_LIBRARY_DIR, process.env.LIBRARY_DIR].filter(Boolean);
  const home = os.homedir();
  const user = process.platform === 'darwin' ? path.join(home, 'Library', 'Application Support')
    : process.platform === 'win32' ? (process.env.APPDATA || path.join(home, 'AppData', 'Roaming'))
    : (process.env.XDG_CONFIG_HOME || path.join(home, '.config'));
  const app = ['greenlight-dashboard', 'GreenLight DashBoard', 'GreenLight Dash'].map((n) => path.join(user, n, 'libraries'));
  return [...env, ...app].filter((d, i, a) => a.indexOf(d) === i);
}
const walkAudio = (root) => {
  const out = [];
  const go = (d, depth) => {
    if (depth > 7) return;
    let names = []; try { names = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of names) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) go(p, depth + 1); else if (AUDIO.test(e.name)) out.push(p);
    }
  };
  go(root, 0);
  return out;
};

/** The sounds to design with: { where, list: [{ rel, size }], local(rel) → a file path (downloaded once
 *  when it only exists on the board) }. Order: --sounds <dir>, the board's Sound Library (the API), the
 *  app's library folder on this machine. */
export async function soundLibrary({ B = null, dir = null, cacheDir = path.join(os.tmpdir(), 'greenlight-motion-sounds') } = {}) {
  if (dir) {
    const root = path.resolve(dir);
    if (!fs.existsSync(root)) throw new Error(`--sounds: no folder ${root}`);
    const list = walkAudio(root).map((f) => ({ rel: path.relative(root, f).split(path.sep).join('/'), size: fs.statSync(f).size }));
    return { where: root, kind: 'folder', list, local: async (rel) => path.join(root, rel) };
  }
  if (B) {
    const tree = await B.call('GET', '/api/libraries/sound');
    const list = [];
    const go = (n) => { for (const f of n.files || []) if (f.type === 'audio' || AUDIO.test(f.filename)) list.push({ rel: decodeURIComponent(f.url.replace(/^\/media\/lib\/sound\//, '')), size: f.size, url: f.url }); for (const c of n.folders || []) go(c); };
    go(tree);
    // the app usually runs on this machine: read its files straight from the library folder when they match
    const roots = localLibraryRoots().map((r) => path.join(r, 'sound')).filter((r) => fs.existsSync(r));
    return {
      where: `${B.api} · Sound Library`, kind: 'board', list,
      local: async (rel) => {
        for (const r of roots) { const f = path.join(r, rel); if (fs.existsSync(f)) return f; }
        const item = list.find((x) => x.rel === rel);
        const url = item ? item.url : '/media/lib/sound/' + rel.split('/').map(encodeURIComponent).join('/');
        const f = path.join(cacheDir, crypto.createHash('sha1').update(rel).digest('hex').slice(0, 16) + path.extname(rel));
        if (!fs.existsSync(f)) {
          const r = await fetch(B.api + url, { headers: B.headers });
          if (!r.ok) throw new Error(`cannot fetch ${rel} from the Sound Library (${r.status})`);
          fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
        }
        return f;
      },
    };
  }
  for (const r of localLibraryRoots()) {
    const root = path.join(r, 'sound');
    if (!fs.existsSync(root)) continue;
    const list = walkAudio(root).map((f) => ({ rel: path.relative(root, f).split(path.sep).join('/'), size: fs.statSync(f).size }));
    if (list.length) return { where: root, kind: 'folder', list, local: async (rel) => path.join(root, rel) };
  }
  return { where: null, kind: 'none', list: [], local: async () => { throw new Error('no sound library'); } };
}

/** Under a board: the Sound Library has sounds, or the Motion Design Pack is installed now (the app's own
 *  pack installer: POST /api/asset-packs/{id}/install, then its job). → { files, installed?, pack? } */
export async function ensureSoundLibrary(B, { pack = 'motion-design', log = () => {} } = {}) {
  const libs = await B.call('GET', '/api/libraries');
  const sound = (libs.libraries || []).find((l) => l.id === 'sound');
  if (sound && sound.file_count > 0) return { files: sound.file_count, installed: false };
  log(`The Sound Library is empty — installing the ${pack} pack…`);
  const { job_id: job } = await B.call('POST', `/api/asset-packs/${encodeURIComponent(pack)}/install`);
  let last = '';
  for (let i = 0; i < 1800; i++) {                     // up to an hour on a slow line
    const j = await B.call('GET', `/api/asset-packs/jobs/${job}`);
    const pct = j.total ? Math.round((j.received / j.total) * 100) : 0;
    const line = `${j.phase || j.state} ${pct}%`;
    if (line !== last) { log(`  ${line}`); last = line; }
    if (j.state === 'done' || j.state === 'complete' || j.state === 'completed' || j.state === 'installed') break;
    if (j.state === 'error' || j.state === 'cancelled' || j.cancelled) throw new Error(`installing ${pack}: ${j.error || j.state}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  const again = await B.call('GET', '/api/libraries');
  const s2 = (again.libraries || []).find((l) => l.id === 'sound');
  return { files: s2 ? s2.file_count : 0, installed: true, pack };
}

// ── what a sound file is like ──
/** Decode to 48 kHz float (stereo unless mono). */
export function decode(file, { channels = 2, rate = SR } = {}) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vn', '-ac', String(channels), '-ar', String(rate), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg cannot read ${file}: ${String(r.stderr).slice(0, 300)}`);
  return new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.byteLength / 4);
}
/** { duration, peak (s), peakDb, onset (s), end (s) } — the peak of a 20 ms RMS envelope: where a whoosh
 *  or a hit is loudest, the moment it belongs on. */
export function analyse(file) {
  const rate = 22050, x = decode(file, { channels: 1, rate });
  const n = x.length; if (!n) return { duration: 0, peak: 0, peakDb: -120, onset: 0, end: 0 };
  const win = Math.round(rate * 0.02); const env = new Float32Array(n);
  let acc = 0; const sq = (i) => x[i] * x[i];
  for (let i = 0; i < n; i++) { acc += sq(i); if (i >= win) acc -= sq(i - win); env[i] = Math.sqrt(Math.max(0, acc) / win); }
  let pk = 0, at = 0, mx = 0;
  for (let i = 0; i < n; i++) { if (env[i] > pk) { pk = env[i]; at = i; } const a = Math.abs(x[i]); if (a > mx) mx = a; }
  let on = 0; while (on < n && env[on] < pk * 0.1) on++;
  let end = n - 1; while (end > 0 && env[end] < pk * 0.01) end--;
  const r3 = (v) => Math.round(v * 1000) / 1000;
  return { duration: r3(n / rate), peak: r3(Math.max(0, at - win / 2) / rate), peakDb: Math.round(20 * Math.log10(mx + 1e-9) * 10) / 10, onset: r3(on / rate), end: r3(end / rate) };
}
/** analyse() with a cache next to the files (keyed by path, size and mtime). */
export function analyser(cacheFile) {
  let db = {}; try { db = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { db = {}; }
  let dirty = false;
  return {
    get(file) {
      const st = fs.statSync(file); const key = `${file}|${st.size}|${Math.round(st.mtimeMs)}`;
      if (!db[key]) { db[key] = analyse(file); dirty = true; }
      return db[key];
    },
    save() { if (dirty) { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify(db)); dirty = false; } },
  };
}

// ── the cues ──
/** Sound-effect cues with their files: scenario.sfx.cues that sfx.mjs resolved (file + peak). start = the
 *  film second the FILE starts (t − peak, or at). */
export const sfxCues = (project) => (((project.scenario.sfx && project.scenario.sfx.cues) || []).filter((c) => c && c.file && fs.existsSync(path.join(project.dir, c.file)))
  .map((c) => ({ ...c, start: Math.round(((c.at != null ? Number(c.at) : Number(c.t) - (c.peak || 0))) * 1000) / 1000, gain: c.gain != null ? Number(c.gain) : -18 })));
export const dbToGain = (db) => Math.pow(10, db / 20);

// ── the mix ──
const writeWav = (file, buf, T) => {
  const n = Math.min(buf.length, Math.round(T * SR) * 2);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_f32le', file],
    { input: Buffer.from(buf.buffer, buf.byteOffset, n * 4), maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).slice(0, 300)}`);
};
/** The film's soundtrack → a WAV: the voice-over clips at their seconds, the sound effects at theirs (each
 *  at its gain), the effects ducked under the voice (sidechain), the whole loudness-normalised in two
 *  passes (−16 LUFS, −1.5 dBTP; scenario.sfx.loudness / .duck override). null when there is no sound. */
export function mixTrack(project, { T, out }) {
  const voice = voiceClips(project).filter((c) => fs.existsSync(path.join(project.dir, c.file)));
  const sfx = sfxCues(project);
  if (!voice.length && !sfx.length) return null;
  const opt = project.scenario.sfx || {};
  const n = Math.ceil(T * SR) + SR;
  const busV = new Float32Array(n * 2), busS = new Float32Array(n * 2);
  const cache = new Map();
  const add = (bus, file, start, gain) => {
    let x = cache.get(file); if (!x) { x = decode(file); cache.set(file, x); }
    let s = Math.round(start * SR); let from = 0;
    if (s < 0) { from = -s; s = 0; }
    for (let i = from; i < x.length / 2 && s + i - from < n; i++) {
      const o = (s + i - from) * 2; bus[o] += x[i * 2] * gain; bus[o + 1] += x[i * 2 + 1] * gain;
    }
  };
  for (const c of voice) add(busV, path.join(project.dir, c.file), c.start || 0, 1);
  for (const c of sfx) add(busS, path.join(project.dir, c.file), c.start, dbToGain(c.gain));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'greenlight-motion-mix-'));
  const fv = path.join(tmp, 'voice.wav'), fs_ = path.join(tmp, 'sfx.wav');
  writeWav(fv, busV, T); writeWav(fs_, busS, T);
  const duck = opt.duck !== false && voice.length && sfx.length;
  const target = Number(opt.loudness || -16);
  const chain = (duck
    ? '[1:a]asplit=2[v][key];[0:a][key]sidechaincompress=threshold=0.02:ratio=4:attack=8:release=320[d];[d][v]amix=inputs=2:normalize=0'
    : '[0:a][1:a]amix=inputs=2:normalize=0') + `,atrim=0:${T},afade=t=out:st=${Math.max(0, T - 0.05).toFixed(3)}:d=0.05`;
  const inputs = ['-i', fs_, '-i', fv];
  const m = spawnSync('ffmpeg', ['-v', 'info', ...inputs, '-filter_complex', `${chain},loudnorm=I=${target}:TP=-1.5:LRA=11:print_format=json[a]`, '-map', '[a]', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  let ln = `loudnorm=I=${target}:TP=-1.5:LRA=11`;
  try {
    const j = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'), m.stderr.lastIndexOf('}') + 1));
    if (Number.isFinite(+j.input_i)) ln += `:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  } catch { /* silent film: one pass */ }
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', `${chain},${ln},aresample=${SR}[a]`, '-map', '[a]', '-c:a', 'pcm_s16le', out], { encoding: 'utf8', maxBuffer: 1 << 28 });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`mix failed: ${r.stderr.slice(-600)}`);
  return { file: out, voice: voice.length, sfx: sfx.length, ducked: !!duck, loudness: target };
}

/** The picture of `video` with `audio` as its sound (the video stream copied) → out. */
export function muxAudio(video, audio, out, format = 'mp4') {
  const codec = format === 'mov' ? ['-c:a', 'pcm_s16le'] : /webm/.test(format) ? ['-c:a', 'libopus', '-b:a', '160k'] : ['-c:a', 'aac', '-b:a', '192k'];
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...codec, '-shortest',
    ...(format === 'mp4' ? ['-movflags', '+faststart'] : []), out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`mux failed: ${r.stderr.slice(-600)}`);
  return out;
}
