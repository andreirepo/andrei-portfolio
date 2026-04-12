---
title: "Revisiones de Código con IA Local en GitHub PRs usando LM Studio y GitHub Actions"
description: "Cómo configuré revisiones automáticas de PRs usando un modelo Qwen2.5 Coder ejecutándose localmente en LM Studio, Tailscale y un runner self-hosted de GitHub Actions — con fallback graceful cuando el PC está apagado."
pubDate: 2025-04-12
tags: ["github-actions", "ai", "lm-studio", "tailscale", "self-hosted", "devops"]
draft: false
---

Quería revisiones automáticas de código en los pull requests sin enviar mi código a una API de terceros. Ya ejecuto LM Studio en mi PC gaming con Windows con `qwen/qwen2.5-coder-14b` y `google/gemma-4-26b-a4b` cargados, y la VM de mi home lab está conectada a la misma red Tailscale. Montarlo todo llevó menos de una hora — una vez que descubrí por qué el Firewall de Windows estaba bloqueando todo silenciosamente.

## La Arquitectura

```
PR abierto → GitHub Actions (runner self-hosted en la VM)
              → health check: ¿LM Studio es accesible?
              → sí: obtener diff → llamar a Qwen → publicar comentario en PR
              → no: publicar aviso "IA offline" → fin
```

El runner self-hosted ya está en la misma VM que el sitio del portfolio (explicado en un [post anterior](/es/blog/self-hosted-cicd-github-actions-ssh-cloudflare)). LM Studio corre en un PC Windows separado conectado via Tailscale.

## Conectar LM Studio por Tailscale

LM Studio tiene un toggle "Serve on Local Network" en la pestaña Developer. Al activarlo, se enlaza a `0.0.0.0:1234`, haciéndolo accesible via la IP de Tailscale.

El problema: cuando Windows ejecutó LM Studio por primera vez y mostró el aviso del firewall, debí hacer clic en la opción incorrecta. Windows creó silenciosamente dos reglas de **bloqueo** para `lm studio.exe` que anulaban todo lo demás — incluyendo las reglas de Allow que añadí manualmente después.

La solución fue eliminar esas reglas de bloqueo:

```powershell
Get-NetFirewallRule | Where-Object { $_.DisplayName -eq "lm studio.exe" -and $_.Action -eq "Block" } | Remove-NetFirewallRule
```

Después de eso, la VM pudo acceder a LM Studio inmediatamente:

```bash
curl http://100.115.80.116:1234/v1/models
# devuelve {"data": [{"id": "google/gemma-4-26b-a4b"}, {"id": "qwen/qwen2.5-coder-14b"}]}
```

## El Workflow de GitHub Actions

El workflow se activa en cada PR abierto o actualizado contra `main`. La decisión de diseño clave fue hacer la revisión de IA completamente opcional — si LM Studio está apagado, el workflow sigue pasando y solo deja un aviso breve.

```yaml
- name: Comprobar disponibilidad de LM Studio
  id: lmstudio-check
  run: |
    if curl -sf --max-time 5 http://100.115.80.116:1234/v1/models > /dev/null 2>&1; then
      echo "available=true" >> $GITHUB_OUTPUT
    else
      echo "available=false" >> $GITHUB_OUTPUT
    fi
```

Cada paso posterior usa `if: steps.lmstudio-check.outputs.available == 'true'` para que se omitan completamente cuando el PC está apagado.

El diff se limita a tipos de archivo relevantes y se recorta a 12KB para no sobrecargar el modelo:

```bash
git diff origin/${{ github.base_ref }}...HEAD \
  -- '*.ts' '*.tsx' '*.astro' '*.js' '*.mjs' '*.css' '*.json' \
  | head -c 12000 > /tmp/pr_diff.txt
```

La llamada a la API usa el endpoint compatible con OpenAI que expone LM Studio:

```bash
PAYLOAD=$(jq -n --arg diff "$DIFF" '{
  model: "qwen/qwen2.5-coder-14b",
  messages: [
    {
      role: "system",
      content: "Eres un ingeniero de software senior haciendo una revisión de código. Sé conciso y práctico. Céntrate en: bugs, problemas de seguridad, problemas de rendimiento y calidad del código. Omite problemas menores de estilo."
    },
    {
      role: "user",
      content: ("Por favor revisa este diff de pull request:\n\n```diff\n" + $diff + "\n```")
    }
  ],
  temperature: 0.3,
  max_tokens: 1500,
  stream: false
}')

curl -sf --max-time 180 \
  -X POST ${{ secrets.LMSTUDIO_URL }}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"
```

`temperature: 0.3` mantiene la revisión enfocada y consistente. `max_tokens: 1500` es suficiente para una revisión completa. El timeout de 120s le da tiempo suficiente a Qwen2.5 Coder 14B.

La revisión se publica como comentario en el PR via `actions/github-script`:

```javascript
await github.rest.issues.createComment({
  owner: context.repo.owner,
  repo: context.repo.repo,
  issue_number: context.issue.number,
  body: `## 🤖 Revisión de Código IA\n\n${review}\n\n---\n*Revisado por Qwen2.5 Coder 14B ejecutándose localmente*`
});
```

## ¿Por Qué Qwen2.5 Coder 14B?

Tengo dos modelos cargados: `qwen/qwen2.5-coder-14b` y `google/gemma-4-26b-a4b`. Qwen Coder está específicamente entrenado en código y da feedback técnico más preciso — entiende patrones específicos de cada lenguaje, detecta bugs potenciales con más fiabilidad y produce comentarios de revisión estructurados. Gemma 4 es un modelo general potente, pero para revisión de código gana un modelo especializado en código.

El tamaño 14B es un punto óptimo — suficientemente rápido para revisar un diff típico de PR en menos de un minuto en una GPU gaming, y suficientemente capaz para detectar problemas reales.

## El Resultado

Cada PR recibe ahora un comentario de revisión automático en 1-2 minutos (dependiendo del tamaño del diff y la carga de la GPU). Cuando mi PC gaming está apagado, el workflow publica un aviso de una línea y termina limpiamente — sin checks fallidos, sin PRs bloqueados.

Todo corre en hardware que ya tengo, no cuesta nada por revisión, y mantiene el código completamente en mi propia infraestructura.
