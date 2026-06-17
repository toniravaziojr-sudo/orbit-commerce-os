---
name: Ads "Ajustar proposta" nunca rejeita
description: Caminho oficial de ajuste de proposta no Gestor de Tráfego IA — distinto de recusa, com feedback formal e aprendizado.
type: constraint
---

# Contrato canônico de "Ajustar proposta" — Gestor de Tráfego IA

**Anti-regressão (2026-06-17).** O botão "Ajustar proposta" do Gestor de Tráfego IA NÃO PODE, em nenhuma hipótese, percorrer a trilha de recusa. Reincidência conhecida: a UI marcava `status='rejected'` com `rejection_reason='Ajuste solicitado: ...'` e então chamava o Strategist. Isso quebrava auditoria, não criava feedback formal e não gerava aprendizado.

## Regras invioláveis

1. Ajustar e Recusar são caminhos distintos.
   - Recusar: `status='rejected'`, motivo opcional, sem geração de nova versão.
   - Ajustar: `status='superseded'` na proposta original, `lifecycle.status='<tipo>_needs_adjustment'`, histórico em `action_data.adjustment_history`, **nunca** `status='rejected'` e **nunca** `rejection_reason` preenchido como "Ajuste solicitado".

2. Toda chamada de ajuste passa OBRIGATORIAMENTE pela edge function `ads-autopilot-request-adjustment`. O frontend não pode mais marcar `rejected` em nome de ajuste, nem invocar `ads-autopilot-strategist` direto no fluxo de ajuste.

3. O texto do lojista é gravado como feedback estruturado via `ads-autopilot-feedback-record` com `decision='needs_revision'`, o que dispara automaticamente `ads-ai-learnings-write` (aprendizado sugerido).

4. A nova versão é vinculada via `parent_action_id` e `superseded_by_action_id` e nasce em `pending_approval` (entra na fila "Aguardando Ação").

5. Anti dupla chamada: novo pedido para a mesma proposta dentro de 10 minutos retorna idempotente.

6. Falhas do Strategist (ex.: `insufficient_balance` por saldo de IA) NUNCA são silenciadas. O original fica com `lifecycle.status='<tipo>_needs_adjustment_failed'` + mensagem clara no UI; o lojista pode tentar novamente.

7. Vale para `strategic_plan` E para `campaign_proposal` e demais tipos sem hierarquia que abrem o diálogo de ajuste por texto livre. O Editor Estruturado (Frente 4.3, `two_step_v1 strategy`) segue por `ads-autopilot-revise-proposal` — não muda.

## Pontos sensíveis (não regredir)

- `src/components/ads/AdsPendingActionsTab.tsx` → `handleAdjust`
- `src/components/ads/AdsPendingApprovalTab.tsx` → `adjustAction`
- `supabase/functions/ads-autopilot-request-adjustment/index.ts`

Qualquer alteração nessas superfícies precisa preservar: zero `rejected` no ajuste, gravação de feedback `needs_revision`, criação de aprendizado e vínculo parent/superseded_by.
