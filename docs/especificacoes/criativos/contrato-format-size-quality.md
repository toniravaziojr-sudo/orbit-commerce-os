# Contrato format/size/quality — Criativos (Imagem)

**Versão:** 10.1
**Edge:** `creative-image-generate`
**UI:** `src/components/creatives/image-generation/ImageGenerationTabV3.tsx` + `types.ts`
**Resolver:** `supabase/functions/_shared/credits/image-resolver.ts`
**Catálogo:** Fal GPT Image 1.5 (`service_pricing` keys `fal.gpt-image-1.5.per_image.*`)

## Por quê

A tentativa A3.3 (live controlado para `medium_1024x1536`) caiu corretamente em shadow porque a UI e o edge `creative-image-generate` enviavam `outputSize` fora do catálogo (`1024x1792`, `1792x1024`) ou hardcoded (`1024x1024`), independente do formato escolhido. Este doc fixa o contrato pós-A3.3.

## Formatos suportados

A UI expõe **somente** os 3 sizes que existem em `service_pricing`:

| UI label                | format interno | outputSize    | service_key (medium)                           |
|-------------------------|----------------|---------------|------------------------------------------------|
| Quadrado (1024×1024)    | `square`       | `1024x1024`   | `fal.gpt-image-1.5.per_image.medium_1024`      |
| Retrato (1024×1536)     | `portrait`     | `1024x1536`   | `fal.gpt-image-1.5.per_image.medium_1024x1536` |
| Paisagem (1536×1024)    | `landscape`    | `1536x1024`   | `fal.gpt-image-1.5.per_image.medium_1536x1024` |

Labels `9:16` e `16:9` foram removidos. Sizes `1024x1792` / `1792x1024` deixam de ser enviados.

## Qualidade

- Default explícito **`medium`** nesta fase. Badge "Média (padrão)" exibido na UI com tooltip "Low e High serão liberados futuramente."
- Resolver continua suportando `low` / `high` no backend; só não há seletor na UI.
- Para `low`, sizes retangulares caem em `low_other` (regra atual do resolver, intencional).

## Payload UI → edge

A UI envia em `settings`:

```json
{
  "format": "portrait",          // square | portrait | landscape
  "output_size": "1024x1536",    // redundante mas explícito
  "quality": "medium",
  "variations": 2,
  ...
}
```

## Normalização única no edge

`creative-image-generate/index.ts` tem **um único** ponto de normalização — `normalizeImageGenerationOptions(input)` — que:

1. Aceita aliases legados (`1:1`, `9:16`, `16:9`, `2:3`, `3:2`) por compat retroativa.
2. Resolve para um par `(format, outputSize)` sempre dentro do catálogo.
3. Usa `medium` se `quality` ausente; aceita `low`/`high`.
4. Defaults seguros: `format=square` (1024x1024), `quality=medium`.

A partir da normalização, **todos os caminhos** (geração normal, edit-image com produto, retry, variações, fallback shadow, sidecar pre-router, persistência em `creative_jobs.settings`, RPC reserve/capture do Motor v2) usam as mesmas variáveis `outputSize` e `quality`. **Nenhum hardcode `'1024x1024'` / `'medium'` permanece** fora da função de normalização (defaults).

## Edit-image (com imagem de referência)

`resilientGenerate` repassa `outputSize` para `generateImageWithGptImage1`, que envia `image_size` ao Fal mesmo no modo `edit-image`. O formato escolhido pelo lojista é sempre respeitado — não há mais herança automática de 1024x1024 da imagem fonte.

## Live target derivado

`LIVE_TARGET_KEY` deixou de ser fixo `medium_1024`. Agora é derivado por job:

```
fal.gpt-image-1.5.per_image.{quality}_{sizeSuffix}
```

onde `sizeSuffix` é `1024` para 1024x1024 ou o próprio `outputSize` para retangulares. Resultado: cada combinação só ativa fluxo Motor v2 LIVE se sua service_key específica estiver em `tenant_credit_motor_config.live_service_keys`.

## Validação automatizada

Matriz coberta por `supabase/functions/_shared/credits/image-resolver_matrix_test.ts` (9 testes — 3 sizes × 3 qualidades + caso crítico Retrato+medium + bloqueio dos sizes legados 1024x1792/1792x1024). Comando: `supabase functions test`.

## Histórico

- **v10.0** (2026-04): UI prompt-only, formatos 1:1/9:16/16:9 com sizes 1024x1024/1024x1792/1792x1024. Hardcodes espalhados no edge.
- **v10.1** (2026-05-06): este contrato. Formatos alinhados ao catálogo, normalização centralizada, badge de qualidade, LIVE_TARGET_KEY dinâmica.
