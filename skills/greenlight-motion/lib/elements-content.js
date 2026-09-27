/* UI Motion Kit — content elements. */
(function () {
const { rect, circle, text, path, icon, group, k, enter, exit, pop, press, cursorLayer, stagger } = UIK.h;

// ── local helpers ──
// the main shape's entrance: a scale pop from `from` with a 10 % settle
const appear = (t, from = 0.6) => ({ scale: [from, [t, t + 0.52, 1, 'Back Out']], opacity: [0, [t, t + 0.12, 1, 'Linear']] });
// deterministic pseudo random (equalizer heights etc.)
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
// a count that rolls from `a` to `b` inside a clipping chip (old value leaves up, new one rises from below)
const rollText = (a, b, t, o = {}) => {
  const d = o.d ?? 44, base = { size: o.size ?? 24, weight: o.weight ?? 600, color: o.color };
  return [
    text(Object.assign({ text: a, k: { y: [[t, t + 0.45, -d, 'Power3 Out']] } }, base)),
    text(Object.assign({ text: b, y: d, k: { y: [[t, t + 0.45, 0, 'Power3 Out']] } }, base)),
  ];
};
// extra y segments for a cursor (an arc through a drag) — the engine sorts segments by time
const cursorArc = (c, segs) => { c.k.y = c.k.y.concat(segs); return c; };

// 1 ─ Chat thread: bubbles pop from their tail corners, the thread scrolls up as each one lands
UIK.define({
  id: 'chat-thread', name: 'Chat thread', cat: 'content', T: 5.5, cam: 1.05,
  desc: 'Bubbles pop from their tail corners on alternating sides while earlier ones scroll up. The cursor sends a typed reply, a typing indicator turns into the answer, then an attached file goes out and is read.',
  build: () => {
    const S1 = 0.62, TY0 = 1.0, TY1 = 1.55, C1 = 1.75, DOTS = 2.25, S3 = 3.05, ATT = 3.5, C2 = 4.15, READ = 4.7;
    const L = -410, R = 410, B = [236, 328, 420, 552];
    const IN = '30px 30px 30px 8px', OUT = '30px 30px 8px 30px';
    const bub = (t) => pop(t, { from: 0.3, dur: 0.46 });
    const shift = (t, y) => [t, t + 0.5, y, 'Power3 Out'];
    const dots = [0, 1, 2].map((i) => {
      const y = [];
      for (const t0 of [2.42, 2.92]) { const t = t0 + i * 0.1; y.push([t, t + 0.18, -9, 'Sine Smooth'], [t + 0.18, t + 0.36, 0, 'Sine Smooth']); }
      return circle({ id: 'dot' + i, x: -22 + i * 22, d: 14, fill: 'muted', k: { y } });
    });
    return [
      rect({ id: 'card', w: 900, h: 780, r: 44, fill: 'card', shadow: 1, k: appear(0.1, 0.7), ch: [
        group({ id: 'header', k: enter(0.26), ch: [
          circle({ id: 'avatar', x: -364, y: -322, d: 76, fill: 'soft', ch: [text({ text: 'M', size: 32, weight: 600 })] }),
          circle({ id: 'online', x: -336, y: -294, d: 24, fill: 'acc', stroke: 'card', sw: 4 }),
          text({ id: 'name', text: 'Maya Chen', x: -306, y: -338, ax: 0, size: 32, weight: 600 }),
          text({ id: 'status', text: 'Active now', x: -306, y: -302, ax: 0, size: 24, color: 'muted' }),
          icon({ id: 'call', icon: 'video', x: 384, y: -322, size: 36, color: 'ink' }),
        ] }),
        rect({ id: 'hairline', y: -262, w: 900, h: 2, fill: 'line' }),
        group({ id: 'thread', w: 900, h: 520, clip: true, ch: [
          group({ id: 'stack', k: { y: [shift(C1 + 0.02, -92), shift(DOTS, -184), shift(C2 + 0.02, -316), shift(READ - 0.04, -352)] }, ch: [
            rect({ id: 'b1', pin: 'bl', x: L, y: B[0], w: 352, h: 72, radii: IN, fill: 'soft', k: bub(S1),
              ch: [text({ text: 'Did the render finish?', size: 30 })] }),
            rect({ id: 'b2', pin: 'br', x: R, y: B[1], w: 354, h: 72, radii: OUT, fill: 'ink', k: bub(C1 + 0.04),
              ch: [text({ text: 'Yes, 4K in 38 seconds', size: 30, color: 'inv' })] }),
            rect({ id: 'typing', pin: 'bl', x: L, y: B[2], w: 116, h: 72, radii: IN, fill: 'soft', k: k(bub(DOTS + 0.02), exit(S3, { s: 0.7, blur: 4 })), ch: dots }),
            rect({ id: 'b3', pin: 'bl', x: L, y: B[2], w: 330, h: 72, radii: IN, fill: 'soft', k: bub(S3 + 0.03),
              ch: [text({ text: 'Perfect, send it over', size: 30 })] }),
            rect({ id: 'b4', pin: 'br', x: R, y: B[3], w: 370, h: 116, radii: OUT, fill: 'ink', k: bub(C2 + 0.04), ch: [
              rect({ id: 'fileTile', x: -115, w: 76, h: 76, r: 20, fill: 'inv/14', ch: [icon({ icon: 'video', size: 36, color: 'inv' })] }),
              text({ text: 'final-cut.mp4', x: -60, y: -17, ax: 0, size: 28, weight: 500, color: 'inv' }),
              text({ text: '24 MB · 0:38', x: -60, y: 20, ax: 0, size: 22, color: 'inv/60' }),
            ] }),
            text({ id: 'read', text: 'Read 10:42', x: R, y: B[3] + 32, ax: 1, size: 22, color: 'muted', k: enter(READ) }),
          ] }),
        ] }),
        rect({ id: 'field', x: -54, y: 322, w: 744, h: 80, r: 40, fill: 'soft', k: enter(0.34), ch: [
          icon({ id: 'attach', icon: 'plus', x: -330, size: 32, color: 'muted', sw: 2.6, k: press(ATT, { to: 0.8 }) }),
          text({ id: 'placeholder', text: 'Message', x: -292, ax: 0, size: 28, color: 'muted',
            k: { opacity: [1, [TY0 - 0.05, TY0 + 0.03, 0, 'Power2 In'], [C1 + 0.12, C1 + 0.4, 1, 'Power2 Out'], [ATT + 0.02, ATT + 0.1, 0, 'Power2 In'], [C2 + 0.12, C2 + 0.4, 1, 'Power2 Out']] } }),
          text({ id: 'typed', text: 'Yes, 4K in 38 seconds', x: -292, ax: 0, size: 28, caret: true, caretColor: 'ink', caretFrom: TY0 - 0.05, caretUntil: C1,
            k: k({ reveal: [0, [TY0, TY1, 1, 'Linear']] }, exit(C1, { dur: 0.1 })) }),
          rect({ id: 'fileChip', x: -164, w: 256, h: 56, r: 18, fill: 'card', shadow: 3, k: k(enter(ATT + 0.02, { d: 0, dx: -14, x0: -164, blur: 6 }), exit(C2, { dur: 0.1 })), ch: [
            icon({ icon: 'video', x: -98, size: 28, color: 'ink' }),
            text({ text: 'final-cut.mp4', x: -72, ax: 0, size: 24, weight: 500 }),
          ] }),
        ] }),
        circle({ id: 'send', x: 382, y: 322, d: 80, fill: 'dim',
          k: k(enter(0.4), { fill: [[TY0, TY0 + 0.2, 'acc', 'Power2 Out'], [C1 + 0.1, C1 + 0.3, 'dim', 'Power2 Out'], [ATT, ATT + 0.2, 'acc', 'Power2 Out'], [C2 + 0.1, C2 + 0.3, 'dim', 'Power2 Out']] }, press(C1, { to: 0.9 }), press(C2, { to: 0.9 })),
          ch: [icon({ icon: 'arrowUp', size: 36, color: '#FFFFFF', sw: 2.8 })] }),
      ] }),
      cursorLayer([[0, 620, 470], [0.85, 620, 470], [1.62, 394, 332], [2.55, 394, 332], [3.35, -380, 334], [3.62, -380, 334], [4.05, 394, 332], [4.45, 394, 332], [5.05, 560, 450]],
        [C1, ATT, C2], [], { inAt: 0.8 }),
    ];
  },
});

// 2 ─ Drag & drop: a file stack is dragged into a dashed zone, the zone collapses into a folder row
UIK.define({
  id: 'file-drag-drop', name: 'Drag & drop', cat: 'content', T: 4.0,
  cam: { zoom: 1.1, x: -80, k: { zoom: [[2.45, 3.3, 1.3, 'Power2 Smooth']], x: [[2.45, 3.3, 160, 'Power2 Smooth']] } },
  desc: 'The cursor grabs a stack of files and carries it into a dashed drop zone. The zone lights up on hover; on release the stack snaps in and the zone collapses into an uploaded folder row with a check.',
  build: () => {
    const G = 1.25, D0 = 1.3, D = 2.2, HV = 1.72, CX = 160, ZY = 50, EZ = 'Expo Out';
    const m0 = D + 0.12, m1 = D + 0.8;
    return [
      rect({ id: 'card', x: CX, w: 1000, h: 640, r: 44, fill: 'card', shadow: 1, k: k(appear(0.1, 0.7), { h: [[m0, m1, 340, EZ]] }), ch: [
        text({ id: 'title', text: 'Upload files', x: -440, y: -250, ax: 0, size: 44, weight: 600, ls: -0.02, k: k(enter(0.26), { y: [[m0, m1, -100, EZ]] }) }),
        text({ id: 'limit', text: 'Up to 2 GB', x: 440, y: -250, ax: 1, size: 26, color: 'muted', k: k(enter(0.32), { y: [[m0, m1, -100, EZ]] }) }),
        rect({ id: 'zone', y: ZY, w: 880, h: 440, r: 32, stroke: 'dim', sw: 3, dash: true,
          k: k(enter(0.36, { blur: 0 }), {
            stroke: [[HV, HV + 0.2, 'acc', 'Power2 Out']],
            fill: [[HV, HV + 0.2, 'acc/6', 'Power2 Out'], [m0, m0 + 0.3, 'soft', 'Power2 Out']],
            sw: [[m0, m0 + 0.2, 0, 'Power2 Out']], h: [[m0, m1, 132, EZ]], r: [[m0, m0 + 0.5, 28, 'Power3 Out']] }),
          ch: [
            group({ id: 'zoneContent', k: k(enter(0.45), exit(D + 0.02)), ch: [
              circle({ id: 'upTile', y: -62, d: 104, fill: 'soft', k: { fill: [[HV, HV + 0.2, 'acc', 'Power2 Out']], y: [[HV, HV + 0.35, -72, 'Power3 Out']] },
                ch: [icon({ id: 'upIcon', icon: 'upload', size: 46, color: 'ink', sw: 2.6, k: { color: [[HV, HV + 0.2, '#FFFFFF', 'Power2 Out']] } })] }),
              text({ id: 'dropLbl', text: 'Drop files here', y: 32, size: 34, weight: 600, k: exit(HV) }),
              text({ id: 'releaseLbl', text: 'Release to upload', y: 32, size: 34, weight: 600, k: enter(HV) }),
              text({ id: 'hint', text: 'or click to browse', y: 74, size: 26, color: 'muted' }),
            ] }),
            group({ id: 'rowContent', k: enter(D + 0.3, { d: 0 }), ch: [
              rect({ id: 'folder', x: -370, w: 80, h: 80, r: 22, fill: 'ink', k: pop(D + 0.34, { from: 0.6 }), ch: [icon({ icon: 'folder', size: 38, color: 'inv', sw: 2.4 })] }),
              text({ id: 'folderName', text: 'brand-assets', x: -310, y: -17, ax: 0, size: 32, weight: 600, k: enter(D + 0.4, { dx: -16, x0: -310 }) }),
              text({ id: 'folderMeta', text: '3 files · 18.4 MB', x: -310, y: 21, ax: 0, size: 24, color: 'muted', k: enter(D + 0.48) }),
              text({ id: 'uploaded', text: 'Uploaded', x: 334, ax: 1, size: 26, color: 'muted', k: enter(D + 0.72) }),
              circle({ id: 'okDisc', x: 384, d: 60, fill: 'acc', k: pop(D + 0.62, { from: 0.4 }) }),
              path({ id: 'okTick', x: 384, d: 'M-12 1 L-3 10 L13 -8', stroke: '#FFFFFF', sw: 5, trimmed: true, k: { trimE: [0, [D + 0.74, D + 1.05, 100, 'Power3 Out']] } }),
            ] }),
          ] }),
      ] }),
      group({ id: 'chip', x: -640, y: 190, k: k(pop(0.55, { from: 0.6, dur: 0.5 }), {
          x: [[D0, D, CX, 'Power2 Smooth']], y: [[D0, D, ZY, 'Sine Smooth']],
          rot: [[G, G + 0.3, -4, 'Power3 Out'], [D - 0.1, D + 0.12, 0, 'Power2 Out']],
          scale: [[G, G + 0.3, 1.05, 'Power3 Out'], [D, D + 0.16, 0.82, 'Power2 In']],
          opacity: [[D + 0.04, D + 0.18, 0, 'Power2 In']], blur: [[D + 0.04, D + 0.18, 6, 'Power2 In']] }), ch: [
        rect({ id: 'back2', x: 16, y: 16, w: 320, h: 100, r: 24, fill: 'card', shadow: 3, rot: 5, k: { rot: [[G, G + 0.3, 9, 'Power3 Out'], [D - 0.1, D + 0.1, 5, 'Power2 Out']] } }),
        rect({ id: 'back1', x: 8, y: 8, w: 320, h: 100, r: 24, fill: 'card', shadow: 3, rot: 2.5, k: { rot: [[G, G + 0.3, 4.5, 'Power3 Out'], [D - 0.1, D + 0.1, 2.5, 'Power2 Out']] } }),
        rect({ id: 'chipFace', w: 320, h: 100, r: 24, fill: 'card', shadow: 2, ch: [
          rect({ x: -110, w: 64, h: 64, r: 18, fill: 'soft', ch: [icon({ icon: 'image', size: 32, color: 'ink' })] }),
          text({ text: 'brand-assets', x: -64, y: -15, ax: 0, size: 28, weight: 600 }),
          text({ text: '3 files · 18.4 MB', x: -64, y: 18, ax: 0, size: 22, color: 'muted' }),
        ] }),
      ] }),
      cursorLayer([[0, -380, 430], [0.72, -380, 430], [1.15, -596, 204], [D0, -596, 204], [D, CX + 44, ZY + 14], [2.62, CX + 44, ZY + 14], [3.25, 440, 260]],
        [], [[G, D]], { inAt: 0.68 }),
    ];
  },
});

// 3 ─ Kanban: a card is dragged across columns, the source closes the gap, a dashed slot opens in the target
UIK.define({
  id: 'kanban-drag', name: 'Kanban drag', cat: 'content', T: 3.7, cam: 1.15,
  desc: 'The cursor lifts a card (it tilts and gains a deeper shadow) and carries it across. The source column closes the gap, a dashed slot opens in Done, the card lands in it and its status turns into a check.',
  build: () => {
    const G = 1.2, D0 = 1.28, D = 2.15, MID = 1.72, XL = -305, XR = 305, CY = [-70, 66, 202], HY = -176;
    const face = (id, title, meta, status) => rect({ id, w: 540, h: 120, r: 22, fill: 'card', shadow: 3, ch: [
      text({ text: title, x: -236, y: -18, ax: 0, size: 28, weight: 600 }),
      text({ text: meta, x: -236, y: 22, ax: 0, size: 22, color: 'muted' }),
      ...status,
    ] });
    const ring = () => circle({ x: 226, d: 36, stroke: 'dim', sw: 3 });
    const card = (id, title, meta, x, y, kk, status) => group({ id, x, y, k: kk, ch: [face(id + 'Face', title, meta, status || [ring()])] });
    const head = (label, x, count) => group({ k: enter(0.42), ch: [
      text({ text: label, x, y: HY, ax: 0, size: 30, weight: 600 }),
      rect({ x: x + label.length * 15.5 + 34, y: HY, w: 46, h: 40, r: 20, fill: 'card', clip: true, ch: count }),
      icon({ icon: 'plus', x: x + 506, y: HY, size: 28, color: 'muted' }),
    ] });
    const cur = cursorLayer([[0, 420, 430], [0.62, 420, 430], [1.1, XL - 30, CY[1] + 10], [D0, XL - 30, CY[1] + 10], [D, XR - 30, CY[1] + 10], [2.5, XR - 30, CY[1] + 10], [3.05, 520, 330]],
      [], [[G, D]], { inAt: 0.6 });
    cursorArc(cur, [[D0, MID, CY[1] - 24, 'Sine Smooth'], [MID, D, CY[1] + 10, 'Sine Smooth']]);
    return [
      rect({ id: 'board', w: 1240, h: 680, r: 40, fill: 'card', shadow: 1, k: appear(0.1, 0.7), ch: [
        text({ id: 'title', text: 'Sprint 14', x: -580, y: -276, ax: 0, size: 40, weight: 600, ls: -0.02, k: enter(0.26) }),
        text({ id: 'sub', text: 'Launch week', x: 580, y: -276, ax: 1, size: 26, color: 'muted', k: enter(0.32) }),
        rect({ id: 'colTodo', x: XL, y: 35, w: 590, h: 510, r: 30, fill: 'panel', k: enter(0.3, { blur: 0 }) }),
        rect({ id: 'colDone', x: XR, y: 35, w: 590, h: 510, r: 30, fill: 'panel', k: enter(0.36, { blur: 0 }) }),
        head('To do', XL - 255, rollText('3', '2', 1.5)),
        head('Done', XR - 255, rollText('1', '2', D + 0.1)),
        card('todo0', 'Write launch notes', 'Content · 1d', XL, CY[0], enter(0.48, { dy: 14, y0: CY[0] })),
        card('todo2', 'Pricing table QA', 'QA · 3d', XL, CY[2], k(enter(0.62, { dy: 14, y0: CY[2] }), { y: [[1.48, 1.98, CY[1], 'Power3 Out']] })),
        card('done0', 'Set up analytics', 'Ops · done', XR, CY[0], enter(0.56, { dy: 14, y0: CY[0] }),
          [circle({ x: 226, d: 36, fill: 'ink', ch: [icon({ icon: 'check', size: 20, color: 'inv', sw: 3 })] })]),
        rect({ id: 'slot', x: XR, y: CY[1], w: 540, h: 120, r: 22, stroke: 'dim', sw: 3, dash: true,
          k: { opacity: [0, [1.6, 1.8, 1, 'Power2 Out'], [D + 0.05, D + 0.2, 0, 'Power2 Out']], h: [70, [1.6, 1.95, 120, 'Power3 Out']] } }),
        group({ id: 'drag', x: XL, y: CY[1], k: k(enter(0.55, { dy: 14, y0: CY[1] }), {
            x: [[D0, D, XR, 'Power2 Smooth']], y: [[D0, MID, CY[1] - 34, 'Sine Smooth'], [MID, D, CY[1], 'Sine Smooth']],
            rot: [[G, G + 0.3, 3, 'Power3 Out'], [D - 0.05, D + 0.3, 0, 'Power3 Out']],
            scale: [[G, G + 0.3, 1.04, 'Power3 Out'], [D - 0.05, D + 0.3, 1, 'Power3 Out']] }), ch: [
          rect({ id: 'liftShadow', w: 540, h: 120, r: 22, fill: 'card', shadow: 2, k: { opacity: [0, [G, G + 0.2, 1, 'Power2 Out'], [D, D + 0.3, 0, 'Power2 Out']] } }),
          face('dragFace', 'Hero section copy', 'Design · 2d', [
            ring(),
            circle({ id: 'doneDisc', x: 226, d: 36, fill: 'acc', k: pop(D + 0.15, { from: 0.3 }) }),
            path({ id: 'doneTick', x: 226, d: 'M-7 0 L-2 5 L8 -5', stroke: '#FFFFFF', sw: 3.5, trimmed: true, k: { trimE: [0, [D + 0.26, D + 0.5, 100, 'Power3 Out']] } }),
          ]),
        ] }),
      ] }),
      cur,
    ];
  },
});

// 4 ─ Date picker: two clicks pick a range, the fill grows row by row between them
UIK.define({
  id: 'calendar-pick', formats: ['html'], name: 'Date picker', cat: 'content', T: 3.9, cam: 1.12,
  desc: 'A month grid builds in row by row. The cursor clicks a start and an end date: each pops an ink circle, then the range fill grows across the first row and continues on the next while the header reads the range.',
  build: () => {
    const C1 = 1.45, C2 = 2.35;
    const X = (c) => -264 + c * 88, RY = [-52, 34, 120, 206, 292];
    const pos = (d) => [X((d - 1) % 7), RY[Math.floor((d - 1) / 7)]];
    const [x12, y12] = pos(12), [x16, y16] = pos(16);
    const rows = RY.map((y, r) => group({ id: 'row' + r, y, k: enter(0.5 + r * 0.06, { dy: 12, y0: y }), ch: [
      ...Array.from({ length: 7 }, (_, c) => r * 7 + c + 1).filter((d) => d <= 31).map((d) => text({ id: 'd' + d, text: String(d), x: X((d - 1) % 7), size: 28, weight: 500,
        color: d < 10 ? 'muted' : 'ink', k: d === 12 ? { color: [[C1, C1 + 0.15, 'inv', 'Power2 Out']] } : d === 16 ? { color: [[C2, C2 + 0.15, 'inv', 'Power2 Out']] } : undefined })),
      ...(r === 1 ? [circle({ id: 'today', x: X(2), y: 26, d: 8, fill: 'acc' })] : []),
    ] }));
    return [
      rect({ id: 'card', w: 720, h: 740, r: 44, fill: 'card', shadow: 1, k: appear(0.1, 0.7), ch: [
        text({ id: 'readout0', text: 'Select dates', x: -304, y: -300, ax: 0, size: 44, weight: 600, ls: -0.02, k: k(enter(0.28), exit(C1 + 0.02)) }),
        text({ id: 'readout1', text: 'Mar 12', x: -304, y: -300, ax: 0, size: 44, weight: 600, ls: -0.02, k: k(enter(C1 + 0.02, { d: 0.1 }), exit(C2 + 0.02)) }),
        text({ id: 'readout2', text: 'Mar 12 – 16', x: -304, y: -300, ax: 0, size: 44, weight: 600, ls: -0.02, k: enter(C2 + 0.02, { d: 0.1 }) }),
        text({ id: 'nights', text: '5 days', x: 304, y: -300, ax: 1, size: 28, color: 'muted', k: enter(C2 + 0.3) }),
        rect({ id: 'hairline', y: -246, w: 720, h: 2, fill: 'line' }),
        group({ id: 'nav', k: enter(0.36), ch: [
          text({ text: 'March 2026', x: -304, y: -186, ax: 0, size: 30, weight: 600 }),
          icon({ icon: 'chevronLeft', x: 226, y: -186, size: 30, color: 'muted' }),
          icon({ icon: 'chevronRight', x: 290, y: -186, size: 30, color: 'ink' }),
        ] }),
        group({ id: 'weekdays', k: enter(0.42), ch: 'SMTWTFS'.split('').map((s, c) => text({ text: s, x: X(c), y: -122, size: 22, weight: 500, color: 'muted' })) }),
        rect({ id: 'range1', pin: 'l', x: x12, y: y12, w: 0, h: 70, r: 35, fill: 'acc/16', k: { w: [[C2 + 0.05, C2 + 0.42, 299 - x12, 'Power3 Out']] } }),
        rect({ id: 'range2', pin: 'l', x: -299, y: y16, w: 0, h: 70, r: 35, fill: 'acc/16', k: { w: [[C2 + 0.32, C2 + 0.66, x16 + 299, 'Power3 Out']] } }),
        circle({ id: 'sel12', x: x12, y: y12, d: 70, fill: 'ink', k: pop(C1 + 0.02, { from: 0.5 }) }),
        circle({ id: 'sel16', x: x16, y: y16, d: 70, fill: 'ink', k: pop(C2 + 0.02, { from: 0.5 }) }),
        ...rows,
      ] }),
      cursorLayer([[0, 420, 420], [0.9, 420, 420], [1.35, x12 + 12, y12 + 14], [1.6, x12 + 12, y12 + 14], [2.25, x16 + 12, y16 + 14], [2.7, x16 + 12, y16 + 14], [3.3, 470, 300]],
        [C1, C2], [], { inAt: 0.85 }),
    ];
  },
});

// 5 ─ Profile card: stats count up, Follow morphs into Following, the follower count rolls +1
UIK.define({
  id: 'profile-follow', name: 'Profile card', cat: 'content', T: 3.7, cam: 1.1,
  desc: 'The avatar ring draws on and the stats count up. A click on Follow morphs the ink pill into a soft Following pill with a drawn check, and the follower count rolls its last digit up by one.',
  build: () => {
    const C = 1.9, FX = -200, LEFT = FX - 54;   // "1,284" is 108 px wide at 40 / 600 → its left edge
    const stat = (x, value, label, t) => [
      text({ x, y: -20, size: 40, weight: 600, num: {}, k: { value: [[t, t + 0.85, value, 'Power3 Out']] } }),
      text({ text: label, x, y: 26, size: 24, color: 'muted' }),
    ];
    return [
      rect({ id: 'card', w: 700, h: 720, r: 48, fill: 'card', shadow: 1, k: appear(0.1, 0.7), ch: [
        path({ id: 'ring', y: -205, d: 'M0 -94 A94 94 0 1 1 0 94 A94 94 0 1 1 0 -94', stroke: 'acc', sw: 5, trimmed: true, k: { trimE: [0, [0.3, 1.0, 100, 'Power2 Smooth']] } }),
        circle({ id: 'avatar', y: -205, d: 164, fill: 'soft', k: pop(0.22, { from: 0.6, dur: 0.5 }), ch: [text({ text: 'LO', size: 56, weight: 600, ls: -0.02 })] }),
        text({ id: 'name', text: 'Lena Ortiz', y: -60, size: 48, weight: 600, ls: -0.02, k: enter(0.4, { dy: 14, y0: -60 }) }),
        text({ id: 'handle', text: '@lenamakes', y: -12, size: 28, color: 'muted', k: enter(0.48) }),
        rect({ id: 'stats', y: 100, w: 604, h: 136, r: 30, fill: 'soft', k: enter(0.56, { blur: 0 }), ch: [
          text({ id: 'followers', x: FX, y: -20, size: 40, weight: 600, num: {}, k: { value: [[0.66, 1.5, 1284, 'Power3 Out']], opacity: [[C + 0.08, 0]] } }),
          group({ id: 'followersRoll', k: { opacity: [0, [C + 0.08, 1]] }, ch: [
            text({ text: '1,28', x: LEFT, y: -20, ax: 0, size: 40, weight: 600 }),
            rect({ x: LEFT + 83.2 + 12.4, y: -20, w: 30, h: 48, clip: true, ch: [group({ k: { y: [[C + 0.1, C + 0.55, -48, 'Power3 Out']] }, ch: [
              text({ text: '4', size: 40, weight: 600 }), text({ text: '5', y: 48, size: 40, weight: 600 }),
            ] })] }),
          ] }),
          text({ text: 'Followers', x: FX, y: 26, size: 24, color: 'muted' }),
          ...stat(0, 312, 'Following', 0.72),
          ...stat(200, 86, 'Posts', 0.78),
          text({ id: 'plusOne', text: '+1', x: LEFT + 136, y: -26, size: 26, weight: 600, color: 'acc',
            k: { opacity: [0, [C + 0.12, C + 0.25, 1, 'Power2 Out'], [C + 0.8, C + 1.05, 0, 'Power2 In']], y: [-24, [C + 0.12, C + 1.05, -58, 'Power3 Out']] } }),
        ] }),
        rect({ id: 'follow', y: 262, w: 604, h: 96, r: 48, fill: 'ink',
          k: k(enter(0.66, { blur: 0 }), { fill: [[C, C + 0.3, 'soft', 'Power2 Out']], w: [[C, C + 0.6, 420, 'Expo Out']] }, press(C)), ch: [
          group({ id: 'followLbl', k: exit(C + 0.02), ch: [
            icon({ icon: 'plus', x: -57, size: 30, color: 'inv', sw: 2.8 }),
            text({ text: 'Follow', x: -32, ax: 0, size: 34, weight: 600, color: 'inv' }),
          ] }),
          group({ id: 'followingLbl', k: enter(C + 0.06), ch: [
            path({ id: 'tick', x: -84, d: 'M-10 0 L-3 8 L11 -8', stroke: 'ink', sw: 4, trimmed: true, k: { trimE: [0, [C + 0.2, C + 0.5, 100, 'Power3 Out']] } }),
            text({ text: 'Following', x: -62, ax: 0, size: 34, weight: 600 }),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 420, 410], [1.3, 420, 410], [1.8, 70, 276], [2.3, 70, 276], [2.95, 330, 400]], [C], [], { inAt: 1.25 }),
    ];
  },
});

// 6 ─ Command palette: ⌘K flashes, the palette drops in, typing filters the list, ↓ glides, Enter selects
UIK.define({
  id: 'command-palette', name: 'Command palette', cat: 'content', T: 4.2, cam: { zoom: 1.3, y: 25, k: { y: [[1.9, 2.5, -8, 'Power2 Smooth']] } },
  desc: 'The ⌘ and K keycaps press and flash, a palette drops in. Typing swaps the suggestions for matching commands, the panel tightens, the highlight glides down one row and Enter selects it.',
  build: () => {
    const P = 0.95, TY0 = 1.5, TY1 = 2.0, X = 1.62, R = 1.9, F = 1.9, G = 2.7, E = 3.35, PT = -250;
    const RY = [196, 268, 340, 412];
    const sugg = [['New project', 'plus', '⌘N'], ['Open recent', 'clock', '⌘O'], ['Share link', 'link', '⌘L'], ['Settings', 'settings', '⌘,']];
    const res = [['Export video', 'video', '⌘E'], ['Export as GIF', 'image', '⇧⌘G'], ['Export audio', 'volume', '⇧⌘A']];
    const sel = (c) => ({ color: [[E, E + 0.2, c, 'Power2 Out']] });
    const row = (id, [label, ic, hint], y, kk, on) => group({ id, y, k: kk, ch: [
      icon({ icon: ic, x: -440, size: 30, color: 'ink', k: on ? sel('inv') : undefined }),
      text({ text: label, x: -404, ax: 0, size: 30, weight: 500, k: on ? sel('inv') : undefined }),
      text({ text: hint, x: 452, ax: 1, size: 24, color: 'muted', k: on ? sel('inv/60') : undefined }),
    ] });
    const cap = (id, glyph, x, t, tp) => group({ id, x, k: k(pop(t, { from: 0.6, dur: 0.5 }), exit(0.88, { s: 0.8 })), ch: [
      rect({ y: 10, w: 150, h: 150, r: 34, fill: 'dim' }),
      rect({ w: 150, h: 150, r: 34, fill: 'card', stroke: 'line', sw: 2, k: { y: [[tp - 0.06, tp, 8, 'Power2 Out']], fill: [[tp - 0.06, tp + 0.04, 'ink', 'Power2 Out']] },
        ch: [text({ text: glyph, size: 72, weight: 500, k: { color: [[tp - 0.06, tp + 0.04, 'inv', 'Power2 Out']] } })] }),
    ] });
    const kbd = (id, glyph, x, kk, gk) => rect({ id, x, y: 514, w: 38, h: 36, r: 10, fill: 'soft', k: kk, ch: [text({ text: glyph, size: 20, weight: 600, k: gk })] });
    return [
      cap('capCmd', '⌘', -92, 0.1, 0.5),
      cap('capK', 'K', 92, 0.16, 0.62),
      group({ id: 'palette', y: PT, k: { opacity: [0, [P, P + 0.14, 1, 'Linear']], y: [PT - 36, [P, P + 0.55, PT, 'Power4 Out']], scale: [0.95, [P, P + 0.55, 1, 'Power4 Out']] }, ch: [
        rect({ id: 'bg', pin: 't', w: 1000, h: 550, r: 32, fill: 'card', shadow: 2, k: { h: [[F, F + 0.55, 478, 'Expo Out']] } }),
        icon({ id: 'searchIcon', icon: 'search', x: -440, y: 52, size: 34, color: 'muted', k: enter(P + 0.1) }),
        text({ id: 'placeholder', text: 'Type a command or search', x: -404, y: 52, ax: 0, size: 34, color: 'muted', k: k(enter(P + 0.12), exit(TY0 - 0.04, { dur: 0.08, blur: 0 })) }),
        text({ id: 'query', text: 'export', x: -404, y: 52, ax: 0, size: 34, weight: 500, caret: true, caretColor: 'acc', caretFrom: P + 0.2, k: { reveal: [0, [TY0, TY1, 1, 'Linear']] } }),
        rect({ id: 'esc', x: 446, y: 52, w: 64, h: 40, r: 12, fill: 'soft', k: enter(P + 0.16), ch: [text({ text: 'esc', size: 20, weight: 500, color: 'muted' })] }),
        rect({ id: 'hairline', y: 104, w: 1000, h: 2, fill: 'line' }),
        text({ id: 'secSugg', text: 'Suggestions', x: -456, y: 142, ax: 0, size: 22, weight: 500, color: 'muted', k: k(enter(P + 0.18), exit(X)) }),
        text({ id: 'secCmd', text: 'Commands', x: -456, y: 142, ax: 0, size: 22, weight: 500, color: 'muted', k: enter(X + 0.02) }),
        rect({ id: 'highlight', y: RY[0], w: 968, h: 64, r: 18, fill: 'soft',
          k: k(enter(P + 0.22, { blur: 0 }), { y: [[G, G + 0.45, RY[1], 'Power4 Out']], h: [[G, G + 0.12, 86, 'Power2 Out'], [G + 0.12, G + 0.5, 64, 'Power3 Out']], fill: [[E, E + 0.2, 'ink', 'Power2 Out']] }, press(E, { to: 0.98 })) }),
        ...sugg.map((s, i) => row('sugg' + i, s, RY[i], k(enter(P + 0.2 + i * 0.05, { dy: 10, y0: RY[i] }), exit(X + i * 0.04, { s: 0.98 })))),
        ...res.map((s, i) => row('res' + i, s, RY[i], enter(R + i * 0.07, { dy: 12, y0: RY[i] }), i === 1)),
        group({ id: 'footer', k: k(enter(P + 0.3), { y: [[F, F + 0.55, -72, 'Expo Out']] }), ch: [
          rect({ y: 476, w: 1000, h: 2, fill: 'line' }),
          kbd('kUp', '↑', -452),
          kbd('kDown', '↓', -406, { fill: [[G - 0.05, G + 0.05, 'ink', 'Power2 Out'], [G + 0.3, G + 0.5, 'soft', 'Power2 Out']] },
            { color: [[G - 0.05, G + 0.05, 'inv', 'Power2 Out'], [G + 0.3, G + 0.5, 'ink', 'Power2 Out']] }),
          text({ text: 'Navigate', x: -374, y: 514, ax: 0, size: 22, color: 'muted' }),
          kbd('kEnter', '↵', -212, { fill: [[E - 0.05, E + 0.08, 'acc', 'Power2 Out']] }, { color: [[E - 0.05, E + 0.08, '#FFFFFF', 'Power2 Out']] }),
          text({ text: 'Run', x: -180, y: 514, ax: 0, size: 22, color: 'muted' }),
          text({ text: 'esc  Close', x: 456, y: 514, ax: 1, size: 22, color: 'muted' }),
        ] }),
      ] }),
    ];
  },
});

// 7 ─ Browser: the URL types in, a loading bar runs, the page skeleton builds on a stagger
UIK.define({
  id: 'browser-window', name: 'Browser', cat: 'content', T: 3.9, cam: 1.05,
  desc: 'A click focuses the address bar of a new tab and the URL types in. On Enter the shortcuts clear, a thin accent bar loads across the top in steps while reload turns into stop, and the page skeleton builds in: nav, hero, image, then three cards.',
  build: () => {
    const CL = 0.66, TY0 = 0.78, TY1 = 1.4, EN = 1.54, LD = EN + 1.25, BY = -364;
    const sk = (id, x, y, w, h, t, fill = 'skel', r = h / 2) => rect({ id, x, y, w, h, r, fill, k: enter(t, { dy: 14, y0: y, blur: 6 }) });
    const tiles = [['globe', 'Studio'], ['mail', 'Mail'], ['chart', 'Analytics'], ['bookmark', 'Reading']];
    return [
      rect({ id: 'window', w: 1300, h: 820, r: 28, fill: 'card', shadow: 1, clip: true, k: appear(0.1, 0.7), ch: [
        rect({ id: 'bar', y: BY, w: 1300, h: 92, fill: 'panel' }),
        rect({ id: 'barLine', y: BY + 47, w: 1300, h: 2, fill: 'line' }),
        ...[0, 1, 2].map((i) => circle({ id: 'light' + i, x: -608 + i * 28, y: BY, d: 16, fill: 'dim' })),
        icon({ id: 'back', icon: 'chevronLeft', x: -500, y: BY, size: 30, color: 'muted', k: enter(0.22) }),
        icon({ id: 'fwd', icon: 'chevronRight', x: -452, y: BY, size: 30, color: 'dim', k: enter(0.25) }),
        icon({ id: 'reload', icon: 'refresh', x: -402, y: BY, size: 26, color: 'muted', k: k(enter(0.28), exit(EN), enter(LD)) }),
        icon({ id: 'stop', icon: 'x', x: -402, y: BY, size: 28, color: 'muted', k: k(enter(EN), exit(LD - 0.05)) }),
        rect({ id: 'url', x: 20, y: BY, w: 760, h: 60, r: 30, fill: 'card', stroke: 'line', sw: 2,
          k: k(enter(0.28, { blur: 0 }), { stroke: [[CL, CL + 0.15, 'ink', 'Power2 Out'], [EN, EN + 0.3, 'line', 'Power2 Out']] }, press(CL, { to: 0.98 })), ch: [
          icon({ id: 'searchIc', icon: 'search', x: -344, size: 24, color: 'muted', k: exit(EN) }),
          icon({ id: 'lock', icon: 'lock', x: -344, size: 24, color: 'muted', sw: 2.4, k: enter(EN) }),
          text({ id: 'urlPh', text: 'Search or enter address', x: -316, ax: 0, size: 28, color: 'muted', k: exit(TY0 - 0.04, { dur: 0.08 }) }),
          text({ id: 'urlText', text: 'studio.site/launch', x: -316, ax: 0, size: 28, weight: 500, caret: true, caretColor: 'ink', caretFrom: CL + 0.05, caretUntil: EN,
            k: { reveal: [0, [TY0, TY1, 1, 'Linear']] } }),
        ] }),
        icon({ id: 'dl', icon: 'download', x: 548, y: BY, size: 28, color: 'muted', k: enter(0.31) }),
        circle({ id: 'me', x: 606, y: BY, d: 38, fill: 'dim', k: enter(0.34) }),
        rect({ id: 'loader', pin: 'l', x: -650, y: BY + 50, w: 0, h: 5, r: 2.5, fill: 'acc',
          k: { w: [[EN, EN + 0.35, 460, 'Power3 Out'], [EN + 0.5, EN + 0.92, 960, 'Power3 Out'], [EN + 1.05, LD, 1300, 'Power2 Out']], opacity: [[LD + 0.02, LD + 0.25, 0, 'Power2 Out']] } }),
        // new-tab page: a greeting and shortcuts, cleared when the page starts loading
        text({ id: 'greeting', text: 'Good morning', y: -90, size: 48, weight: 600, ls: -0.02, k: k(enter(0.3, { dy: 14, y0: -90 }), exit(EN)) }),
        ...tiles.map(([ic, label], i) => group({ id: 'short' + i, x: -270 + i * 180, y: 60, k: k(enter(0.36 + i * 0.05, { dy: 16, y0: 60 }), exit(EN + i * 0.015, { s: 0.94 })), ch: [
          circle({ d: 112, fill: 'soft', ch: [icon({ icon: ic, size: 42, color: 'ink' })] }),
          text({ text: label, y: 88, size: 24, color: 'muted' }),
        ] })),
        // page skeleton
        circle({ id: 'logo', x: -596, y: -266, d: 34, fill: 'ink', k: enter(EN + 0.14) }),
        sk('brand', -500, -266, 120, 18, EN + 0.17),
        sk('link0', 150, -266, 70, 14, EN + 0.2), sk('link1', 250, -266, 70, 14, EN + 0.22), sk('link2', 350, -266, 70, 14, EN + 0.24),
        sk('navCta', 560, -266, 130, 46, EN + 0.26, 'ink'),
        sk('h1a', -350, -156, 480, 40, EN + 0.34, 'dim', 12),
        sk('h1b', -410, -100, 360, 40, EN + 0.4, 'dim', 12),
        sk('p1', -370, -38, 440, 16, EN + 0.46), sk('p2', -400, -8, 380, 16, EN + 0.5),
        sk('cta', -500, 64, 180, 58, EN + 0.56, 'acc'),
        rect({ id: 'cta2', x: -310, y: 64, w: 150, h: 58, r: 29, stroke: 'line', sw: 2, k: enter(EN + 0.6, { dy: 14, y0: 64, blur: 6 }) }),
        rect({ id: 'hero', x: 310, y: -66, w: 560, h: 296, r: 24, fill: 'soft', k: enter(EN + 0.42, { dy: 18, y0: -66, blur: 8 }),
          ch: [icon({ icon: 'image', size: 64, color: 'dim', sw: 2.4 })] }),
        ...[0, 1, 2].map((i) => rect({ id: 'card' + i, x: -414 + i * 414, y: 252, w: 390, h: 226, r: 24, fill: 'card', stroke: 'line', sw: 2,
          k: enter(EN + 0.72 + i * 0.09, { dy: 24, y0: 252, blur: 6 }), ch: [
            rect({ y: -40, w: 354, h: 108, r: 16, fill: 'soft' }),
            rect({ x: -57, y: 42, w: 240, h: 16, r: 8, fill: 'skel' }),
            rect({ x: -97, y: 72, w: 160, h: 14, r: 7, fill: 'skel' }),
          ] })),
      ] }),
      cursorLayer([[0, 560, 40], [0.24, 560, 40], [0.56, -130, -352], [0.8, -130, -352], [1.34, 780, -40]], [CL], [], { inAt: 0.2 }),
    ];
  },
});

// 8 ─ Media player: play swaps to pause, the record spins, the scrubber runs, the equalizer moves
UIK.define({
  id: 'media-player', name: 'Media player', cat: 'content', T: 4.4, cam: 1.2,
  desc: 'A click on play swaps the icon for pause and the status for Now playing. The record starts spinning, the scrubber fill and knob run while the time counts, and five accent equalizer bars move on smooth keys.',
  build: () => {
    const C = 1.35, P0 = C + 0.08, T1 = 4.4, RX = -60, RW = 560, FW = RW * 10 / 30;
    const r = rnd(11);
    const eq = [0, 1, 2, 3, 4].map((i) => {
      const h = [6]; let t = P0 + i * 0.04;
      while (t < T1 - 0.1) { const d = 0.16 + r() * 0.1; h.push([t, t + d, 8 + Math.round(r() * 24), 'Sine Smooth']); t += d; }
      return rect({ id: 'eq' + i, x: RX + 4 + i * 13, y: -152, pin: 'b', w: 8, h: 6, r: 4, fill: 'dim', k: { h, fill: [[C, C + 0.2, 'acc', 'Power2 Out']] } });
    });
    const skip = (x, dir) => path({ x, y: 150, d: dir > 0 ? ['M-10 -13 L8 0 L-10 13 Z', 'M12 -13 V13'] : ['M10 -13 L-8 0 L10 13 Z', 'M-12 -13 V13'], stroke: 'ink', sw: 4, fill: 'ink', k: enter(0.66) });
    return [
      rect({ id: 'card', w: 1120, h: 500, r: 48, fill: 'card', shadow: 1, k: appear(0.1, 0.7), ch: [
        rect({ id: 'art', x: -310, w: 360, h: 360, r: 36, fill: 'ink', clip: true, k: enter(0.22, { blur: 0, s: 0.9 }), ch: [
          group({ id: 'record', k: { rot: [[C, T1, 360 * (T1 - C) / 2.4, 'Linear']] }, ch: [
            circle({ d: 262, fill: 'inv/10' }),
            path({ d: 'M0 -100 A100 100 0 1 1 0 100 A100 100 0 1 1 0 -100', stroke: 'inv/14', sw: 2 }),
            path({ d: 'M0 -78 A78 78 0 1 1 0 78 A78 78 0 1 1 0 -78', stroke: 'inv/14', sw: 2 }),
            path({ d: 'M-99.6 -57.5 A115 115 0 0 1 -39.3 -108.1', stroke: 'inv/45', sw: 5 }),
            circle({ d: 88, fill: 'acc' }),
            circle({ d: 14, fill: 'ink' }),
          ] }),
        ] }),
        ...eq,
        text({ id: 'paused', text: 'Paused', x: RX + 78, y: -164, ax: 0, size: 24, weight: 500, color: 'muted', k: k(enter(0.34), exit(C + 0.02)) }),
        text({ id: 'playing', text: 'Now playing', x: RX + 78, y: -164, ax: 0, size: 24, weight: 500, color: 'muted', k: enter(C + 0.04) }),
        text({ id: 'title', text: 'Midnight Drive', x: RX, y: -110, ax: 0, size: 52, weight: 600, ls: -0.02, k: enter(0.4, { dx: -16, x0: RX }) }),
        text({ id: 'artist', text: 'Low Tide · Night Tapes', x: RX, y: -60, ax: 0, size: 28, color: 'muted', k: enter(0.48) }),
        group({ id: 'scrubber', k: enter(0.54, { blur: 0 }), ch: [
          rect({ id: 'track', pin: 'l', x: RX, y: 14, w: RW, h: 8, r: 4, fill: 'dim' }),
          rect({ id: 'fill', pin: 'l', x: RX, y: 14, w: 0, h: 8, r: 4, fill: 'ink', k: { w: [[P0, T1, FW, 'Linear']] } }),
          circle({ id: 'knob', x: RX, y: 14, d: 24, fill: 'ink', k: { x: [[P0, T1, RX + FW, 'Linear']] } }),
        ] }),
        text({ id: 'time', x: RX, y: 50, ax: 0, size: 22, color: 'muted', num: { pre: '0:', pad: 2, floor: true, sep: false }, k: k(enter(0.58), { value: [[P0, T1, 10, 'Linear']] }) }),
        text({ id: 'dur', text: '0:30', x: RX + RW, y: 50, ax: 1, size: 22, color: 'muted', k: enter(0.6) }),
        skip(RX + RW / 2 - 116, -1),
        circle({ id: 'playBtn', x: RX + RW / 2, y: 150, d: 100, fill: 'ink', k: k(enter(0.62, { blur: 0 }), press(C, { to: 0.9 })), ch: [
          icon({ id: 'playIc', icon: 'play', x: 3, size: 40, color: 'inv', filled: true, fill: 'inv', sw: 2, k: exit(C + 0.02, { s: 0.5 }) }),
          icon({ id: 'pauseIc', icon: 'pause', size: 38, color: 'inv', filled: true, fill: 'inv', sw: 2, k: pop(C + 0.08, { from: 0.4 }) }),
        ] }),
        skip(RX + RW / 2 + 116, 1),
      ] }),
      cursorLayer([[0, 560, 380], [0.75, 560, 380], [1.25, RX + RW / 2 + 12, 162], [1.75, RX + RW / 2 + 12, 162], [2.35, 520, 360]], [C], [], { inAt: 0.7 }),
    ];
  },
});

// 9 ─ Avatar stack: avatars slide in overlapping, +3 pops, an invite squeezes a new face in front
UIK.define({
  id: 'avatar-stack', name: 'Avatar stack', cat: 'content', T: 3.5, cam: 1.25,
  desc: 'Four overlapping avatars slide in from the left on a stagger and a +3 chip pops. Clicking Invite squeezes a new accent avatar in at the front: the others shift right, the last one folds into the chip, which rolls to +4.',
  build: () => {
    const C = 1.95, S = C + 0.05, STEP = 78, AX = [-470, -392, -314, -236], CHX = -158, D = 104;
    const av = [['AK', 'dim', 'ink'], ['MR', 'ink', 'inv'], ['JS', 'soft', 'ink'], ['LT', 'dim', 'ink']];
    const avatar = (i) => {
      const [ini, fill, col] = av[i], sh = S + i * 0.03;
      const kk = k(enter(0.3 + i * 0.08, { dx: -50, x0: AX[i], blur: 6 }), { x: [[sh, sh + 0.5, AX[i] + STEP, 'Power3 Out']] },
        i === 3 ? { scale: [[S + 0.06, S + 0.32, 0.75, 'Power2 In']], opacity: [[S + 0.06, S + 0.3, 0, 'Power2 In']], blur: [[S + 0.06, S + 0.3, 4, 'Power2 In']] } : null);
      return circle({ id: 'av' + i, x: AX[i], d: D, fill, stroke: 'card', sw: 6, k: kk, ch: [text({ text: ini, size: 28, weight: 600, color: col })] });
    };
    return [
      rect({ id: 'card', w: 1160, h: 232, r: 60, fill: 'card', shadow: 1, k: appear(0.1, 0.7), ch: [
        circle({ id: 'more', x: CHX, d: D, fill: 'soft', stroke: 'card', sw: 6, clip: true, k: pop(0.72, { from: 0.4 }),
          ch: rollText('+3', '+4', S + 0.18, { size: 30, d: 76 }) }),
        avatar(3), avatar(2), avatar(1), avatar(0),
        circle({ id: 'newAv', x: AX[0], d: D, fill: 'acc', stroke: 'card', sw: 6, k: k(pop(S + 0.04, { from: 0.3 }), { x: [AX[0] - 30, [S + 0.04, S + 0.5, AX[0], 'Power3 Out']] }),
          ch: [text({ text: 'NB', size: 28, weight: 600, color: '#FFFFFF' })] }),
        text({ id: 'label', text: 'Shared with the team', x: -52, y: -20, ax: 0, size: 34, weight: 600, k: enter(0.95, { dx: -16, x0: -52 }) }),
        text({ id: 'sub7', text: 'Design · 7 people', x: -52, y: 22, ax: 0, size: 26, color: 'muted', k: k(enter(1.05), exit(S + 0.2)) }),
        text({ id: 'sub8', text: 'Design · 8 people', x: -52, y: 22, ax: 0, size: 26, color: 'muted', k: enter(S + 0.2) }),
        rect({ id: 'invite', x: 452, w: 176, h: 76, r: 38, fill: 'ink', k: k(enter(1.12, { blur: 0 }), press(C)), ch: [
          icon({ icon: 'plus', x: -48, size: 28, color: 'inv', sw: 2.8 }),
          text({ text: 'Invite', x: -24, ax: 0, size: 28, weight: 600, color: 'inv' }),
        ] }),
      ] }),
      cursorLayer([[0, 640, 330], [1.3, 640, 330], [1.85, 464, 14], [2.4, 464, 14], [2.95, 640, 300]], [C], [], { inAt: 1.25 }),
    ];
  },
});

// 10 ─ Keyboard shortcut: three keycaps press down in sequence (the lip shrinks), the action names itself
UIK.define({
  id: 'keyboard-keys', name: 'Keyboard shortcut', cat: 'content', T: 3.3, cam: { zoom: 1.55, y: -40, k: { y: [[1.68, 2.4, 56, 'Power2 Smooth']] } },
  desc: 'Three big keycaps pop in, then press down one after another as a chord: each cap sinks onto its darker lip, the last one flashes accent, the action label rises in, and the keys release together.',
  build: () => {
    const KX = [-290, 0, 290], KY = -50, PR = [0.95, 1.3, 1.65], REL = 2.45;
    const keys = [['⌘', 'command'], ['⇧', 'shift'], ['P', null]];
    const key = (i) => {
      const [g, word] = keys[i], tp = PR[i], last = i === 2, rl = REL + i * 0.05;
      return group({ id: 'key' + i, x: KX[i], y: KY, k: appear(0.1 + i * 0.08, 0.6), ch: [
        rect({ id: 'lip' + i, y: 16, w: 220, h: 220, r: 46, fill: 'dim', shadow: 1 }),
        rect({ id: 'cap' + i, w: 220, h: 220, r: 46, fill: 'card', stroke: 'line', sw: 2,
          k: { y: [[tp - 0.06, tp + 0.02, 12, 'Power2 Out'], [rl, rl + 0.35, 0, 'Power3 Out']],
               fill: [[tp - 0.06, tp + 0.06, last ? 'acc' : 'soft', 'Power2 Out'], [rl, rl + 0.3, 'card', 'Power2 Out']] },
          ch: [
            text({ text: g, y: word ? -14 : 0, size: word ? 92 : 100, weight: 500,
              k: last ? { color: [[tp - 0.06, tp + 0.06, '#FFFFFF', 'Power2 Out'], [rl, rl + 0.3, 'ink', 'Power2 Out']] } : undefined }),
            ...(word ? [text({ text: word, y: 66, size: 22, weight: 500, color: 'muted' })] : []),
          ] }),
      ] });
    };
    return [
      key(0), key(1), key(2),
      text({ id: 'plus0', text: '+', x: -145, y: KY + 8, size: 48, weight: 500, color: 'muted', k: enter(0.42) }),
      text({ id: 'plus1', text: '+', x: 145, y: KY + 8, size: 48, weight: 500, color: 'muted', k: enter(0.48) }),
      text({ id: 'label', text: 'Open command palette', y: 200, size: 54, weight: 600, ls: -0.02, k: enter(PR[2] + 0.12, { dy: 20, y0: 200 }) }),
      text({ id: 'sub', text: 'Works in every view', y: 256, size: 28, color: 'muted', k: enter(PR[2] + 0.24, { dy: 12, y0: 256 }) }),
    ];
  },
});

// 11 ─ Before / after: a clip split tracks the handle while the cursor drags it both ways
UIK.define({
  id: 'before-after', name: 'Before / after slider', cat: 'content', T: 4.8, cam: { zoom: 1.15, y: -24 },
  desc: 'A wireframe and the finished page share one frame, split by a clip whose width tracks the handle. The cursor drags the handle across to reveal the finished page, back to compare, then leaves it on the after side.',
  build: () => {
    const H0 = 260, REL = 3.65, segs = [[1.05, 1.95, -540], [2.15, 2.85, 200], [3.05, 3.6, -80]];
    const hx = segs.map(([a, b, v]) => [a, b, v, 'Power2 Smooth']);
    // the before layer is a left-pinned clip: its width is 600 + handle x, and its content counter-moves to stay put
    const cw = [600 + H0].concat(segs.map(([a, b, v]) => [a, b, 600 + v, 'Power2 Smooth']));
    const ix = [300 - H0 / 2].concat(segs.map(([a, b, v]) => [a, b, 300 - v / 2, 'Power2 Smooth']));
    const bars = [90, 140, 110, 190];
    const after = [
      circle({ x: -538, y: -290, d: 34, fill: 'ink' }),
      text({ text: 'Studio', x: -510, y: -290, ax: 0, size: 28, weight: 600 }),
      ...['Work', 'Pricing', 'About'].map((s, i) => text({ text: s, x: 110 + i * 110, y: -290, size: 24, weight: 500, color: 'muted' })),
      rect({ x: 500, y: -290, w: 140, h: 50, r: 25, fill: 'ink', ch: [text({ text: 'Sign up', size: 22, weight: 600, color: 'inv' })] }),
      text({ text: 'Ship pages', x: -540, y: -170, ax: 0, size: 64, weight: 600, ls: -0.03 }),
      text({ text: 'people finish', x: -540, y: -100, ax: 0, size: 64, weight: 600, ls: -0.03 }),
      text({ text: 'Templates, motion and hosting in one place', x: -540, y: -34, ax: 0, size: 24, color: 'muted' }),
      rect({ x: -440, y: 50, w: 200, h: 64, r: 32, fill: 'acc', ch: [text({ text: 'Start free', size: 26, weight: 600, color: '#FFFFFF' })] }),
      rect({ x: 270, y: -70, w: 440, h: 300, r: 28, fill: 'ink', ch: bars.map((h, i) => rect({ x: -120 + i * 80, y: 110, pin: 'b', w: 52, h, r: 12, fill: i === 3 ? 'acc' : 'inv/18' })) }),
      ...[['2.4×', 'faster loads'], ['98', 'performance'], ['12k', 'sites live']].map(([v, l], i) => rect({ x: -380 + i * 380, y: 240, w: 340, h: 150, r: 24, fill: 'soft', ch: [
        text({ text: v, y: -18, size: 48, weight: 600, ls: -0.02 }), text({ text: l, y: 32, size: 22, color: 'muted' }),
      ] })),
    ];
    const before = [
      rect({ x: -538, y: -290, w: 34, h: 34, r: 6, fill: 'skel' }),
      rect({ x: -455, y: -290, w: 110, h: 20, r: 4, fill: 'skel' }),
      ...[0, 1, 2].map((i) => rect({ x: 110 + i * 110, y: -290, w: 64, h: 14, r: 3, fill: 'skel' })),
      rect({ x: 500, y: -290, w: 140, h: 50, r: 6, fill: 'dim' }),
      rect({ x: -382, y: -170, w: 316, h: 50, r: 6, fill: 'skel' }),
      rect({ x: -336, y: -100, w: 408, h: 50, r: 6, fill: 'skel' }),
      rect({ x: -320, y: -34, w: 440, h: 16, r: 3, fill: 'skel' }),
      rect({ x: -440, y: 50, w: 200, h: 64, r: 6, fill: 'dim' }),
      rect({ x: 270, y: -70, w: 440, h: 300, r: 6, fill: 'skel', ch: [icon({ icon: 'image', size: 64, color: 'muted', sw: 2.2 })] }),
      ...[0, 1, 2].map((i) => rect({ x: -380 + i * 380, y: 240, w: 340, h: 150, r: 6, fill: 'skel' })),
    ];
    return [
      rect({ id: 'frame', w: 1200, h: 720, r: 32, fill: 'card', shadow: 1, clip: true, k: appear(0.1, 0.7), ch: [
        group({ id: 'after', k: enter(0.28, { blur: 6 }), ch: after }),
        rect({ id: 'beforeClip', pin: 'l', x: -600, w: 600 + H0, h: 720, fill: 'panel', clip: true, k: { w: cw }, ch: [
          group({ id: 'before', x: 300 - H0 / 2, k: k(enter(0.28, { blur: 6 }), { x: ix }), ch: before }),
        ] }),
        group({ id: 'handle', x: H0, k: k(enter(0.5, { blur: 0 }), { x: hx }), ch: [
          rect({ id: 'handleLine', w: 4, h: 720, fill: 'ink' }),
          circle({ id: 'knob', d: 76, fill: 'ink', stroke: 'card', sw: 4, k: { scale: [[1.0, 1.2, 1.1, 'Power3 Out'], [REL, REL + 0.25, 1, 'Power3 Out']] }, ch: [
            icon({ icon: 'chevronLeft', x: -11, size: 26, color: 'inv', sw: 2.8 }),
            icon({ icon: 'chevronRight', x: 11, size: 26, color: 'inv', sw: 2.8 }),
          ] }),
        ] }),
      ] }),
      rect({ id: 'lblBefore', x: -536, y: -412, w: 128, h: 52, r: 26, fill: 'card', shadow: 3, k: enter(0.4), ch: [text({ text: 'Before', size: 24, weight: 600 })] }),
      rect({ id: 'lblAfter', x: 544, y: -412, w: 112, h: 52, r: 26, fill: 'ink', k: enter(0.46), ch: [text({ text: 'After', size: 24, weight: 600, color: 'inv' })] }),
      cursorLayer([[0, 560, 370], [0.5, 560, 370], [0.92, H0 + 10, 14], [1.05, H0 + 10, 14], [1.95, -530, 30], [2.15, -530, 30], [2.85, 210, 0], [3.05, 210, 0], [3.6, -70, 14], [3.9, -70, 14], [4.4, 220, 330]],
        [], [[1.0, REL]], { inAt: 0.45 }),
    ];
  },
});

// 12 ─ Chapter card: an "Up next" pill opens into a chapter card, the number rolls like an odometer
{
  const M = 1.25, DW = 134.3, NX = -560;
  UIK.define({
    id: 'chapter-card', name: 'Chapter card', cat: 'morph', T: 4.1,
    cam: { zoom: 1.9, k: { zoom: [[M, M + 0.7, 1.1, 'Expo Out']] } },
    desc: 'An ink "Up next" pill nudges its arrow, then opens into a wide chapter card. The accent chapter number rolls up like an odometer, the title block slides in and an autoplay countdown starts filling its segment.',
    build: () => [
      rect({ id: 'shape', w: 340, h: 116, r: 58, fill: 'ink', shadow: 1,
        k: k(appear(0.12, 0.55), { w: [[M, M + 0.7, 1300, 'Expo Out']], h: [[M, M + 0.7, 560, 'Expo Out']], r: [[M, M + 0.5, 48, 'Power3 Out']] }), ch: [
        group({ id: 'pillContent', k: k(enter(0.3, { d: 0 }), exit(M)), ch: [
          text({ text: 'Up next', x: -104, ax: 0, size: 44, weight: 600, ls: -0.02, color: 'inv' }),
          icon({ id: 'arrow', icon: 'arrow', x: 86, size: 40, color: 'inv', sw: 2.6, k: { x: [[0.75, 0.95, 100, 'Power2 Out'], [0.95, 1.2, 86, 'Power3 Out']] } }),
        ] }),
        group({ id: 'cardContent', k: { opacity: [0, [M + 0.05, M + 0.25, 1, 'Power2 Out']] }, ch: [
          rect({ id: 'numClip', x: NX + DW, w: DW * 2 + 24, h: 270, clip: true, ch: [
            group({ id: 'tens', x: -DW / 2, y: 270, k: { y: [[M + 0.18, M + 0.85, 0, 'Power4 Out']] }, ch: [text({ text: '0', size: 230, weight: 600, ls: -0.04, color: 'acc' })] }),
            group({ id: 'ones', x: DW / 2, y: 270, k: { y: [[M + 0.26, M + 1.2, -540, 'Power4 Out']] }, ch: ['0', '1', '2'].map((d, i) => text({ text: d, y: i * 270, size: 230, weight: 600, ls: -0.04, color: 'acc' })) }),
          ] }),
          rect({ id: 'divider', x: -236, w: 2, h: 0, fill: 'inv/18', k: { h: [[M + 0.3, M + 0.9, 300, 'Power3 Out']] } }),
          text({ id: 'eyebrow', text: 'Chapter two', x: -190, y: -120, ax: 0, size: 24, weight: 600, ls: 0.14, upper: true, color: 'inv/55', k: enter(M + 0.3) }),
          text({ id: 'title', text: 'The motion system', x: -190, y: -52, ax: 0, size: 68, weight: 600, ls: -0.03, color: 'inv', k: enter(M + 0.38, { dx: -20, x0: -190 }) }),
          text({ id: 'subtitle', text: 'Springs, easing and timing · 6 min', x: -190, y: 16, ax: 0, size: 30, color: 'inv/60', k: enter(M + 0.48) }),
          ...[0, 1, 2, 3].map((i) => rect({ id: 'seg' + i, pin: 'l', x: -190 + i * 132, y: 128, w: 120, h: 6, r: 3, fill: i === 0 ? 'inv/70' : 'inv/18', k: enter(M + 0.58 + i * 0.04, { blur: 0, s: 1 }) })),
          rect({ id: 'segFill', pin: 'l', x: -190 + 132, y: 128, w: 0, h: 6, r: 3, fill: 'acc', k: { w: [[M + 0.9, M + 3.9, 120, 'Linear']] } }),
          text({ id: 'countdown', x: 590, y: 128, ax: 1, size: 24, weight: 500, color: 'inv/55', num: { pre: 'Starts in ', suf: 's', floor: true },
            k: k(enter(M + 0.62), { value: [3.999, [M + 0.9, M + 3.9, 0.999, 'Linear']] }) }),
        ] }),
      ] }),
    ],
  });
}

// 13 ─ Map pin: a click drops a pin with a squash, rings ripple under it, a route draws, a place card slides up
UIK.define({
  id: 'map-pin', name: 'Map pin', cat: 'content', T: 3.8,
  cam: { zoom: 1.1, k: { zoom: [[1.2, 3.2, 1.18, 'Power2 Smooth']] } },
  desc: 'Streets draw on across a stylised map. A click drops an accent pin that lands with a small squash while its shadow tightens, two rings ripple out under it, a route draws from you to it and a place card slides up.',
  build: () => {
    const PX = 120, PY = -70, PD = 1.1, PL = 1.45, RT = 1.8, LC = 2.3;
    const roads = [
      ['M-660 150 C-380 110 -220 170 -40 60 S300 -170 660 -210', 40],
      ['M-660 -110 L660 -40', 26], ['M-150 -400 L-100 400', 26], ['M300 -400 L360 400', 22],
      ['M-660 300 L-150 262', 14], ['M360 120 L660 140', 14], ['M-420 -400 L-460 400', 14], ['M-100 -250 L660 -300', 14],
    ];
    return [
      rect({ id: 'map', w: 1200, h: 720, r: 40, fill: 'skel', shadow: 1, clip: true, k: appear(0.1, 0.7), ch: [
        rect({ id: 'park0', x: -300, y: -250, w: 250, h: 200, r: 36, fill: 'dim', k: enter(0.3, { blur: 0 }) }),
        rect({ id: 'park1', x: 500, y: 250, w: 220, h: 200, r: 36, fill: 'dim', k: enter(0.36, { blur: 0 }) }),
        rect({ id: 'park2', x: 140, y: 250, w: 170, h: 120, r: 30, fill: 'dim', k: enter(0.42, { blur: 0 }) }),
        ...roads.map(([d, sw], i) => path({ id: 'road' + i, d, stroke: 'card', sw, trimmed: true, k: { trimE: [0, [0.18 + i * 0.05, 0.9 + i * 0.05, 100, 'Power3 Out']] } })),
        path({ id: 'route', d: `M-470 140 C-330 118 -210 150 -80 62 S40 -40 ${PX} ${PY}`, stroke: 'ink', sw: 8, trimmed: true, k: { trimE: [0, [RT, RT + 0.7, 100, 'Power2 Smooth']] } }),
        circle({ id: 'youHalo', x: -470, y: 140, d: 76, fill: 'ink/10', k: pop(0.62, { from: 0.4 }) }),
        circle({ id: 'you', x: -470, y: 140, d: 30, fill: 'ink', stroke: 'card', sw: 5, k: pop(0.66, { from: 0.4 }) }),
        ...[0, 1].map((i) => { const t = PL + i * 0.28; return circle({ id: 'ring' + i, x: PX, y: PY, w: 40, h: 16, stroke: 'acc', sw: 4,
          k: { w: [[t, t + 0.95, 300, 'Power3 Out']], h: [[t, t + 0.95, 120, 'Power3 Out']], opacity: [0, [t, t + 0.06, 1, 'Linear'], [t + 0.3, t + 0.95, 0, 'Power2 Out']] } }); }),
        circle({ id: 'pinShadow', x: PX, y: PY + 2, w: 66, h: 20, fill: 'ink/22', k: { opacity: [0, [PD, PL, 1, 'Power2 In']], scale: [0.3, [PD, PL, 1, 'Power2 In']] } }),
        group({ id: 'pin', x: PX, y: PY, k: { opacity: [0, [PD, PD + 0.08, 1, 'Linear']], y: [PY - 330, [PD, PL, PY, 'Power2 In']],
            sy: [[PL, PL + 0.08, 0.86, 'Power2 Out'], [PL + 0.08, PL + 0.42, 1, 'Power3 Out']], sx: [[PL, PL + 0.08, 1.1, 'Power2 Out'], [PL + 0.08, PL + 0.42, 1, 'Power3 Out']] }, ch: [
          path({ d: 'M0 0 C-8 -18 -40 -46 -40 -80 A40 40 0 1 1 40 -80 C40 -46 8 -18 0 0 Z', stroke: 'acc', sw: 2, fill: 'acc' }),
          circle({ y: -80, d: 30, fill: '#FFFFFF' }),
        ] }),
        rect({ id: 'place', y: 250, w: 640, h: 150, r: 32, fill: 'card', shadow: 2, k: { y: [340, [LC, LC + 0.6, 250, 'Power4 Out']], opacity: [0, [LC, LC + 0.15, 1, 'Linear']] }, ch: [
          rect({ x: -242, w: 92, h: 92, r: 26, fill: 'soft', k: pop(LC + 0.18, { from: 0.6 }), ch: [icon({ icon: 'pin', size: 42, color: 'ink' })] }),
          text({ text: 'Harbor Coffee', x: -176, y: -20, ax: 0, size: 34, weight: 600, k: enter(LC + 0.22, { dx: -16, x0: -176 }) }),
          text({ text: '0.4 km · 6 min walk', x: -176, y: 22, ax: 0, size: 26, color: 'muted', k: enter(LC + 0.3) }),
          circle({ x: 246, d: 80, fill: 'ink', k: pop(LC + 0.36, { from: 0.5 }), ch: [icon({ icon: 'arrow', size: 34, color: 'inv', sw: 2.8, rot: -45 })] }),
        ] }),
      ] }),
      cursorLayer([[0, 520, 380], [0.6, 520, 380], [0.98, PX + 4, PY + 4], [1.12, PX + 4, PY + 4], [1.7, 470, 40], [3.8, 480, 50]], [1.05], [], { inAt: 0.55 }),
    ];
  },
});

// 14 ─ Sidebar nav: a hover highlight follows the cursor, a click moves the selection, the sidebar collapses to icons
UIK.define({
  id: 'sidebar-nav', name: 'Sidebar nav', cat: 'content', T: 4.4, cam: 1.05,
  desc: 'A soft hover highlight glides between items after the cursor and stretches in flight. A click moves the ink selection to Analytics and the page title swaps; then Collapse shrinks the sidebar to icons while labels exit and the page widens.',
  build: () => {
    const H1 = 1.28, H2 = 1.62, C1 = 1.88, H3 = 2.45, CC = 2.72, SL = -668, W0 = 360, W1 = 112, EZ = 'Expo Out';
    const IX = 56, LX = 100, HW0 = 336, HW1 = 88, SWK = { w: [[CC, CC + 0.6, W1, EZ]] };
    const items = [['Home', 'home', -230], ['Projects', 'layers', -150], ['Analytics', 'chart', -70], ['Messages', 'message', 10], ['Team', 'users', 90], ['Settings', 'settings', 246]];
    const COLL = 326;
    // tiles in the page: pinned left, their x and width stretch with the page as the sidebar collapses
    const CL0 = SL + W0 + 48, CL1 = SL + W1 + 48, PR = 632, GAP = 24;
    const tw0 = (PR - CL0 - 2 * GAP) / 3, tw1 = (PR - CL1 - 2 * GAP) / 3;
    const tile = (i, label, value) => rect({ id: 'tile' + i, pin: 'l', x: i * (tw0 + GAP), y: -130, w: tw0, h: 170, r: 26, fill: 'card',
      k: k(enter(0.6 + i * 0.07, { dy: 16, y0: -130, blur: 6 }), { x: [[CC, CC + 0.6, i * (tw1 + GAP), EZ]], w: [[CC, CC + 0.6, tw1, EZ]] }), ch: [
        text({ text: label, x: -tw0 / 2 + 30, y: -36, ax: 0, size: 24, color: 'muted', k: { x: [[CC, CC + 0.6, -tw1 / 2 + 30, EZ]] } }),
        text({ text: value, x: -tw0 / 2 + 30, y: 18, ax: 0, size: 48, weight: 600, ls: -0.02, k: { x: [[CC, CC + 0.6, -tw1 / 2 + 30, EZ]] } }),
      ] });
    const bw0 = PR - CL0, bw1 = PR - CL1;
    const labelExit = (i) => exit(CC - 0.02 + i * 0.01, { dur: 0.14 });
    return [
      rect({ id: 'window', w: 1360, h: 800, r: 36, fill: 'panel', shadow: 1, k: appear(0.1, 0.7), ch: [
        // the sidebar clips its content, so labels are wiped by its edge as it collapses. Its content group
        // counter-moves (x = -w/2) to stay pinned to the left edge; the inner bg isolates the difference blend.
        rect({ id: 'sidebar', pin: 'l', x: SL, w: W0, h: 776, r: 28, fill: 'card', clip: true, k: k(enter(0.22, { blur: 0, s: 1, dx: -20, x0: SL }), SWK), ch: [
          group({ id: 'sideContent', x: -W0 / 2, k: { x: [[CC, CC + 0.6, -W1 / 2, EZ]] }, ch: [
            rect({ id: 'sideBg', pin: 'l', w: W0, h: 776, fill: 'card', k: SWK }),
            rect({ id: 'logo', x: IX, y: -330, w: 56, h: 56, r: 16, fill: 'ink', k: enter(0.28), ch: [text({ text: 'S', size: 28, weight: 700, color: 'inv' })] }),
            text({ id: 'wsName', text: 'Studio', x: LX, y: -330, ax: 0, size: 30, weight: 600, k: k(enter(0.3), exit(CC - 0.02, { dur: 0.14 })) }),
            // hover (soft) and selection (ink) highlights — the icons and labels above them use the difference blend
            rect({ id: 'hover', pin: 'l', x: 12, y: items[1][2], w: HW0, h: 64, r: 18, fill: 'soft',
              k: { opacity: [0, [H1, H1 + 0.16, 1, 'Power2 Out'], [C1, C1 + 0.15, 0, 'Power2 Out'], [H3 - 0.02, H3 + 0.12, 1, 'Power2 Out'], [3.42, 3.6, 0, 'Power2 Out']],
                   y: [[H2, H2 + 0.38, items[2][2], 'Power4 Out'], [2.3, COLL]], h: [[H2, H2 + 0.1, 82, 'Power2 Out'], [H2 + 0.1, H2 + 0.42, 64, 'Power3 Out']],
                   w: [[CC, CC + 0.6, HW1, EZ]] } }),
            rect({ id: 'selected', pin: 'l', x: 12, y: items[0][2], w: HW0, h: 64, r: 18, fill: 'ink',
              k: k(enter(0.4, { blur: 0 }), { y: [[C1, C1 + 0.5, items[2][2], 'Power4 Out']], h: [[C1, C1 + 0.14, 110, 'Power2 Out'], [C1 + 0.14, C1 + 0.55, 64, 'Power3 Out']], w: [[CC, CC + 0.6, HW1, EZ]] }) }),
            ...items.map(([label, ic, y], i) => icon({ id: 'ic' + i, icon: ic, x: IX, y, size: 30, color: '#FFFFFF', blend: 'difference', k: enter(0.34 + i * 0.05, { blur: 0 }) })),
            ...items.map(([label, ic, y], i) => text({ id: 'lbl' + i, text: label, x: LX, y, ax: 0, size: 30, weight: 500, color: '#FFFFFF', blend: 'difference',
              k: k(enter(0.36 + i * 0.05, { dx: -14, x0: LX, blur: 0 }), labelExit(i)) })),
            icon({ id: 'collapseIc', icon: 'chevronLeft', x: IX, y: COLL, size: 30, color: '#FFFFFF', blend: 'difference', k: k(enter(0.66, { blur: 0 }), { rot: [[CC, CC + 0.5, 180, 'Power3 Out']] }) }),
            text({ id: 'collapseLbl', text: 'Collapse', x: LX, y: COLL, ax: 0, size: 30, weight: 500, color: '#FFFFFF', blend: 'difference', k: k(enter(0.68, { blur: 0 }), labelExit(6)) }),
          ] }),
        ] }),
        group({ id: 'page', x: CL0, k: { x: [[CC, CC + 0.6, CL1, EZ]] }, ch: [
          text({ id: 'pgHome', text: 'Home', y: -318, ax: 0, size: 48, weight: 600, ls: -0.02, k: k(enter(0.45), exit(C1 + 0.06)) }),
          text({ id: 'pgAnalytics', text: 'Analytics', y: -318, ax: 0, size: 48, weight: 600, ls: -0.02, k: enter(C1 + 0.08) }),
          text({ id: 'pgSub', text: 'Last 30 days', y: -270, ax: 0, size: 26, color: 'muted', k: enter(0.52) }),
          tile(0, 'Visitors', '48.2k'), tile(1, 'Conversion', '3.8%'), tile(2, 'Revenue', '$12.4k'),
          rect({ id: 'block', pin: 'l', y: 170, w: bw0, h: 360, r: 26, fill: 'card', k: k(enter(0.82, { dy: 18, y0: 170, blur: 6 }), { w: [[CC, CC + 0.6, bw1, EZ]] }), ch: [
            ...[0, 1, 2, 3].map((j) => rect({ pin: 'l', x: -bw0 / 2 + 30, y: -120 + j * 80, w: 220 - j * 30, h: 18, r: 9, fill: 'skel', k: { x: [[CC, CC + 0.6, -bw1 / 2 + 30, EZ]] } })),
            ...[0, 1, 2, 3].map((j) => rect({ pin: 'r', x: bw0 / 2 - 30, y: -120 + j * 80, w: 90, h: 18, r: 9, fill: 'skel', k: { x: [[CC, CC + 0.6, bw1 / 2 - 30, EZ]] } })),
            ...[0, 1, 2].map((j) => rect({ y: -80 + j * 80, w: bw0 - 60, h: 2, fill: 'line', k: { w: [[CC, CC + 0.6, bw1 - 60, EZ]] } })),
          ] }),
        ] }),
      ] }),
      cursorLayer([[0, 300, 440], [0.9, 300, 440], [1.3, SL + LX + 60, items[1][2] + 10], [1.52, SL + LX + 60, items[1][2] + 10], [1.78, SL + LX + 60, items[2][2] + 10], [2.05, SL + LX + 60, items[2][2] + 10], [2.6, SL + IX + 10, COLL + 10], [3.3, SL + IX + 10, COLL + 10], [3.9, 60, 240]],
        [C1, CC], [], { inAt: 0.85 }),
    ];
  },
});
})();
