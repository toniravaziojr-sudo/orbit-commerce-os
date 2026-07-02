# Central de SEO — Especificação

**Status:** Onda 2 em construção. Sub-onda 2.A entregue (fundação de dados read-only). Demais sub-ondas ainda não implementadas.
**Localização futura na UI:** `Marketing → SEO` (aba nova em `src/pages/Marketing.tsx`). **Não implementada nesta sub-onda.**
**Fundação técnica pública:** `docs/especificacoes/storefront/seo.md` (Onda 1 — Worker + `storefront-html` + robots/sitemap). Continua sendo a fonte de verdade do SEO público. Esta Central **não substitui** essa fundação.

## Objetivo
Reunir num único painel administrativo:
1. Um **Índice de Saúde SEO** interno (0–100) calculado sob demanda.
2. Cobertura de SEO por entidade editorial (produtos, categorias, páginas, landing pages, blog).
3. Pendências acionáveis com link para a entidade.
4. Estado técnico local da loja (favicon, SEO padrão, domínio primário verificado, SSL) como espelho informativo da Onda 1.

O nome oficial é **Índice de Saúde SEO**. Nunca chamar de "nota do Google".

---

## Sub-onda 2.A — Fundação de dados (entregue)

Escopo: só backend read-only. Zero UI, zero IA, zero GSC, zero cron, zero cache, zero snapshot, zero tabela nova, zero coluna nova.

### Views criadas (todas `security_invoker=true`)
Todas expõem `tenant_id` e herdam a RLS das tabelas de origem — a leitura roda no papel do caller.

| View | Origem | Filtro |
|---|---|---|
| `v_seo_coverage_products` | `products` | `status='active' AND deleted_at IS NULL` |
| `v_seo_coverage_categories` | `categories` | `is_active=true` |
| `v_seo_coverage_storefront_pages` | `store_pages` | `is_published=true AND COALESCE(no_index,false)=false AND type <> 'landing_page'` |
| `v_seo_coverage_landing_pages` | `store_pages` | `is_published=true AND type='landing_page'` (inclui `no_index` como flag informativa) |
| `v_seo_coverage_blog_posts` | `blog_posts` | `status='published'` |
| `v_seo_store_foundation` | `store_settings` + `tenant_domains` | 1 linha por tenant |

**Regra anti-duplicação:** `v_seo_coverage_storefront_pages` exclui `type='landing_page'` para não sobrepor `v_seo_coverage_landing_pages`.

**Campo efetivo de título/descrição em `store_pages`:** `COALESCE(meta_title, seo_title)` e `COALESCE(meta_description, seo_description)` — a tabela tem ambos os pares e o código público prioriza `meta_*`.

### Função `public.calc_seo_health(p_tenant_id uuid) → jsonb`
- `STABLE`, `SECURITY INVOKER`, `search_path = public`.
- Defesa em profundidade: `RAISE 42501` se `user_has_tenant_access(p_tenant_id)` falhar.
- `GRANT EXECUTE` apenas para `authenticated` e `service_role` (Onda 4.1 default revoke honrado).
- Retorna JSON com:
  - `score` 0–100 (arredondado).
  - `factors[]` — chave, peso, score parcial, contagens.
  - `counts` por entidade.
  - `pending[]` — pendências acionáveis agregadas.
  - `computed_at`.

**Pesos (soma 100):** produtos 30 · categorias 15 · páginas do storefront 15 · landing pages 10 · blog 10 · fundação técnica 20.
Entidades sem itens contam como 100% do peso (não penaliza quem ainda não tem blog, por exemplo).
A fundação técnica pondera 5 sinais binários igualmente: favicon, seo_title padrão, seo_description padrão, domínio primário verificado, SSL ativo.

**Pendências devolvidas hoje** (agregadas — o detalhamento por entidade é escopo da 2.B):
`products_missing_seo`, `categories_missing_seo`, `pages_missing_seo`, `landing_pages_missing_seo`, `blog_posts_missing_seo`, `duplicate_titles`.

### Validação técnica (tenant Respeite o Homem)
Executada via `SELECT` direto nas views:
- 33 produtos ativos, 33 com SEO OK.
- 12 categorias ativas, 11 com SEO OK.
- 9 páginas do storefront indexáveis, 9 OK.
- 0 landing pages, 0 blog posts.
- Fundação: favicon ✅ · logo ✅ · SEO padrão da loja ❌ · domínio primário verificado ✅ · SSL ativo ✅.

### Modelo de segurança (hardening 2026-07-02)
As 6 views `v_seo_*` são **superfície administrativa tenant-scoped**, não API pública. Modelo aplicado (Opção 1 do plano de hardening):

- **`security_invoker=true`** em todas as views (RLS herdada roda no papel do caller).
- **Guarda explícita no WHERE:** cada view aplica `AND public.user_has_tenant_access(tenant_id)` (helper SECURITY DEFINER, STABLE, que confere `auth.uid()` em `user_roles`). Zero linha cross-tenant, mesmo que a RLS da tabela base seja pública para o storefront.
- **Grants:** `anon` e `PUBLIC` **revogados** em todas as views. Apenas `authenticated` (SELECT) e `service_role` (ALL) têm acesso.
- **`calc_seo_health(p_tenant_id)`** permanece `SECURITY INVOKER`, com o mesmo guard `user_has_tenant_access` no topo. EXECUTE só para `authenticated` e `service_role`.
- **Não usa SECURITY DEFINER em nenhuma view.**

**Efeitos colaterais assumidos:**
- Chamadas via PostgREST com o papel `service_role` retornam 0 linhas nas views (não há `auth.uid()`). Edge functions que precisarem desses dados devem chamar `calc_seo_health` no contexto do usuário autenticado, ou ler as tabelas base diretamente com service_role. Hoje **não existe consumidor** dessas views.
- A 2.B poderá consultar as views diretamente do client autenticado — o filtro por tenant é aplicado no banco, não depende da UI.

**Validação executada (2026-07-02):**
- `anon` via PostgREST em `v_seo_coverage_products`, `v_seo_store_foundation` e RPC `calc_seo_health` → HTTP 401 / código `42501` "permission denied for view/function". ✅
- ACLs pós-hardening: `authenticated=r/postgres`, `service_role=arwdDxtm/postgres`, sem entrada para `anon` nem `PUBLIC`. ✅
- Guarda por linha (`user_has_tenant_access`) provada logicamente: mesmo com SELECT concedido, o WHERE só retorna linhas dos tenants presentes em `user_roles` do caller. Zero risco cross-tenant.

### O que a 2.A **não faz** (por decisão de escopo)
- Não cria UI nem aba em Marketing.
- Não chama Google Search Console.
- Não usa IA.
- Não cria tabela, coluna, trigger, cron, materialized view, snapshot ou cache.
- Não altera dados reais de produtos, categorias, páginas, blog, landing pages, Worker, sitemap, robots, meta robots, `storefront-html`, `StorefrontHead.tsx` ou Ads.
- Não cria role nova. Aprovação/aplicação futura em 2.D/2.E será owner/admin (a role "marketing" existente é módulo/permissão, não role de usuário).

---

## Roadmap — próximas sub-ondas (não implementadas)

**Ordem aprovada:** 2.A → 2.B → 2.F → 2.C → 2.D → 2.E.

- **2.B — Central read-only.** Aba `Marketing → SEO` consumindo `calc_seo_health` + as 6 views. Zero chamada externa na abertura.
- **2.F — Correções de SEO público server-side.** Ajustes de `<title>/description/canonical/og:*/twitter/JSON-LD/og:type` nascem no `storefront-html` + `block-compiler`. **Não** introduzir `react-helmet-async`. **Não** transformar `StorefrontHead.tsx` em fonte de verdade. LPs de Ads passam por auditoria prévia e ficam congeladas.
- **2.C — Search Console cacheado.** Refresh manual com rate-limit ≥ 10 min e cache em `seo_gsc_cache` (a criar quando a sub-onda começar). Sem cron, sem chamada na abertura.
- **2.D — Sugestões IA individuais.** Ação explícita, sempre draft com diff, aprovação manual, rollback, Motor Universal de Créditos, guardrails contra claims/alegações regulatórias. Sem cota nova.
- **2.E — Lote com orçamento.** Estimativa de créditos exibida antes, confirmação, cancelamento, tudo como draft.

## Contrato de Landing Pages (documentar; sem UI nesta onda)
- Linguagem futura na UI: "Ativar SEO orgânico nesta landing page" (SEO on → `no_index=false`; off → `no_index=true`).
- LPs de Ads permanecem separadas e nunca são alvo editorial SEO orgânico nesta Central.
- LPs `no_index=true` só aparecem como contador informativo, nunca como pendência.

## Permissões (MVP planejado)
- Visualização da Central: quem já enxerga Marketing.
- Aprovar/aplicar sugestões (2.D/2.E): owner + admin.
- Sem role nova.

## Governança
- Este doc é a fonte de verdade da Central de SEO.
- `docs/especificacoes/storefront/seo.md` continua sendo a fonte de verdade da fundação técnica pública (Onda 1).
- `docs/especificacoes/transversais/mapa-ui.md` só será atualizado com a rota `Marketing → SEO` quando a UI (2.B) for entregue.
