---
name: Platform Admin Auth + Observability RPC Standard
description: Hook unificado de Platform Admin via RPC is_platform_admin() e padrão de RPCs de observabilidade agregadas em passe único + normalização de erro PostgREST
type: constraint
---

## Regra

1. **Fonte única de verdade para Platform Admin**: o hook `usePlatformOperator` DEVE chamar a RPC `is_platform_admin()` (SECURITY DEFINER) e usar o resultado como única autoridade. Proibido manter checagens paralelas via `user_roles`/`platform_admins` no client — gera divergência entre UI e RLS e causa "Access Denied" intermitente em `/platform/*`.

2. **RPCs de observabilidade**: funções como `get_cron_jobs_status`, `get_queue_health`, `get_db_overview` DEVEM agregar em passe único via CTE sobre `cron.job_run_details` (janela 24h). Proibido loop por job com subquery — causa timeout (~8s) em tenants com muitos jobs ativos.

3. **Normalização de erro no client**: hooks que consomem RPCs de observabilidade DEVEM normalizar o erro PostgREST via helper (`toRpcError`) extraindo `message`/`details`/`hint`. Proibido renderizar o objeto cru — vira `[object Object]` na UI.

4. **Resiliência de KPI**: dashboards de saúde DEVEM exibir "Indisponível" (variant `muted`) quando uma métrica falha. Proibido cair para "0" ou "0%" em erro — gera ilusão de "métrica caindo" e mascara a falha real.

**Por quê:** Em 28/04/2026 o painel `/platform/system-health` ficou inacessível por divergência entre RLS (que usava `is_platform_admin()`) e o hook do client (que checava `user_roles` direto), somado a timeout no RPC de cron e erro renderizado como `[object Object]`. A correção isolada de cada sintoma fazia a porcentagem só cair. Solução estrutural: unificar no RPC, agregar em passe único, normalizar erro, mostrar "Indisponível".

**Como aplicar:** Qualquer nova rota `/platform/*` ou novo KPI de observabilidade deve seguir os 4 itens acima. Code review bloqueia PR que (a) cheque admin sem RPC, (b) faça loop por job, (c) renderize erro PostgREST cru, (d) defaulte métrica para 0 em falha.
