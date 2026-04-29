---
name: AI Brain Insight Status Enum Contract
description: Enum ai_brain_insight_status só aceita pendente|urgente|ativo|revogado|descartado|expirado. Aprovar = status='ativo'. Nunca usar 'aprovado' (não existe).
type: constraint
---
# Contrato do enum `ai_brain_insight_status`

## Valores válidos (ÚNICOS)
`pendente` | `urgente` | `ativo` | `revogado` | `descartado` | `expirado`

## Regra
- "Aprovar insight" no UI = `UPDATE ai_brain_insights SET status = 'ativo'`. NUNCA `'aprovado'`.
- A view `ai_brain_active_view` (única fonte consumida por `_shared/brain-context.ts` e pelos agentes) filtra `status = 'ativo' AND (expires_at IS NULL OR expires_at > now())`.
- Qualquer hook, edge function, cron ou query que use `'aprovado'` quebra silenciosamente: a UI mostra sucesso, o insight some da lista de pendentes, mas NUNCA chega à IA.

## Pontos de uso já alinhados (2026-04-29)
- `src/hooks/useBrainInsights.ts` (tipo + `useApproveInsight` + filtros)
- `src/components/command-center/InsightsTab.tsx` (filtros de aba)
- `supabase/functions/ai-signal-consolidate/index.ts` (busca por insights existentes)
- `supabase/functions/ai-brain-monthly-review-reminder/index.ts` (filtro de revisão)

## Como aplicar
- Ao adicionar novo consumidor de `ai_brain_insights`, sempre filtrar por `'ativo'` para uso pela IA.
- Ao adicionar nova ação humana (revogar/descartar), usar exatamente o valor do enum.
- Se precisar de novo estado, ALTERAR o enum via migration E atualizar esta memória + doc da Central de Comando.
