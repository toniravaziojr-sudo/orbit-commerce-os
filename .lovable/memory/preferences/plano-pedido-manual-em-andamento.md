---
name: F2 Motor de Créditos — onde paramos
description: Estado atual do rollout Motor de Créditos / platform_cost_ledger. F2.5 e F2.6 GO; próximas fases F2.7+ pendentes.
type: preference
---

## Contexto ativo

Rollout do **Motor de Créditos — Fase F2 (platform_cost_ledger)**.
Doc oficial: `docs/especificacoes/plataforma/motor-creditos-fase-f2-platform-cost-ledger.md`.

## Status por sub-fase

- **F2.5 — `send-system-email`** → 🟢 GO (validado em 07/05/2026 com 2 envios reais SendGrid).
- **F2.6 — `command-insights-generate` + `ai-learning-aggregator`** → 🟢 GO funcional final em 07/05/2026.
  - `command-insights-generate` v1.1.0: plugada em `recordPlatformCost`, `service_key=command-insights-generate`, `category=ai_text`, custo calculado por tokens reais (Gemini 2.5 Flash).
  - Validação real ponta a ponta: tenant Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`), 4 insights gerados, 564 tokens_in / 313 tokens_out, cost_usd `0.00095170`, ledger_id `4f496e29-af52-430b-a64c-2cad148ff69c`.
  - Idempotência: 2ª chamada retornou `insights_generated:0`, bloqueada antes do Gemini. Sem 2ª linha em ledger.
  - Tenant **não foi cobrado**: `credit_wallet`, `credit_ledger`, `service_usage_events` intactos.
  - `ai-learning-aggregator` classificada como **não aplicável** (sem provider externo).
  - Doc atualizado com seção 13 "Evidência F2.6 — 2026-05-07".

## Achados paralelos NÃO corrigidos (pendentes)

1. **Cron `generate-weekly-insights`**: envia anon key, mas edge só ativa ramo cron com service_role → cai em "Manual call" → 401 silencioso. Refatoração da edge necessária (não do cron).
2. **`get_auth_user_email`**: `permission denied` na tela `/platform/emails` (card de Templates). Task separada `b70aa82b`. RLS/grant.

## Próximo passo combinado

Iniciar **F2.7 em modo PLANNER** (somente diagnóstico, sem execução).
Objetivo: mapear próxima edge candidata a `recordPlatformCost` (ainda não plugada, com `cost_owner=platform`, chamando provider externo IA/email/infra).

## Restrições firmes

- Não corrigir cron `generate-weekly-insights` sem autorização.
- Não corrigir `get_auth_user_email` sem autorização.
- Não iniciar F2.7 sem autorização explícita.
- Toda nova fase começa em PLANNER, executa só após GO do operador.
- Nunca processar mais de 1 tenant em validação real.
- Nunca apagar linha real de `platform_cost_ledger` (custo real é histórico imutável).

## Referências

- Doc F2: `docs/especificacoes/plataforma/motor-creditos-fase-f2-platform-cost-ledger.md`
- Doc funções pagas: `docs/especificacoes/plataforma/funcoes-pagas.md`
- Edge: `supabase/functions/command-insights-generate/index.ts` (v1.1.0)
- Helper: `supabase/functions/_shared/credits/charge.ts` → `recordPlatformCost`
- Memory relacionada: `mem://features/command-center/ai-command-insights-v1-0-ptbr-v2`
