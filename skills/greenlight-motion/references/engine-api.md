# UI Motion Kit — engine API

Everything `lib/engine.js` offers an element author. Read SKILL.md first for the
workflow, style and motion rules.

## Contents
- The item spec (params, ui)
- Layers and their props
- Tracks
- Helpers
- Camera
- Colour tokens
- Icons
- Photos
- VE mapping and gaps

## The item spec

`UIK.define({ id, name, cat, T, desc, cam, formats, build })` — `formats` (optional): `['layers', 'html']`
by default; `['html']` for an item too heavy for editor layers (over `UIK.VE_LIMITS`: 100 layers or
1,500 keyframes as converted) or drawn in code (a `canvas` layer). `UIK.formatsOf(spec)` /
`UIK.canLayers(spec)` read it; every exporter follows it.

`params` (optional): `{ name: { label, type: 'slider' | 'number' | 'toggle' | 'select' | 'color', min, max, step, unit,
options, default } }` — `build(H, P)` gets every one (defaults filled). Build an item with `UIK.build(spec, values)`
(`UIK.paramsOf(spec, values)` = the filled set), never `spec.build(H)`. A layer's `ui: { label, controls }` is a
panel for the preview; the engine doesn't draw it ([building-items.md](building-items.md#controls-for-the-user)).

A film (`UIK.compose`) applies a scene's `params`, its `style` (per layer key) and the film's `recolor`, and marks
every built layer with `_key` (its id, or `~0.2.1`) and `_scene`; `spec.font` carries the film's font.
`UIK.style` = `{ restOf(L, prop), setProp(L, prop, v), recolor(L, map), normHex, sameColor }` — what a style does.

## Canvas layers (HTML-only items drawn in code)

A gallery or effect that is easier to draw than to build from layers is one `canvas` layer:
`canvas({ draw(ctx, { width, height, t, images, scale }), images, w, h, start })` — a canvas the size of
the frame by default (1920 × 1080), centred on `x, y` like any layer. `draw` is a pure function of `t`
(seconds since `start`): no `Date`, no `Math.random`, no state between frames. It gets a cleared
Canvas2D context of `width × height` device pixels (`scale` = pixels per frame unit) and paints no
background. `images` are the layer's pictures as `{ img, loaded, failed }` — draw a stand-in until
`loaded`. In a film the scene's pictures become the list (`images: ["assets/a.jpg", …]` or `'#1'`,
`'#2'` …) and the clock starts with the scene. The item declares `formats: ['html']`: it previews,
renders and exports as its page (a render waits for the pictures — `UIK.media.ready()`); there are no
parameters — one item is one fixed look.

## Layers and their props

Every layer takes the common props, and every numeric or colour prop can carry a track in `k`.

| Common prop | Meaning |
|---|---|
| `id` | name shown in the inspector (becomes the VE layer name) |
| `x`, `y` | centre relative to the parent's centre (px) |
| `opacity` | 0–1 |
| `scale`, `sx`, `sy` | uniform scale and per-axis scale (multiply) |
| `rot` | degrees (on screen, clockwise) |
| `rx`, `ry` | 3D: rotation around X / Y in degrees — `+rx` tilts the top away, `+ry` turns the right edge toward the viewer (the Video Editor's senses) |
| `depth` | 3D: px toward the camera (negative = farther away) |
| `blur` | px |
| `origin` | `[fx, fy]` transform origin as fractions of the box (−0.5…0.5); default = pin point / centre |
| `blend` | blend mode — use single-word modes (`multiply` `screen` `overlay` `difference` `saturation` `color` `luminosity`); they map to VE blend modes directly |
| `z` | static stacking order among siblings (paint order is otherwise DOM order and never changes) |
| `offscreen` | `true` = leaves the frame on purpose; `bounds.cjs` skips it |
| `k` | tracks, see below |
| `ch` | children |

**`rect({ w, h, r, fill, stroke, sw, dash, shadow, pin, chAt, clip, radii })`** — VE rectangle shape.
- `r` corner radius (capped at half the short side).
- `stroke` + `sw` = inside border ring (`dash: true` makes it a dashed border instead).
- `shadow`: 1 card, 2 floating, 3 small (knobs); static.
- `pin`: `'c'` default, or `'t' 'b' 'l' 'r' 'tl' 'br'…` — which box point sits on (x, y), so `w`/`h`
  tracks grow from that edge. `chAt: 'pin'` also places the children around the pin point.
- `clip: true` clips the children to the box (masks, windows, digit rolls, reveals).
- `radii: '28px 28px 8px 8px'` per-corner radius as a static CSS string.
- `notches: [{ at, r, sides }]` cuts real semicircle bites into the box edges (tickets, coupons,
  boarding passes): `at` = px from the box centre along the edge (x for `t`/`b`, y for `l`/`r`), `r` the
  bite radius, `sides` e.g. `'tb'` (default) or `'l'`. A bite at an edge's end (`at` = ±half the width)
  on a square corner becomes a quarter bite — the two halves of a torn ticket. The box, its children and
  its shadow are cut. In the VE the box becomes one closed path shape (static size).

**`circle({ d, fill, … })`, `ellipse({ w, h, fill, … })`** — VE circle / ellipse shapes.

**`text({ text, size, weight, color, ax, ls, lh, wrap, upper, italic, tnum, caret, num })`** — VE text layer.
- `ax` anchor: 0 left edge, 0.5 centre, 1 right edge. `y` is the vertical middle.
- `ls` letter spacing in em. `lh` line height. `wrap: px` enables wrapping at that width.
- Digits are proportional, like the editor's text (`tnum: true` forces tabular — lab only, avoid).
- **Placeholder tokens** in `text` are the editor's own and convert as is:
  `{{{COUNTER:0-2,480}}}` (range format = separators / decimals / zero-padding as typed; `100-0` counts
  down) and `{{{TIMER:05:00-00:00}}}` (`ss`, `mm:ss`, `h:mm:ss`; one value counts down to zero). Options
  after `;`: `style` odometer|roll|count · `start` s · `duration` s · `easing` lowercase key
  (`power3_out`, `expo_out`, `linear`, `back_out`…) · `turns` 0–10 · `lands` left|right|together ·
  `cascade` 0–90 · `direction` auto|up|down · `kf` id. COUNTER defaults: odometer, 1.8 s, power3_out;
  TIMER defaults: count, its own span in real time, linear. With `kf=1` the number follows the layer's
  `'ph:1'` track (0–100, eased by the segment's easing) instead of start/duration/easing.
- `reveal` track 0→1 = typewriter; `caret: true` with `caretColor`, `caretFrom`, `caretUntil` (s).
- `num: { pre, suf, dec, sep, pad, floor }` + a `value` track = a counting number that replaces `text`
  (older files; drawn as a Count-style COUNTER token keyed from the value track).
- Text has no box: `origin` does not apply; it scales and rotates about its anchor.

**`path({ d, stroke, sw, fill, cap, join, dash, trimmed })`** — VE line / path shape.
- `d` is SVG path data (string or array) in local px around (x, y).
- A filled path with no `stroke` draws no outline. An unfilled one defaults to an ink line.
- `trimmed: true` enables Trim Paths: tracks `trimS`, `trimE`, `trimO` (0–100).
- `dash: [a, b]` = dashed stroke (not together with trim).
- Circle ring: `M0 -R A R R 0 1 1 0 R A R R 0 1 1 0 -R` (starts at 12 o'clock, clockwise).

**`icon({ icon, paths, size, color, sw, filled, fill })`** — VE custom-SVG shape.
- `icon` names one of the icons below, or `paths: [...]` gives your own 24-grid stroke paths.
- `sw` is the stroke in screen px at the icon's size: 2.2–3 for icons ≤ 60 px, scale it up for big
  icons (112 px → ~6) so all icons read with the same weight.
- `filled: true` fills the paths with `fill` (e.g. a liked heart).

**`photo({ v, src, w, h, r, img, … })`** — a stand-in picture, or a real one with `img`; see Photos.
**`image({ img, w, h, r, fit })`** — a picture (logo, screenshot) in a box; see Photos.

**`group({ ch, clip, w, h })`** — VE parent null (or a sequence when it fades, blurs or clips).
Transforms, opacity and blur apply to all children, about the group's (0, 0). `origin` on a group
needs `w`/`h` (it is a fraction of that box).

**`cursorLayer(keys, clicks, drags, { inAt, size, ex, ey, k })`** — the pointer.
- `keys`: `[[t, x, y, easing?], …]` in world coordinates. x travels with `Power2 Smooth` and y with
  `Sine Smooth` (a slight arc). A 4th element sets the easing of the leg arriving at that key, so a
  drag or flick can match the dragged layer.
- `clicks: [t, …]` and `drags: [[t0, t1], …]` squeeze it.
- `inAt`: fade-in time. It keeps one screen size at any camera zoom.

## Tracks

```js
k: { x: [120, [0.4, 0.9, -40, 'Power4 Out'], [1.6, 60]] }
//       ^init  ^ ease from 120 to -40 over 0.4–0.9 s  ^ step to 60 at 1.6 s
```

- Numeric props: `x y w h r opacity scale sx sy rot blur sw size ls trimS trimE trimO reveal value`.
- Colour props: `fill stroke color` — values are tokens (`'acc'`, `'ink/40'`) or `'#FFFFFF'`, and they
  lerp in RGB.
- A segment that starts before the previous one ends interrupts it: it eases on from the value at its
  t0 (the converter writes a key there). Intentional for a press during a pop, a bug when two helpers
  collide — check merged tracks.
- Easings are the names in `UIK_EASINGS` (`lib/easings.js`): the Video Editor's catalogue plus the
  kit's spring curves `Spring Smooth`, `Spring Out` and `Spring Pop`, which export as the editor's
  Custom easing with their bezier. An unknown name warns and falls back to Linear. Every curve and when to
  use it: [easing.md](easing.md). A film's `motion` preset (`UIK.MOTION_PRESETS`) re-names segment
  easings by role in `UIK.compose`.

## Helpers (`UIK.h`)

| Helper | Returns |
|---|---|
| `k(...parts)` | merges track objects (tracks concatenate, the first `init` wins) |
| `enter(t, { d, dur, blur, s, dx, x0, dy, y0 })` | fade + un-blur + settle from 94 % (+ travel from an offset to `x0`/`y0`) |
| `exit(t, { dur, blur, s })` | fast blur-out |
| `popIn(t, { from, dur })` | the main shape's intro: scale 0.6 → 1 `Back Out` + 0.12 s fade |
| `pop(t, { from, to, dur, e })` | scale pop with `Back Out` + quick fade-in (badges, dots) |
| `press(t, { to, back })` | click squeeze on the pressed shape |
| `stagger(n, t, gap)` | `[t, t+gap, …]` |
| `fadeIn(t, dur)` | plain fade (no blur, no settle) |
| `ring(R)` | circle path data from 12 o'clock, clockwise (trimmed rings, dials) |
| `spinner({ id, x, y, R, sw, color, t0, t1, k })` | a 30 % arc spinning between t0 and t1 (put a `path({ d: ring(R), stroke: 'line' })` track under it if it needs one) |
| `digitCol({ id, x, y, w, h, digits, size, weight, color, k })` | one rolling digit column in a clip window; animate `k.y` to `-h × index` |
| `invEase(name, p)` / `cross(t0, t1, a, b, v, easing)` | when an eased move passes a value — switch things exactly as an edge crosses them |
| `rnd(i)` | deterministic 0…1 noise per index |
| `sample(f, t0, t1, { tol, fps })` | Linear segments approximating `f(t)` within `tol` (default 1) — formula-driven motion at a sane key count |
| `valueAt(trackArray, base, t)` | a numeric track's value at `t` (drive one layer from another's track) |
| `cursorLayer(...)` | see above |

## Camera

`cam: 1.4` or `cam: { zoom, x, y, tiltX, tiltY, dolly, k: { zoom: [...], x: [...], … } }`. `x/y` is the world point
framed at the centre. The visible world at zoom z is ±960/z × ±540/z. `tiltX` / `tiltY` (degrees, the senses of
`rx` / `ry`) turn the world around that point; `dolly` (px) moves the camera in. It exports as root joints every layer
hangs from.

## 3D space

Every item plays in the Video Editor's 3D space: a perspective camera with a 28° vertical field of view, the frame
at `depth` 0 exactly 1:1. A layer with `rx`, `ry` or `depth`, or a camera with `tiltX`, `tiltY` or `dolly`, uses it —
the preview draws it with CSS 3D, and the Video Editor and After Effects get real 3D layers (and in AE a camera at
the same distance), keyframes intact. Parents pass their 3D rotation and depth to their children.
- Turn the thing that turns: put `ry` on the card, and its content (texts, buttons, pictures on it) turns with it.
  Content on a card stays on top of it at any angle.
- A clipping box (`clip: true`) flattens its content onto itself — right for a window or a card. For depth inside a
  card (layers floating above it), don't clip that card.
- A fade or blur on a parent of 3D layers is passed down to them (CSS would flatten them otherwise), the way the
  editor applies it.
- Layers are flat planes: a cube, a sphere or a model is not a layer — that is the 3D engine (HTML scenes).
- Depth sells with the camera: `dolly` into a stack of layers at different `depth`, or `tiltY` across a tilted grid.
  Keep `rx` / `ry` within ±60° for UI you want read.

## Colour tokens

| Token | Light | Use |
|---|---|---|
| `bg` | #E9E7E2 | the canvas (stage background) |
| `card` | #FFFFFF | main surfaces |
| `panel` | #F4F2EE | light warm surfaces (windows, phones' screens) |
| `ink` | #0B0B0B | primary components, text |
| `inv` | #FFFFFF | text/icons on ink |
| `muted` | #8A8782 | secondary text |
| `line` | #E2DFD9 | hairlines |
| `skel` | #E6E3DE | skeleton bars, tracks on white |
| `soft` | #F1EFEB | chips, icon tiles |
| `dim` | #D6D3CE | off tracks, inactive dots |
| `acc` | #FF5A1F | the one accent (switchable in the lab) |
| `bad` | #E5484D | errors, destructive actions |
| `shade` | #0B0B0B | scrims / dimming — stays dark in the dark theme too |
| `white` | #FFFFFF | stays white in both themes (knobs, text on accent or on a `shade` panel) |

In the dark theme `ink` becomes light and `card` dark. Alpha: `'ink/40'` = 40 %.
`UIK.setTheme(theme, accent, colors)` — `colors` gives tokens the film's own values (`scenario.colors`).

Fonts: `UIK.FONTS` (Helvetica Neue — the default and the Video Editor's — Inter, Geist, Manrope, DM Sans, Fraunces),
`UIK.fontOf(name).stack`, `UIK.useFont(name)` (a page loads the web font; `UIK.media.ready()` waits for it).

## Icons

`arrow arrowUp arrowDown check x plus minus chevronDown chevronRight chevronUp chevronLeft search
folder file terminal clock coin chip sparkle bell heart star user users mail lock upload download play
pause calendar image link trash home chart trend moon sun pin message send zap shield eye filter command
refresh sliders mic globe copy bag volume flag info alert pencil layers video cloud bookmark grid list
settings dot phone share archive thumbsUp thumbsDown card maximize cube`

Lucide paths (ISC). Anything missing: `icon({ paths: ['M…', …] })` with 24-grid Lucide paths.

## Photos

`photo({ id, x, y, w, h, r, v, src, k, ch, shadow, pin })` is a rect with `clip: true` holding an
abstract composition in the kit palette, built at the size you pass. `v` picks it:

| v | Composition |
|---|---|
| 0 | sun over hills (accent sun) |
| 1 | mountains + moon |
| 2 | portrait |
| 3 | city skyline |
| 4 | circles (accent, dark background) |
| 5 | waves |
| 6 | product bottle |
| 7 | plant |
| 8 | arch + figure |
| 9 | stripes + dot |

- All rect props and tracks work; `w`/`h` tracks act as a crop.
- `ch` layers draw on top (captions, badges). In the VE they are separate layers above the image,
  masked by it.
- Windows/tiles/copies of ONE picture share `src: 'name'` — one media slot the user fills once.
- Vary `v` between neighbours. 0 and 4 carry the accent, so use them sparingly. `fill` overrides the
  composition's background — `v: 9` is white, so pass `fill: 'soft'` on `card` surfaces; pale photos on
  the bare canvas want `shadow: 3`.
- `w`/`h` tracks crop — they do not re-lay-out the picture. To grow a tile into a hero, build it at
  hero size and animate `scale`.
- In the VE a photo is ONE image layer (a media slot the user fills), so the inspector counts it once.

**Real pictures.** `photo({ img: 'assets/shot.png', … })` draws that picture (a URL, or a path next to
the page) instead of the stand-in, cropped to the box (`fit: 'cover'` default, or `'contain'`), with the
box's corners; its motion is the photo's. `image({ img, w, h, r, fit })` is the same with no fill and
square corners by default — logos, screenshots, product shots. A film fills an item's photo slots from
its scenario (`images: { '#1': … }`, UIK.compose in film.js). The converter makes it an editor **image
layer** scaled to cover the box (`UIK.toVE(spec, { imageSizes: { [img]: { w, h } } })` — the editor
draws a picture at its own pixel size, so the scale needs the file's size) and matted by the box; the
After Effects export imports it as footage (`files: { [img]: 'assets/x.png' }`, next to the .jsx).

## VE mapping and gaps

| Lab | VE |
|---|---|
| rect / circle / ellipse | shape layer (rectangle / circle / ellipse) |
| text | text layer (`reveal` = typewriter split by symbols) |
| path | line / path shape (Trim Paths = `lineTrimStart/End/Offset`) |
| icon, cursor | custom SVG shape |
| photo | its stand-in composition as shapes, clipped by the photo box (swap in an image layer) — with `img`, an image layer cover-scaled and matted by the box |
| group, or any layer with children | a 1 px parent null (keyframeParenting, additive) the children hang from; its opacity / blur multiply into the layers under it |
| rect with `clip: true` | a hidden matte shape (trackMatte) for its children; a clip inside a clip becomes ONE matte of both boxes' intersection |
| x, y, scale, sx, sy, rot, opacity, blur | translateX/Y, scale, scaleX/Y, rotate, opacity, blur |
| w, h | shapeWidthPx / shapeHeightPx |
| fill / color | shapeFill / textColor |
| r | borderRadius (corner radius track) |
| text `{{{COUNTER…}}}` / `{{{TIMER…}}}` | the same token in `textContent`; `'ph:<id>'` tracks → `propertyKeyframes["ph:<id>"]` |
| text `num` + `value` | `{{{COUNTER:a-b; style=count; kf=1}}}` + a `ph:1` track mapped from `value` |
| cam | a root parent null: scale = zoom, position = −zoom × focus (the cursor keeps its screen size) |
| rect `sw` / `stroke` tracks | borderWidth / borderColor tracks |
| text `reveal` + `caret` | text Reveal track (`textRevealProgress`, `textSplitTiming: "progress"`) + text caret (`textCaret*`) |

Not in the VE yet (the inspector flags them): font-size tracks and Trim Paths on an icon (a custom-SVG
icon is a filled silhouette — a check that draws on must be a `path`).
