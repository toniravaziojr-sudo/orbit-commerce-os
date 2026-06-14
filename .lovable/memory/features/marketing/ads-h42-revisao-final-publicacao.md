---
name: H.4.2 — Revisão Final e Publicação da Proposta
description: Modal de 4 passos publica a Proposta de Campanha aprovada na Meta em modo ATIVO com agendamento 00:01 BRT.
type: feature
---

# Onda H.4.2 — Revisão Final + Publicação (2026-06-14)

## Fluxo end-to-end
1. **H.3** — Usuário aprova a `campaign_proposal` → executor valida gate publish-critical, enfileira N jobs de imagem (H.4.1), mantém status='approved' e lifecycle='campaign_creatives_generating'.
2. **Trigger SQL** `trg_flip_campaign_proposal_lifecycle` em `creative_jobs` → quando todos os jobs ligados à proposta entram em status terminal, vira lifecycle para `campaign_creatives_ready` (se ≥1 succeeded) ou `campaign_creatives_failed`.
3. **UI** — `ApprovedProposalsSection` (renderizada no topo de `AdsPendingApprovalTab`) lista propostas aprovadas em andamento e oferece botão "Revisar e publicar" quando lifecycle=`campaign_creatives_ready`.
4. **FinalReviewModal** — 4 passos: (1) Resumo da estratégia/campanha/conjunto/identidade, (2) Criativos gerados com contagem prontos/falhos/processando, (3) Agendamento na próxima janela 00:01 BRT, (4) Confirmação final + botão "Publicar agora".
5. **Edge function** `ads-autopilot-publish-proposal` — cria campanha → conjunto → para cada criativo pronto: upload de imagem + adcreative + ad. Tudo em status=ACTIVE com `start_time` na próxima janela 00:01 BRT (ou imediato se já dentro de 00:01–04:00 BRT). Nunca PAUSED.
6. **Pós-publicação** — `status='executed'`, `lifecycle.status='campaign_implemented'`, IDs Meta em `rollback_data`. Insight visível ao usuário.

## Falhas
- **Falha na geração** (todos jobs failed) → lifecycle=`campaign_creatives_failed`, card mostra botão "Revisar" sem ação destrutiva. Sem retry automático (usuário pode rejeitar a proposta para regerar).
- **Falha na publicação Meta** (qualquer etapa do publish) → lifecycle=`campaign_implementation_failed` + `failure_message_pt`. Status permanece 'approved' para permitir nova tentativa.
- **Falha parcial em ads individuais** → publica os que deram certo e marca lifecycle=`campaign_implemented` com `ads_created[]` registrando os erros.

## Proibido
- Publicar fora da janela 00:01–04:00 BRT sem `start_time` agendado (estado padrão = sempre ATIVO).
- Marcar `status='executed'` antes de ter pelo menos 1 ad criado com sucesso.
- Pular o modal de Revisão Final (botão "Publicar" só existe dentro dele).
- Chamar Meta para mutação antes de lifecycle=`campaign_creatives_ready`.

## Componentes
- `supabase/functions/ads-autopilot-publish-proposal/index.ts` (v1.0.0-h42)
- `src/hooks/useApprovedProposalsAwaitingPublish.ts`
- `src/components/ads/FinalReviewModal.tsx`
- `src/components/ads/ApprovedProposalsSection.tsx`
- Trigger SQL: `trg_flip_campaign_proposal_lifecycle` em `creative_jobs`

## Próxima onda
- **H.5** — Aba "Aprendizados" globais já existe em `AdsAILearningsTab.tsx` (ao lado das Configurações). Sem ação adicional.
