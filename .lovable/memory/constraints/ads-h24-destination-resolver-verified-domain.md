---
name: H.2.4 — Resolver de Link de Destino (Anúncios)
description: Regras anti-regressão para o resolver de URL de destino dos anúncios planejados na Onda H.2 (Contrato Meta Vendas v1.1).
type: constraint
---

# H.2.4 — Resolver de Link de Destino

Quando o Gestor de Tráfego IA monta uma proposta de anúncio (H.2), o "Link de destino" é resolvido por uma cascata determinística — sem IA, sem Meta, sem inventar URL.

## Prioridade obrigatória

1. URL explícita do próprio anúncio (`ad_override`).
2. Landing/oferta vinculada — apenas se pública e segura.
3. URL pública do produto/kit já resolvida.
4. Derivação `https://{domínio_primário_verificado_da_loja}/produto/{slug}` — só executa se houver domínio primário verificado E slug.

## Regras de segurança (proibições)

- Nunca usar URL não-https.
- Nunca usar URL interna, admin, preview, checkout administrativo, `localhost`, `lovable.app`, `supabase.co`, `vercel.app`.
- Nunca usar URL fixa configurada na conta Meta como fallback.
- Nunca usar domínio que não esteja `is_primary = true`, `status = 'verified'`, `ssl_status = 'active'` na tabela `tenant_domains`.
- Nunca inventar slug ou URL "presumida".

## Motivos de pendência (enum único)

- `store_public_domain_not_verified` — há slug, mas não há domínio público verificado da loja.
- `product_offer_url_missing` — há referência ao produto mas faltam dados para resolver (nome sem slug, sem URL, sem landing).
- `landing_invalid_or_internal` — landing existia mas foi descartada por não ser pública/segura.
- `no_product_or_offer_linked` — proposta sem qualquer vínculo a produto/kit/landing/coleção.

## Separação URL base × UTM

- O resolver devolve **apenas a URL base**.
- O UTM template vem da configuração de rastreamento da conta (`account_defaults.default_utm_params`), aplicado em outra etapa.
- Se URL base existe mas o UTM template não, a URL **não** fica pendente; apenas o UTM/template fica pendente separadamente.

## Onde o resolver vive

- Módulo puro: `supabase/functions/_shared/ads-autopilot/destinationResolver.ts`.
- Função patch idempotente (one-shot para propostas legadas): `public.ads_patch_proposal_to_h24(uuid)`.
- **Fonte única da rota pública de produto:** `supabase/functions/_shared/storefront/publicRoutes.ts` (`STOREFRONT_PRODUCT_PATH_TEMPLATE = "/produto/{slug}"` + `buildPublicProductPath`). Qualquer módulo backend que precise montar URL pública de produto deve consumir essa função — NUNCA hardcodar `/produto/` em outros lugares.
- Override por tenant: o resolver aceita `tenantProductRouteTemplate` como parâmetro opcional. Hoje não há fonte segura de configuração por tenant para essa rota (nenhuma coluna em `store_settings`/`tenants`), então o default global é sempre usado. Quando existir, basta passar o valor — nenhuma outra mudança é necessária.

## O que NUNCA fazer

- Não chamar Meta, IA, criar `creative_jobs` ou liberar aprovação na fase H.2.
- Não atualizar `H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED`.
- Não derivar URL a partir de subdomínio de plataforma (`*.shops.comandocentral.com.br`) sem que esteja verified+active na `tenant_domains` como `is_primary`.
- Não fazer correção local para um tenant — o resolver é global.
