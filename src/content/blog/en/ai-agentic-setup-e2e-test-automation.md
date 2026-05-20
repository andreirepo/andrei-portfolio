---
title: "Building an AI Agent Layer for E2E Test Automation"
description: "How I structured a knowledge-driven AI agent setup using Cline that lets any developer generate, debug, and maintain E2E tests with minimal domain knowledge — by encoding team patterns into machine-readable files."
pubDate: 2026-05-20
tags: ["testing", "ai", "automation", "webdriverio", "typescript", "cline"]
draft: false
---

Writing E2E tests for a complex platform is slow — not because the code is hard, but because the knowledge is scattered. You need to know which API helpers exist, which page objects cover which flows, what the timing gotchas are, and how the fixture files are structured. That knowledge lives in people's heads, in Slack threads, and in code you have to read before you can write any.

I wanted to fix that. Not by writing better documentation, but by encoding team knowledge into structured, machine-readable files that an AI agent can actually use.

## A Quick Word on AI Coding Tools

If you're new to AI-assisted development, here's the landscape in brief. Tools like [Cline](https://cline.bot), [Cursor](https://cursor.sh), [Windsurf](https://windsurf.ai), and GitHub Copilot all let an AI agent read your codebase and generate code alongside you. The key difference from a basic chatbot is that these tools can read files, run commands, and take multi-step actions in your project.

**Cline** is the tool this setup is built around. It's an open-source VS Code extension that gives you full control over which AI model you use, and it has a native system for Rules and Skills — the building blocks of the setup described here. The same concepts apply to other tools, but the file names and invocation syntax differ slightly.

## The Core Problem

The test suite I was working with had grown to ~40 spec files, 35+ API helpers, and over a dozen distinct business flows — each with unique setup requirements, state dependencies, and UI interactions. Generating a new test for a feature meant:

1. Finding the right existing spec to use as a reference
2. Understanding which page objects and helpers were relevant
3. Knowing the fixture file format and what fields to sanitize
4. Remembering the timing gotchas that caused flakiness last time

An AI tool without this context would scan the entire codebase, make wrong assumptions, and produce code that needed heavy correction. The problem wasn't the AI — it was the missing context.

## The Building Blocks: Rules, Skills, and Memory

Before getting into the structure, it helps to understand what each piece actually does. Cline has three native concepts for customizing agent behavior:

**[Rules](https://docs.cline.bot/customization/cline-rules)** (`.clinerules`) — a markdown file at the root of your project that Cline reads on every task. Think of it as the standing instructions: coding standards, naming conventions, what to never do. Every AI tool has an equivalent: `.cursorrules` for Cursor, `.windsurfrules` for Windsurf, `CLAUDE.md` for Claude Code, `copilot-instructions.md` for GitHub Copilot.

**[Skills](https://docs.cline.bot/customization/skills)** — modular instruction sets for specific tasks, each stored as a `SKILL.md` file inside a named directory under `.cline/skills/`. A skill is invoked via a slash command (e.g., `/generate-test`) or auto-loaded when Cline detects it's relevant based on the skill's description. The `SKILL.md` contains everything: the step-by-step process, what files to read, when to stop and ask for approval, what to do if something fails. The difference from a rule is scope: rules are always active, skills are loaded on demand.

**[Memory files](https://docs.cline.bot/best-practices/memory-bank)** (the "brain") — markdown files that store domain knowledge the agent should carry between sessions. Unlike rules (which are instructions), memory files are facts: what this feature does, which helpers exist, what caused that flaky test last month. You write and maintain these files — they're not auto-generated. The agent reads them at the start of a task to get up to speed instantly.

---

Together, these three pieces turn a general-purpose AI tool into a team-aware agent that knows your codebase, follows your standards, and doesn't repeat the same mistakes.

## The Structure

Here's how these concepts map to a concrete folder layout:

```
.clinerules                           # Rules: always-on coding standards for Cline

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

One way to make this stick: treat updating `gotchas.md` as the last step of any defect resolution. If a test flaked in CI and a developer spent two hours tracking it down, the fix isn't complete until the symptom and resolution are in the context layer. That reframes the memory bank from a maintenance chore into a natural byproduct of the work you're already doing.

**Where to start:** `gotchas.md` is the easiest entry point. Open it, write down the last three things that caused a flaky test, and add a concrete fix for each. That alone will save the next person (or the next AI session) hours.

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

With this in place, a prompt like `/generate-test TICKET-123 intent:flow:checkout` gives the agent everything it needs. It knows the file paths, the relevant memory sections, and the key patterns before writing a single line.

Without the registry, the agent would need to search 40+ spec files to understand the checkout pattern. With it, the lookup is instant.

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
Read the following files before doing anything else:
- `.cline/memory/{team}/flows.md`
- `.cline/memory/{team}/patterns.md`
- `.cline/memory/shared/gotchas.md`
- `.cline/knowledge/feature-registry.md`

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
- Write the spec file adhering strictly to `.clinerules` and `.cline/memory/shared/gotchas.md`
- Run the local test execution command to verify passing status
- If the test fails, transition automatically to the `/debug-test` skill and rerun until passing
```

The `STOP — wait for human approval` in step 3 is the key safety valve. Without it, the agent will happily generate 10 files, half of which duplicate things that already exist. And step 4's automatic handoff to `/debug-test` on failure is what makes the whole thing feel agentic — one skill chains into another without you having to intervene.

**Debug Test** (`/debug-test`) follows the same pattern — a skill with a 4-step pipeline in its SKILL.md:

1. Analyze logs, screenshots, and environment state
2. Generate hypotheses (selector issue? timing? data? environment?)
3. Apply fix, rerun, verify it's not flaky
4. Run regression check, clean up

The debug skill cross-references `troubleshooting.md` and `gotchas.md` automatically. Most flaky test failures fall into a handful of known patterns — the skill finds them in seconds instead of minutes.

## MCP Integration: From Ticket to Test

Step 2 of the generate skill already fetches the Jira ticket before generating anything. With a Jira MCP server configured in Cline:

```markdown
## Step 2 — Discovery
- Use the Jira MCP tool to fetch ticket {TICKET_ID}
- Extract: summary, description, acceptance criteria, linked tickets
- Use the acceptance criteria as the primary source for what the test must verify
- Then resolve the intent key and scan the codebase as usual
```

The prompt becomes `/generate-test TICKET-123 intent:flow:checkout` and the agent reads the acceptance criteria directly from Jira. The test is grounded in the actual requirement, not your summary of it.

This matters because the biggest source of test drift is when the ticket says one thing and the test verifies something slightly different. When the agent reads the acceptance criteria directly, that gap closes.

The same pattern works with Linear, GitHub Issues, or any tool that has an [MCP server](https://docs.cline.bot/mcp/mcp-overview). The memory files handle the *how* — patterns, gotchas, file paths. The MCP connection handles the *what* — what this specific ticket requires. They complement each other cleanly.

## Multi-Tool Consistency

If your team uses different AI tools — Cline, Cursor, Windsurf, GitHub Copilot — each has its own format for coding rules. Maintaining separate rule files for each tool is a maintenance nightmare.

The source of truth is `.clinerules`. The other formats are just copies with different filenames:

| Tool | Rule file location |
|---|---|
| Cline | `.clinerules` |
| Cursor | `.cursor/rules/` (individual `.mdc` files with `globs` / `alwaysApply` frontmatter) |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |

The simplest approach is to ask your AI tool to generate a sync script for you — something like: *"Write a shell script that copies `.clinerules` to the rule file locations for Cursor, Windsurf, and GitHub Copilot."* It's a handful of `cp` commands. Run it whenever the rules change and everyone stays in sync regardless of which tool they use.

## What Actually Changed

| | Before | After |
|---|---|---|
| Generate a new test | 30–60 min | 10–15 min |
| Debug a flaky test | 20–40 min | 5–10 min |
| Agent needs to scan codebase | Yes (40+ files) | No (memory has the paths) |
| New team member ramp-up | Weeks | Days |
| Multi-tool rule consistency | Manual | Automated |

The time savings are real, but the more significant change is the floor. A developer who's never touched the test suite can generate a working test on their first day, because the memory files have the context they'd otherwise spend weeks accumulating.

## What I'd Do Differently

**Start the memory files earlier.** The most valuable entries are the gotchas — timing issues and edge cases that took hours to debug. Document them the moment you hit them, not retroactively.

**Version the memory files.** Adding `last_updated` frontmatter would make it easier to spot stale entries. A gotcha documented 18 months ago might no longer apply after a framework upgrade.

**Make the debug skill domain-aware.** The current `/debug-test` skill checks general troubleshooting patterns first. It should check domain-specific failure patterns first, since those are more likely to be the cause for any given test.

The system isn't magic — it's structured context. The AI tools were already capable of generating good tests. What they were missing was the knowledge that experienced team members carry around in their heads. Rules, Skills, and memory files are just a way to write that knowledge down in a format machines can use.

If your test suite has grown to the point where onboarding takes weeks and flaky tests take hours to debug, the bottleneck probably isn't the AI tool. It's the missing context layer.
