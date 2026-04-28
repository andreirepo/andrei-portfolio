import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { HomePage } from './pages/HomePage.js';

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

describe('Navigation — Header', () => {
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
    await page.close();
  });

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

  it('should render locale switcher links for en and es', async () => {
    expect(await homePage.localeLink('en').isVisible()).toBe(true);
    expect(await homePage.localeLink('es').isVisible()).toBe(true);
  });});

describe('Navigation — Theme Toggle', () => {
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
    await page.close();
  });

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
  });

  afterEach(async () => {
    await page.close();
  });

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
    await page.close();
  });

  it('should render the hero section with a heading', async () => {
    const text = await homePage.heroHeading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  it('should render the experience section with at least one entry', async () => {
    const count = await homePage.experienceItems.count();
    expect(count).toBeGreaterThan(0);
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
