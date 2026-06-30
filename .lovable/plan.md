## Plano final — Correção estrutural de duplicação e vazamento logístico

### Causas-raiz confirmadas
1. **Bug 1 (estrutural):** Gatilho `sync_shipment_with_pv_status` só pula `provider_kind='gateway'`. Não pula marketplace. Por isso pedidos do ML geram objeto Correios fantasma na Logística Interna. (A fila `shipping_draft_queue` já bloqueia marketplace — o furo é exclusivo deste gatilho, que grava direto em `shipments`.)
2. **Bug 2 (estrutural):** Postagem manual da loja cria nova linha em `shipments` sem costurar `source_pedido_venda_id`. O índice único parcial atual só cobre PV preenchido + tracking preenchido, então a duplicata escapa.
3. **Bug 3 (UI):** Logística Externa não exibe nome do cliente nos rastreios.

### Regra canônica preservada
- 1 PV = 1 objeto de remessa. Múltiplos PVs do mesmo pedido = múltiplos objetos legítimos (saída manual para reenvio confirmada por você).
- Marketplace nunca tem objeto local.
- PV de pedido marketplace continua existindo (necessário para NF + envio externo ao ML).

---

## Execução

### Onda 1 — Blindar o gatilho `sync_shipment_with_pv_status` contra marketplace
Migração ajustando a função para sair imediatamente quando o pedido for de marketplace:
- Checar `orders.marketplace_source IS NOT NULL` **ou** `resolve_order_shipping_provider(order_id).reason = 'marketplace'`.
- Mesmo bloqueio aplicado em `public.reconcile_orphan_pv_shipments` (rede de segurança).
- Preserva o ramo de cancelamento terminal (memória `pv-status-shipment-mirror-preserves-active`).
- Mantém intacto o ramo `gateway` (já correto).

### Onda 2 — Postagem manual adota rascunho e amarra PV
Auditar o caminho de criação manual (edge `shipping-create-shipment` e UI `ShipmentGenerator`):
- Antes de INSERT, buscar `shipments` do mesmo `order_id` com `tracking_code` vazio (rascunho do gatilho). Se existir, **UPDATE** com tracking/label/status — proibido criar segunda linha.
- Resolver `source_pedido_venda_id` (via `fiscal_invoices` do pedido) e costurar SEMPRE antes do INSERT/UPDATE.
- Cumpre `shipment-ingest-adopt-draft-and-auto-dispatch` e `shipping-canonical-link-is-pv-not-order`.
- Se aparecer mais de uma porta de entrada (RPC, outro edge), aplico em todas e te listo no fechamento.

### Onda 3 — Trava física no banco (defesa em profundidade)
Migração criando índice único parcial em `shipments`:
- `UNIQUE (source_pedido_venda_id) WHERE source_pedido_venda_id IS NOT NULL AND delivery_status NOT IN ('cancelled','failed')` — no máximo 1 objeto ativo por PV.
- Não bloqueia múltiplos PVs do mesmo pedido (saída manual de reenvio).
- Não bloqueia históricos cancelados nem rascunhos falhos antigos.
- Convive com o índice atual `idx_shipments_pv_tracking`.

### Onda 4 — Limpeza dos 3 objetos fantasmas (autorizada)
DELETE direcionado e auditado:
- `cf4b2ada-982f-4c0b-9cd4-f8be84465292` (PV #446 / Alexandre — duplicata órfã do manual AP146180332BR).
- `89ec77f1-56c7-4020-b55a-1c732e6c8df1` (PV #452 / Carlos ML — fantasma).
- `1f6c1e63-a6b4-4e21-8162-74996441c92d` (PV #453 / Hilário ML — fantasma).
- Registro em `order_history` de cada pedido com nota explicando a limpeza.

### Onda 5 — UI Logística Externa exibe cliente
Em `src/pages/ExternalShipping.tsx`:
- Join opcional com `orders` para puxar `customer_name`.
- Nova coluna "Cliente" antes de "Pedido" na tabela de rastreios.

### Onda 6 — Documentação + memórias (anti-regressão obrigatória)
- `docs/especificacoes/erp/logistica.md`: nova seção "Roteamento marketplace × gatilho de PV" + reforço "1 PV = 1 objeto, saída manual = novo PV".
- `docs/especificacoes/logistica/logistica-externa.md`: nota de não-duplicidade e cliente visível.
- Nova memória `mem://constraints/pv-shipment-trigger-must-skip-marketplace`.
- Nova memória `mem://constraints/manual-shipment-must-adopt-pv-draft` (cita incidente #658).
- Atualizar `mem://index.md`.
- `docs/tecnico/base-de-conhecimento-tecnico.md`: registro do incidente.

### Onda 7 — Validação técnica obrigatória
1. `SELECT COUNT(*) FROM shipments s JOIN orders o ON o.id=s.order_id WHERE o.marketplace_source IS NOT NULL AND s.delivery_status NOT IN ('cancelled')` → **0**.
2. `SELECT source_pedido_venda_id, COUNT(*) FROM shipments WHERE delivery_status NOT IN ('cancelled','failed') AND source_pedido_venda_id IS NOT NULL GROUP BY 1 HAVING COUNT(*)>1` → **vazio**.
3. Os 3 IDs fantasmas → `SELECT COUNT(*)` = **0**.
4. Aba "Pendentes" da Logística Interna: apenas pedidos reais da loja.
5. Logística Externa: "Carlos Roberto…" e "Hilario…" visíveis.
6. Simular INSERT duplicado por PV → deve falhar pelo índice único.
7. `tsgo` limpo e logs de edge sem erro nos 5 min pós-deploy.

---

## Pontos de parada (consulto antes de continuar)
- Se a Onda 3 acusar duplicatas legadas adicionais que ainda não vi, paro e te listo antes de aplicar.
- Se o caminho da postagem manual tiver mais de uma porta de entrada, aplico em todas e te informo quais.
- Qualquer mudança de UI/UX além da coluna "Cliente" — paro e pergunto.

📌 STATUS: Plano consolidado e revisado — aguardando "Implementar" para executar todas as ondas.
