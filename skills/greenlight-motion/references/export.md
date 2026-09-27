# Exports

```
node SKILL/tools/export.mjs <project> --format glea | ae
```

Every export carries the user's edits from the preview (`scenario.json → edits`): words, colours, sizes, moves,
pictures, params, the film's font.

## GLEA: the GreenLight Dash Video Editor

`--format glea`. Every scene becomes an **HTML clip**: its page, self-contained (the scene kit, three.js when it
uses it, its pictures and every file it names inlined, the film's colours, the user's edits), at the scene's time
window. It looks exactly like the preview. The voice-over goes on a Voice channel and the sound effects on
**Sound effects** audio channels (a lane per overlap, each clip at its cue's level). The project carries the film's
background and its colours as colour tokens. Scenes joined by a fade sit on two alternating channels with an
opacity ramp over the overlap.

- Under a board: the project is created on the board (Video Editor ▸ Projects), its scene pages in the film's board
  folder.
- Standalone: `exports/<id>-glea.zip` (`project.json` + `media/…`). The user imports it: Video Editor ▸ Projects ▸
  Import project, or `POST /api/moodboards/{id}/video-projects/import` with the file.

In the editor, a clip plays on the editor's clock and renders with the rest of the timeline. The user double-clicks
it to edit the page's code, and can add the editor's own layers, effects and transitions around it.

## After Effects: an agent builds it

`--format ae`. After Effects gets a **native project**, built by an agent (you, or the user's) from the scene pages: the
package is everything the agent needs, and `PROMPT.md` is its task.

**After Effects must be installed and open** while the agent builds it (macOS; scripts run through AppleScript).
Tell the user so when they ask for it. Nothing runs in After Effects until they ask for it.

```
exports/<id>-after-effects/          (and <id>-after-effects.zip)
  PROMPT.md            the task: rebuild the film as comps, shape and text layers, keyframes, precomps
  timeline.json        size, fps, length, background, font (and its PostScript name), colours, every scene's
                       window, transition, page and stills; the voice-over and sound cues
  scenes/scene-N.html  every scene as a self-contained page: the ground truth for layout, colour, type and motion
  reference/           three stills per scene (the app under a board, the render engine standalone) and film.mp4
                       when the film was rendered
  assets/              the pictures, the voice-over and the sound effects
  scripts/ae/          gl-ae-run.sh + gl-ae-prelude.jsx: the safe way to run scripts in After Effects
  after-effects.md     how to measure a page and map CSS to After Effects, how to run scripts, how to verify
```

Under a board the zip also goes into the film's board folder. To build it yourself: read `PROMPT.md` and
[after-effects.md](after-effects.md), probe After Effects (`scripts/ae/gl-ae-run.sh --probe`), then build scene by
scene and compare with the stills. **Never run a script in the user's After Effects without asking**: one alert
blocks their session.
