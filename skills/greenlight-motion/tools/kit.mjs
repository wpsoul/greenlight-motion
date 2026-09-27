// Loads the GreenLight Motion library (lib/) and the film runtime into node: the same plain scripts the browser pages
// use, evaluated against a `window` stub.
//   import { loadKit, libSource, SKILL_DIR } from './kit.mjs';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LIB_DIR = path.join(SKILL_DIR, 'lib');
export const RUNTIME = path.join(SKILL_DIR, 'runtime/motion.js');
export const CORE = ['easings.js', 'engine.js', 'catalog.js'];
export const TAIL = ['html-export.js', 'film.js', 'player.js'];

export const libSource = (name) => fs.readFileSync(path.join(LIB_DIR, name), 'utf8');

let loaded = null;
/** Load the library once. Returns window.UIK (window.MU, the runtime, and window.GLPlayer come with it). */
export function loadKit() {
  if (loaded) return loaded;
  globalThis.window = globalThis.window || globalThis;
  if (typeof globalThis.btoa !== 'function') globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
  const run = (file, name) => {
    if (globalThis.window.UIK) globalThis.window.UIK.__loadingFile = name;
    vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  };
  for (const f of CORE) run(path.join(LIB_DIR, f), f);
  globalThis.UIK = globalThis.window.UIK;
  for (const f of globalThis.UIK.FILES) run(path.join(LIB_DIR, f), f);
  for (const f of TAIL) run(path.join(LIB_DIR, f), f);
  delete globalThis.UIK.__loadingFile;
  run(RUNTIME, 'motion.js');
  loaded = globalThis.UIK;
  return loaded;
}

/** CLI helpers */
export const arg = (argv, name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
export const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
