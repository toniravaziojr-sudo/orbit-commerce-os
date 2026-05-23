---
name: Modo Vendas — 4 reflexos determinísticos do roteador
description: CEP isolado, pergunta de frete, pergunta de pós-venda e turno curto com intent classificado nunca podem cair em fallback de descoberta. Reflexos rodam após decideNextState e antes de buildPromptForState.
type: constraint
---

## Regras invioláveis (Reg #2.17 Fase 3)

`deterministic-reflexes.ts` roda **depois** de `decideNextState` e **antes** de `buildPromptForState`, sobre o turno consolidado pelo Turn Orchestrator. Detecta 4 desvios e aplica override de estado + bloco de instrução curta no prompt.

### Reflexos

1. **CEP recebido** (regex `\d{5}-?\d{3}`):
   - Carrinho ativo → força `checkout_assist` + ordem de chamar `calculate_shipping`.
   - Sem carrinho → mantém estado, confirma CEP em uma linha e pede produto/família.

2. **Pergunta de frete** (TPR `asked_about_shipping=true` ou regex):
   - Carrinho + CEP → força `checkout_assist` + chama `calculate_shipping`.
   - Carrinho sem CEP → pede CEP em uma linha e para. Proibido prazo genérico.
   - Sem carrinho em `greeting` → vai para `recommendation`, oferece ajuda de escolha.

3. **Pergunta de pós-venda** (TPR `is_support_topic=true` ou regex de "meu pedido", "rastreio", "não chegou"):
   - Força `support`. Proibido responder com pergunta de descoberta de venda.

4. **Turno curto + intent classificado** (≤4 palavras, estado em `greeting`/`discovery`, intent `purchase_intent`/`product_named`/`family_or_objective_query`):
   - Com `lastFocusedProductName` + `product_named` → `product_detail`.
   - Caso geral → `recommendation`.
   - Proibido "Me conta o que você precisa" / pergunta de descoberta ampla.

### Princípios

- **Aditivo:** se nenhum reflexo dispara, retorna `null` e o estado é o de `decideNextState`.
- **Consome o turno consolidado** (não o último fragmento). Respeita Turn Orchestrator.
- **Respeita Reg #2.8** (TPR como fonte primária de classificação).
- **Respeita Reg #2.17 Fases 1–2** (dor não é reclamação; handoff tem motor único).

## Por quê

Auditoria das ondas A–D mostrou:
- B1, B3 (turno curto com intenção) → "Me conta o que você precisa…"
- D2 (CEP isolado) → IA ignorava CEP e voltava para descoberta.
- D3 (pós-venda) → IA tentava vender produto novo.

O classificador acertava o intent; o roteador não consumia. Os 4 reflexos consomem o intent já classificado e ancoram o comportamento esperado.

## Como aplicar

- Toda nova categoria de desvio reconhecível (ex.: CPF isolado, ID de pedido isolado) deve virar novo reflexo no mesmo módulo, com regra de override de estado + bloco de prompt.
- Reflexo nunca substitui prompt do estado — só anexa bloco curto via `contextualBlocks`.
- Threshold de "turno curto" = 4 palavras. Não aumentar sem revalidar a bateria.
- Cenários B1, B3, D2, D2b, D3 viram testes fixos.

## Fonte de verdade

- Doc formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — Registro #2.17 Fases B–C.
- Código: `supabase/functions/_shared/sales-pipeline/deterministic-reflexes.ts`, integração em `supabase/functions/ai-support-chat/index.ts` (após `decideNextState`, antes de `buildPromptForState`).
