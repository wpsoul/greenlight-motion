// GL Motion site capture: everything site.json says about the page, read from the live DOM.
// Run by render/capture.py, and sent to the app's /api/site-capture under a board.
() => {
  // whitespace collapsed; a text shown twice (an animated heading's copy, "Sign in Sign in") once
  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/^(.{3,}?) \1$/, '$1');
  const short = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n) > n * 0.6 ? s.lastIndexOf(' ', n) : n).replace(/[\s,;:–—-]+$/, '') + '…');
  // some of its text is on screen (not only screen-reader text clipped to 1 px)
  const seen = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const rg = document.createRange();
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue;
      rg.selectNodeContents(n); const r = rg.getBoundingClientRect();
      if (r.width >= 2 && r.height >= 2) return true;
    }
    return false;
  };
  const abs = (u) => { try { return u ? new URL(u, document.baseURI).href : null; } catch (e) { return null; } };
  const meta = (sel) => { const m = document.querySelector(sel); const v = m && clean(m.getAttribute('content')); return v || null; };
  const shown = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05;
  };
  const out = {};
  out.title = clean(document.title) || meta('meta[property="og:title"]') || '';
  out.description = meta('meta[name="description"]') || meta('meta[property="og:description"]') || meta('meta[name="twitter:description"]') || '';
  out.ogImage = abs(meta('meta[property="og:image"]') || meta('meta[property="og:image:url"]') || meta('meta[name="twitter:image"]'));
  out.themeColor = meta('meta[name="theme-color"]');

  // headings: every h1, then h2s — up to 12, trimmed, no repeats
  const heads = []; const seenH = new Set();
  for (const sel of ['h1', 'h2']) for (const h of document.querySelectorAll(sel)) {
    if (heads.length >= 12) break;
    if (!shown(h) || !seen(h)) continue;
    const t = short(clean(h.innerText || h.textContent), 140);
    if (!t || seenH.has(t.toLowerCase())) continue;
    seenH.add(t.toLowerCase()); heads.push(t);
  }
  out.headings = heads;

  // navigation link texts (nav, role=navigation, then the header)
  const links = []; const seenL = new Set();
  for (const root of document.querySelectorAll('nav, [role="navigation"], header')) {
    for (const a of root.querySelectorAll('a')) {
      if (links.length >= 12) break;
      if (!shown(a) || !seen(a)) continue;
      const t = clean(a.innerText || a.textContent);
      if (!t || t.length > 40 || seenL.has(t.toLowerCase())) continue;
      seenL.add(t.toLowerCase()); links.push(t);
    }
  }
  out.links = links;

  // colours: every colour string → sRGB through a 1×1 canvas (oklch, color(), named colours all work)
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgbCache = new Map();
  const rgba = (c) => {
    if (!c || c === 'transparent' || c === 'none' || c.startsWith('url(')) return null;
    if (rgbCache.has(c)) return rgbCache.get(c);
    let v = null;
    try {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#00000000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      v = d[3] > 0 ? { r: d[0], g: d[1], b: d[2], a: d[3] / 255 } : null;   // ImageData is not premultiplied
    } catch (e) { v = null; }
    rgbCache.set(c, v); return v;
  };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('').toUpperCase();
  const grey = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) < 26;
  const tally = new Map(); const all = new Map();
  const add = (map, c, w) => { if (!c || c.a < 0.5 || !(w > 0)) return; const k = hex(c); map.set(k, (map.get(k) || 0) + w); };
  const vw = document.documentElement.clientWidth || innerWidth;
  const REGION = innerHeight * 3;   // the top of the page is the brand's face
  const BTN = 'button, [role="button"], input[type="submit"], input[type="button"], a[class*="btn" i], a[class*="button" i], [class*="cta" i]';
  const els = document.body ? document.body.querySelectorAll('*') : [];
  let n = 0;
  for (const el of els) {
    if (++n > 6000) break;
    if (el.closest('svg') && !(el instanceof SVGGraphicsElement)) continue;
    const r = el.getBoundingClientRect();
    const top = r.top + scrollY;
    if (r.width < 1 || r.height < 1 || top > REGION || r.bottom + scrollY < 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) continue;
    // painted area, the first screen counting fully and the rest of the region at a third
    const wide = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    const span = (a, b) => Math.max(0, Math.min(top + r.height, b) - Math.max(top, a));
    const area = wide * (span(0, innerHeight) + span(innerHeight, REGION) / 3);
    const isBtn = el.matches(BTN);
    const boost = isBtn ? 6 : 1;
    if (el instanceof SVGGraphicsElement) {
      if (el.tagName.toLowerCase() !== 'svg') { const f = rgba(cs.fill); add(tally, f, area * 0.5); add(all, f, area * 0.5); }
      continue;
    }
    const bg = rgba(cs.backgroundColor);
    add(tally, bg, area * boost); add(all, bg, area);
    const bi = cs.backgroundImage;
    if (bi && bi.includes('gradient')) for (const m of bi.matchAll(/(rgba?\([^)]*\)|color\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\)|lab\([^)]*\)|lch\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b)/gi)) add(tally, rgba(m[1]), area * 0.4 * boost);
    if (isBtn) { const bc = rgba(cs.borderTopColor); if (parseFloat(cs.borderTopWidth) > 0) add(tally, bc, (r.width + r.height) * 2 * 40); }
    // text: glyph area of the element's own text
    let chars = 0;
    for (const t of el.childNodes) if (t.nodeType === 3) chars += t.textContent.trim().length;
    if (chars) { const fs = parseFloat(cs.fontSize) || 16; const tc = rgba(cs.color); const w = Math.min(chars, 400) * fs * fs * 0.55 * (isBtn ? 4 : 1); add(tally, tc, w); add(all, tc, w * 0.2); }
  }
  // merge near colours (the heavier one names the group), drop greys
  const merged = [];
  for (const [k, w] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    const c = rgba(k); if (!c || grey(c)) continue;
    const near = merged.find((m) => Math.hypot(m.c.r - c.r, m.c.g - c.g, m.c.b - c.b) < 30);
    if (near) near.w += w; else merged.push({ k, c, w });
  }
  merged.sort((a, b) => b.w - a.w);
  out.colors = merged.slice(0, 6).map((m) => m.k);
  // the page's own background (greys included): body / html, else the largest painted area
  const own = rgba(getComputedStyle(document.body || document.documentElement).backgroundColor) || rgba(getComputedStyle(document.documentElement).backgroundColor);
  const bigBg = [...all.entries()].sort((a, b) => b[1] - a[1])[0];
  out.background = own ? hex(own) : (bigBg ? bigBg[0] : '#FFFFFF');

  // logo: an <img> / <svg> named "logo" (class, id, alt, src, aria-label — or its link's), best in the header
  const named = (el) => { for (let e = el, i = 0; e && i < 4; e = e.parentElement, i++) { const s = [e.getAttribute('class'), e.id, e.getAttribute('alt'), e.getAttribute('aria-label'), e.getAttribute('title'), e.tagName === 'IMG' ? e.getAttribute('src') : ''].join(' '); if (/logo|wordmark/i.test(s)) return 3 - Math.min(i, 2); } return 0; };
  const cands = [];
  for (const el of document.querySelectorAll('img, svg')) {
    if (el.parentElement && el.parentElement.closest('svg')) continue;
    if (!shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.height < 8 || r.width > 800) continue;
    let score = named(el);
    const home = el.closest('a[href="/"], a[href="./"], a[href="' + location.origin + '/"], a[href="' + location.origin + '"]');
    if (!score && home && el.closest('header, nav')) score = 2;
    if (!score) continue;
    if (el.closest('header, nav, [role="banner"]')) score += 2;
    if (r.top + scrollY < 200) score += 1;
    cands.push({ el, score, top: r.top });
  }
  cands.sort((a, b) => b.score - a.score || a.top - b.top);
  let logo = null;
  for (const { el } of cands) {
    if (el.tagName.toLowerCase() === 'img') { logo = abs(el.currentSrc || el.getAttribute('src')); if (logo) break; continue; }
    // an inline <svg>: self-contained (no <use> of a sprite), as a data URL with its colour baked in
    if (el.querySelector('use')) continue;
    const c = el.cloneNode(true);
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const r = el.getBoundingClientRect();
    if (!c.getAttribute('width')) c.setAttribute('width', String(Math.round(r.width)));
    if (!c.getAttribute('height')) c.setAttribute('height', String(Math.round(r.height)));
    c.setAttribute('style', `color:${getComputedStyle(el).color}`);
    const s = new XMLSerializer().serializeToString(c);
    if (s.length > 60000) continue;
    logo = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
    break;
  }
  // icons: apple-touch-icon, else the largest declared icon
  const sizeOf = (l) => { const s = String(l.getAttribute('sizes') || ''); if (/any/i.test(s)) return 10000; const m = s.match(/(\d+)x(\d+)/i); return m ? +m[1] : (/\.svg(\?|$)/i.test(l.getAttribute('href') || '') ? 5000 : 16); };
  const touch = [...document.querySelectorAll('link[rel~="apple-touch-icon" i], link[rel~="apple-touch-icon-precomposed" i]')].sort((a, b) => sizeOf(b) - sizeOf(a))[0];
  const icon = [...document.querySelectorAll('link[rel~="icon" i]')].sort((a, b) => sizeOf(b) - sizeOf(a))[0];
  out.icon = abs(touch && touch.getAttribute('href')) || abs(icon && icon.getAttribute('href')) || null;
  out.logo = logo || out.icon;
  out.height = Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0);
  return out;
}
