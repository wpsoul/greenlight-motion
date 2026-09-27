/* UI Motion Kit — data elements. */
(function () {
const { rect, circle, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// the main shape's pop-in (same as the exemplars)
const cardIn = (t = 0.08, s = 0.7) => ({ scale: [s, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// time u (0…1) at which a VE easing reaches progress p — used to key piecewise-linear tracks that follow one easing
const invEase = (name, p) => {
  const f = UIK.ease(name); let a = 0, b = 1;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < p) a = m; else b = m; }
  return (a + b) / 2;
};
const RING = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;

// 1 ─ Line chart: the line draws on, a dot rides the tip, the area fills behind it, a value chip lands
UIK.define({
  id: 'line-chart', name: 'Line chart', cat: 'data', T: 3.7, cam: 1.3,
  desc: 'Grid and axis labels settle in, then the line draws itself (Trim Paths) while a dot rides the tip and the area fills in behind it. At the last point the dot turns accent, a guide drops to the axis and a value chip pops.',
  build: () => {
    const V = [18, 22, 20, 27, 25, 31, 29, 36, 34, 41, 39, 48], X0 = -380, DX = 76, BASE = 200, SC = 340 / 60;
    const P = V.map((v, i) => [X0 + i * DX, +(BASE - v * SC).toFixed(1)]);
    const N = P.length, LAST = P[N - 1], D0 = 0.72, DUR = 1.7;
    // arc length at each vertex → the time the tip reaches it on a Power2 Smooth draw; every track below is
    // keyed at those times with Linear segments, so trim, dot and area reveal stay locked together
    const cum = [0];
    for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const LEN = cum[N - 1];
    const TI = cum.map((c) => +(D0 + DUR * invEase('Power2 Smooth', c / LEN)).toFixed(4));
    const seg = (fn) => P.slice(1).map((p, j) => [TI[j], TI[j + 1], fn(p, j + 1), 'Linear']);
    const E = TI[N - 1];
    const d = 'M' + P.map((p) => p.join(' ')).join(' L');
    const area = d + ` L${LAST[0]} ${BASE} L${X0} ${BASE} Z`;
    const CY = 25, CH = 350;   // area clip window: y -150 … 200
    const GY = [0, 1, 2, 3].map((i) => BASE - i * 340 / 3);
    return [
      rect({ id: 'card', w: 1080, h: 640, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Revenue', x: -470, y: -250, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'sub', text: 'Monthly, in USD', x: -470, y: -206, ax: 0, size: 26, color: 'muted', k: enter(0.33) }),
          rect({ id: 'range', x: 400, y: -236, w: 180, h: 56, r: 28, fill: 'soft', k: enter(0.36), ch: [
            text({ text: 'This year', x: -20, size: 24, weight: 500 }),
            icon({ icon: 'chevronDown', x: 56, size: 22, sw: 2.4, color: 'muted' }),
          ] }),
          ...GY.map((y, i) => rect({ id: 'grid' + i, x: 25, y, w: 890, h: 2, fill: i ? 'line' : 'dim', k: enter(0.3 + i * 0.05, { blur: 0, s: 1 }) })),
          ...['0', '20k', '40k', '60k'].map((s, i) => text({ id: 'yl' + i, text: s, x: -470, y: GY[i], ax: 0, size: 22, color: 'muted', k: enter(0.34 + i * 0.05) })),
          ...['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((s, i) => text({ id: 'xl' + i, text: s, x: P[i * 2][0], y: BASE + 40, size: 22, color: 'muted', k: enter(0.42 + i * 0.04) })),
          // area: a clip window pinned left grows with the tip; the child moves back by w/2 so it stays put
          rect({ id: 'areaClip', x: X0, y: CY, pin: 'l', w: 0, h: CH, clip: true, k: { w: [0, ...seg((p) => p[0] - X0)] }, ch: [
            path({ id: 'area', d: area, fill: 'ink/6', stroke: 'ink/0', y: -CY, x: -X0, k: { x: [-X0, ...seg((p) => -(X0 + (p[0] - X0) / 2))] } }),
          ] }),
          rect({ id: 'guide', x: LAST[0], y: BASE, pin: 'b', w: 2, h: 0, fill: 'ink/25', k: { h: [[E + 0.05, E + 0.45, BASE - LAST[1], 'Power3 Out']] } }),
          path({ id: 'line', d, stroke: 'ink', sw: 5, trimmed: true, k: { trimE: [0, ...seg((p, i) => +(cum[i] / LEN * 100).toFixed(3))] } }),
          circle({ id: 'tip', x: P[0][0], y: P[0][1], d: 28, fill: 'ink', stroke: 'card', sw: 6,
            k: { x: [P[0][0], ...seg((p) => p[0])], y: [P[0][1], ...seg((p) => p[1])],
                 scale: [0, [0.55, 0.9, 1, 'Back Out'], [E, E + 0.15, 1.35, 'Power2 Out'], [E + 0.15, E + 0.5, 1, 'Power3 Out']],
                 opacity: [0, [0.55, 0.65, 1, 'Linear']], fill: [[E, E + 0.2, 'acc', 'Power2 Out']] } }),
          rect({ id: 'chip', x: LAST[0] - 30, y: LAST[1] - 30, pin: 'b', w: 148, h: 60, r: 18, fill: 'ink', k: pop(E + 0.15, { from: 0.5 }),
            ch: [text({ text: '$48.2k', size: 28, weight: 600, color: 'inv' })] }),
        ] }),
    ];
  },
});

// 2 ─ Donut chart: three arcs draw one after another, the centre total counts up, legend rows follow
UIK.define({
  id: 'donut-chart', name: 'Donut chart', cat: 'data', T: 2.9, cam: 1.25,
  desc: 'A faint ring settles, then three arcs draw one after another around it (Trim Paths, butt caps, 1 % gaps) while the centre total counts up and each legend row slides in as its arc starts.',
  build: () => {
    const R = 150, CX = -250, CY = 40;
    const S = [{ n: 'Search', p: 45, c: 'ink', a: 0.55, d: 0.62 }, { n: 'Social', p: 30, c: 'acc', a: 1.08, d: 0.5 }, { n: 'Direct', p: 25, c: 'dim', a: 1.5, d: 0.48 }];
    let run = 0;
    for (const s of S) { s.s = run + 0.5; s.e = run + s.p - 0.5; run += s.p; }
    return [
      rect({ id: 'card', w: 1100, h: 600, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Traffic sources', x: -490, y: -226, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'sub', text: 'This month', x: -490, y: -182, ax: 0, size: 26, color: 'muted', k: enter(0.33) }),
          path({ id: 'track', x: CX, y: CY, d: RING(R), stroke: 'soft', sw: 44, k: enter(0.3, { blur: 0 }) }),
          ...S.map((s, i) => path({ id: 'arc' + i, x: CX, y: CY, d: RING(R), stroke: s.c, sw: 44, cap: 'butt', trimmed: true, trimS: s.s,
            k: { trimE: [s.s, [s.a, s.a + s.d, s.e, 'Power3 Out']] } })),
          text({ id: 'total', x: CX, y: CY - 16, size: 60, weight: 600, ls: -0.02, num: {}, k: k(enter(0.4), { value: [[0.55, 2.0, 8412, 'Power3 Out']] }) }),
          text({ id: 'totalLbl', text: 'visits', x: CX, y: CY + 36, size: 26, color: 'muted', k: enter(0.46) }),
          ...[0, 1].map((i) => rect({ id: 'rule' + i, x: 255, y: -5 + i * 90, w: 430, h: 2, fill: 'line', k: enter(S[i + 1].a, { blur: 0, s: 1 }) })),
          ...S.map((s, i) => group({ id: 'row' + i, x: 40, y: -50 + i * 90, k: enter(s.a, { dx: -18, x0: 40 }), ch: [
            circle({ x: 10, d: 20, fill: s.c }),
            text({ text: s.n, x: 38, ax: 0, size: 32, weight: 500 }),
            text({ text: s.p + '%', x: 430, ax: 1, size: 32, weight: 600 }),
          ] })),
        ] }),
    ];
  },
});

// 3 ─ KPI card: the number counts up, a delta chip slides in, a sparkline draws underneath
UIK.define({
  id: 'kpi-card', name: 'KPI card', cat: 'data', T: 3.2, cam: 1.6,
  desc: 'The headline number counts up with Power3 Out, a +12 % delta chip slides in beside it once it lands, and a sparkline draws on underneath, ending on an accent dot.',
  build: () => {
    const V = [22, 30, 26, 38, 34, 44, 40, 52, 47, 58, 55, 66, 62, 74], X0 = -376, DX = 752 / 13;
    const P = V.map((v, i) => [+(X0 + i * DX).toFixed(1), +(196 - v * 1.25).toFixed(1)]), L = P[P.length - 1];
    return [
      rect({ id: 'card', w: 840, h: 480, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          rect({ id: 'tile', x: -340, y: -160, w: 72, h: 72, r: 20, fill: 'soft', k: enter(0.22, { blur: 0, s: 0.7 }), ch: [icon({ icon: 'coin', size: 38, sw: 2.4, color: 'ink' })] }),
          text({ id: 'label', text: 'Monthly revenue', x: -288, y: -160, ax: 0, size: 30, weight: 500, k: enter(0.28, { dx: -14, x0: -288 }) }),
          text({ id: 'period', text: 'September', x: 376, y: -160, ax: 1, size: 24, color: 'muted', k: enter(0.34) }),
          text({ id: 'value', x: -380, y: -52, ax: 0, size: 104, weight: 600, ls: -0.035, num: { pre: '$' }, k: k(enter(0.34), { value: [[0.42, 1.7, 84320, 'Power3 Out']] }) }),
          rect({ id: 'delta', x: 124, y: -46, w: 140, h: 54, r: 27, fill: 'acc/12', k: enter(1.5, { dx: -22, x0: 124 }), ch: [
            icon({ icon: 'arrowUp', x: -34, size: 24, sw: 2.8, color: 'acc' }),
            text({ text: '+12%', x: 12, size: 26, weight: 600, color: 'acc' }),
          ] }),
          text({ id: 'caption', text: 'vs $75,280 last month', x: -376, y: 30, ax: 0, size: 26, color: 'muted', k: enter(0.5) }),
          path({ id: 'spark', d: 'M' + P.map((p) => p.join(' ')).join(' L'), stroke: 'ink', sw: 5, trimmed: true, k: { trimE: [0, [0.8, 2.05, 100, 'Power2 Smooth']] } }),
          circle({ id: 'sparkEnd', x: L[0], y: L[1], d: 22, fill: 'acc', stroke: 'card', sw: 5, k: pop(2.0) }),
        ] }),
    ];
  },
});

// 4 ─ Race lanes: four fills run at their own pace; each status swaps queued → % → done
UIK.define({
  id: 'race-bars', name: 'Race lanes', cat: 'data', T: 4.0, cam: 1.3,
  desc: 'Four lanes fill at their own uneven pace (two Linear legs each). Each status swaps from Queued to a live percentage to a Done check, the finishing lane name flashes accent and the live counter ticks up.',
  build: () => {
    const TW = 620;
    const L = [
      { n: 'Europe', s: 0.6, m: [1.12, 58], e: 1.8 },
      { n: 'US East', s: 0.78, m: [1.9, 64], e: 2.78 },
      { n: 'US West', s: 1.02, m: [2.25, 55], e: 3.22 },
      { n: 'Asia', s: 0.9, m: [1.55, 71], e: 2.3 },
    ];
    const done = L.map((l) => l.e).sort((a, b) => a - b);
    return [
      rect({ id: 'card', w: 1100, h: 560, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Deploying v2.4', x: -480, y: -200, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'sub', text: 'Rolling out to every region', x: -480, y: -156, ax: 0, size: 26, color: 'muted', k: enter(0.33) }),
          text({ id: 'live', x: 480, y: -200, ax: 1, size: 40, weight: 600, ls: -0.02, num: { suf: '/4' },
            k: k(enter(0.3), { value: [0, ...done.map((t, i) => [t, i + 1])] }) }),
          text({ id: 'liveLbl', text: 'regions live', x: 480, y: -156, ax: 1, size: 26, color: 'muted', k: enter(0.38) }),
          ...L.map((l, i) => {
            const y = -70 + i * 90, e = l.e, a = 0.36 + i * 0.07;
            return group({ id: 'lane' + i, y, k: enter(a, { dx: -18, x0: 0 }), ch: [
              text({ id: 'name' + i, text: l.n, x: -480, ax: 0, size: 30, weight: 500,
                k: { color: [[e, e + 0.12, 'acc', 'Power2 Out'], [e + 0.42, e + 0.72, 'ink', 'Power2 Out']] } }),
              rect({ id: 'track' + i, x: -20, w: TW, h: 16, r: 8, fill: 'skel', ch: [
                rect({ id: 'fill' + i, x: -TW / 2, pin: 'l', w: 0, h: 16, r: 8, fill: 'ink',
                  k: { w: [[l.s, l.m[0], TW * l.m[1] / 100, 'Linear'], [l.m[0], e, TW, 'Linear']] } }),
              ] }),
              text({ id: 'queued' + i, text: 'Queued', x: 480, ax: 1, size: 26, color: 'muted', k: exit(l.s - 0.02) }),
              text({ id: 'pct' + i, x: 480, ax: 1, size: 28, weight: 600, num: { suf: '%', floor: true },
                k: k(enter(l.s, { d: 0.05, dur: 0.2 }), { value: [[l.s, l.m[0], l.m[1], 'Linear'], [l.m[0], e, 100, 'Linear']] }, exit(e + 0.02)) }),
              icon({ id: 'check' + i, icon: 'check', x: 386, size: 28, sw: 3, color: 'ink', k: pop(e + 0.06) }),
              text({ id: 'done' + i, text: 'Done', x: 480, ax: 1, size: 28, weight: 600, k: enter(e + 0.02, { d: 0.04 }) }),
            ] });
          }),
        ] }),
    ];
  },
});

// 5 ─ Versus: two halves count up side by side, a vs badge pops, the winner takes the accent
UIK.define({
  id: 'vs-compare', name: 'Versus', cat: 'data', T: 3.4, cam: 1.25,
  desc: 'Before and After cards pop in, their scores count up while the bars fill, a vs badge pops between them, then the winner lifts slightly, its bar turns accent and a Winner chip lands while the other side greys out.',
  build: () => {
    const W = 2.05, TW = 420;
    const side = (id, X, label, val, win, t0) => rect({ id, x: X, w: 540, h: 440, r: 40, fill: 'card', shadow: 1,
      k: k(cardIn(t0), win ? { scale: [[W, W + 0.5, 1.03, 'Power3 Out']] } : null),
      ch: [
        text({ id: id + 'Lbl', text: label, x: -210, y: -150, ax: 0, size: 30, weight: 500, color: 'muted', k: enter(t0 + 0.2) }),
        text({ id: id + 'Num', x: -216, y: -32, ax: 0, size: 136, weight: 600, ls: -0.04, num: {},
          k: k(enter(t0 + 0.24), { value: [[0.55, 1.6, val, 'Power3 Out']] }, win ? null : { color: [[W, W + 0.3, 'muted', 'Power2 Out']] }) }),
        text({ id: id + 'Cap', text: 'Performance score', x: -210, y: 64, ax: 0, size: 26, color: 'muted', k: enter(t0 + 0.3) }),
        rect({ id: id + 'Track', y: 146, w: TW, h: 20, r: 10, fill: 'skel', k: enter(t0 + 0.3, { blur: 0, s: 1 }), ch: [
          rect({ id: id + 'Bar', x: -TW / 2, pin: 'l', w: 0, h: 20, r: 10, fill: 'ink',
            k: { w: [[0.55, 1.6, TW * val / 100, 'Power3 Out']], fill: [[W, W + 0.3, win ? 'acc' : 'muted', 'Power2 Out']] } }),
        ] }),
        win ? rect({ id: 'winner', x: 152, y: -150, w: 140, h: 52, r: 26, fill: 'acc', k: pop(W + 0.12, { from: 0.4 }),
          ch: [text({ text: 'Winner', size: 24, weight: 600, color: '#FFFFFF' })] }) : null,
      ].filter(Boolean) });
    return [
      side('before', -300, 'Before', 62, false, 0.08),
      side('after', 300, 'After', 97, true, 0.16),
      circle({ id: 'vs', d: 124, fill: 'ink', shadow: 2, k: pop(1.55, { from: 0.3, dur: 0.45 }),
        ch: [text({ text: 'vs', y: -3, size: 42, weight: 600, color: 'inv' })] }),
    ];
  },
});

// 6 ─ Distribution bar: one rounded bar, four segments grow in sequence; the legend lights up as each lands
UIK.define({
  id: 'stacked-bar', name: 'Distribution bar', cat: 'data', T: 3.2, cam: 1.12,
  desc: 'Inside one rounded clip, four segments grow from the left in sequence (Power4 Out), each % label rises in above it, and the matching legend item lights up — dot pulses to its colour, name darkens — as its segment lands.',
  build: () => {
    const BW = 1120, BH = 72, X0 = -BW / 2, BY = 60, GAP = 6;
    const S = [{ n: 'Mobile', p: 40, c: 'acc' }, { n: 'Desktop', p: 25, c: 'ink' }, { n: 'Tablet', p: 20, c: 'ink/55' }, { n: 'Other', p: 15, c: 'ink/25' }];
    let run = 0;
    S.forEach((s, i) => { s.x = X0 + run * BW / 100; s.w = s.p * BW / 100 - (i < S.length - 1 ? GAP : 0); s.t = 0.55 + i * 0.38; s.l = s.t + 0.32; run += s.p; });
    return [
      rect({ id: 'card', w: 1260, h: 440, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Traffic by device', x: X0, y: -150, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'sub', text: 'Sessions this week', x: X0, y: -106, ax: 0, size: 26, color: 'muted', k: enter(0.33) }),
          text({ id: 'total', text: '48,210', x: -X0, y: -150, ax: 1, size: 40, weight: 600, ls: -0.02, tnum: false, k: enter(0.3) }),
          text({ id: 'totalLbl', text: 'sessions', x: -X0, y: -106, ax: 1, size: 26, color: 'muted', k: enter(0.38) }),
          rect({ id: 'bar', y: BY, w: BW, h: BH, r: BH / 2, fill: 'skel', clip: true, k: enter(0.34, { blur: 0, s: 1 }),
            ch: S.map((s, i) => rect({ id: 'seg' + i, x: s.x, pin: 'l', w: 0, h: BH, fill: s.c, k: { w: [[s.t, s.t + 0.6, s.w, 'Power4 Out']] } })) }),
          ...S.map((s, i) => text({ id: 'pct' + i, text: s.p + '%', x: s.x + 2, y: -8, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(s.t + 0.14, { dy: 14, y0: -8 }) })),
          ...S.map((s, i) => group({ id: 'legend' + i, x: s.x, y: 152, k: enter(0.42 + i * 0.06), ch: [
            circle({ id: 'ldot' + i, x: 9, d: 18, fill: 'dim',
              k: { fill: [[s.l, s.l + 0.2, s.c, 'Power2 Out']], scale: [[s.l, s.l + 0.12, 1.45, 'Power2 Out'], [s.l + 0.12, s.l + 0.45, 1, 'Power3 Out']] } }),
            text({ id: 'lname' + i, text: s.n, x: 30, ax: 0, size: 28, weight: 500, color: 'muted', k: { color: [[s.l, s.l + 0.25, 'ink', 'Power2 Out']] } }),
          ] })),
        ] }),
    ];
  },
});

// 7 ─ Countdown: seconds roll down 10 → 7, the ring depletes linearly, the label changes
UIK.define({
  id: 'countdown', name: 'Countdown', cat: 'data', T: 4.5, cam: 1.3,
  desc: 'A timer disc pops in and its accent ring draws on, then the seconds roll down one per second (10 → 9 → 8 → 7 — one TIMER placeholder, Roll style, keyed) while the ring depletes linearly; the label swaps to “Starting soon”.',
  build: () => {
    const SZ = 136, S0 = 0.6, TK = [1.6, 2.6, 3.6], R = 272;
    return [
      circle({ id: 'disc', d: 640, fill: 'card', shadow: 1, k: cardIn(0.08, 0.6),
        ch: [
          path({ id: 'track', d: RING(R), stroke: 'skel', sw: 12, k: enter(0.2, { blur: 0, s: 1 }) }),
          path({ id: 'ring', d: RING(R), stroke: 'acc', sw: 12, trimmed: true, k: { trimE: [0, [0.25, S0, 100, 'Power3 Out'], [S0, TK[2], 70, 'Linear']] } }),
          text({ id: 'lblA', text: 'Starts in', y: -126, size: 32, weight: 500, color: 'muted', k: k(enter(0.3), exit(TK[1] - 0.02)) }),
          text({ id: 'lblB', text: 'Starting soon', y: -126, size: 32, weight: 500, k: enter(TK[1]) }),
          // ONE text: a TIMER placeholder in Roll style, keyed by 'ph:1' — a Power4 Out tick each second
          text({ id: 'digits', text: '{{{TIMER:00:10-00:07; style=roll; kf=1}}}', y: 4, size: SZ, weight: 600,
            k: k(enter(0.34, { s: 0.9 }), { 'ph:1': [0, ...TK.map((t, i) => [t, t + 0.45, +((100 * (i + 1)) / 3).toFixed(3), 'Power4 Out'])] }) }),
          text({ id: 'event', text: 'Live product launch', y: 130, size: 28, color: 'muted', k: enter(0.42) }),
        ] }),
    ];
  },
});

// 8 ─ Odometer: every digit column rolls up from 0 at its own speed, the rightmost fastest
UIK.define({
  id: 'odometer', name: 'Odometer', cat: 'data', T: 3.2, cam: 1.35,
  desc: 'The number is ONE text layer with a COUNTER placeholder in Odometer style: every digit column of 2,480 rolls up from 0, the left digit lands first, the right one spins three full turns and lands last; the comma stays put and a caption fades in.',
  build: () => [
    rect({ id: 'card', w: 1000, h: 520, r: 48, fill: 'card', shadow: 1, k: cardIn(),
      ch: [
        text({ id: 'label', text: 'Orders shipped', y: -170, size: 34, weight: 500, color: 'muted', k: enter(0.25) }),
        text({ id: 'number', text: '{{{COUNTER:0-2,480; start=0.45}}}', size: 200, weight: 600, ls: -0.02, k: enter(0.3, { s: 0.94 }) }),
        group({ id: 'caption', y: 172, k: enter(2.2, { dy: 12, y0: 172 }), ch: [
          circle({ x: -166, d: 14, fill: 'acc' }),
          text({ text: 'Live · updated just now', x: -146, ax: 0, size: 28, color: 'muted' }),
        ] }),
      ] }),
  ],
});

// 9 ─ Activity grid: a diagonal wave fills 7×12 cells with four levels; the cursor hovers the peak day
UIK.define({
  id: 'heat-grid', formats: ['html'], name: 'Activity grid', cat: 'data', T: 3.5, cam: 1.12,
  desc: 'A skeleton grid of 84 cells fills in a diagonal wave — each cell dips and pops as it takes one of four intensity levels, two peak days in accent — then the cursor hovers a peak cell: a ring pops round it and a tooltip lands.',
  build: () => {
    const PITCH = 68, CS = 56, COLS = 12, ROWS = 7, X0 = -334, Y0 = -184;
    const LV = ['skel', 'ink/40', 'ink/70', 'ink'];
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const HR = 2, HC = 8, ACC = [[2, 8], [4, 10]];
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const base = 0.25 + c * 0.12 + rnd() * 1.9 - (r === 0 || r === 6 ? 1.1 : 0);
      const lv = Math.max(0, Math.min(3, Math.floor(base)));
      const acc = ACC.some(([ar, ac]) => ar === r && ac === c);
      const t = 0.48 + (r + c) * 0.05;
      cells.push(rect({ id: `c${r}_${c}`, x: X0 + c * PITCH, y: Y0 + r * PITCH, w: CS, h: CS, r: 14, fill: 'skel',
        k: { fill: [[t, t + 0.22, acc ? 'acc' : LV[lv], 'Power2 Out']], scale: [[t, t + 0.1, 0.78, 'Power2 Out'], [t + 0.1, t + 0.45, 1, 'Back Out']] } }));
    }
    const HX = X0 + HC * PITCH, HY = Y0 + HR * PITCH, HOV = 2.12;
    return [
      rect({ id: 'card', w: 1040, h: 740, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Activity', x: -466, y: -300, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'total', x: 442, y: -300, ax: 1, size: 28, color: 'muted', num: { suf: ' sessions' }, k: k(enter(0.3), { value: [[0.5, 1.6, 1284, 'Power3 Out']] }) }),
          ...['Jan', 'Feb', 'Mar'].map((s, i) => text({ id: 'mon' + i, text: s, x: X0 - CS / 2 + i * 4 * PITCH, y: Y0 - 58, ax: 0, size: 22, color: 'muted', k: enter(0.34 + i * 0.05) })),
          ...['Mon', 'Wed', 'Fri'].map((s, i) => text({ id: 'wd' + i, text: s, x: -466, y: Y0 + (1 + i * 2) * PITCH, ax: 0, size: 22, color: 'muted', k: enter(0.36 + i * 0.05) })),
          group({ id: 'grid', k: enter(0.22, { blur: 0, s: 0.97 }), ch: cells }),
          group({ id: 'legend', x: 442, y: 300, k: enter(0.5), ch: [
            text({ text: 'Less', x: -180, ax: 1, size: 22, color: 'muted' }),
            ...LV.map((c, i) => rect({ x: -69 - (3 - i) * 30, w: 22, h: 22, r: 6, fill: c })),
            text({ text: 'More', ax: 1, size: 22, color: 'muted' }),
          ] }),
          rect({ id: 'hoverRing', x: HX, y: HY, w: CS + 14, h: CS + 14, r: 19, stroke: 'ink', sw: 3, k: pop(HOV, { from: 0.8, dur: 0.35 }) }),
          rect({ id: 'tooltip', x: HX, y: HY - CS / 2 - 22, pin: 'b', w: 250, h: 92, r: 18, fill: 'ink', k: pop(HOV + 0.08, { from: 0.5 }), ch: [
            rect({ id: 'nub', y: 46, w: 18, h: 18, r: 3, rot: 45, fill: 'ink' }),
            text({ text: '24 sessions', y: -14, size: 28, weight: 600, color: 'inv' }),
            text({ text: 'Thursday, Mar 14', y: 20, size: 22, color: 'inv/60' }),
          ] }),
        ] }),
      cursorLayer([[0, 560, 420], [1.45, 560, 420], [2.02, HX + 6, HY + 8], [3.5, HX + 10, HY + 12]], [], [], { inAt: 1.4 }),
    ];
  },
});

// 10 ─ Gauge: the accent arc fills while the needle swings to the value and settles
UIK.define({
  id: 'gauge', name: 'Gauge', cat: 'data', T: 3.0, cam: 1.38,
  desc: 'A semicircle track and ticks settle in, then the needle swings from Low to the value — a few degrees past it and back — while the accent arc fills in lockstep (Trim Paths) and the score counts up.',
  build: () => {
    const R = 290, GY = 60, S0 = 0.8, S1 = 1.62, S2 = 2.1, OVER = 76, VAL = 72;
    const ARC = `M-${R} 0 A${R} ${R} 0 0 1 ${R} 0`, ang = (p) => -90 + p * 1.8;
    return [
      rect({ id: 'card', w: 860, h: 620, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          path({ id: 'track', y: GY, d: ARC, stroke: 'skel', sw: 34, k: enter(0.22, { blur: 0, s: 1 }) }),
          path({ id: 'arc', y: GY, d: ARC, stroke: 'acc', sw: 34, trimmed: true,
            k: { trimE: [0, [S0, S1, OVER, 'Power3 Out'], [S1, S2, VAL, 'Power2 Smooth']] } }),
          ...Array.from({ length: 11 }, (_, i) => {
            const a = Math.PI * (1 - i / 10), rr = 238;
            return rect({ id: 'tick' + i, x: +(rr * Math.cos(a)).toFixed(1), y: +(GY - rr * Math.sin(a)).toFixed(1), w: 4, h: i % 5 ? 12 : 22, r: 2, rot: ang(i * 10), fill: i % 5 ? 'dim' : 'muted',
              k: enter(0.3 + i * 0.03, { blur: 0, s: 0.5 }) });
          }),
          rect({ id: 'needle', y: GY, pin: 'b', w: 14, h: 214, r: 7, fill: 'ink',
            k: k({ rot: [ang(0), [S0, S1, ang(OVER), 'Power3 Out'], [S1, S2, ang(VAL), 'Power2 Smooth']] }, pop(0.42, { from: 0.4 })) }),
          circle({ id: 'hub', y: GY, d: 48, fill: 'ink', k: pop(0.38), ch: [circle({ d: 16, fill: 'card' })] }),
          text({ id: 'low', text: 'Low', x: -R, y: GY + 52, size: 26, color: 'muted', k: enter(0.34) }),
          text({ id: 'high', text: 'High', x: R, y: GY + 52, size: 26, color: 'muted', k: enter(0.4) }),
          text({ id: 'value', y: GY + 116, size: 100, weight: 600, ls: -0.03, num: {}, k: k(enter(0.45), { value: [[S0, S2, VAL, 'Power3 Out']] }) }),
          text({ id: 'valueLbl', text: 'Health score', y: GY + 184, size: 28, color: 'muted', k: enter(0.52) }),
        ] }),
    ];
  },
});

// 11 ─ Leaderboard: a lower row's score counts up, it glides past two rows and takes rank 2
UIK.define({
  id: 'leaderboard', name: 'Leaderboard', cat: 'data', T: 3.6, cam: 1.22,
  desc: 'Five ranked rows slide in. Row four counts its score up, lifts onto a floating card and glides past two rows while they shift down in sync, then lands on rank 2: an accent rank badge pops and a +2 chip appears.',
  build: () => {
    const SY = (s) => -170 + s * 96, C0 = 1.0, C1 = 1.72, G0 = 1.78, G1 = 2.42;
    const P = [
      { n: 'Maya Chen', i: 'MC', s: 2940 }, { n: 'Leo Park', i: 'LP', s: 2810 }, { n: 'Ava Brooks', i: 'AB', s: 2655 },
      { n: 'Sam Rivera', i: 'SR', s: 2420, to: 2860 }, { n: 'Noah Kim', i: 'NK', s: 2180 },
    ];
    const moveTo = { 1: 2, 2: 3, 3: 1 };
    const rowY = (idx) => moveTo[idx] != null ? { y: [[G0, G1, SY(moveTo[idx]), 'Power4 Out']] } : null;
    const row = (p, idx) => {
      const climb = idx === 3, a = 0.34 + idx * 0.08;
      const ent = enter(a, { dx: -18, x0: 0 });
      return group({ id: 'row' + idx, k: k(ent, rowY(idx), climb ? { scale: [[G0 - 0.08, G0 + 0.14, 1.03, 'Power2 Out'], [G1, G1 + 0.35, 1, 'Power3 Out']] } : null), y: SY(idx), ch: [
        climb ? rect({ id: 'lift', w: 860, h: 84, r: 22, fill: 'card', shadow: 2, k: { opacity: [0, [G0 - 0.08, G0 + 0.06, 1, 'Power2 Out'], [G1 + 0.12, G1 + 0.45, 0, 'Power2 Out']] } }) : null,
        circle({ id: 'av' + idx, x: -300, d: 60, fill: 'soft', ch: [text({ text: p.i, size: 22, weight: 600 })] }),
        text({ id: 'name' + idx, text: p.n, x: -252, ax: 0, size: 32, weight: 500 }),
        climb ? rect({ id: 'up', x: -10, w: 72, h: 40, r: 20, fill: 'soft', k: pop(G1 + 0.14, { from: 0.4 }), ch: [
          icon({ icon: 'arrowUp', x: -14, size: 20, sw: 2.8, color: 'acc' }),
          text({ text: '2', x: 12, size: 22, weight: 600 }),
        ] }) : null,
        text({ id: 'score' + idx, x: 400, ax: 1, size: 32, weight: 600, num: {}, value: p.s,
          k: climb ? { value: [[C0, C1, p.to, 'Power3 Out']] } : undefined }),
      ].filter(Boolean) });
    };
    return [
      rect({ id: 'card', w: 900, h: 660, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Leaderboard', x: -400, y: -262, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'period', text: 'This week', x: 400, y: -262, ax: 1, size: 26, color: 'muted', k: enter(0.32) }),
          ...[0, 1, 2, 3].map((s) => rect({ id: 'rule' + s, y: SY(s) + 48, w: 800, h: 2, fill: 'line', k: enter(0.4 + s * 0.08, { blur: 0, s: 1 }) })),
          ...[0, 1, 2, 3, 4].map((s) => text({ id: 'rank' + s, text: String(s + 1), x: -380, y: SY(s), size: 30, weight: 600, color: 'muted', tnum: false,
            k: k(enter(0.34 + s * 0.08), s === 1 ? exit(G1 + 0.02) : null) })),
          ...[0, 1, 2, 4, 3].map((idx) => row(P[idx], idx)),
          circle({ id: 'badge', x: -380, y: SY(1), d: 50, fill: 'acc', k: pop(G1 + 0.02), ch: [text({ text: '2', size: 26, weight: 600, color: '#FFFFFF' })] }),
        ] }),
    ];
  },
});

// 12 ─ Pricing toggle: the cursor picks Yearly, the indicator slides, the price rolls $24 → $19
UIK.define({
  id: 'pricing-toggle', name: 'Pricing toggle', cat: 'data', T: 3.4, cam: { zoom: 1.2, y: 20 },
  desc: 'The cursor clicks Yearly: the indicator stretches across and settles (labels invert over it via the difference blend), the price digits roll down from $24 to $19 one after the other, the billing line swaps and a Save 20 % chip pops.',
  build: () => {
    const C = 1.2, SZ = 128;
    return [
      rect({ id: 'switch', y: -300, w: 440, h: 88, r: 44, fill: 'card', shadow: 1, k: k(cardIn(0.08, 0.6), press(C, { to: 0.97 })), ch: [
        rect({ id: 'indicator', x: -108, w: 208, h: 72, r: 36, fill: 'ink',
          k: { x: [[C, C + 0.5, 108, 'Power4 Out']], w: [[C, C + 0.16, 300, 'Power2 Out'], [C + 0.16, C + 0.56, 208, 'Power3 Out']] } }),
        // difference blend: the labels invert exactly where the indicator passes under them
        text({ id: 'monthly', text: 'Monthly', x: -108, size: 30, weight: 500, color: '#FFFFFF', blend: 'difference', k: enter(0.22) }),
        text({ id: 'yearly', text: 'Yearly', x: 108, size: 30, weight: 500, color: '#FFFFFF', blend: 'difference', k: enter(0.26) }),
      ] }),
      rect({ id: 'plan', y: 110, w: 640, h: 560, r: 44, fill: 'card', shadow: 1, k: cardIn(0.16), ch: [
        text({ id: 'name', text: 'Pro', x: -262, y: -216, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.34) }),
        rect({ id: 'save', x: 196, y: -216, w: 156, h: 50, r: 25, fill: 'acc', k: pop(C + 0.42, { from: 0.4 }), ch: [text({ text: 'Save 20%', size: 24, weight: 600, color: '#FFFFFF' })] }),
        text({ id: 'desc', text: 'For growing teams', x: -262, y: -168, ax: 0, size: 28, color: 'muted', k: enter(0.4) }),
        group({ id: 'price', y: -62, k: enter(0.44), ch: [
          text({ id: 'cur', text: '$', x: -262, y: -22, ax: 0, size: 60, weight: 600 }),
          // a COUNTER placeholder (Odometer): each digit rolls from its old value to its new one, left first
          text({ id: 'amount', text: `{{{COUNTER:24-19; start=${C + 0.1}; duration=0.57; easing=power4_out; turns=0; cascade=12}}}`, x: -226, ax: 0, size: SZ, weight: 600 }),
          text({ id: 'per', text: '/mo', x: -74, y: 30, ax: 0, size: 32, color: 'muted' }),
        ] }),
        text({ id: 'billA', text: 'Billed monthly', x: -262, y: 20, ax: 0, size: 26, color: 'muted', k: k(enter(0.48), exit(C + 0.16)) }),
        text({ id: 'billB', text: 'Billed yearly · $228', x: -262, y: 20, ax: 0, size: 26, color: 'muted', k: enter(C + 0.16) }),
        rect({ id: 'divider', y: 72, w: 540, h: 2, fill: 'line', k: enter(0.5, { blur: 0, s: 1 }) }),
        ...['Unlimited projects', 'Priority support', 'Advanced analytics'].map((s, i) => group({ id: 'feat' + i, y: 124 + i * 54, k: enter(0.52 + i * 0.07, { dx: -16, x0: 0 }), ch: [
          icon({ icon: 'check', x: -248, size: 28, sw: 2.6, color: 'ink' }),
          text({ text: s, x: -216, ax: 0, size: 28 }),
        ] })),
      ] }),
      cursorLayer([[0, 520, 400], [0.5, 520, 400], [1.1, 116, -290], [1.75, 116, -290], [2.5, 440, -120]], [C], [], { inAt: 0.42 }),
    ];
  },
});

// 13 ─ Funnel: centred bars narrow stage by stage, trapezoids join them, conversion chips follow
UIK.define({
  id: 'funnel', name: 'Funnel', cat: 'data', T: 3.3, cam: 1.15,
  desc: 'Four centred bars grow out from the middle on a stagger, each narrower than the last; faint trapezoids join them into a funnel, step-conversion chips pop between the stages and the overall rate counts up.',
  build: () => {
    const MW = 760, BX = 60, BH = 76, Y = (i) => -140 + i * 128;
    const S = [{ n: 'Visited', v: 12400 }, { n: 'Signed up', v: 8930 }, { n: 'Activated', v: 5710 }, { n: 'Purchased', v: 3220 }];
    S.forEach((s, i) => { s.w = Math.round(MW * s.v / S[0].v); s.t = 0.45 + i * 0.22; });
    const fmt = (v) => v.toLocaleString('en-US');
    return [
      rect({ id: 'card', w: 1240, h: 700, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Conversion funnel', x: -560, y: -280, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25) }),
          text({ id: 'sub', text: 'Last 30 days', x: -560, y: -236, ax: 0, size: 26, color: 'muted', k: enter(0.33) }),
          text({ id: 'overall', x: 560, y: -280, ax: 1, size: 40, weight: 600, ls: -0.02, num: { suf: '%' }, k: k(enter(1.7), { value: [[1.7, 2.4, 26, 'Power3 Out']] }) }),
          text({ id: 'overallLbl', text: 'overall', x: 560, y: -236, ax: 1, size: 26, color: 'muted', k: enter(1.76) }),
          // trapezoids between consecutive bars
          ...S.slice(0, -1).map((s, i) => {
            const n = S[i + 1], y0 = Y(i) + BH / 2, y1 = Y(i + 1) - BH / 2;
            return path({ id: 'join' + i, d: `M${BX - s.w / 2} ${y0} L${BX + s.w / 2} ${y0} L${BX + n.w / 2} ${y1} L${BX - n.w / 2} ${y1} Z`, fill: 'ink/6', stroke: 'ink/0',
              k: enter(n.t + 0.3, { blur: 0, s: 1 }) });
          }),
          ...S.map((s, i) => text({ id: 'stage' + i, text: s.n, x: -560, y: Y(i), ax: 0, size: 30, weight: 500, k: enter(s.t - 0.06, { dx: -18, x0: -560 }) })),
          ...S.map((s, i) => rect({ id: 'bar' + i, x: BX, y: Y(i), w: 0, h: BH, r: 18, fill: i === S.length - 1 ? 'acc' : 'ink',
            k: { w: [[s.t, s.t + 0.6, s.w, 'Power4 Out']] },
            ch: [text({ id: 'count' + i, text: fmt(s.v), size: 30, weight: 600, tnum: false, color: i === S.length - 1 ? '#FFFFFF' : 'inv', k: enter(s.t + 0.2, { d: 0 }) })] })),
          // step conversion chips sit on the joins, centred on the funnel axis
          ...S.slice(1).map((s, i) => rect({ id: 'conv' + i, x: BX, y: (Y(i) + Y(i + 1)) / 2, w: 124, h: 42, r: 21, fill: 'card', stroke: 'line', sw: 2, shadow: 3, k: pop(s.t + 0.42, { from: 0.4 }), ch: [
            icon({ icon: 'arrowDown', x: -30, size: 20, sw: 2.8, color: 'muted' }),
            text({ text: Math.round(s.v / S[i].v * 100) + '%', x: 12, size: 24, weight: 600 }),
          ] })),
        ] }),
    ];
  },
});
})();
