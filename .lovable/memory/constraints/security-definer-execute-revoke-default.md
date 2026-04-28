---
name: SECURITY DEFINER EXECUTE Revoke Default Standard
description: Onda 4.1 — Toda nova função SECURITY DEFINER nasce sem grant para anon/authenticated/PUBLIC. ALTER DEFAULT PRIVILEGES travado. Helpers de RLS são exceção. Pattern 6 (Onda 3) NÃO basta.
type: constraint
---

# SECURITY DEFINER EXECUTE — Padrão de Revogação Default

**Aplicado em 2026-04-28 (Onda 4.1).** Detalhamento completo em `docs/tecnico/base-de-conhecimento-tecnico.md` seção "Onda 4.1".

## Regra inviolável

1. **`ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;`** está ativo. Toda nova função `SECURITY DEFINER` nasce **inacessível** via PostgREST.

2. Para que uma RPC seja chamável pelo front logado, a migration que a cria DEVE incluir:
   ```sql
   GRANT EXECUTE ON FUNCTION public.<fn>(<args>) TO authenticated;
   ```

3. Para Edge Functions (que usam `service_role`), nenhum grant adicional é necessário — `service_role` herda do owner.

4. Para triggers, **nunca** conceder EXECUTE — trigger executa no contexto do banco.

## Por que Pattern 6 (Onda 3) NÃO substitui isso

Pattern 6 (`IF NOT user_has_tenant_access(p_tenant_id) THEN RAISE...`) é defesa em profundidade dentro da função. Mas se `EXECUTE` está aberto pra `anon`, qualquer atacante com a chave anônima pode invocar a função e disparar o RAISE — vazando informação por timing/erros, e em funções sem `p_tenant_id` (cleanups, migrations, helpers internos), Pattern 6 nem se aplica. **As duas camadas são necessárias.**

## Exceções declaradas (não corrigir)

- **RLS Helpers (9 funções):** `belongs_to_tenant`, `get_current_tenant_id`, `has_role`, `is_owner_of_member_tenant`, `is_platform_admin_by_auth`, `is_tenant_owner`, `user_belongs_to_tenant`, `user_has_tenant_access`, e implicitamente `get_auth_user_email`. **Postgres precisa de EXECUTE para anon E authenticated** para avaliar policies RLS no role do caller. Revogar quebra TODA RLS com erro 42501.
- **Pública intencional:** `get_public_marketing_config(uuid)` — endpoint público do storefront por design.

## Anti-regressão: validação obrigatória antes de revogar uma função "exposta"

Antes de revogar `EXECUTE` de qualquer função que apareça no linter:
```sql
-- 1. Está em alguma policy RLS?
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE qual::text LIKE '%<fn_name>%' OR with_check::text LIKE '%<fn_name>%';

-- 2. É chamada pelo front?
-- grep -rE "\.rpc\(['\"]<fn_name>['\"]" src/

-- 3. É chamada por edge function com service_role?
-- grep -rE "\.rpc\(['\"]<fn_name>['\"]" supabase/functions/
```

Se (1) tem resultado: **NÃO revogar de anon/authenticated**.
Se (2) tem resultado: manter `authenticated`.
Se só (3): revogar tudo, edge usa service_role.

## Resultado mensurável

Onda 4.1 reduziu alertas Supabase Linter de **219 → 75** (-144 alertas, -66%).
