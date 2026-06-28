
## 📋 CHECKLIST DE CONFORMIDADE
- Doc de Regras do Sistema lido (governança)
- Docs do tema lidos: `mercado-livre.md`, `erp/logistica.md`, memórias `wms-pratika-*`, `gateway-vs-local-shipping-routing`
- **Lacuna documental declarada:** não existe doc formal para "Logística Externa" — será criada na Onda 4
- Fluxo afetado: ingestão de pedido ML → `orders` → NF automática (Focus) → envio chave NF ao ML → ML libera etiqueta → puxa etiqueta → Pratika + tracking + notificações
- Fonte de verdade: `orders` (pedido), `fiscal_invoices` (NF), nova `marketplace_shipments` (etiquetas externas), `shipments` (etiquetas internas), `shipping_providers.provider_kind`
- Módulos impactados: Mercado Livre, Pedidos, Fiscal, Logística Interna, Logística Externa, Pratika, Notificações
- UI impactada: sim (sidebar + 2 rotas + filtros) — `mapa-ui.md` será atualizado
- Situação: **Aguardando confirmação do usuário**

## 🧭 Princípio único de roteamento

> **Quem emite a etiqueta?**

| | Logística **Interna** | Logística **Externa** |
|---|---|---|
| Quem emite a etiqueta | Nosso sistema (Correios contrato próprio, Loggi direto, futuras transportadoras com contrato local) | Terceiro: marketplace (ML, Shopee, TikTok Shop, Amazon-FBA) ou gateway de envio (Frenet, Melhor Envio) |
| O que o sistema faz | Gera + imprime + entrega à transportadora; opera a Remessa | Recebe etiqueta pronta (pull) OU envia etiqueta de terceiro para outro terceiro (push) |
| Filtro principal | Transportadora | Fonte da etiqueta |
| Tabela canônica | `shipments` + `shipping_remessas` (já existem) | `marketplace_shipments` (nova — apesar do prefixo, cobre marketplaces **e** gateways de loja) |

**Cobertura dos cenários:**
- **Ex.1** Frenet + ML → ambos em **Externa** (Frenet emite, ML emite)
- **Ex.2** Frenet (loja) + Amazon-seller usando contrato Correios próprio → Frenet em **Externa**, Amazon em **Interna**
- **Ex.3** Amazon-seller gerando etiqueta via Frenet/Melhor Envio e devolvendo para Amazon → **Externa** (label nasceu fora; push para o marketplace)
- **Futuro** Shopee/TikTok-seller usando contrato próprio → Interna; usando Frenet → Externa

A decisão é por linha (pedido), via função SQL `resolve_label_origin(order)` lendo `marketplace_source`, fulfillment mode do canal e `shipping_providers.provider_kind`. Marketplaces e modos novos entram no enum sem refactor.

## 🔁 Fluxo ML específico (NF automática → Etiqueta → Pratika)

1. Webhook/cron ingere pedido em `orders` (Onda 2)
2. Trigger fiscal atual cria PV → tenant com **NF automática** emite NF → `fiscal_invoices.status='authorized'` com `chave_acesso` e XML
3. **Novo:** trigger SQL ao detectar NF autorizada de pedido ML enfileira o envio da chave da NF ao ML (sem `pg_net` direto — usa fila + cron, padrão da casa)
4. Edge `meli-send-invoice` faz POST no ML anexando a NF; ML aceita e (assíncrono) muda `shipment.status` para `ready_to_ship`
5. Webhook `shipments` (já tratado) OU o `external-shipping-sync-cron` aciona `meli-fetch-shipment`
6. `meli-fetch-shipment` baixa PDF (`/shipments/{id}/labels?response_type=pdf`) + tracking; salva PDF em Storage `marketplace-labels` e upserta `marketplace_shipments`
7. Despachante `external-shipment-to-pratika` envia `(chave_nf, pdf_etiqueta, tracking_number)` para Pratika reutilizando o adapter SOAP existente (CNPJ cru + envio combinado conforme memória `wms-pratika-combined-send-and-cnpj-raw`)
8. Mudanças em `marketplace_shipments` propagam para `orders.tracking_*` → motor de notificações dispara naturalmente

**Idempotência:** chave única `(tenant_id, source_key, external_shipment_id)`. Pratika já é idempotente por `invoice.id`. Retry seguro em qualquer etapa.

**Remessa automática do tenant Respeite o Homem:** continua valendo só para Interna; ML não toca em `shipping_remessas`.

## 🧭 Plano em 4 Ondas

### Onda 1 — UI/UX e navegação
- Sidebar: renomear `Logística` → **`Logística Interna`** (rota `/shipping` mantida). Adicionar **`Logística Externa`** (rota nova `/external-shipping`).
- Criar `ExternalShipping.tsx` (reaproveita layout do dashboard de shipping) com abas: **Dashboard**, **Objetos de postagem**, **Rastreios**. Sem "Remessas", sem "Prontos para emitir".
- Filtro principal: **Fonte da etiqueta** (todos / Mercado Livre / Shopee / TikTok Shop / Frenet / Melhor Envio / Amazon-seller). Estrutura genérica para novas fontes.
- Ações por linha: baixar PDF, abrir no marketplace, reenviar à Pratika, copiar tracking.
- Card extra no Dashboard: **"Aguardando NF"** (pedidos ML cuja etiqueta depende de NF autorizada).
- `Logística Interna` mantém Remessas + "Prontos para emitir"; filtro continua **Transportadora**.
- Atualizar `mapa-ui.md`.

### Onda 2 — Ingestão de pedidos ML
1. Agendar cron `meli-orders-reconcile` (`*/15 * * * *`) — função já existe mas **não está agendada**.
2. **Backfill imediato**: rodar `meli-sync-orders` em modo `fullSync` para o tenant Respeite o Homem → validar entrada dos 2 pedidos da imagem em `/orders` e PV em `/fiscal?tab=pedidos`.
3. Documentar (runbook) que o app ML no DevCenter precisa ter `orders_v2` e `shipments` assinados (webhook já trata os dois).
4. Hardening de `meli-sync-orders`: tolerar `buyer.email` ausente, lidar com `pack_id` (múltiplos pedidos no mesmo pacote).

### Onda 3 — Logística Externa: NF → Etiqueta → Pratika

**Schema (migração — segue padrão `wms-pratika-*` e RLS por tenant):**
```
marketplace_shipments(
  id, tenant_id, label_origin enum('marketplace','gateway'),
  source_key text,            -- 'mercadolivre' | 'frenet' | 'melhor_envio' | 'amazon_seller' | 'shopee' | 'tiktok_shop'
  order_id FK orders, marketplace_order_id, external_shipment_id,
  carrier, tracking_number, tracking_url,
  status enum('awaiting_invoice','ready_to_ship','label_issued','in_transit','delivered','problem','returned'),
  label_pdf_url, label_fetched_at,
  invoice_id FK fiscal_invoices, invoice_sent_at,
  pratika_sent_at, last_tracking_event_at,
  raw jsonb, created_at, updated_at
) + UNIQUE(tenant_id, source_key, external_shipment_id) + RLS tenant + GRANTs
```
Bucket Storage `marketplace-labels` privado, tenant-scoped.

**Edge functions novas:**
- `meli-send-invoice` — recebe `order_id`; busca NF autorizada; anexa chave/XML no ML; preenche `invoice_sent_at`.
- `meli-fetch-shipment` — busca `/shipments/{id}` + PDF; upserta `marketplace_shipments`; salva PDF.
- `external-shipment-to-pratika` — despachante único; reusa `wms-pratika-send` (`send_combined`) respeitando regra NF+rastreio juntos, CNPJ cru.
- `external-shipping-sync-cron` (30min) — (a) varre `marketplace_shipments` não-terminais e atualiza tracking; (b) varre pedidos ML com NF autorizada e `invoice_sent_at IS NULL` e chama `meli-send-invoice` (rede de segurança).

**Triggers SQL:**
- Em `fiscal_invoices` autorizada + pedido ML → enfileira `meli-send-invoice` via tabela de fila (padrão `gateway_sync_queue`), consumida por cron — **sem `pg_net` direto** (constraint do projeto).
- Em mudança de `marketplace_shipments.status/tracking_*` → propaga para `orders.tracking_*`.

**Webhook ML:** quando `topic='shipments'` chegar, já dispara `meli-fetch-shipment` (caminho primário; cron é fallback).

**Frenet (gateway de loja):** adicionar gancho em `gateway-attach-fiscal-doc` para criar linha em `marketplace_shipments` com `source_key='frenet'` e deixar o cron puxar PDF gerado pela Frenet — aparece na mesma UI de Externa.

**Melhor Envio / Amazon-seller / Shopee / TikTok labels:** ficam **stubbed** — enum suporta, arquivo adapter criado vazio com TODO, UI mostra o filtro. Sem código de integração agora (zero gasto de processamento).

### Onda 4 — Validação técnica + Documentação

**Validação técnica obrigatória (executada por mim antes de fechar):**
- `SELECT order_number, marketplace_order_id, status FROM orders WHERE marketplace_source='mercadolivre'` → 2 pedidos perdidos presentes
- `SELECT numero, chave_acesso, status FROM fiscal_invoices WHERE source_order_id IN (...)` → PV + NF criados
- Disparar `meli-send-invoice` num pedido com NF autorizada → `invoice_sent_at` preenchido, sem 4xx
- Disparar `meli-fetch-shipment` → PDF no Storage + linha em `marketplace_shipments`
- Conferir log em `wms_pratika_logs` (operação combined, success)
- Abrir `/external-shipping` → card "Aguardando NF", filtro Fonte, ações (baixar/reenviar)
- Logs limpos em todas as edges novas

**Documentação:**
- `docs/especificacoes/logistica/logistica-interna.md` (renomeação a partir de `erp/logistica.md` + ajuste de escopo)
- `docs/especificacoes/logistica/logistica-externa.md` **(NOVO)** — princípio "quem emite o label", matriz de fontes, fluxo NF→ML→Etiqueta→Pratika, contratos
- `docs/especificacoes/marketplaces/mercado-livre.md` — seção "Ciclo Fiscal-Logístico ML" + tópicos DevCenter obrigatórios + cron agendado
- `docs/especificacoes/transversais/mapa-ui.md` — rename + rota nova
- `docs/especificacoes/transversais/assuntos-em-andamento.md` — encerramento do tema
- Memórias: nova `mem://features/logistics/external-vs-internal-routing-standard`; atualizar `meli-listings-bidirectional-sync.md` (orders+shipments) e `gateway-vs-local-shipping-routing.md` (cross-ref)

## 🔧 Detalhes técnicos
- Tenant piloto: Respeite o Homem; conexão ML `91cb152c-20bc-41c2-8188-56070034e4db`
- Endpoints ML: `POST /shipment_labels` (anexar NF), `GET /shipments/{id}`, `GET /shipments/{id}/labels?response_type=pdf`
- Tópicos DevCenter manuais: `orders_v2`, `shipments`
- Crons novos: agendar `meli-orders-reconcile` (15min) + criar `external-shipping-sync-cron` (30min) — ambos com anon key hardcoded no header (constraint `cron-service-role-key-guc-prohibition`)
- Padrão de fila: `gateway_sync_queue`-like (sem `pg_net` no DB)
- Pratika: chamadas seguem `wms-pratika-send action=send_combined`, CNPJ 14 dígitos puros, chave 44 dígitos puros — sem alteração no adapter
- Reuso máximo: zero refactor em fiscal/Pratika; tudo novo é aditivo

## ❓ Pontos para sua aprovação
Mudanças de **UI/navegação** dentro do escopo que você já autorizou:
- Renomear `Logística` → `Logística Interna` (mesma rota)
- Nova `Logística Externa` com 3 abas
- Filtro "Fonte da etiqueta" no Externa, mantendo "Transportadora" no Interna

Tudo o que está aqui está dentro do que você pediu (logística interna vs externa, fluxo NF→ML→Etiqueta→Pratika, considerar NF automática do tenant). Nenhuma mudança de negócio fora do seu pedido.

**Confirma a sequência Onda 1 → Onda 2 → Onda 3 → Onda 4 e eu executo?**
