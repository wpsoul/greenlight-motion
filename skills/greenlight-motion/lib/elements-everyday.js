/* UI Motion Kit — everyday elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// the kit's opening beat: the main shape pops in from empty
const cardIn = (t = 0.08, s = 0.7) => ({ scale: [s, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (hairlines, tracks — things that should not scale or blur in)
const fadeIn = (t) => enter(t, { blur: 0, s: 1 });
// a closed circle for Trim Paths, starting at 12 o'clock and running clockwise
const RING = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// deterministic 0…1 noise — frames stay a pure function of t
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const r1 = (v) => Math.round(v * 10) / 10;
// time fraction u (0…1) at which a VE easing reaches progress p — keys tracks that must meet an eased move
const invEase = (name, p) => {
  const f = UIK.ease(name); let a = 0, b = 1;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(m) < p) a = m; else b = m; }
  return (a + b) / 2;
};
// a polyline's cumulative lengths
const cumLen = (P) => P.reduce((a, p, i) => { a.push(i ? a[i - 1] + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0); return a; }, []);
// smooth curve through points (Catmull-Rom → cubic Béziers)
const smooth = (P) => {
  let d = `M${P[0][0]} ${P[0][1]}`;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
    d += ` C${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)} ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  return d;
};

// 1 ─ Analog clock: ticks draw in, hands swing into place from twelve, the second hand keeps sweeping
UIK.define({
  id: 'analog-clock', name: 'Analog clock', cat: 'everyday', T: 3.6, cam: { zoom: 1.25, x: -16 },
  desc: 'Twelve ticks draw in round the dial one after another, the hour and minute hands swing from twelve into place (rotating on their base) while the accent second hand settles and keeps sweeping; the digital time slides in beside it and ticks in sync.',
  build: () => {
    const T = 3.6, H0 = 0.62, SET = 1.8, SEC = 31, SA = SEC * 6;
    const ticks = Array.from({ length: 12 }, (_, i) => {
      const a = i * Math.PI / 6, major = i % 3 === 0, h = major ? 40 : 24, R = 236, t = 0.26 + i * 0.045;
      // the tick's origin is its outer end (its local top): the box turns and grows from there
      return rect({ id: 'tick' + i, x: r1(R * Math.sin(a)), y: r1(-R * Math.cos(a) + h / 2), w: major ? 10 : 6, h, r: 3, rot: i * 30, origin: [0, -0.5],
        fill: major ? 'ink' : 'dim', k: { opacity: [0, [t, t + 0.1, 1, 'Linear']], sy: [0, [t, t + 0.42, 1, 'Power3 Out']] } });
    });
    const NUMS = [['12', 0, -166], ['3', 170, 0], ['6', 0, 170], ['9', -170, 0]];
    return [
      circle({ id: 'face', x: -300, d: 548, fill: 'card', shadow: 1, k: cardIn(0.08, 0.6), ch: [
        ...ticks,
        ...NUMS.map(([s, x, y], i) => text({ id: 'num' + s, text: s, x, y, size: 44, weight: 600, ls: -0.02, tnum: false, k: enter(0.5 + i * 0.06, { s: 0.8 }) })),
        group({ id: 'hands', k: pop(0.52, { from: 0.4, dur: 0.5 }), ch: [
          rect({ id: 'hourHand', pin: 'b', w: 18, h: 128, r: 9, fill: 'ink', k: { rot: [0, [H0, SET - 0.12, 304, 'Expo Out']] } }),
          rect({ id: 'minuteHand', pin: 'b', w: 12, h: 198, r: 6, fill: 'ink', k: { rot: [0, [H0 + 0.06, SET, 408, 'Expo Out']] } }),
          circle({ id: 'cap', d: 34, fill: 'ink' }),
          path({ id: 'secondHand', d: 'M0 46 L0 -214', stroke: 'acc', sw: 5,
            k: { rot: [0, [H0 + 0.1, SET, SA, 'Expo Out'], [SET, T, SA + 6 * (T - SET), 'Linear']] } }),
          circle({ id: 'secondHub', d: 18, fill: 'acc' }),
          circle({ id: 'pivot', d: 6, fill: 'card' }),
        ] }),
      ] }),
      text({ id: 'city', text: 'Lisbon', x: 60, y: -104, ax: 0, size: 34, weight: 500, color: 'muted', k: enter(0.45, { dx: -14, x0: 60 }) }),
      text({ id: 'digital', x: 54, y: -8, ax: 0, size: 116, weight: 600, ls: -0.03, num: { pre: '10:08:', pad: 2, sep: false, floor: true }, value: SEC,
        k: k(enter(1.38, { dx: -22, x0: 54 }), { value: [[SET, T, SEC + (T - SET), 'Linear']] }) }),
      text({ id: 'date', text: 'Wednesday, 25 September', x: 60, y: 84, ax: 0, size: 32, color: 'muted', k: enter(1.52, { dx: -14, x0: 60 }) }),
    ];
  },
});

// 2 ─ Weather card: the sun turns, the temperature counts up, hourly columns land, a curve draws through them
UIK.define({
  id: 'weather-card', name: 'Weather card', cat: 'everyday', T: 3.5, cam: 1.3,
  desc: 'The card pops in, a big accent sun turns slowly for the whole shot while the temperature counts up to 24°; six hourly columns rise in on a stagger, then a thin temperature curve draws through them (Trim Paths) and each hour’s point pops as the line reaches it.',
  build: () => {
    const T = 3.5, C0 = 1.28, CD = 1.2;
    const HR = [['Now', 'sun', 24], ['11:00', 'sun', 26], ['12:00', 'cloud', 27], ['13:00', 'cloud', 26], ['14:00', 'sun', 24], ['15:00', 'cloud', 22]];
    const XS = HR.map((_, i) => -375 + i * 150);
    const P = HR.map((h, i) => [XS[i], 196 - (h[2] - 20) * 13]);
    const cum = cumLen(P), LEN = cum[cum.length - 1];
    const TI = cum.map((c) => C0 + CD * invEase('Power2 Smooth', c / LEN));
    return [
      rect({ id: 'card', w: 1040, h: 640, r: 44, fill: 'card', shadow: 1, k: cardIn(), ch: [
        icon({ id: 'sun', icon: 'sun', x: -404, y: -198, size: 124, color: 'acc', sw: 6, k: k(pop(0.22, { from: 0.5, dur: 0.5 }), { rot: [[0.22, T, 70, 'Linear']] }) }),
        text({ id: 'temp', x: -318, y: -194, ax: 0, size: 136, weight: 600, ls: -0.04, num: { suf: '°' }, value: 16,
          k: k(enter(0.28, { dx: -16, x0: -318 }), { value: [[0.4, 1.5, 24, 'Power3 Out']] }) }),
        text({ id: 'city', text: 'Lisbon', x: 460, y: -236, ax: 1, size: 44, weight: 600, ls: -0.02, k: enter(0.3) }),
        text({ id: 'cond', text: 'Mostly sunny', x: 460, y: -188, ax: 1, size: 28, color: 'muted', k: enter(0.38) }),
        text({ id: 'hilo', text: 'H 27°  ·  L 18°', x: 460, y: -148, ax: 1, size: 26, color: 'muted', k: enter(0.44) }),
        rect({ id: 'rule', y: -76, w: 940, h: 2, fill: 'line', k: fadeIn(0.5) }),
        ...HR.map((h, i) => group({ id: 'col' + i, x: XS[i], k: enter(0.7 + i * 0.08, { dy: 18, y0: 0 }), ch: [
          text({ id: 'hour' + i, text: h[0], y: -20, size: 26, weight: i ? 400 : 600, color: i ? 'muted' : 'ink' }),
          icon({ id: 'hIcon' + i, icon: h[1], y: 42, size: 42, sw: 2.4, color: 'ink' }),
          text({ id: 'hTemp' + i, text: h[2] + '°', y: 244, size: 30, weight: 600, tnum: false }),
        ] })),
        path({ id: 'curve', d: smooth(P), stroke: 'ink', sw: 4, trimmed: true, k: { trimE: [0, [C0, C0 + CD, 100, 'Power2 Smooth']] } }),
        ...P.map((p, i) => circle({ id: 'pt' + i, x: p[0], y: p[1], d: 20, fill: i ? 'card' : 'ink', stroke: 'ink', sw: 4, k: pop(Math.max(C0, TI[i] - 0.05), { dur: 0.36 }) })),
      ] }),
    ];
  },
});

// 3 ─ Stopwatch: Start → the time runs, two laps slide in at the top of the list, Stop → Start again
UIK.define({
  id: 'stopwatch', name: 'Stopwatch', cat: 'everyday', T: 4.5, cam: 1.3,
  desc: 'Start is clicked: the button turns accent and reads Stop while the time runs in hundredths. Lap is clicked twice — each lap row slides in at the top of the list and pushes the older one down — then Stop swaps the button back to Start and Lap becomes Reset.',
  build: () => {
    const S = 0.95, L1 = 1.8, L2 = 2.75, P = 3.7, BY = 6, LX = -176, SX = 176, R0 = 140, R1 = 214;
    const lapRow = (id, n, v, y, extra) => group({ id, y, k: k(enter(n === 1 ? L1 : L2, { dy: -20, y0: y }), extra), ch: [
      text({ id: id + 'Name', text: 'Lap ' + n, x: -340, ax: 0, size: 32, weight: 500 }),
      text({ id: id + 'Time', text: v, x: 340, ax: 1, size: 32, weight: 600 }),
      rect({ id: id + 'Rule', y: 37, w: 680, h: 2, fill: 'line' }),
    ] });
    return [
      rect({ id: 'card', w: 780, h: 640, r: 48, fill: 'card', shadow: 1, k: cardIn(), ch: [
        text({ id: 'label', text: 'Stopwatch', y: -246, size: 30, weight: 500, color: 'muted', k: enter(0.22) }),
        text({ id: 'time', y: -146, size: 132, weight: 600, ls: -0.03, num: { pre: '00:', dec: 2, pad: 5, sep: false, floor: true },
          k: k(enter(0.28), { value: [[S, P, P - S, 'Linear']] }) }),
        group({ id: 'controls', y: BY, k: enter(0.36, { dy: 14, y0: BY }), ch: [
          rect({ id: 'lapBtn', x: LX, w: 316, h: 108, r: 54, fill: 'soft', k: k(press(L1), press(L2)), ch: [
            text({ id: 'lapLbl', text: 'Lap', size: 36, weight: 600, k: exit(P) }),
            text({ id: 'resetLbl', text: 'Reset', size: 36, weight: 600, k: enter(P) }),
          ] }),
          rect({ id: 'startBtn', x: SX, w: 316, h: 108, r: 54, fill: 'ink', k: k(press(S), press(P)), ch: [
            // the accent opens from the centre and closes back into it (an iris), so ink and accent never crossfade
            rect({ id: 'stopFill', w: 316, h: 108, r: 54, fill: 'acc', k: { opacity: [0, [S, S + 0.06, 1, 'Linear'], [P + 0.16, P + 0.22, 0, 'Linear']],
              sx: [0.3, [S, S + 0.4, 1, 'Power4 Out'], [P, P + 0.22, 0.3, 'Power2 In']], sy: [0.3, [S, S + 0.4, 1, 'Power4 Out'], [P, P + 0.22, 0.3, 'Power2 In']] } }),
            text({ id: 'startLbl', text: 'Start', size: 36, weight: 600, color: 'inv', k: exit(S) }),
            text({ id: 'stopLbl', text: 'Stop', size: 36, weight: 600, color: '#FFFFFF', k: k(enter(S), exit(P)) }),
            text({ id: 'startLbl2', text: 'Start', size: 36, weight: 600, color: 'inv', k: enter(P) }),
          ] }),
        ] }),
        rect({ id: 'listRule', y: 94, w: 680, h: 2, fill: 'line', k: fadeIn(0.42) }),
        lapRow('lap1', 1, '00:00.85', R0, { y: [[L2, L2 + 0.45, R1, 'Power3 Out']] }),
        lapRow('lap2', 2, '00:00.95', R0),
      ] }),
      cursorLayer([[0, 420, 330], [0.4, 420, 330], [S - 0.09, SX + 14, BY + 16], [S + 0.25, SX + 14, BY + 16], [L1 - 0.1, LX + 12, BY + 18],
        [L1 + 0.2, LX + 12, BY + 18], [L2 - 0.1, LX + 16, BY + 14], [L2 + 0.2, LX + 16, BY + 14], [P - 0.1, SX + 14, BY + 16], [P + 0.25, SX + 14, BY + 16], [4.4, 300, 250]],
        [S, L1, L2, P], [], { inAt: 0.38 }),
    ];
  },
});

// 4 ─ Drag to create an event: the cursor drags down a time column, an accent block grows with it
UIK.define({
  id: 'event-drag', name: 'Drag to create event', cat: 'everyday', T: 3.9, cam: 1.2,
  desc: 'A week grid settles in. The cursor presses in Wednesday at 10:00 and drags down: an accent event block grows from its top edge with the cursor while its time range snaps 10:30 → 11:00 → 11:30; on release the range steps down a line and the title types in.',
  build: () => {
    const GX = -450, CW = 200, GT = -190, RH = 100, D0 = 1.05, G0 = D0 + 0.1, D1 = 2.05;
    const colX = (c) => GX + CW * (c + 0.5), rowY = (hr) => GT + (hr - 9) * RH;
    const snap = (p) => G0 + (D1 - G0) * invEase('Sine Smooth', p);
    const TA = snap(0.25), TB = snap(0.75), TY = D1 + 0.12;
    const DAYS = ['Mon 22', 'Tue 23', 'Wed 24', 'Thu 25', 'Fri 26'];
    const EV = [{ c: 0, a: 9, b: 10, n: 'Standup', s: '9:00 – 10:00' }, { c: 1, a: 11, b: 12.5, n: 'Roadmap', s: '11:00 – 12:30' },
      { c: 3, a: 9.5, b: 11, n: '1:1 with Ana', s: '9:30 – 11:00' }, { c: 4, a: 12, b: 13, n: 'Lunch', s: '12:00 – 13:00' }, { c: 2, a: 12.5, b: 13.5, n: 'Hiring sync', s: '12:30 – 13:30' }];
    const range = (id, s, op) => text({ id, text: s, x: -80, y: 25, ax: 0, size: 21, weight: 500, color: '#FFFFFF',
      k: { opacity: op, y: [[TY, TY + 0.4, 60, 'Power3 Out']] } });
    return [
      rect({ id: 'card', w: 1180, h: 720, r: 40, fill: 'card', shadow: 1, k: cardIn(), ch: [
        text({ id: 'title', text: 'This week', x: -550, y: -300, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.22) }),
        rect({ id: 'viewChip', x: 490, y: -300, w: 120, h: 52, r: 26, fill: 'soft', k: enter(0.3), ch: [text({ text: 'Week', size: 24, weight: 500 })] }),
        rect({ id: 'todayPill', x: colX(2), y: -240, w: 116, h: 44, r: 22, fill: 'ink', k: enter(0.34, { blur: 0 }) }),
        ...DAYS.map((d, i) => text({ id: 'day' + i, text: d, x: colX(i), y: -240, size: 24, weight: i === 2 ? 600 : 500, color: i === 2 ? 'inv' : 'muted', k: enter(0.3 + i * 0.04) })),
        ...[0, 1, 2, 3, 4, 5].map((i) => rect({ id: 'hLine' + i, x: 50, y: GT + i * RH, w: 1000, h: 2, fill: 'line', k: fadeIn(0.32 + i * 0.03) })),
        ...[0, 1, 2, 3, 4].map((i) => rect({ id: 'vLine' + i, x: GX + i * CW, y: GT + 250, w: 2, h: 500, fill: 'line', k: fadeIn(0.34) })),
        ...['9 AM', '10 AM', '11 AM', '12 PM', '1 PM'].map((s, i) => text({ id: 'hr' + i, text: s, x: GX - 18, y: GT + i * RH, ax: 1, size: 21, color: 'muted', k: enter(0.36 + i * 0.04) })),
        ...EV.map((e, i) => rect({ id: 'ev' + i, x: colX(e.c), y: rowY(e.a) + 3, pin: 't', chAt: 'pin', w: CW - 12, h: (e.b - e.a) * RH - 6, r: 14, fill: 'soft',
          k: enter(0.5 + i * 0.06, { blur: 6 }), ch: [
            rect({ x: -88, y: ((e.b - e.a) * RH - 6) / 2, w: 5, h: (e.b - e.a) * RH - 26, r: 3, fill: 'ink/30' }),
            text({ text: e.n, x: -74, y: 26, ax: 0, size: 22, weight: 600 }),
            text({ text: e.s, x: -74, y: 54, ax: 0, size: 19, color: 'muted' }),
          ] })),
        rect({ id: 'newEvent', x: colX(2), y: rowY(10) + 3, pin: 't', chAt: 'pin', w: CW - 12, h: 44, r: 14, fill: 'acc', shadow: 3,
          k: { opacity: [0, [D0, D0 + 0.1, 1, 'Linear']], scale: [0.9, [D0, D0 + 0.35, 1, 'Back Out']], h: [[G0, D1, 144, 'Sine Smooth']] }, ch: [
            range('range0', '10:00 – 10:30', [0, [D0 + 0.04, D0 + 0.14, 1, 'Linear'], [TA, 0]]),
            range('range1', '10:00 – 11:00', [0, [TA, 1], [TB, 0]]),
            range('range2', '10:00 – 11:30', [0, [TB, 1]]),
            text({ id: 'evTitle', text: 'Design sync', x: -80, y: 27, ax: 0, size: 25, weight: 600, color: '#FFFFFF', caret: true, caretColor: '#FFFFFF', caretFrom: TY + 0.1, caretUntil: TY + 1.2,
              k: { opacity: [0, [TY + 0.08, TY + 0.1, 1, 'Linear']], reveal: [0, [TY + 0.3, TY + 0.85, 1, 'Linear']] } }),
            rect({ id: 'grip', y: 34, w: 36, h: 5, r: 3, fill: '#FFFFFF', k: { y: [34, [G0, D1, 134, 'Sine Smooth']], opacity: [0, [D0 + 0.1, D0 + 0.2, 0.7, 'Linear'], [D1 + 0.05, D1 + 0.25, 0, 'Linear']] } }),
          ] }),
      ] }),
      cursorLayer([[0, 520, 330], [0.45, 520, 330], [D0 - 0.08, 64, -68], [G0, 64, -68], [D1, 64, 32], [D1 + 0.3, 64, 32], [3.4, 330, 250]], [], [[D0, D1]], { inAt: 0.42 }),
    ];
  },
});

// 5 ─ Route map: the route draws between two pins, a puck drives it, the ETA sheet counts down
UIK.define({
  id: 'route-map', name: 'Route map', cat: 'everyday', T: 4.8, cam: 1.2,
  desc: 'A stylised street map pops in and both pins drop; the route draws between them (Trim Paths), an ETA sheet slides up from the bottom edge, then a puck drives the route corner to corner — the road behind it greys out while the minutes count down — and arrives: the pin bumps and the sheet reads Arrived.',
  build: () => {
    const XE = [[-560, -358], [-322, -78], [-42, 202], [238, 560]], YE = [[-360, -218], [-182, 2], [38, 360]];
    const P = [[-340, 120], [-340, 20], [220, 20], [220, -200], [430, -200]], N = P.length;
    const d = 'M' + P.map((p) => p.join(' ')).join(' L');
    const R0 = 0.85, R1 = 1.85, TR0 = 2.25, TR1 = 3.95, SH = 1.65, SY = 262;
    const cum = cumLen(P), LEN = cum[N - 1];
    const TI = cum.map((c) => +(TR0 + (TR1 - TR0) * invEase('Power2 Smooth', c / LEN)).toFixed(4));
    const seg = (fn) => P.slice(1).map((p, j) => [TI[j], TI[j + 1], fn(p, j + 1), 'Linear']);
    const blocks = [];
    XE.forEach((xe, c) => YE.forEach((ye, r) => blocks.push(rect({ id: `block${r}${c}`, x: (xe[0] + xe[1]) / 2, y: (ye[0] + ye[1]) / 2, w: xe[1] - xe[0], h: ye[1] - ye[0], r: 18,
      fill: r === 0 && c === 1 ? 'ink/10' : 'skel' }))));
    return [
      rect({ id: 'map', w: 1100, h: 700, r: 40, fill: 'card', shadow: 1, clip: true, k: cardIn(), ch: [
        group({ id: 'blocks', k: enter(0.2, { blur: 0, s: 1.03 }), ch: blocks }),
        path({ id: 'routeBase', d, stroke: 'ink/22', sw: 12, trimmed: true, k: { trimE: [0, [R0, R1, 100, 'Power2 Smooth']] } }),
        path({ id: 'route', d, stroke: 'ink', sw: 12, trimmed: true, k: { trimE: [0, [R0, R1, 100, 'Power2 Smooth']], trimS: [0, ...seg((p, i) => +(cum[i] / LEN * 100).toFixed(3))] } }),
        circle({ id: 'start', x: P[0][0], y: P[0][1], d: 30, fill: 'card', stroke: 'ink', sw: 8, k: pop(0.5) }),
        circle({ id: 'puck', x: P[0][0], y: P[0][1], d: 40, fill: 'ink', stroke: 'card', sw: 8, shadow: 3,
          k: k(pop(TR0 - 0.3, { from: 0.4 }), { x: [P[0][0], ...seg((p) => p[0])], y: [P[0][1], ...seg((p) => p[1])] }) }),
        icon({ id: 'destPin', icon: 'pin', x: P[N - 1][0], y: P[N - 1][1] - 28, size: 72, color: '#FFFFFF', filled: true, fill: 'acc', sw: 2.2, origin: [0, 0.4167],
          k: k(pop(0.62, { from: 0.3 }), { scale: [[TR1, TR1 + 0.12, 1.2, 'Power2 Out'], [TR1 + 0.12, TR1 + 0.5, 1, 'Power3 Out']] }) }),
        rect({ id: 'sheet', y: SY, w: 1020, h: 140, r: 32, fill: 'card', shadow: 2, k: { y: [SY + 240, [SH, SH + 0.6, SY, 'Power4 Out']] }, ch: [
          text({ id: 'eta', x: -450, y: -16, ax: 0, size: 52, weight: 600, ls: -0.02, num: { suf: ' min' }, value: 12,
            k: k({ value: [[TR0, TR1 - 0.1, 1, 'Linear']] }, exit(TR1)) }),
          text({ id: 'arrived', text: 'Arrived', x: -450, y: -16, ax: 0, size: 52, weight: 600, ls: -0.02, k: enter(TR1) }),
          text({ id: 'dest', text: 'Rua Augusta 24 · 3.4 km', x: -448, y: 34, ax: 0, size: 26, color: 'muted' }),
          rect({ id: 'endBtn', x: 400, w: 150, h: 72, r: 36, fill: 'ink', ch: [text({ text: 'End', size: 28, weight: 600, color: 'inv' })] }),
        ] }),
      ] }),
    ];
  },
});

// 6 ─ Photo select: three taps shrink three photos under numbered accent badges; an action bar slides up
UIK.define({
  id: 'photo-select', name: 'Photo select', cat: 'everyday', T: 3.6, cam: 0.86,
  desc: 'A 3×3 photo grid ripples in. The cursor taps three photos: each shrinks inside its cell and a numbered accent badge pops on it; the first tap slides an action bar up from the bottom edge, and its count rolls 1 → 2 → 3 before the cursor settles on Share.',
  build: () => {
    const S = 236, PITCH = 246, GY = -252, TAPS = [1.0, 1.6, 2.2], SEL = { 1: 0, 5: 1, 6: 2 }, BAR = TAPS[0] + 0.1, BY = 426, HOV = 2.98;
    // token-coloured compositions: [base fill, shapes] — sky/sun/ridge, night, still life, arch, stripes, sunset, circles, peaks, vase
    const COMPS = [
      ['skel', [circle({ x: 52, y: -46, d: 56, fill: 'card' }), path({ d: 'M-118 118 L-118 58 L-40 -8 L14 42 L58 8 L118 62 L118 118 Z', fill: 'ink/25' })]],
      ['ink/80', [circle({ x: -46, y: -50, d: 46, fill: 'card/90' }), rect({ y: 86, w: 236, h: 64, fill: 'ink' })]],
      ['soft', [ellipse({ y: 86, w: 150, h: 24, fill: 'ink/10' }), circle({ y: 8, d: 140, fill: 'dim' })]],
      ['dim', [rect({ y: 40, w: 124, h: 172, radii: '62px 62px 0 0', fill: 'panel' }), rect({ y: 108, w: 236, h: 22, fill: 'ink/20' })]],
      ['panel', [-1, 0, 1].map((j) => rect({ x: j * 84, w: 34, h: 380, rot: 30, fill: 'ink/12' }))],
      ['ink/15', [circle({ y: 8, d: 66, fill: 'card' }), rect({ y: 72, w: 236, h: 124, fill: 'ink/40' })]],
      ['skel', [circle({ x: -30, y: 26, d: 104, fill: 'ink/60' }), circle({ x: 48, y: -38, d: 64, fill: 'card' })]],
      ['ink/60', [circle({ x: 58, y: -66, d: 32, fill: 'card/80' }), path({ d: 'M-118 118 L-118 40 L-50 -40 L10 30 L60 -8 L118 50 L118 118 Z', fill: 'ink/90' })]],
      ['soft', [rect({ x: -28, y: 34, w: 72, h: 136, r: 36, fill: 'ink/35' }), circle({ x: 50, y: 66, d: 72, fill: 'dim' })]],
    ];
    const photos = COMPS.map(([fill, shapes], i) => {
      const c = i % 3, r = Math.floor(i / 3), s = SEL[i], t = s != null ? TAPS[s] : 0;
      return rect({ id: 'photo' + i, x: (c - 1) * PITCH, y: GY + r * PITCH, w: S, h: S, r: 18, fill, clip: true,
        k: k(enter(0.24 + (r + c) * 0.05, { blur: 6, s: 0.9 }), s != null ? { scale: [[t - 0.05, t + 0.35, 0.86, 'Power3 Out']] } : null),
        ch: shapes.concat(s != null ? [circle({ id: 'badge' + s, x: 80, y: -80, d: 56, fill: 'acc', stroke: '#FFFFFF', sw: 4, k: pop(t + 0.04),
          ch: [text({ text: String(s + 1), y: -1, size: 27, weight: 600, color: '#FFFFFF', tnum: false })] })] : []) });
    });
    return [
      rect({ id: 'card', w: 780, h: 980, r: 52, fill: 'card', shadow: 1, clip: true, k: cardIn(0.08, 0.75), ch: [
        text({ id: 'title', text: 'Recents', x: -364, y: -422, ax: 0, size: 46, weight: 600, ls: -0.02, k: enter(0.2, { dx: -14, x0: -364 }) }),
        text({ id: 'select', text: 'Select', x: 364, y: -422, ax: 1, size: 30, weight: 500, k: k(enter(0.28), exit(TAPS[0])) }),
        text({ id: 'cancel', text: 'Cancel', x: 364, y: -422, ax: 1, size: 30, weight: 500, color: 'muted', k: enter(TAPS[0]) }),
        ...photos,
        rect({ id: 'bar', y: BY, w: 716, h: 96, r: 48, fill: 'ink', shadow: 2, k: { y: [BY + 200, [BAR, BAR + 0.6, BY, 'Power4 Out']] }, ch: [
          // a COUNTER placeholder (Roll) keyed by 'ph:1': one step per tap
          text({ id: 'count', text: '{{{COUNTER:1-3; style=roll; kf=1}}}', x: -298, size: 32, weight: 600, color: 'inv',
            k: { 'ph:1': [0, [TAPS[1] + 0.05, TAPS[1] + 0.45, 50, 'Power4 Out'], [TAPS[2] + 0.05, TAPS[2] + 0.45, 100, 'Power4 Out']] } }),
          text({ id: 'selLbl', text: 'selected', x: -276, ax: 0, size: 32, weight: 500, color: 'inv' }),
          rect({ id: 'share', x: 256, w: 180, h: 68, r: 34, fill: 'inv', k: { scale: [[HOV - 0.05, HOV + 0.25, 1.05, 'Power3 Out']] }, ch: [
            icon({ icon: 'upload', x: -44, y: -2, size: 28, sw: 2.4, color: 'ink' }),
            text({ text: 'Share', x: 14, size: 28, weight: 600 }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 520, 540], [0.5, 520, 540], [TAPS[0] - 0.1, 14, GY + 14], [TAPS[0] + 0.12, 14, GY + 14], [TAPS[1] - 0.1, PITCH + 14, GY + PITCH + 14],
        [TAPS[1] + 0.12, PITCH + 14, GY + PITCH + 14], [TAPS[2] - 0.1, -PITCH + 14, GY + 2 * PITCH + 14], [TAPS[2] + 0.15, -PITCH + 14, GY + 2 * PITCH + 14],
        [HOV, 282, BY + 12], [3.6, 290, BY + 18]], TAPS, [], { inAt: 0.45 }),
    ];
  },
});

// 7 ─ Clip trim: the cursor drags both trim handles inward, the trimmed ends dim, the duration counts down
UIK.define({
  id: 'clip-trim', name: 'Clip trim', cat: 'everyday', T: 4.3, cam: 1.15,
  desc: 'A filmstrip of two shots sits in a trim frame. The cursor drags the left handle in, then the right one: the frame follows both, the trimmed-off ends dim as they grow, a timecode bubble rides each handle while it is held, and the duration counts down 12.0 → 7.4 s.',
  build: () => {
    const SW = 1120, SH = 150, SY = 70, PX = SW / 12, E = 'Power2 Smooth';
    const L0 = -560, L1 = r1(L0 + 2.4 * PX), R0 = 560, R1 = r1(R0 - 2.2 * PX);
    const A0 = 1.0, A1 = 1.8, B0 = 2.6, B1 = 3.4;
    const frames = Array.from({ length: 8 }, (_, i) => {
      const b = i >= 4;   // a cut between frames 4 and 5: two shots
      return rect({ id: 'frame' + i, x: L0 + 70 + i * 140, w: 136, h: SH, fill: b ? 'ink/70' : 'skel', clip: true, ch: b ? [
        circle({ x: -24 + (i - 4) * 14, y: 4, d: 72, fill: 'card/85' }), rect({ y: 58, w: 136, h: 34, fill: 'ink/85' }),
      ] : [
        circle({ x: -34 + i * 16, y: -32 + i * 7, d: 40, fill: 'card' }), rect({ y: 44, w: 136, h: 62, fill: 'ink/20' }),
      ] });
    });
    const handle = (id, x0, x1, t0, t1, left) => rect({ id, x: x0 + (left ? 16 : -16), y: SY, w: 32, h: SH + 12, radii: left ? '20px 6px 6px 20px' : '6px 20px 20px 6px', fill: 'ink',
      k: { x: [[t0, t1, x1 + (left ? 16 : -16), E]], sy: [[t0 - 0.05, t0 + 0.1, 1.06, 'Power2 Out'], [t1 + 0.02, t1 + 0.3, 1, 'Power3 Out']] },
      ch: [rect({ w: 5, h: 44, r: 3, fill: 'inv' })] });
    const bubble = (id, x0, x1, t0, t1, v0, v1) => group({ id, x: x0, y: SY - 126, k: k(pop(t0 - 0.06, { from: 0.5, dur: 0.35 }), exit(t1 + 0.35, { s: 0.85 }), { x: [[t0, t1, x1, E]] }), ch: [
      rect({ y: 28, w: 16, h: 16, r: 3, rot: 45, fill: 'ink' }),
      rect({ w: 128, h: 54, r: 16, fill: 'ink', ch: [text({ size: 26, weight: 600, color: 'inv', num: { pre: '0:', dec: 1, pad: 4 }, value: v0, k: { value: [[t0, t1, v1, E]] } })] }),
    ] });
    return [
      rect({ id: 'card', w: 1260, h: 480, r: 44, fill: 'card', shadow: 1, k: cardIn(), ch: [
        text({ id: 'title', text: 'Trim clip', x: -570, y: -150, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -570 }) }),
        text({ id: 'file', text: 'beach-day.mp4', x: -570, y: -104, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        text({ id: 'duration', x: 570, y: -150, ax: 1, size: 48, weight: 600, ls: -0.02, num: { dec: 1, suf: ' s' }, value: 12,
          k: k(enter(0.28), { value: [[A0, A1, 9.6, E], [B0, B1, 7.4, E]] }) }),
        text({ id: 'durLbl', text: 'Duration', x: 570, y: -104, ax: 1, size: 26, color: 'muted', k: enter(0.34) }),
        rect({ id: 'strip', y: SY, w: SW, h: SH, r: 18, fill: 'card', clip: true, k: enter(0.34, { blur: 6, s: 0.97 }), ch: [
          ...frames,
          rect({ id: 'trimL', x: L0, pin: 'l', w: 0, h: SH, fill: 'shade/50', k: { w: [[A0, A1, L1 - L0, E]] } }),
          rect({ id: 'trimR', x: R0, pin: 'r', w: 0, h: SH, fill: 'shade/50', k: { w: [[B0, B1, R0 - R1, E]] } }),
        ] }),
        group({ id: 'trimUI', k: fadeIn(0.5), ch: [
          rect({ id: 'selFrame', y: SY, w: SW, h: SH + 12, r: 20, stroke: 'ink', sw: 6,
            k: { x: [[A0, A1, (L1 + R0) / 2, E], [B0, B1, (L1 + R1) / 2, E]], w: [[A0, A1, R0 - L1, E], [B0, B1, R1 - L1, E]] } }),
          handle('handleL', L0, L1, A0, A1, true),
          handle('handleR', R0, R1, B0, B1, false),
        ] }),
        bubble('inTime', L0 + 16, L1 + 16, A0, A1, 0, 2.4),
        bubble('outTime', R0 - 16, R1 - 16, B0, B1, 12, 9.8),
        text({ id: 'tc0', text: '0:00', x: L0, y: 188, ax: 0, size: 22, color: 'muted', k: enter(0.4) }),
        text({ id: 'tc1', text: '0:12', x: R0, y: 188, ax: 1, size: 22, color: 'muted', k: enter(0.44) }),
      ] }),
      cursorLayer([[0, -220, 330], [0.45, -220, 330], [A0 - 0.1, L0 + 18, SY + 24], [A0, L0 + 18, SY + 24], [A1, L1 + 18, SY + 24], [A1 + 0.15, L1 + 18, SY + 24],
        [B0 - 0.1, R0 - 14, SY + 24], [B0, R0 - 14, SY + 24], [B1, R1 - 14, SY + 24], [B1 + 0.15, R1 - 14, SY + 24], [4.3, R1 + 110, 260]],
        [], [[A0, A1], [B0, B1]], { inAt: 0.42 }),
    ];
  },
});

// 8 ─ Voice recorder: the record button pulses, bars are added at the playhead and the strip scrolls left
UIK.define({
  id: 'voice-recorder', name: 'Voice recorder', cat: 'everyday', T: 4.8, cam: 1.25,
  desc: 'Record is tapped: the accent button breathes with a ripple ring and shows a stop square, the timer runs in tenths, and waveform bars are added one by one at the playhead while the strip scrolls left. Stop: the square spins away, an ink disc irises open over the button and a play triangle turns into place.',
  build: () => {
    const C1 = 0.95, C2 = 3.75, DT = 0.1, PITCH = 26, PH = 330, WY = -12, BY = 172;
    const N = Math.round((C2 - C1) / DT);
    const bars = Array.from({ length: N }, (_, i) => {
      const t = C1 + i * DT, env = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.45 + 0.5)), H = Math.round(14 + 118 * env * (0.4 + 0.6 * rnd(i * 7 + 3)));
      return rect({ id: 'bar' + i, x: PH - 9 + i * PITCH, w: 12, h: 6, r: 6, fill: 'ink', k: { opacity: [0, [t, t + 0.05, 1, 'Linear']], h: [[t, t + 0.18, H, 'Power3 Out']] } });
    });
    const ripple = { scale: [1], opacity: [0] }, breathe = [];
    for (let t = C1 + 0.15; t + 0.8 <= C2 + 0.01; t += 0.8) { ripple.scale.push([t, 1], [t, t + 0.8, 1.55, 'Power2 Out']); ripple.opacity.push([t, 0.8], [t, t + 0.8, 0, 'Power2 Out']); }
    for (let t = C1 + 0.32; t + 0.7 <= C2 - 0.1; t += 0.7) breathe.push([t, t + 0.35, 0.9, 'Sine Smooth'], [t + 0.35, t + 0.7, 1, 'Sine Smooth']);
    return [
      rect({ id: 'card', w: 900, h: 700, r: 48, fill: 'card', shadow: 1, k: cardIn(), ch: [
        text({ id: 'title', text: 'New recording', x: -390, y: -282, ax: 0, size: 34, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -390 }) }),
        text({ id: 'date', text: 'Sep 25', x: 390, y: -282, ax: 1, size: 26, color: 'muted', k: enter(0.28) }),
        text({ id: 'timer', y: -178, size: 104, weight: 600, ls: -0.03, num: { pre: '0:0', dec: 1, sep: false, floor: true },
          k: k(enter(0.28), { value: [[C1, C2, C2 - C1, 'Linear']] }) }),
        group({ id: 'wave', y: WY, clip: true, w: 800, h: 180, k: fadeIn(0.34), ch: [
          rect({ id: 'baseline', w: 800, h: 2, fill: 'line' }),
          group({ id: 'scroll', k: { x: [[C1, C2, -N * PITCH, 'Linear']] }, ch: bars }),
          rect({ id: 'playhead', x: PH, w: 4, h: 168, r: 2, fill: 'acc' }),
        ] }),
        circle({ id: 'recRing', y: BY, d: 156, stroke: 'dim', sw: 6, k: fadeIn(0.3) }),
        circle({ id: 'ripple', y: BY, d: 124, stroke: 'acc', sw: 4, k: ripple }),
        circle({ id: 'recDisc', y: BY, d: 120, fill: 'acc', k: k(pop(0.36, { from: 0.5 }), press(C1), { scale: breathe }, press(C2)), ch: [
          rect({ id: 'stopGlyph', w: 40, h: 40, r: 9, fill: '#FFFFFF',
            k: k(pop(C1 + 0.06, { from: 0.2, dur: 0.4 }), { scale: [[C2, C2 + 0.2, 0.2, 'Power2 In']], rot: [[C2, C2 + 0.22, 90, 'Power2 In']], opacity: [[C2 + 0.08, C2 + 0.2, 0, 'Linear']] }) }),
        ] }),
        circle({ id: 'playDisc', y: BY, d: 120, fill: 'ink', k: pop(C2 + 0.04, { from: 0.2, dur: 0.45, e: 'Power4 Out' }) }),
        icon({ id: 'play', icon: 'play', x: 4, y: BY, size: 48, color: 'inv', filled: true, fill: 'inv', sw: 2.4,
          k: k(pop(C2 + 0.12, { from: 0.3 }), { rot: [-90, [C2 + 0.12, C2 + 0.55, 0, 'Power3 Out']] }) }),
        text({ id: 'hintIdle', text: 'Tap to record', y: 298, size: 28, color: 'muted', k: k(enter(0.4), exit(C1)) }),
        text({ id: 'hintRec', text: 'Recording…', y: 298, size: 28, color: 'muted', k: k(enter(C1), exit(C2)) }),
        text({ id: 'hintSaved', text: 'Saved · 0:02.8', y: 298, size: 28, weight: 500, k: enter(C2) }),
      ] }),
      cursorLayer([[0, 420, 320], [0.45, 420, 320], [C1 - 0.1, 14, BY + 16], [C1 + 0.3, 14, BY + 16], [1.9, 190, 280], [3.1, 198, 288],
        [C2 - 0.1, 14, BY + 16], [C2 + 0.3, 14, BY + 16], [4.7, 220, 296]], [C1, C2], [], { inAt: 0.42 }),
    ];
  },
});

// 9 ─ Image crop: a corner handle is dragged in, thirds appear, the outside darkens, the ratio snaps to 4:5
UIK.define({
  id: 'image-crop', name: 'Image crop', cat: 'everyday', T: 3.5, cam: { zoom: 1.15, y: 10 },
  desc: 'The cursor grabs the bottom-right crop handle and drags it inward: the frame and its corner marks follow, rule-of-thirds lines fade in while the handle is held, the area outside the crop darkens as it grows, and the aspect chip pops to an accent 4:5.',
  build: () => {
    const IY = -40, D0 = 1.05, D1 = 2.25, PS = 'Power2 Smooth', SS = 'Sine Smooth';
    const CXF = -60, CYF = 250, W1 = CXF + 500, H1 = CYF + 300;   // the corner's end point: a 440 × 550 crop = 4:5
    const gx = (v) => ({ x: [[D0, D1, v, PS]] }), gy = (v) => ({ y: [[D0, D1, v, SS]] });
    const gridOp = { opacity: [0, [D0, D0 + 0.2, 0.75, 'Power2 Out'], [D1 + 0.1, D1 + 0.45, 0, 'Power2 Out']] };
    const thirds = [1, 2].flatMap((j) => [
      rect({ id: 'gridV' + j, x: r1(-500 + 1000 * j / 3), w: 2, h: 600, fill: '#FFFFFF', k: k(gridOp, gx(r1(-500 + W1 * j / 3)), gy((-300 + CYF) / 2), { h: [[D0, D1, H1, SS]] }) }),
      rect({ id: 'gridH' + j, y: -300 + 200 * j, w: 1000, h: 2, fill: '#FFFFFF', k: k(gridOp, gx((-500 + CXF) / 2), gy(r1(-300 + H1 * j / 3)), { w: [[D0, D1, W1, PS]] }) }),
    ]);
    const mark = (id, x, y, d, kk) => path({ id, x, y, d, stroke: '#FFFFFF', sw: 10, k: kk });
    return [
      rect({ id: 'image', y: IY, w: 1000, h: 600, r: 24, fill: 'dim', clip: true, k: cardIn(0.08, 0.75), ch: [
        circle({ id: 'sunDisc', x: 210, y: -130, d: 150, fill: 'card' }),
        path({ id: 'ridgeFar', d: 'M-500 110 L-330 -70 L-200 30 L-60 -130 L120 50 L260 -30 L500 130 L500 300 L-500 300 Z', fill: 'ink/25' }),
        path({ id: 'ridgeNear', d: 'M-500 190 Q-250 50 0 160 T500 140 L500 300 L-500 300 Z', fill: 'ink/50' }),
        rect({ id: 'shadeR', x: 500, pin: 'r', w: 0, h: 600, fill: 'shade/50', k: { w: [[D0, D1, 500 - CXF, PS]] } }),
        rect({ id: 'shadeB', y: 300, pin: 'b', w: 1000, h: 0, fill: 'shade/50', k: k(gx((-500 + CXF) / 2), { w: [[D0, D1, W1, PS]], h: [[D0, D1, 300 - CYF, SS]] }) }),
        ...thirds,
        group({ id: 'cropUI', k: enter(0.34, { blur: 0, s: 1.02 }), ch: [
          rect({ id: 'cropFrame', x: -500, y: -300, pin: 'tl', w: 1000, h: 600, stroke: '#FFFFFF', sw: 3, k: { w: [[D0, D1, W1, PS]], h: [[D0, D1, H1, SS]] } }),
          mark('markTL', -500, -300, 'M5 64 L5 5 L64 5'),
          mark('markTR', 500, -300, 'M-64 5 L-5 5 L-5 64', gx(CXF)),
          mark('markBL', -500, 300, 'M5 -64 L5 -5 L64 -5', gy(CYF)),
          mark('markBR', 500, 300, 'M-64 -5 L-5 -5 L-5 -64', k(gx(CXF), gy(CYF))),
        ] }),
      ] }),
      group({ id: 'toolbar', y: 330, k: enter(0.45, { dy: 14, y0: 330 }), ch: [
        text({ id: 'aspectLbl', text: 'Aspect', x: -500, ax: 0, size: 28, color: 'muted' }),
        rect({ id: 'aspectChip', x: -314, w: 136, h: 64, r: 32, fill: 'card', shadow: 3, k: press(D1 + 0.02, { to: 0.94 }), ch: [
          rect({ id: 'aspectAcc', w: 136, h: 64, r: 32, fill: 'acc', k: pop(D1 + 0.02, { from: 0.5, dur: 0.4 }) }),
          text({ id: 'free', text: 'Free', size: 28, weight: 600, k: exit(D1) }),
          text({ id: 'ratio', text: '4:5', size: 28, weight: 600, color: '#FFFFFF', tnum: false, k: enter(D1) }),
        ] }),
        text({ id: 'reset', text: 'Reset', x: 316, ax: 1, size: 28, weight: 500, color: 'muted' }),
        rect({ id: 'done', x: 430, w: 140, h: 64, r: 32, fill: 'ink', ch: [text({ text: 'Done', size: 28, weight: 600, color: 'inv' })] }),
      ] }),
      cursorLayer([[0, 640, 420], [0.5, 640, 420], [D0 - 0.1, 486, 246], [D0, 486, 246], [D1, CXF - 14, CYF + IY - 14], [D1 + 0.25, CXF - 14, CYF + IY - 14], [3.5, 80, 300]],
        [], [[D0, D1]], { inAt: 0.45 }),
    ];
  },
});

// 10 ─ Compress files: four chips fly into an archive tile, it pops, the size rolls 24 MB → 6 MB
UIK.define({
  id: 'file-compress', name: 'Compress files', cat: 'everyday', T: 4.0,
  cam: { zoom: 1.3, y: -45, k: { zoom: [[1.62, 2.45, 1.72, 'Power2 Smooth']], y: [[1.62, 2.45, 52, 'Power2 Smooth']] } },
  desc: 'Four file chips line up, then fly into the archive tile one after another (x, y and scale converge; each landing nudges the tile) while the size label adds them up to 24 MB. The camera closes in, the tile pops and squeezes, the size rolls down to 6 MB and an accent −75% chip pops.',
  build: () => {
    const FILES = [['brief.pdf', 'file', 5], ['cover.png', 'image', 10], ['notes.txt', 'file', 3], ['demo.mov', 'video', 6]];
    const XS = [-405, -135, 135, 405], FY = -300, TY = -20, F0 = 0.95, GAP = 0.13, FD = 0.55;
    const land = FILES.map((_, i) => F0 + i * GAP + FD), LZ = land[3];
    let run = 0; const sizes = FILES.map((f) => (run += f[2]));
    const bumps = [];
    land.slice(0, 3).forEach((t) => bumps.push([t - 0.02, t + 0.05, 1.05, 'Power2 Out'], [t + 0.05, t + 0.11, 1, 'Power2 Out']));
    bumps.push([LZ - 0.02, LZ + 0.1, 1.12, 'Power2 Out'], [LZ + 0.1, LZ + 0.55, 1, 'Back Out']);
    return [
      // the chips paint under the tile, so they slip into it
      ...FILES.map((f, i) => {
        const t = F0 + i * GAP;
        return group({ id: 'file' + i, x: XS[i], y: FY, k: k(enter(0.2 + i * 0.07, { dy: 18, y0: FY }),
          { x: [[t, t + FD, 0, 'Power2 Smooth']], y: [[t, t + FD, TY, 'Power2 In']], scale: [[t, t + FD, 0.28, 'Power2 In']], opacity: [[t + FD - 0.14, t + FD, 0, 'Linear']] }), ch: [
          rect({ id: 'chip' + i, w: 250, h: 88, r: 24, fill: 'card', shadow: 1 }),
          rect({ id: 'chipTile' + i, x: -84, w: 56, h: 56, r: 16, fill: 'soft', ch: [icon({ icon: f[1], size: 30, sw: 2.4, color: 'ink' })] }),
          text({ id: 'chipName' + i, text: f[0], x: -46, y: -13, ax: 0, size: 26, weight: 600 }),
          text({ id: 'chipSize' + i, text: f[2] + ' MB', x: -46, y: 19, ax: 0, size: 21, color: 'muted' }),
        ] });
      }),
      rect({ id: 'archive', y: TY, w: 230, h: 250, r: 44, fill: 'ink', shadow: 1,
        k: k(pop(0.3, { from: 0.5, dur: 0.5 }), { scale: bumps, sy: [[LZ + 0.3, LZ + 0.6, 0.9, 'Power2 Out'], [LZ + 0.6, LZ + 1.1, 1, 'Power3 Out']] }), ch: [
          ...[0, 1, 2, 3, 4, 5].map((j) => rect({ id: 'tooth' + j, x: j % 2 ? 9 : -9, y: -94 + j * 20, w: 22, h: 12, r: 3, fill: 'inv' })),
          rect({ id: 'pull', y: 46, w: 44, h: 58, r: 12, stroke: 'inv', sw: 5, ch: [rect({ y: 8, w: 16, h: 5, r: 2.5, fill: 'inv' })] }),
        ] }),
      text({ id: 'zipName', text: 'Archive.zip', y: 160, size: 40, weight: 600, ls: -0.02, k: enter(0.45) }),
      // centred while it adds up; steps aside for the −75% chip
      text({ id: 'size', y: 222, size: 36, weight: 600, num: { suf: ' MB' }, value: 0,
        k: k(enter(land[0] - 0.08), { value: [...land.map((t, i) => [t, t + 0.12, sizes[i], 'Power3 Out']), [LZ + 0.3, LZ + 1.2, 6, 'Power3 Out']],
          x: [[LZ + 1.05, LZ + 1.5, -64, 'Power3 Out']] }) }),
      rect({ id: 'saved', x: 58, y: 222, w: 124, h: 54, r: 27, fill: 'acc', k: pop(LZ + 1.15, { from: 0.4 }),
        ch: [text({ text: '−75%', size: 26, weight: 600, color: '#FFFFFF', tnum: false })] }),
    ];
  },
});

// 11 ─ QR scan: a scan line sweeps the code down and up, the brackets snap onto it, a check pops
UIK.define({
  id: 'qr-scan', formats: ['html'], name: 'QR scan', cat: 'everyday', T: 3.7, cam: 0.86,
  desc: 'A camera viewfinder frames a code plate. An accent scan line sweeps down and back up across it, then the four corner brackets contract onto the plate, the code dims and an accent check pops over it while the status swaps to Linked.',
  build: () => {
    const B0 = 246, B1 = 196, S0 = 0.9, S1 = 1.6, S2 = 2.3, LOCK = 2.3, M = 18, N = 17, O = -(N - 1) * M / 2;
    // the code: three rounded finder squares, one alignment ring and a fixed pattern of dots drawn as ONE filled path
    const dots = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if ((r < 6 && c < 6) || (r < 6 && c > N - 7) || (r > N - 7 && c < 6) || (r > 10 && r < 15 && c > 10 && c < 15) || rnd(r * N + c + 5) > 0.5) continue;
      const x = O + c * M, y = O + r * M, rr = 7;
      dots.push(`M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0Z`);
    }
    const F = O + 2 * M;
    const finder = (id, x, y) => rect({ id, x, y, w: 88, h: 88, r: 24, stroke: 'ink', sw: 14, ch: [rect({ w: 34, h: 34, r: 10, fill: 'ink' })] });
    const bracket = (id, sx, sy, d) => path({ id, x: sx * B0, y: sy * B0, d, stroke: 'inv', sw: 12,
      k: { x: [[LOCK, LOCK + 0.5, sx * B1, 'Power4 Out']], y: [[LOCK, LOCK + 0.5, sy * B1, 'Power4 Out']] } });
    return [
      rect({ id: 'card', w: 720, h: 960, r: 56, fill: 'card', shadow: 1, k: cardIn(0.08, 0.75), ch: [
        text({ id: 'title', text: 'Link a device', y: -405, size: 42, weight: 600, ls: -0.02, k: enter(0.2) }),
        text({ id: 'sub', text: 'Point your camera at the code', y: -357, size: 26, color: 'muted', k: enter(0.28) }),
        rect({ id: 'viewfinder', w: 600, h: 600, r: 44, fill: 'ink', clip: true, k: enter(0.22, { blur: 0, s: 0.96 }), ch: [
          group({ id: 'code', k: k(enter(0.4, { s: 0.9 }), { opacity: [[LOCK + 0.1, LOCK + 0.4, 0.2, 'Power2 Out']] }), ch: [
            rect({ id: 'plate', w: 348, h: 348, r: 32, fill: 'card' }),
            path({ id: 'dots', d: dots.join(''), fill: 'ink' }),
            finder('finderTL', F, F), finder('finderTR', -F, F), finder('finderBL', F, -F),
            rect({ id: 'align', x: O + 12.5 * M, y: O + 12.5 * M, w: 52, h: 52, r: 14, stroke: 'ink', sw: 10, ch: [circle({ d: 14, fill: 'ink' })] }),
          ] }),
          bracket('brTL', -1, -1, 'M0 72 L0 26 Q0 0 26 0 L72 0'),
          bracket('brTR', 1, -1, 'M-72 0 L-26 0 Q0 0 0 26 L0 72'),
          bracket('brBL', -1, 1, 'M0 -72 L0 -26 Q0 0 26 0 L72 0'),
          bracket('brBR', 1, 1, 'M-72 0 L-26 0 Q0 0 0 -26 L0 -72'),
          rect({ id: 'scanLine', y: -176, w: 400, h: 6, r: 3, fill: 'acc',
            k: { y: [[S0, S1, 176, 'Sine Smooth'], [S1, S2, -176, 'Sine Smooth']], opacity: [0, [S0 - 0.12, S0, 1, 'Linear'], [S2 - 0.08, S2 + 0.08, 0, 'Linear']] } }),
          circle({ id: 'okDisc', d: 156, fill: 'acc', k: pop(LOCK + 0.14, { from: 0.4, dur: 0.5 }), ch: [
            path({ id: 'okTick', d: 'M-38 2 L-11 29 L40 -24', stroke: '#FFFFFF', sw: 15, trimmed: true, k: { trimE: [0, [LOCK + 0.32, LOCK + 0.68, 100, 'Power3 Out']] } }),
          ] }),
        ] }),
        text({ id: 'searching', text: 'Looking for a code…', y: 378, size: 28, color: 'muted', k: k(enter(0.45), exit(LOCK + 0.05)) }),
        text({ id: 'linked', text: 'Linked', y: 368, size: 44, weight: 600, ls: -0.02, k: enter(LOCK + 0.2, { dy: 14, y0: 368 }) }),
        text({ id: 'device', text: 'Studio display · just now', y: 418, size: 26, color: 'muted', k: enter(LOCK + 0.3, { dy: 10, y0: 418 }) }),
      ] }),
    ];
  },
});

// 12 ─ Activity rings: three rings draw on a stagger, the outer one closes and an accent lap sweeps it
UIK.define({
  id: 'activity-rings', name: 'Activity rings', cat: 'everyday', T: 3.4, cam: 1.3,
  desc: 'Three concentric rings draw to different amounts on a stagger (Trim Paths) while their stat rows count up beside them. The outer ring closes, an accent lap sweeps round over it, the rings give a small pulse and the Move row reads Goal met.',
  build: () => {
    const CX = -270, SW = 44, DONE = 1.6, SWEEP = DONE + 0.42;
    const G = [
      { R: 200, c: 'ink', v: 100, a: 0.5, d: 1.1, n: 'Move', val: 520, suf: ' kcal', goal: 'Goal 520' },
      { R: 145, c: 'ink/55', v: 72, a: 0.66, d: 0.95, n: 'Exercise', val: 22, suf: ' min', goal: 'Goal 30' },
      { R: 90, c: 'ink/28', v: 50, a: 0.82, d: 0.85, n: 'Stand', val: 6, suf: ' hrs', goal: 'Goal 12' },
    ];
    return [
      rect({ id: 'card', w: 1120, h: 580, r: 44, fill: 'card', shadow: 1, k: cardIn(), ch: [
        group({ id: 'rings', x: CX, k: { scale: [[SWEEP, SWEEP + 0.12, 1.04, 'Power2 Out'], [SWEEP + 0.12, SWEEP + 0.5, 1, 'Power3 Out']] }, ch: [
          ...G.map((g, i) => path({ id: 'track' + i, d: RING(g.R), stroke: 'skel', sw: SW, k: enter(0.2 + i * 0.06, { blur: 0, s: 0.92 }) })),
          ...G.map((g, i) => path({ id: 'arc' + i, d: RING(g.R), stroke: g.c, sw: SW, trimmed: true, k: { trimE: [0, [g.a, g.a + g.d, g.v, 'Power3 Out']] } })),
          // the accent lap draws over the closed ink ring — a sweep, never a crossfade
          path({ id: 'lap', d: RING(200), stroke: 'acc', sw: SW, trimmed: true, k: { trimE: [0, [DONE, SWEEP, 100, 'Power3 Out']] } }),
        ] }),
        text({ id: 'title', text: 'Activity', x: 60, y: -198, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.25, { dx: -14, x0: 60 }) }),
        text({ id: 'day', text: 'Today', x: 500, y: -198, ax: 1, size: 26, color: 'muted', k: enter(0.3) }),
        ...G.map((g, i) => group({ id: 'row' + i, y: -70 + i * 126, k: enter(g.a - 0.12, { dx: -18, x0: 0 }), ch: [
          rect({ id: 'mark' + i, x: 64, w: 8, h: 76, r: 4, fill: g.c }),
          i === 0 ? rect({ id: 'markAcc', x: 64, w: 8, h: 76, r: 4, fill: 'acc', k: { sy: [0, [DONE + 0.1, SWEEP, 1, 'Power3 Out']] } }) : null,
          text({ id: 'name' + i, text: g.n, x: 92, y: -22, ax: 0, size: 26, color: 'muted' }),
          text({ id: 'val' + i, x: 92, y: 20, ax: 0, size: 46, weight: 600, ls: -0.02, num: { suf: g.suf }, k: { value: [[g.a, g.a + g.d, g.val, 'Power3 Out']] } }),
          text({ id: 'goal' + i, text: g.goal, x: 500, y: 20, ax: 1, size: 26, color: 'muted', k: i === 0 ? exit(SWEEP - 0.1) : null }),
          i === 0 ? group({ id: 'goalMet', k: enter(SWEEP - 0.04, { dx: 12, x0: 0 }), ch: [
            icon({ id: 'metIcon', icon: 'check', x: 362, y: 20, size: 28, sw: 3, color: 'acc', k: pop(SWEEP + 0.04) }),
            text({ id: 'metLbl', text: 'Goal met', x: 500, y: 20, ax: 1, size: 26, weight: 600, color: 'acc' }),
          ] }) : null,
        ].filter(Boolean) })),
      ] }),
    ];
  },
});

// 13 ─ Habit streak: six days fill one by one, a tap completes today, the streak rolls 6 → 7
UIK.define({
  id: 'habit-streak', name: 'Habit streak', cat: 'everyday', T: 3.6, cam: 1.25,
  desc: 'Six weekday circles fill one by one (ink disc pops, check writes on) while the streak digit rolls up with each; today gets an accent ring. The cursor taps today: it fills, the zap bumps and turns accent, the streak rolls 6 → 7 and a Personal best chip pops.',
  build: () => {
    const XS = Array.from({ length: 7 }, (_, i) => -444 + i * 148), CY = 58, D = 112, F = stagger(6, 0.7, 0.14), TAP = 2.25, RING_T = 1.62, H = 84;
    const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const fillDay = (i, t) => [
      circle({ id: 'done' + i, x: XS[i], y: CY, d: D, fill: 'ink', k: pop(t, { from: 0.6, dur: 0.4 }) }),
      path({ id: 'tick' + i, x: XS[i], y: CY, d: 'M-22 2 L-7 17 L23 -15', stroke: 'inv', sw: 9, trimmed: true, k: { trimE: [0, [t + 0.08, t + 0.34, 100, 'Power3 Out']] } }),
    ];
    return [
      rect({ id: 'card', w: 1160, h: 440, r: 44, fill: 'card', shadow: 1, k: cardIn(), ch: [
        rect({ id: 'tile', x: -484, y: -122, w: 84, h: 84, r: 24, fill: 'soft', k: enter(0.2, { s: 0.7 }), ch: [icon({ icon: 'sun', size: 42, sw: 2.4, color: 'ink' })] }),
        text({ id: 'title', text: 'Morning run', x: -424, y: -138, ax: 0, size: 38, weight: 600, ls: -0.02, k: enter(0.24, { dx: -14, x0: -424 }) }),
        text({ id: 'sub', text: 'Every day · 6:30 AM', x: -424, y: -97, ax: 0, size: 24, color: 'muted', k: enter(0.32) }),
        group({ id: 'streak', k: enter(0.3), ch: [
          icon({ id: 'zap', icon: 'zap', x: 282, y: -124, size: 48, sw: 2, color: 'ink', filled: true, fill: 'ink',
            k: { scale: [[TAP, TAP + 0.12, 1.3, 'Power2 Out'], [TAP + 0.12, TAP + 0.5, 1, 'Back Out']], rot: [[TAP, TAP + 0.12, -14, 'Power2 Out'], [TAP + 0.12, TAP + 0.5, 0, 'Power3 Out']] } }),
          icon({ id: 'zapAcc', icon: 'zap', x: 282, y: -124, size: 48, sw: 2, color: 'acc', filled: true, fill: 'acc', k: pop(TAP + 0.02, { from: 0.3, dur: 0.48 }) }),
          // a COUNTER placeholder (Roll) keyed by 'ph:1': quick ticks through the week, then the tap lands on 7
          text({ id: 'count', text: '{{{COUNTER:0-7; style=roll; kf=1}}}', x: 334, y: -124, size: 72, weight: 600,
            k: { 'ph:1': [0, ...F.map((t, i) => [t, t + 0.13, +((100 * (i + 1)) / 7).toFixed(3), 'Power3 Out']), [TAP + 0.04, TAP + 0.5, 100, 'Power4 Out']] } }),
          text({ id: 'streakLbl', text: 'day streak', x: 372, y: -120, ax: 0, size: 28, color: 'muted' }),
        ] }),
        rect({ id: 'best', x: 420, y: -48, w: 204, h: 48, r: 24, fill: 'ink', k: pop(TAP + 0.42, { from: 0.5 }),
          ch: [text({ text: 'Personal best', size: 22, weight: 600, color: 'inv' })] }),
        ...XS.map((x, i) => circle({ id: 'empty' + i, x, y: CY, d: D, fill: 'soft', k: k(enter(0.36 + i * 0.05, { blur: 0, s: 0.6 }), i === 6 ? press(TAP) : null) })),
        ...F.flatMap((t, i) => fillDay(i, t)),
        circle({ id: 'todayRing', x: XS[6], y: CY, d: 136, stroke: 'acc', sw: 5, k: pop(RING_T, { from: 0.7 }) }),
        ...fillDay(6, TAP + 0.02),
        ...DAYS.map((s, i) => text({ id: 'dl' + i, text: s, x: XS[i], y: CY + 94, size: 26, weight: i === 6 ? 600 : 400, color: i === 6 ? 'ink' : 'muted', k: enter(0.4 + i * 0.05) })),
      ] }),
      cursorLayer([[0, 560, 330], [1.3, 560, 330], [TAP - 0.1, XS[6] + 14, CY + 14], [TAP + 0.3, XS[6] + 14, CY + 14], [3.6, 540, 270]], [TAP], [], { inAt: 1.25 }),
    ];
  },
});

// 14 ─ Battery charge: segments fill left → right with the %, the bolt pulses, an accent wipe at 100
UIK.define({
  id: 'battery-charge', name: 'Battery charge', cat: 'everyday', T: 4.2, cam: { zoom: 1.65, y: 48 },
  desc: 'A big battery outline pops in at 20 %. The charge climbs linearly: each segment fills left to right as the counter passes its band, the difference-blended bolt pulses in the middle (inverting where the fill runs under it), and at 100 an accent wipe sweeps across the segments and the status reads Fully charged.',
  build: () => {
    const BW = 620, BH = 300, IW = 556, IH = 236, GAP = 12, SEGW = (IW - 4 * GAP) / 5, C0 = 0.75, FULL = 3.0;
    const tAt = (lvl) => C0 + (FULL - C0) * (lvl - 20) / 80;
    const segX = (i) => r1(-IW / 2 + i * (SEGW + GAP));
    const pulse = [];
    for (let t = C0; t + 0.6 <= FULL + 0.01; t += 0.6) pulse.push([t, t + 0.3, 1.12, 'Sine Smooth'], [t + 0.3, t + 0.6, 1, 'Sine Smooth']);
    return [
      rect({ id: 'battery', y: -40, w: BW, h: BH, r: 64, fill: 'card', stroke: 'ink', sw: 14, k: cardIn(0.08, 0.6), ch: [
        ...[0, 1, 2, 3, 4].map((i) => rect({ id: 'seg' + i, x: segX(i), pin: 'l', w: i ? 0 : SEGW, h: IH, r: 22, fill: 'ink',
          k: i ? { w: [[tAt(20 * i), tAt(20 * i + 20), SEGW, 'Linear']] } : enter(0.3, { blur: 0, s: 0.8 }) })),
        ...[0, 1, 2, 3, 4].map((i) => rect({ id: 'segAcc' + i, x: segX(i), pin: 'l', w: 0, h: IH, r: 22, fill: 'acc',
          k: { w: [[FULL + 0.04 + i * 0.06, FULL + 0.34 + i * 0.06, SEGW, 'Power3 Out']] } })),
        icon({ id: 'bolt', icon: 'zap', size: 116, sw: 2, color: '#FFFFFF', filled: true, fill: '#FFFFFF', blend: 'difference',
          k: k(pop(0.3, { from: 0.4 }), { scale: pulse }, exit(FULL + 0.02, { s: 0.9 })) }),
        icon({ id: 'boltDone', icon: 'zap', size: 116, sw: 2, color: '#FFFFFF', filled: true, fill: '#FFFFFF', k: pop(FULL + 0.3, { from: 0.6 }) }),
      ] }),
      rect({ id: 'cap', x: 318, y: -40, w: 24, h: 110, radii: '0 14px 14px 0', fill: 'ink', k: enter(0.3, { blur: 0, s: 0.6 }) }),
      text({ id: 'pct', y: 196, size: 100, weight: 600, ls: -0.03, num: { suf: '%', floor: true }, value: 20, k: k(enter(0.34), { value: [[C0, FULL, 100, 'Linear']] }) }),
      text({ id: 'charging', text: 'Charging · 32 min to full', y: 268, size: 30, color: 'muted', k: k(enter(0.42), exit(FULL)) }),
      text({ id: 'charged', text: 'Fully charged', y: 268, size: 30, weight: 500, k: enter(FULL) }),
    ];
  },
});

// 15 ─ Volume: the cursor drags a tall slider up, wave arcs draw as thresholds pass, then mute slashes it
UIK.define({
  id: 'volume-control', name: 'Volume control', cat: 'everyday', T: 4.3, cam: 1.3,
  desc: 'The cursor drags a tall slider up from 6 %: the fill follows it, the level counts, and the speaker’s three wave arcs draw on one by one as 20, 50 and 80 % are passed. Then a tap on the speaker mutes it: the arcs collapse, an accent slash draws through it, the fill greys out and the level reads Muted.',
  build: () => {
    const TX = -190, TY = 40, SX = 250, SH = 380, V0 = 6, V1 = 94, D0 = 1.05, D1 = 2.35, M = 3.15, SS = 'Sine Smooth';
    const fh = (v) => SH * v / 100, yTop = (v) => TY + SH / 2 - fh(v);
    const cross = (v) => D0 + (D1 - D0) * invEase(SS, (v - V0) / (V1 - V0));
    const MX = 22, A = Math.PI / 4;   // arc centre = the speaker's mouth
    const arc = (r) => `M${r1(MX + r * Math.cos(A))} ${r1(-r * Math.sin(A))} A${r} ${r} 0 0 1 ${r1(MX + r * Math.cos(A))} ${r1(r * Math.sin(A))}`;
    const SLASH = 'M-96 -104 L146 112';
    return [
      rect({ id: 'card', w: 900, h: 600, r: 48, fill: 'card', shadow: 1, k: cardIn(), ch: [
        text({ id: 'title', text: 'Sound', x: -390, y: -230, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -390 }) }),
        text({ id: 'level', x: 390, y: -230, ax: 1, size: 40, weight: 600, ls: -0.02, num: { suf: '%' }, value: V0, k: k(enter(0.3), { value: [[D0, D1, V1, SS]] }, exit(M)) }),
        text({ id: 'muted', text: 'Muted', x: 390, y: -230, ax: 1, size: 40, weight: 600, ls: -0.02, color: 'muted', k: enter(M) }),
        rect({ id: 'tile', x: TX, y: TY, w: 400, h: 380, r: 56, fill: 'soft', k: k(enter(0.3, { blur: 0, s: 0.92 }), press(M)), ch: [
          group({ id: 'speaker', x: -41, ch: [
            path({ id: 'body', d: 'M-80 -34 L-44 -34 L6 -84 L6 84 L-44 34 L-80 34 Z', fill: 'ink', stroke: 'ink', sw: 10, k: enter(0.4, { s: 0.8 }) }),
            ...[50, 94, 138].map((r, j) => {
              const m = M + 0.04 * (2 - j);
              return path({ id: 'wave' + j, d: arc(r), stroke: 'ink', sw: 16, trimmed: true,
                k: { trimE: [0, [cross([20, 50, 80][j]), cross([20, 50, 80][j]) + 0.3, 100, 'Power3 Out'], [m, m + 0.24, 50, 'Power2 In']], trimS: [0, [m, m + 0.24, 50, 'Power2 In']] } });
            }),
            path({ id: 'slashCut', d: SLASH, stroke: 'soft', sw: 40, trimmed: true, k: { trimE: [0, [M + 0.12, M + 0.46, 100, 'Power3 Out']] } }),
            path({ id: 'slash', d: SLASH, stroke: 'acc', sw: 16, trimmed: true, k: { trimE: [0, [M + 0.12, M + 0.46, 100, 'Power3 Out']] } }),
          ] }),
        ] }),
        rect({ id: 'slider', x: SX, y: TY, w: 132, h: SH, r: 44, fill: 'skel', clip: true, k: enter(0.36, { blur: 0, s: 0.92 }), ch: [
          rect({ id: 'fill', y: SH / 2, pin: 'b', w: 132, h: fh(V0), fill: 'ink', k: { h: [[D0, D1, fh(V1), SS]], fill: [[M, M + 0.3, 'dim', 'Power2 Out']] } }),
        ] }),
      ] }),
      cursorLayer([[0, 520, 330], [0.45, 520, 330], [D0 - 0.1, SX + 12, yTop(V0) + 8], [D0, SX + 12, yTop(V0) + 8], [D1, SX + 12, yTop(V1) + 8], [D1 + 0.2, SX + 12, yTop(V1) + 8],
        [M - 0.1, TX + 40, TY + 70], [M + 0.25, TX + 40, TY + 70], [4.3, TX + 170, 250]], [M], [[D0, D1]], { inAt: 0.42 }),
    ];
  },
});

})();
