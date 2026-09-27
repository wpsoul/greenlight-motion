/* GreenLight Motion — the user's edits on a scene page. Every element the user changed in the preview is addressed by
 * its data-gl id (the tools stamp one on every element of a scene's HTML; a library item's engine stamps its layer key),
 * or by a path under one ("12/0/3": child 0, then child 3, of element 12) for an element a script made.
 *
 *   window.__glEdits = { style: { id: { … } }, text: { id: 'new text' }, images: { id: 'url' } }   (before this runs)
 *   window.__glApplyEdits(edits)   the same, live
 *
 * style: color, fill (background / SVG fill), stroke, size (px), weight, ls (em), upper, italic, font, r (radius px),
 *   x, y (px, added to the element's own motion), scale, rotate (deg), hide. Every rule is !important, so an edit wins
 *   over the page's own animation of that property, in the preview, in renders and in exports. A colour is any CSS
 *   colour or one of the film's colours by name ('acc', 'ink', 'acc/40' = 40 % opacity): it follows the film's theme.
 * text / images: set on the element (text on an element without child elements; images on <img>, SVG <image>, or as
 *   the background picture), and set again whenever the page's scripts change it.
 * On a library item's page (window.__glSceneKind = 'item') only style applies here: its text and pictures are the
 * item's own data.
 */
(function () {
'use strict';
const W = window;
if (W.__glApplyEdits) return;
let E = W.__glEdits || {};
const ITEM = W.__glSceneKind === 'item';
const esc = (id) => String(id).replace(/["\\]/g, '\\$&');
// "12" → [data-gl="12"]; "12/0/3" → [data-gl="12"] > :nth-child(1) > :nth-child(4)
const selector = (id) => {
  const [head, ...path] = String(id).split('/');
  return `[data-gl="${esc(head)}"]` + path.map((n) => ` > :nth-child(${(parseInt(n, 10) || 0) + 1})`).join('');
};
const find = (id) => { try { return document.querySelector(selector(id)); } catch (e) { return null; } };
const num = (v) => (Number.isFinite(+v) ? +v : 0);
const clean = (v) => String(v).replace(/[;{}<>]/g, '');
// the film's colour by name → the page's variable (a library scene resolves it with its own theme)
const TOKEN = /^([a-z][a-z0-9-]*)(?:\/(\d+(?:\.\d+)?))?$/i;
const colour = (v) => {
  const s = clean(v), m = TOKEN.exec(s); if (!m) return s;
  const K = W.UIK;
  if (ITEM && K && K._int) { try { const c = K._int.resolve(s); if (c) return K._int.css(c); } catch (e) { /* not a colour of the film */ } return s; }
  const ref = `var(--gl-${m[1]}, ${m[1]})`;
  return m[2] == null ? ref : `color-mix(in srgb, ${ref} ${m[2]}%, transparent)`;
};

function rules() {
  const out = [];
  for (const [id, st] of Object.entries(E.style || {})) {
    if (!st || typeof st !== 'object') continue;
    const s = selector(id), I = ' !important';
    const own = [], txt = [], box = [], svg = [];
    // position, scale, rotation: the individual properties add to the element's own (animated) transform
    if (st.x != null || st.y != null) own.push(`translate:${num(st.x)}px ${num(st.y)}px${I}`);
    if (st.scale != null) own.push(`scale:${num(st.scale)}${I}`);
    if (st.rotate != null) own.push(`rotate:${num(st.rotate)}deg${I}`);
    if (st.hide) own.push(`visibility:hidden${I}`);
    const T = ITEM ? txt : own;
    if (st.color != null) T.push(`color:${colour(st.color)}${I}`);
    if (st.size != null) T.push(`font-size:${num(st.size)}px${I}`);
    if (st.weight != null) T.push(`font-weight:${num(st.weight)}${I}`);
    if (st.ls != null) T.push(`letter-spacing:${num(st.ls)}em${I}`);
    if (st.upper != null) T.push(`text-transform:${st.upper ? 'uppercase' : 'none'}${I}`);
    if (st.italic != null) T.push(`font-style:${st.italic ? 'italic' : 'normal'}${I}`);
    if (st.font != null) T.push(`font-family:${clean(st.font)}${I}`);
    const B = ITEM ? box : own;
    if (st.fill != null) { B.push(`background-color:${colour(st.fill)}${I}`); if (!ITEM) own.push(`fill:${colour(st.fill)}${I}`); }
    if (st.r != null) B.push(`border-radius:${num(st.r)}px${I}`);
    if (st.stroke != null) (ITEM ? svg : own).push(`stroke:${colour(st.stroke)}${I}`);
    if (own.length) out.push(`${s}{${own.join(';')}}`);
    if (txt.length) out.push(`${s} > .uik-t{${txt.join(';')}}`);
    if (box.length) out.push(`${s} > .uik-b{${box.join(';')}}`);
    if (svg.length) out.push(`${s} > svg path{${svg.join(';')}}`);
  }
  return out.join('\n');
}
function applyStyle() {
  let tag = document.getElementById('gl-edits');
  if (!tag) { tag = document.createElement('style'); tag.id = 'gl-edits'; (document.head || document.documentElement).appendChild(tag); }
  const css = rules();
  if (tag.textContent !== css) tag.textContent = css;
}
// an element's own words and picture, kept the first time an edit replaces them: dropping the edit puts them back
// (window.__glOriginal(el) → { text, image } for the preview's picker; __glKeep(el, what, v) for the scene kit's pictures)
const originals = new WeakMap();
const keep = (el, what, v) => { const o = originals.get(el) || {}; if (!(what in o)) { o[what] = v; originals.set(el, o); } };
W.__glKeep = keep;
W.__glOriginal = (el) => originals.get(el) || {};
const picOf = (el) => (el.tagName === 'IMG' ? el.getAttribute('src') || '' : el.tagName.toLowerCase() === 'image' ? el.getAttribute('href') || '' : el.style.backgroundImage || '');
const setPic = (el, u, raw) => {
  if (el.tagName === 'IMG') { if (el.getAttribute('src') !== u) el.setAttribute('src', u); }
  else if (el.tagName.toLowerCase() === 'image') { if (el.getAttribute('href') !== u) el.setAttribute('href', u); }
  else { const v = raw ? u : `url("${u.replace(/"/g, '%22')}")`; if (el.style.backgroundImage !== v) { el.style.backgroundImage = v; if (!raw) { el.style.backgroundSize = el.style.backgroundSize || 'cover'; el.style.backgroundPosition = el.style.backgroundPosition || 'center'; } } }
};
let applying = false, textEls = new Set(), picEls = new Set();
function applyContent() {
  if (ITEM || applying) return;
  applying = true;
  try {
    const texts = new Set(), pics = new Set();
    for (const [id, t] of Object.entries(E.text || {})) {
      const el = find(id); if (!el || el.children.length) continue;
      texts.add(el);
      if (el === W.__glEditing) continue;   // being typed in the preview
      if (el.textContent !== String(t)) { keep(el, 'text', el.textContent); el.textContent = String(t); }
    }
    for (const [id, url] of Object.entries(E.images || {})) {
      const el = find(id); if (!el) continue;
      pics.add(el); keep(el, 'image', picOf(el)); setPic(el, String(url));
    }
    for (const el of textEls) if (!texts.has(el) && el !== W.__glEditing && 'text' in (originals.get(el) || {})) el.textContent = originals.get(el).text;
    for (const el of picEls) if (!pics.has(el) && 'image' in (originals.get(el) || {})) setPic(el, originals.get(el).image, true);
    textEls = texts; picEls = pics;
  } finally { applying = false; }
}
function apply() { applyStyle(); applyContent(); }
W.__glApplyEdits = (edits) => { E = edits || {}; apply(); };
W.__glGetEdits = () => E;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
// the page's scripts may make or change elements later (letters split for a stagger, a typed line): apply again
const watch = () => { try { new MutationObserver(() => { if (!applying) applyContent(); }).observe(document.body, { childList: true, subtree: true, characterData: true }); } catch (e) { /* no body yet */ } };
if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
})();
