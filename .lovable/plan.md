## Diagnóstico (confirmado contra banco e docs)

### 1. Tarja "Cancelado pelo comprador" não aparece nas listas
Foi colocada só em **detalhe** do pedido e do editor de NF. Nas listas (`/orders` e `/fiscal?tab=notas`) não existe. Dados já estão no banco:
- Pedidos #662 e #663 → `status=cancelled`, `cancellation_reason="There is a mediation with status cancel_purchase"`.
- NFs #446 e #447 → `status=cancelled`, vinculadas aos pedidos cancelados.

### 2. Pedido pago #665 — ciclo quase fechado, falta Pratika
- NF #448 autorizada ✅
- Envio da chave ao ML: `done` (XML aceito) ✅
- ML devolveu shipment: rastreio `AD624331900BR`, PDF salvo no bucket ✅
- **Pratika NÃO enviou** (`pratika_sent_at` vazio) — não há gatilho para esse caminho (ML→shipment).
- Status do shipment ainda `ready_to_ship` (precisa o cron de tracking evoluir).

### 3. Fila de envio entupida com cancelados
`meli_invoice_send_queue` hoje: `0 pending / 2 failed / 1 done`. Os 2 `failed` são #662/#663 (28 e 6 tentativas, erro "NF autorizada não encontrada") — NF foi cancelada junto com o pedido, mas ninguém cancela o item na fila. É isso que infla o banner "Aguardando envio da NF ao marketplace (2)" da Logística Externa.

### 4. Logística Externa — UI/UX confusa
- KPI "Aguardando NF" usa `marketplace_shipments`, banner usa `meli_invoice_send_queue` → números nunca batem.
- 3 abas renderizando a mesma tabela; sem aba de "Problemas" (existe na Interna).
- Sem deep-link da coluna Pedido para `/orders/{id}`.
- Coluna Pratika sem ação de reenvio nem motivo da falha.

---

## Plano (4 ondas, sem gambiarra)

### Onda 1 — Tarja de cancelamento nas LISTAS
Reuso do componente `BuyerCancellationNotice` (já implementado).
- **`src/components/orders/OrderList.tsx`**: na coluna Status, abaixo do badge "Cancelado", linha vermelha discreta quando `order.cancellation_reason` existir.
- **`src/components/fiscal/FiscalInvoiceList.tsx`**: na coluna Status, abaixo do badge "Cancelada", mesma linha. Resolução do motivo via `fiscal_invoices.order_id → orders.cancellation_reason` em **uma query lote** (sem N+1).
- Sem mexer em detalhe nem editor (já têm).

### Onda 2 — Fila de envio NF saneada (anti-regressão)
- Migration: estender o CHECK de `meli_invoice_send_queue.status` para incluir `cancelled` (estados reais hoje: `pending | processing | done | failed`).
- Trigger PG: quando `fiscal_invoices.status` vira `cancelled` **ou** `orders.status` vira `cancelled`, marcar itens correspondentes da fila como `cancelled` com `last_error="Pedido/NF cancelado"`.
- Backfill controlado: rodar uma vez para sair com os 2 itens (#662/#663) em `cancelled`.
- Banner da UI passa a contar somente `status='pending'` (não `failed`, não `cancelled`).

### Onda 3 — Fechar o #665 (Pratika + tracking)
- Centralizar disparo no `external-shipping-sync-cron` (que já roda 30 min e já é o orquestrador):
  - Para cada `marketplace_shipments` com `tracking_number IS NOT NULL` + NF autorizada do mesmo pedido + `pratika_sent_at IS NULL` → chamar `wms-pratika-send` ação `send_combined`. Idempotente (memória `wms-pratika-integration` já garante).
- Backfill manual: disparar `send_combined` para o pedido #665 uma vez (limpa pendência atual).
- Status do shipment evolui via `marketplace-shipments-tracking-cron` já existente (`ready_to_ship → in_transit → delivered`). Confirmar que está rodando; se estiver dormente, religar.

### Onda 4 — UI/UX da Logística Externa
Reorganização interna (mesmo módulo, mesma rota, sem mudar nome nem URL):
- **KPIs unificados**: 5 cards lêem `marketplace_shipments` (consistente entre si). Banner laranja passa a contar apenas `meli_invoice_send_queue.status='pending'`.
- **Abas claras**, espelhando a Logística Interna:
  1. *Dashboard* — KPIs + banners de pendência + últimos objetos.
  2. *Objetos de postagem* — sub-abas internas: `Aguardando NF` / `Prontos p/ envio` / `Em trânsito` / `Entregues`.
  3. *Rastreios* — só com tracking ativo, link para rastrear.
  4. *Problemas de envio/entrega* — `status in ('problem','returned')` ou `requires_action=true`. Aceita deep-link `?tab=problemas&shipment={id}` (compatível com `resolveShippingDeepLink` que já existe).
- **Coluna Pedido**: linka para `/orders/{id}`.
- **Coluna Pratika**: chip `enviado / pendente / erro` + ação "Reenviar" (admin) chamando `wms-pratika-send` com `force=true`.

> Nenhuma mudança de negócio ou troca de nome; apenas organização da própria página.

### Validação técnica obrigatória após cada onda
- **Onda 1**: consulta SQL pós-deploy + screenshot Playwright das listas com tarja visível nas linhas #662/#663 e NFs 446/447.
- **Onda 2**: SQL confirma que os 2 itens travados ficaram `cancelled` e banner some.
- **Onda 3**: `marketplace_shipments` do #665 com `pratika_sent_at` preenchido; log SOAP com `Sucesso=true` em `wms_pratika_logs`.
- **Onda 4**: abrir `/external-shipping`, conferir cada aba e o deep-link de problemas.

### Docs no fechamento
- `docs/especificacoes/logistica/logistica-externa.md` — atualizar diagrama (gatilho Pratika no cron, estados reais da fila, nova organização de abas).
- `docs/especificacoes/marketplaces/mercado-livre.md` — apontar para o cron como responsável pela Pratika.
- `.lovable/memory/constraints/meli-invoice-queue-auto-cancel.md` — nova memória anti-regressão.
- `docs/especificacoes/transversais/assuntos-em-andamento.md` — registrar fechamento desta entrega.

---

**Confirma que sigo com as 4 ondas?**
