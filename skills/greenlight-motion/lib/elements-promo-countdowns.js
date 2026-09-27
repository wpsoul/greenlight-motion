/* UI Motion Kit — Promos & countdowns: countdowns (see SKILL.md). */
(function () {
'use strict';
const { rect, circle, text, path, icon, group, photo, k, enter, exit, pop, popIn, fadeIn, press, ring, cursorLayer } = UIK.h;

// ── local helpers ──
const f3 = (n) => +n.toFixed(3);
// keyed placeholder ticks: one Power4 Out step per time in `ts`, reaching 100 on the last
const ticks = (ts, dur = 0.45) => [0, ...ts.map((t, i) => [t, t + dur, f3((100 * (i + 1)) / ts.length), 'Power4 Out'])];
// avatar: a circle with initials, ringed in the card colour so overlapping ones separate
const avatar = (o) => circle({ id: o.id, x: o.x, y: o.y || 0, d: o.d, fill: o.fill, stroke: 'card', sw: 4, k: o.k,
  ch: [text({ id: o.id + 'Ini', text: o.ini, size: o.size || 17, weight: 600, color: o.color || 'ink' })] });

// 1 ─ Flash sale: unit boxes drop in on a cascade, the seconds tick with a roll, the claimed bar creeps up on every tick
UIK.define({
  id: 'countdown-flash-sale', name: 'Flash sale timer', cat: 'promo', T: 4.3, cam: 1.15,
  desc: 'A flash-sale banner pops in and its hours / minutes / seconds boxes drop in on a cascade. The seconds (a TIMER placeholder, Roll style, keyed) tick 59 → 56 with one Power4 Out roll per second, while the claimed bar fills to 72 % (a keyed COUNTER follows its width) and creeps up a percent on every tick.',
  build: () => {
    const TK = [1.3, 2.3, 3.3], BX = [236, 376, 516], BY = 4, BW = 108, BH = 124;
    const TX = -564, TW = 464, BARY = 84, TOP = 75;
    // the claimed label is a COUNTER 0–75 keyed by 'ph:2'; the bar's width follows the same keys
    const pc = (v) => f3(Math.min(100, ((v + 0.01) / TOP) * 100));
    const claimed = [72, 73, 74, 75];
    const fillW = [[0.62, 1.22, f3((TW * claimed[0]) / 100), 'Power3 Out'], ...TK.map((t, i) => [t, t + 0.35, f3((TW * claimed[i + 1]) / 100), 'Power3 Out'])];
    const phClaimed = [0, [0.62, 1.22, pc(claimed[0]), 'Power3 Out'], ...TK.map((t, i) => [t, t + 0.35, pc(claimed[i + 1]), 'Power3 Out'])];
    const UNITS = ['Hours', 'Minutes', 'Seconds'];
    return [
      rect({ id: 'banner', w: 1240, h: 300, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'tile', x: -512, y: -40, w: 104, h: 104, r: 28, fill: 'acc', k: pop(0.22, { from: 0.5 }), ch: [
          icon({ icon: 'zap', size: 52, sw: 3, color: 'white' }),
        ] }),
        text({ id: 'title', text: 'Flash sale', x: -432, y: -62, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.26, { dx: -16, x0: -432 }) }),
        text({ id: 'sub', text: 'Up to 40% off everything', x: -432, y: -16, ax: 0, size: 26, color: 'muted', k: enter(0.32) }),
        rect({ id: 'track', x: TX + TW / 2, y: BARY, w: TW, h: 12, r: 6, fill: 'skel', k: fadeIn(0.4), ch: [
          rect({ id: 'fill', x: -TW / 2, pin: 'l', w: 0, h: 12, r: 6, fill: 'ink', k: { w: fillW } }),
        ] }),
        text({ id: 'claimed', text: '{{{COUNTER:0-75; style=count; kf=2}}}% claimed', x: TX + TW + 24, y: BARY, ax: 0, size: 24, weight: 500,
          k: k(enter(0.46), { 'ph:2': phClaimed }) }),
        text({ id: 'endsIn', text: 'Ends in', x: BX[0] - BW / 2, y: BY - 94, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.36) }),
        ...BX.map((x, i) => group({ id: 'unit' + i, x, y: BY, k: enter(0.42 + i * 0.08, { dy: -26, y0: BY }), ch: [
          rect({ id: 'box' + i, w: BW, h: BH, r: 24, fill: 'ink' }),
          // hours and minutes hold for these few seconds; the seconds are ONE TIMER placeholder
          i < 2
            ? text({ id: 'digits' + i, text: i ? '14' : '02', size: 60, weight: 600, color: 'inv' })
            : text({ id: 'secs', text: '{{{TIMER:59-56; style=roll; kf=1}}}', size: 60, weight: 600, color: 'inv', k: { 'ph:1': ticks(TK) } }),
        ] })),
        ...[0, 1].map((i) => group({ id: 'colon' + i, x: (BX[i] + BX[i + 1]) / 2, y: BY, k: fadeIn(0.62 + i * 0.08), ch: [
          circle({ y: -14, d: 9, fill: 'muted' }), circle({ y: 14, d: 9, fill: 'muted' }),
        ] })),
        ...UNITS.map((s, i) => text({ id: 'unitLbl' + i, text: s, x: BX[i], y: BY + BH / 2 + 30, size: 20, weight: 500, color: 'muted', k: enter(0.52 + i * 0.08) })),
      ] }),
    ];
  },
});

// 2 ─ Launch: every column of the clock spins down to 00:00 on a cascade, the panel snaps into an accent CTA
UIK.define({
  id: 'countdown-launch', name: 'Launch countdown', cat: 'promo', T: 3.9, cam: 1.25,
  desc: 'A product-drop card behind a veil. The big clock (one TIMER placeholder, Odometer style) spins every column down from 02:45 to 00:00 — the left digits land first, the seconds take an extra turn. On landing the panel squeezes, the digits blur out and it morphs into an accent “Shop the drop” button while the chip turns to “Live now”, the veil lifts and the lock pops away.',
  build: () => {
    const R0 = 0.95, RD = 1.5, L = R0 + RD, M = L + 0.17, CX = -80;
    const PW = 600, PH = 200, PY = 96, PY1 = 60, BW = 330, BH = 100;
    return [
      rect({ id: 'card', w: 1120, h: 560, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        photo({ id: 'product', v: 6, x: -320, w: 400, h: 480, r: 32, k: enter(0.2, { blur: 0, s: 0.96 }), ch: [
          rect({ id: 'veil', w: 400, h: 480, fill: 'shade/40', k: { opacity: [[M, M + 0.45, 0, 'Power2 Out']] } }),
          circle({ id: 'lockDisc', d: 104, fill: 'card/90', k: k(enter(0.34, { blur: 0, s: 0.8 }), exit(M, { s: 0.6, dur: 0.2 })), ch: [
            icon({ id: 'lock', icon: 'lock', size: 44, sw: 2.6 }),
          ] }),
        ] }),
        rect({ id: 'chip', x: CX, y: -176, pin: 'l', chAt: 'pin', w: 148, h: 50, r: 25, fill: 'soft',
          k: k(enter(0.26, { blur: 0, s: 1 }), { fill: [[M, M + 0.3, 'ink', 'Power2 Out']], w: [[M, M + 0.5, 166, 'Power4 Out']] }), ch: [
            text({ id: 'chipSoon', text: 'New drop', x: 74, size: 22, weight: 600, k: exit(M - 0.02) }),
            group({ id: 'chipLive', k: enter(M + 0.06, { s: 1 }), ch: [
              circle({ id: 'liveDot', x: 30, d: 12, fill: 'acc', k: pop(M + 0.12) }),
              text({ text: 'Live now', x: 46, ax: 0, size: 22, weight: 600, color: 'inv' }),
            ] }),
          ] }),
        text({ id: 'title', text: 'Field Bottle 2.0', x: CX, y: -100, ax: 0, size: 52, weight: 600, ls: -0.02, k: enter(0.3, { dx: -16, x0: CX }) }),
        text({ id: 'whenSoon', text: 'Launching today at 10:00', x: CX, y: -52, ax: 0, size: 26, color: 'muted', k: k(enter(0.36), exit(M)) }),
        text({ id: 'whenLive', text: 'Available now · 250 made', x: CX, y: -52, ax: 0, size: 26, color: 'muted', k: enter(M + 0.04) }),
        rect({ id: 'panel', x: CX, y: PY, pin: 'l', origin: [0, 0], w: PW, h: PH, r: 32, fill: 'panel',
          k: k(enter(0.42, { blur: 0, s: 1 }), press(L + 0.06, { to: 0.97 }), {
            w: [[M + 0.1, M + 0.7, BW, 'Expo Out']], h: [[M + 0.1, M + 0.7, BH, 'Expo Out']], y: [[M + 0.1, M + 0.7, PY1, 'Expo Out']],
            r: [[M + 0.1, M + 0.5, BH / 2, 'Power3 Out']], fill: [[M + 0.1, M + 0.4, 'acc', 'Power2 Out']] }), ch: [
            text({ id: 'capIn', text: 'Launching in', y: -72, size: 22, weight: 500, color: 'muted', k: k(enter(0.5), exit(L + 0.08)) }),
            // ONE text: a TIMER placeholder in Odometer style — every column rolls on its own and lands left first
            text({ id: 'clock', text: `{{{TIMER:02:45-00:00; style=odometer; start=${R0}; duration=${RD}; easing=power3_out; turns=1; cascade=40}}}`,
              y: 30, size: 104, weight: 600, ls: -0.02, k: k(enter(0.52, { s: 0.94 }), exit(L + 0.1, { s: 0.9 })) }),
            group({ id: 'cta', k: enter(M + 0.26), ch: [
              text({ text: 'Shop the drop', x: -20, size: 30, weight: 600, color: 'white' }),
              icon({ icon: 'arrow', x: 107, size: 28, sw: 2.6, color: 'white' }),
            ] }),
          ] }),
        text({ id: 'ship', text: 'Free shipping · ships in 2 days', x: CX, y: PY1 + 92, ax: 0, size: 24, color: 'muted', k: enter(M + 0.36) }),
      ] }),
    ];
  },
});

// 3 ─ Webinar: a live clock keeps ticking while Add to calendar is clicked — you join the attendees, the count rolls on
UIK.define({
  id: 'countdown-webinar', name: 'Webinar starts in', cat: 'promo', T: 3.9, cam: 1.25,
  desc: 'A webinar card whose “Starts in” clock is a real-time TIMER placeholder (Count style — the seconds just tick). The cursor clicks Add to calendar: the button squeezes and shrinks from its right edge into “Added” with a check, an accent “You” avatar pops onto the attendee stack, the going count (a keyed COUNTER, Roll) rolls 1,284 → 1,285 and a reminder note slides in.',
  build: () => {
    const C = 1.55, BW0 = 364, BW1 = 214, RY = 116, XL = -484, XR = 484;
    const AV = [{ x: 313, fill: 'dim', ini: 'JL' }, { x: 271, fill: 'skel', ini: 'SO' }, { x: 229, fill: 'ink', ini: 'MC', color: 'inv' }];
    return [
      rect({ id: 'card', w: 1080, h: 560, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'chip', x: XL + 104, y: -206, w: 208, h: 52, r: 26, fill: 'soft', k: enter(0.22, { blur: 0, s: 0.9 }), ch: [
          icon({ icon: 'video', x: -72, size: 24, sw: 2.4 }),
          text({ text: 'Live webinar', x: -50, ax: 0, size: 22, weight: 600 }),
        ] }),
        // the stack: right to left, so each face overlaps the one to its right; yours lands on top
        ...AV.map((a, i) => avatar({ id: 'av' + i, x: a.x, y: -206, d: 52, fill: a.fill, ini: a.ini, color: a.color, k: enter(0.28 + i * 0.05, { blur: 0, s: 0.7 }) })),
        avatar({ id: 'avYou', x: 187, y: -206, d: 52, fill: 'acc', ini: 'You', size: 16, color: 'white', k: pop(C + 0.32, { from: 0.3 }) }),
        text({ id: 'going', text: '{{{COUNTER:1,284-1,285; style=roll; kf=2}}} going', x: XR, y: -206, ax: 1, size: 24, weight: 500, color: 'muted',
          k: k(enter(0.3), { 'ph:2': [0, [C + 0.4, C + 0.85, 100, 'Power4 Out']] }) }),
        text({ id: 'title', text: 'Design systems that scale', x: XL, y: -116, ax: 0, size: 50, weight: 600, ls: -0.02, k: enter(0.28, { dx: -16, x0: XL }) }),
        group({ id: 'meta', y: -64, k: enter(0.34), ch: [
          icon({ icon: 'calendar', x: XL + 13, size: 26, sw: 2.2, color: 'muted' }),
          text({ text: 'Thu, Oct 16 · 6:00 PM · 45 min', x: XL + 40, ax: 0, size: 26, color: 'muted' }),
        ] }),
        rect({ id: 'rule', y: -12, w: 968, h: 2, fill: 'line', k: fadeIn(0.38) }),
        text({ id: 'startsIn', text: 'Starts in', x: XL, y: 46, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.42) }),
        // ONE text: a real-time TIMER placeholder (Count style, its own span, linear) — no options needed
        text({ id: 'clock', text: '{{{TIMER:02:14:36-02:14:32}}}', x: XL, y: RY, ax: 0, size: 88, weight: 600, ls: -0.02, k: enter(0.46, { dy: 12, y0: RY }) }),
        rect({ id: 'calBtn', x: XR, y: RY, pin: 'r', chAt: 'pin', w: BW0, h: 96, r: 48, fill: 'ink',
          k: k(enter(0.5, { blur: 0, s: 1 }), press(C), { w: [[C + 0.05, C + 0.55, BW1, 'Power4 Out']] }), ch: [
            group({ id: 'addLbl', k: exit(C + 0.02), ch: [
              icon({ icon: 'calendar', x: -301, size: 26, sw: 2.4, color: 'inv' }),
              text({ text: 'Add to calendar', x: -276, ax: 0, size: 30, weight: 600, color: 'inv' }),
            ] }),
            group({ id: 'addedLbl', k: enter(C + 0.08, { d: 0.04 }), ch: [
              icon({ id: 'addedCheck', icon: 'check', x: -158, size: 28, sw: 3, color: 'inv', k: pop(C + 0.14) }),
              text({ text: 'Added', x: -134, ax: 0, size: 30, weight: 600, color: 'inv' }),
            ] }),
          ] }),
        group({ id: 'reminder', y: 212, k: enter(C + 0.62, { dy: 12, y0: 212 }), ch: [
          icon({ icon: 'bell', x: XR - 304 - 23, size: 24, sw: 2.2, color: 'muted' }),
          text({ text: 'We’ll remind you 10 min before', x: XR, ax: 1, size: 22, color: 'muted' }),
        ] }),
      ] }),
      cursorLayer([[0, 600, 360], [0.75, 600, 360], [C - 0.1, 352, RY + 10], [C + 0.3, 352, RY + 10], [C + 1.05, 590, 350]], [C], [], { inAt: 0.7 }),
    ];
  },
});

// 4 ─ Cart reservation: a ring drains with the clock, the last seconds turn red and nudge, +5 min rolls the minutes up
UIK.define({
  id: 'countdown-cart-reserve', name: 'Cart reservation', cat: 'promo', T: 4.1, cam: 1.3,
  desc: 'A bag whose items are reserved: the clock (a keyed TIMER placeholder) runs down from 00:08 while a ring drains in step with it. At 00:05 the timer, ring and banner turn red, the banner nudges and a +5 min chip pops; the cursor clicks it at 00:03 — only the minutes wheel rolls up to 05:03 (a second TIMER, Odometer), the ring refills and the banner calms back to ink.',
  build: () => {
    const T0 = 0.7, U = 1.9, X = 2.9, TX = 380, RX = -346, RR = 30, BY = -212;
    // the clock: 8 → 2.5 s shown between T0 and X (0.4 s per second, Linear) — it reads 00:05 at U and 00:03 at X
    const ph = [0, [T0, X, f3((5.5 / 8) * 100), 'Linear']];
    const shake = [[U + 0.02, U + 0.08, -10, 'Power2 Out'], [U + 0.08, U + 0.17, 8, 'Sine Smooth'], [U + 0.17, U + 0.26, -5, 'Sine Smooth'],
      [U + 0.26, U + 0.35, 2, 'Sine Smooth'], [U + 0.35, U + 0.44, 0, 'Sine Smooth']];
    const clock = (id, color, kk) => text({ id, text: '{{{TIMER:00:08-00:00; kf=1}}}', x: TX, ax: 1, size: 52, weight: 600, color, k: k({ 'ph:1': ph }, kk) });
    const ITEMS = [['Everyday Bottle', 'Stone · 750 ml', '$32.00', 6], ['Linen Planter', 'Sand · Medium', '$44.00', 7]];
    return [
      rect({ id: 'card', w: 900, h: 620, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, { from: 0.7 }), ch: [
        rect({ id: 'banner', y: BY, w: 820, h: 124, r: 28, fill: 'panel', k: k(enter(0.2, { blur: 0, s: 1 }), { x: [0, ...shake] }), ch: [
          rect({ id: 'tint', w: 820, h: 124, r: 28, fill: 'bad/10', k: { opacity: [0, [U, U + 0.25, 1, 'Power2 Out'], [X, X + 0.3, 0, 'Power2 Out']] } }),
          path({ id: 'ringTrack', x: RX, d: ring(RR), stroke: 'dim', sw: 6, k: fadeIn(0.26) }),
          path({ id: 'ring', x: RX, d: ring(RR), stroke: 'ink', sw: 6, trimmed: true,
            k: { trimE: [0, [0.3, T0, 80, 'Power3 Out'], [T0, X, 25, 'Linear'], [X + 0.05, X + 0.6, 100, 'Power4 Out']],
              stroke: [[U, U + 0.2, 'bad', 'Power2 Out'], [X, X + 0.25, 'ink', 'Power2 Out']] } }),
          icon({ id: 'clockIcon', icon: 'clock', x: RX, size: 30, sw: 2.4,
            k: k(fadeIn(0.3), { color: [[U, U + 0.2, 'bad', 'Power2 Out'], [X, X + 0.25, 'ink', 'Power2 Out']] }) }),
          text({ id: 'heading', text: 'Items reserved for', x: -294, y: -18, ax: 0, size: 26, weight: 500, k: enter(0.3) }),
          text({ id: 'capKeep', text: 'Complete checkout to keep them', x: -294, y: 18, ax: 0, size: 22, color: 'muted', k: k(enter(0.36), exit(U)) }),
          text({ id: 'capHurry', text: 'Hurry, almost out of time', x: -294, y: 18, ax: 0, size: 22, color: 'bad', k: k(enter(U + 0.02), exit(X)) }),
          text({ id: 'capDone', text: 'Extended by 5 minutes', x: -294, y: 18, ax: 0, size: 22, color: 'muted', k: enter(X + 0.04) }),
          rect({ id: 'extend', x: 150, w: 116, h: 52, r: 26, fill: 'ink', k: k(pop(U + 0.32, { from: 0.5 }), press(X)), ch: [
            text({ id: 'extendLbl', text: '+5 min', size: 22, weight: 600, color: 'inv', k: exit(X + 0.02) }),
            group({ id: 'extended', k: enter(X + 0.06, { d: 0.04 }), ch: [
              icon({ icon: 'check', x: -34, size: 22, sw: 3, color: 'inv', k: pop(X + 0.12) }),
              text({ text: 'Added', x: -20, ax: 0, size: 22, weight: 600, color: 'inv' }),
            ] }),
          ] }),
          // ONE clock, three copies that hand over while they show the same digits: ink → red (crossfade
          // at 00:05) → a second TIMER at 00:03 that rolls only its minutes wheel on to 05:03
          clock('clockInk', 'ink', k(enter(0.4), { opacity: [[U, U + 0.2, 0, 'Power2 Out']] })),
          clock('clockBad', 'bad', { opacity: [0, [U, U + 0.2, 1, 'Power2 Out'], [X, X + 0.2, 0, 'Power2 Out']] }),
          text({ id: 'clockNew', text: `{{{TIMER:00:03-05:03; style=odometer; start=${X + 0.1}; duration=0.6; easing=power4_out; turns=0}}}`, x: TX, ax: 1, size: 52, weight: 600,
            k: { opacity: [0, [X, X + 0.2, 1, 'Power2 Out']] } }),
        ] }),
        ...ITEMS.map(([n, v, p, pv], i) => group({ id: 'item' + i, y: -66 + i * 116, k: enter(0.34 + i * 0.08, { dx: -18, x0: 0 }), ch: [
          photo({ id: 'thumb' + i, v: pv, x: -362, w: 96, h: 96, r: 22 }),
          text({ text: n, x: -290, y: -18, ax: 0, size: 28, weight: 600 }),
          text({ text: v, x: -290, y: 18, ax: 0, size: 22, color: 'muted' }),
          text({ text: p, x: 410, y: -18, ax: 1, size: 28, weight: 600 }),
          text({ text: 'Qty 1', x: 410, y: 18, ax: 1, size: 22, color: 'muted' }),
        ] })),
        rect({ id: 'rule', y: 128, w: 820, h: 2, fill: 'line', k: fadeIn(0.5) }),
        rect({ id: 'checkout', y: 222, w: 820, h: 96, r: 48, fill: 'ink', k: enter(0.54, { blur: 0, s: 1 }), ch: [
          text({ text: 'Checkout · $76.00', size: 30, weight: 600, color: 'inv' }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 330], [U, 560, 330], [X - 0.1, 162, BY + 8], [X + 0.3, 162, BY + 8], [X + 1.0, 520, 300]], [X], [], { inAt: U - 0.1 }),
    ];
  },
});

// 5 ─ Go live: Go live is clicked, 3 · 2 · 1 punch in over the preview while a ring drains each beat, then the Live pill and a stopwatch
UIK.define({
  id: 'countdown-go-live', name: 'Go-live 3·2·1', cat: 'promo', T: 4.7, cam: 1.3,
  desc: 'A camera preview. The cursor clicks Go live: the preview dims and a disc counts 3 · 2 · 1 — ONE COUNTER placeholder stepped by a keyed track while each numeral punches in from 140 % and a white ring drains once per beat. On zero the disc blows out, the scrim lifts, an accent Live pill pops with a stopwatch (a TIMER counting up in real time) and the viewer count rolls up (Odometer).',
  build: () => {
    const C = 0.85, BT = 0.7, B = [1.1, 1.8, 2.5], LV = B[2] + BT, PW = 1000, PH = 620, TOPY = -PH / 2 + 36 + 25;
    const nScale = [1.4], nOpac = [0], nBlur = [8], sweep = [0];
    B.forEach((b, i) => {
      if (i) nScale.push([b, 1.4]), nBlur.push([b, 8]);
      nScale.push([b, b + 0.45, 1, 'Power4 Out']); nOpac.push([b, b + 0.16, 1, 'Power2 Out']); nBlur.push([b, b + 0.2, 0, 'Power2 Out']);
      if (i < 2) nScale.push([b + BT - 0.16, b + BT - 0.02, 0.86, 'Power2 In']), nOpac.push([b + BT - 0.16, b + BT - 0.02, 0, 'Power2 In']);
      sweep.push([b, 100], [b, b + BT, 0, 'Linear']);
    });
    return [
      photo({ id: 'preview', v: 1, w: PW, h: PH, r: 40, shadow: 1, k: popIn(0.1, { from: 0.7 }) }),
      // under the scrim: it dims with the preview as it leaves
      rect({ id: 'goLive', y: PH / 2 - 36 - 40, w: 210, h: 80, r: 40, fill: 'card', k: k(enter(0.28, { dy: 16, y0: PH / 2 - 76 }), press(C), exit(C + 0.3, { s: 0.9 })), ch: [
        circle({ id: 'recDot', x: -50, d: 16, fill: 'acc' }),
        text({ text: 'Go live', x: -32, ax: 0, size: 28, weight: 600 }),
      ] }),
      rect({ id: 'scrim', w: PW, h: PH, r: 40, fill: 'shade/45', k: { opacity: [0, [C + 0.05, C + 0.35, 1, 'Power2 Out'], [LV, LV + 0.4, 0, 'Power2 Out']] } }),
      rect({ id: 'previewChip', x: -PW / 2 + 36 + 70, y: TOPY, w: 140, h: 50, r: 25, fill: 'card/90', k: k(enter(0.3, { blur: 0, s: 0.9 }), exit(LV)), ch: [
        text({ text: 'Preview', size: 22, weight: 600 }),
      ] }),
      text({ id: 'goingIn', text: 'Going live in', y: -196, size: 30, weight: 500, color: 'white', k: k(enter(C + 0.12), exit(LV)) }),
      circle({ id: 'disc', y: 20, d: 300, fill: 'shade/50', k: k(pop(C + 0.12, { from: 0.6 }), exit(LV, { s: 1.15, dur: 0.24 })), ch: [
        path({ id: 'beatTrack', d: ring(126), stroke: 'white/25', sw: 8 }),
        path({ id: 'beatRing', d: ring(126), stroke: 'white', sw: 8, trimmed: true, k: { trimE: sweep } }),
        // ONE text: a COUNTER placeholder stepped 3 → 2 → 1 by its keyed track, while the layer is faded out
        text({ id: 'numeral', text: '{{{COUNTER:3-1; style=count; kf=1}}}', size: 150, weight: 600, color: 'white',
          k: { 'ph:1': [0, [B[1], 50], [B[2], 100]], scale: nScale, opacity: nOpac, blur: nBlur } }),
      ] }),
      rect({ id: 'livePill', x: -PW / 2 + 36 + 45, y: TOPY, w: 90, h: 50, r: 25, fill: 'acc', k: pop(LV + 0.05, { from: 0.4 }), ch: [
        text({ text: 'Live', size: 22, weight: 600, color: 'white' }),
      ] }),
      rect({ id: 'elapsed', x: -PW / 2 + 36 + 90 + 10 + 50, y: TOPY, w: 100, h: 50, r: 25, fill: 'shade/55', k: enter(LV + 0.14, { dx: -14, x0: -PW / 2 + 36 + 90 + 10 + 50, blur: 0 }), ch: [
        // a stopwatch: a TIMER counting up in real time from the moment the stream goes live
        text({ id: 'stopwatch', text: `{{{TIMER:00:00-59:59; start=${f3(LV + 0.1)}}}}`, size: 22, weight: 600, color: 'white' }),
      ] }),
      rect({ id: 'viewers', x: PW / 2 - 36 - 56, y: TOPY, w: 112, h: 50, r: 25, fill: 'shade/55', k: enter(LV + 0.22, { dx: 14, x0: PW / 2 - 92, blur: 0 }), ch: [
        icon({ icon: 'eye', x: -28, size: 24, sw: 2.2, color: 'white' }),
        text({ id: 'viewerCount', text: `{{{COUNTER:0-128; start=${f3(LV + 0.35)}; duration=1.1; turns=1}}}`, x: -10, ax: 0, size: 22, weight: 600, color: 'white' }),
      ] }),
      cursorLayer([[0, 560, 350], [0.3, 560, 350], [C - 0.1, 40, PH / 2 - 66], [C + 0.25, 40, PH / 2 - 66], [C + 0.95, 560, 350]], [C], [], { inAt: 0.25 }),
    ];
  },
});
})();
