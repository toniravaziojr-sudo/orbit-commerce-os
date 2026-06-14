---
name: Aprovar Plano Estratégico não executa — Onda H.1+H.2
description: Aprovação de strategic_plan revalida e gera campaign_proposal filhas; nunca executa, nunca chama Meta, nunca gera criativo. Trigger implement_approved_plan está descontinuado em servidor.
type: constraint
---

## Regra
Quando uma ação `strategic_plan` é aprovada:
1. O servidor revalida o plano (contrato canônico + preflight).
2. Se válido, marca status legado como `approved` (NUNCA `executed`) e grava `action_data.lifecycle.status='plan_approved'`.
3. Gera 1 registro `campaign_proposal` por ação planejada, em `pending_approval`, com snapshot detalhado, vínculo `parent_action_id` + `planned_action_index` + `analysis_run_id`, dedup pelo índice único parcial `idx_aaa_child_dedup_plan_action`.
4. **Não invoca o estrategista. Não gera criativo. Não cria público/lookalike/catálogo. Não chama Meta para mutação.**

## Proibido
- Reintroduzir invocação do `ads-autopilot-strategist` com `trigger='implement_approved_plan'` em qualquer caminho (UI, hook, cron, edge function).
- Marcar `status='executed'` em `strategic_plan` no momento da aprovação. `executed` fica reservado para implementação final (Onda H.4).
- Criar caminho alternativo que gere filhas operacionais (`generate_creative`, `create_lookalike_audience`, `create_campaign`, `create_adset`) a partir da aprovação do plano — toda criação operacional precisa partir da Revisão Final aprovada por etapa.
- Aprovar individualmente uma `campaign_proposal` antes da entrega da Onda H.3 (a função de execução bloqueia em servidor com mensagem PT-BR).

## Por quê
Em 2026-06-14 o plano real `d5ca39cb-6d6b-4af6-99f3-35876378df0c` foi aprovado e disparou imediatamente 5 criativos + 1 tentativa de lookalike duplicado (rejeitada pela Meta), porque a função `ads-autopilot-execute-approved`, ao processar `strategic_plan`, invocava `ads-autopilot-strategist` com `trigger='implement_approved_plan'`, que rodava uma rodada LLM com tools `generate_creative` + `create_lookalike_audience`. Isso violava o princípio "aprovar plano não é aprovar execução".

## Como aplicar em PRs futuros
- Geração de filhas a partir do plano é determinística e vive em `supabase/functions/_shared/ads-autopilot/campaignProposals.ts`. Qualquer novo campo do snapshot deve ser adicionado lá, mantendo a função pura (sem dependência de banco, Meta, crédito ou LLM).
- O killswitch no estrategista (early-return no início de `runStrategistForTenant` quando `trigger==='implement_approved_plan'`) é a barreira final. Não removê-lo "porque está sobrando" — ele protege contra caminhos legados.
- O guard server-side de `campaign_proposal` no executor (early-return com `error_pt`) só pode ser removido quando a Onda H.3 (aprovação individual) estiver entregue, com sua própria lógica de resolução de públicos/catálogos e geração de criativos por campanha.
