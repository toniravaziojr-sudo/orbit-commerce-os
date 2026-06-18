---
name: Ads — criativo inline usa product_images como fonte da imagem
description: Geração inline do card Criativo do anúncio resolve produto por cascata e busca imagem em product_images, não em campo de imagem dentro de products.
type: constraint
---

## Regra

Na geração inline de imagem do Gestor de Tráfego, o produto deve ser resolvido em cascata:

1. vínculo explícito do anúncio/plano;
2. produto da campanha;
3. nome do conjunto/anúncio;
4. slug derivado do link de destino.

Depois de resolver o produto, a imagem base vem obrigatoriamente de `product_images`, priorizando `is_primary` e depois `sort_order`.

## Por quê

Em 18/06/2026, a proposta de Shampoo Calvície Zero tinha produto e link corretos, mas o gerador inline falhava com “produto não encontrado” porque tentava obter a imagem em campo legado/inexistente do cadastro operacional do produto. O catálogo real usa `product_images`.

## Como aplicar

- Não buscar imagem principal de produto diretamente em `products` no fluxo de criativo Ads.
- Aceitar status `succeeded` e `completed` como conclusão bem-sucedida de job de imagem.
- Validar com proposta legada sem `product_id` no anúncio, mas com produto no nível da campanha ou slug no link de destino.

## Fonte documental

- `docs/especificacoes/marketing/gestor-trafego.md` — H.4.4/H.4.9.
- `docs/tecnico/base-de-conhecimento-tecnico.md` — incidente 2026-06-18.