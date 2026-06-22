---
name: Mercado Livre Bidirectional Real-Time Sync
description: Sincronização anúncio sistema ↔ ML em tempo real via webhook items/items_prices + cron 05h como fallback, status inactive na aba Inativos, origem da última mudança, idempotência por evento.
type: feature
---

# Sincronização Bidirecional ML ↔ Sistema (v2.6 — 2026-06-22)

## Arquitetura em 3 camadas
1. **Sistema → ML (imediato):** mutations locais chamam `meli-publish-listing`; trigger BEFORE UPDATE em `meli_listings` carimba `last_status_change_source = 'local'` e `last_status_change_at = now()` quando o status muda e o writer não informou origem.
2. **ML → Sistema em tempo real:** `meli-webhook` v3.0.0 escuta os topics `items`, `items_prices` e `questions`. Para `items`/`items_prices` chama `GET /items/{id}` no ML e aplica `mapMeliItemToLocal` (status-mapper.ts puro, testado). Carimba `last_status_change_source = 'meli'`. Atualiza `marketplace_connections.last_webhook_at`.
3. **Cron 05h BRT (`meli-sync-listings`):** rede de segurança. Métrica de saúde: tende a zero updates conforme o tempo real funciona.

## Regra excluído vs desativado (limitação do ML)
- ML não permite DELETE definitivo de anúncios já publicados — só `closed`.
- Excluir aqui um publicado → `closed` no ML + DELETE local. Aviso v2.6 explícito.
- ML reporta `closed` + `sub_status: deleted` em item que **nunca** atingiu published/paused/inactive → DELETE local.
- ML reporta `closed` em item já publicado → vira `inactive` local com `inactive_reason`. Aba **Inativos**.
- 404 na consulta segue a mesma regra (nunca publicado → delete; senão → inactive "Excluído no Mercado Livre").

## Mapeamento canônico ML→local
Fonte única em `supabase/functions/meli-webhook/status-mapper.ts`. Usado tanto pelo webhook quanto pelo cron. Coberto por 11 testes Deno em `__tests__/status-mapper_test.ts`.

## Idempotência
Webhook compara `notification.sent` com `meli_listings.last_status_change_at`. Eventos `> 1s` mais antigos são descartados (proteção contra ordem fora).

## UI
- **4 abas** em `MeliListingsTab`: Rascunhos / Publicados / Pendências / **Inativos**.
- Selo **"Sincronizado em tempo real com o Mercado Livre"** (verde se `last_webhook_at < 1h`, âmbar caso contrário).
- Indicador de **origem** ao lado do badge de status (• azul = local; ML âmbar = ML), tooltip com data/hora relativa BRT.
- Aba Inativos mostra `inactive_reason` e botão "Ver no Mercado Livre (histórico)".
- Realtime: subscription em `meli_listings` filtrada por `tenant_id`, pausada em `visibilitychange=hidden` (proteção de custo e canais).
- Texto de exclusão v2.6 deixa explícito que o ML não permite exclusão definitiva — só finaliza e mantém no histórico interno.

## Schema (migração 2026-06-22)
- `meli_listings.status` CHECK passa a aceitar `paused` e `inactive` (além dos anteriores).
- Novas colunas: `last_status_change_source` (local|meli), `last_status_change_at`, `inactive_reason`, `inactive_at`.
- `marketplace_connections.last_webhook_at`.
- Trigger `meli_listings_status_change_stamp` BEFORE INSERT OR UPDATE.
- `ALTER PUBLICATION supabase_realtime ADD TABLE public.meli_listings` + `REPLICA IDENTITY FULL`.

## Pré-requisito de plataforma
App ML no DevCenter precisa assinar os topics `items` e `items_prices` (callback já é `meli-webhook`). One-time. Sem custo ao lojista.

## Bugs corrigidos junto
- `meli-webhook` filtrava conexão por colunas inexistentes (`external_account_id`/`status`); corrigido para `external_user_id`/`is_active`. Antes disso o webhook de perguntas nunca encontrava a conexão.
