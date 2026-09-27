/* UI Motion Kit — mobile elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
// the main shape's pop-in from empty
const popIn = (t = 0.1, from = 0.7) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (tracks, bars, backgrounds that should not scale or blur in)
const fadeIn = (t, dur = 0.3) => enter(t, { blur: 0, s: 1, dur });
// cursor with per-leg easing: keys [t, x, y, ease?] — `ease` drives both axes of the leg that ends on that key,
// so a layer dragged with the same times and easing sticks to the cursor tip
const cursorE = (keys, clicks = [], drags = [], o = {}) => {
  const c = cursorLayer(keys.map((q) => q.slice(0, 3)), clicks, drags, o);
  keys.forEach((q, i) => {
    if (!i || !q[3]) return;
    for (const p of ['x', 'y']) for (const s of c.k[p]) if (Array.isArray(s) && s.length === 4 && s[0] === keys[i - 1][0] && s[1] === q[0]) s[3] = q[3];
  });
  return c;
};
// the moment an eased move a → b over [t0, t1] passes v (hover hand-offs, the theme wave front)
const cross = (t0, t1, a, b, v, e = 'Power2 Smooth') => {
  const f = UIK.ease(e); let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, x = a + (b - a) * f(m); if ((b - a) * (v - x) > 0) lo = m; else hi = m; }
  return +(t0 + (t1 - t0) * hi).toFixed(3);
};
// liquid indicator for a pin 'l' rect: the leading edge travels fast, the trailing edge follows late.
// x (= left edge) is one eased segment; w (= right − left) is sampled into short linear segments.
const edges = (t, L0, R0, L1, R1, o = {}) => {
  const right = (L1 + R1) > (L0 + R0), fast = o.fast ?? 0.34, slow = o.slow ?? 0.5, lag = o.lag ?? 0.08, n = o.n ?? 10;
  const f = UIK.ease('Power3 Out'), at = (tt, a, b, t0, d) => a + (b - a) * f(Math.min(1, Math.max(0, (tt - t0) / d)));
  const Lf = (tt) => (right ? at(tt, L0, L1, t + lag, slow) : at(tt, L0, L1, t, fast));
  const Rf = (tt) => (right ? at(tt, R0, R1, t, fast) : at(tt, R0, R1, t + lag, slow));
  const end = t + lag + slow, w = [];
  for (let j = 1; j <= n; j++) { const a = t + (end - t) * (j - 1) / n, b = t + (end - t) * j / n; w.push([+a.toFixed(3), +b.toFixed(3), +(Rf(b) - Lf(b)).toFixed(2), 'Linear']); }
  return { x: [right ? [t + lag, t + lag + slow, L1, 'Power3 Out'] : [t, t + fast, L1, 'Power3 Out']], w };
};
// a closed ring for Trim Paths, from 12 o'clock clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;

// ── the phone (no device branding): an ink bezel round a clipped screen.
//    Screen coordinates: centre 0,0 — top edge −500, bottom +500, sides ±250. ──
const PW = 500, PH = 1000, PR = 64, BZ = 14;
const phone = (o) => group({ id: 'phone', k: o.k || popIn(0.1, 0.72), ch: [
  rect({ id: 'bezel', w: PW + 2 * BZ, h: PH + 2 * BZ, r: PR + BZ, fill: 'ink', shadow: 1 }),
  rect({ id: 'glass', w: PW + 4, h: PH + 4, r: PR + 2, fill: 'dim' }),
  rect({ id: 'screen', w: PW, h: PH, r: PR, fill: o.fill || 'card', clip: true, ch: o.ch }),
] });
// status bar: time, camera dot, battery; `to` = [t, colour] recolours it (an app going dark under it)
const statusBar = (t0 = 0.26, to, o = {}) => {
  const ck = (p) => (to ? { [p]: [[to[0], to[0] + 0.3, to[1], 'Power2 Out']] } : null);
  return group({ id: 'statusBar', y: -462, k: fadeIn(t0), ch: [
    ...(o.noTime ? [] : [text({ id: 'sbTime', text: '9:41', x: -188, size: 24, weight: 600, color: 'ink', k: ck('color') })]),
    circle({ id: 'camera', d: 22, fill: 'ink' }),
    rect({ id: 'sbBattery', x: 182, w: 40, h: 20, r: 6, stroke: 'ink', sw: 2.4, k: ck('stroke'), ch: [
      rect({ id: 'sbCharge', x: -14, pin: 'l', w: 22, h: 12, r: 3, fill: 'ink', k: ck('fill') }),
    ] }),
  ] });
};
const homeBar = (t0 = 0.3, to) => rect({ id: 'homeBar', y: 482, w: 150, h: 6, r: 3, fill: 'ink/80',
  k: k(fadeIn(t0), to ? { fill: [[to[0], to[0] + 0.3, to[1], 'Power2 Out']] } : null) });
const PHONE_CAM = 0.86;

// 1 ─ Lock screen: notifications drop in and stack; the cursor flicks the newest one up and away
UIK.define({
  id: 'lockscreen-notification', name: 'Lock screen notification', cat: 'mobile', T: 4.3, cam: PHONE_CAM,
  desc: 'A lock screen settles in; a notification drops in under the clock, a second one lands on top and pushes it down, then the cursor grabs the newest, flicks it up and away, and the first slides back into place.',
  build: () => {
    const N1 = 0.85, N2 = 1.72, G = 2.6, R = 2.94, UP = 3.0, Y0 = -30, GAP = 150, DRAG = Y0 - 120;
    const arrive = (t) => ({ y: [Y0 - 90, [t, t + 0.62, Y0, 'Power4 Out']], opacity: [0, [t, t + 0.14, 1, 'Linear']],
                             blur: [12, [t, t + 0.36, 0, 'Power2 Out']], scale: [0.9, [t, t + 0.62, 1, 'Power4 Out']] });
    const note = (id, o, kk) => rect({ id, y: Y0, w: 452, h: 134, r: 34, fill: 'card', shadow: 2, k: kk, ch: [
      rect({ id: id + 'Tile', x: -172, w: 68, h: 68, r: 20, fill: o.tile, ch: [icon({ icon: o.icon, size: 34, color: o.ic, sw: 2.4 })] }),
      text({ id: id + 'Title', text: o.title, x: -122, y: -20, ax: 0, size: 26, weight: 600, ls: -0.01 }),
      text({ id: id + 'Body', text: o.body, x: -122, y: 18, ax: 0, size: 24, color: 'muted' }),
      text({ id: id + 'Time', text: 'now', x: 204, y: -20, ax: 1, size: 20, color: 'muted' }),
    ] });
    return [
      phone({ fill: 'panel', ch: [
        statusBar(0.26, null, { noTime: true }),
        icon({ id: 'lock', icon: 'lock', y: -392, size: 34, sw: 2.6, k: enter(0.28) }),
        text({ id: 'date', text: 'Thursday, 25 September', y: -318, size: 28, weight: 500, color: 'muted', k: enter(0.32) }),
        text({ id: 'clock', text: '9:41', y: -226, size: 150, weight: 600, ls: -0.04, tnum: false, k: enter(0.36, { dy: 14, y0: -226 }) }),
        note('note1', { tile: 'ink', icon: 'message', ic: 'inv', title: 'Maya Chen', body: 'Still on for 3 pm?' },
          k(arrive(N1), { y: [[N2 + 0.02, N2 + 0.57, Y0 + GAP, 'Power3 Out'], [UP, UP + 0.6, Y0, 'Power4 Out']] })),
        note('note2', { tile: 'acc', icon: 'calendar', ic: '#FFFFFF', title: 'Design review', body: 'Starts in 10 min · Room 4' },
          k(arrive(N2), { y: [[G, R, DRAG, 'Power2 In'], [R, R + 0.42, Y0 - 640, 'Power2 Out']],
                          scale: [[G - 0.04, G + 0.1, 0.97, 'Power2 Out']], opacity: [[R + 0.08, R + 0.34, 0, 'Linear']] })),
        ...[[-166, 'zap'], [166, 'video']].map(([x, ic], i) => circle({ id: 'quick' + i, x, y: 398, d: 84, fill: 'ink/8', k: enter(0.42 + i * 0.04),
          ch: [icon({ icon: ic, size: 32, sw: 2.4 })] })),
        text({ id: 'hint', text: 'Swipe up to open', y: 398, size: 22, color: 'muted', k: enter(0.46) }),
        homeBar(0.3),
      ] }),
      cursorE([[0, 440, 420], [G - 0.62, 440, 420], [G - 0.08, 96, Y0 + 26], [G, 96, Y0 + 26], [R, 96, DRAG + 26, 'Power2 In'],
        [R + 0.3, 112, DRAG - 34, 'Power2 Out'], [R + 1.0, 400, 170]], [], [[G, R]], { inAt: G - 0.7 }),
    ];
  },
});

// 2 ─ Tab bar: an ink pill stretches between tabs; the active icon fills and its label unfolds
UIK.define({
  id: 'tab-bar', name: 'Tab bar', cat: 'mobile', T: 3.8, cam: PHONE_CAM,
  desc: 'Two taps on a floating tab bar: the ink pill stretches to the new tab (leading edge first), the other icons make room, the active icon swaps to its filled white form and its label unfolds, while the page title and content slide in from the tapped side.',
  build: () => {
    const C1 = 1.2, C2 = 2.45, BY = 404, A = 176, S = 80, PAD = 208;
    const TABS = [['Home', 'home', 60.1], ['Likes', 'heart', 53.9], ['Alerts', 'bell', 62.3], ['Profile', 'user', 67.5]];
    const lay = (a) => { const L = []; let x = -PAD; for (let i = 0; i < 4; i++) { L.push(x); x += i === a ? A : S; } return L; };
    const gx = (a, i) => { const l = lay(a)[i]; return i === a ? l + A / 2 - (12 + TABS[i][2]) / 2 : l + S / 2; };
    const pl = (a) => lay(a)[a] + 6;
    const ACT = [0, 2, 1], CS = [C1, C2];
    const tab = (i) => {
      const [label, ic] = TABS[i], on0 = ACT[0] === i;
      const oo = [on0 ? 0 : 1], fo = [on0 ? 1 : 0], lo = [on0 ? 1 : 0], fsc = [1], lx = [27];
      CS.forEach((t, j) => {
        const was = ACT[j] === i, is = ACT[j + 1] === i;
        if (was && !is) { oo.push([t + 0.06, t + 0.26, 1, 'Power2 Out']); fo.push([t, t + 0.12, 0, 'Linear']); lo.push([t, t + 0.1, 0, 'Linear']); }
        if (!was && is) { oo.push([t, t + 0.1, 0, 'Linear']); fo.push([t + 0.04, t + 0.16, 1, 'Linear']); fsc.push([t, t + 0.001, 0.6, 'Linear'], [t + 0.04, t + 0.44, 1, 'Back Out']);
                          lo.push([t + 0.12, t + 0.32, 1, 'Power2 Out']); lx.push([t + 0.1, t + 0.101, 17, 'Linear'], [t + 0.12, t + 0.46, 27, 'Power3 Out']); }
      });
      const x = [gx(0, i)];
      CS.forEach((t, j) => { if (gx(ACT[j], i) !== gx(ACT[j + 1], i)) x.push([t, t + 0.5, gx(ACT[j + 1], i), 'Power4 Out']); });
      const pressAt = CS.filter((t, j) => ACT[j + 1] === i);
      return group({ id: 'tab' + i, k: k(enter(0.42 + i * 0.05, { blur: 0, s: 0.8 }), { x }, ...pressAt.map((t) => press(t, { to: 0.9 }))), ch: [
        icon({ id: 'tabIc' + i, icon: ic, size: 32, sw: 2.4, color: 'muted', k: { opacity: oo } }),
        icon({ id: 'tabFill' + i, icon: ic, size: 32, sw: 2.4, color: 'inv', filled: true, fill: 'inv', k: { opacity: fo, scale: fsc } }),
        text({ id: 'tabLbl' + i, text: label, x: 27, ax: 0, size: 22, weight: 600, color: 'inv', k: { opacity: lo, x: lx } }),
        ...(i === 2 ? [circle({ id: 'badge', x: 12, y: -13, d: 18, fill: 'acc', stroke: 'card', sw: 3,
          k: k(pop(0.8, { from: 0.3 }), { scale: [[C1 + 0.04, C1 + 0.22, 0, 'Power2 In']] }) })] : []),
      ] });
    };
    const title = (id, s, kk) => text({ id, text: s, x: -206, y: -392, ax: 0, size: 52, weight: 600, ls: -0.02, k: kk });
    const bar = (id, x, y, w, h, fill = 'skel') => rect({ id, x, y, pin: 'l', w, h, r: h / 2, fill });
    return [
      phone({ fill: 'panel', ch: [
        statusBar(0.26),
        title('ttlHome', 'Home', k(enter(0.3, { dx: -14, x0: -206 }), exit(C1))),
        title('ttlAlerts', 'Alerts', k(enter(C1 + 0.06, { dx: 24, x0: -206 }), exit(C2))),
        title('ttlLikes', 'Likes', enter(C2 + 0.06, { dx: -24, x0: -206 })),
        group({ id: 'pgHome', k: k(enter(0.4, { dy: 24, blur: 6 }), exit(C1, { dur: 0.2 }), { x: [[C1, C1 + 0.24, -40, 'Power2 In']] }), ch: [
          rect({ id: 'hero', y: -176, w: 452, h: 280, r: 36, fill: 'card', ch: [
            rect({ id: 'heroImg', y: -36, w: 412, h: 168, r: 24, fill: 'soft' }),
            bar('heroBar', -206, 96, 250, 22, 'dim'),
          ] }),
          ...[0, 1].map((j) => rect({ id: 'homeRow' + j, y: 56 + j * 136, w: 452, h: 120, r: 30, fill: 'card', ch: [
            circle({ id: 'homeAv' + j, x: -166, d: 68, fill: j ? 'skel' : 'dim' }),
            bar('homeBar' + j, -114, 0, [210, 160][j], 20),
          ] })),
        ] }),
        group({ id: 'pgAlerts', k: k(enter(C1 + 0.1, { dx: 50, blur: 6 }), exit(C2, { dur: 0.2 }), { x: [[C2, C2 + 0.24, 40, 'Power2 In']] }), ch: [
          rect({ id: 'alertCard', y: -84, w: 452, h: 492, r: 36, fill: 'card', ch: [
            ...[0, 1, 2, 3].map((j) => circle({ id: 'alertDot' + j, x: -166, y: -180 + j * 120, d: 64, fill: j ? 'skel' : 'ink' })),
            ...[0, 1, 2, 3].map((j) => bar('alertBar' + j, -114, -180 + j * 120, [240, 190, 220, 160][j], 20, j ? 'skel' : 'dim')),
          ] }),
        ] }),
        group({ id: 'pgLikes', k: enter(C2 + 0.1, { dx: -50, blur: 6 }), ch: [
          ...[0, 1, 2, 3, 4, 5].map((j) => rect({ id: 'likeTile' + j, x: j % 2 ? 118 : -118, y: -226 + (j >> 1) * 212, w: 216, h: 196, r: 32,
            fill: ['ink', 'dim', 'card', 'skel', 'dim', 'card'][j], ch: j ? [] : [icon({ icon: 'heart', size: 48, sw: 2.4, color: 'inv', filled: true, fill: 'inv' })] })),
        ] }),
        rect({ id: 'bar', y: BY, w: 440, h: 104, r: 52, fill: 'card', shadow: 2, k: enter(0.3, { dy: 40, y0: BY, blur: 0, s: 1 }), ch: [
          rect({ id: 'pill', x: pl(0), pin: 'l', w: A - 12, h: 76, r: 38, fill: 'ink',
            k: k(fadeIn(0.4), edges(C1, pl(0), pl(0) + A - 12, pl(2), pl(2) + A - 12), edges(C2, pl(2), pl(2) + A - 12, pl(1), pl(1) + A - 12)) }),
          ...[0, 1, 2, 3].map(tab),
        ] }),
        homeBar(0.3),
      ] }),
      cursorLayer([[0, 440, 420], [0.62, 440, 420], [C1 - 0.1, gx(0, 2) + 6, BY + 8], [C1 + 0.2, gx(0, 2) + 6, BY + 8],
        [C2 - 0.1, gx(2, 1) + 6, BY + 8], [C2 + 0.2, gx(2, 1) + 6, BY + 8], [C2 + 0.85, 390, 300]], [C1, C2], [], { inAt: 0.58 }),
    ];
  },
});

// 3 ─ Bottom sheet: rises to half over a map, then is dragged up by its grabber to full height
UIK.define({
  id: 'bottom-sheet', name: 'Bottom sheet', cat: 'mobile', T: 3.9, cam: PHONE_CAM,
  desc: 'Over a map with a drawn route, a place sheet slides up to half height. The cursor grabs the grabber and drags the sheet up; on release it snaps to full height, the map dims and drifts up, and more rows slide in.',
  build: () => {
    const S0 = 0.75, G = 1.95, R = 2.6, HALF = 84, DRAG = -330, FULL = -416;
    const road = (id, d, sw, t) => path({ id, d, stroke: 'card', sw, cap: 'butt', k: fadeIn(t) });
    const rows = [['clock', 'Open · closes at 6 pm'], ['bag', 'Order ahead · ready in 8 min'], ['pin', '12 Harbor Street'], ['star', '4.8 · 320 reviews']];
    return [
      phone({ fill: 'panel', ch: [
        group({ id: 'map', k: { y: [[G, R, -46, 'Power2 Smooth']] }, ch: [
          rect({ id: 'park', x: -180, y: -150, w: 170, h: 130, r: 34, fill: 'dim', k: fadeIn(0.28) }),
          rect({ id: 'block', x: 196, y: -366, w: 130, h: 96, r: 24, fill: 'skel', k: fadeIn(0.3) }),
          road('avenue', 'M-320 -380 L320 -100', 40, 0.26),
          road('street0', 'M-60 -560 L-60 560', 30, 0.28),
          road('street1', 'M-320 -30 C-140 10 80 -120 320 -60', 24, 0.3),
          road('street2', 'M150 -560 L210 560', 18, 0.32),
          road('street3', 'M-320 -250 L320 -280', 16, 0.32),
          path({ id: 'route', d: 'M-60 -40 L-60 -266 L140 -178.75', stroke: 'ink', sw: 8, trimmed: true, k: { trimE: [0, [0.55, 1.25, 100, 'Power2 Smooth']] } }),
          circle({ id: 'youHalo', x: -60, y: -40, d: 72, fill: 'ink/10', k: pop(0.42, { from: 0.4 }) }),
          circle({ id: 'you', x: -60, y: -40, d: 30, fill: 'ink', stroke: 'card', sw: 6, k: pop(0.42, { from: 0.4 }) }),
          icon({ id: 'pin', icon: 'pin', x: 140, y: -205, size: 64, sw: 2.2, color: 'card', filled: true, fill: 'acc', origin: [0, 0.42], k: pop(1.2, { from: 0.3 }) }),
          rect({ id: 'pinLabel', x: 140, y: -268, w: 176, h: 48, r: 24, fill: 'card', shadow: 3, k: enter(1.32, { dy: 10, y0: -268 }),
            ch: [text({ text: 'Harbor Coffee', size: 22, weight: 600 })] }),
        ] }),
        circle({ id: 'back', x: -190, y: -380, d: 64, fill: 'card', shadow: 3, k: enter(0.34, { s: 0.7 }), ch: [icon({ icon: 'chevronLeft', size: 30, sw: 2.6 })] }),
        rect({ id: 'scrim', w: PW, h: PH, fill: 'shade', k: { opacity: [0, [G, R + 0.3, 0.24, 'Power2 Out']] } }),
        rect({ id: 'sheet', y: HALF, pin: 't', chAt: 'pin', w: PW, h: 1100, radii: '44px 44px 0 0', fill: 'card', shadow: 2,
          k: { y: [560, [S0, S0 + 0.7, HALF, 'Power4 Out'], [G, R, DRAG, 'Power2 Smooth'], [R, R + 0.5, FULL, 'Power3 Out']] }, ch: [
            rect({ id: 'grabber', y: 18, w: 64, h: 8, r: 4, fill: 'dim',
              k: { w: [[G - 0.06, G + 0.1, 84, 'Power2 Out'], [R, R + 0.3, 64, 'Power3 Out']], fill: [[G - 0.06, G + 0.1, 'muted', 'Power2 Out'], [R, R + 0.3, 'dim', 'Power2 Out']] } }),
            text({ id: 'place', text: 'Harbor Coffee', x: -214, y: 74, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(S0 + 0.2, { dx: -14, x0: -214 }) }),
            text({ id: 'placeSub', text: 'Café · 4 min walk', x: -214, y: 118, ax: 0, size: 24, color: 'muted', k: enter(S0 + 0.26) }),
            rect({ id: 'directions', x: -96, y: 196, w: 240, h: 76, r: 38, fill: 'ink', k: enter(S0 + 0.32), ch: [
              icon({ icon: 'arrow', x: -68, size: 26, sw: 2.6, color: 'inv', rot: -45 }),
              text({ text: 'Directions', x: 18, size: 26, weight: 600, color: 'inv' }),
            ] }),
            ...[[82, 'bookmark'], [176, 'link']].map(([x, ic], i) => circle({ id: 'act' + i, x, y: 196, d: 76, fill: 'soft', k: enter(S0 + 0.36 + i * 0.04),
              ch: [icon({ icon: ic, size: 30, sw: 2.4 })] })),
            ...[0, 1, 2].map((j) => rect({ id: 'photo' + j, x: -150 + j * 150, y: 322, w: 140, h: 116, r: 22, fill: ['soft', 'skel', 'soft'][j],
              k: enter(S0 + 0.42 + j * 0.04, { dy: 14, y0: 322 }) })),
            ...rows.map(([ic, s], j) => group({ id: 'info' + j, y: 440 + j * 76, k: enter(j ? G + 0.22 + j * 0.08 : S0 + 0.5, { dy: 18, y0: 440 + j * 76 }), ch: [
              icon({ icon: ic, x: -198, size: 30, sw: 2.4, color: 'muted' }),
              text({ text: s, x: -164, ax: 0, size: 26, weight: 500 }),
              rect({ x: -164, y: 38, pin: 'l', w: 390, h: 2, fill: 'line' }),
            ] })),
          ] }),
        statusBar(0.26),
        homeBar(0.3),
      ] }),
      cursorE([[0, 440, 420], [G - 0.62, 440, 420], [G - 0.1, 8, HALF + 20], [G, 8, HALF + 20], [R, 8, DRAG + 20, 'Power2 Smooth'], [R + 0.7, 400, 60]],
        [], [[G, R]], { inAt: G - 0.7 }),
    ];
  },
});

// 4 ─ Pull to refresh: the list is dragged down, the spinner arc grows with the pull, spins, a new row lands
UIK.define({
  id: 'pull-to-refresh', name: 'Pull to refresh', cat: 'mobile', T: 4.1, cam: PHONE_CAM,
  desc: 'The cursor drags an inbox down: a spinner fades in the gap and its arc grows and turns with the pull. On release the list springs back to hold it while it spins, then a new message slides into the top and the list settles.',
  build: () => {
    const G = 1.05, P = 1.72, D = 2.85, PULL = 190, REST = 110, TOP = -332, RH = 124, R0 = TOP + 62, TB = 404;
    const rows = [['Maya Chen', 'Draft is ready for review', 'dim'], ['Leo Park', 'Can we move the call to 4?', 'skel'], ['Studio team', 'Weekly notes are up', 'dim'],
                  ['Ana Reyes', 'Loved the new cut', 'skel'], ['Sam Ortiz', 'Invoice #2041 is paid', 'dim'], ['Noor Aziz', 'Photos from the shoot', 'skel']];
    const row = (id, y, [name, msg, av], kk, extra = []) => group({ id, y, k: kk, ch: [
      circle({ id: id + 'Av', x: -178, d: 72, fill: av, ch: extra.slice(0, 1) }),
      text({ id: id + 'Name', text: name, x: -122, y: -18, ax: 0, size: 28, weight: 600, ls: -0.01 }),
      text({ id: id + 'Msg', text: msg, x: -122, y: 20, ax: 0, size: 24, color: 'muted' }),
      ...extra.slice(1),
    ] });
    return [
      phone({ fill: 'card', ch: [
        group({ id: 'spinner', y: TOP + 20, k: { y: [[G, P, TOP + PULL / 2, 'Power2 Out'], [P, P + 0.45, TOP + REST / 2, 'Power3 Out']],
            opacity: [0, [G + 0.05, G + 0.25, 1, 'Power2 Out'], [D, D + 0.18, 0, 'Power2 In']],
            scale: [0.5, [G, P, 1, 'Power2 Out'], [D, D + 0.18, 0.5, 'Power2 In']] }, ch: [
          path({ id: 'spinTrack', d: ring(20), stroke: 'line', sw: 5 }),
          path({ id: 'spinArc', d: ring(20), stroke: 'ink', sw: 5, trimmed: true,
            k: { trimE: [0, [G, P, 78, 'Power2 Out']], rot: [0, [G, P, 200, 'Power2 Out'], [P, D + 0.2, 200 + 1000, 'Linear']] } }),
        ] }),
        group({ id: 'list', k: { y: [[G, P, PULL, 'Power2 Out'], [P, P + 0.45, REST, 'Power3 Out'], [D, D + 0.55, 0, 'Power3 Out']] }, ch: [
          group({ id: 'oldRows', k: { y: [[D, D + 0.55, RH, 'Power3 Out']] }, ch:
            rows.map((r, i) => row('row' + i, R0 + i * RH, r, enter(0.4 + i * 0.05, { dy: 16, y0: R0 + i * RH }))) }),
          row('newRow', R0, ['Jamie Lin', 'Sent the final export', 'ink'], enter(D + 0.04, { blur: 8 }), [
            text({ text: 'JL', size: 24, weight: 600, color: 'inv' }),
            text({ id: 'newTime', text: 'now', x: 208, y: -18, ax: 1, size: 20, color: 'muted' }),
            circle({ id: 'unread', x: 200, y: 20, d: 14, fill: 'acc', k: pop(D + 0.3) }),
          ]),
        ] }),
        rect({ id: 'header', y: (TOP - 500) / 2, w: PW, h: 500 + TOP, fill: 'card' }),
        text({ id: 'title', text: 'Inbox', x: -206, y: -392, ax: 0, size: 52, weight: 600, ls: -0.02, k: enter(0.3, { dx: -14, x0: -206 }) }),
        icon({ id: 'search', icon: 'search', x: 202, y: -392, size: 32, sw: 2.4, k: enter(0.34) }),
        rect({ id: 'hairline', y: TOP, w: PW, h: 2, fill: 'line', k: fadeIn(0.36) }),
        // bottom toolbar (masks rows passing under the home indicator) carries the sync status
        rect({ id: 'toolbar', y: (TB + 500) / 2, w: PW, h: 500 - TB, fill: 'card' }),
        rect({ id: 'toolbarLine', y: TB, w: PW, h: 2, fill: 'line', k: fadeIn(0.36) }),
        icon({ id: 'filter', icon: 'filter', x: -204, y: TB + 38, size: 28, sw: 2.4, k: enter(0.4) }),
        text({ id: 'upd0', text: 'Updated 5 min ago', y: TB + 38, size: 20, color: 'muted', k: k(enter(0.42), exit(D + 0.1)) }),
        text({ id: 'upd1', text: 'Updated just now', y: TB + 38, size: 20, weight: 500, k: enter(D + 0.12) }),
        icon({ id: 'compose', icon: 'pencil', x: 204, y: TB + 38, size: 28, sw: 2.4, k: enter(0.44) }),
        statusBar(0.26),
        homeBar(0.3),
      ] }),
      cursorE([[0, 440, 420], [G - 0.58, 440, 420], [G - 0.1, 40, R0 + RH + 6], [G, 40, R0 + RH + 6], [P, 40, R0 + RH + 6 + PULL, 'Power2 Out'], [P + 0.65, 390, 250]],
        [], [[G, P]], { inAt: G - 0.62 }),
    ];
  },
});

// 5 ─ Onboarding carousel: three pages swipe across, the dots stretch into a pill, Get started unfolds
UIK.define({
  id: 'onboarding-carousel', name: 'Onboarding carousel', cat: 'mobile', T: 4.1, cam: PHONE_CAM,
  desc: 'Two swipes carry three onboarding pages across (drag, then a decisive snap). The page dots hand the ink pill along, each new illustration pops as it lands, and on the last page Next unfolds into a full-width Get started button that is tapped.',
  build: () => {
    const S1 = 0.95, S2 = 2.0, SW = 0.3, DR = 170, R1 = S1 + SW, R2 = S2 + SW, M = R2 + 0.12, B = 3.42;
    const P = [
      { title: 'Plan your week', body: 'Keep every task and meeting in one calm place.', icon: 'calendar', c: 'ink', ic: 'inv', chip: 'Mon · 9:00', cw: 150 },
      { title: 'Work together', body: 'Share boards and see every change as it happens.', icon: 'users', c: 'ink', ic: 'inv', chip: '3 online', cw: 128 },
      { title: 'Stay on track', body: 'Gentle reminders keep the whole team moving.', icon: 'check', c: 'acc', ic: '#FFFFFF', chip: 'All done', cw: 130 },
    ];
    const land = [0.42, R1, R2];
    const page = (p, i) => group({ id: 'page' + i, x: i * PW, ch: [
      rect({ id: 'art' + i, y: -170, w: 420, h: 400, r: 48, fill: 'soft', k: i ? null : enter(0.3, { dy: 20, y0: -170 }), ch: [
        circle({ id: 'disc' + i, y: -16, d: 204, fill: p.c, k: pop(land[i], { from: i ? 0.8 : 0.6, dur: 0.5 }), ch: [icon({ icon: p.icon, size: 92, color: p.ic, sw: 5 })] }),
        rect({ id: 'chip' + i, x: 100, y: 124, w: p.cw, h: 56, r: 28, fill: 'card', shadow: 3, k: enter(land[i] + 0.16, { dy: 14, y0: 124 }),
          ch: [text({ text: p.chip, size: 22, weight: 600 })] }),
      ] }),
      text({ id: 'title' + i, text: p.title, y: 124, size: 44, weight: 600, ls: -0.02, k: i ? null : enter(0.4, { dy: 14, y0: 124 }) }),
      text({ id: 'body' + i, text: p.body, y: 208, size: 26, color: 'muted', wrap: 400, lh: 1.4, k: i ? null : enter(0.46) }),
    ] });
    const DL = [[-46, 10, 34], [-46, -22, 34], [-46, -22, 2]], DW = [[44, 12, 12], [12, 44, 12], [12, 12, 44]];
    const dotK = (i) => {
      const x = [DL[0][i]], w = [DW[0][i]], fill = [];
      [R1, R2].forEach((t, j) => {
        if (DL[j + 1][i] !== DL[j][i]) x.push([t, t + 0.45, DL[j + 1][i], 'Power4 Out']);
        if (DW[j + 1][i] !== DW[j][i]) { w.push([t, t + 0.45, DW[j + 1][i], 'Power4 Out']); fill.push([t, t + 0.25, DW[j + 1][i] > 12 ? 'ink' : 'dim', 'Power2 Out']); }
      });
      return k(fadeIn(0.5), { x, w }, fill.length ? { fill } : null);
    };
    return [
      phone({ fill: 'card', ch: [
        group({ id: 'pages', k: { x: [[S1, R1, -DR, 'Power2 In'], [R1, R1 + 0.55, -PW, 'Power3 Out'], [S2, R2, -PW - DR, 'Power2 In'], [R2, R2 + 0.55, -2 * PW, 'Power3 Out']] },
          ch: P.map(page) }),
        ...[0, 1, 2].map((i) => rect({ id: 'dot' + i, x: DL[0][i], y: 318, pin: 'l', w: DW[0][i], h: 12, r: 6, fill: i ? 'dim' : 'ink', k: dotK(i) })),
        text({ id: 'skip', text: 'Skip', x: -170, y: 410, size: 26, weight: 500, color: 'muted', k: k(enter(0.52), exit(R2 + 0.02)) }),
        rect({ id: 'next', x: 214, y: 410, pin: 'r', chAt: 'pin', w: 88, h: 88, r: 44, fill: 'ink',
          k: k(fadeIn(0.5), { w: [[M, M + 0.6, 428, 'Expo Out']] }, press(B, { to: 0.96 })), ch: [
            icon({ id: 'nextArrow', icon: 'arrow', x: -44, size: 34, sw: 2.6, color: 'inv', k: { x: [[M, M + 0.6, -137, 'Expo Out']] } }),
            text({ id: 'getStarted', text: 'Get started', x: -238, size: 26, weight: 600, color: 'inv', k: enter(M + 0.18, { dx: -12, x0: -238 }) }),
          ] }),
        statusBar(0.26),
        homeBar(0.3),
      ] }),
      cursorE([[0, 440, 420], [0.5, 440, 420], [S1 - 0.08, 150, -250], [S1, 150, -250], [R1, 150 - DR, -250, 'Power2 In'], [R1 + 0.4, 60, -180],
        [S2 - 0.08, 150, -250], [S2, 150, -250], [R2, 150 - DR, -250, 'Power2 In'], [R2 + 0.45, 90, 180], [B - 0.1, 12, 418], [B + 0.2, 12, 418], [4.05, 320, 470]],
        [B], [[S1, R1], [S2, R2]], { inAt: 0.45 }),
    ];
  },
});

// 6 ─ Hamburger → drawer: the three lines fold into an X, a drawer slides in, the page dims
UIK.define({
  id: 'hamburger-menu', name: 'Hamburger → drawer', cat: 'mobile', T: 4.0, cam: PHONE_CAM,
  desc: 'A tap folds the hamburger into an X (the lines meet, then rotate) while a drawer slides in from the left, the page dims and shifts aside, and the menu rows stagger in. Tapping Projects glides the highlight down, the drawer closes, the X unfolds and the page title swaps.',
  build: () => {
    const C1 = 0.95, O = C1 + 0.04, C2 = 2.3, X = C2 + 0.36, BX = -192, BY = -392, DW = 400, DX0 = -250 - DW - 24, DX1 = -250;
    const ROW = (i) => -150 + i * 84;
    const items = [['Home', 'home'], ['Projects', 'layers'], ['Messages', 'message'], ['Calendar', 'calendar'], ['Settings', 'settings']];
    const line = (i) => {
      const y0 = (i - 1) * 12, a = i === 1 ? 0 : i ? -45 : 45;
      const kk = i === 1
        ? { opacity: [[C1, C1 + 0.12, 0, 'Linear'], [X + 0.14, X + 0.3, 1, 'Linear']], sx: [[C1, C1 + 0.16, 0.2, 'Power2 Out'], [X + 0.14, X + 0.36, 1, 'Power3 Out']] }
        : { y: [[C1, C1 + 0.16, 0, 'Power2 Out'], [X + 0.14, X + 0.36, y0, 'Power3 Out']], rot: [[C1 + 0.12, C1 + 0.52, a, 'Power4 Out'], [X, X + 0.2, 0, 'Power2 Out']] };
      return path({ id: 'line' + i, y: y0, d: 'M-18 0 L18 0', stroke: 'ink', sw: 4.5, k: kk });
    };
    const bar = (id, x, y, w, h, fill = 'skel') => rect({ id, x, y, pin: 'l', w, h, r: h / 2, fill });
    return [
      phone({ fill: 'panel', ch: [
        group({ id: 'page', k: { x: [[O, O + 0.6, 36, 'Expo Out'], [X, X + 0.45, 0, 'Power3 Out']] }, ch: [
          text({ id: 'ttlHome', text: 'Home', x: BX + 50, y: BY, ax: 0, size: 40, weight: 600, ls: -0.02, k: k(enter(0.3, { dx: -12, x0: BX + 50 }), exit(X + 0.05)) }),
          text({ id: 'ttlProjects', text: 'Projects', x: BX + 50, y: BY, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(X + 0.1, { dx: -12, x0: BX + 50 }) }),
          circle({ id: 'avatar', x: 192, y: BY, d: 56, fill: 'dim', k: enter(0.34, { s: 0.7 }) }),
          group({ id: 'homeContent', k: k(enter(0.4, { dy: 24, blur: 6 }), exit(X, { dur: 0.2 })), ch: [
            rect({ id: 'hero', y: -190, w: 452, h: 280, r: 34, fill: 'card', ch: [
              rect({ id: 'heroImg', y: -36, w: 412, h: 168, r: 22, fill: 'soft' }),
              bar('heroBar', -206, 96, 240, 22, 'dim'),
            ] }),
            rect({ id: 'listCard', y: 110, w: 452, h: 260, r: 34, fill: 'card', ch: [
              ...[0, 1].map((j) => circle({ id: 'lAv' + j, x: -170, y: -56 + j * 112, d: 60, fill: j ? 'skel' : 'dim' })),
              ...[0, 1].map((j) => bar('lBar' + j, -122, -56 + j * 112, [230, 180][j], 20)),
            ] }),
          ] }),
          ...['Brand refresh', 'Website', 'Q4 campaign', 'Archive'].map((s, j) => rect({ id: 'proj' + j, y: -240 + j * 136, w: 452, h: 116, r: 30, fill: 'card',
            k: enter(X + 0.16 + j * 0.06, { dy: 18, y0: -240 + j * 136 }), ch: [
              rect({ x: -168, w: 72, h: 72, r: 22, fill: ['ink', 'dim', 'skel', 'soft'][j], ch: j ? [] : [icon({ icon: 'layers', size: 34, sw: 2.4, color: 'inv' })] }),
              text({ text: s, x: -112, ax: 0, size: 28, weight: 600, ls: -0.01 }),
            ] })),
        ] }),
        rect({ id: 'scrim', w: PW, h: PH, fill: 'shade', k: { opacity: [0, [O, O + 0.45, 0.32, 'Power2 Out'], [X, X + 0.35, 0, 'Power2 Out']] } }),
        rect({ id: 'drawer', x: DX0, pin: 'l', chAt: 'pin', w: DW, h: PH, radii: '0 44px 44px 0', fill: 'card', shadow: 2,
          k: { x: [[O, O + 0.6, DX1, 'Expo Out'], [X, X + 0.38, DX0, 'Power2 In']] }, ch: [
            circle({ id: 'dAvatar', x: 62, y: -296, d: 72, fill: 'ink', k: enter(O + 0.1, { s: 0.7 }), ch: [text({ text: 'AR', size: 26, weight: 600, color: 'inv' })] }),
            text({ id: 'dName', text: 'Ana Reyes', x: 114, y: -312, ax: 0, size: 28, weight: 600, ls: -0.01, k: enter(O + 0.13, { dx: -14, x0: 114 }) }),
            text({ id: 'dMail', text: 'ana@studio.co', x: 114, y: -278, ax: 0, size: 22, color: 'muted', k: enter(O + 0.16) }),
            rect({ id: 'highlight', x: 16, y: ROW(0), pin: 'l', w: 368, h: 68, r: 20, fill: 'soft',
              k: k(fadeIn(O + 0.2), { y: [[C2, C2 + 0.4, ROW(1), 'Power4 Out']], h: [[C2, C2 + 0.12, 92, 'Power2 Out'], [C2 + 0.12, C2 + 0.45, 68, 'Power3 Out']] }) }),
            ...items.flatMap(([s, ic], i) => [
              icon({ id: 'itemIc' + i, icon: ic, x: 60, y: ROW(i), size: 30, sw: 2.4, k: enter(O + 0.14 + i * 0.05, { dx: -20, x0: 60 }) }),
              text({ id: 'itemLbl' + i, text: s, x: 102, y: ROW(i), ax: 0, size: 28, weight: 500, k: enter(O + 0.14 + i * 0.05, { dx: -20, x0: 102 }) }),
            ]),
            rect({ id: 'count', x: 340, y: ROW(2), w: 44, h: 32, r: 16, fill: 'acc', k: pop(O + 0.45, { from: 0.4 }),
              ch: [text({ text: '3', size: 20, weight: 600, color: '#FFFFFF' })] }),
          ] }),
        group({ id: 'burger', x: BX, y: BY, k: k(enter(0.3, { s: 0.7 }), press(C1, { to: 0.86 })), ch: [0, 1, 2].map(line) }),
        statusBar(0.26),
        homeBar(0.3),
      ] }),
      cursorLayer([[0, 440, 420], [0.5, 440, 420], [C1 - 0.1, BX + 8, BY + 10], [C1 + 0.2, BX + 8, BY + 10],
        [C2 - 0.12, -110, ROW(1) + 10], [C2 + 0.2, -110, ROW(1) + 10], [3.8, 390, 280]], [C1, C2], [], { inAt: 0.45 }),
    ];
  },
});

// 7 ─ Breadcrumbs: folder clicks append crumbs, the path scrolls when long, Home collapses it back
UIK.define({
  id: 'breadcrumbs', name: 'Breadcrumbs', cat: 'mobile', T: 4.2, cam: 1.35,
  desc: 'Clicking folders appends crumbs that slide in while the list swaps with a directional slide; the third crumb overflows, so the path scrolls left. Clicking Home collapses every crumb back in reverse order and the root list slides in from the other side.',
  build: () => {
    const C1 = 1.0, C2 = 2.05, C3 = 3.15, BY = -176, RY = [-58, 42, 142];
    const CL = -254, CR = 394, CW = CR - CL, CX = (CL + CR) / 2;
    const W = [113.9, 265.8, 273.2], NAMES = ['Projects', 'Brand refresh 2026', 'Social media assets'];
    const pos = []; let cx = 0;
    for (let j = 0; j < 3; j++) { pos.push({ sep: cx + 14, lbl: cx + 32 }); cx += 32 + W[j] + 8; }
    // the third crumb overflows: scroll by exactly the first crumb, which fades as it passes under the clip edge
    const SCROLL = Math.round(pos[1].sep - 18);
    const inAt = [0.36, C1 + 0.06, C2 + 0.06], outAt = [C3 + 0.1, C3 + 0.05, C3];
    const crumbCol = [[C1, C1 + 0.2, 'muted', 'Power2 Out']], crumbCol1 = [[C2, C2 + 0.2, 'muted', 'Power2 Out']];
    const LISTS = [
      [['folder', 'Brand refresh 2026', '3 folders'], ['folder', 'Website redesign', '48 files'], ['folder', 'Q4 campaign', '9 files']],
      [['folder', 'Guidelines', '6 files'], ['folder', 'Social media assets', '24 files'], ['folder', 'Exports', '31 files']],
      [['image', 'launch-post.png', '2.4 MB'], ['video', 'story-teaser.mp4', '18 MB'], ['image', 'banner-wide.jpg', '1.1 MB']],
      [['folder', 'Projects', '3 folders'], ['users', 'Shared with me', '12 files'], ['clock', 'Recent', '8 files']],
    ];
    const LT = [[0.44, 0, C1, -1], [C1 + 0.1, 30, C2, -1], [C2 + 0.1, 30, C3, 1], [C3 + 0.14, -30, null, 0]];
    const list = (rows, li) => {
      const [tIn, dIn, tOut, dOut] = LT[li];
      const kk = tOut != null ? k(exit(tOut, { dur: 0.18 }), { x: [[tOut, tOut + 0.22, dOut * 34, 'Power2 In']] }) : null;
      const e = (i, x) => enter(tIn + i * 0.05, dIn ? { dx: dIn, x0: x, blur: 6 } : { dy: 14, y0: RY[i], blur: 6 });
      return group({ id: 'list' + li, k: kk, ch: rows.flatMap(([ic, name, meta], i) => [
        icon({ id: `l${li}r${i}Ic`, icon: ic, x: -372, y: RY[i], size: 32, sw: 2.4, color: ic === 'folder' ? 'ink' : 'muted', k: e(i, -372) }),
        text({ id: `l${li}r${i}Name`, text: name, x: -334, y: RY[i], ax: 0, size: 30, weight: 500, k: e(i, -334) }),
        text({ id: `l${li}r${i}Meta`, text: meta, x: 390, y: RY[i], ax: 1, size: 24, color: 'muted', k: e(i, 390) }),
      ]) });
    };
    return [
      rect({ id: 'card', w: 900, h: 500, r: 40, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'pathBar', y: BY, w: 820, h: 84, r: 26, fill: 'soft', k: fadeIn(0.24), ch: [
          rect({ id: 'homeHover', x: -324, w: 136, h: 60, r: 18, fill: 'card', k: k({ opacity: [0, [C3 - 0.28, C3 - 0.14, 1, 'Power2 Out'], [C3 + 0.45, C3 + 0.7, 0, 'Power2 Out']] }, press(C3, { to: 0.95 })) }),
          icon({ id: 'homeIc', icon: 'home', x: -372, size: 28, sw: 2.4, color: 'muted', k: k(enter(0.3), { color: [[C3 + 0.1, C3 + 0.3, 'ink', 'Power2 Out']] }) }),
          text({ id: 'homeLbl', text: 'Home', x: -346, ax: 0, size: 30, weight: 500, color: 'muted', k: k(enter(0.32), { color: [[C3 + 0.1, C3 + 0.3, 'ink', 'Power2 Out']] }) }),
          group({ id: 'crumbClip', x: CX, clip: true, w: CW, h: 84, ch: [
            group({ id: 'crumbTrack', x: -CW / 2, k: { x: [[C2 + 0.08, C2 + 0.6, -CW / 2 - SCROLL, 'Power3 Out']] },
              ch: NAMES.flatMap((s, j) => {
                const ek = (x) => k(enter(inAt[j], { dx: 24, x0: x, blur: 6 }), j ? exit(outAt[j], { dur: 0.16 }) : { opacity: [[C2 + 0.08, C2 + 0.32, 0, 'Power2 Out']] },
                  j ? { x: [[outAt[j], outAt[j] + 0.2, x - 16, 'Power2 In']] } : null);
                return [
                  icon({ id: 'sep' + j, icon: 'chevronRight', x: pos[j].sep, size: 24, sw: 2.4, color: 'muted', k: ek(pos[j].sep) }),
                  text({ id: 'crumb' + j, text: s, x: pos[j].lbl, ax: 0, size: 30, weight: 500,
                    k: k(ek(pos[j].lbl), j === 0 ? { color: crumbCol } : j === 1 ? { color: crumbCol1 } : null) }),
                ];
              }) }),
          ] }),
        ] }),
        rect({ id: 'hover', y: RY[0], w: 840, h: 88, r: 22, fill: 'soft',
          k: k({ opacity: [0, [C1 - 0.28, C1 - 0.14, 1, 'Power2 Out'], [C1 + 0.12, C1 + 0.3, 0, 'Power2 Out'], [C2 - 0.28, C2 - 0.14, 1, 'Power2 Out'], [C2 + 0.12, C2 + 0.3, 0, 'Power2 Out']],
                  y: [[C1 + 0.4, RY[1]]] }, press(C1, { to: 0.98 }), press(C2, { to: 0.98 })) }),
        ...LISTS.map(list),
      ] }),
      cursorLayer([[0, 520, 330], [0.5, 520, 330], [C1 - 0.1, -150, RY[0] + 8], [C1 + 0.15, -150, RY[0] + 8], [C2 - 0.1, -120, RY[1] + 8], [C2 + 0.15, -120, RY[1] + 8],
        [C3 - 0.1, -318, BY + 8], [C3 + 0.2, -318, BY + 8], [4.1, 150, 300]], [C1, C2, C3], [], { inAt: 0.45 }),
    ];
  },
});

// 8 ─ Pagination: the ink page pill stretches along the pager, the grid swaps with a directional slide
UIK.define({
  id: 'pagination', name: 'Pagination', cat: 'mobile', T: 3.6, cam: 1.2,
  desc: 'Clicking 2, then 3: the ink page pill stretches along the pager (leading edge first, numbers invert through it), the six-card grid slides out to the left and the next page slides in from the right column by column, and the range label swaps.',
  build: () => {
    const C1 = 1.1, C2 = 2.3, NX = [-120, -40, 40, 120], PY = 290, CX = [-344, 0, 344], RY = [-120, 104], DARK = [1, 3, 5];
    const tiles = (p, tIn, dx) => [0, 1, 2, 3, 4, 5].map((j) => {
      const c = j % 3, r = j > 2 ? 1 : 0, dark = j === DARK[p];
      return rect({ id: `tile${p}_${j}`, x: CX[c], y: RY[r], w: 320, h: 200, r: 26, fill: dark ? 'ink' : 'soft',
        k: enter(tIn + c * 0.05 + r * 0.03, dx ? { dx, x0: CX[c], blur: 8 } : { dy: 20, y0: RY[r], blur: 8 }), ch: [
          text({ text: String(p * 6 + j + 1).padStart(2, '0'), x: -128, y: 44, ax: 0, size: 60, weight: 600, ls: -0.03, tnum: false, color: dark ? 'inv' : 'ink' }),
          ...(dark ? [circle({ x: 124, y: -64, d: 14, fill: 'acc' })] : []),
        ] });
    });
    const out = (t) => k(exit(t, { dur: 0.2 }), { x: [[t, t + 0.26, -70, 'Power2 In']] });
    const pillL = (i) => NX[i] - 36;
    return [
      rect({ id: 'card', w: 1120, h: 700, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Gallery', x: -500, y: -292, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -500 }) }),
        text({ id: 'range0', text: '1–6 of 24', x: 500, y: -292, ax: 1, size: 26, color: 'muted', k: k(enter(0.3), exit(C1)) }),
        text({ id: 'range1', text: '7–12 of 24', x: 500, y: -292, ax: 1, size: 26, color: 'muted', k: k(enter(C1 + 0.05), exit(C2)) }),
        text({ id: 'range2', text: '13–18 of 24', x: 500, y: -292, ax: 1, size: 26, color: 'muted', k: enter(C2 + 0.05) }),
        group({ id: 'page0', k: out(C1), ch: tiles(0, 0.3, 0) }),
        group({ id: 'page1', k: out(C2), ch: tiles(1, C1 + 0.1, 70) }),
        group({ id: 'page2', ch: tiles(2, C2 + 0.1, 70) }),
        icon({ id: 'prev', icon: 'chevronLeft', x: -216, y: PY, size: 32, sw: 2.6, color: 'dim', k: k(enter(0.44), { color: [[C1 + 0.1, C1 + 0.3, 'ink', 'Power2 Out']] }) }),
        icon({ id: 'next', icon: 'chevronRight', x: 216, y: PY, size: 32, sw: 2.6, k: enter(0.5) }),
        rect({ id: 'pill', x: pillL(0), y: PY, pin: 'l', w: 72, h: 72, r: 36, fill: 'ink',
          k: k(fadeIn(0.44), edges(C1, pillL(0), pillL(0) + 72, pillL(1), pillL(1) + 72, { fast: 0.3, slow: 0.42 }), edges(C2, pillL(1), pillL(1) + 72, pillL(2), pillL(2) + 72, { fast: 0.3, slow: 0.42 })) }),
        ...NX.map((x, i) => text({ id: 'num' + i, text: String(i + 1), x, y: PY, size: 30, weight: 600, color: '#FFFFFF', blend: 'difference',
          k: k(enter(0.46 + i * 0.04, { blur: 0 }), i === 1 ? press(C1, { to: 0.85 }) : null, i === 2 ? press(C2, { to: 0.85 }) : null) })),
      ] }),
      cursorLayer([[0, 560, 380], [0.6, 560, 380], [C1 - 0.1, NX[1] + 6, PY + 8], [C1 + 0.15, NX[1] + 6, PY + 8], [C2 - 0.1, NX[2] + 6, PY + 8],
        [C2 + 0.15, NX[2] + 6, PY + 8], [3.5, 420, 400]], [C1, C2], [], { inAt: 0.55 }),
    ];
  },
});

// 9 ─ FAB speed dial: + turns into ×, three actions fan up with labels, one is picked, it all folds back
UIK.define({
  id: 'fab-speed-dial', name: 'FAB speed dial', cat: 'mobile', T: 3.8, cam: PHONE_CAM,
  desc: 'The accent floating button is tapped: its plus rotates 45° into a close mark, a frosted scrim covers the notes, and three mini actions rise out of it on a stagger with their labels sliding in. Voice note is tapped and everything folds back into the button.',
  build: () => {
    const C1 = 1.0, C2 = 2.3, X = C2 + 0.32, FX = 166, FY = 380, MY = [266, 162, 58];
    const acts = [['Photo', 'image', 66.6], ['Voice note', 'mic', 119.4], ['Text note', 'pencil', 104.5]];
    const notes = [['Weekend plans', 'Market, then a long walk'], ['Shot list', 'Wide shot, slow push in'], ['Book notes', 'Chapter 4 — small wins']];
    const open = (j) => C1 + 0.06 + j * 0.06, close = (j) => X + (2 - j) * 0.04;
    return [
      phone({ fill: 'panel', ch: [
        text({ id: 'title', text: 'Notes', x: -206, y: -392, ax: 0, size: 52, weight: 600, ls: -0.02, k: enter(0.3, { dx: -14, x0: -206 }) }),
        ...notes.map(([t, s], j) => rect({ id: 'note' + j, y: -236 + j * 176, w: 452, h: 156, r: 30, fill: 'card', k: enter(0.38 + j * 0.06, { dy: 18, y0: -236 + j * 176 }), ch: [
          text({ text: t, x: -196, y: -24, ax: 0, size: 28, weight: 600, ls: -0.01 }),
          text({ text: s, x: -196, y: 18, ax: 0, size: 24, color: 'muted' }),
        ] })),
        rect({ id: 'scrim', w: PW, h: PH, fill: 'panel', k: { opacity: [0, [C1, C1 + 0.3, 0.86, 'Power2 Out'], [X, X + 0.3, 0, 'Power2 Out']] } }),
        ...acts.map(([s, ic, tw], j) => rect({ id: 'lbl' + j, x: FX - 62, y: MY[j], pin: 'r', chAt: 'pin', w: tw + 36, h: 56, r: 18, fill: 'card', shadow: 3,
          k: k(enter(open(j) + 0.1, { dx: 18, x0: FX - 62, blur: 6 }), exit(close(j) - 0.04, { dur: 0.12 })),
          ch: [text({ text: s, x: -(tw + 36) / 2, size: 24, weight: 600 })] })),
        ...acts.map(([s, ic], j) => circle({ id: 'mini' + j, x: FX, y: FY, d: 84, fill: 'card', shadow: 2,
          k: k({ y: [[open(j), open(j) + 0.5, MY[j], 'Power4 Out'], [close(j), close(j) + 0.26, FY, 'Power2 In']],
                 scale: [0.4, [open(j), open(j) + 0.45, 1, 'Back Out'], [close(j), close(j) + 0.26, 0.4, 'Power2 In']],
                 opacity: [0, [open(j), open(j) + 0.12, 1, 'Linear'], [close(j) + 0.12, close(j) + 0.26, 0, 'Linear']] },
               j === 1 ? { scale: [[C2 - 0.07, C2, 0.9, 'Power2 Out'], [C2 + 0.02, C2 + 0.26, 1, 'Back Out']] } : null),
          ch: [icon({ icon: ic, size: 34, sw: 2.4 })] })),
        circle({ id: 'fab', x: FX, y: FY, d: 112, fill: 'acc', shadow: 2, k: k(pop(0.45, { from: 0.4 }), press(C1, { to: 0.9 })), ch: [
          icon({ id: 'plus', icon: 'plus', size: 48, sw: 3, color: '#FFFFFF', k: { rot: [[C1, C1 + 0.45, 45, 'Power4 Out'], [X, X + 0.4, 0, 'Power4 Out']] } }),
        ] }),
        statusBar(0.26),
        homeBar(0.3),
      ] }),
      cursorLayer([[0, 440, 420], [0.55, 440, 420], [C1 - 0.1, FX + 6, FY + 8], [C1 + 0.2, FX + 6, FY + 8], [C2 - 0.1, FX + 6, MY[1] + 8],
        [C2 + 0.2, FX + 6, MY[1] + 8], [3.6, 400, 250]], [C1, C2], [], { inAt: 0.5 }),
    ];
  },
});

// 10 ─ Search expand: a round button grows into a field, the query types in, matching rows drop in
UIK.define({
  id: 'search-expand', name: 'Search expand', cat: 'mobile', T: 4.0, cam: { zoom: 1.3, y: -40 },
  desc: 'A click on the round search button grows it leftward into a full field (pinned right) as the icon rides the leading edge; the placeholder gives way to the typed query, recent searches drop in beneath with the match in bold, and one is picked.',
  build: () => {
    const C1 = 0.95, E = C1 + 0.04, TY0 = 1.72, TY1 = 2.12, D = 2.24, H = 2.98, CL = 3.3, BY = -200, W1 = 760, RX = 526;
    const MX = RX - W1 / 2, MT = BY + 44 + 16, RR = [110, 186, 262], REST = [['guidelines'], ['refresh 2026'], ['assets']];
    return [
      rect({ id: 'appBar', y: BY, w: 1100, h: 136, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'logo', x: -482, w: 72, h: 72, r: 22, fill: 'ink', k: enter(0.24, { s: 0.7 }), ch: [icon({ icon: 'layers', size: 36, sw: 2.4, color: 'inv' })] }),
        text({ id: 'title', text: 'Library', x: -426, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.28, { dx: -14, x0: -426 }) }),
        rect({ id: 'field', x: RX, pin: 'r', chAt: 'pin', w: 88, h: 88, r: 44, fill: 'soft', stroke: 'ink', sw: 0, origin: [0, 0],
          k: k(enter(0.32, { blur: 0 }), press(C1, { to: 0.92 }), { w: [[E, E + 0.62, W1, 'Expo Out']], sw: [[E + 0.2, E + 0.4, 2.5, 'Power2 Out']] }), ch: [
            icon({ id: 'searchIc', icon: 'search', x: -44, size: 34, sw: 2.6, k: { x: [[E, E + 0.62, -W1 + 46, 'Expo Out']], color: [[E + 0.1, E + 0.3, 'muted', 'Power2 Out']] } }),
            text({ id: 'placeholder', text: 'Search files and folders', x: -W1 + 86, ax: 0, size: 30, color: 'muted', k: k(enter(E + 0.32), exit(TY0 - 0.04, { dur: 0.08, blur: 0 })) }),
            text({ id: 'query', text: 'brand', x: -W1 + 86, ax: 0, size: 30, weight: 500, caret: true, caretColor: 'acc', caretFrom: E + 0.36, k: { reveal: [0, [TY0, TY1, 1, 'Linear']] } }),
            icon({ id: 'clear', icon: 'x', x: -44, size: 28, sw: 2.6, color: 'muted', k: enter(E + 0.42, { s: 0.6 }) }),
          ] }),
      ] }),
      rect({ id: 'results', x: MX, y: MT, pin: 't', chAt: 'pin', w: W1, h: 0, r: 28, fill: 'card', shadow: 2, clip: true,
        k: { h: [[D, D + 0.5, 318, 'Power4 Out']], opacity: [0, [D, D + 0.1, 1, 'Linear']] }, ch: [
          text({ id: 'recent', text: 'Recent searches', x: -340, y: 42, ax: 0, size: 22, weight: 500, color: 'muted', k: enter(D + 0.1) }),
          text({ id: 'clearAll', text: 'Clear', x: 340, y: 42, ax: 1, size: 22, weight: 500, color: 'muted', k: enter(D + 0.14) }),
          rect({ id: 'hover', y: RR[1], w: 728, h: 70, r: 18, fill: 'soft', k: k({ opacity: [0, [H, H + 0.15, 1, 'Power2 Out']] }, press(CL, { to: 0.97 })) }),
          ...REST.map(([rest], j) => group({ id: 'res' + j, y: RR[j], k: enter(D + 0.12 + j * 0.07, { dy: -12, y0: RR[j], blur: 6 }), ch: [
            icon({ icon: 'clock', x: -336, size: 28, sw: 2.4, color: 'muted' }),
            text({ text: 'brand', x: -300, ax: 0, size: 30, weight: 600 }),
            text({ text: rest, x: -300 + 81.7 + 8, ax: 0, size: 30, color: 'muted' }),
            icon({ icon: 'arrowUp', x: 336, size: 26, sw: 2.4, color: 'muted', rot: -45 }),
          ] })),
        ] }),
      cursorLayer([[0, 560, 240], [0.45, 560, 240], [C1 - 0.1, 492, BY + 8], [C1 + 0.25, 492, BY + 8], [1.62, 600, -60], [H - 0.06, 190, MT + RR[1] + 8],
        [CL + 0.2, 190, MT + RR[1] + 8], [3.95, 520, 290]], [C1, CL], [], { inAt: 0.4 }),
    ];
  },
});

// 11 ─ Reading progress: flicks scroll the article; the top bar fills and the minutes count down
UIK.define({
  id: 'reading-progress', name: 'Reading progress', cat: 'mobile', T: 4.4, cam: PHONE_CAM,
  desc: 'Three flicks scroll an article under a fixed header (drag, then momentum). A thin accent bar along the header fills in step with the scroll and the minutes-left label counts down, ending on Finished.',
  build: () => {
    const F = [0.95, 1.9, 2.85], FL = 0.18, MO = 0.62, DRG = 110, MOM = 250, STEP = DRG + MOM, TOT = 3 * STEP, END = F[2] + FL + 0.36;
    const scroll = (f) => F.flatMap((t, i) => [[t, t + FL, f(i * STEP + DRG), 'Power2 In'], [t + FL, t + FL + MO, f((i + 1) * STEP), 'Power3 Out']]);
    const para = (id, y, s) => text({ id, text: s, x: -226, y, ax: 0, size: 26, wrap: 452, lh: 1.5 });
    const keys = [[0, 440, 420], [0.5, 440, 420]];
    F.forEach((t) => keys.push([t - 0.1, 70, 240], [t, 70, 240], [t + FL, 70, 240 - DRG, 'Power2 In'], [t + 0.56, 88, 252, 'Power2 Out']));
    keys.push([4.3, 390, 300]);
    return [
      phone({ fill: 'card', ch: [
        group({ id: 'article', k: k(enter(0.3, { dy: 30, blur: 6 }), { y: [0, ...scroll((s) => -s)] }), ch: [
          rect({ id: 'hero', y: -186, w: 452, h: 250, r: 30, fill: 'soft', clip: true, ch: [
            circle({ id: 'sun', x: 110, y: -44, d: 56, fill: 'dim' }),
            path({ id: 'hills', d: 'M-226 125 L-226 60 L-90 -20 L10 60 L80 10 L226 110 L226 125 Z', fill: 'dim' }),
          ] }),
          text({ id: 'kicker', text: 'Essay · Design', x: -226, y: -26, ax: 0, size: 20, weight: 600, color: 'muted', ls: 0.06, upper: true }),
          text({ id: 'headline', text: 'The quiet craft of motion design', x: -226, y: 48, ax: 0, size: 44, weight: 600, ls: -0.02, wrap: 452, lh: 1.1 }),
          circle({ id: 'author', x: -200, y: 150, d: 52, fill: 'ink', ch: [text({ text: 'MR', size: 18, weight: 600, color: 'inv' })] }),
          text({ id: 'authorName', text: 'Maya Reyes', x: -162, y: 138, ax: 0, size: 22, weight: 600 }),
          text({ id: 'authorMeta', text: 'Sep 25 · 6 min read', x: -162, y: 164, ax: 0, size: 20, color: 'muted' }),
          para('p1', 310, 'Good motion is felt before it is seen. It tells you where something came from, where it is going, and what just changed.'),
          rect({ id: 'quoteBar', x: -223, y: 520, w: 6, h: 84, r: 3, fill: 'acc' }),
          text({ id: 'quote', text: 'Motion is the grammar of an interface.', x: -200, y: 520, ax: 0, size: 30, weight: 500, wrap: 420, lh: 1.3 }),
          para('p2', 720, 'The best interfaces move like people do: quick to start, gentle to stop. Every transition earns its place by explaining a change.'),
          rect({ id: 'clip', y: 960, w: 452, h: 220, r: 30, fill: 'soft', ch: [
            circle({ d: 84, fill: 'card', shadow: 3, ch: [icon({ icon: 'play', size: 30, sw: 2.4, filled: true, fill: 'ink', x: 3 })] }),
          ] }),
          para('p3', 1200, 'Give each change room to land, and hold the final state long enough to read. Your viewer will thank you with attention.'),
          rect({ id: 'endRule', y: 1360, w: 60, h: 4, r: 2, fill: 'dim' }),
          text({ id: 'endNote', text: 'Thanks for reading', y: 1400, size: 22, color: 'muted' }),
        ] }),
        rect({ id: 'header', y: -421, w: PW, h: 158, fill: 'card' }),
        icon({ id: 'back', icon: 'chevronLeft', x: -210, y: -392, size: 32, sw: 2.6, k: enter(0.3) }),
        text({ id: 'section', text: 'Journal', x: -180, y: -392, ax: 0, size: 26, weight: 600, k: enter(0.32, { dx: -10, x0: -180 }) }),
        text({ id: 'left', x: 212, y: -392, ax: 1, size: 22, weight: 500, color: 'muted', num: { suf: ' min left' },
          k: k(enter(0.36), { value: [4, ...scroll((s) => 4 - 3 * s / TOT)] }, exit(END)) }),
        group({ id: 'finished', x: 212, y: -392, k: enter(END + 0.02, { dx: 12, x0: 212 }), ch: [
          icon({ id: 'doneIc', icon: 'check', x: -106, size: 24, sw: 3, color: 'ink' }),
          text({ id: 'doneLbl', text: 'Finished', ax: 1, size: 22, weight: 600 }),
        ] }),
        rect({ id: 'track', y: -344, w: PW, h: 6, fill: 'skel', k: fadeIn(0.36) }),
        rect({ id: 'progress', x: -PW / 2, y: -344, pin: 'l', w: 0, h: 6, fill: 'acc', k: { w: [0, ...scroll((s) => PW * s / TOT)] } }),
        // bottom action bar: the article scrolls under it, not under the home indicator
        rect({ id: 'actions', y: 456, w: PW, h: 88, fill: 'card' }),
        rect({ id: 'actionsLine', y: 412, w: PW, h: 2, fill: 'line', k: fadeIn(0.4) }),
        ...['heart', 'message', 'bookmark', 'send'].map((ic, i) => icon({ id: 'act' + i, icon: ic, x: -165 + i * 110, y: 446, size: 30, sw: 2.4, k: enter(0.42 + i * 0.04) })),
        statusBar(0.26),
        homeBar(0.3),
      ] }),
      cursorE(keys, [], F.map((t) => [t, t + FL]), { inAt: 0.5 }),
    ];
  },
});

// 12 ─ Context menu: right-click pops a menu at the cursor, the highlight follows, a submenu slides out
UIK.define({
  id: 'context-menu', name: 'Context menu', cat: 'mobile', T: 3.9, cam: 1.2,
  desc: 'A right-click on a file tile selects it and pops a menu that grows from the cursor corner. The highlight follows the cursor down to Share, a submenu slides out to the side, Copy link is chosen, the menus fold away and a Link copied toast pops.',
  build: () => {
    const R = 1.0, MX = -92, MY = -84, MW = 320, MH = 356, MV0 = R + 0.3, MV1 = 1.85, C = 2.72, X = C + 0.14;
    const TX = [-375, -125, 125, 375], SEL = 1;
    const files = [['folder', 'Brand kit'], ['image', 'Hero.png'], ['video', 'Teaser.mp4'], ['file', 'Brief.pdf']];
    const items = [['Open', 'eye'], ['Rename', 'pencil'], ['Duplicate', 'copy'], ['Share', 'send'], ['Delete', 'trash']];
    const IY = [44, 104, 164, 224, 312];
    const SX = MX + MW + 6, SY = MY + IY[3] - 38, subs = [['Copy link', 'link'], ['Email', 'mail'], ['Message', 'message']];
    // highlight hand-offs: the cursor's y leg crosses the row boundaries
    const cy = (b) => cross(MV0, MV1, MY, MY + IY[3] + 6, MY + b, 'Sine Smooth');
    const hand = [cy(74), cy(134), cy(194)];
    const hy = [], hh = [];
    hand.forEach((t, i) => {
      const nx = hand[i + 1] ?? t + 1, d = Math.min(0.3, nx - t - 0.01);
      hy.push([t, t + d, IY[i + 1], 'Power4 Out']);
      hh.push([t, t + Math.min(0.08, d / 3), 66, 'Power2 Out'], [t + Math.min(0.08, d / 3), t + d, 56, 'Power3 Out']);
    });
    const SUBIN = cross(2.05, 2.5, 28, 344, SX + 8, 'Power2 Smooth'), S = hand[2] + 0.12;
    const menuK = (t0, x0, x1) => ({ opacity: [0, [t0, t0 + 0.1, 1, 'Linear'], [X, X + 0.16, 0, 'Power2 In']], blur: [6, [t0, t0 + 0.24, 0, 'Power2 Out'], [X, X + 0.16, 4, 'Power2 In']],
      ...(x0 != null ? { x: [x0, [t0, t0 + 0.36, x1, 'Power4 Out']] } : { scale: [0.86, [t0, t0 + 0.36, 1, 'Power4 Out'], [X, X + 0.16, 0.96, 'Power2 In']] }) });
    const row = (id, [s, ic], y, t) => group({ id, y, k: t != null ? enter(t, { dy: -8, y0: y, blur: 4, dur: 0.22 }) : null, ch: [
      icon({ icon: ic, x: 34, size: 26, sw: 2.4 }),
      text({ text: s, x: 66, ax: 0, size: 26, weight: 500 }),
    ] });
    return [
      rect({ id: 'window', w: 1100, h: 700, r: 36, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Assets', x: -500, y: -290, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -500 }) }),
        text({ id: 'count', text: '4 items', x: 500, y: -290, ax: 1, size: 24, color: 'muted', k: enter(0.28) }),
        rect({ id: 'rule', y: -246, w: 1100, h: 2, fill: 'line', k: fadeIn(0.28) }),
        ...files.map(([ic, s], i) => group({ id: 'file' + i, x: TX[i], k: enter(0.3 + i * 0.05, { dy: 16 }), ch: [
          rect({ id: 'tile' + i, y: -110, w: 210, h: 180, r: 28, fill: 'soft', stroke: 'ink', sw: 0,
            k: i === SEL ? k({ sw: [[R, R + 0.12, 3, 'Power2 Out']] }, press(R, { to: 0.97 })) : null, ch: [icon({ icon: ic, size: 64, sw: 2.4 })] }),
          text({ id: 'name' + i, text: s, y: 16, size: 24, weight: 500 }),
        ] })),
        rect({ id: 'toast', y: 270, w: 270, h: 64, r: 32, fill: 'ink', k: pop(X + 0.1, { from: 0.6 }), ch: [
          icon({ icon: 'check', x: -68, size: 26, sw: 3, color: 'acc' }),
          text({ text: 'Link copied', x: 18, size: 24, weight: 600, color: 'inv' }),
        ] }),
      ] }),
      rect({ id: 'menu', x: MX, y: MY, pin: 'tl', chAt: 'pin', w: MW, h: MH, r: 22, fill: 'card', shadow: 2, k: menuK(R + 0.02), ch: [
        rect({ id: 'hl', x: 8, y: IY[0], pin: 'l', w: MW - 16, h: 56, r: 14, fill: 'soft', k: { opacity: [0, [MV0 + 0.04, MV0 + 0.16, 1, 'Power2 Out']], y: hy, h: hh } }),
        ...items.map((it, i) => row('item' + i, it, IY[i], R + 0.06 + i * 0.03)),
        icon({ id: 'subArrow', icon: 'chevronRight', x: 294, y: IY[3], size: 22, sw: 2.6, color: 'muted', k: enter(R + 0.15) }),
        rect({ id: 'divider', x: 16, y: 268, pin: 'l', w: MW - 32, h: 2, fill: 'line' }),
      ] }),
      rect({ id: 'submenu', x: SX, y: SY, pin: 'tl', chAt: 'pin', w: 260, h: 196, r: 22, fill: 'card', shadow: 2, k: menuK(S, SX - 18, SX), ch: [
        rect({ id: 'subHl', x: 8, y: 38, pin: 'l', w: 244, h: 56, r: 14, fill: 'soft', k: k({ opacity: [0, [SUBIN, SUBIN + 0.12, 1, 'Power2 Out']] }, press(C, { to: 0.96 })) }),
        ...subs.map((it, i) => row('sub' + i, it, 38 + i * 60, null)),
      ] }),
      cursorLayer([[0, 520, 380], [0.5, 520, 380], [R - 0.1, MX, MY], [MV0, MX, MY], [MV1, 28, MY + IY[3] + 6], [2.05, 28, MY + IY[3] + 6], [2.5, 344, MY + IY[3] + 6],
        [C + 0.2, 344, MY + IY[3] + 6], [3.8, 470, 390]], [R, C], [], { inAt: 0.45 }),
    ];
  },
});

// 13 ─ Tooltip glide: one tooltip follows the hover along a toolbar, resizing to each label
UIK.define({
  id: 'tooltip-glide', name: 'Gliding tooltip', cat: 'mobile', T: 3.9, cam: { zoom: 2.1, y: 46 },
  desc: 'The cursor runs along a floating toolbar: one tooltip pops on the first button, then glides to each next one and resizes its width to the new label while the labels swap. A click on Share turns it into a wider Link copied confirmation.',
  build: () => {
    const BX = [-232, -116, 0, 116, 232], TY = 90, HV = [0.9, 1.34, 1.78, 2.22, 2.66], CL = 3.08, TIPY = 15;
    const TOOLS = [['Draw', 'pencil', 62], ['Add image', 'image', 127.3], ['Insert link', 'link', 119.1], ['Duplicate', 'copy', 113.7], ['Share', 'send', 69.9]];
    const tw = (w) => Math.round(w + 44), DONE_W = Math.round(24 + 10 + 137.2 + 44);
    const glide = (f) => HV.slice(1).map((t, i) => [t, t + 0.45, f(i + 1), 'Power4 Out']);
    const keys = [[0, 380, 240], [0.5, 380, 240]];
    HV.forEach((t, i) => keys.push([t - 0.03, BX[i] + 8, TY + 14], [t + 0.16, BX[i] + 8, TY + 14]));
    keys.push([CL + 0.2, BX[4] + 8, TY + 14], [3.85, 360, 236]);
    return [
      rect({ id: 'toolbar', y: TY, w: 600, h: 108, r: 54, fill: 'card', shadow: 2, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'hoverBg', x: BX[0], w: 84, h: 84, r: 26, fill: 'soft', k: k({ opacity: [0, [HV[0], HV[0] + 0.15, 1, 'Power2 Out']], x: glide((i) => BX[i]) }, press(CL, { to: 0.9 })) }),
        ...TOOLS.map(([s, ic], i) => icon({ id: 'tool' + i, icon: ic, x: BX[i], size: 36, sw: 2.4, color: 'muted',
          k: k(enter(0.24 + i * 0.04, { s: 0.7 }), { color: [[HV[i], HV[i] + 0.15, 'ink', 'Power2 Out'], ...(i < 4 ? [[HV[i + 1], HV[i + 1] + 0.15, 'muted', 'Power2 Out']] : [])] }) })),
      ] }),
      group({ id: 'tooltip', x: BX[0], y: TIPY, k: { x: glide((i) => BX[i]), opacity: [0, [HV[0] + 0.02, HV[0] + 0.14, 1, 'Linear']], scale: [0.7, [HV[0] + 0.02, HV[0] + 0.42, 1, 'Back Out']] }, ch: [
        rect({ id: 'tipArrow', w: 18, h: 18, r: 3, rot: 45, fill: 'ink' }),
        rect({ id: 'tipBox', pin: 'b', w: tw(TOOLS[0][2]), h: 62, r: 18, fill: 'ink',
          k: { w: [...HV.slice(1).map((t, i) => [t, t + 0.42, tw(TOOLS[i + 1][2]), 'Expo Out']), [CL + 0.02, CL + 0.46, DONE_W, 'Expo Out']] } }),
        ...TOOLS.map(([s], i) => {
          const a = HV[i] + 0.06, z = i < 4 ? HV[i + 1] : CL;
          return text({ id: 'tip' + i, text: s, y: -31, size: 26, weight: 500, color: 'inv',
            k: { opacity: [0, [a, a + 0.16, 1, 'Power2 Out'], [z - 0.02, z + 0.07, 0, 'Linear']], blur: [6, [a, a + 0.2, 0, 'Power2 Out']], x: [i ? 12 : 0, [a, a + 0.34, 0, 'Power3 Out']] } });
        }),
        group({ id: 'copied', y: -31, k: enter(CL + 0.08, { dx: 12, blur: 6 }), ch: [
          icon({ icon: 'check', x: -73.6, size: 24, sw: 3, color: 'acc' }),
          text({ text: 'Link copied', x: 17, size: 26, weight: 500, color: 'inv' }),
        ] }),
      ] }),
      cursorLayer(keys, [CL], [], { inAt: 0.45 }),
    ];
  },
});

// 14 ─ App launch: a tapped home-screen tile morphs into the full-screen app while the grid recedes
UIK.define({
  id: 'app-launch', name: 'App launch', cat: 'mobile', T: 3.4, cam: PHONE_CAM,
  desc: 'Home-screen tiles pop in on a diagonal stagger. A tap on the ink player tile grows that one shape into the full-screen app (position, size and corners) while the grid behind shrinks, fades and blurs away; then the player content settles in and playback runs.',
  build: () => {
    const C = 1.15, M = C + 0.07, EZ = 'Expo Out', CX = [-165, -55, 55, 165], RY = [-150, -30, 90, 210], TR = 1, TC = 2;
    const APPS = [[['ink', 'mail'], ['card', 'calendar'], ['card', 'image'], ['dim', 'message']],
                  [['card', 'globe'], ['dim', 'clock'], ['ink', 'play'], ['card', 'settings']],
                  [['acc', 'bell'], ['card', 'chart'], ['card', 'cloud'], ['card', 'bag']],
                  [['card', 'user'], ['card', 'mic'], ['dim', 'pin'], ['ink', 'bookmark']]];
    const icCol = (f) => (f === 'ink' ? 'inv' : f === 'acc' ? '#FFFFFF' : 'ink');
    const tIn = (r, c) => 0.28 + (r + c) * 0.04;
    const a = (t) => M + t - 0.1;
    return [
      phone({ fill: 'panel', ch: [
        group({ id: 'home', k: { scale: [[M, M + 0.55, 0.9, 'Power3 Out']], opacity: [[M + 0.05, M + 0.4, 0, 'Power2 Out']], blur: [[M, M + 0.4, 8, 'Power2 Out']] }, ch: [
          text({ id: 'weekday', text: 'Thursday', x: -206, y: -366, ax: 0, size: 28, weight: 500, color: 'muted', k: enter(0.24, { dx: -14, x0: -206 }) }),
          text({ id: 'day', text: '25 September', x: -206, y: -318, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.28, { dx: -14, x0: -206 }) }),
          ...APPS.flatMap((row, r) => row.map(([f, ic], c) => (r === TR && c === TC ? null :
            rect({ id: `app${r}${c}`, x: CX[c], y: RY[r], w: 92, h: 92, r: 26, fill: f, shadow: f === 'card' ? 3 : undefined, k: pop(tIn(r, c), { from: 0.5, dur: 0.45 }),
              ch: [icon({ icon: ic, size: 40, sw: 2.4, color: icCol(f) })] })))).filter(Boolean),
        ] }),
        rect({ id: 'player', x: CX[TC], y: RY[TR], w: 92, h: 92, r: 26, fill: 'ink', clip: true,
          k: k(pop(tIn(TR, TC), { from: 0.5, dur: 0.45 }), press(C, { to: 0.9 }), {
            x: [[M, M + 0.7, 0, EZ]], y: [[M, M + 0.7, 0, EZ]], w: [[M, M + 0.7, PW + 8, EZ]], h: [[M, M + 0.7, PH + 8, EZ]], r: [[M, M + 0.5, PR + 4, 'Power3 Out']] }), ch: [
            icon({ id: 'playIc', icon: 'play', size: 40, sw: 2.4, color: 'inv', k: exit(M, { s: 1.6, dur: 0.2 }) }),
            icon({ id: 'down', icon: 'chevronDown', x: -206, y: -392, size: 32, sw: 2.6, color: 'inv', k: enter(a(0.38)) }),
            text({ id: 'nowPlaying', text: 'Now playing', y: -392, size: 22, weight: 500, color: 'inv/60', k: enter(a(0.4)) }),
            rect({ id: 'art', y: -150, w: 420, h: 420, r: 40, fill: 'inv/10', k: enter(a(0.42), { s: 0.9, dy: 20, y0: -150 }), ch: [
              circle({ id: 'disc', d: 300, fill: 'inv/10' }),
              circle({ id: 'label', d: 96, fill: 'acc' }),
            ] }),
            text({ id: 'song', text: 'Midnight Drive', x: -210, y: 130, ax: 0, size: 40, weight: 600, ls: -0.02, color: 'inv', k: enter(a(0.5), { dx: -14, x0: -210 }) }),
            text({ id: 'artist', text: 'Nova Lane', x: -210, y: 176, ax: 0, size: 26, color: 'inv/60', k: enter(a(0.55)) }),
            icon({ id: 'fav', icon: 'heart', x: 200, y: 150, size: 34, sw: 2.4, color: 'inv', k: enter(a(0.58), { s: 0.6 }) }),
            rect({ id: 'track', y: 250, w: 420, h: 8, r: 4, fill: 'inv/20', k: fadeIn(a(0.6)), ch: [
              rect({ id: 'played', x: -210, pin: 'l', w: 90, h: 8, r: 4, fill: 'inv', k: { w: [[a(0.6), 3.4, 170, 'Linear']] } }),
            ] }),
            icon({ id: 'prevIc', icon: 'chevronLeft', x: -130, y: 370, size: 44, sw: 2.6, color: 'inv', k: enter(a(0.64)) }),
            circle({ id: 'pauseBtn', y: 370, d: 112, fill: 'inv', k: enter(a(0.66), { s: 0.7 }), ch: [icon({ icon: 'pause', size: 40, sw: 2.2, color: 'ink', filled: true, fill: 'ink' })] }),
            icon({ id: 'nextIc', icon: 'chevronRight', x: 130, y: 370, size: 44, sw: 2.6, color: 'inv', k: enter(a(0.68)) }),
          ] }),
        statusBar(0.26, [M + 0.2, 'inv']),
        homeBar(0.3, [M + 0.2, 'inv/80']),
      ] }),
      cursorLayer([[0, 440, 420], [0.6, 440, 420], [C - 0.1, CX[TC] + 8, RY[TR] + 10], [C + 0.2, CX[TC] + 8, RY[TR] + 10], [C + 0.85, 390, 300]], [C], [], { inAt: 0.55 }),
    ];
  },
});

// 15 ─ Theme switch: the sun/moon switch flips the card to dark in a wave spreading from the switch
UIK.define({
  id: 'theme-switch', name: 'Theme switch wave', cat: 'mobile', T: 3.2, cam: 1.35,
  desc: 'Clicking the sun/moon switch slides and inverts its knob, then a dark disc spreads from the switch across the card; every text, chip and hairline turns its colour while the wave front crosses it, so the theme change travels outward from the switch.',
  build: () => {
    const C = 1.05, W0 = C + 0.06, W1 = W0 + 0.95, SX = 330, SY = -206, RMAX = 930, EZ = 'Power2 Smooth';
    const at = (x, y) => cross(W0, W1, 0, RMAX, Math.hypot(x - SX, y - SY), EZ);
    // an element's colour starts to turn when the front touches its box and finishes as the front clears its far corner,
    // so text straddling the edge sits at mid-grey (legible on both sides) rather than dark on dark
    const flip = (x0, y0, x1, y1, p, to) => {
      const cl = (v, a, b) => Math.min(Math.max(v, a), b), t0 = at(cl(SX, x0, x1), cl(SY, y0, y1));
      const t1 = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => at(x, y)));
      return { [p]: [[t0, Math.max(t1, t0 + 0.1), to, 'Linear']] };
    };
    const CHIPS = [['Motion', 76.5], ['Type', 52.5], ['3D', 31], ['Brand systems', 163.4]];
    let cx = -390;
    const chips = CHIPS.map(([s, w], j) => { const cw = w + 40, x = cx + cw / 2; cx += cw + 12; return { s, x, cw, j }; });
    const STATS = [['248', 'Posts', -390], ['12.4k', 'Followers', -120], ['180', 'Following', 150]];
    return [
      rect({ id: 'card', w: 900, h: 560, r: 44, fill: 'card', shadow: 1, clip: true, k: popIn(0.1, 0.7), ch: [
        circle({ id: 'wave', x: SX, y: SY, d: 0, fill: 'ink', k: { w: [[W0, W1, 2 * RMAX, EZ]], h: [[W0, W1, 2 * RMAX, EZ]] } }),
        text({ id: 'title', text: 'Studio', x: -390, y: SY, ax: 0, size: 40, weight: 600, ls: -0.02, k: k(enter(0.22, { dx: -14, x0: -390 }), flip(-390, SY - 20, -268, SY + 20, 'color', 'inv')) }),
        rect({ id: 'switch', x: SX, y: SY, w: 156, h: 80, r: 40, fill: 'soft', k: k(fadeIn(0.3), press(C, { to: 0.94 }), { fill: [[W0, W0 + 0.2, 'inv/16', 'Power2 Out']] }), ch: [
          rect({ id: 'knob', x: -38, w: 64, h: 64, r: 32, fill: 'ink',
            k: { x: [[C, C + 0.45, 38, 'Power4 Out']], w: [[C, C + 0.13, 88, 'Power2 Out'], [C + 0.13, C + 0.5, 64, 'Power3 Out']], fill: [[C + 0.05, C + 0.3, 'inv', 'Power2 Out']] }, ch: [
              icon({ id: 'sun', icon: 'sun', size: 34, sw: 2.4, color: 'inv', k: k(exit(C + 0.02, { s: 0.6 }), { rot: [[C, C + 0.3, 90, 'Power2 Out']] }) }),
              icon({ id: 'moon', icon: 'moon', size: 30, sw: 2.4, color: 'ink', k: k(enter(C + 0.12, { s: 0.6 }), { rot: [-60, [C + 0.12, C + 0.55, 0, 'Power3 Out']] }) }),
            ] }),
        ] }),
        circle({ id: 'avatar', x: -350, y: -86, d: 96, fill: 'ink', k: k(enter(0.3, { s: 0.8 }), flip(-398, -134, -302, -38, 'fill', 'inv')),
          ch: [text({ text: 'AR', size: 32, weight: 600, color: 'inv', k: flip(-380, -104, -320, -68, 'color', 'ink') })] }),
        text({ id: 'name', text: 'Ana Reyes', x: -282, y: -104, ax: 0, size: 34, weight: 600, ls: -0.02, k: k(enter(0.34, { dx: -14, x0: -282 }), flip(-282, -122, -115, -86, 'color', 'inv')) }),
        text({ id: 'role', text: 'Motion designer · Lisbon', x: -282, y: -64, ax: 0, size: 26, color: 'muted', k: enter(0.38) }),
        rect({ id: 'follow', x: 318, y: -86, w: 180, h: 72, r: 36, fill: 'acc', k: enter(0.42, { s: 0.8 }), ch: [text({ text: 'Follow', size: 26, weight: 600, color: '#FFFFFF' })] }),
        ...chips.map((c) => rect({ id: 'chip' + c.j, x: c.x, y: 30, w: c.cw, h: 56, r: 28, fill: 'soft', k: k(enter(0.46 + c.j * 0.05, { dy: 12, y0: 30 }), flip(c.x - c.cw / 2, 2, c.x + c.cw / 2, 58, 'fill', 'inv/12')),
          ch: [text({ text: c.s, size: 24, weight: 500, k: flip(c.x - c.cw / 2 + 20, 18, c.x + c.cw / 2 - 20, 42, 'color', 'inv') })] })),
        // the hairline flips in four pieces so it never shows light on the dark side of the wave front
        ...[0, 1, 2, 3].map((i) => rect({ id: 'rule' + i, x: -307.5 + i * 205, y: 110, w: 205, h: 2, fill: 'line', k: k(fadeIn(0.5), flip(-410 + i * 205, 110, -205 + i * 205, 112, 'fill', 'inv/14')) })),
        ...STATS.map(([n, l, x], j) => group({ id: 'stat' + j, x, k: enter(0.52 + j * 0.05, { dy: 12 }), ch: [
          text({ id: 'statN' + j, text: n, y: 172, ax: 0, size: 40, weight: 600, ls: -0.02, k: flip(x, 152, x + [72, 106, 72][j], 192, 'color', 'inv') }),
          text({ id: 'statL' + j, text: l, y: 214, ax: 0, size: 24, color: 'muted' }),
        ] })),
      ] }),
      cursorLayer([[0, 560, 320], [0.5, 560, 320], [C - 0.1, SX - 30, SY + 8], [C + 0.2, SX - 30, SY + 8], [C + 1.0, 560, 330]], [C], [], { inAt: 0.45 }),
    ];
  },
});
})();
