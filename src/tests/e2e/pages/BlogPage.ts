import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * BlogPage — page object for /[lang]/blog using data-testid selectors.
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
    return this.page.locator('[data-testid="blog-index-heading"]');
  }

  get postList() {
    return this.page.locator('[data-testid="blog-post-list"]');
  }

  get postItems() {
    return this.page.locator('[data-testid="blog-post-list"] li');
  }

  get postLinks() {
    // Card links — the outer <a> wrapping each card (not tag links)
    return this.page.locator('[data-testid="blog-post-list"] li > a');
  }

  get tagLinks() {
    return this.page.locator('[data-testid="blog-post-list"] a[href*="/blog/tag/"]');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async getPostTitles(): Promise<string[]> {
    // Get the title text from each card's <p> heading inside the post link
    const titles = await this.page
      .locator('[data-testid="blog-post-list"] li > a p:first-child')
      .allTextContents();
    return titles;
  }
}
