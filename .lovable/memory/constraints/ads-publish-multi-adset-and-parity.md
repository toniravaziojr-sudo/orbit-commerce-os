---
name: Publicação Meta — múltiplos conjuntos e paridade total
description: Publisher de propostas de campanha cria TODOS os conjuntos planejados, vincula cada anúncio ao conjunto correto, exige paridade total e devolve a proposta para a fila em qualquer falha (anti-limbo).
type: constraint
---
Regra obrigatória do `ads-autopilot-publish-proposal` (v1.1+, 2026-06-18):

1. **Múltiplos conjuntos:** itera sobre `action_data.adsets[]` e cria todos via `meta-ads-adsets`. Cada anúncio é vinculado ao `meta_adset_id` do índice apontado em `planned_creatives[i].adset_index` (fallback para o primeiro conjunto). Proibido voltar a usar somente `adsets[0]`.
2. **Paridade total:** marca `status=executed` apenas se `successAds === readyCreatives.length`. Falha parcial ou total devolve `status=pending_approval`, limpa `approved_at`, registra `lifecycle.failure_code` (`partial_ads_failed` / `all_ads_failed` / `adset_create_failed` / `campaign_create_failed`) e `failure_message_pt` em português claro.
3. **Anti-limbo:** `markFailed` e o catch global reabrem a proposta na fila. Proibido deixar `status=approved` sem execução completa.
4. **Insight visível:** sempre insere um registro em `ads_autopilot_insights` com o resultado real (sucesso ou falha amigável).

Por quê: a versão H.4.2 criava apenas o primeiro conjunto e considerava sucesso qualquer anúncio publicado, gerando campanhas incompletas na Meta e propostas em limbo invisíveis para o lojista.
