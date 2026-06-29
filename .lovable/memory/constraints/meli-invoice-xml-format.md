---
name: Mercado Livre Send Invoice XML Format
description: meli-send-invoice deve enviar o XML autorizado da NF como application/xml para POST /shipments/{id}/invoice_data com siteId=MLB (header e query) e x-format-new=true. JSON é rejeitado com HTTP 415; ausência de site_id é rejeitada com 400 invalid_site_id.
type: constraint
---

# Envio de NF ao Mercado Livre — Contrato Obrigatório

## Endpoint
`POST https://api.mercadolibre.com/shipments/{shipment_id}/invoice_data?siteId=MLB&site_id=MLB`

## Headers obrigatórios
- `Authorization: Bearer <access_token>` (token do tenant)
- `Content-Type: application/xml`
- `x-format-new: true`
- `x-site-id: MLB`

## Body
**O XML autorizado da NF** (string contendo `<nfeProc>...</nfeProc>`). Buscar primeiro em `fiscal_invoices.xml_autorizado`; se ausente, baixar de `fiscal_invoices.xml_url` via `fetch`.

## Proibido
- Enviar JSON `{ invoice_data: { number, type, date_created } }` — o ML responde **HTTP 415 "unsupported type JSON"**.
- Omitir `siteId=MLB` (query) ou `x-site-id: MLB` (header) — resposta **HTTP 400 "invalid_site_id"**.
- Enviar apenas a chave de acesso — o endpoint exige o XML inteiro.

## Validação após qualquer mudança
1. Reabrir item da fila `meli_invoice_send_queue` (`status='pending', attempts=0`).
2. Disparar `POST /meli-send-invoice` com `{ "processQueue": true }`.
3. Resposta esperada: `{ success: true, shipment_id, invoice_id }` no item da fila.
4. Conferir que `marketplace_shipments` foi populado com `invoice_sent_at`.

## Arquivos
- `supabase/functions/meli-send-invoice/index.ts` — função canônica.
- `meli_invoice_send_queue` — fila com retry exponencial.
