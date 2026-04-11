---
title: "5 Test Automation Tips I Wish I Knew Earlier"
description: "Hard-won lessons from years of writing end-to-end tests with Playwright and Cypress — from flaky tests to maintainable selectors."
pubDate: 2025-02-10
tags: ["playwright", "cypress", "automation", "testing"]
---

# 5 Test Automation Tips I Wish I Knew Earlier

After years of writing end-to-end tests across multiple companies and frameworks, here are the five things I wish someone had told me at the start.

## 1. Use data-testid attributes, not CSS classes

CSS classes change. Layout changes. But a `data-testid="submit-button"` attribute is a contract between your test and your UI. Make it explicit.

```html
<button data-testid="submit-button">Submit</button>
```

```ts
await page.getByTestId('submit-button').click();
```

## 2. Avoid arbitrary waits

`await page.waitForTimeout(2000)` is a code smell. Use `waitForSelector`, `waitForResponse`, or Playwright's auto-waiting instead. Your tests will be faster and more reliable.

## 3. Keep tests independent

Each test should set up its own state and clean up after itself. Tests that depend on execution order are a maintenance nightmare.

## 4. Test the happy path first, then edge cases

Get the core flow working and stable before adding error scenarios. A flaky happy-path test undermines confidence in everything else.

## 5. Treat test code like production code

Review it, refactor it, and document it. Tests that nobody understands don't get maintained — and unmaintained tests get deleted.

---

What tips would you add? I'm always looking to improve.
