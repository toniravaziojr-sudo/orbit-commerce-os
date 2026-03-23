# Memory: infrastructure/marketing/meta-tracking-standards-v8-20
Updated: 2026-03-23

O sistema de rastreamento Meta (v8.20.0) corrigiu 3 bugs críticos que impediam eventos CAPI server-side de funcionar para eventos de checkout.

1. **events_inbox constraint**: A tabela só aceitava status 'new','processed','ignored','error'. Seis edge functions inseriam com 'pending' → todas falhavam silenciosamente. Constraint expandida para incluir 'pending' e 'processing'. Todas as functions padronizadas para usar 'new'.

2. **Transporte híbrido**: sendBeacon com application/json causa preflight CORS que beacon não suporta. Nova estratégia:
   - Lead e InitiateCheckout: `fetch + keepalive` (não há redirect)
   - Purchase: `fetch + keepalive` primário, `sendBeacon + text/plain` como fallback em page unload
   - Edge function `marketing-capi-track` aceita Content-Type text/plain

3. **content_id fallback**: `resolveMetaContentId()` nunca retorna string vazia. Usa product_id/UUID como último recurso + log de warning para visibilidade.

4. **paid_only Purchase**: Fonte primária é server-side (webhook → events_inbox → process-events). Browser é complemento/fallback apenas.
