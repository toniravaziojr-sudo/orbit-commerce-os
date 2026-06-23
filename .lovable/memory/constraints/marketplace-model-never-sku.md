---
name: Marketplaces — campo MODEL nunca pode ser SKU
description: Em qualquer marketplace (ML, Shopee, TikTok Shop), o atributo MODEL/Modelo segue a cascata products.model → product_type → ai_product_type → brand → "Genérico". SKU é código interno e está PROIBIDO como valor de modelo.
type: constraint
---

## Regra

O atributo `MODEL` (e `LINE` quando exigido) enviado para qualquer marketplace segue **estritamente** esta cascata:

1. `products.model` (campo dedicado, texto livre, opcional)
2. `products.product_type` (Shampoo, Balm, Loção, Óleo, etc.)
3. `products.ai_product_type` (derivado por IA)
4. `products.brand` (último recurso)
5. Literal `"Genérico"`

## Proibido

- **Usar `products.sku` como valor de MODEL/LINE em qualquer marketplace.** SKU é código interno de inventário, não modelo comercial. Esse bug ocorreu no ML em 2026-06-22 (anúncio `MLB7017325810` saiu com Modelo `"0002"`).
- Pular para `brand` direto sem passar pelo `product_type` antes — produtos cosméticos da Respeite o Homem não têm modelo específico e devem aparecer como "Balm"/"Shampoo"/"Loção", não como nome da marca repetido.

## Onde está aplicado

- `supabase/functions/meli-resolve-attributes/index.ts` (resolução de atributos do wizard)
- `supabase/functions/meli-publish-listing/index.ts` (auto-fill required attrs no publish)
- Doc oficial: `docs/especificacoes/marketplaces/mercado-livre.md` v2.4.5

## Validação obrigatória

Qualquer alteração nos resolvedores de atributos de marketplace deve passar por checagem manual com um produto da linha Respeite o Homem (sem modelo cadastrado) e confirmar que o campo Modelo sai como o tipo do produto, nunca como SKU.
