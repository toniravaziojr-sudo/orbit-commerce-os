# Catálogo Meta — Fluxo de Sincronização

## Visão de negócio

O Catálogo Meta espelha os produtos ativos da loja dentro do Commerce Manager para alimentar anúncios Advantage+, Loja do Facebook/Instagram e DPA. O usuário escolhe um catálogo existente (ou cria) dentro do card "Catálogos" em **Integrações → Meta**.

A partir da escolha, o sistema:
1. Sincroniza os produtos imediatamente (auto-sync na hora).
2. Roda uma sincronização automática diária às 05:00 UTC (cobre alterações de preço, foto, descrição, estoque).
3. Permite ao usuário disparar uma sincronização manual a qualquer momento pelo botão "Atualizar agora" no próprio card.
4. Avisa na Central de Execuções quando há falha total ou parcial no envio.

## Fonte de verdade

| Item | Chave |
|---|---|
| Seleção do catálogo do usuário | `tenant_meta_integrations` com `integration_id = 'catalogos'` |
| Histórico de itens sincronizados | `meta_catalog_items` (por `tenant_id`, `product_id`, `catalog_id`) |
| Alertas operacionais | `ai_critical_alerts` (categorias `integracao_meta_catalogo` e `integracao_meta_catalogo_parcial`) |

A chave legada `catalogo_meta` está **aposentada**. Cron e UI usam exclusivamente `catalogos`. Apenas leitura de fallback temporário é tolerada para tenants ainda não migrados.

## Fluxos

### 1. Seleção/troca do catálogo na UI
1. Usuário ativa "Catálogos" no card Meta e escolhe um catálogo existente (ou cria).
2. O backend salva a seleção em `catalogos.selected_assets.catalog = {id, name}`.
3. Side-effect dispara `meta-catalog-sync` imediatamente (fire-and-forget).
4. O painel exibe quantos produtos foram enviados e quando.

### 2. Sincronização diária (fallback automático)
Cron `meta-catalog-daily-sync` (todo dia 05:00 UTC) varre tenants com `catalogos` ativo e dispara `meta-catalog-sync` para cada um. Atende o requisito de "ao menos semanal" com folga.

### 3. Sincronização manual
Botão "Atualizar agora" no card chama o mesmo `meta-catalog-sync` direto.

### 4. Alertas na Central de Execuções
Ao final de cada sync, `meta-catalog-sync` mantém em `ai_critical_alerts`:
- `integracao_meta_catalogo` — aberto quando nenhum produto subiu e houve erros.
- `integracao_meta_catalogo_parcial` — aberto quando parte dos produtos falhou.

Os alertas são auto-resolvidos no próximo sync bem-sucedido.

## Princípios técnicos

- Resolver o `catalog_id` aceitando três formatos: `catalog.id`, `catalog_id`, `catalogs[0].id`.
- Side-effect é fire-and-forget (não bloqueia a resposta da UI ao salvar a integração).
- `synced_data_hash` em `meta_catalog_items` evita reenvio de produto sem alteração — controle de custo na Graph API.
- Validação de imagem é feita server-side antes de enviar (mínimo 500x500, content-type correto).

## Não faz parte deste módulo

- Trigger em mudança de produto (preço/imagem/estoque) — coberto pela rodada diária; trigger por evento será proposta em onda futura se necessário.
- Catálogos de outros marketplaces (Mercado Livre, Shopify) — fluxos independentes.
