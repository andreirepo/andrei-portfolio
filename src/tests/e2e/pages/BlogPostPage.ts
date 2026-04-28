import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * BlogPostPage — page object for /[lang]/blog/[slug] (individual post).
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
    return this.page.locator('#back-link');
  }

  get postHeading() {
    return this.page.locator('main header h1');
  }

  get postDescription() {
    return this.page.locator('main header p');
  }

  get publishedDate() {
    return this.page.locator('main header time');
  }

  get tagLinks() {
    return this.page.locator('main header a[href*="/blog/tag/"]');
  }

  get postContent() {
    return this.page.locator('main .prose');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async getTagTexts(): Promise<string[]> {
    return this.tagLinks.allTextContents();
  }

  async clickBackLink() {
    await this.backLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickTag(tagText: string) {
    await this.page.locator('main header a[href*="/blog/tag/"]', { hasText: tagText }).click();
    await this.page.waitForLoadState('networkidle');
  }
}
