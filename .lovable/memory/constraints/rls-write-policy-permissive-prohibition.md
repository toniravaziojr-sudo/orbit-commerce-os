---
name: RLS Write Policy Permissive Prohibition
description: Proíbe policies RLS de escrita com USING/WITH CHECK literal `true` sem restrição de role/tenant; nome de policy deve refletir role real
type: constraint
---

# Anti-padrão proibido em policies RLS

## Regra
Policies RLS de **escrita** (INSERT, UPDATE, DELETE, ALL) **NUNCA** podem usar `USING (true)` ou `WITH CHECK (true)` sem uma das condições abaixo:

1. **Role explícito = `service_role`**: aceito (service_role faz bypass natural de RLS).
   ```sql
   CREATE POLICY "..." ON tbl FOR ALL TO service_role USING (true) WITH CHECK (true);
   ```
2. **Validação de existência de tenant** (endpoints públicos do storefront):
   ```sql
   WITH CHECK (tenant_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM public.tenants WHERE id = tenant_id
   ))
   ```
3. **Validação de parent record** (tabelas filhas como `cart_items`):
   ```sql
   USING (cart_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.carts WHERE id = cart_id))
   ```

## Anti-padrão crítico
**NUNCA** criar policy de INSERT em tabela de papéis/permissões (`user_roles`, `tenant_users`, etc) com `WITH CHECK (true)` para `authenticated`. Isso permite **escalada de privilégios trivial**: qualquer usuário logado se torna owner de qualquer tenant. Inserções em tabelas de papéis devem ser exclusivas de:
- `service_role` (Edge Functions admin), ou
- Policy com `is_tenant_owner(auth.uid(), tenant_id)` no `WITH CHECK`.

## Coerência nome/role
Se o nome da policy diz "Service role can ..." ou "Service can manage ...", o `TO` **DEVE** ser `service_role`. Nome contraditório com role é bug crítico (Categoria A da Onda 4.2): policies com nome "Service role" estavam em `roles: {public}`, abrindo acesso a anon/authenticated.

## Verificação obrigatória ao criar policy nova
1. `roles` corresponde ao escopo real (service_role vs authenticated vs anon vs public)?
2. Se `WITH CHECK = true`, o `TO` é `service_role`? Se não, há cláusula de tenant/parent?
3. Para tabelas de papéis: `WITH CHECK` valida `is_tenant_owner` ou similar?

## Por quê
Onda 4.2 encontrou 17 policies "Service role" atribuídas a `public` (acesso aberto), 1 caso de privilege escalation em `user_roles`, e 8 endpoints públicos sem validação mínima de tenant. Lint Supabase `0024_permissive_rls_policy` detecta o padrão `true` literal.

## Referências
- `docs/tecnico/base-de-conhecimento-tecnico.md` — seção "2026-04-28 — Hardening de Políticas RLS Permissivas (Onda 4.2)"
- Lint Supabase: `0024_permissive_rls_policy`
- Memória relacionada: `mem://infrastructure/security/database-hardening-standard-v2`
- Memória relacionada: `mem://constraints/security-definer-execute-revoke-default`
