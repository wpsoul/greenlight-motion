/* UI Motion Kit — work elements. */
(function () {
const { rect, circle, text, path, icon, group, photo, k, enter, exit, pop, popIn, fadeIn, press, ring, spinner, cross, cursorLayer } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
const f1 = (n) => +n.toFixed(1);
// a check mark `w` wide, centred on the layer point (same proportions as success-check)
const tickD = (w) => `M${f1(-0.5 * w)} ${f1(0.03 * w)} L${f1(-0.17 * w)} ${f1(0.36 * w)} L${f1(0.5 * w)} ${f1(-0.36 * w)}`;
// visible from t0 until t1 (focus rings, hover fills); t1 null = stays on
const onOff = (t0, t1, to = 1) => ({ opacity: [0, [t0, t0 + 0.18, to, 'Power2 Out']].concat(t1 != null ? [[t1, t1 + 0.2, 0, 'Power2 Out']] : []) });
// a shape that reacts in place: a quick scale-up that settles
const bump = (t, to = 1.06) => ({ scale: [[t, t + 0.1, to, 'Power2 Out'], [t + 0.1, t + 0.45, 1, 'Power3 Out']] });
// slot roll: a clipped window whose column of values rolls UP one slot at each time in `ts`
const roll = (o) => rect({ id: o.id, x: o.x || 0, y: o.y || 0, w: o.w, h: o.h, clip: true, ch: [
  group({ id: o.id + 'Col', k: { y: o.ts.map((t, i) => [t, t + (o.dur || 0.45), -o.h * (i + 1), o.e || 'Power3 Out']) },
    ch: o.vals.map((s, i) => text({ text: s, x: o.tx || 0, y: i * o.h, ax: o.ax ?? 0.5, size: o.size, weight: o.weight || 600, color: o.color || 'ink', ls: o.ls, tnum: false })) }),
] });
// avatar: a circle with initials (text colour follows the fill)
const avatar = (o) => circle({ id: o.id, x: o.x || 0, y: o.y || 0, d: o.d, fill: o.fill || 'soft', stroke: o.stroke, sw: o.sw, k: o.k,
  ch: [text({ id: o.id && o.id + 'Ini', text: o.ini, size: o.size || Math.round(o.d * 0.36), weight: 600, ls: -0.01,
    color: o.color || ({ ink: 'inv', acc: 'white' }[o.fill] || 'ink') })].concat(o.ch || []) });

// 1 ─ Login: email and password type in, Sign in spins, and the button becomes the avatar of a compact welcome card
UIK.define({
  id: 'login-form', name: 'Login → welcome', cat: 'work', T: 5.1,
  cam: { zoom: 1.12, k: { zoom: [[3.8, 4.5, 1.7, 'Power2 Smooth']] } },
  desc: 'The email types in, the password types in as bullets, Sign in squeezes into a spinning circle; then the form blurs away, the card collapses into a compact strip and the circle glides left to become the avatar of a "Welcome back, Ana" card with an accent verified badge.',
  build: () => {
    const F1 = 1.0, T0 = 1.15, T1 = 1.75, F2 = 2.05, P0 = 2.2, P1 = 2.6, S = 2.95, M = 3.8, EZ = 'Expo Out', FX = -318, AVX = -270;
    const field = (id, y, t, on, ch) => group({ id, y, k: k(enter(t, { dy: 14, y0: y }), press(on[0], { to: 0.985 })), ch: [
      rect({ id: id + 'Box', w: 700, h: 96, r: 24, fill: 'card', stroke: 'line', sw: 2 }),
      rect({ id: id + 'Focus', w: 700, h: 96, r: 24, stroke: 'ink', sw: 2.5, k: onOff(on[0], on[1]) }),
      ...ch,
    ] });
    return [
      rect({ id: 'card', w: 820, h: 700, r: 48, fill: 'card', shadow: 1,
        k: k(popIn(0.1, { from: 0.7 }), { w: [[M, M + 0.6, 760, EZ]], h: [[M, M + 0.6, 208, EZ]] }), ch: [
          group({ id: 'form', k: exit(M, { dur: 0.16 }), ch: [
            text({ id: 'title', text: 'Sign in', x: -350, y: -270, ax: 0, size: 52, weight: 600, ls: -0.03, k: enter(0.22, { dx: -16, x0: -350 }) }),
            text({ id: 'sub', text: 'Use your Studio account', x: -350, y: -222, ax: 0, size: 28, color: 'muted', k: enter(0.3) }),
            text({ id: 'emailLbl', text: 'Email', x: -350, y: -170, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.34) }),
            field('email', -98, 0.36, [F1, F2], [
              text({ id: 'emailPh', text: 'you@company.com', x: FX, ax: 0, size: 32, color: 'muted', k: exit(T0 - 0.02, { dur: 0.08, blur: 0 }) }),
              text({ id: 'emailTyped', text: 'ana@studio.io', x: FX, ax: 0, size: 32, weight: 500, caret: true, caretColor: 'acc', caretFrom: F1 + 0.1, caretUntil: F2,
                k: { reveal: [0, [T0, T1, 1, 'Linear']] } }),
            ]),
            text({ id: 'pwLbl', text: 'Password', x: -350, y: -22, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.42) }),
            text({ id: 'forgot', text: 'Forgot?', x: 350, y: -22, ax: 1, size: 24, weight: 500, color: 'muted', k: enter(0.46) }),
            field('password', 50, 0.44, [F2, S], [
              text({ id: 'pwPh', text: 'Enter your password', x: FX, ax: 0, size: 32, color: 'muted', k: exit(P0 - 0.02, { dur: 0.08, blur: 0 }) }),
              text({ id: 'pwTyped', text: '••••••••••', x: FX, ax: 0, size: 32, weight: 500, ls: 0.08, caret: true, caretColor: 'acc', caretFrom: F2 + 0.1, caretUntil: S,
                k: { reveal: [0, [P0, P1, 1, 'Linear']] } }),
              icon({ id: 'eye', icon: 'eye', x: 306, size: 30, sw: 2.4, color: 'muted' }),
            ]),
            text({ id: 'footer', text: 'New to Studio? Create an account', y: 292, size: 26, color: 'muted', k: enter(0.56) }),
          ] }),
          // the button: a pill → a spinning circle → glides left and becomes the avatar
          rect({ id: 'btn', y: 186, w: 700, h: 100, r: 60, fill: 'ink',
            k: k(enter(0.5, { dy: 14, y0: 186, blur: 0 }), press(S, { to: 0.97 }), {
              w: [[S + 0.06, S + 0.6, 100, EZ], [M, M + 0.6, 120, EZ]], h: [[M, M + 0.6, 120, EZ]],
              x: [[M, M + 0.6, AVX, 'Power4 Out']], y: [[M, M + 0.6, 0, 'Power4 Out']] }), ch: [
              text({ id: 'btnLbl', text: 'Sign in', size: 34, weight: 600, color: 'inv', k: exit(S + 0.02) }),
              path({ id: 'spin', d: ring(28), stroke: 'inv', sw: 6, trimmed: true, k: {
                opacity: [0, [S + 0.3, S + 0.45, 1, 'Power2 Out'], [M + 0.02, M + 0.18, 0, 'Power2 In']],
                trimE: [8, [S + 0.3, S + 0.9, 70, 'Power3 Out'], [M - 0.35, M - 0.02, 100, 'Power2 Out']],
                rot: [[S + 0.3, M, 540, 'Linear']] } }),
              text({ id: 'initials', text: 'AR', size: 42, weight: 600, ls: -0.01, color: 'inv', k: enter(M + 0.2) }),
              group({ id: 'verified', x: 44, y: 44, k: pop(M + 0.6, { from: 0.3 }), ch: [
                circle({ id: 'verifiedRim', d: 46, fill: 'card' }),
                circle({ id: 'verifiedDisc', d: 36, fill: 'acc', ch: [icon({ icon: 'check', size: 20, sw: 3.4, color: 'white' })] }),
              ] }),
            ] }),
          group({ id: 'welcome', ch: [
            text({ id: 'hello', text: 'Welcome back, Ana', x: -180, y: -22, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(M + 0.14, { dx: -16, x0: -180 }) }),
            text({ id: 'helloSub', text: 'Signed in to Studio · 3 projects', x: -180, y: 26, ax: 0, size: 26, color: 'muted', k: enter(M + 0.22) }),
            icon({ id: 'chev', icon: 'chevronRight', x: 322, size: 32, sw: 2.6, color: 'muted', k: enter(M + 0.3) }),
          ] }),
        ] }),
      cursorLayer([[0, 520, 330], [0.5, 520, 330], [F1 - 0.1, 60, -92], [F1 + 0.2, 60, -92], [F2 - 0.1, 80, 56], [F2 + 0.2, 80, 56],
        [S - 0.1, 40, 192], [S + 0.15, 40, 192], [S + 0.75, 330, 256]], [F1, F2, S], [], { inAt: 0.45 }),
    ];
  },
});

// 2 ─ Passkey: press and hold the sensor, fingerprint ridges draw on inside-out, a check lands, the lock opens
UIK.define({
  id: 'passkey-auth', name: 'Passkey sign-in', cat: 'work', T: 4.2, cam: 1.2,
  desc: 'The cursor presses and holds the sensor: soft rings pulse out while the fingerprint ridges draw on over their faint copies from the centre outward. On release the print blurs away into an accent disc with a check, the shackle of the lock lifts and swings open, and the subtitle swaps to the signed-in name.',
  build: () => {
    const H0 = 1.05, D = 2.4, U = D + 0.12, SY = 90, S = 7.5;
    // Lucide fingerprint ridges (24 grid) and the ring each belongs to: 0 centre, 1 middle, 2 outer
    const RIDGES = [
      ['M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4', 0], ['M14 13.12c0 2.38 0 6.38-1 8.88', 0],
      ['M9 6.8a6 6 0 0 1 9 5.2v2', 1], ['M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2', 1], ['M17.29 21.02c.12-.6.43-2.3.5-3.02', 1],
      ['M2 12a10 10 0 0 1 18-6', 2], ['M21.8 16c.2-2 .131-5.354 0-6', 2], ['M8.65 22c.21-.66.45-1.32.57-2', 2], ['M2 16h.01', 2],
    ];
    const DRAW = [[H0 + 0.08, H0 + 0.5], [H0 + 0.4, H0 + 0.88], [H0 + 0.76, D - 0.1]];
    const print = (id, color, live) => group({ id, x: -12 * S, y: -12 * S, scale: S, ch: RIDGES.map(([d, g], i) => path({ id: id + i, d, stroke: color, sw: 7 / S,
      trimmed: live, k: live ? { trimE: [0, [DRAW[g][0] + (i % 3) * 0.04, DRAW[g][1], 100, 'Power2 Out']] } : undefined })) });
    const pulse = (t) => [[t, t + 0.75, 1.2, 'Power2 Out'], [t + 0.75, 1]];
    return [
      rect({ id: 'card', w: 760, h: 700, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'lockTile', y: -250, w: 112, h: 112, r: 32, fill: 'soft', k: k(pop(0.22, { from: 0.6 }), bump(U, 1.08)), ch: [
          path({ id: 'shackle', x: -13, y: -8, d: 'M0 4 V-12 A13 13 0 0 1 26 -12 V4', stroke: 'ink', sw: 6,
            k: { y: [[U, U + 0.3, -17, 'Power4 Out']], rot: [[U + 0.12, U + 0.5, -20, 'Power3 Out']] } }),
          rect({ id: 'lockBody', y: 10, w: 46, h: 36, r: 9, fill: 'ink' }),
          circle({ id: 'keyhole', y: 9, d: 9, fill: 'soft' }),
        ] }),
        text({ id: 'title', text: 'Sign in with passkey', y: -146, size: 44, weight: 600, ls: -0.02, k: enter(0.28) }),
        text({ id: 'hint', text: 'Touch the sensor to continue', y: -98, size: 28, color: 'muted', k: k(enter(0.34), exit(H0)) }),
        text({ id: 'scanning', text: 'Scanning…', y: -98, size: 28, color: 'muted', k: k(enter(H0), exit(D)) }),
        text({ id: 'signedIn', text: 'Signed in as Ana Reyes', y: -98, size: 28, weight: 500, k: enter(D + 0.06, { dy: 10, y0: -98 }) }),
        group({ id: 'sensor', y: SY, ch: [
          circle({ id: 'halo', d: 300, stroke: 'ink/15', sw: 3, k: { opacity: [0, [H0, 1], [H0, H0 + 0.75, 0, 'Power2 Out'], [H0 + 0.75, 1], [H0 + 0.75, H0 + 1.5, 0, 'Power2 Out']],
            scale: [1, ...pulse(H0), ...pulse(H0 + 0.75)] } }),
          circle({ id: 'pad', d: 300, fill: 'soft', k: k(enter(0.38, { blur: 0, s: 0.8 }), { scale: [[H0 - 0.04, H0 + 0.16, 0.96, 'Power2 Out'], [D, D + 0.4, 1, 'Power3 Out']] }) }),
          group({ id: 'print', k: k(exit(D, { dur: 0.18, s: 0.8 })), ch: [
            group({ id: 'printBase', k: fadeIn(0.46), ch: [print('base', 'dim', false)] }),
            print('ridge', 'ink', true),
          ] }),
          circle({ id: 'okDisc', d: 156, fill: 'acc', k: pop(D + 0.04, { from: 0.4, dur: 0.46 }), ch: [
            path({ id: 'okTick', d: tickD(68), stroke: 'white', sw: 12, trimmed: true, k: { trimE: [0, [D + 0.18, D + 0.52, 100, 'Power3 Out']] } }),
          ] }),
        ] }),
        text({ id: 'alt', text: 'Use a password instead', y: 294, size: 26, weight: 500, color: 'muted', k: enter(0.5) }),
      ] }),
      cursorLayer([[0, 460, 340], [0.5, 460, 340], [H0 - 0.1, 24, SY + 106], [D + 0.05, 24, SY + 106], [D + 0.7, 300, 300]], [], [[H0, D]], { inAt: 0.45 }),
    ];
  },
});

// 3 ─ Approve on phone: the laptop waits with a spinner, a phone slides in with the request, Approve signs the laptop in
UIK.define({
  id: 'two-factor-approve', name: 'Approve on phone', cat: 'work', T: 4.1, cam: 1.05,
  desc: 'A laptop window waits with a spinner. It slides aside as a phone slides in with an "Approve sign-in?" sheet; the cursor taps Approve, the sheet turns into an accent check, and a beat later the laptop spinner becomes an ink check with "Signed in".',
  build: () => {
    const LX = -250, PX = 490, PIN = 0.85, A = 2.1, L = A + 0.5, SH = 110;
    return [
      rect({ id: 'laptop', w: 860, h: 560, r: 36, fill: 'card', shadow: 1, k: k(popIn(0.1, { from: 0.7 }), { x: [[PIN, PIN + 0.6, LX, 'Power4 Out']] }), ch: [
        ...[0, 1, 2].map((i) => circle({ id: 'winDot' + i, x: -400 + i * 26, y: -242, d: 14, fill: 'dim' })),
        rect({ id: 'url', y: -242, w: 360, h: 42, r: 21, fill: 'soft', k: fadeIn(0.24), ch: [
          icon({ icon: 'lock', x: -140, size: 18, sw: 2.4, color: 'muted' }),
          text({ text: 'studio.app/sign-in', x: -120, ax: 0, size: 20, weight: 500, color: 'muted' }),
        ] }),
        rect({ id: 'winRule', y: -212, w: 860, h: 2, fill: 'line' }),
        group({ id: 'wait', y: -40, k: k(enter(0.3), exit(L, { s: 0.6 })), ch: [
          path({ id: 'waitTrack', d: ring(40), stroke: 'line', sw: 7 }),
          spinner({ id: 'waitArc', R: 40, sw: 7, t0: 0.3, t1: L + 0.1 }),
        ] }),
        circle({ id: 'okDisc', y: -40, d: 96, fill: 'ink', k: pop(L + 0.04, { from: 0.4 }), ch: [
          path({ id: 'okTick', d: tickD(42), stroke: 'inv', sw: 7, trimmed: true, k: { trimE: [0, [L + 0.16, L + 0.46, 100, 'Power3 Out']] } }),
        ] }),
        text({ id: 'waitTitle', text: 'Waiting for approval…', y: 66, size: 40, weight: 600, ls: -0.02, k: k(enter(0.36), exit(L)) }),
        text({ id: 'waitSub', text: 'Approve the request on your phone', y: 114, size: 28, color: 'muted', k: k(enter(0.42), exit(L + 0.04)) }),
        text({ id: 'inTitle', text: 'Signed in', y: 66, size: 40, weight: 600, ls: -0.02, k: enter(L + 0.06, { dy: 12, y0: 66 }) }),
        text({ id: 'inSub', text: 'Taking you to your dashboard', y: 114, size: 28, color: 'muted', k: enter(L + 0.12) }),
        group({ id: 'device', y: 206, k: fadeIn(0.5), ch: [
          icon({ icon: 'phone', x: -122, size: 24, sw: 2.2, color: 'muted' }),
          text({ text: 'Sent to Ana’s iPhone', x: -98, ax: 0, size: 24, color: 'muted' }),
        ] }),
      ] }),
      group({ id: 'phone', x: PX, k: { x: [PX + 90, [PIN, PIN + 0.6, PX, 'Power4 Out']], opacity: [0, [PIN, PIN + 0.14, 1, 'Linear']] }, ch: [
        rect({ id: 'screen', w: 400, h: 800, r: 64, fill: 'panel', shadow: 2, clip: true, ch: [
          text({ id: 'clock', text: '9:41', x: -128, y: -360, size: 22, weight: 600 }),
          rect({ id: 'island', y: -360, w: 104, h: 30, r: 15, fill: 'ink' }),
          text({ id: 'lockTime', text: '9:41', y: -250, size: 88, weight: 600, ls: -0.03, tnum: false, k: enter(PIN + 0.12) }),
          text({ id: 'lockDate', text: 'Tuesday, October 14', y: -184, size: 24, color: 'muted', k: enter(PIN + 0.16) }),
          rect({ id: 'sheet', y: SH, w: 356, h: 420, r: 40, fill: 'card', shadow: 1, k: enter(PIN + 0.3, { dy: 40, y0: SH, blur: 0 }), ch: [
            group({ id: 'request', k: exit(A + 0.06, { dur: 0.14 }), ch: [
              rect({ id: 'reqTile', y: -136, w: 80, h: 80, r: 24, fill: 'soft', ch: [icon({ icon: 'shield', size: 40, sw: 2.4 })] }),
              text({ id: 'reqTitle', text: 'Approve sign-in?', y: -56, size: 32, weight: 600, ls: -0.02 }),
              text({ id: 'reqWhere', text: 'MacBook · Lisbon, PT', y: -16, size: 22, color: 'muted' }),
              text({ id: 'reqWhen', text: 'Chrome · just now', y: 14, size: 22, color: 'muted' }),
              rect({ id: 'deny', x: -86, y: 130, w: 156, h: 76, r: 38, fill: 'soft', ch: [text({ text: 'Deny', size: 26, weight: 600 })] }),
              rect({ id: 'approve', x: 86, y: 130, w: 156, h: 76, r: 38, fill: 'ink', k: press(A), ch: [text({ text: 'Approve', size: 26, weight: 600, color: 'inv' })] }),
            ] }),
            group({ id: 'approved', k: enter(A + 0.1, { d: 0 }), ch: [
              circle({ id: 'appDisc', y: -40, d: 128, fill: 'acc', k: pop(A + 0.12, { from: 0.4, dur: 0.46 }), ch: [
                path({ id: 'appTick', d: tickD(56), stroke: 'white', sw: 10, trimmed: true, k: { trimE: [0, [A + 0.26, A + 0.58, 100, 'Power3 Out']] } }),
              ] }),
              text({ id: 'appTitle', text: 'Approved', y: 86, size: 34, weight: 600, ls: -0.02 }),
              text({ id: 'appSub', text: 'You can put your phone away', y: 128, size: 22, color: 'muted' }),
            ] }),
          ] }),
        ] }),
        rect({ id: 'bezel', w: 400, h: 800, r: 64, stroke: 'ink', sw: 10 }),
      ] }),
      cursorLayer([[0, 820, 450], [1.45, 820, 450], [A - 0.1, 590, SH + 142], [A + 0.25, 590, SH + 142], [A + 0.9, 760, 400]], [A], [], { inAt: 1.4 }),
    ];
  },
});

// 4 ─ Invite: emails type into the field and wrap into chips (the field grows a line), Send flies them into the team row
UIK.define({
  id: 'invite-team', name: 'Invite teammates', cat: 'work', T: 5.4,
  cam: { zoom: 1.2, k: { y: [[2.55, 3.05, 36, 'Power2 Smooth'], [4.46, 4.96, 0, 'Power2 Smooth']] } },
  desc: 'Three addresses type into the invite field; after each one the typed text is wrapped by a chip. The third no longer fits, so the field grows a line and everything below slides down. Send is clicked: the chips shrink and fly into the team row as avatars, the empty field folds back to one line and "3 invites sent" lands with an accent check.',
  build: () => {
    const F = 0.9, W = 2.55, S = 3.65, GROW = 72, FT = -150, R1 = -102, R2 = R1 + GROW, IL = -404, AVY = 196;
    const E = [
      { s: 'leo.park@studio.io', tw: 242.9, ini: 'LP', t0: 1.05, t1: 1.6, c: 1.7, row: R1, cf: F + 0.15 },
      { s: 'maya.chen@studio.io', tw: 277.6, ini: 'MC', t0: 1.8, t1: 2.35, c: 2.45, row: R1, cf: 1.7 },
      { s: 'sam@studio.io', tw: 192.4, ini: 'SM', t0: 2.75, t1: 3.15, c: 3.25, row: R2, cf: W + 0.2 },
    ];
    E[0].x = IL; E[1].x = IL + E[0].tw + 74 + 10; E[2].x = IL;
    const AVX = [-288, -236, -184], FL = E.map((_, i) => [S + 0.12 + i * 0.08, S + 0.66 + i * 0.08]);
    const CB = FL[2][1] + 0.06;   // the emptied field folds back to one line
    const fold = (h) => ({ h: [[W, W + 0.45, h + GROW, 'Power3 Out'], [CB, CB + 0.45, h, 'Power3 Out']] });
    // the typed text is swapped for an identical label inside a chip, whose pill widens around it.
    // The chip group sits on the chip's centre so it shrinks about it while flying.
    const chip = (e, i) => {
      const w = e.tw + 74, L = -w / 2, [a, b] = FL[i];
      return group({ id: 'chip' + i, x: e.x + w / 2, y: e.row, k: k(bump(e.c, 1.04), {
          x: [[a, b, AVX[i], 'Power2 Smooth']], y: [[a, b, AVY + GROW, 'Power2 Smooth']],
          scale: [[a, b, 0.2, 'Power2 Smooth']], opacity: [[b - 0.12, b, 0, 'Linear']] }), ch: [
          rect({ id: 'chipBg' + i, x: L, pin: 'l', w: e.tw + 44, h: 60, r: 30, fill: 'soft',
            k: { w: [[e.c, e.c + 0.4, w, 'Power4 Out']], opacity: [0, [e.c, e.c + 0.12, 1, 'Linear']] } }),
          text({ id: 'chipTxt' + i, text: e.s, x: L + 22, ax: 0, size: 28, weight: 500, k: { opacity: [0, [e.c, 1]] } }),
          icon({ id: 'chipX' + i, icon: 'x', x: L + e.tw + 46, size: 20, sw: 2.6, color: 'muted', k: pop(e.c + 0.1, { from: 0.4 }) }),
        ] });
    };
    return [
      group({ id: 'invite', k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'card', y: -300, pin: 't', w: 960, h: 600, r: 44, fill: 'card', shadow: 1, k: fold(600) }),
        text({ id: 'title', text: 'Invite teammates', x: -420, y: -236, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -420 }) }),
        text({ id: 'sub', text: 'Add people to the Studio workspace', x: -420, y: -192, ax: 0, size: 26, color: 'muted', k: enter(0.3) }),
        rect({ id: 'field', y: FT, pin: 't', w: 840, h: 96, r: 24, fill: 'card', stroke: 'line', sw: 2, k: k(fadeIn(0.38), fold(96)) }),
        text({ id: 'placeholder', text: 'Add emails, separated by commas', x: IL + 22, y: R1, ax: 0, size: 28, color: 'muted',
          k: k(enter(0.46), exit(E[0].t0 - 0.02, { dur: 0.08, blur: 0 }), enter(CB + 0.3)) }),
        ...E.map((e, i) => text({ id: 'typed' + i, text: e.s, x: e.x + 22, y: e.row, ax: 0, size: 28, weight: 500,
          caret: true, caretColor: 'acc', caretFrom: e.cf, caretUntil: e.c, k: { reveal: [0, [e.t0, e.t1, 1, 'Linear']], opacity: [[e.c, 0]] } })),
        rect({ id: 'fieldFocus', y: FT, pin: 't', w: 840, h: 96, r: 24, stroke: 'ink', sw: 2.5, k: k(onOff(F, S - 0.1), fold(96)) }),
        group({ id: 'below', k: { y: [[W, W + 0.45, GROW, 'Power3 Out'], [CB, CB + 0.45, 0, 'Power3 Out']] }, ch: [
          text({ id: 'asLbl', text: 'Invite as', x: -420, y: 30, ax: 0, size: 26, color: 'muted', k: enter(0.5) }),
          rect({ id: 'role', x: -226, y: 30, w: 150, h: 64, r: 32, fill: 'soft', k: enter(0.54), ch: [
            text({ text: 'Editor', x: -14, size: 26, weight: 500 }),
            icon({ icon: 'chevronDown', x: 46, size: 22, sw: 2.6, color: 'muted' }),
          ] }),
          rect({ id: 'send', x: 300, y: 30, w: 240, h: 84, r: 42, fill: 'ink', k: k(enter(0.58, { blur: 0 }), press(S)), ch: [
            icon({ icon: 'send', x: -78, size: 26, sw: 2.4, color: 'inv' }),
            text({ text: 'Send invites', x: -54, ax: 0, size: 28, weight: 600, color: 'inv' }),
          ] }),
          rect({ id: 'rule', y: 104, w: 840, h: 2, fill: 'line', k: fadeIn(0.6) }),
          avatar({ id: 'memA', x: -392, y: AVY, d: 64, fill: 'ink', ini: 'AR', stroke: 'card', sw: 5, k: enter(0.64, { blur: 0, s: 0.7 }) }),
          avatar({ id: 'memB', x: -340, y: AVY, d: 64, fill: 'dim', ini: 'RK', stroke: 'card', sw: 5, k: enter(0.7, { blur: 0, s: 0.7 }) }),
          text({ id: 'teamNote', text: 'Ana and Rui · 2 members', x: -290, y: AVY, ax: 0, size: 26, color: 'muted', k: k(enter(0.74), exit(S + 0.2)) }),
          ...E.map((e, i) => avatar({ id: 'newAv' + i, x: AVX[i], y: AVY, d: 64, fill: 'soft', ini: e.ini, stroke: 'card', sw: 5, k: pop(FL[i][1] - 0.08, { from: 0.4 }) })),
          group({ id: 'sent', y: AVY, k: enter(FL[2][1] - 0.02, { dx: -14, x0: 0 }), ch: [
            circle({ id: 'sentDisc', x: -114, d: 36, fill: 'acc', k: pop(FL[2][1] + 0.02, { from: 0.4 }), ch: [icon({ icon: 'check', size: 20, sw: 3.4, color: 'white' })] }),
            text({ id: 'sentLbl', text: '3 invites sent', x: -86, ax: 0, size: 28, weight: 600 }),
          ] }),
        ] }),
        ...E.map(chip),
      ] }),
      cursorLayer([[0, 560, 360], [0.45, 560, 360], [F - 0.1, 100, R1 + 12], [F + 0.2, 100, R1 + 12], [F + 0.75, 560, 250], [S - 0.55, 560, 250],
        [S - 0.1, 318, 30 + GROW + 10], [S + 0.15, 318, 30 + GROW + 10], [S + 0.8, 560, 300]], [F, S], [], { inAt: 0.4 }),
    ];
  },
});

// 5 ─ Role matrix: a role pill is promoted Viewer → Editor and the new permissions tick on down its column
UIK.define({
  id: 'role-matrix', name: 'Role permissions', cat: 'work', T: 3.3, cam: 1.2,
  desc: 'A permissions table of three people × five actions. The cursor clicks Leo’s role pill: it presses, darkens and rolls from Viewer to Editor while a soft band settles behind his column, and the three newly granted boxes tick on in accent one after another down the column. A saved note fades in.',
  build: () => {
    const C = 1.35, X = [-40, 200, 440], RY = [-2, 62, 126, 190, 254], PY = -86, HY = -142;
    const ROWS = ['View files', 'Comment', 'Edit content', 'Share links', 'Delete project'];
    const P = [
      { n: 'Ana', nw: 52, ini: 'AR', fill: 'ink', role: 'Admin', rw: 72.3, on: [1, 1, 1, 1, 1] },
      { n: 'Leo', nw: 48.7, ini: 'LP', fill: 'dim', role: 'Viewer', rw: 77.3, on: [1, 2, 2, 2, 0] },
      { n: 'Maya', nw: 71.8, ini: 'MC', fill: 'soft', role: 'Commenter', rw: 131.9, on: [1, 1, 0, 0, 0] },
    ];
    const ADD = [null, C + 0.3, C + 0.44, C + 0.58, null];
    // a checkbox: 1 = already on (ink), 2 = granted now (accent pop + tick)
    const box = (id, x, st, t) => group({ id, x, ch: [
      rect({ id: id + 'Line', w: 44, h: 44, r: 12, fill: 'card', stroke: 'dim', sw: 3 }),
      ...(st === 1 ? [rect({ id: id + 'On', w: 44, h: 44, r: 12, fill: 'ink', ch: [path({ d: tickD(20), stroke: 'inv', sw: 4.5 })] })] : []),
      ...(st === 2 ? [rect({ id: id + 'New', w: 44, h: 44, r: 12, fill: 'acc', k: pop(t, { from: 0.5, dur: 0.36 }), ch: [
        path({ id: id + 'Tick', d: tickD(20), stroke: 'white', sw: 4.5, trimmed: true, k: { trimE: [0, [t + 0.08, t + 0.34, 100, 'Power3 Out']] } })] })] : []),
    ] });
    const head = (p, i) => {
      const tot = 64 + p.nw, L = -tot / 2, pw = p.rw + 58, promote = i === 1;
      return group({ id: 'head' + i, x: X[i], k: enter(0.3 + i * 0.06, { dy: 12 }), ch: [
        avatar({ id: 'av' + i, x: L + 26, y: HY, d: 52, fill: p.fill, ini: p.ini }),
        text({ id: 'name' + i, text: p.n, x: L + 64, y: HY, ax: 0, size: 28, weight: 600 }),
        rect({ id: 'pill' + i, y: PY, w: pw, h: 50, r: 25, fill: 'soft', k: promote ? k(press(C, { to: 0.94 }), { fill: [[C + 0.02, C + 0.26, 'ink', 'Power2 Out']] }) : undefined, ch: [
          promote
            ? rect({ id: 'roleRoll', x: -pw / 2 + 18 + 42, w: 84, h: 40, clip: true, ch: [group({ id: 'roleCol', k: { y: [[C + 0.04, C + 0.44, -40, 'Power3 Out']] }, ch: [
              text({ text: 'Viewer', x: -42, ax: 0, size: 24, weight: 500 }),
              text({ text: 'Editor', x: -42, y: 40, ax: 0, size: 24, weight: 500, color: 'inv' }),
            ] })] })
            : text({ text: p.role, x: -pw / 2 + 18, ax: 0, size: 24, weight: 500 }),
          icon({ id: 'roleChev' + i, icon: 'chevronDown', x: pw / 2 - 23, size: 18, sw: 2.8, color: 'muted', k: promote ? { color: [[C + 0.02, C + 0.26, 'inv', 'Power2 Out']] } : undefined }),
        ] }),
      ] });
    };
    return [
      rect({ id: 'card', w: 1120, h: 660, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'title', text: 'Permissions', x: -500, y: -262, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -500 }) }),
        text({ id: 'sub', text: 'Brand refresh · 3 people', x: -500, y: -220, ax: 0, size: 26, color: 'muted', k: enter(0.28) }),
        group({ id: 'saved', x: 500, y: -262, k: enter(C + 0.95), ch: [
          icon({ icon: 'check', x: -210, size: 24, sw: 2.8, color: 'muted' }),
          text({ text: 'All changes saved', ax: 1, size: 24, color: 'muted' }),
        ] }),
        rect({ id: 'band', x: X[1], y: 52, w: 204, h: 470, r: 28, fill: 'panel', k: onOff(C - 0.2, C + 1.2) }),
        ...P.map(head),
        rect({ id: 'headRule', y: -46, w: 1040, h: 2, fill: 'line', k: fadeIn(0.4) }),
        ...ROWS.map((s, r) => group({ id: 'row' + r, y: RY[r], k: enter(0.44 + r * 0.06, { dy: 12, y0: RY[r] }), ch: [
          ...(r < 4 ? [rect({ id: 'rule' + r, y: 32, w: 1040, h: 2, fill: 'line' })] : []),
          text({ id: 'action' + r, text: s, x: -500, ax: 0, size: 30, weight: 500 }),
          ...P.map((p, i) => box(`box${r}_${i}`, X[i], p.on[r], ADD[r])),
        ] })),
      ] }),
      cursorLayer([[0, 620, 380], [0.6, 620, 380], [C - 0.1, X[1] + 26, PY + 10], [C + 0.25, X[1] + 26, PY + 10], [C + 0.85, 580, 330]], [C], [], { inAt: 0.55 }),
    ];
  },
});

// 6 ─ Live collaborators: two named cursors roam a doc — one drag-selects a phrase, the other opens a line and types
UIK.define({
  id: 'collab-cursors', name: 'Live collaborators', cat: 'work', T: 4.4, cam: 1.25,
  desc: 'A shared doc with two collaborators. Maya’s ink cursor glides to a date and drag-selects it, a soft highlight growing exactly under her pointer. Leo’s accent cursor clicks the end of the last line: the text below slides down to open a line, and his sentence types in behind an accent caret. Both cursors drift off at the end.',
  build: () => {
    const LX = -520, LY = [-66, -12, 42], NL = 96, D0 = 1.6, D1 = 2.15, KC = 1.85, E0 = 1.95, T0 = 2.08, T1 = 3.2;
    const PH0 = f1(LX + 559.8 - 172), PHW = 166.5, L2END = f1(LX + 565.7);
    const ARROW = 'M3 2.2 L3 22.6 L8.4 17.4 L12 25.4 L15.6 23.8 L12.1 16 L19.6 16 Z';
    // a collaborator's pointer: the tip sits on the group point, a name tag hangs below right
    const pointer = (id, color, name, tw, kk) => group({ id, k: kk, ch: [
      path({ id: id + 'Arrow', x: -3.75, y: -2.75, scale: 1.25, d: ARROW, fill: color, stroke: 'card', sw: 1.6 }),
      rect({ id: id + 'Tag', x: 20, y: 44, pin: 'l', chAt: 'pin', w: tw + 26, h: 36, r: 12, fill: color, ch: [
        text({ text: name, x: 13, ax: 0, size: 20, weight: 600, color: color === 'acc' ? 'white' : 'inv' }),
      ] }),
    ] });
    const squeeze = (a, b) => ({ scale: [[a - 0.06, a, 0.9, 'Power2 Out'], [b, b + 0.22, 1, 'Back Out']] });
    return [
      rect({ id: 'card', w: 1160, h: 620, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'docTile', x: -492, y: -250, w: 56, h: 56, r: 16, fill: 'soft', k: enter(0.2, { blur: 0, s: 0.7 }), ch: [icon({ icon: 'file', size: 28, sw: 2.4 })] }),
        text({ id: 'docName', text: 'Launch plan', x: -448, y: -250, ax: 0, size: 30, weight: 600, k: enter(0.24, { dx: -14, x0: -448 }) }),
        text({ id: 'editing', text: '2 editing', x: 400, y: -250, ax: 1, size: 24, color: 'muted', k: enter(0.5) }),
        avatar({ id: 'presA', x: 450, y: -250, d: 50, fill: 'ink', ini: 'MC', stroke: 'card', sw: 4, k: pop(0.5, { from: 0.4 }) }),
        avatar({ id: 'presB', x: 490, y: -250, d: 50, fill: 'acc', ini: 'LP', stroke: 'card', sw: 4, k: pop(0.58, { from: 0.4 }) }),
        rect({ id: 'topRule', y: -206, w: 1160, h: 2, fill: 'line', k: fadeIn(0.3) }),
        text({ id: 'heading', text: 'Q4 launch', x: LX, y: -140, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.3, { dx: -16, x0: LX }) }),
        rect({ id: 'selection', x: PH0 - 2, y: LY[0], pin: 'l', w: 0, h: 46, r: 8, fill: 'ink/12', k: { w: [[D0, D1, PHW, 'Power2 Smooth']] } }),
        ...['We ship the new editor on October 14.', 'Marketing starts two weeks before launch.', 'Support needs the help docs by Friday.'].map((s, i) =>
          text({ id: 'line' + i, text: s, x: LX, y: LY[i], ax: 0, size: 32, k: enter(0.36 + i * 0.06, { dx: -14, x0: LX }) })),
        text({ id: 'newLine', text: 'Add a beta waitlist before launch.', x: LX, y: NL, ax: 0, size: 32,
          caret: true, caretColor: 'acc', caretFrom: E0 + 0.05, caretUntil: T1 + 0.9, k: { reveal: [0, [T0, T1, 1, 'Linear']] } }),
        group({ id: 'rest', k: k(enter(0.54, { blur: 0, s: 1 }), { y: [[E0, E0 + 0.35, 54, 'Power3 Out']] }), ch: [
          rect({ id: 'rest0', x: LX, y: 154, pin: 'l', w: 1000, h: 18, r: 9, fill: 'skel' }),
          rect({ id: 'rest1', x: LX, y: 198, pin: 'l', w: 760, h: 18, r: 9, fill: 'skel' }),
        ] }),
      ] }),
      pointer('maya', 'ink', 'Maya', 51.3, k(pop(0.62, { from: 0.4 }), squeeze(D0, D1), {
        x: [380, [0.95, 1.52, PH0, 'Power2 Smooth'], [D0, D1, PH0 + PHW, 'Power2 Smooth'], [3.3, 3.9, 180, 'Power2 Smooth']],
        y: [150, [0.95, 1.52, LY[0] + 10, 'Sine Smooth'], [3.3, 3.9, -150, 'Sine Smooth']] })),
      pointer('leo', 'acc', 'Leo', 34.8, k(pop(0.76, { from: 0.4 }), squeeze(KC, KC + 0.05), {
        x: [-420, [1.15, 1.76, L2END + 6, 'Power2 Smooth'], [3.35, 3.95, -250, 'Power2 Smooth']],
        y: [240, [1.15, 1.76, LY[2] + 12, 'Sine Smooth'], [3.35, 3.95, 196, 'Sine Smooth']] })),
    ];
  },
});

// 7 ─ Comment pins: numbered pins drop onto a design, one opens its thread, Resolve turns it into a small check
UIK.define({
  id: 'comment-pins', name: 'Comment pins', cat: 'work', T: 3.9, cam: 1.2,
  desc: 'Three numbered comment pins drop onto a page design, each pivoting on its tip. The cursor clicks pin 2: a thread bubble grows out of it with the comment, Reply and Resolve. Resolve folds the bubble away, the pin collapses into an accent check that shrinks to a small marker, and the open count rolls from 3 to 2.',
  build: () => {
    const C1 = 1.7, C2 = 2.7, O = C1 + 0.06, XC = C2 + 0.08, AX = 0, AY = 36;
    const PINS = [[320, 206], [56, -114], [-204, 76]], DROP = [0.75, 0.9, 1.05];
    const P2 = [PINS[1][0] + 28, PINS[1][1] - 28], BX = P2[0] + 40, BY = P2[1] - 28;
    const pin = (i) => group({ id: 'pin' + (i + 1), x: PINS[i][0], y: PINS[i][1],
      k: k({ y: [PINS[i][1] - 44, [DROP[i], DROP[i] + 0.45, PINS[i][1], 'Power3 Out']], opacity: [0, [DROP[i], DROP[i] + 0.12, 1, 'Linear']], scale: [0.5, [DROP[i], DROP[i] + 0.45, 1, 'Back Out']] },
        i === 1 ? k(press(C1, { to: 0.9 }), exit(XC, { dur: 0.16, s: 0.6 })) : null), ch: [
        rect({ id: 'pinBody' + (i + 1), x: 28, y: -28, w: 56, h: 56, radii: '28px 28px 28px 4px', fill: 'ink', stroke: 'card', sw: 3, shadow: 3, ch: [
          text({ text: String(i + 1), size: 26, weight: 600, color: 'inv', tnum: false }),
        ] }),
      ] });
    return [
      rect({ id: 'canvas', w: 1040, h: 700, r: 36, fill: 'panel', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'fileName', text: 'Homepage · v3', x: -476, y: -304, ax: 0, size: 28, weight: 600, k: enter(0.22, { dx: -14, x0: -476 }) }),
        rect({ id: 'openChip', x: 416, y: -304, w: 148, h: 52, r: 26, fill: 'card', k: enter(0.3), ch: [
          icon({ icon: 'message', x: -42, size: 24, sw: 2.4 }),
          roll({ id: 'openCount', x: -12, w: 20, h: 36, vals: ['3', '2'], ts: [XC + 0.1], size: 24, weight: 600 }),
          text({ text: 'open', x: 4, ax: 0, size: 24, weight: 500, color: 'muted' }),
        ] }),
        rect({ id: 'artboard', x: AX, y: AY, w: 800, h: 560, r: 20, fill: 'card', shadow: 3, k: enter(0.26, { blur: 0, s: 0.96 }), ch: [
          circle({ id: 'logo', x: -350, y: -234, d: 28, fill: 'ink' }),
          ...[140, 220, 300].map((x, i) => rect({ id: 'nav' + i, x, y: -234, w: 56, h: 12, r: 6, fill: 'skel' })),
          rect({ id: 'head0', x: -364, y: -150, pin: 'l', w: 420, h: 36, r: 10, fill: 'dim', k: enter(0.36, { blur: 0, dx: -12, x0: -364 }) }),
          rect({ id: 'head1', x: -364, y: -102, pin: 'l', w: 300, h: 36, r: 10, fill: 'dim', k: enter(0.4, { blur: 0, dx: -12, x0: -364 }) }),
          rect({ id: 'body0', x: -364, y: -42, pin: 'l', w: 340, h: 16, r: 8, fill: 'skel', k: fadeIn(0.44) }),
          rect({ id: 'body1', x: -364, y: -12, pin: 'l', w: 280, h: 16, r: 8, fill: 'skel', k: fadeIn(0.46) }),
          rect({ id: 'cta', x: -364, y: 56, pin: 'l', w: 170, h: 56, r: 28, fill: 'ink', k: fadeIn(0.5) }),
          photo({ id: 'hero', x: 210, y: -80, w: 260, h: 300, r: 18, v: 7, k: enter(0.34, { blur: 0, s: 0.96 }) }),
          ...[-250, 0, 250].map((x, i) => rect({ id: 'tile' + i, x, y: 190, w: 220, h: 110, r: 16, fill: 'soft', k: enter(0.5 + i * 0.05, { dy: 12, y0: 190, blur: 0 }) })),
        ] }),
        pin(0), pin(2), pin(1),
        group({ id: 'resolved', x: P2[0], y: P2[1], k: k(pop(XC + 0.02, { from: 0.5 }), { scale: [[XC + 0.5, XC + 0.85, 0.64, 'Power3 Out']] }), ch: [
          circle({ id: 'resolvedDisc', d: 56, fill: 'acc', stroke: 'card', sw: 3 }),
          path({ id: 'resolvedTick', d: tickD(24), stroke: 'white', sw: 5, trimmed: true, k: { trimE: [0, [XC + 0.12, XC + 0.4, 100, 'Power3 Out']] } }),
        ] }),
        rect({ id: 'thread', x: BX, y: BY, pin: 'tl', chAt: 'pin', w: 380, h: 256, r: 24, fill: 'card', shadow: 2,
          k: { scale: [0.5, [O, O + 0.45, 1, 'Power4 Out'], [XC, XC + 0.22, 0.6, 'Power2 In']], opacity: [0, [O, O + 0.12, 1, 'Linear'], [XC, XC + 0.22, 0, 'Power2 In']] }, ch: [
            group({ id: 'author', k: enter(O + 0.1, { s: 1 }), ch: [
              avatar({ x: 44, y: 46, d: 44, fill: 'dim', ini: 'MR' }),
              text({ text: 'Maya', x: 78, y: 46, ax: 0, size: 24, weight: 600 }),
              text({ text: '· 2h', x: 142, y: 46, ax: 0, size: 22, color: 'muted' }),
            ] }),
            text({ id: 'comment', text: 'Make the headline shorter?', x: 24, y: 104, ax: 0, size: 26, weight: 500, k: enter(O + 0.16) }),
            text({ id: 'comment2', text: 'Two lines at most on mobile.', x: 24, y: 138, ax: 0, size: 24, color: 'muted', k: enter(O + 0.2) }),
            rect({ id: 'threadRule', x: 190, y: 176, w: 332, h: 2, fill: 'line', k: fadeIn(O + 0.22) }),
            rect({ id: 'reply', x: 88, y: 216, w: 128, h: 56, r: 28, fill: 'soft', k: enter(O + 0.26), ch: [text({ text: 'Reply', size: 24, weight: 600 })] }),
            rect({ id: 'resolve', x: 268, y: 216, w: 176, h: 56, r: 28, fill: 'ink', k: k(enter(O + 0.3), press(C2)), ch: [
              icon({ icon: 'check', x: -52, size: 22, sw: 3, color: 'inv' }),
              text({ text: 'Resolve', x: -30, ax: 0, size: 24, weight: 600, color: 'inv' }),
            ] }),
          ] }),
      ] }),
      cursorLayer([[0, 620, 380], [1.0, 620, 380], [C1 - 0.1, P2[0] + 6, P2[1] + 10], [C1 + 0.2, P2[0] + 6, P2[1] + 10], [C2 - 0.1, BX + 276, BY + 224], [C2 + 0.2, BX + 276, BY + 224], [C2 + 0.85, 600, 360]],
        [C1, C2], [], { inAt: 0.95 }),
    ];
  },
});

// 8 ─ Version history: hovering versions previews them in the doc, Restore hands the Current badge to the picked one
UIK.define({
  id: 'version-history', name: 'Version history', cat: 'work', T: 4.1, cam: 1.15,
  desc: 'A doc beside its version list. The cursor slides down the list: a soft hover row glides after it (stretching as it travels) and the doc preview swaps to each version with a blur. On the older version the cursor clicks Restore: the accent Current badge travels down to it, the timeline dots trade places and a Restored toast lands on the doc.',
  build: () => {
    const RY = [-196, -92, 12, 116, 220], LX = 164, BX = 505, DX = -250, DY = 30, R = 2.7;
    const V = [['Today, 4:12 pm', 'Ana · Edited the plan cards'], ['Today, 11:30 am', 'Leo · New headline'], ['Yesterday, 6:05 pm', 'Maya · Added a table'],
      ['Sep 22, 9:40 am', 'Ana · First draft'], ['Sep 20, 3:15 pm', 'Leo · Created the page']];
    const CUR = [[0.6, 700, -250], [1.2, 300, RY[1] - 10], [1.95, 310, RY[2] - 10]];
    const tIn = cross(CUR[0][0], CUR[1][0], CUR[0][1], CUR[1][1], 580);
    const tG = cross(CUR[1][0], CUR[2][0], CUR[1][2], CUR[2][2], (RY[1] + RY[2]) / 2 - 10, 'Sine Smooth');
    const SW = [tIn + 0.05, tG];   // when the preview swaps to version 1, then 2
    // doc previews: three layouts in the doc panel's local space (±310 × ±300)
    const bar = (x, y, w, h, fill = 'skel') => rect({ x, y, pin: 'l', w, h, r: h / 2, fill });
    const tile = (x, y, w, h, fill = 'card') => rect({ x, y, w, h, r: 16, fill, ch: [bar(-w / 2 + 18, -h / 2 + 30, w * 0.4, 12, 'dim'), bar(-w / 2 + 18, -h / 2 + 62, w * 0.55, 22, fill === 'ink' ? 'inv/30' : 'skel')] });
    const views = [
      ['Simple pricing', [bar(-270, -176, 460, 14), bar(-270, -148, 380, 14), tile(-185, -30, 170, 190), tile(0, -30, 170, 190, 'ink'), tile(185, -30, 170, 190),
        bar(-270, 110, 520, 14), bar(-270, 138, 440, 14), rect({ x: -270, y: 212, pin: 'l', w: 190, h: 56, r: 28, fill: 'ink' })]],
      ['Pricing that scales', [bar(-270, -176, 500, 14), tile(-140, -50, 260, 150), tile(140, -50, 260, 150),
        ...[80, 124, 168, 212].map((y, i) => group({ ch: [bar(-270, y, [300, 360, 260, 330][i], 14, 'dim'), icon({ icon: 'plus', x: 250, y, size: 22, sw: 2.6, color: 'muted' })] }))]],
      ['Plans for every team', [bar(-270, -176, 420, 14), bar(-270, -148, 340, 14),
        rect({ y: -84, w: 560, h: 50, r: 12, fill: 'card', ch: [bar(-262, 0, 90, 12, 'dim'), bar(-20, 0, 60, 12, 'dim'), bar(130, 0, 60, 12, 'dim')] }),
        ...[-20, 36, 92, 148].map((y, i) => group({ y, ch: [bar(-262, 0, [130, 110, 150, 100][i], 12),
          icon({ icon: 'check', x: 10, size: 24, sw: 2.8 }), icon({ icon: i < 2 ? 'check' : 'minus', x: 160, size: 24, sw: 2.8, color: i < 2 ? 'ink' : 'dim' }),
          rect({ y: 28, w: 540, h: 2, fill: 'line' })] }))]],
    ];
    const preview = (v, i) => group({ id: 'view' + i, k: i === 0 ? k(enter(0.3), exit(SW[0], { dur: 0.14 })) : i === 1 ? k(enter(SW[0]), exit(SW[1], { dur: 0.14 })) : enter(SW[1]), ch: [
      text({ id: 'viewTitle' + i, text: v[0], x: -270, y: -226, ax: 0, size: 38, weight: 600, ls: -0.02 }),
      ...v[1],
    ] });
    return [
      rect({ id: 'card', w: 1200, h: 720, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'docName', text: 'Pricing page', x: -560, y: -306, ax: 0, size: 32, weight: 600, k: enter(0.22, { dx: -14, x0: -560 }) }),
        text({ id: 'listTitle', text: 'Version history', x: 110, y: -306, ax: 0, size: 32, weight: 600, k: enter(0.28, { dx: -14, x0: 110 }) }),
        icon({ id: 'close', icon: 'x', x: 548, y: -306, size: 30, sw: 2.6, color: 'muted', k: enter(0.32) }),
        rect({ id: 'doc', x: DX, y: DY, w: 620, h: 600, r: 24, fill: 'panel', clip: true, k: fadeIn(0.24), ch: [
          ...views.map(preview),
          group({ id: 'toast', y: 244, k: k(enter(R + 0.35, { dy: 24, y0: 244, blur: 0 })), ch: [
            rect({ id: 'toastBg', w: 440, h: 64, r: 32, fill: 'ink', shadow: 2 }),
            icon({ icon: 'refresh', x: -184, size: 24, sw: 2.6, color: 'inv' }),
            text({ text: 'Restored Yesterday, 6:05 pm', x: -158, ax: 0, size: 24, weight: 500, color: 'inv' }),
          ] }),
        ] }),
        rect({ id: 'hover', x: 340, y: RY[1], w: 480, h: 100, r: 20, fill: 'soft',
          k: k(onOff(tIn - 0.06, R + 0.7), { y: [[tG, tG + 0.32, RY[2], 'Power4 Out']], h: [[tG, tG + 0.1, 124, 'Power2 Out'], [tG + 0.1, tG + 0.36, 100, 'Power3 Out']] }) }),
        rect({ id: 'spine', x: 132, y: RY[0] - 18, pin: 't', w: 2, h: RY[4] - RY[0], fill: 'line', k: fadeIn(0.34) }),
        ...V.map(([t, s], i) => group({ id: 'ver' + i, y: RY[i], k: enter(0.34 + i * 0.06, { dx: -16, x0: 0, s: 1 }), ch: [
          circle({ id: 'dot' + i, x: 132, y: -18, d: 16, fill: i === 0 ? 'ink' : 'dim', stroke: 'card', sw: 3,
            k: i === 0 ? { fill: [[R + 0.1, R + 0.4, 'dim', 'Power2 Out']] } : i === 2 ? { fill: [[R + 0.4, R + 0.7, 'ink', 'Power2 Out']] } : undefined }),
          text({ id: 'verTime' + i, text: t, x: LX, y: -18, ax: 0, size: 28, weight: 600 }),
          text({ id: 'verWho' + i, text: s, x: LX, y: 18, ax: 0, size: 22, color: 'muted' }),
        ] })),
        rect({ id: 'restore', x: BX, y: RY[2] - 18, w: 110, h: 40, r: 20, fill: 'ink', k: k(enter(tG + 0.12, { blur: 0, s: 0.85 }), press(R), exit(R + 0.05, { dur: 0.1 })), ch: [
          text({ text: 'Restore', size: 20, weight: 600, color: 'inv' }),
        ] }),
        rect({ id: 'current', x: BX, y: RY[0] - 18, w: 110, h: 40, r: 20, fill: 'acc', k: k(enter(0.6, { blur: 0, s: 0.7 }), {
          y: [[R + 0.06, R + 0.56, RY[2] - 18, 'Power4 Out']], h: [[R + 0.06, R + 0.2, 64, 'Power2 Out'], [R + 0.2, R + 0.6, 40, 'Power3 Out']] }), ch: [
          text({ text: 'Current', size: 20, weight: 600, color: 'white' }),
        ] }),
      ] }),
      cursorLayer([[0, 700, -250], ...CUR, [R - 0.1, BX + 8, RY[2] - 12], [R + 0.2, BX + 8, RY[2] - 12], [R + 0.85, 700, 300]], [R], [], { inAt: 0.55 }),
    ];
  },
});

// Lucide glyphs K.ICONS lacks (24-grid stroke paths for icon({ paths }))
const UTENSILS = ['M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2', 'M7 2v20', 'M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7'];
const CAR = ['M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2',
  'M7 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4', 'M9 17h6', 'M17 15a2 2 0 1 0 0 4a2 2 0 1 0 0-4'];
const RECEIPT = ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z', 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 17.5v-11'];

// 9 ─ Book a meeting: a slot is picked from three days, Confirm collapses the picker into a booked card with a date tile
UIK.define({
  id: 'meeting-slots', name: 'Book a meeting', cat: 'work', T: 4.2,
  cam: { zoom: 1.2, k: { zoom: [[2.35, 3.0, 1.7, 'Power2 Smooth']] } },
  desc: 'A scheduling card with time slots over three days (one already taken). The cursor picks Tuesday 13:30: an ink fill grows inside the chip, the summary line swaps to the chosen time and Confirm wakes up. Confirm collapses the whole picker into a compact booked card while the camera moves in: a calendar tile with an accent header pops beside "You’re booked".',
  build: () => {
    const P = 1.35, C = 2.25, M = C + 0.1, EZ = 'Expo Out', X = [-300, 0, 300], SY = [-20, 64, 148], BY = 272;
    const DAYS = [['MON', '14', ['9:00', '11:30', '15:00']], ['TUE', '15', ['10:00', '13:30', '16:00']], ['WED', '16', ['9:30', '12:00', '14:30']]];
    const slot = (s, i, j) => {
      const off = i === 0 && j === 1, pick = i === 1 && j === 1;
      return rect({ id: `slot${i}_${j}`, x: X[i], y: SY[j], w: 240, h: 68, r: 34, fill: off ? 'panel' : 'card', stroke: off ? 'panel' : 'line', sw: 2,
        k: k(enter(0.5 + (i + j) * 0.05, { dy: 12, y0: SY[j] }), pick ? press(P, { to: 0.95 }) : null), ch: [
          text({ text: s, size: 28, weight: 500, color: off ? 'dim' : 'ink' }),
          ...(off ? [path({ d: 'M-44 2 H44', stroke: 'dim', sw: 3 })] : []),
          ...(pick ? [rect({ id: 'slotOn', w: 240, h: 68, r: 34, fill: 'ink', k: { opacity: [0, [P, P + 0.12, 1, 'Linear']], scale: [0.8, [P, P + 0.4, 1, 'Power4 Out']] }, ch: [
            text({ text: s, size: 28, weight: 600, color: 'inv' })] })] : []),
        ] });
    };
    return [
      rect({ id: 'card', w: 1000, h: 680, r: 44, fill: 'card', shadow: 1, k: k(popIn(0.1, { from: 0.7 }), { w: [[M, M + 0.6, 700, EZ]], h: [[M, M + 0.6, 400, EZ]] }), ch: [
        group({ id: 'picker', k: exit(C + 0.04, { dur: 0.16 }), ch: [
          avatar({ id: 'host', x: -414, y: -256, d: 72, fill: 'dim', ini: 'AR', k: pop(0.22, { from: 0.6 }) }),
          text({ id: 'title', text: 'Book a call with Ana', x: -362, y: -272, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(0.26, { dx: -14, x0: -362 }) }),
          text({ id: 'sub', text: '30 min · Video call', x: -362, y: -234, ax: 0, size: 24, color: 'muted', k: enter(0.32) }),
          icon({ id: 'videoIcon', icon: 'video', x: 430, y: -256, size: 32, sw: 2.4, color: 'muted', k: enter(0.34) }),
          rect({ id: 'rule', y: -186, w: 900, h: 2, fill: 'line', k: fadeIn(0.34) }),
          ...DAYS.map(([d, n], i) => group({ id: 'day' + i, x: X[i], k: enter(0.38 + i * 0.06, { dy: 12 }), ch: [
            text({ text: d, y: -140, size: 20, weight: 600, ls: 0.08, color: 'muted' }),
            text({ text: n, y: -102, size: 40, weight: 600, ls: -0.02, tnum: false }),
          ] })),
          ...DAYS.flatMap(([, , s], i) => s.map((v, j) => slot(v, i, j))),
          rect({ id: 'rule2', y: 214, w: 900, h: 2, fill: 'line', k: fadeIn(0.6) }),
          text({ id: 'hint', text: 'Pick a time that works', x: -450, y: BY, ax: 0, size: 26, color: 'muted', k: k(enter(0.62), exit(P + 0.04)) }),
          group({ id: 'picked', y: BY, k: enter(P + 0.08, { dx: -12, x0: 0, s: 1 }), ch: [
            icon({ icon: 'clock', x: -434, size: 26, sw: 2.4 }),
            text({ text: 'Tue, Oct 15 · 13:30', x: -408, ax: 0, size: 26, weight: 600 }),
          ] }),
          rect({ id: 'confirm', x: 330, y: BY, w: 240, h: 80, r: 40, fill: 'dim', k: k(enter(0.64, { blur: 0 }), { fill: [[P + 0.1, P + 0.4, 'ink', 'Power2 Out']] }, press(C)), ch: [
            text({ id: 'confirmLbl', text: 'Confirm', size: 28, weight: 600, color: 'card', k: { color: [[P + 0.1, P + 0.4, 'inv', 'Power2 Out']] } }),
          ] }),
        ] }),
        group({ id: 'booked', ch: [
          group({ id: 'dateTile', x: -210, k: pop(M + 0.08, { from: 0.6 }), ch: [
            rect({ id: 'tileFace', w: 150, h: 164, r: 28, fill: 'card', stroke: 'line', sw: 2, shadow: 3 }),
            rect({ id: 'tileHead', y: -60, w: 150, h: 44, radii: '28px 28px 0 0', fill: 'acc', ch: [text({ text: 'OCT', size: 20, weight: 600, ls: 0.1, color: 'white' })] }),
            text({ id: 'tileDay', text: '15', y: 22, size: 72, weight: 600, ls: -0.03, tnum: false }),
          ] }),
          text({ id: 'bookedTitle', text: 'You’re booked', x: -100, y: -52, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(M + 0.12, { dx: -16, x0: -100 }) }),
          text({ id: 'bookedTime', text: 'Tue, Oct 15 · 13:30–14:00', x: -100, y: -4, ax: 0, size: 26, k: enter(M + 0.2) }),
          group({ id: 'bookedInvite', y: 44, k: enter(M + 0.28, { s: 1 }), ch: [
            icon({ icon: 'mail', x: -86, size: 24, sw: 2.2, color: 'muted' }),
            text({ text: 'Invite sent to ana@studio.io', x: -62, ax: 0, size: 22, color: 'muted' }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 600, 380], [0.6, 600, 380], [P - 0.1, 34, SY[1] + 12], [P + 0.2, 34, SY[1] + 12], [C - 0.1, 340, BY + 10], [C + 0.2, 340, BY + 10], [C + 0.8, 400, 240]], [P, C], [], { inAt: 0.55 }),
    ];
  },
});

// 10 ─ Time zones: dragging the hour slider rolls every city's clock in sync while each working-hours band slides under a fixed needle
UIK.define({
  id: 'timezone-slider', name: 'Time zone slider', cat: 'work', T: 3.9, cam: 1.2,
  desc: 'Three cities with their local times. The cursor drags the hour slider past 4 pm and back to 3 pm: every clock rolls through the hours on the same curve as the knob, each row’s working-hours band slides under a fixed accent needle, and the status icons flip — New York wakes into its workday (moon → sun) while Tokyo’s ends (sun → moon).',
  build: () => {
    const G = 1.1, M = 2.05, R = 2.55, PS = 'Power2 Smooth', H0 = 9, H1 = 16, H2 = 15, PX = 36, TX = 240, TW = 440, SY = 196, HH = 60;
    const X = (h) => -450 + h * 37.5, RY = [-150, -40, 70];
    const Z = [{ n: 'Lisbon', m: 'Portugal · UTC+1', off: 0 }, { n: 'New York', m: 'USA · UTC−4', off: -5 }, { n: 'Tokyo', m: 'Japan · UTC+9', off: 8 }];
    const mv = (f) => [[G, M, f(H1), PS], [M, R, f(H2), PS]];
    const pad = (h) => String(((h % 24) + 24) % 24).padStart(2, '0');
    const at = (h) => cross(G, M, H0, H1, h);   // the moment the first leg passes hour h
    // status flips: [icon at start, time it swaps] — NY enters 9:00 local, Tokyo leaves 18:00 local
    const FLIP = [null, at(9 + 5), at(18 - 8)];
    const status = (i) => {
      const start = i === 1 ? 'moon' : 'sun', t = FLIP[i];
      const icn = (name, on) => icon({ id: 'st' + i + name, icon: name, size: 34, sw: 2.4, color: name === 'sun' ? 'ink' : 'muted',
        k: on ? (t ? k(enter(0.5 + i * 0.07), { scale: [[t, t + 0.16, 0.5, 'Power2 In']], opacity: [[t, t + 0.16, 0, 'Power2 In']], rot: [[t, t + 0.16, 40, 'Power2 In']] }) : enter(0.5 + i * 0.07))
          : { scale: [0.5, [t + 0.1, t + 0.5, 1, 'Back Out']], opacity: [0, [t + 0.1, t + 0.22, 1, 'Linear']], rot: [-40, [t + 0.1, t + 0.5, 0, 'Power3 Out']] } });
      return group({ id: 'status' + i, x: 506, ch: t ? [icn(start, true), icn(start === 'sun' ? 'moon' : 'sun', false)] : [icn(start, true)] });
    };
    return [
      rect({ id: 'card', w: 1100, h: 680, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'title', text: 'Find a time', x: -490, y: -270, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -490 }) }),
        text({ id: 'sub', text: 'Working hours 9:00–18:00 local', x: -490, y: -228, ax: 0, size: 24, color: 'muted', k: enter(0.28) }),
        ...Z.map((z, i) => group({ id: 'zone' + i, y: RY[i], k: enter(0.34 + i * 0.07, { dx: -16, x0: 0 }), ch: [
          text({ id: 'city' + i, text: z.n, x: -490, y: -18, ax: 0, size: 34, weight: 600 }),
          text({ id: 'meta' + i, text: z.m, x: -490, y: 22, ax: 0, size: 22, color: 'muted' }),
          rect({ id: 'hours' + i, x: -150, w: 70, h: HH, clip: true, ch: [group({ id: 'hoursCol' + i, k: { y: mv((h) => -HH * (h - H0)) },
            ch: Array.from({ length: H1 - H0 + 1 }, (_, j) => text({ text: pad(H0 + z.off + j), x: 35, y: j * HH, ax: 1, size: 48, weight: 600, ls: -0.02, tnum: false })) })] }),
          text({ id: 'mins' + i, text: ':00', x: -116, ax: 0, size: 48, weight: 600, ls: -0.02, tnum: false }),
          rect({ id: 'track' + i, x: TX, w: TW, h: 44, r: 22, fill: 'soft', clip: true, ch: [
            group({ id: 'band' + i, x: (9 - (H0 + z.off)) * PX, k: { x: mv((h) => (9 - (h + z.off)) * PX) }, ch: [
              rect({ id: 'bandFill' + i, pin: 'l', w: 9 * PX, h: 48, r: 24, fill: 'dim' }),
            ] }),
          ] }),
          status(i),
        ] })),
        group({ id: 'needle', x: TX, k: fadeIn(0.6), ch: [
          rect({ id: 'needleLine', y: RY[0] - 36, pin: 't', w: 4, h: RY[2] - RY[0] + 72, r: 2, fill: 'acc' }),
          circle({ id: 'needleCap', y: RY[0] - 36, d: 16, fill: 'acc' }),
        ] }),
        rect({ id: 'rule', y: 136, w: 1000, h: 2, fill: 'line', k: fadeIn(0.5) }),
        rect({ id: 'sliderTrack', y: SY, w: 900, h: 10, r: 5, fill: 'dim', k: fadeIn(0.54) }),
        rect({ id: 'sliderFill', x: -450, y: SY, pin: 'l', w: X(H0) + 450, h: 10, r: 5, fill: 'ink', k: k(fadeIn(0.54), { w: mv((h) => X(h) + 450) }) }),
        ...[0, 6, 12, 18, 24].map((h, i) => text({ id: 'tick' + i, text: pad(h) + ':00', x: X(h), y: SY + 44, size: 20, color: 'muted', k: enter(0.58 + i * 0.03) })),
        circle({ id: 'knob', x: X(H0), y: SY, d: 48, fill: 'white', stroke: 'ink', sw: 4, shadow: 3,
          k: k(pop(0.6, { from: 0.4 }), { x: mv(X) }, { scale: [[G - 0.05, G + 0.15, 1.2, 'Power3 Out'], [R + 0.05, R + 0.45, 1, 'Back Out']] }) }),
      ] }),
      cursorLayer([[0, 600, 380], [0.5, 600, 380], [G - 0.12, X(H0) + 4, SY + 8], [G, X(H0) + 4, SY + 8], [M, X(H1) + 4, SY + 8], [R, X(H2) + 4, SY + 8],
        [R + 0.15, X(H2) + 4, SY + 8], [R + 0.75, 560, 380]], [], [[G, R]], { inAt: 0.45 }),
    ];
  },
});

// 11 ─ Split the bill: Split evenly rolls three amounts up, switching one person off rolls them to the new share
UIK.define({
  id: 'expense-split', name: 'Split the bill', cat: 'work', T: 3.9, cam: 1.2,
  desc: 'A $126 dinner bill and three people. Split evenly is clicked: each amount (a COUNTER placeholder, Roll) rolls up to $42.00 and the button settles into an applied state. The cursor switches Maya off: her row dims as her share rolls back to zero, the other two roll on to $63.00 and small accent "+$21" chips pop beside them.',
  build: () => {
    const S = 1.2, K = 2.45, RY = [-70, 30, 130], SZ = 36, R1 = 'Power3 Out', AX = 380;
    const P = [{ n: 'Ana (you)', ini: 'AR', fill: 'ink' }, { n: 'Leo', ini: 'LP', fill: 'dim' }, { n: 'Maya', ini: 'MC', fill: 'soft' }];
    // ONE text per amount: "$" + a COUNTER placeholder (Roll: the ones wheel spins, each carry turns the
    // tens) keyed by 'ph:1' — up to $42 on Split evenly, then on to $63 (Maya: back to $0). width=fit
    // closes the empty tens slot at $0, so the "$" slides left as the tens digit rolls in.
    const amount = (i) => {
      const off = i === 2, to = off ? 42 : 63;
      return text({ id: 'amount' + i, text: `$\{{{COUNTER:0-${to}; style=roll; width=fit; kf=1}}}.00`, x: AX, ax: 1, size: SZ, weight: 600,
        k: { 'ph:1': [0, [S + 0.1, S + 0.9, +(4200 / to).toFixed(3), R1], [K + 0.15, K + 0.75, off ? 0 : 100, R1]] } });
    };
    return [
      rect({ id: 'card', w: 860, h: 700, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'tile', x: -354, y: -262, w: 72, h: 72, r: 22, fill: 'soft', k: enter(0.2, { blur: 0, s: 0.7 }), ch: [icon({ paths: RECEIPT, size: 36, sw: 2.4 })] }),
        text({ id: 'title', text: 'Dinner at Nopa', x: -298, y: -278, ax: 0, size: 32, weight: 600, ls: -0.02, k: enter(0.24, { dx: -14, x0: -298 }) }),
        text({ id: 'sub', text: 'Fri, Oct 10 · Paid by Ana', x: -298, y: -242, ax: 0, size: 24, color: 'muted', k: enter(0.3) }),
        text({ id: 'total', text: '$126.00', x: AX, y: -262, ax: 1, size: 44, weight: 600, ls: -0.02, tnum: false, k: enter(0.3) }),
        rect({ id: 'rule', y: -196, w: 780, h: 2, fill: 'line', k: fadeIn(0.34) }),
        text({ id: 'between3', text: 'Split between 3 people', x: -390, y: -144, ax: 0, size: 24, weight: 500, color: 'muted', k: k(enter(0.38), exit(K + 0.1)) }),
        text({ id: 'between2', text: 'Split between 2 people', x: -390, y: -144, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(K + 0.12) }),
        ...[0, 1].map((i) => rect({ id: 'sep' + i, y: (RY[i] + RY[i + 1]) / 2, w: 780, h: 2, fill: 'line', k: fadeIn(0.5 + i * 0.06) })),
        ...P.map((p, i) => group({ id: 'person' + i, y: RY[i], k: enter(0.42 + i * 0.07, { dx: -16, x0: 0 }), ch: [
          group({ id: 'info' + i, k: i === 2 ? { opacity: [[K + 0.05, K + 0.3, 0.4, 'Power2 Out']] } : undefined, ch: [
            avatar({ x: -350, d: 64, fill: p.fill, ini: p.ini }),
            text({ text: p.n, x: -300, ax: 0, size: 30, weight: 600 }),
            amount(i),
          ] }),
          rect({ id: 'switch' + i, x: 90, w: 84, h: 48, r: 24, fill: 'ink', k: i === 2 ? k(press(K, { to: 0.93 }), { fill: [[K, K + 0.25, 'dim', 'Power2 Out']] }) : undefined, ch: [
            rect({ id: 'knob' + i, x: 18, w: 38, h: 38, r: 19, fill: 'white', shadow: 3,
              k: i === 2 ? { x: [[K, K + 0.45, -18, 'Power4 Out']], w: [[K, K + 0.13, 54, 'Power2 Out'], [K + 0.13, K + 0.5, 38, 'Power3 Out']] } : undefined }),
          ] }),
          ...(i < 2 ? [rect({ id: 'delta' + i, x: 230, pin: 'r', chAt: 'pin', w: 82, h: 38, r: 19, fill: 'acc/12', k: pop(K + 0.6 + i * 0.06, { from: 0.4 }), ch: [
            text({ text: '+$21', x: -41, size: 22, weight: 600, color: 'acc' })] })] : []),
        ] })),
        rect({ id: 'splitBtn', y: 252, w: 780, h: 96, r: 48, fill: 'ink', k: k(enter(0.6, { blur: 0 }), press(S, { to: 0.97 }), { fill: [[S + 0.06, S + 0.36, 'soft', 'Power2 Out']] }), ch: [
          text({ id: 'splitLbl', text: 'Split evenly', size: 32, weight: 600, color: 'inv', k: exit(S + 0.02) }),
          group({ id: 'splitDone', k: enter(S + 0.1), ch: [
            icon({ icon: 'check', x: -110, size: 30, sw: 3 }),
            text({ text: 'Split evenly', x: -82, ax: 0, size: 32, weight: 600 }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 580, 380], [0.55, 580, 380], [S - 0.1, 60, 262], [S + 0.2, 60, 262], [K - 0.1, 100, RY[2] + 10], [K + 0.2, 100, RY[2] + 10], [K + 0.85, 560, 360]], [S, K], [], { inAt: 0.5 }),
    ];
  },
});

// 12 ─ Budget envelopes: a new expense glides into Dining, whose bar runs past its limit and turns red with an "Over by $12" chip
UIK.define({
  id: 'budget-envelopes', name: 'Budget envelopes', cat: 'work', T: 3.7, cam: 1.2,
  desc: 'Four budget rows fill their spent bars on a stagger. A new expense card slides in beside the card, then glides into the Dining row and shrinks into its bar: the bar grows past its limit notch, a red wipe runs along it, the spent figure counts up and turns red, an "Over by $12" chip pops and the left-to-spend total counts down.',
  build: () => {
    const E0 = 0.95, E1 = 1.55, E2 = 2.05, TW = 680, TL = -320, RY = [-128, -14, 100, 214], CX = 620;
    const W = (s, l) => +(TW * s / l).toFixed(1);
    const ROWS = [['Groceries', { icon: 'bag' }, 320, 400], ['Dining', { paths: UTENSILS }, 188, 200], ['Transport', { paths: CAR }, 64, 120], ['Entertainment', { icon: 'video' }, 90, 150]];
    return [
      rect({ id: 'card', w: 900, h: 680, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'title', text: 'October budget', x: -400, y: -262, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -400 }) }),
        text({ id: 'leftLbl', text: 'Left to spend', x: 400, y: -288, ax: 1, size: 22, color: 'muted', k: enter(0.28) }),
        text({ id: 'left', x: 400, y: -250, ax: 1, size: 44, weight: 600, ls: -0.02, num: { pre: '$' }, value: 348, k: k(enter(0.3), { value: [[E2, E2 + 0.6, 324, 'Power3 Out']] }) }),
        rect({ id: 'rule', y: -196, w: 820, h: 2, fill: 'line', k: fadeIn(0.34) }),
        ...ROWS.map(([n, ic, s, l], i) => {
          const hit = i === 1, t = 0.5 + i * 0.08;
          return group({ id: 'env' + i, y: RY[i], k: k(enter(0.36 + i * 0.07, { dx: -16, x0: 0 }), hit ? bump(E2, 1.02) : null), ch: [
            rect({ x: -370, w: 60, h: 60, r: 18, fill: 'soft', ch: [icon(Object.assign({ size: 30, sw: 2.4 }, ic))] }),
            text({ id: 'envName' + i, text: n, x: TL, y: -18, ax: 0, size: 30, weight: 600 }),
            text({ id: 'envLimit' + i, text: '/ $' + l, x: 400, y: -18, ax: 1, size: 26, weight: 500, color: 'muted' }),
            text({ id: 'envSpent' + i, x: 400 - 83.6 - 8, y: -18, ax: 1, size: 26, weight: 600, num: { pre: '$' }, value: s,
              k: hit ? { value: [[E2, E2 + 0.55, s + 24, 'Power3 Out']], opacity: [[E2 + 0.4, E2 + 0.6, 0, 'Power2 Out']] } : undefined }),
            ...(hit ? [text({ id: 'envSpentOver', x: 400 - 83.6 - 8, y: -18, ax: 1, size: 26, weight: 600, color: 'bad', num: { pre: '$' }, value: s,
              k: { value: [[E2, E2 + 0.55, s + 24, 'Power3 Out']], opacity: [0, [E2 + 0.4, E2 + 0.6, 1, 'Power2 Out']] } })] : []),
            rect({ id: 'envTrack' + i, x: TL, y: 24, pin: 'l', w: TW, h: 14, r: 7, fill: 'skel' }),
            rect({ id: 'envFill' + i, x: TL, y: 24, pin: 'l', w: 0, h: 14, r: 7, fill: 'ink',
              k: { w: [[t, t + 0.7, W(s, l), 'Power4 Out']].concat(hit ? [[E2, E2 + 0.55, W(s + 24, l), 'Power4 Out']] : []) } }),
            ...(hit ? [
              rect({ id: 'overFill', x: TL, y: 24, pin: 'l', w: 0, h: 14, r: 7, fill: 'bad', k: { w: [[E2 + 0.4, E2 + 0.75, W(s + 24, l), 'Power3 Out']] } }),
              rect({ id: 'limitNotch', x: TL + TW, y: 24, w: 4, h: 22, fill: 'card' }),
              rect({ id: 'overChip', x: TL + 92.1 + 16, y: -18, pin: 'l', chAt: 'pin', w: 150, h: 40, r: 20, fill: 'bad/12', k: pop(E2 + 0.62, { from: 0.4 }), ch: [
                text({ text: 'Over by $12', x: 75, size: 22, weight: 600, color: 'bad' })] }),
            ] : []),
          ] });
        }),
      ] }),
      // the new expense: slides in beside the card, then glides into the Dining bar's end and shrinks into it
      group({ id: 'expense', x: CX, y: RY[1], k: { x: [CX + 60, [E0, E0 + 0.5, CX, 'Power4 Out'], [E1, E2, TL + W(188, 200), 'Power2 Smooth']], y: [[E1, E2, RY[1] + 24, 'Power2 Smooth']],
          scale: [0.7, [E0, E0 + 0.5, 1, 'Back Out'], [E1, E2, 0.16, 'Power2 Smooth']], opacity: [0, [E0, E0 + 0.12, 1, 'Linear'], [E2 - 0.12, E2, 0, 'Linear']] }, ch: [
        rect({ id: 'expenseCard', w: 280, h: 88, r: 44, fill: 'ink', shadow: 2 }),
        icon({ paths: UTENSILS, x: -100, size: 30, sw: 2.4, color: 'inv' }),
        text({ text: 'Sushi Bar', x: -70, y: -14, ax: 0, size: 26, weight: 600, color: 'inv' }),
        text({ text: '−$24.00 · Dining', x: -70, y: 18, ax: 0, size: 20, color: 'inv/60' }),
      ] }),
    ];
  },
});

// 13 ─ Stock ticker: a live line draws at a steady pace, the price ticks with its tip, the delta chip flips up ↔ down
UIK.define({
  id: 'stock-ticker', name: 'Stock ticker', cat: 'work', T: 4.3, cam: 1.25,
  desc: 'A live price card: the line draws across the time axis at a steady pace (Trim Paths keyed per vertex) while a dot rides its tip and the price counter ticks to each new value. When the price crosses the dashed open line the delta chip flips over (a vertical squash) between an accent “up” and a red “down”, and a volume bar pops under every tick.',
  build: () => {
    const V = [182.4, 183.3, 183.9, 182.9, 181.8, 181.0, 180.6, 181.4, 181.0, 182.6, 183.7, 184.3, 185.1];
    const OPEN = V[0], X0 = -440, DX = 840 / (V.length - 1), Y = (p) => +(150 - (p - 180) / 5.4 * 236).toFixed(1);
    const P = V.map((v, i) => [+(X0 + i * DX).toFixed(1), Y(v)]), N = P.length, D0 = 0.6, D1 = 3.6;
    const cum = [0];
    for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    const LEN = cum[N - 1];
    // the x axis is time: the tip crosses it at a constant speed (ONE Linear x segment); trim, tip y and the
    // price are keyed at the moment the tip reaches each vertex
    const TI = P.map((_, i) => +(D0 + (D1 - D0) * i / (N - 1)).toFixed(3));
    const seg = (fn, from = 1, to = N - 1) => P.slice(from, to + 1).map((p, j) => [TI[from + j - 1], TI[from + j], fn(from + j), 'Linear']);
    const pct = (i) => +((V[i] - OPEN) / OPEN * 100).toFixed(2);
    const IA = V.findIndex((v) => v < OPEN), IB = V.findIndex((v, i) => i > IA && v > OPEN), FA = TI[IA], FB = TI[IB];   // down at FA, up again at FB
    // each chip's percentage is keyed only while that chip is showing
    const PCT = { up: [0, ...seg(pct, 1, IA - 1), [FB, pct(IB)], ...seg(pct, IB + 1)], down: [0, [FA, pct(IA)], ...seg(pct, IA + 1, IB - 1)] };
    const VOL = [34, 48, 40, 52, 60, 44, 70, 38, 46, 58, 64, 50, 72];
    const chip = (id, up) => group({ id, x: -140, y: -164, k: up
        ? k(enter(0.42, { s: 1 }), { sy: [1, [FA, FA + 0.12, 0, 'Power2 In'], [FB + 0.12, FB + 0.32, 1, 'Power3 Out']] })
        : { sy: [0, [FA + 0.12, FA + 0.32, 1, 'Power3 Out'], [FB, FB + 0.12, 0, 'Power2 In']] }, ch: [
        rect({ id: id + 'Bg', x: 0, pin: 'l', chAt: 'pin', w: 156, h: 50, r: 25, fill: up ? 'acc/12' : 'bad/12', ch: [
          icon({ icon: up ? 'arrowUp' : 'arrowDown', x: 30, size: 24, sw: 2.8, color: up ? 'acc' : 'bad' }),
          text({ id: id + 'Pct', x: 50, ax: 0, size: 24, weight: 600, color: up ? 'acc' : 'bad', num: { pre: up ? '+' : '', dec: 2, suf: '%' },
            value: 0, k: { value: up ? PCT.up : PCT.down } }),
        ] }),
      ] });
    return [
      rect({ id: 'card', w: 1000, h: 640, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'logo', x: -408, y: -254, w: 64, h: 64, r: 20, fill: 'ink', k: enter(0.2, { blur: 0, s: 0.7 }), ch: [icon({ icon: 'zap', size: 30, sw: 2.4, color: 'inv' })] }),
        text({ id: 'name', text: 'Nova Robotics', x: -360, y: -270, ax: 0, size: 30, weight: 600, k: enter(0.24, { dx: -14, x0: -360 }) }),
        text({ id: 'symbol', text: 'NOVA · Market open', x: -360, y: -236, ax: 0, size: 22, color: 'muted', k: enter(0.3) }),
        group({ id: 'live', x: 440, y: -254, k: enter(0.34), ch: [
          circle({ id: 'liveDot', x: -70, d: 12, fill: 'ink', k: { opacity: [1, [0.9, 1.3, 0.2, 'Sine Smooth'], [1.3, 1.7, 1, 'Sine Smooth'], [2.1, 2.5, 0.2, 'Sine Smooth'], [2.5, 2.9, 1, 'Sine Smooth'], [3.3, 3.7, 0.2, 'Sine Smooth'], [3.7, 4.1, 1, 'Sine Smooth']] } }),
          text({ text: 'Live', x: -52, ax: 0, size: 24, weight: 500 }),
        ] }),
        text({ id: 'price', x: -440, y: -164, ax: 0, size: 72, weight: 600, ls: -0.03, num: { pre: '$', dec: 2 }, value: V[0], k: k(enter(0.3), { value: [V[0], ...seg((i) => V[i])] }) }),
        chip('chipUp', true), chip('chipDown', false),
        path({ id: 'openLine', d: `M${X0} ${Y(OPEN)} H400`, stroke: 'dim', sw: 3, dash: [8, 10], k: fadeIn(0.44) }),
        text({ id: 'openLbl', text: 'Open', x: 470, y: Y(OPEN), ax: 1, size: 20, weight: 500, color: 'muted', k: enter(0.46) }),
        ...[184, 180].map((p, i) => text({ id: 'axis' + i, text: String(p), x: 470, y: Y(p), ax: 1, size: 20, color: 'muted', k: enter(0.48 + i * 0.04) })),
        ...P.map(([x], i) => rect({ id: 'vol' + i, x, y: 244, pin: 'b', w: 26, h: 0, r: 5, fill: i && V[i] < V[i - 1] ? 'ink/15' : 'ink/40',
          k: { h: [[TI[i] - 0.02, TI[i] + 0.28, VOL[i], 'Power3 Out']] } })),
        ...['9:30', '11:00', '12:30', '14:00'].map((s, i) => text({ id: 'time' + i, text: s, x: X0 + i * 280, y: 276, ax: i ? 0.5 : 0, size: 20, color: 'muted', k: enter(0.5 + i * 0.04) })),
        path({ id: 'line', d: 'M' + P.map((p) => p.join(' ')).join(' L'), stroke: 'ink', sw: 5, trimmed: true, k: { trimE: [0, ...seg((i) => +(cum[i] / LEN * 100).toFixed(3))] } }),
        circle({ id: 'tipPulse', x: P[N - 1][0], y: P[N - 1][1], d: 22, stroke: 'ink/30', sw: 3, k: { scale: [1, [D1, D1 + 0.7, 2.6, 'Power2 Out']], opacity: [0, [D1, 1], [D1, D1 + 0.7, 0, 'Power2 Out']] } }),
        circle({ id: 'tip', x: P[0][0], y: P[0][1], d: 22, fill: 'ink', stroke: 'card', sw: 5,
          k: { x: [P[0][0], [D0, D1, P[N - 1][0], 'Linear']], y: [P[0][1], ...seg((i) => P[i][1])], scale: [0, [0.5, 0.85, 1, 'Back Out']], opacity: [0, [0.5, 0.6, 1, 'Linear']] } }),
      ] }),
    ];
  },
});

// 14 ─ Currency converter: the amount types in, the result rolls in digit by digit; the swap button turns and the pills trade places
UIK.define({
  id: 'currency-converter', name: 'Currency converter', cat: 'work', T: 4.3, cam: 1.2,
  desc: 'The cursor focuses the send field and 1,250 types in; the converted amount (a COUNTER placeholder, Odometer) rolls in column by column, the right-hand columns spinning a full turn. The accent swap button is clicked: it turns 180°, the USD and EUR pills trade places on crossing arcs, every result digit rolls on to the new value and the rate line swaps.',
  build: () => {
    const F = 0.9, T0 = 1.05, T1 = 1.45, TC = 1.6, SW = 2.6, BYF = -110, BYT = 90, PX = 230, AY = 18, SZ = 56;
    // the result is a COUNTER placeholder in Odometer style (the right-hand columns spin a turn). It rolls
    // twice — 0 → 1,152.50, then on to 1,355.75 at the swap — so two texts hand over on a Hold key at
    // the moment both read 1,152.50 in the same digit cells.
    const result = (id, body, kk) => text({ id, text: `{{{COUNTER:${body}}}}`, x: -330, y: AY, ax: 0, size: SZ, weight: 600, k: kk });
    const cols = [
      result('resultA', `0.00-1,152.50; start=${TC}; duration=0.85; turns=1`, k(fadeIn(TC), { opacity: [[SW + 0.2, 0]] })),
      result('resultB', `1,152.50-1,355.75; start=${SW + 0.2}; duration=0.6; turns=0; cascade=25`, { opacity: [0, [SW + 0.2, 1]] }),
    ];
    const pill = (id, sym, code, y0, y1, arc) => group({ id, x: PX, y: y0, k: k(enter(0.44, { blur: 0, s: 0.8 }),
        { y: [[SW, SW + 0.55, y1, 'Power4 Out']], x: [[SW, SW + 0.24, PX + arc, 'Power2 Out'], [SW + 0.24, SW + 0.6, PX, 'Power3 Out']] }), ch: [
        rect({ w: 180, h: 72, r: 36, fill: 'card', shadow: 3 }),
        circle({ x: -54, d: 44, fill: 'ink', ch: [text({ text: sym, size: 24, weight: 600, color: 'inv' })] }),
        text({ text: code, x: -22, ax: 0, size: 28, weight: 600 }),
        icon({ icon: 'chevronDown', x: 62, size: 20, sw: 2.8, color: 'muted' }),
      ] });
    const box = (id, y, label, t) => rect({ id, y, w: 740, h: 160, r: 30, fill: 'panel', k: enter(t, { dy: 14, y0: y, blur: 0 }), ch: [
      text({ text: label, x: -330, y: -46, ax: 0, size: 22, weight: 500, color: 'muted' }),
    ] });
    return [
      rect({ id: 'card', w: 820, h: 640, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'title', text: 'Convert', x: -370, y: -262, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -370 }) }),
        text({ id: 'mid', text: 'Mid-market rate', x: 370, y: -262, ax: 1, size: 22, color: 'muted', k: enter(0.3) }),
        box('fromBox', BYF, 'You send', 0.3),
        rect({ id: 'fromFocus', y: BYF, w: 740, h: 160, r: 30, stroke: 'ink', sw: 2.5, k: onOff(F, SW - 0.1) }),
        box('toBox', BYT, 'They get', 0.36),
        group({ id: 'from', y: BYF + AY, ch: [
          text({ id: 'fromPh', text: '0', x: -330, ax: 0, size: SZ, weight: 600, color: 'dim', tnum: false, k: k(enter(0.4), exit(T0 - 0.02, { dur: 0.08, blur: 0 })) }),
          text({ id: 'fromAmt', text: '1,250', x: -330, ax: 0, size: SZ, weight: 600, ls: -0.02, tnum: false, caret: true, caretColor: 'acc', caretFrom: F + 0.1, caretUntil: SW,
            k: { reveal: [0, [T0, T1, 1, 'Linear']] } }),
        ] }),
        group({ id: 'to', y: BYT, ch: [
          text({ id: 'toPh', text: '0.00', x: -330, y: AY, ax: 0, size: SZ, weight: 600, color: 'dim', tnum: false, k: k(enter(0.44), exit(TC - 0.02, { dur: 0.1, blur: 0 })) }),
          ...cols,
        ] }),
        pill('usd', '$', 'USD', BYF, BYT, 64), pill('eur', '€', 'EUR', BYT, BYF, -64),
        circle({ id: 'swap', y: (BYF + BYT) / 2, d: 84, fill: 'acc', stroke: 'card', sw: 8, k: k(pop(0.5, { from: 0.4 }), press(SW, { to: 0.88 })), ch: [
          icon({ id: 'swapIcon', paths: ['m21 16-4 4-4-4', 'M17 20V4', 'm3 8 4-4 4 4', 'M7 4v16'], size: 34, sw: 2.8, color: 'white', k: { rot: [[SW, SW + 0.55, 180, 'Power4 Out']] } }),
        ] }),
        text({ id: 'rateA', text: '1 USD = 0.9220 EUR', x: -370, y: 246, ax: 0, size: 24, color: 'muted', k: k(enter(0.5), exit(SW + 0.1)) }),
        text({ id: 'rateB', text: '1 EUR = 1.0846 USD', x: -370, y: 246, ax: 0, size: 24, color: 'muted', k: enter(SW + 0.14) }),
        text({ id: 'fee', text: 'No fee', x: 370, y: 246, ax: 1, size: 24, weight: 500, k: enter(0.54) }),
      ] }),
      cursorLayer([[0, 600, 380], [0.45, 600, 380], [F - 0.1, -80, BYF + 22], [F + 0.2, -80, BYF + 22], [F + 0.8, 520, 330], [SW - 0.55, 520, 330], [SW - 0.1, 12, 2], [SW + 0.2, 12, 2], [SW + 0.85, 520, 340]],
        [F, SW], [], { inAt: 0.4 }),
    ];
  },
});

// 15 ─ Receipt print: the paper feeds out of the printer slot line by line, the camera follows it down, a PAID stamp lands
UIK.define({
  id: 'receipt-print', name: 'Receipt print', cat: 'work', T: 4.6,
  cam: { zoom: 1.4, y: -300, k: { zoom: [[0.9, 3.7, 1.12, 'Power2 Smooth']], y: [[0.9, 3.7, -56, 'Power2 Smooth']] } },
  desc: 'A receipt feeds out of a printer slot in short mechanical bursts (a clip window growing line by line) while the camera eases down and out to follow it: header, items, subtotal, a bold total, a barcode, and last the zigzag torn edge. The printer status swaps to Done and an accent PAID stamp lands on the total.',
  build: () => {
    const SLOT = -362, PW = 480, PH = 690, Z = 12;
    // feed: clip heights (paper-relative y) the printer stops at, one burst each
    const STOPS = [58, 118, 152, 196, 236, 276, 316, 352, 390, 426, 476, 522, 612, 650, PH + Z];
    const P0 = 0.75, STEP = 0.19, END = P0 + STOPS.length * STEP;
    const feed = STOPS.map((h, i) => [+(P0 + i * STEP).toFixed(2), +(P0 + i * STEP + 0.13).toFixed(2), h, 'Power2 Out']);
    let zz = `M${-PW / 2} 0 H${PW / 2} V${PH}`;
    for (let x = PW / 2, up = false; x > -PW / 2 + 0.1; up = !up) { x -= 12; zz += ` L${x} ${up ? PH : PH + Z}`; }
    zz += ' Z';
    const row = (y, a, b, o = {}) => group({ y, ch: [
      text({ text: a, x: -200, ax: 0, size: o.size || 24, weight: o.w || 400, color: o.c }),
      text({ text: b, x: 200, ax: 1, size: o.size || 24, weight: o.w || 500, color: o.c }),
    ] });
    const rule = (y) => path({ d: `M-200 ${y} H200`, stroke: 'dim', sw: 2, dash: [6, 8] });
    const BARS = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 3, 2, 1];
    let bx = -150;
    const barcode = BARS.map((w, i) => { const r = rect({ x: +(bx + w * 2).toFixed(1), y: 572, w: w * 4, h: 56, fill: i % 2 ? 'card' : 'ink' }); bx += w * 4 + 2; return r; });
    return [
      rect({ id: 'printer', y: -420, w: 680, h: 150, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        circle({ id: 'statusDot', x: -270, y: -30, d: 14, fill: 'ink', k: { opacity: [1, [0.8, 1.1, 0.25, 'Sine Smooth'], [1.1, 1.4, 1, 'Sine Smooth'], [1.7, 2.0, 0.25, 'Sine Smooth'], [2.0, 2.3, 1, 'Sine Smooth'], [2.6, 2.9, 0.25, 'Sine Smooth'], [2.9, 3.2, 1, 'Sine Smooth']] } }),
        text({ id: 'printing', text: 'Printing receipt…', x: -250, y: -30, ax: 0, size: 26, weight: 500, k: k(enter(0.3), exit(END)) }),
        text({ id: 'done', text: 'Done · tear to remove', x: -250, y: -30, ax: 0, size: 26, weight: 500, k: enter(END + 0.02) }),
        text({ id: 'orderNo', text: '#2041', x: 280, y: -30, ax: 1, size: 26, weight: 500, color: 'muted', k: enter(0.34) }),
        rect({ id: 'slotBed', y: 58, w: 600, h: 34, r: 17, fill: 'soft' }),
      ] }),
      rect({ id: 'paperClip', y: SLOT, pin: 't', chAt: 'pin', w: PW + 8, h: 0, clip: true, k: { h: feed }, ch: [
        path({ id: 'paper', d: zz, fill: 'card', stroke: 'line', sw: 2 }),
        text({ text: 'STUDIO CAFÉ', y: 40, size: 30, weight: 600, ls: 0.12 }),
        text({ text: '21 Harbour St · Lisbon', y: 76, size: 20, color: 'muted' }),
        text({ text: 'Order #2041 · Table 6 · 12:48', y: 104, size: 20, color: 'muted' }),
        rule(136),
        row(176, 'Flat white ×2', '$9.00'), row(216, 'Almond croissant', '$4.50'), row(256, 'Avocado toast', '$12.00'), row(296, 'Sparkling water', '$3.00'),
        rule(334),
        row(372, 'Subtotal', '$28.50', { c: 'muted' }), row(408, 'Tax 8%', '$2.28', { c: 'muted' }),
        row(456, 'Total', '$30.78', { size: 36, w: 600 }),
        ...barcode,
        text({ text: 'Thank you!', y: 640, size: 22, weight: 500 }),
      ] }),
      rect({ id: 'slot', y: SLOT, w: 560, h: 14, r: 7, fill: 'ink', k: popIn(0.1, { from: 0.7 }) }),
      group({ id: 'stamp', y: SLOT + 510, rot: -8, k: { scale: [1.6, [END + 0.1, END + 0.4, 1, 'Power4 Out']], opacity: [0, [END + 0.1, END + 0.2, 1, 'Linear']] }, ch: [
        rect({ w: 176, h: 64, r: 14, stroke: 'acc', sw: 5 }),
        text({ text: 'PAID', size: 36, weight: 600, ls: 0.14, color: 'acc' }),
      ] }),
    ];
  },
});

// 16 ─ Compose: the button grows into a mail window, the message fills in, the window folds into Send, which becomes a paper plane and flies off
UIK.define({
  id: 'email-compose', name: 'Compose email', cat: 'work', T: 5.3,
  cam: { zoom: 1.9, k: { zoom: [[0.85, 1.55, 1.25, 'Power2 Smooth'], [4.0, 4.7, 1.7, 'Power2 Smooth']], y: [[4.0, 4.7, 20, 'Power2 Smooth']] } },
  desc: 'Compose is clicked and the ink pill grows into a white mail window while the camera pulls back. A recipient chip pops into To, the subject types in, four body lines rise in. Send is clicked: the message blurs away and the window folds down onto the Send button, which rounds into an ink disc as its paper plane moves to the centre, then flies off up and to the right; the camera pushes in on a "Message sent" toast.',
  build: () => {
    const C0 = 0.8, G = C0 + 0.05, R1 = 1.45, S0 = 1.65, S1 = 2.15, B0 = 2.3, S = 3.25, K = S + 0.1, B = K + 0.34, FL0 = B + 0.3, FL1 = FL0 + 0.5, TS = FL1 - 0.1;
    const SX = -365, SY = 256, EZ = 'Power4 Out';
    const BODY = ['Hi Maya,', 'Here is the plan for the October launch.', 'Could you review the timeline by Friday?', 'Thanks, Ana'];
    const by = (i) => -6 + i * 46 + (i === 3 ? 20 : 0);
    return [
      rect({ id: 'window', w: 240, h: 84, r: 36, fill: 'ink', shadow: 2,
        k: k(popIn(0.1, { from: 0.6 }), press(C0, { to: 0.94 }), {
          w: [[G, G + 0.7, 960, EZ], [K, K + 0.46, 150, EZ]], h: [[G, G + 0.7, 640, EZ], [K, K + 0.46, 68, EZ]],
          x: [[K, K + 0.46, SX, EZ]], y: [[K, K + 0.46, SY, EZ]],
          fill: [[G, G + 0.3, 'card', 'Power2 Out']], opacity: [[K + 0.3, K + 0.42, 0, 'Linear']] }), ch: [
          group({ id: 'btnLbl', k: exit(C0 + 0.02), ch: [
            icon({ icon: 'pencil', x: -70, size: 30, sw: 2.4, color: 'inv' }),
            text({ text: 'Compose', x: -44, ax: 0, size: 32, weight: 600, color: 'inv' }),
          ] }),
          group({ id: 'mail', k: k(enter(G + 0.25, { d: 0 }), exit(S + 0.02, { dur: 0.1 })), ch: [
            text({ id: 'winTitle', text: 'New message', x: -440, y: -276, ax: 0, size: 28, weight: 600 }),
            ...['minus', 'maximize', 'x'].map((ic, i) => icon({ id: 'winIcon' + i, icon: ic, x: 364 + i * 40, y: -276, size: 24, sw: 2.4, color: 'muted' })),
            rect({ id: 'rule0', y: -236, w: 960, h: 2, fill: 'line' }),
            text({ id: 'toLbl', text: 'To', x: -440, y: -190, ax: 0, size: 26, color: 'muted' }),
            group({ id: 'recipient', x: -396, y: -190, k: pop(R1, { from: 0.5 }), ch: [
              rect({ id: 'recipBg', pin: 'l', chAt: 'pin', w: 232, h: 52, r: 26, fill: 'soft', ch: [
                avatar({ x: 26, d: 40, fill: 'dim', ini: 'MC', size: 15 }),
                text({ text: 'Maya Chen', x: 54, ax: 0, size: 24, weight: 600 }),
                icon({ icon: 'x', x: 206, size: 18, sw: 2.6, color: 'muted' }),
              ] }),
            ] }),
            rect({ id: 'rule1', y: -146, w: 900, h: 2, fill: 'line' }),
            text({ id: 'subjPh', text: 'Subject', x: -440, y: -104, ax: 0, size: 28, color: 'muted', k: exit(S0 - 0.02, { dur: 0.08, blur: 0 }) }),
            text({ id: 'subject', text: 'Q4 launch plan', x: -440, y: -104, ax: 0, size: 28, weight: 600, caret: true, caretColor: 'acc', caretFrom: S0 - 0.1, caretUntil: B0,
              k: { reveal: [0, [S0, S1, 1, 'Linear']] } }),
            rect({ id: 'rule2', y: -60, w: 900, h: 2, fill: 'line' }),
            ...BODY.map((s, i) => text({ id: 'body' + i, text: s, x: -440, y: by(i), ax: 0, size: 26, k: enter(B0 + i * 0.14, { dy: 12, y0: by(i) }) })),
            ...['link', 'image', 'file'].map((ic, i) => icon({ id: 'tool' + i, icon: ic, x: -236 + i * 52, y: SY, size: 28, sw: 2.2, color: 'muted' })),
            icon({ id: 'trash', icon: 'trash', x: 430, y: SY, size: 28, sw: 2.2, color: 'muted' }),
          ] }),
        ] }),
      // Send sits above the window: the window folds onto it, it rounds into a disc and flies off as a paper plane
      group({ id: 'send', x: SX, y: SY, k: k(enter(G + 0.3), press(S), {
          x: [[FL0, FL1, 40, 'Power2 In']], y: [[FL0, FL1, -110, 'Power2 In']], scale: [[FL0, FL1, 0.35, 'Power2 In']], opacity: [[FL1 - 0.14, FL1, 0, 'Linear']] }), ch: [
        rect({ id: 'sendBg', w: 150, h: 68, r: 48, fill: 'ink', k: { w: [[B, B + 0.36, 96, EZ]], h: [[B, B + 0.36, 96, EZ]] } }),
        text({ id: 'sendLbl', text: 'Send', x: -18, size: 28, weight: 600, color: 'inv', k: exit(B, { dur: 0.12 }) }),
        icon({ id: 'plane', icon: 'send', x: 40, size: 24, sw: 2, color: 'inv', k: { x: [[B, B + 0.36, 0, EZ]], scale: [[B, B + 0.36, 1.5, EZ]] } }),
      ] }),
      group({ id: 'toast', y: 20, k: k(enter(TS, { dy: 30, y0: 20, blur: 0 }), { scale: [0.9, [TS, TS + 0.45, 1, 'Power3 Out']] }), ch: [
        rect({ id: 'toastBg', w: 440, h: 84, r: 42, fill: 'ink', shadow: 2 }),
        circle({ id: 'toastCheck', x: -170, d: 40, fill: 'acc', k: pop(TS + 0.12, { from: 0.4 }), ch: [icon({ icon: 'check', size: 22, sw: 3.2, color: 'white' })] }),
        text({ text: 'Message sent', x: -136, ax: 0, size: 30, weight: 600, color: 'inv' }),
        text({ text: 'Undo', x: 180, ax: 1, size: 28, weight: 500, color: 'inv/55' }),
      ] }),
      cursorLayer([[0, 300, 200], [0.4, 300, 200], [C0 - 0.1, 30, 16], [C0 + 0.25, 30, 16], [C0 + 1.0, 560, 380], [S - 0.6, 560, 380], [S - 0.1, SX + 20, SY + 10], [S + 0.2, SX + 20, SY + 10], [S + 1.0, 250, 280]],
        [C0, S], [], { inAt: 0.35 }),
    ];
  },
});

// 17 ─ Search facets: ticking filters removes cards (the grid reflows), the result count rolls down, applied chips appear
UIK.define({
  id: 'search-facets', name: 'Search filters', cat: 'work', T: 4.3, cam: 1.1,
  desc: 'A media search with facet checkboxes and a grid of eight results. The cursor ticks Video: the non-video cards blur out, the rest glide into the free slots, the result count rolls from 128 to 42 and an accent "Video" chip pops. Ticking Under 1 min drops one more card, the grid closes up again and the count rolls to 18.',
  build: () => {
    const F = [1.3, 2.5], GX = [-150, 62, 274, 486], GY = [-20, 210], BX = -566, CY = -214;
    const slot = (s) => [GX[s % 4], GY[Math.floor(s / 4)]];
    const ITEMS = [
      { t: 'Harbor dusk', m: 'Photo', v: 1 }, { t: 'City timelapse', m: 'Video · 0:42', v: 3, vid: 1, short: 1 },
      { t: 'Portrait', m: 'Photo', v: 2 }, { t: 'Waves', m: 'Video · 2:15', v: 5, vid: 1 },
      { t: 'Ambience', m: 'Audio · 3:02', aud: 1 }, { t: 'Product spin', m: 'Video · 0:18', v: 6, vid: 1, short: 1 },
      { t: 'Desert arch', m: 'Photo', v: 8 }, { t: 'Plant care', m: 'Video · 0:55', v: 7, vid: 1, short: 1 },
    ];
    // slot of each item after each filter (null = filtered out)
    const S1 = ITEMS.map((it, i) => (it.vid ? ITEMS.slice(0, i).filter((o) => o.vid).length : null));
    const S2 = ITEMS.map((it, i) => (it.short ? ITEMS.slice(0, i).filter((o) => o.short).length : null));
    const card = (it, i) => {
      const [x0, y0] = slot(i), kk = { x: [], y: [] };
      let gone = null;
      [[S1[i], F[0]], [S2[i], F[1]]].forEach(([s, t], n) => {
        if (gone != null) return;
        if (s == null) { gone = t; return; }
        const [x, y] = slot(s), t0 = t + 0.14 + s * 0.04;
        kk.x.push([t0, t0 + 0.55, x, 'Power4 Out']); kk.y.push([t0, t0 + 0.55, y, 'Power4 Out']);
      });
      return group({ id: 'res' + i, x: x0, y: y0, k: k(enter(0.4 + i * 0.05, { dy: 16, y0 }), kk, gone != null ? exit(gone + 0.02, { dur: 0.2, s: 0.85 }) : null), ch: [
        it.aud
          ? rect({ id: 'resMedia' + i, y: -35, w: 196, h: 130, r: 18, fill: 'soft', ch: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((j) => rect({ x: -64 + j * 16, w: 8, h: [20, 42, 30, 58, 36, 50, 24, 40, 18][j], r: 4, fill: 'ink/40' })) })
          : photo({ id: 'resMedia' + i, y: -35, w: 196, h: 130, r: 18, v: it.v, ch: it.vid ? [circle({ x: -70, y: -38, d: 36, fill: 'shade/60', ch: [icon({ icon: 'play', size: 16, sw: 2.4, color: 'white', filled: true, fill: 'white' })] })] : [] }),
        text({ text: it.t, x: -98, y: 50, ax: 0, size: 22, weight: 600 }),
        text({ text: it.m, x: -98, y: 78, ax: 0, size: 18, color: 'muted' }),
      ] });
    };
    const facet = (id, y, label, count, on) => group({ id, y, ch: [
      rect({ id: id + 'Box', x: BX, w: 36, h: 36, r: 10, fill: 'card', stroke: 'dim', sw: 3, k: on != null ? press(on, { to: 0.85 }) : undefined }),
      ...(on != null ? [rect({ id: id + 'On', x: BX, w: 36, h: 36, r: 10, fill: 'ink', k: pop(on, { from: 0.5, dur: 0.36 }), ch: [
        path({ d: tickD(16), stroke: 'inv', sw: 4, trimmed: true, k: { trimE: [0, [on + 0.08, on + 0.32, 100, 'Power3 Out']] } })] })] : []),
      text({ text: label, x: BX + 32, ax: 0, size: 26, weight: 500 }),
      text({ text: count, x: -330, ax: 1, size: 22, color: 'muted' }),
    ] });
    const chip = (id, x, label, tw, t) => rect({ id, x, y: CY, pin: 'l', chAt: 'pin', w: tw + 70, h: 48, r: 24, fill: 'acc/12', k: pop(t, { from: 0.5 }), ch: [
      text({ text: label, x: 20, ax: 0, size: 24, weight: 500, color: 'acc' }),
      icon({ icon: 'x', x: tw + 44, size: 18, sw: 2.8, color: 'acc' }),
    ] });
    return [
      rect({ id: 'card', w: 1260, h: 720, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        text({ id: 'filtersTitle', text: 'Filters', x: -584, y: -290, ax: 0, size: 30, weight: 600, k: enter(0.22, { dx: -14, x0: -584 }) }),
        text({ id: 'typeLbl', text: 'TYPE', x: -584, y: -226, ax: 0, size: 18, weight: 600, ls: 0.08, color: 'muted', k: enter(0.28) }),
        ...[['Photo', '64'], ['Video', '42'], ['Audio', '22']].map(([l, c], i) => group({ id: 'typeRow' + i, k: enter(0.3 + i * 0.05, { dx: -12, s: 1 }), ch: [facet('type' + i, -180 + i * 52, l, c, i === 1 ? F[0] : null)] })),
        text({ id: 'durLbl', text: 'DURATION', x: -584, y: -6, ax: 0, size: 18, weight: 600, ls: 0.08, color: 'muted', k: enter(0.44) }),
        ...[['Under 1 min', '18'], ['1–5 min', '31'], ['Over 5 min', '9']].map(([l, c], i) => group({ id: 'durRow' + i, k: enter(0.46 + i * 0.05, { dx: -12, s: 1 }), ch: [facet('dur' + i, 40 + i * 52, l, c, i === 0 ? F[1] : null)] })),
        rect({ id: 'divider', x: -300, w: 2, h: 640, fill: 'line', k: fadeIn(0.3) }),
        text({ id: 'resultsTitle', text: 'Results', x: -250, y: -290, ax: 0, size: 30, weight: 600, k: enter(0.26, { dx: -14, x0: -250 }) }),
        rect({ id: 'countPill', x: -90, y: -290, w: 76, h: 44, r: 22, fill: 'soft', k: enter(0.32), ch: [
          roll({ id: 'count', w: 76, h: 44, vals: ['128', '42', '18'], ts: [F[0] + 0.18, F[1] + 0.18], size: 22, weight: 600 }),
        ] }),
        group({ id: 'sort', x: 584, y: -290, k: enter(0.34), ch: [
          text({ text: 'Most relevant', x: -30, ax: 1, size: 24, color: 'muted' }),
          icon({ icon: 'chevronDown', x: -8, size: 20, sw: 2.6, color: 'muted' }),
        ] }),
        text({ id: 'allMedia', text: 'Showing all media', x: -248, y: CY, ax: 0, size: 24, color: 'muted', k: k(enter(0.38), exit(F[0] + 0.02)) }),
        chip('chipVideo', -248, 'Video', 63.9, F[0] + 0.1),
        chip('chipShort', -248 + 63.9 + 70 + 12, 'Under 1 min', 135.8, F[1] + 0.1),
        ...ITEMS.map(card),
      ] }),
      cursorLayer([[0, 700, 380], [0.6, 700, 380], [F[0] - 0.1, BX + 6, -120], [F[0] + 0.2, BX + 6, -120], [F[1] - 0.1, BX + 6, 48], [F[1] + 0.2, BX + 6, 48], [F[1] + 0.85, 420, 400]], F, [], { inAt: 0.55 }),
    ];
  },
});

})();
