---
name: H.2 / H.2.4 — Contrato da Proposta de Campanha e Resolver de Link de Destino
description: Regras anti-regressão consolidadas da Onda H.2 (proposta de campanha Meta Vendas v1.1) e H.2.4 (resolver determinístico de URL de destino). Documentação técnica; fechamento operacional depende de validação visual no painel /ads.
type: constraint
---

# H.2 / H.2.4 — Contrato e Resolver de Link de Destino

> Status: **resolver validado tecnicamente**. Fechamento operacional da H.2/H.2.4 só ocorre após validação visual no painel `/ads` (ver seção "Critérios de validação visual final").

## 1. Contrato atual da proposta
- Versão: `campaign_proposal_v1_1`.
- Escopo suportado nesta onda: **Meta Ads + objetivo Vendas**.
- Qualquer outra plataforma/objetivo deve falhar de forma fechada (sem fallback silencioso, sem inventar defaults).
- Aprovação `campaign_proposal` continua bloqueada (ver seção 9).

## 2. CTA
- Meta Vendas → CTA planejado padrão = **"Comprar agora"** (`SHOP_NOW`).
- Origem exibida: **"Padrão do objetivo Vendas"** (`cta_source = "objective_default"`).
- CTA com default do objetivo **nunca** é pendência H.2.
- CTA jamais derivado da configuração padrão da conta Meta quando o objetivo já tem default mapeado.
- Tabela canônica: `OBJECTIVE_DEFAULT_CTA` / `defaultCtaForObjective` em `supabase/functions/_shared/ads-autopilot/objectiveFieldContract.ts`.

## 3. Link de destino — prioridade obrigatória
`destination_url_base` é campo estrutural H.2. Cascata determinística:
1. URL explícita do próprio anúncio (`ad_override`).
2. Landing/oferta vinculada — apenas se pública e segura.
3. URL pública do produto/kit.
4. Coleção/categoria pública, quando aplicável.
5. Derivação `https://{domínio_primário_verificado}/produto/{slug}` (último recurso).

**Proibido**: URL fixa da conta Meta como fallback; URL admin/preview/checkout admin/interna; `localhost`, `lovable.app`, `supabase.co`, `vercel.app`; qualquer domínio não verificado; não-https.

## 4. Domínio
- Derivação por slug **só** com domínio em `tenant_domains` com `is_primary = true`, `status = 'verified'`, `ssl_status = 'active'`.
- Faltando esse domínio: pendência **"Pendente de domínio público verificado da loja"** (`store_public_domain_not_verified`).

## 5. Rota pública do storefront
- Fonte centralizada: `supabase/functions/_shared/storefront/publicRoutes.ts` (`STOREFRONT_PRODUCT_PATH_TEMPLATE = "/produto/{slug}"`, `buildPublicProductPath`).
- Default global atual da plataforma: **`/produto/{slug}`**.
- Proibido replicar a string `/produto/` em outros resolvers — consumir sempre `buildPublicProductPath`.
- **Override por tenant não existe hoje** (nenhuma coluna em `store_settings`/`tenants`). O resolver já aceita `tenantProductRouteTemplate` opcional para o dia em que existir.
- **Limitação futura registrada**: tenants com `/products/{handle}`, `/p/{slug}`, rota customizada ou loja externa (Shopify, Woo, etc.) exigirão fonte segura de configuração por tenant antes de habilitar derivação para eles.

## 6. Separação URL × UTM
- URL base = H.2 (estrutural).
- UTM template = configuração de rastreamento (`account_defaults.default_utm_params`), aplicada em etapa separada.
- URL base presente + UTM template ausente → **a URL não volta a ser pendência**; gera pendência separada **"Pendente de UTM/template"**.

## 7. Campanhas [Teste] / ABO
- `internal_strategy_tag = "testing"` + `budget_mode = "ABO"`:
  - `planned_creatives[].format = null`;
  - `resolution_phase.format = "h4_future"`;
  - formato **não conta** como pendência estrutural H.2;
  - badge "X pendências" do "Passo a passo Meta" ignora o formato nesse caso;
  - UI: "Será definido na etapa de criativos como variável do teste".
- Vínculo anúncio ↔ conjunto/variação preservado: `linked_adset_name`, `adset_key`, `adset_index` **nunca** são alterados no payload; humanização ocorre só na UI via `humanizeAdsetDisplayName`.
- Para Prospecção/Retargeting/Manual: formato continua estrutural H.2 — ausente vira pendência clara.

## 8. Campos de criativo final
Pertencem à próxima etapa (H.4), **nunca** são pendência H.2:
- Título final, texto principal, descrição, asset final, preview.
- UI deve renderizar "Será gerado na próxima etapa".
- `AdSection` força `futurePhase` para esses campos em proposta de campanha.

## 9. Segurança (trava H.2 → H.3/H.4)
- **UI**: `H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED = true` em `StructuredProposalModal.tsx` — botão de aprovar desabilitado, rótulo "Aguardando próxima etapa".
- **Backend**: mesma constante em `ads-autopilot-execute-approved/index.ts` — retorna 200 OK com `{ success: false, error: "campaign_proposal_approval_locked_h2" }` antes de qualquer mutação.
- Enquanto a trava estiver ativa, **proibido**: chamar Meta para mutação, inserir `creative_jobs` originados de proposta, alterar `status`/`lifecycle` de `campaign_proposal`, chamar IA para criativo, publicar.
- Reversão: flipar a constante nos dois pontos quando H.2 for validada visualmente.

## 10. Critérios de validação visual final (painel `/ads`)
Para fechar H.2.4 operacionalmente, conferir nas propostas ativas:
- Link de destino aparece resolvido na aba "Anúncio planejado".
- Origem exibida como **"Derivado do domínio verificado da loja"** (ou equivalente conforme a fonte: landing, produto, override).
- "Passo a passo Meta" sem pendência de Link de destino.
- Título/texto/descrição como **"Será gerado na próxima etapa"**.
- CTA exibido como **"Comprar agora"** com nota de origem do objetivo.
- Formato em campanhas [Teste] aparece como variável da etapa de criativos.
- Botão de aprovação desabilitado, rótulo "Aguardando próxima etapa".

## Onde o resolver vive
- Módulo puro: `supabase/functions/_shared/ads-autopilot/destinationResolver.ts`.
- Patch idempotente para propostas legadas: `public.ads_patch_proposal_to_h24(uuid)` (SECURITY DEFINER, service_role).
- Rota pública: `supabase/functions/_shared/storefront/publicRoutes.ts`.
- Contrato de objetivo / CTA: `supabase/functions/_shared/ads-autopilot/objectiveFieldContract.ts`.
- Gerador de proposta: `supabase/functions/_shared/ads-autopilot/campaignProposals.ts`.
- Normalizer UI: `src/lib/ads/normalizeCampaignStructure.ts`.

## Motivos de pendência (enum único)
- `store_public_domain_not_verified`
- `product_offer_url_missing`
- `landing_invalid_or_internal`
- `no_product_or_offer_linked`

## O que NUNCA fazer
- Chamar Meta, IA, criar `creative_jobs` ou liberar aprovação enquanto H.2 não for validada.
- Derivar URL a partir de subdomínio de plataforma (`*.shops.comandocentral.com.br`) sem `is_primary + verified + active` em `tenant_domains`.
- Fazer correção pontual por tenant — o resolver é global.
- Hardcodar `/produto/` fora de `publicRoutes.ts`.
- Usar URL fixa da conta Meta como default de destino.
