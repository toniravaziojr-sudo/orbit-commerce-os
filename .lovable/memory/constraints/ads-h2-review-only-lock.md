---
name: Ads H.2 — Trava temporária de aprovação de campaign_proposal [SUPERSEDED]
description: SUPERSEDED por ads-h3-structure-only-approval (Onda H.3, 2026-06-16). Histórico mantido para auditoria.
type: constraint
---

> ⚠️ **SUPERSEDED em 2026-06-16 pela Onda H.3.**
> A trava `H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED` foi removida. A aprovação de `campaign_proposal` é agora **structure-only** (não cria criativos, não chama Meta, não publica). Veja `ads-h3-structure-only-approval`.
> O texto abaixo é histórico.

---



# Regra (2026-06-15)

H.3 e H.4.1 (aprovação individual → enfileirar creative_jobs) estão temporariamente trancadas atrás de um interruptor de etapa com **default OFF** até a validação visual da H.2 (Propostas de Campanha) ser concluída pelo usuário.

## Implementação

- **UI** — `src/components/ads/StructuredProposalModal.tsx`: constante `H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED = true`. Quando `action.action_type === "campaign_proposal"`, o botão de aprovar fica `disabled`, com rótulo "Aguardando próxima etapa" e tooltip "A aprovação individual desta proposta de campanha será habilitada na próxima etapa do fluxo de revisão." Nenhum caminho alternativo no modal chama `onApprove` para esse tipo.
- **Backend** — `supabase/functions/ads-autopilot-execute-approved/index.ts`: mesma constante no início do ramo `action.action_type === "campaign_proposal"`. Retorna 200 OK com `{ success: false, error: "campaign_proposal_approval_locked_h2", message: "…" }` **antes** de qualquer mutação (status, lifecycle, creative_jobs, IA, Meta, públicos, lookalike, publicação).

## Proibições enquanto a trava estiver ativa

- Não chamar Meta para mutação.
- Não inserir registros em `creative_jobs` originados de `campaign_proposal`.
- Não alterar `status` ou `lifecycle` de `campaign_proposal`.
- Não disparar IA para gerar criativo a partir de proposta.

## Como reverter (quando H.2 for validada)

Flipar a constante para `false` nos dois pontos (UI + backend). O comportamento H.3/H.4.1 já implementado volta a funcionar imediatamente — nada foi descontinuado nem redesenhado.

## Card compacto

O card já estava consistente (botão desabilitado). A trava do modal foi acrescentada para fechar o gap em que o usuário podia abrir o modal e aprovar por lá.
