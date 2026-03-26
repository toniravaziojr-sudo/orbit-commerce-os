# Memory: infrastructure/marketing/meta-tracking-standards-v8-21
Updated: 2026-03-26

## v8.21.1
Correção de cobertura de fbp em todos os eventos do funil.

1. **waitForFbp universal**: Anteriormente apenas PageView, ViewContent e AddToCart aguardavam o cookie `_fbp` antes de enviar CAPI. Agora TODOS os eventos (ViewCategory, InitiateCheckout, Lead, AddShippingInfo, AddPaymentInfo, Purchase) também aguardam até 1.5s pelo `_fbp`. Isso garante cobertura máxima de identidade em todo o funil.

2. **Impacto esperado**: Eventos de meio/fundo de funil (InitiateCheckout, AddShippingInfo, AddPaymentInfo) devem subir ~1-2 pontos no quality score da Meta nas próximas 48h, pois passarão a enviar `fbp` consistentemente.

3. **Parâmetros que NÃO precisam de correção** (limitações naturais):
   - `fbc`: só existe para tráfego vindo de anúncios Meta (esperado ~40-50%)
   - `email/phone` em ViewContent/PageView: visitante ainda não se identificou
   - `Facebook Login ID`: requer integração Facebook Login (ganho de 0.01%, não justifica)
