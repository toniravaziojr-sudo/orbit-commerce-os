---
name: IA — pergunta sobre frete aciona ferramenta e oferece kit com frete grátis
description: Quando o cliente pergunta sobre frete/entrega/prazo, a IA DEVE pedir CEP (se faltar), chamar calculate_shipping e, se o frete vier pago e a família tiver oferta de frete grátis, oferecer o kit/quantidade maior no mesmo turno (máximo 1×).
type: constraint
---

## Regra (Reg #17.x — Frete-Upsell)

Em `supabase/functions/ai-support-chat/index.ts` (prompt do modo vendas), há duas regras imperativas:

1. **Pergunta sobre frete/entrega/prazo/"paga frete?" sempre chama `calculate_shipping`.**
   - Se o CEP do cliente ainda não é conhecido, a IA pede o CEP em UMA linha curta e PARA. Não pode responder sobre frete em texto genérico antes de cotar.
   - Se o carrinho está vazio, primeiro precisa haver um produto-base escolhido (search_products + add_to_cart), aí cota.

2. **Frete pago + oportunidade de frete grátis na família = upsell obrigatório.**
   - Quando `calculate_shipping` retorna preço > 0 E o contexto traz `has_free_shipping_offers: true` ou `family_free_shipping_offers` não-vazio:
     - A IA apresenta o frete cotado E oferece, no mesmo turno, o kit/quantidade maior da mesma linha com frete grátis.
     - Fórmula: *"Para 1 unidade fica R$ X com entrega em Y dias. Temos também o [nome do kit] dessa mesma linha com frete grátis — quer que eu te mostre?"*
   - **Máximo 1 oferta por conversa.** Se o cliente recusar, NÃO insistir.
   - **NUNCA inventar kit.** Só ofertar o que veio em `family_free_shipping_offers`.
   - Se o frete já voltou grátis, apenas confirmar — não forçar upsell.

## Por quê

Bateria de teste do tenant Respeite o Homem (mai/2026): ao perguntar "paga frete?", a IA respondia "sim, paga" em texto e perdia (a) a informação concreta do valor/prazo, (b) a chance de subir o ticket via kit com frete grátis. A infraestrutura já existia (tool + contexto), faltava regra dura de uso.

## Como aplicar

- Sempre que o vocabulário do prompt de frete for alterado, manter os dois gatilhos (cotar antes de falar + upsell de kit gratuito).
- Sempre que `calculate_shipping` for alterada (campos do retorno) ou `family_free_shipping_offers` mudar de nome/estrutura, atualizar o prompt e este memo.
- Registro: Reg #30 em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.
