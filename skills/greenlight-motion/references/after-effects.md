# After Effects: an agent rebuilds the film

`export.mjs --format ae` writes a package for an agent (you, or the user's) that rebuilds the film in After Effects as a
native, editable project: one comp per scene inside a main comp, shape and text layers, keyframes that match the scene
pages' timing and easing, the pictures and the audio.

**After Effects must be installed and open** (macOS; the runner drives it through AppleScript). Never launch it
yourself, and never run anything in the user's After Effects without asking first: a script that raises a dialog blocks
their session.

## The package

```
exports/<id>-after-effects/
  PROMPT.md            the task: read it first
  timeline.json        size, fps, length; every scene's window, transition, page, stills; voice-over and sound cues
  scenes/scene-N.html  every scene as a self-contained page: the ground truth for layout, colours, type and motion
  reference/           stills of every scene (and film.mp4 when the film was rendered): what the comps must match
  assets/              the pictures, the voice-over and the sound effects
  scripts/ae/          gl-ae-run.sh + gl-ae-prelude.jsx: the only way to run scripts in After Effects
  after-effects.md     this guide
```

## Run scripts only through the bundled helpers

```bash
scripts/ae/gl-ae-run.sh --probe                              # is AE running and accepting scripts?
scripts/ae/gl-ae-run.sh /abs/path/build.jsx [--log /abs/path/build.log] [--timeout 600]
```

`gl-ae-run.sh` loads `gl-ae-prelude.jsx` before your script, runs it with `DoScriptFile` inside an AppleScript timeout,
catches errors outside `GL.run` (syntax errors too) and prints the log.

| Exit | Meaning | What to do |
| --- | --- | --- |
| 0 | ran, log ends with `END` | continue |
| 2 | AE running but not executing scripts | a modal alert is open (or AE is starting): ask the user to click **OK** once, then probe once |
| 3 | AE not running / not installed | ask the user to open After Effects and wait for its normal window; don't launch it yourself |
| 4 | your script logged `ERROR …` | read the logged message: the real error with its line |
| 5 | no `END` in the log | the script aborted; an alert may be open: same as exit 2 |

Write every script against the prelude's `GL`:

```js
GL.run('Build Spring drop', function () {
  GL.newOwnProject('Spring drop');                       // throws instead of touching the user's project
  var root = app.project.items.addFolder('Spring drop'); // marker folder = "this project is ours"
  var comp = app.project.items.addComp('Scene 1 · Hook', 1920, 1080, 1, 3, 30);
  comp.parentFolder = root;
  // … build layers, logging each: GL.log('layer', layer.name)
  app.project.save(new File('/abs/path/Spring drop.aep'));
});
```

## Rules that prevent the blocking alerts

1. **Never join a non-string into a string** (`'x' + err`, `'x' + file`): it raises inside `catch` and turns a harmless
   error into an alert. Log through `GL.log(...)`, convert with `GL.str(v)`.
2. **Keep all work inside `GL.run`**: warning dialogs suppressed, an undo group, every exception logged with its line.
3. **One alert blocks everything.** On exit 2 or 5 ask the user once to dismiss it. Don't loop probes or re-send the build.
4. **Never close or replace the user's project.** `GL.newOwnProject(marker)` reuses an empty untitled project, closes one
   with your marker folder, and otherwise throws.
5. **Try an unfamiliar API call on a scratch comp first**, then run the full build. Log after every layer.

## From a scene page to a comp

1. **Measure the page in a browser** (Playwright / headless Chrome): open `scenes/scene-N.html`, call
   `window.__glSeek(t)` for the moments you need, and read `getBoundingClientRect()` and `getComputedStyle()` of every
   element (text runs, shapes, pictures). Read the animations: `document.getAnimations()` gives each CSS / Web Animation's
   keyframes, timing and easing; a script-driven or canvas scene is read from its code and from frames at several `t`.
2. **Map CSS to After Effects:**

   | CSS | After Effects |
   | --- | --- |
   | `transform` / `opacity` keyframes with `cubic-bezier` | layer transform keys via `GL.setKeys` (exact eases) |
   | `overflow: hidden` rise / reveal, `clip-path` wipe | layer motion + a static alpha track matte |
   | SVG stroke draw (`stroke-dashoffset`) | Trim Paths *End* 0 → 100 |
   | `letter-spacing` | `tracking` (em/1000); animated: Text Animator Tracking (≈ px per gap) |
   | `filter: blur(σ)` | Gaussian Blur, Blurriness ≈ 3.55·σ |
   | `box-shadow: 0 y B color` | Drop Shadow: Direction 180, Distance y, Softness ≈ 2.53·B |
   | `linear-gradient` | Gradient Ramp on solids (one per band), in a precomp |
   | a group that scales / fades as one | a precomp |
   | canvas / WebGL drawing, particles | rebuild with shape layers, CC Particle World or an effect; if it can't be rebuilt faithfully, import the scene's render as footage and say so |
   | a counter | Source Text expression + a Slider Control |

   `GL.setKeys(prop, [[t, v], …], [[x1, y1, x2, y2] | 'linear' | 'hold', …])` sets keys from CSS curves exactly (colour and
   spatial properties handled). CSS keywords: `ease-out` = `[0, 0, .58, 1]`, `ease-in-out` = `[.42, 0, .58, 1]`.
3. **Text:** set `text` first, then `font` (PostScript name), `fontSize`, `fillColor`, `tracking`, `justification`.
   **Read `font` back**: a missing font is silently replaced. Point text sits on its baseline.
4. **Fonts:** After Effects renders only installed fonts and reads the list at startup. The film's font is in
   `timeline.json`; if it isn't installed, tell the user which one to install (Google Fonts) before AE is opened.
5. **The main comp:** every scene comp at its window from `timeline.json` (`from` … `to`); a fade is an opacity ramp over
   the overlap (0.35 s). The voice-over and sound effects go on audio layers at their `start`.
6. **Verify:** render with `aerender` (it runs while AE is open), take frames at the reference stills' times, and compare
   them side by side with `reference/`. Fix, rebuild, repeat, then save the `.aep` into the package folder.
