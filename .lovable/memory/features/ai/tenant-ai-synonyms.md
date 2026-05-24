---
name: Sinônimos determinísticos por tenant (tenant_ai_synonyms)
description: Tabela e helper resolveTenantSynonym mapeiam termo (marca, ingrediente, apelido) → produto do catálogo do tenant. Consultados ANTES do roteador estatístico para garantir resposta determinística.
type: feature
---

## Regra

Termos ambíguos (ex.: "minoxidil", "ácido hialurônico", apelidos populares) são cadastrados em `public.tenant_ai_synonyms` e consultados pela função `resolveTenantSynonym` (em `_shared/sales-pipeline/synonyms-resolver.ts`).

Estrutura da tabela:
- `term` (livre) e `term_normalized` (auto: lowercase + unaccent + trim).
- `kind` ∈ `{synonym, brand, ingredient, alias}`.
- `target_product_id` (opcional — pode existir alias só com `response_template`).
- `response_template` (opcional — texto que a IA pode usar como base).
- `is_active`.

RLS: `user_has_tenant_access(tenant_id)` em SELECT/INSERT/UPDATE/DELETE.

Match: longest-match com boundary simples no texto normalizado do turno.

## Por quê

Antes desta tabela, "minoxidil" caía em busca textual e podia retornar pool vazio ou ranking errado. P-EXEC-3 do plano pós-Frentes B–E (cenário B5.1).

## Como aplicar

- Cadastro de sinônimo é responsabilidade do lojista (ou da equipe que opera o tenant). Não criar UI ainda — fonte de verdade é o banco.
- NÃO usar a tabela para "regras de promoção" ou texto livre de marketing — só mapeamento determinístico de termo → produto.
- Limite prático: 200 sinônimos ativos por tenant. Acima disso, repensar arquitetura (FTS dedicada).
- O helper retorna o primeiro hit por longest-match. Em caso de ambiguidade, o termo mais longo vence.

## Pendência

A integração do `resolveTenantSynonym` dentro do fluxo do `search_products` (prepender o produto-alvo no topo do pool) é a próxima onda. Tabela + helper estão prontos.

## Fonte de verdade

- Tabela: `public.tenant_ai_synonyms` (migration aplicada em 24/mai/2026).
- Código: `supabase/functions/_shared/sales-pipeline/synonyms-resolver.ts`.
- Doc formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — Registro #41.
