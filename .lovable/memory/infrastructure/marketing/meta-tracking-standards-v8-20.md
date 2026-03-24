# Memory: infrastructure/marketing/meta-tracking-standards-v8-20
Updated: 2026-03-24

## v8.20.0
O sistema de rastreamento Meta (v8.20.0) corrigiu 3 bugs críticos que impediam eventos CAPI server-side de funcionar para eventos de checkout.

1. **events_inbox constraint**: A tabela só aceitava status 'new','processed','ignored','error'. Seis edge functions inseriam com 'pending' → todas falhavam silenciosamente. Constraint expandida para incluir 'pending' e 'processing'. Todas as functions padronizadas para usar 'new'.

2. **Transporte híbrido**: sendBeacon com application/json causa preflight CORS que beacon não suporta. Nova estratégia:
   - Lead e InitiateCheckout: `fetch + keepalive` (não há redirect)
   - Purchase: `fetch + keepalive` primário, `sendBeacon + text/plain` como fallback em page unload
   - Edge function `marketing-capi-track` aceita Content-Type text/plain

3. **content_id fallback**: `resolveMetaContentId()` nunca retorna string vazia. Usa product_id/UUID como último recurso + log de warning para visibilidade.

4. **paid_only Purchase**: Fonte primária é server-side (webhook → events_inbox → process-events). Browser é complemento/fallback apenas.

## v8.20.1
Correções de cobertura de parâmetros CAPI para melhorar quality scores na Meta:

1. **_sf_vid síncrono**: `getOrCreateVisitorId()` agora executa sincronamente no MarketingTrackerProvider, ANTES da inicialização deferida do tracker. Garante `external_id` em 100% dos eventos CAPI.

2. **Retry de _fbp**: `sendServerEvent` agora aguarda até 1.5s pela criação do cookie `_fbp` pelo Meta Pixel para eventos ViewContent, AddToCart e PageView. Usa polling a cada 200ms com timeout gracioso.

3. **Identidade na checkout_sessions**: Novas colunas `visitor_id`, `fbp`, `fbc`, `client_ip`, `client_user_agent` salvas no momento do checkout-session-start. O `process-events` lê esses dados ao disparar Purchase CAPI server-side para pedidos `paid_only`, garantindo que o Purchase tenha IP, UA, fbp, fbc e external_id mesmo quando enviado pelo servidor.

4. **IP capture no checkout**: `checkout-session-start` captura IP do visitante via headers HTTP (cf-connecting-ip > true-client-ip > x-real-ip > x-forwarded-for) e salva na sessão.
