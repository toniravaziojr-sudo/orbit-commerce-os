---
name: Dormant Cron + Resource Usage Registry
description: Crons específicos de módulo passam por gate cron_call_edge_if_active; ativação imediata por trigger; criar novo cron de módulo exige registrar module_key no registry
type: constraint
---

## Regra

1. **Toda criação ou alteração de cron específico de módulo** (Meta, WhatsApp, Google, marketplaces, IA, e-mail marketing, fiscal, YouTube, TikTok) DEVE chamar `public.cron_call_edge_if_active(ARRAY['<module_key>'], '<job_name>', '<edge_function>', '<body>'::jsonb)` em vez de chamar `net.http_post` diretamente. Proibido criar cron de módulo sem o gate — viola a economia de processamento e o critério "Recurso em uso".

2. **Crons sempre ativos (sem gate) são restritos** a: notificações ao cliente (`run-notifications-every-minute`), orquestrador de turnos (`turn-orchestrator-watchdog`), expiração de pedidos (`expire-stale-orders-every-15m`), liberação de reservas de crédito (`credits-release-orphan-reservations-15m`), tick do agendador, despacho de eventos, cleanups de housekeeping, health checks da plataforma e refresh do próprio registry. Qualquer adição a essa lista exige justificativa documentada.

3. **Frequências críticas mantidas em 1 minuto:** notificações ao cliente e orquestrador WhatsApp. Proibido reduzir essas duas — quebra SLA de notificação de Pix/pagamento e tempo de resposta da IA conversacional.

4. **Novo módulo gateado exige 4 passos obrigatórios na mesma entrega:**
   (a) adicionar `module_key` em `public.system_resource_usage` (seed via INSERT idempotente),
   (b) implementar branch correspondente em `public.count_active_tenants_for_module(module_key)` apontando para a tabela/condição real do banco,
   (c) criar trigger AFTER INSERT/UPDATE na tabela de origem chamando `mark_module_active_by_event(<module_key>)`,
   (d) reagendar/criar o cron usando `cron_call_edge_if_active`.

5. **Critérios em `count_active_tenants_for_module` devem refletir o schema real.** Em 15/05/2026 a primeira versão usou nomes errados (`access_token`/`provider`/`status`) que não existiam nas tabelas reais (`marketplace`/`is_active`/`is_enabled`), zerando todos os módulos e fazendo todos os crons ficarem adormecidos por engano. Toda alteração nessa função DEVE ser validada com `SELECT public.refresh_system_resource_usage()` + comparação contra contagem manual antes do merge.

**Por quê:** O sistema deve dormir quando ninguém está usando, mas não pode dormir por bug de critério. O esquecimento de qualquer um dos 4 passos do item 4 cria um cron que sempre roda (sem gate) ou um módulo que nunca acorda (sem trigger). O painel `/platform/recursos-em-uso` (super-admin only) é a fonte visual de verdade — divergência entre painel e realidade indica falha em um desses passos.

**Como aplicar:** Code review bloqueia PR que (a) crie `cron.schedule` com `net.http_post` direto para função de módulo, (b) altere `count_active_tenants_for_module` sem teste de refresh, (c) reduza frequência dos dois crons críticos, (d) adicione módulo ao registry sem trigger de evento correspondente.
