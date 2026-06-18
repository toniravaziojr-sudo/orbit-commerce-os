---
name: Ads Publish — Paridade Total Proposta → Meta
description: Publicador de propostas deve transcrever 100% dos campos da proposta para o formato Meta. Lista de tradutores obrigatórios e regra de novos campos.
type: constraint
---

A partir de 2026-06-18 (v1.2.0-h5-full-parity), `ads-autopilot-publish-proposal` é o **transmissor fiel** da Proposta de Campanha para a Meta Ads API. Nenhum campo definido na proposta pode ser silenciosamente ignorado.

## Tradutores obrigatórios (em `_shared/meta-publish-mappers.ts`)
- `mapGender`: "Masculino"/"masc"/"homem"/"male" → `[1]`; "Feminino"/"female"/"mulher" → `[2]`; "Todos"/"ambos"/vazio → omitir. Aceita array `[1,2]` direto.
- `mapGeoLocations`: aceita `geo_locations` estruturado; cai para `{countries:["BR"]}`.
- `applyPlacements`:
  - `["advantage_plus"]` → `targeting_automation.advantage_audience=1` e **NÃO** envia `publisher_platforms` (Advantage+ Placements).
  - Lista manual (`facebook_feed`, `instagram_reels`, etc.) → `publisher_platforms` + `facebook_positions`/`instagram_positions`/`messenger_positions`/`audience_network_positions`.
- `mapAttributionSpec`: `"7d_click_1d_view"` → `[{event_type:"CLICK_THROUGH",window_days:7},{event_type:"VIEW_THROUGH",window_days:1}]`. Enviado em `adset.attribution_spec`.
- `fetchAccountAudiences` + `findAudienceByName` + `extractIncludedAudienceRefs`: resolvem nomes de público/lookalike em IDs reais da conta no momento do publish (1 fetch por publicação, cache em memória).

## Campos obrigatoriamente transmitidos
- **Campanha**: name, objective, status, daily_budget, special_ad_categories, bid_strategy, **buying_type**, destination_type, start_time.
- **Conjunto**: name, optimization_goal, billing_event, status, start_time, end_time, promoted_object (pixel+evento), daily_budget (ABO), **attribution_spec**, targeting completo: geo, age_min/max, **genders**, **publisher_platforms/positions ou Advantage+**, **custom_audiences (inclusão)**, excluded_custom_audiences.
- **Anúncio**: name, status, creative_id; `object_story_spec` com page_id, **instagram_actor_id**, link_data (message, name, **description**, link, image_hash, call_to_action).

## Regra de público a incluir
Se a proposta cita um público por nome (texto livre em `audience`/`required_audiences`/`required_lookalikes`), o publicador busca o ID na conta. Se não encontrar, **falha o conjunto** com mensagem PT-BR ("Conjunto N: público(s) não encontrado(s) na conta: X") e devolve a proposta para a fila — proibido publicar parcialmente.

## Anti-regressão
- PROIBIDO adicionar novo campo à Proposta sem adicionar o mapper correspondente + teste em `meta-publish-mappers_test.ts`.
- PROIBIDO usar o campo `default_cta`; o canônico é `cta_default` (compat mantém ambos).
- PROIBIDO publicar adset sem `targeting.genders` quando a proposta tem `gender` definido (regressão histórica de 2026-06-18).
- PROIBIDO publicar criativo sem `instagram_actor_id` quando `identity.instagram_actor_id` existe (sem isso o anúncio só roda no Facebook).
- Bateria de testes em `supabase/functions/_shared/__tests__/meta-publish-mappers_test.ts` deve passar antes de qualquer alteração no publicador.
