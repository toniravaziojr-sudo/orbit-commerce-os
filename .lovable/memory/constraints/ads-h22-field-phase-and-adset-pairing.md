---
name: Ads H.2.2 — Contrato de Campos por Fase + Paridade ABO
description: Anúncios planejados sempre carregam vínculo explícito com conjunto; pendências viajam classificadas por fase (h2_structural/h4_future/account_config); checklist Meta conta só H.2 estrutural; copy final nunca bloqueia revisão H.2.
type: constraint
---

# Regra (Onda H.2.2 — 2026-06-15)

## Vínculo anúncio ↔ conjunto

Todo `planned_creative` salvo em `ads_autopilot_actions.action_data` DEVE conter:
- `adset_index` (numérico, válido contra `adsets[]`)
- `adset_key` (`adset_<index>`)
- `linked_adset_name` (nome humanizado do conjunto vinculado)

A UI lê `linked_adset_name` primeiro, com fallback para `adset_name`/`ad_set_ref`/`adsets[index].name`. Nunca deve aparecer "Conjunto vinculado: —" quando o vínculo existe no payload.

## Paridade [Teste] / ABO

Em campanhas com `internal_strategy_tag === "testing"` e `budget_mode === "ABO"`:
- **1 anúncio planejado por conjunto** (paridade 1:1, vínculo posicional).
- Se `planned_creatives.length === 0` → expande placeholders 1:1.
- Se `planned_creatives.length === adsets.length` → vínculo posicional reforçado.
- Mismatch ambíguo → `contract_validation_status = "pending_dependency"` + `testing_abo_pairing_status = "mismatch_pending_user_decision"`. **Nunca inventar.**

## Classificação por fase em pending_fields

`pending_fields[].phase` é OBRIGATÓRIO no payload gerado pelo backend:
- `h2_structural` → bloqueia revisão H.2 (formato planejado, CTA planejado, link de destino, vínculo com conjunto, segmentação, exclusões, evento de conversão da proposta).
- `h4_future` → será gerado na próxima etapa (copy final: `headline`, `primary_text`, `description`, asset visual, preview, IDs de criativo).
- `account_config` → configuração padrão da conta Meta (`facebook_page_id`, `pixel_id`, `conversion_event_default`, `attribution_window`, `cta_default`, `utm_base`, `default_creative_format`).
- `publication_final` → resolvido só na publicação (IDs Meta de campanha/conjunto/anúncio).

`meta_step_checklist[].h2_missing_count` é a fonte de verdade do bloco "Passo a passo Meta". A UI **nunca** deve usar `missing_count` cru para essa contagem.

## Suprimir pendências fantasma de orçamento

- `budget_mode === "ABO"` → NÃO exigir `campaign.daily_budget_cents`.
- `budget_mode === "CBO"` → NÃO exigir `adset.daily_budget_cents` em cada conjunto.

## Gate visual H.2 (strategy stage)

- `headline` e `primary_text` ausentes → **warning** ("Será gerado na próxima etapa"), nunca blocker.
- `cta`, `destination_url`, `creative_format` ausentes → blocker (estrutura H.2).
- Aprovação de `campaign_proposal` continua trancada pela constante `H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED` (mem://constraints/ads-h2-review-only-lock).

## Implementação

- **Contrato + computador de pendências (TS):** `supabase/functions/_shared/ads-autopilot/objectiveFieldContract.ts` (com `FieldSpec.phase` e `MetaStepChecklistItemV2`).
- **Gerador:** `supabase/functions/_shared/ads-autopilot/campaignProposals.ts` (`buildPlannedCreativesSnapshot` enriquece todo anúncio; `enrichRecordWithV1_1Contract` aplica paridade ABO e recomputa pendências com `budget_mode`).
- **Patch idempotente das propostas existentes:** função `public.ads_patch_proposal_to_h22(uuid)` (SECURITY DEFINER, service_role).
- **UI:** `src/components/ads/StructuredProposalModal.tsx` (checklist usa `h2_missing_count`, `Detail` recebe prop `futurePhase`, aba Anúncio marca copy como H.4) + `src/lib/ads/normalizeCampaignStructure.ts` (`ad_set_ref` resolve `linked_adset_name` primeiro).
- **Gate:** `src/lib/ads/gates/structureCompleteness.ts` (etapa strategy: copy → warning).

## Proibições

- Não gerar copy final, asset, IDs Meta ou URL final no estágio H.2.
- Não inventar CTA/destino/UTM/formato quando os defaults da conta não existem — virar pendência declarada.
- Não voltar a contar `headline`/`primary_text` como pendência H.2.
- Não remover `phase` do payload — quebra a UI.

