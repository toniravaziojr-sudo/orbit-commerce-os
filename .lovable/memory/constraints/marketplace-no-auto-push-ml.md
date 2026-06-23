---
name: Marketplace ML — Sem Push Automático
description: Proibido criar cron/trigger/job que envie atualizações automáticas ao Mercado Livre. Todo PUT/POST ao ML é manual, disparado pelo usuário.
type: constraint
---

# Mercado Livre — Política Manual-Only de Envio

**Não criar nenhum mecanismo automático (cron, trigger, queue, job) que envie atualizações ao Mercado Livre** (POST/PUT em `api.mercadolibre.com/items/*`).

Toda chamada de escrita para o ML deve ser disparada **exclusivamente por ação manual do usuário**: publicar, atualizar, pausar, reativar, excluir, editar em lote.

## Por quê
O Mercado Livre penaliza anúncios editados com alta frequência:
- Perda de relevância na busca orgânica.
- Reset do score de qualidade do anúncio.
- Queda em campanhas Mercado Ads.

Atualizações automáticas “para manter sincronizado” causam mais dano do que benefício no canal ML.

## O que é permitido
- Cron de **leitura** (`meli-sync-listings-auto`, 08:00 diário) que traz status/preço/estoque do ML para o nosso banco. Read-only no sentido inverso.
- Webhooks do ML (entrada de notificações).
- Atualizações manuais via UI (botão "Atualizar no ML", "Editar em Lote", etc.).

## O que é PROIBIDO
- Cron que faça `PUT /items/{id}` em massa.
- Trigger de banco que dispare `meli-publish-listing` com action `update` automaticamente.
- Job que ressincronize preços/estoque do nosso banco → ML sem clique do usuário.
- "Auto-update" silencioso em background após edição do produto.

## Como aplicar
Antes de criar qualquer rotina que toque na API do ML, perguntar:
1. Isso é disparado por ação do usuário? Se não → bloqueado.
2. É leitura (GET) ou escrita (PUT/POST/DELETE)? Se escrita sem ação humana → bloqueado.

Doc canônica: `docs/especificacoes/marketplaces/mercado-livre.md` (v2.5.0+).
