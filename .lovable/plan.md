## Revisão contra docs e memórias

Encontrei 3 fatos que enxugam o plano:

1. **A distinção comprador × lojista já existe no próprio status do pedido.**
   - `cancelled` → cancelamento externo (comprador no ML, expiração, chargeback). `cancellation_reason` traz o detalhe.
   - `cancelled_by_user` → cancelamento manual do lojista (cascata oficial documentada em `mem://constraints/payment-cancel-cascades-to-cancelled-by-user`).
   - Não preciso criar coluna nova nem fazer backfill — basta o componente de tarja ler o status.
2. **`cancelled_at + cancellation_reason` já são obrigatórios** em toda transição (trigger `trg_guard_order_cancellation_metadata`). Garantido em loja e marketplace.
3. **PV já é espelho vivo do pedido** (`trg_orders_sync_pv_status` + `trg_guard_pv_cancellation`). `pedido_status='cancelled'` no PV é fonte de verdade — é só o que falta o componente da tarja olhar.

## O problema (confirmado)

- Na aba **Pedidos de Venda** do Fiscal, a tarja não aparece porque a condição atual exige `invoice.status === 'cancelled'`, mas o PV mantém `status='draft'` mesmo cancelado (quem reflete o cancelamento é `pedido_status`).
- O texto da tarja hoje só fala em "comprador". Para pedidos da loja cancelados pelo lojista, fica enganoso.
- O rastreio externo do #665 (`AD624331900BR`) **não tem bug**: `tracking_url` está preenchido (`mercadolibre.com.br/envios/47404539295`) e o botão aparece (tooltip "Rastreio externo" visível no print). O que falta é a primeira leitura física dos Correios para começar a aparecer movimentação.

## O que eu faria

### 1. Tarja em Pedidos de Venda (Fiscal → modo `orders`)
`src/components/fiscal/FiscalInvoiceList.tsx`, linha 2055: trocar a condição da tarja para:
```ts
(mode === 'orders' && pedidoStatusOf(invoice) === 'cancelled')
|| (mode === 'notas' && invoice.status === 'cancelled')
```
Componente `BuyerCancellationNotice` continua igual; o batch loader `cancellationReasonByOrder` que já existe alimenta o motivo. Nenhuma mudança em fluxo fiscal.

### 2. Tarja universal (loja + marketplace) com origem correta
Apenas em `src/components/orders/BuyerCancellationNotice.tsx`:
- Passar a aceitar `status` com os dois valores reais (`cancelled`, `cancelled_by_user`).
- `humanize()` ganha um galho:
  - `cancelled_by_user` → **"Cancelado pelo lojista"** (mostra `cancellation_reason` em parênteses se houver).
  - `cancelled` + razão batendo em regex de comprador/mediação/expirou → mantém os textos atuais ("Cancelado pelo comprador", "Cancelado em mediação", etc.).
  - `cancelled` sem razão reconhecível → **"Pedido cancelado"** genérico.
- Lista de status considerados "cancelado-like" já inclui `cancelled_by_user` no `OrderList` (linha 97). Componente só precisa renderizar quando o status casar.

Resultado: tarja aparece automaticamente em **qualquer pedido cancelado** (loja ou marketplace), em Pedidos, Pedidos de Venda e Notas Fiscais, com texto que reflete quem cancelou.

### 3. Rastreio externo do #665
Sem código nesta entrega — resposta clara na conversa: o botão está disponível, o link aponta para o painel de envios do ML e o objeto ainda não foi lido pelos Correios. Não há bug a corrigir.

> **Ponto que peço sua decisão:** posso (opcional, pequeno) adicionar um tooltip "Sem movimentações ainda" no chip de status do objeto quando `last_tracking_event_at` for nulo? Ajuda a deixar explícito que não é bug. Se preferir não tocar agora, sigo só com 1 e 2.

## Resultado final

- PV cancelado mostra a mesma linha discreta abaixo do status.
- Em qualquer canal, a tarja diz quem cancelou — comprador, lojista ou genérico — sem inventar coluna nem migração.
- Rastreio externo permanece como está; ambiguidade fica resolvida na conversa (e, se você autorizar, com o tooltip do item 3).

## Detalhes técnicos

- Arquivos tocados: `src/components/orders/BuyerCancellationNotice.tsx`, `src/components/fiscal/FiscalInvoiceList.tsx`.
- Zero migrações, zero backfill, zero edge function.
- Sem mudança em triggers, fila de NF marketplace, Pratika ou logística externa.
- Sem alteração em fluxo de cancelamento — só leitura do estado já existente.

## Validação técnica pós-entrega

- SQL: confirmar que os PVs 1-450/1-451 do tenant Respeite o Homem têm `pedido_status='cancelled'` e que o pedido linkado tem `cancellation_reason` populado.
- Visual: abrir `/fiscal` (Pedidos de Venda), `/fiscal?tab=notas`, `/orders` — verificar a linha vermelha discreta em pedidos cancelados, com o texto correto para comprador (ML) e para "lojista" caso exista pedido cancelado por essa via.

## Documentação a atualizar

- `docs/especificacoes/ecommerce/pedidos.md` — registrar que a tarja é universal e reflete `cancelled` × `cancelled_by_user`.
- `docs/especificacoes/transversais/mapa-ui.md` — tarja agora também na aba Pedidos de Venda.
- Sem memória nova: as regras de origem já estão cobertas por `payment-cancel-cascades-to-cancelled-by-user` e `pv-cancellation-must-mirror-order`.

Confirma que sigo nessa direção? E me diz se quer ou não o tooltip opcional do item 3.
