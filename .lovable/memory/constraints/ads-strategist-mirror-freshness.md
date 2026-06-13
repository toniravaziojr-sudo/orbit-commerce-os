---
name: Ads Strategist — Frescor do Espelho Meta
description: Análise inicial do Gestor de Tráfego IA deve forçar sync condicional de campanhas Meta (>10min) e proibir pausa/ajuste de campanha já PAUSED no prompt.
type: constraint
---

O Strategist do Gestor de Tráfego IA lê de `meta_ad_campaigns` (espelho local atualizado por cron). Mudanças manuais na Meta entre execuções de cron ficam invisíveis e geravam propostas redundantes (pausar campanha já pausada, ajustar verba de campanha parada).

**Obrigatório** em todo fluxo de análise inicial (`ads-ai-initial-analysis`):
1. Antes de invocar o Strategist, verificar `MAX(synced_at)` em `meta_ad_campaigns` para a conta. Se >10 min ou ausente, disparar `meta-ads-campaigns action=sync` apenas para essa `ad_account_id`. Falha silenciosa: se a Meta não responder, seguir com o último estado e registrar limitação amigável (`"Não foi possível atualizar o status das campanhas com a Meta agora — análise usou o último estado conhecido."`).
2. O prompt do Strategist deve declarar explicitamente que a coluna `status` da lista de CAMPANHAS é a fonte de verdade do estado atual e proibir `pause_campaign`/`adjust_budget` sobre campanhas já `PAUSED`/`effective_status` pausado. Reativação só com justificativa explícita.

**Proibido:**
- Sync incondicional (gasta API à toa).
- Sync de adsets/ads/insights nesse pré-passo (escopo é apenas status de campanha).
- Remover a limitação amigável quando o sync falhar — o usuário precisa saber que a análise rodou com dado possivelmente velho.

**Why:** Em 2026-06-13 o usuário reportou repetidamente que a IA sugeria pausar campanhas que ele havia pausado manualmente minutos antes. Causa raiz: cron de 6h em 6h, não havia gatilho de frescor por análise.

**How to apply:** Sempre que mexer em `ads-ai-initial-analysis`, `ads-autopilot-strategist` ou qualquer novo fluxo que leia `meta_ad_campaigns` para sugerir ações sobre campanhas, manter (a) o gate de frescor de 10 min com sync por `ad_account_id` e (b) a regra no prompt. Se alguém propuser remover o gate "para economizar API", lembrar que o throttle de 10 min já limita o custo a no máximo 1 chamada Graph por conta a cada 10 min.
