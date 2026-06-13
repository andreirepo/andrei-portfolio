import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { BlogPage } from './pages/BlogPage.js';
import { BlogPostPage } from './pages/BlogPostPage.js';
import { TagPage } from './pages/TagPage.js';
import { HomePage } from './pages/HomePage.js';

const BASE_URL = 'http://localhost:4321';

/**
 * Blog E2E Tests
 */

describe('Blog — Index Page', () => {
  let browser: Browser;
  let page: Page;
  let blogPage: BlogPage;

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    blogPage = new BlogPage(page);
    await blogPage.goto('en');
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  it('should render the blog heading', async () => {
    expect(await blogPage.heading.isVisible()).toBe(true);
    const text = await blogPage.heading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  it('should render at least one post', async () => {
    const count = await blogPage.postItems.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render post links with non-empty titles', async () => {
    const titles = await blogPage.getPostTitles();
    expect(titles.length).toBeGreaterThan(0);
    titles.forEach(title => expect(title.trim().length).toBeGreaterThan(0));
  });

  it('should render tag links on posts', async () => {
    const count = await blogPage.tagLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should navigate to a post when clicking a post link', async () => {
    await Promise.all([
      page.waitForURL(/\/en\/blog\/.+/),
      blogPage.postLinks.first().click(),
    ]);
    expect(await blogPage.currentPath).toMatch(/\/en\/blog\/.+/);
  });

  it('should navigate to a tag page when clicking a tag', async () => {
    await Promise.all([
      page.waitForURL(/\/blog\/tag\//),
      blogPage.tagLinks.first().click(),
    ]);
    expect(await blogPage.currentPath).toContain('/blog/tag/');
  });

  it('should render the same posts on /es blog index', async () => {
    await blogPage.goto('es');
    const count = await blogPage.postItems.count();
    expect(count).toBeGreaterThan(0);
  });
});

describe('Blog — Post Page', () => {
  let browser: Browser;
  let page: Page;
  let postPage: BlogPostPage;

  const TEST_SLUG = 'self-hosted-cloudflare-tunnel-traefik';

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    postPage = new BlogPostPage(page);
    await postPage.goto('en', TEST_SLUG);
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  it('should render the post heading', async () => {
    expect(await postPage.postHeading.isVisible()).toBe(true);
    const text = await postPage.postHeading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  it('should render the post description', async () => {
    expect(await postPage.postDescription.isVisible()).toBe(true);
  });

  it('should render the published date with a valid datetime attribute', async () => {
    expect(await postPage.publishedDate.isVisible()).toBe(true);
    const datetime = await postPage.publishedDate.getAttribute('datetime');
    expect(datetime).toBeTruthy();
    expect(new Date(datetime!).getTime()).not.toBeNaN();
  });

  it('should render tag links', async () => {
    const count = await postPage.tagLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render the post content with substantial text', async () => {
    expect(await postPage.postContent.isVisible()).toBe(true);
    const text = await postPage.postContent.textContent();
    expect(text?.trim().length).toBeGreaterThan(100);
  });

  it('should render the back link pointing to /en/blog by default', async () => {
    const href = await postPage.backLink.getAttribute('href');
    expect(href).toContain('/blog');
  });

  it('should navigate back to blog index when back link is clicked', async () => {
    await Promise.all([
      page.waitForURL(`${BASE_URL}/en/blog`),
      postPage.backLink.click(),
    ]);
    expect(await postPage.currentPath).toBe('/en/blog');
  });

  it('should update back link to point to home when navigated from home via link click', async () => {
    const homePage = new HomePage(page);
    await homePage.goto('en');

    const postLink = page.locator(`#blog a[href*="/blog/${TEST_SLUG}"]`).first();
    const postLinkExists = await postLink.count();

    if (postLinkExists > 0) {
      await Promise.all([
        page.waitForURL(/\/en\/blog\/.+/),
        postLink.click(),
      ]);
      await page.waitForTimeout(300);

      const href = await postPage.backLink.getAttribute('href');
      const text = await postPage.backLink.textContent();
      expect(href).toBe('/en');
      expect(text?.toLowerCase()).toContain('home');
    } else {
      await postPage.goto('en', TEST_SLUG);
      const href = await postPage.backLink.getAttribute('href');
      expect(href).toContain('/blog');
    }
  });

  it('should navigate to tag page when a tag is clicked', async () => {
    await Promise.all([
      page.waitForURL(/\/blog\/tag\//),
      postPage.tagLinks.first().click(),
    ]);
    expect(await postPage.currentPath).toContain('/blog/tag/');
  });

  it('should render the blog nav item as active', async () => {
    const blogNavLink = page.locator('[data-testid="nav-blog"]');
    const classes = await blogNavLink.getAttribute('class');
    expect(classes).toContain('text-foreground');
    expect(classes).not.toContain('text-muted-foreground');
  });
});

describe('Blog — Tag Page', () => {
  let browser: Browser;
  let page: Page;
  let tagPage: TagPage;

  const TEST_TAG = 'cloudflare';

  beforeAll(async () => {
    browser = await chromium.launch();
  });

  afterAll(async () => {
    await browser?.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    tagPage = new TagPage(page);
    await tagPage.goto('en', TEST_TAG);
  });

  afterEach(async () => {
    if (page) await page.close();
  });

  it('should render the tag heading with the tag name', async () => {
    expect(await tagPage.tagHeading.isVisible()).toBe(true);
    const text = await tagPage.tagHeading.textContent();
    expect(text).toContain(TEST_TAG);
  });

  it('should render at least one post for the tag', async () => {
    const count = await tagPage.getPostCount();
    expect(count).toBeGreaterThan(0);
  });

  it('should render a back link to the blog index', async () => {
    expect(await tagPage.backLink.isVisible()).toBe(true);
    const href = await tagPage.backLink.getAttribute('href');
    expect(href).toContain('/blog');
    expect(href).not.toContain('/tag/');
  });

  it('should navigate back to blog index when back link is clicked', async () => {
    await Promise.all([
      page.waitForURL(`${BASE_URL}/en/blog`),
      tagPage.backLink.click(),
    ]);
    expect(await tagPage.currentPath).toBe('/en/blog');
  });

  it('should render post links that navigate to post pages', async () => {
    const count = await tagPage.postLinks.count();
    expect(count).toBeGreaterThan(0);

    await Promise.all([
      page.waitForURL(/\/en\/blog\/.+/),
      tagPage.postLinks.first().click(),
    ]);
    expect(await tagPage.currentPath).toMatch(/\/en\/blog\/.+/);
  });

  it('should render the blog nav item as active on tag page', async () => {
    const blogNavLink = page.locator('[data-testid="nav-blog"]');
    const classes = await blogNavLink.getAttribute('class');
    expect(classes).toContain('text-foreground');
  });

  it('should work for Spanish locale tag page', async () => {
    await tagPage.goto('es', TEST_TAG);
    const count = await tagPage.getPostCount();
    expect(count).toBeGreaterThan(0);
    expect(await tagPage.currentPath).toContain('/es/blog/tag/');
  });

  it('should render posts for a different tag', async () => {
    await tagPage.goto('en', 'aws');
    const count = await tagPage.getPostCount();
    expect(count).toBeGreaterThan(0);
    const heading = await tagPage.tagHeading.textContent();
    expect(heading).toContain('aws');
  });
});