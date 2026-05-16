# Recursos em Uso e Crons Adormecidos

## Objetivo

Reduzir consumo de processamento em background mantendo crons "adormecidos" enquanto nenhum lojista está usando o módulo correspondente. Quando algum lojista conecta o recurso, o sistema é ativado **na hora** via gatilho de evento (sem esperar o cron diário de varredura).

## Componentes

### 1. Registro central (`system_resource_usage`)

Tabela com 12 módulos monitorados, agrupados por área:

| Grupo | Módulos |
|---|---|
| Anúncios | Meta Ads, Google Ads, IA Gestor de Tráfego |
| Marketplaces | Mercado Livre, Shopee, TikTok Shop |
| Mensageria | WhatsApp Meta, Catálogo Meta |
| IA | IA de Atendimento |
| Marketing | E-mail Marketing, YouTube Publishing |
| Fiscal | Fiscal (NFe) |

Cada linha tem `module_key`, `active_tenant_count`, `status` (`active`/`dormant`), `last_refreshed_at`, `last_event_activation_at`.

### 2. Atualização do registro

- **Diária (cron `system-resource-usage-refresh-daily` às 04:00 UTC):** varredura completa, recalcula contagem real e marca módulos sem lojistas ativos como `dormant`.
- **Imediata por evento (gatilhos SQL):** quando lojista conecta um recurso (WhatsApp, Meta, Google, marketplace, IA Atendimento, IA Tráfego, Fiscal, YouTube, e-mail marketing), o módulo é marcado `active` na hora.

### 3. Filtro nos crons (gating)

Crons específicos de módulo passam a chamar a função `cron_call_edge_if_active(module_keys, job_name, function_name, body)`, que:
- Se ao menos um módulo da lista está ativo: chama a edge function normalmente.
- Se todos estão adormecidos: registra a execução pulada em `system_resource_skip_log` e não chama o backend.

### 4. Auditoria (`system_resource_skip_log`)

Toda execução pulada é registrada com módulo, nome do cron, motivo e contagem. Janela de 24 h é exibida no painel admin.

### 5. Painel admin (`/platform/recursos-em-uso`)

Acesso restrito a super-admin (PlatformAdminGate). Mostra:
- Total de recursos em uso x adormecidos.
- Total de execuções puladas em 24 h.
- Lista por grupo com status, contagem de lojistas e execuções puladas por módulo.
- Botão "Atualizar agora" (chama `refresh_system_resource_usage()`).

## Frequências definidas

### Sempre ativos (não dependem de gating)

| Cron | Frequência | Justificativa |
|---|---|---|
| `run-notifications-every-minute` | 1 min | Crítico — notificações ao cliente (Pix gerado, pagamento confirmado). |
| `turn-orchestrator-watchdog` | 1 min | Crítico — orquestrador de turnos do WhatsApp (tempo de resposta da IA). |
| `expire-stale-orders-every-15m` | 15 min | SLA de expiração de pedidos abandonados. |
| `credits-release-orphan-reservations-15m` | 15 min | Liberação financeira de reservas órfãs. |
| `scheduler-tick-job` | 10 min | Tick geral do agendador. |
| `process-events-every-minute` | 10 min | Despacho de eventos internos. |
| Cleanup / health checks / cobrança / custos | diário/6 h | Housekeeping e governança da plataforma. |

### Com filtro "recurso em uso" (rodam só quando há lojista usando)

| Cron | Frequência | Módulo(s) |
|---|---|---|
| `meli-sync-listings-auto` | grade fixa 00/06/09/12/15/18/21 | Mercado Livre |
| `check-whatsapp-templates-hourly` | 2 h | WhatsApp Meta |
| `whatsapp-orphan-watcher-15min` | 1 h | WhatsApp Meta |
| `meta-whatsapp-monitor-hourly` | 2 h | WhatsApp Meta |
| `meta-whatsapp-monitor-all-daily` | diário | WhatsApp Meta |
| `whatsapp-token-healthcheck-daily` | diário | WhatsApp Meta |
| `whatsapp-cross-business-detector-daily` | diário | WhatsApp Meta |
| `meta-token-refresh-daily` | diário | Meta Ads + Catálogo + WhatsApp |
| `meta-token-health-check-daily` | diário | Meta Ads + Catálogo + WhatsApp |
| `meta-catalog-daily-sync` | diário | Catálogo Meta |
| `sync-ads-dashboard-daily-15min` | 1 h | Meta Ads + Google Ads |
| `sync-ads-dashboard-weekly-reconcile` | semanal | Meta Ads + Google Ads |
| `tiktok-token-refresh-cron` | 6 h | TikTok Shop |
| `ads-autopilot-analyze` | 6 h | IA Gestor de Tráfego |
| `ads-weekly-insights` | semanal | IA Gestor de Tráfego + Ads |
| `ads-creative-generate` | semanal | IA Gestor de Tráfego |
| `ads-experiments-run` | semanal | IA Gestor de Tráfego |
| `ai-critical-alerts-process-30min` | 2 h | IA de Atendimento |
| `ai-snapshot-queue-worker-every-2min` | 10 min | IA de Atendimento |
| `ai-signal-capture-batch-daily` | diário | IA de Atendimento |
| `ai-learning-aggregator-daily` | diário | IA de Atendimento |
| `ai-brain-monthly-review-reminder` | mensal | IA de Atendimento |
| `agenda-dispatch-reminders` | 30 min | IA de Atendimento (agenda WhatsApp) |
| `audience-sync-weekly-sat-23h` | semanal | E-mail Marketing |
| `birthday-daily-trigger` | diário | E-mail Marketing |
| `media-social-publish-worker` | 30 min | Meta Ads + Catálogo |

## Critérios de "lojista usando o módulo"

Definidos na função `count_active_tenants_for_module(module_key)`:

- **Meta Ads:** integração conectada com `auth_grant_id`, status `connected/active`, ativos selecionados, último sync nos últimos 30 dias.
- **Catálogo Meta:** integração com `catalog_id` selecionado.
- **WhatsApp Meta:** config Meta com `access_token` e `phone_number_id`, habilitada.
- **Google Ads:** conexão Google ativa com `refresh_token` e escopo Ads.
- **Mercado Livre / Shopee:** conexão de marketplace ativa.
- **TikTok Shop:** conexão registrada (último sync ≤ 30 dias).
- **IA de Atendimento:** `ai_support_config.is_enabled = true`.
- **IA Gestor de Tráfego:** `ads_autopilot_configs.is_enabled = true`.
- **E-mail Marketing:** campanha agendada/enviada nos últimos 30 dias OU inscrito criado nos últimos 30 dias.
- **Fiscal:** certificado configurado e válido.
- **YouTube:** conexão ativa com `refresh_token`.

## Regressão e rollback

Cada cron foi reagendado com nome igual ao original (`cron.schedule` substitui in-place). Para reverter qualquer cron específico, basta executar `cron.unschedule('<jobname>')` e recriar com a frequência/comando antigo. O log de pulos serve como evidência de que o filtro está agindo corretamente.
