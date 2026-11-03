# AGENTS.md

Single source of truth for AI agents working in this repo. Every tool we use
reads this file directly — Cline, Kilo Code, Cursor and Windsurf all support the
`AGENTS.md` format — so there is no second copy to keep in sync.

## Stack

- **Astro 5 (SSG).** Pure `.astro` components — no React/Vue/Svelte. Interactivity is vanilla `<script>`.
- **Tailwind CSS v4** via `@tailwindcss/vite`. Design tokens are oklch custom properties in `src/styles/global.css`.
- **TypeScript** strict. `@/` → repo root, `@src/` → `src/`.
- **pnpm**, Node 18+.

## Layout

```
src/pages/[lang]/           routes; [lang] is en or es
src/components/             .astro only
src/layouts/Layout.astro    single layout: head metadata, theme script, schema.org
src/content/blog/{en,es}/   markdown posts
src/lib/                    page-helpers.ts, utils.ts
src/styles/global.css       Tailwind import + design tokens
src/types.ts                LocaleSchema, derived from i18n/en.json
src/assets/                 background.png, profile.webp
src/tests/                  vitest: unit, accessibility (axe), e2e (playwright)
i18n/{en,es}.json           translations
```

## Commands

| | |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` | `astro-i18n-check --base en && astro build` |
| `pnpm test` | unit + accessibility |
| `pnpm test:a11y` | accessibility only |
| `pnpm test:e2e` | e2e, needs a server on :4321 |
| `pnpm check-sync` | i18n parity without a full build |

## Conventions

- All user-facing text goes through `t()`. Pass both key and value to components: `{ key: "hero.title", value: t("hero.title") }`.
- `i18n/en.json` is the base locale. `es.json` must match it exactly — the build fails otherwise.
- `getStaticPaths()` returns both `en` and `es`.
- Blog posts use the same filename in `blog/en/` and `blog/es/`.
- Dark mode is the `.dark` class on `<html>`, persisted in localStorage. The blocking theme script in `Layout.astro` must stay in `<head>`.
- Merge classes with `cn()` from `src/lib/utils.ts`.
- Tests run on **Vitest, not Playwright Test** — use `.count()` / `.isVisible()`, not Playwright's `expect` matchers.

## Hard rules

1. **`--amber-accent` is decorative only.** Against the light background it measures **2.83:1** — below the 3:1 needed for non-text graphics and well below 4.5:1 for text. Use `--amber-text` for anything that must be read; keep `--amber-accent` for borders, tints and backgrounds.

2. **axe cannot measure contrast on this site.** `body` carries a five-layer gradient, so `color-contrast` returns *incomplete* for every element — a green run proves nothing. `src/tests/accessibility-full-audit.test.ts` neutralises the gradient and the scroll-reveal animations before auditing. Keep that; without it the suite cannot fail.

3. **A scroll-reveal `animation-range` must end on `entry`, not `cover`.** `cover` never completes for the last section on a page, stranding it at partial opacity.

4. **Tailwind v4 writes `scale-x-*` to the `scale` property,** not `transform`. A `transform: scaleX()` override silently loses.

5. **No client-side frameworks.** Vanilla `<script>` only.

6. **pnpm 11 removed `ignoredBuiltDependencies`** — the key is `allowBuilds`. If install warns about ignored build scripts, that is the fix.

## Deploy

Push to `main` → GitHub Actions: build → Docker image → GHCR → SSH deploy → health check → Cloudflare cache purge → auto-rollback on failure.

nginx serves `/usr/share/nginx/html` with a strict CSP. Any new third-party origin must be added there, or the browser blocks it.
