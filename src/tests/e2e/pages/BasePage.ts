import type { Page } from 'playwright';

/**
 * BasePage — shared methods and selectors used across all page objects.
 */
export class BasePage {
  readonly page: Page;
  readonly baseUrl: string;

  constructor(page: Page, baseUrl = 'http://localhost:4321') {
    this.page = page;
    this.baseUrl = baseUrl;
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  async goto(path: string) {
    await this.page.goto(`${this.baseUrl}${path}`, { waitUntil: 'networkidle' });
  }

  get currentPath(): Promise<string> {
    return this.page.evaluate(() => window.location.pathname);
  }

  // ── Header ────────────────────────────────────────────────────────────────

  get header() {
    return this.page.locator('header');
  }

  get navLinks() {
    return this.page.locator('header nav a');
  }

  get themeToggle() {
    return this.page.locator('#theme-toggle');
  }

  get resumeButton() {
    return this.page.locator('a[href*="Resume.pdf"]');
  }

  localeLink(locale: 'en' | 'es') {
    // Scope to the locale switcher div to avoid matching the home nav link
    return this.page.locator(`header div a[href="/${locale}"].uppercase`);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  async setTheme(theme: 'light' | 'dark') {
    await this.page.evaluate((t) => {
      localStorage.setItem('theme', t);
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);
    await this.page.waitForTimeout(200);
  }

  async isDarkMode(): Promise<boolean> {
    return this.page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
  }

  async getStoredTheme(): Promise<string | null> {
    return this.page.evaluate(() => localStorage.getItem('theme'));
  }

  // ── Footer ────────────────────────────────────────────────────────────────

  get footer() {
    return this.page.locator('footer');
  }

  get footerLinks() {
    return this.page.locator('footer a');
  }
}
