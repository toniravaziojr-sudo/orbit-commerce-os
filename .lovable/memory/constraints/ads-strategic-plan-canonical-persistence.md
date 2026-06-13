---
name: Ads Strategist — Persistência Canônica Obrigatória do Plano Estratégico
description: O handler do strategic_plan no estrategista DEVE persistir o normalizedPlan completo (com metadata, contract, campaign_account_snapshot, source_flow, analysis_run_id e exclusões por adset). Nunca montar objeto manual achatado.
type: constraint
---

Em 2026-06-13, na auditoria do plano `94b75318-3b48-4ddd-a186-f228c01697b9` (tenant Respeite o Homem, conta `act_251893833881780`), foi confirmado que o estrategista chamava o guard canônico (`normalizeAndValidateStrategicPlanForApproval`) mas, ao montar a resposta de `toolName === "strategic_plan"`, devolvia um objeto manual com apenas alguns campos (`diagnosis`, `planned_actions`, `expected_results`, etc.). Os campos críticos `metadata`, `contract`, `campaign_account_snapshot`, `source_flow`, `analysis_run_id` e o enriquecimento de exclusão por adset (`audience_exclusions` + `excluded_audience_ids` + `targeting.excluded_custom_audiences`) eram **descartados** antes do INSERT em `ads_autopilot_actions`. O painel então renderizava o plano salvo legado e o botão "Aprovar plano" não respeitava o status técnico canônico, mesmo com guard, validator e UI corretos isoladamente.

**Obrigatório** no handler do `strategic_plan` em `supabase/functions/ads-autopilot-strategist/index.ts`:
1. Sempre espalhar `normalizedPlanArgs` (= `guard.normalizedPlan`) **inteiro** no `data` retornado. Os campos explícitos depois do spread (`type`, `ad_account_id`, `strategic_plan_preflight`, `contract`, `approval_status`, `preview`) são apenas reforço — nunca podem substituir, achatar ou omitir o payload canônico.
2. Se `preflightSnapshot` estiver vazio para a conta no momento da resposta, reconstruí-lo aqui mesmo via `resolveCustomerAudienceForMetaAccount` + `buildStrategicPlanPreflightContext` antes de chamar o guard. Sem preflight, o guard cai em `preflight_unavailable` e o plano vira não aprovável — comportamento correto, mas que precisa de fallback determinístico para não bloquear toda análise quando o bloco Onda G do prompt falhar silenciosamente.
3. O `actionRecord.action_data` no insert (linha do `INSERT into ads_autopilot_actions`) é montado como `{ ...result.data, ad_account_id, campaign_name, ...twoStepFields }`. Como `result.data` agora carrega o plano canônico completo, **não adicionar nenhuma transformação intermediária** que remova `metadata`, `contract` ou as exclusões por adset entre o handler e o insert.

**Proibido:**
- Construir manualmente o `data` de resposta do `strategic_plan` listando campos um a um (padrão antigo que perdeu metadata). Sempre `...normalizedPlanArgs` primeiro.
- Persistir `strategic_plan` por qualquer outro caminho sem passar pelo guard canônico. Caminhos legados (`ads-chat-v2`, `ads-chat`) devem salvar como `incomplete` não aprovável.
- Remover o fallback do preflight "para economizar processamento": ele só roda quando o pré-cálculo do prompt falhou e custa 1 query de mapeamento + 1 query de lista; o ganho de segurança compensa.

**Why:** Sintoma reincidente (10+ tentativas anteriores) de plano TOF salvo sem exclusão de clientes por adset, com botão "Aprovar plano" habilitado em plano tecnicamente incompleto, e sugestão de pausar campanha já pausada. Causa raiz não era guard/validator/UI — era o handler de resposta achatando o payload antes da persistência.

**How to apply:** Sempre que mexer no handler do `strategic_plan` (ou criar novo caminho que devolva plano para persistir), abrir este arquivo, conferir que o spread `...normalizedPlanArgs` está presente, conferir que o fallback do preflight está intacto, e rodar `bunx vitest run src/test/ads-strategic-plan-contract.test.ts src/test/ads-strategic-plan-preflight.test.ts` antes de fechar a entrega. Se a suíte passar mas o banco persistir plano legado, o problema voltou para o handler — não para o guard.
