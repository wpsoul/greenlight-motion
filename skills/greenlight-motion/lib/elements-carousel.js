/* UI Motion Kit — carousel elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, photo, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
// the main shape's pop-in from empty
const popIn = (t = 0.1, from = 0.7) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (tracks, dots, backgrounds that should not scale or blur in)
const fadeIn = (t, dur = 0.3) => enter(t, { blur: 0, s: 1, dur });
const clamp01 = (u) => Math.max(0, Math.min(1, u));
const r1 = (v) => Math.round(v * 10) / 10;
const r3 = (v) => Math.round(v * 1000) / 1000;
// value of a numeric track array at t (same rules as the engine: hold until t0, ease to v by t1)
const evalK = (arr, base, t) => {
  let v = base; const segs = [];
  for (const s of arr) { if (!Array.isArray(s)) v = s; else segs.push(s.length === 2 ? [s[0], s[0], s[1], 'Hold'] : s); }
  segs.sort((a, b) => a[0] - b[0]);
  for (const [t0, t1, val, e] of segs) {
    if (t < t0) break;
    if (t >= t1) { v = val; continue; }
    return v + (val - v) * UIK.ease(e || 'Power3 Out')((t - t0) / (t1 - t0));
  }
  return v;
};
// fn(t) over [t0, t1] as the fewest Linear segments that stay within eps of it (sampled at 60 fps).
// Used where a value is a function of another eased motion (a point riding an ellipse, a card's opacity
// as a function of where the strip has carried it). Constant stretches emit nothing (the track holds).
const fitK = (t0, t1, fn, eps, rnd = r1) => {
  const n = Math.max(1, Math.ceil((t1 - t0) * 60)), ts = [], vs = [];
  for (let j = 0; j <= n; j++) { const t = t0 + (t1 - t0) * j / n; ts.push(t); vs.push(fn(t)); }
  const segs = [];
  for (let i = 0; i < n;) {
    let j = i + 1;
    for (let jj = j + 1; jj <= n; jj++) {
      let ok = true;
      for (let q = i + 1; q < jj && ok; q++) ok = Math.abs(vs[i] + (vs[jj] - vs[i]) * (ts[q] - ts[i]) / (ts[jj] - ts[i]) - vs[q]) <= eps;
      if (!ok) break;
      j = jj;
    }
    if (Math.abs(vs[j] - vs[i]) > 1e-6) segs.push([r3(ts[i]), r3(ts[j]), rnd(vs[j]), 'Linear']);
    i = j;
  }
  return segs;
};
// liquid indicator for a pin 'l' rect: the leading edge travels fast, the trailing edge follows late.
// x (= left edge) is one eased segment; w (= right − left) is sampled into short linear segments.
const edges = (t, L0, R0, L1, R1, o = {}) => {
  const right = (L1 + R1) > (L0 + R0), fast = o.fast ?? 0.34, slow = o.slow ?? 0.5, lag = o.lag ?? 0.08, n = o.n ?? 10;
  const f = UIK.ease('Power3 Out'), at = (tt, a, b, t0, d) => a + (b - a) * f(clamp01((tt - t0) / d));
  const Lf = (tt) => (right ? at(tt, L0, L1, t + lag, slow) : at(tt, L0, L1, t, fast));
  const Rf = (tt) => (right ? at(tt, R0, R1, t, fast) : at(tt, R0, R1, t + lag, slow));
  const end = t + lag + slow, w = [];
  for (let j = 1; j <= n; j++) { const a = t + (end - t) * (j - 1) / n, b = t + (end - t) * j / n; w.push([r3(a), r3(b), +(Rf(b) - Lf(b)).toFixed(2), 'Linear']); }
  return { x: [right ? [t + lag, t + lag + slow, L1, 'Power3 Out'] : [t, t + fast, L1, 'Power3 Out']], w };
};
// a caption that swaps: enters at tIn (sliding in from dx), leaves at tOut drifting the other way
const swapK = (x0, tIn, tOut, dx = 24, first = false) => k(
  first ? enter(tIn, { dx: -14, x0 }) : enter(tIn, { dx, x0 }),
  tOut != null ? k(exit(tOut), { x: [[tOut, tOut + 0.2, x0 - dx, 'Power2 In']] }) : null);
// a round icon button
const roundBtn = (id, x, y, d, ic, o = {}) => circle({ id, x, y, d, fill: o.fill || 'soft', stroke: o.stroke, sw: o.stroke ? 2 : 0, k: o.k,
  ch: [icon({ id: id + 'Ic', icon: ic, size: d * 0.42, sw: 2.6, color: o.color || 'ink' })] });

// ── the phone (no device branding): an ink bezel round a clipped screen.
//    Screen coordinates: centre 0,0 — top edge −500, bottom +500, sides ±250. ──
const PW = 500, PH = 1000, PR = 64, BZ = 14, PHONE_CAM = 0.86;
const phone = (o) => group({ id: 'phone', k: o.k || popIn(0.1, 0.72), ch: [
  rect({ id: 'bezel', w: PW + 2 * BZ, h: PH + 2 * BZ, r: PR + BZ, fill: 'ink', shadow: 1 }),
  rect({ id: 'glass', w: PW + 4, h: PH + 4, r: PR + 2, fill: 'dim' }),
  rect({ id: 'screen', w: PW, h: PH, r: PR, fill: o.fill || 'card', clip: true, ch: o.ch }),
] });
const statusBar = (t0 = 0.26) => group({ id: 'statusBar', y: -462, k: fadeIn(t0), ch: [
  text({ id: 'sbTime', text: '9:41', x: -188, size: 24, weight: 600 }),
  circle({ id: 'camera', d: 22, fill: 'ink' }),
  rect({ id: 'sbBattery', x: 182, w: 40, h: 20, r: 6, stroke: 'ink', sw: 2.4, ch: [rect({ id: 'sbCharge', x: -14, pin: 'l', w: 22, h: 12, r: 3, fill: 'ink' })] }),
] });
const homeBar = (t0 = 0.3) => rect({ id: 'homeBar', y: 482, w: 150, h: 6, r: 3, fill: 'ink/80', k: fadeIn(t0) });

// 1 ─ Snap carousel: the cursor drags the strip, lets go, and it snaps a card to the centre
UIK.define({
  id: 'carousel-snap', formats: ['html'], name: 'Snap carousel', cat: 'carousel', T: 4.2, cam: 1.1,
  desc: 'The cursor grabs the card strip and drags it part-way; on release it snaps on to the next card (Power4 Out). The second drag overshoots past a card and the strip snaps back to it. The grabbed card dips while held and the ink page pill stretches from dot to dot on each snap.',
  build: () => {
    // the strip starts on card 1; drag 1 stops 0.62 of a card short and snaps on, drag 2 overshoots 0.35 and snaps back
    const P = 560, D1 = 1.0, R1 = 1.55, D2 = 2.4, R2 = 3.1, G1 = -P - 347, G2 = -2 * P - 756, E = 'Power2 Smooth', DY = 282;
    const items = [[6, 'Makers', '11 places'], [1, 'Alpine lakes', '12 places'], [3, 'City breaks', '24 places'], [5, 'Coastline', '9 places'], [7, 'Greenhouses', '7 places'], [8, 'Old towns', '15 places']];
    const DX = [-80, -48, -16, 16, 48, 80], pl = (i) => DX[i] - 18;
    const grab = (t0, t1) => ({ scale: [[t0 - 0.06, t0 + 0.12, 0.97, 'Power2 Out'], [t1, t1 + 0.4, 1, 'Power3 Out']] });
    return [
      rect({ id: 'card', w: 1240, h: 660, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'Collections', x: -576, y: -262, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -576 }) }),
        text({ id: 'hint', text: 'Drag to explore', x: 576, y: -262, ax: 1, size: 26, color: 'muted', k: enter(0.3) }),
        rect({ id: 'viewport', y: 10, w: 1160, h: 440, clip: true, ch: [
          group({ id: 'strip', x: -P, k: { x: [[D1, R1, G1, E], [R1 + 0.02, R1 + 0.55, -2 * P, 'Power4 Out'], [D2, R2, G2, E], [R2 + 0.02, R2 + 0.6, -3 * P, 'Power4 Out']] },
            ch: items.map(([v, t, m], i) => group({ id: 'item' + i, x: i * P,
              k: k(enter(0.26 + Math.abs(i - 1) * 0.07, { dx: 40, x0: i * P }), i === 1 ? grab(D1, R1) : i === 3 ? grab(D2, R2) : null), ch: [
                photo({ id: 'photo' + i, v, y: -40, w: 520, h: 340, r: 28 }),
                text({ id: 'name' + i, text: t, x: -258, y: 172, ax: 0, size: 32, weight: 600, ls: -0.01 }),
                text({ id: 'meta' + i, text: m, x: 258, y: 172, ax: 1, size: 26, color: 'muted' }),
              ] })) }),
        ] }),
        ...DX.map((x, i) => circle({ id: 'dot' + i, x, y: DY, d: 12, fill: 'dim', k: fadeIn(0.5 + i * 0.03) })),
        rect({ id: 'pill', x: pl(1), y: DY, pin: 'l', w: 36, h: 12, r: 6, fill: 'ink',
          k: k(fadeIn(0.5), edges(R1 + 0.02, pl(1), pl(1) + 36, pl(2), pl(2) + 36), edges(R2 + 0.02, pl(2), pl(2) + 36, pl(3), pl(3) + 36)) }),
      ] }),
      cursorLayer([[0, 640, 440], [0.55, 640, 440], [D1 - 0.12, 150, -20], [D1, 150, -20], [R1, 150 - 347, -20, E], [R1 + 0.45, -90, 90],
        [D2 - 0.14, 360, -10], [D2, 360, -10], [R2, 360 - 756, -10, E], [R2 + 0.5, -300, 170], [4.2, -270, 190]], [], [[D1, R1], [D2, R2]], { inAt: 0.5 }),
    ];
  },
});

// 2 ─ Peek carousel: the centre card is full size, its neighbours peek smaller and dimmed; arrows advance it
UIK.define({
  id: 'carousel-peek', name: 'Peek carousel', cat: 'carousel', T: 4.0, cam: 1.0,
  desc: 'A centre card with its neighbours peeking in at the edges, scaled to 0.86 and dimmed. The next arrow is clicked twice: the strip glides one card each time and the scale and dim hand over as cards pass the centre, while the caption under the centre card swaps.',
  build: () => {
    const P = 660, C = [1.2, 2.35], DUR = 0.7, E = 'Power4 Out', A = [1, 2, 3], CY = -64, TX = -300, BY = 262;
    const items = [[3, 'Harbour walk', 'Lisbon · 2.4 km'], [5, 'Tide pools', 'Porto · 1.1 km'], [1, 'Ridge trail', 'Sintra · 6.8 km'], [8, 'Old quarter', 'Évora · 3.0 km'], [7, 'Botanic garden', 'Coimbra · 1.6 km']];
    const SC = (d) => (d ? 0.86 : 1), OP = (d) => (d ? 0.42 : 1);
    const cardK = (i) => {
      const d0 = i - A[0], t = 0.26 + Math.min(2, Math.abs(d0)) * 0.08, x0 = i * P;
      const sc = [SC(d0)], op = [0, [t, t + 0.3, OP(d0), 'Power2 Out']];
      C.forEach((c, j) => {
        const da = i - A[j], db = i - A[j + 1];
        if (SC(da) !== SC(db)) sc.push([c, c + DUR, SC(db), E]);
        if (OP(da) !== OP(db)) op.push([c + 0.04, c + 0.5, OP(db), 'Power2 Out']);
      });
      return { scale: sc, opacity: op, blur: [8, [t, t + 0.3, 0, 'Power2 Out']], x: [x0 + Math.sign(d0) * 60, [t, t + 0.5, x0, 'Power3 Out']] };
    };
    return [
      rect({ id: 'panel', w: 1440, h: 800, r: 48, fill: 'card', shadow: 1, clip: true, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'Walks near you', x: TX, y: -336, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: TX }) }),
        text({ id: 'count', text: '5 routes', x: -TX, y: -336, ax: 1, size: 26, color: 'muted', k: enter(0.3) }),
        group({ id: 'strip', y: CY, x: -A[0] * P, k: { x: C.map((c, j) => [c, c + DUR, -A[j + 1] * P, E]) },
          ch: items.map(([v], i) => photo({ id: 'card' + i, v, x: i * P, w: 600, h: 440, r: 32, k: cardK(i) })) }),
        ...A.map((a, j) => group({ id: 'caption' + a, k: swapK(0, j ? C[j - 1] + 0.12 : 0.42, C[j], 24, !j), ch: [
          text({ id: 'capTitle' + a, text: items[a][1], x: TX, y: 240, ax: 0, size: 38, weight: 600, ls: -0.02 }),
          text({ id: 'capSub' + a, text: items[a][2], x: TX, y: 284, ax: 0, size: 26, color: 'muted' }),
        ] })),
        roundBtn('prev', 206, BY, 80, 'chevronLeft', { k: fadeIn(0.5) }),
        roundBtn('next', 300, BY, 80, 'chevronRight', { fill: 'ink', color: 'inv', k: k(fadeIn(0.55), press(C[0], { to: 0.9 }), press(C[1], { to: 0.9 })) }),
      ] }),
      cursorLayer([[0, 560, 440], [0.6, 560, 440], [C[0] - 0.1, 306, BY + 8], [C[0] + 0.25, 306, BY + 8], [C[0] + 0.55, 340, BY + 50], [C[1] - 0.1, 306, BY + 8],
        [C[1] + 0.25, 306, BY + 8], [4.0, 400, 380]], C, [], { inAt: 0.55 }),
    ];
  },
});

// 3 ─ Cover flow: side covers squeezed and stacked behind, the centre one full; clicks flow them through
UIK.define({
  id: 'coverflow', name: 'Cover flow', cat: 'carousel', T: 3.9, cam: 1.0,
  desc: 'Faux-3D cover flow: side covers are squeezed to half width, shaded and stacked behind one another; the centre cover is full. Clicking the next cover flows the row along — the incoming cover un-squeezes as it reaches the centre while the old one squeezes away — the title swaps and the ink scrubber thumb stretches along.',
  build: () => {
    const A0 = 2, STEPS = [[1.1, 3], [2.3, 4]], DUR = 0.65, E = 'Power3 Out', CY = -76, S = 380;
    const albums = [['Low Tide', 'Mara Voss', 3], ['Paper Moon', 'The Quiet Hours', 5], ['Northern Lines', 'Ilse Brandt', 1], ['Glasshouse', 'June Harbor', 7],
      ['Slow Signal', 'Otto Lane', 4], ['Soft Machines', 'Kite Theory', 6], ['Afterglow', 'Nell Ames', 8], ['Field Notes', 'Arlo Finch', 2]];
    const X = (d) => (d === 0 ? 0 : Math.sign(d) * (320 + (Math.abs(d) - 1) * 84));
    const SX = (d) => (d ? 0.46 : 1), SY = (d) => (d ? 0.88 : 1), SH = (d) => (d ? Math.min(0.5, 0.18 + 0.08 * (Math.abs(d) - 1)) : 0);
    // paint order: there is no z-order track, so the static order has to satisfy every pair that overlaps
    // during the clip — left side: nearer the centre on top (ascending), right side: descending. With two
    // steps to the right this is one order: 0 1 2 | 7 6 5 4 | 3 (item 3 is the first to reach the centre).
    const ORDER = [0, 1, 2, 7, 6, 5, 4, 3];
    const trackOf = (i, f) => {
      const tr = [f(i - A0)];
      let a = A0;
      for (const [t, b] of STEPS) { if (f(i - b) !== f(i - a)) tr.push([t, t + DUR, f(i - b), E]); a = b; }
      return tr;
    };
    const cover = (i) => {
      const d0 = i - A0, t = 0.2 + Math.abs(d0) * 0.06, hit = STEPS.findIndex(([, b]) => b === i);
      return photo({ id: 'cover' + i, v: albums[i][2], y: CY, w: S, h: S, r: 18,
        k: k({ x: trackOf(i, X), sx: trackOf(i, SX), sy: trackOf(i, SY), opacity: [0, [t, t + 0.3, 1, 'Power2 Out']],
               scale: [0.9, [t, t + 0.5, 1, 'Power3 Out']] }, hit >= 0 ? press(STEPS[hit][0], { to: 0.95 }) : null),
        ch: [rect({ id: 'shade' + i, w: S, h: S, fill: 'shade', opacity: SH(d0), k: { opacity: trackOf(i, SH) } })] });
    };
    const TL = (a) => -200 + a * 50;
    return [
      rect({ id: 'panel', w: 1440, h: 740, r: 48, fill: 'card', shadow: 1, clip: true, k: popIn(0.1), ch: [
        ...ORDER.map(cover),
        ...[A0, 3, 4].map((a, j) => group({ id: 'caption' + a, k: j ? k(enter(STEPS[j - 1][0] + 0.14, { dy: 12 }), j < 2 ? exit(STEPS[j][0]) : null) : k(enter(0.4, { dy: 12 }), exit(STEPS[0][0])), ch: [
          text({ id: 'album' + a, text: albums[a][0], y: 196, size: 40, weight: 600, ls: -0.02 }),
          text({ id: 'artist' + a, text: albums[a][1], y: 240, size: 26, color: 'muted' }),
        ] })),
        rect({ id: 'scrubTrack', y: 306, w: 400, h: 6, r: 3, fill: 'skel', k: fadeIn(0.5) }),
        rect({ id: 'scrubThumb', x: TL(A0), y: 306, pin: 'l', w: 50, h: 6, r: 3, fill: 'ink',
          k: k(fadeIn(0.5), edges(STEPS[0][0] + 0.02, TL(2), TL(2) + 50, TL(3), TL(3) + 50), edges(STEPS[1][0] + 0.02, TL(3), TL(3) + 50, TL(4), TL(4) + 50)) }),
      ] }),
      cursorLayer([[0, 600, 430], [0.6, 600, 430], [STEPS[0][0] - 0.1, 330, CY + 30], [STEPS[0][0] + 0.25, 330, CY + 30], [STEPS[0][0] + 0.6, 420, CY + 120],
        [STEPS[1][0] - 0.1, 330, CY + 30], [STEPS[1][0] + 0.25, 330, CY + 30], [3.9, 470, 260]], STEPS.map((s) => s[0]), [], { inAt: 0.55 }),
    ];
  },
});

// 4 ─ Ring carousel: photos ride an ellipse that turns a step at a time; the front one is largest
UIK.define({
  id: 'ring-carousel', name: 'Ring carousel', cat: 'carousel', T: 4.0, cam: 1.0,
  desc: 'Six photos sit on a flat ellipse — x follows the cosine, height, size and opacity follow the sine, so the back of the ring is small and faint. Each click on the next arrow turns the ring one step: every photo rides the curve to its neighbour\'s place and the new front photo gets its caption.',
  build: () => {
    const N = 6, RX = 600, RY = 215, CY = -84, W = 300, H = 210, CL = [1.15, 2.35], DUR = 0.85, E = UIK.ease('Power3 Out'), BY = 300;
    const names = [['Harbour', '14 photos'], ['Dunes', '9 photos'], ['Old town', '22 photos']];
    const ang = (i, t) => { let s = 0; for (const c of CL) s += E(clamp01((t - c) / DUR)); return (90 - 60 * i + 60 * s) * Math.PI / 180; };
    const at = (i, t) => { const a = ang(i, t), s = Math.sin(a); return { x: RX * Math.cos(a), y: CY + RY * s, scale: 0.62 + 0.19 * (1 + s), opacity: 0.3 + 0.35 * (1 + s) }; };
    const EPS = { x: 3, y: 2, scale: 0.01, opacity: 0.02 };   // fit tolerance: keeps the key count down
    const item = (i) => {
      const p0 = at(i, 0), tr = {};
      for (const p of ['x', 'y', 'scale', 'opacity']) {
        tr[p] = [p === 'opacity' ? 0 : p0[p]];
        if (p === 'opacity') tr[p].push([0.22 + i * 0.05, 0.52 + i * 0.05, r3(p0.opacity), 'Power2 Out']);
        for (const c of CL) tr[p].push(...fitK(c, c + DUR, (t) => at(i, t)[p], EPS[p], p === 'x' || p === 'y' ? r1 : r3));
      }
      tr.blur = [8, [0.22 + i * 0.05, 0.52 + i * 0.05, 0, 'Power2 Out']];
      return photo({ id: 'photo' + i, v: [3, 5, 8, 1, 7, 6][i], x: r1(p0.x), y: r1(p0.y), w: W, h: H, r: 24, shadow: 3, k: tr });
    };
    return [
      path({ id: 'orbit', d: `M${-RX} ${CY} A${RX} ${RY} 0 1 1 ${RX} ${CY} A${RX} ${RY} 0 1 1 ${-RX} ${CY}`, stroke: 'ink/12', sw: 2, trimmed: true,
        k: { trimE: [0, [0.12, 0.9, 100, 'Power3 Out']] } }),
      ...Array.from({ length: N }, (_, i) => item(i)),
      ...names.map(([t, s], j) => group({ id: 'caption' + j, k: k(j ? enter(CL[j - 1] + 0.3, { dy: 12 }) : enter(0.5, { dy: 12 }), j < 2 ? exit(CL[j]) : null), ch: [
        text({ id: 'capTitle' + j, text: t, y: BY - 18, size: 36, weight: 600, ls: -0.02 }),
        text({ id: 'capSub' + j, text: s, y: BY + 22, size: 24, color: 'muted' }),
      ] })),
      roundBtn('prev', -250, BY, 72, 'chevronLeft', { fill: 'card', k: fadeIn(0.55) }),
      roundBtn('next', 250, BY, 72, 'chevronRight', { fill: 'ink', color: 'inv', k: k(fadeIn(0.6), press(CL[0], { to: 0.9 }), press(CL[1], { to: 0.9 })) }),
      cursorLayer([[0, 620, 440], [0.6, 620, 440], [CL[0] - 0.1, 256, BY + 8], [CL[0] + 0.25, 256, BY + 8], [CL[0] + 0.6, 300, BY + 60], [CL[1] - 0.1, 256, BY + 8],
        [CL[1] + 0.25, 256, BY + 8], [4.0, 380, 420]], CL, [], { inAt: 0.55 }),
    ];
  },
});

// 5 ─ Orbit gallery: photo tiles orbit a title card on two rings; one is clicked and flies to the centre
UIK.define({
  id: 'orbit-gallery', name: 'Orbit gallery', cat: 'carousel', T: 3.7, cam: 0.95,
  desc: 'Photo tiles drift round a centred title card on two elliptical rings, the inner one clockwise and faster, the outer one slower the other way. The cursor catches an inner tile as it passes; it flies to the centre and grows into the hero picture while the title card blurs away, the other tiles dim and keep orbiting behind, and a caption chip pops on the hero.',
  build: () => {
    const T = 3.7, TC = 2.1, HERO = 420, TS = 124, SS = 112;
    const rings = [
      { n: 5, rx: 420, ry: 240, w: 14, a0: -4, gap: 72, size: TS, v: [5, 6, 1, 7, 3] },
      { n: 8, rx: 690, ry: 400, w: -8, a0: 22.5, gap: 45, size: SS, v: [8, 2, 0, 9, 1, 7, 6, 3] },
    ];
    const pos = (ring, i, t) => { const a = (ring.a0 + ring.gap * i + ring.w * t) * Math.PI / 180; return { x: ring.rx * Math.cos(a), y: ring.ry * Math.sin(a) }; };
    const dim = { opacity: [[TC + 0.12, TC + 0.5, 0.35, 'Power2 Out']] };
    const tile = (ri, i) => {
      const ring = rings[ri], hero = ri === 0 && i === 0, tEnd = hero ? TC : T, p0 = pos(ring, i, 0), t0 = 0.24 + (ri * 5 + i) * 0.035;
      const xy = (p) => [r1(p0[p]), ...fitK(0, tEnd, (t) => pos(ring, i, t)[p], 1)];
      if (!hero) return photo({ id: `tile${ri}_${i}`, v: ring.v[i], x: r1(p0.x), y: r1(p0.y), w: ring.size, h: ring.size, r: 20, shadow: 3,
        k: k({ x: xy('x'), y: xy('y') }, pop(t0, { from: 0.5, dur: 0.5 }), dim) });
      // the hero is built at full size and starts scaled down to a tile — it is ONE photo layer that grows
      const s0 = TS / HERO, E = 'Power4 Out';
      return photo({ id: 'hero', v: ring.v[i], x: r1(p0.x), y: r1(p0.y), w: HERO, h: HERO, r: 64, shadow: 2,
        k: { x: [...xy('x'), [TC + 0.02, TC + 0.75, 0, E]], y: [...xy('y'), [TC + 0.02, TC + 0.75, 0, E]],
             scale: [0, [t0, t0 + 0.5, s0, 'Back Out'], [TC - 0.07, TC, s0 * 0.9, 'Power2 Out'], [TC + 0.02, TC + 0.75, 1, E]],
             opacity: [0, [t0, t0 + 0.12, 1, 'Linear']] },
        ch: [rect({ id: 'heroChip', x: -210 + 24, y: 210 - 24 - 28, pin: 'l', chAt: 'pin', w: 176, h: 56, r: 28, fill: 'card', shadow: 3, k: pop(TC + 0.62, { from: 0.6 }),
          ch: [text({ text: 'Linen set', x: 26, ax: 0, size: 24, weight: 600 })] })] });
    };
    const hit = (dt) => { const p = pos(rings[0], 0, TC + dt); return [r1(p.x + 12), r1(p.y + 14)]; };
    return [
      ...rings.map((g, ri) => path({ id: 'ring' + ri, d: `M${-g.rx} 0 A${g.rx} ${g.ry} 0 1 1 ${g.rx} 0 A${g.rx} ${g.ry} 0 1 1 ${-g.rx} 0`, stroke: 'ink/10', sw: 2, trimmed: true,
        k: { trimE: [0, [0.14 + ri * 0.08, 0.9 + ri * 0.08, 100, 'Power3 Out']] } })),
      rect({ id: 'titleCard', w: 360, h: 170, r: 36, fill: 'card', shadow: 1, k: k(popIn(0.1), exit(TC + 0.12, { dur: 0.22, s: 0.9 })), ch: [
        text({ id: 'title', text: 'Moodboard', y: -22, size: 44, weight: 600, ls: -0.02, k: enter(0.24, { dy: 10, y0: -22 }) }),
        text({ id: 'sub', text: 'Spring · 36 references', y: 30, size: 24, color: 'muted', k: enter(0.32) }),
      ] }),
      ...rings[1].v.map((_, i) => tile(1, i)),
      ...rings[0].v.map((_, i) => tile(0, i)).reverse(),
      cursorLayer([[0, 780, 470], [1.05, 780, 470], [TC - 0.16, ...hit(-0.16)], [TC, ...hit(0), 'Linear'], [TC + 0.5, 470, 330], [T, 520, 380]], [TC], [], { inAt: 1.0 }),
    ];
  },
});

// 6 ─ Testimonial carousel: quote cards slide, the avatar ring hops, the name swaps
UIK.define({
  id: 'testimonial-carousel', name: 'Testimonial carousel', cat: 'carousel', T: 4.2, cam: 1.2,
  desc: 'Quotes sit in a clipped strip above a row of customer avatars. Clicking an avatar slides the strip to that quote (a two-slide jump carries a touch of motion blur), the ink ring stretches across to the new face, the other faces dim, and the name and role under the quote swap.',
  build: () => {
    // quotes are measured to wrap to exactly two lines at 960 px, so one clip (QY, 124 high) fits them all
    const C = [1.15, 2.5], ACT = [0, 1, 3], QW = 1000, QX = -480, QY = -102, AY = 190, AX = [-444, -348, -252, -156];
    const Q = [
      ['The handoff used to take a week. Now the whole team ships from one file, and nothing gets lost.', 'Maya Chen', 'Head of Design, Fieldnote', 'dim'],
      ['It gets out of the way. We spend our time on the work itself instead of on the process around it.', 'Leo Park', 'Engineering lead, Tandem', 'skel'],
      ['Our launch pages went from idea to live in an afternoon. The review loop alone paid for it.', 'Sara Holm', 'Marketing, Brightside', 'soft'],
      ['Clear, calm and fast. It is the first tool the whole studio actually agreed on.', 'Jonah Diaz', 'Founder, Northfold', 'ink/20'],
    ];
    const on = (i) => ACT.map((a) => (a === i ? 1 : 0.45));
    const avK = (i) => {
      const o = on(i), op = [0, [0.5 + i * 0.05, 0.8 + i * 0.05, o[0], 'Power2 Out']];
      C.forEach((c, j) => { if (o[j + 1] !== o[j]) op.push([c + 0.04, c + 0.34, o[j + 1], 'Power2 Out']); });
      const pr = C.findIndex((c, j) => ACT[j + 1] === i);
      return k({ opacity: op, scale: [0.6, [0.5 + i * 0.05, 0.9 + i * 0.05, 1, 'Back Out']] }, pr >= 0 ? press(C[pr], { to: 0.9 }) : null);
    };
    const RL = (i) => AX[i] - 44;
    return [
      rect({ id: 'card', w: 1120, h: 580, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        text({ id: 'quoteMark', text: '“', x: QX - 6, y: -186, ax: 0, size: 120, weight: 600, color: 'acc', tnum: false, k: enter(0.22, { s: 0.7 }) }),
        rect({ id: 'quoteClip', y: QY, w: QW, h: 124, clip: true, ch: [
          group({ id: 'quotes', k: { x: [[C[0], C[0] + 0.6, -QW, 'Power4 Out'], [C[1], C[1] + 0.75, -3 * QW, 'Power4 Out']],
                                     blur: [[C[1], C[1] + 0.1, 3, 'Power2 Out'], [C[1] + 0.1, C[1] + 0.55, 0, 'Power2 Out']] },
            ch: Q.map(([q], j) => text({ id: 'quote' + j, text: q, x: QX + j * QW, ax: 0, size: 40, weight: 500, ls: -0.015, lh: 1.3, wrap: 960, k: j ? null : enter(0.3, { dy: 16 }) })) }),
        ] }),
        ...ACT.map((a, j) => group({ id: 'who' + a, k: swapK(0, j ? C[j - 1] + 0.14 : 0.4, j < 2 ? C[j] : null, 20, !j), ch: [
          text({ id: 'name' + a, text: Q[a][1], x: QX, y: 8, ax: 0, size: 30, weight: 600, ls: -0.01 }),
          text({ id: 'role' + a, text: Q[a][2], x: QX, y: 46, ax: 0, size: 24, color: 'muted' }),
        ] })),
        rect({ id: 'divider', y: 112, w: QW, h: 2, fill: 'line', k: fadeIn(0.4) }),
        ...AX.map((x, i) => photo({ id: 'avatar' + i, v: 2, x, y: AY, w: 72, h: 72, r: 36, fill: Q[i][3], k: avK(i) })),
        rect({ id: 'ring', x: RL(0), y: AY, pin: 'l', w: 88, h: 88, r: 44, stroke: 'ink', sw: 3,
          k: k(fadeIn(0.7), edges(C[0] + 0.02, RL(0), RL(0) + 88, RL(1), RL(1) + 88), edges(C[1] + 0.02, RL(1), RL(1) + 88, RL(3), RL(3) + 88, { fast: 0.4, slow: 0.58 })) }),
        icon({ id: 'star', icon: 'star', x: 222, y: AY, size: 26, sw: 2.2, filled: true, fill: 'ink', k: enter(0.6) }),
        text({ id: 'rating', text: '4.9 · 1,200 reviews', x: 480, y: AY, ax: 1, size: 26, weight: 500, k: enter(0.62) }),
      ] }),
      cursorLayer([[0, 600, 400], [0.6, 600, 400], [C[0] - 0.1, AX[1] + 8, AY + 10], [C[0] + 0.25, AX[1] + 8, AY + 10], [C[0] + 0.6, AX[1] + 60, AY + 70],
        [C[1] - 0.12, AX[3] + 8, AY + 10], [C[1] + 0.25, AX[3] + 8, AY + 10], [4.2, 120, 380]], C, [], { inAt: 0.55 }),
    ];
  },
});

// 7 ─ Autoplay progress: segmented bars fill over time and advance the slides; hover pauses it
UIK.define({
  id: 'autoplay-progress', name: 'Autoplay progress', cat: 'carousel', T: 4.4, cam: 1.12,
  desc: 'An autoplaying hero carousel with three segmented progress bars on top. Each bar fills linearly while its slide slowly pushes in; when it is full the slide strip glides to the next photo and the caption swaps. The cursor hovers the third slide mid-fill: the bar and the push-in stop and a Paused chip pops.',
  build: () => {
    const SW = 1100, SH = 540, SY = -48, BY = -352, SEG = 358, GAP = 13, E = 'Power4 Out';
    const F = [[0.45, 1.55], [1.62, 2.72], [2.79, 3.89]], A = [F[0][1], F[1][1]], HOV = 3.42, KB = 0.028;
    const slides = [[1, 'Autumn edit', 'New arrivals · 24 pieces'], [5, 'Coastal linen', 'Light layers for warm days'], [7, 'Home & plants', 'Ceramics, pots and throws']];
    const BX = (j) => -SW / 2 + j * (SEG + GAP);
    const fillTo = (j) => (j < 2 ? [F[j][0], F[j][1], SEG, 'Linear'] : [F[j][0], HOV, r1(SEG * (HOV - F[j][0]) / (F[j][1] - F[j][0])), 'Linear']);
    const kb = [[0.2, A[0] + 0.6], [A[0], A[1] + 0.6], [A[1], HOV]].map(([a, b]) => [a, b, r3(1 + KB * (b - a)), 'Linear']);
    return [
      rect({ id: 'card', w: 1180, h: 800, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        ...[0, 1, 2].map((j) => rect({ id: 'track' + j, x: BX(j), y: BY, pin: 'l', w: SEG, h: 8, r: 4, fill: 'skel', k: fadeIn(0.26 + j * 0.05) })),
        ...[0, 1, 2].map((j) => rect({ id: 'fill' + j, x: BX(j), y: BY, pin: 'l', w: 0, h: 8, r: 4, fill: 'ink', k: { w: [fillTo(j)] } })),
        rect({ id: 'stage', y: SY, w: SW, h: SH, r: 28, fill: 'soft', clip: true, k: enter(0.2, { blur: 0, s: 0.97 }), ch: [
          group({ id: 'strip', k: { x: [[A[0], A[0] + 0.6, -SW, E], [A[1], A[1] + 0.6, -2 * SW, E]] },
            ch: slides.map(([v], j) => photo({ id: 'slide' + j, v, x: j * SW, w: SW, h: SH, r: 0, k: { scale: [kb[j]] } })) }),
          rect({ id: 'paused', x: SW / 2 - 24, y: -SH / 2 + 50, pin: 'r', chAt: 'pin', w: 150, h: 52, r: 26, fill: 'card', shadow: 3, k: pop(HOV + 0.06, { from: 0.6 }), ch: [
            icon({ id: 'pauseIc', icon: 'pause', x: -122, size: 20, sw: 2, filled: true, fill: 'ink' }),
            text({ id: 'pausedLbl', text: 'Paused', x: -100, ax: 0, size: 22, weight: 600 }),
          ] }),
        ] }),
        ...slides.map(([, t, s], j) => group({ id: 'caption' + j, k: swapK(0, j ? A[j - 1] + 0.14 : 0.36, j < 2 ? A[j] : null, 20, !j), ch: [
          text({ id: 'capTitle' + j, text: t, x: -SW / 2, y: 282, ax: 0, size: 40, weight: 600, ls: -0.02 }),
          text({ id: 'capSub' + j, text: s, x: -SW / 2, y: 326, ax: 0, size: 26, color: 'muted' }),
        ] })),
        rect({ id: 'shop', x: SW / 2, y: 302, pin: 'r', chAt: 'pin', w: 196, h: 72, r: 36, fill: 'ink', k: enter(0.44, { blur: 0 }), ch: [
          text({ id: 'shopLbl', text: 'Shop now', x: -98, size: 26, weight: 600, color: 'inv' }),
        ] }),
      ] }),
      cursorLayer([[0, 700, 420], [2.95, 700, 420], [HOV, 170, 10], [4.4, 186, 26]], [], [], { inAt: 2.9 }),
    ];
  },
});

// 8 ─ Hero slider: full-width slides, the headline rises out of line masks, the photo lags in parallax
UIK.define({
  id: 'hero-slider', formats: ['html'], name: 'Hero slider', cat: 'carousel', T: 4.2, cam: 1.0,
  desc: 'A full-width hero: on each click of the next button the slide frame glides left while its photo moves at half the speed inside it (parallax), the old headline lifts out of its line masks and the new one rises into them line by line, and the slide counter rolls.',
  build: () => {
    const W = 1440, H = 800, C = [1.3, 2.6], DUR = 0.9, E = 'Power4 Out', TX = -620, LY = [-66, 44], PX = W / 2, NY = 292;
    const S = [
      { v: 1, kick: 'New season', lines: ['Slow mornings,', 'better days'], sub: 'Linen, wool and light layers for spring.' },
      { v: 3, kick: 'Travel', lines: ['Built for the', 'long weekend'], sub: 'Carry-on pieces that pack flat.' },
      { v: 7, kick: 'Home', lines: ['Light that', 'follows you'], sub: 'Lamps and shades in warm tones.' },
    ];
    const tin = [0.4, C[0] + 0.22, C[1] + 0.22], tout = [C[0], C[1], null];
    const slide = (s, j) => {
      const px = [j ? -PX : 0];
      if (j) px.push([C[j - 1], C[j - 1] + DUR, 0, E]);
      if (tout[j] != null) px.push([tout[j], tout[j] + DUR, PX, E]);
      const lift = tout[j] != null ? [[tout[j], tout[j] + 0.3, -120, 'Power2 In']] : [];
      const fade = (t, y0) => k(enter(t, { dy: 16, y0 }), tout[j] != null ? exit(tout[j]) : null);
      return rect({ id: 'slide' + j, x: j * W, w: W, h: H, clip: true, ch: [
        photo({ id: 'photo' + j, v: s.v, x: px[0], w: W, h: H, r: 0, k: { x: px } }),
        rect({ id: 'scrim' + j, w: W, h: H, fill: 'shade/40' }),
        text({ id: 'kicker' + j, text: s.kick, x: TX, y: -186, ax: 0, size: 24, weight: 600, upper: true, ls: 0.12, color: '#FFFFFF', k: fade(tin[j] - 0.06, -186) }),
        ...s.lines.map((ln, l) => rect({ id: `mask${j}_${l}`, x: TX, y: LY[l], pin: 'l', chAt: 'pin', w: 1100, h: 112, clip: true, ch: [
          text({ id: `line${j}_${l}`, text: ln, ax: 0, size: 92, weight: 600, ls: -0.03, color: '#FFFFFF', tnum: false,
            k: { y: [120, [tin[j] + l * 0.08, tin[j] + l * 0.08 + 0.8, 0, E], ...lift] } }),
        ] })),
        text({ id: 'sub' + j, text: s.sub, x: TX, y: 150, ax: 0, size: 30, color: '#FFFFFFD9', k: fade(tin[j] + 0.2, 150) }),
      ] });
    };
    return [
      rect({ id: 'hero', w: W, h: H, r: 44, fill: 'shade', shadow: 1, clip: true, k: popIn(0.1, 0.8), ch: [
        group({ id: 'slides', k: { x: C.map((c, j) => [c, c + DUR, -(j + 1) * W, E]) }, ch: S.map(slide) }),
        rect({ id: 'cta', x: TX, y: 262, pin: 'l', chAt: 'pin', w: 244, h: 76, r: 38, fill: '#FFFFFF', k: enter(0.7, { dy: 16, y0: 262 }), ch: [
          text({ id: 'ctaLbl', text: 'Shop the edit', x: 122, size: 26, weight: 600, color: 'shade' }),
        ] }),
        rect({ id: 'counter', x: 398, y: NY, pin: 'r', w: 34, h: 36, clip: true, k: fadeIn(0.7), ch: [
          group({ id: 'counterCol', y: 0, k: { y: C.map((c, j) => [c + 0.1, c + 0.5, -36 * (j + 1), 'Power3 Out']) },
            ch: ['01', '02', '03'].map((s, i) => text({ text: s, y: i * 36, size: 26, weight: 600, color: '#FFFFFF', tnum: false })) }),
        ] }),
        text({ id: 'counterOf', text: '/ 03', x: 406, y: NY, ax: 0, size: 26, weight: 500, color: '#FFFFFF99', k: fadeIn(0.7) }),
        roundBtn('prev', 540, NY, 76, 'chevronLeft', { fill: 'shade/30', stroke: '#FFFFFF66', color: '#FFFFFF', k: fadeIn(0.72) }),
        roundBtn('next', 630, NY, 76, 'chevronRight', { fill: '#FFFFFF', color: 'shade', k: k(fadeIn(0.76), press(C[0], { to: 0.9 }), press(C[1], { to: 0.9 })) }),
      ] }),
      cursorLayer([[0, 760, 460], [0.75, 760, 460], [C[0] - 0.1, 636, NY + 8], [C[0] + 0.25, 636, NY + 8], [C[0] + 0.62, 690, NY + 80], [C[1] - 0.1, 636, NY + 8],
        [C[1] + 0.25, 636, NY + 8], [4.2, 720, 440]], C, [], { inAt: 0.7 }),
    ];
  },
});

// 9 ─ Momentum scroller: a flick sends the strip gliding; it decelerates and edge cards fade out
UIK.define({
  id: 'momentum-scroller', formats: ['html'], name: 'Momentum scroller', cat: 'carousel', T: 4.8, cam: 1.15,
  desc: 'The cursor flicks the product strip: it follows the pointer, is let go at speed and glides on, decelerating on an Expo Out curve; a smaller flick back glides it the other way. Cards fade out as they near the clipped edges and fade back in as they come inside, and the scrollbar thumb tracks the scroll.',
  build: () => {
    const P = 280, VW = 1220, HALF = VW / 2, CW = 250, FZ = 140, F0 = 1.0, F1 = 1.24, G0 = 2.95, G1 = 3.15;
    // drag legs are Power2 In (accelerating with the pointer), the glides Expo Out — the release speeds roughly match
    const SK = [[F0, F1, -170, 'Power2 In'], [F1, F1 + 1.75, -900, 'Expo Out'], [G0, G1, -810, 'Power2 In'], [G1, G1 + 1.25, -540, 'Expo Out']];
    const items = [[6, 'Amber serum', '$34'], [8, 'Linen tote', '$48'], [1, 'Trail flask', '$22'], [7, 'Olive planter', '$29'], [3, 'Map print', '$18'], [5, 'Wave throw', '$64'],
      [2, 'Portrait print', '$90'], [0, 'Sunset candle', '$16'], [6, 'Night oil', '$38'], [8, 'Clay vase', '$42'], [1, 'Canvas cap', '$26'], [7, 'Fern kit', '$24']];
    const x0 = (i) => -HALF + 20 + CW / 2 + i * P;
    const op = (X) => clamp01(1 - (Math.abs(X) - (HALF - CW / 2)) / FZ);
    const cardK = (i) => {
      const t = 0.3 + Math.min(i, 5) * 0.06, o0 = op(x0(i));
      return { opacity: [0, [t, t + 0.3, r3(o0), 'Power2 Out'], ...fitK(F0, G1 + 1.25, (tt) => op(x0(i) + evalK(SK, 0, tt)), 0.012, r3)],
               blur: [8, [t, t + 0.3, 0, 'Power2 Out']], y: [20, [t, t + 0.4, 0, 'Power3 Out']] };
    };
    const MAX = items.length * P + 20 - VW, TW = 360, THW = 90, thumb = (sx) => r1(-TW / 2 + (TW - THW) * (-sx / MAX));
    return [
      rect({ id: 'card', w: 1300, h: 600, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'Recently viewed', x: -HALF, y: -236, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -HALF }) }),
        text({ id: 'count', text: '12 items', x: HALF, y: -236, ax: 1, size: 26, color: 'muted', k: enter(0.3) }),
        rect({ id: 'window', y: 24, w: VW, h: 400, clip: true, ch: [
          group({ id: 'strip', k: { x: SK },
            ch: items.map(([v, n, pr], i) => group({ id: 'item' + i, x: x0(i), k: cardK(i), ch: [
              photo({ id: 'photo' + i, v, y: -40, w: CW, h: 300, r: 24 }),
              text({ id: 'name' + i, text: n, x: -CW / 2, y: 146, ax: 0, size: 26, weight: 600, ls: -0.01 }),
              text({ id: 'price' + i, text: pr, x: CW / 2, y: 146, ax: 1, size: 26, color: 'muted' }),
            ] })) }),
        ] }),
        rect({ id: 'barTrack', y: 262, w: TW, h: 6, r: 3, fill: 'skel', k: fadeIn(0.5) }),
        rect({ id: 'barThumb', x: thumb(0), y: 262, pin: 'l', w: THW, h: 6, r: 3, fill: 'ink', k: k(fadeIn(0.5), { x: SK.map(([a, b, v, e]) => [a, b, thumb(v), e]) }) }),
      ] }),
      cursorLayer([[0, 640, 400], [0.62, 640, 400], [F0 - 0.14, 300, 10], [F0, 300, 10], [F1, 130, 10, 'Power2 In'], [F1 + 0.35, 20, 40, 'Power2 Out'],
        [G0 - 0.16, -240, 20], [G0, -240, 20], [G1, -150, 20, 'Power2 In'], [G1 + 0.35, -70, 50, 'Power2 Out'], [4.8, 30, 250]], [], [[F0, F1], [G0, G1]], { inAt: 0.58 }),
    ];
  },
});

// 10 ─ Avatar carousel: portraits scroll along a row; the centre one grows and its name swaps in
UIK.define({
  id: 'avatar-carousel', name: 'Avatar carousel', cat: 'carousel', T: 4.0, cam: 1.3,
  desc: 'A row of round portraits shrinking and fading toward the edges. Clicking a neighbour scrolls the row so it lands in the accent ring at the centre, growing as the old one shrinks away; the second click jumps two places. The name and role under the ring swap and the ring gives a small pulse as each face lands.',
  build: () => {
    const D = 200, AY = -24, C = [1.1, 2.35], A = [2, 3, 5], DUR = 0.62, E = 'Power3 Out';
    const SX = [0, 184, 318, 428, 520], SS = [1, 0.56, 0.44, 0.38, 0.3], SO = [1, 1, 0.72, 0.38, 0];
    const at = (d, arr) => { const a = Math.min(4, Math.abs(d)); return arr === SX ? Math.sign(d) * SX[a] : arr[a]; };
    const people = [['Ana Reyes', 'Product lead', 'skel'], ['Leo Park', 'Engineer', 'dim'], ['Maya Chen', 'Design lead', 'soft'], ['Jonah Diaz', 'Researcher', 'ink/20'],
      ['Sara Holm', 'Engineer', 'skel'], ['Tom Okafor', 'Brand designer', 'dim'], ['Iris Lund', 'Marketing', 'soft'], ['Ben Adler', 'Support', 'ink/20']];
    const avK = (i) => {
      const d0 = i - A[0], t = 0.28 + Math.abs(d0) * 0.06, tr = { x: [], scale: [r3(at(d0, SS) * 0.7), [t, t + 0.45, at(d0, SS), 'Back Out']], opacity: [0, [t, t + 0.25, at(d0, SO), 'Power2 Out']] };
      C.forEach((c, j) => {
        const da = i - A[j], db = i - A[j + 1];
        if (at(da, SX) !== at(db, SX)) tr.x.push([c, c + DUR, at(db, SX), E]);
        if (at(da, SS) !== at(db, SS)) tr.scale.push([c, c + DUR, at(db, SS), E]);
        if (at(da, SO) !== at(db, SO)) tr.opacity.push([c, c + DUR * 0.7, at(db, SO), 'Power2 Out']);
      });
      if (!tr.x.length) delete tr.x;
      return tr;
    };
    return [
      rect({ id: 'card', w: 1080, h: 560, r: 44, fill: 'card', shadow: 1, clip: true, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'Meet the team', x: -490, y: -214, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.2, { dx: -14, x0: -490 }) }),
        text({ id: 'count', text: '8 people', x: 490, y: -214, ax: 1, size: 26, color: 'muted', k: enter(0.28) }),
        circle({ id: 'focusRing', y: AY, d: D + 28, stroke: 'acc', sw: 4,
          k: k(pop(0.36, { from: 0.7 }), ...C.map((c) => ({ scale: [[c + 0.3, c + 0.42, 0.95, 'Power2 Out'], [c + 0.42, c + 0.8, 1, 'Power3 Out']] }))) }),
        ...people.map((p, i) => photo({ id: 'avatar' + i, v: 2, x: at(i - A[0], SX), y: AY, w: D, h: D, r: D / 2, fill: p[2], k: avK(i) })),
        ...A.map((a, j) => group({ id: 'who' + a, k: k(enter(j ? C[j - 1] + 0.2 : 0.46, { dy: 12 }), j < 2 ? exit(C[j]) : null), ch: [
          text({ id: 'name' + a, text: people[a][0], y: 150, size: 40, weight: 600, ls: -0.02 }),
          text({ id: 'role' + a, text: people[a][1], y: 194, size: 26, color: 'muted' }),
        ] })),
      ] }),
      cursorLayer([[0, 560, 380], [0.6, 560, 380], [C[0] - 0.1, SX[1] + 8, AY + 12], [C[0] + 0.25, SX[1] + 8, AY + 12], [C[0] + 0.6, 360, 120],
        [C[1] - 0.1, SX[2] + 8, AY + 10], [C[1] + 0.25, SX[2] + 8, AY + 10], [4.0, 420, 300]], C, [], { inAt: 0.55 }),
    ];
  },
});

// 11 ─ Phone carousel: a finger swipes an app's card carousel; the page pill stretches, a caption flips
UIK.define({
  id: 'phone-carousel', formats: ['html'], name: 'Phone carousel', cat: 'carousel', T: 4.3, cam: PHONE_CAM,
  desc: 'A travel app on a phone: a fingertip swipes the card carousel twice (a drag, then a snap to the next card), the ink page pill stretches along the dots. The finger then taps the Kyoto card, whose caption flips over on its horizontal axis to an accent Added to trip confirmation.',
  build: () => {
    const P = 420, CW = 400, CH = 560, CY = -6, S1 = 0.95, R1 = S1 + 0.3, S2 = 1.95, R2 = S2 + 0.3, DR = 150, TP = 3.0, FL = TP + 0.05, DY = 330;
    const trips = [[1, 'Lisbon', 'Portugal · 4 days'], [5, 'Reykjavík', 'Iceland · 6 days'], [8, 'Kyoto', 'Japan · 5 days'], [3, 'Marrakesh', 'Morocco · 3 days']];
    const DX = [-48, -16, 16, 48], pl = (i) => DX[i] - 18;
    // the fingertip: a translucent disc that only exists while it touches the glass
    const touch = (id, x0, y0, t0, t1, x1, e) => circle({ id, x: x0, y: y0, d: 66, fill: 'ink/14', stroke: 'ink/35', sw: 2,
      k: { x: x1 != null ? [[t0, t1, x1, e]] : [], opacity: [0, [t0 - 0.1, t0, 1, 'Power2 Out'], [t1, t1 + 0.18, 0, 'Power2 Out']],
           scale: [0.6, [t0 - 0.1, t0 + 0.04, 1, 'Power3 Out'], [t1, t1 + 0.18, 1.3, 'Power2 Out']] } });
    const cap = (i) => {
      const [, t, s] = trips[i], plain = [text({ text: t, x: -172, y: -20, ax: 0, size: 32, weight: 600, ls: -0.02 }), text({ text: s, x: -172, y: 20, ax: 0, size: 24, color: 'muted' })];
      if (i !== 2) return group({ id: 'caption' + i, y: 208, ch: plain });
      return group({ id: 'caption2', y: 208, ch: [
        group({ id: 'capFront', k: { sy: [[FL, FL + 0.16, 0, 'Power2 In']], opacity: [[FL + 0.16, 0]] }, ch: plain }),
        group({ id: 'capBack', sy: 0, opacity: 0, k: { sy: [0, [FL + 0.16, FL + 0.4, 1, 'Power3 Out']], opacity: [0, [FL + 0.16, 1]] }, ch: [
          circle({ id: 'addedDot', x: -150, d: 44, fill: 'acc', ch: [icon({ icon: 'check', size: 24, sw: 3, color: '#FFFFFF' })] }),
          text({ text: 'Added to trip', x: -114, y: -16, ax: 0, size: 30, weight: 600, ls: -0.02 }),
          text({ text: 'Mar 12 – 17 · 2 people', x: -114, y: 20, ax: 0, size: 22, color: 'muted' }),
        ] }),
      ] });
    };
    return [
      phone({ fill: 'panel', ch: [
        text({ id: 'title', text: 'Explore', x: -CW / 2, y: -386, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.3, { dx: -14, x0: -CW / 2 }) }),
        text({ id: 'sub', text: 'Trips for spring', x: -CW / 2, y: -338, ax: 0, size: 26, color: 'muted', k: enter(0.36) }),
        group({ id: 'cards', k: { x: [[S1, R1, -DR, 'Power2 In'], [R1, R1 + 0.5, -P, 'Power3 Out'], [S2, R2, -P - DR, 'Power2 In'], [R2, R2 + 0.5, -2 * P, 'Power3 Out']] },
          ch: trips.map(([v], i) => rect({ id: 'card' + i, x: i * P, y: CY, w: CW, h: CH, r: 36, fill: 'card', shadow: 3, clip: true,
            k: k(enter(0.34 + i * 0.07, { dx: 40, x0: i * P, blur: 6 }), i === 2 ? press(TP, { to: 0.97 }) : null), ch: [
              photo({ id: 'photo' + i, v, y: -70, w: CW, h: 420, r: 0 }),
              cap(i),
            ] })) }),
        ...DX.map((x, i) => circle({ id: 'dot' + i, x, y: DY, d: 12, fill: 'dim', k: fadeIn(0.5 + i * 0.03) })),
        rect({ id: 'pagePill', x: pl(0), y: DY, pin: 'l', w: 36, h: 12, r: 6, fill: 'ink',
          k: k(fadeIn(0.5), edges(R1, pl(0), pl(0) + 36, pl(1), pl(1) + 36), edges(R2, pl(1), pl(1) + 36, pl(2), pl(2) + 36)) }),
        rect({ id: 'tabBar', y: 424, w: PW, h: 2, fill: 'line', k: fadeIn(0.5) }),
        ...[['home', 'ink'], ['search', 'muted'], ['bookmark', 'muted'], ['user', 'muted']].map(([ic, c], i) => icon({ id: 'tab' + i, icon: ic, x: -165 + i * 110, y: 448, size: 30, sw: 2.4, color: c, k: fadeIn(0.52 + i * 0.03) })),
        touch('touch1', 150, -40, S1, R1, 150 - DR, 'Power2 In'),
        touch('touch2', 150, -40, S2, R2, 150 - DR, 'Power2 In'),
        touch('tap', 40, 206, TP - 0.02, TP + 0.12),
        statusBar(0.26),
        homeBar(0.3),
      ] }),
    ];
  },
});

// 12 ─ Logo marquee: generic logo pills scroll forever inside a clip, fading at both edges
UIK.define({
  id: 'logo-marquee', name: 'Logo marquee', cat: 'carousel', T: 5.5, cam: 1.3,
  desc: 'An endless marquee of generic logo pills (icon + wordmark) scrolls left at a constant speed inside a clipped window. The strip is laid out twice back to back and travels exactly one strip length over the clip, so it loops without a seam; pills fade out at the left edge and fade in at the right.',
  build: () => {
    const T = 5.5, VW = 1000, HALF = VW / 2, FZ = 140, GAP = 24, H = 76;
    // text widths measured in Helvetica 30/600 (ls −0.02)
    const LOGOS = [['zap', 'Voltaic', 91.9], ['globe', 'Meridian', 120.1], ['layers', 'Stackwise', 141.8], ['sparkle', 'Lumen', 94.8], ['shield', 'Bastion', 104.7]];
    let acc = 0;
    const lay = LOGOS.map(([ic, name, tw]) => { const w = Math.round(26 + 30 + 12 + tw + 30), c = acc + w / 2; acc += w + GAP; return { ic, name, w, c }; });
    const S = acc;   // the strip period (≥ the window, so two copies always cover it)
    const X = (t) => -HALF - S * t / T;   // strip x: Linear, one period over the clip
    const op = (c) => [r3(clamp01((HALF - Math.abs(c + X(0))) / FZ)), ...fitK(0, T, (t) => clamp01((HALF - Math.abs(c + X(t))) / FZ), 0.004, r3)];
    const pill = (L, copy) => {
      const c = L.c + copy * S;
      return rect({ id: `logo${copy}_${L.name}`, x: c, w: L.w, h: H, r: H / 2, fill: 'soft', k: { opacity: op(c) }, ch: [
        icon({ icon: L.ic, x: -L.w / 2 + 26 + 15, size: 30, sw: 2.4 }),
        text({ text: L.name, x: -L.w / 2 + 26 + 30 + 12, ax: 0, size: 30, weight: 600, ls: -0.02 }),
      ] });
    };
    return [
      rect({ id: 'card', w: 1100, h: 340, r: 44, fill: 'card', shadow: 1, k: popIn(0.1), ch: [
        text({ id: 'title', text: 'Trusted by 4,000+ teams', y: -80, size: 30, weight: 500, color: 'muted', k: enter(0.24, { dy: 10, y0: -80 }) }),
        rect({ id: 'window', y: 44, w: VW, h: 100, clip: true, k: fadeIn(0.3, 0.4), ch: [
          group({ id: 'strip', x: -HALF, k: { x: [[0, T, r1(X(T)), 'Linear']] }, ch: [0, 1].flatMap((copy) => lay.map((L) => pill(L, copy))) }),
        ] }),
      ] }),
    ];
  },
});

// 13 ─ Dual marquee: two rows of photos drift in opposite directions while the camera pushes in
UIK.define({
  id: 'dual-marquee', name: 'Dual marquee', cat: 'carousel', T: 5.0,
  cam: { zoom: 0.96, k: { zoom: [[0, 5.0, 1.08, 'Sine Smooth']] } },
  desc: 'Two rows of photo tiles drift in opposite directions at different speeds — the upper, wider row faster to the left, the square row slower to the right — inside a rounded panel, with a View all work button at the centre, while the camera slowly pushes in.',
  build: () => {
    const T = 5.0, PW2 = 1560, PH2 = 860;
    const rows = [
      { y: -206, w: 400, h: 300, gap: 24, x0: -980, dx: -600, v: [3, 5, 1, 8, 7, 6, 2, 3] },
      { y: 206, w: 300, h: 300, gap: 24, x0: -1100, dx: 340, v: [7, 0, 6, 2, 1, 5, 8, 3] },
    ];
    const row = (R, ri) => group({ id: 'row' + ri, y: R.y, k: { x: [[0, T, R.dx, 'Linear']] }, ch: R.v.map((v, i) => {
      const x = R.x0 + i * (R.w + R.gap), t = 0.22 + Math.abs(x + R.dx * 0.1) / 3200;
      return photo({ id: `tile${ri}_${i}`, v, x, w: R.w, h: R.h, r: 24, k: { opacity: [0, [t, t + 0.4, 1, 'Power2 Out']], scale: [0.94, [t, t + 0.5, 1, 'Power3 Out']] } });
    }) });
    return [
      rect({ id: 'panel', w: PW2, h: PH2, r: 48, fill: 'card', shadow: 1, clip: true, k: popIn(0.1, 0.8), ch: [
        ...rows.map(row),
        rect({ id: 'cta', w: 300, h: 84, r: 42, fill: 'ink', shadow: 2, k: pop(0.8, { from: 0.6 }), ch: [
          text({ id: 'ctaLbl', text: 'View all work', x: -22, size: 28, weight: 600, color: 'inv' }),
          icon({ id: 'ctaArrow', icon: 'arrow', x: 104, size: 28, sw: 2.6, color: 'inv', k: { x: [80, [1.0, 1.4, 104, 'Power3 Out']] } }),
        ] }),
      ] }),
    ];
  },
});

})();
