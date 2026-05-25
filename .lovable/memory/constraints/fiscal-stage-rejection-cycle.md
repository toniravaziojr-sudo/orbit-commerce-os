---
name: Fiscal Stage Rejection Cycle
description: Rejeição da SEFAZ nunca pode deixar NF em etapa emitida. Rejeição volta para pendência e salvar revalida a nota para liberar novo envio.
type: constraint
---

# Fiscal — Ciclo correto de rejeição, edição e novo envio (rev 2026-05-25)

## Regra permanente

Quando uma nota fiscal recebe **rejeição** da SEFAZ, ela **não pode permanecer** na etapa operacional `emitida`.

O comportamento obrigatório é:

1. **Rejeição** → status oficial `rejected` + etapa operacional `pendencia`.
2. O motivo da rejeição deve ficar visível na própria nota como pendência.
3. Ao **salvar** a nota editada na aba Notas Fiscais, o sistema deve **revalidar automaticamente** o documento.
4. Se tudo estiver correto após a edição, a nota volta para **Pronta para Emitir**.
5. Se ainda houver problema cadastral/fiscal, permanece em **Pendência Identificada**.

## Proibido

- Marcar `fiscal_stage='emitida'` quando a resposta real do provedor for rejeição/erro de autorização.
- Deixar uma nota com combinação inconsistente como `status='draft'` + `fiscal_stage='emitida'`.
- Exigir ação manual fora do fluxo normal só para recalcular a etapa depois de uma edição.

## Onde reforçar

- Envio síncrono e assíncrono para a SEFAZ.
- Retorno assíncrono por webhook.
- Salvamento de nota manual já existente na aba Notas Fiscais.

## Por que existe

Sem essa regra, a nota fica presa como rascunho visualmente, mas sem voltar para **Pronta para Emitir**, escondendo o botão de envio e quebrando o ciclo operacional do fiscal.