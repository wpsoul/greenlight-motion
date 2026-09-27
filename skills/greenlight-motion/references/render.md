# The render engine

`SKILL/render/render.py` is GreenLight Dash's own HTML → video engine (the one behind the app's HTML
card renders), as one standalone script:

- a **virtual clock** injected before the page loads: `requestAnimationFrame`, timers, `Date`,
  `performance.now()` and CSS / Web animations all follow the frame being recorded, never the wall
  clock; `Math.random` is seeded — every render of a page is identical;
- pages that draw any moment directly (`window.__glSeek(seconds)` — every GL Motion page does) are
  recorded **in parallel** across up to three browsers; other pages are stepped frame by frame;
- **motion blur**: n moments per frame spread over the shutter (0.5 = 180°), averaged
  (premultiplied alpha for the transparent formats);
- **ffmpeg** encode tagged BT.709: MP4 (H.264, crf 18), WebM with alpha (VP9 `yuva420p`), MOV
  ProRes 4444 with alpha.

## Via the tools

```
node SKILL/tools/render.mjs <project> [--format mp4|webm-alpha|mov] [--motion-blur 4] [--out file] [--python path]
```

writes `film.html` (the film as one page) and records it — `renders/<id>-<format>.<ext>` — then mixes its
soundtrack: the voice-over and the sound effects ([sound.md](sound.md)), the effects ducked under the voice,
loudness-normalised to −16 LUFS / −1.5 dBTP, muxed onto the picture. After a voice-over or sound-effect change,
`render.mjs <project> --remix` mixes the soundtrack again onto the existing render without recording the picture. Transparent formats leave the background out. Under a board the app renders instead
([board-mode.md](board-mode.md)).

## Directly

```
python3 SKILL/render/render.py page.html --out film.mp4 [--width 1920 --height 1080 --fps 30]
        [--duration 6] [--format mp4|webm|webm-alpha|mov] [--start 0] [--motion-blur 4] [--shutter 0.5]
        [--audio vo-1.m4a@0.25 --audio vo-2.m4a@4.55] [--ffmpeg /path/to/ffmpeg] [--keep-frames]
```

Any HTML page works — a GL Motion page reports its own length (`__uikDuration`), others need
`--duration`. Relative assets resolve next to the page.

## Setup

Under a GreenLight Dash board there is none: the app renders. Standalone, check first:

```
node SKILL/tools/doctor.mjs
```

It lists what works and prints the install commands for what's missing, for this system and with this
install's paths. Show them to the user; never install anything yourself. The usual setup gives the render
engine its own Python with Playwright:

```
python3 -m venv ~/.greenlight-motion/venv
~/.greenlight-motion/venv/bin/pip install -r SKILL/render/requirements.txt
~/.greenlight-motion/venv/bin/python -m playwright install chromium    # or have Chrome / Edge installed
```

plus ffmpeg on PATH (`brew install ffmpeg`, `sudo apt install ffmpeg`, `winget install Gyan.FFmpeg`;
downloads: https://ffmpeg.org/download.html). Python itself: https://www.python.org/downloads/ ; Playwright:
https://playwright.dev/python/docs/intro. The plugin's README has the steps for macOS, Windows and Linux.
The tools look for a Python that can import playwright: `--python`, then `$GL_MOTION_PYTHON`, then
`~/.greenlight-motion/venv`, then `python3` / `python`.

## Troubleshooting

- *no usable Chromium/Chrome/Edge* — run the `playwright install chromium` line.
- A black or empty video with `webm-alpha` in a player that ignores alpha is expected: the frame is
  transparent. Check it over a background in an editor.
- Slow: motion blur multiplies the frames recorded (×4, ×8). Render without it while iterating.
