import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import { BlogPage } from './pages/BlogPage.js';
import { BlogPostPage } from './pages/BlogPostPage.js';
import { TagPage } from './pages/TagPage.js';
import { HomePage } from './pages/HomePage.js';

/**
 * Blog E2E Tests
 *
 * Covers critical blog user journeys:
 * - Blog index renders posts with titles, descriptions, dates, and tags
 * - Clicking a post navigates to the correct post page
 * - Blog post page renders heading, date, tags, and content
 * - Back link navigates to blog index
 * - Back link navigates to home when referred from home
 * - Tag links navigate to the correct tag page
 * - Tag page shows correct posts and highlights the active tag
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
    await page.close();
  });

  it('should render the blog heading', async () => {
    await expect(blogPage.heading).toBeVisible();
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
    await blogPage.clickFirstPost();
    const path = await blogPage.currentPath;
    expect(path).toMatch(/\/en\/blog\/.+/);
  });

  it('should navigate to a tag page when clicking a tag', async () => {
    const firstTagText = await blogPage.tagLinks.first().textContent();
    await blogPage.tagLinks.first().click();
    await page.waitForLoadState('networkidle');
    const path = await blogPage.currentPath;
    expect(path).toContain('/blog/tag/');
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

  // Use a known slug from the blog content
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
    await page.close();
  });

  it('should render the post heading', async () => {
    await expect(postPage.postHeading).toBeVisible();
    const text = await postPage.postHeading.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  it('should render the post description', async () => {
    await expect(postPage.postDescription).toBeVisible();
  });

  it('should render the published date', async () => {
    await expect(postPage.publishedDate).toBeVisible();
    const datetime = await postPage.publishedDate.getAttribute('datetime');
    expect(datetime).toBeTruthy();
    // Should be a valid ISO date string
    expect(new Date(datetime!).getTime()).not.toBeNaN();
  });

  it('should render tag links', async () => {
    const count = await postPage.tagLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  it('should render the post content', async () => {
    await expect(postPage.postContent).toBeVisible();
    const text = await postPage.postContent.textContent();
    expect(text?.trim().length).toBeGreaterThan(100);
  });

  it('should render the back link pointing to /en/blog', async () => {
    const href = await postPage.backLink.getAttribute('href');
    expect(href).toContain('/blog');
  });

  it('should navigate back to blog index when back link is clicked', async () => {
    await postPage.clickBackLink();
    const path = await postPage.currentPath;
    expect(path).toBe('/en/blog');
  });

  it('should update back link to "back to home" when referred from home page', async () => {
    // Navigate from home to the post to set the referrer
    const homePage = new HomePage(page);
    await homePage.goto('en');
    await page.goto(`http://localhost:4321/en/blog/${TEST_SLUG}`, { waitUntil: 'networkidle' });

    // Wait for the script to run and potentially update the link
    await page.waitForTimeout(300);

    const href = await postPage.backLink.getAttribute('href');
    const text = await postPage.backLink.textContent();

    // When coming from home, the link should point to /en
    expect(href).toBe('/en');
    expect(text).toContain('home');
  });

  it('should navigate to tag page when a tag is clicked', async () => {
    const tags = await postPage.getTagTexts();
    expect(tags.length).toBeGreaterThan(0);

    await postPage.tagLinks.first().click();
    await page.waitForLoadState('networkidle');

    const path = await postPage.currentPath;
    expect(path).toContain('/blog/tag/');
  });

  it('should render the blog nav item as active', async () => {
    // The blog nav item should have text-foreground class (active state)
    const blogNavLink = page.locator('header nav a[href="/en/blog"]');
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
    await page.close();
  });

  it('should render the tag heading with the tag name', async () => {
    await expect(tagPage.tagHeading).toBeVisible();
    const text = await tagPage.tagHeading.textContent();
    expect(text).toContain(TEST_TAG);
  });

  it('should render at least one post for the tag', async () => {
    const count = await tagPage.getPostCount();
    expect(count).toBeGreaterThan(0);
  });

  it('should render a back link to the blog index', async () => {
    await expect(tagPage.backLink).toBeVisible();
    const href = await tagPage.backLink.getAttribute('href');
    expect(href).toContain('/blog');
    expect(href).not.toContain('/tag/');
  });

  it('should navigate back to blog index when back link is clicked', async () => {
    await tagPage.clickBackLink();
    const path = await tagPage.currentPath;
    expect(path).toBe('/en/blog');
  });

  it('should render post links that navigate to post pages', async () => {
    const count = await tagPage.postLinks.count();
    expect(count).toBeGreaterThan(0);

    await tagPage.postLinks.first().click();
    await page.waitForLoadState('networkidle');

    const path = await tagPage.currentPath;
    expect(path).toMatch(/\/en\/blog\/.+/);
  });

  it('should render the blog nav item as active on tag page', async () => {
    const blogNavLink = page.locator('header nav a[href="/en/blog"]');
    const classes = await blogNavLink.getAttribute('class');
    expect(classes).toContain('text-foreground');
  });

  it('should work for Spanish locale tag page', async () => {
    await tagPage.goto('es', TEST_TAG);
    const count = await tagPage.getPostCount();
    expect(count).toBeGreaterThan(0);
    const path = await tagPage.currentPath;
    expect(path).toContain('/es/blog/tag/');
  });

  it('should render posts for a different tag', async () => {
    await tagPage.goto('en', 'aws');
    const count = await tagPage.getPostCount();
    expect(count).toBeGreaterThan(0);
    const heading = await tagPage.tagHeading.textContent();
    expect(heading).toContain('aws');
  });
});
