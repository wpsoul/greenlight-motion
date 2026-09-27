/* UI Motion Kit — play elements (Learn, play & travel). */
(function () {
const { rect, circle, ellipse, text, path, icon, group, photo, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
// the kit's opening beat: the main shape pops in from empty
const popIn = (t = 0.1, from = 0.68) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (tracks, rules, fields — things that should not scale or blur in)
const fadeIn = (t, dur = 0.3) => enter(t, { blur: 0, s: 1, dur });
// a closed circle for Trim Paths, starting at 12 o'clock and running clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// deterministic 0…1 noise — frames stay a pure function of t
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const r1 = (v) => Math.round(v * 10) / 10;
// an in-place reaction: a quick scale-up that settles (no opacity change)
const bump = (t, to = 1.12) => ({ scale: [[t, t + 0.1, to, 'Power2 Out'], [t + 0.1, t + 0.45, 1, 'Power3 Out']] });
// time fraction u (0…1) at which an easing reaches progress p
const invEase = (name, p) => {
  const f = UIK.ease(name); let a = 0, b = 1;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < p) a = m; else b = m; }
  return (a + b) / 2;
};
// the moment an eased move a → b over [t0, t1] passes v (hover hand-offs that follow the cursor)
const cross = (t0, t1, a, b, v, e = 'Power2 Smooth') => +(t0 + (t1 - t0) * invEase(e, (v - a) / (b - a))).toFixed(3);
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
// slot roll: a clipped window whose column of values rolls UP one slot at each time in `ts`
// (ax 0 = values left-aligned to the window's left edge)
const roll = ({ id, x = 0, y = 0, w, h, vals, ts, dur = 0.45, e = 'Power3 Out', size, weight = 600, color = 'ink', ax = 0.5, k: kk }) =>
  rect({ id, x, y, w, h, clip: true, k: kk, ch: [group({ id: id + 'Col', k: { y: ts.map((t, i) => [t, t + dur, -h * (i + 1), e]) },
    ch: vals.map((s, i) => text({ text: s, x: ax === 0 ? -w / 2 : ax === 1 ? w / 2 : 0, ax, y: i * h, size, weight, color, tnum: false })) })] });
// cubic Bézier helpers: P = [p0, c1, c2, p3]
const bz = (P, u) => { const v = 1 - u; return [0, 1].map((j) => v * v * v * P[0][j] + 3 * v * v * u * P[1][j] + 3 * v * u * u * P[2][j] + u * u * u * P[3][j]); };
const bzD = (P) => `M${P[0].join(' ')} C${P[1].join(' ')} ${P[2].join(' ')} ${P[3].join(' ')}`;
// follow a cubic from t0 to t1 on one easing: n + 1 checkpoints at equal arc length (p, tangent angle, trim
// fraction f), timed where the easing reaches them — a rider's x/y/rot, a trim and a cursor keyed on these
// Linear legs stay locked together
const follow = (P, t0, t1, n = 12, ez = 'Power2 Smooth') => {
  const N = 240, pts = Array.from({ length: N + 1 }, (_, i) => bz(P, i / N)), cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const out = [];
  for (let j = 0; j <= n; j++) {
    let i = cum.findIndex((c) => c >= cum[N] * j / n - 1e-9); if (i < 0) i = N;
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
    out.push({ p: pts[i].map(r1), f: j / n, ang: r1(Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI), t: +(t0 + (t1 - t0) * invEase(ez, j / n)).toFixed(3) });
  }
  return out;
};
const followSegs = (F, fn) => F.slice(1).map((c, j) => [F[j].t, c.t, fn(c), 'Linear']);
// Lucide glyphs K.ICONS lacks (24-grid stroke paths for icon({ paths }))
const G = {
  plane: ['M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z'],
  coffee: ['M10 2v2', 'M14 2v2', 'M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1', 'M6 2v2'],
  gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'],
  lockOpen: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z', 'M7 11V7a5 5 0 0 1 9.9-1'],
  sunrise: ['M12 2v8', 'm4.93 10.93 1.41 1.41', 'M2 18h2', 'M20 18h2', 'm19.07 10.93-1.41 1.41', 'M22 22H2', 'm8 6 4-4 4 4', 'M16 18a4 4 0 0 0-8 0'],
  grip: ['M4 9h16', 'M4 15h16'],
  rewind: ['m11 19-9-7 9-7v14z', 'm22 19-9-7 9-7v14z'],
  forward: ['m13 19 9-7-9-7v14z', 'm2 19 9-7-9-7v14z'],
  flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'],
  bulb: ['M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5', 'M9 18h6', 'M10 22h4'],
};

// 1 ─ Seat picker: a cinema seat map; the cursor picks two free seats, the total rolls, Book wakes up
UIK.define({
  id: 'seat-picker', name: 'Seat picker', cat: 'play', T: 3.7, cam: 1.1,
  desc: 'A cinema seat map ripples in under a screen line that draws out from its centre; taken seats are solid grey. The cursor picks two free seats: each pops to the accent with a check, the seat list and the total roll on every pick, and Book 2 seats wakes from grey to ink.',
  build: () => {
    const SX = (i) => (i - 3.5) * 76 + (i >= 4 ? 18 : -18), SY = (r) => -104 + r * 68;
    const TAKEN = new Set(['0-2', '0-3', '0-6', '1-0', '1-4', '1-5', '1-6', '2-1', '2-2', '2-7', '3-3', '3-4', '3-5', '4-0', '4-6', '4-7']);
    const PR = 2, PI = [4, 5], C = [1.3, 1.9], RAD = '16px 16px 8px 8px', BY = 300, ROWS = 'ABCDE';
    const seats = [];
    for (let r = 0; r < 5; r++) for (let i = 0; i < 8; i++) {
      const taken = TAKEN.has(r + '-' + i), pick = r === PR ? PI.indexOf(i) : -1, t = 0.36 + r * 0.05 + Math.abs(i - 3.5) * 0.018;
      seats.push(rect({ id: 'seat' + ROWS[r] + (i + 1), x: SX(i), y: SY(r), w: 58, h: 50, radii: RAD, fill: taken ? 'dim' : 'card', stroke: taken ? null : 'ink/30', sw: taken ? 0 : 3,
        k: k(enter(t, { blur: 0, s: 0.6 }), pick >= 0 ? press(C[pick], { to: 0.88 }) : null) }));
    }
    const legend = [['Free', 190, 'card', 'ink/30'], ['Taken', 292, 'dim'], ['Yours', 408, 'acc']];
    return [
      rect({ id: 'card', w: 1120, h: 780, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Choose seats', x: -500, y: -318, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -500 }) }),
        text({ id: 'sub', text: '2 tickets · Hall 3 · Today 19:40', x: -500, y: -276, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        ...legend.map(([s, x, fill, stroke], j) => group({ id: 'legend' + j, y: -306, k: enter(0.32 + j * 0.05), ch: [
          rect({ x, w: 24, h: 22, radii: '8px 8px 4px 4px', fill, stroke, sw: stroke ? 2 : 0 }),
          text({ text: s, x: x + 22, ax: 0, size: 22, color: 'muted' }),
        ] })),
        path({ id: 'screen', d: 'M-330 -196 Q0 -238 330 -196', stroke: 'ink', sw: 6, trimmed: true,
          k: { trimS: [50, [0.3, 0.85, 0, 'Power3 Out']], trimE: [50, [0.3, 0.85, 100, 'Power3 Out']] } }),
        text({ id: 'screenLbl', text: 'Screen', y: -168, size: 20, weight: 600, ls: 0.2, upper: true, color: 'muted', k: enter(0.45) }),
        ...ROWS.split('').map((L, r) => text({ id: 'row' + L, text: L, x: -356, y: SY(r), size: 22, weight: 500, color: 'muted', k: enter(0.36 + r * 0.05) })),
        ...seats,
        ...PI.map((i, j) => rect({ id: 'mine' + j, x: SX(i), y: SY(PR), w: 58, h: 50, radii: RAD, fill: 'acc', k: pop(C[j] + 0.02, { from: 0.5, dur: 0.4 }),
          ch: [icon({ icon: 'check', y: 1, size: 26, sw: 3.2, color: '#FFFFFF' })] })),
        rect({ id: 'rule', y: 222, w: 1040, h: 2, fill: 'line', k: fadeIn(0.5) }),
        text({ id: 'totalLbl', text: 'Total', x: -500, y: BY - 28, ax: 0, size: 24, color: 'muted', k: enter(0.52) }),
        roll({ id: 'total', x: -390, y: BY + 16, w: 220, h: 58, ax: 0, size: 44, vals: ['$0.00', '$14.00', '$28.00'], ts: [C[0] + 0.05, C[1] + 0.05], k: enter(0.56) }),
        text({ id: 'seatsLbl', text: 'Seats', x: -210, y: BY - 28, ax: 0, size: 24, color: 'muted', k: enter(0.56) }),
        roll({ id: 'seatList', x: -100, y: BY + 16, w: 220, h: 50, ax: 0, size: 34, vals: ['—', 'C5', 'C5 · C6'], ts: [C[0] + 0.05, C[1] + 0.05], k: enter(0.6) }),
        rect({ id: 'book', x: 330, y: BY, w: 340, h: 96, r: 48, fill: 'dim',
          k: k(enter(0.6, { blur: 0 }), { fill: [[C[1] + 0.1, C[1] + 0.4, 'ink', 'Power2 Out']], scale: [[2.55, 2.8, 1.04, 'Power3 Out']] }), ch: [
            text({ id: 'bookIdle', text: 'Select 2 seats', size: 30, weight: 600, color: 'card', k: exit(C[1] + 0.1) }),
            text({ id: 'bookLbl', text: 'Book 2 seats', size: 30, weight: 600, color: 'inv', k: enter(C[1] + 0.12) }),
          ] }),
      ] }),
      cursorLayer([[0, 560, 400], [0.8, 560, 400], [C[0] - 0.1, SX(PI[0]) + 10, SY(PR) + 12], [C[0] + 0.15, SX(PI[0]) + 10, SY(PR) + 12],
        [C[1] - 0.1, SX(PI[1]) + 10, SY(PR) + 12], [C[1] + 0.2, SX(PI[1]) + 10, SY(PR) + 12], [2.6, 356, BY + 14], [3.7, 368, BY + 22]], C, [], { inAt: 0.75 }),
    ];
  },
});

// 2 ─ Boarding pass: the plane flies the dashed arc AMS → LIS, the fields fill, the stub tears off
UIK.define({
  id: 'boarding-pass', name: 'Boarding pass', cat: 'play', T: 4.4,
  cam: { zoom: 1.34, k: { zoom: [[2.95, 3.85, 1.2, 'Power2 Smooth']] } },
  desc: 'A boarding pass pops in. An accent plane flies the dashed arc from AMS to LIS, turning along the curve while the flown part turns solid behind it; gate, seat and boarding time fill in one after another, then the stub peels off along the perforation, rotating about its bottom corner, and drifts away while the pass slides the other way.',
  build: () => {
    const TEAR = 2.85, FL0 = 0.72, FL1 = 1.85, FT = [1.98, 2.1, 2.22];
    const P = [[-118, -34], [-40, -104], [40, -104], [118, -34]];
    const F = follow(P, FL0, FL1, 14);
    const RAD_M = '36px 0 0 36px', RAD_S = '0 36px 36px 0';
    const fields = [['Gate', 'D7', -330, 64], ['Seat', '14A', -150, 82], ['Boards', '06:35', 30, 112]];
    const bars = []; let bx = -104, bi = 0;
    while (bx < 96) { const w = [4, 6, 10][Math.floor(rnd(bi + 3) * 3)]; bars.push(rect({ x: r1(bx + w / 2), w, h: 116, fill: 'ink' })); bx += w + 6; bi++; }
    const perf = (x) => path({ x, d: 'M0 -186 V186', stroke: 'dim', sw: 6, dash: [0.5, 16] });
    // real bites at the tear line (transparent): mid-edge on the whole ticket, corner quarters on each half
    const NB = (at) => [{ at, r: 28 }];
    return [
      group({ id: 'ticket', k: popIn(0.1, 0.7), ch: [
        rect({ id: 'base', w: 1080, h: 440, r: 36, fill: 'card', shadow: 1, notches: NB(240), k: { opacity: [[TEAR, 0]] } }),
        group({ id: 'mainG', k: { x: [[TEAR + 0.14, TEAR + 0.9, -36, 'Power3 Out']] }, ch: [
          rect({ id: 'mainShadow', x: -150, w: 780, h: 440, radii: RAD_M, fill: 'card', shadow: 1, notches: NB(390), k: { opacity: [0, [TEAR, 1]] } }),
          rect({ id: 'main', x: -150, w: 780, h: 440, radii: RAD_M, fill: 'card', clip: true, notches: NB(390), ch: [
            perf(390),
            text({ id: 'kind', text: 'Boarding pass', x: -330, y: -160, ax: 0, size: 24, weight: 600, k: enter(0.24) }),
            text({ id: 'date', text: 'Mon 14 Oct · 07:15', x: 330, y: -160, ax: 1, size: 22, color: 'muted', k: enter(0.3) }),
            text({ id: 'from', text: 'AMS', x: -262, y: -40, size: 100, weight: 600, ls: -0.03, tnum: false, k: enter(0.3, { dx: -16, x0: -262 }) }),
            text({ id: 'fromCity', text: 'Amsterdam', x: -262, y: 30, size: 24, color: 'muted', k: enter(0.36) }),
            text({ id: 'to', text: 'LIS', x: 262, y: -40, size: 100, weight: 600, ls: -0.03, tnum: false, k: k(enter(0.36, { dx: 16, x0: 262 }), bump(FL1 - 0.04, 1.08)) }),
            text({ id: 'toCity', text: 'Lisbon', x: 262, y: 30, size: 24, color: 'muted', k: enter(0.42) }),
            path({ id: 'route', d: bzD(P), stroke: 'dim', sw: 5, dash: [0.1, 13], k: fadeIn(0.45) }),
            path({ id: 'flown', d: bzD(P), stroke: 'ink', sw: 4, trimmed: true, k: { trimE: [0, ...followSegs(F, (c) => r1(c.f * 100))] } }),
            circle({ id: 'dotA', x: P[0][0], y: P[0][1], d: 12, fill: 'ink', k: pop(0.5) }),
            circle({ id: 'dotB', x: P[3][0], y: P[3][1], d: 12, fill: 'ink', k: pop(FL1 - 0.06) }),
            icon({ id: 'plane', paths: G.plane, x: F[0].p[0], y: F[0].p[1], size: 46, sw: 1.6, color: 'acc', filled: true, fill: 'acc', rot: F[0].ang + 45,
              k: k(pop(0.52, { from: 0.4 }), { x: followSegs(F, (c) => c.p[0]), y: followSegs(F, (c) => c.p[1]), rot: followSegs(F, (c) => r1(c.ang + 45)) }) }),
            rect({ id: 'divider', y: 76, w: 700, h: 2, fill: 'line', k: fadeIn(0.48) }),
            ...fields.flatMap(([lbl, val, x, bw], i) => [
              text({ id: 'lbl' + lbl, text: lbl, x, y: 116, ax: 0, size: 22, color: 'muted', k: enter(0.5 + i * 0.05) }),
              rect({ id: 'skel' + lbl, x, y: 160, pin: 'l', w: bw, h: 30, r: 8, fill: 'skel', k: k(fadeIn(0.54 + i * 0.05), exit(FT[i], { blur: 0 })) }),
              text({ id: 'val' + lbl, text: val, x, y: 160, ax: 0, size: 40, weight: 600, ls: -0.02, tnum: false, k: enter(FT[i], { dy: 14, y0: 160 }) }),
            ]),
          ] }),
        ] }),
        group({ id: 'stubG', x: 390, w: 300, h: 440, origin: [-0.5, 0.5], k: {
            rot: [[TEAR, TEAR + 0.26, 4, 'Power2 In'], [TEAR + 0.26, TEAR + 1.0, 10, 'Power3 Out']],
            x: [[TEAR + 0.1, TEAR + 1.0, 530, 'Power3 Out']], y: [[TEAR + 0.1, TEAR + 1.0, 44, 'Power3 Out']] }, ch: [
          rect({ id: 'stubLift', w: 300, h: 440, radii: RAD_S, fill: 'card', shadow: 2, notches: NB(-150), k: { opacity: [0, [TEAR, TEAR + 0.3, 1, 'Power2 Out']] } }),
          rect({ id: 'stub', w: 300, h: 440, radii: RAD_S, fill: 'card', clip: true, notches: NB(-150), ch: [
            perf(-150),
            text({ id: 'stubLbl', text: 'Seat', y: -150, size: 22, color: 'muted', k: enter(0.4) }),
            rect({ id: 'stubSkel', y: -98, w: 110, h: 44, r: 10, fill: 'skel', k: k(fadeIn(0.46), exit(FT[1] + 0.06, { blur: 0 })) }),
            text({ id: 'stubSeat', text: '14A', y: -98, size: 68, weight: 600, ls: -0.03, tnum: false, k: enter(FT[1] + 0.06, { dy: 14, y0: -98 }) }),
            group({ id: 'barcode', y: 56, k: fadeIn(0.5), ch: bars }),
            text({ id: 'zone', text: 'Zone 2', y: 164, size: 22, color: 'muted', k: enter(0.56) }),
          ] }),
        ] }),
      ] }),
    ];
  },
});

// 3 ─ Loyalty stamps: eight stamps press in one by one, the last (accent) unlocks the reward chip
UIK.define({
  id: 'loyalty-stamps', name: 'Loyalty stamps', cat: 'play', T: 3.5, cam: 1.3,
  desc: 'A coffee loyalty card with eight dashed stamp slots. Stamps press in one after another — each drops from 145 % onto its slot, squashes a little and settles at a slight angle — while the count rolls up. The eighth lands in the accent, the lock hint blurs away and a Free coffee chip pops.',
  build: () => {
    const XS = [-270, -90, 90, 270], YS = [-52, 116], ST = [...stagger(7, 0.66, 0.18), 2.16], U = 2.5, H = 66;
    const ROT = [-8, 5, -3, 7, -6, 3, -9, 4];
    const pos = (i) => [XS[i % 4], YS[Math.floor(i / 4)]];
    return [
      rect({ id: 'card', w: 1000, h: 620, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'tile', x: -400, y: -222, w: 84, h: 84, r: 24, fill: 'soft', k: enter(0.2, { s: 0.7 }), ch: [icon({ paths: G.coffee, size: 42, sw: 2.4 })] }),
        text({ id: 'title', text: 'Coffee card', x: -338, y: -240, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.24, { dx: -14, x0: -338 }) }),
        text({ id: 'sub', text: 'Every 8th coffee is on us', x: -338, y: -199, ax: 0, size: 24, color: 'muted', k: enter(0.32) }),
        // a COUNTER placeholder (Roll) keyed by 'ph:1': one step per stamp
        text({ id: 'count', text: `{{{COUNTER:0-${ST.length}; style=roll; kf=1}}}`, x: 372, y: -222, size: 56, weight: 600,
          k: { 'ph:1': [0, ...ST.map((t, i) => [t + 0.17, t + 0.33, +((100 * (i + 1)) / ST.length).toFixed(3), 'Power3 Out'])] } }),
        text({ id: 'of8', text: '/8', x: 392, y: -216, ax: 0, size: 32, weight: 500, color: 'muted', tnum: false, k: enter(0.34) }),
        ...ST.map((_, i) => circle({ id: 'slot' + i, x: pos(i)[0], y: pos(i)[1], d: 128, stroke: 'dim', sw: 3, dash: true, k: enter(0.3 + i * 0.035, { blur: 0, s: 0.7 }),
          ch: [text({ text: String(i + 1), size: 30, weight: 500, color: 'dim', tnum: false })] })),
        ...ST.map((t, i) => {
          const last = i === 7, big = last ? 1.6 : 1.45;
          return group({ id: 'stamp' + i, x: pos(i)[0], y: pos(i)[1], rot: ROT[i],
            k: { scale: [big, [t, t + 0.17, 0.92, 'Power2 In'], [t + 0.17, t + 0.5, 1, 'Power3 Out']], opacity: [0, [t, t + 0.08, 1, 'Linear']] }, ch: [
              circle({ d: 128, fill: last ? 'acc' : 'ink' }),
              circle({ d: 106, stroke: last ? '#FFFFFF' : 'inv', sw: 2.5, dash: true, opacity: 0.4 }),
              icon({ paths: G.coffee, size: 54, sw: 2.8, color: last ? '#FFFFFF' : 'inv' }),
            ] });
        }),
        group({ id: 'locked', y: 248, k: k(enter(0.5), exit(U)), ch: [
          icon({ icon: 'lock', x: -96, size: 26, sw: 2.4, color: 'muted' }),
          text({ text: 'Reward locked', x: -72, ax: 0, size: 26, color: 'muted' }),
        ] }),
        rect({ id: 'reward', y: 248, w: 290, h: 72, r: 36, fill: 'ink', k: pop(U + 0.04, { from: 0.5 }), ch: [
          icon({ paths: G.gift, x: -94, size: 30, sw: 2.4, color: 'acc' }),
          text({ text: 'Free coffee', x: -66, ax: 0, size: 28, weight: 600, color: 'inv' }),
        ] }),
      ] }),
    ];
  },
});

// 4 ─ Gift card: the card slides up out of its sleeve, the amount counts, the code is wiped open
UIK.define({
  id: 'gift-card', name: 'Gift card', cat: 'play', T: 4.1,
  cam: { zoom: 1.42, y: 170, k: { zoom: [[0.5, 1.35, 1.3, 'Power2 Smooth']], y: [[0.5, 1.35, 20, 'Power2 Smooth']] } },
  desc: 'A gift sleeve pops in; the ink gift card slides up out of it (a clip at the sleeve mouth) with a slight tilt while the camera rises with it. The amount counts to $50, then the cursor clicks Show code: the grey cover wipes away to the right behind a thin accent edge and reveals the code.',
  build: () => {
    const YM = 76, UP = 0.72, UP1 = 1.5, CY = -212, CNT = [1.3, 2.05], CL = 2.4, W0 = CL + 0.06, W1 = CL + 0.62, FX = -44, FY = 122, FW = 412;
    return [
      group({ id: 'sleeveG', y: YM + 160, k: popIn(0.1, 0.7), ch: [
      rect({ id: 'sleeveBack', y: -118, w: 716, h: 110, r: 26, fill: 'dim' }),
      rect({ id: 'mouth', y: -160, pin: 'b', chAt: 'pin', w: 820, h: 0, clip: true, k: { h: [[UP, UP1, 460, 'Power3 Out']] }, ch: [
        group({ id: 'gift', y: 250, k: { y: [[UP, UP1, CY, 'Power3 Out']], rot: [[UP, UP + 0.35, -3, 'Power2 Out'], [UP + 0.35, UP1 + 0.1, 0, 'Power3 Out']] }, ch: [
          rect({ id: 'giftCard', w: 600, h: 380, r: 32, fill: 'ink', shadow: 2, ch: [
            text({ id: 'kind', text: 'Gift card', x: -250, y: -140, ax: 0, size: 26, weight: 600, color: 'inv/70' }),
            icon({ id: 'giftIc', paths: G.gift, x: 250, y: -140, size: 34, sw: 2.4, color: 'inv/70' }),
            text({ id: 'amount', x: -254, y: -48, ax: 0, size: 120, weight: 600, ls: -0.03, color: 'inv', num: { pre: '$' }, k: { value: [[CNT[0], CNT[1], 50, 'Power3 Out']] } }),
            text({ id: 'credit', text: 'Store credit · never expires', x: -250, y: 30, ax: 0, size: 24, color: 'inv/60' }),
            rect({ id: 'codeField', x: FX, y: FY, w: FW, h: 76, r: 18, fill: 'inv/12', ch: [
              text({ id: 'code', text: 'GIFT-4K9P-27XQ', size: 30, weight: 600, ls: 0.06, color: 'inv', tnum: false }),
            ] }),
            rect({ id: 'cover', x: FX + FW / 2, y: FY, pin: 'r', origin: [0, 0], w: FW, h: 76, r: 18, fill: 'dim', k: k({ w: [[W0, W1, 0, 'Power3 Out']] }, press(CL)), ch: [
              group({ id: 'coverLbl', k: exit(CL + 0.02), ch: [
                icon({ icon: 'eye', x: -78, size: 28, sw: 2.4, color: 'ink' }),
                text({ text: 'Show code', x: -54, ax: 0, size: 26, weight: 600 }),
              ] }),
            ] }),
            rect({ id: 'wipeEdge', x: FX - FW / 2, y: FY, w: 4, h: 60, r: 2, fill: 'acc',
              k: { x: [[W0, W1, FX + FW / 2, 'Power3 Out']], opacity: [0, [W0, W0 + 0.06, 1, 'Linear'], [W1 - 0.14, W1 + 0.06, 0, 'Power2 Out']] } }),
            circle({ id: 'copyBtn', x: 234, y: FY, d: 76, fill: 'inv/12', ch: [icon({ icon: 'copy', size: 30, sw: 2.4, color: 'inv' })] }),
          ] }),
        ] }),
      ] }),
      rect({ id: 'sleeve', w: 760, h: 320, r: 32, fill: 'card', shadow: 1, ch: [
        text({ id: 'forWho', text: 'For Mia', x: -318, y: -30, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.24, { dx: -14, x0: -318 }) }),
        text({ id: 'note', text: 'Happy birthday! Love, Sam', x: -318, y: 22, ax: 0, size: 26, color: 'muted', k: enter(0.32) }),
        circle({ id: 'seal', x: 262, y: -4, d: 104, fill: 'ink', k: enter(0.3, { s: 0.7 }), ch: [icon({ paths: G.gift, size: 46, sw: 2.6, color: 'inv' })] }),
      ] }),
      ] }),
      cursorLayer([[0, 540, 380], [1.65, 540, 380], [CL - 0.1, -26, 0], [CL + 0.25, -26, 0], [3.3, 360, 300]], [CL], [], { inAt: 1.6 }),
    ];
  },
});

// 5 ─ Recipe timer: Start → the ring counts down fast, the step completes (accent check), the next step slides in
UIK.define({
  id: 'recipe-timer', name: 'Recipe timer', cat: 'play', T: 4.3, cam: 1.3,
  desc: 'A recipe step card. The cursor clicks Start timer: the ring drains (Trim Paths) while 0:45 counts down, an accent disc with a check pops over it and the button reads Done. Then the whole step slides out left as the next one slides in, the step counter rolls and the page dot glides (stretching) to step 3.',
  build: () => {
    const W = 1060, C = 1.05, R0 = 1.12, R1 = 2.52, D = 2.56, S = 3.1, RX = 300, RY = 20, RR = 116;
    const DX = [366, 396, 426, 456], DY = -206;
    const btnLbl = (id, ic, s, kk) => group({ id, k: kk, ch: [
      icon({ icon: ic, x: -86, size: 24, sw: 2.4, color: 'inv', filled: ic !== 'check', fill: 'inv' }),
      text({ text: s, x: -62, ax: 0, size: 28, weight: 600, color: 'inv' }),
    ] });
    const step = (i, o) => group({ id: 'step' + i, x: i * W, ch: [
      text({ id: 'stepTitle' + i, text: o.title, x: -470, y: -78, ax: 0, size: 50, weight: 600, ls: -0.02, k: i ? null : enter(0.3, { dx: -14, x0: -470 }) }),
      text({ id: 'stepDesc' + i, text: o.desc, x: -470, y: 4, ax: 0, size: 28, color: 'muted', wrap: 500, lh: 1.35, k: i ? null : enter(0.38) }),
      rect({ id: 'btn' + i, x: -340, y: 124, w: 260, h: 84, r: 42, fill: 'ink', k: i ? null : k(enter(0.44, { blur: 0 }), press(C)), ch: o.btn }),
      path({ id: 'track' + i, x: RX, y: RY, d: ring(RR), stroke: 'skel', sw: 14, k: i ? null : fadeIn(0.4) }),
      ...o.ring,
    ] });
    return [
      rect({ id: 'card', w: W, h: 540, r: 48, fill: 'card', shadow: 1, clip: true, k: popIn(0.1, 0.7), ch: [
        text({ id: 'dish', text: 'Tomato pasta', x: -470, y: DY, ax: 0, size: 32, weight: 600, ls: -0.01, k: enter(0.2) }),
        roll({ id: 'stepNo', x: -350, y: DY + 40, w: 240, h: 34, ax: 0, size: 24, weight: 500, color: 'muted', vals: ['Step 2 of 4', 'Step 3 of 4'], ts: [S + 0.06], k: enter(0.26) }),
        ...DX.map((x, i) => circle({ id: 'dot' + i, x, y: DY, d: 14, fill: i < 2 ? 'ink' : 'dim', k: k(enter(0.3 + i * 0.04, { blur: 0, s: 0.5 }), i === 2 ? { fill: [[S + 0.3, S + 0.5, 'ink', 'Power2 Out']] } : null) })),
        rect({ id: 'dotNow', x: DX[1] - 7, y: DY, pin: 'l', w: 14, h: 14, r: 7, fill: 'ink', k: edges(S + 0.04, DX[1] - 7, DX[1] + 7, DX[2] - 7, DX[2] + 7) }),
        rect({ id: 'rule', y: -130, w: 960, h: 2, fill: 'line', k: fadeIn(0.3) }),
        group({ id: 'strip', y: 16, k: { x: [[S, S + 0.7, -W, 'Power4 Out']] }, ch: [
          step(0, {
            title: 'Simmer the sauce', desc: 'Stir now and then until it turns thick and glossy.',
            btn: [btnLbl('startLbl', 'play', 'Start timer', exit(C + 0.04)), btnLbl('pauseLbl', 'pause', 'Pause', k(enter(C + 0.04, { d: 0.04 }), exit(D))), btnLbl('doneLbl', 'check', 'Done', enter(D + 0.02))],
            ring: [
              path({ id: 'arc0', x: RX, y: RY, d: ring(RR), stroke: 'ink', sw: 14, trimmed: true, k: k(fadeIn(0.42), { trimE: [100, [R0, R1, 0, 'Linear']] }) }),
              text({ id: 'time0', x: RX, y: RY - 8, size: 60, weight: 600, ls: -0.02, num: { pre: '0:', pad: 2 }, value: 45, k: k(enter(0.46), { value: [[R0, R1, 0, 'Linear']] }, exit(D, { s: 0.8 })) }),
              text({ id: 'timeLbl0', text: 'remaining', x: RX, y: RY + 46, size: 22, color: 'muted', k: k(enter(0.5), exit(D)) }),
              circle({ id: 'doneDisc', x: RX, y: RY, d: 246, fill: 'acc', k: pop(D, { from: 0.6 }), ch: [
                path({ id: 'doneTick', d: 'M-40 2 L-12 30 L42 -26', stroke: '#FFFFFF', sw: 14, trimmed: true, k: { trimE: [0, [D + 0.1, D + 0.4, 100, 'Power3 Out']] } }),
              ] }),
            ],
          }),
          step(1, {
            title: 'Add the pasta', desc: 'Toss it through the sauce over low heat for a minute.',
            btn: [btnLbl('startLbl1', 'play', 'Start timer')],
            ring: [
              path({ id: 'arc1', x: RX, y: RY, d: ring(RR), stroke: 'ink', sw: 14 }),
              text({ id: 'time1', text: '1:00', x: RX, y: RY - 8, size: 60, weight: 600, ls: -0.02, tnum: false }),
              text({ id: 'timeLbl1', text: 'ready', x: RX, y: RY + 46, size: 22, color: 'muted' }),
            ],
          }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 360], [0.5, 560, 360], [C - 0.1, -330, 152], [C + 0.25, -330, 152], [1.9, 420, 330]], [C], [], { inAt: 0.45 }),
    ];
  },
});

// 6 ─ Quiz answer: the cursor picks an answer (ink), it is wiped to the accent with a check, score and progress advance
UIK.define({
  id: 'quiz-answer', name: 'Quiz answer', cat: 'play', T: 3.6, cam: 1.2,
  desc: 'A quiz question with four answer rows. The cursor hovers and picks Saturn: the row fills ink. Then the answer is marked correct — an accent fill wipes across it from the left and a check pops — the other rows dim, +1 rises beside the score, the score rolls to 3 and the progress bar advances.',
  build: () => {
    const OY = [-64, 40, 144, 248], OW = 880, OH = 88, PICK = 1, C = 1.35, R = 2.05;
    const opts = ['Jupiter', 'Saturn', 'Uranus', 'Neptune'];
    const rowContent = (i, badgeFill, letterC, labelC, bx = -392, lx = -350) => [
      circle({ x: bx, d: 48, fill: badgeFill, ch: [text({ text: 'ABCD'[i], size: 24, weight: 600, color: letterC, tnum: false })] }),
      text({ text: opts[i], x: lx, ax: 0, size: 30, weight: 500, color: labelC }),
    ];
    return [
      rect({ id: 'card', w: 1000, h: 720, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'qNo', text: 'Question 3 of 10', x: -440, y: -296, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.22) }),
        text({ id: 'plus', text: '+1', x: 284, y: -296, ax: 1, size: 26, weight: 600, color: 'acc', k: enter(R + 0.3, { dy: 18, y0: -296 }) }),
        rect({ id: 'scoreChip', x: 370, y: -296, w: 150, h: 52, r: 26, fill: 'soft', k: k(enter(0.26), bump(R + 0.34, 1.08)), ch: [
          roll({ id: 'score', w: 130, h: 34, size: 24, vals: ['Score 2', 'Score 3'], ts: [R + 0.34] }),
        ] }),
        rect({ id: 'progTrack', y: -250, w: 880, h: 10, r: 5, fill: 'skel', k: fadeIn(0.28) }),
        rect({ id: 'progFill', x: -440, y: -250, pin: 'l', w: 176, h: 10, r: 5, fill: 'ink', k: k(fadeIn(0.28), { w: [[R + 0.34, R + 0.94, 264, 'Power3 Out']] }) }),
        text({ id: 'question', text: 'Which planet has the most moons?', x: -440, y: -178, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.3, { dx: -14, x0: -440 }) }),
        ...opts.map((_, i) => rect({ id: 'opt' + i, y: OY[i], w: OW, h: OH, r: 24, fill: 'card', stroke: 'line', sw: 2,
          k: k(enter(0.38 + i * 0.07, { blur: 0, dy: 12, y0: OY[i] }),
            i === PICK ? k({ fill: [[C - 0.3, C - 0.12, 'panel', 'Power2 Out']] }, press(C, { to: 0.98 })) : { opacity: [[R + 0.1, R + 0.4, 0.4, 'Power2 Out']] }),
          ch: rowContent(i, 'soft', 'ink', 'ink') })),
        group({ id: 'picked', y: OY[PICK], k: { opacity: [0, [C, C + 0.1, 1, 'Power2 Out']], scale: [0.97, [C, C + 0.3, 1, 'Power3 Out']] }, ch: [
          rect({ w: OW, h: OH, r: 24, fill: 'ink' }),
          ...rowContent(PICK, 'inv/16', 'inv', 'inv'),
        ] }),
        rect({ id: 'correct', x: -OW / 2, y: OY[PICK], pin: 'l', chAt: 'pin', w: 0, h: OH, r: 24, fill: 'acc', clip: true, k: { w: [[R, R + 0.45, OW, 'Power3 Out']] }, ch: [
          circle({ x: 48, d: 48, fill: '#FFFFFF', opacity: 0.24 }),
          text({ text: 'B', x: 48, size: 24, weight: 600, color: '#FFFFFF', tnum: false }),
          text({ text: opts[PICK], x: 90, ax: 0, size: 30, weight: 500, color: '#FFFFFF' }),
          text({ text: 'Correct', x: OW - 84, ax: 1, size: 24, weight: 600, color: '#FFFFFF', k: enter(R + 0.34) }),
          icon({ id: 'check', icon: 'check', x: OW - 50, size: 32, sw: 3.2, color: '#FFFFFF', k: pop(R + 0.3) }),
        ] }),
      ] }),
      cursorLayer([[0, 520, 390], [0.7, 520, 390], [C - 0.1, -120, OY[PICK] + 12], [C + 0.25, -120, OY[PICK] + 12], [2.3, 380, 390]], [C], [], { inAt: 0.65 }),
    ];
  },
});

// 7 ─ Course unlock: lesson 3's ring completes, lesson 4 unlocks (lock → play), the Up next chip moves to it
UIK.define({
  id: 'course-unlock', name: 'Course unlock', cat: 'play', T: 3.5, cam: 1.15,
  desc: 'A course lesson list: two lessons done, the third in progress. Its ring closes (Trim Paths) and turns into an ink check disc, the header rolls to 3 of 5; lesson 4’s lock springs open and swaps to a play disc while its title wakes from grey, and the accent Up next chip glides down to it, stretching as it travels.',
  build: () => {
    const RY = [-140, -36, 68, 172, 276], P0 = 0.75, P1 = 1.7, DN = 1.72, U = 2.0, M = 2.45;
    const L = [['Keyframes 101', '6 min · Video'], ['Easing curves', '9 min · Video'], ['Timing & spacing', '12 min · Video'], ['Follow-through', '8 min · Exercise'], ['Final project', '20 min · Project']];
    const doneDisc = (id, kk) => circle({ id, d: 56, fill: 'ink', k: kk, ch: [icon({ icon: 'check', size: 26, sw: 3.2, color: 'inv' })] });
    const status = (i) => {
      if (i < 2) return [doneDisc('done' + i)];
      if (i === 2) return [
        path({ id: 'ringTrack', d: ring(25), stroke: 'skel', sw: 6 }),
        path({ id: 'ringArc', d: ring(25), stroke: 'ink', sw: 6, trimmed: true, trimE: 62, k: { trimE: [[P0, P1, 100, 'Power2 Smooth']] } }),
        icon({ id: 'nowPlay', icon: 'play', x: 2, size: 18, sw: 2, color: 'ink', filled: true, fill: 'ink' }),
        doneDisc('done2', pop(DN, { from: 0.5 })),
      ];
      return [
        circle({ id: 'lockDisc' + i, d: 56, fill: 'soft', ch: i === 3 ? [
          icon({ id: 'lock3', icon: 'lock', size: 24, sw: 2.4, color: 'muted', k: k(bump(U - 0.06, 1.15), { opacity: [[U + 0.04, 0]] }) }),
          icon({ id: 'lockOpen3', paths: G.lockOpen, size: 24, sw: 2.4, color: 'muted', k: { opacity: [0, [U + 0.04, 1]] } }),
        ] : [icon({ icon: 'lock', size: 24, sw: 2.4, color: 'muted' })] }),
        ...(i === 3 ? [circle({ id: 'playDisc', d: 56, fill: 'ink', k: pop(U + 0.36, { from: 0.4 }), ch: [icon({ icon: 'play', x: 2, size: 20, sw: 2, color: 'inv', filled: true, fill: 'inv' })] })] : []),
      ];
    };
    return [
      rect({ id: 'card', w: 900, h: 720, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Motion basics', x: -390, y: -290, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -390 }) }),
        roll({ id: 'doneCount', x: -230, y: -246, w: 320, h: 34, ax: 0, size: 24, weight: 500, color: 'muted', vals: ['2 of 5 lessons done', '3 of 5 lessons done'], ts: [DN + 0.1], k: enter(0.3) }),
        roll({ id: 'pct', x: 345, y: -290, w: 100, h: 44, ax: 1, size: 34, vals: ['40%', '60%'], ts: [DN + 0.1], k: enter(0.3) }),
        rect({ id: 'rule', y: -198, w: 800, h: 2, fill: 'line', k: fadeIn(0.3) }),
        ...RY.slice(0, 4).map((y, i) => rect({ id: 'sep' + i, x: 40, y: y + 52, w: 720, h: 2, fill: 'line', k: fadeIn(0.4 + i * 0.05) })),
        ...L.map(([name, meta], i) => group({ id: 'lesson' + i, y: RY[i], k: enter(0.34 + i * 0.07, { dx: -18, x0: 0 }), ch: [
          group({ id: 'status' + i, x: -370, ch: status(i) }),
          text({ id: 'name' + i, text: name, x: -320, y: -15, ax: 0, size: 30, weight: 600, color: i > 2 ? 'muted' : 'ink',
            k: i === 3 ? { color: [[U + 0.36, U + 0.66, 'ink', 'Power2 Out']] } : null }),
          text({ id: 'meta' + i, text: meta, x: -320, y: 21, ax: 0, size: 22, color: 'muted' }),
        ] })),
        rect({ id: 'upNext', x: 308, y: RY[2], w: 148, h: 48, r: 24, fill: 'acc',
          k: k(pop(0.62, { from: 0.5 }), { y: [[M, M + 0.5, RY[3], 'Power4 Out']], h: [[M, M + 0.14, 62, 'Power2 Out'], [M + 0.14, M + 0.55, 48, 'Power3 Out']] }), ch: [
            text({ text: 'Up next', size: 22, weight: 600, color: '#FFFFFF' }),
          ] }),
      ] }),
    ];
  },
});

// 8 ─ Flashcard flip: tap flips the word to its definition, a swipe right throws it onto the Known pile
UIK.define({
  id: 'flashcard-flip', name: 'Flashcard flip', cat: 'play', T: 3.7, cam: { zoom: 1.32, x: 110 },
  desc: 'A vocabulary card on a small stack. The cursor taps it: the card lifts, squeezes to an edge (scale X 1 → 0) and opens again on its definition. Then the cursor drags it right — it tilts and gains a deeper shadow — and lets go: the card flies onto the Known pile, shrinking to 40 %, the pile flashes an accent ring, its count rolls 12 → 13 and the next card comes forward.',
  build: () => {
    const X0 = -190, F = 1.0, SW = F + 0.2, SW0 = 2.1, SW1 = 2.5, LAND = SW1 + 0.42, PX = 570, PY = -44;
    const face = (id, o) => rect({ id, w: 600, h: 400, r: 36, fill: 'card', shadow: 1, k: o.k, ch: o.ch });
    // the next card's face stays blank until it comes forward, so nothing reads through the flip
    const front = (word, kk) => (word ? [
      text({ text: 'Vocabulary · 13 / 40', x: -250, y: -150, ax: 0, size: 22, color: 'muted', k: kk }),
      text({ text: word, y: -8, size: 68, weight: 600, ls: -0.02, k: kk }),
      text({ text: 'Tap to flip', y: 150, size: 22, color: 'muted', k: kk }),
    ] : []);
    const next = (id, y, s, to, word) => group({ id, x: X0, y, scale: s,
      k: to ? { y: [[SW1 + 0.05, SW1 + 0.55, to[0], 'Power3 Out']], scale: [[SW1 + 0.05, SW1 + 0.55, to[1], 'Power3 Out']] } : null,
      ch: [face(id + 'Face', { ch: front(word, enter(SW1 + 0.12)) })] });
    return [
      rect({ id: 'tray', x: PX, w: 320, h: 380, r: 36, fill: 'panel', k: enter(0.3, { blur: 0, s: 0.9 }), ch: [
        rect({ id: 'pileA', y: PY, w: 240, h: 160, r: 16, fill: 'card', shadow: 3, rot: -5, ch: [text({ text: 'lucid', size: 26, weight: 600 })] }),
        rect({ id: 'pileB', y: PY, w: 240, h: 160, r: 16, fill: 'card', shadow: 3, rot: 3, ch: [text({ text: 'brevity', size: 26, weight: 600 })] }),
        icon({ id: 'knownIc', icon: 'check', x: -120, y: 132, size: 26, sw: 3, color: 'ink' }),
        text({ id: 'knownLbl', text: 'Known', x: -98, y: 132, ax: 0, size: 28, weight: 600 }),
        rect({ id: 'countChip', x: 104, y: 132, w: 76, h: 48, r: 24, fill: 'ink', k: bump(LAND, 1.12), ch: [
          roll({ id: 'known', w: 60, h: 34, size: 24, color: 'inv', vals: ['12', '13'], ts: [LAND - 0.02] }),
        ] }),
      ] }),
      rect({ id: 'trayRing', x: PX, w: 336, h: 396, r: 44, stroke: 'acc', sw: 4,
        k: { opacity: [0, [LAND - 0.12, LAND, 1, 'Power2 Out'], [LAND + 0.4, LAND + 0.8, 0, 'Power2 Out']], scale: [0.97, [LAND - 0.12, LAND + 0.4, 1.02, 'Power3 Out']] } }),
      next('next2', 44, 0.88, [22, 0.94], null),
      next('next1', 22, 0.94, [0, 1], 'ephemeral'),
      group({ id: 'flip', x: X0, k: {
          scale: [0.7, [0.1, 0.62, 1, 'Back Out'], [F - 0.04, SW, 1.04, 'Power2 Out'], [SW, F + 0.6, 1, 'Power3 Out'], [SW1, SW1 + 0.5, 0.4, 'Power3 Out']],
          opacity: [0, [0.1, 0.22, 1, 'Linear']],
          sx: [[F, SW, 0, 'Power2 In'], [SW, F + 0.52, 1, 'Power3 Out']],
          y: [[F - 0.04, SW, -14, 'Power2 Out'], [SW, F + 0.6, 0, 'Power3 Out'], [SW1, SW1 + 0.5, PY, 'Power3 Out']],
          x: [[SW0, SW1, X0 + 230, 'Power2 Smooth'], [SW1, SW1 + 0.5, PX, 'Power3 Out']],
          rot: [[SW0, SW1, 7, 'Power2 Smooth'], [SW1, SW1 + 0.5, -2, 'Power3 Out']],
        }, ch: [
          rect({ id: 'lift', w: 600, h: 400, r: 36, fill: 'card', shadow: 2, k: { opacity: [0, [SW0 - 0.05, SW0 + 0.15, 1, 'Power2 Out'], [SW1 + 0.1, SW1 + 0.4, 0, 'Power2 Out']] } }),
          face('front', { k: { opacity: [[SW, 0]] }, ch: [
            text({ text: 'Vocabulary · 12 / 40', x: -250, y: -150, ax: 0, size: 22, color: 'muted', k: enter(0.26) }),
            text({ id: 'word', text: 'serendipity', y: -8, size: 68, weight: 600, ls: -0.02, k: enter(0.3) }),
            text({ id: 'hint', text: 'Tap to flip', y: 150, size: 22, color: 'muted', k: enter(0.38) }),
          ] }),
          face('back', { k: { opacity: [0, [SW, 1]] }, ch: [
            text({ text: 'noun', x: -250, y: -150, ax: 0, size: 22, weight: 600, color: 'muted' }),
            text({ id: 'definition', text: 'Finding something good without looking for it', y: -14, size: 38, weight: 500, ls: -0.01, wrap: 470, lh: 1.25 }),
            text({ text: '“a happy accident”', y: 128, size: 24, color: 'muted', italic: true }),
          ] }),
        ] }),
      cursorLayer([[0, 520, 360], [0.5, 520, 360], [F - 0.1, X0 + 20, 30], [F + 0.2, X0 + 20, 30], [SW0 - 0.14, X0 + 14, 18], [SW0, X0 + 14, 18],
        [SW1, X0 + 244, 18, 'Power2 Smooth'], [SW1 + 0.2, X0 + 244, 18], [3.3, 330, 330]], [F], [[SW0, SW1]], { inAt: 0.45 }),
    ];
  },
});

// 9 ─ Word match: the cursor drags a curved line from each word to its translation; matched pairs turn ink
UIK.define({
  id: 'word-match', name: 'Word match', cat: 'play', T: 4.6, cam: 1.2,
  desc: 'Two columns of words, English and Spanish. The cursor drags from each word to its translation: a curved line draws behind the pointer (Trim Paths, keyed along the curve with the cursor), dots pop at both ends and on release both rows fill ink. The counter rolls 1 → 4 of 4 and an accent All matched chip pops.',
  build: () => {
    const LW = ['cat', 'house', 'water', 'bread'], RW = ['agua', 'gato', 'pan', 'casa'], PAIRS = [[0, 1], [1, 3], [2, 0], [3, 2]];
    const YS = [-128, -24, 80, 184], LX = -300, RX = 300, A = [0.95, 1.75, 2.55, 3.35], DUR = 0.5, END = A[3] + DUR + 0.1;
    const conns = PAIRS.map(([l, r], i) => {
      const P = [[-150, YS[l]], [-40, YS[l]], [40, YS[r]], [150, YS[r]]];
      return { l, r, P, F: follow(P, A[i], A[i] + DUR, 10) };
    });
    const matchedAt = (side, j) => A[conns.findIndex((c) => c[side] === j)] + DUR;
    const row = (id, x, y, s, t, kk) => rect({ id, x, y, w: 300, h: 84, r: 22, fill: 'card', stroke: 'line', sw: 2, k: k(enter(t, { blur: 0, dy: 12, y0: y }), kk),
      ch: [text({ text: s, size: 30, weight: 500 })] });
    const inked = (id, x, y, s, t) => rect({ id, x, y, w: 300, h: 84, r: 22, fill: 'ink', k: { opacity: [0, [t, t + 0.1, 1, 'Power2 Out']], scale: [0.95, [t, t + 0.35, 1, 'Power3 Out']] },
      ch: [text({ text: s, size: 30, weight: 500, color: 'inv' })] });
    const keys = [[0, 540, 390], [0.5, 540, 390]];
    conns.forEach((c, i) => { keys.push([A[i] - 0.05, c.P[0][0], c.P[0][1]], [A[i], c.P[0][0], c.P[0][1]]); c.F.slice(1).forEach((q) => keys.push([q.t, q.p[0], q.p[1], 'Linear'])); });
    keys.push([END + 0.2, conns[3].P[3][0], conns[3].P[3][1]], [END + 0.75, 420, 380]);
    return [
      rect({ id: 'card', w: 1000, h: 720, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Match the pairs', x: -440, y: -292, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -440 }) }),
        text({ id: 'sub', text: 'Lesson 4 · Home', x: -440, y: -250, ax: 0, size: 24, color: 'muted', k: enter(0.3) }),
        roll({ id: 'count', x: 380, y: -292, w: 120, h: 36, ax: 1, size: 26, vals: ['0 of 4', '1 of 4', '2 of 4', '3 of 4', '4 of 4'], ts: A.map((a) => a + DUR + 0.04), k: enter(0.3) }),
        text({ id: 'enLbl', text: 'English', x: LX, y: -196, size: 22, weight: 600, ls: 0.12, upper: true, color: 'muted', k: enter(0.34) }),
        text({ id: 'esLbl', text: 'Spanish', x: RX, y: -196, size: 22, weight: 600, ls: 0.12, upper: true, color: 'muted', k: enter(0.38) }),
        ...LW.map((s, j) => row('left' + j, LX, YS[j], s, 0.38 + j * 0.06, press(A[conns.findIndex((c) => c.l === j)], { to: 0.97 }))),
        ...RW.map((s, j) => row('right' + j, RX, YS[j], s, 0.42 + j * 0.06)),
        ...LW.map((s, j) => inked('leftDone' + j, LX, YS[j], s, matchedAt('l', j))),
        ...RW.map((s, j) => inked('rightDone' + j, RX, YS[j], s, matchedAt('r', j))),
        ...conns.map((c, i) => path({ id: 'link' + i, d: bzD(c.P), stroke: 'ink', sw: 5, trimmed: true, k: { trimE: [0, ...followSegs(c.F, (q) => r1(q.f * 100))] } })),
        ...conns.flatMap((c, i) => [
          circle({ id: 'dotL' + i, x: c.P[0][0], y: c.P[0][1], d: 16, fill: 'ink', stroke: 'card', sw: 3, k: pop(A[i], { from: 0.3, dur: 0.3 }) }),
          circle({ id: 'dotR' + i, x: c.P[3][0], y: c.P[3][1], d: 16, fill: 'ink', stroke: 'card', sw: 3, k: pop(A[i] + DUR, { from: 0.3, dur: 0.3 }) }),
        ]),
        text({ id: 'hint', text: 'Drag each word to its match', y: 292, size: 24, color: 'muted', k: k(enter(0.5), exit(END)) }),
        rect({ id: 'allDone', y: 292, w: 250, h: 64, r: 32, fill: 'acc', k: pop(END + 0.04, { from: 0.5 }), ch: [
          icon({ icon: 'check', x: -84, size: 26, sw: 3.2, color: '#FFFFFF' }),
          text({ text: 'All matched', x: -62, ax: 0, size: 26, weight: 600, color: '#FFFFFF' }),
        ] }),
      ] }),
      cursorLayer(keys, [], A.map((a) => [a, a + DUR]), { inAt: 0.45 }),
    ];
  },
});

// 10 ─ Achievement unlock: the badge pops with a sweeping ring, the title slides in, +50 XP rises
UIK.define({
  id: 'achievement-unlock', name: 'Achievement unlock', cat: 'play', T: 2.9, cam: 1.3,
  desc: 'A hexagon badge pops in with a quarter turn while an accent ring sweeps round it (Trim Paths on a rotating group). The caption fades up, the title Early bird slides in from the left, and a +50 XP chip rises out of the badge to rest on its shoulder.',
  build: () => {
    const BY = -86, HR = 112, B0 = 0.3, XP = 1.4;
    const hex = 'M' + Array.from({ length: 6 }, (_, i) => { const a = (-90 + 60 * i) * Math.PI / 180; return `${r1(HR * Math.cos(a))} ${r1(HR * Math.sin(a))}`; }).join(' L') + ' Z';
    return [
      rect({ id: 'card', w: 820, h: 640, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        group({ id: 'sweep', y: BY, rot: -150, k: { rot: [[B0 + 0.12, B0 + 0.9, 0, 'Power3 Out']] }, ch: [
          path({ id: 'sweepTrack', d: ring(160), stroke: 'skel', sw: 6, k: fadeIn(B0 + 0.1) }),
          path({ id: 'sweepArc', d: ring(160), stroke: 'acc', sw: 6, trimmed: true, k: { trimE: [0, [B0 + 0.12, B0 + 0.9, 100, 'Power3 Out']] } }),
        ] }),
        group({ id: 'badge', y: BY, k: { scale: [0.3, [B0, B0 + 0.52, 1, 'Back Out']], opacity: [0, [B0, B0 + 0.12, 1, 'Linear']], rot: [-30, [B0, B0 + 0.6, 0, 'Power3 Out']] }, ch: [
          path({ id: 'hex', d: hex, fill: 'ink', stroke: 'ink', sw: 22 }),
          icon({ id: 'sunrise', paths: G.sunrise, size: 96, sw: 6, color: 'inv' }),
        ] }),
        group({ id: 'xp', x: 150, y: -214, k: { y: [-110, [XP, XP + 0.55, -214, 'Power3 Out']], opacity: [0, [XP, XP + 0.14, 1, 'Power2 Out']], scale: [0.7, [XP, XP + 0.5, 1, 'Power3 Out']] }, ch: [
          rect({ w: 172, h: 60, r: 30, fill: 'ink', shadow: 3 }),
          icon({ icon: 'zap', x: -54, size: 26, sw: 2, color: 'acc', filled: true, fill: 'acc' }),
          text({ text: '+50 XP', x: -34, ax: 0, size: 26, weight: 600, color: 'inv', tnum: false }),
        ] }),
        text({ id: 'caption', text: 'Achievement unlocked', y: 128, size: 22, weight: 600, ls: 0.14, upper: true, color: 'muted', k: enter(0.9, { dy: 10, y0: 128 }) }),
        text({ id: 'name', text: 'Early bird', y: 184, size: 64, weight: 600, ls: -0.03, k: enter(0.98, { dx: -60, x0: 0 }) }),
        text({ id: 'desc', text: 'Finished a lesson before 7 AM', y: 240, size: 26, color: 'muted', k: enter(1.1) }),
      ] }),
    ];
  },
});

// 11 ─ XP level up: a +120 chunk fills the bar and overflows, the level rolls 7 → 8, the bar resets and refills a little
UIK.define({
  id: 'xp-level-up', name: 'XP level up', cat: 'play', T: 3.1, cam: 1.3,
  desc: 'A level card at 460 / 500 XP. A +120 XP chip pops, an accent chunk fills the rest of the bar while the XP counts to 500; the bar overflows: the level badge bumps and its number rolls 7 → 8, an accent Level up chip pops, the full bar blurs away and a fresh bar refills to 80 / 550.',
  build: () => {
    const BX = -250, BW = 720, G0 = 1.0, G1 = 1.45, LV = 1.48, RS = 1.72, RF = 1.96;
    return [
      rect({ id: 'card', w: 1100, h: 380, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        circle({ id: 'badge', x: -400, d: 180, fill: 'ink', k: k(enter(0.2, { s: 0.7 }), bump(LV, 1.1)), ch: [
          text({ id: 'lvlLbl', text: 'Level', y: -50, size: 20, weight: 600, ls: 0.14, upper: true, color: 'inv/60' }),
          text({ id: 'lvl', text: `{{{COUNTER:7-8; start=${LV}; duration=0.5; easing=power4_out; turns=0}}}`, y: 12, size: 92, weight: 600, color: 'inv' }),
        ] }),
        rect({ id: 'lvlUp', x: -400, y: 92, w: 170, h: 50, r: 25, fill: 'acc', k: pop(LV + 0.28, { from: 0.5 }), ch: [
          icon({ icon: 'arrowUp', x: -50, size: 22, sw: 3, color: '#FFFFFF' }),
          text({ text: 'Level up', x: -32, ax: 0, size: 22, weight: 600, color: '#FFFFFF' }),
        ] }),
        text({ id: 'rank', text: 'Explorer', x: BX, y: -88, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.26, { dx: -14, x0: BX }) }),
        rect({ id: 'gain', x: 396, y: -88, w: 148, h: 50, r: 25, fill: 'ink', k: k(pop(0.72, { from: 0.5 }), exit(RS, { s: 0.8 })), ch: [
          text({ text: '+120 XP', size: 22, weight: 600, color: 'inv', tnum: false }),
        ] }),
        rect({ id: 'track', x: BX, y: -8, pin: 'l', w: BW, h: 26, r: 13, fill: 'skel', k: fadeIn(0.32) }),
        rect({ id: 'chunk', x: BX + BW * 0.92 - 26, y: -8, pin: 'l', w: 26, h: 26, r: 13, fill: 'acc', k: k({ opacity: [0, [G0, 1]], w: [[G0, G1, BW * 0.08 + 26, 'Power2 Smooth']] }, exit(RS, { dur: 0.2 })) }),
        rect({ id: 'fill', x: BX, y: -8, pin: 'l', w: BW * 0.92, h: 26, r: 13, fill: 'ink', k: k(fadeIn(0.36), exit(RS, { dur: 0.2 })) }),
        rect({ id: 'refill', x: BX, y: -8, pin: 'l', w: 0, h: 26, r: 13, fill: 'ink', k: { w: [[RF, RF + 0.55, r1(BW * 80 / 550), 'Power3 Out']] } }),
        roll({ id: 'next', x: BX + 140, y: 46, w: 280, h: 34, ax: 0, size: 24, weight: 500, color: 'muted', vals: ['Next: Level 8', 'Next: Level 9'], ts: [LV + 0.1], k: enter(0.4) }),
        text({ id: 'xpOld', x: BX + BW, y: 46, ax: 1, size: 24, weight: 600, num: { suf: ' / 500 XP' }, value: 460, k: k(enter(0.42), { value: [[G0, G1, 500, 'Power2 Smooth']] }, exit(RS)) }),
        text({ id: 'xpNew', x: BX + BW, y: 46, ax: 1, size: 24, weight: 600, num: { suf: ' / 550 XP' }, k: k(enter(RS + 0.06), { value: [[RF, RF + 0.55, 80, 'Power3 Out']] }) }),
      ] }),
    ];
  },
});

// 12 ─ Playlist reorder: a track is dragged by its handle down two slots, the others shift up; the now-playing EQ moves
UIK.define({
  id: 'playlist-reorder', name: 'Playlist reorder', cat: 'play', T: 3.4, cam: 1.1,
  desc: 'A play queue: the now-playing row has accent equalizer bars moving on smooth keys. The cursor grabs the first queued track by its handle — it lifts (scale + a deeper shadow) — and drags it down two slots; the two tracks it passes slide up one slot each as it crosses their midpoints, and it settles in place.',
  build: () => {
    const QY = [-30, 74, 178, 282], RH = 104, GR = 1.1, D0 = 1.24, D1 = 2.14, HX = 360;
    const tracks = [['Paper Boats', 'Juno Park', '3:41', 1], ['Harbor Lights', 'The Quiet Hours', '4:02', 3], ['Neon Fields', 'Ada Rhee', '3:18', 5], ['Afterglow', 'North Coast', '2:57', 9]];
    const content = (tr, i) => [
      rect({ id: 'rowBg' + i, w: 860, h: 100, r: 20, fill: 'card' }),
      photo({ id: 'art' + i, x: -358, w: 64, h: 64, r: 14, v: tr[3] }),
      text({ text: tr[0], x: -306, y: -15, ax: 0, size: 28, weight: 600 }),
      text({ text: tr[1], x: -306, y: 19, ax: 0, size: 22, color: 'muted' }),
      text({ text: tr[2], x: 296, ax: 1, size: 24, color: 'muted' }),
      icon({ id: 'grip' + i, paths: G.grip, x: HX, size: 30, sw: 2.6, color: 'muted' }),
    ];
    const eq = [0, 1, 2, 3].map((i) => {
      const h = [8]; let t = 0.4 + i * 0.05;
      while (t < 3.3) { const d = 0.16 + rnd(i * 31 + h.length) * 0.1; h.push([+t.toFixed(3), +(t + d).toFixed(3), 8 + Math.round(rnd(i * 17 + h.length * 3) * 30), 'Sine Smooth']); t += d; }
      return rect({ id: 'eq' + i, x: 318 + i * 14, y: 20, pin: 'b', w: 8, h: 8, r: 4, fill: 'acc', k: k(fadeIn(0.4), { h }) });
    });
    const shiftAt = (j) => cross(D0, D1, QY[0], QY[2], (QY[j - 1] + QY[j]) / 2);
    return [
      rect({ id: 'card', w: 900, h: 760, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Queue', x: -390, y: -318, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -390 }) }),
        text({ id: 'clear', text: 'Clear', x: 390, y: -318, ax: 1, size: 26, weight: 500, color: 'muted', k: enter(0.28) }),
        text({ id: 'nowLbl', text: 'Now playing', x: -390, y: -260, ax: 0, size: 20, weight: 600, ls: 0.12, upper: true, color: 'muted', k: enter(0.3) }),
        rect({ id: 'now', y: -188, w: 820, h: 116, r: 28, fill: 'panel', k: enter(0.32, { blur: 0, s: 0.96 }), ch: [
          photo({ id: 'nowArt', x: -352, w: 76, h: 76, r: 16, v: 8 }),
          text({ text: 'Slow Light', x: -296, y: -16, ax: 0, size: 30, weight: 600 }),
          text({ text: 'Mara Vale', x: -296, y: 20, ax: 0, size: 24, color: 'muted' }),
          ...eq,
        ] }),
        text({ id: 'nextLbl', text: 'Next up', x: -390, y: -100, ax: 0, size: 20, weight: 600, ls: 0.12, upper: true, color: 'muted', k: enter(0.36) }),
        ...[0, 1, 2].map((j) => rect({ id: 'sep' + j, y: (QY[j] + QY[j + 1]) / 2, w: 820, h: 2, fill: 'line', k: fadeIn(0.44 + j * 0.05) })),
        ...tracks.slice(1).map((tr, n) => {
          const i = n + 1;
          return group({ id: 'row' + i, y: QY[i], k: k(enter(0.4 + i * 0.07, { dx: -18, x0: 0 }), i < 3 ? { y: [[shiftAt(i), shiftAt(i) + 0.32, QY[i - 1], 'Power3 Out']] } : null), ch: content(tr, i) });
        }),
        group({ id: 'dragRow', y: QY[0], k: k(enter(0.4, { dx: -18, x0: 0 }), {
            y: [[D0, D1, QY[2], 'Power2 Smooth']], scale: [[GR - 0.05, GR + 0.2, 1.03, 'Power3 Out'], [D1, D1 + 0.3, 1, 'Power3 Out']] }), ch: [
          rect({ id: 'liftShadow', w: 860, h: 100, r: 20, fill: 'card', shadow: 2, k: { opacity: [0, [GR - 0.05, GR + 0.15, 1, 'Power2 Out'], [D1, D1 + 0.3, 0, 'Power2 Out']] } }),
          ...content(tracks[0], 0),
        ] }),
      ] }),
      cursorLayer([[0, 560, 400], [0.55, 560, 400], [GR - 0.1, HX + 4, QY[0] + 6], [D0, HX + 4, QY[0] + 6], [D1, HX + 4, QY[2] + 6, 'Power2 Smooth'],
        [D1 + 0.25, HX + 4, QY[2] + 6], [3.0, 520, 400]], [], [[GR, D1]], { inAt: 0.5 }),
    ];
  },
});

// 13 ─ Podcast chapters: a segmented scrubber; clicking chapter 3 jumps the playhead, the title swaps, playback continues
UIK.define({
  id: 'podcast-chapters', name: 'Podcast chapters', cat: 'play', T: 4.0, cam: 1.25,
  desc: 'A podcast player whose scrubber is split into chapter segments. It plays on (the played clip and knob creep, the time counts); the cursor hovers chapter 3 — a tooltip names it — and clicks: the playhead jumps there (the knob stretches in flight), the chapter line rolls, the title swaps to The interview and playback carries on.',
  build: () => {
    const X0 = -110, SWD = 610, GAP = 8, FR = [0.16, 0.24, 0.36, 0.24], TOT = 760, SY = 36, H = 1.45, C = 1.75, J = C + 0.45, T = 4.0;
    const usable = SWD - GAP * (FR.length - 1), WS = FR.map((f) => usable * f), ST = [], CF = [];
    FR.reduce((a, f, i) => { ST.push(i ? ST[i - 1] + WS[i - 1] + GAP : X0); CF.push(a); return a + f; }, 0);
    const px = (p) => { let i = FR.length - 1; while (i > 0 && p < CF[i]) i--; return r1(ST[i] + (p - CF[i]) / FR[i] * WS[i]); };
    const P = [65 / TOT, 100 / TOT, 304 / TOT, 350 / TOT];   // 1:05 → 1:40, jump to 5:04 → 5:50
    const kx = [[0.3, C, px(P[1]), 'Linear'], [C, J, px(P[2]), 'Power4 Out'], [J, T, px(P[3]), 'Linear']];
    const HX = px(P[2]) + 8;
    return [
      rect({ id: 'card', w: 1160, h: 480, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        photo({ id: 'cover', x: -340, w: 340, h: 340, r: 32, v: 8, k: enter(0.2, { blur: 0, s: 0.9 }) }),
        text({ id: 'show', text: 'The Long Take · Ep. 42', x: X0, y: -164, ax: 0, size: 24, color: 'muted', k: enter(0.26) }),
        roll({ id: 'chapterNo', x: X0 + 140, y: -124, w: 280, h: 34, ax: 0, size: 22, weight: 600, color: 'muted', vals: ['Chapter 1 of 4', 'Chapter 3 of 4'], ts: [C + 0.06], k: enter(0.3) }),
        text({ id: 'titleA', text: 'Cold open', x: X0, y: -78, ax: 0, size: 50, weight: 600, ls: -0.02, k: k(enter(0.34, { dx: -14, x0: X0 }), exit(C + 0.04)) }),
        text({ id: 'titleB', text: 'The interview', x: X0, y: -78, ax: 0, size: 50, weight: 600, ls: -0.02, k: enter(C + 0.06, { dx: 14, x0: X0 }) }),
        group({ id: 'scrubber', k: fadeIn(0.4), ch: [
          ...WS.map((w, i) => rect({ id: 'seg' + i, x: ST[i], y: SY, pin: 'l', w, h: 10, r: 5, fill: 'dim' })),
          rect({ id: 'played', x: X0, y: SY, pin: 'l', chAt: 'pin', w: px(P[0]) - X0, h: 20, clip: true, k: { w: kx.map(([a, b, v, e]) => [a, b, r1(v - X0), e]) },
            ch: WS.map((w, i) => rect({ x: ST[i] - X0, pin: 'l', w, h: 10, r: 5, fill: 'ink' })) }),
          rect({ id: 'knob', x: px(P[0]), y: SY, w: 24, h: 24, r: 12, fill: 'ink', k: { x: kx, w: [[C, C + 0.12, 58, 'Power2 Out'], [C + 0.12, C + 0.5, 24, 'Power3 Out']] } }),
        ] }),
        group({ id: 'tip', x: px(P[2]), y: SY - 50, k: k(pop(H, { from: 0.6, dur: 0.35 }), exit(C + 0.06, { s: 0.85 })), ch: [
          rect({ id: 'tipArrow', y: 22, w: 16, h: 16, r: 3, rot: 45, fill: 'ink' }),
          rect({ id: 'tipBox', w: 262, h: 50, r: 14, fill: 'ink', ch: [text({ text: 'The interview · 5:04', size: 22, weight: 500, color: 'inv' })] }),
        ] }),
        text({ id: 'tA', x: X0, y: SY + 40, ax: 0, size: 22, color: 'muted', num: { pre: '1:', pad: 2, sep: false }, value: 5, k: k(enter(0.44), { value: [[0.3, C, 40, 'Linear']] }, exit(C + 0.02, { blur: 0, dur: 0.1 })) }),
        text({ id: 'tB', x: X0, y: SY + 40, ax: 0, size: 22, color: 'muted', num: { pre: '5:', pad: 2, sep: false }, value: 4, k: k(enter(C + 0.14, { d: 0, blur: 0, dur: 0.2 }), { value: [[J, T, 50, 'Linear']] }) }),
        text({ id: 'dur', text: '12:40', x: X0 + SWD, y: SY + 40, ax: 1, size: 22, color: 'muted', k: enter(0.46) }),
        group({ id: 'controls', x: X0 + SWD / 2, y: 162, k: enter(0.5), ch: [
          icon({ paths: G.rewind, x: -124, size: 34, sw: 2.2, color: 'ink', filled: true, fill: 'ink' }),
          circle({ id: 'pauseBtn', d: 88, fill: 'ink', ch: [icon({ icon: 'pause', size: 32, sw: 2, color: 'inv', filled: true, fill: 'inv' })] }),
          icon({ paths: G.forward, x: 124, size: 34, sw: 2.2, color: 'ink', filled: true, fill: 'ink' }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 380], [0.8, 560, 380], [H - 0.04, HX, SY + 8], [C + 0.3, HX, SY + 8], [2.9, 440, 330]], [C], [], { inAt: 0.75 }),
    ];
  },
});

// 14 ─ Photo filters: pick a filter thumbnail, the main photo's overlay crossfades in, the intensity slider is dragged
UIK.define({
  id: 'photo-filters', name: 'Photo filters', cat: 'play', T: 4.1, cam: 1.05,
  desc: 'A photo editor: the main photo over a strip of filter thumbnails (the same picture under different tint and saturation overlays). The cursor picks Mono: the selection ring glides to it (stretching), the labels swap and the main photo’s saturation overlay crossfades in. Then the Intensity slider wakes and is dragged down to 55 %, easing the overlay back on the same keys.',
  build: () => {
    const TX = [-360, -180, 0, 180, 360], TY = 128, C = 1.25, D0 = 2.3, D1 = 3.15, PICK = 2, SL = -230, SWD = 560, SYY = 306, PS = 'Power2 Smooth';
    const FX = [[], [{ fill: 'acc/26' }], [{ fill: 'muted', blend: 'saturation' }], [{ fill: 'card/50' }], [{ fill: 'muted', blend: 'saturation' }, { fill: 'shade/40' }]];
    const NAMES = ['Original', 'Warm', 'Mono', 'Fade', 'Noir'];
    const V = (v) => SL + SWD * v / 100, mv = (f) => [[D0, D1, f(55), PS]];
    return [
      rect({ id: 'card', w: 1000, h: 780, r: 40, fill: 'card', shadow: 1, k: popIn(0.1, 0.72), ch: [
        photo({ id: 'photo', y: -175, w: 1000, h: 430, radii: '40px 40px 0 0', v: 0, k: fadeIn(0.2), ch: [
          rect({ id: 'monoFx', w: 1000, h: 430, fill: 'muted', blend: 'saturation', k: { opacity: [0, [C + 0.05, C + 0.5, 1, 'Power2 Out'], ...mv((v) => v / 100)] } }),
        ] }),
        ...TX.map((x, i) => photo({ id: 'thumb' + i, x, y: TY, w: 152, h: 112, r: 16, v: 0, k: enter(0.34 + i * 0.05, { blur: 0, dy: 14, y0: TY }),
          ch: FX[i].map((o) => rect(Object.assign({ w: 152, h: 112 }, o))) })),
        rect({ id: 'selRing', x: TX[0] - 84, y: TY, pin: 'l', w: 168, h: 128, r: 24, stroke: 'ink', sw: 4, k: k(fadeIn(0.6), edges(C, TX[0] - 84, TX[0] + 84, TX[PICK] - 84, TX[PICK] + 84)) }),
        ...NAMES.map((s, i) => text({ id: 'fname' + i, text: s, x: TX[i], y: 214, size: 22, weight: 500, color: i ? 'muted' : 'ink',
          k: k(enter(0.4 + i * 0.05), i === 0 ? { color: [[C, C + 0.25, 'muted', 'Power2 Out']] } : i === PICK ? { color: [[C, C + 0.25, 'ink', 'Power2 Out']] } : null) })),
        group({ id: 'intensity', k: { opacity: [0, [0.6, 0.9, 0.35, 'Power2 Out'], [C + 0.15, C + 0.45, 1, 'Power2 Out']] }, ch: [
          text({ id: 'intLbl', text: 'Intensity', x: -440, y: SYY, ax: 0, size: 26, weight: 500 }),
          rect({ id: 'intTrack', x: SL, y: SYY, pin: 'l', w: SWD, h: 8, r: 4, fill: 'dim' }),
          rect({ id: 'intFill', x: SL, y: SYY, pin: 'l', w: SWD, h: 8, r: 4, fill: 'ink', k: { w: mv((v) => r1(V(v) - SL)) } }),
          circle({ id: 'intKnob', x: V(100), y: SYY, d: 44, fill: '#FFFFFF', stroke: 'ink', sw: 3, shadow: 3,
            k: { x: mv((v) => r1(V(v))), scale: [[D0 - 0.05, D0 + 0.15, 1.18, 'Power3 Out'], [D1 + 0.05, D1 + 0.4, 1, 'Back Out']] } }),
          text({ id: 'intVal', x: 440, y: SYY, ax: 1, size: 28, weight: 600, num: {}, value: 100, k: { value: mv((v) => v) } }),
        ] }),
      ] }),
      cursorLayer([[0, 600, 420], [0.7, 600, 420], [C - 0.1, 12, TY + 12], [C + 0.25, 12, TY + 12], [D0 - 0.12, V(100) + 4, SYY + 8], [D0, V(100) + 4, SYY + 8],
        [D1, r1(V(55)) + 4, SYY + 8, PS], [D1 + 0.2, r1(V(55)) + 4, SYY + 8], [4.1, 300, 420]], [C], [[D0, D1]], { inAt: 0.65 }),
    ];
  },
});

// 15 ─ Thermostat dial: the knob is dragged round the arc, the set point rolls 19 → 22°, Heat engages in the accent
UIK.define({
  id: 'thermostat-dial', name: 'Thermostat dial', cat: 'play', T: 3.6, cam: 1.1,
  desc: 'A 270° thermostat dial. The cursor grabs the knob and drags it clockwise round the arc (knob and cursor keyed along the circle): the ink value arc grows with it (Trim Paths) and the set point rolls 19 → 20 → 21 → 22° as each degree is passed. On release the arc is wiped over in the accent and the Idle chip gives way to an accent Heat chip.',
  build: () => {
    const DY = 50, R = 230, GR = 1.0, D0 = 1.1, D1 = 2.2, HT = D1 + 0.12, F0 = 0.45, F1 = 0.6, PS = 'Power2 Smooth';
    const pt = (f) => { const a = (135 + 270 * f) * Math.PI / 180; return [r1(R * Math.cos(a)), r1(DY + R * Math.sin(a))]; };
    const ARC = `M${r1(R * Math.cos(Math.PI * 0.75))} ${r1(R * Math.sin(Math.PI * 0.75))} A${R} ${R} 0 1 1 ${r1(R * Math.cos(Math.PI * 0.25))} ${r1(R * Math.sin(Math.PI * 0.25))}`;
    const N = 12, S = Array.from({ length: N + 1 }, (_, j) => ({ t: +(D0 + (D1 - D0) * invEase(PS, j / N)).toFixed(3), p: pt(F0 + (F1 - F0) * j / N) }));
    const segs = (fn) => S.slice(1).map((s, j) => [S[j].t, s.t, fn(s.p), 'Linear']);
    const TS = [1 / 6, 1 / 2, 5 / 6].map((p) => +(D0 + (D1 - D0) * invEase(PS, p)).toFixed(3));
    const ticks = Array.from({ length: 28 }, (_, i) => { const a = 135 + i * 10, ar = a * Math.PI / 180;
      return rect({ id: 'tick' + i, x: r1(274 * Math.cos(ar)), y: r1(DY + 274 * Math.sin(ar)), w: 4, h: i % 5 ? 12 : 20, r: 2, rot: a + 90, fill: i % 5 ? 'dim' : 'muted', k: enter(0.3 + i * 0.012, { blur: 0, s: 0.5 }) }); });
    const [kx, ky] = pt(F0);
    return [
      rect({ id: 'card', w: 760, h: 720, r: 56, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'room', text: 'Living room', x: -320, y: -292, ax: 0, size: 34, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -320 }) }),
        text({ id: 'indoor', text: 'Indoor 19°', x: 320, y: -292, ax: 1, size: 26, color: 'muted', tnum: false, k: enter(0.28) }),
        ...ticks,
        path({ id: 'track', y: DY, d: ARC, stroke: 'skel', sw: 26, k: fadeIn(0.26) }),
        path({ id: 'value', y: DY, d: ARC, stroke: 'ink', sw: 26, trimmed: true, k: { trimE: [0, [0.4, 0.95, F0 * 100, 'Power3 Out'], [D0, D1, F1 * 100, PS]] } }),
        path({ id: 'heatArc', y: DY, d: ARC, stroke: 'acc', sw: 26, trimmed: true, k: { trimE: [0, [HT, HT + 0.5, F1 * 100, 'Power3 Out']] } }),
        text({ id: 'setLbl', text: 'Set to', y: DY - 104, size: 26, color: 'muted', k: enter(0.4) }),
        roll({ id: 'temp', x: -14, y: DY - 6, w: 200, h: 150, size: 140, vals: ['19', '20', '21', '22'], ts: TS, dur: 0.2, k: enter(0.44) }),
        text({ id: 'deg', text: '°', x: 84, y: DY - 44, ax: 0, size: 76, weight: 500, k: enter(0.46) }),
        rect({ id: 'idle', y: DY + 202, w: 150, h: 56, r: 28, fill: 'soft', k: k(enter(0.5), exit(HT)), ch: [text({ text: 'Idle', size: 24, weight: 600, color: 'muted' })] }),
        rect({ id: 'heat', y: DY + 202, w: 150, h: 56, r: 28, fill: 'acc', k: pop(HT + 0.02, { from: 0.5 }), ch: [
          icon({ paths: G.flame, x: -32, size: 26, sw: 2.4, color: '#FFFFFF' }),
          text({ text: 'Heat', x: -12, ax: 0, size: 24, weight: 600, color: '#FFFFFF' }),
        ] }),
        circle({ id: 'knob', x: kx, y: ky, d: 58, fill: '#FFFFFF', stroke: 'ink', sw: 4, shadow: 3,
          k: k(pop(0.62, { from: 0.4 }), { x: segs((p) => p[0]), y: segs((p) => p[1]), scale: [[GR - 0.05, GR + 0.15, 1.2, 'Power3 Out'], [D1 + 0.05, D1 + 0.4, 1, 'Back Out']] }) }),
      ] }),
      cursorLayer([[0, 520, 380], [0.6, 520, 380], [GR - 0.1, kx + 6, ky + 8], [D0, kx + 6, ky + 8], ...S.slice(1).map((s) => [s.t, s.p[0] + 6, s.p[1] + 8, 'Linear']),
        [D1 + 0.25, pt(F1)[0] + 6, pt(F1)[1] + 8], [3.2, 400, 360]], [], [[GR, D1]], { inAt: 0.55 }),
    ];
  },
});

// 16 ─ Smart lights: taps flood two room tiles with ink from the tap point, a brightness slider is dragged up
UIK.define({
  id: 'smart-lights', name: 'Smart lights', cat: 'play', T: 4.0, cam: 1.15,
  desc: 'Four room tiles with bulb icons. Each tap floods its tile with ink from the tap point (a circular clip growing out of it, carrying the lit content: white text and an accent bulb), and the header rolls to 2 lights on. Then the cursor drags the Living room brightness bar up from 40 % to 85 % while its status counts along.',
  build: () => {
    const TP = [[-235, -76], [235, -76], [-235, 192], [235, 192]], TW = 450, TH = 252;
    const ROOMS = ['Living room', 'Kitchen', 'Bedroom', 'Office'], TAP = { 1: 1.0, 0: 1.6 }, D0 = 2.3, D1 = 3.1, PS = 'Power2 Smooth';
    const SX = 160, SY = -4, SH = 196, fh = (v) => r1(SH * v / 100), TPX = -40, TPY = 6;
    const tileContent = (i, on) => [
      circle({ x: -152, y: -64, d: 76, fill: on ? 'inv/14' : 'card', ch: [icon({ paths: G.bulb, size: 38, sw: 2.4, color: on ? 'inv' : 'ink', filled: on, fill: 'acc' })] }),
      text({ text: ROOMS[i], x: -190, y: 36, ax: 0, size: 30, weight: 600, color: on ? 'inv' : 'ink' }),
      ...(on && i === 0 ? [] : [text({ text: on ? 'On · 100%' : 'Off', x: -190, y: 76, ax: 0, size: 24, color: on ? 'inv/60' : 'muted' })]),
    ];
    const tiles = TP.map(([x, y], i) => {
      const t = TAP[i], on = t != null;
      const lit = on ? [circle({ id: 'lit' + i, x: TPX, y: TPY, d: 0, fill: 'ink', clip: true, k: { w: [[t, t + 0.6, 1060, 'Power3 Out']], h: [[t, t + 0.6, 1060, 'Power3 Out']] },
        ch: [group({ x: -TPX, y: -TPY, ch: [
          ...tileContent(i, true),
          ...(i === 0 ? [
            text({ id: 'bright', x: -190, y: 76, ax: 0, size: 24, color: 'inv/60', num: { pre: 'On · ', suf: '%' }, value: 40, k: { value: [[D0, D1, 85, PS]] } }),
            rect({ id: 'slider', x: SX, y: SY, w: 64, h: SH, r: 22, fill: 'inv/14', clip: true, k: enter(t + 0.3, { blur: 0, s: 0.9 }), ch: [
              rect({ id: 'sliderFill', y: SH / 2, pin: 'b', w: 64, h: fh(40), fill: 'inv', k: { h: [[D0, D1, fh(85), PS]] } }),
              icon({ icon: 'sun', y: 70, size: 26, sw: 2.4, color: 'ink' }),
            ] }),
          ] : []),
        ] })] })] : [];
      return rect({ id: 'tile' + i, x, y, w: TW, h: TH, r: 36, fill: 'soft', clip: true, k: k(enter(0.3 + i * 0.06, { blur: 0, dy: 16, y0: y }), on ? press(t, { to: 0.97 }) : null),
        ch: [...tileContent(i, false), ...lit] });
    });
    const tapAt = (i) => [TP[i][0] + TPX + 8, TP[i][1] + TPY + 10];
    const grab = (v) => [TP[0][0] + SX + 6, r1(TP[0][1] + SY + SH / 2 - fh(v) + 8)];
    return [
      rect({ id: 'card', w: 1020, h: 720, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Lights', x: -460, y: -296, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -460 }) }),
        roll({ id: 'onCount', x: -310, y: -254, w: 300, h: 34, ax: 0, size: 24, weight: 500, color: 'muted', vals: ['All lights off', '1 light on', '2 lights on'], ts: [TAP[1] + 0.1, TAP[0] + 0.1], k: enter(0.3) }),
        ...tiles,
      ] }),
      cursorLayer([[0, 540, 400], [0.5, 540, 400], [TAP[1] - 0.1, ...tapAt(1)], [TAP[1] + 0.15, ...tapAt(1)], [TAP[0] - 0.1, ...tapAt(0)], [TAP[0] + 0.15, ...tapAt(0)],
        [D0 - 0.12, ...grab(40)], [D0, ...grab(40)], [D1, ...grab(85), PS], [D1 + 0.2, ...grab(85)], [4.0, 200, 400]], [TAP[1], TAP[0]], [[D0, D1]], { inAt: 0.45 }),
    ];
  },
});

// 17 ─ NPS score: the cursor hovers along the 0–10 scale and picks 9, a follow-up field slides in and an answer types
UIK.define({
  id: 'nps-score', name: 'NPS score', cat: 'play', T: 4.8,
  cam: { zoom: 1.3, y: -140, k: { y: [[2.1, 2.9, 50, 'Power2 Smooth']], zoom: [[2.1, 2.9, 1.22, 'Power2 Smooth']] } },
  desc: 'A 0–10 recommendation scale. The cursor glides along the chips and each one greys under it as it passes, then clicks 9: an accent chip pops over it. The card grows downward (the camera follows), a follow-up question and a text field slide in and the answer types in behind a caret.',
  build: () => {
    const CX = (i) => (i - 5) * 92, CY = -118, S0 = 1.05, S1 = 1.85, C = 1.97, F = C + 0.33, TY0 = F + 0.75, TY1 = F + 1.85;
    const hov = (i) => {
      if (i < 2 || i > 9) return null;
      const tin = i === 2 ? S0 - 0.1 : cross(S0, S1, CX(2), CX(9), CX(i) - 46), tout = i === 9 ? null : cross(S0, S1, CX(2), CX(9), CX(i) + 46);
      const f = [[tin, tin + 0.05, 'dim', 'Power2 Out']];
      if (tout) f.push([Math.max(tout, tin + 0.06), Math.max(tout, tin + 0.06) + 0.16, 'soft', 'Power2 Out']);
      return { fill: f };
    };
    return [
      rect({ id: 'card', y: -300, pin: 't', origin: [0, 0], w: 1100, h: 320, r: 44, fill: 'card', shadow: 1, k: k(popIn(0.1, 0.7), { h: [[F, F + 0.6, 700, 'Power3 Out']] }) }),
      text({ id: 'question', text: 'How likely are you to recommend us?', y: -226, size: 44, weight: 600, ls: -0.02, k: enter(0.22) }),
      ...Array.from({ length: 11 }, (_, i) => rect({ id: 'chip' + i, x: CX(i), y: CY, w: 78, h: 78, r: 22, fill: 'soft',
        k: k(enter(0.3 + i * 0.03, { blur: 0, s: 0.7, dy: 10, y0: CY }), hov(i), i === 9 ? press(C, { to: 0.9 }) : null),
        ch: [text({ text: String(i), size: 30, weight: 600, tnum: false })] })),
      rect({ id: 'pick', x: CX(9), y: CY, w: 78, h: 78, r: 22, fill: 'acc', k: pop(C + 0.02, { from: 0.6, dur: 0.38 }), ch: [text({ text: '9', size: 30, weight: 600, color: '#FFFFFF', tnum: false })] }),
      text({ id: 'lo', text: 'Not likely', x: CX(0) - 39, y: -50, ax: 0, size: 22, color: 'muted', k: enter(0.5) }),
      text({ id: 'hi', text: 'Very likely', x: CX(10) + 39, y: -50, ax: 1, size: 22, color: 'muted', k: enter(0.54) }),
      text({ id: 'follow', text: 'What’s the main reason for your score?', x: -500, y: 64, ax: 0, size: 30, weight: 600, k: enter(F + 0.2, { dy: 18, y0: 64 }) }),
      group({ id: 'field', y: 196, k: enter(F + 0.28, { dy: 30, y0: 196 }), ch: [
        rect({ id: 'fieldBox', w: 1000, h: 170, r: 24, fill: 'panel', stroke: 'line', sw: 2 }),
        text({ id: 'answer', text: 'Setup took five minutes and support answered fast.', x: -468, y: -40, ax: 0, size: 28, weight: 500,
          caret: true, caretColor: 'ink', caretFrom: F + 0.55, k: { reveal: [0, [TY0, TY1, 1, 'Linear']] } }),
      ] }),
      rect({ id: 'send', x: 440, y: 338, w: 150, h: 72, r: 36, fill: 'ink', k: enter(F + 0.36, { blur: 0, dy: 20, y0: 338 }), ch: [text({ text: 'Send', size: 26, weight: 600, color: 'inv' })] }),
      cursorLayer([[0, 560, 180], [0.62, 560, 180], [S0, CX(2) + 8, CY + 14], [S1, CX(9) + 8, CY + 14], [C + 0.2, CX(9) + 8, CY + 14], [3.0, 640, 250]], [C], [], { inAt: 0.6 }),
    ];
  },
});
})();
