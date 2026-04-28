import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { HomePage } from './pages/HomePage.js';
import { BasePage } from './pages/BasePage.js';

/**
 * Navigation E2E Tests
 *
 * Covers critical user journeys on the home page:
 * - Header structure and resume button
 * - Theme toggle (light/dark) with persistence
 * - Locale switcher between /en and /es
 * - Section anchors are present in the DOM
 * - Footer contact links
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
    await expect(homePage.header).toBeVisible();
    const count = await homePage.navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render the resume button with correct attributes', async () => {
    const btn = homePage.resumeButton;
    await expect(btn).toBeVisible();
    const href = await btn.getAttribute('href');
    expect(href).toContain('Resume.pdf');
    const target = await btn.getAttribute('target');
    expect(target).toBe('_blank');
    const rel = await btn.getAttribute('rel');
    expect(rel).toContain('noopener');
  });

  it('should render locale switcher links for en and es', async () => {
    const enLink = homePage.localeLink('en');
    const esLink = homePage.localeLink('es');
    await expect(enLink).toBeVisible();
    await expect(esLink).toBeVisible();
  });
});

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
    const isDark = await homePage.isDarkMode();
    expect(isDark).toBe(true);
  });

  it('should restore light mode after page reload', async () => {
    await homePage.setTheme('light');
    await page.reload({ waitUntil: 'networkidle' });
    const isDark = await homePage.isDarkMode();
    expect(isDark).toBe(false);
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
    await homePage.localeLink('es').click();
    await page.waitForLoadState('networkidle');
    const path = await homePage.currentPath;
    expect(path).toMatch(/^\/es/);
  });

  it('should navigate to /en when English locale is clicked', async () => {
    await homePage.goto('es');
    await homePage.localeLink('en').click();
    await page.waitForLoadState('networkidle');
    const path = await homePage.currentPath;
    expect(path).toMatch(/^\/en/);
  });

  it('should render content in Spanish on /es', async () => {
    await homePage.goto('es');
    const heading = await homePage.heroHeading.textContent();
    expect(heading).toBeTruthy();
    // Page should have lang attribute set
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
    await expect(homePage.heroHeading).toBeVisible();
    const text = await homePage.heroHeading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  it('should render the skills section with at least one card', async () => {
    await expect(homePage.skillsSection).toBeVisible();
    const count = await homePage.skillCards.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render the experience section with at least one entry', async () => {
    await expect(homePage.experienceSection).toBeVisible();
    const count = await homePage.experienceItems.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render the latest posts section with post links', async () => {
    await expect(homePage.blogSection).toBeVisible();
    const count = await homePage.latestPostLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render the see all posts link pointing to /en/blog', async () => {
    const link = homePage.seeAllPostsLink;
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('/blog');
  });

  it('should render the footer with contact links', async () => {
    await expect(homePage.footer).toBeVisible();
    const count = await homePage.footerLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render the skip to content link that targets #main-content', async () => {
    const skipLink = page.locator('a[href="#main-content"]');
    const href = await skipLink.getAttribute('href');
    expect(href).toBe('#main-content');
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeAttached();
  });
});
