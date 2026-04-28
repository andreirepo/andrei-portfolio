import type { Page } from 'playwright';

/**
 * BasePage — shared methods and selectors using data-testid attributes.
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
    return this.page.locator('[data-testid="site-header"]');
  }

  get navLinks() {
    return this.page.locator('[data-testid="main-nav"] a');
  }

  get themeToggle() {
    return this.page.locator('[data-testid="theme-toggle"]');
  }

  get resumeButton() {
    return this.page.locator('[data-testid="resume-button"]');
  }

  localeLink(locale: 'en' | 'es') {
    return this.page.locator(`[data-testid="locale-${locale}"]`);
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
    return this.page.locator('[data-testid="site-footer"]');
  }

  get footerLinks() {
    return this.page.locator('[data-testid="site-footer"] a');
  }
}
