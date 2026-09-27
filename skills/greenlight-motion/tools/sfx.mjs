// Sound design: sound-effect cues on the film's own events, from the GreenLight Dash Sound Library.
//   node tools/sfx.mjs <project> --library                 where the sounds come from (under a board: installs the
//                                                           Motion Design Pack when the Sound Library is empty)
//   node tools/sfx.mjs <project> --events                  the film's events: what --auto listens to
//   node tools/sfx.mjs <project> --auto [--density calm|normal|rich]   cues for those events → scenario.sfx
//   node tools/sfx.mjs <project> --list <role> [--limit 20]            candidate sounds for a role (length, peak)
//   node tools/sfx.mjs <project> --resolve                 prepare each cue's file (sfx/…m4a) and measure its peak
//   node tools/sfx.mjs <project> --clear
// Sounds: --sounds <folder> (your own), else the board's Sound Library (the app), else the app's library
// folder on this machine. A cue is { t, sound, gain, role, label } (t = the film second its PEAK lands on)
// or { at, sound, dur, … } (a texture from `at` for `dur` s). Edit scenario.sfx.cues freely, then --resolve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadProject, board, readJSON, writeJSON, arg } from './project.mjs';
import { soundLibrary, ensureSoundLibrary, analyser, analyse } from './audio.mjs';

const r3 = (v) => Math.round(v * 1000) / 1000;

// what each role sounds like: where it lives in the library (folder), a name filter, a length range (s),
// and its level (dB, the file peak-normalised to −1 dBFS first). Vector Motion Sound (UI sounds) is preferred
// when installed; the Motion Design Pack — the app's default pack — covers every role on its own.
// dirs are a preference order; `prefer` names win inside a folder
export const ROLES = {
  key: { gain: -18, dirs: [/(^|\/)Click$/], name: /keyboard click|key/i, max: 0.35, peakMax: 0.08, about: 'one key per typed character' },
  typing: { gain: -19, dirs: [/(^|\/)Text$/, /Keyboard Typing/], name: /keyboard writing|typing/i, min: 0.8, about: 'a typing texture (fast typing)' },
  click: { gain: -14, dirs: [/(^|\/)Click$/, /Notifications and Buttons$/], name: /click|tap|select/i, not: /keyboard|deny|switch|mechanical/i, prefer: /tonal click|tile click|^.*click 0\d/i, max: 0.6, peakMax: 0.16, about: 'a press or a cursor click' },
  switch: { gain: -14, dirs: [/(^|\/)Click$/], name: /switch/i, max: 0.6, about: 'a toggle or a segmented control flips' },
  pop: { gain: -20, dirs: [/Pop-Up$/, /Bubble$/], not: /bell|long|woodblock|particles|colorful|drum/i, prefer: /liquid|digital popup|organic|popup 0\d/i, max: 0.9, peakMax: 0.2, about: 'something appears' },
  tick: { gain: -23, dirs: [/Tiles$/, /Hover$/, /Bleep$/], not: /shaker|assembling|keyboard|notification|sliding/i, prefer: /glass tap|plastic tiles|paper tiles|simple hover/i, max: 0.6, peakMax: 0.15, about: 'many small things appear' },
  whoosh: { gain: -15, dirs: [/(^|\/)Whoosh$/, /Swoosh$/], not: /long tail|reverb/i, min: 0.3, max: 3.2, about: 'a camera move or a big move' },
  transition: { gain: -16, dirs: [/Full Screen Transition$/, /SFX Transition$/, /Ambient Transition$/, /Cyber Transition$/], not: /chaos|glitch|data transfer|moving synth|long tail/i, prefer: /granular|liquid|big transition|resonant|lush/i, min: 0.6, max: 6, about: 'the frame floods / a full-frame change' },
  data: { gain: -18, dirs: [/(^|\/)Data$/], min: 0.6, about: 'a counter or progress running' },
  success: { gain: -15, dirs: [/Pop-Up$/, /Notifications and Buttons$/, /Bleep$/], name: /tonal|notification|success|chime|confirm/i, max: 1.6, about: 'a result lands' },
  impact: { gain: -19, dirs: [/(^|\/)Impact$/, /Bass Drop$/], name: /bass|hit|impact|drop/i, not: /explosion|glass|crack|gun|laser|metal|echo/i, about: 'a big reveal' },
};

// ── the film's events (what --auto listens to) ──
export function filmEvents(project) {
  const { K, MU, scenario } = project;
  const { normTrack, evalTrack } = K._int;
  // a 3D-engine film: its scenes are pages, so only the cuts can be read — a whoosh into a fade, a hit on a cut;
  // cue what happens inside the scenes by hand (at: seconds)
  if (scenario.engine === '3d') {
    return MU.timing(scenario).slice(1).map((tm, k) => ({ t: r3(tm.start), role: scenario.scenes[k + 1].transition === 'fade' ? 'whoosh' : 'transition', gain: -3, dur: 0.35, label: `into scene ${k + 2}` }));
  }
  const spec = MU.film(scenario);
  const T = spec.T;
  const camTr = {}; for (const p of ['zoom', 'x', 'y']) if (spec.cam.k && spec.cam.k[p]) camTr[p] = normTrack(spec.cam.k[p], 'x');
  const cam = (t) => ({ zoom: camTr.zoom ? evalTrack(camTr.zoom, spec.cam.zoom, t, false) : spec.cam.zoom, x: camTr.x ? evalTrack(camTr.x, spec.cam.x, t, false) : spec.cam.x, y: camTr.y ? evalTrack(camTr.y, spec.cam.y, t, false) : spec.cam.y });
  const ev = [];
  const push = (e) => { if (e.t >= 0 && e.t <= T) ev.push({ ...e, t: r3(e.t) }); };
  // peak speed inside a segment (where a whoosh belongs): sample its easing
  const peakAt = (s) => { const f = K.ease(s.e); let best = 0, at = 0.3; for (let i = 1; i < 40; i++) { const u = i / 40, v = f(u + 0.0125) - f(u - 0.0125); if (v > best) { best = v; at = u; } } return s.t0 + at * (s.t1 - s.t0); };
  const W = project.scenario.size.w / 2 + 80, Hh = project.scenario.size.h / 2 + 80;
  // chain = the ancestors' { opacity, position } — an event counts only when the layer is visible AND in frame
  const walk = (L, chain, scale) => {
    const tr = {}; for (const p of Object.keys(L.k || {})) tr[p] = normTrack(L.k[p], p);
    const here = [...chain, { L, tr, scale }];
    const seen = (t) => {
      let op = 1, x = 0, y = 0;
      for (const { L: A, tr: At, scale: sc } of here) {
        op *= At.opacity ? evalTrack(At.opacity, A.opacity ?? 1, t, false) : (A.opacity ?? 1);
        x += (At.x ? evalTrack(At.x, A.x ?? 0, t, false) : (A.x ?? 0)) * sc;
        y += (At.y ? evalTrack(At.y, A.y ?? 0, t, false) : (A.y ?? 0)) * sc;
      }
      if (op <= 0.05) return false;
      // in frame: layers with a known size, checked with their own half-size as margin (a group's extent
      // is unknown — it counts as in frame when visible)
      const own = L.type === 'text' ? [(L.size || 40) * 0.55 * String(L.text || '').length, (L.size || 40)] : L.type === 'icon' ? [L.size || 24, L.size || 24]
        : L.type === 'group' || L.type === 'cursor' || L.type === 'canvas' ? null : [L.w ?? L.d ?? 0, L.h ?? L.d ?? L.w ?? 0];
      if (!own) return true;
      const c = cam(t), sc = here[here.length - 1].scale * (L.scale ?? 1);
      return Math.abs((x - c.x) * c.zoom) < W + (own[0] * sc * c.zoom) / 2 && Math.abs((y - c.y) * c.zoom) < Hh + (own[1] * sc * c.zoom) / 2;
    };
    const S = scale * (L.scale ?? 1);
    const name = L.id || L.type;
    // typing: the reveal track, one key per character it adds or removes
    if (L.type === 'text' && tr.reveal) {
      const len = [...String(L.text || '').replace(/\{\{\{[^}]*\}\}\}/g, '0')].length;
      let v = tr.reveal.init ?? (L.reveal ?? 1); const keys = [];
      for (const s of tr.reveal.segs) {
        const n = Math.round((s.v - v) * len);
        if (n && (s.t1 - s.t0 > 1e-3 || Math.abs(n) <= 2)) for (let i = 0; i < Math.abs(n); i++) keys.push({ t: s.t0 + ((i + 0.5) / Math.abs(n)) * (s.t1 - s.t0), del: n < 0 });
        v = s.v;
      }
      const vis = keys.filter((k) => seen(k.t)).sort((a, b) => a.t - b.t);
      // runs of keys; fast runs become one typing texture
      let run = [];
      const flush = () => {
        if (!run.length) return;
        const span = run[run.length - 1].t - run[0].t;
        if (run.length > 8 && run.length / Math.max(span, 0.01) > 24) push({ t: run[0].t, role: 'typing', dur: r3(span + 0.12), label: `${name} types` });
        else run.forEach((k) => push({ t: k.t, role: 'key', gain: k.del ? -2 : 0, label: `${name} ${k.del ? 'deletes' : 'types'}` }));
        run = [];
      };
      for (const k of vis) { if (run.length && k.t - run[run.length - 1].t > 0.4) flush(); run.push(k); }
      flush();
    }
    // counters and timers: the digits running
    if (L.type === 'text' && /\{\{\{\s*(COUNTER|TIMER)/i.test(String(L.text || ''))) {
      for (const m of String(L.text).matchAll(/\{\{\{\s*(COUNTER|TIMER)\s*:([^{}]*)\}\}\}/gi)) {
        const o = Object.fromEntries(m[2].split(';').slice(1).map((p) => p.split('=').map((x) => x.trim())).filter((p) => p.length === 2));
        let start = Number(o.start) || 0, dur = Number(o.duration) || (m[1].toUpperCase() === 'COUNTER' ? 1.8 : 2);
        if (o.kf && tr['ph:' + o.kf]) { const s = tr['ph:' + o.kf].segs[0]; if (s) { start = s.t0; dur = s.t1 - s.t0; } }
        if (seen(start + 0.05)) { push({ t: start, role: 'data', dur: r3(dur), label: `${name} counts` }); push({ t: start + dur, role: 'tick', gain: 2, label: `${name} lands` }); }
      }
    }
    // clicks: a quick squeeze (press), or the cursor's click
    if (tr.scale) {
      let v = tr.scale.init ?? (L.scale ?? 1);
      for (const s of tr.scale.segs) {
        const d = s.t1 - s.t0;
        if (L.type === 'cursor' ? s.v <= 0.9 && d <= 0.1 : d > 0 && d <= 0.12 && s.v >= 0.85 && s.v <= 0.995 && v >= 0.99) { if (seen(s.t1)) push({ t: s.t1, role: 'click', label: `${name} click` }); }
        else if (L.type !== 'text' && L.type !== 'cursor' && v <= 0.65 && s.v >= 0.9 && d > 0 && d <= 0.8 && seen(s.t0 + 0.1)
          && (L.type === 'group' || Math.max(L.w || 0, L.h || 0, L.d || 0, L.size || 0) * S * cam(s.t0).zoom >= 24)) push({ t: s.t0 + 0.03, role: 'pop', label: `${name} appears` });
        v = s.v;
      }
    }
    // big moves of a layer (world px), and full-frame floods (a shape growing past the frame)
    if (L.type !== 'cursor') for (const p of ['x', 'y']) for (const s of (tr[p] ? tr[p].segs : [])) {
      const i = tr[p].segs.indexOf(s), v0 = i ? tr[p].segs[i - 1].v : (tr[p].init ?? L[p] ?? 0);
      if (s.t1 - s.t0 > 0.05 && Math.abs(s.v - v0) * S * cam(s.t0).zoom >= 900 && s.t1 - s.t0 <= 1.6 && seen((s.t0 + s.t1) / 2)) push({ t: peakAt(s), role: 'whoosh', gain: -3, move: 'layer', dur: r3(s.t1 - s.t0), label: `${name} moves` });
    }
    for (const p of ['w', 'h']) for (const s of (tr[p] ? tr[p].segs : [])) {
      const i = tr[p].segs.indexOf(s), v0 = i ? tr[p].segs[i - 1].v : (tr[p].init ?? L[p] ?? 0), z = cam(s.t1).zoom;
      if (p === 'w' && Math.max(s.v, v0) * S * z >= 1500 && Math.abs(s.v - v0) * S * z >= 700 && seen(s.t0 + 0.02)) push({ t: peakAt(s), role: 'transition', dur: r3(s.t1 - s.t0), label: `${name} floods` });
    }
    for (const c of L.ch || []) walk(c, here, S);
  };
  for (const L of K.build(spec)) walk(L, [], 1);
  // the camera: contiguous segments on zoom / x / y are one move; a whoosh at its fastest moment
  const segs = []; for (const p of Object.keys(camTr)) for (const s of camTr[p].segs) if (s.t1 > s.t0) segs.push({ ...s, p });   // steps (cuts) are not moves
  segs.sort((a, b) => a.t0 - b.t0);
  const moves = [];
  for (const s of segs) { const m = moves[moves.length - 1]; if (m && s.t0 <= m.t1 + 0.03) { m.t1 = Math.max(m.t1, s.t1); } else moves.push({ t0: s.t0, t1: s.t1 }); }
  for (const m of moves) {
    const a = cam(m.t0), b = cam(m.t1 - 1e-3), d = m.t1 - m.t0;
    const zoom = Math.abs(Math.log(b.zoom / a.zoom)), pan = Math.hypot(b.x - a.x, b.y - a.y) * Math.max(a.zoom, b.zoom);
    // a move you hear: big enough AND quick enough (a slow drift is silent)
    if (d < 0.15 || ((zoom < 0.22 || zoom / d < 0.3) && (pan < 220 || pan / d < 600))) continue;
    let best = 0, at = m.t0;
    for (let i = 1; i < 60; i++) { const t = m.t0 + (i / 60) * (m.t1 - m.t0), p = cam(t - 0.01), q = cam(t + 0.01);
      const v = Math.abs(Math.log(q.zoom / p.zoom)) * 1000 + Math.hypot(q.x - p.x, q.y - p.y) * q.zoom; if (v > best) { best = v; at = t; } }
    push({ t: at, role: 'whoosh', dur: r3(m.t1 - m.t0), move: 'camera', strength: zoom + pan / 1000, label: `camera ${zoom >= 0.22 ? (b.zoom > a.zoom ? 'pushes in' : 'pulls back') : 'pans'}` });
  }
  // scene cross-fades
  MU.timing(scenario).forEach((tm, i) => { if (i && scenario.scenes[i].transition === 'fade') push({ t: tm.start - 0.1, role: 'whoosh', gain: -5, dur: 0.5, label: `fade into scene ${i + 1}` }); });
  ev.sort((a, b) => a.t - b.t);
  // pops in a cluster are ticks; a layer move next to a camera whoosh is the same gesture
  for (const e of ev) if (e.role === 'pop' && ev.filter((o) => o.role === 'pop' && Math.abs(o.t - e.t) <= 0.25).length >= 4) e.role = 'tick';
  return ev.filter((e, i) => {
    if (e.move === 'layer' && ev.some((o) => o !== e && o.role === 'whoosh' && o.move === 'camera' && Math.abs(o.t - e.t) < 0.4)) return false;
    if (e.role === 'whoosh' && e.move === 'layer' && ev.slice(0, i).some((o) => o.role === 'whoosh' && Math.abs(o.t - e.t) < 0.3)) return false;
    if (['click', 'pop', 'tick'].includes(e.role) && ev.slice(0, i).some((o) => o.role === e.role && Math.abs(o.t - e.t) < (e.role === 'tick' ? 0.035 : 0.09))) return false;
    if (e.role === 'data' && ev.slice(0, i).some((o) => o.role === 'data' && Math.abs(o.t - e.t) < 0.4)) return false;
    return true;
  });
}

// ── the library, by role ──
async function candidates(lib, role, cache, { limit = 40 } = {}) {
  const R = ROLES[role]; if (!R) throw new Error(`unknown role "${role}" — one of ${Object.keys(ROLES).join(', ')}`);
  const dirOf = (rel) => rel.split('/').slice(0, -1).join('/');
  let list = lib.list.filter((f) => R.dirs.some((d) => d.test(dirOf(f.rel))) && (!R.name || R.name.test(f.rel.split('/').pop())) && (!R.not || !R.not.test(f.rel)));
  if (!list.length && R.name) list = lib.list.filter((f) => R.dirs.some((d) => d.test(dirOf(f.rel))) && (!R.not || !R.not.test(f.rel)));
  // the role's folder order, then UI-sound packs, then preferred names, then a stable name order
  const dirRank = (f) => { const i = R.dirs.findIndex((d) => d.test(dirOf(f.rel))); return i < 0 ? 99 : i; };
  const pref = (f) => (R.prefer && R.prefer.test(f.rel.split('/').pop()) ? 0 : 1);
  list.sort((a, b) => dirRank(a) - dirRank(b) || (/Vector Motion Sound/.test(b.rel) - /Vector Motion Sound/.test(a.rel)) || pref(a) - pref(b) || a.rel.localeCompare(b.rel));
  const out = [];
  for (const f of list.slice(0, limit * 2)) {
    let a; try { a = cache.get(await lib.local(f.rel)); } catch { continue; }
    if (R.min && a.duration < R.min) continue; if (R.max && a.end > R.max) continue; if (R.peakMax && a.peak > R.peakMax) continue;
    out.push({ rel: f.rel, ...a });
    if (out.length >= limit) break;
  }
  return out;
}
/** A sound for an event: textures by length, whooshes by where their peak falls, the rest in rotation. */
function pick(c, e, n) {
  if (!c.length) return null;
  if (e.role === 'typing' || e.role === 'data') return c.slice().sort((a, b) => (a.duration >= (e.dur || 1) ? 0 : 1) - (b.duration >= (e.dur || 1) ? 0 : 1) || Math.abs(a.duration - (e.dur || 1)) - Math.abs(b.duration - (e.dur || 1)))[n % Math.min(2, c.length)];
  if (e.role === 'whoosh' || e.role === 'transition') {
    const want = Math.min(0.9, Math.max(0.12, (e.dur || 0.8) * 0.35));
    const R = ROLES[e.role], liked = R.prefer ? c.filter((x) => R.prefer.test(x.rel.split('/').pop())) : [];
    const ranked = (liked.length >= 2 ? liked : c).slice().sort((a, b) => Math.abs(a.peak - want) - Math.abs(b.peak - want));
    return ranked[n % Math.min(3, ranked.length)];
  }
  return c[n % Math.min(e.role === 'key' ? 3 : 4, c.length)];
}

// ── the files the film plays: trimmed, peak-normalised to −1 dBFS, AAC ──
async function resolve(project, lib, cues) {
  const dir = path.join(project.dir, 'sfx'); fs.mkdirSync(dir, { recursive: true });
  for (const c of cues) {
    if (!c.sound) continue;
    const hash = crypto.createHash('sha1').update(`${c.sound}|${c.dur || ''}`).digest('hex').slice(0, 8);
    const base = path.basename(c.sound).replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sound';
    const rel = `sfx/${base}-${hash}.m4a`; const out = path.join(project.dir, rel);
    const ok = fs.existsSync(out) && fs.statSync(out).size > 1024;
    if (c.file === rel && ok && c.peak != null) continue;
    if (!ok) {
      const own = path.isAbsolute(c.sound) ? c.sound : path.join(project.dir, c.sound);
      const src = fs.existsSync(own) ? own : await lib.local(c.sound);
      const trim = c.dur ? `atrim=0:${c.dur},afade=t=out:st=${Math.max(0, c.dur - 0.06)}:d=0.06,` : '';
      const vd = spawnSync('ffmpeg', ['-v', 'info', '-i', src, '-vn', '-af', `${trim}volumedetect`, '-f', 'null', '-'], { encoding: 'utf8' });
      const max = Number((/max_volume:\s*(-?[\d.]+) dB/.exec(vd.stderr) || [])[1] || 0);
      const part = out + '.part.m4a';                     // written aside, renamed only when complete
      const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vn', '-af', `${trim}volume=${(-1 - max).toFixed(2)}dB`, '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', part], { encoding: 'utf8' });
      if (r.status !== 0) { fs.rmSync(part, { force: true }); throw new Error(`cannot prepare ${c.sound}: ${r.stderr.slice(-300)}`); }
      fs.renameSync(part, out);
    }
    const a = analyse(out);
    Object.assign(c, { file: rel, peak: a.peak, length: a.duration });
  }
  return cues;
}

// ── CLI ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const VALUE = ['--board', '--api', '--sounds', '--density', '--list', '--limit'];
  const dirArg = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE.includes(argv[i - 1]))) || '.';
  const project = loadProject(dirArg);
  const raw = readJSON(project.file);
  const say = (o) => console.log(JSON.stringify(o, null, 1));
  const B = argv.includes('--events') || argv.includes('--clear') ? null : await board(argv);
  const libFor = async () => {
    if (B && !arg(argv, 'sounds')) { const st = await ensureSoundLibrary(B, { log: (s) => console.warn(s) }); if (st.installed) console.warn(`Installed the ${st.pack} pack: ${st.files} sounds.`); }
    const lib = await soundLibrary({ B: arg(argv, 'sounds') ? null : B, dir: arg(argv, 'sounds') });
    if (!lib.list.length) throw new Error(B ? 'the Sound Library is still empty' : 'no Sound Library here: install GreenLight Dash and its Motion Design Pack (the app\'s Sound Library), or pass --sounds <folder> with your own sounds');
    return lib;
  };
  const cacheFile = path.join(project.dir, '.sfx-cache.json');
  if (argv.includes('--events')) {
    say(filmEvents(project).map((e) => ({ t: e.t, role: e.role, ...(e.dur ? { dur: e.dur } : {}), label: e.label })));
  } else if (argv.includes('--clear')) {
    delete raw.sfx; writeJSON(project.file, raw); say({ ok: true, cleared: true });
  } else if (argv.includes('--library')) {
    const lib = await libFor();
    const roles = {}; const cache = analyser(cacheFile);
    for (const r of Object.keys(ROLES)) roles[r] = (await candidates(lib, r, cache, { limit: 8 })).length;
    cache.save();
    say({ where: lib.where, sounds: lib.list.length, candidatesPerRole: roles });
  } else if (arg(argv, 'list')) {
    const lib = await libFor(); const cache = analyser(cacheFile);
    const role = arg(argv, 'list');
    const c = await candidates(lib, role, cache, { limit: Number(arg(argv, 'limit', 20)) }); cache.save();
    say({ role, about: ROLES[role].about, sounds: c.map((s) => ({ sound: s.rel, length: s.duration, peak: s.peak, end: s.end })) });
  } else if (argv.includes('--auto')) {
    const density = arg(argv, 'density', 'normal');
    const lib = await libFor(); const cache = analyser(cacheFile);
    let events = filmEvents(project);
    if (density === 'calm') events = events.filter((e, i) => e.role !== 'tick' && !(e.role === 'key' && i % 2) && !(e.role === 'whoosh' && e.move === 'layer'));
    const pools = {}; const used = {}; const cues = [];
    for (const e of events) {
      pools[e.role] = pools[e.role] || await candidates(lib, e.role, cache);
      const s = pick(pools[e.role], e, used[e.role] = (used[e.role] ?? -1) + 1);
      if (!s) { console.warn(`! no ${e.role} sound in the library — skipped: ${e.label} @ ${e.t}`); continue; }
      const texture = e.role === 'typing' || e.role === 'data';
      cues.push({ ...(texture ? { at: e.t, dur: e.dur } : { t: e.t }), sound: s.rel, gain: ROLES[e.role].gain + (e.gain || 0) + (density === 'rich' ? 2 : 0), role: e.role, label: e.label });
    }
    cache.save();
    const keep = ((raw.sfx && raw.sfx.cues) || []).filter((c) => c.keep);        // your own cues survive a re-run
    raw.sfx = Object.assign({}, raw.sfx || {}, { source: lib.where, cues: [...keep, ...cues].sort((a, b) => (a.t ?? a.at) - (b.t ?? b.at)) });
    await resolve(project, lib, raw.sfx.cues);
    writeJSON(project.file, raw);
    const byRole = {}; for (const c of cues) byRole[c.role] = (byRole[c.role] || 0) + 1;
    say({ ok: true, cues: cues.length, kept: keep.length, byRole, library: lib.where });
  } else if (argv.includes('--resolve')) {
    const cues = (raw.sfx && raw.sfx.cues) || [];
    const need = cues.some((c) => c.sound && !(c.file && fs.existsSync(path.join(project.dir, c.file)) && c.peak != null));
    const lib = need ? await libFor() : null;
    await resolve(project, lib, cues); writeJSON(project.file, raw);
    say({ ok: true, cues: cues.length, files: new Set(cues.map((c) => c.file)).size });
  } else {
    console.log('usage: node tools/sfx.mjs <project> --library | --events | --auto [--density calm|normal|rich] | --list <role> | --resolve | --clear  [--sounds <folder>]');
  }
}
