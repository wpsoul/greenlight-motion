# The 3D engine

A film is built one of two ways, chosen **per film** in `scenario.json → engine` (from the brief's `look.engine`):

| | `default` (or no `engine`) | `3d` |
|---|---|---|
| A scene is | a GL Motion item (library or `items/*.js`): layers | an HTML page you write (`scenes/*.html`) |
| 3D | 3D space: layers turn (`rx`, `ry`), sit at a depth, the camera tilts and dollies ([engine-api.md](engine-api.md#3d-space)) | anything three.js does on WebGL: models, lights, glow, particles, materials |
| Video Editor | every layer editable | each scene is an **HTML clip**; the user edits it as code (double-click opens the code editor) |
| After Effects | yes | **no** |
| Preview edits | every layer's text, colour, size… | the page's `data-ui` elements, your `params`, the film's colours and font |

Pick `3d` only when the story needs real 3D objects (a product model, a glowing logo in space, a particle field).
Turning cards, depth and camera moves are the default engine's 3D space, and stay editable everywhere. Films are
never mixed: a 3D-engine film has only HTML scenes.

## The film

```json
{
  "name": "Cube launch", "engine": "3d", "size": { "w": 1920, "h": 1080 }, "fps": 30,
  "theme": "dark", "accent": "#33EFAB", "background": "#0B0B0F",
  "scenes": [
    { "html": "scenes/cube.html", "title": "The cube", "duration": 3, "params": { "spin": 1.2 }, "text": { "title": "Meet the cube" } },
    { "html": "scenes/rings.html", "title": "Rings", "duration": 3, "transition": "fade", "images": { "logo": "assets/logo.png" } }
  ]
}
```

A scene has `html` (its page, relative to the project) instead of `item`. `title`, `duration` (default 4 s),
`transition` (`cut` / `fade`), `voice`, `params`, `text` (data-ui-id → text), `style` (data-ui-id → `color`, `size`,
`weight`, `upper`) and `images` (key → file) work as for items. `story`, `storyboard`, `voiceover`, `sfx`, `edits`,
`theme`, `accent`, `colors`, `font` and `background` are the same as in [scenario.md](scenario.md). No `gallery`,
no `ui`, no `recolor` (the page reads the tokens itself).

## A scene page

Any HTML, CSS and JS. The page gets `window.THREE` (three.js r183, with `EffectComposer`, `RenderPass`,
`UnrealBloomPass`, `OutputPass`, `RoundedBoxGeometry`, `GLTFLoader`, `RoomEnvironment`) and `MUScene` before its
own code runs. Call `MUScene` once:

```html
<!doctype html><html><head><meta charset="utf-8">
<style>
  body { font-family: var(--mu-font); }
  .title { position: fixed; left: 0; right: 0; bottom: 140px; text-align: center; color: var(--mu-ink); font-size: 88px; font-weight: 700; z-index: 2; }
</style></head>
<body>
<div class="title" data-ui-id="title" data-ui="text,color,size" data-ui-label="Title">Meet the cube</div>
<script>
MUScene({
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
- `draw(t, ctx)` draws the frame at `t` seconds into the scene. It is called for any `t`, in any order (renders
  seek; the preview scrubs), so **every frame is a pure function of `t`**: no `Date`, `Math.random`, timers,
  physics that steps per frame or state carried from the last frame. `check` warns about them.
- `ctx`: `THREE`; `renderer` (a `WebGLRenderer` on a full-frame canvas behind the page's HTML, made on first use,
  transparent); `W`, `H` (the frame); `P` (the params, defaults filled); `state`; `color(token)` → `THREE.Color`;
  `css(token, alpha%)` → a CSS colour; `ease(name)` (`spring`, `smooth`, `pop`, `out`, `in`, `inOut`, `expoOut`,
  `linear`); `tween(t, t0, t1, from, to, ease)`; `random(seed)` → a seeded `() => 0…1`; `image(key)` → the
  scene's picture URL; `load(key | url)` → `Promise<THREE.Texture>` (renders wait for it); `duration`.
- **Colours** are the film's tokens (`ink`, `card`, `panel`, `acc`, `muted`, `line`, `soft`, `dim`, `bg` … — see
  [engine-api.md](engine-api.md)) with the user's edits applied. Use `color('acc')` / `css('ink')` in code and
  `var(--mu-acc)` / `var(--mu-ink)` in CSS, never literals, so the Design tab recolours the scene. The film's font
  is `var(--mu-font)`.
- **Pictures** come from the scene's `images` (key → file): `<img data-image="logo">` (or any element: its
  background) or `ctx.load('logo')` for a texture. Never a path of your own: the tools map the keys wherever the
  film plays (a board, a file, an artifact, the Video Editor).
- **Text the user edits**: give an element `data-ui-id="title"`, `data-ui="text,color,size"` (any of `text`,
  `color`, `size`, `weight`, `upper`) and `data-ui-label="Title"`. The preview's Elements tab shows a panel for
  it; `text` and `style` in the scenario (and the user's edits) set it. Keep that element's text plain (no child
  elements: an edit replaces its text).
- **Effects the user tunes**: `params` (`slider`, `number`, `toggle`, `select`, `color` — as for items), read from
  `ctx.P` in `draw` (or in `setup`, with `rebuild: true`). 2–4 per scene, the ones worth changing: a glow, a spin
  speed, a particle count.
- The page is transparent: the film's `background` paints behind it. No external scripts, stylesheets, fonts or
  files from the web: renders and the Video Editor play the page offline. Build objects in code (geometry,
  materials, lights, shaders); pictures come through `images`.
- An error shows on the page as `Scene error: …` (red, top left). Look at stills before you show anything.

## Tools

- `check.mjs <project>` checks every scene has a page that calls `MUScene`, its pictures exist, and the page doesn't
  use `Math.random` / `Date` / timers.
- `story.mjs`, `script.mjs`, `voiceover.mjs`, `preview.mjs`, `serve.mjs`, `edits.mjs`, `render.mjs` and `stills.mjs`
  work as for any film. `sfx.mjs --auto` cues only the cuts and fades (it can't see inside a page): add the rest
  of the cues yourself.
- `storyboard.mjs` shows a still of every shot (the app, or the render engine standalone, takes them). A variant's
  scenes point at pages too.
- `gallery.mjs` is for library items: not for a 3D-engine film.
- `export.mjs --format glea-html` (`glea-layers` gives the same: there are no layers) places each scene as an
  HTML clip in its time window. `--format ae` is refused.

## The Video Editor

Each scene is one HTML clip holding the page with three.js and the runtime inlined, the pictures, the theme and the
user's edits. It plays on the clip's clock. The user double-clicks it to edit the code; there are no layers to edit.
Say so when you hand over the project.
