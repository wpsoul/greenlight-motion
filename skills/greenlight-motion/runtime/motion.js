/* GL Motion — the film runtime shared by the preview page (browser) and the tools (node).
 *
 * Everything here is a pure function of the scenario + the GL Motion library (window.UIK), so the
 * preview's buttons and the agent's CLI produce the same files:
 *   MU.normalize(scenario, { edits })      → the scenario with defaults filled in and the user's edits applied
 *   MU.applyEdits(scenario, edits)         → the scenario with an edits overlay merged into its own fields
 *   MU.film(scenario)                      → the whole film as one kit element (UIK.compose)
 *   MU.tokens(scenario)                    → the design tokens (colours) and fonts the film uses
 *   MU.pageHtml(scenario, sources, opt)    → a standalone page: the film, or one scene (opt.scene)
 *   MU.veLayers(scenario, opt)             → a Video Editor project: every layer editable
 *   MU.veHtmlCards(scenario, opt)          → a Video Editor project: one HTML clip per scene
 *   MU.aeScript(scenario, opt)             → an After Effects .jsx (+ the pictures it imports)
 *   MU.zip(entries)                        → a .zip (stored) as bytes
 * Scenario format: references/scenario.md.
 */
(function () {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const MU = root.MU = root.MU || {};
const K = () => root.UIK;
const r3 = (v) => Math.round(v * 1000) / 1000;

// The words spoken over each scene → [string per scene]: the recorded clips when there are any (a take's parts go
// to their own scenes), else the scenario's lines — a scene's own `voice`, or its part of a take
// ({ take: [part, …] } on an earlier scene: part k is spoken over scene +k).
MU.sceneVoices = (scenario) => {
  const scenes = (scenario && scenario.scenes) || [];
  const recorded = scenes.map(() => []); const written = scenes.map(() => []);
  const add = (to, i, t) => { const s = String(t || '').trim(); if (s && i >= 0 && i < to.length) to[i].push(s); };
  const textOf = (l) => (typeof l === 'string' ? l : (l && l.text) || '');
  for (const c of (scenario && scenario.voiceover && scenario.voiceover.clips) || []) {
    if (Array.isArray(c.parts) && c.parts.length) c.parts.forEach((p, k) => add(recorded, c.scene - 1 + k, p)); else add(recorded, c.scene - 1, c.text);
  }
  let covered = -1;
  scenes.forEach((s, i) => {
    if (i <= covered) return;
    const v = s && s.voice;
    if (v && typeof v === 'object' && !Array.isArray(v) && Array.isArray(v.take)) { v.take.forEach((p, k) => add(written, i + k, textOf(p))); covered = i + v.take.length - 1; return; }
    (Array.isArray(v) ? v : v ? [v] : []).forEach((l) => add(written, i, textOf(l)));
  });
  // per scene: what was recorded, else what is written (a line not recorded yet still shows)
  return scenes.map((_, i) => (recorded[i].length ? recorded[i] : written[i]).join(' '));
};

MU.slug = (s) => String(s || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'film';

// The user's changes from the preview (scenario.edits) — an overlay the agent can read, reset or fold:
//   { film: { theme, accent, background, colors: { token: hex }, recolor: { hex: hex }, font },
//     scenes: { "<scene number>": { text: { id: s }, images: { id: url }, style: { key: { prop: v } }, params: { name: v } } } }
// Merged into the scenario's own fields (the same names), key by key.
const plain = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);
MU.applyEdits = (scenario, edits) => {
  const E = plain(edits); if (!E) return scenario;
  const s = Object.assign({}, scenario);
  const f = plain(E.film) || {};
  for (const k of ['theme', 'accent', 'background', 'font']) if (Object.prototype.hasOwnProperty.call(f, k)) s[k] = f[k];
  for (const k of ['colors', 'recolor']) if (plain(f[k])) s[k] = Object.assign({}, plain(s[k]), f[k]);
  const scenes = plain(E.scenes) || {};
  s.scenes = (s.scenes || []).map((sc, i) => {
    const e = plain(scenes[String(i + 1)]); if (!e) return sc;
    const o = Object.assign({}, sc);
    for (const k of ['text', 'images', 'params']) if (plain(e[k])) o[k] = Object.assign({}, plain(sc[k]), e[k]);
    if (plain(e.style)) {
      o.style = Object.assign({}, plain(sc.style));
      for (const [key, st] of Object.entries(e.style)) {
        if (!plain(st)) continue;
        const cur = Object.assign({}, plain(o.style[key]));
        // a colour's swaps ({ acc: '#F00' }) add to the film's own
        for (const [p, v] of Object.entries(st)) cur[p] = plain(v) && plain(cur[p]) ? Object.assign({}, cur[p], v) : v;
        o.style[key] = cur;
      }
    }
    return o;
  });
  return s;
};

MU.normalize = (scenario, opt = {}) => {
  let s = Object.assign({}, scenario);
  if (opt.edits !== false && s.edits) s = MU.applyEdits(s, s.edits);
  delete s.edits;
  s.name = s.name || 'GL Motion film';
  s.id = MU.slug(s.id || s.name);
  const size = s.size || {};
  s.size = { w: Math.max(16, Math.round(size.w || 1920)), h: Math.max(16, Math.round(size.h || 1080)) };
  s.fps = Math.max(1, Math.min(120, Math.round(s.fps || 30)));
  s.theme = s.theme === 'dark' ? 'dark' : 'light';
  s.accent = s.accent || null;
  // the film's tokens: colours by token name, item colours swapped, its font
  const colors = {};
  for (const [k, v] of Object.entries(plain(s.colors) || {})) if (K().TOKENS.includes(k) && typeof v === 'string' && v) colors[k] = v;
  s.colors = Object.keys(colors).length ? colors : null;
  const recolor = {};
  for (const [k, v] of Object.entries(plain(s.recolor) || {})) if (/^#[0-9a-f]{3,8}$/i.test(k) && typeof v === 'string' && v) recolor[K().style ? K().style.normHex(k) : k.toUpperCase()] = v;
  s.recolor = Object.keys(recolor).length ? recolor : null;
  s.font = s.font && K().FONTS && K().FONTS[s.font] && s.font !== K().FONT_DEFAULT ? s.font : null;
  // background: a CSS colour, 'theme' (the theme's canvas colour) or null / 'transparent'
  s.background = s.background === 'theme' ? K().THEMES[s.theme].bg : (s.background && s.background !== 'transparent' ? s.background : null);
  // motion: the easing preset every scene takes (K.MOTION_PRESETS — spring by default; 'authored' = as built)
  s.motion = s.motion || K().MOTION_DEFAULT || 'spring';
  // the film's engine: 'default' (GL Motion items → editable layers, 3D space) or '3d' (HTML scenes — each scene a page
  // of its own, three.js for real 3D; the Video Editor gets them as HTML clips, After Effects nothing)
  s.engine = s.engine === '3d' ? '3d' : 'default';
  s.scenes = (s.scenes || []).map((sc) => Object.assign({ transition: 'cut' }, sc, s.engine === '3d' && !(Number(sc.duration) > 0) ? { duration: 4 } : {}));
  s.voiceover = s.voiceover || null;
  return s;
};

MU.film = (scenario, opt = {}) => K().compose(MU.normalize(scenario), opt);
MU.is3dEngine = (scenario) => !!scenario && scenario.engine === '3d';
// a 3D-engine film's player plan (UIK.scenePlan): docs = each scene's page source
MU.scenePlan = (scenario, docs) => K().scenePlan(MU.normalize(scenario), docs);
MU.timing = (scenario) => K().filmTiming(MU.normalize(scenario));

// ── design tokens + fonts: every colour and type style the film's layers really use ──
MU.tokens = (scenario) => {
  const s = MU.normalize(scenario);
  K().setTheme(s.theme, s.accent, s.colors);
  // a 3D-engine film has no layers to read: its tokens are the theme's (the scenes use them all)
  if (s.engine === '3d') {
    const th = K().theme();
    return { theme: s.theme, accent: th.acc, colors: K().TOKENS.map((name) => ({ name: name === 'acc' ? 'accent' : name, value: th[name], role: name, uses: 1 })),
      fonts: [{ family: s.font || K().FONT_DEFAULT, stack: K().fontOf(s.font).stack, note: s.font ? 'the film\'s font' : 'the scenes\' font', styles: [] }] };
  }
  const theme = K().theme();
  const used = new Map(); const hex = new Map(); const type = new Map();
  const note = (v) => {
    if (typeof v !== 'string' || !v) return;
    const name = v.split('/')[0];
    if (Object.prototype.hasOwnProperty.call(theme, name)) used.set(name, (used.get(name) || 0) + 1);
    else if (/^#|^rgb/i.test(name)) hex.set(name.toUpperCase(), (hex.get(name.toUpperCase()) || 0) + 1);
  };
  const walk = (L) => {
    for (const p of ['fill', 'stroke', 'color', 'caretColor']) note(L[p]);
    for (const p of ['fill', 'stroke', 'color']) if (L.k && L.k[p]) [].concat(L.k[p]).forEach((seg) => { if (Array.isArray(seg)) note(seg[seg.length === 2 ? 1 : 2]); else note(seg); });
    if (L.type === 'text') {
      const key = `${L.weight || 400}`;
      const t = type.get(key) || { weight: L.weight || 400, sizes: new Set(), samples: [] };
      t.sizes.add(L.size || 40);
      const txt = String(L.text || '').replace(/\{\{\{[^}]*\}\}\}/g, '123');
      if (txt.trim() && t.samples.length < 3 && !t.samples.includes(txt)) t.samples.push(txt.slice(0, 40));
      type.set(key, t);
    }
    (L.ch || []).forEach(walk);
  };
  const film = K().compose(s);
  K().build(film).forEach(walk);
  const ROLE = { bg: 'canvas', card: 'surface', panel: 'panel', ink: 'text', inv: 'text on accent', muted: 'secondary text', line: 'hairlines',
    skel: 'skeleton', soft: 'soft fill', dim: 'dim fill', acc: 'accent', bad: 'error', shade: 'scrim', white: 'white' };
  const colors = [...used.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name: name === 'acc' ? 'accent' : name, value: theme[name], role: ROLE[name] || name, uses: n }));
  const bgv = String(s.background || '').toUpperCase();
  if (bgv) colors.unshift({ name: 'background', value: s.background, role: 'film background', uses: 1 });
  // literal colours in the items, unless a token already has that value
  const have = new Set(colors.map((c) => String(c.value).toUpperCase()));
  for (const [v, n] of hex) if (!have.has(v)) { have.add(v); colors.push({ name: 'literal', value: v, role: 'item colour', uses: n }); }
  const weights = [...type.values()].sort((a, b) => a.weight - b.weight);
  return {
    theme: s.theme, accent: theme.acc, colors,
    fonts: [{ family: s.font || K().FONT_DEFAULT, stack: K().fontOf(s.font).stack, note: s.font ? 'the film\'s font' : 'the Video Editor\'s text font',
      styles: weights.map((t) => ({ weight: t.weight, sizes: [...t.sizes].sort((a, b) => a - b), sample: t.samples[0] || '' })) }],
  };
};

// ── pages ──
// sources = { easings, engine, film, files: { 'elements-x.js': text, … } } — the library's script texts
MU.pageHtml = (scenario, sources, opt = {}) => {
  let s = MU.normalize(scenario);
  // a 3D-engine film: the whole film as one page hosting its scenes, or one scene alone (its HTML clip)
  if (s.engine === '3d') {
    if (!sources.sceneRuntime || !sources.sceneHost || !sources.scenes) throw new Error('pageHtml: a 3D-engine film needs sources.scenes, sceneRuntime, sceneHost (and three)');
    if (opt.background !== undefined) s = Object.assign({}, s, { background: opt.background });
    const plan = K().scenePlan(s, sources.scenes);
    return opt.scene != null ? K().toScenePageHTML(plan, opt.scene, { three: sources.three, runtime: sources.sceneRuntime })
      : K().toSceneFilmHTML(plan, { three: sources.three, runtime: sources.sceneRuntime, host: sources.sceneHost });
  }
  // a scene page carries only its own item: the other scenes keep just their timing
  if (opt.scene != null) { const tm = MU.timing(s); s = Object.assign({}, s, { scenes: s.scenes.map((x, i) => Object.assign({}, x, { duration: tm[i].duration })) }); }
  const spec = K().compose(s, opt.scene != null ? { scene: opt.scene } : {});
  const need = (opt.scene != null ? [spec.film.scenes[0]] : spec.film.scenes).map((x) => x.file);
  const files = [...new Set(need)].map((f) => { if (!sources.files[f]) throw new Error(`pageHtml: no source for ${f}`); return sources.files[f]; });
  return K().toHTML(spec, { theme: s.theme, accent: s.accent, colors: s.colors, background: opt.scene != null ? null : (opt.background !== undefined ? opt.background : s.background),
    sources: { easings: sources.easings, engine: sources.engine, film: sources.film, files } });
};

// ── Video Editor projects ──
let nid = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(++nid).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const baseItem = (clipId, dur, extra) => Object.assign({
  id: uid('mi'), clipId, transition: 'None', transitionDuration: 0, trimStart: 0, trimEnd: dur,
  speedPoints: [{ x: 0, y: 1 }, { x: 1, y: 1 }], zoom: 1, scaleX: 1, scaleY: 1, panX: 0, panY: 0, panZ: 0,
  rotateX: 0, rotateY: 0, rotateZ: 0, rotation: 0, opacity: 100, blendMode: 'normal', propertyKeyframes: {}, layerEffects: [], effects: [],
}, extra);
const state = (s, clips, channels) => {
  const data = { version: 3, clips, channels, activeChannelId: channels.length ? channels[channels.length - 1].id : null, selectedTimelineId: null, currentTime: 0, videoSize: { w: s.size.w, h: s.size.h } };
  if (s.background) data.background = { type: 'solid', solidColor: s.background };
  const tk = MU.tokens(s).colors.map((c) => c.value).filter((v) => /^#[0-9a-f]{3,8}$/i.test(v));
  if (tk.length) data.colorTokens = [...new Set(tk)].slice(0, 24);
  return data;
};
// voice = [{ url, start, duration, name }] → one Voice channel (the editor's own kind)
const voiceChannel = (voice) => {
  const clips = []; const items = [];
  for (const v of voice || []) {
    if (!v || !v.url || !(v.duration > 0)) continue;
    const id = uid('mv');
    clips.push({ id, source: 'REMOTE', mediaType: 'audio', voice: true, url: v.url, proxyUrl: null, name: v.name || 'Voice-over', duration: r3(v.duration) });
    items.push(baseItem(id, r3(v.duration), { freeStart: r3(Math.max(0, v.start || 0)), volume: 100 }));
  }
  return items.length ? { clips, channel: { id: uid('mc'), name: 'Voice-over', visible: true, unsnapped: true, kind: 'voice', items: items.sort((a, b) => a.freeStart - b.freeStart) } } : null;
};
// sfx = [{ url, start, duration, gain | vol, name }] → audio channels ("Sound effects"): overlapping sounds go on
// separate lanes (a channel holds one item at a time); volume = the cue's gain as a percentage (≤ 100 %).
// The editor has no ducking: the effects play at their own levels.
const sfxChannels = (sfx) => {
  const clips = []; const lanes = [];
  const byUrl = new Map();
  for (const v of (sfx || []).filter((x) => x && x.url && x.duration > 0).sort((a, b) => a.start - b.start)) {
    let id = byUrl.get(v.url);
    if (!id) { id = uid('mx'); byUrl.set(v.url, id); clips.push({ id, source: 'REMOTE', mediaType: 'audio', url: v.url, proxyUrl: null, name: v.name || 'Sound effect', duration: r3(v.duration) }); }
    const start = r3(Math.max(0, v.start || 0)), skip = r3(Math.max(0, -(v.start || 0)));
    let lane = lanes.find((l) => l.end <= start + 1e-3);
    if (!lane) { lane = { end: 0, items: [] }; lanes.push(lane); }
    lane.items.push(baseItem(id, r3(v.duration), { trimStart: skip, freeStart: start, customName: v.name || undefined,
      volume: Math.max(0, Math.min(100, Math.round(100 * (v.vol != null ? v.vol : Math.pow(10, (v.gain != null ? v.gain : 0) / 20))))) }));
    lane.end = start + v.duration - skip;
  }
  return lanes.length ? { clips, channels: lanes.map((l, i) => ({ id: uid('mc'), name: lanes.length > 1 ? `Sound effects ${i + 1}` : 'Sound effects', visible: true, unsnapped: true, kind: 'audio', items: l.items })) } : null;
};

// the scenes alternate between two banks of channels when they overlap (fades), so no channel ever
// holds two live items at once; a bank has as many channels as its biggest scene has layers
const bankOf = (timing, i) => (timing.some((t) => t.from < t.start) ? i % 2 : 0);

// the scenes whose item can't become editor layers (formats: ['html']): a layers export places them as
// HTML clips (they need their scene pages), After Effects gets them as pre-rendered footage
MU.htmlOnlyScenes = (scenario) => (MU.normalize(scenario).engine === '3d' ? MU.timing(scenario).map((tm, i) => i) : MU.timing(scenario).map((tm, i) => {
  const el = K().elements.find((e) => e.id === tm.item);
  return el && !K().canLayers(el) ? i : -1;
}).filter((i) => i >= 0));
MU.footageScenes = MU.htmlOnlyScenes;
const htmlClip = (s, tm, i, url) => {
  const dur = r3(tm.to - tm.from); const id = uid('mh');
  const name = s.scenes[i].title || K().elements.find((e) => e.id === tm.item)?.name || tm.item;
  return { clip: { id, source: 'REMOTE', mediaType: 'html', url, proxyUrl: null, thumbnailUrl: null, name, duration: dur, html: { width: s.size.w, height: s.size.h } },
    item: baseItem(id, dur, { customName: name, freeStart: r3(tm.from) }) };
};

// every layer editable: scene i = UIK.compose(…, { scene: i }) converted, its items placed at the
// scene's window on the bank's channels. opt.imageSizes = { url: {w, h} }, opt.url(path) → media URL.
// An HTML-only scene goes in as its HTML clip: opt.htmlUrls[i] = that scene page's URL.
MU.veLayers = (scenario, opt = {}) => {
  const s = MU.normalize(scenario);
  if (s.engine === '3d') throw new Error('a 3D-engine film goes into the Video Editor as HTML scenes: export glea-html');
  const timing = MU.timing(s);
  const clips = []; const banks = [[], []]; const approx = new Set();
  const htmlOnly = new Set(MU.htmlOnlyScenes(s));
  timing.forEach((tm, i) => {
    if (htmlOnly.has(i)) {
      const url = (opt.htmlUrls || [])[i];
      if (!url) throw new Error(`veLayers: scene ${i + 1} (${tm.item}) goes in as its HTML clip — pass its page URL in opt.htmlUrls[${i}]`);
      const bank = banks[bankOf(timing, i)];
      if (!bank[0]) bank[0] = { id: uid('mc'), name: 'Scene', visible: true, unsnapped: true, items: [] };
      const h = htmlClip(s, tm, i, url); clips.push(h.clip); bank[0].items.push(h.item);
      approx.add(`scene ${i + 1} (${tm.item}): an HTML clip — the item is too heavy for editor layers`);
      return;
    }
    const spec = K().compose(s, { scene: i });
    const { preset, report } = K().toVE(spec, { theme: s.theme, accent: s.accent, colors: s.colors, videoSize: s.size, imageSizes: opt.imageSizes });
    report.approx.forEach((a) => approx.add(a));
    for (const c of preset.sequence.clips) clips.push(Object.assign({}, c, c.url && opt.url ? { url: opt.url(c.url) } : {}));
    const bank = banks[bankOf(timing, i)];
    preset.sequence.channels.forEach((ch, j) => {
      if (!bank[j]) bank[j] = { id: uid('mc'), name: ch.name, visible: true, unsnapped: true, items: [] };
      else if (!bank[j].name.includes(ch.name)) bank[j].name = `${bank[j].name} · ${ch.name}`.slice(0, 60);
      for (const it of ch.items) bank[j].items.push(Object.assign({}, it, { freeStart: r3(tm.from) }));
    });
  });
  // bank 0 under bank 1 (a later scene fades in on top); channel names stay short
  const channels = [...banks[0], ...banks[1]].map((ch) => Object.assign(ch, { name: ch.name.split(' · ')[0] }));
  const vo = voiceChannel(opt.voice);
  if (vo) { clips.push(...vo.clips); channels.unshift(vo.channel); }
  const fx = sfxChannels(opt.sfx);
  if (fx) { clips.push(...fx.clips); channels.unshift(...fx.channels); }
  return { name: s.name, data: state(s, clips, channels), approx: [...approx] };
};

// one HTML clip per scene: opt.htmlUrls[i] = the scene page's media URL (MU.pageHtml(…, { scene: i }))
MU.veHtmlCards = (scenario, opt = {}) => {
  const s = MU.normalize(scenario);
  const timing = MU.timing(s);
  const clips = []; const banks = [{ id: uid('mc'), name: 'Scenes', visible: true, unsnapped: true, items: [] }];
  if (timing.some((t) => t.from < t.start)) banks.push({ id: uid('mc'), name: 'Scenes (fades)', visible: true, unsnapped: true, items: [] });
  timing.forEach((tm, i) => {
    const url = (opt.htmlUrls || [])[i];
    if (!url) throw new Error(`veHtmlCards: no page URL for scene ${i + 1}`);
    const h = htmlClip(s, tm, i, url); clips.push(h.clip); banks[bankOf(timing, i)].items.push(h.item);
  });
  const channels = banks.filter((b) => b.items.length);
  const vo = voiceChannel(opt.voice);
  if (vo) { clips.push(...vo.clips); channels.unshift(vo.channel); }
  const fx = sfxChannels(opt.sfx);
  if (fx) { clips.push(...fx.clips); channels.unshift(...fx.channels); }
  return { name: s.name, data: state(s, clips, channels), approx: [] };
};

// the editor's project bundle (POST /api/moodboards/{id}/video-projects/import): project.json + media/<rel>
// — media URLs inside are /media/<rel>, which the import copies into the board and remaps
MU.veBundle = (project, media) => MU.zip([
  { name: 'project.json', data: JSON.stringify({ version: 1, kind: 've-project-export', name: project.name, data: project.data }, null, 1) },
  ...media.map((m) => ({ name: 'media/' + m.rel, data: m.data })),
]);

// ── After Effects ──
// the pictures sit next to the script in assets/: returns { jsx, files: { url: 'assets/x' }, approx,
// renders }. An HTML-only scene is FOOTAGE: renders = [{ scene, file: 'assets/scene-N.mov', duration }]
// the exporter records (ProRes 4444 with alpha, MU.pageHtml(…, { scene })) next to the script.
MU.aeScript = (scenario, opt = {}) => {
  const s = MU.normalize(scenario);
  if (s.engine === '3d') throw new Error('a 3D-engine film has no After Effects export (its scenes are HTML pages): render it, or export glea-html');
  const timing = MU.timing(s);
  const skip = MU.footageScenes(s);
  const spec = K().compose(s, { skip });
  const files = {}; const taken = new Set();
  const walk = (L) => { if (L.img && !files[L.img]) { let b = String(L.img).split('/').pop().split('?')[0] || 'picture.png'; while (taken.has(b)) b = '1-' + b; taken.add(b); files[L.img] = 'assets/' + b; } (L.ch || []).forEach(walk); };
  K().build(spec).forEach(walk);
  const renders = skip.map((i) => ({ scene: i, file: `assets/scene-${i + 1}.mov`, start: timing[i].from, duration: r3(timing[i].to - timing[i].from),
    name: s.scenes[i].title || K().elements.find((e) => e.id === timing[i].item)?.name || timing[i].item }));
  const out = K().toAE(spec, { theme: s.theme, accent: s.accent, colors: s.colors, fps: s.fps, name: s.name, videoSize: s.size, imageSizes: opt.imageSizes, files, footage: renders });
  return { jsx: out.jsx, files, renders, layers: out.layers, approx: out.approx.concat(renders.map((r) => `scene ${r.scene + 1} (${r.name}): pre-rendered footage — the item is HTML-only`)) };
};

// ── zip (stored, no compression — media is compressed already) ──
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
const bytes = (d) => (typeof d === 'string' ? new TextEncoder().encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d));
MU.zip = (entries) => {
  const parts = []; const central = []; let off = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255]; const u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const e of entries) {
    const name = bytes(e.name); const data = bytes(e.data); const crc = crc32(data);
    const head = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
    parts.push(new Uint8Array(head), name, data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
    off += head.length + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  const all = [...parts, ...central, end]; const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let p = 0; for (const b of all) { out.set(b, p); p += b.length; }
  return out;
};
})();
