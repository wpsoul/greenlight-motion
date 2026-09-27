// The GreenLight Motion library's registry: one JSON with every ready-made scene — what it is, how long it runs, the
// texts a scenario can re-word, the photo slots it can fill and its parameters — so an agent can search the library
// without loading any JS.
//   node tools/registry.mjs                 → rewrites registry.json
//   node tools/registry.mjs --search "coupon countdown" [--cat promo] [--limit 20]   (prints matches)
import fs from 'node:fs';
import path from 'node:path';
import { loadKit, SKILL_DIR, arg } from './kit.mjs';

const argv = process.argv.slice(2);
const K = loadKit();

function build() {
  const order = Object.keys(K.CATS);
  const items = K.elements.slice()
    .sort((a, b) => (order.indexOf(a.cat) - order.indexOf(b.cat)) || (K.elements.indexOf(a) - K.elements.indexOf(b)))
    .map((e) => {
      const texts = []; const numbers = []; const images = []; let photos = 0, imageList = false;
      const walk = (L) => {
        // pictures in the order film.js numbers photo slots ('#1', '#2' …), with the box size to fill.
        // Layers showing ONE picture (a shared `src`, or copies with one id — a thumbnail and its big
        // screen, a marquee's loop twin) are one entry: `key` fills them all, `copies` counts them
        if (L.media != null) {
          const slot = '#' + (++photos);
          const key = L.src || L.id || slot;
          const had = images.find((im) => im.key === key);
          if (had) had.copies += 1;
          else images.push({ key, slot, ...(L.id ? { id: L.id } : {}), ...(L.src ? { src: L.src } : {}), w: L.w, h: L.h, copies: 1 });
        }
        if (L.type === 'canvas') imageList = true;   // drawn in code: takes the scene's pictures as a list
        if (L.type === 'text') {
          const t = String(L.text ?? '');
          if (/\{\{\{\s*(COUNTER|TIMER)/i.test(t) || L.num) numbers.push({ id: L.id || null, text: L.num ? `num(${JSON.stringify(L.num)})` : t });
          else if (L.id && t.trim()) texts.push({ id: L.id, text: t });
        }
        (L.ch || []).forEach(walk);
      };
      let layers = [];
      try { layers = K.build(e); } catch { /* reported by the lab */ }
      layers.forEach(walk);
      return {
        id: e.id, name: e.name, category: e.cat, categoryLabel: K.CATS[e.cat] || e.cat,
        duration: e.T, description: e.desc || '', file: e.file,
        texts, numbers, images, ...(imageList ? { imageList: true } : {}),
        ...(e.params && Object.keys(e.params).length ? { params: e.params } : {}),
      };
    });
  return { name: 'GreenLight Motion library', version: 1, count: items.length, categories: K.CATS, items };
}

const reg = build();
const q = arg(argv, 'search');
if (q != null) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  const cat = arg(argv, 'cat');
  const hits = reg.items
    .filter((it) => !cat || it.category === cat)
    .map((it) => {
      const hay = `${it.id} ${it.name} ${it.categoryLabel} ${it.description} ${it.texts.map((t) => t.text).join(' ')}`.toLowerCase();
      const score = terms.reduce((a, t) => a + (hay.includes(t) ? (it.name.toLowerCase().includes(t) ? 3 : 1) : 0), 0);
      return { it, score };
    })
    .filter((h) => h.score > 0 || !terms.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, Number(arg(argv, 'limit', 25)));
  for (const { it } of hits) console.log(`${it.id.padEnd(26)} ${String(it.duration).padStart(4)}s  ${it.categoryLabel.padEnd(20)} ${it.description.slice(0, 108)}`);
  console.log(`\n${hits.length} of ${reg.count}`);
} else {
  fs.writeFileSync(path.join(SKILL_DIR, 'registry.json'), JSON.stringify(reg, null, 1));
  console.log(`registry.json: ${reg.count} items in ${Object.keys(reg.categories).length} categories`);
}
