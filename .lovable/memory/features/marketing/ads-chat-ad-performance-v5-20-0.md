# Memory: features/marketing/ads-chat-ad-performance-v5-20-0
Updated: 2026-03-11

## Correção: Métricas de Performance por Anúncio (v5.20.0 → v5.25.0)

### Problema v5.25.0 (Dados Incompletos — Cap de 365 dias + Sem Paginação)
A função `getCampaignPerformance` tinha 3 problemas graves que causavam dados imprecisos:
1. **Cap de 365 dias**: `Math.min(days || 14, 365)` — contas com 2-3 anos de dados perdiam todo o histórico anterior
2. **Sem paginação nos insights**: `fetchMetaInsightsLive` buscava apenas 500 rows sem seguir `paging.next`, truncando dados de contas com muitas campanhas
3. **Default 14 dias**: Quando a IA não passava `days`, usava apenas 14 dias de dados
4. **Conversões subestimadas**: Campanhas com 1000+ vendas (visíveis no Gerenciador) apareciam com 700-800 por falta de dados históricos

### Correções v5.25.0
1. **`date_preset=maximum` (NOVO)**: Novo parâmetro `date_preset` na tool definition. Quando `"maximum"`, usa `date_preset=maximum` da Meta API para buscar dados LIFETIME (desde a criação da conta), sem limite de tempo
2. **Paginação completa em insights**: `fetchMetaInsightsLive` agora segue `paging.next` até 15 páginas, com delay de 2s entre páginas e retry automático em HTTP 429
3. **Default 30 dias**: Default aumentado de 14 para 30 dias quando nenhum parâmetro é informado
4. **System Prompt**: Nova regra "DADOS LIFETIME" — obriga a IA a usar `date_preset: "maximum"` quando o usuário pedir "máximo", "total", "desde o início", "lifetime" ou "histórico completo"
5. **Totais no summary**: Adicionados `total_revenue` e `total_conversions` ao summary para validação cruzada

### Correções v5.24.0 (mantidas)
1. **`fetchMetaCampaignsLive()`**: Busca LISTA de campanhas diretamente da Meta Graph API com paginação completa
2. **`getCampaignPerformance` refatorada**: Usa `fetchMetaCampaignsLive()` como fonte primária para nomes exatos
3. **Campanhas orphans**: Campanhas nos insights mas fora da lista são criadas dinamicamente
4. **System Prompt**: Regra "NOMES EXATOS DAS CAMPANHAS" — proíbe invenção/abreviação de nomes

### Correções anteriores (mantidas)
- v5.21.0: `paused_campaigns` retorna lista completa
- v5.20.0: `fetchMetaInsightsLive()`, `getAdPerformance` com `performance_30d`

### Arquivos Modificados
- `supabase/functions/ads-chat/index.ts` — v5.25.0
