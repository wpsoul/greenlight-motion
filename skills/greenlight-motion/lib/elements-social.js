/* UI Motion Kit — social elements. */
(function () {
const { rect, circle, ellipse, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers (plain functions that return ordinary layers / tracks) ──
// the main shape's entrance: pops from `from` with a 10 % settle
const popIn = (t = 0.1, from = 0.65) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// fade-only entry (tracks, rows that should not scale or blur in)
const fadeIn = (t) => enter(t, { blur: 0, s: 1 });
// a closed circle for Trim Paths, starting at 12 o'clock and running clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// deterministic 0…1 noise (waveforms) — frames stay a pure function of t
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
// an icon that reacts in place: a quick scale-up that settles (no opacity change)
const bump = (t, to = 1.22) => ({ scale: [[t, t + 0.1, to, 'Power2 Out'], [t + 0.1, t + 0.45, 1, 'Power3 Out']] });
// the moment an eased move a → b over [t0, t1] passes v (hover hand-offs that follow the cursor)
const cross = (t0, t1, a, b, v, e = 'Power2 Smooth') => {
  const f = UIK.ease(e); let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2, x = a + (b - a) * f(m); if ((b - a) * (v - x) > 0) lo = m; else hi = m; }
  return +(t0 + (t1 - t0) * hi).toFixed(3);
};
// avatar: a circle with initials (text colour follows the fill)
const avatar = (o) => circle({ id: o.id, x: o.x || 0, y: o.y || 0, d: o.d, fill: o.fill || 'soft', stroke: o.stroke, sw: o.sw, k: o.k,
  ch: [text({ id: o.id && o.id + 'Ini', text: o.ini, size: o.size || Math.round(o.d * 0.34), weight: 600, ls: -0.01,
    color: o.color || ({ ink: 'inv', acc: '#FFFFFF' }[o.fill] || 'ink') })].concat(o.ch || []) });
// slot roll: a clipped window whose column of values rolls up one slot at each time in `ts`
const roll = (o) => rect({ id: o.id, x: o.x || 0, y: o.y || 0, w: o.w, h: o.h, clip: true, ch: [
  group({ id: o.id + 'Col', k: { y: o.ts.map((t, i) => [t, t + (o.dur || 0.45), -o.h * (i + 1), 'Power3 Out']) },
    ch: o.vals.map((s, i) => text({ text: s, y: i * o.h, size: o.size, weight: o.weight || 600, color: o.color || 'ink', tnum: false })) }),
] });
// Lucide glyphs K.ICONS lacks, drawn as a path from their 24-unit box. The group sits on the glyph centre so pops and
// rotations pivot there; `sw` is the on-screen stroke, same convention as icon().
const GLYPH = {
  phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
  hand: ['M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2', 'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2', 'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8',
    'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.83L7 15'],
  archive: ['M3 3h18a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z', 'M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8', 'M10 12h4'],
  share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'm16 6-4-4-4 4', 'M12 2v13'],
};
const glyph = (o) => group({ id: o.id, x: o.x || 0, y: o.y || 0, k: o.k, ch: [
  path({ id: o.id && o.id + 'Path', d: GLYPH[o.g], x: -o.size / 2, y: -o.size / 2, scale: o.size / 24, stroke: o.color || 'ink', sw: (o.sw ?? 2.4) * 24 / o.size }),
] });

// 1 ─ Post engagement: the post builds in, then likes, comments and shares tick up in turn with icon pops
UIK.define({
  id: 'post-card', name: 'Post engagement', cat: 'social', T: 3.8, cam: 1.25,
  desc: 'A post settles in block by block, then the like, comment and share counters tick up in turn; each icon gives a small pop as its number climbs, and the heart fills with the accent.',
  build: () => {
    const L1 = 1.15, C1 = 1.7, S1 = 2.25, L2 = 2.85, FY = 222;
    const tick = (a, v, dur = 0.8) => [a + 0.04, a + dur, v, 'Power3 Out'];
    const count = (id, x, value, t, segs) => text({ id, x, y: FY, ax: 0, size: 30, weight: 600, num: {}, value, k: k(enter(t), { value: segs }) });
    return [
      rect({ id: 'card', w: 940, h: 580, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        avatar({ id: 'avatar', x: -392, y: -222, d: 76, fill: 'ink', ini: 'NB', size: 28, k: pop(0.2, { from: 0.6 }) }),
        text({ id: 'name', text: 'Nora Blake', x: -340, y: -238, ax: 0, size: 32, weight: 600, ls: -0.01, k: enter(0.24, { dx: -14, x0: -340 }) }),
        text({ id: 'meta', text: '2h · Lisbon', x: -340, y: -202, ax: 0, size: 24, color: 'muted', k: enter(0.3) }),
        ...[0, 1, 2].map((i) => circle({ id: 'more' + i, x: 386 + i * 14, y: -222, d: 8, fill: 'muted', k: fadeIn(0.32 + i * 0.03) })),
        text({ id: 'line0', text: 'Golden hour over the river tonight.', x: -430, y: -146, ax: 0, size: 30, k: enter(0.34, { dx: -12, x0: -430 }) }),
        text({ id: 'line1', text: 'Shot on the walk home from the studio.', x: -430, y: -104, ax: 0, size: 30, k: enter(0.4, { dx: -12, x0: -430 }) }),
        rect({ id: 'image', y: 44, w: 860, h: 220, r: 24, fill: 'panel', clip: true, k: enter(0.44, { blur: 12, s: 0.98 }), ch: [
          circle({ id: 'sun', x: 250, y: -38, d: 56, fill: 'dim', k: pop(0.72, { from: 0.4 }) }),
          group({ id: 'hills', k: { y: [40, [0.5, 1.2, 0, 'Power3 Out']] }, ch: [
            path({ id: 'ridge', d: 'M-430 112 L-430 30 L-300 -20 L-190 40 L-40 -50 L110 30 L230 -10 L430 70 L430 112 Z', fill: 'skel' }),
            path({ id: 'hillL', d: 'M-430 112 L-430 60 L-280 10 L-110 112 Z', fill: 'dim' }),
            path({ id: 'hillR', d: 'M-60 112 L150 20 L300 70 L430 30 L430 112 Z', fill: 'dim' }),
          ] }),
        ] }),
        group({ id: 'likeIcon', x: -398, y: FY, k: k(fadeIn(0.52), bump(L2, 1.2)), ch: [
          icon({ id: 'heartLine', icon: 'heart', size: 40, sw: 2.6, k: { scale: [[L1, L1 + 0.12, 0.6, 'Power2 In']], opacity: [[L1, L1 + 0.12, 0, 'Linear']] } }),
          icon({ id: 'heartFill', icon: 'heart', size: 40, sw: 2.6, color: 'acc', filled: true, fill: 'acc', k: pop(L1 + 0.04, { from: 0.4 }) }),
        ] }),
        count('likes', -366, 1204, 0.54, [tick(L1, 1236), tick(L2, 1248, 0.6)]),
        icon({ id: 'commentIcon', icon: 'message', x: -218, y: FY, size: 38, sw: 2.6, k: k(fadeIn(0.58), bump(C1)) }),
        count('comments', -186, 86, 0.6, [tick(C1, 92)]),
        icon({ id: 'shareIcon', icon: 'send', x: -86, y: FY, size: 38, sw: 2.6,
          k: k(fadeIn(0.64), bump(S1), { x: [[S1, S1 + 0.1, -80, 'Power2 Out'], [S1 + 0.1, S1 + 0.45, -86, 'Power3 Out']],
                                         y: [[S1, S1 + 0.1, FY - 6, 'Power2 Out'], [S1 + 0.1, S1 + 0.45, FY, 'Power3 Out']] }) }),
        count('shares', -54, 31, 0.66, [tick(S1, 36)]),
        icon({ id: 'saveIcon', icon: 'bookmark', x: 408, y: FY, size: 38, sw: 2.6, k: fadeIn(0.7) }),
      ] }),
    ];
  },
});

// 2 ─ Story rings: a tap starts playback, each ring un-draws as its segment of the bar fills
UIK.define({
  id: 'story-rings', name: 'Story rings', cat: 'social', T: 4.7, cam: 1.2,
  desc: 'A tap starts the stories: the active avatar grows, its accent ring un-draws (Trim Paths) as it is watched and is left dim, while the matching segment of the bar above fills; then the next one takes over.',
  build: () => {
    const X = [-400, -200, 0, 200, 400], AY = 36, R = 76, C = 0.85, S0 = 0.95, STEP = 0.66, DUR = 0.6;
    const ST = X.map((_, i) => +(S0 + i * STEP).toFixed(3)), END = ST[4] + DUR;
    const SEGW = (1000 - 48) / 5, BY = -166;
    const P = [['AK', 'ink', 'Ava'], ['MR', 'soft', 'Milo'], ['JS', 'dim', 'June'], ['LT', 'soft', 'Theo'], ['NB', 'ink', 'Nia']];
    return [
      rect({ id: 'card', w: 1120, h: 440, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        ...X.map((_, i) => rect({ id: 'seg' + i, x: -500 + SEGW / 2 + i * (SEGW + 12), y: BY, w: SEGW, h: 8, r: 4, fill: 'dim', clip: true, k: fadeIn(0.22 + i * 0.04), ch: [
          rect({ id: 'segFill' + i, x: -SEGW / 2, pin: 'l', w: 0, h: 8, fill: 'ink', k: { w: [[ST[i], ST[i] + DUR, SEGW, 'Linear']] } }),
        ] })),
        text({ id: 'title', text: 'Stories', x: -500, y: -104, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.26, { dx: -14, x0: -500 }) }),
        text({ id: 'newCount', x: 500, y: -104, ax: 1, size: 26, color: 'muted', num: { suf: ' new' }, value: 5,
          k: k(enter(0.32), { value: ST.slice(0, 4).map((s, i) => [s + DUR, 4 - i]) }, exit(END)) }),
        text({ id: 'caughtUp', text: 'All caught up', x: 500, y: -104, ax: 1, size: 26, weight: 500, k: enter(END) }),
        ...X.map((x, i) => {
          const s = ST[i], e = s + DUR;
          const sc = i === 0 ? [[C - 0.07, C, 0.93, 'Power2 Out'], [C + 0.02, C + 0.4, 1.07, 'Power3 Out']] : [[s, s + 0.35, 1.07, 'Power3 Out']];
          sc.push([e, e + 0.35, 1, 'Power3 Out']);
          return group({ id: 'story' + i, x, y: AY, k: k(enter(0.3 + i * 0.06, { dy: 16, y0: AY }), { scale: sc }), ch: [
            path({ id: 'track' + i, d: ring(R), stroke: 'dim', sw: 6 }),
            path({ id: 'arc' + i, d: ring(R), stroke: 'acc', sw: 6, trimmed: true, k: { trimS: [[s, e, 100, 'Linear']] } }),
            avatar({ id: 'av' + i, d: 128, fill: P[i][1], ini: P[i][0], size: 40 }),
          ] });
        }),
        ...X.map((x, i) => text({ id: 'name' + i, text: P[i][2], x, y: 162, size: 24, weight: 500, color: 'muted',
          k: k(enter(0.36 + i * 0.06), { color: [[ST[i], ST[i] + 0.2, 'ink', 'Power2 Out'], [ST[i] + DUR, ST[i] + DUR + 0.2, 'muted', 'Power2 Out']] }) })),
      ] }),
      cursorLayer([[0, 560, 330], [0.3, 560, 330], [0.76, -392, 64], [1.0, -392, 64], [1.55, -310, 310]], [C], [], { inAt: 0.25 }),
    ];
  },
});

// 3 ─ Comment reply: Reply opens an indented field on a growing thread line; the sent reply morphs into a comment
UIK.define({
  id: 'comment-reply', name: 'Comment reply', cat: 'social', T: 4.4,
  cam: { zoom: 1.3, y: -132, k: { y: [[1.2, 1.9, -70, 'Power2 Smooth'], [2.9, 3.6, -32, 'Power2 Smooth']] } },
  desc: 'The cursor clicks Reply: a thread line grows down from the avatar and an indented field stretches open. A reply types in; on Send the pill morphs into a comment bubble, the name drops in above the text and the reply count rolls to 3.',
  build: () => {
    const C1 = 1.1, O = 1.2, TY0 = 1.95, TY1 = 2.6, S = 2.8, M = 2.9, TOP = -250;
    const FX = -318, FY = 36, FW = 778, FH = 76, BW = 388, BH = 110;
    return [
      rect({ id: 'card', y: TOP, pin: 't', w: 1000, h: 225, r: 40, fill: 'card', shadow: 1,
        k: k(popIn(0.1, 0.7), { h: [[O, O + 0.55, 364, 'Power4 Out'], [M, M + 0.6, 437, 'Expo Out']] }) }),
      group({ id: 'parent', ch: [
        avatar({ id: 'pAvatar', x: -424, y: -178, d: 72, fill: 'soft', ini: 'PN', size: 26, k: pop(0.2, { from: 0.6 }) }),
        rect({ id: 'pBubble', x: -376, y: -214, pin: 'tl', w: 650, h: 110, r: 28, fill: 'soft', k: enter(0.24, { blur: 0, dx: -12, x0: -376 }) }),
        text({ id: 'pName', text: 'Priya Nair', x: -348, y: -182, ax: 0, size: 28, weight: 600, k: enter(0.3) }),
        text({ id: 'pText', text: 'The pacing in the second act is so much better.', x: -348, y: -142, ax: 0, size: 28, k: enter(0.36) }),
        text({ id: 'pTime', text: '3h', x: -348, y: -72, ax: 0, size: 22, color: 'muted', k: enter(0.44) }),
        text({ id: 'pLike', text: 'Like', x: -306, y: -72, ax: 0, size: 22, weight: 600, color: 'muted', k: enter(0.47) }),
        text({ id: 'pReply', text: 'Reply', x: -246, y: -72, ax: 0, size: 22, weight: 600, color: 'muted',
          k: k(enter(0.5), press(C1, { to: 0.9 }), { color: [[C1, C1 + 0.15, 'ink', 'Power2 Out'], [M, M + 0.3, 'muted', 'Power2 Out']] }) }),
        group({ id: 'replyCount', k: enter(0.54), ch: [
          roll({ id: 'countDigit', x: 373, y: -72, w: 16, h: 30, vals: ['2', '3'], ts: [M + 0.35], size: 22, weight: 400, color: 'muted' }),
          text({ id: 'countLbl', text: 'replies', x: 452, y: -72, ax: 1, size: 22, color: 'muted' }),
        ] }),
      ] }),
      path({ id: 'thread', x: -424, y: -134, d: 'M0 0 V146 Q0 170 24 170', stroke: 'dim', sw: 3, trimmed: true, k: { trimE: [0, [O + 0.08, O + 0.55, 100, 'Power3 Out']] } }),
      avatar({ id: 'meAvatar', x: -356, y: FY, d: 52, fill: 'ink', ini: 'AR', size: 19, k: pop(O + 0.3, { from: 0.5 }) }),
      rect({ id: 'field', x: FX, y: FY - FH / 2, pin: 'tl', w: FH, h: FH, r: 38, fill: 'soft',
        k: { opacity: [0, [O + 0.22, O + 0.34, 1, 'Linear']], w: [[O + 0.25, O + 0.8, FW, 'Expo Out'], [M, M + 0.6, BW, 'Expo Out']],
             h: [[M, M + 0.6, BH, 'Expo Out']], r: [[M, M + 0.4, 28, 'Power3 Out']] } }),
      text({ id: 'placeholder', text: 'Write a reply…', x: -290, y: FY, ax: 0, size: 28, color: 'muted', k: k(enter(O + 0.3), exit(TY0 - 0.02, { dur: 0.08 })) }),
      text({ id: 'typed', text: 'Yes — tightened it by 12 s.', x: -290, y: FY, ax: 0, size: 28, caret: true, caretColor: 'ink', caretFrom: O + 0.45, caretUntil: S,
        k: { reveal: [0, [TY0, TY1, 1, 'Linear']], y: [[M, M + 0.6, FY + 34, 'Expo Out']] } }),
      text({ id: 'meName', text: 'You', x: -290, y: FY - 6, ax: 0, size: 26, weight: 600, k: enter(M + 0.2, { dy: -10, y0: FY - 6 }) }),
      circle({ id: 'send', x: 420, y: FY, d: 56, fill: 'ink',
        k: { opacity: [0, [O + 0.55, O + 0.7, 0.3, 'Power2 Out'], [TY0, TY0 + 0.2, 1, 'Power2 Out'], [M - 0.02, M + 0.12, 0, 'Power2 In']],
             scale: [[S - 0.07, S, 0.86, 'Power2 Out'], [M - 0.02, M + 0.14, 0.5, 'Power2 In']] },
        ch: [icon({ icon: 'arrowUp', size: 26, color: 'inv', sw: 2.8 })] }),
      group({ id: 'meActions', k: enter(M + 0.36, { dy: -8, y0: 0 }), ch: [
        text({ text: 'now', x: -290, y: 142, ax: 0, size: 22, color: 'muted' }),
        text({ text: 'Like', x: -236, y: 142, ax: 0, size: 22, weight: 600, color: 'muted' }),
        text({ text: 'Reply', x: -176, y: 142, ax: 0, size: 22, weight: 600, color: 'muted' }),
      ] }),
      cursorLayer([[0, 600, 200], [0.5, 600, 200], [1.02, -214, -64], [1.3, -214, -64], [1.75, 160, 170], [2.45, 160, 170], [2.7, 426, 44], [3.0, 426, 44], [3.6, 560, 240]],
        [C1, S], [], { inAt: 0.45 }),
    ];
  },
});

// 4 ─ Reactions: press-and-hold Like, a pill of reactions pops, the cursor scrubs across and drops one on the button
UIK.define({
  id: 'reactions-bar', name: 'Reactions', cat: 'social', T: 3.8, cam: 1.3,
  desc: 'A press-and-hold on Like pops a pill of five reactions on a stagger. The cursor slides across them (each one scales up and lifts under it, with its name above), releases on Celebrate, and the reaction flies down onto the button, which widens for the new label.',
  build: () => {
    const H = 0.95, P = 1.2, R = 2.62, LAND = R + 0.48, BL = -410, BY = 208, TY = 88;
    const TX = [-352, -252, -152, -52, 48], IC = ['heart', 'star', 'sparkle', 'zap', 'sun'];
    const GX = -352, GY = 146;   // the reactions group sits by the button, so its exit shrinks toward it
    // hover windows follow the cursor: in when it gets close, out when it passes the midpoint to the next one
    const m01 = cross(1.72, 1.98, -352, -252, -302), m12 = cross(1.98, 2.26, -252, -152, -202);
    const HV = [[1.58, m01 - 0.02], [m01, m12 - 0.02], [m12, null]];
    const TIP = [['Love', 76], ['Great', 84], ['Celebrate', 128]];
    const tile = (i) => {
      const hv = HV[i], lift = hv ? { scale: [[hv[0], hv[0] + 0.18, 1.3, 'Power3 Out']], y: [[hv[0], hv[0] + 0.18, -18, 'Power3 Out']] } : null;
      if (hv && hv[1]) { lift.scale.push([hv[1], hv[1] + 0.2, 1, 'Power3 Out']); lift.y.push([hv[1], hv[1] + 0.2, 0, 'Power3 Out']); }
      return group({ id: 'tile' + i, x: TX[i] - GX, y: TY - GY, k: pop(P + 0.06 + i * 0.05, { from: 0.3, dur: 0.38 }), ch: [
        group({ id: 'tileHover' + i, k: lift, ch: [
          circle({ id: 'tileBg' + i, d: 88, fill: 'soft' }),
          icon({ id: 'tileIcon' + i, icon: IC[i], size: 44, sw: 2.4, k: i === 2 ? { opacity: [[R, 0]] } : null }),
        ] }),
      ] });
    };
    const tip = (i) => {
      const hv = HV[i], [s, w] = TIP[i];
      return rect({ id: 'tip' + i, x: TX[i] - GX, y: TY - 18 - 57 - 32 - GY, w, h: 40, r: 20, fill: 'ink',
        k: k(pop(hv[0] + 0.04, { from: 0.6, dur: 0.32 }), hv[1] ? exit(hv[1], { dur: 0.12, blur: 4 }) : null),
        ch: [text({ text: s, size: 22, weight: 600, color: 'inv' })] });
    };
    return [
      rect({ id: 'card', w: 900, h: 580, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        avatar({ id: 'avatar', x: -374, y: -216, d: 72, fill: 'soft', ini: 'KT', size: 26, k: pop(0.2, { from: 0.6 }) }),
        text({ id: 'name', text: 'Kai Turner', x: -322, y: -232, ax: 0, size: 30, weight: 600, k: enter(0.24, { dx: -14, x0: -322 }) }),
        text({ id: 'meta', text: 'Shared a video · 1h', x: -322, y: -196, ax: 0, size: 24, color: 'muted', k: enter(0.3) }),
        text({ id: 'body', text: 'Rough cut of the launch film is up — thoughts?', x: -410, y: -134, ax: 0, size: 30, k: enter(0.36, { dx: -12, x0: -410 }) }),
        rect({ id: 'media', y: 10, w: 820, h: 200, r: 24, fill: 'panel', k: enter(0.42, { blur: 10, s: 0.98 }), ch: [
          circle({ id: 'playDisc', x: 300, d: 76, fill: 'card', shadow: 3, k: pop(0.6, { from: 0.5 }), ch: [icon({ icon: 'play', x: 3, size: 30, sw: 2.4, filled: true, fill: 'ink' })] }),
          text({ id: 'dur', text: '0:48', x: 370, y: 70, ax: 1, size: 22, weight: 500, color: 'muted', k: enter(0.62) }),
        ] }),
        icon({ id: 'commentIcon', icon: 'message', x: 318, y: BY, size: 34, sw: 2.6, k: fadeIn(0.54) }),
        icon({ id: 'sendIcon', icon: 'send', x: 394, y: BY, size: 34, sw: 2.6, k: fadeIn(0.58) }),
      ] }),
      rect({ id: 'likeBtn', x: BL, y: BY, pin: 'l', chAt: 'pin', origin: [0, 0], w: 172, h: 84, r: 42, fill: 'soft',
        k: k(fadeIn(0.5), { w: [[LAND, LAND + 0.55, 250, 'Power4 Out']],
          scale: [[H - 0.07, H, 0.95, 'Power2 Out'], [R, R + 0.3, 1, 'Back Out'], [LAND - 0.02, LAND + 0.06, 0.95, 'Power2 Out'], [LAND + 0.06, LAND + 0.4, 1, 'Back Out']] }), ch: [
          icon({ id: 'heartLine', icon: 'heart', x: 44, size: 34, sw: 2.6, k: exit(LAND - 0.06, { s: 0.5, dur: 0.1 }) }),
          text({ id: 'likeLbl', text: 'Like', x: 76, ax: 0, size: 30, weight: 600, k: exit(LAND - 0.04) }),
          text({ id: 'celebrateLbl', text: 'Celebrate', x: 76, ax: 0, size: 30, weight: 600, color: 'acc', k: enter(LAND + 0.04, { dx: -10, x0: 76 }) }),
        ] }),
      group({ id: 'reactions', x: GX, y: GY, k: { opacity: [[R + 0.08, R + 0.26, 0, 'Power2 In']], scale: [[R + 0.08, R + 0.26, 0.9, 'Power2 In']], blur: [[R + 0.08, R + 0.26, 6, 'Power2 In']] }, ch: [
        rect({ id: 'pill', x: -152 - GX, y: TY - GY, w: 516, h: 116, r: 58, fill: 'card', shadow: 2, origin: [-0.4, 0.5],
          k: { scale: [0.5, [P, P + 0.45, 1, 'Back Out']], opacity: [0, [P, P + 0.12, 1, 'Linear']] } }),
        ...TX.map((_, i) => tile(i)),
        ...[0, 1, 2].map(tip),
      ] }),
      // the chosen reaction: takes over from the hovered tile's icon at release and flies onto the button
      icon({ id: 'flyer', icon: 'sparkle', x: TX[2], y: TY - 18, size: 44, sw: 2.4, color: 'acc', filled: true, fill: 'acc',
        k: { opacity: [0, [R, 1]], scale: [1.3, [R, R + 0.1, 1.45, 'Power2 Out'], [R + 0.1, LAND, 0.77, 'Power2 Smooth']],
             x: [[R + 0.06, LAND, BL + 44, 'Power2 Smooth']], y: [[R + 0.02, R + 0.18, TY - 34, 'Power2 Out'], [R + 0.18, LAND, BY, 'Power2 In']] } }),
      cursorLayer([[0, 600, 340], [0.3, 600, 340], [0.85, -350, 222], [1.4, -350, 222], [1.72, -352, TY - 4], [1.98, -252, TY - 4], [2.26, -152, TY - 4],
        [2.95, -152, TY - 4], [3.5, -40, 320]], [], [[H, R]], { inAt: 0.25 }),
    ];
  },
});

// 5 ─ Mention picker: "@ma" filters the people popup, the highlight glides, Enter turns the query into a chip
UIK.define({
  id: 'mention-picker', name: 'Mention picker', cat: 'social', T: 4.5,
  cam: { zoom: 1.45, y: -190, k: { zoom: [[1.4, 2.1, 1.3, 'Power2 Smooth'], [3.45, 4.1, 1.45, 'Power2 Smooth']], y: [[1.4, 2.1, -20, 'Power2 Smooth'], [3.45, 4.1, -190, 'Power2 Smooth']] } },
  desc: 'Typing "@" opens a people popup; "ma" filters it from three to two (the middle row leaves and the panel tightens), the highlight glides down to Marco, and Enter turns the query into an accent-tinted mention chip.',
  build: () => {
    const FC = 0.7, TY0 = 0.95, TY1 = 1.4, QS = 1.55, Q1 = 1.95, Q2 = 2.2, F = 2.28, D = 2.8, E = 3.35;
    const CY = -190, TX = -392, QX = TX + 169.4, PT = -118, RH = 84;   // "Looping in" + a space, measured in Helvetica 34
    const RY = [54, 138, 222];
    const people = [['MC', 'Maya Chen', '@maya', 'dim'], ['JP', 'Jonah Park', '@jonah', 'soft'], ['MD', 'Marco Diaz', '@marco', 'ink']];
    const row = (i, kk) => group({ id: 'row' + i, y: RY[i], k: kk, ch: [
      avatar({ id: 'rowAv' + i, x: -210, d: 52, fill: people[i][3], ini: people[i][0], size: 19 }),
      text({ text: people[i][1], x: -170, ax: 0, size: 30, weight: 500 }),
      text({ text: people[i][2], x: 236, ax: 1, size: 24, color: 'muted' }),
    ] });
    return [
      rect({ id: 'composer', y: CY, w: 1000, h: 112, r: 34, fill: 'card', shadow: 1, k: k(popIn(0.1, 0.7), press(FC, { to: 0.985 })) }),
      avatar({ id: 'meAvatar', x: -438, y: CY, d: 56, fill: 'ink', ini: 'AR', size: 20, k: pop(0.24, { from: 0.6 }) }),
      text({ id: 'placeholder', text: 'Write a comment…', x: TX, y: CY, ax: 0, size: 34, color: 'muted', k: k(enter(0.28), exit(TY0 - 0.02, { dur: 0.08 })) }),
      text({ id: 'prefix', text: 'Looping in ', x: TX, y: CY, ax: 0, size: 34, caret: true, caretColor: 'ink', caretFrom: FC + 0.05, caretUntil: QS,
        k: { reveal: [0, [TY0, TY1, 1, 'Linear']] } }),
      text({ id: 'query', text: '@ma', x: QX, y: CY, ax: 0, size: 34, caret: true, caretColor: 'ink', caretFrom: QS, caretUntil: E,
        k: k({ reveal: [0, [QS, QS + 0.04, 1 / 3, 'Linear'], [Q1, Q2, 1, 'Linear']] }, exit(E, { dur: 0.12, blur: 6 })) }),
      rect({ id: 'chip', x: QX - 3, y: CY, pin: 'l', chAt: 'pin', w: 226, h: 54, r: 14, fill: 'acc/14',
        k: { opacity: [0, [E + 0.04, E + 0.16, 1, 'Power2 Out']], scale: [0.86, [E + 0.04, E + 0.46, 1, 'Back Out']], blur: [6, [E + 0.04, E + 0.24, 0, 'Power2 Out']] },
        ch: [text({ id: 'chipLbl', text: '@Marco Diaz', x: 9, ax: 0, size: 34, weight: 500, color: 'acc' })] }),
      text({ id: 'caretAfter', text: '', x: QX - 3 + 226 + 6, y: CY, ax: 0, size: 34, caret: true, caretColor: 'ink', caretFrom: E + 0.3 }),
      icon({ id: 'sendIcon', icon: 'send', x: 440, y: CY, size: 34, sw: 2.6, color: 'muted', k: fadeIn(0.32) }),
      group({ id: 'popup', x: 10, y: PT,
        k: { opacity: [0, [QS + 0.04, QS + 0.18, 1, 'Linear'], [E + 0.02, E + 0.22, 0, 'Power2 In']],
             y: [PT - 18, [QS + 0.04, QS + 0.6, PT, 'Power4 Out'], [E + 0.02, E + 0.22, PT - 10, 'Power2 In']],
             scale: [0.96, [QS + 0.04, QS + 0.6, 1, 'Power4 Out'], [E + 0.02, E + 0.22, 0.97, 'Power2 In']],
             blur: [8, [QS + 0.04, QS + 0.3, 0, 'Power2 Out'], [E + 0.02, E + 0.22, 6, 'Power2 In']] }, ch: [
          rect({ id: 'popupBg', pin: 't', w: 520, h: 12 + 3 * RH + 60, r: 26, fill: 'card', shadow: 2, k: { h: [[F + 0.05, F + 0.5, 12 + 2 * RH + 60, 'Power3 Out']] } }),
          rect({ id: 'highlight', y: RY[0], w: 496, h: 72, r: 18, fill: 'soft',
            k: k({ y: [[D, D + 0.45, RY[1], 'Power4 Out']], h: [[D, D + 0.14, 100, 'Power2 Out'], [D + 0.14, D + 0.5, 72, 'Power3 Out']] }, press(E, { to: 0.97 })) }),
          row(0, fadeIn(QS + 0.14)),
          row(1, k(fadeIn(QS + 0.19), exit(F, { dur: 0.14, blur: 6, s: 0.94 }))),
          row(2, k(fadeIn(QS + 0.24), { y: [[F + 0.1, F + 0.55, RY[1], 'Power3 Out']] })),
          group({ id: 'footer', y: 12 + 3 * RH + 4, k: k(fadeIn(QS + 0.28), { y: [[F + 0.05, F + 0.5, 12 + 2 * RH + 4, 'Power3 Out']] }), ch: [
            rect({ w: 520, h: 2, fill: 'line' }),
            text({ text: 'Enter to select', x: -236, y: 28, ax: 0, size: 22, color: 'muted' }),
            text({ id: 'count3', text: '3 people', x: 236, y: 28, ax: 1, size: 22, color: 'muted', k: exit(F) }),
            text({ id: 'count2', text: '2 people', x: 236, y: 28, ax: 1, size: 22, color: 'muted', k: enter(F) }),
          ] }),
        ] }),
      cursorLayer([[0, 560, 110], [0.3, 560, 110], [0.62, -60, -178], [0.8, -60, -178], [1.4, 560, 110]], [FC], [], { inAt: 0.25 }),
    ];
  },
});

// 6 ─ Inbox: a new message pushes in at the top; opening a row clears its dot and un-bolds the sender
UIK.define({
  id: 'inbox-list', name: 'Inbox', cat: 'social', T: 3.6, cam: 1.25,
  desc: 'A new message slides in at the top of the inbox and pushes the other rows down (the last one out of view), its unread dot pops and the count rolls up. Then a click opens a row: it tints, its dot shrinks away, the sender name swaps to regular weight and the count rolls back.',
  build: () => {
    const N = 1.05, O = 2.45, LY = 50, RY = (i) => -168 + i * 112;
    const rows = [
      ['MC', 'Maya Chen', 'Draft is ready for review', '9:24', true, 'dim'],
      ['LM', 'Leo Martins', 'Can we move the call to 3pm?', '8:51', true, 'ink'],
      ['SN', 'Studio North', 'Your March invoice is ready', 'Mon', false, 'skel'],
      ['AK', 'Ava Kim', 'Thanks, that works for me', 'Sun', false, 'dim'],
    ];
    const body = (id, r, o = {}) => [
      avatar({ id: id + 'Av', x: -398, d: 68, fill: r[5], ini: r[0], size: 24 }),
      ...(o.open
        ? [text({ id: id + 'NameB', text: r[1], x: -346, y: -18, ax: 0, size: 30, weight: 600, k: exit(O + 0.05, { dur: 0.16, blur: 5 }) }),
           text({ id: id + 'NameR', text: r[1], x: -346, y: -18, ax: 0, size: 30, weight: 400, k: enter(O + 0.05, { d: 0.04, blur: 5, s: 1 }) })]
        : [text({ id: id + 'Name', text: r[1], x: -346, y: -18, ax: 0, size: 30, weight: r[4] ? 600 : 400 })]),
      text({ id: id + 'Time', text: r[3], x: 410, y: -18, ax: 1, size: 22, color: 'muted' }),
      text({ id: id + 'Prev', text: r[2], x: -346, y: 18, ax: 0, size: 24, color: 'muted' }),
      ...(r[4] ? [circle({ id: id + 'Dot', x: 402, y: 18, d: 16, fill: 'acc', k: o.dot })] : []),
      rect({ id: id + 'Rule', y: 56, w: 860, h: 2, fill: 'line' }),
    ];
    return [
      rect({ id: 'card', w: 940, h: 600, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Inbox', x: -410, y: -240, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -410 }) }),
        rect({ id: 'unread', x: 410, y: -240, pin: 'r', chAt: 'pin', w: 138, h: 50, r: 25, fill: 'soft', k: enter(0.3), ch: [
          roll({ id: 'unreadN', x: -113, w: 18, h: 34, vals: ['2', '3', '2'], ts: [N + 0.2, O + 0.15], size: 24, weight: 600 }),
          text({ text: 'unread', x: -20, ax: 1, size: 24, weight: 500 }),
        ] }),
        group({ id: 'list', y: LY, w: 940, h: 448, clip: true, ch: [
          ...rows.map((r, i) => {
            const t = N + i * 0.03, open = i === 1;
            return group({ id: 'row' + i, y: RY(i), k: k(enter(0.3 + i * 0.07, { dx: -18, x0: 0 }), { y: [[t, t + 0.5, RY(i + 1), 'Power3 Out']] }, open ? press(O, { to: 0.985 }) : null), ch: [
              ...(open ? [rect({ id: 'openHi', w: 940, h: 112, fill: 'soft', k: { opacity: [0, [O, O + 0.2, 1, 'Power2 Out']] } })] : []),
              ...body('r' + i, r, { open, dot: open ? { scale: [[O + 0.05, O + 0.3, 0, 'Power2 In']] } : null }),
            ] });
          }),
          group({ id: 'newRow', y: RY(0), k: enter(N, { d: 0.06, dy: -34, y0: RY(0) }), ch: [
            rect({ id: 'newHi', w: 940, h: 112, fill: 'soft', k: { opacity: [0, [N + 0.06, N + 0.2, 1, 'Power2 Out'], [N + 0.8, N + 1.2, 0, 'Power2 Out']] } }),
            ...body('rn', ['JP', 'Jonah Park', 'Sent you 3 files', 'now', true, 'ink'], { dot: pop(N + 0.36, { from: 0 }) }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 380], [1.5, 560, 380], [2.35, -60, 112], [2.65, -60, 112], [3.2, 300, 360]], [O], [], { inAt: 1.45 }),
    ];
  },
});

// 7 ─ Swipe to archive: the cursor drags a row left over an ink action, releases, the row flies out and the list closes up
UIK.define({
  id: 'swipe-to-archive', name: 'Swipe to archive', cat: 'social', T: 3.4,
  cam: { zoom: 1.25, y: 10, k: { y: [[2.2, 2.8, -48, 'Power2 Smooth']] } },
  desc: 'The cursor grabs a row and drags it left: an ink Archive action is revealed behind it (a clip that grows with the drag) and its icon pops once past the threshold. On release the row flies out, the ink fills the row and collapses, the rows below close the gap and the count rolls down.',
  build: () => {
    const D0 = 1.1, D1 = 1.85, DX = -400, K = D1 + 0.35, LY = 40, RH = 116, W = 920;
    const RY = (i) => -174 + i * RH;
    const ARM = cross(D0, D1, 0, DX, -250);
    const rows = [
      ['calendar', 'Design review', 'Today at 3:00 PM', '9:24'],
      ['file', 'Weekly report', 'Q3 numbers are in', '8:51'],
      ['users', 'Team offsite', '12 people are going', 'Mon'],
      ['bell', 'Reminder', 'Renew the studio domain', 'Sun'],
    ];
    const content = (r, i) => [
      rect({ id: 'rowBg' + i, w: W, h: RH, fill: 'card' }),
      rect({ id: 'tile' + i, x: -388, w: 68, h: 68, r: 20, fill: 'soft', ch: [icon({ icon: r[0], size: 32, sw: 2.4 })] }),
      text({ text: r[1], x: -330, y: -18, ax: 0, size: 30, weight: 600 }),
      text({ text: r[2], x: -330, y: 18, ax: 0, size: 24, color: 'muted' }),
      text({ text: r[3], x: 420, y: -18, ax: 1, size: 22, color: 'muted' }),
      ...(i < 3 ? [rect({ id: 'rule' + i, y: RH / 2 - 1, w: 840, h: 2, fill: 'line' })] : []),
    ];
    return [
      rect({ id: 'card', y: -300, pin: 't', w: W, h: 620, r: 44, fill: 'card', shadow: 1, k: k(popIn(0.1, 0.7), { h: [[K, K + 0.5, 620 - RH, 'Power3 Out']] }) }),
      text({ id: 'title', text: 'Updates', x: -400, y: -240, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -400 }) }),
      rect({ id: 'countChip', x: 400, y: -240, pin: 'r', chAt: 'pin', w: 124, h: 50, r: 25, fill: 'soft', k: enter(0.3), ch: [
        roll({ id: 'countN', x: -98, w: 18, h: 34, vals: ['4', '3'], ts: [K + 0.05], size: 24, weight: 600 }),
        text({ text: 'items', x: -20, ax: 1, size: 24, weight: 500 }),
      ] }),
      group({ id: 'list', y: LY, w: W, h: 4 * RH, clip: true, ch: [
        ...rows.map((r, i) => {
          if (i === 1) return group({ id: 'row1', y: RY(1), k: enter(0.3 + 0.07, { dx: -18, x0: 0 }), ch: [
            // the action behind the row: pinned to the right edge, its width is exactly the dragged distance
            rect({ id: 'action', x: W / 2, pin: 'r', chAt: 'pin', w: 0, h: RH, fill: 'ink', clip: true,
              k: { w: [[D0, D1, -DX, 'Power2 Smooth'], [D1, D1 + 0.4, W, 'Power3 Out']], h: [[K, K + 0.45, 0, 'Power4 Out']] }, ch: [
                glyph({ id: 'archiveIcon', g: 'archive', x: -176, size: 34, color: 'inv', sw: 2.4, k: k(bump(ARM, 1.3), exit(K - 0.05, { dur: 0.12 })) }),
                text({ id: 'archiveLbl', text: 'Archive', x: -44, ax: 1, size: 28, weight: 600, color: 'inv', k: exit(K - 0.05, { dur: 0.12 }) }),
              ] }),
            group({ id: 'front', k: { x: [[D0, D1, DX, 'Power2 Smooth'], [D1, D1 + 0.4, -W - 40, 'Power3 Out']] }, ch: content(r, 1) }),
          ] });
          const kk = [enter(0.3 + i * 0.07, { dx: -18, x0: 0 })];
          if (i > 1) kk.push({ y: [[K + (i - 2) * 0.03, K + 0.5 + (i - 2) * 0.03, RY(i - 1), 'Power3 Out']] });
          return group({ id: 'row' + i, y: RY(i), k: k(...kk), ch: content(r, i) });
        }),
      ] }),
      cursorLayer([[0, 560, 340], [0.4, 560, 340], [0.98, 250, -12], [D0, 250, -12], [D1, 250 + DX, -8], [D1 + 0.25, 250 + DX, -8], [2.9, 320, 280]], [], [[D0, D1]], { inAt: 0.35 }),
    ];
  },
});

// 8 ─ Video call grid: the active-speaker ring jumps between tiles, a mic mutes, a hand goes up
UIK.define({
  id: 'call-tiles', name: 'Call grid', cat: 'social', T: 4.1, cam: 1.02,
  desc: 'A 2×2 call grid: the accent active-speaker ring jumps from tile to tile and stretches in flight. The cursor mutes the mic (both badges swap to a slashed mic), a Raised hand chip pops and waves on another tile, and the ring moves to that person.',
  build: () => {
    const TX = [-270, 270, -270, 270], TY = [-220, -220, 100, 100], TW = 520, TH = 300, J0 = 0.75, J1 = 1.45, M = 2.05, HD = 2.55, J2 = 3.1;
    const P = [['MC', 'Maya Chen', 'ink'], ['LP', 'Leo Park', 'card'], ['AR', 'You', 'dim'], ['JD', 'Jonah Diaz', 'card']];
    const slash = (s) => `M${-s} ${-s} L${s} ${s}`;
    // mic badge: on M the fill turns ink and the icon swaps for a slashed mic (the slash cuts through with an ink gap)
    const mic = (id, x, y, d, size, from, extra) => circle({ id, x, y, d, fill: from, k: k({ fill: [[M, M + 0.2, 'ink', 'Power2 Out']] }, extra), ch: [
      icon({ id: id + 'On', icon: 'mic', size, sw: 2.4, k: exit(M, { s: 0.6 }) }),
      group({ id: id + 'Off', k: enter(M + 0.02, { d: 0, dur: 0.2, s: 0.8 }), ch: [
        icon({ icon: 'mic', size, sw: 2.4, color: 'inv' }),
        path({ d: slash(size * 0.44), stroke: 'ink', sw: 7, trimmed: true, k: { trimE: [0, [M + 0.1, M + 0.34, 100, 'Power3 Out']] } }),
        path({ d: slash(size * 0.44), stroke: 'inv', sw: 2.4, trimmed: true, k: { trimE: [0, [M + 0.1, M + 0.34, 100, 'Power3 Out']] } }),
      ] }),
    ] });
    return [
      rect({ id: 'window', w: 1140, h: 820, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        ...P.map((p, i) => group({ id: 'tile' + i, x: TX[i], y: TY[i], k: enter(0.2 + i * 0.06, { s: 0.96, blur: 6 }), ch: [
          rect({ id: 'tileBg' + i, w: TW, h: TH, r: 28, fill: 'panel' }),
          avatar({ id: 'tileAv' + i, y: -10, d: 140, fill: p[2], ini: p[0], size: 48, k: pop(0.3 + i * 0.06, { from: 0.6 }) }),
          text({ id: 'tileName' + i, text: p[1], x: -236, y: 116, ax: 0, size: 24, weight: 500 }),
          ...(i === 2 ? [] : [circle({ x: 226, y: 116, d: 48, fill: 'card', ch: [icon({ icon: 'mic', size: 24, sw: 2.4 })] })]),
        ] })),
        mic('youMic', TX[2] + 226, TY[2] + 116, 48, 24, 'card', fadeIn(0.38)),
        // active speaker: one ring that travels (and stretches along its path)
        rect({ id: 'speaker', x: TX[0], y: TY[0], w: TW, h: TH, r: 28, stroke: 'acc', sw: 6,
          k: { opacity: [0, [J0, J0 + 0.15, 1, 'Power2 Out']], scale: [1.05, [J0, J0 + 0.4, 1, 'Power3 Out']],
               x: [[J1, J1 + 0.5, TX[1], 'Power4 Out']], w: [[J1, J1 + 0.16, TW + 160, 'Power2 Out'], [J1 + 0.16, J1 + 0.55, TW, 'Power3 Out']],
               y: [[J2, J2 + 0.5, TY[3], 'Power4 Out']], h: [[J2, J2 + 0.16, TH + 110, 'Power2 Out'], [J2 + 0.16, J2 + 0.55, TH, 'Power3 Out']] } }),
        rect({ id: 'handChip', x: TX[3] - 236, y: TY[3] - 114, pin: 'l', chAt: 'pin', w: 188, h: 50, r: 25, fill: 'card', shadow: 3,
          k: k(pop(HD, { from: 0.5, dur: 0.4 }), exit(J2 + 0.35, { s: 0.8 })), ch: [
            group({ id: 'wrist', x: 30, y: 10, k: { rot: [[HD + 0.12, HD + 0.26, 16, 'Sine Smooth'], [HD + 0.26, HD + 0.42, -12, 'Sine Smooth'],
                                                       [HD + 0.42, HD + 0.58, 8, 'Sine Smooth'], [HD + 0.58, HD + 0.74, 0, 'Sine Smooth']] }, ch: [
              glyph({ id: 'hand', g: 'hand', y: -10, size: 26, sw: 2.4 }),
            ] }),
            text({ text: 'Raised hand', x: 52, ax: 0, size: 22, weight: 500 }),
          ] }),
        // controls
        mic('ctrlMic', -150, 330, 76, 32, 'soft', k(fadeIn(0.46), press(M))),
        circle({ id: 'ctrlVideo', x: -50, y: 330, d: 76, fill: 'soft', k: fadeIn(0.5), ch: [icon({ icon: 'video', size: 32, sw: 2.4 })] }),
        rect({ id: 'leave', x: 90, y: 330, w: 150, h: 76, r: 38, fill: 'ink', k: fadeIn(0.54), ch: [text({ text: 'Leave', size: 28, weight: 600, color: 'inv' })] }),
      ] }),
      cursorLayer([[0, 560, 470], [1.45, 560, 470], [1.95, -142, 342], [2.3, -142, 342], [2.9, 380, 470]], [M], [], { inAt: 1.4 }),
    ];
  },
});

// 9 ─ Share sheet: Share → a sheet slides up with targets on a stagger → Copy link confirms → the sheet slides away
UIK.define({
  id: 'share-sheet', name: 'Share sheet', cat: 'social', T: 4.0, cam: 1.35,
  desc: 'Share is clicked: the post dims and a sheet slides up with five round targets popping on a stagger and a Copy link row. A click on Copy link swaps its icon for an accent check and its label for Link copied, then the sheet slides away and the button confirms.',
  build: () => {
    const C1 = 1.0, U = C1 + 0.08, C2 = 2.05, X = 2.85, BX = 350, BY = 120;
    const TG = [['message', 'Chat'], ['mail', 'Mail'], ['users', 'Team'], ['bookmark', 'Save'], [null, 'More']];
    return [
      rect({ id: 'card', w: 980, h: 500, r: 44, fill: 'card', shadow: 1, clip: true, k: popIn(0.1, 0.7), ch: [
        group({ id: 'post', k: { opacity: [[U, U + 0.35, 0.6, 'Power2 Out'], [X + 0.1, X + 0.5, 1, 'Power2 Out']] }, ch: [
          rect({ id: 'media', y: -95, w: 900, h: 270, r: 28, fill: 'panel', k: enter(0.2, { blur: 10, s: 0.98 }), ch: [
            circle({ id: 'playDisc', d: 96, fill: 'card', shadow: 3, k: pop(0.34, { from: 0.5 }), ch: [icon({ icon: 'play', x: 3, size: 38, sw: 2.4, filled: true, fill: 'ink' })] }),
          ] }),
          text({ id: 'title', text: 'Launch film — final cut', x: -450, y: 100, ax: 0, size: 38, weight: 600, ls: -0.02, k: enter(0.3, { dx: -14, x0: -450 }) }),
          text({ id: 'meta', text: '2:14 · 1.2k views', x: -450, y: 142, ax: 0, size: 24, color: 'muted', k: enter(0.38) }),
          rect({ id: 'shareBtn', x: BX, y: BY, w: 190, h: 76, r: 38, fill: 'ink', k: k(enter(0.44, { blur: 0 }), press(C1)), ch: [
            group({ id: 'shareLbl', x: -1, k: exit(X + 0.3), ch: [
              glyph({ g: 'share', x: -44, size: 28, color: 'inv', sw: 2.4 }),
              text({ text: 'Share', x: -20, ax: 0, size: 28, weight: 600, color: 'inv' }),
            ] }),
            group({ id: 'copiedLbl', x: -8, k: enter(X + 0.32), ch: [
              icon({ icon: 'check', x: -44, size: 28, color: 'inv', sw: 3 }),
              text({ text: 'Copied', x: -20, ax: 0, size: 28, weight: 600, color: 'inv' }),
            ] }),
          ] }),
        ] }),
        // backdrop dim: 'shade' stays near-black in both themes, so the post darkens behind the sheet
        rect({ id: 'scrim', w: 980, h: 500, fill: 'shade/22', k: { opacity: [0, [U, U + 0.35, 1, 'Power2 Out'], [X + 0.1, X + 0.5, 0, 'Power2 Out']] } }),
        group({ id: 'sheet', k: { y: [470, [U, U + 0.62, 0, 'Power4 Out'], [X, X + 0.42, 470, 'Power2 In']] }, ch: [
          rect({ id: 'sheetBg', y: -130, pin: 't', w: 980, h: 460, radii: '40px 40px 0 0', fill: 'card', shadow: 2 }),
          rect({ id: 'handle', y: -112, w: 64, h: 8, r: 4, fill: 'dim' }),
          text({ id: 'sheetTitle', text: 'Share to', x: -430, y: -70, ax: 0, size: 30, weight: 600, k: enter(U + 0.2) }),
          icon({ id: 'close', icon: 'x', x: 424, y: -70, size: 30, sw: 2.4, color: 'muted', k: enter(U + 0.24) }),
          ...TG.map(([ic, lbl], i) => group({ id: 'target' + i, x: -360 + i * 180, y: 12, ch: [
            circle({ id: 'targetBg' + i, d: 88, fill: 'soft', k: pop(U + 0.3 + i * 0.06, { from: 0.3, dur: 0.4 }),
              ch: ic ? [icon({ icon: ic, size: 36, sw: 2.4 })] : [-14, 0, 14].map((x) => circle({ x, d: 8, fill: 'ink' })) }),
            text({ text: lbl, y: 70, size: 22, weight: 500, color: 'muted', k: enter(U + 0.36 + i * 0.06) }),
          ] })),
          rect({ id: 'copyRow', y: 172, w: 880, h: 80, r: 24, fill: 'soft', k: k(enter(U + 0.62, { blur: 0 }), press(C2, { to: 0.98 })), ch: [
            icon({ id: 'linkIcon', icon: 'link', x: -386, size: 30, sw: 2.4, k: exit(C2 + 0.04, { s: 0.6 }) }),
            circle({ id: 'okDisc', x: -386, d: 42, fill: 'acc', k: pop(C2 + 0.08, { from: 0.3 }), ch: [icon({ icon: 'check', size: 24, color: '#FFFFFF', sw: 3 })] }),
            text({ id: 'copyLbl', text: 'Copy link', x: -346, ax: 0, size: 28, weight: 600, k: exit(C2 + 0.04) }),
            text({ id: 'copiedRowLbl', text: 'Link copied', x: -346, ax: 0, size: 28, weight: 600, k: enter(C2 + 0.06, { dx: -10, x0: -346 }) }),
            text({ id: 'url', text: 'north.studio/p/48k', x: 410, ax: 1, size: 24, color: 'muted' }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 600, 330], [0.4, 600, 330], [0.9, 364, 134], [1.2, 364, 134], [1.95, -330, 178], [2.3, -330, 178], [2.9, 200, 330]], [C1, C2], [], { inAt: 0.35 }),
    ];
  },
});

// 10 ─ Poll: a vote fills every option with its result bar; the pick is accent with a check
UIK.define({
  id: 'poll', name: 'Poll', cat: 'social', T: 3.2, cam: 1.3,
  desc: 'A poll with three outlined options. The cursor hovers and votes: result bars grow in every row on a stagger while the percentages count up; the chosen one fills with the accent, its label turns white and a check pops.',
  build: () => {
    const C = 1.3, B = C + 0.08, OY = [-52, 50, 152], PICK = 1, OW = 800, OH = 88;
    const opts = [['Close-up portrait', 24, 238], ['Wide landscape', 58, 222], ['Title card', 18, 140]];
    return [
      rect({ id: 'card', w: 900, h: 500, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'q', text: 'Which thumbnail should we use?', x: -400, y: -184, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -14, x0: -400 }) }),
        text({ id: 'subIdle', text: '1,204 votes · Closes in 2 days', x: -400, y: -140, ax: 0, size: 24, color: 'muted', k: k(enter(0.3), exit(B + 0.15)) }),
        text({ id: 'subDone', text: 'You voted · 1,205 votes', x: -400, y: -140, ax: 0, size: 24, color: 'muted', k: enter(B + 0.15) }),
        ...opts.map(([label, pct, lw], i) => {
          const pick = i === PICK, t = B + i * 0.06;
          return rect({ id: 'opt' + i, y: OY[i], w: OW, h: OH, r: 24, fill: 'card', stroke: 'line', sw: 2, clip: true,
            k: k(enter(0.34 + i * 0.07, { blur: 0, dy: 12, y0: OY[i] }), pick ? press(C, { to: 0.98 }) : null,
              pick ? { fill: [[C - 0.3, C - 0.1, 'panel', 'Power2 Out']], stroke: [[C - 0.3, C - 0.1, 'dim', 'Power2 Out'], [B, B + 0.3, 'acc', 'Power2 Out']] } : null), ch: [
              rect({ id: 'bar' + i, x: -OW / 2, pin: 'l', w: 0, h: OH, fill: pick ? 'acc' : 'skel', k: { w: [[t, t + 0.85, OW * pct / 100, 'Power4 Out']] } }),
              text({ id: 'lbl' + i, text: label, x: -364, ax: 0, size: 30, weight: 500, k: pick ? { color: [[t + 0.02, t + 0.2, '#FFFFFF', 'Power2 Out']] } : null }),
              ...(pick ? [icon({ id: 'check', icon: 'check', x: -364 + lw + 26, size: 28, color: '#FFFFFF', sw: 3, k: pop(B + 0.32) })] : []),
              text({ id: 'pct' + i, x: 364, ax: 1, size: 28, weight: 600, num: { suf: '%' }, k: k(enter(t, { d: 0 }), { value: [[t, t + 0.85, pct, 'Power3 Out']] }) }),
            ] });
        }),
      ] }),
      cursorLayer([[0, 560, 330], [0.55, 560, 330], [1.1, -40, 60], [1.5, -40, 60], [2.15, 300, 300]], [C], [], { inAt: 0.5 }),
    ];
  },
});

// 11 ─ Read receipts: clock → sent → delivered → read, each state a small swap inside the bubble
UIK.define({
  id: 'read-receipts', name: 'Read receipts', cat: 'social', T: 3.2, cam: { zoom: 1.9, x: 10, y: -6 },
  desc: 'An outgoing bubble pops from its tail. Its status steps through small swaps: a spinning clock, one check drawing on (sent), a second check (delivered), then both pop in the accent as the label changes to Read and the reader’s avatar appears.',
  build: () => {
    const S = 0.95, D = 1.65, R = 2.35, KX = 280, KY = 18;
    // Lucide check-check, 1.25× (24-unit box centred): the first check, then the second one set lower-right
    const T1 = 'M-12.5 0 L-6.25 6.25 L7.5 -7.5', T2 = 'M1.25 5 L3.13 6.88 L12.5 -2.5';
    const ticks = (color, kk) => [
      path({ d: T1, stroke: color, sw: 2.6, trimmed: true, k: kk[0] }),
      path({ d: T2, stroke: color, sw: 2.6, trimmed: true, k: kk[1] }),
    ];
    return [
      rect({ id: 'bubble', x: 330, y: 60, pin: 'br', w: 640, h: 150, radii: '44px 44px 12px 44px', fill: 'ink', shadow: 1, k: popIn(0.1, 0.6) }),
      text({ id: 'msg', text: 'Final cut is in the shared folder', x: -270, y: -40, ax: 0, size: 36, weight: 500, color: 'inv', k: enter(0.22, { dx: -12, x0: -270 }) }),
      text({ id: 'time', text: '9:41', x: 252, y: KY, ax: 1, size: 24, color: 'inv/60', k: enter(0.32) }),
      group({ id: 'clock', x: KX, y: KY, k: k(enter(0.32), exit(S, { s: 0.5 })), ch: [
        path({ d: ring(10), stroke: 'inv/60', sw: 2.4 }),
        path({ id: 'hand', d: 'M0 1 L0 -5.5', stroke: 'inv/60', sw: 2.4, k: { rot: [[0.32, S, 600, 'Linear']] } }),
      ] }),
      group({ id: 'ticks', x: KX, y: KY, k: k({ opacity: [[R, R + 0.12, 0, 'Linear']] }), ch: ticks('inv/60', [
        { trimE: [0, [S + 0.04, S + 0.3, 100, 'Power3 Out']] },
        { trimE: [0, [D, D + 0.24, 100, 'Power3 Out']] },
      ]) }),
      group({ id: 'readTicks', x: KX, y: KY, k: { opacity: [0, [R, R + 0.1, 1, 'Linear']], scale: [0.6, [R, R + 0.4, 1, 'Back Out']] }, ch: ticks('acc', [{}, {}]) }),
      text({ id: 'sending', text: 'Sending…', x: 330, y: 100, ax: 1, size: 26, color: 'muted', k: k(enter(0.32), exit(S)) }),
      text({ id: 'sent', text: 'Sent', x: 330, y: 100, ax: 1, size: 26, color: 'muted', k: k(enter(S), exit(D)) }),
      text({ id: 'delivered', text: 'Delivered', x: 330, y: 100, ax: 1, size: 26, color: 'muted', k: k(enter(D), exit(R)) }),
      text({ id: 'read', text: 'Read', x: 290, y: 100, ax: 1, size: 26, weight: 500, k: enter(R, { d: 0.1 }) }),
      avatar({ id: 'reader', x: 314, y: 100, d: 34, fill: 'dim', ini: 'M', size: 16, k: pop(R + 0.12, { from: 0.3 }) }),
    ];
  },
});

// 12 ─ Voice message: play → pause, the waveform fills with ink from the left, 2× speeds it up, the time counts
UIK.define({
  id: 'voice-message', name: 'Voice message', cat: 'social', T: 4.2, cam: 1.3,
  desc: 'Play is clicked: the icon swaps to pause and the 28-bar waveform turns ink bar by bar from the left as the note plays, while the time counts. A click on 1× rolls it to 2× and the fill speeds up; at the end the icon swaps back to play.',
  build: () => {
    const C1 = 0.95, PL = 1.03, SP = 2.05, END = 3.63, N = 28, PITCH = 18, X0 = -256, WW = (N - 1) * PITCH + 8;
    const hs = Array.from({ length: N }, (_, j) => {
      const env = 0.35 + 0.65 * Math.sin(Math.PI * (j + 0.5) / N);
      return Math.round(12 + 58 * env * (0.35 + 0.65 * rnd(j * 7 + 3)));
    });
    // playback progress is piecewise linear (1× until the speed click, then 2×); a bar turns ink when it reaches the bar's centre
    const W1 = WW * 0.26;
    const reach = (x) => (x <= W1 ? PL + (SP + 0.02 - PL) * x / W1 : SP + 0.1 + (END - SP - 0.1) * (x - W1) / (WW - W1));
    return [
      avatar({ id: 'avatar', x: -500, y: 30, d: 90, fill: 'dim', ini: 'LO', size: 32, k: popIn(0.1, 0.6) }),
      text({ id: 'who', text: 'Lena Ortiz', x: -384, y: -106, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.22) }),
      rect({ id: 'bubble', x: 40, w: 900, h: 150, r: 75, fill: 'card', shadow: 1, k: popIn(0.14, 0.7), ch: [
        circle({ id: 'playBtn', x: -372, d: 100, fill: 'acc', k: k(pop(0.3, { from: 0.5 }), press(C1, { to: 0.9 })), ch: [
          icon({ id: 'playIcon', icon: 'play', x: 3, size: 40, color: '#FFFFFF', sw: 2.4, filled: true, fill: '#FFFFFF', k: k(exit(C1 + 0.02, { s: 0.6, dur: 0.1 }), enter(END, { d: 0.02, s: 0.6 })) }),
          icon({ id: 'pauseIcon', icon: 'pause', size: 38, color: '#FFFFFF', sw: 2.4, filled: true, fill: '#FFFFFF', k: k(enter(C1 + 0.04, { d: 0, s: 0.6 }), exit(END, { s: 0.6, dur: 0.1 })) }),
        ] }),
        ...hs.map((h, j) => {
          const t = +reach(4 + j * PITCH).toFixed(3);
          return rect({ id: 'bar' + j, x: X0 - 40 + 4 + j * PITCH, w: 8, h: 6, r: 4, fill: 'dim',
            k: { h: [[0.3 + j * 0.014, 0.75 + j * 0.014, h, 'Power3 Out']], fill: [[t, t + 0.1, 'ink', 'Power2 Out']] } });
        }),
        rect({ id: 'speed', x: 264, w: 80, h: 50, r: 25, fill: 'soft', k: k(enter(0.5), press(SP, { to: 0.9 })), ch: [
          roll({ id: 'speedRoll', w: 40, h: 34, vals: ['1×', '2×'], ts: [SP + 0.04], size: 24, weight: 600 }),
        ] }),
        text({ id: 'total', text: '0:09', x: 410, ax: 1, size: 28, weight: 500, color: 'muted', k: k(enter(0.54), exit(PL, { dur: 0.1 })) }),
        text({ id: 'elapsed', x: 410, ax: 1, size: 28, weight: 500, num: { pre: '0:0', sep: false, floor: true },
          k: k(enter(PL, { d: 0 }), { value: [[PL, SP + 0.02, 2.34, 'Linear'], [SP + 0.1, END, 9, 'Linear']] }) }),
      ] }),
      cursorLayer([[0, 560, 300], [0.45, 560, 300], [0.88, -318, 14], [1.1, -318, 14], [1.95, 316, 16], [2.25, 316, 16], [2.9, 440, 200]], [C1, SP], [], { inAt: 0.4 }),
    ];
  },
});

// 13 ─ Contact card: the avatar pops, name + role enter, detail rows slide in, two action buttons pop
UIK.define({
  id: 'contact-card', name: 'Contact card', cat: 'social', T: 2.5, cam: 1.3,
  desc: 'A contact card builds in order: the avatar pops, name and role slide in, a hairline draws across, three detail rows (phone, mail, location) slide in on a stagger with their icon tiles popping, and two round action buttons pop last.',
  build: () => {
    const RY = [14, 110, 206];
    const rows = [['phone', '+1 415 555 0142', 'Mobile'], ['mail', 'elena@north.studio', 'Work'], ['pin', 'Lisbon, Portugal', 'Studio']];
    return [
      rect({ id: 'card', w: 940, h: 580, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        avatar({ id: 'avatar', x: -340, y: -171, d: 150, fill: 'ink', ini: 'EV', size: 52, k: pop(0.2, { from: 0.4, dur: 0.5 }) }),
        text({ id: 'name', text: 'Elena Vasquez', x: -236, y: -197, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.34, { dx: -18, x0: -236 }) }),
        text({ id: 'role', text: 'Design lead · Lisbon', x: -236, y: -143, ax: 0, size: 28, color: 'muted', k: enter(0.42, { dx: -12, x0: -236 }) }),
        circle({ id: 'callBtn', x: 270, y: -171, d: 88, fill: 'acc', k: pop(1.0, { from: 0.3 }), ch: [glyph({ g: 'phone', size: 34, color: '#FFFFFF', sw: 2.6 })] }),
        circle({ id: 'msgBtn', x: 376, y: -171, d: 88, fill: 'soft', k: pop(1.08, { from: 0.3 }), ch: [icon({ icon: 'message', size: 34, sw: 2.6 })] }),
        rect({ id: 'rule', x: -410, y: -64, pin: 'l', w: 0, h: 2, fill: 'line', k: { w: [[0.5, 1.0, 820, 'Power3 Out']] } }),
        ...rows.map(([g, value, label], i) => {
          const t = 0.62 + i * 0.1;
          return group({ id: 'row' + i, y: RY[i], k: enter(t, { dx: -24, x0: 0 }), ch: [
            circle({ id: 'rowTile' + i, x: -378, d: 64, fill: 'soft', k: pop(t + 0.04, { from: 0.5 }),
              ch: [g === 'phone' ? glyph({ g, size: 28, sw: 2.4 }) : icon({ icon: g, size: 28, sw: 2.4 })] }),
            text({ text: value, x: -324, y: -16, ax: 0, size: 30, weight: 500 }),
            text({ text: label, x: -324, y: 20, ax: 0, size: 22, color: 'muted' }),
            icon({ id: 'rowCopy' + i, icon: 'copy', x: 396, size: 28, sw: 2.2, color: 'muted' }),
          ] });
        }),
      ] }),
    ];
  },
});

// 14 ─ Presence: away → online (the dot pops accent), "Active now", then a live typing indicator
UIK.define({
  id: 'presence-status', name: 'Presence status', cat: 'social', T: 3.9, cam: 1.55,
  desc: 'An away contact comes online: the dim status dot is covered by an accent dot that pops in, the status line swaps from Away to Active now, and then to typing with three dots rippling in a wave.',
  build: () => {
    const ON = 1.2, TY = 2.15, AX = -330, DX = AX + 55, DY = 55;
    const dots = [0, 1, 2].map((i) => {
      const y = [], o = [0.45];
      for (const c of [TY + 0.25, TY + 0.8, TY + 1.35]) {
        const a = c + i * 0.1;
        y.push([a, a + 0.18, -7, 'Sine Smooth'], [a + 0.18, a + 0.36, 0, 'Sine Smooth']);
        o.push([a, a + 0.18, 1, 'Sine Smooth'], [a + 0.18, a + 0.36, 0.45, 'Sine Smooth']);
      }
      return circle({ id: 'tdot' + i, x: -122 + i * 16, y: 0, d: 9, fill: 'ink', k: { y, opacity: o } });
    });
    return [
      rect({ id: 'card', w: 900, h: 260, r: 56, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        avatar({ id: 'avatar', x: AX, d: 156, fill: 'ink', ini: 'JL', size: 54, k: pop(0.2, { from: 0.5, dur: 0.5 }) }),
        circle({ id: 'rim', x: DX, y: DY, d: 50, fill: 'card', k: k(pop(0.42, { from: 0.3 }), bump(ON, 1.14)), ch: [
          circle({ id: 'awayDot', d: 32, fill: 'dim' }),
          circle({ id: 'onDot', d: 32, fill: 'acc', k: pop(ON, { from: 0.2 }) }),
        ] }),
        text({ id: 'name', text: 'Jamie Lee', x: -218, y: -26, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.3, { dx: -16, x0: -218 }) }),
        text({ id: 'away', text: 'Away · last seen 12m ago', x: -218, y: 28, ax: 0, size: 28, color: 'muted', k: k(enter(0.38), exit(ON + 0.05)) }),
        text({ id: 'active', text: 'Active now', x: -218, y: 28, ax: 0, size: 28, color: 'muted', k: k(enter(ON + 0.05, { dx: -10, x0: -218 }), exit(TY)) }),
        group({ id: 'typing', y: 28, k: enter(TY, { dx: -10, x0: 0 }), ch: [
          text({ id: 'typingLbl', text: 'typing', x: -218, ax: 0, size: 28, weight: 500 }),
          group({ id: 'typingDots', y: 6, ch: dots }),
        ] }),
        circle({ id: 'msgBtn', x: 364, d: 96, fill: 'soft', k: pop(0.5, { from: 0.4 }), ch: [icon({ icon: 'message', size: 38, sw: 2.6 })] }),
      ] }),
    ];
  },
});

// 15 ─ Milestone: the count climbs to 10,000, the ring round the avatar closes and turns accent, a chip pops
UIK.define({
  id: 'milestone', name: 'Follower milestone', cat: 'social', T: 3.4,
  cam: { zoom: 1.3, k: { zoom: [[2.35, 3.15, 1.36, 'Power2 Smooth']] } },
  desc: 'A big follower count climbs to 10,000 while a thin ink ring closes round the avatar in step (Trim Paths). At the goal the number gives a small pulse, the ring is covered by an accent ring and a Milestone chip pops onto it.',
  build: () => {
    const C0 = 0.5, C1 = 2.3, D = 2.35, R = 150, AY = -116;
    const COUNT = [[C0, C1, 10000, 'Power3 Out']];
    return [
      rect({ id: 'card', w: 720, h: 620, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        group({ id: 'ringG', y: AY, k: { scale: [[D, D + 0.1, 1.04, 'Power2 Out'], [D + 0.1, D + 0.5, 1, 'Power3 Out']] }, ch: [
          path({ id: 'track', d: ring(R), stroke: 'dim', sw: 8, k: fadeIn(0.24) }),
          path({ id: 'arc', d: ring(R), stroke: 'ink', sw: 8, trimmed: true, k: { trimE: [0, ...COUNT.map(([a, b, , e]) => [a, b, 100, e])] } }),
          path({ id: 'arcAcc', d: ring(R), stroke: 'acc', sw: 8, k: { opacity: [0, [D, D + 0.12, 1, 'Power2 Out']] } }),
          avatar({ id: 'avatar', d: 240, fill: 'soft', ini: 'MA', size: 80, k: pop(0.2, { from: 0.5, dur: 0.5 }) }),
        ] }),
        rect({ id: 'chip', y: AY + R, w: 215, h: 60, r: 30, fill: 'ink', k: pop(D + 0.1, { from: 0.4 }), ch: [
          icon({ icon: 'sparkle', x: -70, size: 26, color: 'acc', sw: 2.4 }),
          text({ text: 'Milestone', x: -47, ax: 0, size: 28, weight: 600, color: 'inv' }),
        ] }),
        group({ id: 'number', y: 150, k: k(enter(0.3), { scale: [[D, D + 0.1, 1.06, 'Power2 Out'], [D + 0.1, D + 0.45, 1, 'Power3 Out']] }), ch: [
          text({ id: 'counter', size: 104, weight: 600, ls: -0.03, num: {}, k: { value: COUNT, opacity: [[D, 0]] } }),
          text({ id: 'final', text: '10,000', size: 104, weight: 600, ls: -0.03, tnum: false, k: { opacity: [0, [D, 1]] } }),
        ] }),
        text({ id: 'label', text: 'followers', y: 238, size: 32, color: 'muted', k: enter(0.4) }),
      ] }),
    ];
  },
});
})();
