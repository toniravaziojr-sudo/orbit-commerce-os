---
name: ML Bulk Pagination Drift Proibido
description: Ações em lote do Mercado Livre (bulk_auto_categories, bulk_generate_titles, bulk_generate_descriptions) não podem paginar via OFFSET/LIMIT sem ORDER BY — causa listings perdidos por pagination drift do Postgres. Quando listingIds vem do diálogo, processar tudo numa passada. Diálogo deve chunkar em JS + reconciliação final.
type: constraint
---

**Forbidden:** Em `supabase/functions/meli-bulk-operations/index.ts`, usar `.range(offset, offset + limit - 1)` sem `.order("id", { ascending: true })` precedente. Postgres não garante ordem estável entre páginas → listings caem em lacunas/sobreposições e ficam órfãos (já aconteceu em 2026-06-27 no tenant Respeite o Homem com kits 2x/FLEX que não categorizaram enquanto irmãos 3x sim).

**Forbidden:** Quando o diálogo (`MeliListingCreator`) tem a lista explícita de IDs, deixar a Edge Function fatiar por OFFSET. Em vez disso:
1. Diálogo: fatiar em JS (chunk de 5), enviar `listingIds: chunk` por chamada, sem `offset/limit`.
2. Edge: quando `filterIds?.length`, processar TODOS os IDs do filtro em uma única passada (sem `range()`).
3. Diálogo: após terminar os chunks, reler do banco e re-tentar **uma única vez** os que ficaram `category_id IS NULL`. Máx 1 retry — evita loop.
4. Edge devolve `processedIds` + log `received_ids/fetched/updated/skipped/errors`.

**Why:** Falha silenciosa: usuário percebe só na UI ao notar produtos sem categoria. Reprocessar manualmente era gambiarra; a estrutura precisa garantir cobertura 100% por chamada.

**How to apply:** Antes de aprovar qualquer PR que toque ações em lote do ML, validar:
- `.order("id")` presente antes de qualquer `.range()`.
- Quando `filterIds` está presente, o código bypass-a a paginação.
- Diálogo não usa `while (hasMore) { offset += limit }` — usa chunks JS sobre `ids`.
- Há reconciliação pós-lote relendo do banco e re-tentando faltantes 1x.
