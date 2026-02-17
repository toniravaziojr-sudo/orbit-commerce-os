

# Teste E2E: Bug Critico Encontrado - URL de Destino Incorreta

## Resultado do Teste

Ao rastrear o fluxo completo no tenant **respeiteohomem**, identifiquei que os 3 fixes anteriores (Tarefas 1, 2 e 3) foram implementados corretamente em termos de lógica, mas compartilham um **bug critico** que impede o funcionamento correto.

---

## Status dos Assets

- 15 criativos com `status = ready` e `asset_url` preenchido -- Pipeline de geração OK
- Nenhum com `platform_ad_id` -- Nenhum foi publicado no Meta ainda
- Domínio correto do tenant: `loja.respeiteohomem.com.br` (tabela `tenant_domains`)
- Produtos possuem `slug` -- OK

---

## Bug Critico: `tenants.custom_domain` NAO EXISTE

### O Problema

Tanto `ads-chat` (linhas 928, 2109, 2212) quanto `ads-autopilot-analyze` (linha 1858) fazem:

```text
supabase.from("tenants").select("slug, custom_domain")
```

A tabela `tenants` **não possui** a coluna `custom_domain`. O domínio customizado está na tabela `tenant_domains`:

```text
tenant_domains: domain = 'loja.respeiteohomem.com.br', type = 'custom', is_primary = true
```

O PostgREST do Supabase **não gera erro** ao selecionar colunas inexistentes -- simplesmente retorna `null`. Resultado: `custom_domain` é sempre `undefined`, e o fallback gera a URL errada.

### URL Gerada (ERRADA)
```
https://respeite-o-homem.shops.comandocentral.com.br/produto/{slug}
```

### URL Correta (ESPERADA)
```
https://loja.respeiteohomem.com.br/produto/{slug}
```

### Impacto

Mesmo que os criativos sejam publicados no Meta, os anúncios redirecionariam para a URL errada. Se o subdomínio da plataforma não estiver configurado com SSL/DNS, os cliques resultariam em erro de conexão.

---

## Plano de Correção

### Correção Unica: Buscar domínio da tabela `tenant_domains`

Em **todos** os pontos que constroem `storeHost`, substituir:

```text
// ANTES (errado):
const { data: tenantInfo } = await supabase
  .from("tenants")
  .select("slug, custom_domain")
  .eq("id", tenantId)
  .single();
const storeHost = tenantInfo?.custom_domain || tenantInfo?.slug + ".shops...";

// DEPOIS (correto):
const { data: tenantInfo } = await supabase
  .from("tenants")
  .select("slug")
  .eq("id", tenantId)
  .single();
const { data: customDomain } = await supabase
  .from("tenant_domains")
  .select("domain")
  .eq("tenant_id", tenantId)
  .eq("type", "custom")
  .eq("is_primary", true)
  .maybeSingle();
const storeHost = customDomain?.domain 
  || (tenantInfo?.slug ? `${tenantInfo.slug}.shops.comandocentral.com.br` : null);
```

### Arquivos e Locais Afetados

1. **`supabase/functions/ads-chat/index.ts`** -- 3 locais:
   - Linha 928: Context collector (`select("name, slug, custom_domain")`)
   - Linha 2109: `create_full_campaign_for_product`
   - Linha 2212: Outro context collector

2. **`supabase/functions/ads-autopilot-analyze/index.ts`** -- 1 local:
   - Linha 1858: Step 3 (criação de criativo no Meta)

### Resultado Esperado Após Fix

Para o tenant respeiteohomem:
```
URL de destino: https://loja.respeiteohomem.com.br/produto/kit-banho-calvicie-zero-3x
```

### Edge Functions para Redeploy

- `ads-chat`
- `ads-autopilot-analyze`

