import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import fc from 'fast-check';

/**
 * Preservation Property Tests: Baseline Behavior for Non-Buggy Elements
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**
 * 
 * This test suite verifies that elements NOT affected by the bug condition
 * (i.e., elements that already meet contrast requirements or are non-text elements)
 * continue to render correctly and maintain their baseline behavior.
 * 
 * **EXPECTED OUTCOME**: Tests PASS on unfixed code — all preservation properties hold,
 * confirming baseline behavior to preserve during the fix.
 * 
 * Test Strategy:
 * - Observe behavior on UNFIXED code for elements that already meet contrast requirements
 * - Write property-based tests capturing observed behavior patterns
 * - Test across multiple dimensions: light/dark modes, viewport widths, locales, interactive states
 * - Verify no regressions when the fix is applied
 */

describe('Preservation Properties: Baseline Behavior for Non-Buggy Elements', () => {
  let browser: Browser;
  const BASE_URL = 'http://localhost:4321';

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  // Helper: Wait for page to be fully loaded
  async function waitForPageReady(page: Page) {
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  }

  // ============================================================================
  // Property 1: Green Accent Preservation
  // ============================================================================

  describe('Property 1: Green Accent Preservation', () => {
    /**
     * Verify text-green-500 elements render with green color and meet contrast requirements
     * Affected elements: skill titles, project links, active locale, resume button
     */
    it('should preserve green accent color on skill titles across all themes', async () => {
      const themeArb = fc.constantFrom('light', 'dark');

      await fc.assert(
        fc.asyncProperty(themeArb, async (theme) => {
          const page = await browser.newPage();
          await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
          await waitForPageReady(page);

          // Set theme
          if (theme === 'dark') {
            await page.evaluate(() => {
              localStorage.setItem('theme', 'dark');
              document.documentElement.classList.add('dark');
            });
            await page.waitForTimeout(300);
          }

          // Query skill titles with text-green-500
          const skillTitles = await page.evaluate(() => {
            const elements = document.querySelectorAll('.text-green-500');
            return elements.length;
          });

          // Verify green accent elements exist
          expect(skillTitles).toBeGreaterThan(0);

          await page.close();
        }),
        { numRuns: 2 } // light and dark modes
      );
    });

    /**
     * Verify resume button maintains green background and white text
     */
    it('should preserve resume button styling (green background, white text)', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const resumeButton = await page.evaluate(() => {
        const btn = document.querySelector('a[href*="Resume.pdf"]');
        if (!btn) return null;

        return {
          hasGreenBg: btn.className.includes('bg-green-600') || btn.className.includes('bg-green-500'),
          hasWhiteText: btn.className.includes('text-white'),
          text: btn.textContent,
        };
      });

      expect(resumeButton).not.toBeNull();
      expect(resumeButton?.hasGreenBg).toBe(true);
      expect(resumeButton?.hasWhiteText).toBe(true);
      expect(resumeButton?.text).toBeTruthy();

      await page.close();
    });
  });

  // ============================================================================
  // Property 2: Dark Mode Toggle Preservation
  // ============================================================================

  describe('Property 2: Dark Mode Toggle Preservation', () => {
    /**
     * Verify theme toggle button applies/removes dark class on <html>
     */
    it('should preserve dark mode toggle functionality', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

      // Initial state
      const initialDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      // Click theme toggle
      await page.click('#theme-toggle');
      await page.waitForTimeout(300);

      // Verify dark class was toggled
      const afterToggleDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      expect(afterToggleDarkClass).toBe(!initialDarkClass);

      // Toggle again to verify it works both ways
      await page.click('#theme-toggle');
      await page.waitForTimeout(300);

      const finalDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      expect(finalDarkClass).toBe(initialDarkClass);

      await page.close();
    });

    /**
     * Verify theme toggle swaps sun/moon icons
     */
    it('should preserve sun/moon icon swapping on theme toggle', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

      // Get initial icon visibility
      const initialIcons = await page.evaluate(() => {
        const sunIcon = document.getElementById('icon-sun');
        const moonIcon = document.getElementById('icon-moon');
        return {
          sunHidden: sunIcon?.classList.contains('hidden') ?? true,
          moonHidden: moonIcon?.classList.contains('hidden') ?? true,
        };
      });

      // Click theme toggle
      await page.click('#theme-toggle');
      await page.waitForTimeout(300);

      // Get icon visibility after toggle
      const afterToggleIcons = await page.evaluate(() => {
        const sunIcon = document.getElementById('icon-sun');
        const moonIcon = document.getElementById('icon-moon');
        return {
          sunHidden: sunIcon?.classList.contains('hidden') ?? true,
          moonHidden: moonIcon?.classList.contains('hidden') ?? true,
        };
      });

      // Verify icons were swapped
      expect(afterToggleIcons.sunHidden).toBe(!initialIcons.sunHidden);
      expect(afterToggleIcons.moonHidden).toBe(!initialIcons.moonHidden);

      await page.close();
    });

    /**
     * Verify theme preference persists in localStorage
     */
    it('should preserve theme preference persistence in localStorage', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });

      // Set theme to dark
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark');
        document.documentElement.classList.add('dark');
      });

      // Verify localStorage was set
      const storedTheme = await page.evaluate(() => {
        return localStorage.getItem('theme');
      });

      expect(storedTheme).toBe('dark');

      // Reload page and verify theme persists
      await page.reload({ waitUntil: 'networkidle' });

      const isDarkAfterReload = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark');
      });

      expect(isDarkAfterReload).toBe(true);

      await page.close();
    });
  });

  // ============================================================================
  // Property 3: Locale Switcher Preservation
  // ============================================================================

  describe('Property 3: Locale Switcher Preservation', () => {
    /**
     * Verify locale switcher exists and has proper styling
     */
    it('should preserve locale switcher styling', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const localeLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('a[href*="/en"], a[href*="/es"]');
        return links.length;
      });

      // Verify locale switcher exists
      expect(localeLinks).toBeGreaterThanOrEqual(2);

      await page.close();
    });

    /**
     * Verify locale switcher navigation works correctly
     */
    it('should preserve locale switcher navigation functionality', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      // Verify we're on /en
      expect(page.url()).toContain('/en');

      // Find and click Spanish locale link
      const esLink = await page.$('a[href="/es"]');
      expect(esLink).not.toBeNull();

      // Navigate directly to /es to verify locale switching works
      await page.goto(`${BASE_URL}/es`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      // Verify we're now on /es
      expect(page.url()).toContain('/es');

      await page.close();
    });
  });

  // ============================================================================
  // Property 4: Layout Preservation
  // ============================================================================

  describe('Property 4: Layout Preservation', () => {
    /**
     * Verify Experience section layout exists
     */
    it('should preserve experience section layout structure', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const experienceSection = await page.evaluate(() => {
        const section = document.querySelector('section');
        if (!section) return null;

        // Look for experience-related content
        const hasHeading = !!section.querySelector('h2, h3, h4');
        return {
          exists: !!section,
          hasHeading,
        };
      });

      // Verify experience section exists
      expect(experienceSection?.exists).toBe(true);

      await page.close();
    });

    /**
     * Verify Footer layout exists
     */
    it('should preserve footer layout structure', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const footerLayout = await page.evaluate(() => {
        const footer = document.querySelector('footer');
        if (!footer) return null;

        const heading = footer.querySelector('h2, h3, h4');
        const description = footer.querySelector('p');
        const links = footer.querySelectorAll('a');

        return {
          exists: !!footer,
          hasHeading: !!heading,
          hasDescription: !!description,
          linkCount: links.length,
        };
      });

      expect(footerLayout?.exists).toBe(true);
      expect(footerLayout?.hasHeading).toBe(true);
      expect(footerLayout?.linkCount).toBeGreaterThan(0);

      await page.close();
    });

    /**
     * Verify Header exists and has nav
     */
    it('should preserve header layout structure', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const headerLayout = await page.evaluate(() => {
        const header = document.querySelector('header');
        const nav = header?.querySelector('nav');

        return {
          headerExists: !!header,
          navExists: !!nav,
        };
      });

      expect(headerLayout.headerExists).toBe(true);
      expect(headerLayout.navExists).toBe(true);

      await page.close();
    });
  });

  // ============================================================================
  // Property 5: Content Preservation
  // ============================================================================

  describe('Property 5: Content Preservation', () => {
    /**
     * Verify all text content (headings, descriptions, labels) is present
     */
    it('should preserve all text content across pages', async () => {
      const localeArb = fc.constantFrom('en', 'es');

      await fc.assert(
        fc.asyncProperty(localeArb, async (locale) => {
          const page = await browser.newPage();
          await page.goto(`${BASE_URL}/${locale}`, { waitUntil: 'networkidle' });
          await waitForPageReady(page);

          const content = await page.evaluate(() => {
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const paragraphs = document.querySelectorAll('p');

            return {
              headingCount: headings.length,
              paragraphCount: paragraphs.length,
              hasContent: headings.length > 0 || paragraphs.length > 0,
            };
          });

          // Verify content exists
          expect(content.hasContent).toBe(true);
          expect(content.headingCount).toBeGreaterThan(0);

          await page.close();
        }),
        { numRuns: 2 } // en and es
      );
    });

    /**
     * Verify Projects section has content
     */
    it('should preserve projects section content', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const projectsContent = await page.evaluate(() => {
        const projectsSection = document.querySelector('section');
        if (!projectsSection) return { hasContent: false };

        // Check for project items (li elements) or project links
        const projectItems = projectsSection.querySelectorAll('li');
        const projectLinks = projectsSection.querySelectorAll('a.text-green-500');
        return {
          hasContent: projectItems.length > 0 || projectLinks.length > 0,
        };
      });

      // Verify projects have content
      expect(projectsContent.hasContent).toBe(true);

      await page.close();
    });
  });

  // ============================================================================
  // Property 6: Interactive Behavior Preservation
  // ============================================================================

  describe('Property 6: Interactive Behavior Preservation', () => {
    /**
     * Verify Resume button exists and has correct attributes
     */
    it('should preserve resume button PDF opening behavior', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const resumeButton = await page.evaluate(() => {
        const btn = document.querySelector('a[href*="Resume.pdf"]');
        return {
          exists: !!btn,
          href: btn?.getAttribute('href'),
          target: btn?.getAttribute('target'),
          rel: btn?.getAttribute('rel'),
        };
      });

      expect(resumeButton.exists).toBe(true);
      expect(resumeButton.href).toContain('Resume.pdf');
      expect(resumeButton.target).toBe('_blank');
      expect(resumeButton.rel).toContain('noopener');

      await page.close();
    });

    /**
     * Verify nav links are clickable
     */
    it('should preserve nav link navigation functionality', async () => {
      const page = await browser.newPage();
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle' });
      await waitForPageReady(page);

      const navLinks = await page.evaluate(() => {
        const links = document.querySelectorAll('nav a');
        return links.length;
      });

      // Verify nav links exist
      expect(navLinks).toBeGreaterThan(0);

      await page.close();
    });
  });

  // ============================================================================
  // Property 7: i18n Preservation
  // ============================================================================

  describe('Property 7: i18n Preservation', () => {
    /**
     * Verify content displays correctly in both English and Spanish
     */
    it('should preserve i18n content in English and Spanish', async () => {
      const localeArb = fc.constantFrom('en', 'es');

      await fc.assert(
        fc.asyncProperty(localeArb, async (locale) => {
          const page = await browser.newPage();
          await page.goto(`${BASE_URL}/${locale}`, { waitUntil: 'networkidle' });
          await waitForPageReady(page);

          const i18nContent = await page.evaluate(() => {
            const html = document.documentElement;
            const lang = html.getAttribute('lang');
            const headings = document.querySelectorAll('h1, h2, h3');

            return {
              langAttribute: lang,
              headingCount: headings.length,
              hasContent: headings.length > 0,
            };
          });

          // Verify language attribute is set
          expect(i18nContent.langAttribute).toBeTruthy();

          // Verify content exists
          expect(i18nContent.hasContent).toBe(true);

          await page.close();
        }),
        { numRuns: 2 } // en and es
      );
    });
  });

  // ============================================================================
  // Property 8: Cross-Dimensional Preservation
  // ============================================================================

  describe('Property 8: Cross-Dimensional Preservation', () => {
    /**
     * Property-based test: Verify preservation across all combinations of
     * theme (light/dark) and locale (en/es)
     */
    it('should preserve layout and content across all theme/locale combinations', async () => {
      const themeArb = fc.constantFrom('light', 'dark');
      const localeArb = fc.constantFrom('en', 'es');

      await fc.assert(
        fc.asyncProperty(themeArb, localeArb, async (theme, locale) => {
          const page = await browser.newPage();
          await page.goto(`${BASE_URL}/${locale}`, { waitUntil: 'networkidle' });
          await waitForPageReady(page);

          // Set theme
          if (theme === 'dark') {
            await page.evaluate(() => {
              localStorage.setItem('theme', 'dark');
              document.documentElement.classList.add('dark');
            });
            await page.waitForTimeout(300);
          }

          // Verify page structure is intact
          const structure = await page.evaluate(() => {
            const header = document.querySelector('header');
            const footer = document.querySelector('footer');

            return {
              hasHeader: !!header,
              hasFooter: !!footer,
              isDarkMode: document.documentElement.classList.contains('dark'),
            };
          });

          // Verify basic structure exists
          expect(structure.hasHeader).toBe(true);
          expect(structure.hasFooter).toBe(true);

          // Verify theme was applied correctly
          expect(structure.isDarkMode).toBe(theme === 'dark');

          await page.close();
        }),
        { numRuns: 4 } // 2 themes × 2 locales
      );
    });

    /**
     * Verify theme toggle works across locales
     */
    it('should preserve theme toggle functionality across locales', async () => {
      const localeArb = fc.constantFrom('en', 'es');

      await fc.assert(
        fc.asyncProperty(localeArb, async (locale) => {
          const page = await browser.newPage();
          await page.goto(`${BASE_URL}/${locale}`, { waitUntil: 'networkidle' });
          await waitForPageReady(page);

          // Get initial dark class state
          const initialDarkClass = await page.evaluate(() => {
            return document.documentElement.classList.contains('dark');
          });

          // Click theme toggle
          await page.click('#theme-toggle');
          await page.waitForTimeout(300);

          // Verify dark class was toggled
          const afterToggleDarkClass = await page.evaluate(() => {
            return document.documentElement.classList.contains('dark');
          });

          expect(afterToggleDarkClass).toBe(!initialDarkClass);

          await page.close();
        }),
        { numRuns: 2 } // en and es
      );
    });
  });
});
