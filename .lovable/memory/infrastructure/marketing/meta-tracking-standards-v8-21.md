# Memory: infrastructure/marketing/meta-tracking-standards-v8-21
Updated: 2026-03-28

## v8.23.0
Correção crítica de 5 bugs no Purchase que causavam deduplicação quebrada, rejeição pela Meta e valores errados.

1. **event_id sincronizado**: ThankYouContent agora faz `order_number.replace(/^#/, '')` antes de gerar o event_id. Browser e servidor passam a usar exatamente o mesmo `purchase_paid_XXX`, restaurando a deduplicação na Meta.

2. **contents com campo `id`**: `get-order` agora retorna `product_id` nos items. O browser envia `contents: [{id: "...", quantity: N, item_price: X}]` corretamente. Antes, o campo `id` estava ausente e a Meta rejeitava com erro 2804008.

3. **Server contents corrigido**: `process-events` não faz mais select de `meta_retailer_id` (coluna inexistente em `order_items`). Em vez disso, faz lookup na tabela `products` para resolver `meta_retailer_id`. Items deixaram de vir vazios.

4. **Valor em REAIS, não centavos**: Removido `/100` no `process-events`. O banco armazena valores em REAIS (ex: 151.95), não centavos. O servidor estava enviando 1.52 em vez de 151.95.

5. **content_ids não mais null**: Com `product_id` disponível via `get-order`, `resolveMetaContentId` resolve corretamente para o ID do produto.

## v8.22.0
Correção crítica de deduplicação do Purchase e enriquecimento de parâmetros.

1. **Purchase APENAS na Thank You**: Removido trackPurchase do CheckoutStepWizard.tsx. O evento Purchase agora dispara **exclusivamente** na ThankYouContent.tsx. Isso elimina o double-fire (Checkout + ThankYou) que causava contagem inflada na Meta (ex: 5 vendas vs 4 pedidos reais).

2. **userData enriquecido no Purchase**: Adicionados `city` (shipping_city), `state` (shipping_state), `zip` (shipping_postal_code) ao userData do Purchase na ThankYou. Anteriormente enviava apenas email/phone/name.

3. **IP compartilhado investigado**: O alerta de "shared IP" (74% dos PageView) foi investigado — a detecção de IP funciona corretamente via `cf-connecting-ip`. O problema é NAT do ISP (múltiplos visitantes no mesmo IP público), não é falha técnica.

4. **Regra de disparo**:
   - `all_orders`: Purchase dispara ao carregar ThankYou (independente de status de pagamento)
   - `paid_only`: Purchase dispara na ThankYou somente se payment_status = approved/paid; e também via process-events (webhook) como CAPI-only

## v8.21.1
Correção de cobertura de fbp em todos os eventos do funil.

1. **waitForFbp universal**: Todos os eventos CAPI aguardam até 1.5s pelo cookie `_fbp` antes de enviar. Garante cobertura máxima de identidade em todo o funil.

2. **Limitações naturais (NÃO são bugs)**:
   - `fbc`: só existe para tráfego vindo de anúncios Meta (esperado ~40-50%)
   - `email/phone` em ViewContent/PageView: visitante ainda não se identificou
   - `Facebook Login ID`: requer integração Facebook Login (não implementado)
   - IP compartilhado: NAT do ISP, não é problema do sistema
