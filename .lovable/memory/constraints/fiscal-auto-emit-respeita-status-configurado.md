---
name: Fiscal Auto-Emit — Gatilho único ready_to_invoice
description: Auto-emissão de NF-e tem UM único gatilho oficial — pedido em 'ready_to_invoice'. A opção legada 'paid' foi removida da UI e é normalizada no save. Só pedidos reais (loja/marketplace) são afetados; PV manual fica fora.
type: constraint
---

# Fiscal Auto-Emit — Gatilho único `ready_to_invoice`

## Regra (v2026-06-10 — substitui versão anterior baseada em `emitir_apos_status`)

`fiscal-auto-create-drafts` só pode invocar `fiscal-emit` quando TODAS as
condições forem verdadeiras:

1. Emissor fiscal totalmente configurado (`isFiscalConfigured`).
2. `fiscal_settings.emissao_automatica === true`.
3. `numero > 0` (numeração válida atribuída ao rascunho).
4. `order.status === 'ready_to_invoice'` — **único** gatilho oficial.
5. PV é raiz com `order_id IS NOT NULL` (pedido real da loja ou marketplace).
   PV manual (sem `order_id`) **nunca** entra nesse fluxo.

A coluna `fiscal_settings.emitir_apos_status` continua existindo por
compatibilidade, mas o backend `fiscal-settings` força sempre o valor
`'ready_to_invoice'` no save. O motor não lê mais essa coluna para decidir
o gatilho — usa `ready_to_invoice` direto.

## Por quê

A opção legada `'paid'` disparava emissão imediatamente no pagamento, antes
do pedido passar pela conferência operacional ("Pronto para emitir NF").
Manter dois gatilhos confunde o usuário e gera emissão prematura. Regra de
negócio é uma só: NF sai quando o pedido está pronto para emitir, ponto.

## UI

- Tela "Configurações Fiscais → Outros" e a tela paralela em
  `FiscalSettingsContent.tsx` mostram apenas o toggle "Emissão Automática
  de NF-e" + uma caixa de texto explicando a regra. **Proibido** voltar o
  seletor "Emitir NF-e quando" com a opção `paid` (legado).
- O Select de "Transportadora Padrão" no bloco de Remessa Automática usa
  sentinela `__order_carrier__` para representar "Usar transportadora do
  pedido" — **proibido** `<SelectItem value="">` (quebra Radix Select e
  derruba a tela inteira com "Algo deu errado").

## Remessa automática

Sem mudança de lógica. `linkNFeToShipment` em `fiscal-webhook` só é chamado
quando `invoice.order_id` existe — ou seja, NF de pedido real (loja ou
marketplace). NF originada de PV manual (sem `order_id`) não gera remessa
automática. Pedidos via gateway (Frenet etc.) e marketplace continuam fora
da fila local conforme `mem://features/logistics/gateway-vs-local-shipping-routing`.

## Anti-regressão

- `fiscal-settings` precisa forçar `emitir_apos_status='ready_to_invoice'`
  no save, ignorando qualquer valor recebido.
- `fiscal-auto-create-drafts` não pode voltar a ramificar por
  `emitir_apos_status`. Comparação é `orderStatus === 'ready_to_invoice'`
  direto, em ambos os caminhos (rascunho novo e rascunho já existente).
- Migração única já normalizou todos os registros legados para
  `'ready_to_invoice'` em 2026-06-10.
- Não reintroduzir SelectItem com valor vazio em nenhuma tela.

## Validação obrigatória ao mexer no fluxo

1. Pedido pago em status `paid` (não `ready_to_invoice`) → rascunho criado,
   **sem** chamada a `fiscal-emit` nos logs.
2. Mesmo pedido transita para `ready_to_invoice` → log
   "Auto-emit (rascunho existente) disparado".
3. `emissao_automatica=false` → nenhuma chamada a `fiscal-emit` em nenhum
   cenário.
4. PV manual sem `order_id` → nunca passa por auto-emit nem auto-remessa.
5. Ativar "Criar Remessa Automaticamente" na UI → tela não quebra; campo de
   transportadora padrão aparece com opção "Usar transportadora do pedido".
