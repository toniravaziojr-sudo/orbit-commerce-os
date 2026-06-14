---
name: Aprovar Plano e Aprovar Proposta de Campanha — Ondas H.1+H.2+H.2.1+H.3
description: Aprovação de strategic_plan gera filhas sem executar; aprovação individual de campaign_proposal (H.3) só marca lifecycle, sem chamada Meta, sem criativo, sem público/catálogo.
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

## Renderização de campaign_proposal (UI — H.2 + H.2.1)
A `campaign_proposal` grava `action_data.schema_version = "campaign_proposal_v1"` com `campaign{}`, `adsets[]`, `planned_creatives[]`, `identity{}`, `pending_fields[]`, `meta_step_checklist[]`, `objective_contract_label_pt`, `raw_planned_action`. A UI lê via `normalizeCampaignStructure` (rama `fromCampaignProposalV1`), que cruza o dialeto H.2 com `raw_planned_action.adsets[i]` para preencher idade/gênero/local/orçamento/audience_type/optimization_goal/conversion_event quando vierem só no raw. **Não criar tela nova**: usa o `StructuredProposalModal` existente. A aba Campanha mostra o bloco "Identidade e rastreamento da conta" (página, IG, pixel, CAPI, evento, atribuição, CTA padrão, UTM base); a Visão Geral mostra "Passo a passo Meta" com status por etapa + "Campos pendentes" listando o que falta por contrato de objetivo. Botão Aprovar fica desabilitado (mensagem PT-BR de próxima etapa) até a Onda H.3.

## Identidade da conta nunca depende do LLM (H.2.1)
A identidade (página, IG, pixel, CAPI, evento padrão, atribuição, CTA padrão, UTM base, idade/local/posicionamento padrão) é **resolvida server-side** em `accountDefaults.ts` lendo `ads_meta_production_config` + `tenant_meta_integrations` antes de chamar o builder. O LLM NÃO precisa inventar nenhum desses campos. Quando ausentes na conta, viram pendência explícita em `pending_fields` (sem bloquear a proposta — gate fica para H.3).

## Onda H.3 — Aprovação individual da Proposta de Campanha (2026-06-14)
Aprovar uma `campaign_proposal` filha **não chama Meta**, **não gera criativo**, **não cria público/lookalike/catálogo**, **não consome crédito**. O executor (`ads-autopilot-execute-approved` v4.3.0-h3) só valida campos critical-publish e marca `status='approved'` + `action_data.lifecycle.status='campaign_creatives_generation_pending'`.

### Gate publish-critical (servidor é a fonte da verdade)
Bloqueia aprovação com erro `campaign_proposal_has_publish_critical_blockers` se faltar:
- `campaign.name`, `campaign.objective`, `campaign.daily_budget_cents > 0`
- `adsets.length >= 1`
- `identity.facebook_page_id`
- `identity.pixel_id` (quando objetivo é sales/leads/conversion)
- Público de Clientes sincronizado (quando funil é frio — `isColdFunnelStage`)

Pendências ad-level (copy/headline/cta/link/criativo final) **não** bloqueiam aqui — ficam para a H.4. O `StructuredProposalModal` replica o gate apenas para feedback imediato; o servidor revalida.

### Proibido em H.3
- Spawn de `create_campaign`/`create_adset`/`create_ad` ou qualquer ação que chame Meta.
- Geração de criativo (não importa o provedor).
- Criação/sync de público, lookalike ou catálogo.
- Consumo de crédito.
- Mudar `lifecycle.status` para `campaign_implemented` ou `campaign_ready_for_implementation` (este último fica para a H.4 após criativos prontos).

### Próximas ondas (ainda não entregues)
- **H.4**: geração de criativos por proposta → revisão final → publicação em modo ATIVO com `start_time` na próxima janela 00:01 BRT (usar `getSchedulingParams()` já existente).
- **H.5**: aprendizados editáveis em `ads_ai_learnings` (hook `useAdsAILearnings` já existe).
