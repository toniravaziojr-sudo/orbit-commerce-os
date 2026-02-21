

## Problema Identificado

A funcao `buildDeepHistoricalFromLocalData` no Motor Estrategista (v1.41.0) faz uma query de insights com `.limit(5000)`, porem o PostgREST do Supabase impoe um limite maximo de **1000 rows por request**. Resultado:

- **No banco:** 6.035 registros de insights = **R$ 667.321,02** de spend total
- **O que a IA recebe:** Apenas as 1.000 linhas mais recentes = **R$ 110.826,09**
- **Discrepancia:** 83% dos dados historicos sao silenciosamente cortados

Isso explica porque a IA "regressou" — antes ela fazia a coleta via API da Meta (com paginacao propria), mas a otimizacao v1.38.0 mudou para leitura local do banco sem implementar paginacao.

## Solucao

Implementar **paginacao sequencial** na funcao `buildDeepHistoricalFromLocalData` para buscar TODOS os registros de insights, em blocos de 1000 rows.

### Alteracao no arquivo

**`supabase/functions/ads-autopilot-strategist/index.ts`**

Substituir a query unica de insights (linhas 409-411) por um loop paginado:

```typescript
// ANTES (bugado - retorna max 1000 pelo PostgREST):
supabase.from("meta_ad_insights")
  .select("...")
  .eq("tenant_id", tenantId)
  .order("date_start", { ascending: false })
  .limit(5000)

// DEPOIS (paginacao em blocos de 1000):
async function fetchAllInsights(supabase, tenantId) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data } = await supabase
      .from("meta_ad_insights")
      .select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, cpm_cents, frequency, actions, date_start")
      .eq("tenant_id", tenantId)
      .order("date_start", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    
    const rows = data || [];
    allRows.push(...rows);
    offset += PAGE_SIZE;
    hasMore = rows.length === PAGE_SIZE;
  }
  
  return allRows;
}
```

### O que muda

1. A query de insights sera substituida pelo helper paginado dentro do `Promise.all`
2. Para 6.035 rows, executara 7 requests sequenciais de 1000 rows cada (rapido, <2s total)
3. O log existente na linha 481 ja mostrara os numeros corretos para validacao
4. Nenhum outro arquivo e afetado — a mudanca e isolada na funcao `buildDeepHistoricalFromLocalData`

### Resultado esperado

- O diagnostico passara a reportar **R$ 667k+** em spend total
- Todas as 274 campanhas terao performance historica completa
- A qualidade estrategica volta ao nivel anterior (pre-v1.38.0)

