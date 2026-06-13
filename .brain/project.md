# Project Overview: Andrei Portfolio

## Tech Stack
- **Framework:** Astro 5 (SSG) — all pages are `.astro` files, no React/Vue/Svelte
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite` plugin. Design tokens use oklch CSS variables in `src/styles/global.css`
- **Language:** TypeScript (strict). Path aliases: `@/` maps to project root, `@src/` maps to `src/`
- **Package Manager:** pnpm (lockfile: `pnpm-lock.yaml`)
- **Node:** 18+

## File Organization
```
src/
├── pages/[lang]/          # Route pages. [lang] = en | es
├── components/            # Astro-only components (.astro). No JS frameworks
├── layouts/Layout.astro   # Single layout with <head> metadata, theme script, schema.org
├── content/blog/{en,es}/  # Blog posts as Markdown (.md)
├── content.config.ts      # Astro content collection schema (Zod)
├── lib/                   # Shared TS helpers (page-helpers.ts, utils.ts)
├── styles/global.css      # Tailwind import and CSS variable design tokens
├── types.ts               # LocaleSchema type (derived from i18n/en.json)
├── assets/                # Static assets imported by components (background.png)
└── tests/                 # Vitest unit + accessibility + E2E (Playwright)
i18n/
├── en.json                # English translations (BASE locale — source of truth)
└── es.json                # Spanish translations (must stay in sync with en.json)
```

## Code Style & Conventions
- **Components are pure Astro** — no client-side JS frameworks. Use `<script>` tags for vanilla JS interactivity only
- **i18n is mandatory** — all user-facing text must go through `useI18n()` / `t()` from `@ariaskit/astro-i18n`
- **i18n key-value pattern** — when passing i18n data to components, always pass both the key and translated value: `{ key: "hero.title", value: t("hero.title") }`
- **EN is the base locale** — `i18n/en.json` is the source of truth. The `LocaleSchema` type is derived from it
- **Design tokens** — use Tailwind classes mapped to CSS variables (e.g., `bg-background`, `text-foreground`, `border-border`). Define new tokens in `global.css` under `:root` and `.dark`
- **Class merging** — use `clsx` + `tailwind-merge` via the `cn()` utility in `src/lib/utils.ts`
- **Dark mode** — uses `.dark` class on `<html>` (not `prefers-color-scheme`). Theme persists in localStorage. The blocking theme script in `Layout.astro` prevents FOUC

## Internationalization (i18n)
- Locales: `en` and `es`
- **Always keep `i18n/en.json` and `i18n/es.json` in sync** — same keys, same structure
- Run `pnpm check-sync` (or `astro-i18n-check --base en`) to validate locale parity
- Routes: `/{lang}/...` (e.g., `/en/blog`, `/es/blog`)
- `getStaticPaths()` must return both `{ lang: "en" }` and `{ lang: "es" }`
- Alternate hreflang links must be included for SEO on every page

## Content (Blog)
- Blog posts live in `src/content/blog/{en,es}/` as Markdown files
- Same filename in both language directories for corresponding translations
- Frontmatter schema (defined in `src/content.config.ts`):
  ```yaml
  title: string
  description: string
  pubDate: date (coerced)
  tags: string[] (optional, defaults to [])
  draft: boolean (optional, defaults to false)
  ```
- Posts support tags — tag pages are generated at `/{lang}/blog/tag/{tag}`

## Testing
- **Runner:** Vitest (NOT Playwright Test) with `globals: true`, 60s timeout
- **E2E:** Playwright browser automation run through Vitest. Uses **Page Object Model** in `src/tests/e2e/pages/`
- **Accessibility:** axe-core via `@axe-core/playwright` and `axe-playwright`. Property-based testing with `fast-check`
- **Commands:**
  - `pnpm test` — all unit/accessibility tests
  - `pnpm test:e2e` — E2E tests only (requires dev server running)
  - `pnpm test:a11y` — accessibility tests only
- E2E tests use `.count()` and `.isVisible()` (NOT Playwright's `expect` matchers) since the runner is Vitest

## Build & Deploy
- **Build command:** `pnpm build` (runs `astro-i18n-check --base en && astro build`)
- **Docker:** Multi-stage — Node 18 alpine builder → nginx:alpine production. Static output in `dist/`
- **nginx:** Serves from `/usr/share/nginx/html`, root `/` → `/en/index.html`, security headers, gzip, caching
- **CI/CD:** GitHub Actions on push to `main` → build → Docker push to GHCR → SSH deploy → health check → Cloudflare cache purge → auto-rollback on failure

## Critical Warnings
1. **Never skip the i18n check** — `astro-i18n-check --base en` runs before every build. If `es.json` keys drift from `en.json`, the build fails
2. **WCAG contrast compliance** — all color combinations must meet 4.5:1 contrast ratio. The `--green-accent` tokens are carefully tuned for both light and dark themes (Note: Currently using Amber accent as primary theme color)
3. **No client-side framework imports** — do not add React, Vue, or Svelte components. Keep everything as `.astro` files with vanilla `<script>` tags
4. **Theme FOUC prevention** — the inline blocking script in `Layout.astro` must remain in the `<head>` before any rendering
5. **Content must be bilingual** — when adding a new blog post, create it in BOTH `src/content/blog/en/` and `src/content/blog/es/`

## Recent UI Refinements (Amber Theme)
- Unified hover effects for primary links (GitHub, Live Demo, Navigation) using Amber accent background shift.
- Subtle hover effects for content cards (BlogCards) using muted backgrounds with Amber accents for borders and text highlights.
- Consistent tag styling in BlogCard using Amber accents.
- Balanced visual hierarchy in Experience section by moving dates to `text-muted-foreground`.