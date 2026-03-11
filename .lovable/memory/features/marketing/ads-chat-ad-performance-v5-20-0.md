# Memory: features/marketing/ads-chat-ad-performance-v5-20-0
Updated: 2026-03-11

## Correção: Métricas de Performance por Anúncio (v5.20.0 → v5.27.0)

### Problema v5.26.0 (Conversões INFLADAS — Soma de Action Types Duplicados)
A v5.26.0 somava TODOS os 8 action_types de purchase. Porém a Meta reporta a MESMA compra sob múltiplos action_types simultaneamente (ex: `purchase` + `omni_purchase`). Isso causava contagem 2x-6x maior que o real em conversões e receita.

### Correção v5.27.0 — Deduplicação por Prioridade
1. **Hierarquia de prioridade**: `omni_purchase` > `purchase` > `offsite_conversion.fb_pixel_purchase` > `offsite_conversion.custom.purchase` > `onsite_conversion.purchase` > `onsite_web_purchase` > `onsite_web_app_purchase` > `web_in_store_purchase`
2. **Primeiro match ganha**: Usa `.find()` na ordem de prioridade e `break` no primeiro match. NUNCA soma tipos diferentes.
3. **`omni_purchase` é prioridade máxima**: É o valor deduplicado da Meta que agrega todas as fontes de conversão.
4. **Aplicado em ambos os arquivos**: `ads-chat/index.ts` e `meta-ads-insights/index.ts`

### Correções anteriores (mantidas)
- v5.26.0: 8 action_types, Ctrl+V paste, system prompt reforçado
- v5.25.0: `date_preset=maximum`, paginação 15 páginas, retry rate limits
- v5.24.0: `fetchMetaCampaignsLive()`, nomes exatos, campanhas orphans
- v5.21.0: `paused_campaigns` lista completa
- v5.20.0: `fetchMetaInsightsLive()`, `getAdPerformance` com `performance_30d`

### Arquivos Modificados
- `supabase/functions/ads-chat/index.ts` — v5.27.0
- `supabase/functions/meta-ads-insights/index.ts` — deduplicação por prioridade
