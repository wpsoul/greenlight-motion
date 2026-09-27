/* GreenLight Motion — the preview's element picker, inside a scene page (only the preview loads it).
 *
 * The preview (the parent page) plays the scene in a frame that takes no pointer events: it asks this page what is
 * under the pointer, where an element is, and what it is, and draws the hover and selection boxes itself.
 *
 *   window.__glEditor.at(x, y)        → the id of the element drawn at page point (x, y), or null
 *   window.__glEditor.rect(id)        → its box on the page { left, top, right, bottom } (null when it isn't drawn)
 *   window.__glEditor.info(id)        → { id, kind, tag, label, text, textEditable, image, svg, natural: { … } }
 *   window.__glEditor.chain(id)       → the ids around it, outermost first (where it sits)
 *   window.__glEditor.editText(id, { onInput(text), onDone(text, cancelled) })   inline typing on the element
 *
 * An id is the element's data-gl (the tools stamp one on every element of a scene's HTML; a library scene's engine
 * stamps its layer key), or a path under the nearest stamped element: "12/0/3" (overrides.js reads the same).
 * kind: 'text' | 'image' | 'shape' | 'drawing' | 'group'. natural: the element's own values, without the user's edits.
 */
(function () {
'use strict';
const W = window;
if (W.__glEditor) return;
const doc = W.document;
const ITEM = W.__glSceneKind === 'item';
// every element can be picked, whatever the page says about pointer events (the frame itself takes none)
const pickable = () => {
  if (doc.getElementById('gl-pick')) return;
  const st = doc.createElement('style'); st.id = 'gl-pick';
  st.textContent = 'html *{pointer-events:auto!important}[contenteditable="true"]{outline:none!important;cursor:text!important;-webkit-user-select:text!important;user-select:text!important}';
  (doc.head || doc.documentElement).appendChild(st);
};
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', pickable); else pickable();

const esc = (id) => String(id).replace(/["\\]/g, '\\$&');
const find = (id) => {
  const [head, ...path] = String(id).split('/');
  try { return doc.querySelector(`[data-gl="${esc(head)}"]` + path.map((n) => ` > :nth-child(${(parseInt(n, 10) || 0) + 1})`).join('')); } catch (e) { return null; }
};
// an element → its id: its own data-gl, else its path under the nearest element that has one
const idOf = (el) => {
  if (!el || el.nodeType !== 1) return null;
  if (ITEM) { const n = el.closest('[data-gl]'); return n ? n.getAttribute('data-gl') : null; }
  const path = [];
  for (let x = el; x && x !== doc.body && x !== doc.documentElement; x = x.parentElement) {
    if (x.hasAttribute('data-gl')) return [x.getAttribute('data-gl'), ...path].join('/');
    path.unshift([...x.parentElement.children].indexOf(x));
  }
  return null;
};
// its box: the element's own; a library layer's node is a zero-size anchor, so its box is what it draws (its words, its
// fill, its outline, else its children's)
const union = (rs) => {
  const ok = rs.filter((r) => r && r.right - r.left > 0.5 && r.bottom - r.top > 0.5); if (!ok.length) return null;
  return { left: Math.min(...ok.map((r) => r.left)), top: Math.min(...ok.map((r) => r.top)), right: Math.max(...ok.map((r) => r.right)), bottom: Math.max(...ok.map((r) => r.bottom)) };
};
const boxOf = (el, depth = 0) => {
  if (!ITEM || !el.hasAttribute('data-gl')) { const r = el.getBoundingClientRect(); return r.width > 0.5 && r.height > 0.5 ? r : null; }
  const own = el.querySelector(':scope > .uik-t') || el.querySelector(':scope > .uik-b') || el.querySelector(':scope > canvas');
  if (own) return own.getBoundingClientRect();
  const svg = el.querySelector(':scope > svg');
  if (svg) return union([...svg.querySelectorAll('path, circle, rect, ellipse, line, polyline, polygon')].map((p) => p.getBoundingClientRect())) || svg.getBoundingClientRect();
  return depth > 8 ? null : union([...el.querySelectorAll(':scope > [data-gl], :scope > .uik-b > .uik-c > [data-gl]')].filter((k) => visible(k)).map((k) => boxOf(k, depth + 1)));
};
const visible = (el) => {
  let a = 1;
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    const cs = W.getComputedStyle(x);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    a *= parseFloat(cs.opacity); if (a < 0.05) return false;
  }
  return true;
};
// drawn: not see-through (an element that hasn't come in yet, or has gone, doesn't take the click), with a box
const shown = (el) => visible(el) && !!boxOf(el);
const SHAPES = new Set(['path', 'circle', 'rect', 'ellipse', 'line', 'polyline', 'polygon']);
const tagOf = (el) => el.tagName.toLowerCase();
const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim());
const bgImage = (el) => { const b = W.getComputedStyle(el).backgroundImage; const m = /url\(["']?([^"')]+)["']?\)/.exec(b || ''); return m ? m[1] : null; };
// the element that carries a library layer's words / fill (the engine draws them inside its node)
const textEl = (el) => (ITEM ? el.querySelector(':scope > .uik-t') : el);
const boxEl = (el) => (ITEM ? el.querySelector(':scope > .uik-b') || el : el);
function kindOf(el) {
  const t = tagOf(el);
  if (t === 'img' || t === 'image' || t === 'video') return 'image';
  if (t === 'canvas') return 'drawing';
  if (ITEM) {
    if (el.querySelector(':scope > .uik-t')) return 'text';
    if (el.querySelector(':scope > canvas')) return 'drawing';
    const b = el.querySelector(':scope > .uik-b');
    if (b && (bgImage(b) || b.querySelector('img'))) return 'image';
    if (b || el.querySelector(':scope > svg')) return 'shape';
    return 'group';
  }
  if (bgImage(el)) return 'image';
  if (ownText(el)) return 'text';
  if (SHAPES.has(t) || t === 'svg') return 'shape';
  const cs = W.getComputedStyle(el);
  const painted = (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
  return painted || !el.children.length ? 'shape' : 'group';
}
// the element's own values, read with the user's edits switched off for a moment
function natural(el, kind) {
  const tag = doc.getElementById('gl-edits');
  const was = tag ? tag.disabled : null;
  if (tag) tag.disabled = true;
  try {
    const te = textEl(el) || el, be = boxEl(el);
    const ct = W.getComputedStyle(te), cb = W.getComputedStyle(be), svg = el instanceof W.SVGElement;
    const fs = parseFloat(ct.fontSize) || 16;
    const ls = ct.letterSpacing === 'normal' ? 0 : (parseFloat(ct.letterSpacing) || 0) / fs;
    const shapeSvg = ITEM ? el.querySelector(':scope > svg path') : null;
    return {
      color: ct.color, size: Math.round(fs * 10) / 10, weight: parseInt(ct.fontWeight, 10) || 400, ls: Math.round(ls * 1000) / 1000,
      upper: ct.textTransform === 'uppercase', italic: ct.fontStyle === 'italic', font: ct.fontFamily,
      fill: svg ? W.getComputedStyle(el).fill : cb.backgroundColor,
      stroke: svg ? W.getComputedStyle(el).stroke : shapeSvg ? W.getComputedStyle(shapeSvg).stroke : null,
      r: parseFloat(cb.borderTopLeftRadius) || 0,
      x: 0, y: 0, scale: 1, rotate: 0, hide: false,
    };
  } finally { if (tag) tag.disabled = was; }
}
const imageOf = (el) => {
  const t = tagOf(el);
  if (t === 'img' || t === 'video') return el.currentSrc || el.getAttribute('src') || '';
  if (t === 'image') return el.getAttribute('href') || el.getAttribute('xlink:href') || '';
  if (ITEM) { const b = el.querySelector(':scope > .uik-b'); const im = b && b.querySelector('img'); return im ? im.src : (b && bgImage(b)) || ''; }
  return bgImage(el) || '';
};
const words = (el) => String((textEl(el) || el).textContent || '').replace(/\s+/g, ' ').trim();

W.__glEditor = {
  at(x, y) {
    for (const el of doc.elementsFromPoint(x, y)) {
      if (el === doc.documentElement || el === doc.body || !shown(el)) continue;
      const id = idOf(el); if (id) return id;
    }
    return null;
  },
  rect(id) {
    const el = find(id); if (!el || !visible(el)) return null;
    const r = boxOf(el); if (!r) return null;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  },
  info(id) {
    const el = find(id); if (!el) return null;
    // its own words / picture from before the user's edits replaced them (overrides.js keeps them)
    const kind = kindOf(el), o = (W.__glOriginal && W.__glOriginal(el)) || {};
    return {
      id, kind, tag: tagOf(el), label: el.getAttribute('data-ui-label') || el.getAttribute('aria-label') || el.getAttribute('alt') || '',
      text: kind === 'text' ? words(el) : '', originalText: o.text != null ? o.text : null,
      textEditable: kind === 'text' && (ITEM || !el.children.length),
      image: kind === 'image' ? imageOf(el) : '', originalImage: o.image != null ? (/^url\(/.test(o.image) ? (/url\(["']?([^"')]+)/.exec(o.image) || [])[1] || '' : o.image) : null,
      svg: el instanceof W.SVGElement || (ITEM && !!el.querySelector(':scope > svg')),
      imageKey: el.getAttribute('data-image') || null,
      natural: natural(el, kind),
    };
  },
  chain(id) {
    const out = [];
    for (let x = find(id); x && x !== doc.body && x !== doc.documentElement; x = x.parentElement) {
      const i = idOf(x); if (i && (ITEM ? x.hasAttribute('data-gl') : true) && !out.includes(i)) out.unshift(i);
    }
    return out;
  },
  editText(id, { onInput, onDone } = {}) {
    const el = find(id); if (!el) return false;
    const t = textEl(el); if (!t || (!ITEM && el.children.length)) return false;
    const before = t.textContent;
    if (!ITEM && W.__glKeep) W.__glKeep(t, 'text', before);   // the page's own words, for a reset later
    W.__glEditing = t;
    t.setAttribute('contenteditable', 'true'); t.setAttribute('spellcheck', 'false');
    t.focus();
    const range = doc.createRange(); range.selectNodeContents(t);
    const s = W.getSelection(); s.removeAllRanges(); s.addRange(range);
    const input = () => { if (onInput) onInput(t.textContent); };
    const end = (cancel) => {
      t.removeEventListener('input', input); t.removeEventListener('keydown', key); t.removeEventListener('blur', blur);
      t.removeAttribute('contenteditable'); t.removeAttribute('spellcheck');
      if (cancel) t.textContent = before;
      W.__glEditing = null;
      try { W.getSelection().removeAllRanges(); } catch (e) { /* nothing selected */ }
      if (onDone) onDone(t.textContent, !!cancel);
    };
    const key = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); end(false); }
      else if (e.key === 'Escape') { e.preventDefault(); end(true); }
    };
    const blur = () => end(false);
    t.addEventListener('input', input); t.addEventListener('keydown', key); t.addEventListener('blur', blur);
    return true;
  },
};
})();
