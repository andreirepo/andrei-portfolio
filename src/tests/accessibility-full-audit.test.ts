import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { injectAxe } from 'axe-playwright';
import { readdirSync, existsSync } from 'node:fs';

/**
 * Full Accessibility Audit — color contrast at rest.
 *
 * Two things previously made this check meaningless:
 *
 * 1. `body` carries a five-layer gradient. axe cannot sample a gradient
 *    background, so it reported color-contrast as *incomplete* for every
 *    element — "0 violations" meant "not checked", not "passing".
 * 2. `.section-fade-in` and the hero entrance animations drive opacity from
 *    a scroll timeline. Elements below the fold are mid-fade when axe runs,
 *    so it measured a transient colour rather than the real one.
 *
 * Both are presentation. The audit neutralises them and measures the resting
 * state against the solid `--background` token, which is what a reader
 * actually sees once the page has settled.
 */

const BASE_URL = 'http://localhost:4321';

const NEUTRALISE = `
  body { background-image: none !important; }
  .section-fade-in { animation: none !important; opacity: 1 !important; transform: none !important; }
  [class*="hero-animate"] { animation: none !important; opacity: 1 !important; transform: none !important; }
  .animate-ping { animation: none !important; }
  /* the ping ring overlays the badge text, which makes axe bail on geometry */
  .ci-status-ping { display: none !important; }
  #scroll-top { display: none !important; }
`;

/** Blog post routes, discovered from the build output the CI downloads. */
function postRoutes(): string[] {
  const dir = 'dist/en/blog';
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'tag')
    .map((d) => `/en/blog/${d.name}/`);
}

describe('Color contrast at rest, across routes and themes', () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  async function audit(url: string, theme: 'light' | 'dark', viewport = { width: 1440, height: 900 }) {
    const context = await browser.newContext({ viewport });
    const page: Page = await context.newPage();
    await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
    await page.goto(`${BASE_URL}${url}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: NEUTRALISE });
    await page.waitForTimeout(250);

    await injectAxe(page);
    const results = await page.evaluate(() =>
      (window as any).axe.run(document, { runOnly: ['color-contrast'] })
    );

    const nodes = results.violations.flatMap((v: any) =>
      v.nodes.map((n: any) => ({
        target: n.target.join(' '),
        html: String(n.html).slice(0, 100),
        reason: String(n.any?.[0]?.message ?? '').replace('Element has insufficient color contrast of ', ''),
      }))
    );
    const incomplete = results.incomplete.length;

    await context.close();
    return { nodes, incomplete };
  }

  const routes = ['/en', '/es', '/en/blog', '/es/blog', '/404.html', '/en/blog/tag/testing/'];

  for (const route of routes) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${route} (${theme}) has no contrast violations`, async () => {
        const { nodes } = await audit(route, theme);
        expect(nodes, JSON.stringify(nodes, null, 2)).toHaveLength(0);
      });
    }
  }

  for (const route of postRoutes()) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${route} (${theme}) has no contrast violations`, async () => {
        const { nodes } = await audit(route, theme);
        expect(nodes, JSON.stringify(nodes, null, 2)).toHaveLength(0);
      });
    }
  }

  // Narrow viewports change type sizes, which can change what counts as large text
  for (const theme of ['light', 'dark'] as const) {
    it(`/en at 390px (${theme}) has no contrast violations`, async () => {
      const { nodes } = await audit('/en', theme, { width: 390, height: 844 });
      expect(nodes, JSON.stringify(nodes, null, 2)).toHaveLength(0);
    });
  }

  it('axe can actually measure contrast once the gradient is neutralised', async () => {
    // Guards against the check silently degrading back to all-incomplete.
    const { incomplete } = await audit('/en', 'light');
    expect(incomplete).toBe(0);
  });
});
