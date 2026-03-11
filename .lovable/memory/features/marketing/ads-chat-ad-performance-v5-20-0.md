# Memory: features/marketing/ads-chat-ad-performance-v5-20-0
Updated: 2026-03-11

## Correção: Métricas de Performance por Anúncio (v5.20.0 → v5.21.0)

### Problema v5.20.0
A função `getAdPerformance` retornava apenas metadados sem métricas de performance. A IA atribuía incorretamente a falta de dados ao pixel.

### Problema v5.21.0 (Regressão de Visibilidade)
A resposta de `getCampaignPerformance` retornava campanhas pausadas truncadas (`paused_campaigns_sample: slice(0, 10)`), fazendo a IA ignorar dados históricos de campanhas pausadas. O system prompt instruía "PRIORIZAR CAMPANHAS ATIVAS", reforçando o viés.

### Correções v5.21.0
1. **`getCampaignPerformance` (Meta)**: Retorna `paused_campaigns` (lista completa) em vez de `paused_campaigns_sample` (slice 10)
2. **`getGoogleCampaigns`**: Mesma correção — `paused_campaigns` sem truncamento
3. **System Prompt**: Regra alterada de "PRIORIZAR CAMPANHAS ATIVAS" para "ANALISAR TODAS AS CAMPANHAS (ATIVAS E PAUSADAS)" — instrui a IA a incluir dados históricos de pausadas
4. **Tool description**: Atualizada para explicitar que retorna ativas + pausadas

### Correções v5.20.0 (mantidas)
1. **`fetchMetaInsightsLive()`**: Consulta Meta Graph API diretamente quando DB não tem dados
2. **`getAdPerformance`**: Inclui `performance_30d` com métricas reais por anúncio
3. **`getCampaignPerformance`**: Suporta até 365 dias de histórico

### Arquivos Modificados
- `supabase/functions/ads-chat/index.ts` — v5.21.0
