---
name: Ads H.2.5 — Default contratual de creative_format
description: Cascata global de resolução de "Formato do criativo" em campaign_proposal v1.1. Meta + Vendas manual, não-[Teste], não-catálogo → "Imagem única" como default seguro do contrato. [Teste] mantém variável H.4. Catálogo mantém regra própria. Vídeo e carrossel NUNCA são defaults automáticos.
type: constraint
---

# Regra (Onda H.2.5 — 2026-06-15)

## Cascata determinística de creative_format

Aplicada como post-pass em `enrichRecordWithV1_1Contract`, antes de `computePendingFields`. Implementação central em `supabase/functions/_shared/ads-autopilot/creativeFormatResolver.ts` (`resolveCreativeFormat`).

Ordem de prioridade:

1. **[Teste]/ABO** (`internal_strategy_tag === "testing"`) → `source: "testing_h4_variable"`, `resolution_phase: "h4_future"`, valor **não preenchido**. UI mostra "Será definido na etapa de criativos como variável do teste".
2. **Catálogo obrigatório** (`requires_catalog === true`):
   - Com catálogo válido → `value: "catalog"`, `source: "catalog_required"`.
   - Sem catálogo → `value: null`, `source: "missing_catalog_config"`, `resolution_phase: "account_config"`. **NUNCA cai para "single_image".**
3. **Formato explícito da estratégia** (`planned_creative.format` válido após normalização) → `source: "strategy_explicit_format"`.
4. **Default da conta Meta** (`account_defaults.default_creative_format`) → `source: "account_default_format"`.
5. **Default contratual global** (apenas Meta + Vendas manual) → `value: "single_image"`, `source: "meta_sales_manual_contract_default"`, `resolution_phase: "h2_structural"`.
6. **Fora do escopo coberto** → `source: "unsupported_format"`, pendência permanece.

O resolver escreve em cada `planned_creative`: `format`, `creative_format` (mirror para o contrato), `format_label`, `format_source`, `format_source_label_pt`, `format_resolution_phase`, `format_missing_reason` e atualiza `resolution_phase.format`.

## Proibições inegociáveis

- Vídeo NÃO é default automático nesta onda. Só entra com explícito da estratégia, default da conta ou regra futura aprovada.
- Carrossel NÃO é default automático nesta onda. Mesma regra de vídeo.
- Catálogo NÃO é fallback de outros casos: sem catálogo válido vira pendência de configuração, jamais "Imagem única".
- Ausência de formato fora de [Teste] e fora de catálogo NUNCA é classificada como `h4_future` (proibido esconder pendência estrutural H.2 como H.4).
- Default contratual NÃO é por tenant, produto, campanha ou proposta específica. É contrato Meta Vendas manual global.

## UI

`src/lib/ads/normalizeCampaignStructure.ts` propaga `format_source`, `format_source_label_pt`, `format_label` e `format_phase` (lendo `format_resolution_phase` antes do legado `resolution_phase.format`). `src/components/ads/StructuredProposalModal.tsx` mostra valor humanizado (`format_label`) e origem (`format_source_label_pt`, ex.: "Padrão do contrato Meta Vendas"). Sem novas rotas, telas ou itens de sidebar.

## Patch idempotente das propostas existentes

Migration `20260615231620_*` itera `ads_autopilot_actions` com `action_type='campaign_proposal'` e `status='pending_approval'`, aplicando o default contratual apenas em rows que satisfazem platform=meta + objective_canonical=sales + não-testing + não-requires_catalog. Atualiza `pending_fields`, `pending_fields_total` e `meta_step_checklist[step=ad].{filled, missing_count, h2_missing_count}`. Idempotente: ignora rows que já têm `format` preenchido.

## Segurança preservada

- `H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED = true` no UI e no backend (intacto).
- Backend `ads-autopilot-execute-approved` continua retornando `campaign_proposal_approval_locked_h2`.
- Botão "Aguardando próxima etapa" segue desabilitado.
- Nenhum `creative_job`, chamada IA, chamada Meta ou publicação foi disparada por esta onda.

## Como evoluir

Quando houver regra aprovada para vídeo/carrossel como default por subtipo de campanha ou para override por tenant, estender `resolveCreativeFormat` mantendo a precedência: explícito > conta > contrato global. Atualizar esta memória junto.
