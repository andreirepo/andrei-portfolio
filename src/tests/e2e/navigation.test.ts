import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { HomePage } from './pages/HomePage.js';

const BASE_URL = 'http://localhost:4321';

/**
 * Navigation E2E Tests
 *
 * Covers critical user journeys on the home page:
 * - Header structure and resume button
 * - Theme toggle (light/dark) with persistence
 * - Locale switcher between /en and /es
 * - Section anchors are present in the DOM
 * - Footer contact links
 *
 * Note: Uses Playwright locator queries with vitest assertions.
 * Playwright's expect matchers (toBeVisible, toBeAttached) are not available
 * when using vitest as the runner — we use .count() > 0 and .isVisible() instead.
 */

describe('Navigation E2E', () => {
  let browser: Browser;
  let page: Page;
  let homePage: HomePage;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    homePage = new HomePage(page);
    await homePage.goto('en');
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  describe('Navigation — Header', () => {
    it('should render the header with nav links', async () => {
      expect(await homePage.header.isVisible()).toBe(true);
      const count = await homePage.navLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    it('should render the resume button with correct attributes', async () => {
      const btn = homePage.resumeButton;
      expect(await btn.isVisible()).toBe(true);
      const href = await btn.getAttribute('href');
      expect(href).toContain('Resume.pdf');
      const target = await btn.getAttribute('target');
      expect(target).toBe('_blank');
      const rel = await btn.getAttribute('rel');
      expect(rel).toContain('noopener');
    });

    /**
     * Cloudflare's Email Address Obfuscation rewrites every mailto: into
     * /cdn-cgi/l/email-protection, a relay page that needs JavaScript and does
     * not open the mail client. The contact button was "not working" for
     * exactly this reason, so the link and its opt-out markers are asserted.
     */
    it('should render the hero contact button as a real mailto link', async () => {
      const href = await homePage.heroCtaEmail.getAttribute('href');
      expect(href).toBe('mailto:contact@andreirepo.com');
      expect(href).not.toContain('/cdn-cgi/');
    });

    it('should opt the contact link out of Cloudflare email obfuscation', async () => {
      const html = await page.content();
      expect(html).toContain('<!--email_off-->');
      expect(html).toContain('<!--/email_off-->');
    });

    it('should render the footer email as a real mailto link too', async () => {
      await homePage.footer.scrollIntoViewIfNeeded();
      const href = await page.locator('[data-testid="footer-email"]').getAttribute('href');
      expect(href).toBe('mailto:contact@andreirepo.com');
    });

    /**
     * Labels are capitalised for display, but the anchors are built from
     * `title.toLowerCase()`. Capitalising the label without lowercasing the
     * path leaves a nav that scrolls nowhere, so the pair is asserted.
     */
    it('should capitalise the nav labels and keep their anchors resolving', async () => {
      const enlaces = page.locator('[data-testid="main-nav"] a');
      const etiquetas = await enlaces.allInnerTexts();
      expect(etiquetas).toEqual(['Home', 'Projects', 'Blog']);

      const anchors = (await enlaces.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '')))
        .filter((href) => href.includes('#'))
        .map((href) => href.split('#')[1]);

      expect(anchors).toEqual(['projects', 'blog']);
      for (const id of anchors) {
        expect(await page.locator(`[id="${id}"]`).count()).toBe(1);
      }
    });

    it('should offer a 15-minute booking link as the primary CTA', async () => {
      const href = await homePage.heroCtaCal.getAttribute('href');
      expect(href).toBe('https://cal.com/andrei-repo-g1rtie/15min');
      expect(await homePage.heroCtaCal.getAttribute('target')).toBe('_blank');
    });

    it('should show a screenshot for every project', async () => {
      const imagenes = homePage.projectImages;
      expect(await imagenes.count()).toBe(3);
      const alts = await imagenes.evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt') ?? ''));
      for (const alt of alts) expect(alt.length).toBeGreaterThan(0);
      const cargadas = await imagenes.evaluateAll((imgs) =>
        imgs.every((i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0),
      );
      expect(cargadas).toBe(true);
    });

    it('should render locale switcher links for en and es', async () => {
      expect(await homePage.localeLink('en').isVisible()).toBe(true);
      expect(await homePage.localeLink('es').isVisible()).toBe(true);
    });
  });

  /**
   * The home label used to be a prop with an English default ("home"). Every
   * page except the homepage forgot to pass it, so Spanish blog posts showed
   * "home" in an otherwise Spanish menu. It is resolved inside the header now;
   * this walks every page type to keep it that way.
   */
  describe('Navigation — Home label on every route', () => {
    const rutas: Array<[string, string]> = [
      ['/en/', 'Home'],
      ['/en/blog/', 'Home'],
      ['/en/blog/ai-agentic-setup-e2e-test-automation/', 'Home'],
      ['/en/blog/tag/testing/', 'Home'],
      ['/es/', 'Inicio'],
      ['/es/blog/', 'Inicio'],
      ['/es/blog/ai-agentic-setup-e2e-test-automation/', 'Inicio'],
      ['/es/blog/tag/testing/', 'Inicio'],
    ];

    for (const [ruta, etiqueta] of rutas) {
      it(`should say "${etiqueta}" on ${ruta}`, async () => {
        await page.goto(`${BASE_URL}${ruta}`, { waitUntil: 'networkidle' });
        const home = page.locator('[data-testid="nav-home"]');
        expect(await home.count()).toBeGreaterThan(0);
        expect((await home.first().innerText()).trim()).toBe(etiqueta);
      });
    }
  });

  describe('Navigation — Theme Toggle', () => {
    it('should toggle dark mode when theme button is clicked', async () => {
      const initialDark = await homePage.isDarkMode();
      await homePage.themeToggle.click();
      await page.waitForTimeout(300);
      const afterToggle = await homePage.isDarkMode();
      expect(afterToggle).toBe(!initialDark);
    });

    it('should persist theme preference in localStorage', async () => {
      await homePage.setTheme('dark');
      const stored = await homePage.getStoredTheme();
      expect(stored).toBe('dark');
    });

    it('should restore dark mode after page reload', async () => {
      await homePage.setTheme('dark');
      await page.reload({ waitUntil: 'networkidle' });
      expect(await homePage.isDarkMode()).toBe(true);
    });

    it('should restore light mode after page reload', async () => {
      await homePage.setTheme('light');
      await page.reload({ waitUntil: 'networkidle' });
      expect(await homePage.isDarkMode()).toBe(false);
    });
  });

  describe('Navigation — Locale Switcher', () => {
    it('should navigate to /es when Spanish locale is clicked', async () => {
      await homePage.goto('en');
      await Promise.all([
        page.waitForURL(/\/es/),
        homePage.localeLink('es').click(),
      ]);
      expect(await homePage.currentPath).toMatch(/^\/es/);
    });

    it('should navigate to /en when English locale is clicked', async () => {
      await homePage.goto('es');
      await Promise.all([
        page.waitForURL(/\/en/),
        homePage.localeLink('en').click(),
      ]);
      expect(await homePage.currentPath).toMatch(/^\/en/);
    });

    it('should render content in Spanish on /es', async () => {
      await homePage.goto('es');
      const heading = await homePage.heroHeading.textContent();
      expect(heading?.trim().length).toBeGreaterThan(0);
      const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
      expect(lang).toBeTruthy();
    });
  });

  describe('Navigation — Home Page Sections', () => {
    it('should render the hero section with a heading', async () => {
      const text = await homePage.heroHeading.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });

    it('should not render a separate experience section', async () => {
      // The timeline moved to the résumé: the page goes hero → work → writing.
      expect(await page.locator('[data-testid="experience-section"]').count()).toBe(0);
    });

    it('should render the latest posts section with post links', async () => {
      const count = await homePage.latestPostLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    it('should render the see all posts link pointing to /en/blog', async () => {
      const href = await homePage.seeAllPostsLink.getAttribute('href');
      expect(href).toContain('/blog');
    });

    it('should render the footer with contact links', async () => {
      await homePage.footer.scrollIntoViewIfNeeded();
      const count = await homePage.footerLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    it('should have a #main-content element in the DOM', async () => {
      const mainContent = await page.$('#main-content');
      expect(mainContent).not.toBeNull();
    });

    it('should have a skip-to-content link targeting #main-content', async () => {
      const skipLink = await page.$('a[href="#main-content"]');
      expect(skipLink).not.toBeNull();
    });
  });
});