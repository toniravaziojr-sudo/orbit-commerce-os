---
name: Meta /adimages — Upload Binário Obrigatório
description: Imagens de criativo enviadas à Meta DEVEM ir como multipart/form-data com bytes da imagem. Upload por URL exige capacidade image scraper e bloqueia publicação.
type: constraint
---

# Regra (vigente desde 2026-06-16, v6.21 — Onda H.4.2)

Toda chamada a `POST /{ad_account_id}/adimages` da Marketing API da Meta feita pelo Gestor de Tráfego DEVE enviar a imagem em **multipart/form-data com os bytes brutos** (download da URL pública → `FormData` → upload binário). O `image_hash` retornado é o que vai em `object_story_spec.link_data.image_hash` ao criar o `adcreative`.

## Por que

O upload por URL exige a capacidade *image scraper* na conta de anúncios. Essa capacidade é concedida de forma inconsistente pela Meta e estava bloqueando publicações de propostas aprovadas com erro genérico "capability", mesmo com o App Meta 100% configurado. O upload binário é o modo recomendado pela documentação oficial (Marketing API — Ad Images) e funciona sem depender de capacidades extras.

## Proibido

- Reintroduzir upload exclusivo por URL como caminho principal de `/adimages`.
- Publicar criativo sem `image_hash` validado retornado pela Meta.
- Suprimir falha de download da imagem — registrar sempre em `lifecycle.events` da proposta.
- Trocar `multipart/form-data` por JSON com `url` sem aprovação explícita.

## Permitido

- Fallback **único** por URL apenas quando o `fetch` da imagem falhar (rede/CDN), com registro obrigatório no lifecycle para observabilidade.

## Onde está implementado

- `supabase/functions/ads-autopilot-publish-proposal/index.ts` — função `uploadImageToMeta` (binário com fallback URL).

## Doc formal

`docs/especificacoes/marketing/gestor-trafego.md` — seção "Upload binário de imagens para a Meta (v6.21 — 2026-06-16)".
