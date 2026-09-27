# Under a GreenLight Dash board

The tools run in board mode when they find the app: `GREENLIGHT_API_BASE_URL` (set in the app's
terminals; `GREENLIGHT_API_TOKEN` is sent when present) and a current board
(`GET /api/moodboards/current`). `--api <url> --board <id>` picks one explicitly, `--standalone`
turns board mode off.

## The pipeline

Under a board, the film is a GreenLight Dash **pipeline** (the app's model:
`skills/greenlight-dash/references/pipelines.md`). `tools/pipeline.mjs` builds it and keeps it up to date,
and every card tool fills its own step:

- **The flow row:** Brief (the starter: the brief's text and its pictures) → Capture the site → Scenario →
  Storyboard → Preview → Render & export → Final film, wired in order. Every step has Instructions,
  Assets and Results panes, plus a status light: waiting, in progress, finished or error.
- **The gates:** Scenario, Storyboard and Preview wait for the user. In quick mode (`workflow.mode: "quick"` in
  brief.json) only Preview does: the flow has no Storyboard step, and the scenario card opens no gate. When a card tool shows its card,
  the step turns finished and **Requires Approval**, and the pipeline container's note says which step waits.
  When a later step's tool runs, every earlier gate still open becomes **Approved**, and a step that never ran
  (a skipped storyboard, say) is finished as "Skipped". `storyboard.mjs --pick`, `--approve <key>` and
  `--require <key>` set a gate by hand. A step that is no longer in the flow is removed with its lane and card
  the next time a tool runs.
- **The review lane:** under the flow, one frame per card step, wired from its step. Each card sits at its
  full size: the screenshots, the scenario card (the story), the storyboard (every shot with its copy and
  voice-over, and the library scenes list), and the preview. A lane grows or shrinks to its card, and the pipeline reflows.
  Until its card arrives, an empty lane holds a note saying what will appear there; the card replaces it.
- **Render & export:** `render.mjs` and `export.mjs` mark it running, then finished, and list what they made in
  its Results pane. The film lands in **Final film**, and the pipeline finishes.
- **Capture and Storyboard** are there when the brief names a website and does not skip the storyboard.

| Tool | In the pipeline |
| --- | --- |
| `pipeline.mjs` | Creates the pipeline in free space right of everything, or brings it up to date. `--step <key> --status in_progress` before you work on a step, `--approve <key>`, `--require <key>`, `--done`. |
| `capture.mjs` | The app's browser takes the screenshots (`POST /api/site-capture`: nothing to install). They show at full size in the Capture lane; Capture is finished. |
| `story.mjs` | The "<name> — scenario" card (1200 wide, as tall as its beats): the story in words, big enough to read from the pipeline, with a note to read it before anything is built. Scenario: finished, Requires Approval. |
| `storyboard.mjs` | The storyboard card (1400 wide, as tall as its shots and their words): a still of every shot, and the library scenes the directions use. Scenario approved; Storyboard finished, Requires Approval; `--pick` approves it. |
| `preview.mjs` | The preview card (1600×1000): the film, and the user edits any element on it (their edits are saved on the card). Storyboard (or, with no storyboard, Scenario) approved; Preview finished, Requires Approval. Under a board the card has **no Render or Export**: its top bar says the agent renders and exports once the user approves. |
| `render.mjs` | Preview approved; Render & export running. The app renders the film (`POST /api/html/render`), `render.mjs` mixes the voice-over and the sound effects in with ffmpeg, and the film is placed in Final film. |
| `export.mjs --format glea` | A Video Editor project named after the film: one HTML clip per scene (the scene pages live in the film's folder), the voice-over on a Voice channel, the sound effects on their own channels, the film's background and colour tokens set. Listed in Render & export. |
| `ae` | The After Effects package (`<id>-after-effects.zip`) in the film's folder: PROMPT.md, the scene pages, reference stills, the assets and the script runner ([export.md](export.md)). An agent builds the project with After Effects open. |
| `gallery.mjs` (optional) | The "<name> — gallery" card in free space: every scene playing, plus the library scenes and their alternatives. Not part of the pipeline. |
| `stills.mjs` | The app records the frames (`POST /api/html/stills`, saved nowhere); the sheet is assembled locally with ffmpeg. |

The app's agent terminal has the app's own ffmpeg and ffprobe on its PATH. Nothing under a board needs a
Python: never look for one or install one.

**Pictures in the pipeline are uploaded copies** (the `greenlight-motion-<project>-pipeline` folder). Deleting a
card on the canvas moves its file to the app's trash when nothing else uses it, and the pipeline's "reset
run" clears its Results panes. With copies, neither ever touches the project's own files.

Files go into one board folder per film, `greenlight-motion-<id>` (pictures, voice clips, scene pages, the
scenario as `scenario.json`, exports, mixed renders). Uploads never overwrite, so the project keeps
`.board.json`: what it already uploaded (by content hash), which cards it made, and the pipeline's ids. The
next run updates the same cards and the same pipeline instead of adding new ones. Delete `.board.json` to
start over on a board.

## Cards

The cards are ordinary HTML cards: the pages run same-origin with the app. Re-running a card tool rewrites
its card in place (the canvas reloads it) and keeps it in its lane. Pictures are referenced relative to the
board folder, which is also where the app records a render from, so the preview and its renders show the
same thing.

## The user's edits

The preview card lets the user edit the film (Elements, Design). The card saves each change on itself: its
element's `data.muEdits = { edits, at }` (a versioned write, the page itself never changes). `preview.mjs`,
`render.mjs`, `export.mjs` and `edits.mjs` pull them into `scenario.json → edits` before they build, so the render
and the exports carry them. `edits.mjs --fold` / `--clear` clear the card too.

## Endpoints used

```
GET  /api/moodboards/current                     the board
POST /api/upload?board_id=&folder=greenlight-motion-<id>  pictures, voice clips, scene pages, exports
POST /api/moodboards/{id}/elements               the HTML cards   → PUT …/elements/{eid}/html
GET, PUT /api/moodboards/{id}/elements/{eid}     the preview card's saved edits (data.muEdits; PUT with expected_version)
POST /api/moodboards/{id}/frames, …/notes, …/arrows   the pipeline (PUT …/elements bulk moves, PUT …/frames/{id} fits it)
POST /api/moodboards/{id}/video-projects         the GLEA projects
POST /api/html/render                            renders   → POST /api/moodboards/{id}/media/place
POST /api/site-capture, /api/html/stills         capture.mjs, stills.mjs (the app's browser)
GET  /api/ai/models, POST /api/ai/generate       text-to-speech (voiceover.mjs)
GET  /api/libraries, /api/libraries/sound         the Sound Library (sfx.mjs); files at /media/lib/sound/<path>
POST /api/asset-packs/motion-design/install       installs the Motion Design Pack when the library is empty
GET  /api/asset-packs/jobs/{job_id}               its progress (state running → done | error)
```
