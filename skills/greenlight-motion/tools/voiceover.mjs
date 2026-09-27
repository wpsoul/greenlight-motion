// Voice-over: the lines in each scene's `voice` (a string, a list of lines — { text, at } places a line at a
// second of its scene — or a long take { take: [part, …] }: ONE recording whose part k is spoken over scene +k),
// recorded into <project>/audio/ and placed on the film. The result goes into
// scenario.json → voiceover.clips, which the preview plays, the renders mix in and the Video Editor
// exports put on a Voice channel.
//   node tools/voiceover.mjs <project> --lines                      the lines, with their scene timing
//   node tools/voiceover.mjs <project> --models                     (board) the text-to-speech models + options
//   node tools/voiceover.mjs <project> --model <id> [--param k=v]…  (board) record the lines with that model
//        [--scenes 1,3] [--force] [--timeout 120] [--retries 2]
//   node tools/voiceover.mjs <project> --say [--voice Samantha]     (macOS, offline) a draft voice
//   node tools/voiceover.mjs <project> --files a.mp3,,c.mp3         the user's own recordings, one per line
//   node tools/voiceover.mjs <project> --place                      place the recorded clips again (after editing
//                                                                   a line's `at` or a scene's length) — offline
//   node tools/voiceover.mjs <project> --clear                      remove the voice-over
// Recording is resumable: every finished line is saved at once, and a re-run records only the lines with no
// clip yet or whose text changed. --scenes records just those scenes again; --force records everything. Each request has a timeout and is retried (network errors, timeouts, 5xx).
// Timing: a line starts `at` seconds into its scene (default --lead, 0.25); a scene's next line without
// `at` follows the previous one after a short breath. --fit lengthens a scene its lines run past.
// A take is placed from the pauses in its own recording: each part boundary is the pause nearest where the words
// put it, and --fit cuts the picture to the voice (every scene of the take ends in the pause after its part).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadProject, board, boardState, boardFolder, readJSON, writeJSON, sha1, arg, voiceLines } from './project.mjs';

const argv = process.argv.slice(2);
const VALUE = ['--board', '--api', '--model', '--param', '--voice', '--files', '--lead', '--scenes', '--timeout', '--retries'];
const dir = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1]))) || '.';
const project = loadProject(dir);
const file = project.file;
const raw = readJSON(file);
const lead = Number(arg(argv, 'lead', raw.voiceover && raw.voiceover.lead != null ? raw.voiceover.lead : 0.25));
const BREATH = 0.15;                                    // between two lines of one scene

const duration = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  if (!(d > 0)) throw new Error(`cannot read the length of ${f} — is ffprobe (ffmpeg) installed?`);
  return Math.round(d * 1000) / 1000;
};
const say = (o) => console.log(JSON.stringify(o, null, 1));
/** The audio format from the first bytes (a provider may send WAV or FLAC behind an .mp3 URL). */
const sniffExt = (b, fallback) => {
  const s4 = b.toString('latin1', 0, 4);
  if (s4 === 'RIFF') return '.wav'; if (s4 === 'fLaC') return '.flac'; if (s4 === 'OggS') return '.ogg';
  if (s4.startsWith('ID3') || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return '.mp3';
  if (b.toString('latin1', 4, 8) === 'ftyp') return '.m4a';
  return fallback;
};

const lines = () => voiceLines(raw.scenes);
const multi = (scene) => lines().filter((l) => l.scene === scene).length > 1;
const clipName = (l, ext) => `audio/vo-${l.scene}${l.through > l.scene ? '-' + l.through : multi(l.scene) ? '-' + (l.line + 1) : ''}${ext}`;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The pauses in a recording: [[start, end], …] in seconds (ffmpeg silencedetect). */
function pauses(f) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'], { encoding: 'utf8' });
  const out = []; let at = null;
  for (const m of String(r.stderr).matchAll(/silence_(start|end): (-?[\d.]+)/g)) {
    if (m[1] === 'start') at = Math.max(0, +m[2]); else if (at != null) { out.push([at, +m[2]]); at = null; }
  }
  return out;
}
/** Where a take's parts meet, in seconds of its clip: each boundary at the pause nearest where the words put it
 *  (the speech spread over the parts by their length), later than the previous one. → [after part 1, …] */
function takeCuts(f, parts, dur) {
  const gaps = pauses(f);
  const first = gaps.length && gaps[0][0] < 0.05 ? gaps[0][1] : 0;                  // leading silence
  const tail = gaps.find((g) => g[1] >= dur - 0.05); const last = tail ? tail[0] : dur;   // trailing silence
  const inner = gaps.filter((g) => g[0] > first + 0.05 && g[1] < last - 0.05).map((g) => ({ mid: (g[0] + g[1]) / 2, len: g[1] - g[0] }));
  const weight = parts.map((p) => p.length + 6);                                     // characters + the pause after
  const total = weight.reduce((a, b) => a + b, 0);
  const cuts = []; let acc = 0; let prev = first;
  for (let k = 0; k < parts.length - 1; k++) {
    acc += weight[k];
    const expect = first + ((last - first) * acc) / total;
    const tol = Math.max(0.8, (last - first) * 0.12);
    // the nearest pause (a longer one wins a near tie: a sentence end over a comma)
    let best = null;
    for (const g of inner) {
      if (g.mid <= prev + 0.2) continue;
      const score = Math.abs(g.mid - expect) - Math.min(0.3, g.len * 0.5);
      if (Math.abs(g.mid - expect) <= tol && (!best || score < best.score)) best = { ...g, score };
    }
    prev = best ? best.mid : Math.max(expect, prev + 0.2);
    cuts.push(r3(prev));
  }
  return cuts;
}
const same = (c, l) => c.scene === l.scene && (c.line || 0) === l.line;

/** Place every clip (their scene's start + at, lines of a scene one after another), lengthen scenes with
 *  --fit, write scenario.json. Called after EVERY recorded line, so a failure keeps what is done
 *  (quiet: no overrun warnings — the final call reports them). */
function place(clips, source, quiet = false) {
  for (const c of clips) if (!(c.duration > 0)) c.duration = duration(path.join(project.dir, c.file));
  const bySceneLine = (a, b) => a.scene - b.scene || (a.line || 0) - (b.line || 0);
  clips.sort(bySceneLine);
  const want = new Map(lines().map((l) => [`${l.scene}:${l.line}`, l]));
  for (const c of clips) {                              // offsets within the scene
    const l = want.get(`${c.scene}:${c.line || 0}`);
    const prev = clips.filter((p) => p.scene === c.scene && (p.line || 0) < (c.line || 0)).pop();
    c.at = l && l.at != null ? l.at : prev ? Math.round((prev.at + prev.duration + BREATH) * 1000) / 1000 : lead;
    // a take: its parts, the scenes it runs over, and where its parts meet in the recording
    if (l && l.parts && l.parts.length > 1) { c.parts = l.parts; c.through = l.through; c.cuts = takeCuts(path.join(project.dir, c.file), l.parts, c.duration); }
    else { delete c.parts; delete c.through; delete c.cuts; }
  }
  const fit = argv.includes('--fit');
  // a take cuts the picture to the voice: every scene of it ends in the pause after its part; the last one
  // keeps at least its length (a held end card), plus a beat after the voice
  for (const c of clips.filter((x) => x.cuts)) {
    const first = c.scene - 1; const n = c.parts.length;
    const want = c.parts.map((_, k) => (k === 0 ? c.at + c.cuts[0] : k < n - 1 ? c.cuts[k] - c.cuts[k - 1] : c.duration - c.cuts[n - 2] + 0.4));
    want.forEach((d, k) => {
      const s = raw.scenes[first + k]; if (!s) return;
      const spec = project.K.elements.find((e) => e.id === s.item);
      const cur = Number(s.duration) || (spec ? spec.T : d);
      const next = Math.round((k === n - 1 ? Math.max(cur, d) : d) * 100) / 100;
      if (fit) {
        if (Math.abs(next - cur) > 0.01) { s.duration = next; if (!quiet) console.warn(`scene ${first + k + 1}: ${cur} → ${next} s (cut to the take)`); }
        if (!quiet && spec && k < n - 1 && spec.T > next + 0.5) console.warn(`! scene ${first + k + 1}: its item plays ${spec.T} s but its part is spoken in ${next} s — the cut comes before it settles; give that part more words or pick a shorter item`);
      } else if (!quiet && Math.abs(next - cur) > 0.3) console.warn(`! scene ${first + k + 1}: ${cur} s, its part of the take needs ${next} s — pass --fit to cut the picture to the voice`);
    });
  }
  if (fit) {
    for (const c of clips.filter((x) => !x.cuts)) {
      const s = raw.scenes[c.scene - 1];
      const spec = project.K.elements.find((e) => e.id === s.item);
      const cur = Number(s.duration) || spec.T;
      const need = Math.round((c.at + c.duration + 0.4) * 100) / 100;
      if (need > cur) { s.duration = need; console.warn(`scene ${c.scene}: lengthened ${cur} → ${need} s for its voice-over`); }
    }
  }
  const timing = project.MU.timing(raw);
  raw.voiceover = { source, lead, clips: clips.map((c) => ({ ...c, start: Math.round((timing[c.scene - 1].start + c.at) * 1000) / 1000 })) };
  if (!quiet) for (const c of raw.voiceover.clips) {
    const next = raw.voiceover.clips.find((n) => n.start > c.start);
    const last = (c.through || c.scene) - 1;           // a take may run to the end of its last scene
    const end = next && next.scene === c.scene ? next.start : timing[Math.min(last, timing.length - 1)].end;
    if (c.start + c.duration > end + 0.05) console.warn(`! scene ${c.scene}${multi(c.scene) ? ' line ' + (c.line + 1) : ''}: the voice runs ${(c.start + c.duration - end).toFixed(2)} s past ${next && next.scene === c.scene ? 'the next line' : 'the scene'} — shorten the line, lengthen the scene or pass --fit`);
  }
  writeJSON(file, raw);
  return raw.voiceover;
}
const kept = () => ((raw.voiceover && raw.voiceover.clips) || []).filter((c) => c && c.file && fs.existsSync(path.join(project.dir, c.file)));

if (argv.includes('--lines')) {
  const timing = project.MU.timing(project.scenario);
  const secs = (t) => Math.round((t.split(/\s+/).filter(Boolean).length / 2.6) * 10) / 10;
  say(lines().map((l) => (l.parts
    ? { scene: l.scene, through: l.through, take: true, words: l.text.split(/\s+/).length, roughSeconds: secs(l.text),
      parts: l.parts.map((p, k) => ({ scene: l.scene + k, text: p, roughSeconds: secs(p), sceneLength: timing[l.scene - 1 + k].duration })) }
    : { ...l, sceneStart: timing[l.scene - 1].start, sceneLength: timing[l.scene - 1].duration, words: l.text.split(/\s+/).length, roughSeconds: secs(l.text) })));
} else if (argv.includes('--place')) {
  // the recorded clips of the lines that still exist (same scene, line and text), placed again
  const clips = kept().filter((c) => lines().some((l) => same(c, l) && l.text === c.text));
  const gone = kept().length - clips.length;
  if (gone) console.warn(`${gone} clip(s) dropped: their line changed or is gone — record them again`);
  say({ ok: true, ...place(clips, (raw.voiceover && raw.voiceover.source) || 'files') });
} else if (argv.includes('--clear')) {
  delete raw.voiceover; writeJSON(file, raw); say({ ok: true, cleared: true });
} else if (argv.includes('--files')) {
  // one file per line, in order (empty = no clip for that line)
  const list = String(arg(argv, 'files', '')).split(',');
  const clips = [];
  lines().forEach((l, i) => {
    const f = (list[i] || '').trim(); if (!f) return;
    const abs = path.resolve(f);
    if (!fs.existsSync(abs)) throw new Error(`not found: ${f}`);
    const rel = clipName(l, path.extname(abs)); const dest = path.join(project.dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (abs !== dest) fs.copyFileSync(abs, dest);
    clips.push({ scene: l.scene, line: l.line, text: l.text, file: rel });
  });
  say({ ok: true, ...place(clips, 'files') });
} else if (argv.includes('--say')) {
  if (process.platform !== 'darwin') throw new Error('--say uses the macOS voice; elsewhere record the lines and pass --files');
  const voice = arg(argv, 'voice');
  const clips = [];
  for (const l of lines()) {
    const m4a = path.join(project.dir, clipName(l, '.m4a')); const aiff = m4a.replace(/\.m4a$/, '.aiff');
    fs.mkdirSync(path.dirname(aiff), { recursive: true });
    const r = spawnSync('say', [...(voice ? ['-v', voice] : []), '-o', aiff, l.text], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`say failed: ${r.stderr}`);
    const c = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-c:a', 'aac', '-b:a', '160k', m4a], { encoding: 'utf8' });
    if (c.status !== 0) throw new Error(`ffmpeg failed: ${c.stderr}`);
    fs.rmSync(aiff);
    clips.push({ scene: l.scene, line: l.line, text: l.text, file: path.relative(project.dir, m4a) });
  }
  say({ ok: true, ...place(clips, 'say' + (voice ? `:${voice}` : '')) });
} else {
  const B = await board(argv);
  if (!B) throw new Error('text-to-speech models come from the GreenLight Dash board; standalone, use --say (macOS draft) or --files (your recordings)');
  const models = (await B.call('GET', '/api/ai/models')).filter((m) => m.model_type === 'text_to_speech');
  if (argv.includes('--models') || !arg(argv, 'model')) {
    say(models.map((m) => ({ id: m.id, name: m.name, provider: m.provider, price: m.price_per_generation != null ? `${m.price_per_generation} ${m.price_unit || ''}`.trim() : undefined,
      options: (m.fields || []).filter((f) => f.key !== 'prompt' && f.key !== 'text').map((f) => `${f.key}${f.default != null ? '=' + f.default : ''}${f.options && f.options.length ? ' [' + f.options.join('|') + ']' : ''}`) })));
  } else {
    const id = arg(argv, 'model');
    const model = models.find((m) => m.id === id);
    if (!model) throw new Error(`no text-to-speech model "${id}" on this board — see --models`);
    const textKey = ((model.fields || []).find((f) => ['prompt', 'text', 'input'].includes(f.key)) || { key: 'prompt' }).key;
    const params = {};
    argv.forEach((a, i) => { if (a === '--param' && argv[i + 1]) { const [k, ...v] = argv[i + 1].split('='); params[k] = v.join('='); } });
    const only = arg(argv, 'scenes') ? new Set(String(arg(argv, 'scenes')).split(',').map((n) => Number(n.trim())).filter(Boolean)) : null;
    const force = argv.includes('--force');
    const timeout = Number(arg(argv, 'timeout', 120)) * 1000; const retries = Math.max(0, Number(arg(argv, 'retries', 2)));
    const state = boardState(project, B.id);
    const folder = boardFolder(project.scenario);
    // what to record: --force → every line; --scenes → those scenes' lines; otherwise (resume) the lines
    // with no clip yet or whose text changed. Every other clip is kept as it is.
    const existing = kept(); let clips = []; const todo = [];
    for (const l of lines()) {
      const c = existing.find((x) => same(x, l));
      const inScope = force || !only || only.has(l.scene);
      if (c && (!inScope || (!force && !only && c.text === l.text))) {
        clips.push(c);
        if (!inScope && c.text !== l.text) console.warn(`! scene ${l.scene}: its line changed but it is not in --scenes — the old recording stays`);
      } else if (inScope) todo.push(l);
    }
    const skipped = clips.length;
    if (skipped) console.warn(`${skipped} line(s) kept as recorded`);
    // one request, with a timeout; network errors, timeouts and 5xx are retried. NOTE: a request that timed
    // out may still finish at the provider — a retry can bill that line twice.
    const generate = async (l) => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await B.call('POST', '/api/ai/generate', { model_id: id, params: { ...params, [textKey]: l.text }, board_id: B.id, folder }, {}, { timeout });
        } catch (err) {
          const status = Number((/→ (\d{3})/.exec(String(err.message)) || [])[1]);
          const again = !status || status >= 500 || status === 408 || status === 429;
          if (!again || attempt >= retries) throw new Error(`scene ${l.scene}${multi(l.scene) ? ' line ' + (l.line + 1) : ''}: ${err.message}${status ? '' : ' (no answer)'}`);
          console.warn(`scene ${l.scene}: ${err.name === 'TimeoutError' ? `no answer in ${timeout / 1000} s` : err.message.slice(0, 120)} — retry ${attempt + 1}/${retries}`);
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      }
    };
    for (const l of todo) {
      console.warn(`scene ${l.scene}${multi(l.scene) ? ' line ' + (l.line + 1) : ''}: ${l.text}`);
      const out = await generate(l);
      const res = (out.results || []).find((r) => r.url);
      if (!res) throw new Error(`scene ${l.scene}: the model returned no audio`);
      const bytes = Buffer.from(await (await fetch(B.api + res.url, { headers: B.headers })).arrayBuffer());
      const rel = clipName(l, sniffExt(bytes, path.extname(res.url.split('?')[0]) || '.mp3'));
      fs.mkdirSync(path.join(project.dir, 'audio'), { recursive: true });
      for (const old of clips.filter((c) => same(c, l))) if (old.file !== rel) fs.rmSync(path.join(project.dir, old.file), { force: true });
      fs.writeFileSync(path.join(project.dir, rel), bytes);
      // it is on the board already — remember it, so the exports don't upload it again
      state.st.files['asset:' + rel] = { sha: sha1(bytes), url: res.url }; state.save();
      clips = clips.filter((c) => !same(c, l)).concat({ scene: l.scene, line: l.line, text: l.text, file: rel, model: id, duration: 0 });
      place(clips, `tts:${id}`, true);                   // saved now: a later failure keeps this line
    }
    say({ ok: true, model: id, recorded: todo.length, kept: skipped, ...place(clips, `tts:${id}`) });
  }
}
