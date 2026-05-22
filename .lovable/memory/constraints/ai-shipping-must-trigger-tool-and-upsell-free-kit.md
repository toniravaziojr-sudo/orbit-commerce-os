---
name: IA — gatilho proativo de upsell (reciprocidade comercial) + cotação obrigatória em pergunta de frete
description: Quando o cliente sinaliza intenção de comprar 1 unidade ou kit sem frete grátis, a IA DEVE cotar antes do link e oferecer a alternativa melhor (mais quantidade, kit da família, gap pra frete grátis) se existir. Quando o cliente PERGUNTA sobre frete/entrega, a IA DEVE chamar calculate_shipping (pedindo CEP se faltar) antes de qualquer resposta em texto.
type: constraint
---

## Regras (Reg #17.x e Reg #19.2)

Em `supabase/functions/ai-support-chat/index.ts` (prompt do modo vendas), três regras imperativas:

### 1. Pergunta sobre frete/entrega/prazo SEMPRE chama `calculate_shipping` (Reg #17.x)
- Se o CEP do cliente ainda não é conhecido, pede CEP em UMA linha curta e PARA. Não pode responder sobre frete em texto genérico antes de cotar.
- Se o carrinho está vazio, primeiro precisa haver produto-base escolhido (search_products + add_to_cart), aí cota.

### 2. Gatilho PROATIVO de upsell (Reg #19.2 — reciprocidade comercial)
**Quando disparar:** sempre que o cliente sinalizar intenção de comprar (a) 1 unidade de um produto OU (b) um kit/produto que NÃO tem frete grátis, **E** existir oferta melhor disponível (mais quantidade da mesma linha, kit da família, ou faixa de frete grátis a poucos reais).

**Como executar:**
1. Após `add_to_cart` da base, se ainda não houver CEP, pede CEP e para.
2. Com CEP em mãos, chama `calculate_shipping` automaticamente — sem perguntar permissão.
3. Avalia o retorno:
   - `is_free: true` → segue para checkout, sem upsell.
   - `upsell_opportunity` com `priority` definido → aplica a regra 8 (apresenta a oferta no mesmo turno).
   - Sem oportunidade real → segue para checkout, NÃO inventa upsell.

**Limites:** máximo 1 oferta proativa por conversa. Se o cliente recusar, vai direto pro link.

### 3. Frete pago + oferta de frete grátis na família = upsell obrigatório (Reg #17.x — reativo)
- Quando `calculate_shipping` retorna preço > 0 E `has_free_shipping_offers: true` ou `family_free_shipping_offers` não-vazio:
  - IA apresenta o frete cotado E oferece, no mesmo turno, o kit/quantidade maior da mesma linha com frete grátis.
- Cliente perguntar sobre frete/kit/desconto = reciprocidade de atendimento, NÃO conta para o limite de 1 oferta proativa.
- NUNCA inventar kit. Só ofertar o que veio em `family_free_shipping_offers` / `pack_offers` / `family_kit_offers`.

### Bloqueio do link de checkout (Regra 4)
`generate_checkout_link` só pode rodar se: (a) já houve cotação nesta conversa, OU (b) o cliente recusou explicitamente a oferta proativa, OU (c) a base já é frete grátis.

## Por quê

Bateria de teste do tenant Respeite o Homem (mai/2026):
- Reg #30: ao perguntar "paga frete?", IA respondia "sim, paga" em texto sem cotar nem ofertar kit.
- Reg #31: ao pedir 1 unidade, IA mandava direto pro checkout sem cotar nem oferecer pack/kit melhor — perdia ticket maior e benefício do cliente (frete grátis).

Infraestrutura já existia (tool + contexto + motor de upsell), faltava regra dura no prompt.

## Como aplicar

- Sempre que o vocabulário do prompt de frete/upsell for alterado, manter os três gatilhos (cotar antes de falar + upsell proativo na intenção + upsell reativo na pergunta).
- Sempre que `calculate_shipping` ou `family_free_shipping_offers` mudar de estrutura, atualizar prompt e este memo.
- Registro: Reg #30 e #31 em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.
