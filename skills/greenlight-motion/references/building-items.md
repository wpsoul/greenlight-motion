
# UI Motion Kit — building elements

The kit is a lab of animated UI elements. Each element is a small JavaScript spec: a tree of layers
plus keyframe tracks. The engine renders it as a pure function of time, and every layer and track is
chosen so it converts one-to-one into the app's Video Editor (VE): shapes, text, line paths, custom
SVG icons, image slots, parent groups and a camera, animated with the VE's own easing names. Keep to
that vocabulary and a finished element is also a finished VE asset.

Build like an exceptional motion designer whose portfolio this piece will be in: a hiring director
watches it frame by frame. Decide every beat, curve and spacing on purpose, and judge your own stills
as that director would.

## Contents
1. Files and workflow
2. The element spec — and its controls for the user
3. Style rules
4. Motion rules
5. Recipes — which finished element to copy for each pattern
6. Traps
7. Verify
8. Where your items live

Full API (every prop, helper and token): [engine-api.md](engine-api.md).

## 1. Files and workflow

```
lib/engine.js           engine, helpers (UIK.h), icons (UIK.ICONS), themes — read-only
lib/easings.js          the Video Editor's easing catalogue — read-only
lib/elements-*.js       the library's items — read them, copy their patterns
<project>/items/*.js    YOUR items: UIK.define({ … }) calls, loaded after the library
tools/stills.mjs        review sheets (frames side by side)     tools/check.mjs   build, keys, export checks
```

1. **Pick the file.** Write your item into `<project>/items/<name>.js` (§8).
2. **List what exists** so ids and mechanics don't repeat:
   `grep -ho "id: '[a-z0-9-]*', name: '[^']*'" lib/elements-*.js`
3. **Read two or three finished elements** that are closest to what you are building (§5 names them).
   Copying a solved pattern is faster and more consistent than inventing one. Element files define a
   few local helpers at the top (a phone frame, an inverse easing); copy the ones you need, and prefer
   `UIK.h` when it has an equivalent — `popIn`, `fadeIn`, `pop`, `press`, `enter`, `exit`, `ring`,
   `spinner`, `digitCol`, `invEase`/`cross`, `rnd`, `sample`, `valueAt` (older files still carry local
   copies of some; don't redeclare a name you destructured). `cursorLayer` keys take a per-leg easing.
4. **Write the spec** (§2), in the style (§3) and motion rules (§4).
5. **Verify** with the probes and look at every sheet yourself (§7). Iterate until it reads as well
   as its neighbours.

Screenshots and scratch scripts go to a scratch folder, never into the repo.

## 2. The element spec

```js
(function () {
const { rect, circle, ellipse, text, path, icon, group, photo, k, enter, exit, pop, popIn, press, cursorLayer, stagger } = UIK.h;

UIK.define({
  id: 'toggle', name: 'Toggle switch', cat: 'controls', T: 3.0, cam: 1.5,
  desc: 'Click flips the switch: the knob stretches while it travels, the track recolours.',
  build: () => {
    const C = 1.25;                                    // beat times as named constants
    return [
      rect({ id: 'card', w: 820, h: 220, r: 56, fill: 'card', shadow: 1, k: popIn(0.1),
        ch: [
          text({ id: 'title', text: 'Dark mode', x: -214, y: -24, ax: 0, size: 48, weight: 600, k: enter(0.22) }),
          rect({ id: 'track', x: 262, w: 180, h: 104, r: 52, fill: 'dim',
            k: k({ fill: [[C, C + 0.25, 'acc', 'Power2 Out']] }, press(C)),
            ch: [rect({ id: 'knob', x: -38, w: 80, h: 80, r: 40, fill: '#FFFFFF', shadow: 3,
              k: { x: [[C, C + 0.45, 38, 'Power4 Out']] } })] }),
        ] }),
      cursorLayer([[0, 500, 290], [0.55, 500, 290], [1.12, 282, 16], [2.7, 360, 150]], [C], [], { inAt: 0.35 }),
    ];
  },
});
})();
```

- **World:** 1920×1080, (0, 0) is the frame centre, y goes down. A layer's `x/y` is its centre relative
  to its parent's centre (text: `ax` picks the anchor — 0 left, 0.5 centre, 1 right).
- **Layers:** `rect`, `circle`/`ellipse`, `text`, `path`, `icon`, `photo`, `group`, `cursorLayer`.
  Children go in `ch`. DOM order is paint order: later siblings draw on top.
- **Tracks:** `k: { prop: [init?, [t0, t1, value, easing], [t, value], …] }`. Hold the previous value
  until t0, ease to `value` by t1. `[t, value]` is an instant step. A leading non-array is the start
  value. Each segment becomes exactly two VE keys, which is why segments are the unit.
- **Camera:** `cam: 1.4` or `cam: { zoom, x, y, k: { zoom: [...], x: [...], y: [...] } }` — a VE camera
  clip. Zoom so the main shape fills the frame (§3); zoom as states change size.
- **3D space:** `rx` / `ry` (degrees) and `depth` (px toward the camera) on any layer, `tiltX` / `tiltY` / `dolly` on
  the camera: a card that flips, a phone that turns to show its screen, a dashboard seen at an angle, a stack of
  cards in depth the camera pushes through. They export as real 3D layers to the Video Editor and After Effects.
  Turn the parent (the card), not each child; see [engine-api.md](engine-api.md#3d-space).
- `T` is the length in seconds (2.5–5.5). `desc` is one sentence describing the motion (the
  inspector shows it). `cat` is the gallery category.
- **Formats:** by default an item leaves the kit two ways: as Video Editor **layers** (its own shapes,
  text and keyframes, as a Sequence or Layers) and as an **HTML** page / clip. An item that is too
  heavy to edit as layers declares `formats: ['html']` next to its id: the Presets tab then offers only
  the HTML import, a film exports that scene as an HTML clip (GLEA) or as pre-rendered footage (After
  Effects), and nothing else changes. The limit is `UIK.VE_LIMITS` (100 editor layers or 1,500
  keyframes); `tools/check.mjs` reports an item over it that doesn't declare `html`. An HTML-only item
  may also use what editor layers can't (3D transforms, filters, canvas, many particles), as long as
  every frame is still a pure function of time — renders and the editor's pre-rendering depend on it.

### Controls for the user

The film's preview lets the user edit what you made (its **Elements** tab). Design the controls as you build
the item, the way a product designer picks the few settings worth exposing:

```js
UIK.define({
  id: 'price-sticker', …,
  // the item's own settings: build gets them in P (defaults filled; a scene's `params` override them)
  params: {
    tilt: { label: 'Tilt', type: 'slider', min: -30, max: 30, step: 1, unit: '°', default: -9 },
    blur: { label: 'Whip blur', type: 'slider', min: 0, max: 60, unit: 'px', default: 26 },
    ring: { label: 'Ring', type: 'toggle', default: true },
  },
  build: (H, P) => [
    group({ id: 'sticker', k: { rot: [-40, [1.1, 2, P.tilt, E.move]], blur: [P.blur, [0, 0.5, 0, E.whipIn]] },
      // a panel: what the user sees when this is on screen or clicked, in the film's words
      ui: { label: '$0 sticker', controls: [
        { layer: 'price', prop: 'text', label: 'Price' },
        { layer: 'disc', prop: 'fill', label: 'Colour' },
        { param: 'tilt' },
      ] },
      ch: [
        rect({ id: 'disc', w: 440, h: 440, r: 220, fill: 'acc' }),
        ...(P.ring ? [rect({ id: 'ring', w: 396, h: 396, r: 198, stroke: 'white/45', sw: 3 })] : []),
        text({ id: 'price', text: '$0', size: 170, weight: 700, color: 'white' }),
      ] }),
  ],
});
```

- **params** are for what only code can change: an effect's strength (blur, glow, a line's opacity), an angle, a
  stagger or ripple step, an optional part (a toggle). Types: `slider` · `number` · `toggle` · `select` (`options`)
  · `color`. Build must still work with the defaults alone (the Presets tab and single-item pages use them) and
  every value must keep each frame a pure function of time. Params never change `T` or the item's timing.
- **ui** on a layer is one panel: `label` (the film's words) and `controls` — a property of the layer (`'text'`,
  `'color'`, `{ prop: 'size', min, max }`), of a child (`{ layer: 'price', prop: 'text' }`, or several ids that change
  together), or a param (`{ param: 'tilt' }`). Props: `text`, `color`, `fill`, `stroke`, `size`, `weight`, `case`,
  `tracking`, `radius`, `width`, `image`. The panel shows while its layer is on screen; params no panel names show
  under the scene's **Effects**.
- 2–4 controls per panel, a few panels per item. Skip text whose width you measured (a pill hugging a word, a line in
  a mask): a longer word gets cut. The user can still change any layer by clicking it; your panels are the obvious,
  named ones.
- `tools/check.mjs` names panels and params that point at nothing.

## 3. Style rules

The look comes from the motion-broll reference: calm, product-like UI, where motion is the only
flourish. These rules are what keep 200+ elements feeling like one kit.

- **Colour = theme tokens only** — `bg` (the canvas — for fake cut-outs like ticket notches) `card`
  `panel` `ink` `inv` `muted` `line` `skel` `soft` `dim` `acc` `bad` `shade` `white`, optionally with alpha (`'ink/40'`, `'white/80'`). `white` and `shade` are the
  same in both themes: white for knobs and text on the accent, shade for scrims. Tokens let the lab switch Light/Dark and the accent live,
  and let the VE port swap in a brand palette. `shade` stays near-black in both themes — use it for
  scrims and dimming (`ink` turns light in dark mode). `bad` is for errors, destructive actions and
  negative values (a down delta, over budget).
- **At most one or two accent uses per element** — the thing the eye should land on (the new state,
  the winner, the confirmation). It is a limit, not a quota: an element can have none. An accent inside
  a photo (`v` 0 or 4) counts; one identity colour repeated on its avatar, pointer and tag counts once.
  An element with accent everywhere has no focal point.
- **Type:** Helvetica only — the stage font IS the Video Editor's default text font (`'Helvetica Neue',
  Helvetica, Arial, sans-serif`), so the lab and the editor draw the same glyphs. Never monospace — not
  for code, terminals, keycaps or file names. Weights: 400, 500 (Medium), 600/700 (both Bold). Titles
  44–64 px weight 600 `ls: -0.02…-0.03`; body 28–36 px weight 400–500; captions 22–30 px `muted`.
  Default tracking is 0; keep `ls` for big type only — the editor draws tracked text glyph by glyph
  (no kerning pairs), so it runs ~2–3 % wider there. Text width ≈ 0.55 × size × characters at weight
  500–600; where it must fit exactly (pills, word-by-word layouts) check it on large stills (§7).
- **Framing:** set `cam` so the main shape fills ~60–75 % of the frame width (or ~70–80 % of its
  height). The visible world at zoom z is ±960/z × ±540/z. Everything, including the cursor at
  every moment, stays inside the frame.
- **Pictures:** use `photo({ v })` for every image (§5). It is one image slot in the VE, which the
  user fills with their own media. Never hand-build pictures. Several windows onto ONE picture (tiles,
  slats, a magnifier) share `src: 'name'`, so the user fills that media once. `v: 9` has a white
  background — on `card` surfaces pass `fill: 'soft'`; pale photos on the bare canvas want `shadow: 3`.
  A real picture (a film's logo or screenshot): `photo({ img: 'assets/x.png' })` or `image({ img, w, h })`
  — see Photos in the engine reference.
- **Content:** realistic, short UI copy. Placeholder numbers are fine. No real brands, logos or emoji —
  generic marks built from an icon + a made-up wordmark are fine.
- **Banned:** particles, confetti, glows, gradients, mixed icon stroke weights, dead time. Bouncy
  easings (`Elastic`, `Bounce Out`, `Overshoot`, `Swing`, `Smooth Overshoot`) only when the user asks for
  a playful or elastic feel. Library items stay calm; a film's `motion` preset adds the bounce
  ([easing.md](easing.md)).

## 4. Motion rules

- **Easing** ([easing.md](easing.md) has every curve and when to use it). New items use the **spring**
  curves, the calm feel of the GreenLight Dash launch films, through ONE role table at the top of the
  file:
  `const E = { enter: 'Spring Out', move: 'Spring Smooth', travel: 'Spring Smooth', pop: 'Spring Pop', fade: 'Spring Out', exit: 'Power2 In', drift: 'Linear', scrub: 'Sine Smooth' };`
  Springs settle slowly, so give their segments about 20 % more time than a Power curve. Any name in
  `lib/easings.js` works and converts (anything else won't): `Power4 Out` / `Expo Out` decisive moves
  and morphs · `Power3 Out` the engine's default · `Power2 Smooth` travel · `Back Out` (≈10 %
  overshoot) small pops only · `Power2 Out` fades · `Power2 In` exits · `Linear` spinners, typing,
  progress, mechanical counters and continuous drifts (Ken Burns) · `Sine Smooth` gentle back-and-forth
  drags and scrubs. The helpers (`enter`, `popIn`, `press`, `cursorLayer`) keep their own Power / Back
  curves. In a film, the default `spring` preset turns those into springs too.
- **Start from empty, end on a hold** (continuous loops like marquees are the exception — see §5). The main shape pops at 0.08–0.15 s — `k: popIn(0.1)` (scale
  0.6 → 1 `Back Out` + a 0.12 s fade; `popIn(t, { from })` to vary). Its content enters just after with `enter()`. The final
  state holds ≥ 0.4 s — a clip ends by holding its last frame.
- **Beats:** one change every 0.4–1.2 s. Anything slower reads as dead time; anything faster blurs.
- **Liquid indicators:** when something travels, also stretch its `w` (or `h`) and relax it. The
  leading edge goes first, the trailing edge catches up. This single trick is most of the kit's feel.
- **Content swaps:** `k(enter(a), exit(b))` on the old layer, `enter(b)` on the new one. The exit
  blurs out fast and the enter waits, so old and new never overlap.
- **Staggers:** rows 0.06–0.12 s apart, entering with `enter(t, { dx: -18, x0 })` or `{ dy, y0 }`.
- **Interaction:** wherever the UI is interactive, a cursor drives it. It fades in (`inAt`) just
  before it moves, arrives ~0.1 s before the click, and the clicked shape gets `press(t)`. A dragged
  layer uses the SAME key times and easing as the cursor leg, so it sticks to the pointer.
- **Colour tracks lerp in RGB,** so ink → acc passes through brown and opaque → alpha tokens
  (`soft` → `acc/10`) through salmon, and a big surface tweening card → ink shows a mid-grey slab. Pop,
  wipe or fade in a new shape of the target colour over the old one instead — for a counter that
  changes colour, crossfade a second copy.

## 5. Recipes — copy the solved pattern

| Pattern | How | Copy from |
|---|---|---|
| One shape morphing between states | rect `w/h/r/fill` tracks + content groups swapping with enter/exit + camera zoom per state | `pill-card-morph`, `chapter-card`, `button-states`, `ai-summarize` |
| Liquid indicator | `x` one segment + `w` stretch-then-relax | `segmented`, `tabs-underline`, `tab-bar`, `pagination` |
| Toggle / knob | knob `x` `Power4 Out` + `w` stretch; track fill | `toggle`, `settings-panel` |
| Typing | text `reveal` 0→1 `Linear` + `caret: true` | `terminal`, `text-input`, `ai-autocomplete` |
| Counting / rolling number | ONE text with the editor's placeholder token: `text: '{{{COUNTER:0-2,480; start=0.45}}}'` — style `odometer` (default: columns roll and cascade), `roll` (mechanical) or `count` (digits change); options live in the token | `odometer` |
| Countdown / clock | `text: '{{{TIMER:00:10-00:00}}}'` runs in real time (Count style, Linear); `{{{TIMER:05:00; duration=4; style=roll}}}` compresses it | `odometer` (same token rules) |
| Number keyed to other motion | token with `kf=<id>` + a `'ph:<id>'` track 0–100: `text: '{{{COUNTER:0-100; kf=1}}}%', k: { 'ph:1': [0, [t0, t1, 100, 'Power3 Out']] }` — e.g. a percentage that follows a bar's `w` with the same timing | — |
| Counting number (older files) | text `num: {…}` + `value` track — the lab draws it as a COUNTER token (Count style); new work uses the token | `bar-chart`, `kpi-card`, `wallet-balance` |
| Digit roll by hand | `digitCol` (a clip + column of digits), `y` track per column — only when a token can't do it (one column stepping on its own schedule) | `stepper`, `expense-split`, `currency-converter` |
| Typed text turning into a chip | identical label: an opacity step from the typed text to the chip label, then widen the pill | `invite-team`, `mention-picker` |
| Draw-on line / ring / check | `path` `trimmed: true` + `trimE` 0→100 | `success-check`, `line-chart`, `donut-chart`, `progress-ring` |
| Dot riding a curve | sample the curve, key `x/y` as short Linear legs timed to the trim easing | `line-chart`, `flow-nodes`, `route-map` |
| Bars / fills growing from an edge | `pin: 'b'` or `'l'` + `h`/`w` track (children stay put with `chAt: 'pin'`) | `bar-chart`, `race-bars`, `progress-bar` |
| Drag and drop | dragged layer `x/y` = cursor keys; target highlights on hover | `file-drag-drop`, `kanban-drag`, `slider-drag` |
| Swipe / flick | per-leg cursor easing (4th key element) matching the layer | `swipe-to-archive`, `lockscreen-notification`, `onboarding-carousel` |
| Clip reveal / wipe | clip rect `w` track (+ counter-move child) | `before-after`, `wipe-slideshow`, `headline-rise` |
| Circle mask that grows | clip rect with a huge static `r` (capped to a circle) + `w`/`h` tracks | `circle-reveal` |
| Tiles/slats onto one picture | many clipped windows, each holding the same `photo` offset to its place, `src` shared | `blinds-transition`, `mosaic-transition`, `zoom-lens` |
| Parallax | layers of one slide moving at different speeds (same easing, scaled distances) | `push-parallax`, `layered-parallax` |
| Scrolling strip in a window | group `y`/`x` track inside a clip rect | `log-stream`, `cpu-monitor`, `reading-progress` |
| Menus / popovers | card grows from its anchor (`pin`) with clip, highlight row glides | `dropdown`, `context-menu`, `ai-model-picker` |
| Modal + backdrop | full-frame `shade/40` rect, modal scales in | `confirm-dialog`, `hamburger-menu`, `bottom-sheet` |
| Stack / pile | older cards scale 0.94 / 0.88, offset, fade | `notification-stack`, `lockscreen-notification` |
| Camera follows growing content | `cam.k.y` / `zoom` with the SAME easing as the growth — `Power2 Smooth` is a strong S-curve (≈10 % done at 30 % of the time), so a smooth camera behind `Power4 Out` growth must start ~0.2 s earlier | `accordion`, `dropdown`, `nps-score` |
| Difference-blend labels | white text `blend: 'difference'` over an ink indicator | `segmented`, `pricing-toggle` |
| Wave across an element | per-layer colour change timed by distance from the origin | `theme-switch` |
| Word-by-word text | one text layer per word at measured x | `karaoke-caption`, `ai-translate`, `strike-correction` |
| Pictures, galleries | `photo({ v, w, h, r })`, strips of photos in a clip | `kenburns-crossfade`, `hover-accordion`, `timeline-scrubber` |
| Bring to front / tuck behind | paint order is static: keep two copies (one early, one late in DOM order) and swap them with an opacity step when they overlap nothing | `stack-cycle`, `polaroid-scatter` |
| Rotate/scale about a pivot | wrap the layer in a `group` placed at the pivot; the group rotates about its own (0, 0) | `fan-spread`, `notification-badge`, `cube-turn` |
| Motion computed from a formula | `sample(f, t0, t1, { tol })` → the fewest `Linear` segments within `tol` px; `valueAt(track, base, t)` reads another layer's track | `ring-carousel`, `cube-turn`, `wheel-picker` |
| Seamless loop (marquees) | move exactly one strip period over `T` (period ≥ window width), so the last frame matches the first | `logo-marquee`, `dual-marquee` |
| Tile growing into a hero | build the photo at HERO size and scale it down; `w`/`h` on a photo only crop | `orbit-gallery`, `polaroid-scatter` |
| Text over a full-bleed photo | put it on a `card/90` (or `shade/60` + `white`) panel — photo tones flip with the theme | `story-viewer`, `push-parallax` |

## 6. Traps

These each cost a previous author a round of fixes.

- **`enter(t, { dy })` animates y TO `y0` (default 0).** Always pass `y0`/`x0` equal to the layer's own
  y/x, or it jumps to the centre.
- **Overlapping segments on one track interrupt:** a segment that starts before the previous one
  ends eases on from wherever the value had got to. That is fine (a press during a pop), but it is
  easy to do by accident — `enter()` or `popIn()` plus your own `opacity`/`scale` track on the same
  layer at the same time. Merge with `k()` and check the times.
- **`enter()` on a group scales around the group's origin,** pulling off-centre children toward it.
  Pass `s: 1` for groups whose children sit away from the group's (0, 0).
- **`photo()` composes its picture at the size you pass.** A panel that widens (accordion, crop): build
  it at the MAXIMUM size and start its `w` track smaller.
- **`k(exit(a), enter(b))` on ONE layer starts it invisible** — `enter`'s start values become the
  track's initial values. Swaps need two layers: the old one exits, the new one enters.
- **A band flush with a clip edge anti-aliases into a visible sliver.** Extend bands a few px past the
  clip edge.
- **A roll/move longer than the gap to the next one overlaps it** — it gets interrupted mid-way
  (§ above). Keep each step's duration shorter than the spacing between steps.
- **Finish an exit before moving its parent** — content still fading while its container flies off
  leaves ghosts.
- **Paint order is fixed** (DOM order). `z` exists but is static. Re-ordering needs two copies — see
  the recipe.
- **Keys cost the VE.** Most elements land at 50–250 keys (the kit's median is ~130). Formula-driven motion is where they explode;
  sample coarsely.
- **Flings and off-frame entrances** leave the frame on purpose. Mark such layers `offscreen: true` so a bounds check
  skips them — and only those.
- **Clip windows tiling one picture leave hairline seams.** Overlap the tiles by 2 px, and switch a
  clean full copy on when the transition ends.
- **Children sit around the parent's centre.** When a pinned rect grows, its children move with the
  centre — use `chAt: 'pin'`, or give the child a counter-move with the same timing.
- **Text has no box:** `origin` does not apply to text, and it scales/rotates about its anchor. Choose
  `ax` for the pivot you want. Trailing spaces are dropped — measure and place the next layer.
- **Every element is a transparent item.** It is placed over the user's video, so nothing may fake
  transparency by painting the canvas colour (`fill: 'bg'`): cut holes with `notches` on the rect, and
  keep backdrops (scrims, modal shades) as real semi-transparent layers. The lab's canvas colour is only
  the viewing surface — presets and HTML exports carry no background.
- **Digits are proportional in plain text** (the editor draws text that way): a number that changes
  belongs in a COUNTER / TIMER token, whose digit cells are as wide as the widest digit so nothing
  jitters. Never fake a live number with several stacked texts.
- **Placeholder tokens are the editor's own syntax** — the text converts as is. Options after `;`
  (`style`, `start`, `duration`, `easing` as a lowercase key like `power3_out`, `turns`, `lands`,
  `cascade`, `direction`, `kf`); the full list is in the editor's Text layers guide (video-text.md).
  A TIMER's default is a real clock: `{{{TIMER:05:00}}}` takes five minutes — set `duration` for a
  short clip. Spin blur, `width=fit` and `digits=natural` show only in the editor.
- **Blend modes are isolated by a filtered/clipped parent.** A `blend: 'difference'` label needs its
  backdrop inside the same group (add a background rect inside the clip group).
- **Shadows don't animate.** For a "lift", fade in a second copy that carries a deeper shadow.
- **Dashes and Trim Paths can't share a path.** Draw a dashed base path and a trimmed solid path over it.
- **Under a big scale, box half-sizes must be whole pixels.** The browser snaps a box's half-size
  offset to whole local pixels, so at ×24 a 45 px-tall box landed 12 px low and showed a strip of
  canvas. Give zoom-through boxes even `w`/`h`.
- **No shear in the Video Editor.** A squashed parent group with a rotated child (an isometric plane)
  draws a true rhombus in the lab and in HTML, but the editor's parenting keeps only rotation and
  scale, so it draws a rotated rectangle. Declare `formats: ['html']` for isometric or skewed items
  (`iso-screens`).
- **The cursor keeps one screen size** at any camera zoom — author its keys in world coordinates and
  check it stays in frame at the current zoom.

## 7. Verify

Look at the output yourself — the checks catch errors, not taste.

```bash
node SKILL/tools/stills.mjs <project> --item <id> --n 6              # contact sheet: 6 frames across its length
node SKILL/tools/stills.mjs <project> --item <id> --t 1.2,1.5,2 --w 960   # large frames at chosen times (judge text)
node SKILL/tools/stills.mjs <project> --item <id> --n 4 --theme dark      # dark theme
node SKILL/tools/stills.mjs <project> --scene 2                      # the item inside its scene, with the user's copy
node SKILL/tools/check.mjs <project> [--item <id>]                   # builds? layers, keys, what the exports approximate
```

Done means:
- `check.mjs` reports no problems and `stills.mjs` no page errors.
- No empty frames; each beat reads in the sheet, and the final state holds.
- Text judged on large frames (`--w 480` or more): it never overflows its box or collides.
- Nothing leaves the frame unintentionally, including the cursor.
- Keys within budget: most items land at 50–250.
- It works in dark theme.
- It looks as polished as the library items around it in the gallery.

The Video Editor export maps every layer one-to-one; `check.mjs` lists what it approximates (and
anything the editor can't animate yet, like font-size tracks or Trim Paths on an icon).

## 8. Where your items live

- One or more files in `<project>/items/` (any name ending in `.js`), each an IIFE calling
  `UIK.define({ id, name, cat, T, desc, cam, build })` as in §2. They load after the library, in name
  order, so they can use `UIK.h` and the library's icons — but not the local helpers at the top of a
  library file (copy those).
- Give each item a unique id (prefix it with the film: `spring-hero-card`) and one of the library's
  categories (`UIK.CATS`: controls, feedback, data, content, morph, ai, commerce, promo, social,
  system, mobile, text, everyday, work, play, carousel, gallery).
- The gallery shows them as "Built new"; the scenario uses them by id like any library item; every
  export (GLEA layers, HTML cards, After Effects) and the render take them the same way.
