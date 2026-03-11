# Memory: features/marketing/ads-chat-ad-performance-v5-20-0
Updated: 2026-03-11

## Correção: Métricas de Performance por Anúncio (v5.20.0 → v5.28.0)

### Problema v5.27.0 (Conversões SUBESTIMADAS — Prioridade omni_purchase errada)
A v5.27.0 usava `omni_purchase` como prioridade máxima, mas em algumas contas esse action_type retorna valores muito menores que `purchase` ou `offsite_conversion.fb_pixel_purchase`. Resultado: conversões apareciam como 1 ou 0 quando deveriam ser centenas.

### Problema v5.26.0 (Conversões INFLADAS — Soma de Action Types Duplicados)
A v5.26.0 somava TODOS os 8 action_types. A Meta reporta a MESMA compra sob múltiplos tipos simultaneamente. Resultado: contagem 2x-6x maior que o real.

### Correção v5.28.0 — MAX Value Deduplication
1. **Estratégia MAX**: Itera todos os 8 action_types de purchase e usa o que tiver o **MAIOR valor** (não soma, não prioridade fixa)
2. **Lógica**: `if (val > conversions) conversions = val` — pega o máximo entre todos os tipos
3. **Racional**: O action_type com o maior valor é o mais completo/correto para aquela conta específica
4. **Aplicado em**: `ads-chat/index.ts` e `meta-ads-insights/index.ts`

### Correções anteriores (mantidas)
- v5.27.0: Prioridade hierárquica (causou subestimação — substituída)
- v5.26.0: Soma de 8 action_types (causou inflação — substituída)
- v5.25.0: `date_preset=maximum`, paginação 15 páginas, retry rate limits
- v5.24.0: `fetchMetaCampaignsLive()`, nomes exatos, campanhas orphans

### Arquivos Modificados
- `supabase/functions/ads-chat/index.ts` — v5.28.0
- `supabase/functions/meta-ads-insights/index.ts` — MAX value dedup
