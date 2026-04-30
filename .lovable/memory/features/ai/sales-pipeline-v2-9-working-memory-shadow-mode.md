---
name: Sales Pipeline v2.9 — Working Memory + Stage Machine (Shadow Mode)
description: Onda 2 do Reg #2.9. Tabela conversation_sales_state com 7 estágios (social_only/exploring/needs_known/evaluating/buying_intent/closing/post_sale) é a fonte única de memória persistente da conversa de vendas. Módulos working-memory.ts (load/patch/hashQuestion) e stage-machine.ts (decideStage com anti-regressão + STAGE_TO_PIPELINE_STATE mapeando para os 8 PipelineState legados) rodam em ai-support-chat APÓS o TPR e ANTES da gravação de nextPipelineState. Nesta onda é shadow mode: loga e persiste, NÃO altera resposta. Onda 3 ativará prompts por estágio. Onda 4 ativará tool-filter por estágio.
type: feature
---

## Estado atual (30/abr/2026)

**Onda 1 (concluída):** tabela `conversation_sales_state` (1:1 com `conversations`, UNIQUE em `conversation_id`). RLS: service_role total, authenticated lê via `user_has_tenant_access`, anon bloqueado.

**Onda 2 (concluída — shadow mode):**
- `_shared/sales-pipeline/working-memory.ts` — `loadSalesState()`, `patchSalesState()`, `hashQuestion()` (FNV-1a determinístico).
- `_shared/sales-pipeline/stage-machine.ts` — `decideStage()` com anti-regressão; `STAGE_TO_PIPELINE_STATE` mapeia 7 estágios → 8 PipelineState legados.
- Plugado em `ai-support-chat/index.ts` em 2 pontos: pós-TPR (load + decideStage + log) e pós-nextPipelineState (patchSalesState).
- TPR NÃO foi estendido — campos atuais cobrem todas as transições.

## Regras anti-regressão

1. **NUNCA usar `decideStage` para alterar a resposta enquanto estiver em shadow mode.** A máquina antiga (`decideNextState` + `family_focus` + `pending_action`) continua sendo a fonte de verdade do que a IA fala. Romper isso sem virar Onda 3 = regressão grave no pipeline F2-V3/V4.
2. **`loadSalesState` deve ser idempotente.** O UNIQUE em `conversation_id` garante 1:1; se falhar com 23505, relê. Nunca duplicar registros.
3. **`patchSalesState` é merge parcial.** Nunca sobrescrever arrays inteiros (`presented_families`, `asked_question_hashes`) sem `add_*` — só append único.
4. **`customer_declared_pain` só grava se ainda for null.** A primeira dor declarada vence — evita que a IA "esqueça" o motivo original do cliente.
5. **Anti-regressão de estágio:** `decideStage` bloqueia queda de rank (ex.: `closing` → `exploring`) a menos que haja sinal explícito (suporte, nova dor, novo produto).
6. **Falhas em working memory são silenciosas.** `try/catch` em volta de load e patch — se o banco falhar, o pipeline F2 segue normal. Working memory é melhoria, não dependência.

## Como validar (shadow mode)

```sql
-- Memória persistida de uma conversa específica
SELECT stage, customer_declared_pain, presented_product_ids,
       customer_named_families, upsell_offered_count,
       commercial_signals, last_greeting_at
FROM conversation_sales_state
WHERE conversation_id = '<uuid>';
```

Logs do edge function `ai-support-chat` (buscar por `[Reg #2.9]`):
- `[Reg #2.9] [shadow] stage=… suggested=… pipeline_state=… reason=… regressed=… presented=… pain=… upsell_offered=…`

## Próximas ondas

- **Onda 3** — prompts por estágio leem working memory (anti-repetição via `asked_question_hashes`, dor declarada como contexto, evitar produtos em `presented_product_ids`, controlar upsell). `decideStage` vira fonte de verdade no lugar de `decideNextState`.
- **Onda 4** — tool-filter por estágio comercial (não mais por PipelineState legado). Documentação Layer 3 `sales-pipeline-v3.md` criada como spec final.

## Doc formal

- Layer 3 `sales-pipeline-v3.md` — pendente (será criado na Onda 4 quando a arquitetura virar fonte de verdade ativa).
- Changelog: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` Reg #2.9.
