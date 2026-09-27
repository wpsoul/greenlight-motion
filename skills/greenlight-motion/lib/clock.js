/* GreenLight Motion — the page clock: every scene page plays on it. Installed before the page's own scripts, it makes
 * time virtual: requestAnimationFrame, timers, Date, performance.now, a seeded Math.random, every CSS / Web Animation,
 * SVG timeline and <video> / <audio> element move only when window.__glHtmlClipSeek(ms) is called. So any HTML, CSS or
 * script animation is frame-exact in the preview, in renders and in the GreenLight Dash Video Editor, which installs
 * this same clock (the guard below) when it bakes an HTML clip.
 */
(() => {
    if (window.__glHtmlClipClockInstalled) return;
    window.__glHtmlClipClockInstalled = true;
    // The HTML card renderer's clock uses the same guard name; one clock per page.
    window.__vibeMotionRenderClockInstalled = true;
    // GreenLight Motion: this is the scene's own clock (not a host's, like the Video Editor's), and the real frame
    // callback, kept for a scene page opened on its own (scene.js plays it in real time then)
    window.__glClockFromScene = true;
    window.__glNativeRaf = window.requestAnimationFrame.bind(window);

    const NativeDate = Date;
    // Real-clock timer, kept before the page's setTimeout becomes virtual: the
    // backstop for a media seek that never reports `seeked`.
    const nativeSetTimeout = window.setTimeout.bind(window);
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

    function normalizeDelay(delay) {
        const value = Number(delay);
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    function runTimer(id) {
        const timer = timers.get(id);
        if (!timer) return;
        if (timer.repeat) timer.time += Math.max(1, timer.delay);
        else timers.delete(id);
        try { timer.callback(...timer.args); } catch (error) { console.error(error); }
    }

    function runDueTimers() {
        let guard = 0;
        while (guard < 5000) {
            let dueId = null;
            let dueTime = Infinity;
            for (const [id, timer] of timers) {
                if (timer.time <= now && timer.time < dueTime) { dueId = id; dueTime = timer.time; }
            }
            if (dueId == null) break;
            guard += 1;
            runTimer(dueId);
        }
    }

    window.requestAnimationFrame = (callback) => { const id = nextId++; rafCallbacks.set(id, callback); return id; };
    window.cancelAnimationFrame = (id) => { rafCallbacks.delete(id); };
    const addTimer = (callback, delay, args, repeat) => {
        const id = nextId++;
        const d = normalizeDelay(delay);
        timers.set(id, {
            callback: typeof callback === 'function' ? callback : () => eval(String(callback)),
            args, delay: d, time: now + d, repeat,
        });
        return id;
    };
    window.setTimeout = (callback, delay = 0, ...args) => addTimer(callback, delay, args, false);
    window.setInterval = (callback, delay = 0, ...args) => addTimer(callback, delay, args, true);
    window.clearTimeout = (id) => { timers.delete(id); };
    window.clearInterval = (id) => { timers.delete(id); };

    function RenderDate(...args) {
        if (!(this instanceof RenderDate)) return new NativeDate(baseEpoch + now).toString();
        return args.length === 0 ? new NativeDate(baseEpoch + now) : new NativeDate(...args);
    }
    RenderDate.now = () => baseEpoch + now;
    RenderDate.parse = NativeDate.parse;
    RenderDate.UTC = NativeDate.UTC;
    RenderDate.prototype = NativeDate.prototype;
    window.Date = RenderDate;
    try { Object.defineProperty(performance, 'now', { configurable: true, value: () => now }); } catch (_) {}

    // Each animation / media element runs from the virtual time it first appeared:
    // one a script starts at 2 s is at 0 there, not 2 s in.
    const starts = new WeakMap();
    const startOf = (obj) => {
        let s = starts.get(obj);
        if (s === undefined) { s = now; starts.set(obj, s); }
        return s;
    };

    function seekMedia(el, localMs) {
        try { if (!el.paused) el.pause(); } catch (_) {}
        try { el.muted = true; } catch (_) {}
        let t = Math.max(0, localMs / 1000);
        const d = el.duration;
        if (Number.isFinite(d) && d > 0) t = el.loop ? (t % d) : Math.min(t, Math.max(0, d - 0.001));
        if (Math.abs((el.currentTime || 0) - t) < 0.0005) return null;
        // Nothing loaded and nothing loading (preload="none", a failed file): there is
        // no frame to show, and setting its time never fires `seeked` — waiting for it
        // cost the 1.5 s backstop on EVERY step, so a render starting 15 s into such a
        // page spent ~20 minutes stepping to its first frame. networkState 2 = loading.
        if (el.error || (el.readyState === 0 && el.networkState !== 2)) {
            try { el.currentTime = t; } catch (_) {}
            return null;
        }
        return new Promise((resolve) => {
            let done = false;
            const finish = () => { if (!done) { done = true; resolve(); } };
            el.addEventListener('seeked', finish, { once: true });
            nativeSetTimeout(finish, 1500);
            try { el.currentTime = t; } catch (_) { finish(); }
        });
    }

    // `opts.media === false`: a catch-up step on the way to a later frame — timers,
    // rAF and animations advance as usual, media elements are only seeked on the
    // frame that is drawn (the live layer passes this; the bake steps every frame).
    window.__glHtmlClipSeek = async (timeMs, opts) => {
        const seekMediaNow = !(opts && opts.media === false);
        now = Math.max(0, Number(timeMs) || 0);
        runDueTimers();
        const callbacks = Array.from(rafCallbacks.entries());
        rafCallbacks.clear();
        for (const [, callback] of callbacks) {
            try { callback(now); } catch (error) { console.error(error); }
        }
        runDueTimers();
        if (typeof document.getAnimations === 'function') {
            for (const anim of document.getAnimations()) {
                const s = startOf(anim);
                try { anim.pause(); } catch (_) {}
                try { anim.currentTime = now - s; } catch (_) {}
            }
        }
        for (const svg of document.querySelectorAll('svg')) {
            if (svg.ownerSVGElement) continue;  // SMIL time lives on the outermost <svg>
            try { svg.pauseAnimations(); svg.setCurrentTime((now - startOf(svg)) / 1000); } catch (_) {}
        }
        const pending = [];
        for (const el of document.querySelectorAll('video, audio')) {
            const local = now - startOf(el);  // noted every step: where the element began
            if (!seekMediaNow) continue;
            const p = seekMedia(el, local);
            if (p) pending.push(p);
        }
        if (pending.length) await Promise.all(pending);
        document.body?.getBoundingClientRect();
        await Promise.resolve();
        await Promise.resolve();
    };
})();
