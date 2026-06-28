# Logística Externa — Marketplaces e Gateways

## 1. Princípio de roteamento

| Quem emite a etiqueta? | Módulo destino |
|------------------------|----------------|
| **Nós** (Correios via integração interna, etiqueta gerada pelo ERP) | `/shipping` — Logística Interna |
| **Terceiros** (Mercado Livre, Shopee, TikTok Shop, Amazon, Frenet, Melhor Envio) | `/external-shipping` — Logística Externa |

Não há duplicidade: cada pedido cai em **um** módulo conforme a origem da etiqueta.

## 2. Fluxo Mercado Livre (ciclo NF → Etiqueta → Pratika)

```
Pedido criado no ML
   │
   ▼
[Webhook orders_v2] → meli-sync-orders → INSERT em `orders` (sales_channel='marketplace')
   │
   ▼
Trigger NF-e (auto-emissão por canal marketplace) → fiscal_invoices.status='authorized'
   │
   ▼
meli-send-invoice (fila `meli_invoice_send_queue`)
   │ envia chave da NF ao ML via POST /orders/{id}/invoice
   ▼
ML processa e libera etiqueta
   │
   ▼
[Webhook shipments] → meli-fetch-shipment → baixa PDF da etiqueta,
                                              salva em storage `marketplace-labels`,
                                              atualiza `marketplace_shipments`
   │
   ▼
external-shipping-sync-cron (a cada 30 min) → wms-pratika-send
                                              despacha tracking/etiqueta à Pratika
```

## 3. Esquema de dados

### `marketplace_shipments`
Centraliza qualquer etiqueta emitida externamente.
- `source_key`: `mercadolivre | shopee | tiktok_shop | amazon_seller | frenet | melhor_envio`
- `status`: `awaiting_invoice | ready_to_ship | label_issued | in_transit | delivered | problem | returned | cancelled`
- `label_pdf_url`: caminho no bucket `marketplace-labels` (privado) ou URL externa
- `tracking_number`, `tracking_url`, `carrier`
- `pratika_sent_at`: marca quando o objeto foi despachado para a Pratika

### `meli_invoice_send_queue`
Fila idempotente que controla o envio da chave da NF ao ML.
Estados: `pending | sent | failed`.

## 4. Edge functions

| Função | Disparo | Responsabilidade |
|--------|---------|------------------|
| `meli-webhook` | ML (HTTP) | Roteia `orders_v2/orders` → `meli-sync-orders`; roteia `shipments` → `meli-fetch-shipment` |
| `meli-sync-orders` | Webhook + cron 15 min | Insere/atualiza pedidos em `orders` |
| `meli-orders-reconcile` | Cron 15 min | Rede de segurança caso webhook perca eventos |
| `meli-send-invoice` | Trigger NF autorizada | Envia chave ao ML, registra em `meli_invoice_send_queue` |
| `meli-fetch-shipment` | Webhook shipments | Baixa PDF da etiqueta + tracking, salva em `marketplace_shipments` |
| `external-shipping-sync-cron` | Cron 30 min | Orquestra: refresh tokens, processa fila de NFs, retenta etiquetas pendentes, dispara Pratika |
| `wms-pratika-send` | Cron 30 min | Envia tracking ao WMS Pratika (lê `marketplace_shipments` como fallback) |

## 5. Crons agendados (pg_cron)

- `meli-orders-reconcile-15m` — `*/15 * * * *`
- `external-shipping-sync-cron-30m` — `*/30 * * * *`

## 6. UI

- **Sidebar:** "Logística Interna" + "Logística Externa".
- **`/external-shipping`:** KPIs (total, aguardando NF, em trânsito, entregues, problemas), filtro por fonte, abas Dashboard / Objetos / Rastreios, download de etiquetas e link de rastreio externo.

## 7. Pendências operacionais

- Inscrever os tópicos `orders_v2` e `shipments` no app DevCenter do ML do tenant (sem isso o webhook não chega).
- Garantir que `fiscal-invoice-issue` dispare automaticamente para pedidos com `sales_channel='marketplace'`.
- Configurar Pratika para aceitar tracking de múltiplas fontes (já há fallback em `wms-pratika-send`).
