---
title: "From Two Runner Containers to Ephemeral Pods: Actions Runner Controller on a 4-Core Homelab"
description: "Replacing two always-on GitHub runner containers — and the personal access token in their environment — with ephemeral pods on k3s. Measured on a 4-core Proxmox host, including the two addresses the migration broke."
pubDate: 2026-11-05
author: "Andrei Repo"
tags: ["github-actions", "arc", "k3s", "kubernetes", "self-hosted", "devops"]
draft: false
---

Durante dos años mi CI corrió en dos contenedores `myoung34/github-runner` en la VM de desarrollo. Funcionaban. También estaban siempre encendidos, compartían un `docker.sock` montado y llevaban un token de acceso personal en su entorno — un token con permisos `repo` y `workflow`, dentro de un contenedor que cualquier job podía leer.

Esa última parte es la razón por la que por fin hice algo al respecto. No el número de contenedores, no la RAM. Una credencial de larga vida que puede hacer push a todos mis repositorios, en texto plano, dentro de un proceso que ejecuta código de internet.

Esto es el reemplazo: Actions Runner Controller en un clúster k3s de un solo nodo, dentro de un contenedor LXC, sobre un i5 de 2015 con 16 GB de RAM. Todo lo que viene abajo está medido en ese hardware, no en un clúster de nube.

## Por qué reemplazar algo que funcionaba

Tres cosas, en el orden en que realmente me importaron:

- **Aislamiento.** Un runner en contenedor persiste entre jobs. Restos en el workspace, credenciales cacheadas, un `node_modules` envenenado: todo sobrevive de una ejecución a la siguiente. Un pod se crea para un job y se borra al terminar, así que no hay nada que envenenar.
- **Ninguna credencial de larga vida.** ARC se autentica como una **GitHub App** y emite tokens de registro efímeros. La clave privada de la App vive en un único secreto de Kubernetes, no en el entorno de dos contenedores.
- **Escalar a cero.** Dos contenedores estaban ociosos 23 horas al día. El scale set se queda en cero runners y cero pods hasta que hay un job en cola.

El coste nunca fue parte del asunto. Los repositorios públicos ya tienen minutos gratis en runners de GitHub, y la electricidad de este homelab no se factura por job. Lo que quería era control sobre el entorno, y aprender una herramienta sobre la que solo había leído.

## Qué es ARC en realidad

Tres piezas, y conviene saber cuál es cuál antes de instalar nada:

```
GitHub (App)  ──►  listener pod  ──►  controller ──►  runner pod (efímero)
                   (uno por          (arc-systems)    (arc-runners)
                    scale set)
```

- El **controller** observa objetos `AutoscalingRunnerSet` y nada más.
- Cada **scale set** tiene un pod **listener** que consulta GitHub en long polling buscando jobs en cola y le pide runners al controller.
- Cada **runner** es su propio pod. Cuando el job termina, el pod se borra y, con él, el token con el que se registró.

La gente instala ARC y luego se pregunta por qué no pasa nada: el controller solo no hace nada. Necesita al menos un scale set, y ese scale set necesita una credencial que pueda leer la cola de jobs de un repositorio.

## El clúster

El host es un i5-6500T (cuatro núcleos, sin hyperthreading, de 2015), 16 GB de DDR4 y un único SSD SATA de consumo de 223 GB con 50.000 horas de encendido. Ya ejecuta una VM de desarrollo, Home Assistant y una instancia de Immich, y le quedaban unos 5 GB de RAM libres.

Antes de todo esto tuve que arreglar el disco, que es lección aparte. El thin pool estaba al 93% porque los discos de las VMs se habían asignado pero nunca se habían descartado: `discard=on,ssd=1` en cada `scsi0` más un `fstrim` dentro de cada invitado lo bajaron del 93% al 37%, unos 92 GB recuperados, sin tocar la configuración de ningún invitado.

El clúster es un LXC sin privilegios con Ubuntu 24.04, no una VM:

```bash
pct create 110 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
  --hostname k3s-lab --cores 2 --memory 3072 --rootfs local-lvm:30 \
  --net0 name=eth0,bridge=vmbr0,ip=192.168.18.70/24,gw=192.168.18.1 \
  --features nesting=1,keyctl=1 --unprivileged 1 --onboot 1
```

Después k3s, con los dos componentes que aquí solo gastarían RAM y no expondrían nada útil:

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik \
  --disable servicelb --flannel-iface eth0 --node-ip 192.168.18.70 \
  --write-kubeconfig-mode 600" sh -
```

Sin Traefik porque no hay ingress que servir: los runners solo hacen conexiones salientes. Sin servicelb por lo mismo. Queda k3s (~600 MB), cert-manager (ARC lo necesita para los activos TLS del listener) y el controller.

## Autenticarse con una GitHub App

Esta es la mejora que merece la pena contar, y la parte con más aristas.

1. Crea una GitHub App con **Actions: read and write** y **Administration: read and write** sobre los repositorios que correspondan.
2. **Instálala.** Crear una App e instalarla son pasos distintos, y saltarse el segundo produce un controller que arranca, lee su secreto y no hace nada. La señal es `GET /app/installations` devolviendo `[]` mientras la App se autentica sin problema.
3. Guarda el App ID, el installation ID y la clave privada como un secreto de Kubernetes.

```bash
kubectl -n arc-runners create secret generic arc-homelab-github-app \
  --from-literal=github_app_id=5625980 \
  --from-literal=github_app_installation_id=178883381 \
  --from-file=github_app_private_key=./private-key.pem
```

La clave pasa por stdin hacia el secreto. Nunca aparece en una línea de comandos, en un log ni en este repositorio.

Una limitación estructural con la que choca cualquiera que use una cuenta personal de GitHub: **los runner groups de organización no existen para cuentas de usuario**, así que un scale set está limitado a exactamente un repositorio. Tres repositorios significan tres scale sets. No cuestan nada ociosos —cada listener es un pod pequeño— pero son tres releases de Helm que mantener sincronizadas.

## El scale set

Toda la configuración es un fichero de valores:

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

`minRunners: 0` es el ajuste que hace que esto valga la pena: ni pods ni RAM hasta que llega un job. `maxRunners: 2` es lo que cabe: dos runners de 512 Mi (límite 2 Gi) junto a k3s, cert-manager, el controller y dos listeners, dentro de 3 GB.

## Verlo funcionar

La parte satisfactoria es una matrix de cuatro jobs y una terminal:

```bash
kubectl -n arc-runners get pods -w
```

```
arc-homelab-runner-qs6db   0/1   ContainerCreating   0   3s
arc-homelab-runner-qwpjz   0/1   ContainerCreating   0   2s
...  ~55 s después, ambos Running (primera vez: descargando la imagen)
...  el job termina, los dos pods se borran
```

Cuatro shards contra `maxRunners: 2` significa que dos corren y dos esperan, que es justo el punto de un scale set: es una cola, no una promesa.

El segundo scale set, con el clúster caliente, medido desde un pull request desechable:

| | |
|---|---|
| pull request abierto → job terminado | **17 s** |
| tiempo en cola | **7 s** |
| el job en sí | 9 s |
| pods después | **0** |

La comparación que importa no es la velocidad del runner. Los jobs del mismo repositorio en runners de GitHub han llegado a esperar **más de 20 minutos** en cola por las mañanas. Siete segundos de cola y un pod de dos núcleos que arranca en tres segundos es otro producto.

## Lo que cuesta ocioso

| | |
|---|---|
| Clúster ocioso (k3s, cert-manager, controller, 2 listeners) | **~900 MB** |
| Pods de runner ociosos | **0** |
| Disco tras descargar la imagen del runner | 4,3 GB de 30 GB |
| RAM libre en el host después | ~5 GB |

Una medición de la que hay que desconfiar: dentro de un pod de runner, `/proc/meminfo` informa de los 16 GB del **host**, porque los contenedores no tienen namespace para la información de memoria. `nproc` sí refleja el límite del contenedor (2). Dimensionar algo con `free` dentro de un runner es cómo se consigue un job que cree tener 16 GB y lo mate el OOM killer.

## La migración rompió dos direcciones

Mover los jobs del portfolio del contenedor a pods sacó el mismo problema dos veces, y es la lección más transferible de este post.

**Los pods están en la LAN. No están en Tailscale.** El runner en contenedor vivía en una VM que tiene ruta por Tailscale; el host de k3s no. Toda dirección `100.x` que antes funcionaba se convirtió en un agujero negro:

| Job | Apuntaba a | Síntoma |
|---|---|---|
| revisión con IA → LM Studio en el PC gaming | una IP de Tailscale de una máquina apagada desde hace 70 días | `curl` expiraba, la revisión se saltaba en silencio |
| deploy → el servidor por SSH | una IP de Tailscale | `ssh: connect to host … port 22: Connection timed out` |

El segundo tumbó un despliegue real en `main`, que a su vez disparó el job de rollback… que falló igual. No se rompió nada, porque la imagen anterior seguía sirviendo, pero es exactamente el fallo que solo aparece en producción.

Ambos se arreglaron apuntando los secretos a direcciones de la LAN, que además resultan más rápidas.

## Dos fallos silenciosos por el camino

Ninguno de estos tenía que ver con ARC, y los dos habrían seguido invisibles detrás de un check en verde.

**La revisión pedía un modelo que no existe.** El payload decía `qwen/qwen3-14b`; LM Studio sirve `qwen3-14b` y responde `400`. El workflow usaba `curl -sf`, que convierte cualquier error HTTP en un código de salida distinto de cero, y el script lo traducía a `review_failed=true`, así que no se publicaba nada. Job en verde, ninguna revisión.

**La revisión nunca se refrescaba.** El chequeo de disponibilidad llevaba `if: steps.check-existing.outputs.exists == 'false'`, así que en cuanto existía un comentario se saltaba la revisión entera, incluida la rama de "actualizar el comentario existente" unos pasos más abajo. Esa rama era código inalcanzable. Cada push después del primero era un no-op de diez segundos que reportaba éxito.

Los encontré solo porque leí el log de un job que había "funcionado". Ese es el hábito que merece la pena llevarse de este post.

## Lo que se quedó en runners de GitHub

El objetivo nunca fue autohospedarlo todo. Un repositorio siguió en `ubuntu-latest`: un proyecto privado cuyo job instala Node, pnpm y Chromium, luego compila y ejecuta una suite de Playwright.

- **Necesita un entorno de build, no un runner.** La imagen de ARC es el agente: `git`, `curl`, `jq`, `python3`, `tar`, `unzip`, `sudo`, y ni Node, ni pnpm, ni Chromium. Haría falta una imagen propia, construida y mantenida.
- **La RAM es la restricción real.** Chromium más un build de Vite pasan de 2 GB. En un clúster de 3 GB con 2,1 GB libres en reposo, pasaría una tarde tranquila y fallaría en una mala.
- **Dejarlo ahí no cuesta nada.** Unos 100 minutos al mes frente a 2.000 minutos gratis en repositorios privados.

El criterio que aplico ahora a cualquier cosa que me tiente mover: autohospeda cuando el job necesite *tu* red, *tu* hardware o *tus* datos. La revisión con IA lo cumple: habla con un modelo en la LAN, algo que un runner de GitHub no puede alcanzar de ninguna manera. Un build, en general, no.

## El último contenedor

El último contenedor pertenecía a una app de demo cuya pipeline necesitaba Node, Docker buildx y SSH a un host detrás de NAT. Un runner privilegiado con Docker-in-Docker en un clúster de 3 GB no merece la pena, así que retiré ese workflow y escribí los pasos: construir dos imágenes amd64 con los argumentos exactos, publicar dos etiquetas, desplegar por etiqueta y volver atrás desde un fichero de estado.

Eso era lo último que sostenía un token de acceso personal.

## Lo que me diría a mí mismo antes de empezar

- **Lee los caminos muertos antes de fiarte de un check en verde.** Los dos fallos silenciosos estaban en un workflow que llevaba meses "funcionando".
- **`KUBECONFIG` no es opcional en una shell no interactiva.** Helm por SSH falla con `dial tcp [::1]:8080: connection refused` mientras `kubectl` funciona, porque solo uno de los dos encuentra la configuración de k3s.
- **Los listeners son pods sueltos, no deployments.** `kubectl logs deploy/…-listener` devuelve NotFound y parece una instalación rota.
- **Cuenta con un error de reconciliación `autoscalinglisteners … already exists`** por cada scale set nuevo. Es una carrera del controller, aparece una vez y el listener arranca igual.
- **Un PAT clásico no puede gestionar instalaciones de Apps.** Añadir un repositorio a una instalación devuelve 403 o 404 con un token personal; solo un token OAuth o el JWT de la propia App pueden. Ese clic se hace en la interfaz.
- **Repositorio público con runner autohospedado es un pie de banco conocido.** Cualquiera puede hacer fork y abrir un pull request. El job lleva `if: github.event.pull_request.head.repo.full_name == github.repository` para que los PRs de forks se salten el runner, y los runners son pods efímeros sin Docker socket ni montajes del host: no sobrevive nada que envenene la siguiente ejecución.

## El resultado

Dos scale sets, ociosos a cero pods y unos 900 MB para todo el clúster. Los despliegues, los health checks y la revisión con IA corren como pods efímeros que desaparecen al terminar. Ningún runner en contenedor, y ningún token de acceso personal en la pipeline: la autenticación es una GitHub App cuya clave vive en un único secreto de Kubernetes.

El resumen honesto: llevó una tarde, la mayor parte en las cosas que este post lista como trampas, y los dos fallos que importaban estaban en el workflow que creía que ya estaba bien.

**Qué viene**

Al clúster le queda sitio para una idea más: la revisión con IA corre hoy sobre un modelo de 14B en un PC gaming que tiene que estar encendido. Mover ese modelo al clúster es otro problema —passthrough de GPU en un host sin GPU— así que por ahora el fallback del workflow se queda, y una revisión que no puede ocurrir lo dice y termina limpiamente.
