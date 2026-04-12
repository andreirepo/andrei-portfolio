---
title: "Self-Hosting Without Opening Ports: Cloudflare Tunnel + Traefik"
description: "How I serve this portfolio and other services from a Lenovo mini PC in my living room — no open ports, no static IP, with automatic HTTPS and Cloudflare's DDoS protection."
pubDate: 2025-03-28
tags: ["cloudflare", "traefik", "docker", "self-hosted", "networking"]
draft: false
---

This site is served from a Lenovo M910q mini PC sitting in my living room. No cloud VPS, no open firewall ports, no static IP. Just a Cloudflare Tunnel, Traefik as a reverse proxy, and a handful of Docker containers.

Here's how it works and why I built it this way.

## The Problem with Traditional Self-Hosting

The classic approach to self-hosting is to open ports 80 and 443 on your router and point them at your server. It works, but it comes with real downsides:

- Your home IP is publicly exposed
- You need a static IP or a dynamic DNS service
- Every service you add needs its own port forwarding rule
- You're responsible for absorbing any traffic spikes or attacks

Cloudflare Tunnel solves all of this.

## How Cloudflare Tunnel Works

Instead of your server accepting inbound connections, `cloudflared` (running as a Docker container) opens an outbound connection to Cloudflare's edge. All traffic flows through that tunnel — your server never needs to accept a connection from the outside world.

```
Internet → Cloudflare Edge → cloudflared tunnel → Traefik → containers
```

No open ports. No exposed IP. Cloudflare sits in front of everything and handles TLS termination, DDoS protection, and caching.

## The Stack

Everything runs on a dedicated Linux VM on Proxmox (more on the Proxmox setup in another post):

- **Traefik** — reverse proxy, routes traffic to containers by hostname
- **cloudflared** — Cloudflare Tunnel client, connects the VM to Cloudflare's edge
- **Docker** — all services run as containers on a shared network

## Setting Up the Tunnel

First, create a tunnel in the Cloudflare dashboard under Zero Trust → Networks → Tunnels. You'll get a tunnel token.

Then run `cloudflared` as a Docker container:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    restart: unless-stopped
    networks:
      - traefik-net
```

In the Cloudflare dashboard, configure the tunnel's public hostname to point to your Traefik instance:

- **Public hostname**: `andreirepo.com`
- **Service**: `http://traefik:80`

Cloudflare handles HTTPS externally. Traffic arrives at Traefik over plain HTTP inside the tunnel — which is fine since it never leaves the private network.

## Traefik Configuration

Traefik discovers services automatically via Docker labels. Each container declares its own routing rules:

```yaml
services:
  portfolio:
    image: ghcr.io/andreirepo/andrei-portfolio:main
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.portfolio.rule=Host(`andreirepo.com`)"
      - "traefik.http.routers.portfolio.entrypoints=web"
    networks:
      - traefik-net

networks:
  traefik-net:
    external: true
```

Adding a new service is just a matter of adding labels — no nginx config files, no manual routing rules.

## Umami Analytics

Because everything is on the same Docker network, adding [Umami](https://umami.is) for self-hosted analytics was straightforward. Umami runs as two containers (app + Postgres), both on `traefik-net`, with a Traefik label pointing `analytics.andreirepo.com` at the Umami container.

The portfolio site sends analytics events to `analytics.andreirepo.com` — which goes through Cloudflare Tunnel just like the main site. No third-party analytics, no data leaving my infrastructure, and the script is served from my own domain so it's less likely to be blocked by ad blockers.

## Benefits in Practice

**No open ports** — my router has zero port forwarding rules. The only outbound connection is the tunnel.

**No static IP needed** — the tunnel reconnects automatically if my IP changes. I've had zero downtime from IP changes in months of running this.

**Free DDoS protection** — Cloudflare absorbs traffic spikes before they reach my home network.

**Easy service expansion** — adding a new subdomain is two steps: add Docker labels to the container, add a public hostname in the Cloudflare tunnel config. Done.

**Cost** — Cloudflare Tunnel is free on the Zero Trust free tier (up to 50 users). The only cost is the domain itself.

## The Trade-offs

It's not perfect. Cloudflare sits between your users and your server, which means:

- Cloudflare can see your traffic (though it's encrypted end-to-end for sensitive services)
- You're dependent on Cloudflare's availability
- Latency is slightly higher than a direct connection

For a personal portfolio and home lab, these are acceptable trade-offs. For anything handling sensitive user data, you'd want to think more carefully.

## What's Next

In the next post I'll cover the CI/CD side — how I use a self-hosted GitHub Actions runner and SSH over Cloudflare Tunnel to deploy directly to this machine from a GitHub push, without ever exposing an SSH port to the internet.
