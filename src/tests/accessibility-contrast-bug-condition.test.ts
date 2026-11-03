import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import fc from 'fast-check';

/**
 * Regression Guard: WCAG 2 AA Contrast — No Opacity-Dimmed Text Elements
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.6**
 *
 * This test was originally written as a bug condition exploration test to confirm
 * that 40+ elements failed WCAG 2 AA contrast due to opacity-50/opacity-70 classes.
 *
 * The fix replaced all opacity-based dimming with semantic color tokens (text-muted-foreground).
 * This test now acts as a regression guard — it will fail if opacity-dimmed text elements
 * are ever reintroduced, preventing the bug from coming back.
 *
 * **EXPECTED OUTCOME**: All assertions pass — zero contrast violations, zero opacity-dimmed elements.
 */

describe('Regression Guard: No Opacity-Dimmed Text Elements (WCAG 2 AA)', () => {
  let browser: Browser;
  const BASE_URL = 'http://localhost:4321';

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * Contrast itself is audited in accessibility-full-audit.test.ts.
   *
   * The three axe colour-contrast tests that used to live here were removed:
   * they measured nothing. `body` carries a gradient, which makes axe report
   * color-contrast as *incomplete* rather than passing, so the assertions
   * could only ever see an empty list — and whenever the scroll-reveal
   * animation happened to be mid-fade, the same test failed unreliably.
   * The full audit neutralises both and asserts against the resting state.
   */

  /**
   * Test: No opacity-50 text elements remain in the DOM
   */
  it('should have no opacity-50 text elements in the DOM', async () => {
    const page: Page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    const elements = await page.evaluate(() => {
      return document.querySelectorAll('.opacity-50').length;
    });

    console.log(`\n[Programmatic Check] Found ${elements} opacity-50 elements`);
    expect(elements).toBe(0);
    await page.close();
  });

  /**
   * Test: No opacity-70 text elements remain in the DOM
   */
  it('should have no opacity-70 text elements in the DOM', async () => {
    const page: Page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    const elements = await page.evaluate(() => {
      return document.querySelectorAll('.opacity-70').length;
    });

    console.log(`\n[Programmatic Check] Found ${elements} opacity-70 elements`);
    expect(elements).toBe(0);
    await page.close();
  });

  /**
   * Test: No opacity-dimmed nav links, skill descriptions, or footer elements
   */
  it('should have no opacity-dimmed elements in nav, skills, or footer', async () => {
    const page: Page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    const counts = await page.evaluate(() => ({
      navLinksWithOpacity50: document.querySelectorAll('nav a.opacity-50').length,
      elementsWithOpacity50: document.querySelectorAll('[class*="opacity-50"]').length,
      themeToggleWithOpacity70: document.querySelector('button.opacity-70') ? 1 : 0,
      localeLinksWithOpacity70: document.querySelectorAll('a.opacity-70').length,
    }));

    console.log('\n[Regression Check]');
    console.log(`  Nav links with opacity-50: ${counts.navLinksWithOpacity50}`);
    console.log(`  Elements with opacity-50: ${counts.elementsWithOpacity50}`);
    console.log(`  Theme toggle with opacity-70: ${counts.themeToggleWithOpacity70}`);
    console.log(`  Locale links with opacity-70: ${counts.localeLinksWithOpacity70}`);

    expect(counts.navLinksWithOpacity50).toBe(0);
    expect(counts.elementsWithOpacity50).toBe(0);
    expect(counts.themeToggleWithOpacity70).toBe(0);
    expect(counts.localeLinksWithOpacity70).toBe(0);

    await page.close();
  });

  /**
   * Property-based test: No opacity-dimmed elements across all routes and themes
   */
  it('should have no opacity-dimmed elements across all routes and themes (property-based)', async () => {
    const routeArb = fc.constantFrom('/en', '/es');
    const themeArb = fc.constantFrom('light', 'dark');

    await fc.assert(
      fc.asyncProperty(routeArb, themeArb, async (route, theme) => {
        const testPage: Page = await browser.newPage();
        await testPage.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });

        if (theme === 'dark') {
          await testPage.evaluate(() => {
            localStorage.setItem('theme', 'dark');
            document.documentElement.classList.add('dark');
          });
          await testPage.waitForTimeout(300);
        }

        const counts = await testPage.evaluate(() => ({
          opacity50: document.querySelectorAll('.opacity-50').length,
          opacity70: document.querySelectorAll('.opacity-70').length,
        }));

        console.log(`  Route: ${route}, Theme: ${theme} → opacity-50: ${counts.opacity50}, opacity-70: ${counts.opacity70}`);

        expect(counts.opacity50).toBe(0);
        expect(counts.opacity70).toBe(0);

        await testPage.close();
      }),
      { numRuns: 4 }
    );
  });
});
