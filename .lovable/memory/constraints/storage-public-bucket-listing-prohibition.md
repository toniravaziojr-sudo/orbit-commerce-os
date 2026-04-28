---
name: Storage Public Bucket Listing Prohibition
description: Buckets públicos do Supabase Storage não podem ter policy SELECT ampla; LIST/enumerate deve ser tenant-scoped via foldername ou restrito a service_role
type: constraint
---

# Buckets públicos do Storage não podem permitir listagem aberta

## Princípio fundamental
Buckets `public:true` no Supabase **permitem leitura individual via URL direta sem passar por RLS** (`https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>`). RLS SELECT em `storage.objects` controla apenas a API de **LIST/enumerate**.

Logo:
- **Restringir SELECT** → bloqueia enumeração maliciosa, **não quebra** carregamento de imagens via URL pública.
- **Não restringir SELECT** → vaza SKUs, padrões de nomenclatura, volume comercial, arquivos órfãos.

## Padrão obrigatório

```sql
-- ❌ NUNCA: listagem aberta
CREATE POLICY "..." ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'meu-bucket');

-- ✅ Path com tenant_id no folder1: tenant-scoped
CREATE POLICY "..." ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'meu-bucket'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- ✅ Path SEM tenant_id: restringir a service_role e mediar via Edge Function
CREATE POLICY "..." ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'meu-bucket');
```

## Restrições operacionais
- `COMMENT ON TABLE storage.objects` **falha** com `42501 must be owner of table objects`. Supabase reserva alterações estruturais em `storage` schema.
- **Apenas policies** podem ser criadas/dropadas em `storage.objects`. Nunca `COMMENT`, `ALTER`, `INDEX` ou `TRIGGER` em `storage.*`.

## Verificação obrigatória ao criar/modificar bucket público
1. Bucket `public:true`? → Path inclui `<tenant_id>/...` no início?
2. Sim → policy SELECT com `EXISTS user_roles` e `(storage.foldername(name))[1]`.
3. Não → policy SELECT restrita a `service_role`; admin acessa via Edge Function que valida tenant.
4. **Nunca** criar policy `FOR SELECT TO public USING (bucket_id = 'X')` em bucket público.

## Por quê
Onda 4.3 encontrou 4 buckets públicos com listagem aberta (`product-images`, `published-assets`, `store-assets`, `media-assets`, `review-media`). Lint Supabase `0025_public_bucket_allows_listing` detecta o padrão.

## Referências
- `docs/tecnico/base-de-conhecimento-tecnico.md` — seção "2026-04-28 — Hardening de Buckets Públicos (Onda 4.3)"
- Lint Supabase: `0025_public_bucket_allows_listing`
- Memória relacionada: `mem://constraints/rls-write-policy-permissive-prohibition`
