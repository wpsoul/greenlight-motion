# Sound design

Sound effects make a film feel finished: a key click per typed letter, a soft pop when a card appears, a
whoosh on a camera move, a low hit when the frame floods to the next world. They come from the
GreenLight Dash **Sound Library**, sit on the film's own events and play under the voice-over.

```
node SKILL/tools/sfx.mjs <project> --library              where the sounds come from, candidates per role
node SKILL/tools/sfx.mjs <project> --events               the film's events (what --auto listens to)
node SKILL/tools/sfx.mjs <project> --auto [--density calm|normal|rich]
node SKILL/tools/sfx.mjs <project> --list whoosh [--limit 20]     candidate sounds: length, peak
node SKILL/tools/sfx.mjs <project> --resolve              after you edit the cues
node SKILL/tools/sfx.mjs <project> --clear
```

## Where the sounds come from

1. `--sounds <folder>`: any folder of sound files (the user's own). Roles match folder names (below).
2. **Under a board**: the app's Sound Library through the API. When it has no sounds at all, the tool
   installs the **Motion Design Pack** first (the app's own pack installer: `POST /api/asset-packs/motion-design/install`,
   about 230 MB), then continues. The files are read from the app's library folder when the app runs on
   this machine, otherwise fetched from `/media/lib/sound/…`.
3. **Standalone**: the app's library folder on this machine (`<userData>/libraries/sound`; `LIBRARY_DIR`
   or `GREENLIGHT_LIBRARY_DIR` override). With no library, the tool says so; ask the user for a folder of
   sounds or to install GreenLight Dash's Motion Design Pack.

## The workflow

Run it after the voice-over is recorded (the voice decides where the sounds must stay quiet), before
the render.

1. `--auto` reads the film and cues its events. In a library scene it sees what happens inside:

   | Event in the film | Role |
   | --- | --- |
   | a `reveal` track adds or removes characters | `key` (one per character; fast typing → one `typing` texture) |
   | a press squeeze (`press()`), the cursor's click | `click` |
   | a shape scales in from ≤ 0.65 (`pop()`, `popIn()`) | `pop`; four or more within 0.25 s → `tick` |
   | a camera move (zoom × 1.25 or a 220 px pan, quick enough) | `whoosh`, its peak on the fastest frame |
   | a layer travelling ≥ 900 px on screen | `whoosh` (quieter; skipped next to a camera whoosh) |
   | a shape growing past the frame (a flood, an iris) | `transition` |
   | a `{{{COUNTER}}}` / `{{{TIMER}}}` running | `data` texture for its length, `tick` where it lands |
   | a `fade` between scenes | `whoosh` (quiet) |

   Only events that are visible and in frame count. A page you wrote is its own code, so `--auto` cues only
   its cuts and fades (a `transition` hit on a cut into or out of it): cue what happens inside it yourself
   (`t`: the film second it hits; the scene's start is in the preview's scene bar), from what you animated:
   typing, pops, the big move, the landing. Mark them `"keep": true`.
2. **Review it like a sound designer.** Read `scenario.sfx.cues` against the preview:
   - Remove clutter. A sound per event is too much when ten things happen in a second: keep the one
     that carries the beat. Silence before a big moment makes it land.
   - Add what the film's data cannot show: a toggle flipping (`switch`), a result landing (`success`),
     a low `impact` under a big reveal, a soft whoosh when the film opens.
   - Swap a sound: `--list <role>` shows candidates with their length and peak; put the one you want in
     `sound`.
   - Mark your own cues `"keep": true`. A later `--auto` keeps them and replaces the rest.
3. `--resolve` prepares every cue's file (`sfx/*.m4a`: trimmed to `dur`, peak-normalised to −1 dBFS) and
   measures where its peak falls. `--auto` resolves by itself.
4. Re-run `preview.mjs`: the preview plays the cues with the voice-over (ticks under the scene bar;
   the preview does not duck). Then render.

## A cue

```json
{ "t": 4.2, "sound": "Vector Motion Sound/Whoosh/UIMvmt_WHOOSH-Light Whoosh 01_Ocular_Vector.wav", "gain": -15, "role": "whoosh", "label": "camera pushes in" }
{ "at": 5.5, "dur": 1.4, "sound": "Motion Design Pack/Data/Data 8.wav", "gain": -18, "role": "data", "label": "the counter rolls" }
```

| Field | Meaning |
| --- | --- |
| `t` | The film second the sound's **peak** lands on: a hit on the click, a whoosh on the fastest frame. |
| `at` | Instead of `t`: the film second the file **starts** (textures: typing, data, ambience). |
| `sound` | A path inside the Sound Library (or `--sounds` folder), a path in the project, or an absolute path. |
| `gain` | dB, after the file is normalised to −1 dBFS peak. Keys −18, clicks −14, pops −20, ticks −23, whooshes −15, transitions −16, data −18, success −15, impacts −19 (the role defaults). |
| `dur` | Trim the file to this many seconds (with a short fade). |
| `role`, `label` | What it is and what it is for (the preview, the editor's clip names). |
| `keep` | `true`: `--auto` keeps this cue. |
| `file`, `peak`, `length` | Written by `--resolve`. |

`scenario.sfx.duck` (default `true`) ducks the effects under the voice-over; `scenario.sfx.loudness`
(default −16 LUFS) is the film's loudness.

## Roles

| Role | Library folders (preferred first) | For |
| --- | --- | --- |
| `key` | Click (keyboard clicks) | a typed character |
| `typing` | Text, Computer Keyboard Typing | fast typing, as one texture |
| `click` | Click, Notifications and Buttons | presses, cursor clicks |
| `switch` | Click (switches) | toggles, segmented controls |
| `pop` | Pop-Up, Bubble | something appears |
| `tick` | Tiles, Hover, Bleep | many small things appear, a number lands |
| `whoosh` | Whoosh, Swoosh | camera moves, big moves |
| `transition` | Full Screen Transition, SFX / Ambient / Cyber Transition | floods, irises, world changes |
| `data` | Data | counters, progress, rendering |
| `success` | Pop-Up (tonal), Notifications and Buttons, Bleep | a result lands |
| `impact` | Impact, Bass Drop | a big reveal, the logo |

Vector Motion Sound (UI sounds) is preferred when it is installed; the Motion Design Pack alone covers every role.

## The mix and the outputs

- **Render** (`render.mjs`, and the board render): the voice-over and the effects are mixed into one
  track: the effects ducked under the voice (sidechain), the whole normalised in two passes to −16 LUFS,
  −1.5 dBTP.
- **GLEA exports**: the effects go on **Sound effects** audio channels (overlapping sounds on separate
  lanes), each clip at its cue's gain as volume (≤ 100 %). The editor does not duck: the effects play at
  their own levels.
- **After Effects**: the package carries the voice-over and the effects with their start times; the agent
  places them on audio layers in the main comp (the mix and the ducking are the render's).
