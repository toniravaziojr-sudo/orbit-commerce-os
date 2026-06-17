---
name: H.2.4 — Produto canônico obrigatório para resolver o link de destino
description: Proposta filha de campanha deve ter UM produto principal canônico do catálogo. A expansão do plano normaliza nome, suporta nomes compostos e elege o primeiro produto reconhecido como principal. Sem isso, propostas multi-produto travam o fluxo no link de destino.
type: constraint
---

# Produto canônico por proposta filha (anti-regressão)

## Contexto
O Estrategista do Gestor de Tráfego pode (indevidamente) devolver o nome do produto da campanha como **string composta** ("Kits …, Balm …, Loção …") ou com pequenas variações (espaço sobrando, "Kit/Kits", acentuação). O contrato diz "UM produto exato do catálogo", mas o modelo às vezes desobedece em campanhas multi-produto (remarketing BOF, testes).

Sem defesa em profundidade, a resolução do link de destino falha (lookup literal por nome), o link fica nulo e a proposta trava o fluxo H.2/H.3.

## Regra obrigatória (H.2.4 — Onda atual)
Na expansão do Plano Estratégico aprovado em propostas filhas, **antes** de chamar o `destinationResolver`:

1. **Normalizar** o nome recebido do Estrategista (`product_name`): NFD + remoção de acentos, lowercase, colapso de espaços, trim.
2. **Suportar nomes compostos**: separar por vírgula, ponto-e-vírgula, `+`, `/`, `&` e " e ".
3. **Casar contra o catálogo do tenant** (produtos ativos, não deletados) com 3 estratégias, nesta ordem:
   a. igualdade normalizada;
   b. nome do catálogo contido no termo (escolhe o nome mais longo);
   c. termo contido no nome do catálogo (escolhe o nome mais curto, evita ambiguidade).
4. **Eleger o primeiro produto reconhecido como principal** e gravar:
   - `product_name` ← nome canônico do catálogo;
   - `product_name_original` ← string original do Estrategista;
   - `product_slug` ← slug canônico;
   - `secondary_products` ← demais produtos reconhecidos (uso futuro do gerador de criativos).
5. Se nada casar, manter `product_slug = null` e deixar o resolver registrar o motivo (`no_product_or_offer_linked` / `product_offer_url_missing`). **Nunca inventar URL.**

## Ponto de implementação
`supabase/functions/ads-autopilot-execute-approved/index.ts` — bloco "H.2.4 — Resolução canônica de produto por ação planejada".

Proibido voltar à implementação anterior `.in("name", productNames)` com comparação literal: ela quebra com qualquer espaço sobrando, plural ou nome composto e reabre a regressão.

## Por que isso é uma regra permanente
Mesmo melhorando o prompt do Estrategista, modelos generativos eventualmente desobedecem. A camada determinística da expansão é a rede de segurança. Removê-la = regressão garantida em campanhas multi-produto.

## Validação
Após qualquer alteração no Estrategista ou no expansor de propostas:
1. Criar plano com pelo menos uma campanha cujo `product_name` cite >1 produto do catálogo.
2. Aprovar o plano.
3. Conferir que todas as propostas filhas saem com `destination_url` resolvido (não devem listar "Link de destino" em `pending_fields`).
