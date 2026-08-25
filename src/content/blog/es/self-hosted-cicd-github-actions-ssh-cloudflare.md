---
title: "Zero-Exposure CI/CD: GitHub Actions, Self-Hosted Runner, and SSH over Cloudflare Tunnel"
description: "How I deploy this portfolio from a GitHub push to a home server in my living room — using a self-hosted runner and SSH tunnelled through Cloudflare, with no open ports anywhere."
pubDate: 2025-04-01
author: "Andrei Repo"
tags: ["github-actions", "ci-cd", "cloudflare", "self-hosted", "docker", "devops"]
draft: false
---

En el [post anterior](/es/blog/self-hosted-cloudflare-tunnel-traefik) expliqué cómo Cloudflare Tunnel y Traefik sirven este sitio desde un mini PC Lenovo en mi salón sin puertos abiertos. Este post cubre el lado del despliegue — cómo un `git push` a `main` construye una imagen Docker, ejecuta comprobaciones y despliega en esa misma máquina automáticamente.

La restricción interesante: el servidor no tiene puertos abiertos. Ni siquiera SSH. ¿Cómo llega entonces GitHub Actions a él?

## La Arquitectura

```
git push → GitHub Actions → runner self-hosted (Docker) → docker compose pull + up
                                    ↑
                         corre en la misma VM que el sitio
```

La clave: el runner de GitHub Actions corre *en el propio servidor*, como contenedor Docker. No necesita conectividad entrante — consulta GitHub en busca de trabajos a través de una conexión HTTPS saliente, igual que funciona `cloudflared`.

Para la sincronización de archivos y comandos remotos durante el despliegue, SSH va a través de Cloudflare Tunnel — de nuevo, solo saliente.

## Runner Self-Hosted de GitHub

El runner es un contenedor Docker en la misma VM. En lugar de codificarlo en un `docker-compose.yml`, uso un pequeño script que lanza un runner efímero por repositorio — se autolimpia después de cada trabajo y puede reutilizarse en cualquier repo del homelab.

```bash
#!/bin/bash
# Uso: REPO_URL="https://github.com/user/repo" GITHUB_TOKEN=token ./start-github-runner.sh

REPO_URL="${REPO_URL:?Error: REPO_URL es obligatorio}"
GITHUB_TOKEN="${GITHUB_TOKEN:?Error: GITHUB_TOKEN es obligatorio}"
RUNNER_NAME="proxmox-runner-$(hostname)-${REPO_URL##*/}-$(date +%s)"
CONTAINER_NAME="github-runner-${REPO_URL##*/}"

# Detener cualquier runner existente para este repo
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# Iniciar runner efímero
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

El script completo con comprobaciones de estado está en mi [repositorio homelab](https://github.com/andreirepo/homelab/tree/main/scripts/maintenance/start-github-runner). Para registrar un runner para un nuevo repo basta con:

```bash
GITHUB_TOKEN=tu_token REPO_URL="https://github.com/andreirepo/andrei-portfolio" ./start-github-runner.sh
```

Algunos aspectos destacables de esta configuración:

**`EPHEMERAL=true`** — el runner se da de baja de GitHub tras completar un trabajo y el contenedor termina. Se inicia un contenedor nuevo para la siguiente ejecución. Esto evita la acumulación de estado entre trabajos y es el patrón que GitHub recomienda para runners self-hosted.

**`DISABLE_AUTO_UPDATE=true`** — evita que el runner intente actualizarse durante un trabajo, lo que puede causar fallos inesperados.

**Montaje del socket Docker** — `/var/run/docker.sock` da al runner acceso directo a Docker en el host, por lo que `docker compose pull` y `docker compose up` en el workflow se ejecutan contra el servidor real.

El runner se registra en GitHub al iniciarse usando un Token de Acceso Personal (clásico, scope `repo`). Puedes verificar que apareció en `github.com/{usuario}/{repo}/settings/actions/runners`.

## SSH a través de Cloudflare Tunnel

Para los pasos de `rsync` y SSH remoto en el pipeline, uso el tunneling SSH de Cloudflare. Esto permite que GitHub Actions haga SSH al servidor sin que el servidor exponga el puerto 22.

En el servidor, configura el túnel de Cloudflare para exponer SSH:

En el panel de Cloudflare Zero Trust, añade una ruta de red privada o un hostname público apuntando a `ssh://localhost:22`. Luego en el runner de GitHub Actions (que está en la misma máquina), la conexión SSH pasa a través de `cloudflared access`:

```yaml
- name: Configurar SSH
  run: |
    mkdir -p ~/.ssh
    echo "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    # Usar cloudflared como ProxyCommand para SSH
    echo "Host ${{ secrets.SERVER_HOST }}
      ProxyCommand cloudflared access ssh --hostname %h
      StrictHostKeyChecking no" > ~/.ssh/config
```

Como el runner ya está en la misma máquina, en la práctica el salto SSH es local — pero este patrón también funciona si alguna vez ejecutas el workflow en runners alojados por GitHub, ya que el túnel gestiona el enrutamiento de todas formas.

## El Pipeline Completo

El workflow tiene cuatro trabajos:

**1. build-and-test** — instala dependencias, construye el sitio Astro, ejecuta comprobaciones de tipos, sube el artefacto `dist/`.

**2. build-and-push-image** — construye la imagen Docker y la sube a GitHub Container Registry (`ghcr.io`) con etiquetas para el nombre de rama, SHA del commit y `latest`.

**3. deploy** — hace SSH al servidor, sincroniza archivos con `rsync`, descarga la nueva imagen y reinicia el contenedor con `--force-recreate` para asegurar que siempre se usa la nueva imagen.

**4. health-check** — espera 20 segundos, luego accede a `https://andreirepo.com` para confirmar que el sitio está activo. Si tiene éxito, purga la caché de Cloudflare para que los visitantes vean la nueva versión inmediatamente. Si falla, se activa el trabajo de rollback.

```yaml
- name: Docker Compose Up
  run: |
    ssh ${{ secrets.SERVER_USER }}@${{ secrets.SERVER_HOST }} <<'EOF'
      cd /home/anre/apps/github/andrei-portfolio
      docker compose -f docker-compose.yml pull website
      docker compose -f docker-compose.yml up -d --force-recreate website
    EOF

- name: Purgar caché de Cloudflare
  run: |
    curl -s -X POST \
      "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
      -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
      -H "Content-Type: application/json" \
      --data '{"purge_everything":true}'
```

## ¿Por Qué un Runner Self-Hosted?

Varias razones:

**Sin puertos abiertos** — el runner consulta GitHub, por lo que no necesita conectividad entrante. Encaja perfectamente con la filosofía de cero puertos abiertos.

**Velocidad** — el runner está en la misma máquina que el destino del despliegue. `docker compose pull` descarga desde GHCR a localhost, lo cual es rápido. Sin latencia SSH para las operaciones pesadas.

**Coste** — los runners alojados por GitHub tienen un límite en el nivel gratuito. Un runner self-hosted no tiene límites de uso.

**Acceso al socket Docker** — el runner puede ejecutar comandos Docker directamente, lo que simplifica significativamente el paso de despliegue.

## El Panorama General

Todo este setup — Proxmox, VMs, Cloudflare Tunnel, Traefik, runners self-hosted — empezó como un proyecto de aprendizaje. Llevo unos tres años con el Lenovo M910q, usándolo para experimentos de QA (Jenkins, Kubernetes de un solo nodo), gestión multimedia (Plex, Immich), y ahora como un home lab completo con un ciclo de desarrollo y despliegue completo.

El objetivo era entender cada capa del stack: cómo fluye el tráfico desde el navegador de un usuario hasta un contenedor en ejecución, cómo un cambio de código se convierte en una actualización desplegada, y cómo hacer todo esto sin pagar infraestructura en la nube ni exponer la red doméstica.

Lleva funcionando de forma fiable durante meses. Lo único que cambiaría es mover la gestión de secretos a algo como Vault — pero eso es un proyecto para otro fin de semana.
