/* UI Motion Kit — feedback elements. */
(function () {
const { rect, circle, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// deterministic 0…1 noise (waveforms) — frames stay a pure function of t
const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
// a closed circle for Trim Paths, starting at 12 o'clock and running clockwise
const ring = (R) => `M0 -${R} A${R} ${R} 0 1 1 0 ${R} A${R} ${R} 0 1 1 0 -${R}`;
// the kit's opening beat: the main shape pops in from empty
const popIn = (t = 0.1, from = 0.6) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// a fade-only entry (fields, tracks — things that should not scale or blur in)
const fadeIn = (t) => enter(t, { blur: 0, s: 1 });

// 1 ─ Toast: a click drops it from the top edge, its timer drains, it slides back out
UIK.define({
  id: 'toast', name: 'Toast', cat: 'feedback', T: 4.4, cam: { zoom: 1.35, y: -10 },
  desc: 'A click on Save drops a toast in from the top edge with a blur; a thin timer bar drains along its bottom, then the toast slides back up and out.',
  build: () => {
    const C = 0.9, IN = C + 0.08, OUT = 3.5, Y = -205, W = 880, H = 156;
    return [
      rect({ id: 'saveBtn', y: 200, w: 400, h: 112, r: 56, fill: 'ink', k: k(popIn(0.1), press(C)),
        ch: [text({ id: 'saveLbl', text: 'Save changes', size: 38, weight: 600, ls: -0.01, color: 'inv', k: enter(0.22) })] }),
      rect({ id: 'toast', y: Y, w: W, h: H, r: 40, fill: 'card', shadow: 2, clip: true, offscreen: true,
        k: { y: [Y - 300, [IN, IN + 0.7, Y, 'Power4 Out'], [OUT, OUT + 0.45, Y - 300, 'Power2 In']],
             blur: [14, [IN, IN + 0.4, 0, 'Power2 Out'], [OUT + 0.05, OUT + 0.45, 12, 'Power2 In']],
             opacity: [0, [IN, IN + 0.14, 1, 'Linear'], [OUT + 0.25, OUT + 0.45, 0, 'Linear']] },
        ch: [
          circle({ id: 'okDisc', x: -364, d: 80, fill: 'acc', k: pop(IN + 0.2, { from: 0.5 }),
            ch: [icon({ icon: 'check', size: 40, color: '#FFFFFF', sw: 3 })] }),
          text({ id: 'tTitle', text: 'Changes saved', x: -302, y: -20, ax: 0, size: 36, weight: 600, ls: -0.02, k: enter(IN + 0.14, { dx: -14, x0: -302 }) }),
          text({ id: 'tSub', text: 'Synced to all your devices', x: -302, y: 22, ax: 0, size: 27, color: 'muted', k: enter(IN + 0.22) }),
          rect({ id: 'undo', x: 350, w: 132, h: 62, r: 31, fill: 'soft', k: enter(IN + 0.3),
            ch: [text({ text: 'Undo', size: 26, weight: 500 })] }),
          rect({ id: 'timer', x: -W / 2, y: H / 2 - 3, pin: 'l', w: W, h: 6, fill: 'ink', k: { w: [[IN + 0.55, OUT - 0.05, 0, 'Linear']] } }),
        ] }),
      cursorLayer([[0, 440, 330], [0.3, 440, 330], [0.8, 118, 222], [1.35, 118, 222], [1.9, 360, 320]], [C], [], { inAt: 0.22 }),
    ];
  },
});

// 2 ─ Progress bar: uneven bursts, a tracking percentage, status swap + check
UIK.define({
  id: 'progress-bar', name: 'Progress bar', cat: 'feedback', T: 4.3, cam: 1.4,
  desc: 'An upload card: the accent fill advances in uneven bursts while the percentage tracks it, then the status swaps to Uploaded and a check pops.',
  build: () => {
    const TW = 840, D = 3.35;
    const P = [[0.7, 1.25, 23, 'Power3 Out'], [1.45, 1.8, 41, 'Power3 Out'], [1.95, 2.85, 86, 'Linear'], [2.95, 3.3, 100, 'Power3 Out']];
    return [
      rect({ id: 'card', w: 960, h: 300, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        rect({ id: 'tile', x: -376, y: -46, w: 108, h: 108, r: 30, fill: 'soft', k: enter(0.22),
          ch: [icon({ icon: 'video', size: 52, color: 'ink', sw: 2.4 })] }),
        text({ id: 'name', text: 'video.mp4', x: -296, y: -68, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.26, { dx: -16, x0: -296 }) }),
        text({ id: 'uploading', text: 'Uploading…', x: -296, y: -22, ax: 0, size: 28, color: 'muted', k: k(enter(0.34), exit(D)) }),
        group({ id: 'done', x: -296, y: -22, k: enter(D, { d: 0.05 }), ch: [
          icon({ id: 'check', icon: 'check', x: 14, size: 30, color: 'acc', sw: 3, k: pop(D + 0.1) }),
          text({ id: 'doneLbl', text: 'Uploaded · 48 MB', x: 40, ax: 0, size: 28, weight: 500 }),
        ] }),
        text({ id: 'pct', x: 420, y: -46, ax: 1, size: 56, weight: 600, ls: -0.02, num: { suf: '%', floor: true },
          k: k(enter(0.3), { value: P }) }),
        rect({ id: 'track', y: 86, w: TW, h: 16, r: 8, fill: 'soft', clip: true, k: fadeIn(0.4), ch: [
          rect({ id: 'fill', x: -TW / 2, pin: 'l', w: 0, h: 16, r: 8, fill: 'acc', k: { w: P.map(([a, b, v, e]) => [a, b, TW * v / 100, e]) } }),
        ] }),
      ] }),
    ];
  },
});

// 3 ─ Progress ring: trimmed arc + counter, swaps to a check, label enters as the camera widens
UIK.define({
  id: 'progress-ring', name: 'Progress ring', cat: 'feedback', T: 4.4,
  cam: { zoom: 2.25, k: { zoom: [[3.0, 3.8, 1.68, 'Power2 Smooth']], y: [[3.0, 3.8, 82, 'Power2 Smooth']] } },
  desc: 'A trimmed accent arc runs round the track in steps while the centre counter follows it; at 100 the counter blurs into a check and the camera widens for the label.',
  build: () => {
    const R = 150, D = 2.95;
    const P = [[0.6, 1.2, 28, 'Power3 Out'], [1.35, 1.75, 46, 'Power3 Out'], [1.9, 2.88, 100, 'Power2 Smooth']];
    return [
      group({ id: 'ringG', k: { scale: [[D, D + 0.12, 1.04, 'Power2 Out'], [D + 0.12, D + 0.55, 1, 'Power3 Out']] }, ch: [
        path({ id: 'track', d: ring(R), stroke: 'dim', sw: 24, k: popIn(0.1, 0.6) }),
        path({ id: 'arc', d: ring(R), stroke: 'acc', sw: 24, trimmed: true, k: { trimE: [0, ...P] } }),
      ] }),
      text({ id: 'pct', y: -14, size: 80, weight: 600, ls: -0.03, num: { suf: '%', floor: true }, k: k(enter(0.25), { value: P }, exit(D, { s: 0.8 })) }),
      text({ id: 'syncing', text: 'Syncing library', y: 54, size: 26, color: 'muted', k: k(enter(0.35), exit(D)) }),
      icon({ id: 'check', icon: 'check', size: 124, color: 'ink', sw: 12, k: pop(D + 0.08, { from: 0.4 }) }),
      // the label waits until the widening camera has room for it (it rose half out of frame)
      text({ id: 'label', text: 'Library synced', y: 250, size: 56, weight: 600, ls: -0.03, k: enter(D + 0.48, { dy: 24, y0: 250 }) }),
      text({ id: 'sub', text: '2,480 photos backed up', y: 308, size: 30, color: 'muted', k: enter(D + 0.6, { dy: 16, y0: 308 }) }),
    ];
  },
});

// 4 ─ Loading dots → Ready: a dot wave inside an ink pill, then the pill widens for the result
UIK.define({
  id: 'loading-dots', name: 'Loading dots → ready', cat: 'morph', T: 3.4,
  cam: { zoom: 2.6, k: { zoom: [[1.8, 2.45, 2.35, 'Power2 Smooth']] } },
  desc: 'Three dots ripple through two waves inside an ink pill (lifting and brightening in turn), then the pill widens and the dots swap for a check and Ready.',
  build: () => {
    const M = 1.8, W0 = 250, W1 = 420, H = 128;
    const wave = (i) => {
      const y = [], o = [0, [0.25, 0.4, 0.4, 'Power2 Out']];
      for (const c of [0.45, 1.05]) {
        const a = c + i * 0.12;
        y.push([a, a + 0.25, -20, 'Sine Smooth'], [a + 0.25, a + 0.5, 0, 'Sine Smooth']);
        o.push([a, a + 0.25, 1, 'Sine Smooth'], [a + 0.25, a + 0.5, 0.4, 'Sine Smooth']);
      }
      return { y, opacity: o };
    };
    return [
      rect({ id: 'pill', w: W0, h: H, r: 64, fill: 'ink', shadow: 1,
        k: k(popIn(0.1, 0.55), { w: [[M, M + 0.65, W1, 'Expo Out']] }), ch: [
          ...[-48, 0, 48].map((x, i) => circle({ id: 'dot' + i, x, d: 24, fill: 'inv', k: k(wave(i), exit(M, { s: 0.4, dur: 0.12 })) })),
          circle({ id: 'okDisc', x: -80, d: 64, fill: 'acc', k: pop(M + 0.16, { from: 0.4 }),
            ch: [icon({ icon: 'check', size: 34, color: '#FFFFFF', sw: 3 })] }),
          text({ id: 'ready', text: 'Ready', x: -32, ax: 0, size: 52, weight: 600, ls: -0.02, color: 'inv', k: enter(M + 0.1, { dx: -14, x0: -32 }) }),
        ] }),
    ];
  },
});

// 5 ─ Skeleton → content: pulsing placeholders unblur into the real post, block by block
UIK.define({
  id: 'skeleton-reveal', name: 'Skeleton → content', cat: 'feedback', T: 4.3, cam: 1.25,
  desc: 'Skeleton blocks breathe twice, then each one crossfades and unblurs into its real content on a stagger; the chart bars rise last.',
  build: () => {
    const R = 2.15;
    const L = [
      { y: -118, w: 600, s: 'Shipped the new onboarding flow today.' },
      { y: -74, w: 620, s: 'Sign-ups are up 18% in the first week —' },
      { y: -30, w: 400, s: 'thanks for the push, team.' },
    ];
    const at = [R, R + 0.1, R + 0.18, R + 0.28, R + 0.36, R + 0.44, R + 0.56];   // avatar, name, meta, 3 lines, image
    const sk = (i) => exit(at[i], { dur: 0.26, blur: 8 });
    const rv = (i) => enter(at[i], { d: 0.05, dur: 0.34, blur: 12, s: 1 });
    const BARS = [46, 62, 54, 80, 72, 98, 88, 124];
    return [
      rect({ id: 'card', w: 860, h: 620, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        group({ id: 'skeleton', k: { opacity: [0, [0.22, 0.38, 1, 'Power2 Out'], [0.5, 0.9, 0.45, 'Sine Smooth'], [0.9, 1.3, 1, 'Sine Smooth'],
                                               [1.3, 1.7, 0.45, 'Sine Smooth'], [1.7, 2.1, 1, 'Sine Smooth']] }, ch: [
          circle({ id: 'skAvatar', x: -338, y: -218, d: 84, fill: 'skel', k: sk(0) }),
          rect({ id: 'skName', x: -276, y: -234, pin: 'l', w: 190, h: 24, r: 12, fill: 'skel', k: sk(1) }),
          rect({ id: 'skMeta', x: -276, y: -198, pin: 'l', w: 230, h: 18, r: 9, fill: 'skel', k: sk(2) }),
          ...L.map((l, i) => rect({ id: 'skLine' + i, x: -380, y: l.y, pin: 'l', w: l.w, h: 20, r: 10, fill: 'skel', k: sk(3 + i) })),
          rect({ id: 'skImage', y: 150, w: 760, h: 220, r: 24, fill: 'skel', k: sk(6) }),
        ] }),
        circle({ id: 'avatar', x: -338, y: -218, d: 84, fill: 'ink', k: rv(0), ch: [text({ text: 'AR', size: 30, weight: 600, color: 'inv' })] }),
        text({ id: 'name', text: 'Ana Reyes', x: -276, y: -234, ax: 0, size: 34, weight: 600, ls: -0.02, k: rv(1) }),
        text({ id: 'meta', text: '2 min ago · Growth team', x: -276, y: -196, ax: 0, size: 24, color: 'muted', k: rv(2) }),
        ...L.map((l, i) => text({ id: 'line' + i, text: l.s, x: -380, y: l.y, ax: 0, size: 30, k: rv(3 + i) })),
        rect({ id: 'image', y: 150, w: 760, h: 220, r: 24, fill: 'panel', k: rv(6), ch: [
          text({ id: 'chartLbl', text: 'Sign-ups · last 8 days', x: -350, y: -76, ax: 0, size: 24, color: 'muted' }),
          ...BARS.map((h, i) => rect({ id: 'bar' + i, x: -266 + i * 76, y: 86, pin: 'b', w: 44, h: 0, r: 10, fill: i === BARS.length - 1 ? 'acc' : 'ink',
            k: { h: [[at[6] + 0.15 + i * 0.05, at[6] + 0.75 + i * 0.05, h, 'Power4 Out']] } })),
        ] }),
      ] }),
    ];
  },
});

// 6 ─ Status island: pill → wide (recording) → tall (waveform) → pill, driven by the record button
UIK.define({
  id: 'status-island', name: 'Status island', cat: 'morph', T: 5.3, cam: 1.35,
  desc: 'Record is tapped: the black pill at the top stretches into a wide island with a pulsing dot and a running timer, grows taller to show a live waveform, then collapses on stop.',
  build: () => {
    const C1 = 1.0, C2 = 4.1, A = C1 + 0.05, B = 2.15, E = C2 + 0.12, X = C2 - 0.02, TOP = -266, ez = 'Expo Out';
    const pulse = [];
    for (let t = A + 0.45; t + 0.6 < X; t += 0.6) pulse.push([t, t + 0.3, 0.6, 'Sine Smooth'], [t + 0.3, t + 0.6, 1, 'Sine Smooth']);
    const bars = Array.from({ length: 20 }, (_, j) => {
      const env = 0.35 + 0.65 * Math.sin(Math.PI * (j + 0.5) / 20), h = [8];
      let s = 0;
      for (let t = B + 0.25; t + 0.15 < X; t += 0.15, s++) {
        const amp = 0.45 + 0.55 * rnd(s * 13 + 1);
        h.push([t, t + 0.15, Math.round(10 + 62 * env * amp * (0.3 + 0.7 * rnd(j * 31 + s * 7))), 'Sine Smooth']);
      }
      return rect({ id: 'wave' + j, x: -209 + j * 22, w: 10, h: 8, r: 5, fill: 'inv', k: { h } });
    });
    return [
      group({ id: 'phone', k: popIn(0.1, 0.7), ch: [
        rect({ id: 'screen', w: 840, h: 580, r: 80, fill: 'card', shadow: 1 }),
        group({ id: 'statusBar', y: -236, k: k(enter(0.3), exit(B, { dur: 0.2 }), enter(E + 0.3)), ch: [
          text({ id: 'clock', text: '9:41', x: -330, size: 28, weight: 600 }),
          rect({ id: 'battery', x: 326, w: 46, h: 24, r: 8, stroke: 'ink', sw: 2.5, ch: [
            rect({ x: -18, pin: 'l', w: 30, h: 14, r: 4, fill: 'ink' }),
            rect({ x: 27, w: 4, h: 9, r: 2, fill: 'ink' }),
          ] }),
        ] }),
        rect({ id: 'island', y: TOP, pin: 't', w: 200, h: 60, r: 30, fill: 'ink', k: {
          w: [[A, A + 0.6, 560, ez], [B, B + 0.6, 640, ez], [E, E + 0.6, 200, ez]],
          h: [[A, A + 0.6, 84, ez], [B, B + 0.6, 230, ez], [E, E + 0.6, 60, ez]],
          r: [[A, A + 0.4, 42, 'Power3 Out'], [B, B + 0.4, 58, 'Power3 Out'], [E, E + 0.4, 30, 'Power3 Out']] } }),
        group({ id: 'recRow', y: TOP + 42, k: k(enter(A + 0.12, { d: 0 }), exit(X, { dur: 0.1 })), ch: [
          circle({ id: 'recDot', x: -236, d: 18, fill: 'acc', k: { scale: pulse } }),
          text({ id: 'recLbl', text: 'Recording', x: -212, ax: 0, size: 30, weight: 500, color: 'inv' }),
          text({ id: 'recTime', x: 244, ax: 1, size: 30, weight: 500, color: 'inv/60', num: { pre: '0:0', sep: false, floor: true },
            k: { value: [[A + 0.15, C2 - 0.2, 3, 'Linear']] } }),
        ] }),
        group({ id: 'waveform', y: -116, k: k(enter(B + 0.18, { d: 0, blur: 6 }), exit(X, { dur: 0.1 })), ch: bars }),
        text({ id: 'hintIdle', text: 'Tap to record', y: 22, size: 30, color: 'muted', k: k(enter(0.35), exit(A)) }),
        text({ id: 'hintRec', text: 'Tap to stop', y: 22, size: 30, color: 'muted', k: k(enter(A), exit(C2 + 0.05)) }),
        text({ id: 'hintSaved', text: 'Saved · 0:03', y: 22, size: 30, weight: 500, k: enter(C2 + 0.05) }),
        circle({ id: 'recRing', y: 162, d: 152, fill: 'card', stroke: 'dim', sw: 6, k: fadeIn(0.3) }),
        rect({ id: 'recBtn', y: 162, w: 120, h: 120, r: 60, fill: 'acc', k: k(pop(0.36, { from: 0.6 }), {
          w: [[C1, C1 + 0.45, 60, 'Power4 Out'], [C2, C2 + 0.45, 120, 'Power4 Out']],
          h: [[C1, C1 + 0.45, 60, 'Power4 Out'], [C2, C2 + 0.45, 120, 'Power4 Out']],
          r: [[C1, C1 + 0.35, 16, 'Power3 Out'], [C2, C2 + 0.35, 60, 'Power3 Out']] }) }),
      ] }),
      cursorLayer([[0, 560, 330], [0.45, 560, 330], [0.9, 26, 178], [1.35, 26, 178], [1.9, 300, 320], [3.5, 300, 320], [3.98, 26, 178], [4.5, 26, 178], [5.0, 250, 310]],
        [C1, C2], [], { inAt: 0.4 }),
    ];
  },
});

// 7 ─ File upload: a chip is dragged in, lands, widens into a row, uploads, turns to a check
UIK.define({
  id: 'file-upload', name: 'File upload card', cat: 'feedback', T: 4.8, cam: 1.3,
  desc: 'A file chip is carried into the drop zone and drops into place (y + scale), widens into a row, a progress line runs while the size counts up, then the tile swaps to a check and the card settles round the row.',
  build: () => {
    const G0 = [500, -290], GF = [-130, 70], D0 = 0.55, D1 = 1.35, DROP = 1.42, WID = 1.55, DONE = 3.5, SET = DONE + 0.14, O = 130, SH = 124;
    const P = [[1.85, 2.5, 9, 'Power3 Out'], [2.6, 3.42, 24, 'Power2 Smooth']];
    return [
      rect({ id: 'card', w: 900, h: 560, r: 44, fill: 'card', shadow: 1, k: k(popIn(0.1, 0.7), { h: [[SET, SET + 0.6, 560 - SH, 'Power4 Out']] }), ch: [
        text({ id: 'title', text: 'Upload files', x: -400, y: -212, ax: 0, size: 40, weight: 600, ls: -0.02,
          k: k(enter(0.22, { dx: -16, x0: -400 }), { y: [[SET, SET + 0.6, -212 + SH / 2, 'Power4 Out']] }) }),
        text({ id: 'sub', text: 'MP4 or MOV, up to 2 GB', x: -400, y: -168, ax: 0, size: 26, color: 'muted',
          k: k(enter(0.3), { y: [[SET, SET + 0.6, -168 + SH / 2, 'Power4 Out']] }) }),
        rect({ id: 'zone', y: 70, w: 800, h: 300, r: 30, fill: 'panel', stroke: 'dim', sw: 3, dash: true,
          k: k(fadeIn(0.34), { stroke: [[1.0, 1.2, 'ink', 'Power2 Out'], [DROP, DROP + 0.3, 'dim', 'Power2 Out'], [SET, SET + 0.4, 'panel', 'Power2 Out']],
                               h: [[SET, SET + 0.6, 300 - SH, 'Power4 Out']] }), ch: [
            group({ id: 'placeholder', k: k(enter(0.4, { d: 0 }), exit(1.02)), ch: [
              icon({ icon: 'upload', y: -44, size: 52, color: 'muted', sw: 2.4 }),
              text({ text: 'Drop your video here', y: 18, size: 30, weight: 500 }),
              text({ text: 'or browse files', y: 58, size: 24, color: 'muted' }),
            ] }),
          ] }),
      ] }),
      // the dragged file: its origin is the grab point, 130 px left of the row centre
      group({ id: 'file', x: G0[0], y: G0[1], k: {
          x: [[D0, D1, GF[0], 'Power2 Smooth']],
          y: [[D0, D1, GF[1] - 12, 'Sine Smooth'], [DROP, DROP + 0.45, GF[1], 'Power3 Out']],
          scale: [0.6, [0.3, 0.72, 1.04, 'Back Out'], [DROP, DROP + 0.4, 1, 'Power3 Out'], [DONE, DONE + 0.1, 1.02, 'Power2 Out'], [DONE + 0.1, DONE + 0.45, 1, 'Power3 Out']],
          opacity: [0, [0.3, 0.42, 1, 'Linear']],
          rot: [[D0, D0 + 0.3, -4, 'Power2 Out'], [DROP, DROP + 0.45, 0, 'Power3 Out']],
        }, ch: [
          rect({ id: 'row', x: -360 + O, pin: 'l', w: 420, h: 128, r: 26, fill: 'card', shadow: 2, k: { w: [[WID, WID + 0.6, 720, 'Expo Out']] } }),
          rect({ id: 'tile', x: -300 + O, w: 84, h: 84, r: 22, fill: 'soft', k: { fill: [[DONE, DONE + 0.25, 'acc', 'Power2 Out']] }, ch: [
            icon({ id: 'fileIcon', icon: 'video', size: 40, color: 'ink', sw: 2.4, k: exit(DONE, { s: 0.6 }) }),
            icon({ id: 'doneIcon', icon: 'check', size: 42, color: '#FFFFFF', sw: 3, k: pop(DONE + 0.06) }),
          ] }),
          text({ id: 'fname', text: 'launch-film.mov', x: -236 + O, y: -18, ax: 0, size: 32, weight: 600, ls: -0.01, k: { y: [[WID, WID + 0.5, -20, 'Power3 Out']] } }),
          text({ id: 'fsize', text: '24 MB', x: -236 + O, y: 20, ax: 0, size: 26, color: 'muted', k: exit(WID) }),
          text({ id: 'count', x: 330 + O, y: -20, ax: 1, size: 26, color: 'muted', num: { suf: ' MB of 24 MB', floor: true },
            k: k(enter(WID + 0.15), { value: P }, exit(DONE)) }),
          rect({ id: 'ptrack', x: -236 + O, y: 24, pin: 'l', w: 566, h: 8, r: 4, fill: 'soft', clip: true, k: k(fadeIn(WID + 0.2), exit(DONE, { blur: 4 })), ch: [
            rect({ id: 'pfill', x: -283, pin: 'l', w: 0, h: 8, r: 4, fill: 'acc', k: { w: P.map(([a, b, v, e]) => [a, b, 566 * v / 24, e]) } }),
          ] }),
          text({ id: 'fdone', text: '24 MB · Uploaded', x: -236 + O, y: 22, ax: 0, size: 26, color: 'muted', k: enter(DONE + 0.08) }),
        ] }),
      cursorLayer([[0, G0[0], G0[1]], [D0, G0[0], G0[1]], [D1, GF[0], GF[1] - 12], [1.6, GF[0], GF[1] - 12], [2.15, 330, 330]], [], [[0.45, DROP]], { inAt: 0.2 }),
    ];
  },
});

// 8 ─ Download button: pill → progress circle → accent check → "Saved" pill
UIK.define({
  id: 'download-button', name: 'Download button', cat: 'feedback', T: 4.5,
  cam: { zoom: 2.2, k: { zoom: [[1.0, 1.7, 2.6, 'Power2 Smooth'], [3.55, 4.25, 2.4, 'Power2 Smooth']] } },
  desc: 'A click drops the arrow through the pill, which contracts into a circle with a trimmed progress ring; at 100 it pops into an accent disc, draws a check and relaxes into a Saved pill.',
  build: () => {
    const C = 0.9, S = C + 0.12, P = 2.95, R = 3.55, RR = 40;
    return [
      rect({ id: 'btn', w: 440, h: 128, r: 64, fill: 'ink', shadow: 1, clip: true,
        k: k(popIn(0.1, 0.55), press(C), {
          w: [[S, S + 0.55, 128, 'Expo Out'], [R, R + 0.6, 320, 'Expo Out']],
          fill: [[P + 0.45, 'acc']],   // switched while the accent disc covers it
          scale: [[P, P + 0.1, 1.08, 'Power2 Out'], [P + 0.1, P + 0.5, 1, 'Power3 Out']] }),
        ch: [
          text({ id: 'dlLabel', text: 'Download', x: -40, size: 44, weight: 600, ls: -0.02, color: 'inv', k: k(enter(0.24), exit(C + 0.02)) }),
          icon({ id: 'dlArrow', icon: 'arrowDown', x: 114, size: 44, color: 'inv', sw: 2.8, k: k(enter(0.3), { y: [[C + 0.02, C + 0.28, 96, 'Power2 In']] }) }),
          path({ id: 'ringTrack', d: ring(RR), stroke: 'inv/22', sw: 8, k: k(enter(S + 0.3, { d: 0, s: 0.8 }), exit(P, { s: 0.8 })) }),
          path({ id: 'ringArc', d: ring(RR), stroke: 'acc', sw: 8, trimmed: true,
            k: k({ trimE: [0, [1.5, 1.95, 36, 'Power3 Out'], [2.05, 2.35, 58, 'Power3 Out'], [2.45, 2.9, 100, 'Power2 Smooth']] }, exit(P, { s: 0.8 })) }),
          circle({ id: 'accDisc', d: 128, fill: 'acc', k: pop(P, { from: 0.3, dur: 0.45 }) }),
          path({ id: 'tick', d: 'M-22 2 L-7 17 L22 -13', stroke: '#FFFFFF', sw: 9, trimmed: true,
            k: { trimE: [0, [P + 0.08, P + 0.42, 100, 'Power3 Out']], x: [[R, R + 0.6, -66, 'Expo Out']] } }),
          text({ id: 'saved', text: 'Saved', x: -26, ax: 0, size: 44, weight: 600, ls: -0.02, color: '#FFFFFF', k: enter(R + 0.12, { dx: -14, x0: -26 }) }),
        ] }),
      cursorLayer([[0, 330, 200], [0.3, 330, 200], [0.8, 60, 34], [1.15, 60, 34], [1.75, 240, 150]], [C], [], { inAt: 0.25 }),
    ];
  },
});

// 9 ─ Error shake: submit → the password field shakes, turns red, an alert slides in beneath
UIK.define({
  id: 'error-shake', name: 'Error shake', cat: 'feedback', T: 2.9, cam: { zoom: 1.3, y: 28 },
  desc: 'Sign in is clicked with a wrong password: the field shakes with decaying swings, its border turns red, and an alert line slides in beneath as the form makes room.',
  build: () => {
    const C = 1.2, S = C + 0.1, GROW = 52;
    const shake = [[S, S + 0.06, -24, 'Power2 Out'], [S + 0.06, S + 0.15, 20, 'Sine Smooth'], [S + 0.15, S + 0.24, -14, 'Sine Smooth'],
                   [S + 0.24, S + 0.33, 9, 'Sine Smooth'], [S + 0.33, S + 0.42, -4, 'Sine Smooth'], [S + 0.42, S + 0.52, 0, 'Sine Smooth']];
    return [
      group({ id: 'form', k: popIn(0.1, 0.7), ch: [
        rect({ id: 'card', y: -300, pin: 't', w: 820, h: 604, r: 48, fill: 'card', shadow: 1, k: { h: [[S + 0.08, S + 0.58, 604 + GROW, 'Power3 Out']] } }),
        text({ id: 'title', text: 'Welcome back', x: -340, y: -234, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -340 }) }),
        text({ id: 'sub', text: 'Sign in to your workspace', x: -340, y: -188, ax: 0, size: 28, color: 'muted', k: enter(0.3) }),
        text({ id: 'emailLbl', text: 'Email', x: -340, y: -130, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.36) }),
        rect({ id: 'email', y: -64, w: 680, h: 84, r: 20, fill: 'card', stroke: 'line', sw: 2, k: fadeIn(0.4),
          ch: [text({ text: 'ana@studio.co', x: -312, ax: 0, size: 30 })] }),
        text({ id: 'pwLbl', text: 'Password', x: -340, y: 12, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(0.44) }),
        group({ id: 'pwShake', y: 78, k: { x: [0, ...shake] }, ch: [
          rect({ id: 'pw', w: 680, h: 84, r: 20, fill: 'card', stroke: 'line', sw: 2,
            k: k(fadeIn(0.48), { stroke: [[S, S + 0.15, 'bad', 'Power2 Out']], sw: [[S, S + 0.15, 3, 'Power2 Out']] }), ch: [
              text({ id: 'dots', text: '••••••••••', x: -312, ax: 0, size: 34, ls: 0.12 }),
              icon({ id: 'eye', icon: 'eye', x: 298, size: 30, color: 'muted', sw: 2.4 }),
            ] }),
        ] }),
        group({ id: 'alert', y: 150, k: enter(S + 0.12, { dy: -14, y0: 150 }), ch: [
          icon({ icon: 'alert', x: -326, size: 28, color: 'bad', sw: 2.4 }),
          text({ text: 'Incorrect password. Try again.', x: -300, ax: 0, size: 26, weight: 500, color: 'bad' }),
        ] }),
        group({ id: 'submit', y: 202, k: { y: [[S + 0.08, S + 0.58, 202 + GROW, 'Power3 Out']] }, ch: [
          rect({ id: 'btn', w: 680, h: 92, r: 46, fill: 'ink', k: k(fadeIn(0.52), press(C, { to: 0.97 })),
            ch: [text({ text: 'Sign in', size: 32, weight: 600, color: 'inv' })] }),
        ] }),
      ] }),
      cursorLayer([[0, 560, 390], [0.55, 560, 390], [1.1, 150, 222], [1.5, 150, 222], [2.05, 440, 380]], [C], [], { inAt: 0.5 }),
    ];
  },
});

// 10 ─ Notification bell: rings, badge pops 3 → rolls to 4, a click opens the preview
UIK.define({
  id: 'notification-badge', name: 'Notification bell', cat: 'feedback', T: 3.8,
  cam: { zoom: 2.7, x: 240, y: -190, k: { zoom: [[1.85, 2.6, 1.8, 'Power2 Smooth']], x: [[1.85, 2.6, -18, 'Power2 Smooth']], y: [[1.85, 2.6, -58, 'Power2 Smooth']] } },
  desc: 'The bell rings on its top pivot with decaying swings; an accent badge pops in with 3, rings again and rolls to 4; a click opens a dropdown preview with the new item as the camera pulls back.',
  build: () => {
    const BX = 240, BY = -190, R1 = 0.62, R2 = 1.42, C = 2.4, O = C + 0.1;
    const ringK = (t) => [[t, t + 0.07, 15, 'Power2 Out'], [t + 0.07, t + 0.19, -12, 'Sine Smooth'], [t + 0.19, t + 0.31, 9, 'Sine Smooth'],
                          [t + 0.31, t + 0.42, -6, 'Sine Smooth'], [t + 0.42, t + 0.52, 3, 'Sine Smooth'], [t + 0.52, t + 0.62, 0, 'Sine Smooth']];
    const DW = 660, DH = 250, DX = BX + 72 - DW / 2, DY = BY + 72 + 20;
    return [
      rect({ id: 'bellBtn', x: BX, y: BY, w: 144, h: 144, r: 44, fill: 'card', shadow: 1, k: k(popIn(0.1, 0.6), press(C)), ch: [
        // the pivot sits on the top of the bell, so the swing hangs from it
        group({ id: 'bellPivot', y: -28, k: { rot: [0, ...ringK(R1), ...ringK(R2)] }, ch: [
          icon({ id: 'bell', icon: 'bell', y: 28, size: 68, color: 'ink', sw: 2.6 }),
        ] }),
      ] }),
      group({ id: 'badge', x: BX + 50, y: BY - 50, k: k(pop(R1 + 0.08, { from: 0.3 }), { scale: [[R2 + 0.06, R2 + 0.16, 1.16, 'Power2 Out'], [R2 + 0.16, R2 + 0.5, 1, 'Power3 Out']] }), ch: [
        circle({ id: 'badgeRim', d: 64, fill: 'card' }),
        rect({ id: 'badgeDisc', w: 52, h: 52, r: 26, fill: 'acc', clip: true, ch: [
          group({ id: 'roll', k: { y: [[R2 + 0.06, R2 + 0.46, -52, 'Power3 Out']] },
            ch: ['3', '4'].map((d, i) => text({ text: d, y: i * 52, size: 30, weight: 600, color: '#FFFFFF' })) }),
        ] }),
      ] }),
      rect({ id: 'dropdown', x: DX, y: DY, pin: 't', w: DW, h: DH, r: 32, fill: 'card', shadow: 2, origin: [0.4, -0.5],
        k: { y: [DY - 26, [O, O + 0.55, DY, 'Power4 Out']], opacity: [0, [O, O + 0.14, 1, 'Linear']],
             blur: [8, [O, O + 0.3, 0, 'Power2 Out']], scale: [0.94, [O, O + 0.55, 1, 'Power4 Out']] },
        ch: [
          text({ id: 'ddTitle', text: 'Notifications', x: -290, y: -80, ax: 0, size: 30, weight: 600, ls: -0.01, k: enter(O + 0.1) }),
          text({ id: 'ddCount', text: '4 new', x: 290, y: -80, ax: 1, size: 24, color: 'muted', k: enter(O + 0.14) }),
          rect({ id: 'ddLine', y: -40, w: DW, h: 2, fill: 'line' }),
          group({ id: 'item', y: 38, k: enter(O + 0.2, { dx: -16 }), ch: [
            circle({ id: 'avatar', x: -252, d: 76, fill: 'ink', ch: [text({ text: 'MR', size: 28, weight: 600, color: 'inv' })] }),
            text({ id: 'itemTitle', text: 'Maya Reyes commented', x: -196, y: -18, ax: 0, size: 28, weight: 500 }),
            text({ id: 'itemSub', text: '“Love the new layout”', x: -196, y: 20, ax: 0, size: 24, color: 'muted' }),
            text({ id: 'itemTime', text: 'now', x: 290, y: 20, ax: 1, size: 22, color: 'muted' }),
            circle({ id: 'unread', x: 282, y: -18, d: 16, fill: 'acc', k: pop(O + 0.4) }),
          ] }),
        ] }),
      cursorLayer([[0, 470, -40], [1.65, 470, -40], [2.3, 262, -170], [2.6, 262, -170], [3.2, 430, -20]], [C], [], { inAt: 1.55 }),
    ];
  },
});

// 11 ─ Step tracker: each Continue fills the rail to the next step and checks the last one
UIK.define({
  id: 'steps-progress', name: 'Step tracker', cat: 'feedback', T: 3.9, cam: 1.1,
  desc: 'Each Continue click fills the rail to the next step: the finished circle turns ink with a check, the next one takes the accent ring, and the labels hand the ink colour along.',
  build: () => {
    const X = [-420, -140, 140, 420], CY = -40, CS = [0.95, 1.8, 2.65], NAMES = ['Account', 'Profile', 'Team', 'Launch'];
    return [
      rect({ id: 'card', w: 1160, h: 460, r: 48, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Set up your workspace', x: -530, y: -160, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -530 }) }),
        text({ id: 'count', x: 530, y: -160, ax: 1, size: 26, color: 'muted', num: { pre: 'Step ', suf: ' of 4' },
          k: k(enter(0.3), { value: [1, ...CS.map((c, i) => [c + 0.3, i + 2])] }) }),
        rect({ id: 'rail', y: CY, w: 840, h: 6, r: 3, fill: 'dim', k: fadeIn(0.34) }),
        rect({ id: 'railFill', x: -420, y: CY, pin: 'l', w: 0, h: 6, r: 3, fill: 'ink',
          k: { w: CS.map((c, i) => [c + 0.05, c + 0.6, 280 * (i + 1), 'Power3 Out']) } }),
        ...X.map((x, i) => {
          const done = CS[i], cur = i ? CS[i - 1] + 0.38 : null, kk = [enter(0.36 + i * 0.07, { blur: 0 })];
          if (cur != null) kk.push({ stroke: [[cur, cur + 0.2, 'acc', 'Power2 Out']], scale: [[cur, cur + 0.1, 1.08, 'Power2 Out'], [cur + 0.1, cur + 0.4, 1, 'Power3 Out']] });
          if (done != null) kk.push({ stroke: [[done, done + 0.2, 'ink', 'Power2 Out']], fill: [[done, done + 0.2, 'ink', 'Power2 Out']],
                                      scale: [[done, done + 0.08, 0.9, 'Power2 Out'], [done + 0.08, done + 0.4, 1, 'Back Out']] });
          return circle({ id: 'step' + i, x, y: CY, d: 76, fill: 'card', stroke: i ? 'dim' : 'acc', sw: 4, k: k(...kk), ch: [
            text({ id: 'num' + i, text: String(i + 1), size: 30, weight: 600, color: i ? 'muted' : 'acc',
              k: k(cur != null ? { color: [[cur, cur + 0.2, 'acc', 'Power2 Out']] } : null, done != null ? exit(done, { s: 0.6 }) : null) }),
            ...(done != null ? [icon({ id: 'check' + i, icon: 'check', size: 34, color: 'inv', sw: 3, k: pop(done + 0.06) })] : []),
          ] });
        }),
        ...NAMES.map((s, i) => text({ id: 'lbl' + i, text: s, x: X[i], y: 34, size: 26, weight: 500, color: i ? 'muted' : 'ink',
          k: k(enter(0.4 + i * 0.07), i < 3 ? { color: [[CS[i] + 0.3, CS[i] + 0.5, 'muted', 'Power2 Out']] } : null,
                                      i ? { color: [[CS[i - 1] + 0.33, CS[i - 1] + 0.53, 'ink', 'Power2 Out']] } : null) })),
        rect({ id: 'continue', x: 410, y: 150, w: 240, h: 80, r: 40, fill: 'ink', k: k(fadeIn(0.5), ...CS.map((c) => press(c, { to: 0.95 }))), ch: [
          text({ id: 'contLbl', text: 'Continue', size: 28, weight: 600, color: 'inv', k: exit(CS[2] + 0.3) }),
          text({ id: 'finishLbl', text: 'Finish', size: 28, weight: 600, color: 'inv', k: enter(CS[2] + 0.3) }),
        ] }),
      ] }),
      cursorLayer([[0, 700, 390], [0.35, 700, 390], [0.85, 440, 166], [1.25, 454, 176], [1.7, 442, 168], [2.1, 456, 178], [2.55, 444, 168], [2.95, 444, 168], [3.45, 600, 330]],
        CS, [], { inAt: 0.3 }),
    ];
  },
});

// 12 ─ Password strength: dots type in, a 4-segment meter fills, colour and label step up
UIK.define({
  id: 'password-strength', name: 'Password strength', cat: 'feedback', T: 3.8, cam: 1.35,
  desc: 'The field focuses and a password types in as dots; the four-segment meter fills a segment at a time, its colour stepping from red to the accent as the label swaps Weak, Fair, Strong.',
  build: () => {
    const F = 0.85, L = [1.40, 2.01, 2.40, 2.79], SW = 128, SG = 14, X0 = -390;
    const accO = [0, [L[1], L[1] + 0.25, 0.5, 'Power2 Out'], [L[3], L[3] + 0.3, 1, 'Power2 Out']];
    return [
      rect({ id: 'card', w: 880, h: 400, r: 44, fill: 'card', shadow: 1, k: popIn(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Create a password', x: -390, y: -130, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.22, { dx: -16, x0: -390 }) }),
        rect({ id: 'field', y: -24, w: 780, h: 100, r: 24, fill: 'card', stroke: 'line', sw: 2,
          k: k(fadeIn(0.3), { stroke: [[F, F + 0.2, 'ink', 'Power2 Out']], sw: [[F, F + 0.2, 2.5, 'Power2 Out']] }), ch: [
            icon({ id: 'lock', icon: 'lock', x: -350, size: 32, color: 'muted', sw: 2.4 }),
            text({ id: 'pw', text: '••••••••••••', x: -312, ax: 0, size: 40, ls: 0.14, caret: true, caretColor: 'ink', caretFrom: F + 0.05,
              k: { reveal: [0, [1.05, 1.75, 5 / 12, 'Linear'], [1.95, 2.85, 1, 'Linear']] } }),
            icon({ id: 'eye', icon: 'eye', x: 350, size: 32, color: 'muted', sw: 2.4 }),
          ] }),
        ...[0, 1, 2, 3].map((i) => rect({ id: 'seg' + i, x: X0 + SW / 2 + i * (SW + SG), y: 72, w: SW, h: 10, r: 5, fill: 'dim', clip: true,
          k: fadeIn(0.38 + i * 0.04), ch: [
            rect({ id: 'segBad' + i, x: -SW / 2, pin: 'l', w: 0, h: 10, fill: 'bad', k: { w: [[L[i], L[i] + 0.35, SW, 'Power3 Out']] } }),
            rect({ id: 'segAcc' + i, x: -SW / 2, pin: 'l', w: 0, h: 10, fill: 'acc', k: { w: [[L[i], L[i] + 0.35, SW, 'Power3 Out']], opacity: accO } }),
          ] })),
        text({ id: 'weak', text: 'Weak', x: 390, y: 72, ax: 1, size: 26, weight: 600, color: 'bad', k: k(enter(L[0]), exit(L[1])) }),
        text({ id: 'fair', text: 'Fair', x: 390, y: 72, ax: 1, size: 26, weight: 600, k: k(enter(L[1]), exit(L[3])) }),
        text({ id: 'strong', text: 'Strong', x: 390, y: 72, ax: 1, size: 26, weight: 600, color: 'acc', k: enter(L[3]) }),
        text({ id: 'hint', text: 'Use 12+ characters with a number and a symbol', x: -390, y: 128, ax: 0, size: 24, color: 'muted', k: enter(0.42) }),
      ] }),
      cursorLayer([[0, 560, 330], [0.3, 560, 330], [0.75, 150, -14], [1.1, 150, -14], [1.65, 420, 300]], [F], [], { inAt: 0.25 }),
    ];
  },
});

// 13 ─ Typing → message: bouncing dots, then the bubble grows from its tail corner into the reply
UIK.define({
  id: 'typing-bubble', name: 'Typing → message', cat: 'morph', T: 3.5, cam: { zoom: 1.6, y: -4 },
  desc: 'A reply bubble bounces three dots through two beats, then grows out of its tail corner into the full message while the two lines of text blur in.',
  build: () => {
    const G = 1.9, BX = -300, BY = 150, W0 = 150, H0 = 84, W1 = 600, H1 = 164;
    const dotX = BX + W0 / 2, dotY = BY - H0 / 2;
    const bounce = (i) => {
      const y = [], o = [0, [0.62, 0.75, 0.45, 'Power2 Out']];
      for (const c of [0.75, 1.3]) {
        const a = c + i * 0.1;
        y.push([a, a + 0.18, dotY - 14, 'Power2 Out'], [a + 0.18, a + 0.36, dotY, 'Power2 In']);
        o.push([a, a + 0.18, 1, 'Power2 Out'], [a + 0.18, a + 0.36, 0.45, 'Power2 In']);
      }
      return { y, opacity: o };
    };
    return [
      rect({ id: 'outgoing', x: 380, y: -110, pin: 'br', w: 460, h: 92, radii: '46px 46px 12px 46px', fill: 'ink', k: popIn(0.1, 0.6),
        ch: [text({ text: 'Is the final cut ready?', size: 32, weight: 500, color: 'inv', k: enter(0.2) })] }),
      text({ id: 'read', text: 'Read 9:41', x: 380, y: -76, ax: 1, size: 22, color: 'muted', k: enter(0.34) }),
      circle({ id: 'avatar', x: -352, y: BY - 32, d: 64, fill: 'acc', k: popIn(0.5, 0.6), ch: [text({ text: 'JL', size: 24, weight: 600, color: '#FFFFFF' })] }),
      rect({ id: 'bubble', x: BX, y: BY, pin: 'bl', w: W0, h: H0, radii: '42px 42px 42px 12px', fill: 'card', shadow: 1,
        k: k(popIn(0.55, 0.6), { w: [[G, G + 0.65, W1, 'Expo Out']], h: [[G, G + 0.65, H1, 'Expo Out']] }) }),
      ...[0, 1, 2].map((i) => circle({ id: 'dot' + i, x: dotX + (i - 1) * 28, y: dotY, d: 16, fill: 'muted', k: k(bounce(i), exit(G, { s: 0.5, dur: 0.12 })) })),
      text({ id: 'line1', text: 'Yes! Exported it a minute ago.', x: BX + 38, y: BY - H1 + 58, ax: 0, size: 32, k: enter(G + 0.18, { dx: -12, x0: BX + 38 }) }),
      text({ id: 'line2', text: 'It’s in the shared folder.', x: BX + 38, y: BY - H1 + 104, ax: 0, size: 32, k: enter(G + 0.26, { dx: -12, x0: BX + 38 }) }),
      text({ id: 'who', text: 'Jamie · now', x: BX + 4, y: BY + 32, ax: 0, size: 22, color: 'muted', k: enter(G + 0.4) }),
    ];
  },
});

// 14 ─ Notification stack: each arrival pushes the previous cards down and back into a pile
UIK.define({
  id: 'notification-stack', name: 'Notification stack', cat: 'feedback', T: 3.4, cam: { zoom: 1.5, y: -8 },
  desc: 'Three notifications drop in from the top one after another; each arrival pushes the older cards down, smaller and fainter, until they settle into a neat pile.',
  build: () => {
    const Y0 = -30, TS = [0.15, 1.0, 1.85], DY = 26, DS = 0.06, DO = [1, 0.8, 0.55];
    const N = [
      { icon: 'video', title: 'Render finished', sub: 'launch-film.mp4 · 1080p' },
      { icon: 'message', title: 'Maya replied', sub: '“Looks great, ship it”' },
      { icon: 'cloud', title: 'Backup complete', sub: '2,480 files are safe' },
    ];
    return N.map((n, i) => {
      const t = TS[i], last = i === N.length - 1;
      const y = [Y0 - 130, [t, t + 0.6, Y0, 'Power4 Out']], sc = [1], op = [0, [t, t + 0.14, 1, 'Linear']];
      for (let j = i + 1; j < N.length; j++) {
        const d = j - i, tj = TS[j];
        y.push([tj, tj + 0.5, Y0 + DY * d, 'Power3 Out']);
        sc.push([tj, tj + 0.5, 1 - DS * d, 'Power3 Out']);
        op.push([tj, tj + 0.5, DO[d], 'Power3 Out']);
      }
      return rect({ id: 'note' + i, y: Y0, w: 820, h: 150, r: 36, fill: 'card', shadow: 2,
        k: { y, scale: sc, opacity: op, blur: [12, [t, t + 0.35, 0, 'Power2 Out']] }, ch: [
          group({ id: 'noteContent' + i, k: k(enter(t + 0.06, { d: 0 }), last ? null : exit(TS[i + 1], { dur: 0.3, blur: 4 })), ch: [
            rect({ x: -335, w: 90, h: 90, r: 26, fill: last ? 'acc' : 'soft',
              ch: [icon({ icon: n.icon, size: 44, color: last ? '#FFFFFF' : 'ink', sw: 2.4 })] }),
            text({ text: n.title, x: -270, y: -22, ax: 0, size: 32, weight: 600, ls: -0.01 }),
            text({ text: n.sub, x: -270, y: 20, ax: 0, size: 26, color: 'muted' }),
            text({ text: 'now', x: 370, y: -22, ax: 1, size: 24, color: 'muted' }),
          ] }),
        ] });
    });
  },
});
})();
