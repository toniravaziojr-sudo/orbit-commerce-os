---
name: Ads Publish — Paridade Total Proposta → Meta
description: Publicador de propostas deve transcrever 100% dos campos da proposta para o formato Meta. Lista de tradutores obrigatórios e regra de novos campos.
type: constraint
---

A partir de 2026-06-18 (v1.3.0-h5-instagram-and-customer-acq), `ads-autopilot-publish-proposal` é o **transmissor fiel** da Proposta de Campanha para a Meta Ads API. Nenhum campo definido na proposta pode ser silenciosamente ignorado.

## Regras críticas adicionadas em 2026-06-18

- **Instagram do anúncio:** PROIBIDO usar `object_story_spec.instagram_actor_id` quando o valor é IGBA (`17841…`). Meta v21 rejeita com "must be a valid Instagram account id". Usar `instagram_user_id`, que aceita IGBA diretamente. Manter `instagram_actor_id` apenas como fallback para integrações antigas que explicitamente forneçam o valor.
- **Estratégia de ciclo de vida do cliente:** campo `campaign.customer_acquisition` é obrigatório no snapshot da proposta. Valores: `"new_customers"` → Meta `is_new_customer_acquisition=true` (Conquistar novos clientes) | `"all"`/null → padrão Meta (Todos os públicos). IA decide com base na etapa do funil dos conjuntos; lojista pode ajustar antes de aprovar. Só aplicável a OUTCOME_SALES no site.


## Tradutores obrigatórios (em `_shared/meta-publish-mappers.ts`)
- `mapGender`: "Masculino"/"masc"/"homem"/"male" → `[1]`; "Feminino"/"female"/"mulher" → `[2]`; "Todos"/"ambos"/vazio → omitir. Aceita array `[1,2]` direto.
- `mapGeoLocations`: aceita `geo_locations` estruturado; cai para `{countries:["BR"]}`.
- `applyPlacements`:
  - `["advantage_plus"]` (Advantage+ **Placements**) → simplesmente **omitir** `publisher_platforms`/positions. PROIBIDO setar `targeting_automation.advantage_audience=1` aqui — isso é Advantage+ **Audience** (automação de PÚBLICO), coisa diferente, e força a Meta a rejeitar `age_min > 25` (erro 1870188 em 2026-06-18). Só ligar `advantage_audience=1` se a proposta tiver `use_advantage_audience: true` explícito.
  - Para targeting manual (idade/gênero/públicos definidos), enviar `targeting_automation.advantage_audience=0` explicitamente. A documentação da Meta indica que a automação pode assumir default 1 em criações se não houver opt-out explícito.
  - `meta-ads-adsets` é PROIBIDO de injetar `advantage_audience=1` por padrão. Deve sanitizar fluxos legados para `advantage_audience=0` quando `use_advantage_audience !== true`.
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
