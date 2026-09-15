#!/usr/bin/env node
/* ============================================================================
   text-audit.mjs — enforce the "tag every text element" rule.

   WHY
   Edit-mode can only select a node that carries its OWN data-viz-id. An untagged
   heading or paragraph isn't pointable — hovering it just grabs the nearest
   tagged ancestor (the whole card/section). So every meaningful text element must
   have its own dotted id (`card.audit.title`, `footer.text`). This flags any
   text-bearing leaf that's missing one, so you catch omissions before the user
   hits "I can't select that text".

   USAGE
     node text-audit.mjs <url>            (default http://localhost:8800/)
   Exits non-zero if any untagged text leaf is found.

   Requires Playwright (npm i -D @playwright/test && npx playwright install chromium).
   ============================================================================ */

import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://localhost:8800/';

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => page.goto(url));
await page.waitForTimeout(500);

const untagged = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('.em-root')) return;                       // skip edit-mode's own UI
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'svg', 'canvas', 'path', 'use', 'g', 'br'].includes(tag)) return;
    // direct text (not inherited from element children)
    const direct = Array.from(el.childNodes).filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim()).join('');
    if (!direct) return;
    if (!el.hasAttribute('data-viz-id')) {
      const coveredBy = el.closest('[data-viz-id]')?.getAttribute('data-viz-id') || null;
      out.push({ tag, text: direct.slice(0, 50), coveredBy });
    }
  });
  return out;
});

if (!untagged.length) {
  console.log('✓ text-audit: every text-bearing element has its own data-viz-id');
} else {
  console.log(`✗ text-audit: ${untagged.length} text element(s) WITHOUT their own data-viz-id:`);
  untagged.forEach((u) => console.log(`   <${u.tag}> ${JSON.stringify(u.text)} — only covered by: ${u.coveredBy || '(nothing)'}`));
  console.log('\n   Give each its own dotted id (e.g. card.audit.title) so it is individually selectable.');
}
await browser.close();
process.exit(untagged.length ? 1 : 0);
