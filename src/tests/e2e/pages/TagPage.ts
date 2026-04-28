import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * TagPage — page object for /[lang]/blog/tag/[tag].
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
    return this.page.locator('main h1');
  }

  get postCount() {
    return this.page.locator('main span.text-muted-foreground');
  }

  get backLink() {
    return this.page.locator('main a[href$="/blog"]');
  }

  get postItems() {
    return this.page.locator('main li');
  }

  get postLinks() {
    return this.page.locator('main li a[href*="/blog/"]').filter({ hasNot: this.page.locator('[href*="/tag/"]') });
  }

  get activeTagLinks() {
    return this.page.locator('main a[href*="/blog/tag/"].border-green-accent');
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
