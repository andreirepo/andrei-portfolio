import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * BlogPostPage — page object for /[lang]/blog/[slug] using data-testid selectors.
 */
export class BlogPostPage extends BasePage {
  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);
  }

  async goto(locale: 'en' | 'es', slug: string) {
    await super.goto(`/${locale}/blog/${slug}`);
  }

  // ── Page elements ─────────────────────────────────────────────────────────

  get backLink() {
    return this.page.locator('[data-testid="back-link"]');
  }

  get postHeading() {
    return this.page.locator('[data-testid="post-heading"]');
  }

  get postDescription() {
    return this.page.locator('[data-testid="post-description"]');
  }

  get publishedDate() {
    return this.page.locator('[data-testid="post-date"]');
  }

  get tagLinks() {
    return this.page.locator('[data-testid="post-header"] a[href*="/blog/tag/"]');
  }

  get postContent() {
    return this.page.locator('[data-testid="post-content"]');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async getTagTexts(): Promise<string[]> {
    return this.tagLinks.allTextContents();
  }

  async clickBackLink() {
    await this.backLink.click();
    await this.page.waitForLoadState('networkidle');
  }
}
