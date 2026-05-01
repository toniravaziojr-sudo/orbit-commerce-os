---
name: IA Vendas — fechamento confirmado nunca pode virar nova pergunta confirmatória
description: Quando TPR detecta intenção de fechamento e a IA não chama generate_checkout_link, defesa em 2 camadas força a tool ou marca duplicata para regeneração. Frente 3 / Reg #2.16.
type: constraint
---

## Regra

No `ai-support-chat` em sales mode, é PROIBIDO que a resposta da IA contenha pergunta confirmatória de fechamento (`/posso (gerar|mandar|enviar|finalizar) (o )?(link|pedido)/i`, `/quer que eu (gere|mande|envie|finalize)/i`, `/confirma (que|se) (quer|vai|posso)/i`, `/conseguiu pegar os dados/i`) quando:

- `TPR.confirmed_purchase_intent === true` OU `TPR.asked_about_payment_or_link === true`, E
- nenhuma `generate_checkout_link` foi chamada com `success=true` neste turno, E
- a resposta não contém URL `https?://`.

## Defesa em duas camadas (ambas obrigatórias)

1. **Camada de prevenção — Auto-Ready (`ai-support-chat/index.ts`).** `checkoutChecklist.ready` deve ser `true` mesmo com carrinho vazio quando há **exatamente 1 produto apresentado** OU **foco ativo** com no máximo 1 produto presented. Isso libera o FIX-B (`tool_choice=generate_checkout_link`) a forçar a tool, e o handler aplica o auto-add da Reg #2.15 (qty=1, sem variantes mandatórias).

2. **Camada de rede de segurança — `enforceCloseOnConfirmedIntent` (`output-gates.ts`).** Roda após `enforceCheckoutUrlInText`. Quando detecta o loop, NÃO reescreve o texto — marca `semanticDuplicateDetected=true` para forçar regeneração com `tool_choice` no mesmo mecanismo já existente para anti-repetição semântica.

## Por quê

Loop de fechamento ("Posso gerar o link?" → cliente "sim" → "Posso gerar o link?") já causou perdas reais documentadas (Reg #2.10, #2.15). A Reg #2.15 resolveu o cenário "cart vazio dentro do handler" mas não cobria o cenário "FIX-B nunca disparou porque checklist exigia item no cart". Sem a Camada 2, qualquer falha da Camada 1 (TPR errou intent, novo padrão de pergunta, etc.) volta a derrubar venda.

## Como aplicar

- Local Camada 1: `supabase/functions/ai-support-chat/index.ts`, bloco `[Frente 3] Auto-Ready` logo após o cálculo padrão de `checkoutChecklist`.
- Local Camada 2: `supabase/functions/_shared/sales-pipeline/output-gates.ts`, função `enforceCloseOnConfirmedIntent` + chamada em `ai-support-chat/index.ts` antes do bloco de duplicata semântica.
- Logs obrigatórios: `[Frente 3] checkout_auto_ready presented=N focus=ID` e `[Frente 3] close_loop_detected reason=… match="…"`.

## Não fazer

- NÃO reescrever a resposta no gate Camada 2 — a IA precisa rodar de novo com tool_choice forçado, não receber um texto editado.
- NÃO estender Auto-Ready para `presented_product_ids.length > 1` sem foco — quebra a previsibilidade que a Reg #2.15 já protege.
- NÃO trocar a verificação `TPR.confirmed_purchase_intent || asked_about_payment_or_link` por regex direto na mensagem do cliente — TPR é fonte única (Reg #2.8).

## Sinal de regressão

- Logs com `[Frente 3] close_loop_detected` repetidos sem `[ai-support-chat] [FIX-B] forcing tool_choice=generate_checkout_link` no turno seguinte.
- Mensagem persistida com pergunta confirmatória de fechamento E `turn_log.metadata.tpr.confirmed_purchase_intent=true` E sem `tool_calls` contendo `generate_checkout_link`.

Reg #2.16 — 2026-05-01.
