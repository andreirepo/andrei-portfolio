---
title: "Fixing 40+ WCAG Contrast Violations with axe-core and Property-Based Testing"
description: "How I found, verified, and permanently prevented color contrast accessibility failures on this portfolio using axe-core, fast-check, and a CI pipeline that blocks regressions automatically."
pubDate: 2026-04-28
author: "Andrei Repo"
tags: ["accessibility", "testing", "axe-core", "ci-cd", "tailwindcss"]
draft: false
---

I received an automated accessibility report flagging a serious violation on this site: 40+ elements failing WCAG 2 AA color contrast requirements. The report was right. Every section heading, nav link, skill description, blog card, and footer text was rendered with `opacity-50` or `opacity-70` — a pattern that looks fine visually at a glance but fails the 4.5:1 contrast ratio threshold that WCAG requires for normal text.

This post covers how I approached it as a QA problem: explore the bug condition, write tests that prove it exists, fix it, then lock it down so it can't come back.

## The Bug Condition

The root cause was simple. The entire site used Tailwind's opacity utilities to create visual hierarchy:

```html
<!-- Nav link — looks muted, but fails contrast -->
<a class="opacity-50 hover:opacity-100">blog</a>

<!-- Skill description — small text + opacity = double failure -->
<p class="text-[0.88rem] opacity-50">Stable Web Flows</p>
```

`opacity-50` on dark text against a near-white background (`oklch(98.8%)`) produces roughly a 2.1:1 contrast ratio. WCAG 2 AA requires 4.5:1 for normal text and 3:1 for large text. Every single one of these elements was failing.

The formal bug condition:

```
isBugCondition(element):
  contrastRatio = computeContrastRatio(element.color, element.background)
  threshold = element.isLargeText ? 3.0 : 4.5
  return contrastRatio < threshold
```

## Exploring the Bug with axe-core

Before touching any code, I wrote an exploration test to confirm the bug exists and measure its scope. The test uses [axe-core](https://github.com/dequelabs/axe-core) via `axe-playwright` to audit the rendered pages:

```typescript
it('should find color-contrast violations on unfixed code', async () => {
  const page = await browser.newPage();
  await page.goto('http://localhost:4321/en', { waitUntil: 'networkidle' });

  await injectAxe(page);
  const violations = await getViolations(page);
  const contrastViolations = violations.filter(v => v.id === 'color-contrast');

  // EXPECTED: This test MUST FAIL on unfixed code — failure confirms the bug exists
  expect(contrastViolations.length).toBeGreaterThan(0);
});
```

The test ran and found **37 color-contrast violations** in light mode on `/en` alone. A property-based test using [fast-check](https://github.com/dubzzz/fast-check) confirmed the same across all route/theme combinations:

```typescript
await fc.assert(
  fc.asyncProperty(
    fc.constantFrom('/en', '/es'),
    fc.constantFrom('light', 'dark'),
    async (route, theme) => {
      // opacity-50 elements exist on every route and theme
      const count = await page.evaluate(() =>
        document.querySelectorAll('.opacity-50').length
      );
      expect(count).toBeGreaterThan(0);
    }
  )
);
```

Result: 30 elements with `opacity-50` and 6 with `opacity-70` across the entire site.

## The Fix: Semantic Color Tokens

The fix was to replace opacity-based dimming with explicit color tokens that meet contrast requirements. Instead of making text transparent, use a color that's inherently lower contrast but still passes WCAG.

I added a `--muted-foreground` CSS custom property to `global.css` (it was already there from the design token system) and replaced every `opacity-50`/`opacity-70` instance across all components:

```css
/* Before: opacity makes text fail contrast */
.opacity-50 { opacity: 0.5; }

/* After: explicit color that passes 4.5:1 */
--muted-foreground: oklch(52% 0.018 285); /* light mode */
--muted-foreground: oklch(62% 0.02 285);  /* dark mode */
```

The component changes were mechanical — find every `opacity-50` and replace with `text-muted-foreground`:

```html
<!-- Before -->
<h2 class="opacity-50 uppercase mb-6">Skills</h2>
<p class="text-[0.88rem] opacity-50">Stable Web Flows</p>

<!-- After -->
<h2 class="text-muted-foreground uppercase mb-6">Skills</h2>
<p class="text-sm text-muted-foreground">Stable Web Flows</p>
```

The green accent color (`text-green-500`) needed separate treatment. On a light background, `#22c55e` only achieves ~2.5:1 contrast. I replaced it with a CSS custom property that adapts per theme:

```css
:root {
  /* Dark enough for 4.5:1 on light background */
  --green-accent: oklch(48% 0.17 155);
}

.dark {
  /* Bright enough for 4.5:1 on dark background */
  --green-accent: oklch(72% 0.18 155);
}
```

## Verifying the Fix

After the fix, I re-ran the same exploration test. The assertions were now inverted — the test confirms the bug is *gone*:

```
[Light Mode /en] axe-core found 0 color-contrast violations ✓
[Dark Mode /en] axe-core found 0 color-contrast violations ✓
[Light Mode /es] axe-core found 0 color-contrast violations ✓
[Dark Mode /es] axe-core found 0 color-contrast violations ✓
```

Zero violations across all four route/theme combinations.

## Locking It Down: Regression Guard in CI

The most important part isn't the fix — it's making sure it stays fixed. I converted the exploration test into a regression guard and added it to the CI pipeline:

```typescript
describe('Regression Guard: No Opacity-Dimmed Text Elements', () => {
  it('should have zero color-contrast violations', async () => {
    await injectAxe(page);
    const violations = await getViolations(page);
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');
    expect(contrastViolations.length).toBe(0); // was toBeGreaterThan(0)
  });

  it('should have no opacity-50 elements in the DOM', async () => {
    const count = await page.evaluate(() =>
      document.querySelectorAll('.opacity-50').length
    );
    expect(count).toBe(0);
  });
});
```

The CI pipeline now has a dedicated `accessibility-audit` job that runs these tests against the built site on every PR. If anyone introduces `opacity-50` on a text element, the pipeline fails before the Docker image is built.

```yaml
accessibility-audit:
  needs: build-and-test
  steps:
    - name: Start preview server and run accessibility tests
      run: |
        pnpm preview --port 4321 &
        # wait for server...
        pnpm exec vitest --run \
          src/tests/accessibility-contrast-bug-condition.test.ts \
          src/tests/accessibility-full-audit.test.ts
```

## What I Learned

**Opacity is not a contrast-safe dimming strategy.** It reduces the effective contrast ratio proportionally. If your base text is 14:1 against the background, `opacity-50` drops it to ~7:1 — still passing. But if your base is 4.5:1 (the minimum), `opacity-50` drops it to ~2.25:1, which fails. The problem compounds with small font sizes.

**Semantic color tokens are the right tool.** A `text-muted-foreground` token that's defined to meet contrast requirements at the design system level is far more robust than per-element opacity tweaks. The token can be tuned once and applied everywhere.

**Property-based testing is useful for accessibility.** Generating all combinations of routes and themes with fast-check gave me confidence that the fix held across the entire surface area, not just the specific pages I manually checked.

**The exploration test pattern works well.** Writing a test that's *expected to fail* on broken code, then inverting it after the fix, gives you a test that's grounded in a real observed failure rather than a hypothetical one. It's harder to write a test that accidentally passes on broken code when you've seen it fail first.

The full fix touched 8 components and 3 pages, replaced 36 opacity-dimmed elements, and took the axe-core violation count from 37 to 0.

**See also:** [How the CI/CD pipeline deploys this site](/en/blog/self-hosted-cicd-github-actions-ssh-cloudflare) — the self-hosted runner that runs these accessibility checks on every PR.

