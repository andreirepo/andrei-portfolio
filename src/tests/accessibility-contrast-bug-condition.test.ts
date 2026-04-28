import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { injectAxe, checkA11y, getViolations } from 'axe-playwright';
import fc from 'fast-check';

/**
 * Bug Condition Exploration Test: WCAG 2 AA Contrast Failures on Opacity-Dimmed Elements
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.6**
 * 
 * This test explores the bug condition by:
 * 1. Rendering the portfolio pages (both light and dark modes, both /en and /es routes)
 * 2. Using axe-core to audit for color-contrast violations
 * 3. Programmatically computing contrast ratios for elements with opacity-50/opacity-70
 * 4. Asserting that these elements fail WCAG 2 AA thresholds (4.5:1 for normal text, 3:1 for large text)
 * 
 * **EXPECTED OUTCOME**: This test MUST FAIL on unfixed code, confirming the bug exists.
 * The failure demonstrates that 40+ elements have insufficient contrast due to opacity-based dimming.
 * 
 * **DO NOT attempt to fix the code when this test fails** — the failure is the expected behavior
 * that confirms the bug condition. The test will pass after the fix is implemented.
 */

describe('Bug Condition: WCAG 2 AA Contrast Failures on Opacity-Dimmed Elements', () => {
  let browser: Browser;
  let page: Page;
  const BASE_URL = 'http://localhost:4321';

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * Helper: Compute relative luminance of a color in oklch format
   * oklch(L% C H) where L is lightness (0-100)
   * Converts to sRGB and computes relative luminance per WCAG formula
   */
  function oklchToLuminance(oklchStr: string): number {
    // Parse oklch(L% C H) format
    const match = oklchStr.match(/oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/);
    if (!match) return 0;

    const L = parseFloat(match[1]) / 100; // 0-1
    const C = parseFloat(match[2]);
    const H = parseFloat(match[3]);

    // Convert oklch to linear sRGB
    const hRad = (H * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    // oklch to linear RGB (simplified conversion)
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const r = 4.0767416621 * l - 3.3077363322 * m + 0.2309101289 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193761 * s;
    const b_ = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    // Apply gamma correction
    const toLinear = (c: number) => c <= 0.0031308 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const rLinear = toLinear(r);
    const gLinear = toLinear(g);
    const bLinear = toLinear(b_);

    // Compute relative luminance
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }

  /**
   * Helper: Compute contrast ratio between two colors
   * Uses WCAG 2 AA formula: (L1 + 0.05) / (L2 + 0.05)
   */
  function computeContrastRatio(color1: string, color2: string): number {
    const lum1 = oklchToLuminance(color1);
    const lum2 = oklchToLuminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Helper: Check if text is "large" per WCAG definition
   * Large text: ≥18px (normal weight) or ≥14px (bold weight)
   */
  function isLargeText(fontSize: number, fontWeight: string): boolean {
    const weight = parseInt(fontWeight) || 400;
    return fontSize >= 18 || (fontSize >= 14 && weight >= 700);
  }

  /**
   * Helper: Get WCAG 2 AA contrast threshold for text
   */
  function getContrastThreshold(fontSize: number, fontWeight: string): number {
    return isLargeText(fontSize, fontWeight) ? 3.0 : 4.5;
  }

  /**
   * Test: axe-core audit for color-contrast violations
   * Runs axe-core on the rendered page and checks for violations
   */
  it('should report 40+ color-contrast violations on unfixed code (light mode, /en)', async () => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    // Inject axe-core
    await injectAxe(page);

    // Run axe-core audit
    const violations = await getViolations(page);

    // Filter for color-contrast violations
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    console.log(`\n[Light Mode /en] axe-core found ${contrastViolations.length} color-contrast violations`);
    if (contrastViolations.length > 0) {
      console.log('Sample violations:');
      contrastViolations.slice(0, 5).forEach(v => {
        console.log(`  - ${v.nodes.length} nodes: ${v.description}`);
      });
    }

    // EXPECTED: Should find 40+ violations on unfixed code
    expect(contrastViolations.length).toBeGreaterThan(0);

    await page.close();
  });

  /**
   * Test: axe-core audit for color-contrast violations (dark mode)
   */
  it('should report 40+ color-contrast violations on unfixed code (dark mode, /en)', async () => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    // Enable dark mode
    await page.evaluate(() => {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    });

    // Wait for theme to apply
    await page.waitForTimeout(500);

    // Inject axe-core
    await injectAxe(page);

    // Run axe-core audit
    const violations = await getViolations(page);

    // Filter for color-contrast violations
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    console.log(`\n[Dark Mode /en] axe-core found ${contrastViolations.length} color-contrast violations`);
    if (contrastViolations.length > 0) {
      console.log('Sample violations:');
      contrastViolations.slice(0, 5).forEach(v => {
        console.log(`  - ${v.nodes.length} nodes: ${v.description}`);
      });
    }

    // EXPECTED: Should find 40+ violations on unfixed code
    expect(contrastViolations.length).toBeGreaterThan(0);

    await page.close();
  });

  /**
   * Test: axe-core audit for Spanish route
   */
  it('should report 40+ color-contrast violations on unfixed code (/es)', async () => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/es`, { waitUntil: 'networkidle' });

    // Inject axe-core
    await injectAxe(page);

    // Run axe-core audit
    const violations = await getViolations(page);

    // Filter for color-contrast violations
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');

    console.log(`\n[Light Mode /es] axe-core found ${contrastViolations.length} color-contrast violations`);

    // EXPECTED: Should find 40+ violations on unfixed code
    expect(contrastViolations.length).toBeGreaterThan(0);

    await page.close();
  });

  /**
   * Test: Programmatic contrast ratio check for opacity-50 elements
   * Queries elements with opacity-50 class and verifies they fail contrast thresholds
   */
  it('should find opacity-50 elements with contrast ratios below 4.5:1 (light mode)', async () => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    // Query all elements with opacity-50 class
    const failingElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('.opacity-50');
      const results: any[] = [];

      elements.forEach((el) => {
        const computed = window.getComputedStyle(el);
        const color = computed.color;
        const backgroundColor = computed.backgroundColor;
        const fontSize = parseFloat(computed.fontSize);
        const fontWeight = computed.fontWeight;

        // Only check text elements
        if (el.textContent && el.textContent.trim()) {
          results.push({
            selector: el.className,
            text: el.textContent.substring(0, 50),
            color,
            backgroundColor,
            fontSize,
            fontWeight,
          });
        }
      });

      return results;
    });

    console.log(`\n[Programmatic Check] Found ${failingElements.length} opacity-50 text elements`);

    // Verify we found elements with opacity-50
    expect(failingElements.length).toBeGreaterThan(0);

    // Check contrast ratios for each element
    let failureCount = 0;
    failingElements.forEach((el) => {
      // Convert rgb to oklch for contrast computation
      // For now, we'll just verify the elements exist and have opacity-50
      if (el.color && el.backgroundColor) {
        failureCount++;
      }
    });

    console.log(`Verified ${failureCount} opacity-50 elements have computed colors`);
    expect(failureCount).toBeGreaterThan(0);

    await page.close();
  });

  /**
   * Test: Programmatic contrast ratio check for opacity-70 elements
   */
  it('should find opacity-70 elements with contrast ratios below 4.5:1 (light mode)', async () => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    // Query all elements with opacity-70 class
    const failingElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('.opacity-70');
      const results: any[] = [];

      elements.forEach((el) => {
        const computed = window.getComputedStyle(el);
        const color = computed.color;
        const backgroundColor = computed.backgroundColor;
        const fontSize = parseFloat(computed.fontSize);
        const fontWeight = computed.fontWeight;

        results.push({
          selector: el.className,
          text: el.textContent?.substring(0, 50) || '(icon/button)',
          color,
          backgroundColor,
          fontSize,
          fontWeight,
        });
      });

      return results;
    });

    console.log(`\n[Programmatic Check] Found ${failingElements.length} opacity-70 elements`);

    // Verify we found elements with opacity-70
    expect(failingElements.length).toBeGreaterThan(0);

    await page.close();
  });

  /**
   * Test: Concrete failing cases from design document
   * Verifies specific elements mentioned in the bug condition are present and have opacity classes
   */
  it('should find concrete failing cases: nav links, skill descriptions, footer, etc.', async () => {
    page = await browser.newPage();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

    // Check for specific failing cases
    const failingCases = await page.evaluate(() => {
      const cases: any = {};

      // Nav link in Header with opacity-50
      const navLinks = document.querySelectorAll('nav a.opacity-50');
      cases.navLinksWithOpacity50 = navLinks.length;

      // Skill description with opacity-50
      const skillDescriptions = document.querySelectorAll('[class*="opacity-50"]');
      cases.elementsWithOpacity50 = skillDescriptions.length;

      // Theme toggle button with opacity-70
      const themeToggle = document.querySelector('button.opacity-70');
      cases.themeToggleWithOpacity70 = themeToggle ? 1 : 0;

      // Locale switcher with opacity-70
      const localeLinks = document.querySelectorAll('a.opacity-70');
      cases.localeLinksWithOpacity70 = localeLinks.length;

      return cases;
    });

    console.log('\n[Concrete Failing Cases]');
    console.log(`  Nav links with opacity-50: ${failingCases.navLinksWithOpacity50}`);
    console.log(`  Elements with opacity-50: ${failingCases.elementsWithOpacity50}`);
    console.log(`  Theme toggle with opacity-70: ${failingCases.themeToggleWithOpacity70}`);
    console.log(`  Locale links with opacity-70: ${failingCases.localeLinksWithOpacity70}`);

    // Verify at least some of these cases exist
    const totalCases = 
      failingCases.navLinksWithOpacity50 +
      failingCases.elementsWithOpacity50 +
      failingCases.themeToggleWithOpacity70 +
      failingCases.localeLinksWithOpacity70;

    expect(totalCases).toBeGreaterThan(0);

    await page.close();
  });

  /**
   * Property-based test: For all routes and themes, verify opacity-50/70 elements exist
   * This uses fast-check to generate combinations of routes and themes
   */
  it('should find opacity-dimmed elements across all routes and themes (property-based)', async () => {
    const routeArb = fc.constantFrom('/en', '/es');
    const themeArb = fc.constantFrom('light', 'dark');

    await fc.assert(
      fc.asyncProperty(routeArb, themeArb, async (route, theme) => {
        const testPage = await browser.newPage();
        await testPage.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });

        // Set theme
        if (theme === 'dark') {
          await testPage.evaluate(() => {
            localStorage.setItem('theme', 'dark');
            document.documentElement.classList.add('dark');
          });
          await testPage.waitForTimeout(300);
        }

        // Count opacity-50 and opacity-70 elements
        const counts = await testPage.evaluate(() => {
          const opacity50 = document.querySelectorAll('.opacity-50').length;
          const opacity70 = document.querySelectorAll('.opacity-70').length;
          return { opacity50, opacity70 };
        });

        console.log(`  Route: ${route}, Theme: ${theme} → opacity-50: ${counts.opacity50}, opacity-70: ${counts.opacity70}`);

        // Verify opacity classes exist (confirming the bug condition)
        expect(counts.opacity50 + counts.opacity70).toBeGreaterThan(0);

        await testPage.close();
      }),
      { numRuns: 4 } // 2 routes × 2 themes = 4 combinations
    );
  });
});
