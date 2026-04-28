---
name: cron-service-role-key-guc-prohibition
description: Proibido usar current_setting('app.settings.service_role_key') em pg_cron neste projeto — GUC nunca foi provisionada
type: constraint
---

# Cron jobs — proibição de `current_setting('app.settings.service_role_key')`

Neste projeto Supabase, a GUC `app.settings.service_role_key` **NÃO existe**. Qualquer `cron.schedule` que dependa dela falha silenciosamente:

- `current_setting('app.settings.service_role_key', false)` → exceção, job aborta.
- `current_setting('app.settings.service_role_key', true)` → retorna NULL, header vira `Bearer ` vazio, edge rejeita.

**Why:** Caso real do `ads-experiments-run` (jobid 6, criado fev/2026) — falhou silenciosamente toda terça às 11h por ~2 meses até ser detectado em auditoria pós-Onda 6.

**How to apply:**
- Padrão obrigatório para crons que chamam edge functions: **anon key hardcoded** no header `Authorization: Bearer eyJ...`. A validação de papel acontece dentro da edge (verify_jwt=false + checagem de service_role no body quando aplicável).
- Referência canônica: `scheduler-tick-job` ou `ads-autopilot-analyze`.
- Antes de criar cron novo, copiar a estrutura de header de um job existente saudável.
- Se algum dia a GUC for provisionada formalmente, atualizar este memory antes de reativar o padrão.
