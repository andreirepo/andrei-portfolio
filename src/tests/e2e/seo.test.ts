import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

const BASE_URL = 'http://localhost:4321';

/**
 * Discoverability E2E
 *
 * These guard the things a crawler or an answer engine depends on and that
 * nothing else in the suite would catch:
 *
 * - The Person node carries a contact address. It is escaped as \u0040 in the
 *   HTML so Cloudflare's email obfuscation leaves the block alone; if that
 *   escape is ever "tidied up", the address silently disappears.
 * - The share card declares real dimensions, so LinkedIn and Slack do not
 *   fetch a 1.1 MB image to work out how to crop it.
 * - hreflang matches the canonical exactly, including the trailing slash.
 * - llms.txt is served as text, not swallowed by the SPA catch-all.
 */

type JsonLd = Record<string, any>;

const jsonLdBlocks = async (page: Page): Promise<JsonLd[]> => {
  const raw = await page.$$eval('script[type="application/ld+json"]', (nodes) =>
    nodes.map((n) => n.textContent ?? ''),
  );
  return raw.map((text) => JSON.parse(text) as JsonLd);
};

const findNode = (blocks: JsonLd[], type: string): JsonLd | undefined => {
  for (const block of blocks) {
    if (block['@type'] === type) return block;
    const graph = block['@graph'];
    if (Array.isArray(graph)) {
      const hit = graph.find((n: JsonLd) => n['@type'] === type);
      if (hit) return hit;
    }
  }
  return undefined;
};

describe('Discoverability', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  describe('structured data', () => {
    it('exposes a Person with a contact address on the home page', async () => {
      await page.goto(`${BASE_URL}/en/`, { waitUntil: 'domcontentloaded' });
      const person = findNode(await jsonLdBlocks(page), 'Person');

      expect(person, 'Person node missing from JSON-LD').toBeTruthy();
      // Parsed from "contact\u0040andreirepo.com" — the escape is the point.
      expect(person!.email).toMatch(/^[^@\s]+@[^@\s]+$/);
      expect(person!.jobTitle).toBe('Senior QA Engineer');
      expect(person!.worksFor?.name).toBeTruthy();
      expect(person!.sameAs).toContain('https://github.com/andreirepo');
    });

    it('links the home page to the Person as a ProfilePage', async () => {
      await page.goto(`${BASE_URL}/en/`, { waitUntil: 'domcontentloaded' });
      const profile = findNode(await jsonLdBlocks(page), 'ProfilePage');

      expect(profile, 'ProfilePage node missing').toBeTruthy();
      expect(profile!.mainEntity?.['@id']).toContain('#person');
    });

    it('credits blog articles to the same Person by @id', async () => {
      await page.goto(`${BASE_URL}/en/blog/`, { waitUntil: 'domcontentloaded' });
      const link = await page.$eval(
        'a[href*="/blog/self-hosted-cloudflare-tunnel-traefik"]',
        (a) => a.getAttribute('href'),
      );
      await page.goto(`${BASE_URL}${link}`, { waitUntil: 'domcontentloaded' });

      const post = findNode(await jsonLdBlocks(page), 'BlogPosting');
      expect(post, 'BlogPosting node missing').toBeTruthy();
      expect(post!.author?.['@id']).toContain('#person');
      expect(post!.image).toMatch(/\.png$/);
    });
  });

  describe('social card', () => {
    it('declares a 1200x630 image with alt text', async () => {
      await page.goto(`${BASE_URL}/en/`, { waitUntil: 'domcontentloaded' });
      const meta = (name: string) =>
        page.$eval(`meta[property="${name}"]`, (m) => m.getAttribute('content')).catch(() => null);

      const width = await meta('og:image:width');
      const height = await meta('og:image:height');

      expect(width).toBe('1200');
      expect(height).toBe('630');
      expect(await meta('og:image:alt')).toBeTruthy();
      expect(await meta('og:image')).toMatch(/\.png$/);
    });
  });

  describe('language alternates', () => {
    it('emits hreflang that matches the canonical, slash included', async () => {
      await page.goto(`${BASE_URL}/en/`, { waitUntil: 'domcontentloaded' });

      const canonical = await page.$eval('link[rel="canonical"]', (l) => l.getAttribute('href'));
      const alternates = await page.$$eval('link[rel="alternate"][hreflang]', (links) =>
        links.map((l) => ({
          hreflang: l.getAttribute('hreflang'),
          href: l.getAttribute('href'),
        })),
      );

      const hreflangs = alternates.map((a) => a.hreflang);
      expect(hreflangs).toContain('x-default');

      const en = alternates.find((a) => a.hreflang === 'en');
      expect(en?.href).toBe(canonical);

      for (const alt of alternates) {
        expect(alt.href, `${alt.hreflang} does not end in a slash`).toMatch(/\/$/);
      }
    });
  });

  describe('llms.txt', () => {
    it('is served as plain text and names the role and contact address', async () => {
      const res = await fetch(`${BASE_URL}/llms.txt`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/plain');

      const body = await res.text();
      expect(body).toContain('Senior QA Engineer');
      expect(body).toMatch(/[\w.+-]+@andreirepo\.com/);
    });
  });
});
