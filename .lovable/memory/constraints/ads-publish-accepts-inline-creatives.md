---
name: Ads — Publicação aceita criativos anexados/gerados no próprio assistente
description: ads-autopilot-publish-proposal lê criativos de planned_creatives/ads (anexo PC, Drive, IA inline) e não exige lifecycle campaign_creatives_ready do fluxo legado em lote.
type: constraint
---

## Regra

A publicação de Proposta de Campanha na Meta deve aceitar criativos vindos de qualquer um destes caminhos, sem depender exclusivamente do fluxo antigo de geração em lote (`creative_jobs` + lifecycle `campaign_creatives_ready`):

1. Anexo do PC pelo usuário no assistente da proposta.
2. Anexo via Drive pelo usuário no assistente da proposta.
3. Geração inline por IA no próprio card da proposta.
4. (Legado) `creative_jobs` em lote do fluxo H.4.1, quando existir.

Lifecycles aceitáveis para tentar publicar: `structure_approved_awaiting_creatives`, `campaign_creatives_generating`, `campaign_creatives_ready`, `campaign_creatives_failed`, `campaign_implementation_failed`.

A verdade da URL final do criativo está, nesta ordem: `ads[i].creative_final_url` → `ads[i].creative_url` → `ads[i].asset_url` → `ads[i].image_url` → `planned_creatives[i].creative_final_url` → `planned_creatives[i].image_url` → `planned_creatives[i].creative_url` → `planned_creatives[i].asset_url`. Copy/headline/CTA/destino também são mesclados de `ads[i]` por cima de `planned_creatives[i]`, porque é em `ads[i]` que o usuário edita na UI.

Se, mesmo assim, não houver nenhum criativo com URL final, a publicação responde com mensagem clara: "Nenhum criativo anexado ou gerado. Anexe ou gere ao menos um criativo antes de publicar."

## Por quê

Antes desta regra, a publicação travava com "Esta proposta ainda não está pronta para publicação" porque exigia lifecycle `campaign_creatives_ready` (só setado pelo trigger SQL ao final dos jobs em lote) e lia somente `lifecycle.creative_jobs`. Como o fluxo atual permite ao lojista anexar/gerar criativo no próprio assistente, propostas válidas ficavam impossíveis de publicar.

## Implementação

`supabase/functions/ads-autopilot-publish-proposal/index.ts` — bloco "Coleta de criativos prontos". Proibido voltar à dependência exclusiva de `lifecycle.creative_jobs`.
