---
name: Security Linter Accepted Exceptions (Onda 4.4)
description: Encerramento da Onda 4 — 42 alertas restantes do linter Supabase são exceções arquiteturais conscientes, não dívida técnica. Lista whitelist e justificativa.
type: constraint
---

# Exceções aceitas do linter Supabase (Onda 4.4 — encerrada)

Após Ondas 4.1→4.4, o linter Supabase reporta **42 alertas restantes**. Todos são **exceções arquiteturais documentadas**, não dívida técnica. Não tentar revogá-los sem antes consultar este doc.

## Categorias de exceção

### 1. SECURITY DEFINER em `public` callable por anon (9 alertas — lint 0028)

**Helpers RLS necessários para storefront público funcionar:**
- `belongs_to_tenant(uuid)`
- `get_current_tenant_id(uuid)`
- `get_public_marketing_config(uuid)` — endpoint público explícito
- `has_role(uuid, uuid, app_role)`
- `is_owner_of_member_tenant(uuid, uuid)`
- `is_platform_admin_by_auth()`
- `is_tenant_owner(uuid, uuid)`
- `user_belongs_to_tenant(uuid, uuid)`
- `user_has_tenant_access(uuid)`

**Por quê:** policies RLS chamam essas funções; revogar de `anon` quebra leitura pública de produtos, categorias, marketing config, etc.

### 2. SECURITY DEFINER em `public` callable por authenticated (31 alertas — lint 0029)

**Modelo arquitetural:** RPC SECURITY DEFINER com **validação interna de tenant/role**, padrão documentado em `mem://auth/permission-architecture-v2-unified-hook-standard` e `mem://infrastructure/security/database-hardening-standard-v2` (Tenant Identity Guard).

**Funções chamadas pelo frontend autenticado** (NÃO revogar):
- Billing/credits: `check_credit_balance`, `reserve_credits`, `consume_credits`, `check_tenant_order_limit`
- Onboarding: `create_tenant_for_user`, `initialize_default_page_template`, `initialize_storefront_templates`
- Dashboard: `count_unique_visitors`, `get_whatsapp_config_for_tenant`
- Platform Admin: `is_platform_admin`, `get_system_health_overview`, `get_top_slow_queries`, `get_cron_jobs_status`, `get_queue_health`, `get_resilience_kpis`, `get_whatsapp_incidents`, `get_whatsapp_orphan_inbound`, `get_payment_divergences`, `resolve_whatsapp_incident`
- Module access: `check_module_access`, `get_tenant_module_access`

**Por quê:** essas RPCs validam internamente `auth.uid()` + tenant ownership / `is_platform_admin()`. Revogar quebra billing, dashboard, builder, painel platform admin.

### 3. Extension in Public — `pg_net` (1 alerta — lint 0014)

**Por quê não mover:** `pg_net` em `public` é usado por triggers, queues, e código existente em `_shared/`. Mover para schema `extensions` quebra integrações sem ganho de segurança real (extensão é apenas um helper HTTP, não expõe dados).

**Mitigação:** Core rule já proíbe `pg_net` direto de DB triggers (memória `automation-trigger-cron-standard`).

### 4. Function Search Path Mutable (1 alerta — lint 0011)

**Falso-positivo:** Função reportada pertence a extensão nativa (`pgcrypto`/`pgvector` em schema `extensions`). Funções de extensão não permitem `ALTER FUNCTION ... SET search_path` — propriedade da extensão.

**Verificação:** query `SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosecdef=true AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(proconfig,'{}')) c WHERE c LIKE 'search_path=%')` retorna 0 — todas as funções `public` têm search_path fixo.

## Regra anti-regressão

**Antes de tentar reduzir o número de alertas do linter abaixo de 42:**
1. Consultar este doc primeiro.
2. Se a função/extensão não está listada como exceção, OK proceder.
3. Se está listada, **NÃO revogar** sem nova evidência arquitetural — vai quebrar fluxos reais.

## Trilha de redução (Ondas 4.1 → 4.4)

- **Ondas iniciais** → linter: 75 alertas
- **Onda 4.1** (SECURITY DEFINER EXECUTE revoke default) → 60
- **Onda 4.2** (RLS Write Hardening) → 48
- **Onda 4.3** (Storage Bucket Listing) → 44
- **Onda 4.4** (Hardening final + HIBP) → **42 (final)**

Redução total: **44%**. Os 42 restantes são exceções arquiteturais conscientes.

## Auth Hardening adicional (Onda 4.4)

- ✅ **Leaked Password Protection (HIBP)** ativado via `configure_auth({password_hibp_enabled: true})`. Usuários não conseguem mais cadastrar senhas vazadas no Have I Been Pwned.
