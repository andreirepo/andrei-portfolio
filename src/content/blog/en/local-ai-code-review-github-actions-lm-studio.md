---
title: "Local AI Code Reviews on GitHub PRs with LM Studio and GitHub Actions"
description: "How I set up automated PR code reviews using a locally running Qwen2.5 Coder model via LM Studio, Tailscale, and a self-hosted GitHub Actions runner — with a graceful fallback when the PC is off."
pubDate: 2025-04-12
tags: ["github-actions", "ai", "lm-studio", "tailscale", "self-hosted", "devops"]
draft: false
---

I wanted automated code reviews on pull requests without sending my code to a third-party API. I already run LM Studio on my Windows gaming PC with both `qwen/qwen2.5-coder-14b` and `google/gemma-4-26b-a4b` loaded, and my home lab VM is connected to the same Tailscale network. Putting it together took less than an hour — once I figured out why Windows Firewall was silently blocking everything.

## The Architecture

```
PR opened → GitHub Actions (self-hosted runner on VM)
              → health check: is LM Studio reachable?
              → yes: get diff → call Gemma → post PR comment
              → no: post "AI offline" notice → done
```

The self-hosted runner is already on the same VM as the portfolio site (covered in a [previous post](/en/blog/self-hosted-cicd-github-actions-ssh-cloudflare)). LM Studio runs on a separate Windows PC connected via Tailscale.

## Connecting LM Studio over Tailscale

LM Studio has a "Serve on Local Network" toggle in the Developer tab. Enable it and it binds to `0.0.0.0:1234`, making it reachable via the Tailscale IP.

The catch: when Windows first ran LM Studio and showed the firewall prompt, I must have clicked the wrong option. Windows silently created two **Block** rules for `lm studio.exe` that overrode everything else — including the Allow rules I added manually later.

The fix was removing those block rules:

```powershell
Get-NetFirewallRule | Where-Object { $_.DisplayName -eq "lm studio.exe" -and $_.Action -eq "Block" } | Remove-NetFirewallRule
```

After that, the VM could reach LM Studio immediately:

```bash
curl http://100.115.80.116:1234/v1/models
# returns {"data": [{"id": "google/gemma-4-26b-a4b"}, {"id": "qwen/qwen2.5-coder-14b"}]}
```

## The GitHub Actions Workflow

The workflow triggers on every PR opened or updated against `main`. The key design decision was making the AI review completely optional — if LM Studio is off, the workflow still passes and just leaves a short notice.

```yaml
- name: Check LM Studio availability
  id: lmstudio-check
  run: |
    if curl -sf --max-time 5 http://100.115.80.116:1234/v1/models > /dev/null 2>&1; then
      echo "available=true" >> $GITHUB_OUTPUT
    else
      echo "available=false" >> $GITHUB_OUTPUT
    fi
```

Every subsequent step uses `if: steps.lmstudio-check.outputs.available == 'true'` so they're skipped entirely when the PC is off.

The diff is scoped to relevant file types and capped at 12KB to avoid overwhelming the model:

```bash
git diff origin/${{ github.base_ref }}...HEAD \
  -- '*.ts' '*.tsx' '*.astro' '*.js' '*.mjs' '*.css' '*.json' \
  | head -c 12000 > /tmp/pr_diff.txt
```

The API call uses the OpenAI-compatible endpoint LM Studio exposes:

```bash
PAYLOAD=$(jq -n --arg diff "$DIFF" '{
  model: "qwen/qwen2.5-coder-14b",
  messages: [
    {
      role: "system",
      content: "You are a senior software engineer doing a code review. Be concise and practical. Focus on: bugs, security issues, performance problems, and code quality. Skip minor style issues."
    },
    {
      role: "user",
      content: ("Please review this pull request diff:\n\n```diff\n" + $diff + "\n```")
    }
  ],
  temperature: 0.3,
  max_tokens: 1500,
  stream: false
}')

curl -sf --max-time 120 \
  -X POST http://100.115.80.116:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

`temperature: 0.3` keeps the review focused and consistent. `max_tokens: 1500` is enough for a thorough review. The 120s timeout gives Qwen2.5 Coder 14B enough time to process.

The review gets posted as a PR comment via `actions/github-script`:

```javascript
await github.rest.issues.createComment({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.issue.number,
  body: `## 🤖 AI Code Review\n\n${review}\n\n---\n*Reviewed by Gemma 4 26B running locally*`
});
```

## Why Qwen2.5 Coder 14B?

I have two models loaded: `qwen/qwen2.5-coder-14b` and `google/gemma-4-26b-a4b`. Qwen Coder is specifically trained on code and gives more precise technical feedback — it understands language-specific patterns, spots potential bugs more reliably, and produces structured review comments. Gemma 4 is a strong general model but for code review, a purpose-built coder model wins.

The 14B size is a sweet spot — fast enough to review a typical PR diff in under a minute on a gaming GPU, while being capable enough to catch real issues.

## The Result

Every PR now gets an automated review comment within 1–2 minutes (depending on diff size and GPU load). When my gaming PC is off, the workflow posts a one-line notice and exits cleanly — no failed checks, no blocked PRs.

The whole thing runs on hardware I already own, costs nothing per review, and keeps the code entirely on my own infrastructure.
