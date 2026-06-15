---
name: Ads H.2.3 — Defaults por objetivo, formato como variável de teste e link via produto/oferta
description: CTA padrão de Vendas vem do contrato do objetivo (não da conta); formato em campanhas [Teste]/ABO é variável H.4; link de destino sai do produto/oferta com pendência declarada quando ausente; conjunto vinculado humanizado só na UI.
type: constraint
---

# Regra (Onda H.2.3 — 2026-06-15)

## CTA padrão por objetivo (não por conta Meta)

O CTA planejado do anúncio é derivado do **contrato do objetivo**, não da configuração padrão da conta:
- Vendas → `SHOP_NOW` ("Comprar agora"), `cta_source = "objective_default"`.
- Leads → `SIGN_UP`.
- Tráfego → `LEARN_MORE`.
- Quando o anúncio traz CTA próprio, `cta_source = "ad_override"`.

CTA **nunca** vira pendência H.2 quando o objetivo tem default mapeado. A UI mostra o valor humanizado + nota "Padrão do objetivo Vendas".

Tabela canônica em `OBJECTIVE_DEFAULT_CTA` / `defaultCtaForObjective(obj)` (`supabase/functions/_shared/ads-autopilot/objectiveFieldContract.ts`).

## Formato em campanhas [Teste]/ABO é variável do teste

Quando `internal_strategy_tag === "testing"` e `budget_mode === "ABO"`:
- `planned_creatives[].format` é gravado como `null`.
- `resolution_phase.format = "h4_future"`.
- `pending_fields` mantém o campo mas com `phase = "h4_future"`.
- O badge "X pendência(s)" do "Passo a passo Meta" **não** conta o formato.
- A UI exibe: "Será definido na etapa de criativos como variável do teste".

Para Prospecção/Retargeting/Criação manual: formato continua `h2_structural` — se ausente, vira pendência clara "Pendente de definição do formato planejado".

## Link de destino = URL do produto/oferta + UTM template

Origem canônica:
1. URL pública do produto/oferta resolvida server-side (`action.product_url`).
2. UTMs aplicadas pelo template configurado (`utm_template`).
3. **Nunca** usar URL fixa da conta Meta como padrão.
4. **Nunca** inventar URL.

Estado salvo no payload:
- `destination_source = "ad_override" | "product_offer"`.
- `destination_pending_reason = "product_offer_url_missing"` quando ausente.

UI:
- Valor real quando preenchido.
- "Pendente de URL do produto/oferta" quando `destination_pending_reason = "product_offer_url_missing"`.
- "Pendente de UTM/template" quando o template estiver ausente.

## Conjunto vinculado humanizado SOMENTE na UI

`normalizeCampaignStructure.fromCampaignProposalV1` aplica `humanizeAdsetDisplayName(rawLinked, idx)` ao `ad_set_ref` antes de devolver para a UI:
- `[AI] TEST - Kit Banho - Criativo X` → `Kit Banho — Teste de criativo — Variação X`.
- Fallback: `Conjunto N`.

**Nunca** alterar `planned_creatives[].linked_adset_name`, `adset_key`, `adset_index` salvos no payload — eles continuam servindo de chave técnica para a publicação.

## Copy final é SEMPRE H.4 em proposta de campanha

`AdSection` força `futurePhase = isStrategyStage || isCampaignProposal` para Título, Texto principal e Descrição. Esses campos:
- nunca aparecem como "—" em proposta de campanha;
- sempre renderizam "Será gerado na próxima etapa";
- nunca contam como pendência H.2.

## Implementação

- **Contrato:** `OBJECTIVE_DEFAULT_CTA`, `defaultCtaForObjective()` em `objectiveFieldContract.ts`. `computePendingFields` aceita `internal_strategy_tag` e supressões por fase.
- **Gerador:** `buildPlannedCreativesSnapshot(action, adsets, kind, defaults, { strategyTag, objectiveCanonical, productUrl })` em `campaignProposals.ts` — preenche `cta_source`, `destination_source`, `destination_pending_reason`, `format=null` em [Teste] e `resolution_phase.format=h4_future`.
- **Patch SQL idempotente:** `public.ads_patch_proposal_to_h23(uuid)` (SECURITY DEFINER, service_role) aplica nas propostas já gravadas.
- **Normalizer UI:** `fromCampaignProposalV1` humaniza `ad_set_ref` e propaga `cta_source`/`destination_source`/`destination_pending_reason`/`format_phase` no `AdNode`.
- **UI:** `Detail` ganhou `customPlaceholder` (mensagem amarela de pendência classificada) e `helperText` (origem). `AdSection` aceita `campaign` + `isCampaignProposal` e decide cada placeholder por origem/fase.

## Proibições

- Não derivar CTA da configuração da conta Meta quando o objetivo tem default — **sempre** vai do contrato do objetivo.
- Não usar URL fixa da conta Meta como link de destino padrão.
- Não inventar formato, CTA, URL ou UTM.
- Não contar copy final, formato em [Teste] ou CTA com default como pendência H.2.
- Não alterar `linked_adset_name`/`adset_key`/`adset_index` salvos — apenas humanizar na UI.
- Não liberar aprovação `campaign_proposal` (constante `H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED = true`).
- Não chamar IA, Meta, criar `creative_jobs` ou publicar nesta fase.
