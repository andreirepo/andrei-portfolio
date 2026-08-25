---
title: "Self-Hosting Without Opening Ports: Cloudflare Tunnel + Traefik"
description: "How I serve this portfolio and other services from a Lenovo mini PC in my living room — no open ports, no static IP, with automatic HTTPS and Cloudflare's DDoS protection."
pubDate: 2025-03-28
author: "Andrei Repo"
tags: ["cloudflare", "traefik", "docker", "self-hosted", "networking"]
draft: false
---

Este sitio se sirve desde un mini PC Lenovo M910q que tengo en el salón. Sin VPS en la nube, sin puertos abiertos en el firewall, sin IP estática. Solo un Cloudflare Tunnel, Traefik como proxy inverso y unos cuantos contenedores Docker.

Así es como funciona y por qué lo construí de esta manera.

## El Problema del Self-Hosting Tradicional

El enfoque clásico del self-hosting es abrir los puertos 80 y 443 en el router y apuntarlos al servidor. Funciona, pero tiene desventajas reales:

- Tu IP doméstica queda expuesta públicamente
- Necesitas una IP estática o un servicio de DNS dinámico
- Cada servicio que añades necesita su propia regla de reenvío de puertos
- Eres responsable de absorber cualquier pico de tráfico o ataque

Cloudflare Tunnel resuelve todo esto.

## Cómo Funciona Cloudflare Tunnel

En lugar de que tu servidor acepte conexiones entrantes, `cloudflared` (ejecutándose como contenedor Docker) abre una conexión saliente hacia el edge de Cloudflare. Todo el tráfico fluye a través de ese túnel — tu servidor nunca necesita aceptar una conexión del mundo exterior.

```
Internet → Cloudflare Edge → cloudflared tunnel → Traefik → contenedores
```

Sin puertos abiertos. Sin IP expuesta. Cloudflare se sitúa delante de todo y gestiona la terminación TLS, la protección DDoS y el caché.

## El Stack

Todo corre en una VM Linux dedicada en Proxmox (más sobre la configuración de Proxmox en otro post):

- **Traefik** — proxy inverso, enruta el tráfico a los contenedores por hostname
- **cloudflared** — cliente del Cloudflare Tunnel, conecta la VM al edge de Cloudflare
- **Docker** — todos los servicios corren como contenedores en una red compartida

## Configurar el Túnel

Primero, crea un túnel en el panel de Cloudflare en Zero Trust → Networks → Tunnels. Obtendrás un token de túnel.

Luego ejecuta `cloudflared` como contenedor Docker:

```yaml
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    restart: unless-stopped
    networks:
      - traefik-net
```

En el panel de Cloudflare, configura el hostname público del túnel para que apunte a tu instancia de Traefik:

- **Hostname público**: `andreirepo.com`
- **Servicio**: `http://traefik:80`

Cloudflare gestiona HTTPS externamente. El tráfico llega a Traefik por HTTP plano dentro del túnel — lo cual está bien ya que nunca sale de la red privada.

## Configuración de Traefik

Traefik descubre los servicios automáticamente mediante etiquetas Docker. Cada contenedor declara sus propias reglas de enrutamiento:

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

Añadir un nuevo servicio es simplemente cuestión de añadir etiquetas — sin archivos de configuración nginx, sin reglas de enrutamiento manuales.

## Umami Analytics

Como todo está en la misma red Docker, añadir [Umami](https://umami.is) para analíticas self-hosted fue sencillo. Umami corre como dos contenedores (app + Postgres), ambos en `traefik-net`, con una etiqueta Traefik apuntando `analytics.andreirepo.com` al contenedor de Umami.

El sitio del portfolio envía eventos de analíticas a `analytics.andreirepo.com` — que pasa por el Cloudflare Tunnel igual que el sitio principal. Sin analíticas de terceros, sin datos saliendo de mi infraestructura, y el script se sirve desde mi propio dominio por lo que es menos probable que los bloqueadores de anuncios lo bloqueen.

## Beneficios en la Práctica

**Sin puertos abiertos** — mi router no tiene ninguna regla de reenvío de puertos. La única conexión saliente es el túnel.

**Sin IP estática necesaria** — el túnel se reconecta automáticamente si cambia mi IP. Llevo meses sin ningún tiempo de inactividad por cambios de IP.

**Protección DDoS gratuita** — Cloudflare absorbe los picos de tráfico antes de que lleguen a mi red doméstica.

**Expansión de servicios sencilla** — añadir un nuevo subdominio son dos pasos: añadir etiquetas Docker al contenedor, añadir un hostname público en la configuración del túnel de Cloudflare. Listo.

**Coste** — Cloudflare Tunnel es gratuito en el nivel gratuito de Zero Trust (hasta 50 usuarios). El único coste es el dominio en sí.

## Las Contrapartidas

No es perfecto. Cloudflare se sitúa entre tus usuarios y tu servidor, lo que significa:

- Cloudflare puede ver tu tráfico (aunque está cifrado de extremo a extremo para servicios sensibles)
- Dependes de la disponibilidad de Cloudflare
- La latencia es ligeramente mayor que una conexión directa

Para un portfolio personal y un home lab, estas son contrapartidas aceptables. Para cualquier cosa que maneje datos sensibles de usuarios, habría que pensarlo más detenidamente.

## Lo Que Viene

En el siguiente post cubriré el lado CI/CD — cómo uso un runner de GitHub Actions self-hosted y SSH a través de Cloudflare Tunnel para desplegar directamente en esta máquina desde un push a GitHub, sin exponer nunca un puerto SSH a internet.
