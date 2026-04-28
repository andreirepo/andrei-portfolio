import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * TagPage — page object for /[lang]/blog/tag/[tag] using data-testid selectors.
 */
export class TagPage extends BasePage {
  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);
  }

  async goto(locale: 'en' | 'es', tag: string) {
    await super.goto(`/${locale}/blog/tag/${tag}`);
  }

  // ── Page elements ─────────────────────────────────────────────────────────

  get tagHeading() {
    return this.page.locator('[data-testid="tag-heading"]');
  }

  get backLink() {
    return this.page.locator('[data-testid="back-link"]');
  }

  get postItems() {
    return this.page.locator('[data-testid="tag-post-list"] li');
  }

  get postLinks() {
    // Card links — the outer <a> wrapping each card (not tag links)
    return this.page.locator('[data-testid="tag-post-list"] li > a');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async getPostCount(): Promise<number> {
    return this.postItems.count();
  }

  async clickBackLink() {
    await this.backLink.click();
    await this.page.waitForLoadState('networkidle');
  }
}
