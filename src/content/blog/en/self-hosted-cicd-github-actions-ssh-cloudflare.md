---
title: "Zero-Exposure CI/CD: GitHub Actions, Self-Hosted Runner, and SSH over Cloudflare Tunnel"
description: "How I deploy this portfolio from a GitHub push to a home server in my living room — using a self-hosted runner and SSH tunnelled through Cloudflare, with no open ports anywhere."
pubDate: 2025-04-01
tags: ["github-actions", "ci-cd", "cloudflare", "self-hosted", "docker", "devops"]
draft: false
---

In the [previous post](/en/blog/self-hosted-cloudflare-tunnel-traefik) I covered how Cloudflare Tunnel and Traefik serve this site from a Lenovo mini PC in my living room with no open ports. This post covers the deployment side — how a `git push` to `main` builds a Docker image, runs checks, and deploys to that same machine automatically.

The interesting constraint: the server has no open ports. Not even SSH. So how does GitHub Actions reach it?

## The Architecture

```
git push → GitHub Actions → self-hosted runner (Docker) → docker compose pull + up
                                    ↑
                         runs on the same VM as the site
```

The key insight: the GitHub Actions runner runs *on the server itself*, as a Docker container. It doesn't need inbound connectivity — it polls GitHub for jobs over an outbound HTTPS connection, the same way `cloudflared` works.

For file syncing and remote commands during deploy, SSH goes through Cloudflare Tunnel — again, outbound only.

## Self-Hosted GitHub Runner

The runner is a Docker container on the same VM. Rather than hardcoding it into a `docker-compose.yml`, I use a small script that spins up an ephemeral runner per repository — it self-cleans after each job and can be reused across any repo in the homelab.

```bash
#!/bin/bash
# Usage: REPO_URL="https://github.com/user/repo" GITHUB_TOKEN=token ./start-github-runner.sh

REPO_URL="${REPO_URL:?Error: REPO_URL is required}"
GITHUB_TOKEN="${GITHUB_TOKEN:?Error: GITHUB_TOKEN is required}"
RUNNER_NAME="proxmox-runner-$(hostname)-${REPO_URL##*/}-$(date +%s)"
CONTAINER_NAME="github-runner-${REPO_URL##*/}"

# Stop any existing runner for this repo
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Start ephemeral runner
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  -e REPO_URL="$REPO_URL" \
  -e ACCESS_TOKEN="$GITHUB_TOKEN" \
  -e RUNNER_NAME="$RUNNER_NAME" \
  -e RUNNER_WORKDIR="/tmp/runner/work" \
  -e EPHEMERAL="true" \
  -e DISABLE_AUTO_UPDATE="true" \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /tmp/runner:/tmp/runner \
  myoung34/github-runner:latest
```

The full script with status checks is in my [homelab repo](https://github.com/andreirepo/homelab/tree/main/scripts/maintenance/start-github-runner). To register a runner for a new repo it's just:

```bash
GITHUB_TOKEN=your_token REPO_URL="https://github.com/andreirepo/andrei-portfolio" ./start-github-runner.sh
```

A few things worth noting about this setup:

**`EPHEMERAL=true`** — the runner deregisters itself from GitHub after completing one job and the container exits. A fresh container is started for the next run. This avoids state accumulation between jobs and is the pattern GitHub recommends for self-hosted runners.

**`DISABLE_AUTO_UPDATE=true`** — prevents the runner from trying to update itself mid-job, which can cause unexpected failures.

**Docker socket mount** — `/var/run/docker.sock` gives the runner direct access to Docker on the host, so `docker compose pull` and `docker compose up` in the workflow run against the actual server.

The runner registers itself with GitHub on startup using a Personal Access Token (classic, `repo` scope). You can verify it appeared at `github.com/{user}/{repo}/settings/actions/runners`.

## SSH over Cloudflare Tunnel

For the `rsync` and remote SSH steps in the pipeline, I use Cloudflare's SSH tunnelling. This lets GitHub Actions SSH into the server without the server exposing port 22.

On the server, configure the Cloudflare tunnel to expose SSH:

In the Cloudflare Zero Trust dashboard, add a private network route or a public hostname pointing to `ssh://localhost:22`. Then on the GitHub Actions runner (which is on the same machine), the SSH connection goes through `cloudflared access`:

```yaml
- name: Setup SSH
  run: |
    mkdir -p ~/.ssh
    echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    # Use cloudflared as ProxyCommand for SSH
    echo "Host ${{ secrets.SERVER_HOST }}
      ProxyCommand cloudflared access ssh --hostname %h
      StrictHostKeyChecking no" > ~/.ssh/config
```

Since the runner is already on the same machine, in practice the SSH hop is local — but this pattern also works if you ever run the workflow on GitHub-hosted runners, since the tunnel handles the routing either way.

## The Full Pipeline

The workflow has four jobs:

**1. build-and-test** — installs dependencies, builds the Astro site, runs type checks, uploads the `dist/` artifact.

**2. build-and-push-image** — builds the Docker image and pushes it to GitHub Container Registry (`ghcr.io`) with tags for the branch name, commit SHA, and `latest`.

**3. deploy** — SSHs into the server, syncs files with `rsync`, pulls the new image, and restarts the container with `--force-recreate` to ensure the new image is always used.

**4. health-check** — waits 20 seconds, then hits `https://andreirepo.com` to confirm the site is up. On success, purges the Cloudflare cache so visitors see the new version immediately. On failure, the rollback job triggers.

```yaml
- name: Docker Compose Up
  run: |
    ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} <<'EOF'
      cd /home/anre/apps/github/andrei-portfolio
      docker compose -f docker-compose.yml pull website
      docker compose -f docker-compose.yml up -d --force-recreate website
    EOF

- name: Purge Cloudflare cache
  run: |
    curl -s -X POST \
      "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
      -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}'
```

## Why a Self-Hosted Runner?

A few reasons:

**No open ports** — the runner polls GitHub, so no inbound connectivity needed. Fits perfectly with the zero-open-ports philosophy.

**Speed** — the runner is on the same machine as the deployment target. `docker compose pull` pulls from GHCR to localhost, which is fast. No SSH latency for the heavy operations.

**Cost** — GitHub-hosted runners have a free tier limit. A self-hosted runner has no usage limits.

**Docker socket access** — the runner can run Docker commands directly, which simplifies the deploy step significantly.

## The Bigger Picture

This whole setup — Proxmox, VMs, Cloudflare Tunnel, Traefik, self-hosted runners — started as a learning project. I've been running the Lenovo M910q for about three years, using it for QA experiments (Jenkins, single-node Kubernetes), media management (Plex, Immich), and now as a proper home lab with a full development and deployment cycle.

The goal was to understand every layer of the stack: how traffic flows from a user's browser to a running container, how a code change becomes a deployed update, and how to do all of it without paying for cloud infrastructure or exposing my home network.

It's been working reliably for months. The only thing I'd change is moving secrets management to something like Vault — but that's a project for another weekend.
