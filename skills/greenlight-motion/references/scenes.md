# Scene pages

A film's scene is either a page you write (`"html": "scenes/<name>.html"`) or a ready-made library scene
(`"item": "<id>"`, [scenario.md](scenario.md)). This is the contract for the pages: what they get, what they may do,
and what makes them editable in the preview.

A scene page is **any web page**: HTML, CSS, SVG, canvas, WebGL (three.js is built in), web fonts, pictures, video.
Animate it the way you would any web page: CSS keyframes and transitions, the Web Animations API,
`requestAnimationFrame`, timers, SVG animation, a `<video>`. There is no layer model to fit into and no list of
allowed moves: if a browser can draw it, the film can have it.

## Time

Every scene page runs on the **page clock**. It replaces the page's time (`requestAnimationFrame`, `setTimeout`,
`setInterval`, `Date`, `performance.now()`), drives CSS and Web Animations, SVG animation and media, and seeds
`Math.random`. So the page animates exactly as it would in a browser, and every frame is exact: the preview scrubs
it, the storyboard takes stills from it, and a render records it frame by frame at any speed.

- Time starts at 0 when the scene starts (its own time, not the film's). The page lasts the scene's `duration`.
- A page that keeps state from frame to frame (a simulation, particles that move by their speed) is fine: the clock
  steps it forward frame by frame, and going back reloads it and steps it again. Keep that work light (a few
  thousand particles, not a million) so a scrub back stays quick.
- A page drawn in code can draw any moment directly with `GLScene` (below): then scrubbing costs nothing.
- Don't wait on the network or on real time: no `fetch` of data, no polling. Everything the scene shows is in the
  page or the project.

## The frame

- The page is the frame: `window.innerWidth × innerHeight` is the film's size (1920×1080, 1080×1920 …). Lay out in
  px or in `vw` / `vh`, with the body at `margin: 0` and nothing scrolling.
- The page is **transparent**. The film's `background` paints behind every scene. Paint your own ground only when
  the scene has one (a full-bleed colour field, a gradient, a picture).
- Scenes joined by `"transition": "fade"` overlap for 0.35 s; the incoming one holds its first frame while it fades
  in. Design a scene's first and last frames with its neighbours (a match cut beats a fade).

## What every page gets

The tools add these before the page's own scripts:

| | |
| --- | --- |
| `--gl-<name>` | The film's colours as CSS variables: every theme colour (`--gl-bg`, `--gl-card`, `--gl-panel`, `--gl-ink`, `--gl-inv`, `--gl-muted`, `--gl-line`, `--gl-skel`, `--gl-soft`, `--gl-dim`, `--gl-acc`, `--gl-bad`, `--gl-shade`, `--gl-white`) with the film's `theme`, `accent` and `colors`, plus a variable for each colour name of the film's own (`"colors": { "brand-2": "#FFD400" }` → `--gl-brand-2`). |
| `--gl-font` | The film's font stack (its Google font loads by itself; renders wait for it). |
| `data-image="key"` | An `<img>`, an SVG `<image>`, or any element (its background) shows the scene's picture `key` (`scenes[n].images`). |
| `glImage(key)` | That picture's URL, for code (a canvas, a texture). |
| `window.THREE` | three.js (r183) with `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `RoundedBoxGeometry`, `GLTFLoader`, `RoomEnvironment` — loaded only in pages that use `THREE`. |
| `GLScene({...})` | A helper for scenes drawn in code (below). |

**Use the film's colours, not literals**, for everything that belongs to the brand: `color: var(--gl-ink)`,
`background: var(--gl-acc)`, `color('acc')` in code. The Design tab changes them, and a changed accent must reach
every scene. A brand-new film sets its own palette as real values in `colors` and `accent` and still reads them
through the variables. Literal colours are for what never changes with the brand (a photo's shadow, pure white
light).

**Pictures come from the scene's `images`**, or from files you name in the page (`<img src="assets/shot.png">`,
`url(assets/texture.jpg)`, relative to the project or to the page's own folder). Either way the tools carry them
wherever the film plays: inlined in a GLEA clip, uploaded to a board, bundled into the After Effects package.
Prefer `images` for what the user will want to swap (a product shot, a logo).

## Editable elements

The preview lets the user click anything in a scene and change it: its words, colour, size, weight, case,
tracking, a shape's fill and corners, a picture, and where it sits (move, scale, rotate, hide). It works on any
page, with no work from you. Three things make it good:

- **Ids.** The tools give every element in your HTML a `data-gl` id and write it into the file. Keep them when you
  edit the page (they are how the user's edits find their element). An element your script makes gets its id
  from the nearest element with one (`"12/0/3"`: under element 12, child 0, then child 3), so build script-made
  elements under a stable parent.
- **Words that can be edited** sit alone in their element: `<h1 data-gl="4">Clutter</h1>`. An element with
  child elements (`Clutter <span>becomes</span>`) can't take new words without losing its children; split it
  into one element per word or line.
- **Panels for what matters.** Name the few elements the user will want to change, in the film's words:
  `data-ui-label="Headline"` (and `data-ui="text,color,size"` for the controls it offers: `text`, `color`, `fill`,
  `stroke`, `size`, `weight`, `case`, `tracking`, `radius`, `image`, `move`). The Elements tab shows these panels
  while the element is on screen. 2–4 per scene.

An edit is kept as `scenario.json → edits` ([scenario.md](scenario.md#edits)) and applied on top of the page: the
words and pictures are set on the element, and the styles are CSS rules that win over the page's own (an edited
colour stays edited while the page animates it). Moves add to the element's own motion.

## Scenes drawn in code: GLScene

For a canvas or WebGL scene, `GLScene` gives you a draw function of time, so any moment draws directly:

```html
<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; font-family: var(--gl-font); }
  .title { position: fixed; left: 0; right: 0; bottom: 140px; text-align: center; color: var(--gl-ink); font-size: 88px; font-weight: 700; z-index: 2; }
</style></head>
<body>
<div class="title" data-ui-label="Title" data-ui="text,color,size">Meet the cube</div>
<script>
GLScene({
  duration: 3,
  params: {
    spin: { label: 'Spin', type: 'slider', min: 0, max: 3, step: 0.1, default: 1 },
    glow: { label: 'Glow', type: 'slider', min: 0, max: 2, step: 0.05, default: 0.9 },
  },
  setup({ THREE, renderer, W, H, color }) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100); camera.position.set(0, 0.4, 7);
    const box = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.8, 1.8, 1.8, 6, 0.3),
      new THREE.MeshStandardMaterial({ color: color('acc'), roughness: 0.25, emissive: color('acc'), emissiveIntensity: 0.15 }));
    scene.add(box, new THREE.AmbientLight(0xffffff, 0.5));
    const composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.5, 0.2); composer.addPass(bloom);
    composer.addPass(new THREE.OutputPass());
    return { scene, camera, box, composer, bloom, dispose() { box.geometry.dispose(); box.material.dispose(); composer.dispose(); } };
  },
  draw(t, { state: s, P, tween }) {
    s.box.rotation.set(0.5 + t * 0.3 * P.spin, t * P.spin, 0);
    s.box.position.y = tween(t, 0, 0.9, -3, 0.2, 'spring');
    s.bloom.strength = P.glow;
    s.composer.render();
    document.querySelector('.title').style.opacity = String(tween(t, 0.6, 1.2, 0, 1, 'out'));
  },
});
</script>
</body></html>
```

- `setup(ctx)` builds the scene once and returns its state (give it `dispose()` when it holds GPU objects). It runs
  again after a theme change, new pictures, or a param with `rebuild: true`.
- `draw(t, ctx)` draws the frame at `t` seconds, called for any `t` in any order: keep it a function of `t` (and
  `ctx.random(seed)` for variety), no state carried from the last frame.
- `ctx`: `THREE`; `renderer` (a `WebGLRenderer` on a full-frame, transparent canvas behind the page's HTML, made on
  first use); `W`, `H`; `P` (the params, defaults filled); `state`; `color(name)` → `THREE.Color` of a film colour;
  `css(name, alpha%)` → a CSS colour; `ease(name)` (`spring`, `smooth`, `pop`, `out`, `in`, `inOut`, `expoOut`,
  `linear`); `tween(t, t0, t1, from, to, ease)`; `random(seed)` → a seeded `() => 0…1`; `image(key)`;
  `load(key | url)` → `Promise<THREE.Texture>` (renders wait for it); `duration`.
- `params` are the scene's **effects** the user tunes in the preview (`slider`, `number`, `toggle`, `select`,
  `color`, with `label`, `min`, `max`, `step`, `default`, `rebuild`). The scenario's `scenes[n].params` and the
  user's edits set them. 2–4 per scene: a glow, a speed, a count, an angle.
- A 2D canvas works the same: draw into your own `<canvas>` in `draw(t)` (no `renderer` needed).
- An error shows on the page as `Scene error: …` (red, top left).

## Craft

- **Text fits.** Measure long words at their size; nothing clips at the frame edge unless you crop it on purpose.
  Use `white-space: nowrap` and a size that fits, or wrap on purpose.
- **Motion has intent.** Easing contrast (a fast attack, a long settle), overlap (nothing starts or stops
  together), one signature move per film ([original-films.md](original-films.md)). The film's motion feel in CSS:
  [easing.md](easing.md#in-a-scene-page).
- **Clean intros.** No turbulence or ripple warps over the title while it is read.
- **Performance.** A render records every frame. Keep a scene to what a laptop draws at 60 fps: one WebGL canvas,
  a few thousand particles, blurs on a few elements (not on a full-frame layer every frame).
- **One scene, one idea.** A page is one shot. Cut between shots with the scenario's transitions, or carry the move
  across the cut yourself (the last frame of one page matches the first of the next).

## Check it

- `node SKILL/tools/check.mjs <project>`: every page exists, every picture and every file a page names is in the
  project, and the user's edits still find their elements.
- `node SKILL/tools/stills.mjs <project> --scene <n> --n 8`: a contact sheet of the scene. Look at it like the art
  director will: type, spacing, contrast, the moments between the key poses.
- The preview (`preview.mjs`) plays the film with every scene; scrub the cuts.
