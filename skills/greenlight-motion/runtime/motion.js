/* GreenLight Motion — the film runtime, shared by the pages (browser) and the tools (node).
 *
 * A film is a list of scenes, each an HTML page:
 *   · { html: 'scenes/intro.html' } — any page the agent writes (references/scenes.md)
 *   · { item: 'coupon-ticket' }     — a ready-made scene from the library, drawn by its engine (window.UIK)
 * Everything here is a pure function of the scenario + the sources, so the preview's buttons and the agent's CLI
 * make the same files:
 *   MU.normalize(scenario, { edits })   → defaults filled in, the user's edits applied
 *   MU.applyEdits(scenario, edits)      → an edits overlay merged into the scenario's own fields
 *   MU.timing(scenario)                 → every scene's start / end and visible window
 *   MU.sceneTheme(scenario)             → the colours (CSS variables --gl-*) and font every scene gets
 *   MU.tokens(scenario)                 → the film's colours and font, for the Design panel
 *   MU.scenePage(scenario, i, sources, { hosted, editor })   → scene i as a page
 *   MU.plan(scenario, sources, opt)     → the player's plan (GLPlayer): timing + every scene page
 *   MU.pageHtml(scenario, sources, opt) → the whole film as one page (renders), or scene opt.scene alone
 *   MU.glea(scenario, opt)              → a GreenLight Dash Video Editor project: one HTML clip per scene
 *   MU.gleaBundle(project, media), MU.zip(entries)
 *   MU.pageSources(doc, scenes)          → the sources in a page the tools built (its script tags)
 * sources = { clock, overrides, kit, player, editor?, three?, scenes: [page source per scene],
 *             easings, engine, film, files: { 'elements-x.js': text } } — the library's scripts for item scenes.
 * Scenario format: references/scenario.md.
 */
(function () {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const MU = root.MU = root.MU || {};
const K = () => root.UIK;
const r3 = (v) => Math.round(v * 1000) / 1000;
const plain = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);
const safe = (src) => String(src).replace(/<\/(script)/gi, '<\\/$1');
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

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
  return scenes.map((_, i) => (recorded[i].length ? recorded[i] : written[i]).join(' '));
};

MU.slug = (s) => String(s || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'film';

// The user's changes from the preview (scenario.edits) — an overlay the agent can read, fold or clear:
//   { film: { theme, accent, background, colors: { name: hex }, recolor: { hex: hex }, font },
//     scenes: { "<scene number>": { text: { id: s }, style: { id: { prop: v } }, images: { id: url }, params: { name: v } } } }
// id = an element's data-gl id. Merged into the scenario's own fields (the same names), key by key.
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
      for (const [id, st] of Object.entries(e.style)) if (plain(st)) o.style[id] = Object.assign({}, plain(o.style[id]), st);
    }
    return o;
  });
  return s;
};

const COLOR_NAME = /^[a-z][a-z0-9-]*$/i;
MU.normalize = (scenario, opt = {}) => {
  let s = Object.assign({}, scenario);
  if (opt.edits !== false && s.edits) s = MU.applyEdits(s, s.edits);
  delete s.edits;
  s.name = s.name || 'GreenLight Motion film';
  s.id = MU.slug(s.id || s.name);
  const size = s.size || {};
  s.size = { w: Math.max(16, Math.round(size.w || 1920)), h: Math.max(16, Math.round(size.h || 1080)) };
  s.fps = Math.max(1, Math.min(120, Math.round(s.fps || 30)));
  s.theme = s.theme === 'dark' ? 'dark' : 'light';
  s.accent = s.accent || null;
  // the film's colours by name: the theme's tokens (ink, card, acc …) and any names of its own (every scene gets them
  // as --gl-<name>); library colours swapped (recolor); its font
  const colors = {};
  for (const [k, v] of Object.entries(plain(s.colors) || {})) if (COLOR_NAME.test(k) && typeof v === 'string' && v) colors[k] = v;
  s.colors = Object.keys(colors).length ? colors : null;
  const recolor = {};
  for (const [k, v] of Object.entries(plain(s.recolor) || {})) if (/^#[0-9a-f]{3,8}$/i.test(k) && typeof v === 'string' && v) recolor[k.toUpperCase()] = v;
  s.recolor = Object.keys(recolor).length ? recolor : null;
  s.font = s.font && K().FONTS && K().FONTS[s.font] && s.font !== K().FONT_DEFAULT ? s.font : null;
  // background: a CSS colour, 'theme' (the theme's canvas colour) or null / 'transparent'
  s.background = s.background === 'theme' ? K().THEMES[s.theme].bg : (s.background && s.background !== 'transparent' ? s.background : null);
  // motion: the feel of the library scenes (references/motion.md — spring by default; 'authored' = as built)
  s.motion = s.motion || K().MOTION_DEFAULT || 'spring';
  s.scenes = (s.scenes || []).map((sc) => Object.assign({ transition: 'cut' }, sc, sc.html && !(Number(sc.duration) > 0) ? { duration: 4 } : {}));
  s.voiceover = s.voiceover || null;
  return s;
};
MU.timing = (scenario) => K().filmTiming(MU.normalize(scenario));
MU.kindOf = (scene) => (scene && scene.html ? 'html' : 'item');

// ── colours and font ──
// every theme token (with the film's own values) plus the film's own colour names, and the font
MU.sceneTheme = (scenario) => {
  const s = MU.normalize(scenario);
  K().setTheme(s.theme, s.accent, s.colors);
  const th = K().theme(); const tokens = {};
  for (const k of K().TOKENS) tokens[k] = th[k];
  for (const [k, v] of Object.entries(s.colors || {})) tokens[k] = v;
  if (s.background) tokens.bg = s.background;
  return { tokens, font: { stack: K().fontOf(s.font).stack, url: s.font ? K().fontUrl(s.font) : null } };
};
MU.tokens = (scenario) => {
  const s = MU.normalize(scenario);
  const th = MU.sceneTheme(s).tokens;
  const ROLE = { bg: 'canvas', card: 'surface', panel: 'panel', ink: 'text', inv: 'text on accent', muted: 'secondary text', line: 'hairlines',
    skel: 'skeleton', soft: 'soft fill', dim: 'dim fill', acc: 'accent', bad: 'error', shade: 'scrim', white: 'white' };
  const colors = Object.entries(th).map(([name, value]) => ({ name: name === 'acc' ? 'accent' : name, token: name, value, role: ROLE[name] || 'the film\'s colour', uses: 1 }));
  if (s.background) colors.unshift({ name: 'background', token: 'bg', value: s.background, role: 'film background', uses: 1 });
  return { theme: s.theme, accent: th.acc, colors, fonts: [{ family: s.font || K().FONT_DEFAULT, stack: K().fontOf(s.font).stack, note: s.font ? 'the film\'s font' : 'the default font', styles: [] }] };
};

// ── pages ──
// a page with `head` put first in its <head>
const inHead = (doc, head) => {
  const src = String(doc || '');
  if (/<head[^>]*>/i.test(src)) return src.replace(/<head[^>]*>/i, (m) => m + head);
  if (/<html[^>]*>/i.test(src)) return src.replace(/<html[^>]*>/i, (m) => m + '<head>' + head + '</head>');
  return '<!doctype html><html><head>' + head + '</head><body>' + src + '</body></html>';
};
// scene i as a page. hosted: played by the player (no real-time play of its own); editor: the preview's element picker
MU.scenePage = (scenario, i, sources, opt = {}) => {
  const s = MU.normalize(scenario);
  const sc = s.scenes[i]; if (!sc) throw new Error(`scenePage: no scene ${i + 1}`);
  const tm = MU.timing(s)[i];
  const edits = { style: sc.style || {}, text: sc.text || {}, images: sc.images || {} };
  const editor = opt.editor && sources.editor ? `<script>${safe(sources.editor)}</script>` : '';
  if (sc.html) {
    const doc = (sources.scenes || [])[i] || '';
    const boot = { kind: 'html', hosted: !!opt.hosted, theme: MU.sceneTheme(s), images: sc.images || {}, params: sc.params || {}, duration: tm.duration, frame: s.size };
    const three = sources.three && /\bTHREE\b/.test(doc) ? `<script>${safe(sources.three)}</script>` : '';
    return inHead(doc, `<script>window.__glScene=${json(boot)};window.__glSceneKind="html";window.__glEdits=${json(edits)};</script>`
      + `<script>${safe(sources.clock)}</script><script>${safe(sources.overrides)}</script><script>${safe(sources.kit)}</script>${three}${editor}`
      + '<style>html,body{margin:0;background:transparent}</style>');
  }
  // a library scene: its item on its own clock (the other scenes keep only their timing), drawn by the engine
  const tmAll = MU.timing(s);
  const one = Object.assign({}, s, { scenes: s.scenes.map((x, j) => Object.assign({}, x, { duration: tmAll[j].duration })) });
  const spec = K().compose(one, { scene: i });
  const file = spec.film.scenes[0].file;
  if (!sources.files || !sources.files[file]) throw new Error(`scenePage: no source for ${file}`);
  const page = K().toHTML(spec, { theme: s.theme, accent: s.accent, colors: s.colors, sources: { easings: sources.easings, engine: sources.engine, film: sources.film, files: [sources.files[file]] } });
  return inHead(page, `<script>window.__glSceneKind="item";window.__glEdits=${json({ style: sc.style || {} })};</script><script>${safe(sources.overrides)}</script>${editor}`);
};
// the sources in a page the tools built: every script it carries is tagged data-mu-src (tools/page.mjs)
MU.pageSources = (doc, scenes) => {
  const text = (n) => { const el = doc.querySelector(`script[data-mu-src="${n}"]`); return el ? el.textContent : undefined; };
  const files = {};
  for (const n of (K() && K().FILES) || []) { const t = text(n); if (t !== undefined) files[n] = t; }
  const out = { clock: text('clock.js'), overrides: text('overrides.js'), kit: text('scene.js'), player: text('player.js'), editor: text('editor.js'),
    three: text('three.js'), easings: text('easings.js'), engine: text('engine.js'), film: text('film.js'), files, scenes: scenes || [] };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
};
// the player's plan: the timing and every scene page
MU.plan = (scenario, sources, opt = {}) => {
  const s = MU.normalize(scenario);
  const timing = MU.timing(s);
  return {
    W: s.size.w, H: s.size.h, fps: s.fps, T: timing.length ? timing[timing.length - 1].end : 0, background: s.background,
    scenes: timing.map((tm, i) => ({ kind: MU.kindOf(s.scenes[i]), title: s.scenes[i].title || '', start: tm.start, end: tm.end, from: tm.from, to: tm.to,
      fadeIn: tm.from < tm.start, fadeOut: tm.to > tm.end, duration: tm.duration,
      page: MU.scenePage(s, i, sources, { hosted: true, editor: !!opt.editor }) })),
  };
};
MU.pageHtml = (scenario, sources, opt = {}) => {
  let s = MU.normalize(scenario);
  if (opt.background !== undefined) s = Object.assign({}, s, { background: opt.background });
  if (opt.scene != null) return MU.scenePage(s, opt.scene, sources, { hosted: false });
  if (!sources.player) throw new Error('pageHtml: the film page needs sources.player (player.js)');
  if (!root.GLPlayer) throw new Error('pageHtml: player.js is not loaded');
  return root.GLPlayer.filmPage(MU.plan(s, sources), sources.player);
};

// ── the GreenLight Dash Video Editor: one HTML clip per scene ──
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
// scenes joined by a fade overlap: they alternate between two channels, so no channel holds two clips at once
MU.glea = (scenario, opt = {}) => {
  const s = MU.normalize(scenario);
  const timing = MU.timing(s);
  const clips = []; const banks = [{ id: uid('mc'), name: 'Scenes', visible: true, unsnapped: true, items: [] }];
  const fades = timing.some((t) => t.from < t.start);
  if (fades) banks.push({ id: uid('mc'), name: 'Scenes (fades)', visible: true, unsnapped: true, items: [] });
  timing.forEach((tm, i) => {
    const url = (opt.htmlUrls || [])[i];
    if (!url) throw new Error(`glea: no page URL for scene ${i + 1}`);
    const dur = r3(tm.to - tm.from); const id = uid('mh');
    const name = s.scenes[i].title || (s.scenes[i].item ? (K().elements.find((e) => e.id === s.scenes[i].item) || {}).name : '') || `Scene ${i + 1}`;
    clips.push({ id, source: 'REMOTE', mediaType: 'html', url, proxyUrl: null, thumbnailUrl: null, name, duration: dur, html: { width: s.size.w, height: s.size.h } });
    banks[fades ? i % 2 : 0].items.push(baseItem(id, dur, { customName: name, freeStart: r3(tm.from) }));
  });
  const channels = banks.filter((b) => b.items.length);
  const vo = voiceChannel(opt.voice);
  if (vo) { clips.push(...vo.clips); channels.unshift(vo.channel); }
  const fx = sfxChannels(opt.sfx);
  if (fx) { clips.push(...fx.clips); channels.unshift(...fx.channels); }
  return { name: s.name, data: state(s, clips, channels) };
};
// the editor's project bundle (POST /api/moodboards/{id}/video-projects/import): project.json + media/<rel>
// — media URLs inside are /media/<rel>, which the import copies into the board and remaps
MU.gleaBundle = (project, media) => MU.zip([
  { name: 'project.json', data: JSON.stringify({ version: 1, kind: 've-project-export', name: project.name, data: project.data }, null, 1) },
  ...media.map((m) => ({ name: 'media/' + m.rel, data: m.data })),
]);

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
