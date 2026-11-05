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
    await super.goto(`/${locale}/`);
  }

  // ── Hero ──────────────────────────────────────────────────────────────────

  get heroSection() {
    return this.page.locator('[data-testid="hero-section"]');
  }

  get heroHeading() {
    return this.page.locator('[data-testid="hero-heading"]');
  }

  /** The primary "contact" call to action. */
  get heroCtaEmail() {
    return this.page.locator('[data-testid="hero-cta-email"]');
  }

  /** Booking link: the lowest-friction way to reach him. */
  get heroCtaCal() {
    return this.page.locator('[data-testid="hero-cta-cal"]');
  }

  get projectImages() {
    return this.page.locator('[data-testid="projects-section"] img');
  }

  get evidenceSection() {
    return this.page.locator('[data-testid="evidence-section"]');
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
