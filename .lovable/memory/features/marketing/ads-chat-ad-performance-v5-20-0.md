# Memory: features/marketing/ads-chat-ad-performance-v5-20-0
Updated: 2026-03-11

## Correção: Métricas de Performance por Anúncio (v5.20.0 → v5.26.0)

### Problema v5.25.0 (Conversões Subestimadas — Action Types Incompletos)
A função `fetchMetaInsightsLive` usava apenas 2 action_types (`purchase`, `offsite_conversion.fb_pixel_purchase`) com `.find()` que pegava só o primeiro match. Contas que reportavam via `omni_purchase` ou outras variantes tinham conversões zeradas ou subestimadas.

### Correções v5.26.0
1. **8 action_types**: Expandido para cobrir `purchase`, `omni_purchase`, `offsite_conversion.fb_pixel_purchase`, `offsite_conversion.custom.purchase`, `onsite_conversion.purchase`, `onsite_web_purchase`, `onsite_web_app_purchase`, `web_in_store_purchase`
2. **Soma ao invés de find**: Agora SOMA todas as conversões de todos os action_types que matched (não usa `.find()` que pegava só o primeiro)
3. **Default LIFETIME**: `getCampaignPerformance` agora usa `date_preset=maximum` por padrão quando nenhum parâmetro de tempo é informado. A IA não precisa mais lembrar de passar `date_preset: "maximum"` — é automático.
4. **Ctrl+V paste**: Usuário pode colar screenshots do Gerenciador de Anúncios direto no chat para validação visual dos dados
5. **System Prompt reforçado**: Regra de análise de imagens e default lifetime clarificados

### Correções anteriores (mantidas)
- v5.25.0: `date_preset=maximum`, paginação 15 páginas, retry rate limits
- v5.24.0: `fetchMetaCampaignsLive()`, nomes exatos, campanhas orphans
- v5.21.0: `paused_campaigns` lista completa
- v5.20.0: `fetchMetaInsightsLive()`, `getAdPerformance` com `performance_30d`

### Arquivos Modificados
- `supabase/functions/ads-chat/index.ts` — v5.26.0
- `src/components/ads/AdsChatTab.tsx` — paste handler
