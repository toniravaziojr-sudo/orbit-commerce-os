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

## 8. Enriquecimento de Pedidos do ML (rev 2026-06-29 — v3.12)

A função `meli-sync-orders` agora consome **três endpoints** por pedido (`/orders/{id}`, `/orders/{id}/billing_info`, `/shipments/{id}` com header `x-format-new: true`) para entregar ao módulo `/orders` o pedido completo com **CPF/CNPJ, nome real, endereço de entrega e telefone**. Detalhe completo do contrato e dos parsers em `docs/especificacoes/marketplaces/mercado-livre.md` §"Sync de Pedidos v3.12".

Pontos-chave que afetam a Logística Externa:
- O endereço usado na etiqueta vem prioritariamente do **shipment** (`destination.receiver_address`), com `billing_info` como fallback.
- Cada pedido importado entra com `payment_gateway='mercadolivre'` e `payment_gateway_id` válido, então passa a contar nos relatórios financeiros (Dashboard / Pagamentos).
- O badge de origem na lista `/orders` usa o logo oficial do ML (`src/assets/marketplaces/mercadolivre.png`).
- E-mail do comprador permanece sintético (`meli-{orderId}@marketplace.local`) por restrição da API do ML; `customer_notes` registra essa pendência para visibilidade do lojista.

## 9. Anti-regressão — Duplicação e Vazamento (rev 2026-06-30)

**Incidentes corrigidos:**
- **#658 (Alexandre — loja):** postagem manual criou segundo objeto sem amarrar ao PV. O rascunho original ficou em `failed` e o manual em `posted`, gerando duplicidade no `/external-shipping`.
- **#665 (Carlos — ML) e #670 (Hilário — ML):** o gatilho `sync_shipment_with_pv_status` criou rascunhos Correios para pedidos de marketplace (sem rota válida → `failed` permanente).

**Correções aplicadas:**

1. **Gatilho `sync_shipment_with_pv_status`** agora pula:
   - PVs com `marketplace_source` preenchido (ML, Shopee, etc.) — etiqueta é externa.
   - PVs cuja resolução de transporte aponta `reason='marketplace'` (cinto-suspensório).
   - Mantém o pulo já existente para `provider_kind='gateway'` (Frenet).

2. **`shipping-register-manual`** agora:
   - Resolve o PV canônico (raiz, `source_order_invoice_id IS NULL`) a partir do `order_id`.
   - **Adota** um rascunho ativo existente (mesmo PV ou mesmo pedido) em vez de criar uma nova linha. UPDATE em vez de INSERT.
   - Garante `source_pedido_venda_id` preenchido na remessa final.

3. **Trava física no banco:** índice único parcial `uq_shipments_active_per_pv`:
   ```sql
   UNIQUE (source_pedido_venda_id)
     WHERE source_pedido_venda_id IS NOT NULL
       AND delivery_status NOT IN ('canceled','returned','failed')
   ```
   Impede mais de 1 objeto ativo por PV. **Saída manual preservada:** múltiplos PVs do mesmo pedido (reenvio, segunda etiqueta) continuam gerando seu próprio objeto, porque a unicidade é por PV — não por pedido. Estados terminais (`canceled`, `returned`, `failed`) saem do índice, permitindo retry após falha.

4. **UI `/external-shipping`:** tabela agora exibe coluna **Cliente** (join com `orders.customer_name`) e usa `order_number` interno quando disponível.

**Regra canônica reforçada:** `1 PV = 1 objeto logístico ativo`. Para reenviar/segundo envio → criar novo PV (manual ou duplicado) e o objeto nasce vinculado automaticamente.

## 10. Promoção de status do pedido a partir do shipment marketplace (rev 2026-06-30)

**Princípio:** o ciclo de vida do pedido marketplace (`orders.status`, `shipping_status`, `tracking_code`, `shipped_at`, `delivered_at`) precisa refletir o estado real do shipment no marketplace, espelhando exatamente o que `shipment-ingest` já faz para o fluxo interno (Correios/Pratika). A ausência dessa ponte deixava pedidos travados em `invoice_authorized` / `processing` mesmo depois de "A caminho" no ML (incidentes #665 e #670).

**Implementação:** a ponte vive na Edge Function `meli-fetch-shipment` (padrão de arquitetura: ação em edge, não em trigger SQL — ver `mem://architecture/automation-trigger-cron-standard`). Após o `upsert` em `marketplace_shipments`, a função:

1. Lê `orders.status, shipping_status, tracking_code, shipping_carrier, shipped_at, delivered_at`.
2. Traduz o status cru do ML para o **vocabulário canônico único** do sistema. Esse vocabulário vale tanto para `marketplace_shipments.status` quanto para `orders.shipping_status` — não há mais dois dialetos.

| ML raw (`shipment.status`) | Sistema canônico (`marketplace_shipments.status` + `orders.shipping_status`) |
|---|---|
| `pending` / `handling`                       | `awaiting_shipment` |
| `ready_to_ship` **sem** tracking             | `awaiting_label` |
| `ready_to_ship` **com** tracking             | `label_generated` |
| `shipped`                                    | `shipped` |
| `delivered`                                  | `delivered` |
| `not_delivered`                              | `problem` |
| `cancelled`                                  | `cancelled` *(só em `marketplace_shipments`; `orders.shipping_status` não é atualizado, `orders.status='cancelled'` é a fonte de verdade da cancelação)* |

3. Atualiza `tracking_code` e `shipping_carrier` quando vazios ou divergentes.
4. **Promove** `orders.status='dispatched'` (+ `shipped_at=now()` se nulo) quando o status canônico está em `{label_generated, shipped, delivered}` **e** o status atual está em `preDispatchOrderStatuses` (`paid, processing, ready_to_invoice, pending, awaiting_shipment, invoice_pending_sefaz, invoice_authorized, invoice_issued, fulfilled`).
5. Promove `orders.status='delivered'` (+ `delivered_at=now()`) quando o ML reporta `delivered`.
6. **Nunca regride** pedidos em estados terminais.
7. Audita em `order_history` (`action='shipment_updated'`).

**Envio automático para o WMS Pratika (rev 2026-07-01):** logo depois de gravar o rastreio e baixar o PDF da etiqueta ML, `meli-fetch-shipment` chama `wms-pratika-send` com `action=send_combined` se o tenant tem `wms_pratika_configs.is_enabled=true`. O `wms-pratika-send` valida a NF autorizada (âncora oficial), monta o XML + rastreio e envia sob o mesmo CNPJ. Idempotência é dupla: índice único parcial em `wms_pratika_logs` impede corrida, e `marketplace_shipments.pratika_sent_at` corta chamadas repetidas em ciclos do cron. Se a NF ainda não estiver autorizada no momento da chamada, o próximo ciclo do `wms-pratika-reconcile` cobre — que também passa a considerar tracking em `marketplace_shipments` (não só `shipments`).

**Guarda complementar no `meli-sync-orders`:** o sync de pedidos não pode rebaixar `orders.status` quando o pedido já está em estado avançado (`invoice_pending_sefaz, invoice_authorized, invoice_issued, dispatched, shipped, in_transit, delivered, completed, cancelled, returning, returned`). Apenas `payment_status` e demais campos continuam sendo espelhados. Cancelamentos do ML continuam tendo precedência (exceção controlada).

**Referência cruzada:** o fluxo interno usa o mesmo padrão em `supabase/functions/shipment-ingest/index.ts`. Toda alteração nesta ponte deve manter paridade lógica com `shipment-ingest`.

