import type { Page } from 'playwright';
import { BasePage } from './BasePage.js';

/**
 * HomePage — page object for / (redirects to /en or /es) and /[lang] routes.
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
    return this.page.locator('section').first();
  }

  get heroHeading() {
    return this.page.locator('h1').first();
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  get projectsSection() {
    return this.page.locator('#projects, [id*="project"]').first();
  }

  get skillsSection() {
    return this.page.locator('#skills');
  }

  get experienceSection() {
    return this.page.locator('#experience, [id*="experienc"]').first();
  }

  get blogSection() {
    return this.page.locator('#blog');
  }

  get contactSection() {
    return this.page.locator('footer');
  }

  // ── Latest Posts ──────────────────────────────────────────────────────────

  get latestPostLinks() {
    return this.page.locator('#blog a[href*="/blog/"]');
  }

  get seeAllPostsLink() {
    return this.page.locator('#blog a[href$="/blog"]');
  }

  // ── Skills ────────────────────────────────────────────────────────────────

  get skillCards() {
    return this.page.locator('#skills article');
  }

  // ── Projects ─────────────────────────────────────────────────────────────

  get projectItems() {
    return this.page.locator('[id*="project"] li, [id*="proyect"] li');
  }

  // ── Experience ────────────────────────────────────────────────────────────

  get experienceItems() {
    return this.page.locator('[id*="experienc"] li');
  }
}
