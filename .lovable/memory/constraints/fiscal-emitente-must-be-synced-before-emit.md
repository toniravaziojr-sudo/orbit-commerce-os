---
name: Fiscal Emitente Must Be Synced Before Emit
description: NF-e transmission must auto-sync emitente registration when local fiscal_settings is newer than provider snapshot, blocking transmission if sync fails
type: constraint
---

# Regra

Antes de transmitir ou reenviar uma NF-e, `fiscal-submit` e `fiscal-emit` DEVEM
comparar `fiscal_settings.updated_at` com `fiscal_settings.focus_ultima_sincronizacao`.

Se o cadastro local estiver mais novo (ou nunca tiver sido sincronizado), o backend
DEVE chamar `fiscal-sync-focus-nfe` automaticamente antes de transmitir. Se a
sincronização falhar ou o snapshot externo não avançar, a transmissão é
bloqueada com erro de negócio.

## Por que

Sem esse gate, mudanças de regime tributário (ex.: Simples → MEI / CRT 4) ficam
salvas no banco local mas não chegam ao provedor fiscal. A NF é transmitida com
o cadastro defasado e a SEFAZ devolve rejeição 481 ("Código Regime Tributário
do emitente diverge do cadastro na SEFAZ"). Reenvios com nova `focus_ref`
continuam falhando até o provedor ser atualizado.

## Implementação

- Helper único: `supabase/functions/_shared/fiscal-emitente-sync-gate.ts` →
  `ensureEmitenteSynced()`.
- Plugado em `fiscal-submit` e `fiscal-emit` após carregar `fiscal_settings` e
  antes do `evaluateEmissionGate`.
- Em sucesso, `settings` é recarregado para refletir o snapshot fresco antes da
  montagem do payload NF-e.

## Anti-regressão

- Não criar UI para "forçar resync" — o gate é automático e mandatório.
- Não silenciar erro de sync; o usuário deve ver mensagem clara em vez de mandar
  cadastro defasado para a SEFAZ.
- Qualquer nova edge function que transmita NF-e (ex.: emissão programada,
  retry batch) DEVE chamar o mesmo helper.
