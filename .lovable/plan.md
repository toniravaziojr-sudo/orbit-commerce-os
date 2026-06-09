# Reaproveitamento de numeração para rascunhos puros — ENTREGUE (v2026-06-09)

Reversão controlada da regra de numeração estritamente monotônica. Rascunho puro reaproveita número; documento que tocou a SEFAZ continua intocável.

## O que foi implementado

### Banco
- Backfill de `fiscal_settings.numero_nfe_atual` por tenant a partir do maior número de NF que já tocou a SEFAZ (com `chave_acesso`, status `authorized/rejected/cancelled` ou evento `numero_duplicado_sefaz`). Garante que nenhum número queimado lá fora possa ser reusado.
- Trigger `guard_nf_deletion_when_submitted_to_sefaz`: bloqueia `DELETE` em NF com `chave_acesso` ou evento `submitted/authorized/rejected/submission_error/numero_duplicado_sefaz` (código `NF_ALREADY_SUBMITTED_TO_SEFAZ`).
- Tabela `nf_deletion_audit` (espelho de `pv_deletion_audit`) + trigger `audit_nf_deletion` para snapshot na exclusão.

### Edge functions
- `fiscal-prepare-invoice`, `fiscal-create-manual`, `fiscal-create-draft`, `fiscal-auto-create-drafts`: removida chamada a `syncFiscalNumberCursor` na criação de rascunhos (NF e PV). Cursor não avança mais por criação.
- `fiscal-submit` e `fiscal-emit`: passam a bumpar `numero_nfe_atual` para `numeroAtual + 1` no caminho de sucesso. O cursor é agora a marca alta da SEFAZ.

### UI
- Diálogo de exclusão de PV/NF mostra: "O número #X ficará disponível para a próxima criação."
- Novo tratamento de erro `NF_ALREADY_SUBMITTED_TO_SEFAZ` com mensagem clara em PT-BR direcionando para Cancelar/Inutilizar.

### Documentação
- `docs/especificacoes/erp/erp-fiscal.md`: seção "Numeração com reaproveitamento controlado (v2026-06-09 — Onda 3 rev2)" + atualização de "Cancelamentos/inutilizações não liberam números, mas rascunho puro sim".
- Memória `mem://constraints/fiscal-pure-draft-number-reuse` criada e indexada.

## O que NÃO foi tocado (anti-regressão)
- Fluxo de envio Pratika, retry de duplicidade SEFAZ, bloco transportador, vínculo NF↔shipment, auditoria de salto.
- Triggers existentes de PV: `guard_pv_deletion_from_paid_order`, cascata de objetos, reconciliação de PV órfão.
- Numeração da remessa (timestamp).
- Objeto logístico: regra atual mantida (sequencial natural com reuso já existente; cascata respeita remessa despachada).

## Validação técnica executada
- Migração aplicada com sucesso; backfill rodou.
- Edits de edge functions revisados — `syncFiscalNumberCursor` removida apenas dos pontos de criação, mantida no shared para uso futuro se necessário.

## Validação pendente do usuário
1. Criar NF rascunho → excluir → criar outra → confirmar reuso do número.
2. Emitir NF de verdade → tentar excluir → confirmar bloqueio com mensagem "já foi enviada à SEFAZ".
3. Duplicar PV → excluir o duplicado → criar novo PV → confirmar reuso.
4. PV de pedido pago → confirmar bloqueio com nome do pedido.
5. PV rascunho com objeto logístico só em rascunho → confirmar cascata e reuso.
6. Remessa despachada → tentar excluir PV → confirmar bloqueio.
7. Emitir NF completa pela Pratika → confirmar zero regressão.
