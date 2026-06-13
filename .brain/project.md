# Andrei Portfolio — Project Brain (Agent Context)

This file provides comprehensive context about the project for AI agents working on the codebase.

---

## 1. Project Purpose

Personal portfolio website for Andrei Repo, a Senior QA Engineer specializing in highly regulated iGaming. The site is live at **https://andreirepo.com**. It showcases professional experience, skills, projects, and a bilingual technical blog.

---

## 2. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Astro (SSG) | v5.17 |
| Styling | Tailwind CSS | v4.1 |
| Styling Plugin | @tailwindcss/vite | v4.1 |
| i18n | @ariaskit/astro-i18n | ^0.0.8 |
| Icons | @lucide/astro | ^0.563.0 |
| Utilities | clsx + tailwind-merge | latest |
| Package Manager | pnpm | - |
| Node.js | 18+ | - |
| Build/Deploy | Docker (Node 18 alpine → nginx:alpine) | - |
| Reverse Proxy | Traefik | behind Cloudflare |
| Analytics | Umami (self-hosted) | - |
| Sitemap | @astrojs/sitemap | ^3.7.0 |

### Dev Dependencies
- **Test Runner:** Vitest v4.1 (NOT Playwright Test)
- **Browser Automation:** Playwright v1.59
- **Accessibility:** @axe-core/playwright v4.11, axe-playwright v2.2
- **Property-Based Testing:** fast-check v4.7
- **Test UI:** @vitest/ui v4.1

---

## 3. Architecture

### Routing
File-based routing with `[lang]` dynamic segment for i18n:

```
src/pages/
├── 404.astro                              # Custom 404
├── index.astro                            # Root page
└── [lang]/
    ├── index.astro                        # Home (hero, projects, posts, experience)
    └── blog/
        ├── index.astro                    # Blog listing
        ├── [slug].astro                   # Single blog post
        └── tag/
            └── [tag].astro                # Posts filtered by tag
```

All pages must implement `getStaticPaths()` returning both `{ lang: "en" }` and `{ lang: "es" }`.

### Components (Pure Astro — NO JS Frameworks)
```
src/components/
├── Header.astro         # Nav bar, locale switcher, theme toggle, resume button
├── Hero.astro           # Name, title, bio paragraphs
├── Projects.astro       # Project showcase cards
├── Experience.astro     # Work history timeline
├── LatestPosts.astro    # Latest blog posts grid on home page
├── BlogCard.astro       # Individual blog post card
├── Footer.astro         # Contact section with social links
├── Skills.astro         # Skills matrix (not currently on home page)
└── hybrid-astro-ui/
    └── page-metadata/   # <head> meta tags (OG, favicons, hreflang, client router)
```

### Layout
Single layout: `src/layouts/Layout.astro`
- Contains: blocking theme script (prevents FOUC), PageMetadata component, Schema.org structured data (Person type), Umami analytics, skip-to-content link, scroll-to-top button
- Props: title, description, locale, alternateLinks, ogType, schema

### Content (Blog)
- Markdown files in `src/content/blog/{en,es}/`
- Same filename in both language directories for corresponding translations
- Content collection defined in `src/content.config.ts` with Zod schema:
  ```yaml
  title: string
  description: string
  pubDate: date (coerced)
  tags: string[] (optional, defaults to [])
  draft: boolean (optional, defaults to false)
  ```
- Tag pages generated at `/{lang}/blog/tag/{tag}`

### Current Blog Posts (6 articles)
1. `ai-agentic-setup-e2e-test-automation` — AI-agentic E2E test automation
2. `email-forwarding-aws-ses-s3-lambda` — Email forwarding with AWS SES/S3/Lambda
3. `fixing-wcag-contrast-with-axe-core-and-property-based-testing` — WCAG contrast testing
4. `local-ai-code-review-github-actions-lm-studio` — Local AI code review
5. `self-hosted-cicd-github-actions-ssh-cloudflare` — Self-hosted CI/CD
6. `self-hosted-cloudflare-tunnel-traefik` — Cloudflare Tunnel with Traefik

### Lib Helpers
- `src/lib/page-helpers.ts` — `buildNav(t, locale, isHome)`, `buildFooter(t)` — constructs nav/footer data from i18n translations
- `src/lib/utils.ts` — `cn()` utility (clsx + tailwind-merge for class merging)

### Types
- `src/types.ts` — `LocaleSchema` derived from `i18n/en.json` (the base locale)

---

## 4. Design System

### Color Tokens (src/styles/global.css)
Uses oklch color space for perceptually uniform colors. Tokens defined under `:root` (light) and `.dark` (dark).

**Light theme:** warm white background, dark foreground, blue-purple primary
**Dark theme:** very dark background, light foreground, brighter primary

Key tokens:
- `--background` / `--foreground` — page colors
- `--primary` / `--primary-foreground` — primary action colors
- `--secondary` / `--secondary-foreground` — secondary elements
- `--muted` / `--muted-foreground` — subtle/de-emphasized content
- `--accent` / `--accent-foreground` — accent highlights
- `--border` / `--input` / `--ring` — borders and form elements
- `--destructive` / `--destructive-foreground` — error/danger states
- `--green-accent` / `--green-accent-bg` / `--green-accent-bg-hover` — brand green, carefully tuned for WCAG 4.5:1 contrast

### Tailwind Integration
`@theme inline` block maps CSS variables to Tailwind utility classes. Use classes like `bg-background`, `text-foreground`, `border-border`, `text-green-accent`.

### Dark Mode
- `.dark` class on `<html>` (not `prefers-color-scheme`)
- Custom variant: `@custom-variant dark (&:is(.dark *));`
- Theme persisted in `localStorage`
- Inline blocking script in `Layout.astro` `<head>` prevents FOUC

### Typography
- Monospace font: `font-mono` on body
- Smooth scrolling: `scroll-behavior: smooth` on `<html>`

---

## 5. Internationalization

### Structure
- `i18n/en.json` — English (BASE locale, source of truth)
- `i18n/es.json` — Spanish (must stay in sync)
- `src/types.ts` — `LocaleSchema = typeof en.json` for type safety

### i18n Pattern
```typescript
const { t, locale } = useI18n<LocaleSchema>({ ssg: { astro: Astro } });
// Usage: t("hero.title") returns translated string
// For components, pass both key and value:
{ key: "hero.title", value: t("hero.title") }
```

### i18n Key Structure
- `nav.*` — navigation labels
- `hero.*` — hero section content
- `projects.*` — project descriptions
- `experience.*` — work history
- `skills.*` — skill cards
- `contact.*` — contact/footer section
- `blog.*` — blog UI labels
- `description` — meta description

### Validation
Run `pnpm check-sync` or `astro-i18n-check --base en` to ensure locale parity. This runs automatically before `pnpm build`.

---

## 6. Testing

### Configuration
- Vitest config: `vitest.config.ts` — globals: true, environment: node, 60s timeout
- Tests run under Vitest (NOT Playwright Test)

### E2E Tests (src/tests/e2e/)
Uses **Page Object Model** pattern:
- `pages/BasePage.ts` — base page object
- `pages/HomePage.ts` — home page interactions
- `pages/BlogPage.ts` — blog listing
- `pages/BlogPostPage.ts` — single blog post
- `pages/TagPage.ts` — tag filter page

Test files:
- `navigation.test.ts` — header, theme toggle, locale switching, sections, footer
- `blog.test.ts` — blog listing, post rendering, tag filtering

**Important:** Since Vitest is the runner (not Playwright Test), use `.count()` and `.isVisible()` instead of Playwright's `expect` matchers like `toBeVisible()`.

### Accessibility Tests (src/tests/)
- `accessibility-contrast-bug-condition.test.ts` — specific contrast bug conditions
- `accessibility-contrast-preservation.test.ts` — contrast ratio preservation
- `accessibility-full-audit.test.ts` — full axe-core WCAG audit
- Uses `fast-check` for property-based testing

### Commands
```bash
pnpm test          # all tests
pnpm test:e2e      # E2E only (requires dev server)
pnpm test:a11y     # accessibility only
```

---

## 7. Build & Deployment

### Build Pipeline
```bash
pnpm build  # runs: astro-i18n-check --base en && astro build
```

### Docker
Multi-stage Dockerfile:
1. **Builder stage:** Node 18 alpine, installs pnpm, runs `pnpm build`
2. **Production stage:** nginx:alpine, copies built files to `/usr/share/nginx/html`
- Health check: `curl -f http://localhost/`
- Runs as `nginx` user

### nginx Configuration
- Root `/` → `/en/index.html` (English default)
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Gzip compression enabled
- Static assets cached for 1 year (immutable)
- HTML cached for 1 hour
- `/health` endpoint returns 200 "healthy"
- Hidden files denied

### CI/CD (GitHub Actions)
On push to `main`:
1. Build and type-check
2. Build Docker image, push to GHCR
3. SSH to production server, run `docker compose up`
4. Health check via external endpoint
5. Cloudflare cache purge
6. Auto-rollback on health check failure

### Required Secrets
- `SSH_PRIVATE_KEY`, `SERVER_USER`, `SERVER_HOST`
- `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_API_TOKEN`

---

## 8. SEO & Structured Data

- `@astrojs/sitemap` integration for automatic sitemap
- Schema.org Person structured data in Layout.astro
- Open Graph meta tags via PageMetadata component
- Alternate hreflang links for EN/ES on every page
- `robots.txt` in public/
- `site.webmanifest` for PWA hints

---

## 9. Critical Warnings

1. **Never skip i18n check** — build will fail if `es.json` drifts from `en.json`
2. **WCAG contrast compliance** — all color combos must meet 4.5:1 ratio; green-accent tokens are carefully tuned
3. **No client-side frameworks** — no React, Vue, Svelte. Only `.astro` files with vanilla `<script>` tags
4. **Theme FOUC prevention** — blocking script in `Layout.astro` `<head>` must stay before any rendering
5. **Bilingual content** — new blog posts must be created in both `en/` and `es/` directories

---

## 10. Git Remote

- **Remote:** `origin: https://github.com/andreirepo/andrei-portfolio.git`
- **Latest commit:** `da18a745b591efa81d4efce69aaac5094f52a871`