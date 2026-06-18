---
name: Ads H.4.4 — Geração inline de criativo na etapa Anúncios do wizard
description: A geração de imagem e textos do anúncio (com IA, PC ou Drive) acontece DENTRO da etapa 4 do StructuredProposalModal. Etapa 5 (Publicar) absorveu o antigo modal de Revisão Final. Não há mais auto-enqueue de creative_jobs após aprovar.
type: constraint
---

# Regra (Onda H.4.4 — 2026-06-18)

A produção de criativo e copy para campanhas (`campaign_proposal_v1_1`) é executada **dentro da etapa "Anúncios" (step 4) do StructuredProposalModal**, sob gesto explícito do lojista, e **antes** do botão "Publicar na Meta" da etapa 5.

## O que a etapa 4 FAZ
- Para cada anúncio planejado, o lojista pode:
  - Gerar imagem com IA · Enviar do PC · Escolher no Drive · Substituir · Remover.
  - Regerar imagem com IA usando feedback (>= 5 chars, registra aprendizado em `ads_ai_learnings`).
  - Gerar título + texto principal + descrição com IA em um clique.
  - Regerar campo a campo (headline / primary_text / description) com feedback obrigatório.
  - Editar manualmente qualquer campo.
- A primeira geração com IA da sessão dispara confirmação ("vai consumir créditos de IA"). Sessão lembra a confirmação (`sessionStorage: ads-ai-inline-confirmed`).
- Cada chamada de IA persiste em `action_data.ads[idx]` E em `action_data.planned_creatives[idx]` (espelho para o publisher).

## O que a etapa 5 (Publicar) FAZ
- Substitui o antigo `FinalReviewModal` para propostas novas: mostra o resumo e o botão **Publicar na Meta**.
- A publicação aprova a estrutura e cria a campanha em modo ATIVO em uma única ação.
- Bloqueia o botão Publicar enquanto algum anúncio estiver sem `creative_final_url` e/ou sem os 3 textos preenchidos.

## O que é PROIBIDO
- **Enfileirar `creative_jobs` automaticamente após aprovar estrutura.** A geração só acontece por clique explícito na etapa 4.
- **Gerar com IA sem confirmação de custo** na primeira vez da sessão.
- **Regerar sem feedback** (>= 5 caracteres).
- **Reintroduzir** botão "Aprovar estratégia e gerar criativos" no wizard de `campaign_proposal` (continua vivo apenas para o two-step `strategic_plan`).
- **Reabrir** `FinalReviewModal` para propostas novas. Ele continua existindo apenas como caminho de compatibilidade para propostas legadas já em `ApprovedProposalsSection` (lifecycle `campaign_creatives_ready` etc.).

## Implementação
- Edge function: `supabase/functions/ads-creative-inline-generate/index.ts` (4 ações: `generate_copy`, `regen_copy_field`, `generate_image`, `regen_image`).
- UI: `src/components/ads/AdCreativeAIPanel.tsx` (`AdCreativeAIPanel` + `AdImageAIControls`).
- Integração: `src/components/ads/StructuredProposalModal.tsx` — `AdSection` recebe `tenantId/actionId/adIndex/onAfterAIChange` e renderiza o painel de textos; `AttachCreativeBlock` renderiza os botões de imagem com IA junto ao upload.
- Reaproveita `creative-image-generate` (síncrona via `resilientGenerate`) para imagens e Lovable AI Gateway (`google/gemini-2.5-flash`) para textos.

## Anti-regressão
- Não recriar a seção "Propostas aprovadas em andamento" como fluxo principal para propostas novas — ela só sobrevive para compatibilidade de propostas legadas em fila.
- Não mover a geração para depois da aprovação. Mantém-se o princípio H.4.0: custo confirmado + gate de prontidão + idempotência por `(action_id, ad_index)`.
- Não mostrar "Será gerado na próxima etapa" no wizard. Textos canônicos: "A gerar nesta etapa" / "A gerar com IA ou enviar do PC/Drive".
