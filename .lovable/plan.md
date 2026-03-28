
# Plano de Estabilização Definitiva — Meta Pixel + CAPI (Purchase)
## Status: ✅ EXECUTADO — v8.23.0

---

## BUGS ENCONTRADOS E CORRIGIDOS

### Bug 1 (CRÍTICO) — event_id desincronizado → deduplicação QUEBRADA
- **Antes**: Browser enviava `purchase_paid_#141`, servidor enviava `purchase_paid_141`
- **Causa**: ThankYouContent passava `order.order_number` (com `#`) direto
- **Fix**: `ThankYouContent.tsx` agora faz `order.order_number.replace(/^#/, '').trim()` antes de enviar
- **Arquivo**: `src/components/storefront/ThankYouContent.tsx`

### Bug 2 (CRÍTICO) — Browser contents sem campo `id` → Meta rejeitava 100% dos Purchase browser
- **Antes**: `get-order` não retornava `product_id`, então `contents` ia sem `id` → Meta erro 2804008
- **Causa**: select de `order_items` não incluía `product_id`
- **Fix**: Adicionado `product_id` ao select do `get-order`; atualizada interface `OrderDetails`
- **Arquivos**: `supabase/functions/get-order/index.ts`, `src/hooks/useOrderDetails.ts`

### Bug 3 (CRÍTICO) — Server contents VAZIO → Meta recebia Purchase sem dados de produto
- **Antes**: `process-events` fazia select com `meta_retailer_id` que NÃO EXISTE na tabela `order_items`
- **Causa**: Query falhava silenciosamente, `orderItems` era null → contents/content_ids vazios
- **Fix**: Removido `meta_retailer_id` do select; adicionado lookup na tabela `products` para resolver IDs
- **Arquivo**: `supabase/functions/process-events/index.ts`

### Bug 4 (CRÍTICO) — Valor do Purchase 100x MENOR no servidor
- **Antes**: `process-events` fazia `(order.total || 0) / 100` → valor 1.52 em vez de 151.95
- **Causa**: DB armazena valores em REAIS (não centavos), divisão era incorreta
- **Fix**: Removido `/100` → `order.total || 0`
- **Arquivo**: `supabase/functions/process-events/index.ts`

### Bug 5 (ALTO) — content_ids=[null] no browser
- **Antes**: ThankYouContent usava `item.product_id` que era undefined (get-order não retornava)
- **Fix**: Corrigido para `item.product_id || item.id` + get-order agora retorna product_id

---

## PAYLOAD ANTES/DEPOIS

### Browser Purchase (via marketing-capi-track)
**ANTES** (rejeitado pela Meta):
```json
{
  "event_id": "purchase_paid_#141",
  "custom_data": {
    "content_ids": [null],
    "contents": [{"item_price": 159.95, "quantity": 1}],
    "value": 151.95,
    "order_id": "#141"
  }
}
```
**DEPOIS** (esperado):
```json
{
  "event_id": "purchase_paid_141",
  "custom_data": {
    "content_ids": ["6a48ca35-96b8-4987-86d0-48015b96b980"],
    "contents": [{"id": "6a48ca35-96b8-4987-86d0-48015b96b980", "item_price": 159.95, "quantity": 1}],
    "value": 151.95,
    "order_id": "141"
  }
}
```

### Server Purchase (via process-events → sendCapiPurchase)
**ANTES** (aceito mas com dados errados):
```json
{
  "event_id": "purchase_paid_141",
  "custom_data": {
    "content_ids": [],
    "contents": [],
    "value": 1.5195,
    "order_id": "141",
    "num_items": 0
  }
}
```
**DEPOIS** (esperado):
```json
{
  "event_id": "purchase_paid_141",
  "custom_data": {
    "content_ids": ["6a48ca35-96b8-4987-86d0-48015b96b980"],
    "contents": [{"id": "6a48ca35-96b8-4987-86d0-48015b96b980", "item_price": 159.95, "quantity": 1}],
    "value": 151.95,
    "order_id": "141",
    "num_items": 1
  }
}
```

---

## COMO TESTAR

1. Fazer um pedido real (PIX ou cartão) na loja do Respeite o Homem
2. Aguardar aprovação do pagamento
3. Verificar `marketing_events_log`:
   ```sql
   SELECT event_id, event_source, provider_status, event_data
   FROM marketing_events_log
   WHERE tenant_id = 'd1a4d0ed-...' AND event_name = 'Purchase'
   ORDER BY created_at DESC LIMIT 5;
   ```
4. Confirmar:
   - ✅ 2 registros com MESMO event_id (ex: `purchase_paid_142`)
   - ✅ Ambos com `provider_status = 'sent'`
   - ✅ `contents` com `id` preenchido em ambos
   - ✅ `value` correto (em reais, ex: 151.95)
5. No Meta Event Manager (24-48h):
   - Purchase mostra "Navegador + Servidor" na mesma linha
   - Contagem de eventos bate com pedidos reais
   - Match Quality Score sobe para 8+/10

---

## ARQUIVOS ALTERADOS

| Arquivo | Mudança |
|---------|---------|
| `src/components/storefront/ThankYouContent.tsx` | Strip `#` do order_number; fallback `product_id \|\| id` |
| `src/hooks/useOrderDetails.ts` | Adicionado `product_id` e `meta_retailer_id` na interface |
| `supabase/functions/get-order/index.ts` | Adicionado `product_id` ao select de order_items |
| `supabase/functions/process-events/index.ts` | Removido `meta_retailer_id` do select; lookup via products; removido `/100` |
