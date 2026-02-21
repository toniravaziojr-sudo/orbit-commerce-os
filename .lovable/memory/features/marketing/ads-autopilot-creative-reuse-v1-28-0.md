# Memory: features/marketing/ads-autopilot-creative-reuse-v1-28-0
Updated: now

## Smart Creative Reuse (v1.28.0)

### Problema Resolvido
A IA gerava criativos novos a cada execução do plano, ignorando centenas de criativos já existentes na tabela `ads_creative_assets` que nunca foram usados na Meta.

### Solução: Inventário + Dedup em 2 Camadas

#### Camada 1 — Inventário no Prompt (Fase 1)
- Antes de executar a Fase 1 (`implement_approved_plan`), o sistema carrega **TODOS** os criativos existentes do tenant (`status=ready`, com `asset_url`)
- Cross-referencia com `meta_ad_ads` para identificar quais estão em uso ativo na Meta (🟢 EM USO vs ⚪ DISPONÍVEL)
- Injeta o inventário completo no prompt via `{{EXISTING_CREATIVES_INVENTORY}}`
- A IA recebe instrução explícita: "NÃO gere duplicados. Reutilize criativos disponíveis."
- Também ativado nos triggers `weekly`, `monthly` e `start`

#### Camada 2 — Dedup no Handler `generate_creative`
- Quando a IA chama `generate_creative`, o handler verifica se já existem criativos prontos para:
  - Mesmo `product_id`
  - Mesmo `funnel_stage` (tof/bof/mof)
  - Mesmo `format` (1:1, 9:16, etc.)
- Se existem criativos suficientes (≥ variações solicitadas): retorna `reused: true` SEM gerar
- Se existem parcialmente: gera APENAS as variações faltantes (`neededVariations = requested - existing`)

### Dados Retornados no Dedup
```json
{
  "reused": true,
  "reused_count": 3,
  "product_name": "Produto X",
  "creative_urls": ["url1", "url2", "url3"],
  "message": "Reutilizados 3 criativos existentes..."
}
```

### Checklist Anti-Regressão
- [ ] Criativos existentes são carregados antes da Fase 1
- [ ] Cross-reference com `meta_ad_ads` identifica criativos em uso
- [ ] Handler `generate_creative` verifica dedup por product_id + funnel_stage + format
- [ ] Geração parcial funciona (gera apenas variações faltantes)
- [ ] Triggers weekly/monthly/start também recebem inventário
