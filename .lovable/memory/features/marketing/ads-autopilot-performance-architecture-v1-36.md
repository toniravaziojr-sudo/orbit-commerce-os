# Memory: features/marketing/ads-autopilot-performance-architecture-v1-36
Updated: now

Para suportar contas com alto volume de dados (>1500 entidades) e evitar timeouts, o Estrategista utiliza:

### Compressão e Filtragem (v1.34.0+)
1. **Compressão Tabular (TSV)**: Reduz tokens em 70-80%
2. **Coleta Sequencial**: Cooldowns e delays de paginação entre níveis
3. **Filtragem Inteligente**: Processa todas as campanhas mas limita AdSets/Ads aos ativos e top pausados

### Coleta de Insights Inteligente (v1.37.0 — REGRA INVIOLÁVEL)
1. **Sort por Spend Decrescente**: AdSets e Ads utilizam `sort=["spend_descending"]` na chamada de insights da Graph API. Isso garante que, mesmo com rate limit, os conjuntos com maior investimento (winners históricos) sejam coletados primeiro.
2. **Retry Automático em 429**: `fetchAllPages` implementa retry com backoff exponencial (5s → 10s → 20s) ao receber HTTP 429, com até 3 tentativas por página antes de desistir. Respeita o header `Retry-After` quando disponível.
3. **Cobertura Ampliada**: Limites de páginas aumentados (Campaigns: 10 páginas/2000 rows, AdSets: 10 páginas/1000 rows, Ads: 8 páginas/800 rows) para cobrir contas grandes.
4. **Delay Inter-Página**: 3s entre páginas de insights (era 2s) para mais margem contra rate limits.

### Arquivos Relacionados
- `supabase/functions/ads-autopilot-strategist/index.ts` — `fetchDeepHistoricalInsights()` + `fetchAllPages()`
