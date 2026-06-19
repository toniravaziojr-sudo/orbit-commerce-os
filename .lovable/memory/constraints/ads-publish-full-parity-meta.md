---
name: Ads Publish — Paridade Total Proposta → Meta
description: Publicador de propostas deve transcrever 100% dos campos da proposta para o formato Meta. Lista de tradutores obrigatórios e regra de novos campos.
type: constraint
---

A partir de 2026-06-18 (v1.3.0-h5-instagram-and-customer-acq), `ads-autopilot-publish-proposal` é o **transmissor fiel** da Proposta de Campanha para a Meta Ads API. Nenhum campo definido na proposta pode ser silenciosamente ignorado.

## Regra ABO vs CBO no nível de campanha (2026-06-19)

- **CBO** (`campaign.budget_mode = "CBO"`): publicador envia `daily_budget_cents` e `bid_strategy` no corpo da campanha. Conjuntos NÃO carregam orçamento próprio.
- **ABO** (`campaign.budget_mode = "ABO"` ou ausente quando há `adset.daily_budget_cents`): publicador PROIBIDO de enviar `daily_budget_cents` e `bid_strategy` no corpo da campanha. Ambos vivem exclusivamente no conjunto. A Meta rejeita estratégia de lance de campanha sem CBO ativo com `code=100 / subcode=4834011` ("Parâmetro inválido"), erro genérico que não cita o campo culpado.
- Validação: campanha ABO sempre cai no erro 4834011 se algum desses dois campos vazar para o nível de campanha. Caso histórico: proposta "Fast Upgrade" (3 conjuntos, R$ 15/dia cada) em 2026-06-19.

## Regras críticas adicionadas em 2026-06-18

- **Instagram do anúncio:** PROIBIDO usar `object_story_spec.instagram_actor_id` quando o valor é IGBA (`17841…`). Meta v21 rejeita com "must be a valid Instagram account id". Usar `instagram_user_id`, que aceita IGBA diretamente. Manter `instagram_actor_id` apenas como fallback para integrações antigas que explicitamente forneçam o valor.
- **Estratégia de ciclo de vida do cliente:** campo `campaign.customer_acquisition` é obrigatório no snapshot da proposta. Valores: `"new_customers"` → Meta `is_new_customer_acquisition=true` (Conquistar novos clientes) | `"all"`/null → padrão Meta. Aplicável a OUTCOME_SALES e OUTCOME_LEADS. O publicador tem uma camada extra de segurança: se a proposta não trouxer valor e a campanha for fria (TOF) de vendas/leads, força `new_customers` automaticamente. Escolha manual do lojista sempre prevalece.

## Regra atual (2026-06-19, v2.0.0 — "all-audiences-with-manual-customer-exclusion")

- **Decisão vigente:** o publicador NÃO ativa mais o modo "Conquistar novos clientes" da Meta automaticamente. Toda campanha sobe no modo padrão "Obter conversões de todos os públicos" e a exclusão de clientes atuais é feita manualmente em `targeting.excluded_custom_audiences` de cada conjunto frio/prospecção.
- **Motivo:** a Meta aceitava o POST com `is_new_customer_acquisition=true` e o registro de `existing_customers` na conta, mas em vários cenários ainda devolvia `is_new_customer_acquisition=false` na leitura de retorno, derrubando a campanha já publicada e ativa para `pending_approval`. Resultado prático com "Todos os públicos + exclusão manual" é equivalente (anúncio não atinge cliente atual) e a Meta nunca rejeita silenciosamente.
- **PROIBIDO no publicador:** enviar `customer_acquisition_spec`, enviar `is_new_customer_acquisition`, chamar `ensureAccountExistingCustomers`, deduplicar o público de Clientes do `excluded_custom_audiences`, rodar parity check de lifecycle lendo a flag de volta da Meta. O campo `campaign.customer_acquisition` na proposta deixa de afetar a publicação (permanece como referência histórica).
- **UI da Meta — comportamento esperado:** o painel da Meta NÃO marca visualmente o radio "Obter conversões de todos os públicos" quando a campanha é criada sem `customer_acquisition_spec`. Esse é o estado padrão/base. A Meta só destaca o radio quando o lojista escolhe explicitamente "Conquistar novos clientes". NÃO tratar como bug.
- **Seleção manual do lojista:** ativar "Conquistar novos clientes" é feito manualmente no painel da Meta após a publicação, se o tenant precisar. O autopilot não toma essa decisão nesta onda.
- **UTMs obrigatórias em todo anúncio:** o publicador continua aplicando padrão fixo antes de publicar — `utm_source=meta`, `utm_medium=paid_social` (ÚNICO valor reconhecido pelo motor de "ROAS Real (Ads)" — `social_paid` PROIBIDO), `utm_campaign=<slug do nome da campanha>`, `utm_content=ad_<n>`, `utm_term=<slug do conjunto>`, `utm_audience=<slug do público>` quando disponível. `identity.utm_base` complementa (não sobrescreve). Mesmos pares gravados em `creativeBody.url_tags`. PROIBIDO publicar anúncio sem UTMs.
- **Conferência pós-publicação:** mantida APENAS para contagem de anúncios por conjunto (`GET /<adset_id>/ads`). Divergência → `lifecycle.failure_code = "meta_parity_mismatch"`, campanha/conjuntos pausados, proposta devolvida para `pending_approval`. A conferência de `is_new_customer_acquisition` foi REMOVIDA — `parity_check.lifecycle` não é mais produzido.
- **Histórico visual igual ao da aprovação:** a aba "Ações da IA" renderiza Proposta de Campanha e Plano Estratégico usando o mesmo `StructuredProposalModal` da aprovação, em modo `readOnly`. PROIBIDO voltar a exibir JSON cru como detalhe padrão.

## Histórico (revogado em 2026-06-19 com v2.0.0)

As regras anteriores (v1.3.0 → v1.9.0) impunham `is_new_customer_acquisition=true` automaticamente em TOF de vendas/leads, registro de `existing_customers` na conta, dedupe de exclusão e parity check de leitura de volta da flag. TODAS foram removidas em v2.0.0 pelo motivo descrito acima. Não reintroduzir sem decisão explícita do usuário.



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
