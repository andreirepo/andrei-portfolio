---
title: "From Two Runner Containers to Ephemeral Pods: Actions Runner Controller on a 4-Core Homelab"
description: "Replacing two always-on GitHub runner containers (and the personal access token in their environment) with ephemeral pods on k3s. Measured on a 4-core Proxmox host, including the two addresses the migration broke."
pubDate: 2026-11-05
author: "Andrei Repo"
tags: ["github-actions", "arc", "k3s", "kubernetes", "self-hosted", "devops"]
draft: false
---

Since this site got CI, it has run on two `myoung34/github-runner` containers on the dev VM. They worked. They were also always on, shared a mounted `docker.sock`, and carried a personal access token in their environment: a token with `repo` and `workflow` scope, sitting in a container that any job could read.

That last part is the reason I finally did something about it. Not the container count, not the RAM. A long-lived credential that can push to every repository I own, in plain text, inside a process that runs code from the internet.

This is the replacement: Actions Runner Controller on a single-node k3s cluster, in an LXC container, on a 2015 i5 with 16 GB of RAM. Everything below was measured on that hardware, not on a cloud cluster.

## Why Replace Something That Worked

Three things, in the order they actually mattered to me:

- **Isolation.** A container runner persists between jobs. Workspace leftovers, cached credentials, a poisoned `node_modules`: all of it survives from one run to the next. A pod is created for a job and deleted after it, so there is nothing to poison.
- **No long-lived credential.** ARC authenticates as a **GitHub App** and mints short-lived registration tokens. The GitHub App's private key stays in one Kubernetes secret, not in two container environments.
- **Scale to zero.** Two containers were idle 23 hours a day. The scale set sits at zero runners and zero pods until a job is queued.

Cost was never part of it. Public repositories get free GitHub-hosted minutes, and this homelab's electricity is not metered per job. What I wanted was control over the environment, and to learn a tool I had only read about.

## What ARC Actually Is

Three pieces, and it is worth knowing which is which before installing anything:

```
GitHub (App)  ──►  listener pod  ──►  controller ──►  runner pod (ephemeral)
                   (one per          (arc-systems)    (arc-runners)
                    scale set)
```

- The **controller** watches `AutoscalingRunnerSet` objects and nothing else.
- Each **scale set** gets a **listener** pod that long-polls GitHub for queued jobs and asks the controller for runners.
- Each **runner** is its own pod. When the job ends, the pod is deleted and, with it, the token it registered with.

People install ARC and then wonder why nothing happens: the controller alone does nothing. It needs at least one scale set, and that scale set needs a credential that can read one repository's job queue.

## The Cluster

The host is an i5-6500T (four cores, no hyperthreading, 2015), 16 GB of DDR4, and a single 223 GB consumer SATA SSD with 50,000 power-on hours. It already runs a dev VM, Home Assistant and an Immich instance, and had about 5 GB of RAM free.

Before any of this I had to fix the disk, which is its own lesson. The thin pool was at 93% because the VMs' disks had been allocated but never discarded: `discard=on,ssd=1` on each `scsi0` plus an `fstrim` inside each guest took it from 93% to 37%, about 92 GB back, without touching a single guest's configuration.

The cluster is an unprivileged Ubuntu 24.04 LXC, not a VM:

```bash
pct create 110 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname k3s-lab --cores 2 --memory 3072 --rootfs local-lvm:30 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.18.70/24,gw=192.168.18.1 \
  --features nesting=1,keyctl=1 --unprivileged 1 --onboot 1
```

Then k3s, with the two components that would otherwise eat RAM and expose nothing useful here:

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik \
  --disable servicelb --flannel-iface eth0 --node-ip 192.168.18.70 \
  --write-kubeconfig-mode 600" sh -
```

No Traefik because there is no ingress to serve: runners only make outbound connections. No servicelb for the same reason. What remains is k3s itself (~600 MB), cert-manager (ARC needs it for the listener's TLS assets) and the controller.

## Authenticating With a GitHub App

This is the improvement worth writing about, and the part with the most sharp edges.

1. Create a GitHub App with **Actions: read and write**, **Administration: read and write** on the relevant repositories.
2. **Install** it. Creating an App and installing it are different steps, and skipping the second one produces a controller that starts, reads its secret, and does nothing. The tell is `GET /app/installations` returning `[]` while the App itself authenticates fine.
3. Store the App ID, installation ID and private key as a Kubernetes secret.

```bash
kubectl -n arc-runners create secret generic arc-homelab-github-app \
  --from-literal=github_app_id=5625980 \
  --from-literal=github_app_installation_id=178883381 \
  --from-file=github_app_private_key=./private-key.pem
```

The key goes through stdin and into the secret. It never appears on a command line, in a log, or in this repository.

One structural limitation that a personal GitHub account hits immediately: **organisation runner groups do not exist for user accounts**, so a scale set is scoped to exactly one repository. Every repository that needs one means another scale set. They cost nothing while idle, each listener is a small pod, but it is one Helm release per repository to keep in sync.

## The Scale Set

The whole configuration is one values file:

```yaml
githubConfigUrl: https://github.com/andreirepo/homelab
githubConfigSecret: arc-homelab-github-app

minRunners: 0
maxRunners: 2

template:
  spec:
    containers:
      - name: runner
        image: ghcr.io/actions/actions-runner:latest
        command: ["/home/runner/run.sh"]
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            memory: 2Gi
```

`minRunners: 0` is the setting that makes this worth doing: no pods and no RAM until a job arrives. `maxRunners: 2` is what fits: two runners of 512 Mi (2 Gi limit) alongside k3s, cert-manager, the controller and two listeners, inside 3 GB.

## Watching It Work

The satisfying part is a four-job matrix and a terminal:

```bash
kubectl -n arc-runners get pods -w
```

```
arc-homelab-runner-qs6db   0/1   ContainerCreating   0   3s
arc-homelab-runner-qwpjz   0/1   ContainerCreating   0   2s
...  ~55 s later, both Running (first run: pulling the image)
...  job ends, both pods deleted
```

Four shards against `maxRunners: 2` means two run and two wait, which is the point of a scale set: it is a queue, not a promise.

The second scale set, on a warm cluster, measured from a throwaway pull request:

| Measurement | Result |
|---|---|
| pull request opened → job finished | **17 s** |
| time in queue | **7 s** |
| the job itself | 9 s |
| pods afterwards | **0** |

The comparison that matters is not runner speed. The same repository's GitHub-hosted jobs have sat in queue for **20+ minutes** on busy mornings. Seven seconds of queue and a two-core pod that starts in three seconds is a different product.

## What It Costs When Idle

| Item | Idle cost |
|---|---|
| Cluster idle (k3s, cert-manager, controller, 2 listeners) | **~900 MB** |
| Runner pods when idle | **0** |
| Disk after pulling the runner image | 4.3 GB of 30 GB |
| Host RAM free afterwards | ~5 GB |

One measurement to distrust: inside a runner pod, `/proc/meminfo` reports the **host's** 16 GB, because containers are not namespaced for memory information. `nproc` does reflect the container limit (2). Sizing anything from `free` inside a runner is how you get a job that thinks it has 16 GB and gets OOM-killed.

## The Migration Broke Two Addresses

Moving the portfolio's jobs from the container to pods surfaced the same problem twice, and it is the most transferable lesson in this post.

**Pods are on the LAN. They are not on Tailscale.** The container runner lived on a VM that has a Tailscale route; the k3s host does not. Every `100.x` address that worked before became a black hole:

| Job | Was pointing at | Symptom |
|---|---|---|
| AI review → LM Studio | Tailscale IP of a PC offline for 70 days | `curl` timed out, review skipped |
| deploy → server, SSH | a Tailscale IP | `ssh: connect to host … port 22: Connection timed out` |

The second one failed a real deployment on `main`, which triggered the rollback job, and that failed the same way. Nothing broke, because the previous image kept serving, but it is exactly the failure that only shows up in production.

Both fixed by pointing the secrets at LAN addresses, which also happens to be faster.

## Two Silent Failures I Found on the Way

Neither of these had anything to do with ARC, and both would have stayed invisible behind a green check.

**The review was asking for a model that does not exist.** The payload said `qwen/qwen3-14b`; LM Studio serves `qwen3-14b` and answers `400`. The workflow ran `curl -sf`, which turns any HTTP error into a non-zero exit, which the script turned into `review_failed=true`, and nothing was posted. Green job, no review.

**The review never refreshed.** The availability check carried `if: steps.check-existing.outputs.exists == 'false'`, so once a comment existed the entire review was skipped, including the "update the existing comment" branch a few steps later. That branch was unreachable code. Every push after the first was a ten-second no-op that reported success.

I only found them because I read the log of a job that had "succeeded". That is the habit worth taking from this post.

## What Stayed on GitHub-Hosted Runners

The point was never to self-host everything. One repository kept `ubuntu-latest`: a private project whose job installs Node, pnpm and Chromium, then builds and runs a Playwright suite.

- **It needs a build environment, not a runner.** The ARC image is the agent: `git`, `curl`, `jq`, `python3`, `tar`, `unzip`, `sudo`, and no Node, no pnpm, no Chromium. It would need a custom image built and kept current.
- **RAM is the real constraint.** Chromium plus a Vite build peaks above 2 GB. On a 3 GB cluster with 2.1 GB free at idle, it would pass on a quiet afternoon and fail on a bad one.
- **Leaving it costs nothing.** About 100 minutes a month against 2,000 free private-repository minutes.

The test I now apply to anything else I am tempted to move: self-host when the job needs *your* network, *your* hardware or *your* data. The AI review qualifies: it talks to a model on the LAN, which GitHub-hosted runners cannot reach at all. A build, generally, does not.

## The Last Container

The final container belonged to a demo app whose pipeline needed Node, Docker buildx and SSH to a host behind NAT. A privileged Docker-in-Docker runner on a 3 GB cluster is not worth it, so I retired that workflow instead and wrote the steps down: build two amd64 images with the exact build args, push two tags, deploy by tag, roll back from a state file.

That was the last thing holding a personal access token.

## What I'd Tell Myself Before Starting

- **Read the dead code paths before trusting a green check.** Both silent failures above were in a workflow that had been "working" for months.
- **`KUBECONFIG` is not optional in a non-interactive shell.** Helm over SSH fails with `dial tcp [::1]:8080: connection refused` while `kubectl` works, because only one of them is finding the k3s config.
- **Listeners are bare pods, not deployments.** `kubectl logs deploy/…-listener` returns NotFound and looks like a broken install.
- **Expect one `autoscalinglisteners … already exists` reconcile error** per new scale set. It is a race in the controller, it appears once, and the listener comes up anyway.
- **A classic PAT cannot manage App installations.** Adding a repository to an installation returns 403 or 404 for a personal token; only an OAuth token or the App's own JWT can. That click belongs in the UI.
- **Public repository, self-hosted runner is a known footgun.** Anyone can fork it and open a pull request. The job carries `if: github.event.pull_request.head.repo.full_name == github.repository` so fork PRs skip the self-hosted job entirely, and the runners are ephemeral pods with no Docker socket and no host mounts, nothing survives to poison the next run.

## The Result

Two scale sets, idle at zero pods and about 900 MB for the whole cluster. Deploys, health checks and the AI review run as ephemeral pods that disappear when they finish. No container runner, and no personal access token anywhere in the pipeline. Authentication is a GitHub App whose key lives in one Kubernetes secret.

The honest summary: it took an afternoon, most of it on things this post lists as gotchas, and the two failures that mattered were in the workflow I thought was already fine.

**What's Next**

The cluster has room for one more idea: the AI review currently runs on a 14B model on a gaming PC that has to be on. Moving that model into the cluster is a different problem (GPU passthrough on a host with no GPU), so for now the workflow's fallback stays, and a review that cannot happen says so and exits cleanly.
