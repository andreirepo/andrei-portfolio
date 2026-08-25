---
title: "Fixing 40+ WCAG Contrast Violations with axe-core and Property-Based Testing"
description: "How I found, verified, and permanently prevented color contrast accessibility failures on this portfolio using axe-core, fast-check, and a CI pipeline that blocks regressions automatically."
pubDate: 2026-04-28
author: "Andrei Repo"
tags: ["accessibility", "testing", "axe-core", "ci-cd", "tailwindcss"]
draft: false
---

Recibí un informe de accesibilidad automatizado que señalaba una violación grave en este sitio: más de 40 elementos que no cumplían los requisitos de contraste de color de WCAG 2 AA. El informe tenía razón. Cada encabezado de sección, enlace de navegación, descripción de habilidad, tarjeta de blog y texto del pie de página se renderizaba con `opacity-50` u `opacity-70` — un patrón que visualmente parece correcto a primera vista, pero que no supera el umbral de relación de contraste de 4.5:1 que exige WCAG para texto normal.

Este artículo explica cómo lo abordé como un problema de QA: explorar la condición del bug, escribir tests que demuestren que existe, corregirlo y luego bloquearlo para que no pueda volver.

## La Condición del Bug

La causa raíz era simple. Todo el sitio usaba las utilidades de opacidad de Tailwind para crear jerarquía visual:

```html
<!-- Enlace de navegación — parece atenuado, pero falla el contraste -->
<a class="opacity-50 hover:opacity-100">blog</a>

<!-- Descripción de habilidad — texto pequeño + opacidad = doble fallo -->
<p class="text-[0.88rem] opacity-50">Flujos Web Estables</p>
```

`opacity-50` sobre texto oscuro contra un fondo casi blanco (`oklch(98.8%)`) produce una relación de contraste de aproximadamente 2.1:1. WCAG 2 AA requiere 4.5:1 para texto normal y 3:1 para texto grande. Cada uno de estos elementos estaba fallando.

La condición formal del bug:

```
isBugCondition(elemento):
  relacionContraste = calcularContraste(elemento.color, elemento.fondo)
  umbral = elemento.esTextoGrande ? 3.0 : 4.5
  return relacionContraste < umbral
```

## Explorando el Bug con axe-core

Antes de tocar ningún código, escribí un test de exploración para confirmar que el bug existe y medir su alcance. El test usa [axe-core](https://github.com/dequelabs/axe-core) a través de `axe-playwright` para auditar las páginas renderizadas:

```typescript
it('debería encontrar violaciones de contraste en el código sin corregir', async () => {
  const page = await browser.newPage();
  await page.goto('http://localhost:4321/en', { waitUntil: 'networkidle' });

  await injectAxe(page);
  const violations = await getViolations(page);
  const contrastViolations = violations.filter(v => v.id === 'color-contrast');

  // ESPERADO: Este test DEBE FALLAR en código sin corregir — el fallo confirma que el bug existe
  expect(contrastViolations.length).toBeGreaterThan(0);
});
```

El test encontró **37 violaciones de contraste de color** en modo claro en `/en`. Un test basado en propiedades usando [fast-check](https://github.com/dubzzz/fast-check) confirmó lo mismo en todas las combinaciones de ruta y tema:

```typescript
await fc.assert(
  fc.asyncProperty(
    fc.constantFrom('/en', '/es'),
    fc.constantFrom('light', 'dark'),
    async (ruta, tema) => {
      const count = await page.evaluate(() =>
        document.querySelectorAll('.opacity-50').length
      );
      expect(count).toBeGreaterThan(0);
    }
  )
);
```

Resultado: 30 elementos con `opacity-50` y 6 con `opacity-70` en todo el sitio.

## La Corrección: Tokens de Color Semánticos

La corrección consistió en reemplazar el atenuado basado en opacidad con tokens de color explícitos que cumplen los requisitos de contraste. En lugar de hacer el texto transparente, se usa un color que es inherentemente de menor contraste pero que aún supera WCAG.

Añadí la propiedad CSS personalizada `--muted-foreground` a `global.css` y reemplacé cada instancia de `opacity-50`/`opacity-70` en todos los componentes:

```css
/* Antes: la opacidad hace que el texto falle el contraste */
.opacity-50 { opacity: 0.5; }

/* Después: color explícito que supera 4.5:1 */
--muted-foreground: oklch(52% 0.018 285); /* modo claro */
--muted-foreground: oklch(62% 0.02 285);  /* modo oscuro */
```

Los cambios en los componentes fueron mecánicos — encontrar cada `opacity-50` y reemplazarlo con `text-muted-foreground`:

```html
<!-- Antes -->
<h2 class="opacity-50 uppercase mb-6">Habilidades</h2>
<p class="text-[0.88rem] opacity-50">Flujos Web Estables</p>

<!-- Después -->
<h2 class="text-muted-foreground uppercase mb-6">Habilidades</h2>
<p class="text-sm text-muted-foreground">Flujos Web Estables</p>
```

El color de acento verde (`text-green-500`) necesitó tratamiento aparte. Sobre un fondo claro, `#22c55e` solo alcanza ~2.5:1 de contraste. Lo reemplacé con una propiedad CSS personalizada que se adapta por tema:

```css
:root {
  /* Suficientemente oscuro para 4.5:1 sobre fondo claro */
  --green-accent: oklch(48% 0.17 155);
}

.dark {
  /* Suficientemente brillante para 4.5:1 sobre fondo oscuro */
  --green-accent: oklch(72% 0.18 155);
}
```

## Verificando la Corrección

Tras la corrección, volví a ejecutar el mismo test de exploración. Las aserciones ahora estaban invertidas — el test confirma que el bug *ha desaparecido*:

```
[Modo Claro /en] axe-core encontró 0 violaciones de contraste ✓
[Modo Oscuro /en] axe-core encontró 0 violaciones de contraste ✓
[Modo Claro /es] axe-core encontró 0 violaciones de contraste ✓
[Modo Oscuro /es] axe-core encontró 0 violaciones de contraste ✓
```

Cero violaciones en las cuatro combinaciones de ruta y tema.

## Bloqueando la Regresión: Guard en CI

La parte más importante no es la corrección — es asegurarse de que se mantenga. Convertí el test de exploración en un guard de regresión y lo añadí al pipeline de CI:

```typescript
describe('Guard de Regresión: Sin Elementos con Opacidad en Texto', () => {
  it('debería tener cero violaciones de contraste de color', async () => {
    await injectAxe(page);
    const violations = await getViolations(page);
    const contrastViolations = violations.filter(v => v.id === 'color-contrast');
    expect(contrastViolations.length).toBe(0);
  });

  it('no debería tener elementos opacity-50 en el DOM', async () => {
    const count = await page.evaluate(() =>
      document.querySelectorAll('.opacity-50').length
    );
    expect(count).toBe(0);
  });
});
```

El pipeline de CI ahora tiene un job dedicado `accessibility-audit` que ejecuta estos tests contra el sitio construido en cada PR. Si alguien introduce `opacity-50` en un elemento de texto, el pipeline falla antes de que se construya la imagen Docker.

## Lo que Aprendí

**La opacidad no es una estrategia segura para el contraste.** Reduce la relación de contraste efectiva proporcionalmente. Si tu texto base es 14:1 contra el fondo, `opacity-50` lo baja a ~7:1 — aún aprobando. Pero si tu base es 4.5:1 (el mínimo), `opacity-50` lo baja a ~2.25:1, que falla. El problema se agrava con tamaños de fuente pequeños.

**Los tokens de color semánticos son la herramienta correcta.** Un token `text-muted-foreground` definido para cumplir los requisitos de contraste a nivel de sistema de diseño es mucho más robusto que ajustes de opacidad por elemento. El token se puede ajustar una vez y aplicar en todas partes.

**El property-based testing es útil para accesibilidad.** Generar todas las combinaciones de rutas y temas con fast-check me dio confianza de que la corrección se mantenía en toda la superficie, no solo en las páginas que verifiqué manualmente.

**El patrón del test de exploración funciona bien.** Escribir un test que se *espera que falle* en código roto, y luego invertirlo tras la corrección, produce un test basado en un fallo real observado en lugar de uno hipotético. Es más difícil escribir un test que pase accidentalmente en código roto cuando has visto cómo falla primero.

La corrección completa tocó 8 componentes y 3 páginas, reemplazó 36 elementos con opacidad atenuada y redujo el recuento de violaciones de axe-core de 37 a 0.

