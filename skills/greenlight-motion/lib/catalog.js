/* GL Motion — the catalogue: gallery categories (in display order) and the element files, in load
 * order. Everything that loads the library reads it: the skill's tools (tools/kit.mjs), the gallery
 * and preview pages, and — inside GreenLight Dash — the Video Editor's Presets panel and the lab page.
 * A new element file goes here (in GreenLight Dash's repo also in html/ui-motion-kit-lab.html's
 * script tags); a new category gets its label here. See CONTRIBUTING.md. */
(function () {
'use strict';
const K = window.UIK = window.UIK || {};
K.CATS = {
  controls: 'Controls', feedback: 'Feedback', data: 'Data', content: 'Content', morph: 'Morphs', ai: 'AI',
  commerce: 'Commerce', promo: 'Promos & countdowns', social: 'Social', system: 'System & dev', mobile: 'Mobile & nav',
  text: 'Text & titles', everyday: 'Everyday', work: 'Work & money', play: 'Learn, play & travel',
  carousel: 'Carousels & sliders', gallery: 'Galleries & stacks', showcase: 'Product showcase',
};
K.FILES = [
  'elements-core.js', 'elements-controls.js', 'elements-feedback.js', 'elements-data.js', 'elements-content.js',
  'elements-ai.js', 'elements-commerce.js', 'elements-social.js', 'elements-system.js', 'elements-mobile.js',
  'elements-text.js', 'elements-everyday.js', 'elements-work.js', 'elements-play.js', 'elements-carousel.js',
  'elements-slides.js', 'elements-stacks.js', 'elements-grids.js',
  'elements-promo-countdowns.js', 'elements-promo-coupons.js', 'elements-promo-codes.js',
  'elements-showcase.js',
];
})();
