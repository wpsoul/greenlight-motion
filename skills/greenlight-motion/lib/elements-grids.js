/* UI Motion Kit — grids elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, photo, k, enter, exit, pop, popIn, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// a fade-only entry (hairlines, slots — things that should not scale or blur in)
const fadeIn = (t, dur = 0.3) => enter(t, { blur: 0, s: 1, dur });
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => +(+v).toFixed(3);
// a closed circle for Trim Paths, from 12 o'clock clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// the moment an eased move a → b over [t0, t1] passes v (frame cuts under a scrubbing playhead, hover hand-offs)
const cross = (t0, t1, a, b, v, e = 'Power2 Smooth') => {
  const f = UIK.ease(e); let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, x = a + (b - a) * f(m); if ((b - a) * (v - x) > 0) lo = m; else hi = m; }
  return r3(t0 + (t1 - t0) * hi);
};
// liquid indicator for an edge-pinned rect: the leading edge travels fast, the trailing edge follows late.
// x (or y with axis: 'y') = the pinned edge, one eased segment; w (or h) is sampled into short Linear segments.
const edges = (t, L0, R0, L1, R1, o = {}) => {
  const fwd = (L1 + R1) > (L0 + R0), fast = o.fast ?? 0.32, slow = o.slow ?? 0.48, lag = o.lag ?? 0.08, n = o.n ?? 10;
  const f = UIK.ease('Power3 Out'), at = (tt, a, b, t0, d) => a + (b - a) * f(Math.min(1, Math.max(0, (tt - t0) / d)));
  const Lf = (tt) => (fwd ? at(tt, L0, L1, t + lag, slow) : at(tt, L0, L1, t, fast));
  const Rf = (tt) => (fwd ? at(tt, R0, R1, t, fast) : at(tt, R0, R1, t + lag, slow));
  const end = t + lag + slow, s = [];
  for (let j = 1; j <= n; j++) { const a = t + (end - t) * (j - 1) / n, b = t + (end - t) * j / n; s.push([r3(a), r3(b), r1(Rf(b) - Lf(b)), 'Linear']); }
  const pos = [fwd ? [t + lag, t + lag + slow, L1, 'Power3 Out'] : [t, t + fast, L1, 'Power3 Out']];
  return o.axis === 'y' ? { y: pos, h: s } : { x: pos, w: s };
};
// photo on a card: composition 9 (stripes) has a `card` background and would lose its edge on a card
const cardPhoto = (o) => photo(o.v === 9 && o.fill == null ? Object.assign({ fill: 'soft' }, o) : o);
// a spinner: a trimmed ring turning at one revolution per 0.7 s
const spinner = (o) => path({ id: o.id, x: o.x || 0, y: o.y || 0, d: ring(o.R), stroke: o.color || 'ink', sw: o.sw || 4, trimmed: true, trimE: 30,
  k: { rot: [[o.t0, o.t1, 360 * Math.max(1, Math.round((o.t1 - o.t0) / 0.7)), 'Linear']] } });

// 1 ─ Masonry load: columns drop in one after another, Load more pushes a new row in from below
UIK.define({
  id: 'masonry-load', name: 'Masonry load more', cat: 'gallery', T: 3.9, cam: 1.02,
  desc: 'A four-column masonry of photos drops in column by column. Load more is clicked: a spinner turns, then a new row of photos rises in under the uneven columns and pushes the grid up under the header while the count ticks to 28.',
  build: () => {
    const CX = [-414, -138, 138, 414], CW = 256, G = 20, TOP = -300, C = 1.7, L = 2.15, S = 200, BY0 = 320;
    const COLS = [[[280, 3], [200, 7]], [[200, 2], [320, 5]], [[340, 1], [170, 8]], [[220, 6], [250, 9]]];
    const NEW = [[240, 2], [180, 4], [220, 7], [260, 3]];
    const photos = [], added = [];
    let maxB = 0;
    COLS.forEach((col, c) => {
      let y = TOP;
      col.forEach(([h, v], j) => {
        const cy = y + h / 2;
        photos.push(cardPhoto({ id: `photo${c}${j}`, v, x: CX[c], y: cy, w: CW, h, r: 20, k: enter(0.3 + c * 0.13 + j * 0.07, { dy: -70, y0: cy, s: 1, blur: 4, dur: 0.34 }) }));
        y += h + G;
      });
      const [h, v] = NEW[c], cy = y + h / 2;
      added.push(cardPhoto({ id: 'new' + c, v, x: CX[c], y: cy, w: CW, h, r: 20, k: enter(L + c * 0.06, { dy: 90, y0: cy, s: 0.96, blur: 6, dur: 0.36 }) }));
      maxB = Math.max(maxB, y + h);
    });
    const BY1 = maxB + G + 38;
    return [
      rect({ id: 'card', w: 1160, h: 860, r: 44, fill: 'card', shadow: 1, clip: true, k: popIn(0.1), ch: [
        group({ id: 'scroll', k: { y: [[L, L + 0.75, -S, 'Power4 Out']] }, ch: [
          ...photos, ...added,
          rect({ id: 'more', y: BY0, w: 240, h: 76, r: 38, fill: 'soft', k: k(fadeIn(0.95), press(C), { y: [[L, L + 0.75, BY1, 'Power4 Out']] }), ch: [
            text({ id: 'moreLbl', text: 'Load more', size: 28, weight: 600, k: exit(C + 0.02, { dur: 0.1 }) }),
            group({ id: 'loading', k: k(enter(C + 0.04, { d: 0.02 }), exit(L + 0.35)), ch: [
              spinner({ id: 'spin', x: -58, R: 13, sw: 4, t0: C + 0.04, t1: L + 0.5 }),
              text({ text: 'Loading', x: -32, ax: 0, size: 28, weight: 600 }),
            ] }),
            text({ id: 'moreLbl2', text: 'Load more', size: 28, weight: 600, k: enter(L + 0.4) }),
          ] }),
        ] }),
        rect({ id: 'headerBand', y: -395, w: 1160, h: 150, fill: 'card' }),
        rect({ id: 'hairline', y: -320, w: 1160, h: 2, fill: 'line', k: { opacity: [0, [L + 0.1, L + 0.4, 1, 'Power2 Out']] } }),
        text({ id: 'title', text: 'Moodboard', x: -542, y: -372, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.2, { dx: -16, x0: -542 }) }),
        text({ id: 'count24', text: '24 photos', x: 542, y: -372, ax: 1, size: 26, color: 'muted', k: k(enter(0.28), exit(L + 0.1)) }),
        text({ id: 'count28', text: '28 photos', x: 542, y: -372, ax: 1, size: 26, color: 'muted', k: enter(L + 0.1) }),
      ] }),
      cursorLayer([[0, 640, 450], [1.05, 640, 450], [C - 0.1, 40, BY0 + 24], [C + 0.25, 40, BY0 + 24], [3.1, 380, 440]], [C], [], { inAt: 1.0 }),
    ];
  },
});

// 2 ─ Grid ⇄ list: the view toggle morphs a photo grid into a list of thumbnails and back
UIK.define({
  id: 'grid-list-morph', name: 'Grid ⇄ list', cat: 'gallery', T: 4.3, cam: 1.08,
  desc: 'The view toggle is clicked: each photo of a 3×2 grid shrinks and crops to a square thumbnail as it glides to the left of its row, and titles, meta and dates fade in beside them. The grid button morphs everything back.',
  build: () => {
    const C1 = 1.2, C2 = 2.75, GX = [-330, 0, 330], GY = [-88, 152], LX = -468, LY = (i) => -212 + i * 100, SC = r3(80 / 220), E = 'Expo Out', D = 0.7;
    const ITEMS = [
      { v: 1, t: 'Ridge at dusk', m: '4032 × 3024 · 3.1 MB', d: 'Sep 12' },
      { v: 2, t: 'Studio portrait', m: '3000 × 4000 · 2.4 MB', d: 'Sep 10' },
      { v: 3, t: 'Downtown, 6 am', m: '4032 × 3024 · 3.8 MB', d: 'Sep 9' },
      { v: 5, t: 'Low tide', m: '6000 × 4000 · 5.2 MB', d: 'Sep 6' },
      { v: 7, t: 'Monstera', m: '3024 × 3024 · 1.9 MB', d: 'Aug 30' },
      { v: 8, t: 'Courtyard arch', m: '4032 × 3024 · 2.7 MB', d: 'Aug 28' },
    ];
    const photos = ITEMS.map((it, i) => {
      const gx = GX[i % 3], gy = GY[Math.floor(i / 3)], a = C1 + 0.06 + i * 0.04, b = C2 + 0.1 + (5 - i) * 0.04;
      return photo({ id: 'photo' + i, v: it.v, x: gx, y: gy, w: 300, h: 220, r: 26,
        k: k(enter(0.3 + (i % 3 + Math.floor(i / 3)) * 0.06, { s: 0.9, blur: 6 }), {
          x: [[a, a + D, LX, E], [b, b + D, gx, E]], y: [[a, a + D, LY(i), E], [b, b + D, gy, E]],
          scale: [[a, a + D, SC, E], [b, b + D, 1, E]], w: [[a, a + D, 220, E], [b, b + D, 300, E]] }) });
    });
    const rows = ITEMS.map((it, i) => group({ id: 'row' + i, y: LY(i), k: k(enter(C1 + 0.42 + i * 0.05, { dx: -16, x0: 0, s: 1 }), exit(C2, { dur: 0.12 })), ch: [
      text({ text: it.t, x: -404, y: -16, ax: 0, size: 28, weight: 600 }),
      text({ text: it.m, x: -404, y: 20, ax: 0, size: 22, color: 'muted' }),
      text({ text: it.d, x: 508, ax: 1, size: 24, color: 'muted' }),
      i < 5 ? rect({ y: 50, w: 1016, h: 2, fill: 'line' }) : null,
    ].filter(Boolean) }));
    const flip = (a, b) => ({ color: [[C1, C1 + 0.2, a, 'Power2 Out'], [C2, C2 + 0.2, b, 'Power2 Out']] });
    return [
      rect({ id: 'card', w: 1100, h: 780, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'Library', x: -508, y: -322, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.2, { dx: -16, x0: -508 }) }),
        text({ id: 'count', text: '6 photos', x: -340, y: -318, ax: 0, size: 26, color: 'muted', k: enter(0.28) }),
        rect({ id: 'toggle', x: 420, y: -322, w: 184, h: 76, r: 38, fill: 'soft', k: enter(0.3, { blur: 0 }), ch: [
          rect({ id: 'knob', x: -44, w: 84, h: 60, r: 30, fill: 'card', shadow: 3,
            k: { x: [[C1, C1 + 0.45, 44, 'Power4 Out'], [C2, C2 + 0.45, -44, 'Power4 Out']],
                 w: [[C1, C1 + 0.16, 116, 'Power2 Out'], [C1 + 0.16, C1 + 0.55, 84, 'Power3 Out'], [C2, C2 + 0.16, 116, 'Power2 Out'], [C2 + 0.16, C2 + 0.55, 84, 'Power3 Out']] } }),
          icon({ id: 'gridIcon', icon: 'grid', x: -44, size: 30, sw: 2.4, color: 'ink', k: flip('muted', 'ink') }),
          icon({ id: 'listIcon', icon: 'list', x: 44, size: 30, sw: 2.4, color: 'muted', k: flip('ink', 'muted') }),
        ] }),
        ...rows,
        ...photos,
      ] }),
      cursorLayer([[0, 600, 400], [0.55, 600, 400], [C1 - 0.1, 478, -306], [C1 + 0.2, 478, -306], [2.1, 560, -220], [C2 - 0.1, 392, -306], [C2 + 0.2, 392, -306], [3.9, 560, -120]],
        [C1, C2], [], { inAt: 0.5 }),
    ];
  },
});

// 3 ─ Filter reflow: a category chip shrinks the other photos out and the matches glide into the gaps
UIK.define({
  id: 'filter-reflow', name: 'Filter reflow', cat: 'gallery', T: 3.3,
  cam: { zoom: 1.1, y: -40, k: { zoom: [[1.65, 2.3, 1.25, 'Power2 Smooth']], y: [[1.65, 2.3, -135, 'Power2 Smooth']] } },
  desc: 'The Nature chip is clicked: the ink indicator stretches over to it, the photos that don’t match shrink out with a blur, the four matches glide into the gaps on the first row and the card tightens round them as the count drops to 4.',
  build: () => {
    const F = 1.3, TOP = -380, GX = [-390, -130, 130, 390], GY = [330, 530];
    const CHIPS = [['All', -510, 96], ['Nature', -402, 136], ['City', -254, 108], ['People', -134, 136]];
    const ITEMS = [[3, 0], [1, 1], [2, 0], [8, 0], [7, 1], [6, 0], [5, 1], [0, 1]];   // [v, matches Nature]
    let gone = 0, moved = 0;
    const photos = ITEMS.map(([v, keep], i) => {
      const x = GX[i % 4], y = GY[Math.floor(i / 4)], kin = enter(0.34 + (i % 4 + Math.floor(i / 4)) * 0.05, { s: 0.9, blur: 6 });
      if (!keep) {
        const t = F + 0.05 + gone++ * 0.03;
        return photo({ id: 'photo' + i, v, x, y, w: 240, h: 180, r: 18,
          k: k(kin, { scale: [[t, t + 0.28, 0.7, 'Power2 In']], opacity: [[t, t + 0.28, 0, 'Power2 In']], blur: [[t, t + 0.28, 8, 'Power2 In']] }) });
      }
      const s = moved++, m = F + 0.16 + s * 0.04;
      return photo({ id: 'photo' + i, v, x, y, w: 240, h: 180, r: 18,
        k: k(kin, s === i ? null : { x: [[m, m + 0.65, GX[s], 'Power4 Out']], y: [[m, m + 0.65, GY[0], 'Power4 Out']] }) });
    });
    return [
      group({ id: 'gallery', k: popIn(0.1), ch: [
        rect({ id: 'card', y: TOP, pin: 't', chAt: 'pin', w: 1140, h: 690, r: 44, fill: 'card', shadow: 1, k: { h: [[F + 0.35, F + 0.95, 490, 'Power4 Out']] }, ch: [
          text({ id: 'title', text: 'Explore', x: -510, y: 66, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.2, { dx: -16, x0: -510 }) }),
          text({ id: 'count8', text: '8 photos', x: 510, y: 68, ax: 1, size: 26, color: 'muted', k: k(enter(0.28), exit(F + 0.1)) }),
          text({ id: 'count4', text: '4 photos', x: 510, y: 68, ax: 1, size: 26, color: 'muted', k: enter(F + 0.12) }),
          group({ id: 'chips', y: 146, k: enter(0.3, { blur: 0, s: 1, dy: 10, y0: 146 }), ch: [
            ...CHIPS.map(([s, x, w]) => rect({ id: 'chip' + s, x: x + w / 2, w, h: 60, r: 30, fill: 'soft' })),
            rect({ id: 'indicator', x: -510, pin: 'l', w: 96, h: 60, r: 30, fill: 'ink', k: k(edges(F + 0.02, -510, -414, -402, -266), press(F, { to: 0.97 })) }),
            ...CHIPS.map(([s, x, w]) => text({ id: 'lbl' + s, text: s, x: x + w / 2, size: 26, weight: 500, color: '#FFFFFF', blend: 'difference' })),
          ] }),
          ...photos,
        ] }),
      ] }),
      cursorLayer([[0, 600, 330], [0.6, 600, 330], [F - 0.1, -318, TOP + 162], [F + 0.25, -318, TOP + 162], [2.6, 170, 70]], [F], [], { inAt: 0.55 }),
    ];
  },
});

// 4 ─ Bento reveal: mixed tiles build in on a stagger, then one photo tile takes over the layout
UIK.define({
  id: 'bento-reveal', name: 'Bento reveal', cat: 'gallery', T: 3.5, cam: 1.05,
  desc: 'A bento grid builds in tile by tile — photos, a stat tile with an accent trend chip, an ink story tile and a See all tile. The tall portrait tile is clicked and expands to fill the whole layout, uncropping as the other tiles sink away, and a caption card rises in.',
  build: () => {
    const X = 1.75, E = 'Expo Out';
    const tin = (t, y) => enter(t, { s: 0.9, blur: 8, dy: 24, y0: y });
    const away = (d) => ({ opacity: [[X + 0.1 + d, X + 0.45 + d, 0, 'Power2 Out']], scale: [[X + 0.05 + d, X + 0.6 + d, 0.94, 'Power3 Out']] });
    return [
      photo({ id: 'tileA', v: 1, x: -340, y: -130, w: 660, h: 500, r: 32, k: k(tin(0.15, -130), away(0.04)) }),
      rect({ id: 'tileStat', x: 170, y: -260, w: 320, h: 240, r: 32, fill: 'card', k: k(tin(0.23, -260), away(0)), ch: [
        text({ text: 'Saves this week', x: -130, y: -70, ax: 0, size: 24, color: 'muted', k: enter(0.36) }),
        text({ text: '12.4k', x: -133, y: -4, ax: 0, size: 76, weight: 600, ls: -0.03, tnum: false, k: enter(0.4) }),
        rect({ id: 'trend', x: -71, y: 70, w: 118, h: 44, r: 22, fill: 'acc/12', k: pop(0.5, { from: 0.6 }), ch: [
          icon({ icon: 'trend', x: -30, size: 22, sw: 2.4, color: 'acc' }),
          text({ text: '+18%', x: -12, ax: 0, size: 22, weight: 600, color: 'acc' }),
        ] }),
      ] }),
      rect({ id: 'tileStory', x: 170, y: 0, w: 320, h: 240, r: 32, fill: 'ink', k: k(tin(0.39, 0), away(0.02)), ch: [
        text({ text: 'Autumn edit', x: -130, y: -62, ax: 0, size: 34, weight: 600, ls: -0.02, color: 'inv', k: enter(0.5) }),
        text({ text: 'Warm light, long shadows and quiet streets.', x: -130, y: 18, ax: 0, size: 22, lh: 1.35, wrap: 256, color: 'inv/70', k: enter(0.56) }),
      ] }),
      photo({ id: 'tileE', v: 9, x: -510, y: 260, w: 320, h: 240, r: 32, k: k(tin(0.47, 260), away(0.08)) }),
      photo({ id: 'tileF', v: 5, x: 0, y: 260, w: 660, h: 240, r: 32, k: k(tin(0.55, 260), away(0.05)) }),
      rect({ id: 'tileAll', x: 510, y: 260, w: 320, h: 240, r: 32, fill: 'card', k: k(tin(0.63, 260), away(0.03)), ch: [
        circle({ x: 92, y: -52, d: 72, fill: 'ink', k: pop(0.78, { from: 0.5 }), ch: [icon({ icon: 'arrow', size: 32, sw: 2.8, color: 'inv', rot: -45 })] }),
        text({ text: 'See all', x: -130, y: 40, ax: 0, size: 32, weight: 600, ls: -0.02, k: enter(0.74) }),
        text({ text: '86 photos', x: -130, y: 78, ax: 0, size: 22, color: 'muted', k: enter(0.8) }),
      ] }),
      // the tall tile is built at the full layout size and starts cropped to its cell — expanding = uncropping
      photo({ id: 'tilePortrait', v: 2, x: 510, y: -130, w: 1340, h: 760, r: 32,
        k: k(tin(0.31, -130), press(X), { w: [320, [X + 0.05, X + 0.85, 1340, E]], h: [500, [X + 0.05, X + 0.85, 760, E]],
          x: [[X + 0.05, X + 0.85, 0, E]], y: [[X + 0.05, X + 0.85, 0, E]] }), ch: [
          rect({ id: 'caption', x: -366, y: 270, w: 520, h: 132, r: 30, fill: 'card', shadow: 2, k: enter(X + 0.55, { dy: 24, y0: 270 }), ch: [
            text({ text: 'Studio portraits', x: -226, y: -20, ax: 0, size: 34, weight: 600, ls: -0.02 }),
            text({ text: '24 photos · Updated today', x: -226, y: 22, ax: 0, size: 22, color: 'muted' }),
            circle({ x: 200, d: 72, fill: 'ink', k: pop(X + 0.7, { from: 0.5 }), ch: [icon({ icon: 'arrow', size: 32, sw: 2.8, color: 'inv' })] }),
          ] }),
          circle({ id: 'closeBtn', x: 594, y: -304, d: 64, fill: 'card', k: pop(X + 0.62, { from: 0.5 }), ch: [icon({ icon: 'x', size: 28, sw: 2.6, color: 'ink' })] }),
        ] }),
      cursorLayer([[0, 700, 440], [0.9, 700, 440], [X - 0.1, 540, -110], [X + 0.3, 540, -110], [3.2, 720, 330]], [X], [], { inAt: 0.85 }),
    ];
  },
});

// 5 ─ Lightbox: a thumbnail grows into a lightbox over a shade, the arrow slides to the next photo, close shrinks it home
UIK.define({
  id: 'lightbox-open', name: 'Lightbox', cat: 'gallery', T: 4.2, cam: 1.0,
  desc: 'A thumbnail is clicked and grows into a centred lightbox while a shade dims the grid. The next arrow slides the following photo in (the counter rolls 5 → 6, the caption swaps), then close shrinks the lightbox back down onto that photo’s own thumbnail.',
  build: () => {
    const O = 1.05, N = 2.15, X = 3.1, E = 'Expo Out', LW = 1200, LH = 760, LY = -20, S0 = r3(240 / LW);
    const TX = [-390, -130, 130, 390], TY = [-150, 22, 194];
    const V = [1, 3, 7, 2, 9, 0, 8, 6, 5, 2, 7, 3];
    const thumbs = V.map((v, i) => {
      const c = i % 4, r = Math.floor(i / 4);
      const steps = i === 5 ? { opacity: [[O, 0], [X + 0.02, 1]] } : i === 6 ? { opacity: [[X, 0], [X + 0.55, 1]] } : null;
      return cardPhoto({ id: 'thumb' + i, v, x: TX[c], y: TY[r], w: 240, h: 152, r: 12, k: k(enter(0.28 + (c + r) * 0.05, { s: 0.9, blur: 6 }), steps, i === 5 ? press(O) : null) });
    });
    const chrome = (t) => k(enter(O + t), exit(X));
    return [
      rect({ id: 'card', w: 1140, h: 680, r: 44, fill: 'card', shadow: 1, k: k(popIn(0.1), { blur: [[O + 0.05, O + 0.4, 6, 'Power2 Out'], [X + 0.05, X + 0.4, 0, 'Power2 Out']] }), ch: [
        text({ id: 'title', text: 'Trip to Porto', x: -510, y: -278, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.2, { dx: -16, x0: -510 }) }),
        text({ id: 'count', text: '12 photos', x: 510, y: -278, ax: 1, size: 26, color: 'muted', k: enter(0.28) }),
        ...thumbs,
      ] }),
      rect({ id: 'backdrop', w: 4000, h: 3000, fill: 'shade/72', offscreen: true, k: { opacity: [0, [O, O + 0.35, 1, 'Power2 Out'], [X + 0.05, X + 0.45, 0, 'Power2 Out']] } }),
      // the lightbox starts as an exact scaled copy of the thumbnail and grows from it
      rect({ id: 'lightbox', x: TX[1], y: TY[1], w: LW, h: LH, r: 52, fill: 'shade', clip: true, scale: S0,
        k: { opacity: [0, [O, 1], [X + 0.55, 0]],
             x: [[O, O + 0.62, 0, E], [X + 0.02, X + 0.55, TX[2], 'Power4 Out']], y: [[O, O + 0.62, LY, E], [X + 0.02, X + 0.55, TY[1], 'Power4 Out']],
             scale: [[O, O + 0.62, 1, E], [X + 0.02, X + 0.55, S0, 'Power4 Out']] }, ch: [
          group({ id: 'slides', k: { x: [[N + 0.04, N + 0.64, -(LW + 40), 'Power4 Out']] }, ch: [
            photo({ id: 'big5', v: V[5], w: LW, h: LH, r: 0 }),
            photo({ id: 'big6', v: V[6], x: LW + 40, w: LW, h: LH, r: 0 }),
          ] }),
        ] }),
      group({ id: 'counter', x: -600, y: -454, k: chrome(0.35), ch: [
        text({ id: 'idx', text: `{{{COUNTER:5-6; start=${N + 0.06}; duration=0.44; turns=0}}}`, size: 28, weight: 600, color: '#FFFFFF' }),
        text({ text: '/ 12', x: 18, ax: 0, size: 28, weight: 600, color: '#FFFFFF' }),
      ] }),
      text({ id: 'cap5', text: 'Sunrise over the Douro', y: 412, size: 30, weight: 600, color: '#FFFFFF', k: k(enter(O + 0.4), exit(N + 0.04)) }),
      text({ id: 'cap6', text: 'Courtyard, Rua das Flores', y: 412, size: 30, weight: 600, color: '#FFFFFF', k: k(enter(N + 0.2), exit(X)) }),
      circle({ id: 'prev', x: -690, y: LY, d: 88, fill: 'card', k: chrome(0.42), ch: [icon({ icon: 'chevronLeft', size: 36, sw: 2.8, color: 'ink' })] }),
      circle({ id: 'next', x: 690, y: LY, d: 88, fill: 'card', k: k(chrome(0.42), press(N)), ch: [icon({ icon: 'chevronRight', size: 36, sw: 2.8, color: 'ink' })] }),
      circle({ id: 'close', x: 690, y: -454, d: 72, fill: 'card', k: k(chrome(0.38), press(X)), ch: [icon({ icon: 'x', size: 30, sw: 2.8, color: 'ink' })] }),
      cursorLayer([[0, 620, 450], [0.5, 620, 450], [O - 0.1, -112, 40], [O + 0.2, -112, 40], [N - 0.1, 702, -4], [N + 0.25, 702, -4],
        [X - 0.12, 702, -440], [X + 0.2, 702, -440], [4.0, 380, 330]], [O, N, X], [], { inAt: 0.45 }),
    ];
  },
});

// 6 ─ Filmstrip scrub: the playhead is dragged along a filmstrip and the preview cuts frame by frame
UIK.define({
  id: 'filmstrip-scrub', name: 'Filmstrip scrub', cat: 'gallery', T: 4.0, cam: { zoom: 1.0, y: -58 },
  desc: 'The cursor grabs the accent playhead and scrubs it along a filmstrip, right then back: the preview above hard-cuts to whichever frame the playhead is over (timed to the drag’s easing) and its timecode chip follows.',
  build: () => {
    const CY = -58, PW = 1040, PH = 585, PY = -135 - CY, SY = 262 - CY, FW = 130, SL = -520, PS = 'Power2 Smooth';
    const V = [1, 5, 7, 3, 8, 2, 9, 6], TC = ['0:00', '0:03', '0:06', '0:09', '0:12', '0:15', '0:18', '0:21'];
    const D0 = 1.1, D1 = 2.2, E0 = 2.55, E1 = 3.3, X0 = -470, X1 = 330, X2 = -60, KY = SY - 64;
    // [t, frame] — the playhead x is keyed exactly like the cursor, so the cuts land where it crosses a frame edge
    const cuts = [[0, 0]];
    for (let j = 1; j <= 6; j++) cuts.push([cross(D0, D1, X0, X1, SL + j * FW, PS), j]);
    for (const j of [6, 5, 4]) cuts.push([cross(E0, E1, X1, X2, SL + j * FW, PS), j - 1]);
    const steps = (f) => { let cur = cuts[0][1] === f ? 1 : 0; const o = [cur]; for (const [t, g] of cuts.slice(1)) { const v = g === f ? 1 : 0; if (v !== cur) { o.push([t, v]); cur = v; } } return o; };
    const shownF = V.map((_, f) => f).filter((f) => cuts.some((c) => c[1] === f));
    return [
      rect({ id: 'card', y: CY, w: 1140, h: 830, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        rect({ id: 'preview', y: PY, w: PW, h: PH, r: 28, fill: 'soft', clip: true, k: enter(0.2, { s: 0.96, blur: 6 }), ch: [
          ...shownF.map((f) => cardPhoto({ id: 'frame' + f, v: V[f], w: PW, h: PH, r: 0, k: { opacity: steps(f) } })),
          circle({ id: 'playBtn', d: 112, fill: 'card/90', k: k(pop(0.5, { from: 0.6 }), exit(D0 - 0.06, { s: 0.8 })), ch: [
            icon({ icon: 'play', x: 4, size: 44, sw: 2.4, color: 'ink', filled: true, fill: 'ink' }),
          ] }),
          rect({ id: 'tcChip', x: -PW / 2 + 84, y: PH / 2 - 50, w: 108, h: 48, r: 24, fill: 'card', k: enter(0.45, { blur: 0 }), ch:
            shownF.map((f) => text({ id: 'tc' + f, text: TC[f], size: 24, weight: 600, tnum: false, k: { opacity: steps(f) } })) }),
        ] }),
        rect({ id: 'strip', y: SY, w: 1040, h: 96, r: 16, fill: 'card', clip: true, ch: V.map((v, i) =>
          cardPhoto({ id: 'thumb' + i, v, x: SL + FW / 2 + i * FW, w: 126, h: 96, r: 0, k: enter(0.34 + i * 0.04, { dx: 20, x0: SL + FW / 2 + i * FW, blur: 4, s: 1 }) })) }),
        group({ id: 'playhead', x: X0, y: SY, k: k(pop(0.72, { from: 0.4 }), { x: [[D0, D1, X1, PS], [E0, E1, X2, PS]] }), ch: [
          rect({ id: 'phLine', w: 4, h: 128, r: 2, fill: 'acc' }),
          circle({ id: 'phKnob', y: -64, d: 26, fill: 'acc', stroke: '#FFFFFF', sw: 4, shadow: 3,
            k: { scale: [[D0 - 0.08, D0 + 0.1, 1.25, 'Power2 Out'], [E1, E1 + 0.3, 1, 'Power3 Out']] } }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 400], [0.55, 560, 400], [D0 - 0.12, X0 + 2, KY + CY + 4], [D0, X0 + 2, KY + CY + 4], [D1, X1 + 2, KY + CY + 4, PS],
        [E0, X1 + 2, KY + CY + 4], [E1, X2 + 2, KY + CY + 4, PS], [E1 + 0.15, X2 + 2, KY + CY + 4], [4.0, 180, 380]], [], [[D0, E1]], { inAt: 0.5 }),
    ];
  },
});

// 7 ─ Thumbnail rail: a vertical rail drives the main image; the ring slides down, the image crossfades with a zoom
UIK.define({
  id: 'thumbnail-rail', name: 'Thumbnail rail', cat: 'gallery', T: 3.8, cam: 1.1,
  desc: 'Clicking thumbnails on a vertical rail slides the ink ring down to them — its leading edge first, the trailing edge catching up — while the main image crossfades to the new photo settling from a slight zoom, and the page counter rolls 1 → 2 → 4.',
  build: () => {
    const C1 = 1.2, C2 = 2.4, RX = -470, TY = [-254, -127, 0, 127, 254], MX = 95, TV = [1, 8, 5, 3, 7];
    const top = (i) => TY[i] - 65, bot = (i) => TY[i] + 65;
    const lvl = (i) => {   // thumb opacity: active 1, others 0.5
      const on = i === 0 ? 1 : 0.5, a = 0.3 + i * 0.06, o = [0, [a, a + 0.3, on, 'Power2 Out']];
      if (i === 0) o.push([C1 + 0.04, C1 + 0.3, 0.5, 'Power2 Out']);
      if (i === 1) o.push([C1 + 0.04, C1 + 0.3, 1, 'Power2 Out'], [C2 + 0.04, C2 + 0.3, 0.5, 'Power2 Out']);
      if (i === 3) o.push([C2 + 0.04, C2 + 0.3, 1, 'Power2 Out']);
      return { opacity: o, x: [RX - 18, [a, a + 0.4, RX, 'Power3 Out']] };
    };
    const inA = (t) => ({ opacity: [0, [t + 0.05, t + 0.55, 1, 'Power2 Out']], scale: [1.08, [t + 0.05, t + 0.95, 1, 'Power3 Out']] });
    const outA = (t) => ({ scale: [[t + 0.05, t + 0.6, 1.04, 'Power2 Out']], opacity: [[t + 0.62, 0]] });
    return [
      rect({ id: 'card', w: 1180, h: 720, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        ...TV.map((v, i) => photo({ id: 'thumb' + i, v, x: RX, y: TY[i], w: 150, h: 110, r: 16, k: k(lvl(i), i === 1 ? press(C1) : i === 3 ? press(C2) : null) })),
        rect({ id: 'ring', x: RX, y: top(0), pin: 't', w: 170, h: 130, r: 24, stroke: 'ink', sw: 4,
          k: k(fadeIn(0.62), edges(C1 + 0.02, top(0), bot(0), top(1), bot(1), { axis: 'y' }), edges(C2 + 0.02, top(1), bot(1), top(3), bot(3), { axis: 'y', fast: 0.38, slow: 0.56 })) }),
        rect({ id: 'main', x: MX, w: 900, h: 620, r: 28, fill: 'soft', clip: true, k: enter(0.2, { s: 0.95, blur: 6 }), ch: [
          photo({ id: 'main0', v: TV[0], w: 900, h: 620, r: 0, k: outA(C1) }),
          photo({ id: 'main1', v: TV[1], w: 900, h: 620, r: 0, k: k(inA(C1), outA(C2)) }),
          photo({ id: 'main3', v: TV[3], w: 900, h: 620, r: 0, k: inA(C2) }),
          rect({ id: 'pager', x: -450 + 24 + 52, y: 310 - 24 - 26, w: 104, h: 52, r: 26, fill: 'card', k: enter(0.5, { blur: 0, s: 0.8 }), ch: [
            text({ id: 'page', text: '{{{COUNTER:1-4; style=roll; kf=1}}}', x: -24, size: 24, weight: 600,
              k: { 'ph:1': [0, [C1 + 0.06, C1 + 0.5, 33.333, 'Power3 Out'], [C2 + 0.06, C2 + 0.5, 100, 'Power3 Out']] } }),
            text({ text: '/ 5', x: -8, ax: 0, size: 24, weight: 600 }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 400], [0.6, 560, 400], [C1 - 0.1, RX + 18, TY[1] + 16], [C1 + 0.25, RX + 18, TY[1] + 16], [C2 - 0.1, RX + 18, TY[3] + 16], [C2 + 0.25, RX + 18, TY[3] + 16], [3.6, -250, 380]],
        [C1, C2], [], { inAt: 0.55 }),
    ];
  },
});

// 8 ─ Logo wall: cells flip one at a time in a scattered order to reveal new logos
UIK.define({
  id: 'logo-wall-flip', name: 'Logo wall flip', cat: 'gallery', T: 4.4, cam: { zoom: 1.12, y: 60 },
  desc: 'A 4×3 wall of generic logo tiles builds in on a diagonal stagger, then single cells flip one after another in a scattered order — each squashes flat on its vertical axis, swaps its logo while edge-on and opens back out with the new one.',
  build: () => {
    const GX = [-465, -155, 155, 465], GY = [-60, 110, 280];
    const NAMES = ['Kestrel', 'Basalt', 'Tidewell', 'Northcove', 'Fernway', 'Quillo', 'Halden', 'Ostara', 'Palisade', 'Brightfold', 'Mirelle', 'Corvid', 'Wrenfield', 'Emberly', 'Oakmere', 'Solvik'];
    const MARKS = [
      () => [circle({ d: 34, stroke: 'ink', sw: 7 })],
      () => [circle({ x: -8, d: 28, fill: 'ink' }), circle({ x: 8, d: 28, fill: 'ink/35' })],
      () => [rect({ w: 26, h: 26, r: 6, rot: 45, fill: 'ink' })],
      () => [path({ d: 'M0 -17 L18 14 L-18 14 Z', fill: 'ink' })],
      () => [icon({ icon: 'zap', size: 40, sw: 2.6 })],
      () => [icon({ icon: 'globe', size: 40, sw: 2.6 })],
      () => [icon({ icon: 'layers', size: 40, sw: 2.6 })],
      () => [icon({ icon: 'sparkle', size: 40, sw: 2.6 })],
      () => [path({ d: 'M-18 4 A18 18 0 0 1 18 4 Z', fill: 'ink' }), rect({ y: 12, w: 36, h: 6, r: 3, fill: 'ink' })],
      () => [rect({ x: -8, w: 11, h: 34, r: 5.5, fill: 'ink' }), rect({ x: 8, y: 6, w: 11, h: 22, r: 5.5, fill: 'ink' })],
      () => [icon({ icon: 'command', size: 40, sw: 2.6 })],
      () => [icon({ icon: 'shield', size: 40, sw: 2.6 })],
      () => [icon({ icon: 'cloud', size: 40, sw: 2.6 })],
      () => [-13, 0, 13].map((x, j) => circle({ x, y: j === 1 ? -6 : 4, d: 10, fill: 'ink' })),
      () => [rect({ w: 36, h: 36, r: 10, fill: 'ink', ch: [icon({ icon: 'plus', size: 24, sw: 3, color: 'inv' })] })],
      () => [icon({ icon: 'star', size: 40, sw: 2.6 })],
    ];
    const logo = (i, kk) => {
      const tw = NAMES[i].length * 16.2, x0 = -(52 + tw) / 2;
      return group({ id: 'logo' + i, k: kk, ch: [
        group({ x: x0 + 20, ch: MARKS[i]() }),
        text({ text: NAMES[i], x: x0 + 52, ax: 0, size: 30, weight: 600, ls: -0.02 }),
      ] });
    };
    // flips: [tile, new logo] — new logos first, then the ones flipped away earlier come back elsewhere
    const ORDER = [5, 10, 2, 8, 0, 11, 6, 3, 9], NEWL = [12, 13, 14, 15, 5, 10, 2, 8, 0];
    const flipAt = {}; ORDER.forEach((tile, j) => { flipAt[tile] = [1.0 + j * 0.3, NEWL[j]]; });
    const tiles = Array.from({ length: 12 }, (_, i) => {
      const c = i % 4, r = Math.floor(i / 4), x = GX[c], y = GY[r], fl = flipAt[i], t = fl ? fl[0] : 0, M = t + 0.17;
      return group({ id: 'tile' + i, x, y, k: k(enter(0.2 + (c + r) * 0.07, { s: 0.9, blur: 6, dy: 16, y0: y }),
        fl ? { sy: [[t, M, 0, 'Power2 In'], [M, t + 0.47, 1, 'Power3 Out']] } : null), ch: [
        rect({ w: 290, h: 150, r: 24, fill: 'card' }),
        logo(i, fl ? { opacity: [1, [M, 0]] } : null),
        fl ? logo(fl[1], { opacity: [0, [M, 1]] }) : null,
      ].filter(Boolean) });
    });
    return [
      text({ id: 'lead', text: 'Trusted by', x: -8, y: -200, ax: 1, size: 44, weight: 600, ls: -0.02, k: enter(0.1, { dy: 14, y0: -200 }) }),
      text({ id: 'leadNum', text: '2,400+ teams', x: 8, y: -200, ax: 0, size: 44, weight: 600, ls: -0.02, color: 'acc', k: enter(0.16, { dy: 14, y0: -200 }) }),
      ...tiles,
    ];
  },
});

// 9 ─ Upload slots: photos drop into dashed slots one by one, each slot's border fading as it fills
UIK.define({
  id: 'upload-slots', name: 'Upload slots', cat: 'gallery', T: 4.3, cam: 1.1,
  desc: 'An empty album of six dashed slots. Photos drop in one by one from above — shrinking onto the card with a small settle and a fading lift shadow — each slot’s dashed border fading as it fills while the counter rolls 0 → 6; the last one wipes the Create album button to the accent.',
  build: () => {
    const SX = [-320, 0, 320], SYs = [-110, 130], V = [7, 3, 2, 5, 1, 9], T0 = 0.9, GAP = 0.38;
    const at = (i) => r3(T0 + i * GAP), A = r3(at(5) + 0.62);
    const slots = V.map((_, i) => rect({ id: 'slot' + i, x: SX[i % 3], y: SYs[Math.floor(i / 3)], w: 300, h: 220, r: 22, stroke: 'dim', sw: 3, dash: true,
      k: k(fadeIn(0.3 + i * 0.05), { opacity: [[at(i) + 0.26, at(i) + 0.4, 0, 'Power2 Out']] }), ch: [icon({ icon: 'plus', size: 36, sw: 2.4, color: 'muted' })] }));
    const drops = V.map((v, i) => {
      const t = at(i), x = SX[i % 3], y = SYs[Math.floor(i / 3)];
      return group({ id: 'drop' + i, x, y, k: {
          opacity: [0, [t, t + 0.14, 1, 'Linear']], y: [y - 60, [t, t + 0.32, y, 'Power2 In']],
          scale: [1.1, [t, t + 0.32, 0.97, 'Power2 In'], [t + 0.32, t + 0.62, 1, 'Power3 Out']], rot: [i % 2 ? 3 : -3, [t, t + 0.5, 0, 'Power3 Out']] }, ch: [
        rect({ id: 'lift' + i, w: 300, h: 220, r: 22, fill: 'card', shadow: 2, k: { opacity: [[t + 0.24, t + 0.4, 0, 'Power2 Out']] } }),
        cardPhoto({ id: 'photo' + i, v, w: 300, h: 220, r: 22 }),
      ] });
    });
    return [
      rect({ id: 'card', w: 1060, h: 800, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'New album', x: -470, y: -318, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.2, { dx: -16, x0: -470 }) }),
        group({ id: 'counter', x: 430, y: -318, k: enter(0.28), ch: [
          text({ id: 'n', text: `{{{COUNTER:0-${V.length}; style=roll; kf=1}}}`, x: -40, size: 32, weight: 600,
            k: { 'ph:1': [0, ...V.map((_, i) => [at(i) + 0.3, at(i) + 0.62, +((100 * (i + 1)) / V.length).toFixed(3), 'Power3 Out'])] } }),
          text({ text: 'of 6', x: 40, ax: 1, size: 32, weight: 500, color: 'muted' }),
        ] }),
        ...slots, ...drops,
        text({ id: 'hint', text: 'JPG or PNG · up to 20 MB', x: -470, y: 318, ax: 0, size: 24, color: 'muted', k: enter(0.4) }),
        rect({ id: 'create', x: 320, y: 318, w: 300, h: 76, r: 38, fill: 'skel', clip: true, k: enter(0.44, { blur: 0 }), ch: [
          rect({ id: 'createAcc', x: -150, pin: 'l', w: 0, h: 76, fill: 'acc', k: { w: [[A, A + 0.45, 300, 'Power3 Out']] } }),
          text({ id: 'createOff', text: 'Create album', size: 28, weight: 600, color: 'muted', k: exit(A + 0.05) }),
          text({ id: 'createOn', text: 'Create album', size: 28, weight: 600, color: '#FFFFFF', k: enter(A + 0.1) }),
        ] }),
      ] }),
    ];
  },
});

// 10 ─ Collage builder: photos are dragged from a tray into a three-frame template and fill each frame's shape
UIK.define({
  id: 'collage-builder', name: 'Collage builder', cat: 'gallery', T: 4.7, cam: { zoom: 1.0, x: -20 },
  desc: 'Three photos wait in a tray beside a template of three empty frames. The cursor drags each one across — it lifts and tilts — and on release it snaps to its frame and grows into it, the 4:3 crop opening up to the frame’s own shape; the frame tints as the photo arrives.',
  build: () => {
    const TRX = -620, TRY = [-150, 20, 190], TW = 180, PS = 'Power2 Smooth', E = 'Expo Out';
    const F = [{ x: -70, y: 0, w: 400, h: 640, v: 2 }, { x: 410, y: -165, w: 520, h: 310, v: 1 }, { x: 410, y: 165, w: 520, h: 310, v: 0 }];
    F.forEach((f, i) => { f.cw = r1(Math.min(f.w, f.h * 4 / 3)); f.ch = r1(f.cw * 3 / 4); f.s = r3(TW / f.cw); f.G = 0.95 + i * 1.05; f.D = r3(f.G + 0.58); });
    const OX = -18, OY = 14, CUR = 10;   // drop offset from the frame centre (so the snap reads), cursor tip offset on the photo
    const keys = [[0, 260, 460], [0.55, 260, 460]];
    F.forEach((f, i) => {
      keys.push([f.G - 0.1, TRX + CUR, TRY[i] + CUR], [f.G + 0.08, TRX + CUR, TRY[i] + CUR], [f.D, f.x + OX + CUR, f.y + OY + CUR, PS], [f.D + 0.12, f.x + OX + CUR, f.y + OY + CUR]);
    });
    keys.push([4.6, 520, 420]);
    return [
      rect({ id: 'template', x: 200, w: 1000, h: 700, r: 40, fill: 'card', shadow: 1, k: popIn(0.1) }),
      ...F.map((f, i) => rect({ id: 'frame' + i, x: f.x, y: f.y, w: f.w, h: f.h, r: 16, fill: 'soft', stroke: 'dim', sw: 3, dash: true,
        k: fadeIn(0.3 + i * 0.06), ch: [
          // hover cue as a fading overlay (an accent dashed outline + a faint tint) — a soft → acc fill track
          // would lerp through salmon, and a stronger tint turns rust on the dark theme
          rect({ id: 'hover' + i, w: f.w, h: f.h, r: 16, fill: 'acc/5', stroke: 'acc', sw: 3, dash: true, k: { opacity: [0, [f.D - 0.3, f.D - 0.1, 1, 'Power2 Out'], [f.D + 0.3, f.D + 0.5, 0, 'Power2 Out']] } }),
          icon({ icon: 'image', size: 44, sw: 2.4, color: 'muted' }),
        ] })),
      rect({ id: 'tray', x: TRX, w: 240, h: 620, r: 36, fill: 'card', shadow: 1, k: enter(0.16, { dx: -20, x0: TRX, s: 0.96, blur: 0 }), ch: [
        text({ text: 'Photos', x: -90, y: -262, ax: 0, size: 28, weight: 600 }),
        ...TRY.map((y, i) => rect({ id: 'empty' + i, y, w: TW, h: 135, r: 12, stroke: 'dim', sw: 2, dash: true })),
      ] }),
      ...F.map((f, i) => photo({ id: 'photo' + i, v: f.v, x: TRX, y: TRY[i], w: f.w, h: f.h, r: 16,
        k: k(enter(0.42 + i * 0.06, { s: 1, blur: 6 }), {
          x: [[f.G + 0.08, f.D, f.x + OX, PS], [f.D, f.D + 0.5, f.x, E]], y: [[f.G + 0.08, f.D, f.y + OY, PS], [f.D, f.D + 0.5, f.y, E]],
          scale: [f.s, [f.G, f.G + 0.2, r3(f.s * 1.1), 'Power3 Out'], [f.D, f.D + 0.5, 1, E]],
          rot: [[f.G, f.G + 0.2, -3, 'Power3 Out'], [f.D, f.D + 0.4, 0, 'Power3 Out']],
          w: [f.cw, [f.D, f.D + 0.5, f.w, E]], h: [f.ch, [f.D, f.D + 0.5, f.h, E]] }) })),
      cursorLayer(keys, [], F.map((f) => [f.G, f.D]), { inAt: 0.5 }),
    ];
  },
});

// 11 ─ Zoom into grid: the camera dives from a wall of photos into one cell until it fills the frame
UIK.define({
  id: 'zoom-into-grid', name: 'Zoom into grid', cat: 'gallery', T: 3.8,
  cam: (() => {
    // log-space zoom sampled into Linear legs: the dive keeps one perceived speed, and the camera centre is solved
    // so the target's screen position eases to the middle while the zoom runs (no drifting off at high zoom)
    const Za = 0.68, Zf = 5.1, Z0 = 1.45, Z1 = 2.75, P = [636, -249], n = 16, ez = UIK.ease('Power2 Smooth');
    const zoom = [[0.05, 1.35, Za, 'Power2 Smooth']], x = [], y = [];
    for (let j = 1; j <= n; j++) {
      const a = r3(Z0 + (Z1 - Z0) * (j - 1) / n), b = r3(Z0 + (Z1 - Z0) * j / n), e = ez(j / n), z = Za * Math.pow(Zf / Za, e);
      zoom.push([a, b, r3(z), 'Linear']);
      x.push([a, b, r1(P[0] - P[0] * Za * (1 - e) / z), 'Linear']);
      y.push([a, b, r1(P[1] - P[1] * Za * (1 - e) / z), 'Linear']);
    }
    return { zoom: 0.64, k: { zoom, x, y } };
  })(),
  desc: 'A wall of 56 photos ripples in and drifts closer. One cell is clicked and the camera dives into it — a log-space zoom from 0.68× to 5.1× — until the photo fills the frame, then its title card, a back pill and an accent save button rise in.',
  build: () => {
    const C = 1.35, Zf = 5.1, P = [636, -249], TC = 5, TR = 2, SET = [1, 2, 3, 5, 6, 7, 9];
    const cells = [];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 8; c++) {
      if (c === TC && r === TR) continue;
      const d = Math.hypot(c - 3.5, (r - 3) * 1.4);
      cells.push(photo({ id: `cell${r}${c}`, v: SET[(c * 2 + r * 3) % 7], x: (c - 3.5) * 424, y: (r - 3) * 249, w: 400, h: 225, r: 12, k: enter(0.1 + d * 0.06, { s: 0.85, blur: 6 }) }));
    }
    const ui = (t) => enter(t, { dy: 24, y0: 0, s: 1 });
    return [
      group({ id: 'wall', offscreen: true, k: { opacity: [[C, C + 0.4, 0.45, 'Power2 Out']] }, ch: cells }),
      photo({ id: 'target', offscreen: true, v: 8, x: P[0], y: P[1], w: 400, h: 225, r: 12, k: k(enter(0.1 + Math.hypot(TC - 3.5, (TR - 3) * 1.4) * 0.06, { s: 0.85, blur: 6 }), press(C)) }),
      // the detail UI is authored in screen pixels inside a group scaled by 1 / final zoom
      group({ id: 'details', x: P[0], y: P[1], scale: r3(1 / Zf), ch: [
        group({ id: 'capWrap', k: ui(2.55), ch: [
          rect({ id: 'caption', x: -604, y: 404, w: 600, h: 160, r: 36, fill: 'card', shadow: 2, ch: [
            text({ text: 'Courtyard arch', x: -252, y: -26, ax: 0, size: 44, weight: 600, ls: -0.02 }),
            text({ text: 'Lisbon · 24 Sep · f/2.8', x: -252, y: 28, ax: 0, size: 26, color: 'muted' }),
          ] }),
        ] }),
        rect({ id: 'back', x: -796, y: -446, w: 216, h: 72, r: 36, fill: 'card', shadow: 3, k: enter(2.62), ch: [
          icon({ icon: 'chevronLeft', x: -70, size: 30, sw: 2.8, color: 'ink' }),
          text({ text: 'All photos', x: -48, ax: 0, size: 26, weight: 600 }),
        ] }),
        circle({ id: 'save', x: 860, y: -446, d: 84, fill: 'card', shadow: 3, k: pop(2.7, { from: 0.5 }), ch: [
          icon({ icon: 'heart', size: 36, sw: 2.6, color: 'acc', filled: true, fill: 'acc' }),
        ] }),
      ] }),
      cursorLayer([[0, 1250, 420], [0.6, 1250, 420], [C - 0.12, P[0] + 20, P[1] + 20], [C + 0.3, P[0] + 20, P[1] + 20]], [C], [], { inAt: 0.55, k: { opacity: [[C + 0.15, C + 0.35, 0, 'Power2 Out']] } }),
    ];
  },
});

// 12 ─ Drag reorder: a photo is dragged to a new slot, the others shift over to make room, then it drops
UIK.define({
  id: 'drag-reorder-grid', name: 'Drag to reorder', cat: 'gallery', T: 3.5, cam: 0.9,
  desc: 'The cursor lifts the bottom-left photo of a 3×3 grid (it scales up, tilts and gains a deeper shadow) and carries it to the top row. As it arrives, the five photos in between shift one slot on in a quick wave and an accent dashed slot opens; on release it snaps into the slot and settles.',
  build: () => {
    const P = (s) => [(s % 3 - 1) * 256, -200 + Math.floor(s / 3) * 256];
    const V = [3, 1, 7, 2, 5, 9, 8, 6, 0], FROM = 6, TO = 1, PS = 'Power2 Smooth';
    const G = 1.0, G1 = 1.12, D1 = 1.9, R = 2.35, OX = 14, OY = 12, CX = 18, CY = 16;
    const [fx, fy] = P(FROM), [tx, ty] = P(TO);
    const H = r3(cross(G1, D1, fy, ty + OY, -60, PS));
    const tin = (s) => enter(0.3 + (s % 3 + Math.floor(s / 3)) * 0.05, { s: 0.9, blur: 6 });
    const photos = V.map((v, s) => {
      if (s === FROM) return null;
      const shift = s >= TO && s < FROM, t = H + (s - TO) * 0.04, [nx, ny] = P(s + 1), [x, y] = P(s);
      return cardPhoto({ id: 'photo' + s, v, x, y, w: 240, h: 240, r: 20, k: k(tin(s), shift ? { x: nx !== x ? [[t, t + 0.5, nx, 'Power3 Out']] : [], y: ny !== y ? [[t, t + 0.5, ny, 'Power3 Out']] : [] } : null) });
    }).filter(Boolean);
    return [
      rect({ id: 'card', w: 880, h: 960, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'Cover photos', x: -376, y: -410, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.2, { dx: -16, x0: -376 }) }),
        text({ id: 'hint', text: 'Drag to reorder', x: -376, y: -364, ax: 0, size: 24, color: 'muted', k: enter(0.26) }),
        rect({ id: 'done', x: 320, y: -400, w: 112, h: 60, r: 30, fill: 'ink', k: enter(0.3, { blur: 0 }), ch: [text({ text: 'Done', size: 26, weight: 600, color: 'inv' })] }),
        ...V.map((_, s) => rect({ id: 'well' + s, x: P(s)[0], y: P(s)[1], w: 240, h: 240, r: 20, fill: 'soft', k: fadeIn(0.28) })),
        rect({ id: 'target', x: tx, y: ty, w: 256, h: 256, r: 26, stroke: 'acc', sw: 4, dash: true,
          k: { opacity: [0, [H + 0.2, H + 0.4, 1, 'Power2 Out'], [R, R + 0.2, 0, 'Power2 Out']] } }),
        ...photos,
        group({ id: 'drag', x: fx, y: fy, k: k(tin(FROM), {
            x: [[G1, D1, tx + OX, PS], [R, R + 0.4, tx, 'Power3 Out']], y: [[G1, D1, ty + OY, PS], [R, R + 0.4, ty, 'Power3 Out']],
            scale: [[G, G + 0.25, 1.06, 'Power3 Out'], [R, R + 0.35, 1, 'Power3 Out']], rot: [[G, G + 0.25, -3, 'Power3 Out'], [R, R + 0.35, 0, 'Power3 Out']] }), ch: [
          rect({ id: 'lift', w: 240, h: 240, r: 20, fill: 'card', shadow: 2, k: { opacity: [0, [G, G + 0.2, 1, 'Power2 Out'], [R, R + 0.3, 0, 'Power2 Out']] } }),
          photo({ id: 'dragPhoto', v: V[FROM], w: 240, h: 240, r: 20 }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 470], [0.55, 560, 470], [G - 0.12, fx + CX, fy + CY], [G1, fx + CX, fy + CY], [D1, tx + OX + CX, ty + OY + CY, PS], [R + 0.1, tx + OX + CX, ty + OY + CY], [3.2, 330, 420]],
        [], [[G, R]], { inAt: 0.5 }),
    ];
  },
});

// 13 ─ Map gallery: numbered photo pins on a map drive a strip of photo cards
UIK.define({
  id: 'map-gallery', name: 'Map gallery', cat: 'gallery', T: 3.9, cam: 1.0,
  desc: 'Numbered pins sit along a dotted walk on a stylised map. Clicking pin 3 pops it to the accent and slides the photo-card strip along the bottom to its card (a two-card jump with a touch of motion blur); clicking pin 2 hands the highlight back and slides the strip one card the other way.',
  build: () => {
    const C1 = 1.3, C2 = 2.6, SY = 272, PITCH = 460;
    const PINS = [[-470, -180], [-100, -40], [250, -250], [520, -60]];
    const CARDS = [{ v: 5, t: 'Harbour steps', m: 'Photo 1 · 08:12' }, { v: 8, t: 'Old town arch', m: 'Photo 2 · 10:40' }, { v: 3, t: 'River skyline', m: 'Photo 3 · 13:05' }, { v: 7, t: 'Garden café', m: 'Photo 4 · 16:30' }];
    const ACT = [[0, 0], [C1, 2], [C2, 1]];   // [t, active index]
    const onAt = (i) => ACT.filter(([, a]) => a === i).map(([t]) => t), offAt = (i) => ACT.slice(1).filter(([, a], j) => ACT[j][1] === i).map(([t]) => t);
    const roads = [
      ['M-700 -40 C-430 -90 -220 40 40 -10 S420 -170 700 -130', 34], ['M-700 110 L700 80', 22], ['M-320 -400 L-260 400', 22], ['M140 -400 L100 400', 22],
      ['M430 -400 L490 400', 16], ['M-700 -300 L-320 -262', 14], ['M-260 -330 L140 -300', 14], ['M100 -210 L700 -250', 14],
    ];
    const pin = (i) => {
      const [x, y] = PINS[i], ons = onAt(i).filter((t) => t > 0), offs = offAt(i), first = i === 0;
      const sc = first ? [0.3, [0.45, 0.87, 1.2, 'Back Out']] : [0.3, [0.45 + i * 0.08, 0.87 + i * 0.08, 1, 'Back Out']];
      const op = [0, [0.45 + i * 0.08, 0.57 + i * 0.08, 1, 'Power2 Out']];
      const ev = [...ons.map((t) => [t, 1]), ...offs.map((t) => [t, 0])].sort((a, b) => a[0] - b[0]);
      for (const [t, on] of ev) sc.push(on ? [t - 0.07, t, 0.92, 'Power2 Out'] : [t + 0.02, t + 0.4, 1, 'Power3 Out'], ...(on ? [[t + 0.02, t + 0.45, 1.2, 'Back Out']] : []));
      const acc = first ? { opacity: [1, ...offs.map((t) => [t, t + 0.2, 0, 'Power2 In'])], scale: [1, ...offs.map((t) => [t, t + 0.2, 0.6, 'Power2 In'])] } : null;
      const accK = ons.length ? k(pop(ons[0] + 0.04, { from: 0.4 }), offs.length ? { opacity: offs.map((t) => [t, t + 0.2, 0, 'Power2 In']), scale: offs.map((t) => [t, t + 0.2, 0.6, 'Power2 In']) } : null) : acc;
      return group({ id: 'pin' + i, x, y, k: { scale: sc, opacity: op }, ch: [
        circle({ d: 58, fill: 'ink', stroke: 'card', sw: 5, shadow: 3, ch: [text({ text: String(i + 1), y: -1, size: 26, weight: 600, color: 'inv', tnum: false })] }),
        accK ? circle({ id: 'pinOn' + i, d: 58, fill: 'acc', stroke: '#FFFFFF', sw: 5, k: accK, ch: [text({ text: String(i + 1), y: -1, size: 26, weight: 600, color: '#FFFFFF', tnum: false })] }) : null,
      ].filter(Boolean) });
    };
    // inactive cards stay opaque (the map must not show through) — a card-coloured veil dims their content
    const veil = (i) => {
      const o = [i === 0 ? 0 : 0.55];
      for (const [t, a] of ACT.slice(1)) {
        const prev = ACT[ACT.findIndex((q) => q[0] === t) - 1][1];
        if (a === i) o.push([t + 0.1, t + 0.4, 0, 'Power2 Out']); else if (prev === i) o.push([t + 0.04, t + 0.3, 0.55, 'Power2 Out']);
      }
      return { opacity: o };
    };
    return [
      rect({ id: 'map', w: 1400, h: 800, r: 40, fill: 'skel', shadow: 1, clip: true, k: popIn(0.1), ch: [
        rect({ id: 'park0', x: -560, y: -190, w: 200, h: 150, r: 36, fill: 'dim', k: enter(0.2, { blur: 0 }) }),
        rect({ id: 'park1', x: 290, y: 20, w: 240, h: 140, r: 36, fill: 'dim', k: enter(0.26, { blur: 0 }) }),
        rect({ id: 'park2', x: -80, y: -330, w: 260, h: 110, r: 30, fill: 'dim', k: enter(0.32, { blur: 0 }) }),
        ...roads.map(([d, sw], i) => path({ id: 'road' + i, d, stroke: 'card', sw, trimmed: true, k: { trimE: [0, [0.16 + i * 0.04, 0.8 + i * 0.04, 100, 'Power3 Out']] } })),
        path({ id: 'walk', d: 'M-470 -180 C-360 -70 -230 -60 -100 -40 S170 -250 250 -250 S440 -120 520 -60', stroke: 'ink/45', sw: 6, dash: [0.1, 16], k: fadeIn(0.5) }),
        ...PINS.map((_, i) => pin(i)),
        rect({ id: 'place', x: -520, y: -330, w: 280, h: 64, r: 32, fill: 'card', shadow: 3, k: enter(0.4, { dy: -14, y0: -330 }), ch: [
          icon({ icon: 'image', x: -106, size: 28, sw: 2.4, color: 'ink' }),
          text({ text: 'Porto · 4 photos', x: -82, ax: 0, size: 24, weight: 600 }),
        ] }),
        group({ id: 'strip', y: SY, k: k(enter(0.55, { dy: 40, y0: SY, s: 1 }), {
            x: [[C1 + 0.04, C1 + 0.74, -2 * PITCH, 'Power4 Out'], [C2 + 0.04, C2 + 0.64, -PITCH, 'Power4 Out']],
            blur: [[C1 + 0.04, C1 + 0.14, 3, 'Power2 Out'], [C1 + 0.14, C1 + 0.55, 0, 'Power2 Out']] }), ch:
          CARDS.map((c, i) => rect({ id: 'card' + i, x: i * PITCH, w: 420, h: 170, r: 28, fill: 'card', shadow: 2, ch: [
            photo({ v: c.v, x: -130, w: 130, h: 130, r: 18 }),
            text({ text: c.t, x: -44, y: -20, ax: 0, size: 28, weight: 600 }),
            text({ text: c.m, x: -44, y: 20, ax: 0, size: 22, color: 'muted' }),
            rect({ id: 'veil' + i, w: 420, h: 170, r: 28, fill: 'card', k: veil(i) }),
          ] })) }),
      ] }),
      cursorLayer([[0, 620, 440], [0.6, 620, 440], [C1 - 0.1, PINS[2][0] + 12, PINS[2][1] + 14], [C1 + 0.25, PINS[2][0] + 12, PINS[2][1] + 14],
        [C2 - 0.1, PINS[1][0] + 12, PINS[1][1] + 14], [C2 + 0.25, PINS[1][0] + 12, PINS[1][1] + 14], [3.7, 160, 110]], [C1, C2], [], { inAt: 0.55 }),
    ];
  },
});
})();
