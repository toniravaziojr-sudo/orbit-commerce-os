---
name: Catálogo Meta — chave canônica e auto-sync
description: Catálogo Meta usa integration_id 'catalogos' (UI). Cron, side-effect e botão manual leem dessa chave. Legado 'catalogo_meta' está aposentado.
type: constraint
---

A chave canônica do Catálogo Meta em `tenant_meta_integrations` é `integration_id = 'catalogos'`. Essa é a chave gravada pelo card de Integrações Meta e DEVE ser a única fonte de verdade.

Regras obrigatórias:
- `meta-catalog-daily-sync` lê `catalogos` (com fallback de leitura para `catalogo_meta` apenas em tenants legados que ainda não migraram).
- `meta-integrations-manage` dispara `meta-catalog-sync` (fire-and-forget) sempre que `catalogos` for ativado ou tiver `selected_assets` salvo/trocado.
- O catalogId é resolvido aceitando três formatos: `selected_assets.catalog?.id`, `selected_assets.catalog_id`, `selected_assets.catalogs?.[0]?.id` — todos apontando para o mesmo dado.
- Proibido recriar a lógica antiga de auto-criar catálogo no `meta-save-selected-assets` (causava registro paralelo em `catalogo_meta` e divergência com a seleção do usuário).
- `meta-catalog-sync` escreve em `ai_critical_alerts` (categorias `integracao_meta_catalogo` e `integracao_meta_catalogo_parcial`) e auto-resolve no próximo sucesso.

**Why:** Em 12/06/2026 o tenant respeiteohomem ativou o catálogo na Meta e nenhum produto subiu. Causa: cron lia uma chave (`catalogo_meta`) que apontava para um catálogo legado auto-criado pelo onboarding, enquanto a UI gravava a escolha do usuário em outra chave (`catalogos`). Além disso, não havia disparo de sync no momento da seleção nem botão manual.

**How to apply:** Sempre que mexer no fluxo de catálogo Meta, ler/gravar `catalogos`. Qualquer leitura de `catalogo_meta` é apenas fallback temporário e deve ser removida assim que todos os tenants forem migrados.
