---
name: ads-dashboard-sync-strategy
description: Estratégia híbrida de sincronização do dashboard de Ads (Meta/Google/TikTok) — 3 camadas de cron + backfill sob demanda no calendário, garantindo cobertura histórica completa sem regredir
type: feature
---

A sincronização de insights de Ads para o dashboard usa modelo híbrido em 3 camadas + backfill sob demanda:

### Camadas
1. **Diário (`mode: "daily"`)** — cron `*/15 * * * *` → sync `last_7d` (performance recente).
2. **Semanal (`mode: "weekly"`)** — cron `0 6 * * 0` (dom 03h BRT) → sync `last_90d` (reconciliação de atribuição tardia da Meta/Google, até 28 dias).
3. **On-Connect (`mode: "on_connect"`)** — disparado quando tenant conecta plataforma → `maximum` (lifetime, fallback chunks trimestrais).

### Backfill Sob Demanda (`ads-ensure-coverage`)
- Chamado pelo `useDashboardMetrics` a cada mudança de filtro de calendário.
- Detecta dias faltantes no range em `meta_ad_insights`/`google_ad_insights`/`tiktok_ad_insights`.
- Dispara sync cirúrgico (`time_range`) só dos dias faltantes em background (fire-and-forget).
- Today (`CURRENT_DATE`) sempre dispara refresh (gasto muda continuamente).
- Atualiza `ad_insights_sync_coverage` com status (running/success/error).

### Tabela `ad_insights_sync_coverage`
- Rastreia `first_day_synced`, `last_day_synced`, `last_sync_kind`, `last_sync_status` por tenant/plataforma.
- Permite operação e diagnóstico sem varrer tabelas de insights.

### Por que NÃO ler direto da API por filtro
- Rate limit Meta (~200/h por usuário) → bloqueio com múltiplos tenants.
- Períodos > 90d na Meta exigem job assíncrono (2-15min) → inviável para UX.
- Dados antigos são imutáveis → cachear no banco = mesma fidelidade, sem custo.
- Sync semanal de 90d já corrige atribuição retroativa.

### Arquivos
- `supabase/functions/sync-ads-dashboard/index.ts` (v3.0.0 — 3 camadas)
- `supabase/functions/ads-ensure-coverage/index.ts` (v1.0.0 — sob demanda)
- `src/hooks/useDashboardMetrics.ts` (chama ensure-coverage no fetch)
- `docs/especificacoes/marketing/ads-dashboard-sync-strategy.md` (Layer 3 oficial)
