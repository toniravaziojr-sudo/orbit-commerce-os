# Memory: features/marketing/ads-chat-ad-performance-v5-20-0
Updated: 2026-03-11

## Correção: Métricas de Performance por Anúncio (v5.20.0 → v5.24.0)

### Problema v5.24.0 (Nomes Incorretos de Campanhas)
A função `getCampaignPerformance` usava a tabela local `meta_ad_campaigns` como fonte de verdade para nomes. Essa tabela podia estar desatualizada (nomes renomeados, campanhas antigas não sincronizadas), gerando nomes inexistentes ou diferentes do que aparece no Gerenciador de Anúncios. Além disso, campanhas presentes na Meta API mas ausentes no DB local eram silenciosamente descartadas (`if (!c) continue`).

### Correções v5.24.0
1. **`fetchMetaCampaignsLive()` (NOVO)**: Nova função que busca a LISTA de campanhas diretamente da Meta Graph API (`/act_{id}/campaigns`) com paginação completa. Retorna `id`, `name`, `status`, `effective_status`, `objective`, `daily_budget`, `lifetime_budget`
2. **`getCampaignPerformance` refatorada**: Agora usa `fetchMetaCampaignsLive()` como fonte primária (nomes exatos da Meta). DB local é usado apenas como fallback se a API falhar
3. **Insights Live-first**: Busca insights primeiro da Meta API live, depois fallback para DB local
4. **Campanhas orphans**: Campanhas que aparecem nos insights mas não na lista são criadas dinamicamente no mapa usando `campaign_name` do insight
5. **System Prompt**: Nova regra "NOMES EXATOS DAS CAMPANHAS" — proíbe a IA de inventar, abreviar ou modificar nomes. Também exige que ao pedir "N melhores", retorne exatamente N resultados
6. **Sem limite artificial**: Usa paginação da Meta API para buscar TODAS as campanhas (sem `.limit(200)`)

### Problema v5.21.0 (Regressão de Visibilidade)
A resposta de `getCampaignPerformance` retornava campanhas pausadas truncadas (`paused_campaigns_sample: slice(0, 10)`), fazendo a IA ignorar dados históricos de campanhas pausadas.

### Correções v5.21.0
1. `paused_campaigns` retorna lista completa em vez de sample
2. System Prompt: "ANALISAR TODAS AS CAMPANHAS (ATIVAS E PAUSADAS)"

### Correções v5.20.0 (mantidas)
1. **`fetchMetaInsightsLive()`**: Consulta Meta Graph API diretamente quando DB não tem dados
2. **`getAdPerformance`**: Inclui `performance_30d` com métricas reais por anúncio
3. **`getCampaignPerformance`**: Suporta até 365 dias de histórico

### Arquivos Modificados
- `supabase/functions/ads-chat/index.ts` — v5.24.0
