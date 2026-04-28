import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * BlogPage — page object for /[lang]/blog (blog index).
 */
export class BlogPage extends BasePage {
  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);
  }

  async goto(locale: 'en' | 'es' = 'en') {
    await super.goto(`/${locale}/blog`);
  }

  // ── Page elements ─────────────────────────────────────────────────────────

  get heading() {
    return this.page.locator('main h1');
  }

  get postList() {
    return this.page.locator('main ul');
  }

  get postItems() {
    return this.page.locator('main li');
  }

  get postLinks() {
    return this.page.locator('main li a[href*="/blog/"]').filter({ hasNot: this.page.locator('[href*="/tag/"]') });
  }

  get tagLinks() {
    return this.page.locator('main a[href*="/blog/tag/"]');
  }

  get emptyState() {
    return this.page.locator('main p');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async getPostTitles(): Promise<string[]> {
    return this.postLinks.allTextContents();
  }

  async clickFirstPost() {
    await this.postLinks.first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickTag(tagText: string) {
    await this.page.locator(`main a[href*="/blog/tag/"]`, { hasText: tagText }).first().click();
    await this.page.waitForLoadState('networkidle');
  }
}
