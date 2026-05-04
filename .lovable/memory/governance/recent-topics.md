---
name: Recent topics (rotativo, máx 2)
description: Cache rotativo dos 2 últimos assuntos tratados. Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Assuntos recentes (rotativo)

## 1) IA de Atendimento — AI Provider Routing (PAUSADO, aguardando OpenAI quota)

**Onde paramos exatamente:**
- Fase 1 (TPR via ai-router com Gemini Native primário, OpenAI Native, Lovable Gateway só fallback) ✅ FECHADA e validada (smoke test 2026-05-04, `provider=gemini` real).
- Fase 1.1 (observabilidade resiliente do TPR) ✅ FECHADA. `ai_support_turn_log.metadata.tpr` é fonte canônica de auditoria; `metadata.composer_error` sanitizado é persistido mesmo quando o composer falha (try/catch em `ai-support-chat/index.ts` linhas ~6035–6120).
- **Bloqueio atual:** `OPENAI_API_KEY` retornando `insufficient_quota` (HTTP 429) no composer principal. Validação observacional dos 5–10 turnos não pode rodar até a chave/saldo ser regularizado.
- **Última validação real (turno "oi" 13:46:35Z, tenant `d1a4d0ed-8842-495e-b741-540a9a345b25`):** log persistido via rota de erro; `metadata.composer_error.code="insufficient_quota"`; `metadata.tpr.source="fallback"`, `fallback=true`, `latency_ms=3501`, `error="tpr_timeout_3500ms"` — TPR caiu em regex por timeout (não Gemini Native real); idempotência confirmada (1 registro/turno); sem secrets vazados.
- **Próximo passo combinado com o usuário:** usuário regulariza `OPENAI_API_KEY` em `platform_credentials` ou env, manda "Oi" na IA Teste, eu rodo query de validação do caminho de sucesso (esperado: `metadata.tpr.provider="gemini"`, `model`, `latency_ms`, `source="llm"`, sem `composer_error`, composer responde 200).
- Após sucesso, liberar a validação observacional de 5–10 turnos reais/sandbox para medir taxa de fallback regex e 429.

**Restrições ativas (NÃO violar ao retomar):**
- Não iniciar Fase 2.
- Não migrar composer para ai-router.
- Não alterar chamadas OpenAI diretas do composer/ai-support-chat.
- Não mexer em Catalog Probe / search_products.
- Não mexer em Orchestrator (segue desligado).
- Não promover Onda 1C para `active` (segue `dry_run`).
- Não alterar prompt.
- Não mexer em UI.

**Arquivos tocados nas fases recentes:**
- `supabase/functions/_shared/ai-router.ts` (hierarquia de providers + fix `resolveAPIKeys` priorizando `platform_credentials` sobre env).
- `supabase/functions/_shared/sales-pipeline/turn-pre-router.ts` (usa `aiChatCompletionJSON`, popula objeto `tpr` com provider/model/latency/fallback/source).
- `supabase/functions/ai-support-chat/index.ts` (orquestração + bloco try/catch de log resiliente em caminho de erro do composer).
- `docs/especificacoes/ia/ai-provider-routing.md` (seções 6.1, 7, 9.3).
- `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (Registro #27 — observabilidade resiliente).

**Fonte de verdade documental:** `docs/especificacoes/ia/ai-provider-routing.md` + changelog acima.

**Memórias técnicas relacionadas:** `infrastructure/ai/provider-router-standard`, `constraints/sales-pipeline-tpr-and-output-gates`.

---

## 2) IA de Atendimento — Plano principal de 9 frentes (PAUSADO antes do AI Provider Routing)

- Status: 6 frentes entregues (9, 8, 2, 7, 5, 3); 2 parciais (6, 4); 1 pendente (1 — sandbox stale); Reg #8 (`customerName`) por formalizar.
- Plano completo: `.lovable/plan.md`.
- Doc fonte de verdade: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (Reg #1 a #7 + #2.x).
- Próximo passo (quando voltar): usuário escolhe entre Frente 1 (sandbox stale), Frente 4 (loop confirmação), Frente 6 (tom robótico), Reg #8 (formalizar) ou validação prática.
- Memórias técnicas chave: `sales-pipeline-tpr-and-output-gates` (#2.8), `sales-pipeline-v2-9-working-memory-shadow-mode`, `sales-pipeline-v2-10-focus-snapshot-and-exact-match`, `sales-attribution-venda-ia-tag` (#4), `greeting-formal-tone-no-slang` (#5).
