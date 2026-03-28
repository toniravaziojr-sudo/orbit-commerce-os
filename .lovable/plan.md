
# Plano de Estabilização Definitiva — Meta Pixel + CAPI (Purchase)
## Status: FASE 1 COMPLETA — Aguardando aprovação para execução

---

## DIAGNÓSTICO DA FASE 1 — Resultados Reais

### Configuração confirmada
- **purchaseEventTiming = `paid_only`** (default do sistema, tenant não tem override)
- O parse em `storeConfigTypes.ts` (linha 360) trata NULL como `paid_only`
- Isso significa: Purchase browser só dispara quando `payment_status === 'approved'`
- E o `process-events` dispara Purchase CAPI server-side via webhook de pagamento

### Pedidos rastreados ponta a ponta

| Pedido | Criado | Aprovado | events_inbox | process-events | marketing_events_log | Meta |
|--------|--------|----------|-------------|----------------|---------------------|------|
| #141 | 20:34 | 20:36 | ✅ processed | ✅ executou | ✅ `purchase_paid_141` sent + ❌ `purchase_paid_#141` failed (2x) | Parcial |
| #139 | 15:37 | 15:41 | ✅ | ✅ | ✅ `purchase_paid_139` sent (2x) | OK |
| #135 | 00:33 | 00:38 | ✅ | ✅ | ✅ `purchase_paid_135` sent + ❌ `purchase_paid_#135` failed | Parcial |

### checkout_sessions — Identidade

| Pedido | visitor_id | fbp | fbc | client_ip | user_agent |
|--------|-----------|-----|-----|-----------|------------|
| #141 | ✅ v_ibh8u8mg4 | ✅ fb.2.177... | ❌ null | ✅ 181.189.11.75 | ✅ Chrome/146 Mobile |
| #139 | ✅ v_dzewir21 | ✅ fb.2.177... | ❌ null | ✅ 138.122.121.226 | ✅ Chrome/146 Mobile |
| #135 | ✅ v_d72so5o2 | ✅ fb.2.177... | ❌ null | ✅ 189.123.69.216 | ✅ Chrome/146 Mobile |

**Resultado**: checkout_sessions está funcionando bem — `fbp`, `visitor_id`, IP e UA estão presentes. `fbc` null é esperado (tráfego orgânico/direto).

---

## BUGS CRÍTICOS ENCONTRADOS

### BUG 1 (CRÍTICO): event_id desincronizado — deduplicação QUEBRADA

**O problema:**
- **Browser** (ThankYouContent): passa `order.order_number` (`#141`) como `order_id` para `generateDeterministicPurchaseEventId`
  - Resultado: `purchase_paid_#141`
- **Server** (process-events): faz `cleanOrderNumber = orderNumber.replace(/^#/, '')` 
  - Resultado: `purchase_paid_141`

**Event IDs diferentes = Meta NÃO deduplica = contagem DOBRADA ou inconsistente.**

Isso é a causa-raiz da discrepância Navegador vs Servidor no Event Manager.

**Correção**: No `ThankYouContent.tsx` (linha 111), limpar o `#` antes de passar para `trackPurchase`:
```
order_id: order.order_number.replace(/^#/, ''),
```
Ou alternativamente, na função `generateDeterministicPurchaseEventId`, sempre limpar o `#`.

### BUG 2 (CRÍTICO): Browser CAPI envia `contents` em formato inválido

**O problema:**
- O `marketing-capi-track` recebe os items do browser e monta `contents`, mas a Meta rejeita com:
  > "O parâmetro de conteúdo inserido não contém uma lista de objetos JSON"
- Todos os eventos `purchase_paid_#141` falharam com esse erro
- O erro é `OAuthException code 100, subcode 2804008`

**Impacto**: O Purchase browser-side CAPI NUNCA chega na Meta. Só o server-side (process-events) chega.

**Correção**: Investigar como `marketing-capi-track` serializa `contents` e garantir que seja um array JSON válido `[{id, quantity, item_price}]`.

### BUG 3 (ALTO): Purchase browser-side possivelmente enviando preços em centavos

**O problema:**
- ThankYouContent passa `price: item.unit_price` — se `unit_price` está em centavos (inteiro), o valor vai incorreto para a Meta
- Já no process-events, existe `price: (i.unit_price || 0) / 100` — conversão correta

**Correção**: Verificar se ThankYouContent precisa dividir por 100 antes de enviar.

---

## ESTATÍSTICAS REAIS (últimos 7 dias)

| Fonte | Status | Total |
|-------|--------|-------|
| Server | sent | 34 |
| Server | failed | 10 |
| Browser | — | **0** |

**Conclusão**: Não há NENHUM Purchase browser-side registrado na última semana. Os 10 failed são todos do browser-side CAPI (via marketing-capi-track) que falhou no formato de contents. Os 34 sent são todos do server-side (process-events → sendCapiPurchase).

---

## PLANO DE EXECUÇÃO ATUALIZADO

### P1 — Sincronizar event_id (Crítico)
**Arquivo**: `src/components/storefront/ThankYouContent.tsx`
- Limpar `#` do `order_number` antes de passar como `order_id` para `trackPurchase`
- Resultado: browser e servidor usarão o mesmo `purchase_paid_141`
- Isso restaura a deduplicação correta na Meta

### P2 — Corrigir formato de contents no CAPI browser-side (Crítico)  
**Arquivo**: `supabase/functions/marketing-capi-track/index.ts` (ou `_shared/meta-capi-sender.ts`)
- Investigar e corrigir como `contents` é serializado para o Purchase
- Garantir que chega como `[{"id":"X","quantity":1,"item_price":99.90}]`
- Isso faz o Purchase browser-side VOLTAR a chegar na Meta

### P3 — Corrigir preço em centavos no ThankYouContent (Alto)
**Arquivo**: `src/components/storefront/ThankYouContent.tsx`
- Verificar se `order.total` e `item.unit_price` estão em centavos
- Se sim, dividir por 100 antes de enviar para o tracker

### P4 — Retry no sendCapiPurchase server-side (Médio)
**Arquivo**: `supabase/functions/_shared/meta-capi-sender.ts` ou `process-events/index.ts`
- Adicionar 1-2 retentativas com backoff quando a Graph API falhar
- Evita perda irreversível de Purchase por falha temporária

### NÃO FAZER NESTA RODADA
- ❌ Remover `marketing-send-meta` (limpeza pode esperar)
- ❌ Alterar heartbeat de checkout_sessions (dados de identidade já estão OK)
- ❌ Mexer em eventos de funil (ViewContent, AddToCart etc)

---

## CRITÉRIOS DE SUCESSO

1. Browser e servidor usam o **mesmo event_id** (`purchase_paid_141`, sem `#`)
2. Purchase browser-side CAPI chega na Meta sem erro de `contents`
3. No Event Manager: Purchase mostra **Navegador: 1 + Servidor: 1** para cada pedido
4. `marketing_events_log` mostra **0 failed** para Purchase nos próximos pedidos
5. Match Quality Score do Purchase sobe para **8+/10**

---

## PROVA POR PEDIDO REAL

Após as correções, fazer um pedido teste (PIX) e verificar:
1. ✅ Pedido criado com `payment_status: pending`
2. ✅ Pagamento aprovado → `payment_status: approved`
3. ✅ `events_inbox` recebe `payment_status_changed`
4. ✅ `process-events` dispara `sendCapiPurchase` com `event_id: purchase_paid_XXX`
5. ✅ ThankYou page dispara Purchase browser com **mesmo** `event_id: purchase_paid_XXX`
6. ✅ `marketing_events_log` mostra 2 entradas (browser + server), ambas `sent`
7. ✅ Event Manager da Meta mostra evento deduplicado (Navegador + Servidor)
