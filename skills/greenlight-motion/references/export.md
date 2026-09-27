# Exports

```
node SKILL/tools/export.mjs <project> --format glea-layers | glea-html | ae
```

GLEA is GreenLight Dash's editor. Under a board the GLEA exports create the Video Editor project on the
board; standalone they write a bundle the user imports (Video Editor ▸ Projects ▸ Import project, or
`POST /api/moodboards/{id}/video-projects/import` with the file).

Every export carries the user's edits from the preview (`scenario.json → edits`): colours, text, sizes, params,
the font. A film font other than Helvetica Neue goes into the Video Editor as the text layers' font (the editor
loads Google fonts by name) and into After Effects as its PostScript name (`Inter-Bold` …; the font must be
installed).

## GLEA with layers (recommended)

`exports/<id>-glea-layers.zip` (standalone) — `project.json` + `media/…`.

Each scene is converted into native editor layers — shapes, text, custom-SVG icons, parent nulls
for groups (additive parenting), track mattes for clipping, `{{{COUNTER}}}` / `{{{TIMER}}}`
placeholders for numbers — laid out in the film's frame. Every scene's layers sit in that scene's
time window; scenes joined by a fade alternate between two sets of channels so no channel ever holds
two live layers. Pictures become image layers scaled to cover their slot and matted by it. The
voice-over is a Voice channel; the sound effects go on **Sound effects** audio channels (a lane per
overlap, each clip at its cue's gain as volume, no ducking in the editor). The project carries the film's background and its colour tokens. Keyframes keep
their easing names. The spring curves (the default `motion`) become **Custom** keys that carry their
bezier, which the editor's graph editor shows and can edit.

A scene whose item is **HTML only** (too heavy for editor layers — `formats: ['html']`) is placed as
its HTML clip instead, at the same window; the other scenes stay layers.

Photos without a picture of the user's become one **image layer** each (the placeholder as a small
svg, cropped by the photo's box): replace that media with a real picture in the editor. Copies of one
picture share one clip, so replacing it once updates every copy.

Checked against the Video Editor's renderer: frames match the film page within ~1 % of pixels. What
the editor can't do is approximated and listed in the tool's `approx` output (e.g. a clip inside a
clip becomes one intersection matte; interrupted segments are sampled into linear keys).

## GLEA with HTML cards

`exports/<id>-glea-html.zip` — one self-contained HTML page per scene (its pictures inlined) as an
HTML clip, at the scene's window. Looks exactly like the preview; to change it, edit the page. The
editor bakes HTML clips before it renders them.

A **3D-engine film** ([3d-engine.md](3d-engine.md)) always exports this way (`glea-layers` gives the same:
its scenes have no layers): each scene's page with three.js and the scene runtime inlined, its pictures, the
film's colours and the user's edits. The clip plays on its own clock; the user double-clicks it to edit the code.

## As After Effects

`exports/<id>-after-effects/<id>.jsx` + `assets/` (and the same as a `.zip`). Run the .jsx in After
Effects (File ▸ Scripts ▸ Run Script File…) with `assets/` next to it. It builds one comp with native
layers: nulls (parented), shape layers (rect roundness, paths, Trim Paths), text layers (Helvetica
Neue, tracking, a Text Animator for typing), 3D layers and a camera for a film that uses 3D space (X / Y
Rotation, depth; the film camera's tilt and dolly on a parent null), footage for pictures (and for HTML-only scenes: they
are pre-rendered to ProRes 4444 with alpha — by the render engine, or by the app on a board — and
placed at their time), track mattes, Gaussian Blur and Drop
Shadow; easings become AE temporal ease; counters are Source Text expressions driven by a "Progress"
slider. Bounce / elastic curves are baked into linear keys. A 3D-engine film has no After Effects export:
`--format ae` is refused.

**Never run the script in the user's open After Effects without asking.** Scripts that raise a dialog
block their session. If they ask you to run it, follow their app's scripting guide (GreenLight Dash:
`skills/greenlight-dash/references/after-effects-scripting.md`) — a runner that logs instead of alerting.
