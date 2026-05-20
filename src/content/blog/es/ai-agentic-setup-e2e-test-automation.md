---
title: "Construyendo una Capa de Agente IA para Automatización de Tests E2E"
description: "Cómo estructuré un sistema de agente IA con Cline que permite a cualquier desarrollador generar, depurar y mantener tests E2E con mínimo conocimiento del dominio — codificando los patrones del equipo en archivos legibles por máquinas."
pubDate: 2026-05-20
tags: ["testing", "ai", "automation", "webdriverio", "typescript", "cline"]
draft: false
---

Escribir tests E2E para una plataforma compleja es lento — no porque el código sea difícil, sino porque el conocimiento está disperso. Necesitas saber qué helpers de API existen, qué page objects cubren qué flujos, cuáles son los problemas de timing, y cómo están estructurados los archivos de fixtures. Ese conocimiento vive en la cabeza de las personas, en hilos de Slack, y en código que tienes que leer antes de poder escribir cualquier cosa.

Quería solucionar eso. No escribiendo mejor documentación, sino codificando el conocimiento del equipo en archivos estructurados y legibles por máquinas que un agente IA pueda usar de verdad.

## Una Breve Introducción a las Herramientas de IA para Código

Si eres nuevo en el desarrollo asistido por IA, aquí tienes el panorama en pocas palabras. Herramientas como [Cline](https://cline.bot), [Cursor](https://cursor.sh), [Windsurf](https://windsurf.ai) y GitHub Copilot permiten que un agente IA lea tu codebase y genere código junto a ti. La diferencia clave con un chatbot básico es que estas herramientas pueden leer archivos, ejecutar comandos y realizar acciones de múltiples pasos en tu proyecto.

**Cline** es la herramienta sobre la que está construido este setup. Es una extensión de VS Code de código abierto que te da control total sobre qué modelo de IA usas, y tiene un sistema nativo para Rules y Skills — los bloques de construcción del setup descrito aquí. Los mismos conceptos aplican a otras herramientas, pero los nombres de archivos y la sintaxis de invocación difieren ligeramente.

## El Problema Central

La suite de tests con la que trabajaba había crecido hasta ~40 archivos de spec, 35+ helpers de API, y más de una docena de flujos de negocio distintos — cada uno con requisitos de configuración únicos, dependencias de estado e interacciones de UI. Generar un nuevo test para una funcionalidad implicaba:

1. Encontrar el spec existente correcto para usar como referencia
2. Entender qué page objects y helpers eran relevantes
3. Conocer el formato de los archivos de fixture y qué campos sanitizar
4. Recordar los problemas de timing que causaron flakiness la última vez

Una herramienta IA sin este contexto escanearía todo el codebase, haría suposiciones incorrectas y produciría código que necesitaría correcciones importantes. El problema no era la IA — era el contexto que faltaba.

## Los Bloques de Construcción: Rules, Skills y Memoria

Antes de entrar en la estructura, ayuda entender qué hace cada pieza. Cline tiene tres conceptos nativos para personalizar el comportamiento del agente:

**[Rules](https://docs.cline.bot/customization/cline-rules)** (`.clinerules`) — un archivo markdown en la raíz de tu proyecto que Cline lee en cada tarea. Piénsalo como las instrucciones permanentes: estándares de código, convenciones de nomenclatura, qué nunca hacer. Cada herramienta de IA tiene su equivalente: `.cursorrules` para Cursor, `.windsurfrules` para Windsurf, `CLAUDE.md` para Claude Code, `copilot-instructions.md` para GitHub Copilot.

**[Skills](https://docs.cline.bot/customization/skills)** — conjuntos de instrucciones modulares para tareas específicas, cada uno almacenado como un archivo `SKILL.md` dentro de un directorio con nombre bajo `.cline/skills/`. Un skill se invoca mediante un slash command (p.ej., `/generate-test`) o se carga automáticamente cuando Cline detecta que es relevante según la descripción del skill. El `SKILL.md` contiene todo: el proceso paso a paso, qué archivos leer, cuándo detenerse y pedir aprobación, qué hacer si algo falla. La diferencia con una rule es el alcance: las rules siempre están activas, los skills se cargan bajo demanda.

**[Archivos de memoria](https://docs.cline.bot/best-practices/memory-bank)** (el "brain") — archivos markdown que almacenan el conocimiento de dominio que el agente debe mantener entre sesiones. A diferencia de las rules (que son instrucciones), los archivos de memoria son hechos: qué hace esta funcionalidad, qué helpers existen, qué causó ese test flaky el mes pasado. Tú los escribes y mantienes — no se generan automáticamente. El agente los lee al inicio de una tarea para ponerse al día instantáneamente.

---

Juntas, estas tres piezas convierten una herramienta de IA de propósito general en un agente consciente del equipo que conoce tu codebase, sigue tus estándares y no repite los mismos errores.

## La Estructura

Así es como estos conceptos se mapean a una estructura de carpetas concreta:

```
.clinerules                           # Rules: estándares de código siempre activos para Cline

.cline/
├── skills/
│   ├── generate-test/
│   │   └── SKILL.md                  # Skill: invocado via /generate-test
│   └── debug-test/
│       └── SKILL.md                  # Skill: invocado via /debug-test
├── knowledge/                        # Archivos de soporte referenciados por los skills
│   ├── feature-registry.md           # Mapeo de intención a código
│   └── troubleshooting.md            # Fallos comunes y soluciones
└── memory/
    ├── domain-a/
    │   ├── flows.md                  # Flujos de UI, diagramas de estado, secuencias de API
    │   └── patterns.md               # Plantillas de código, patrones de fixtures
    └── shared/
        ├── gotchas.md                # Problemas conocidos con soluciones concretas
        └── selectors.md              # Selectores descubiertos y brechas de cobertura
```

La idea clave: nada de esto es documentación para humanos. Cada archivo está escrito con encabezados, tablas y bloques de código consistentes para que una IA pueda parsearlo y usarlo de forma confiable.

## Los Archivos de Memoria: Codificando lo que Sabes

El directorio `memory/` es donde vive el conocimiento del equipo. Captura tres cosas que la documentación normalmente omite:

**Flujos** — no solo "qué hace esta funcionalidad" sino la secuencia exacta de UI, qué llamadas a la API ocurren en qué orden, y en qué estado necesita estar la aplicación antes de que empiece el test. Esto es lo que un ingeniero senior sabe después de seis meses en el proyecto.

**Patrones** — plantillas de código reutilizables. La estructura de `setup.data.ts`, cómo funciona la sustitución de variables en los fixtures JSON, el flujo de creación por API paso a paso. En lugar de leer tres specs existentes para entender el patrón, el agente lee un archivo.

**Gotchas** — lo que causa flakiness. Cada entrada tiene un síntoma, una causa raíz y una solución concreta. No solo una descripción del problema.

Así se ve una entrada de gotcha:

```markdown
## Condición de Carrera en Sincronización de Toast

**Síntoma**: `expect(toast.getText()).toBe('Éxito')` falla intermitentemente
**Causa raíz**: La aserción de texto se ejecuta antes de que el contenido del toast se llene
**Solución**: Añadir `waitForElementToDisplay(toastSelector)` antes de la aserción de texto
**No usar**: `browser.pause()` — usar solo esperas explícitas
```

La memoria crece con el tiempo. Cuando encuentras un nuevo gotcha, lo añades. Cuando descubres un patrón, lo documentas.

Una forma de que esto funcione en la práctica: tratar la actualización de `gotchas.md` como el último paso de cualquier resolución de defecto. Si un test falló en CI y un desarrollador pasó dos horas rastreándolo, la corrección no está completa hasta que el síntoma y la solución estén en la capa de contexto. Eso reencuadra el banco de memoria de una tarea de mantenimiento a un subproducto natural del trabajo que ya estás haciendo.

**Por dónde empezar:** `gotchas.md` es el punto de entrada más fácil. Ábrelo, escribe las últimas tres cosas que causaron un test flaky y añade una solución concreta para cada una. Eso solo ya le ahorrará horas a la siguiente persona — o a la siguiente sesión de IA.

## El Feature Registry: De Intención a Código

El feature registry es lo que hace posible la generación con prompts cortos. Mapea intenciones de negocio a rutas de archivos técnicos, para que el agente no necesite escanear el codebase para encontrar el punto de partida correcto:

```markdown
## Funcionalidad: Flujo de Checkout de Usuario

- Clave de intención: `flow:checkout`
- Variantes: INVITADO, AUTENTICADO
- Spec E2E: e2e/specs/checkout/
- Setup: e2e/specs/checkout/setup.data.ts
- Fixtures: e2e/specs/checkout/fixtures/
- Patrón clave: El estado del carrito debe inicializarse vía API antes de la interacción con la UI
- Referencia de memoria: .cline/memory/domain-a/flows.md → sección Checkout
```

Con esto en su lugar, un prompt como `/generate-test TICKET-123 intent:flow:checkout` le da al agente todo lo que necesita. Conoce las rutas de archivos, las secciones relevantes de memoria y los patrones clave antes de escribir una sola línea.

Sin el registry, el agente necesitaría buscar en 40+ archivos de spec para entender el patrón de checkout. Con él, la búsqueda es instantánea.

## Los Skills: Pipelines Estructurados como Slash Commands

Esto es lo que hace que el sistema se sienta como un agente en lugar de un autocompletado sofisticado. El `SKILL.md` de cada skill contiene el pipeline completo paso a paso — qué leer primero, qué verificar, cuándo detenerse y pedir aprobación. Cuando escribes `/generate-test` en Cline, carga ese skill y sigue el proceso.

Aquí hay una versión condensada de cómo se ve el SKILL.md de `generate-test`:

```markdown
---
name: generate-test
description: Genera un test E2E para una funcionalidad. Usar cuando se pida escribir, crear o añadir un test para un ticket o funcionalidad.
---

# Generar Test E2E

## Paso 1 — Carga de Contexto
Lee los siguientes archivos antes de hacer cualquier cosa:
- `.cline/memory/{equipo}/flows.md`
- `.cline/memory/{equipo}/patterns.md`
- `.cline/memory/shared/gotchas.md`
- `.cline/knowledge/feature-registry.md`

## Paso 2 — Descubrimiento
- Resuelve la clave de intención del feature registry para obtener las rutas de archivos
- Obtén el ticket de Jira via MCP: resumen, descripción y criterios de aceptación
- Escanea el directorio de spec objetivo en busca de helpers y page objects existentes
- Lista qué existe y qué necesita crearse

## Paso 3 — Revisión de Arquitectura (PARAR — esperar aprobación humana)
Presenta un plan técnico:
- Archivos a crear vs reutilizar
- Page objects necesarios
- Helpers necesarios
- Estructura estimada del test

No generes ningún código hasta que el usuario apruebe el plan.

## Paso 4 — Generación
- Escribe el archivo de spec siguiendo estrictamente `.clinerules` y `.cline/memory/shared/gotchas.md`
- Ejecuta el comando de ejecución de tests local para verificar que pasa
- Si el test falla, transiciona automáticamente al skill `/debug-test` y vuelve a ejecutar hasta que pase
```

El `PARAR — esperar aprobación humana` en el paso 3 es la válvula de seguridad clave. Sin ella, el agente generará felizmente 10 archivos, la mitad de los cuales duplican cosas que ya existen. Y el traspaso automático al skill `/debug-test` en caso de fallo en el paso 4 es lo que hace que todo se sienta verdaderamente agéntico — un skill encadena con otro sin que tengas que intervenir.

**Debug Test** (`/debug-test`) sigue el mismo patrón — un skill con un pipeline de 4 pasos en su SKILL.md:

1. Analizar logs, capturas de pantalla y estado del entorno
2. Generar hipótesis (¿problema de selector? ¿timing? ¿datos? ¿entorno?)
3. Aplicar la corrección, volver a ejecutar, verificar que no sea flaky
4. Ejecutar comprobación de regresión, limpiar

El skill de debug hace referencia cruzada a `troubleshooting.md` y `gotchas.md` automáticamente. La mayoría de los fallos de tests flaky caen en un puñado de patrones conocidos — el skill los encuentra en segundos en lugar de minutos.

## Integración MCP: Del Ticket al Test

El paso 2 del skill de generación ya obtiene el ticket de Jira antes de generar cualquier cosa. Con un servidor MCP de Jira configurado en Cline:

```markdown
## Paso 2 — Descubrimiento
- Usa la herramienta MCP de Jira para obtener el ticket {TICKET_ID}
- Extrae: resumen, descripción, criterios de aceptación, tickets vinculados
- Usa los criterios de aceptación como fuente principal de lo que el test debe verificar
- Luego resuelve la clave de intención y escanea el codebase como de costumbre
```

El prompt se convierte en `/generate-test TICKET-123 intent:flow:checkout` y el agente lee los criterios de aceptación directamente desde Jira. El test está fundamentado en el requisito real, no en tu resumen de él.

Esto importa porque la mayor fuente de desviación en los tests es cuando el ticket dice una cosa y el test verifica algo ligeramente diferente. Cuando el agente lee los criterios de aceptación directamente, esa brecha se cierra.

El mismo patrón funciona con Linear, GitHub Issues, o cualquier herramienta que tenga un [servidor MCP](https://docs.cline.bot/mcp/mcp-overview). Los archivos de memoria manejan el *cómo* — patrones, gotchas, rutas de archivos. La conexión MCP maneja el *qué* — qué requiere este ticket específico. Se complementan limpiamente.

## Consistencia Multi-Herramienta

Si tu equipo usa diferentes herramientas IA — Cline, Cursor, Windsurf, GitHub Copilot — cada una tiene su propio formato para reglas de código. Mantener archivos de reglas separados para cada herramienta es una pesadilla de mantenimiento.

La fuente de verdad es `.clinerules`. Los otros formatos son simplemente copias con nombres de archivo diferentes:

| Herramienta | Ubicación del archivo de reglas |
|---|---|
| Cline | `.clinerules` |
| Cursor | `.cursor/rules/` (archivos `.mdc` individuales con frontmatter `globs` / `alwaysApply`) |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |

El enfoque más sencillo es pedirle a tu herramienta IA que genere un script de sincronización — algo como: *"Escribe un script de shell que copie `.clinerules` a las ubicaciones de archivos de reglas para Cursor, Windsurf y GitHub Copilot."* Son unos pocos comandos `cp`. Ejecútalo cuando cambien las reglas y todos se mantienen sincronizados independientemente de qué herramienta usen.

## Lo que Realmente Cambió

| | Antes | Después |
|---|---|---|
| Generar un nuevo test | 30–60 min | 10–15 min |
| Depurar un test flaky | 20–40 min | 5–10 min |
| El agente necesita escanear el codebase | Sí (40+ archivos) | No (la memoria tiene las rutas) |
| Incorporación de nuevo miembro | Semanas | Días |
| Consistencia de reglas multi-herramienta | Manual | Automatizada |

El ahorro de tiempo es real, pero el cambio más significativo es el piso mínimo. Un desarrollador que nunca ha tocado la suite de tests puede generar un test funcional en su primer día, porque los archivos de memoria tienen el contexto que de otro modo tardaría semanas en acumular.

## Qué Haría Diferente

**Empezar los archivos de memoria antes.** Las entradas más valiosas son los gotchas — los problemas de timing y casos extremos que tardaron horas en depurar. Esos deberían documentarse en el momento en que los encuentras, no de forma retroactiva.

**Versionar los archivos de memoria.** Añadir frontmatter `last_updated` facilitaría detectar entradas obsoletas. Un gotcha documentado hace 18 meses puede que ya no aplique después de una actualización del framework.

**Hacer el skill de debug consciente del dominio.** El skill actual de `/debug-test` comprueba primero los patrones generales de troubleshooting. Debería comprobar primero los patrones de fallo específicos del dominio, ya que es más probable que sean la causa para cualquier test dado.

El sistema no es magia — es contexto estructurado. Las herramientas IA ya eran capaces de generar buenos tests. Lo que les faltaba era el conocimiento que los miembros experimentados del equipo llevan en la cabeza. Rules, Skills y archivos de memoria son simplemente una forma de escribir ese conocimiento en un formato que las máquinas pueden usar.

Si tu suite de tests ha crecido hasta el punto en que la incorporación lleva semanas y los tests flaky tardan horas en depurar, el cuello de botella probablemente no es la herramienta IA. Es la capa de contexto que falta.
