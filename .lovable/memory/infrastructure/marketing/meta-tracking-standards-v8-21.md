# Memory: infrastructure/marketing/meta-tracking-standards-v8-21
Updated: 2026-03-27

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
