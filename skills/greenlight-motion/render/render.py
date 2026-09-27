#!/usr/bin/env python3
"""GreenLight Motion render engine — HTML page → video, frame-exact.

This is GreenLight Dash's own HTML-card render engine (backend `/api/html/render`), extracted into one
standalone script: the same deterministic page clock, the same capture loop (a direct parallel path for
pages that define `window.__glSeek(seconds)`, frame stepping for everything else), the same motion-blur
sampling and the same ffmpeg encode (BT.709-tagged H.264 / VP9 with alpha / ProRes 4444).

    python3 render.py film.html --out film.mp4 [--width 1920 --height 1080 --fps 30 --duration 6]
                     [--format mp4|webm|webm-alpha|mov] [--start 0] [--motion-blur 1] [--shutter 0.5]
                     [--audio vo-1.mp3@0 --audio vo-2.mp3@3.2]   (voice-over, placed at its second)
    python3 render.py page.html --stills 0.5,1.2,2 --out frames/        (PNG stills for review)

Needs: Python 3.9+, `pip install playwright` + `python -m playwright install chromium` (or a Chrome /
Edge installed — it is found on its own), and ffmpeg on PATH (or --ffmpeg /path/to/ffmpeg).
A GreenLight Motion page (a film page, a scene page) defines `__glSeek` and reports its own duration
(`__glDuration`), so --duration can be left out for those.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# ─── the page clock (identical to the app's VIBE_MOTION_RENDER_CLOCK_SCRIPT) ───
CLOCK_SCRIPT = r"""
(() => {
    if (window.__vibeMotionRenderClockInstalled) return;
    window.__vibeMotionRenderClockInstalled = true;
    const NativeDate = Date;
    const baseEpoch = 1700000000000;
    let now = 0;
    let nextId = 1;
    const rafCallbacks = new Map();
    const timers = new Map();
    let seed = 0x2f6b1d3a;
    Math.random = () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    function normalizeDelay(delay) { const value = Number(delay); return Number.isFinite(value) && value > 0 ? value : 0; }
    function runTimer(id) {
        const timer = timers.get(id);
        if (!timer) return;
        if (timer.repeat) timer.time += Math.max(1, timer.delay); else timers.delete(id);
        try { timer.callback(...timer.args); } catch (error) { setTimeout(() => { throw error; }, 0); }
    }
    function runDueTimers() {
        let guard = 0;
        while (guard < 5000) {
            let dueId = null, dueTime = Infinity;
            for (const [id, timer] of timers) if (timer.time <= now && timer.time < dueTime) { dueId = id; dueTime = timer.time; }
            if (dueId == null) break;
            guard += 1; runTimer(dueId);
        }
    }
    window.requestAnimationFrame = (callback) => { const id = nextId++; rafCallbacks.set(id, callback); return id; };
    window.cancelAnimationFrame = (id) => { rafCallbacks.delete(id); };
    window.setTimeout = (callback, delay = 0, ...args) => {
        const d = normalizeDelay(delay); const id = nextId++;
        timers.set(id, { callback: typeof callback === 'function' ? callback : () => eval(String(callback)), args, delay: d, time: now + d, repeat: false });
        return id;
    };
    window.clearTimeout = (id) => { timers.delete(id); };
    window.setInterval = (callback, delay = 0, ...args) => {
        const d = normalizeDelay(delay); const id = nextId++;
        timers.set(id, { callback: typeof callback === 'function' ? callback : () => eval(String(callback)), args, delay: d, time: now + d, repeat: true });
        return id;
    };
    window.clearInterval = (id) => { timers.delete(id); };
    function RenderDate(...args) {
        if (!(this instanceof RenderDate)) return new NativeDate(baseEpoch + now).toString();
        return args.length === 0 ? new NativeDate(baseEpoch + now) : new NativeDate(...args);
    }
    RenderDate.now = () => baseEpoch + now; RenderDate.parse = NativeDate.parse; RenderDate.UTC = NativeDate.UTC;
    RenderDate.prototype = NativeDate.prototype;
    window.Date = RenderDate;
    try { Object.defineProperty(performance, 'now', { configurable: true, value: () => now }); } catch (_) {}
    window.__vibeMotionRenderSeek = (timeMs) => {
        now = Math.max(0, Number(timeMs) || 0);
        runDueTimers();
        const callbacks = Array.from(rafCallbacks.entries());
        rafCallbacks.clear();
        for (const [, callback] of callbacks) { try { callback(now); } catch (error) { setTimeout(() => { throw error; }, 0); } }
        runDueTimers();
    };
})();
"""

STEP_JS = """async (timeMs) => {
    if (typeof window.__vibeMotionRenderSeek === 'function') window.__vibeMotionRenderSeek(timeMs);
    if (typeof document.getAnimations === 'function') {
        const starts = window.__vibeMotionAnimStarts || (window.__vibeMotionAnimStarts = new WeakMap());
        for (const anim of document.getAnimations()) {
            let start = starts.get(anim);
            if (start === undefined) { start = timeMs; starts.set(anim, start); }
            try { anim.pause(); } catch (_) {}
            try { anim.currentTime = timeMs - start; } catch (_) {}
        }
    }
    document.body?.getBoundingClientRect();
    await Promise.resolve();
    await Promise.resolve();
}"""

GL_SEEK_JS = """async (seconds) => {
    await window.__glSeek(seconds);
    document.body?.getBoundingClientRect();
    await Promise.resolve();
    await Promise.resolve();
}"""

PAUSE_CSS = """
*, *::before, *::after {
  animation-play-state: paused !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
"""

# separate browsers (not tabs — they share one GPU process) for long __glSeek renders
SEEK_WORKERS = 3
SEEK_MIN_PER_WORKER = 45


def angle_backend() -> str:
    if sys.platform == "darwin":
        return "metal"
    if os.name == "nt":
        return "d3d11"
    return "gl"


GPU_ARGS = [
    "--headless=new", "--use-gl=angle", f"--use-angle={angle_backend()}", "--enable-gpu",
    "--ignore-gpu-blocklist", "--enable-webgl", "--enable-unsafe-webgpu", "--disable-dev-shm-usage",
]


def log(*parts):
    print("[render]", *parts, file=sys.stderr, flush=True)


async def launch(playwright):
    """Playwright's Chromium, else an installed Chrome / Edge (headless, GPU on)."""
    tries = []
    exe = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH")
    if exe:
        tries.append(dict(executable_path=exe))
    tries += [dict(), dict(channel="chrome"), dict(channel="msedge")]
    last = None
    for opts in tries:
        try:
            return await playwright.chromium.launch(headless=True, args=GPU_ARGS, **opts)
        except Exception as exc:  # noqa: BLE001 — try the next browser
            last = exc
    raise RuntimeError(f"no usable Chromium/Chrome/Edge: {last}")


async def capture(html_path: Path, width: int, height: int, fps: int, frame_count: int, *, start_frame=0,
                  samples=1, shutter=0.5, transparent=False, frames_dir: Path) -> None:
    from playwright.async_api import async_playwright

    frame_ms = max(1.0, 1000.0 / max(1, fps))
    samples = max(1, min(16, int(samples or 1)))
    shutter = max(0.05, min(1.0, float(shutter or 0.5)))

    def moments(k: int):
        if samples == 1:
            return [((start_frame + k) * frame_ms, k)]
        return [((start_frame + k + shutter * (j + 0.5) / samples) * frame_ms, k * samples + j) for j in range(samples)]

    viewport = {"width": max(16, int(width)), "height": max(16, int(height))}
    uri = html_path.resolve().as_uri()

    async def open_page(browser):
        page = await browser.new_page(viewport=viewport, device_scale_factor=1)
        page.on("pageerror", lambda exc: log("pageerror:", exc))
        await page.add_init_script(CLOCK_SCRIPT)
        await page.goto(uri, wait_until="domcontentloaded", timeout=30000)
        pause = await page.add_style_tag(content=PAUSE_CSS)
        try:
            await page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:  # noqa: BLE001
            pass
        try:
            await asyncio.wait_for(page.evaluate("() => (document.fonts && document.fonts.ready) ? document.fonts.ready.then(() => true) : true"), timeout=5.0)
        except Exception:  # noqa: BLE001
            pass
        try:
            await pause.evaluate("node => node.remove()")
        except Exception:  # noqa: BLE001
            pass
        return page

    async def shoot(page, index: int):
        await page.screenshot(path=str(frames_dir / f"frame_{index:06d}.png"), type="png", full_page=False, omit_background=transparent)

    async with async_playwright() as pw:
        browser = await launch(pw)
        try:
            page = await open_page(browser)
            if await page.evaluate("typeof window.__glSeek === 'function'"):
                captures = [m for k in range(frame_count) for m in moments(k)]
                workers = max(1, min(SEEK_WORKERS, len(captures) // SEEK_MIN_PER_WORKER))
                size = -(-len(captures) // workers) if captures else 0
                log(f"direct seek, {len(captures)} captures, {workers} browser(s)")

                async def seek_and_shoot(tab, chunk):
                    for time_ms, index in chunk:
                        await tab.evaluate(GL_SEEK_JS, time_ms / 1000.0)
                        await shoot(tab, index)

                async def in_own_browser(chunk):
                    extra = await launch(pw)
                    try:
                        await seek_and_shoot(await open_page(extra), chunk)
                    finally:
                        await extra.close()

                await asyncio.gather(seek_and_shoot(page, captures[:size]),
                                     *[in_own_browser(captures[w * size:(w + 1) * size]) for w in range(1, workers)])
            else:
                log(f"stepping {start_frame + frame_count} frames from 0")
                steps = [(f * frame_ms, None) for f in range(start_frame)]
                for k in range(frame_count):
                    steps.extend(moments(k))
                for time_ms, index in steps:
                    await page.evaluate(STEP_JS, time_ms)
                    if index is not None:
                        await shoot(page, index)
        finally:
            await browser.close()


def encode(ffmpeg: str, frames_dir: Path, out: Path, fps: int, fmt: str, samples: int = 1, audio=None) -> None:
    """The app's encoder: BT.709 matrix + tags, premultiplied motion-blur average, per-format codecs."""
    samples = max(1, int(samples or 1))
    cmd = [ffmpeg, "-y", "-framerate", str(fps * samples), "-i", str(frames_dir / "frame_%06d.png")]
    audio = audio or []
    for path, _ in audio:
        cmd += ["-i", str(path)]
    filters = []
    if samples > 1:
        weights = " ".join(["1"] * samples)
        blend = f"tmix=frames={samples}:weights='{weights}',select='eq(mod(n\\,{samples})\\,{samples - 1})',setpts=N/({fps}*TB)"
        if fmt in {"webm-alpha", "mov"}:
            blend = f"format=rgba,premultiply=inplace=1,{blend},unpremultiply=inplace=1"
        filters.append(blend)

    def to_yuv(pix):
        return f"scale=out_color_matrix=bt709:out_range=tv,format={pix},setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv"

    tags = ["-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709"]
    rate = ["-r", str(fps)] if samples > 1 else []
    if fmt == "mov":
        video = ["-vf", ",".join(filters + [to_yuv("yuva444p10le")]), "-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le"]
        acodec = ["-c:a", "pcm_s16le"]
    elif fmt in {"webm", "webm-alpha"}:
        video = ["-vf", ",".join(filters + [to_yuv("yuva420p")]), "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-row-mt", "1", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "15"]
        acodec = ["-c:a", "libopus", "-b:a", "160k"]
    else:
        video = ["-vf", ",".join(filters + ["pad=ceil(iw/2)*2:ceil(ih/2)*2:color=black", to_yuv("yuv420p")]), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
        acodec = ["-c:a", "aac", "-b:a", "192k"]
    cmd += video + tags + rate
    if audio:
        # each voice-over clip starts at its own second; mixed without level loss, padded with silence
        # to the end of the video (apad) and cut there (-shortest)
        parts = [f"[{i + 1}:a]adelay={int(off * 1000)}|{int(off * 1000)}[a{i}]" for i, (_, off) in enumerate(audio)]
        mix = "".join(f"[a{i}]" for i in range(len(audio)))
        cmd += ["-filter_complex", ";".join(parts) + f";{mix}amix=inputs={len(audio)}:normalize=0,apad[aout]", "-map", "0:v", "-map", "[aout]", *acodec, "-shortest"]
    cmd.append(str(out))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not out.is_file():
        raise RuntimeError("ffmpeg failed:\n" + (proc.stderr or "")[-2500:])


async def stills(html_path: Path, width: int, height: int, times, out_dir: Path, transparent=False):
    """PNG frames at chosen seconds (review sheets): still-<t>.png in out_dir."""
    from playwright.async_api import async_playwright
    out_dir.mkdir(parents=True, exist_ok=True)
    files = []
    async with async_playwright() as pw:
        browser = await launch(pw)
        try:
            page = await browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            page.on("pageerror", lambda exc: log("pageerror:", exc))
            await page.add_init_script(CLOCK_SCRIPT)
            await page.goto(html_path.resolve().as_uri(), wait_until="domcontentloaded", timeout=30000)
            try:
                await asyncio.wait_for(page.evaluate("() => document.fonts ? document.fonts.ready.then(() => true) : true"), timeout=5.0)
            except Exception:  # noqa: BLE001
                pass
            direct = await page.evaluate("typeof window.__glSeek === 'function'")
            stepped = 0.0
            for t in sorted(times):
                if direct:
                    await page.evaluate(GL_SEEK_JS, t)
                else:
                    while stepped <= t * 1000:
                        await page.evaluate(STEP_JS, stepped)
                        stepped += 1000 / 60
                f = out_dir / f"still-{t:07.3f}.png"
                await page.screenshot(path=str(f), omit_background=transparent)
                files.append(str(f))
        finally:
            await browser.close()
    return files


async def page_duration(html_path: Path, width: int, height: int):
    """A GreenLight Motion page reports its own length (window.__glDuration)."""
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await launch(pw)
        try:
            page = await browser.new_page(viewport={"width": width, "height": height})
            await page.goto(html_path.resolve().as_uri(), wait_until="domcontentloaded", timeout=30000)
            return await page.evaluate("window.__glDuration || null")
        finally:
            await browser.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="Render an HTML page to video (GreenLight Dash's HTML render engine).")
    ap.add_argument("html", help="the page (a file; relative assets resolve next to it)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--duration", type=float, default=None, help="seconds (default: the page's __glDuration, else 5)")
    ap.add_argument("--format", default=None, choices=["mp4", "webm", "webm-alpha", "mov"], help="default: from the --out extension")
    ap.add_argument("--start", type=float, default=0.0)
    ap.add_argument("--motion-blur", type=int, default=1, help="samples per frame, 1–16 (4 = on, 8 = high)")
    ap.add_argument("--shutter", type=float, default=0.5)
    ap.add_argument("--audio", action="append", default=[], help="file@seconds — a voice-over clip and where it starts")
    ap.add_argument("--ffmpeg", default=None)
    ap.add_argument("--keep-frames", action="store_true")
    ap.add_argument("--stills", default=None, help="t1,t2,… — PNG frames at these seconds into the --out directory")
    a = ap.parse_args()

    html = Path(a.html)
    if not html.is_file():
        log("no such page:", html)
        return 2
    out = Path(a.out)
    if a.stills:
        times = [float(x) for x in a.stills.split(",") if x.strip()]
        files = asyncio.run(stills(html, a.width, a.height, times, out, transparent=a.format in {"webm-alpha", "mov"}))
        print(json.dumps({"ok": True, "stills": files}))
        return 0
    fmt = a.format or {".webm": "webm-alpha", ".mov": "mov"}.get(out.suffix.lower(), "mp4")
    ffmpeg = a.ffmpeg or shutil.which("ffmpeg")
    if not ffmpeg:
        log("ffmpeg not found — install it or pass --ffmpeg")
        return 3
    fps = max(1, min(120, a.fps))
    duration = a.duration
    if duration is None:
        duration = asyncio.run(page_duration(html, a.width, a.height)) or 5.0
    frame_count = max(1, round(duration * fps))
    audio = []
    for spec in a.audio:
        path, _, off = spec.rpartition("@") if "@" in spec else (spec, "", "0")
        audio.append((Path(path), float(off or 0)))
    tmp = Path(tempfile.mkdtemp(prefix="greenlight-motion-render-"))
    frames = tmp / "frames"
    frames.mkdir()
    try:
        log(f"{html.name} → {out.name}: {a.width}×{a.height} {fps} fps, {duration:.2f} s, {fmt}"
            + (f", motion blur ×{a.motion_blur}" if a.motion_blur > 1 else ""))
        asyncio.run(capture(html, a.width, a.height, fps, frame_count, start_frame=round(a.start * fps),
                            samples=a.motion_blur, shutter=a.shutter, transparent=fmt in {"webm-alpha", "mov"}, frames_dir=frames))
        out.parent.mkdir(parents=True, exist_ok=True)
        encode(ffmpeg, frames, out, fps, fmt, a.motion_blur, audio)
        print(json.dumps({"ok": True, "out": str(out.resolve()), "frames": frame_count, "format": fmt, "duration": duration}))
        return 0
    finally:
        if a.keep_frames:
            log("frames kept in", frames)
        else:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
