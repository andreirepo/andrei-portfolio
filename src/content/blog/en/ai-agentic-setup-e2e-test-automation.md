---
title: "Building an AI Agent Layer for E2E Test Automation"
description: "How I structured a knowledge-driven AI agent setup using Cline that lets any developer generate, debug, and maintain E2E tests with minimal domain knowledge — by encoding team patterns into machine-readable files."
pubDate: 2026-05-20
author: "Andrei Repo"
tags: ["testing", "ai", "automation", "webdriverio", "typescript", "cline"]
draft: false
---

Writing E2E tests for a complex platform is slow — not because the code is hard, but because the knowledge is scattered. You need to know which API helpers exist, which page objects cover which flows, what the timing gotchas are, and how the fixture files are structured. That knowledge lives in people's heads, in Slack threads, and in code you have to read before you can write any.

I wanted to fix that. Not by writing better documentation, but by encoding team knowledge into structured, machine-readable files that an AI agent can actually use.

## The Core Problem

The test suite I was working with had grown to ~40 spec files, 35+ API helpers, and over a dozen distinct business flows — each with unique setup requirements, state dependencies, and UI interactions. Generating a new test for a feature meant:

1. Finding the right existing spec to use as a reference
2. Understanding which page objects and helpers were relevant
3. Knowing the fixture file format and what fields to sanitize
4. Remembering the timing gotchas that caused flakiness last time

An AI tool without this context would scan the entire codebase, make wrong assumptions, and produce code that needed heavy correction. The problem wasn't the AI — it was the missing context.

*Last updated November 2026. Originally published May 2026 — the rules-file landscape has moved since; see [Multi-Tool Consistency](#multi-tool-consistency).*

## The Building Blocks: Rules, Skills, and Memory

I use three layers to customize agent behavior:

**Rules** (`AGENTS.md`) — standing instructions: coding standards, naming conventions, what to never do. Always active.

This used to be a per-tool file: `.clinerules` for Cline, `.cursorrules` for Cursor, `.windsurfrules` for Windsurf. Keeping them in sync was its own chore, and both single-file formats are now legacy — Cursor and Windsurf both moved to directory-based rules. All of them, plus Kilo Code, GitHub Copilot and Codex, read `AGENTS.md` natively. One file, every tool.

**Skills** — modular instruction sets for specific tasks, stored as `SKILL.md` files under `.cline/skills/`. Invoked via slash commands (e.g., `/generate-test`) or auto-loaded on demand. Contains the full pipeline: what to read, what to check, when to stop and ask for approval.

**Memory files** — markdown files storing domain knowledge the agent carries between sessions. This one is a convention rather than a built-in feature: you point the rules and skills at the files, and the agent reads them. Unlike rules (instructions), memory files are facts: what this feature does, which helpers exist, what caused that flaky test last month.

---

Together, these three pieces turn a general-purpose AI tool into a team-aware agent that knows your codebase, follows your standards, and doesn't repeat the same mistakes.

## The Structure

Here's how these concepts map to a concrete folder layout:

```
AGENTS.md                             # Rules: always-on standards, read by every tool

.cline/
├── skills/
│   ├── generate-test/
│   │   └── SKILL.md                  # Skill: invoked via /generate-test
│   └── debug-test/
│       └── SKILL.md                  # Skill: invoked via /debug-test
├── knowledge/                        # Supporting files referenced by the skills
│   ├── feature-registry.md           # Intent-to-code mapping
│   └── troubleshooting.md            # Common failures & fixes
└── memory/
    ├── domain-a/
    │   ├── flows.md                  # UI flows, state diagrams, API sequences
    │   └── patterns.md               # Code templates, fixture patterns
    └── shared/
        ├── gotchas.md                # Known pitfalls with concrete fixes
        └── selectors.md              # Discovered selectors & coverage gaps
```

The key insight: none of this is documentation for humans. Every file is written with consistent headers, tables, and code blocks so an AI can parse and use it reliably.

## The Memory Files: Encoding What You Know

The `memory/` directory is where team knowledge lives. It captures three things that documentation usually misses:

**Flows** — not just "what does this feature do" but the exact UI sequence, which API calls happen in which order, and what state the app needs to be in before the test starts. This is the kind of thing a senior engineer knows after six months on the project.

**Patterns** — reusable code templates. The `setup.data.ts` structure, how fixture JSON variable substitution works, the step-by-step API creation flow. Instead of reading three existing specs to understand the pattern, the agent reads one file.

**Gotchas** — the stuff that causes flakiness. Each entry has a symptom, a root cause, and a concrete fix. Not just a description of the problem.

Here's what a gotcha entry looks like:

```markdown
## Toast Synchronization Race Condition

**Symptom**: `expect(toast.getText()).toBe('Success')` fails intermittently
**Root cause**: Text assertion runs before toast content is populated
**Fix**: Add `waitForElementToDisplay(toastSelector)` before text assertion
**Do not use**: `browser.pause()` — use explicit waits only
```

The memory grows over time. When you hit a new gotcha, you add it. When you discover a pattern, you document it.

The trick is making this stick. Treat updating `gotchas.md` as the last step of any defect resolution — the fix isn't complete until the symptom and resolution are in the context layer. Better yet, automate it: a `/log-gotcha` skill can read the git diff and append a formatted entry automatically. Documentation becomes a side effect of fixing the bug.

## The Feature Registry: Intent to Code

The feature registry is what makes short-prompt generation possible. It maps business intents to technical file paths, so the agent doesn't need to scan the codebase to find the right starting point:

```markdown
## Feature: User Checkout Flow

- Intent key: `flow:checkout`
- Variants: GUEST, AUTHENTICATED
- E2E Spec: e2e/specs/checkout/
- Setup: e2e/specs/checkout/setup.data.ts
- Fixtures: e2e/specs/checkout/fixtures/
- Key Pattern: Cart state must be seeded via API before UI interaction
- Memory reference: .cline/memory/domain-a/flows.md → Checkout section
```

With this in place, a prompt like `/generate-test TICKET-123 intent:flow:checkout` gives the agent everything it needs — file paths, relevant memory sections, and key patterns — before writing a single line. Without the registry, the agent searches 40+ spec files. With it, the lookup is instant.

## The Skills: Structured Pipelines as Slash Commands

This is the part that makes the system feel like an agent rather than a fancy autocomplete. Each skill's `SKILL.md` contains the full step-by-step pipeline — what to read first, what to check, when to stop and ask for approval. When you type `/generate-test` in Cline, it loads that skill and follows the process.

Here's a condensed version of what the `generate-test` SKILL.md looks like:

```markdown
---
name: generate-test
description: Generate an E2E test for a feature. Use when asked to write, create, or add a test for a ticket or feature.
---

# Generate E2E Test

## Step 1 — Context Load
Read only the feature registry first to resolve the intent key:
- `.cline/knowledge/feature-registry.md`

Once the intent key is resolved, load only the memory files for that specific domain:
- `.cline/memory/{resolved-domain}/flows.md`
- `.cline/memory/{resolved-domain}/patterns.md`
- `.cline/memory/shared/gotchas.md`

This keeps context lean — load what the task needs, not the entire memory bank.

## Step 2 — Discovery
- Resolve the intent key from the feature registry to get file paths
- Fetch the Jira ticket via MCP: get summary, description, and acceptance criteria
- Scan the target spec directory for existing helpers and page objects
- List what exists and what needs to be created

## Step 3 — Architect Review (STOP — wait for human approval)
Present a technical plan:
- Files to create vs reuse
- Page objects needed
- Helpers needed
- Estimated test structure

Do not generate any code until the user approves the plan.

## Step 4 — Generation
- Write the spec file adhering strictly to `AGENTS.md` and `.cline/memory/shared/gotchas.md`
- Run the local test execution command to verify passing status
- If the test fails, transition automatically to the `/debug-test` skill and rerun until passing
```

The `STOP — wait for human approval` in step 3 is the key safety valve. Without it, the agent will happily generate 10 files, half of which duplicate things that already exist. And step 4's automatic handoff to `/debug-test` on failure is what makes the whole thing feel agentic — one skill chains into another without you having to intervene.

**Debug Test** (`/debug-test`) follows the same pattern — analyze logs, generate hypotheses, apply fix, rerun. It cross-references `troubleshooting.md` and `gotchas.md` automatically. Most flaky test failures fall into a handful of known patterns — the skill finds them in seconds instead of minutes.

## MCP Integration: From Ticket to Test

With a Jira MCP server configured in Cline, the prompt becomes `/generate-test TICKET-123 intent:flow:checkout` and the agent reads acceptance criteria directly from Jira. The test is grounded in the actual requirement, not your summary of it.

This matters because the biggest source of test drift is when the ticket says one thing and the test verifies something slightly different. When the agent reads the acceptance criteria directly, that gap closes.

The same pattern works with Linear, GitHub Issues, or any tool that has an [MCP server](https://docs.cline.bot/mcp/mcp-overview). The memory files handle the *how* — patterns, gotchas, file paths. The MCP connection handles the *what* — what this specific ticket requires.

## Multi-Tool Consistency

This is the part I've changed my mind about.

The original advice was to keep `.clinerules` as the source of truth and copy it into each tool's format with a shell script. In practice that doesn't hold, for a boring reason: copies drift. I had exactly two copies of my rules, and within a couple of months they had diverged in six places, in both directions — one had lost a line the other kept, the other had picked up a hand-patched correction that never made it back. Nothing made them stay equal, so they didn't.

Two approaches remove the copy step entirely.

**Use the file every tool already reads.** `AGENTS.md` is an open format — plain markdown at the repo root, read natively by Cursor, Windsurf, Cline, Kilo Code, GitHub Copilot, Codex, opencode and a dozen others. There is no second format to maintain, so there is nothing to sync.

**Where a tool insists on its own filename, symlink it.** `ln -s AGENTS.md .clinerules` and the tool reads the same bytes. A symlink cannot go stale the way a copy can, because it *is* the same file. It's also what the [agents.md](https://agents.md/) migration guide recommends.

A copy script is still the right answer for one case: when two agents need genuinely different content. That's a real problem. It just isn't the same problem as keeping two files identical.

## What Actually Changed

| Task | Before | After |
|---|---|---|
| Generate a new test | 30–60 min | 10–15 min |
| Debug a flaky test | 20–40 min | 5–10 min |
| Agent needs to scan codebase | Yes (40+ files) | No (memory has the paths) |
| New team member ramp-up | Weeks | Days |
| Multi-tool rule consistency | Manual | Automated |

The time savings are real, but the bigger win is the floor. A developer who's never touched the test suite can generate a working test on their first day, because the memory files have the context they'd otherwise spend weeks accumulating.

## What I'd Do Differently

**Start earlier.** The most valuable entries are the gotchas — document them the moment you hit them, not retroactively.

**Version the memory files.** Adding `last_updated` frontmatter makes it easier to spot stale entries after framework upgrades.

**Make the debug skill domain-aware.** Check domain-specific failure patterns first — they're more likely to be the cause than generic troubleshooting steps.

The system isn't magic — it's structured context. The AI tools were already capable of generating good tests. What they were missing was the knowledge that experienced team members carry around in their heads. Rules, Skills, and memory files are just a way to write that knowledge down in a format machines can use.

If your test suite has grown to the point where onboarding takes weeks and flaky tests take hours to debug, the bottleneck probably isn't the AI tool. It's the missing context layer.

**See also:** [How I set up local AI code reviews on GitHub PRs](/en/blog/local-ai-code-review-github-actions-lm-studio) — the same self-hosted AI infrastructure, applied to pull requests instead of test generation.
