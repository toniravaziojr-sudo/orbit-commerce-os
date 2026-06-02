# Estratégia de Sincronização do Dashboard de Ads

**Documento Layer 3 — Marketing**  
**Versão:** v1.0.0 (16/04/2026)  
**Escopo:** Central de Comando, módulo Ads (Meta, Google, TikTok)

---

## 1. Problema Resolvido

Antes desta versão, o sync agendado puxava apenas `last_7d` da Meta/Google/TikTok. Resultado: ao selecionar "Todo o período", "Mês passado" ou qualquer intervalo fora dessa janela rolante, o dashboard mostrava apenas o que estava cacheado no banco — geralmente os últimos dias acumulados desde a primeira execução do sync. Isso gerava a impressão (correta) de que dados históricos "sumiram".

## 2. Modelo Adotado: Híbrido em 3 Camadas + Backfill Sob Demanda

### Camada 1 — Sync Diário (`mode: "daily"`)
- **Frequência:** a cada 15 minutos (cron `sync-ads-dashboard-daily-15min`).
- **Janela:** `last_7d`.
- **Propósito:** manter performance recente sempre fresca (CPM, CTR, gasto do dia mudam muito).

### Camada 2 — Reconciliação Semanal (`mode: "weekly"`)
- **Frequência:** todo domingo 03h BRT (cron `sync-ads-dashboard-weekly-reconcile`).
- **Janela:** `last_90d`.
- **Propósito:** capturar ajustes de **atribuição tardia** que a Meta/Google fazem retroativamente em até 28 dias. Reescreve os dados antigos com os números atualizados, garantindo fidelidade absoluta.

### Camada 3 — Backfill Sob Demanda (`ads-ensure-coverage`)
- **Trigger:** chamado a cada mudança de filtro de calendário no dashboard (`useDashboardMetrics`).
- **Lógica:** verifica os dias presentes em `meta_ad_insights` / `google_ad_insights` / `tiktok_ad_insights` dentro do range solicitado. Se houver dias faltantes, dispara sync cirúrgico (`time_range`) só dos dias que faltam — em background.
- **UX:** o dashboard responde imediatamente com os dados disponíveis. A próxima abertura já estará completa.
- **Hoje (today):** sempre força refresh, pois o gasto do dia muda continuamente.

### Backfill Inicial (`mode: "on_connect"`)
- Disparado automaticamente quando um tenant conecta uma plataforma pela primeira vez.
- Janela: `maximum` (lifetime, com fallback automático para chunks trimestrais se a Meta recusar).
- Garante que "Todo o período" tenha sentido desde o dia 1.

## 3. Tabela de Cobertura

`public.ad_insights_sync_coverage`:
- `tenant_id`, `platform`, `ad_account_id`
- `first_day_synced`, `last_day_synced`
- `last_sync_at`, `last_sync_kind` (daily | weekly | on_connect | on_demand | manual)
- `last_sync_status` (pending | running | success | error), `last_sync_error`

Permite ao sistema (e ao admin) saber exatamente o que está coberto por tenant/plataforma sem precisar varrer as tabelas de insights.

## 4. Fluxo End-to-End

```
[Usuário muda filtro] 
   ↓
[useDashboardMetrics]
   ├─ lê meta_ad_insights / google_ad_insights / tiktok_ad_insights (banco)
   └─ dispara ads-ensure-coverage (fire-and-forget)
                ↓
       [ads-ensure-coverage]
          ├─ detecta dias faltantes no range
          ├─ marca coverage como "running"
          └─ chama meta-ads-insights / google-ads-insights / tiktok-ads-insights
                       com time_range={ since, until }
                       ↓
              [insights são gravados em batch]
                       ↓
              [coverage atualizado para "success"]
```

## 5. Por que não "ler direto da API toda vez"?

- **Rate limit:** Meta limita ~200 calls/h por usuário. Múltiplos tenants × múltiplas mudanças de filtro = bloqueio.
- **Latência:** períodos > 90 dias na Meta exigem job assíncrono (2-15 min). Inviável para UX de calendário.
- **Custo de quota** desnecessário: dados antigos (>90 dias) são imutáveis na Meta.
- **Fidelidade:** o sync semanal de `last_90d` já corrige qualquer ajuste de atribuição.

## 6. Arquivos Relacionados

- `supabase/functions/sync-ads-dashboard/index.ts` — orquestrador 3 camadas
- `supabase/functions/ads-ensure-coverage/index.ts` — backfill sob demanda
- `supabase/functions/meta-ads-insights/index.ts` — sync Meta (suporta date_preset + time_range + chunks trimestrais)
- `supabase/functions/google-ads-insights/index.ts` — sync Google
- `supabase/functions/tiktok-ads-insights/index.ts` — sync TikTok
- `src/hooks/useDashboardMetrics.ts` — leitura + trigger ensure-coverage
- Migração `ad_insights_sync_coverage` (16/04/2026)

## 7. Cron Jobs

| Nome (`cron.job.jobname`) | Cadência real | Mode | Janela |
|------|----------|------|--------|
| `sync-ads-dashboard-daily-15min` | `0 0,6,9,12,15,18,21 * * *` | daily | last_7d |
| `sync-ads-dashboard-weekly-reconcile` | `0 6 * * 0` | weekly | last_90d |

> **Nota — divergência de nomenclatura:** o job `sync-ads-dashboard-daily-15min` foi inicialmente especificado como `*/15 * * * *`, mas a cadência ativa em produção é `0 0,6,9,12,15,18,21 * * *` (7 execuções diárias em horários fixos). O nome do job foi mantido para não causar duplicidade no agendador; a tabela acima reflete o schedule real consultado em `cron.job`.

### Renovação de tokens OAuth relacionados

| Job | Cadência | Função | Gate |
|-----|----------|--------|------|
| `meta-token-refresh-daily` | `0 3 * * *` | `meta-token-refresh` | `meta_ads`, `catalogo_meta`, `whatsapp_meta` |
| `meta-token-health-check-daily` | `0 4 * * *` | `meta-token-health-check` | mesmo gate Meta |
| `tiktok-token-refresh-cron` | `0 */6 * * *` | `tiktok-token-refresh-cron` | `tiktok_shop` |
| `google-token-refresh-cron-10min` | `*/10 * * * *` | `google-token-refresh-cron` | `google_ads`, `youtube_publishing` |

> **Google token refresh:** tokens de acesso Google expiram em ~1h. A função renova qualquer conexão cujo token expira nos próximos 10 minutos, por isso a cadência é de 10 em 10 minutos. O gate cobre Google Ads e YouTube Publishing — se outros módulos Google passarem a ser rastreados em `system_resource_usage` (Gmail, Calendar, Merchant, Search Console, GTM), adicionar ao array do gate para não pular tenants que usem Google apenas para esses fins.

## 8. Operação Manual

Para forçar backfill completo de um tenant específico (ex: pós-onboarding ou recuperação histórica):
```
POST /functions/v1/meta-ads-insights
{ "action": "sync", "tenant_id": "<uuid>", "date_preset": "maximum" }
```
A função usa fallback automático para chunks trimestrais se a Meta recusar `maximum`.
