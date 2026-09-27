# GL Motion render engine

`render.py` records any HTML page to video, frame-exact: a virtual clock drives the page (animation
frames, timers, dates, CSS animations), pages exposing `window.__glSeek(seconds)` are recorded in
parallel, motion blur averages several moments per frame, and ffmpeg encodes BT.709 MP4, WebM with
alpha or ProRes 4444.

```
python3 -m venv ~/.greenlight-motion/venv
~/.greenlight-motion/venv/bin/pip install -r requirements.txt
~/.greenlight-motion/venv/bin/python -m playwright install chromium
~/.greenlight-motion/venv/bin/python render.py page.html --out film.mp4 --duration 6
```

It needs Python 3.9+ ([python.org](https://www.python.org/downloads/)), Playwright
([playwright.dev](https://playwright.dev/python/docs/intro)) and ffmpeg ([ffmpeg.org](https://ffmpeg.org/download.html)).
`node ../tools/doctor.mjs` checks all three and prints the install commands for this system.

Full options and troubleshooting: `../references/render.md`.
