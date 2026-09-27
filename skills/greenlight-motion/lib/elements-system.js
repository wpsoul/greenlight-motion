/* UI Motion Kit — system elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// the kit's opening beat: the main shape pops in from empty
const cardIn = (t = 0.08, s = 0.7) => ({ scale: [s, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (tracks, rules, fields — things that should not scale or blur in)
const fadeIn = (t) => enter(t, { blur: 0, s: 1 });
// a closed circle for Trim Paths, starting at 12 o'clock and running clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// deterministic 0…1 noise — frames stay a pure function of t
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
// time u (0…1) at which an easing reaches progress p
const invEase = (name, p) => {
  const f = UIK.ease(name); let a = 0, b = 1;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < p) a = m; else b = m; }
  return (a + b) / 2;
};
// cubic bezier helpers: P = [p0, c1, c2, p3]
const bz = (P, u) => { const v = 1 - u; return [0, 1].map((j) => v * v * v * P[0][j] + 3 * v * v * u * P[1][j] + 3 * v * u * u * P[2][j] + u * u * u * P[3][j]); };
const bzPts = (P, n = 120) => Array.from({ length: n + 1 }, (_, i) => bz(P, i / n));
const polyLen = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
const bzD = (P) => `M${P[0].join(' ')} C${P[1].join(' ')} ${P[2].join(' ')} ${P[3].join(' ')}`;
// follow a cubic from t0 to t1 on one easing: n checkpoints at equal arc length, keyed with Linear
// segments at the times the easing reaches them — x/y of a rider and the trim of the line stay locked
const follow = (P, t0, t1, n = 16, ez = 'Power2 Smooth') => {
  const pts = bzPts(P, 240), cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1], out = [];
  for (let j = 0; j <= n; j++) {
    const s = L * j / n; let i = cum.findIndex((c) => c >= s); if (i < 0) i = cum.length - 1;
    out.push({ p: pts[i].map((v) => +v.toFixed(1)), f: j / n, t: +(t0 + (t1 - t0) * invEase(ez, j / n)).toFixed(4) });
  }
  return out;
};
const followSegs = (F, fn) => F.slice(1).map((c, j) => [F[j].t, c.t, fn(c), 'Linear']);
// a spinner: a short trimmed arc that turns (Linear) between t0 and t1, fades in and out with a scale
const spinner = (o) => path({ id: o.id, x: o.x || 0, y: o.y || 0, d: ring(o.R), stroke: o.color || 'ink', sw: o.sw || 4, trimmed: true, trimE: o.len || 28,
  k: k({ rot: [[o.t0, o.t1 + 0.14, 360 * (o.turns || Math.max(1, Math.round((o.t1 - o.t0) * 1.6))), 'Linear']] },
       enter(o.t0, { d: 0, dur: 0.16, blur: 0, s: 0.6 }), exit(o.t1, { s: 0.6, blur: 0 })) });
// a looping pulse (scale) between t0 and t1 — live dots
const pulse = (t0, t1, lo = 0.55, per = 0.8) => {
  const sc = [];
  for (let t = t0; t + per <= t1 + 0.001; t += per) sc.push([t, t + per / 2, lo, 'Sine Smooth'], [t + per / 2, t + per, 1, 'Sine Smooth']);
  return sc;
};

// 1 ─ Git graph: main + feature lanes draw on commit by commit, the branch bends back into an accent merge
UIK.define({
  id: 'git-graph', name: 'Git graph', cat: 'system', T: 4.0, cam: 1.3,
  desc: 'The main lane draws up commit by commit (Trim Paths) while a feature branch curves off beside it; each dot pops as its line arrives and the commit message slides in next to it, then the branch bends back and lands on an accent merge dot.',
  build: () => {
    const MX = -425, BX = -337, TX = -280, Y = (j) => 260 - j * 84;   // commit j: 0 oldest … 5 newest (the merge)
    const C = [
      { lane: 'm', msg: 'Initial layout', hash: '1a4e9f0', t: 0.48 },
      { lane: 'm', msg: 'Set up routing', hash: '7c21b3d', t: 0.84 },
      { lane: 'b', msg: 'Build search index', hash: 'e93f5a2', t: 1.38 },
      { lane: 'm', msg: 'Fix header spacing', hash: '4b8d0c6', t: 1.66 },
      { lane: 'b', msg: 'Add result ranking', hash: 'a07e1f9', t: 2.1, tag: 'feature/search' },
      { lane: 'x', msg: 'Merge feature/search', hash: 'f3c9d24', t: 2.72, tag: 'main' },
    ];
    const mPct = (y) => +((Y(0) - y) / (Y(0) - Y(5)) * 100).toFixed(3);
    // branch: fork curve off commit 1, a straight run, a merge curve into commit 5
    const B0 = Y(1) - 60, B1 = Y(5) + 60;
    const fork = [[MX, Y(1)], [MX, Y(1) - 30], [BX, Y(1) - 30], [BX, B0]];
    const merge = [[BX, B1], [BX, B1 - 30], [MX, B1 - 30], [MX, Y(5)]];
    const lf = polyLen(bzPts(fork)), lm = polyLen(bzPts(merge)), LB = lf + (B0 - B1) + lm;
    const bPct = (y) => +((lf + (B0 - y)) / LB * 100).toFixed(3);
    const branchD = bzD(fork) + ` L${BX} ${B1} C${merge[1].join(' ')} ${merge[2].join(' ')} ${merge[3].join(' ')}`;
    return [
      rect({ id: 'card', w: 1000, h: 660, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Commits', x: -440, y: -258, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -440 }) }),
          text({ id: 'branchLbl', text: 'feature/search → main', x: 440, y: -258, ax: 1, size: 26, color: 'muted', k: enter(0.3) }),
          rect({ id: 'rule', y: -212, w: 1000, h: 2, fill: 'line', k: fadeIn(0.32) }),
          path({ id: 'mainLine', d: `M${MX} ${Y(0)} L${MX} ${Y(5)}`, stroke: 'ink', sw: 5, trimmed: true,
            k: { trimE: [0, [0.54, 0.94, mPct(Y(1)), 'Power3 Out'], [1.28, 1.74, mPct(Y(3)), 'Power3 Out'], [2.32, 2.8, 100, 'Power3 Out']] } }),
          path({ id: 'branchLine', d: branchD, stroke: 'muted', sw: 5, trimmed: true,
            k: { trimE: [0, [0.98, 1.46, bPct(Y(2)), 'Power3 Out'], [1.78, 2.18, bPct(Y(4)), 'Power3 Out'], [2.32, 2.8, 100, 'Power3 Out']] } }),
          ...C.map((c, j) => {
            const x = c.lane === 'b' ? BX : MX, y = Y(j);
            if (c.lane === 'x') return circle({ id: 'merge', x, y, d: 40, fill: 'acc', stroke: 'card', sw: 7, k: pop(c.t, { from: 0.3, dur: 0.45 }) });
            return c.lane === 'm'
              ? circle({ id: 'commit' + j, x, y, d: 30, fill: 'ink', stroke: 'card', sw: 7, k: pop(c.t) })
              : circle({ id: 'commit' + j, x, y, d: 28, fill: 'card', stroke: 'muted', sw: 5, k: pop(c.t) });
          }),
          ...C.map((c, j) => group({ id: 'label' + j, y: Y(j), k: enter(c.t + 0.02, { dx: -14, x0: 0 }), ch: [
            text({ text: c.msg, x: TX, ax: 0, size: 28, weight: c.lane === 'x' ? 600 : 500 }),
            c.tag ? rect({ x: TX + (c.lane === 'x' ? 360 : 300) + (c.tag.length * 12.4 + 36) / 2, w: c.tag.length * 12.4 + 36, h: 40, r: 20,
              fill: c.lane === 'x' ? 'ink' : 'soft', ch: [text({ text: c.tag, size: 22, weight: 500, color: c.lane === 'x' ? 'inv' : 'muted' })] }) : null,
            text({ text: c.hash, x: 440, ax: 1, size: 24, color: 'muted' }),
          ].filter(Boolean) })),
        ] }),
    ];
  },
});

// 2 ─ Deploy pipeline: four stages run in turn — spinner → check — while each connector fills
UIK.define({
  id: 'deploy-pipeline', name: 'Deploy pipeline', cat: 'system', T: 4.6, cam: 1.15,
  desc: 'Build, Test, Review and Deploy run in turn: each node spins while its outgoing connector fills, lands on a check as the next one starts, the status lines swap Queued → Running → result, and the last node turns accent with Live while the elapsed timer stops.',
  build: () => {
    const X = [-450, -150, 150, 450], NY = 6, ND = 104, CL = 300 - 2 * 76;
    const S = [
      { n: 'Build', icon: 'layers', s: 0.75, d: 1.4, done: '38s' },
      { n: 'Test', icon: 'shield', s: 1.5, d: 2.3, done: '1m 12s' },
      { n: 'Review', icon: 'eye', s: 2.4, d: 2.95, done: 'Approved' },
      { n: 'Deploy', icon: 'globe', s: 3.05, d: 3.7, done: 'Live' },
    ];
    return [
      rect({ id: 'card', w: 1240, h: 480, r: 44, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Deploy #482', x: -560, y: -160, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -560 }) }),
          text({ id: 'sub', text: 'main · Fix search ranking', x: -560, y: -116, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
          text({ id: 'elapsed', x: 560, y: -160, ax: 1, size: 40, weight: 600, ls: -0.02, num: { pre: '0:', pad: 2, sep: false, floor: true },
            k: k(enter(0.28), { value: [[S[0].s, S[3].d, 48, 'Linear']] }) }),
          text({ id: 'elapsedLbl', text: 'elapsed', x: 560, y: -116, ax: 1, size: 26, color: 'muted', k: enter(0.34) }),
          ...[0, 1, 2].map((i) => rect({ id: 'conn' + i, x: (X[i] + X[i + 1]) / 2, y: NY, w: CL, h: 6, r: 3, fill: 'dim', k: fadeIn(0.42 + i * 0.07), ch: [
            rect({ id: 'connFill' + i, x: -CL / 2, pin: 'l', w: 0, h: 6, r: 3, fill: 'ink', k: { w: [[S[i].s + 0.1, S[i].d, CL, 'Power2 Smooth']] } }),
          ] })),
          ...S.map((s, i) => {
            const last = i === S.length - 1;
            return group({ id: 'stage' + i, x: X[i], y: NY, ch: [
              group({ id: 'node' + i, k: enter(0.34 + i * 0.07, { blur: 0, s: 0.7 }), ch: [
                circle({ id: 'base' + i, d: ND, fill: 'soft' }),
                icon({ id: 'ico' + i, icon: s.icon, size: 44, sw: 2.4, color: 'muted', k: k({ color: [[s.s, s.s + 0.2, 'ink', 'Power2 Out']] }, exit(s.d, { s: 0.6 })) }),
                spinner({ id: 'spin' + i, R: 49, sw: 6, len: 30, t0: s.s, t1: s.d }),
                circle({ id: 'doneDisc' + i, d: ND, fill: last ? 'acc' : 'ink', k: pop(s.d, { from: 0.6, dur: 0.45 }) }),
                icon({ id: 'check' + i, icon: 'check', size: 46, sw: 3, color: last ? '#FFFFFF' : 'inv', k: pop(s.d + 0.06) }),
              ] }),
              text({ id: 'name' + i, text: s.n, y: 104, size: 30, weight: 600, ls: -0.01, k: enter(0.4 + i * 0.07) }),
              text({ id: 'queued' + i, text: 'Queued', y: 144, size: 24, color: 'muted', k: k(enter(0.46 + i * 0.07), exit(s.s)) }),
              text({ id: 'running' + i, text: 'Running…', y: 144, size: 24, weight: 500, k: k(enter(s.s, { d: 0.04 }), exit(s.d)) }),
              last
                ? group({ id: 'live', y: 144, k: enter(s.d + 0.02), ch: [
                    circle({ x: -40, d: 12, fill: 'acc', k: pop(s.d + 0.12) }),
                    text({ text: 'Live', x: -24, ax: 0, size: 24, weight: 600, color: 'acc' }),
                  ] })
                : text({ id: 'done' + i, text: s.done, y: 144, size: 24, color: 'muted', k: enter(s.d + 0.02) }),
            ] });
          }),
        ] }),
    ];
  },
});

// 3 ─ Status page: uptime strips sweep in, one service is degraded, then it recovers
UIK.define({
  id: 'status-page', name: 'Status page', cat: 'system', T: 3.9, cam: 1.2,
  desc: 'Three service rows sweep their 30-day uptime strips in left to right (one trimmed path of bars per row). Webhooks ends on red bars and reads Degraded; then it recovers — the red bars fade to ink, the label swaps to Operational and the header chip widens into All operational.',
  build: () => {
    const F = 2.75, BP = 36, BX0 = -522, BAD = 27;
    const bars = (a, b) => Array.from({ length: b - a }, (_, j) => { const x = BX0 + (a + j) * BP; return `M${x} -21 L${x} 21`; }).join(' ');
    const BAR = { sw: 13 };
    const SV = [{ n: 'API' }, { n: 'Webhooks', bad: true }, { n: 'Dashboard' }];
    return [
      rect({ id: 'card', w: 1180, h: 660, r: 44, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'System status', x: -530, y: -256, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -530 }) }),
          text({ id: 'sub', text: 'Uptime over the last 30 days', x: -530, y: -212, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
          rect({ id: 'chip', x: 530, y: -240, pin: 'r', chAt: 'pin', w: 196, h: 56, r: 28, fill: 'bad/12',
            k: k(enter(0.36, { blur: 0, s: 0.9 }), { w: [[F + 0.1, F + 0.6, 286, 'Power4 Out']], fill: [[F + 0.1, F + 0.4, 'soft', 'Power2 Out']] }), ch: [
              group({ id: 'chipA', k: exit(F + 0.1), ch: [
                circle({ x: -168, d: 12, fill: 'bad' }),
                text({ text: '1 incident', x: -152, ax: 0, size: 24, weight: 600, color: 'bad' }),
              ] }),
              group({ id: 'chipB', k: enter(F + 0.18), ch: [
                icon({ icon: 'check', x: -254, size: 24, sw: 3, color: 'acc' }),
                text({ text: 'All operational', x: -232, ax: 0, size: 24, weight: 600 }),
              ] }),
            ] }),
          ...SV.flatMap((s, i) => {
            const y0 = -110 + i * 140, t0 = 0.56 + i * 0.18, dur = 1.0, a = 0.38 + i * 0.1;
            const out = [
              text({ id: 'svc' + i, text: s.n, x: -530, y: y0 - 30, ax: 0, size: 30, weight: 500, k: enter(a, { dx: -14, x0: -530 }) }),
              path({ id: 'skel' + i, y: y0 + 30, d: bars(0, 30), stroke: 'skel', ...BAR, k: fadeIn(a) }),
              path({ id: 'up' + i, y: y0 + 30, d: bars(0, s.bad ? BAD : 30), stroke: 'ink', ...BAR, trimmed: true,
                k: { trimE: [0, [t0, t0 + dur * (s.bad ? BAD / 30 : 1), 100, 'Linear']] } }),
            ];
            if (s.bad) out.push(
              path({ id: 'badBars', y: y0 + 30, d: bars(BAD, 30), stroke: 'bad', ...BAR, trimmed: true,
                k: { trimE: [0, [t0 + dur * BAD / 30, t0 + dur, 100, 'Linear']], opacity: [[F, F + 0.35, 0, 'Power2 Out']] } }),
              path({ id: 'healed', y: y0 + 30, d: bars(BAD, 30), stroke: 'ink', ...BAR, k: { opacity: [0, [F, F + 0.35, 1, 'Power2 Out']] } }),
              circle({ id: 'dot' + i, x: 524, y: y0 - 30, d: 12, fill: 'bad', k: k(fadeIn(a + 0.04), { fill: [[F, F + 0.25, 'ink', 'Power2 Out']] }) }),
              text({ id: 'degraded', text: 'Degraded', x: 502, y: y0 - 30, ax: 1, size: 24, weight: 500, color: 'bad', k: k(enter(a + 0.04), exit(F)) }),
              text({ id: 'recovered', text: 'Operational', x: 502, y: y0 - 30, ax: 1, size: 24, color: 'muted', k: enter(F + 0.02) }),
            );
            else out.push(
              circle({ id: 'dot' + i, x: 524, y: y0 - 30, d: 12, fill: 'ink', k: fadeIn(a + 0.04) }),
              text({ id: 'state' + i, text: 'Operational', x: 502, y: y0 - 30, ax: 1, size: 24, color: 'muted', k: enter(a + 0.04) }),
            );
            return out;
          }),
          text({ id: 'axisL', text: '30 days ago', x: -530, y: 262, ax: 0, size: 22, color: 'muted', k: enter(0.6) }),
          text({ id: 'axisR', text: 'Today', x: 530, y: 262, ax: 1, size: 22, color: 'muted', k: enter(0.64) }),
        ] }),
    ];
  },
});

// 4 ─ API request: Send → latency counter runs → 200 OK pops → the response body lands row by row
UIK.define({
  id: 'api-request', name: 'API request', cat: 'system', T: 3.7, cam: 1.3,
  desc: 'The cursor hits Send: the placeholder blurs out, a spinner turns while the latency counter runs up to 128 ms, a 200 OK chip pops and the response body lands key by key on a stagger.',
  build: () => {
    const C = 1.15, R = 1.95;
    const BODY = [['id', '42'], ['name', '"Ana Reyes"'], ['email', '"ana@studio.co"'], ['role', '"admin"'], ['plan', '"Pro"'], ['active', 'true']];
    return [
      rect({ id: 'card', w: 1100, h: 660, r: 44, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          rect({ id: 'urlField', x: -120, y: -240, w: 760, h: 88, r: 22, fill: 'panel', stroke: 'line', sw: 2, k: fadeIn(0.22), ch: [
            rect({ id: 'method', x: -324, w: 88, h: 52, r: 14, fill: 'ink', k: enter(0.3, { blur: 0, s: 0.8 }), ch: [text({ text: 'GET', size: 24, weight: 600, color: 'inv' })] }),
            text({ id: 'url', text: 'api.studio.dev/v1/users/42', x: -258, ax: 0, size: 30, weight: 500, k: enter(0.34, { dx: -12, x0: -258 }) }),
          ] }),
          rect({ id: 'send', x: 400, y: -240, w: 200, h: 88, r: 44, fill: 'ink', k: k(enter(0.3, { blur: 0, s: 0.8 }), press(C)), ch: [
            icon({ icon: 'send', x: -44, size: 30, sw: 2.4, color: 'inv' }),
            text({ text: 'Send', x: -18, ax: 0, size: 30, weight: 600, color: 'inv' }),
          ] }),
          rect({ id: 'rule', y: -166, w: 1100, h: 2, fill: 'line', k: fadeIn(0.36) }),
          text({ id: 'respLbl', text: 'Response', x: -500, y: -108, ax: 0, size: 30, weight: 600, ls: -0.01, k: enter(0.38) }),
          spinner({ id: 'spin', x: 300, y: -108, R: 16, sw: 4, t0: C + 0.05, t1: R }),
          rect({ id: 'status', x: 300, y: -108, w: 150, h: 48, r: 24, fill: 'acc/12', k: pop(R + 0.04, { from: 0.5 }), ch: [
            text({ text: '200 OK', size: 24, weight: 600, color: 'acc' }),
          ] }),
          text({ id: 'latency', x: 500, y: -108, ax: 1, size: 26, color: 'muted', num: { suf: ' ms', floor: true },
            k: k(enter(C + 0.05, { d: 0, dur: 0.2 }), { value: [[C + 0.05, R, 128, 'Linear']] }) }),
          rect({ id: 'body', y: 110, w: 1000, h: 336, r: 24, fill: 'panel', k: fadeIn(0.42), ch: [
            text({ id: 'placeholder', text: 'Send the request to see a response', size: 28, color: 'muted', k: k(enter(0.5), exit(C + 0.04)) }),
            ...BODY.map(([key, v], i) => group({ id: 'line' + i, y: -120 + i * 48, k: enter(R + 0.12 + i * 0.08, { dx: -14, x0: 0 }), ch: [
              text({ text: key + ':', x: -440, ax: 0, size: 28, color: 'muted' }),
              text({ text: v, x: -270, ax: 0, size: 28, weight: 500 }),
            ] })),
          ] }),
        ] }),
      cursorLayer([[0, 620, 300], [0.42, 620, 300], [1.05, 418, -226], [1.4, 418, -226], [2.0, 620, 330]], [C], [], { inAt: 0.38 }),
    ];
  },
});

// 5 ─ Log stream: lines scroll up inside a clip window until an error lands, gets flagged and pauses it
UIK.define({
  id: 'log-stream', name: 'Log stream', cat: 'system', T: 3.9, cam: 1.25,
  desc: 'Log lines with level chips stream upward inside a clipped window (one group stepping up per new line). An error line arrives, its row tints red with a marker bar, and the header swaps Live for Paused as the stream stops.',
  build: () => {
    const ROW = 62, A = [0.98, 1.36, 1.7, 2.0, 2.42], E = A[A.length - 1] + 0.32;
    const L = [
      ['12:04:31', 'info', 'GET /health 200 · 4 ms'],
      ['12:04:31', 'info', 'Worker 3 started'],
      ['12:04:32', 'info', 'POST /orders 201 · 38 ms'],
      ['12:04:32', 'warn', 'Slow query on orders · 812 ms'],
      ['12:04:33', 'info', 'GET /users/42 200 · 12 ms'],
      ['12:04:33', 'info', 'Cache hit ratio 94%'],
      ['12:04:34', 'info', 'POST /auth/login 200 · 51 ms'],
      ['12:04:34', 'info', 'GET /products 200 · 22 ms'],
      ['12:04:35', 'warn', 'Retrying payment webhook (1/3)'],
      ['12:04:35', 'info', 'Queue depth 12'],
      ['12:04:36', 'error', 'Payment webhook timed out after 30 s'],
    ];
    const N0 = L.length - A.length;   // rows on screen at the start
    const LV = { info: { f: 'card', s: 'line', c: 'muted', t: 'INFO' }, warn: { f: 'ink/10', c: 'ink', t: 'WARN' }, error: { f: 'bad', c: '#FFFFFF', t: 'ERROR' } };
    // initial rows slide in from the left (x0 = each layer's own x); streamed rows only unblur as they scroll in
    const rowK = (i, x0) => i < N0 ? enter(0.36 + i * 0.05, { dx: -12, x0 }) : enter(A[i - N0] - 0.02, { d: 0, dur: 0.26, blur: 6, s: 1 });
    const Y0 = -155, scroll = [Y0, ...A.map((t, j) => [t, t + 0.32, Y0 - (j + 1) * ROW, 'Power3 Out'])];   // 6 slots, row pitch 62
    return [
      rect({ id: 'card', w: 1180, h: 600, r: 44, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Logs', x: -530, y: -232, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -530 }) }),
          text({ id: 'sub', text: 'api-server · production', x: -530, y: -188, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
          group({ id: 'live', y: -224, k: k(enter(0.34), exit(E)), ch: [
            circle({ id: 'liveDot', x: 454, d: 14, fill: 'acc', k: { scale: pulse(0.6, E, 0.55, 0.7) } }),
            text({ text: 'Live', x: 530, ax: 1, size: 26, weight: 500 }),
          ] }),
          group({ id: 'paused', y: -224, k: enter(E + 0.02), ch: [
            icon({ icon: 'pause', x: 414, size: 22, sw: 2, color: 'ink', filled: true, fill: 'ink' }),
            text({ text: 'Paused', x: 530, ax: 1, size: 26, weight: 500 }),
          ] }),
          rect({ id: 'window', y: 52, w: 1100, h: 392, r: 22, fill: 'panel', clip: true, k: fadeIn(0.3), ch: [
            group({ id: 'stream', y: Y0, k: { y: scroll }, ch: [
              rect({ id: 'errTint', y: (L.length - 1) * ROW, w: 1100, h: 58, fill: 'bad/12', k: { opacity: [0, [E, E + 0.25, 1, 'Power2 Out']] } }),
              rect({ id: 'errBar', x: -547, y: (L.length - 1) * ROW, w: 6, h: 58, fill: 'bad', k: { opacity: [0, [E, E + 0.2, 1, 'Power2 Out']] } }),
              ...L.flatMap(([ts, lv, msg], i) => {
                const y = i * ROW, v = LV[lv];
                return [
                  text({ id: 'ts' + i, text: ts, x: -510, y, ax: 0, size: 22, color: 'muted', k: rowK(i, -510) }),
                  rect({ id: 'lv' + i, x: -330, y, w: 92, h: 36, r: 10, fill: v.f, stroke: v.s, sw: v.s ? 2 : 0, k: rowK(i, -330),
                    ch: [text({ text: v.t, size: 18, weight: 600, ls: 0.04, color: v.c })] }),
                  text({ id: 'msg' + i, text: msg, x: -262, y, ax: 0, size: 26, weight: lv === 'error' ? 500 : 400, k: rowK(i, -262) }),
                ];
              }),
            ] }),
          ] }),
        ] }),
    ];
  },
});

// 6 ─ CPU monitor: a live line scrolls left, the counter reads the live edge, a spike trips the threshold
UIK.define({
  id: 'cpu-monitor', name: 'CPU monitor', cat: 'system', T: 4.4, cam: 1.3,
  desc: 'A long line path scrolls left inside a clip (one Linear x track) while the % counter and the edge dot read the value at the live edge. A spike comes in: the dashed 80 % threshold fades in, an accent alert dot pops on the peak and rides away with it, and a High load chip lands.',
  build: () => {
    const DX = 35, N = 54, X0 = -490, WY = 70, SC0 = 0.35, SPD = 210, T = 4.4;
    const SP = { 39: 50, 40: 76, 41: 92, 42: 85, 43: 62, 44: 47 };
    const V = Array.from({ length: N }, (_, i) => SP[i] ?? +(35 + 6 * Math.sin(i * 0.62) + 10 * (rnd(i + 3) - 0.5)).toFixed(1));
    const ly = (v) => +(140 - v * 2.8).toFixed(1);
    const P = V.map((v, i) => [X0 + i * DX, ly(v)]);
    const lineD = 'M' + P.map((p) => p.join(' ')).join(' L');
    const areaD = lineD + ` L${P[N - 1][0]} ${ly(0)} L${X0} ${ly(0)} Z`;
    // the live edge sits at x = 490: point i crosses it at tc(i)
    const tc = (i) => +(SC0 + (P[i][0] - 490) / SPD).toFixed(4);
    const I0 = P.findIndex((p) => p[0] >= 490), edge = [];
    for (let i = I0 + 1; i < N && tc(i - 1) < T; i++) edge.push([tc(i - 1), tc(i), i]);
    const PK = 41, TP = tc(PK);
    return [
      rect({ id: 'card', w: 1100, h: 600, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'CPU usage', x: -490, y: -220, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -490 }) }),
          text({ id: 'sub', text: 'api-01 · 8 cores', x: -490, y: -176, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
          text({ id: 'value', x: 490, y: -206, ax: 1, size: 64, weight: 600, ls: -0.03, num: { suf: '%' },
            k: k(enter(0.28), { value: [V[I0], ...edge.map(([a, b, i]) => [a, b, V[i], 'Linear'])] }) }),
          rect({ id: 'alertChip', x: 262, y: -206, w: 186, h: 50, r: 25, fill: 'acc/12', k: pop(TP + 0.08, { from: 0.5 }), ch: [
            icon({ icon: 'alert', x: -62, size: 22, sw: 2.4, color: 'acc' }),
            text({ text: 'High load', x: -42, ax: 0, size: 22, weight: 600, color: 'acc' }),
          ] }),
          rect({ id: 'window', y: WY, w: 980, h: 320, clip: true, k: fadeIn(0.3), ch: [
            ...[0, 25, 50, 75].map((v, i) => rect({ id: 'grid' + i, y: ly(v), w: 980, h: 2, fill: i ? 'line' : 'dim' })),
            group({ id: 'scroller', k: { x: [[SC0, T, -(T - SC0) * SPD, 'Linear']] }, ch: [
              path({ id: 'area', d: areaD, fill: 'ink/6' }),
              path({ id: 'line', d: lineD, stroke: 'ink', sw: 4 }),
              circle({ id: 'alertDot', x: P[PK][0], y: P[PK][1], d: 24, fill: 'acc', stroke: 'card', sw: 5, k: pop(TP, { from: 0.3 }) }),
            ] }),
            path({ id: 'threshold', y: ly(80), d: 'M-490 0 L490 0', stroke: 'muted', sw: 2, dash: [10, 10], cap: 'butt', k: fadeIn(TP - 0.15) }),
            text({ id: 'thrLbl', text: '80% limit', x: -478, y: ly(80) - 20, ax: 0, size: 22, color: 'muted', k: enter(TP - 0.1) }),
          ] }),
          circle({ id: 'tip', x: 490, y: WY + P[I0][1], d: 20, fill: 'ink', stroke: 'card', sw: 5,
            k: k(pop(0.45), { y: [WY + P[I0][1], ...edge.map(([a, b, i]) => [a, b, WY + P[i][1], 'Linear'])] }) }),
        ] }),
    ];
  },
});

// 7 ─ File tree: a folder opens (chevron turns, children slide in, rows below push down), a new file is named
{
  const O = 1.12, NF = 2.02;
  UIK.define({
    id: 'file-tree', name: 'File tree', cat: 'system', T: 4.1,
    // the camera leads the panel's growth a touch so its bottom edge never leaves the frame
    cam: { zoom: 1.36, y: -128, k: { zoom: [[O - 0.2, O + 0.55, 1.2, 'Power2 Smooth'], [NF - 0.12, NF + 0.6, 1.13, 'Power2 Smooth']],
                                     y: [[O - 0.2, O + 0.55, -32, 'Power2 Smooth'], [NF - 0.12, NF + 0.6, 0, 'Power2 Smooth']] } },
    desc: 'The cursor opens a folder: its chevron turns, three children slide in and every row below is pushed down as the panel grows. Then + adds a file: a highlighted row opens up, its name types in with a caret, and the highlight fades.',
    build: () => {
      const GY = -128, TOP = -391 - GY, ROW = 64, N = NF + 0.08;
      const ry = (s) => TOP + 150 + s * ROW;
      const R = [
        { name: 'src', lvl: 0, folder: true, open: true, s: [0] },
        { name: 'components', lvl: 1, folder: true, s: [1], click: true },
        { name: 'Button.jsx', lvl: 2, child: 0, s: [2] },
        { name: 'Card.jsx', lvl: 2, child: 1, s: [3] },
        { name: 'Modal.jsx', lvl: 2, child: 2, s: [4] },
        { name: 'Toast.jsx', lvl: 2, isNew: true, s: [5] },
        { name: 'utils', lvl: 1, folder: true, s: [2, 5, 6] },
        { name: 'index.js', lvl: 1, s: [3, 6, 7] },
        { name: 'package.json', lvl: 0, s: [4, 7, 8] },
        { name: 'README.md', lvl: 0, s: [5, 8, 9] },
      ];
      const row = (r, i) => {
        const cx = -340 + r.lvl * 40, ix = cx + 34, nx = ix + 30, y0 = ry(r.s[0]);
        let kk;
        if (r.child != null) kk = enter(O + 0.04 + r.child * 0.06, { d: 0.04, dy: -14, y0 });
        else if (r.isNew) kk = enter(N, { d: 0.02, dy: -14, y0, blur: 6 });
        else kk = k(enter(0.3 + r.s[0] * 0.06, { dx: -14, x0: 0 }),
          r.s[1] != null ? { y: [[O, O + 0.5, ry(r.s[1]), 'Power4 Out'], [N, N + 0.5, ry(r.s[2]), 'Power4 Out']] } : null);
        return group({ id: 'row' + i, y: y0, k: kk, ch: [
          r.isNew ? rect({ id: 'newHi', x: 0, w: 712, h: 56, r: 14, fill: 'acc/12', stroke: 'acc', sw: 2,
            k: { stroke: [[2.98, 3.2, 'acc/0', 'Power2 Out']], opacity: [[3.25, 3.85, 0, 'Power2 Out']] } }) : null,
          r.folder ? icon({ id: 'chev' + i, icon: 'chevronRight', x: cx, size: 24, sw: 2.4, color: 'muted', rot: r.open ? 90 : 0,
            k: r.click ? { rot: [[O, O + 0.38, 90, 'Power3 Out']] } : undefined }) : null,
          icon({ id: 'ico' + i, icon: r.folder ? 'folder' : 'file', x: ix, size: 28, sw: 2.2, color: r.folder ? 'ink' : 'muted' }),
          text({ id: 'name' + i, text: r.name, x: nx, ax: 0, size: 28, weight: r.folder ? 500 : 400,
            ...(r.isNew ? { caret: true, caretColor: 'ink', caretFrom: N + 0.1, caretUntil: 2.98, k: { reveal: [0, [N + 0.2, N + 0.7, 1, 'Linear']] } } : {}) }),
        ].filter(Boolean) });
      };
      return [
        group({ id: 'panel', y: GY, k: cardIn(0.08, 0.7), ch: [
          rect({ id: 'card', y: TOP, pin: 't', w: 760, h: 526, r: 36, fill: 'card', shadow: 1,
            k: { h: [[O, O + 0.5, 718, 'Power4 Out'], [N, N + 0.5, 782, 'Power4 Out']] } }),
          text({ id: 'title', text: 'Explorer', x: -340, y: TOP + 58, ax: 0, size: 30, weight: 600, ls: -0.01, k: enter(0.2, { dx: -12, x0: -340 }) }),
          icon({ id: 'searchIco', icon: 'search', x: 244, y: TOP + 58, size: 26, sw: 2.4, color: 'muted', k: enter(0.26) }),
          rect({ id: 'newBtn', x: 316, y: TOP + 58, w: 52, h: 52, r: 14, fill: 'soft', k: k(enter(0.3, { blur: 0, s: 0.7 }), press(NF, { to: 0.9 })),
            ch: [icon({ icon: 'plus', size: 26, sw: 2.6, color: 'ink' })] }),
          rect({ id: 'rule', y: TOP + 106, w: 760, h: 2, fill: 'line', k: fadeIn(0.3) }),
          rect({ id: 'hover', y: ry(1), w: 712, h: 56, r: 14, fill: 'soft', k: { opacity: [0, [0.92, 1.08, 1, 'Power2 Out'], [1.6, 1.9, 0, 'Power2 Out']] } }),
          ...R.map(row),
        ] }),
        cursorLayer([[0, 470, 190], [0.45, 470, 190], [1.02, -150, -168], [1.34, -150, -168], [1.92, 324, -324], [2.2, 324, -324], [2.8, 460, 60]], [O, NF], [], { inAt: 0.4 }),
      ];
    },
  });
}

// 8 ─ Code review: a line is flagged, a comment bubble pops from the gutter, Resolve shrinks it into a chip
UIK.define({
  id: 'code-review', name: 'Code review', cat: 'system', T: 4.1, cam: 1.25,
  desc: 'The cursor hovers a line of code: it tints and a + pops in the gutter. A click springs a comment bubble out of the gutter; Resolve then shrinks the bubble itself into a small Resolved chip at the end of the line while the tint fades.',
  build: () => {
    const HV = 0.98, C1 = 1.45, C2 = 2.72, M = C2 + 0.06, LY = (i) => -150 + i * 54, CL = 4;
    const CODE = [
      [0, 'import { search } from \'./api\''],
      [0, 'import { rank } from \'./rank\''],
      [0, ''],
      [0, 'export async function find(query) {'],
      [1, 'const results = await search(query)'],
      [1, 'const ranked = rank(results)'],
      [1, 'return ranked.slice(0, 20)'],
      [0, '}'],
    ];
    const BX = -500, BY = LY(CL) + 30, CX = 190, CY = LY(CL) - 26;   // bubble top-left → chip top-left
    return [
      rect({ id: 'card', w: 1180, h: 620, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          icon({ id: 'fileIco', icon: 'file', x: -520, y: -240, size: 32, sw: 2.2, color: 'muted', k: enter(0.2) }),
          text({ id: 'title', text: 'search.js', x: -490, y: -240, ax: 0, size: 32, weight: 600, ls: -0.01, k: enter(0.24, { dx: -14, x0: -490 }) }),
          text({ id: 'diff', text: '+3  −1', x: 530, y: -240, ax: 1, size: 26, weight: 500, color: 'muted', k: enter(0.3) }),
          rect({ id: 'rule', y: -196, w: 1180, h: 2, fill: 'line', k: fadeIn(0.3) }),
          rect({ id: 'lineHi', y: LY(CL), w: 1180, h: 50, fill: 'acc/10', k: { opacity: [0, [HV, HV + 0.18, 1, 'Power2 Out'], [M + 0.1, M + 0.5, 0, 'Power2 Out']] } }),
          rect({ id: 'lineBar', x: -587, y: LY(CL), w: 6, h: 50, fill: 'acc', k: { opacity: [0, [HV, HV + 0.18, 1, 'Power2 Out'], [M + 0.1, M + 0.5, 0, 'Power2 Out']] } }),
          ...CODE.map(([ind, s], i) => group({ id: 'code' + i, y: LY(i), k: enter(0.3 + i * 0.04, { dx: -10, x0: 0 }), ch: [
            text({ text: String(i + 1), x: -470, ax: 1, size: 24, color: 'muted' }),
            s ? text({ text: s, x: -420 + ind * 36, ax: 0, size: 28 }) : null,
          ].filter(Boolean) })),
          rect({ id: 'addBtn', x: -536, y: LY(CL), w: 34, h: 34, r: 10, fill: 'ink', k: k(pop(HV + 0.04, { from: 0.4 }), press(C1, { to: 0.85 }), exit(C1 + 0.12, { s: 0.6 })),
            ch: [icon({ icon: 'plus', size: 22, sw: 3, color: 'inv' })] }),
          // the bubble IS the chip: its top-left flies to the end of the line while it shrinks
          rect({ id: 'bubble', x: BX, y: BY, pin: 'tl', chAt: 'pin', w: 680, h: 178, r: 26, fill: 'card', stroke: 'line', sw: 2, shadow: 1, origin: [-0.5, -0.5],
            k: { scale: [0.5, [C1 + 0.05, C1 + 0.55, 1, 'Power4 Out']], opacity: [0, [C1 + 0.05, C1 + 0.17, 1, 'Linear']], blur: [8, [C1 + 0.05, C1 + 0.3, 0, 'Power2 Out']],
                 x: [[M, M + 0.6, CX, 'Expo Out']], y: [[M, M + 0.6, CY, 'Expo Out']], w: [[M, M + 0.6, 196, 'Expo Out']], h: [[M, M + 0.6, 52, 'Expo Out']],
                 fill: [[M, M + 0.3, 'soft', 'Power2 Out']], stroke: [[M, M + 0.3, 'soft', 'Power2 Out']] },
            ch: [
              group({ id: 'comment', k: k(enter(C1 + 0.12, { d: 0 }), exit(M - 0.02, { dur: 0.12 })), ch: [
                circle({ id: 'avatar', x: 46, y: 48, d: 52, fill: 'ink', ch: [text({ text: 'MC', size: 20, weight: 600, color: 'inv' })] }),
                text({ id: 'who', text: 'Maya Chen', x: 86, y: 36, ax: 0, size: 26, weight: 600 }),
                text({ id: 'when', text: 'just now', x: 646, y: 36, ax: 1, size: 22, color: 'muted' }),
                text({ id: 'note', text: 'Can we cache this call?', x: 86, y: 80, ax: 0, size: 28, k: enter(C1 + 0.22) }),
                rect({ id: 'reply', x: 440, y: 136, w: 120, h: 52, r: 26, fill: 'soft', ch: [text({ text: 'Reply', size: 24, weight: 500 })] }),
                rect({ id: 'resolve', x: 590, y: 136, w: 136, h: 52, r: 26, fill: 'ink', k: press(C2, { to: 0.94 }),
                  ch: [text({ text: 'Resolve', size: 24, weight: 600, color: 'inv' })] }),
              ] }),
              group({ id: 'resolved', k: enter(M + 0.22), ch: [
                icon({ icon: 'check', x: 32, y: 26, size: 24, sw: 3, color: 'ink' }),
                text({ text: 'Resolved', x: 54, y: 26, ax: 0, size: 24, weight: 500 }),
              ] }),
            ] }),
        ] }),
      cursorLayer([[0, 620, 330], [0.5, 620, 330], [0.95, -250, LY(CL) + 10], [1.1, -250, LY(CL) + 10], [1.38, -532, LY(CL) + 6], [1.8, -532, LY(CL) + 6],
                   [2.62, 96, BY + 142], [2.95, 96, BY + 142], [3.5, 420, 330]], [C1, C2], [], { inAt: 0.45 }),
    ];
  },
});

// 9 ─ Settings panel: two toggles flip, the slider is nudged, a Saved pill blinks in the header
UIK.define({
  id: 'settings-panel', name: 'Settings panel', cat: 'system', T: 4.5, cam: 1.3,
  desc: 'A preferences card: the cursor flips one toggle on and another off (knobs stretch as they travel), drags the Text size slider a notch while its value counts, and a Saved pill pops into the header, then tucks away.',
  build: () => {
    const C1 = 1.05, C2 = 1.7, D0 = 2.38, D1 = 2.98, SV = 3.1, SX = 4.02, TY = [-126, -16, 94], TW = 820, P0 = 0.4, P1 = 0.6;
    const ROWS = [
      { n: 'Notifications', s: 'Push and email alerts', on: true },
      { n: 'Auto-update', s: 'Install updates overnight', on: false, c: C1 },
      { n: 'Reduce motion', s: 'Use fewer animations', on: true, c: C2 },
    ];
    const toggle = (r, i) => {
      const c = r.c, kx = r.on ? 20 : -20;
      return rect({ id: 'track' + i, x: 350, y: TY[i], w: 96, h: 56, r: 28, fill: r.on ? 'acc' : 'dim',
        k: k(fadeIn(0.44 + i * 0.07), c != null ? k({ fill: [[c, c + 0.25, r.on ? 'dim' : 'acc', 'Power2 Out']] }, press(c, { to: 0.94 })) : null),
        ch: [rect({ id: 'knob' + i, x: kx, w: 44, h: 44, r: 22, fill: '#FFFFFF', shadow: 3,
          k: c != null ? { x: [[c, c + 0.45, -kx, 'Power4 Out']], w: [[c, c + 0.13, 60, 'Power2 Out'], [c + 0.13, c + 0.5, 44, 'Power3 Out']] } : undefined })] });
    };
    return [
      rect({ id: 'card', w: 940, h: 660, r: 44, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Preferences', x: -410, y: -250, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -410 }) }),
          rect({ id: 'saved', x: 340, y: -250, w: 150, h: 52, r: 26, fill: 'ink', k: k(pop(SV, { from: 0.5 }), exit(SX, { s: 0.8 })), ch: [
            icon({ icon: 'check', x: -40, size: 24, sw: 3, color: 'inv' }),
            text({ text: 'Saved', x: -20, ax: 0, size: 24, weight: 600, color: 'inv' }),
          ] }),
          rect({ id: 'rule', y: -196, w: 940, h: 2, fill: 'line', k: fadeIn(0.3) }),
          ...ROWS.map((r, i) => group({ id: 'row' + i, y: TY[i], k: enter(0.34 + i * 0.07, { dx: -14, x0: 0 }), ch: [
            text({ text: r.n, x: -410, y: -18, ax: 0, size: 30, weight: 500 }),
            text({ text: r.s, x: -410, y: 20, ax: 0, size: 24, color: 'muted' }),
          ] })),
          ...ROWS.map(toggle),
          rect({ id: 'rule2', y: 158, w: 820, h: 2, fill: 'line', k: fadeIn(0.5) }),
          text({ id: 'sizeLbl', text: 'Text size', x: -410, y: 204, ax: 0, size: 30, weight: 500, k: enter(0.56, { dx: -14, x0: -410 }) }),
          text({ id: 'sizeVal', x: 410, y: 204, ax: 1, size: 30, weight: 600, num: { suf: ' px' }, value: 16,
            k: k(enter(0.6), { value: [[D0, D1, 18, 'Power2 Smooth']] }) }),
          rect({ id: 'sTrack', y: 258, w: TW, h: 8, r: 4, fill: 'dim', k: fadeIn(0.6), ch: [
            rect({ id: 'sFill', x: -TW / 2, pin: 'l', w: TW * P0, h: 8, r: 4, fill: 'ink', k: { w: [[D0, D1, TW * P1, 'Power2 Smooth']] } }),
            circle({ id: 'sKnob', x: -TW / 2 + TW * P0, d: 40, fill: '#FFFFFF', stroke: 'line', sw: 2, shadow: 3,
              k: k({ x: [[D0, D1, -TW / 2 + TW * P1, 'Power2 Smooth']] }, { scale: [[D0 - 0.08, D0, 1.12, 'Power2 Out'], [D1, D1 + 0.3, 1, 'Power3 Out']] }) }),
          ] }),
        ] }),
      cursorLayer([[0, 600, 330], [0.45, 600, 330], [0.95, 360, -8], [1.2, 360, -8], [1.6, 360, 102], [1.9, 360, 102], [2.3, -78, 266], [D0, -78, 266], [D1, -78 + TW * (P1 - P0), 266], [3.15, -78 + TW * (P1 - P0), 266], [3.75, 330, 350]],
        [C1, C2], [[D0, D1]], { inAt: 0.4 }),
    ];
  },
});

// 10 ─ Confirm dialog: trash → the scene dims, a modal scales in, Delete → modal leaves, the row collapses
{
  const C1 = 1.15, C2 = 2.32, X = C2 + 0.42;
  UIK.define({
    id: 'confirm-dialog', name: 'Confirm dialog', cat: 'system', T: 3.9, cam: { zoom: 1.3, k: { y: [[X + 0.1, X + 0.7, -48, 'Power2 Smooth']] } },
    desc: 'The trash icon on a row is clicked: a full-frame backdrop dims and softens the list while a Delete project? modal scales in. Delete leaves the modal with a quick exit, the backdrop clears, and the row collapses as the rows below slide up and the card tightens.',
    build: () => {
      const TOP = -220, ROW = 96, RY = (i) => -60 + i * ROW;
      const P = [
        { n: 'Old project', m: 'Edited 8 months ago', f: '24 files' },
        { n: 'Website redesign', m: 'Edited today', f: '112 files' },
        { n: 'Q3 report', m: 'Edited yesterday', f: '8 files' },
      ];
      const MW = 760, MH = 380;
      return [
        group({ id: 'list', k: k(cardIn(0.08, 0.7), { blur: [[C1 + 0.05, C1 + 0.35, 4, 'Power2 Out'], [C2 + 0.1, C2 + 0.4, 0, 'Power2 Out']] }), ch: [
          rect({ id: 'card', y: TOP, pin: 't', w: 900, h: 440, r: 44, fill: 'card', shadow: 1, k: { h: [[X + 0.1, X + 0.6, 440 - ROW, 'Power4 Out']] } }),
          text({ id: 'title', text: 'Projects', x: -390, y: -154, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -390 }) }),
          text({ id: 'count3', text: '3 projects', x: 390, y: -154, ax: 1, size: 26, color: 'muted', k: k(enter(0.3), exit(X + 0.1)) }),
          text({ id: 'count2', text: '2 projects', x: 390, y: -154, ax: 1, size: 26, color: 'muted', k: enter(X + 0.12) }),
          rect({ id: 'rule', y: -108, w: 900, h: 2, fill: 'line', k: fadeIn(0.3) }),
          rect({ id: 'hover', y: RY(0), w: 860, h: 84, r: 22, fill: 'soft', k: { opacity: [0, [0.85, 1.0, 1, 'Power2 Out'], [C2 + 0.2, C2 + 0.4, 0, 'Power2 Out']] } }),
          ...P.map((p, i) => {
            const del = i === 0, a = 0.34 + i * 0.08;
            const kk = del ? k(enter(a, { dx: -16, x0: 0 }), { opacity: [[X, X + 0.2, 0, 'Power2 In']], blur: [[X, X + 0.2, 6, 'Power2 In']], sy: [[X, X + 0.3, 0.6, 'Power2 In']] })
                           : k(enter(a, { dx: -16, x0: 0 }), { y: [[X + 0.1, X + 0.6, RY(i - 1), 'Power4 Out']] });
            return group({ id: 'row' + i, y: RY(i), k: kk, ch: [
              i ? rect({ id: 'sep' + i, y: -ROW / 2, w: 860, h: 2, fill: 'line' }) : null,
              rect({ x: -364, w: 64, h: 64, r: 18, fill: 'soft', ch: [icon({ icon: 'folder', size: 30, sw: 2.2, color: 'ink' })] }),
              text({ text: p.n, x: -308, y: -16, ax: 0, size: 30, weight: 500 }),
              text({ text: p.m, x: -308, y: 20, ax: 0, size: 22, color: 'muted' }),
              text({ text: p.f, x: 300, ax: 1, size: 24, color: 'muted' }),
              del ? rect({ id: 'trashBtn', x: 364, w: 60, h: 60, r: 16, fill: 'card', k: k({ opacity: [0, [0.9, 1.05, 1, 'Power2 Out']] }, press(C1, { to: 0.88 })),
                ch: [icon({ icon: 'trash', size: 28, sw: 2.3, color: 'ink' })] }) : null,
            ].filter(Boolean) });
          }),
        ] }),
        rect({ id: 'backdrop', w: 4000, h: 3000, fill: 'shade/40', offscreen: true, k: { opacity: [0, [C1 + 0.05, C1 + 0.3, 1, 'Power2 Out'], [C2 + 0.1, C2 + 0.4, 0, 'Power2 Out']] } }),
        rect({ id: 'modal', w: MW, h: MH, r: 40, fill: 'card', shadow: 2,
          k: { scale: [0.9, [C1 + 0.1, C1 + 0.6, 1, 'Power4 Out'], [C2 + 0.06, C2 + 0.24, 0.94, 'Power2 In']],
               opacity: [0, [C1 + 0.1, C1 + 0.22, 1, 'Linear'], [C2 + 0.06, C2 + 0.24, 0, 'Power2 In']],
               blur: [8, [C1 + 0.1, C1 + 0.36, 0, 'Power2 Out'], [C2 + 0.06, C2 + 0.24, 6, 'Power2 In']] }, ch: [
            circle({ id: 'warnDisc', x: -292, y: -110, d: 80, fill: 'bad/12', k: pop(C1 + 0.2, { from: 0.5 }), ch: [icon({ icon: 'trash', size: 36, sw: 2.4, color: 'bad' })] }),
            text({ id: 'mTitle', text: 'Delete project?', x: -232, y: -110, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(C1 + 0.16, { dx: -14, x0: -232 }) }),
            text({ id: 'mBody', text: '“Old project” and its 24 files will be removed for everyone. This can’t be undone.', x: -332, y: -12, ax: 0, size: 28, color: 'muted', wrap: 640, lh: 1.35, k: enter(C1 + 0.24) }),
            rect({ id: 'cancel', x: 46, y: 118, w: 180, h: 80, r: 40, fill: 'soft', k: enter(C1 + 0.3, { blur: 0 }), ch: [text({ text: 'Cancel', size: 28, weight: 500 })] }),
            rect({ id: 'delete', x: 242, y: 118, w: 180, h: 80, r: 40, fill: 'bad', k: k(enter(C1 + 0.34, { blur: 0 }), press(C2)), ch: [text({ text: 'Delete', size: 28, weight: 600, color: '#FFFFFF' })] }),
          ] }),
        cursorLayer([[0, 600, 300], [0.45, 600, 300], [1.02, 372, -52], [1.3, 372, -52], [2.18, 296, 140], [2.6, 296, 140], [3.2, 520, 250]], [C1, C2], [], { inAt: 0.4 }),
      ];
    },
  });
}

// 11 ─ App update: the button squashes into a progress bar, grows back into Restart, then the card settles
{
  const C1 = 1.05, M = C1 + 0.05, D = 2.8, C2 = 3.25, F = 3.85;
  UIK.define({
    id: 'app-update', name: 'App update', cat: 'system', T: 4.9, cam: { zoom: 1.4, k: { y: [[F + 0.05, F + 0.65, -94, 'Power2 Smooth']] } },
    desc: 'Download is clicked and the button itself squashes into a thin progress bar that fills in bursts while the size counts up; at 86 MB it swells back into a Restart button. A second click spins, then the card tightens round an accent check: Up to date.',
    build: () => {
      const TOP = -190, BW = 800, BY = 100, PY = 118;
      const P = [[1.45, 1.85, 22.8, 'Power3 Out'], [1.95, 2.5, 71.4, 'Linear'], [2.55, 2.76, 86, 'Power3 Out']];
      return [
        group({ id: 'updater', k: cardIn(0.08, 0.7), ch: [
          rect({ id: 'card', y: TOP, pin: 't', w: 900, h: 380, r: 44, fill: 'card', shadow: 1, k: { h: [[F + 0.05, F + 0.65, 192, 'Power4 Out']] } }),
          rect({ id: 'tile', x: -330, y: -94, w: 112, h: 112, r: 30, fill: 'soft', k: enter(0.2, { blur: 0, s: 0.7 }), ch: [
            icon({ id: 'appIcon', icon: 'refresh', size: 50, sw: 2.6, color: 'ink' }),
          ] }),
          rect({ id: 'okTile', x: -330, y: -94, w: 112, h: 112, r: 30, fill: 'acc', k: pop(F + 0.08, { from: 0.6, dur: 0.45 }), ch: [
            path({ id: 'okTick', d: 'M-22 2 L-7 17 L22 -14', stroke: '#FFFFFF', sw: 9, trimmed: true, k: { trimE: [0, [F + 0.18, F + 0.52, 100, 'Power3 Out']] } }),
          ] }),
          text({ id: 'title', text: 'Update available', x: -246, y: -116, ax: 0, size: 40, weight: 600, ls: -0.02, k: k(enter(0.26, { dx: -16, x0: -246 }), exit(F)) }),
          text({ id: 'sub', text: 'Version 2.4.1 · 86 MB', x: -246, y: -72, ax: 0, size: 26, color: 'muted', k: k(enter(0.34), exit(F)) }),
          text({ id: 'title2', text: 'Up to date', x: -246, y: -116, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(F + 0.06, { dx: -16, x0: -246 }) }),
          text({ id: 'sub2', text: 'v2.4.1 · installed just now', x: -246, y: -72, ax: 0, size: 26, color: 'muted', k: enter(F + 0.14) }),
          text({ id: 'dlLbl', text: 'Downloading…', x: -400, y: 74, ax: 0, size: 26, color: 'muted', k: k(enter(M + 0.18), exit(D)) }),
          text({ id: 'dlCount', x: 400, y: 74, ax: 1, size: 26, weight: 500, num: { dec: 1, suf: ' of 86 MB' }, k: k(enter(M + 0.2), { value: P }, exit(D)) }),
          rect({ id: 'btn', y: BY, w: BW, h: 88, r: 44, fill: 'ink',
            k: k(fadeIn(0.4), press(C1, { to: 0.97 }), press(C2, { to: 0.97 }), exit(F, { s: 0.92 }), {
              h: [[M, M + 0.5, 14, 'Expo Out'], [D, D + 0.55, 88, 'Expo Out']],
              y: [[M, M + 0.5, PY, 'Expo Out'], [D, D + 0.55, BY, 'Expo Out']],
              fill: [[M, M + 0.3, 'skel', 'Power2 Out'], [D, D + 0.3, 'ink', 'Power2 Out']] }), ch: [
              text({ id: 'dlBtnLbl', text: 'Download update', size: 30, weight: 600, color: 'inv', k: k(enter(0.44), exit(C1 + 0.02, { dur: 0.1 })) }),
              text({ id: 'restartLbl', text: 'Restart to update', size: 30, weight: 600, color: 'inv', k: k(enter(D + 0.22), exit(C2 + 0.02)) }),
              group({ id: 'restarting', k: k(enter(C2 + 0.04, { d: 0.02 }), exit(F - 0.02)), ch: [
                spinner({ id: 'spin', x: -110, R: 15, sw: 4, color: 'inv', t0: C2 + 0.06, t1: F - 0.02 }),
                text({ text: 'Restarting…', x: -80, ax: 0, size: 30, weight: 600, color: 'inv' }),
              ] }),
            ] }),
          rect({ id: 'pFill', x: -BW / 2, y: PY, pin: 'l', w: 0, h: 14, r: 7, fill: 'ink', k: k({ w: P.map(([a, b, v, e]) => [a, b, BW * v / 86, e]) }, exit(D + 0.05, { dur: 0.2, blur: 0 })) }),
        ] }),
        cursorLayer([[0, 480, 300], [0.4, 480, 300], [0.95, 90, 108], [1.25, 90, 108], [1.75, 440, 250], [2.72, 440, 250], [3.15, 60, 106], [3.4, 60, 106], [3.95, 400, 230]], [C1, C2], [], { inAt: 0.35 }),
      ];
    },
  });
}

// 12 ─ Data table: rows fetch in, a column header click turns its sort arrow and the rows reorder
UIK.define({
  id: 'data-table', name: 'Data table sort', cat: 'system', T: 3.6, cam: 1.25,
  desc: 'Five customer rows fetch in on a stagger under a header band. The cursor clicks the MRR column: its sort arrow turns accent and rotates to descending, and the rows glide into their new order.',
  build: () => {
    const C = 2.0, SY = (s) => -60 + s * 68;
    const R = [
      { n: 'Ana Reyes', plan: 'Pro', joined: 'Mar 2024', mrr: 480 },
      { n: 'Leo Park', plan: 'Team', joined: 'Jan 2023', mrr: 1240 },
      { n: 'Maya Chen', plan: 'Free', joined: 'Jun 2025', mrr: 0 },
      { n: 'Noah Kim', plan: 'Pro', joined: 'Aug 2024', mrr: 620 },
      { n: 'Sam Rivera', plan: 'Team', joined: 'Nov 2022', mrr: 2150 },
    ];
    const order = R.map((r, i) => i).sort((a, b) => R[b].mrr - R[a].mrr);
    R.forEach((r, i) => { r.to = order.indexOf(i); });
    const HL = { size: 20, weight: 600, color: 'muted', ls: 0.06 };
    return [
      rect({ id: 'card', w: 1180, h: 600, r: 40, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Customers', x: -520, y: -226, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -520 }) }),
          group({ id: 'fetching', x: 520, y: -226, k: k(enter(0.3), exit(1.08)), ch: [
            spinner({ id: 'spin', x: -150, R: 12, sw: 3.5, color: 'muted', t0: 0.3, t1: 1.08 }),
            text({ text: 'Fetching…', ax: 1, size: 24, color: 'muted' }),
          ] }),
          text({ id: 'rowsLbl', text: '5 customers', x: 520, y: -226, ax: 1, size: 24, color: 'muted', k: enter(1.1) }),
          rect({ id: 'band', y: -128, w: 1100, h: 52, r: 14, fill: 'panel', k: fadeIn(0.3) }),
          group({ id: 'heads', y: -128, k: enter(0.36), ch: [
            text({ text: 'NAME', x: -520, ax: 0, ...HL }),
            icon({ id: 'nameArrow', icon: 'arrowUp', x: -444, size: 18, sw: 2.6, color: 'muted', k: { opacity: [[C + 0.05, C + 0.25, 0, 'Power2 Out']] } }),
            text({ text: 'PLAN', x: -60, ax: 0, ...HL }),
            text({ text: 'JOINED', x: 160, ax: 0, ...HL }),
            icon({ id: 'mrrArrow', icon: 'arrowUp', x: 452, size: 18, sw: 2.6, color: 'dim',
              k: { color: [[C + 0.02, C + 0.22, 'acc', 'Power2 Out']], rot: [[C + 0.06, C + 0.5, 180, 'Power3 Out']] } }),
            text({ id: 'mrrHead', text: 'MRR', x: 520, ax: 1, ...HL, k: { color: [[C + 0.02, C + 0.22, 'ink', 'Power2 Out']] } }),
          ] }),
          ...[0, 1, 2, 3].map((s) => rect({ id: 'sep' + s, y: SY(s) + 34, w: 1100, h: 2, fill: 'line', k: fadeIn(0.62 + s * 0.09) })),
          // rows sit on opaque card strips so they slide over each other cleanly; the ones moving up paint last and lift
          ...R.map((r, i) => [r, i]).sort((a, b) => (b[0].to - b[1] > 0) - (a[0].to - a[1] > 0) || (a[1] - a[0].to) - (b[1] - b[0].to)).map(([r, i]) => {
            const moves = r.to !== i, G0 = C + 0.1, G1 = C + 0.7;
            return group({ id: 'row' + i, y: SY(i),
            k: k(enter(0.56 + i * 0.09, { dy: 16, y0: SY(i) }), moves ? { y: [[G0, G1, SY(r.to), 'Power4 Out']] } : null), ch: [
              r.to < i ? rect({ id: 'lift' + i, w: 1100, h: 64, r: 16, fill: 'card', shadow: 2,
                k: { opacity: [0, [G0 - 0.04, G0 + 0.08, 1, 'Power2 Out'], [G1 - 0.1, G1 + 0.2, 0, 'Power2 Out']] } }) : null,
              rect({ id: 'strip' + i, w: 1100, h: 64, r: 16, fill: 'card' }),
              text({ text: r.n, x: -520, ax: 0, size: 28, weight: 500 }),
              rect({ x: -60 + 44, w: 88, h: 40, r: 20, fill: 'soft', ch: [text({ text: r.plan, size: 22, weight: 500 })] }),
              text({ text: r.joined, x: 160, ax: 0, size: 26, color: 'muted' }),
              text({ text: '$' + r.mrr.toLocaleString('en-US'), x: 520, ax: 1, size: 28, weight: 600 }),
            ].filter(Boolean) });
          }),
        ] }),
      cursorLayer([[0, 640, 330], [1.35, 640, 330], [1.9, 498, -120], [2.25, 498, -120], [2.8, 660, 40]], [C], [], { inAt: 1.3 }),
    ];
  },
});

// 13 ─ Flow nodes: Run fires a signal dot along each curved connector; nodes flash an accent ring on arrival
UIK.define({
  id: 'flow-nodes', name: 'Flow nodes', cat: 'system', T: 3.9, cam: { zoom: 1.12, y: -60 },
  desc: 'Run is clicked: the Trigger card flashes an accent ring, then an accent dot rides the curved connector (x/y keyed along the curve) while the dotted line turns solid behind it; Filter flashes, the dot rides on to Action, and every node gets a check.',
  build: () => {
    const C = 1.08, W = 320, H = 136;
    const NODES = [
      { x: -500, y: -140, label: 'Trigger', name: 'New order', icon: 'zap' },
      { x: 0, y: 150, label: 'Filter', name: 'Total > $100', icon: 'filter' },
      { x: 500, y: -140, label: 'Action', name: 'Send email', icon: 'mail' },
    ];
    const L1 = [1.34, 2.02], L2 = [2.22, 2.9], FL = [C + 0.1, L1[1], L2[1]];
    const P1 = [[-500, -72], [-500, 90], [-330, 150], [-160, 150]];
    const P2 = [[160, 150], [330, 150], [500, 90], [500, -72]];
    const F1 = follow(P1, L1[0], L1[1]), F2 = follow(P2, L2[0], L2[1]);
    const legTrim = (F) => ({ trimE: [0, ...followSegs(F, (c) => +(c.f * 100).toFixed(2))] });
    const flash = (t) => ({ opacity: [0, [t, t + 0.08, 1, 'Power2 Out'], [t + 0.35, t + 0.85, 0, 'Power2 Out']], scale: [0.97, [t, t + 0.55, 1.06, 'Power3 Out']] });
    return [
      text({ id: 'title', text: 'Order alerts', x: -660, y: -330, ax: 0, size: 38, weight: 600, ls: -0.02, k: enter(0.2, { dx: -16, x0: -660 }) }),
      text({ id: 'sub', text: 'Workflow · 3 steps', x: -660, y: -286, ax: 0, size: 26, color: 'muted', k: enter(0.28) }),
      rect({ id: 'run', x: 590, y: -318, w: 140, h: 64, r: 32, fill: 'ink', k: k(cardIn(0.2, 0.6), press(C)), ch: [
        icon({ icon: 'play', x: -28, size: 22, sw: 2.4, color: 'inv', filled: true, fill: 'inv' }),
        text({ text: 'Run', x: -8, ax: 0, size: 26, weight: 600, color: 'inv' }),
      ] }),
      path({ id: 'wire1', d: bzD(P1), stroke: 'dim', sw: 4, dash: [0.1, 12], k: fadeIn(0.5) }),
      path({ id: 'wire2', d: bzD(P2), stroke: 'dim', sw: 4, dash: [0.1, 12], k: fadeIn(0.56) }),
      path({ id: 'live1', d: bzD(P1), stroke: 'ink', sw: 4, trimmed: true, k: legTrim(F1) }),
      path({ id: 'live2', d: bzD(P2), stroke: 'ink', sw: 4, trimmed: true, k: legTrim(F2) }),
      ...NODES.map((n, i) => rect({ id: 'ring' + i, x: n.x, y: n.y, w: W + 22, h: H + 22, r: 41, stroke: 'acc', sw: 4, k: flash(FL[i]) })),
      ...NODES.map((n, i) => rect({ id: 'node' + i, x: n.x, y: n.y, w: W, h: H, r: 30, fill: 'card', shadow: 1,
        k: k(cardIn(0.1 + i * 0.09, 0.7), { scale: [[FL[i], FL[i] + 0.1, 1.03, 'Power2 Out'], [FL[i] + 0.1, FL[i] + 0.45, 1, 'Power3 Out']] }), ch: [
          rect({ x: -106, w: 64, h: 64, r: 18, fill: 'soft', k: enter(0.26 + i * 0.09, { blur: 0, s: 0.7 }), ch: [icon({ icon: n.icon, size: 32, sw: 2.4, color: 'ink' })] }),
          text({ text: n.label, x: -58, y: -20, ax: 0, size: 22, color: 'muted', k: enter(0.3 + i * 0.09) }),
          text({ text: n.name, x: -58, y: 16, ax: 0, size: 28, weight: 600, ls: -0.01, k: enter(0.34 + i * 0.09, { dx: -12, x0: -58 }) }),
          circle({ id: 'ok' + i, x: W / 2 - 14, y: -H / 2 + 14, d: 38, fill: 'ink', stroke: 'card', sw: 4, k: pop(FL[i] + 0.12), ch: [
            icon({ icon: 'check', size: 20, sw: 3.2, color: 'inv' }),
          ] }),
        ] })),
      ...[P1[0], P1[3], P2[0], P2[3]].map((p, i) => circle({ id: 'port' + i, x: p[0], y: p[1], d: 18, fill: 'card', stroke: 'dim', sw: 3,
        k: k(pop(0.5 + i * 0.05), { stroke: [[[L1[0], L1[1], L2[0], L2[1]][i], [L1[0], L1[1], L2[0], L2[1]][i] + 0.15, 'ink', 'Power2 Out']] }) })),
      circle({ id: 'signal', x: P1[0][0], y: P1[0][1], d: 22, fill: 'acc', stroke: 'card', sw: 4,
        k: { x: [P1[0][0], ...followSegs(F1, (c) => c.p[0]), [2.12, P2[0][0]], ...followSegs(F2, (c) => c.p[0])],
             y: [P1[0][1], ...followSegs(F1, (c) => c.p[1]), [2.12, P2[0][1]], ...followSegs(F2, (c) => c.p[1])],
             scale: [0, [L1[0] - 0.08, L1[0] + 0.1, 1, 'Back Out'], [L1[1] - 0.06, L1[1] + 0.06, 0, 'Power2 In'], [L2[0] - 0.08, L2[0] + 0.1, 1, 'Back Out'], [L2[1] - 0.06, L2[1] + 0.06, 0, 'Power2 In']] } }),
      cursorLayer([[0, 760, -60], [0.5, 760, -60], [1.0, 600, -304], [1.3, 600, -304], [1.9, 720, -150]], [C], [], { inAt: 0.45 }),
    ];
  },
});

// 14 ─ Storage meter: one sweep reveals the stacked bar; Clean up shrinks Other and counts the freed space
UIK.define({
  id: 'storage-meter', name: 'Storage meter', cat: 'system', T: 3.8, cam: 1.35,
  desc: 'A single reveal sweeps the stacked storage bar in (one clip window growing over four segments) while the used total counts up. Clean up is clicked: the accent Other segment shrinks back, the used figure drops and a +4.2 GB freed chip counts up.',
  build: () => {
    const C = 2.0, BW = 900, BH = 44, GB = BW / 64, GAP = 5;
    const S = [{ n: 'Photos', v: 22.4, c: 'ink' }, { n: 'Video', v: 14.8, c: 'ink/55' }, { n: 'Apps', v: 11.2, c: 'ink/25' }, { n: 'Other', v: 9.6, c: 'acc', to: 5.4 }];
    let run = 0;
    S.forEach((s) => { s.x = run * GB; s.w = s.v * GB - GAP; run += s.v; });
    const A = C + 0.1, Z = A + 0.7;
    return [
      rect({ id: 'card', w: 1000, h: 520, r: 44, fill: 'card', shadow: 1, k: cardIn(),
        ch: [
          text({ id: 'title', text: 'Storage', x: -450, y: -182, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -450 }) }),
          rect({ id: 'clean', x: 355, y: -182, w: 190, h: 64, r: 32, fill: 'soft', k: k(enter(0.3, { blur: 0, s: 0.8 }), press(C)), ch: [
            group({ id: 'cleanA', k: exit(Z), ch: [
              icon({ icon: 'sparkle', x: -58, size: 24, sw: 2.2, color: 'ink' }),
              text({ text: 'Clean up', x: -36, ax: 0, size: 26, weight: 500 }),
            ] }),
            group({ id: 'cleanB', k: enter(Z), ch: [
              icon({ icon: 'check', x: -40, size: 24, sw: 3, color: 'ink' }),
              text({ text: 'Done', x: -18, ax: 0, size: 26, weight: 500 }),
            ] }),
          ] }),
          text({ id: 'used', x: -450, y: -64, ax: 0, size: 72, weight: 600, ls: -0.03, num: { dec: 1, suf: ' GB' },
            k: k(enter(0.3), { value: [[0.5, 1.5, 58, 'Power3 Out'], [A, Z, 53.8, 'Power3 Out']] }) }),
          text({ id: 'usedLbl', text: 'used of 64 GB', x: -450, y: -6, ax: 0, size: 26, color: 'muted', k: enter(0.38) }),
          rect({ id: 'freed', x: 330, y: -58, w: 230, h: 56, r: 28, fill: 'acc/12', k: pop(A + 0.06, { from: 0.5 }), ch: [
            text({ x: 0, size: 26, weight: 600, color: 'acc', num: { pre: '+', dec: 1, suf: ' GB freed' }, k: { value: [[A + 0.06, Z + 0.1, 4.2, 'Power3 Out']] } }),
          ] }),
          rect({ id: 'bar', y: 76, w: BW, h: BH, r: BH / 2, fill: 'skel', clip: true, k: fadeIn(0.34), ch: [
            rect({ id: 'reveal', x: -BW / 2, pin: 'l', chAt: 'pin', w: 0, h: BH, clip: true, k: { w: [[0.5, 1.5, BW, 'Power3 Out']] },
              ch: S.map((s, i) => rect({ id: 'seg' + i, x: s.x, pin: 'l', w: s.w, h: BH, fill: s.c,
                k: s.to != null ? { w: [[A, Z, s.to * GB - GAP, 'Power4 Out']] } : undefined })) }),
          ] }),
          ...S.map((s, i) => group({ id: 'legend' + i, x: -450 + i * 230, y: 176, k: enter(0.6 + i * 0.08, { dy: 12, y0: 176 }), ch: [
            circle({ x: 9, y: -16, d: 18, fill: s.c }),
            text({ text: s.n, x: 30, y: -16, ax: 0, size: 26, weight: 500 }),
            s.to != null
              ? text({ x: 30, y: 20, ax: 0, size: 24, color: 'muted', num: { dec: 1, suf: ' GB' }, value: s.v, k: { value: [[A, Z, s.to, 'Power3 Out']] } })
              : text({ text: s.v.toFixed(1) + ' GB', x: 30, y: 20, ax: 0, size: 24, color: 'muted' }),
          ] })),
        ] }),
      cursorLayer([[0, 620, 330], [1.35, 620, 330], [1.9, 362, -172], [2.3, 362, -172], [2.85, 560, 250]], [C], [], { inAt: 1.3 }),
    ];
  },
});

// 15 ─ Permission prompt: the card drops in, Allow shrinks it into a live camera status pill
{
  const C = 1.5;
  UIK.define({
    id: 'permission-prompt', name: 'Permission prompt', cat: 'system', T: 3.7,
    cam: { zoom: 1.5, k: { zoom: [[C + 0.05, C + 0.75, 2.3, 'Power2 Smooth']] } },
    desc: 'An Allow camera access? card drops in from above with a blur. Allow is clicked and the card itself shrinks into a small ink status pill — the prompt blurs out, a camera icon and Camera on blur in, and an accent live dot keeps pulsing.',
    build: () => {
      const M = C + 0.06;
      return [
        rect({ id: 'prompt', w: 760, h: 420, r: 44, fill: 'card', shadow: 2, clip: true,
          k: { y: [-150, [0.1, 0.8, 0, 'Power4 Out']], opacity: [0, [0.1, 0.24, 1, 'Linear']], blur: [12, [0.1, 0.45, 0, 'Power2 Out']],
               scale: [0.94, [0.1, 0.8, 1, 'Power4 Out']],
               w: [[M, M + 0.65, 320, 'Expo Out']], h: [[M, M + 0.65, 84, 'Expo Out']], fill: [[M, M + 0.3, 'ink', 'Power2 Out']] }, ch: [
            group({ id: 'ask', k: exit(C + 0.03, { dur: 0.13, s: 0.92 }), ch: [
              rect({ id: 'tile', y: -112, w: 96, h: 96, r: 28, fill: 'soft', k: enter(0.3, { blur: 0, s: 0.7 }), ch: [icon({ icon: 'video', size: 46, sw: 2.4, color: 'ink' })] }),
              text({ id: 'q', text: 'Allow camera access?', y: -20, size: 40, weight: 600, ls: -0.02, k: enter(0.36, { dy: 12, y0: -20 }) }),
              text({ id: 'why', text: 'Needed to join the video call', y: 28, size: 28, color: 'muted', k: enter(0.44) }),
              rect({ id: 'deny', x: -170, y: 118, w: 320, h: 84, r: 42, fill: 'soft', k: enter(0.5, { blur: 0 }), ch: [text({ text: 'Don’t allow', size: 28, weight: 500 })] }),
              rect({ id: 'allow', x: 170, y: 118, w: 320, h: 84, r: 42, fill: 'ink', k: k(enter(0.56, { blur: 0 }), press(C)), ch: [text({ text: 'Allow', size: 28, weight: 600, color: 'inv' })] }),
            ] }),
            group({ id: 'pill', k: enter(M + 0.22, { d: 0, blur: 8 }), ch: [
              icon({ id: 'cam', icon: 'video', x: -108, size: 32, sw: 2.4, color: 'inv' }),
              text({ id: 'camOn', text: 'Camera on', x: -80, ax: 0, size: 28, weight: 500, color: 'inv' }),
              circle({ id: 'liveDot', x: 114, d: 16, fill: 'acc', k: k(pop(M + 0.4), { scale: pulse(M + 0.9, 3.7, 0.55, 0.8) }) }),
            ] }),
          ] }),
        cursorLayer([[0, 520, 330], [0.62, 520, 330], [1.3, 186, 128], [1.62, 186, 128], [2.25, 250, 170]], [C], [], { inAt: 0.58 }),
      ];
    },
  });
}
})();
