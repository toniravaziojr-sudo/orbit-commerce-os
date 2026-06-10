---
name: edge-internal-call-requires-verify-jwt-false
description: Edge functions chamadas internamente por outra edge function devem ter verify_jwt=false; chave service_role não é JWT válido no gateway
type: constraint
---

# Chamada interna entre edge functions exige `verify_jwt = false`

**Why:** Em 2026-06 o pipeline de auto-emissão fiscal (`fiscal-auto-create-drafts` → `fiscal-prepare-invoice` → `fiscal-emit`) ficou semanas falhando silenciosamente com `401 UNAUTHORIZED_INVALID_JWT_FORMAT`. Causa raiz: `fiscal-emit` estava com `verify_jwt = true` no `supabase/config.toml`. Com o novo formato de chaves (`sb_*`), o `SUPABASE_SERVICE_ROLE_KEY` não é mais um JWT decodificável; o gateway rejeita antes de chegar na função, independentemente da lógica interna.

**How to apply:**
- Qualquer edge function que precise ser invocada por outra edge function via `fetch` com `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` DEVE declarar `verify_jwt = false` em `supabase/config.toml`.
- A validação de identidade (service_role vs. usuário, RBAC, tenant_id) DEVE ser feita dentro da função (padrão `isServiceRoleCall = authHeader === 'Bearer ' + serviceKey`).
- Não usar headers híbridos `apikey + Authorization: Bearer anonKey + x-internal-call: 1` — esse padrão foi tentado e gera ambiguidade. Padrão único: `Authorization: Bearer <SERVICE_ROLE_KEY>` quando service-role; JWT do usuário quando chamada do front.
- Antes de criar pipeline novo que cruza funções, verificar `verify_jwt` da função alvo. Se estiver `true`, decidir conscientemente: ou abrir (`false` + validação interna), ou usar fila no banco como ponte.

Referência canônica do projeto: `scheduler-tick.callSubFunction` chamando `fiscal-auto-create-drafts` (ambos `verify_jwt=false`).
