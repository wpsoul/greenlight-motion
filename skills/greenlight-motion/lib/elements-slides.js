/* UI Motion Kit — slides elements: slideshow transitions and slider mechanics. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, photo, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// the kit's opening beat: the main shape pops in from empty
const popIn = (t = 0.1, from = 0.7) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// fade only (chrome, tracks, hairlines — things that should not scale or blur in)
const fadeIn = (t, dur = 0.3) => ({ opacity: [0, [t, t + dur, 1, 'Power2 Out']] });
const pad2 = (n) => String(n).padStart(2, '0');
const r1 = (v) => Math.round(v * 10) / 10;
// time fraction u (0…1) at which a VE easing reaches progress p — keys events on an eased drag
const invEase = (name, p) => {
  const f = UIK.ease(name); let a = 0, b = 1;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < p) a = m; else b = m; }
  return (a + b) / 2;
};
// liquid indicator for a pin 'l' rect: the leading edge travels fast, the trailing edge follows late
const edges = (t, L0, R0, L1, R1, o = {}) => {
  const right = (L1 + R1) > (L0 + R0), fast = o.fast ?? 0.32, slow = o.slow ?? 0.48, lag = o.lag ?? 0.08, n = o.n ?? 10;
  const f = UIK.ease('Power3 Out'), at = (tt, a, b, t0, d) => a + (b - a) * f(Math.min(1, Math.max(0, (tt - t0) / d)));
  const Lf = (tt) => (right ? at(tt, L0, L1, t + lag, slow) : at(tt, L0, L1, t, fast));
  const Rf = (tt) => (right ? at(tt, R0, R1, t, fast) : at(tt, R0, R1, t + lag, slow));
  const end = t + lag + slow, w = [];
  for (let j = 1; j <= n; j++) { const a = t + (end - t) * (j - 1) / n, b = t + (end - t) * j / n; w.push([+a.toFixed(3), +b.toFixed(3), +(Rf(b) - Lf(b)).toFixed(2), 'Linear']); }
  return { x: [right ? [t + lag, t + lag + slow, L1, 'Power3 Out'] : [t, t + fast, L1, 'Power3 Out']], w };
};
// one track from a list of keys [[t, a, b, …], …]: eases value idx between consecutive keys (same legs as the cursor)
const legs = (keys, idx, e) => {
  const tr = [keys[0][idx]];
  for (let i = 1; i < keys.length; i++) if (keys[i][idx] !== keys[i - 1][idx]) tr.push([keys[i - 1][0], keys[i][0], keys[i][idx], e]);
  return tr;
};
// the smallest circle diameter centred on (px, py) that covers a w×h box around the origin
const coverD = (px, py, w, h) => Math.ceil(2 * Math.max(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => Math.hypot(a * w / 2 - px, b * h / 2 - py))) + 8);

// ── the slider card: a photo viewport on top, a chrome bar under it ──
const VW = 1120, VH = 620, PAD = 24, BAR = 112, CW = VW + 2 * PAD, CH = VH + PAD + BAR;
const VY = -CH / 2 + PAD + VH / 2, BY = CH / 2 - BAR / 2, BL = -CW / 2 + 40, BR = CW / 2 - 40;
const sliderCard = (view, bar) => rect({ id: 'card', w: CW, h: CH, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
  rect({ id: 'viewport', y: VY, w: VW, h: VH, r: 28, fill: 'soft', clip: true, k: enter(0.16, { blur: 0, s: 0.97 }), ch: view }),
  ...bar,
] });
// a slide's caption in the bar: title + muted line; the pair rises in, and blurs out when the next one comes
const caption = (i, c, tIn, tOut, o = {}) => {
  const x = o.x ?? BL, y = o.y ?? BY;
  return group({ id: 'caption' + i, k: k(enter(tIn, { s: 1, dy: 12, y0: 0, blur: 8 }), tOut != null ? exit(tOut) : null), ch: [
    text({ id: 'title' + i, text: c[0], x, y: y - 17, ax: 0, size: 32, weight: 600, ls: -0.02 }),
    text({ id: 'sub' + i, text: c[1], x, y: y + 21, ax: 0, size: 24, color: 'muted' }),
  ] });
};
// "01 / 03": the current number rolls up inside a clip window (left edge at x), the total stays
const counter = (id, x, y, n, times, o = {}) => {
  const S = o.size ?? 26, H = Math.round(S * 1.6), W = Math.round(S * 1.3);
  return group({ id, k: o.k, ch: [
    rect({ id: id + 'Window', x: x + W / 2, y, w: W, h: H, clip: true, ch: [
      group({ id: id + 'Column', k: times.length ? { y: times.map((t, i) => [t, t + 0.45, -(i + 1) * H, 'Power3 Out']) } : null,
        ch: Array.from({ length: n }, (_, i) => text({ text: pad2(i + 1), y: i * H, size: S, weight: 600, tnum: false, color: o.color })) }),
    ] }),
    text({ id: id + 'Total', text: '/ ' + pad2(n), x: x + W + 4, y, ax: 0, size: S, weight: 500, color: o.muted ?? 'muted' }),
  ] });
};
// page dots: dim dots with an ink pill that hands itself along (leading edge first)
const dots = (id, cx, y, n, times, o = {}) => {
  const G = o.gap ?? 26, D = 10, AW = 30, dx = (i) => r1(cx + (i - (n - 1) / 2) * G), L = (i) => dx(i) - AW / 2;
  return group({ id, k: o.k, ch: [
    ...Array.from({ length: n }, (_, i) => circle({ id: id + i, x: dx(i), y, d: D, fill: 'dim' })),
    rect({ id: id + 'Active', x: L(0), y, pin: 'l', w: AW, h: D, r: D / 2, fill: o.fill ?? 'ink',
      k: k(...times.map((t, j) => edges(t, L(j), L(j) + AW, L(j + 1), L(j + 1) + AW, { fast: 0.28, slow: 0.42 }))) }),
  ] });
};
// round chevron button
const arrowBtn = (id, x, y, dir, kk, o = {}) => circle({ id, x, y, d: o.d ?? 64, fill: o.fill ?? 'soft', shadow: o.shadow, k: kk, ch: [
  icon({ id: id + 'Icon', icon: dir < 0 ? 'chevronLeft' : 'chevronRight', x: dir < 0 ? -1.5 : 1.5, size: o.size ?? 28, sw: 2.6, color: o.color ?? 'ink', k: o.ik }),
] });

// 1 ─ Ken Burns crossfade: every photo drifts (slow zoom + pan); the next crossfades in already drifting its own way
UIK.define({
  id: 'kenburns-crossfade', name: 'Ken Burns crossfade', cat: 'carousel', T: 4.4, cam: 1.15,
  desc: 'An autoplaying slideshow: each photo drifts with a slow zoom and pan, and the next one crossfades in on top already moving in its own Ken Burns direction (the second zooms out), while the caption swaps, the counter rolls and the autoplay segments fill.',
  build: () => {
    const X = [1.35, 2.7], XF = 0.8, END = 3.95, SG = 70, SX = 314;
    const S = [
      { v: 1, cap: ['Alpine ridge', 'Dolomites · 2,950 m'], s: [1.06, 1.16], x: [26, -24], y: [12, -8] },
      { v: 0, cap: ['First light', 'Val d’Orcia · 6:12 am'], s: [1.18, 1.07], x: [-30, 20], y: [-14, 10] },
      { v: 5, cap: ['Low tide', 'Atlantic coast · Portugal'], s: [1.07, 1.15], x: [6, -22], y: [16, -10] },
    ];
    const from = [0.1, X[0], X[1]], to = [X[0] + XF, X[1] + XF, END];
    // the drift runs Linear through the crossfade; the last one eases out so the clip ends on a hold
    const kb = (s, i) => {
      const e = i === 2 ? 'Power2 Out' : 'Linear', a = from[i], b = to[i];
      return { scale: [[a, b, s.s[1], e]], x: [[a, b, s.x[1], e]], y: [[a, b, s.y[1], e]] };
    };
    const view = S.map((s, i) => photo({ id: 'slide' + i, v: s.v, w: VW, h: VH, r: 0, x: s.x[0], y: s.y[0], scale: s.s[0],
      k: k(kb(s, i), i ? { opacity: [0, [X[i - 1], X[i - 1] + XF, 1, 'Power2 Out']] } : null) }));
    const bar = [
      ...S.map((s, i) => caption(i, s.cap, i ? X[i - 1] + 0.22 : 0.28, i < 2 ? X[i] : null)),
      counter('counter', 196, BY, 3, X.map((t) => t + 0.22), { k: fadeIn(0.36) }),
      ...[0, 1, 2].map((i) => rect({ id: 'seg' + i, x: SX + i * (SG + 10), y: BY, pin: 'l', w: SG, h: 6, r: 3, fill: 'skel', k: fadeIn(0.4 + i * 0.04) })),
      ...[0, 1, 2].map((i) => rect({ id: 'segFill' + i, x: SX + i * (SG + 10), y: BY, pin: 'l', w: 0, h: 6, r: 3, fill: 'ink',
        k: { w: [[i ? X[i - 1] : 0.45, i < 2 ? X[i] : END, SG, 'Linear']] } })),
    ];
    return [sliderCard(view, bar)];
  },
});

// 2 ─ Wipe slideshow: the next slide wipes in from the right edge with an accent line riding the wipe
UIK.define({
  id: 'wipe-slideshow', name: 'Wipe slideshow', cat: 'carousel', T: 4.0, cam: 1.15,
  desc: 'Each click on Next wipes the next slide in from the right: a clip grows leftwards with a thin accent line riding its edge, the incoming photo settles from a small offset while the outgoing one is pushed a little left underneath, and the caption, counter and back arrow update.',
  build: () => {
    const C = [1.1, 2.4], W = C.map((c) => c + 0.04), WD = 0.85, SH = 0.3 * VW, PX = 428, NX = 508, E = 'Power3 Out';
    const S = [
      { v: 3, cap: ['Harbour district', 'Built 1910 · restored 2021'] },
      { v: 8, cap: ['Garden pavilion', 'Open daily · 9 am to 6 pm'] },
      { v: 7, cap: ['Winter garden', '1,200 plants under glass'] },
    ];
    const pushOut = (i, x0) => ({ x: [[W[i], W[i] + WD, x0 - SH, E]] });
    const view = [
      photo({ id: 'slide0', v: S[0].v, w: VW, h: VH, r: 0, k: pushOut(0, 0) }),
      // a right-pinned clip grows leftwards; its photo sits around the pin, so it holds still while revealed
      ...[1, 2].map((i) => rect({ id: 'wipe' + i, x: VW / 2, pin: 'r', chAt: 'pin', w: 0, h: VH, clip: true,
        k: { w: [[W[i - 1], W[i - 1] + WD, VW, E]] }, ch: [
          photo({ id: 'slide' + i, v: S[i].v, x: -VW / 2 + 180, w: VW, h: VH, r: 0,
            k: k({ x: [[W[i - 1], W[i - 1] + WD, -VW / 2, E]] }, i === 1 ? pushOut(1, -VW / 2) : null) }),
        ] })),
      rect({ id: 'wipeEdge', x: VW / 2, w: 4, h: VH, fill: 'acc', k: {
        x: [[W[0], W[0] + WD, -VW / 2, E], [W[1], VW / 2], [W[1], W[1] + WD, -VW / 2, E]],
        opacity: [0, [W[0], 1], [W[0] + WD - 0.32, W[0] + WD, 0, 'Power2 Out'], [W[1], 1], [W[1] + WD - 0.32, W[1] + WD, 0, 'Power2 Out']],
      } }),
    ];
    const bar = [
      ...S.map((s, i) => caption(i, s.cap, i ? C[i - 1] + 0.2 : 0.28, i < 2 ? C[i] + 0.02 : null)),
      counter('counter', 262, BY, 3, C.map((t) => t + 0.12), { k: fadeIn(0.36) }),
      // the back arrow wakes up after the first advance
      arrowBtn('prev', PX, BY, -1, fadeIn(0.4), { color: 'dim', ik: { color: [[C[0] + 0.1, C[0] + 0.35, 'ink', 'Power2 Out']] } }),
      arrowBtn('next', NX, BY, 1, k(fadeIn(0.44), press(C[0]), press(C[1]))),
    ];
    return [
      sliderCard(view, bar),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [C[0] - 0.1, NX + 6, BY + 8], [C[0] + 0.3, NX + 6, BY + 8], [C[1] - 0.12, NX + 4, BY + 6],
        [C[1] + 0.25, NX + 4, BY + 6], [C[1] + 0.95, 640, 410]], C, [], { inAt: 0.45 }),
    ];
  },
});

// 3 ─ Circle reveal: the next slide opens as a growing circle from wherever the photo is clicked
UIK.define({
  id: 'circle-reveal', name: 'Circle reveal', cat: 'carousel', T: 4.3, cam: 1.15,
  desc: 'Clicking on the photo opens the next slide as a circle that grows from the click point until it covers the frame, its photo settling from a slight zoom inside; the second click, elsewhere, opens the third slide from there while the caption and page dots follow.',
  build: () => {
    const C = [1.15, 2.6], RD = 1.0, P = [[250, -86], [-296, 104]], E = 'Power3 Out';
    const S = [
      { v: 5, cap: ['Still water', 'Lake Bled · Slovenia'] },
      { v: 0, cap: ['Golden hour', 'Tuscany · Italy'] },
      { v: 7, cap: ['Palm house', 'Botanic garden · Kew'] },
    ];
    const view = [
      photo({ id: 'slide0', v: S[0].v, w: VW, h: VH, r: 0 }),
      // a round clip (radius capped at half its size) grows from the click; the photo counter-sits at the viewport centre
      ...[1, 2].map((i) => {
        const [px, py] = P[i - 1], t = C[i - 1] + 0.03, D = coverD(px, py, VW, VH);
        return rect({ id: 'circle' + i, x: px, y: py, w: 0, h: 0, r: 1200, clip: true,
          k: { w: [[t, t + RD, D, E]], h: [[t, t + RD, D, E]] }, ch: [
            photo({ id: 'slide' + i, v: S[i].v, x: -px, y: -py, w: VW, h: VH, r: 0, k: { scale: [1.14, [t, t + RD + 0.2, 1, E]] } }),
          ] });
      }),
    ];
    const bar = [
      ...S.map((s, i) => caption(i, s.cap, i ? C[i - 1] + 0.22 : 0.28, i < 2 ? C[i] + 0.04 : null)),
      text({ id: 'hint', text: 'Click to explore', x: 440, y: BY, ax: 1, size: 24, color: 'muted', k: fadeIn(0.4) }),
      dots('dots', 504, BY, 3, C.map((t) => t + 0.06), { k: fadeIn(0.44) }),
    ];
    const at = (i) => [P[i][0] + 4, VY + P[i][1] + 6];
    return [
      sliderCard(view, bar),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [C[0] - 0.1, ...at(0)], [C[0] + 0.3, ...at(0)], [C[1] - 0.1, ...at(1)], [C[1] + 0.35, ...at(1)],
        [C[1] + 1.05, 560, 400]], C, [], { inAt: 0.45 }),
    ];
  },
});

// 4 ─ Blinds: the frame is cut into six vertical slats that turn in (scaleX 0 → 1) one after another
UIK.define({
  id: 'blinds-transition', name: 'Blinds transition', cat: 'carousel', T: 4.1, cam: 1.15,
  desc: 'Clicking the arrow turns the next photo in as six vertical slats — each a clipped window onto it — that open from edge-on (scale X 0 → 1) on a left-to-right stagger, like blinds rotating; a second click repeats it for the third slide as the caption and counter update.',
  build: () => {
    const C = [1.05, 2.4], N = 6, SW = VW / N, GAP = 0.07, SD = 0.6, NX = VW / 2 - 60;
    const S = [
      { v: 2, cap: ['Linen overshirt', 'Spring lookbook · look 04'] },
      { v: 8, cap: ['Arch studio', 'Spring lookbook · look 05'] },
      { v: 9, cap: ['Pleated set', 'Spring lookbook · look 06'] },
    ];
    const slats = (i, t0) => Array.from({ length: N }, (_, j) => {
      const cx = r1(-VW / 2 + SW * (j + 0.5)), t = t0 + j * GAP;
      return rect({ id: `slat${i}_${j}`, x: cx, w: r1(SW + 2), h: VH, clip: true,
        k: { sx: [0, [t, t + SD, 1, 'Power3 Out']] }, ch: [
          photo({ id: `slide${i}_${j}`, src: 'slide' + i, v: S[i].v, x: -cx, w: VW, h: VH, r: 0 }),
        ] });
    });
    // once the last slat has turned, one clean copy of the photo steps on over the slats (no seams on the hold)
    const clean = (i, t0) => photo({ id: 'slide' + i, src: 'slide' + i, v: S[i].v, w: VW, h: VH, r: 0, k: { opacity: [0, [t0 + (N - 1) * GAP + SD, 1]] } });
    const view = [
      photo({ id: 'slide0', src: 'slide0', v: S[0].v, w: VW, h: VH, r: 0 }),
      ...slats(1, C[0] + 0.04), clean(1, C[0] + 0.04),
      ...slats(2, C[1] + 0.04), clean(2, C[1] + 0.04),
      arrowBtn('prev', -NX, 0, -1, fadeIn(0.4), { fill: 'card', shadow: 3, d: 68, color: 'dim', ik: { color: [[C[0] + 0.1, C[0] + 0.35, 'ink', 'Power2 Out']] } }),
      arrowBtn('next', NX, 0, 1, k(fadeIn(0.44), press(C[0], { to: 0.9 }), press(C[1], { to: 0.9 })), { fill: 'acc', shadow: 3, d: 68, color: '#FFFFFF' }),
    ];
    const bar = [
      ...S.map((s, i) => caption(i, s.cap, i ? C[i - 1] + 0.3 : 0.28, i < 2 ? C[i] + 0.04 : null)),
      counter('counter', 450, BY, 3, C.map((t) => t + 0.2), { k: fadeIn(0.36) }),
    ];
    return [
      sliderCard(view, bar),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [C[0] - 0.1, NX + 6, VY + 8], [C[0] + 0.3, NX + 6, VY + 8], [C[1] - 0.12, NX + 4, VY + 6],
        [C[1] + 0.3, NX + 4, VY + 6], [C[1] + 1.0, 660, 330]], C, [], { inAt: 0.45 }),
    ];
  },
});

// 5 ─ Mosaic: a 4×3 grid of tiles of the next photo pops in as a diagonal wave
UIK.define({
  id: 'mosaic-transition', formats: ['html'], name: 'Mosaic transition', cat: 'carousel', T: 4.1, cam: 1.15,
  desc: 'Next assembles the following photo from a 4×3 mosaic: each tile is a clipped window onto it that scales up from its own centre, in a diagonal wave from the top-left corner; the second advance runs the wave back from the bottom-right while the caption and dots follow.',
  build: () => {
    const C = [1.05, 2.4], COLS = 4, ROWS = 3, TW = VW / COLS, TH = VH / ROWS, STEP = 0.07, TD = 0.5, NBX = BR - 75;
    const S = [
      { v: 6, cap: ['Amber bottle', 'Hand-blown glass · 500 ml'] },
      { v: 7, cap: ['Fig in terracotta', 'Indoor plants · 60 cm'] },
      { v: 3, cap: ['City print', 'Giclée on cotton · A2'] },
    ];
    const tiles = (i, t0, rev) => {
      const out = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const cx = r1(-VW / 2 + TW * (c + 0.5)), cy = r1(-VH / 2 + TH * (r + 0.5));
        const d = rev ? (COLS - 1 - c) + (ROWS - 1 - r) : c + r, t = t0 + d * STEP;
        out.push(rect({ id: `tile${i}_${r}${c}`, x: cx, y: cy, w: r1(TW + 2), h: r1(TH + 2), clip: true,
          k: { scale: [0, [t, t + TD, 1, 'Power3 Out']] }, ch: [photo({ id: `slide${i}_${r}${c}`, src: 'slide' + i, v: S[i].v, x: -cx, y: -cy, w: VW, h: VH, r: 0 })] }));
      }
      return out;
    };
    // when the wave has landed, one clean copy of the photo steps on over the tiles (no seams on the hold)
    const clean = (i, t0) => photo({ id: 'slide' + i, src: 'slide' + i, v: S[i].v, w: VW, h: VH, r: 0, k: { opacity: [0, [t0 + (COLS + ROWS - 2) * STEP + TD, 1]] } });
    const view = [
      photo({ id: 'slide0', src: 'slide0', v: S[0].v, w: VW, h: VH, r: 0 }),
      ...tiles(1, C[0] + 0.04, false), clean(1, C[0] + 0.04),
      ...tiles(2, C[1] + 0.04, true), clean(2, C[1] + 0.04),
    ];
    const bar = [
      ...S.map((s, i) => caption(i, s.cap, i ? C[i - 1] + 0.24 : 0.28, i < 2 ? C[i] + 0.04 : null)),
      dots('dots', 316, BY, 3, C.map((t) => t + 0.06), { k: fadeIn(0.4), fill: 'acc' }),
      rect({ id: 'nextBtn', x: NBX, y: BY, w: 150, h: 64, r: 32, fill: 'ink', k: k(fadeIn(0.44), press(C[0]), press(C[1])), ch: [
        text({ text: 'Next', x: -46, ax: 0, size: 26, weight: 600, color: 'inv' }),
        icon({ icon: 'arrow', x: 36, size: 26, sw: 2.6, color: 'inv' }),
      ] }),
    ];
    return [
      sliderCard(view, bar),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [C[0] - 0.1, NBX + 10, BY + 10], [C[0] + 0.3, NBX + 10, BY + 10], [C[1] - 0.12, NBX + 8, BY + 8],
        [C[1] + 0.3, NBX + 8, BY + 8], [C[1] + 1.0, 660, 420]], C, [], { inAt: 0.45 }),
    ];
  },
});

// 6 ─ Push with parallax: slides push each other; each photo moves at half speed inside its slide, captions at full speed
UIK.define({
  id: 'push-parallax', name: 'Push parallax', cat: 'carousel', T: 4.0, cam: 1.15,
  desc: 'Two drag-and-release swipes push the slides left. Each slide is a clip whose photo travels at half the slide’s speed, so pictures slide under their frames while the caption cards move at full speed with the slide; the page dots hand the pill along on each release.',
  build: () => {
    const S1 = 0.95, S2 = 2.25, DR = 180, SW = 0.3, SN = 0.62, R1 = S1 + SW, R2 = S2 + SW;
    const S = [
      { v: 5, eyebrow: 'Day 01', title: 'Black sand beach' },
      { v: 1, eyebrow: 'Day 02', title: 'Glacier lagoon' },
      { v: 3, eyebrow: 'Day 03', title: 'Harbour town' },
    ];
    const strip = [[S1, R1, -DR, 'Power2 In'], [R1, R1 + SN, -VW, 'Power3 Out'], [S2, R2, -VW - DR, 'Power2 In'], [R2, R2 + SN, -2 * VW, 'Power3 Out']];
    // photo x inside slide i = −½ × (slide i's position in the viewport) — half speed, same legs and easings
    const half = (i) => [-0.5 * i * VW].concat(strip.map(([a, b, s, e]) => [a, b, r1(-0.5 * (i * VW + s)), e]));
    const CWD = 440, CHT = 128, CX = -VW / 2 + 36 + CWD / 2, CY = VH / 2 - 36 - CHT / 2;
    const view = [
      group({ id: 'strip', k: { x: strip }, ch: S.map((s, i) => rect({ id: 'slide' + i, x: i * VW, w: VW + 2, h: VH, clip: true, ch: [
        photo({ id: 'photo' + i, v: s.v, w: VW + 4, h: VH, r: 0, x: -0.5 * i * VW, k: { x: half(i) } }),
        rect({ id: 'captionCard' + i, x: CX, y: CY, w: CWD, h: CHT, r: 24, fill: 'card', shadow: 2, k: i ? null : enter(0.4, { dy: 16, y0: CY, blur: 0 }), ch: [
          text({ text: s.eyebrow, x: -CWD / 2 + 32, y: -24, ax: 0, size: 22, weight: 600, ls: 0.12, upper: true, color: 'acc' }),
          text({ text: s.title, x: -CWD / 2 + 32, y: 18, ax: 0, size: 36, weight: 600, ls: -0.02 }),
        ] }),
      ] })) }),
    ];
    const bar = [
      caption(0, ['Iceland in three days', 'Drag to browse'], 0.28, null),
      dots('dots', 504, BY, 3, [R1 - 0.05, R2 - 0.05], { k: fadeIn(0.44) }),
    ];
    const GX = 230, GY = VY - 30;
    return [
      sliderCard(view, bar),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [S1 - 0.08, GX, GY], [S1, GX, GY], [R1, GX - DR, GY, 'Power2 In'], [R1 + 0.4, GX - 120, GY + 40],
        [S2 - 0.1, GX, GY], [S2, GX, GY], [R2, GX - DR, GY, 'Power2 In'], [R2 + 0.5, 600, 380]], [], [[S1, R1], [S2, R2]], { inAt: 0.45 }),
    ];
  },
});

// 7 ─ Layered parallax: one scene in three depth layers that travel at different speeds as the slider advances
UIK.define({
  id: 'layered-parallax', name: 'Layered parallax', cat: 'carousel', T: 4.3, cam: 1.15,
  desc: 'One wide scene in three depth layers: each Next moves the far photo a fifth of the way, the hills and pines in the middle at half speed, and the foreground caption cards a full frame, so the landscape opens up in depth while a new stop card slides in; the counter and dots follow.',
  build: () => {
    const C = [1.05, 2.45], D = 1.05, E = 'Power3 Out', SP = [0.2, 0.55, 1];
    const shift = (s) => ({ x: [[C[0] + 0.03, C[0] + 0.03 + D, r1(-s * VW), E], [C[1] + 0.03, C[1] + 0.03 + D, r1(-2 * s * VW), E]] });
    // far layer: a photo wide enough for two far-steps; it starts left-aligned and ends right-aligned
    const BGW = r1(VW + 2 * SP[0] * VW), BGX = r1((BGW - VW) / 2);
    // middle layer: hills and pines spread over the width the middle layer travels
    const HY = VH / 2 + 30, hills = [[-380, 900, 250], [420, 900, 310], [1180, 860, 240], [1880, 900, 300]];
    const hillTop = (x) => {
      let top = 1e9;
      for (const [hx, w, h] of hills) { const u = (x - hx) / (w / 2); if (Math.abs(u) < 1) top = Math.min(top, HY - (h / 2) * Math.sqrt(1 - u * u)); }
      return top;
    };
    const trees = [[-470, 120], [-410, 90], [190, 150], [255, 110], [620, 130], [1020, 170], [1085, 120], [1560, 110], [1640, 160], [1710, 120]];
    const mid = [
      ...hills.map(([x, w, h], i) => ellipse({ id: 'hill' + i, x, y: HY, w, h, fill: 'ink' })),
      ...trees.map(([x, h], i) => path({ id: 'pine' + i, x, y: r1(hillTop(x) + 12), d: `M0 ${-h} L${r1(h * 0.26)} 0 L${r1(-h * 0.26)} 0 Z`, fill: 'ink' })),
    ];
    const stops = [['Stop 01', 'Moonrise ridge', '4.2 km · 2 h'], ['Stop 02', 'Pine valley', '6.8 km · 3 h'], ['Stop 03', 'Summit hut', '9.5 km · 5 h']];
    const FW = 400, FH = 148, FX = VW / 2 - 40 - FW / 2, FY = -VH / 2 + 40 + FH / 2;
    const view = [
      group({ id: 'far', x: BGX, k: { x: [BGX].concat(shift(SP[0]).x.map(([a, b, v, e]) => [a, b, r1(BGX + v), e])) }, ch: [
        photo({ id: 'scene', v: 1, w: BGW, h: VH, r: 0 }),
      ] }),
      group({ id: 'middle', k: shift(SP[1]), ch: mid }),
      group({ id: 'near', k: shift(SP[2]), ch: stops.map((s, i) => rect({ id: 'stopCard' + i, x: FX + i * VW, y: FY, w: FW, h: FH, r: 26, fill: 'card', shadow: 2,
        k: i ? null : enter(0.42, { dy: 16, y0: FY, blur: 0 }), ch: [
          text({ text: s[0], x: -FW / 2 + 32, y: -38, ax: 0, size: 22, weight: 600, ls: 0.12, upper: true, color: 'muted' }),
          text({ text: s[1], x: -FW / 2 + 32, y: 2, ax: 0, size: 36, weight: 600, ls: -0.02 }),
          text({ text: s[2], x: -FW / 2 + 32, y: 42, ax: 0, size: 24, color: 'muted' }),
        ] })) }),
    ];
    const NX = BR - 32;
    const bar = [
      caption(0, ['Ridge trail', 'Three stops · 9.5 km'], 0.28, null),
      counter('counter', 250, BY, 3, C.map((t) => t + 0.12), { k: fadeIn(0.36) }),
      dots('dots', 404, BY, 3, C.map((t) => t + 0.06), { k: fadeIn(0.4) }),
      circle({ id: 'next', x: NX, y: BY, d: 64, fill: 'acc', k: k(fadeIn(0.44), press(C[0]), press(C[1])), ch: [
        icon({ icon: 'arrow', size: 28, sw: 2.6, color: '#FFFFFF' }),
      ] }),
    ];
    return [
      sliderCard(view, bar),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [C[0] - 0.1, NX + 6, BY + 8], [C[0] + 0.3, NX + 6, BY + 8], [C[1] - 0.12, NX + 4, BY + 6],
        [C[1] + 0.3, NX + 4, BY + 6], [C[1] + 1.0, 660, 420]], C, [], { inAt: 0.45 }),
    ];
  },
});

// 8 ─ Vertical panels: full-height slides push up, a side rail fills, each headline rises from its mask
UIK.define({
  id: 'vertical-panels', name: 'Vertical panels', cat: 'carousel', T: 4.3, cam: 1.15,
  desc: 'A split feature slider that advances vertically: each click on the rail’s down button pushes the full-height slide up and out as the next one arrives, the accent progress rail on the side fills a third further, and the new headline rises line by line from behind its masks.',
  build: () => {
    const C = [1.15, 2.55], PD = 0.85, VW8 = 1040, VH8 = 680, RAILW = 120, CW8 = PAD + VW8 + RAILW, CH8 = VH8 + 2 * PAD;
    const VX = -CW8 / 2 + PAD + VW8 / 2, RX = CW8 / 2 - RAILW / 2 - 4, TX = -VW8 / 2 + 48, MW = 420, MH = 72, LH = 64;
    const RT = -236, RH = 420, BTN = CH8 / 2 - PAD - 32;
    const S = [
      { v: 8, eyebrow: '01 — Space', lines: ['Quiet rooms', 'for deep work'], body: 'Soft light and no noise, all day long.' },
      { v: 7, eyebrow: '02 — Air', lines: ['Fresh air on', 'every floor'], body: 'Living walls filter the whole building.' },
      { v: 3, eyebrow: '03 — Place', lines: ['Ten minutes', 'from anywhere'], body: 'Right above the central station.' },
    ];
    const land = [0.3, C[0] + 0.3, C[1] + 0.3];
    const slide = (s, i) => group({ id: 'slide' + i, y: i * VH8, ch: [
      text({ id: 'eyebrow' + i, text: s.eyebrow, x: TX, y: -170, ax: 0, size: 24, weight: 600, ls: 0.1, upper: true, color: 'muted', k: enter(land[i] - 0.05, { blur: 0 }) }),
      ...s.lines.map((ln, j) => rect({ id: `mask${i}_${j}`, x: TX + MW / 2, y: -86 + j * LH, w: MW, h: MH, clip: true, ch: [
        text({ id: `line${i}_${j}`, text: ln, x: -MW / 2, ax: 0, size: 54, weight: 600, ls: -0.03, k: { y: [MH + 8, [land[i] + j * 0.08, land[i] + j * 0.08 + 0.7, 0, 'Power4 Out']] } }),
      ] })),
      text({ id: 'body' + i, text: s.body, x: TX, y: 70, ax: 0, size: 26, color: 'muted', wrap: 380, lh: 1.4, k: enter(land[i] + 0.25, { blur: 6 }) }),
      photo({ id: 'photo' + i, v: s.v, x: VW8 / 2 - 290, w: 580, h: VH8, r: 0 }),
    ] });
    return [
      rect({ id: 'card', w: CW8, h: CH8, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'viewport', x: VX, w: VW8, h: VH8, r: 28, fill: 'soft', clip: true, k: enter(0.16, { blur: 0, s: 0.97 }), ch: [
          group({ id: 'strip', k: { y: [[C[0] + 0.04, C[0] + 0.04 + PD, -VH8, 'Power4 Out'], [C[1] + 0.04, C[1] + 0.04 + PD, -2 * VH8, 'Power4 Out']] }, ch: S.map(slide) }),
        ] }),
        // the current slide number rolls above the rail
        rect({ id: 'railNow', x: RX, y: RT - 40, w: 44, h: 36, clip: true, k: fadeIn(0.36), ch: [
          group({ id: 'railNowColumn', k: { y: C.map((t, i) => [t + 0.1, t + 0.55, -(i + 1) * 36, 'Power3 Out']) },
            ch: ['01', '02', '03'].map((d, i) => text({ text: d, y: i * 36, size: 24, weight: 600, tnum: false })) }),
        ] }),
        rect({ id: 'rail', x: RX, y: RT, pin: 't', w: 6, h: RH, r: 3, fill: 'skel', k: fadeIn(0.4) }),
        rect({ id: 'railFill', x: RX, y: RT, pin: 't', w: 6, h: RH / 3, r: 3, fill: 'acc',
          k: k(fadeIn(0.44), { h: [[C[0] + 0.04, C[0] + 0.04 + PD, 2 * RH / 3, 'Power4 Out'], [C[1] + 0.04, C[1] + 0.04 + PD, RH, 'Power4 Out']] }) }),
        text({ id: 'railTo', text: '03', x: RX, y: RT + RH + 40, size: 24, weight: 600, tnum: false, color: 'muted', k: fadeIn(0.4) }),
        circle({ id: 'down', x: RX, y: BTN, d: 72, fill: 'ink', k: k(fadeIn(0.46), press(C[0]), press(C[1])), ch: [
          icon({ icon: 'arrowDown', size: 30, sw: 2.6, color: 'inv' }),
        ] }),
      ] }),
      cursorLayer([[0, 700, 420], [0.5, 700, 420], [C[0] - 0.1, RX + 8, BTN + 10], [C[0] + 0.3, RX + 8, BTN + 10], [C[1] - 0.12, RX + 6, BTN + 8],
        [C[1] + 0.3, RX + 6, BTN + 8], [C[1] + 1.0, 720, 400]], C, [], { inAt: 0.45 }),
    ];
  },
});

// 9 ─ Hover accordion: five photo panels; the hovered one widens as the others narrow, its caption rises
UIK.define({
  id: 'hover-accordion', name: 'Hover accordion', cat: 'carousel', T: 4.2, cam: 1.1,
  desc: 'Five photo panels share one row. As the cursor glides across, the panel under it widens while the others narrow to make room (widths and positions ease together), and its caption card rises from the bottom edge as the previous one drops away; it visits three panels and rests on the last.',
  build: () => {
    const N = 5, RW = 1240, PH = 560, G = 12, WIDE = 560, HEAD = 104, CWA = RW + 2 * PAD, CHA = PH + PAD + HEAD;
    const RY = -CHA / 2 + HEAD + PH / 2, E = 'Power3 Out', HD = 0.6;
    const H = [[0.95, 1], [1.95, 2], [2.95, 4]];   // [time, hovered panel]
    const P = [
      { v: 1, cap: ['Lofoten', 'Norway · 14 stays'] },
      { v: 5, cap: ['Big Sur', 'California · 22 stays'] },
      { v: 0, cap: ['Hallstatt', 'Austria · 9 stays'] },
      { v: 8, cap: ['Marrakesh', 'Morocco · 31 stays'] },
      { v: 3, cap: ['Lisbon', 'Portugal · 18 stays'] },
    ];
    const layout = (hov) => {
      const narrow = (RW - G * (N - 1) - WIDE) / (N - 1), even = (RW - G * (N - 1)) / N;
      const w = P.map((_, i) => (hov == null ? even : i === hov ? WIDE : narrow));
      let x = -RW / 2; const cx = w.map((wi) => { const c = x + wi / 2; x += wi + G; return r1(c); });
      return { w: w.map(r1), cx };
    };
    const L0 = layout(null), LS = H.map(([, h]) => layout(h));
    const CPW = 300, CPH = 100, CPY = PH / 2 - 24 - CPH / 2, CPX = (w) => r1(-w / 2 + 24 + CPW / 2);
    const panel = (p, i) => {
      const x = [L0.cx[i]], w = [L0.w[i]], cx = [CPX(L0.w[i])], cy = [PH / 2 + CPH], co = [0];
      H.forEach(([t, h], s) => {
        x.push([t, t + HD, LS[s].cx[i], E]); w.push([t, t + HD, LS[s].w[i], E]); cx.push([t, t + HD, CPX(LS[s].w[i]), E]);
        const was = s ? H[s - 1][1] === i : false, is = h === i;
        if (is && !was) { cy.push([t + 0.1, t + 0.7, CPY, 'Power4 Out']); co.push([t + 0.1, t + 0.3, 1, 'Power2 Out']); }
        if (was && !is) { cy.push([t, t + 0.3, CPY + 40, 'Power2 In']); co.push([t, t + 0.2, 0, 'Power2 In']); }
      });
      return photo({ id: 'panel' + i, v: p.v, x: L0.cx[i], y: RY, w: WIDE, h: PH, r: 24,
        k: k({ x, w }, enter(0.24 + i * 0.06, { blur: 0, s: 1, dy: 24, y0: RY })), ch: [
          rect({ id: 'caption' + i, x: cx[0], y: cy[0], w: CPW, h: CPH, r: 22, fill: 'card', shadow: 3, k: { x: cx, y: cy, opacity: co }, ch: [
            text({ text: p.cap[0], x: -CPW / 2 + 26, y: -17, ax: 0, size: 32, weight: 600, ls: -0.02 }),
            text({ text: p.cap[1], x: -CPW / 2 + 26, y: 21, ax: 0, size: 22, color: 'muted' }),
            circle({ x: CPW / 2 - 40, d: 44, fill: 'ink', ch: [icon({ icon: 'arrow', size: 22, sw: 2.4, color: 'inv' })] }),
          ] }),
        ] });
    };
    const TY = -CHA / 2 + HEAD / 2 + 8;
    return [
      rect({ id: 'card', w: CWA, h: CHA, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Where to next', x: -RW / 2, y: TY, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.2, { dx: -14, x0: -RW / 2 }) }),
        text({ id: 'count', text: '5 places', x: RW / 2, y: TY, ax: 1, size: 26, color: 'muted', k: enter(0.28) }),
        ...P.map(panel),
      ] }),
      // the cursor enters each panel just before its hover time, and stays inside it as it widens
      cursorLayer([[0, 700, 440], [0.45, 700, 440], [H[0][0] + 0.02, -236, RY + 50], [H[1][0] - 0.45, -200, RY + 44], [H[1][0] + 0.05, 190, RY + 10],
        [H[2][0] - 0.45, 220, RY + 16], [H[2][0] + 0.05, 520, RY - 20], [4.2, 520, RY - 20]], [], [], { inAt: 0.4 }),
    ];
  },
});

// 10 ─ Vertical compare: a horizontal divider dragged up and down splits a before (top) and after (bottom) photo
UIK.define({
  id: 'compare-vertical', name: 'Compare (vertical)', cat: 'carousel', T: 4.5, cam: 1.15,
  desc: 'A before/after split with a horizontal divider: the top is the hazy original, the bottom the corrected photo, and the before layer is a top-pinned clip whose height follows the handle. The cursor drags the handle down, up past the middle, then settles it back near the centre.',
  build: () => {
    const VWc = 1080, VHc = 700, H0 = 60, REL = 3.62, E = 'Power2 Smooth';
    const segs = [[1.05, 1.85, 210], [2.05, 2.85, -230], [3.05, 3.6, -100]];   // ends splitting the sun: half hazy, half clean
    const hy = [H0].concat(segs.map(([a, b, v]) => [a, b, v, E]));
    const ch = [VHc / 2 + H0].concat(segs.map(([a, b, v]) => [a, b, VHc / 2 + v, E]));
    const chip = (id, label, y, dark, t) => rect({ id, x: -VWc / 2 + 28 + (dark ? 52 : 60), y, w: dark ? 104 : 120, h: 50, r: 25, fill: dark ? 'ink' : 'card', shadow: dark ? 0 : 3, k: enter(t),
      ch: [text({ text: label, size: 24, weight: 600, color: dark ? 'inv' : 'ink' })] });
    return [
      rect({ id: 'card', w: VWc + 2 * PAD, h: VHc + 2 * PAD, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'viewport', w: VWc, h: VHc, r: 28, fill: 'soft', clip: true, k: enter(0.16, { blur: 0, s: 0.97 }), ch: [
          photo({ id: 'after', v: 0, w: VWc, h: VHc, r: 0 }),
          // top-pinned clip: its content sits around the pin, so the photo stays put while h follows the handle
          rect({ id: 'beforeClip', y: -VHc / 2, pin: 't', chAt: 'pin', w: VWc, h: VHc / 2 + H0, clip: true, k: { h: ch }, ch: [
            photo({ id: 'before', v: 0, y: VHc / 2, w: VWc + 24, h: VHc + 24, r: 0, blur: 3 }),
            rect({ id: 'haze', y: VHc / 2, w: VWc, h: VHc, fill: 'panel/55' }),
          ] }),
          group({ id: 'handle', y: H0, k: k(fadeIn(0.5), { y: hy }), ch: [
            rect({ id: 'handleLine', w: VWc, h: 4, fill: 'ink' }),
            circle({ id: 'knob', d: 76, fill: 'ink', stroke: 'card', sw: 4, k: { scale: [[1.0, 1.2, 1.1, 'Power3 Out'], [REL, REL + 0.25, 1, 'Power3 Out']] }, ch: [
              icon({ icon: 'chevronUp', y: -10, size: 24, color: 'inv', sw: 2.8 }),
              icon({ icon: 'chevronDown', y: 10, size: 24, color: 'inv', sw: 2.8 }),
            ] }),
          ] }),
          chip('labelBefore', 'Before', -VHc / 2 + 28 + 25, false, 0.4),
          chip('labelAfter', 'After', VHc / 2 - 28 - 25, true, 0.46),
        ] }),
      ] }),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [0.92, 14, H0 + 12], [1.05, 14, H0 + 12], [1.85, 14, 222, E], [2.05, 14, 222], [2.85, 14, -218, E], [3.05, 14, -218],
        [3.6, 14, -88, E], [3.85, 14, -88], [4.25, 300, 250]], [], [[1.0, REL]], { inAt: 0.45 }),
    ];
  },
});

// 11 ─ Timeline scrubber: dragging the playhead across the years swaps the photo and rolls the year at each tick
UIK.define({
  id: 'timeline-scrubber', name: 'Timeline scrubber', cat: 'carousel', T: 4.2, cam: 1.15,
  desc: 'A photo slider driven by a timeline of years: the cursor drags the accent playhead from 2020 to 2023, and as it crosses each year tick the photo crossfades to that year, the year in the caption rolls and the label lights up; released just past 2023, the playhead snaps back onto the tick.',
  build: () => {
    const VHt = 540, BARt = 150, CHt = VHt + PAD + BARt, VYt = -CHt / 2 + PAD + VHt / 2, TY = CHt / 2 - BARt / 2 - 22, LY = TY + 46;
    // Sine Smooth (a gentle in-out) keeps the year crossings ≥ 0.4 s apart; Power2 Smooth bunches the middle ones
    const X0 = -480, STEP = 240, D0 = 0.95, D1 = 3.0, XE = 292, SNAP = 240, E = 'Sine Smooth';
    const YEARS = [2020, 2021, 2022, 2023, 2024], YX = YEARS.map((_, i) => X0 + i * STEP);
    const tc = (x) => +(D0 + (D1 - D0) * invEase(E, (x - X0) / (XE - X0))).toFixed(3);
    const cross = [0, tc(YX[1]), tc(YX[2]), tc(YX[3])];
    const S = [
      { v: 8, title: 'The first studio' },
      { v: 3, title: 'Moving downtown' },
      { v: 7, title: 'The greenhouse lab' },
      { v: 1, title: 'A mountain retreat' },
    ];
    const px = [X0, [D0, D1, XE, E], [D1, D1 + 0.4, SNAP, 'Power3 Out']];
    const CPW = 400, CPH = 132, CPX = -VW / 2 + 32 + CPW / 2, CPY = VHt / 2 - 32 - CPH / 2, YH = 56;
    const view = [
      ...S.map((s, i) => photo({ id: 'year' + YEARS[i], v: s.v, w: VW, h: VHt, r: 0,
        k: i ? { opacity: [0, [cross[i], cross[i] + 0.2, 1, 'Power2 Out']], scale: [1.05, [cross[i], cross[i] + 0.55, 1, 'Power3 Out']] } : null })),
      rect({ id: 'captionCard', x: CPX, y: CPY, w: CPW, h: CPH, r: 24, fill: 'card', shadow: 2, k: enter(0.36, { dy: 16, y0: CPY, blur: 0 }), ch: [
        rect({ id: 'yearWindow', x: -CPW / 2 + 28 + 70, y: -22, w: 140, h: YH, clip: true, ch: [
          group({ id: 'yearColumn', k: { y: cross.slice(1).map((t, i) => [t, t + 0.34, -(i + 1) * YH, 'Power3 Out']) },
            ch: S.map((_, i) => text({ text: String(YEARS[i]), x: -70, y: i * YH, ax: 0, size: 44, weight: 600, ls: -0.02, tnum: false })) }),
        ] }),
        ...S.map((s, i) => text({ id: 'event' + i, text: s.title, x: -CPW / 2 + 28, y: 30, ax: 0, size: 26, color: 'muted',
          k: i ? k(enter(cross[i], { d: 0.03, dur: 0.23, dy: 8, y0: 30 }), i < 3 ? exit(cross[i + 1]) : null) : exit(cross[1]) })),
      ] }),
    ];
    return [
      rect({ id: 'card', w: CW, h: CHt, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'viewport', y: VYt, w: VW, h: VHt, r: 28, fill: 'soft', clip: true, k: enter(0.16, { blur: 0, s: 0.97 }), ch: view }),
        rect({ id: 'track', x: X0, y: TY, pin: 'l', w: 4 * STEP, h: 4, r: 2, fill: 'skel', k: fadeIn(0.36) }),
        ...YX.flatMap((x, i) => [
          rect({ id: 'tick' + YEARS[i], x, y: TY, w: 3, h: 20, r: 1.5, fill: 'dim', k: fadeIn(0.4 + i * 0.03) }),
          ...(i < 4 ? [1, 2, 3].map((j) => rect({ id: `minor${i}_${j}`, x: x + j * STEP / 4, y: TY, w: 2, h: 10, r: 1, fill: 'dim', k: fadeIn(0.42 + i * 0.03) })) : []),
          text({ id: 'label' + YEARS[i], text: String(YEARS[i]), x, y: LY, size: 24, weight: 600, tnum: false, color: i ? 'muted' : 'ink',
            k: k(fadeIn(0.42 + i * 0.03), i && i < 4 ? { color: [[cross[i], cross[i] + 0.2, 'ink', 'Power2 Out']] } : null) }),
        ]),
        rect({ id: 'progress', x: X0, y: TY, pin: 'l', w: 0, h: 4, r: 2, fill: 'ink', k: { w: [0, [D0, D1, XE - X0, E], [D1, D1 + 0.4, SNAP - X0, 'Power3 Out']] } }),
        group({ id: 'playhead', x: X0, y: TY, k: k(fadeIn(0.5), { x: px }), ch: [
          circle({ id: 'knob', d: 30, fill: 'acc', stroke: 'card', sw: 5, shadow: 3, k: { scale: [[D0 - 0.05, D0 + 0.15, 1.25, 'Power3 Out'], [D1, D1 + 0.25, 1, 'Power3 Out']] } }),
        ] }),
      ] }),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [D0 - 0.12, X0 + 6, TY + 10], [D0, X0 + 6, TY + 10], [D1, XE + 6, TY + 10, E], [D1 + 0.22, XE + 6, TY + 10],
        [D1 + 0.8, 560, 420]], [], [[D0, D1]], { inAt: 0.45 }),
    ];
  },
});

// 12 ─ Zoom lens: a round magnifier follows the cursor over a product photo, showing it at 2× inside
UIK.define({
  id: 'zoom-lens', name: 'Zoom lens', cat: 'carousel', T: 4.7, cam: 1.2,
  desc: 'On a product page a round lens pops up under the cursor and follows it across the photo, showing a 2× copy that counter-moves inside a circular clip so the detail under the pointer stays centred; the cursor then picks the second thumbnail, the photo crossfades and the lens inspects the new view.',
  build: () => {
    const CWz = 1180, CHz = 720, PS = 640, PX = -CWz / 2 + 40 + PS / 2, PY = 0, LD = 250, Z = 2;
    const SWP = 2.45, THY = 96, TX = [192, 318, 444], TS = 108;
    // cursor (and lens) keys in card coordinates
    // A: the cap meeting the shoulder · B: the label's edge · C: the top of the arch · D: the figure
    const keys = [[0, 560, 396], [0.45, 560, 396], [0.95, PX + 88, -150], [1.35, PX + 88, -150], [1.95, PX + 78, 72], [2.1, PX + 78, 72],
      [SWP - 0.1, TX[1] + 8, THY + 10], [SWP + 0.25, TX[1] + 8, THY + 10], [3.2, PX - 96, -150], [3.45, PX - 96, -150], [4.15, PX + 40, 178], [4.7, PX + 40, 178]];
    // the 2× copy counter-moves: copy centre = −Z × (lens − photo centre), on the same legs and easings as the cursor
    const inner = keys.map(([t, x, y]) => [t, r1(-Z * (x - PX)), r1(-Z * (y - PY))]);
    const IN1 = 0.86, OUT1 = 2.08, IN2 = 3.08;
    const thumbs = [6, 8, 7];
    return [
      rect({ id: 'card', w: CWz, h: CHz, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        photo({ id: 'photoA', v: 6, x: PX, y: PY, w: PS, h: PS, r: 28, k: enter(0.16, { blur: 0, s: 0.97 }) }),
        photo({ id: 'photoB', v: 8, x: PX, y: PY, w: PS, h: PS, r: 28, k: { opacity: [0, [SWP + 0.04, SWP + 0.34, 1, 'Power2 Out']] } }),
        text({ id: 'eyebrow', text: 'Skincare', x: 130, y: -250, ax: 0, size: 22, weight: 600, ls: 0.14, upper: true, color: 'muted', k: enter(0.24) }),
        text({ id: 'name', text: 'Daily serum', x: 130, y: -196, ax: 0, size: 54, weight: 600, ls: -0.03, k: enter(0.28, { dx: -14, x0: 130 }) }),
        text({ id: 'detail', text: '30 ml · Amber glass', x: 130, y: -140, ax: 0, size: 26, color: 'muted', k: enter(0.32) }),
        text({ id: 'price', text: '$42', x: 130, y: -58, ax: 0, size: 44, weight: 600, ls: -0.02, tnum: false, k: enter(0.36) }),
        ...thumbs.map((v, i) => photo({ id: 'thumb' + i, v, x: TX[i], y: THY, w: TS, h: TS, r: 20,
          k: k({ scale: [0.9, [0.47 + i * 0.05, 0.85 + i * 0.05, 1, 'Power3 Out']] }, { opacity: [0, [0.47 + i * 0.05, 0.77 + i * 0.05, i ? 0.55 : 1, 'Power2 Out'],
            ...(i === 0 ? [[SWP + 0.04, SWP + 0.3, 0.55, 'Power2 Out']] : i === 1 ? [[SWP + 0.04, SWP + 0.3, 1, 'Power2 Out']] : [])] }, i === 1 ? press(SWP) : null) })),
        rect({ id: 'thumbRing', x: TX[0] - 64, y: THY, pin: 'l', w: 128, h: 128, r: 28, stroke: 'ink', sw: 3,
          k: k(fadeIn(0.6), edges(SWP + 0.02, TX[0] - 64, TX[0] + 64, TX[1] - 64, TX[1] + 64)) }),
        rect({ id: 'addToBag', x: 130 + 220, y: 250, w: 440, h: 88, r: 44, fill: 'ink', k: enter(0.5, { blur: 0 }), ch: [
          text({ text: 'Add to bag', size: 28, weight: 600, color: 'inv' }),
        ] }),
        group({ id: 'lens', x: keys[0][1], y: keys[0][2], k: k({ x: legs(keys, 1, 'Power2 Smooth'), y: legs(keys, 2, 'Sine Smooth') },
          { scale: [0.4, [IN1, IN1 + 0.42, 1, 'Back Out'], [OUT1, OUT1 + 0.16, 0.5, 'Power2 In'], [IN2, IN2 + 0.42, 1, 'Back Out']],
            opacity: [0, [IN1, IN1 + 0.12, 1, 'Power2 Out'], [OUT1, OUT1 + 0.16, 0, 'Power2 In'], [IN2, IN2 + 0.12, 1, 'Power2 Out']] }), ch: [
          rect({ id: 'lensClip', w: LD, h: LD, r: LD / 2, fill: 'soft', clip: true, shadow: 2, ch: [
            group({ id: 'lensView', x: inner[0][1], y: inner[0][2], k: { x: legs(inner, 1, 'Power2 Smooth'), y: legs(inner, 2, 'Sine Smooth') }, ch: [
              photo({ id: 'zoomA', v: 6, w: PS, h: PS, r: 0, scale: Z }),
              photo({ id: 'zoomB', v: 8, w: PS, h: PS, r: 0, scale: Z, k: { opacity: [0, [SWP, 1]] } }),
            ] }),
          ] }),
          circle({ id: 'lensRim', d: LD, stroke: '#FFFFFF', sw: 6 }),
          rect({ id: 'zoomBadge', x: 78, y: 92, w: 64, h: 40, r: 20, fill: 'acc', ch: [text({ text: '2×', size: 22, weight: 600, color: '#FFFFFF', tnum: false })] }),
        ] }),
      ] }),
      cursorLayer(keys, [SWP], [], { inAt: 0.4 }),
    ];
  },
});

})();
