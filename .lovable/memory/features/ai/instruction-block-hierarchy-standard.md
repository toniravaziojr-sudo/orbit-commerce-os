---
name: Instruction Block Hierarchy Standard
description: Ordem fixa e determinística dos blocos de instrução injetados no prompt da IA de atendimento (Modo Vendas WhatsApp). Aplicada em ai-support-chat antes de buildPromptForState.
type: feature
---

# Hierarquia fixa dos blocos de instrução

## Regra

Antes de chamar `buildPromptForState`, os blocos contextuais de prompt em `ai-support-chat/index.ts` são classificados por prioridade e ordenados de forma estável (sort por `(p,i)`). Pesos oficiais:

| Peso | Categoria | Exemplos |
|------|-----------|----------|
| 10 | Trava dura / Produto em foco / Modo limpo | HANDOFF_AWAITING_HUMAN, product info lock |
| 20 | Reflexos determinísticos (`[REFLEXO ...]`) | CEP, frete, pós-venda, `thanks_terminal`, `social_noise`, `presence_ping` |
| 40 | Continuidade (`CONTINUIDADE`) | Continuity-gate (sem duplicar reflexo) |
| 50 | Âncora do turno (`ÂNCORA DESTE TURNO`) | turn-anchor (suavizado em `catalog_question`) |
| 80 | Contexto comercial / Working memory | Suprimido em buckets `human_request` e `post_sale` |

## Por quê

Antes da Frente Passo 4, 9 blocos eram empilhados em ordem aleatória de inserção. Reflexos terminais (agradecimento, ruído social) competiam com bloco comercial e eram diluídos. Passo 4 fixou a ordem e tornou o prompt auditável.

## Como aplicar

- Todo bloco novo entra com peso explícito. Se não couber em 10/20/40/50/80, escalar antes de criar peso novo.
- Sort estável obrigatório: `(a.p - b.p) || (a.i - b.i)`.
- Reflexos terminais (`thanks_terminal`, `social_noise`, `presence_ping`) sempre em peso 20 com tag `[REFLEXO — ...]`.
- Bloco comercial (peso 80) é podado em `human_request` e `post_sale`.
- Continuity-gate só injeta texto se nenhum reflexo terminal disparou no turno (`socialReflexFired=false`).

## Pendência conhecida

`FALLBACK_PROMISE_BY_STATE` em `ai-support-chat/index.ts` ainda é cego ao `reflexId` ativo: quando o LLM retorna `content` vazio, a muleta hardcoded sobrepõe a hierarquia. Documentado em P-EXEC-4/5 e endereçado no plano de correção pós-Frentes B–E.
