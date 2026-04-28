import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { injectAxe, getViolations } from 'axe-playwright';
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
   * Test: axe-core audit — zero color-contrast violations (light mode, /en)
   */
  it('should have zero color-contrast violations (light mode, /en)', async () => {
    const page: Page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    await injectAxe(page);
    const violations = await getViolations(page);
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    console.log(`\n[Light Mode /en] axe-core found ${contrastViolations.length} color-contrast violations`);
    if (contrastViolations.length > 0) {
      contrastViolations.forEach(v => {
        console.log(`  ✗ ${v.nodes.length} nodes: ${v.description}`);
        v.nodes.slice(0, 3).forEach((n: any) => console.log(`    - ${n.html?.substring(0, 100)}`));
      });
    }

    expect(contrastViolations.length).toBe(0);
    await page.close();
  });

  /**
   * Test: axe-core audit — zero color-contrast violations (dark mode, /en)
   */
  it('should have zero color-contrast violations (dark mode, /en)', async () => {
    const page: Page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    await page.waitForTimeout(500);

    await injectAxe(page);
    const violations = await getViolations(page);
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    console.log(`\n[Dark Mode /en] axe-core found ${contrastViolations.length} color-contrast violations`);

    expect(contrastViolations.length).toBe(0);
    await page.close();
  });

  /**
   * Test: axe-core audit — zero color-contrast violations (/es)
   */
  it('should have zero color-contrast violations (/es)', async () => {
    const page: Page = await browser.newPage();
    await page.goto(`${BASE_URL}/es`, { waitUntil: 'networkidle' });

    await injectAxe(page);
    const violations = await getViolations(page);
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    console.log(`\n[Light Mode /es] axe-core found ${contrastViolations.length} color-contrast violations`);

    expect(contrastViolations.length).toBe(0);
    await page.close();
  });

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
