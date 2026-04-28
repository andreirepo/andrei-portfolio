import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * HomePage — page object for /[lang] using data-testid selectors.
 */
export class HomePage extends BasePage {
  constructor(page: Page, baseUrl?: string) {
    super(page, baseUrl);
  }

  async goto(locale: 'en' | 'es' = 'en') {
    await super.goto(`/${locale}`);
  }

  // ── Hero ──────────────────────────────────────────────────────────────────

  get heroSection() {
    return this.page.locator('[data-testid="hero-section"]');
  }

  get heroHeading() {
    return this.page.locator('[data-testid="hero-heading"]');
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  get skillsSection() {
    return this.page.locator('[data-testid="skills-section"]');
  }

  get experienceSection() {
    return this.page.locator('[data-testid="experience-section"]');
  }

  get blogSection() {
    return this.page.locator('[data-testid="latest-posts-section"]');
  }

  // ── Latest Posts ──────────────────────────────────────────────────────────

  get latestPostLinks() {
    return this.page.locator('[data-testid="latest-posts-section"] a[href*="/blog/"]');
  }

  get seeAllPostsLink() {
    return this.page.locator('[data-testid="see-all-posts-link"]');
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  get skillCards() {
    return this.page.locator('[data-testid="skill-card"]');
  }

  // ── Experience ────────────────────────────────────────────────────────────

  get experienceItems() {
    return this.page.locator('[data-testid="experience-item"]');
  }
}
