#!/usr/bin/env python3
"""GL Motion — capture a product website for a film (screenshots + what the page says about itself).

    python3 capture.py --url https://acme.example --out <project> [--timeout 30]

Writes into <project>:
  assets/site-desktop-1.png   1440×900, the top of the page
  assets/site-desktop-2.png   scrolled one viewport height (only when the page is that tall)
  assets/site-desktop-3.png   scrolled two viewport heights (only when the page is that tall)
  assets/site-phone-1.png     390×844 at 2× (780×1688), the top of the page, as a phone sees it
  site.json                   url, finalUrl, title, description, ogImage, themeColor, headings, links,
                              colors (most used non-grey colours), background, logo, icon, screenshots, via
The page-side code is capture-ready.js + capture-extract.js beside this file (tools/capture.mjs sends the
same code to the app's /api/site-capture under a board, and reads the HTML alone when there is no browser).
Re-running overwrites them (and removes a -2 / -3 the page is no longer tall enough for).
Prints one JSON line: { ok, site, screenshots, title, warnings } or { ok: false, error }.

Uses the render engine's browser discovery (render.py: Playwright's Chromium, else Chrome / Edge).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

sys.dont_write_bytecode = True   # no __pycache__ inside the skill folder
sys.path.insert(0, str(Path(__file__).resolve().parent))
from render import launch  # noqa: E402 — the same browser discovery as the render engine

DESKTOP = {"width": 1440, "height": 900}
PHONE = {"width": 390, "height": 844}
PHONE_UA = ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 "
            "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")
DESKTOP_SHOTS = 3

# the page-side code lives beside this file, shared with tools/capture.mjs (which sends it to the app
# under a board): pictures in view finish loading, and everything site.json says about the page
def _js(name: str) -> str:
    """A capture-*.js file without its leading // comment lines: one function expression."""
    lines = (Path(__file__).resolve().parent / name).read_text(encoding="utf-8").splitlines()
    while lines and lines[0].startswith("//"):
        lines.pop(0)
    return "\n".join(lines).strip()


IMAGES_READY_JS = _js("capture-ready.js")

EXTRACT_JS = _js("capture-extract.js")


def log(*parts):
    print("[capture]", *parts, file=sys.stderr, flush=True)


async def settle(page, idle_s: float = 6.0):
    """Let the page load: the load event, a quiet network (never hangs on a busy one), fonts, a beat."""
    for state, t in (("load", 10000), ("networkidle", int(idle_s * 1000))):
        try:
            await page.wait_for_load_state(state, timeout=t)
        except Exception:  # noqa: BLE001 — a busy page still gets captured
            pass
    try:
        await asyncio.wait_for(page.evaluate("() => document.fonts ? document.fonts.ready.then(() => true) : true"), timeout=5.0)
    except Exception:  # noqa: BLE001
        pass
    try:
        await page.evaluate(IMAGES_READY_JS, 3000)
    except Exception:  # noqa: BLE001
        pass
    await page.wait_for_timeout(600)


async def open_url(context, url: str, timeout_s: float):
    page = await context.new_page()
    resp = await page.goto(url, wait_until="domcontentloaded", timeout=int(timeout_s * 1000))
    if resp is not None and resp.status >= 400:
        raise RuntimeError(f"{url} answered HTTP {resp.status}")
    await settle(page)
    return page


async def desktop(browser, url: str, assets: Path, timeout_s: float):
    ctx = await browser.new_context(viewport=DESKTOP, device_scale_factor=1)
    try:
        page = await open_url(ctx, url, timeout_s)
        info = await page.evaluate(EXTRACT_JS)
        info["finalUrl"] = page.url
        shots = []
        f = assets / "site-desktop-1.png"
        await page.screenshot(path=str(f), full_page=False)
        shots.append(f)
        vh = DESKTOP["height"]
        for k in range(1, DESKTOP_SHOTS):
            height = await page.evaluate("() => Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)")
            if height < (k + 1) * vh:
                break
            await page.evaluate("(y) => window.scrollTo(0, y)", k * vh)
            await page.wait_for_timeout(700)   # scroll-triggered reveals and lazy pictures
            try:
                await page.evaluate(IMAGES_READY_JS, 3000)
            except Exception:  # noqa: BLE001
                pass
            f = assets / f"site-desktop-{k + 1}.png"
            await page.screenshot(path=str(f), full_page=False)
            shots.append(f)
        return info, shots
    finally:
        await ctx.close()


async def phone(browser, url: str, assets: Path, timeout_s: float):
    ctx = await browser.new_context(viewport=PHONE, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=PHONE_UA)
    try:
        page = await open_url(ctx, url, timeout_s)
        f = assets / "site-phone-1.png"
        await page.screenshot(path=str(f), full_page=False)
        return f
    finally:
        await ctx.close()


async def capture(url: str, out: Path, timeout_s: float):
    from playwright.async_api import async_playwright

    assets = out / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    warnings = []
    async with async_playwright() as pw:
        browser = await launch(pw)
        try:
            d, p = await asyncio.gather(desktop(browser, url, assets, timeout_s), phone(browser, url, assets, timeout_s), return_exceptions=True)
        finally:
            await browser.close()
    if isinstance(d, BaseException):
        raise d
    info, shots = d
    if isinstance(p, BaseException):
        warnings.append(f"phone screenshot failed: {p}")
    else:
        shots.append(p)
    made = {s.name for s in shots}
    for k in range(2, DESKTOP_SHOTS + 1):   # a page that got shorter leaves no stale screenshot behind
        stale = assets / f"site-desktop-{k}.png"
        if stale.name not in made and stale.exists():
            stale.unlink()
    rel = [f"assets/{s.name}" for s in shots]
    site = {
        "url": url,
        "finalUrl": info.get("finalUrl") or url,
        "title": info.get("title") or "",
        "description": info.get("description") or "",
        "ogImage": info.get("ogImage"),
        "themeColor": info.get("themeColor"),
        "headings": info.get("headings") or [],
        "links": info.get("links") or [],
        "colors": info.get("colors") or [],
        "background": info.get("background"),
        "logo": info.get("logo"),
        "icon": info.get("icon"),
        "screenshots": rel,
        "via": "browser",
        "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (out / "site.json").write_text(json.dumps(site, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return site, warnings


def main() -> int:
    ap = argparse.ArgumentParser(description="Capture a product website for a GL Motion film.")
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", required=True, help="the project folder (assets/ and site.json go there)")
    ap.add_argument("--timeout", type=float, default=30.0, help="seconds to wait for the page to answer (default 30)")
    a = ap.parse_args()
    u = urlparse(a.url)
    if u.scheme not in ("http", "https") or not u.netloc:
        print(json.dumps({"ok": False, "error": f"not a web address: {a.url}"}))
        return 1
    out = Path(a.out)
    try:
        # the whole capture has a hard limit: a page that never settles still ends
        site, warnings = asyncio.run(asyncio.wait_for(capture(a.url, out, a.timeout), timeout=a.timeout * 3 + 30))
    except asyncio.TimeoutError:
        print(json.dumps({"ok": False, "error": f"{a.url} did not finish loading in time"}))
        return 1
    except Exception as exc:  # noqa: BLE001 — one clear line for the agent
        msg = str(exc).strip().splitlines()[0] if str(exc).strip() else exc.__class__.__name__
        print(json.dumps({"ok": False, "error": msg}))
        return 1
    for w in warnings:
        log(w)
    print(json.dumps({"ok": True, "site": "site.json", "screenshots": site["screenshots"], "title": site["title"], "warnings": warnings}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
