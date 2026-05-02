---
name: Onda 18 Fase B.2 — Papéis de modelo separados (Composer vs TPR vs Planner vs Critic)
description: EffectivePolicy.ai_model deixa de ser um campo único e ambíguo. Adicionados model_response_composer, model_classifier_tpr, model_planner, model_critic. Default do composer elevado para openai/gpt-5. Tenant Respeite o Homem migrado de gemini-2.5-flash → openai/gpt-5. Handler não rebaixa mais composer forte para gpt-5-mini em sales mode.
type: feature
---

## Regra (vinculante)

A IA de atendimento/vendas tem PAPÉIS de modelo separados. É proibido tratar `ai_model` como modelo único para todas as etapas.

| Papel | Campo no EffectivePolicy | Default | Onde roda |
|---|---|---|---|
| Response Composer (resposta final ao cliente) | `model_response_composer` | `openai/gpt-5` | `ai-support-chat/index.ts` no loop de tool-calling |
| Classifier TPR (rotula turno) | `model_classifier_tpr` | `google/gemini-2.5-flash-lite` | `_shared/sales-pipeline/turn-pre-router.ts` |
| Planner (Fase C+) | `model_planner` | `null` | a definir |
| Critic (Fase C+) | `model_critic` | `null` | a definir |

`ai_model` continua existindo como **alias deprecated** do composer (compat). `tenant.ai_model` ainda é lido como override do composer, **mas só vale se for um modelo "forte"** (gpt-5*, gemini-pro, gemini-3*-pro). Valores `flash`/`flash-lite`/`mini`/`nano` herdados de defaults antigos são tratados como ruído e ignorados em favor do default do composer.

## Por que B.2 existiu

Auditoria do tenant Respeite o Homem (piloto) revelou:
- `ai_support_config.ai_model = "google/gemini-2.5-flash"` (não foi escolha consciente — herdado de seed/UI antiga)
- Handler aplicava mapping `flash → gpt-5-mini` em sales mode
- Resultado: composer real era `gpt-5-mini`, fraco para venda consultiva

## Mudança no handler (`ai-support-chat/index.ts`)

- Lê `effectivePolicy.model_response_composer.value` (não mais `ai_model.value`)
- Em sales mode, **só rebaixa para gpt-5-mini se o composer for fraco** (nano/flash-lite/flash/mini-não-gpt5). gpt-5, gpt-5.2, gpt-5-mini explícito e modelos pro são preservados.
- Loga `[B.2] composer=<modelo> source=<base|tenant|default> tpr=<modelo>` em todo turno.

## Migration aplicada

`UPDATE ai_support_config SET ai_model='openai/gpt-5' WHERE tenant_id='d1a4d0ed-...' AND ai_model ILIKE '%flash%|%mini%|%nano%'`

Tornou explícito na UI/config que o tenant usa GPT-5 no composer.

## Impacto custo/latência

- **Antes**: composer real `gpt-5-mini` (rápido, ~$0.25/1M in)
- **Depois**: composer `gpt-5` (mais lento ~2-3x, ~$1.25/1M in)
- TPR continua flash-lite (sem mudança)
- Trade-off aceito: piloto único, qualidade de venda consultiva > custo

## Como reverter (kill switch)

Reverter o composer para gpt-5-mini sem mexer em código:
```sql
UPDATE ai_support_config SET ai_model='openai/gpt-5-mini'
WHERE tenant_id='d1a4d0ed-8842-495e-b741-540a9a345b25';
```
Mas atenção: `gpt-5-mini` cai na regra de "fraco" e seria rebaixado de novo. Para reverter de fato, usar `'openai/gpt-5-mini'` (que é considerado forte por conter `gpt-5`) — sales mode preserva. Para forçar gemini-2.5-flash de volta, precisa também alterar a regra `isStrongComposer` no policy-compiler.

## Anti-regressão

- ❌ Não voltar a usar `effectivePolicy.ai_model.value` no handler — usar `model_response_composer`.
- ❌ Não rebaixar globalmente o composer para `gpt-5-mini` em sales mode quando ele já é forte.
- ❌ Não confundir TPR (flash-lite, ok) com composer (gpt-5).
- ❌ Não criar um único `ai_model` ambíguo no UI sem deixar claro qual papel ele controla.
- ✅ Próximas fases (C+) DEVEM declarar `model_planner` / `model_critic` no policy antes de usar.
