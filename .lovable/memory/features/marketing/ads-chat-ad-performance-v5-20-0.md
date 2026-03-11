# Memory: features/marketing/ads-chat-ad-performance-v5-20-0
Updated: 2026-03-11

## Correção: Métricas de Performance por Anúncio (v5.20.0)

### Problema Identificado
A função `getAdPerformance` no `ads-chat` retornava apenas metadados dos anúncios (nome, status, criativo) **sem nenhuma métrica de performance** (spend, clicks, conversions, ROAS). A IA informava incorretamente que não havia dados de desempenho, atribuindo o problema ao pixel.

### Causa Raiz
1. A tabela `meta_ad_insights` armazenava insights apenas no nível de **campanha**, não de anúncio individual
2. `getAdPerformance` não consultava a Meta Graph API para métricas ad-level
3. `getCampaignPerformance` estava limitada a 30 dias máximo (insuficiente para análises de 12 meses)

### Correções Aplicadas
1. **`fetchMetaInsightsLive()`**: Nova função helper que consulta a Meta Graph API diretamente (`/insights?level=ad|campaign`) quando o banco local não tem dados, retornando spend, clicks, conversions, revenue, CTR
2. **`getAdPerformance`**: Agora inclui `performance_30d` com métricas reais (spend, impressions, clicks, conversions, revenue, ROAS, CPA, CTR) para cada anúncio
3. **`getCampaignPerformance`**: Limite de dias aumentado de 30 para **365**, com fallback para API live quando DB não tem insights
4. **Tool descriptions**: Atualizadas para refletir capacidades reais

### Arquivos Modificados
- `supabase/functions/ads-chat/index.ts` — v5.20.0
