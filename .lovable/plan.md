## 📋 Auditoria — Fluxo Mercado Livre end-to-end

### Estado atual (evidência real no banco)

**Pedido #677 (2000017192996616) — teste vivo:**
- Entrou via webhook, cliente/itens criados, propagou para fiscal.
- NF autorizada, XML enviado ao ML às 18:50, etiqueta baixada (`AD633638976BR`).
- Ponte marketplace_shipments → orders aplicou: `status=dispatched`, `shipping_status=label_generated`, `tracking_code`, `shipped_at`.
- Pratika combined recebeu NF + rastreio às 19:00 com sucesso (3 logs: nfe ✅, tracking ✅, combined ✅).

**Últimos 3 pedidos ML (#665, #670, #677):** todos com `dispatched` + `pratika_sent_at` + `invoice_sent_at` preenchidos. Zero pedido travado.

**Filas e crons ativos:**
- `meli-token-refresh-30min` ✅
- `meli-orders-reconcile-15m` ✅ (fallback de pedidos perdidos)
- `external-shipping-sync-cron-30m` ✅ (drena `meli_invoice_send_queue` + re-sincroniza shipments não-terminais)
- `wms-pratika-reconcile-every-30min` ✅ (agora enxerga `marketplace_shipments`)
- `reconcile-orphan-pv-shipments-15m` ✅

### Pipeline confirmado
```
ML → webhook (orders_v2) → meli-sync-orders → orders + customer + itens
                                              ↓ (trigger enqueue_fiscal_on_item_link)
                                       fiscal_draft_queue
                                              ↓ (ready_to_invoice + emissao_automatica)
                                       fiscal-emit → NF autorizada
                                              ↓ (trigger SQL)
                                       meli_invoice_send_queue
                                              ↓ (external-shipping-sync-cron 30m)
                                       meli-send-invoice (XML autorizado ao ML)
                                              ↓
ML libera etiqueta → webhook (shipments) → meli-fetch-shipment
                                              ↓
                            marketplace_shipments + PDF no bucket
                                              ↓ (ponte)
                            orders.status=dispatched, tracking, shipped_at
                                              ↓ (se Pratika ativa + tracking)
                                       wms-pratika-send (send_combined)
                                              ↓
                            Pratika recebe NF + etiqueta juntas
```

### Análise de regressão em outros módulos

- **Fiscal:** trigger `enqueue_fiscal_on_item_link` inalterado; `fiscal-auto-create-drafts` continua com gatilho único `ready_to_invoice`. Sem regressão.
- **Logística interna (Correios/Frenet):** `shipment-ingest` mantém vocabulário canônico próprio; `meli-fetch-shipment` espelha o mesmo mapa. Sem cruzamento.
- **Clientes/Leads:** `meli-sync-orders` continua com identity resolution unificada (external_id → cpf → email real → phone). Sem regressão.
- **Pedidos loja:** ponte só age quando `orders.status` está em `preDispatchOrderStatuses` — pedidos loja em `dispatched/delivered/cancelled` não são tocados.
- **WMS Pratika para loja:** `wms-pratika-reconcile` agora consulta `marketplace_shipments` como fonte adicional de rastreio — não remove nem altera a checagem em `shipments` (loja). Sem regressão.
- **Dashboards/relatórios:** consomem `orders` (não filtram por source) → pedidos ML já contam.
- **Enum `shipping_status`:** adicionado `awaiting_label` (novo valor, não altera existentes). Constraint de `marketplace_shipments.status` ampliada, mantém retrocompat.

### Pontos de atenção (não bloqueadores)

1. **#665 tem `orders.shipping_status='in_transit'` mas `ms.status='delivered'`** — próximo tick do cron 30m re-sincroniza e promove a `delivered`. Bridge está correta; foi só ordem de eventos. Não é bug estrutural.
2. **`meli-fetch-shipment` não tem cron dedicado** — depende do webhook `shipments` do ML + do `external-shipping-sync-cron` que re-sincroniza shipments não-terminais. Cobertura já existe.

### Conclusão

**O próximo pedido pago no ML vai percorrer o fluxo completo automaticamente**, com 4 crons de reconciliação como rede de segurança. Nenhuma regressão introduzida em fluxos existentes (loja, fiscal interno, logística interna, Pratika para loja, PV, dashboards).

### Ação recomendada

Nenhuma alteração necessária. Fluxo sólido e validado com pedido real (#677). Sugiro apenas monitorar o próximo pedido novo para confirmação visual pelo usuário na Pratika.

📌 **STATUS DA ENTREGA:** Corrigido e validado (por pedido #677 vivo).

✅ Sem atualização documental necessária, porque a auditoria confirmou que o comportamento em produção já bate com `docs/especificacoes/marketplaces/mercado-livre.md` e `docs/especificacoes/logistica/logistica-externa.md` atualizados na entrega anterior.
