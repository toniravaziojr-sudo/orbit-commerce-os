

# Auditoria Completa: Pipeline Criativos IA -> Meta Ads

## Resumo da Auditoria

Rastreei o fluxo completo desde a geracão de criativos ate a publicacão no Meta Ads Manager. Identifiquei **2 problemas criticos** e **1 problema moderado** que impedem o fluxo end-to-end de funcionar.

---

## Fluxo Atual (5 etapas)

```text
1. ads-autopilot-creative-generate
   |-- Gera text briefs (headline, copy) via IA
   |-- Salva em ads_creative_assets (status: draft)
   |-- Dispara creative-image-generate via M2M
   
2. creative-image-generate
   |-- Gera imagem via Gemini/OpenAI
   |-- Upload para Storage (media-assets bucket - PUBLICO OK)
   |-- Registra no Drive (files table)
   |-- Atualiza ads_creative_assets (status: ready, asset_url preenchido)
   
3. ads-chat (create_full_campaign_for_product)
   |-- Busca ads_creative_assets com status ready/draft
   |-- Pega asset_url (imagem gerada) OU fallback catalogo
   |-- Upload imagem para Meta via /adimages (gera image_hash)
   |-- Cria adcreative no Meta com object_story_spec
   |-- Cria Campaign -> AdSet -> Ad (tudo PAUSED)
   |-- Agenda ativacao

4. ads-autopilot-analyze (Motor Estrategista)
   |-- Cria campanhas usando creative_id de anuncios EXISTENTES
   |-- Se nao tem creative, chama ads-autopilot-creative (funcao antiga)
   |-- NAO usa ads_creative_assets para criar criativos no Meta
   
5. Meta Graph API
   |-- Recebe image_hash + creative + campaign + adset + ad
```

---

## Problemas Identificados

### CRITICO 1: `link_data` sem campo `link` (URL de destino)

**Arquivo**: `supabase/functions/ads-chat/index.ts` (linha 2108)

O `object_story_spec.link_data` esta sendo enviado **sem o campo `link`** (URL de destino do anuncio). A Meta Graph API **rejeita** criativos do tipo `link_data` que nao possuem uma URL de destino.

**Codigo atual:**
```text
link_data: {
  image_hash: imageHash,
  message: creativeCopy,
  name: creativeHeadline,
  call_to_action: { type: "SHOP_NOW" }
  // FALTA: link: "https://loja.com/produto"
}
```

**Correcao necessaria:**
- Buscar `storeUrl` do tenant (custom_domain ou slug.comandocentral.com.br)
- Buscar slug do produto para construir URL: `https://{storeUrl}/produto/{slug}`
- Injetar no `link_data.link`

---

### CRITICO 2: `ads-autopilot-analyze` NAO usa os criativos gerados pela IA

**Arquivo**: `supabase/functions/ads-autopilot-analyze/index.ts` (linhas 1812-1870)

O Motor Estrategista, ao criar campanhas novas, busca `creative_id` de **anuncios ja existentes** na conta Meta (`meta_ad_ads`). Se nao encontra nenhum, chama `ads-autopilot-creative` (funcao antiga que usa Runway/etc, nao a pipeline de imagens).

Ele **nunca consulta** `ads_creative_assets` para:
1. Pegar a imagem gerada (`asset_url`)
2. Fazer upload para Meta (`/adimages`)
3. Criar um `adcreative` no Meta
4. Usar esse `creative_id` no novo anuncio

Isso significa que todo o trabalho de geracao de criativos (`ads-autopilot-creative-generate` + `creative-image-generate`) e **ignorado** pelo motor que efetivamente cria campanhas.

**Correcao necessaria:**
- Antes de usar um creative_id existente, verificar `ads_creative_assets` com `status = 'ready'` e `asset_url` preenchido
- Se existir, fazer upload da imagem para Meta, criar adcreative, e usar esse novo creative_id

---

### MODERADO: Fallback de imagem via `createSignedUrl` usando bucket errado

**Arquivo**: `supabase/functions/ads-chat/index.ts` (linhas 2048, 2060)

Os fallbacks usam `supabase.storage.from("files").createSignedUrl(...)`, mas as imagens geradas estao no bucket `media-assets`, nao no bucket `files`. Se o `storage_path` salvo nos assets comecar com o path relativo ao bucket `media-assets`, a signed URL sera gerada no bucket errado.

**Impacto**: Se `asset_url` estiver preenchido (caso normal apos fix v2.0.1), esse fallback nunca e atingido. Porem, e um bug latente.

---

## Plano de Correcao (3 tarefas)

### Tarefa 1: Adicionar `link` ao `link_data` no ads-chat

**Arquivo**: `supabase/functions/ads-chat/index.ts`

1. Na funcao `create_full_campaign_for_product`, buscar o tenant (ja faz isso no context collector)
2. Construir `storeUrl` a partir de `custom_domain` ou `slug`
3. Buscar o `slug` do produto na tabela `products`
4. Montar URL de destino: `https://${storeUrl}/produto/${productSlug}`
5. Incluir no `link_data.link`

### Tarefa 2: Integrar `ads_creative_assets` no `ads-autopilot-analyze`

**Arquivo**: `supabase/functions/ads-autopilot-analyze/index.ts`

No Step 3 (criacao de anuncio), antes de buscar `creative_id` de anuncios existentes:

1. Consultar `ads_creative_assets` com `status = 'ready'` e `asset_url IS NOT NULL`
2. Se encontrar, fazer upload da imagem para Meta via `/adimages`
3. Criar um `adcreative` via Graph API (`/adcreatives`)
4. Usar o `creative_id` retornado no anuncio
5. Marcar o asset como `status = 'published'`

### Tarefa 3: Corrigir bucket no fallback de signed URL

**Arquivo**: `supabase/functions/ads-chat/index.ts`

Trocar `supabase.storage.from("files")` por `supabase.storage.from("media-assets")` nos dois fallbacks (linhas 2048 e 2060).

---

## Detalhes Tecnicos

### Dependencias entre tarefas
- Tarefa 1 e 3 sao independentes e podem ser feitas em paralelo
- Tarefa 2 depende da Tarefa 1 (precisa da mesma logica de `link` para o creative)

### Arquivos afetados
- `supabase/functions/ads-chat/index.ts` (Tarefas 1 e 3)
- `supabase/functions/ads-autopilot-analyze/index.ts` (Tarefa 2)

### Edge Functions para redeploy
- `ads-chat`
- `ads-autopilot-analyze`

