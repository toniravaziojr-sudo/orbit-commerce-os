
# Plano — Camada Adaptadora ML + Auditoria de Qualidade (reaproveitando o que já existe)

## Princípio guia
Reaproveitar ao máximo o que já está em produção (sem manter código obsoleto). Nada de reescrever do zero: o que já funciona vira fundação da camada adaptadora; só removo o que ficar redundante ao consolidar.

## O que já existe e será reaproveitado
- `supabase/functions/meli-resolve-attributes` — toda a cascata (cadastro → memória do tenant → dicionários → IA → N/A), `humanizeMeliError`, extrator de substâncias, match por nome de ANVISA, gate de domínio. Tudo isso vira o **núcleo do motor**, só muda de lugar para `_shared/marketplace-adapter/meli/`.
- `supabase/functions/meli-publish-listing` — sanitizadores de publish/update da v2.6.1, soberania de garantia, injeção de `UNITS_PER_PACK`, omissão de regulatórios vazios (v2.4.3). Passam a chamar o mesmo motor compartilhado, em vez de duplicar a lógica.
- `supabase/functions/meli-bulk-operations` — cascata de categorização v1.13.0 (incluindo IA Decisora) e sanitização do termo. Mantida intacta — só ganha persistência do `coverage_report` da categoria.
- Tabela `meli_listings` — já guarda `attributes`, `category_id/name/path_text`, `resolver_version`, `meli_response`. Vamos **adicionar colunas** em vez de criar tabela paralela.
- Tabela `meli_product_attribute_memory` — memória de ajustes manuais do tenant. Mantida como está; vira a etapa 2 da hierarquia do adaptador (já é hoje).
- `src/lib/marketplaces/mlReadiness.ts` e `MarketplaceFieldHint.tsx` — continuam como porta de entrada do cadastro.
- Painel `MeliAttributesPanel`, self-healing v2.6.0, cache versionado v2.4.1, idempotência por step v2.3.0 — todos mantidos; passam a ler o novo `coverage_report` para exibir o que falta em linguagem de negócio (Regra §36), sem nova tela.
- Aba **Anúncios** existente no hub ML — recebe os novos selos de qualidade (sem rota nova, sem mudança de UX além de chips informativos).
- Tabela `platform_capabilities` + hook `usePlatformCapability` — já existe contrato de "capacidades por plataforma". Pode hospedar o `adapter_version` por marketplace, evitando criar registro paralelo.

## O que sai (sem deixar código morto)
- O sanitizador duplicado dentro de `meli-publish-listing` que repete lógica do `meli-resolve-attributes` — removido após a unificação (Onda C). Antes de remover, confirmo zero outros consumidores via busca no repo.
- `resolver_version` ad-hoc espalhado — substituído por `adapter_version` único.

## Ondas

### Onda A — Auditoria de Qualidade (responde "por que não 100" sem mexer em mais nada)
- **Reaproveita** `meli-publish-listing`: após o POST/PUT bem-sucedido, faz `GET /items/{id}` (campo `health`) e `GET /items/{id}/health/actions`, persistindo em novas colunas de `meli_listings`: `health_score`, `health_actions`, `health_checked_at`.
- **Nova função leve** `meli-health-sync` (clonada da estrutura de `meli-bulk-operations`, sem reinventar auth/cors): backfill sob demanda dos 25 anúncios já publicados + reconciliação periódica.
- Aba **Anúncios** ganha chip "Nota ML: X/100" e tooltip listando `health_actions` traduzidos pelo `humanizeMeliError` já existente.

### Onda B — Espelho da Ficha + Cobertura Persistida
- **Nova tabela** `marketplace_category_specs` (`marketplace`, `category_id`, `attributes_json`, `fetched_at`, TTL 7 dias). Substitui as chamadas repetidas a `/categories/{id}/attributes` espalhadas hoje.
- `meli_listings` ganha `coverage_report jsonb` e `adapter_version text`.
- O motor (que hoje vive em `meli-resolve-attributes`) passa a emitir o `coverage_report` (obrigatórios cobertos, opcionais cobertos, ignorados com motivo). O painel `MeliAttributesPanel` lê esse relatório em vez de recalcular.
- Cruzamento na aba Anúncios: `coverage_report` × `health_actions` → mostra "o ML pediu X, seu cadastro não tem Y, corrija em Z" usando o `MarketplaceFieldHint` já existente.

### Onda C — Unificação do Motor (multi-marketplace ready) ✅ Fundação aplicada
- Criado `supabase/functions/_shared/marketplace-adapter/` com:
  - `core/contract.ts` — tipos genéricos (AttributeSpec, ResolvedAttribute, CoverageReport, AdapterContext, MarketplaceErrorHumanizer).
  - `meli/error-humanizer.ts` — `humanizeMeliError` + `prettyAttrName` movidos de `meli-publish-listing` (comportamento preservado).
  - `meli/index.ts` — façade que reexporta humanizer, `getMeliCategorySpec`, `fetchAndPersistMeliHealth` e expõe `MELI_ADAPTER_VERSION`.
- `meli-publish-listing` v3.11.0 agora importa do adaptador (deletadas as duplicações locais).
- Migração futura (mantida no plano): mover sanitizadores de publish e a cascata do `meli-resolve-attributes` para o adaptador sob `meli/resolver.ts` e `meli/sanitizers.ts` — só executar após Onda D validar o estado atual em produção, evitando refactor cego de ~2400 linhas.


### Onda D — Teste real do fluxo novo
- Tenant **respeite-o-homem** como cobaia.
- Roteiro:
  1. Backfill de health dos 25 anúncios existentes — confirmar que `health_score` e `health_actions` aparecem em todos.
  2. Reabrir o diálogo de um anúncio já publicado sem editar nada e salvar — confirmar zero erros (regressão v2.6.1) e que `coverage_report` é gravado.
  3. Publicar 1 anúncio novo end-to-end — validar que `adapter_version` é gravado, health é coletado on-publish, e que o que aparece na aba Anúncios bate com o que o ML mostra no painel oficial.
  4. Forçar 1 anúncio com campo obrigatório faltando no cadastro — confirmar que o painel aponta o campo com `MarketplaceFieldHint` e bloqueia publicar.
  5. SQL de auditoria: comparar `coverage_report.missing` × `health_actions` para os 25 e para o novo, garantir consistência.
- Validação técnica obrigatória (Knowledge): consulta ao banco, leitura dos logs das edges, verificação do build. Se algum item falhar, voltar ao Diagnóstico antes de partir para a Onda E.

### Onda E — Atualização documental (só após D passar)
- `docs/especificacoes/marketplaces/_padrao-canonico-marketplaces.md` — nova seção "Camada Adaptadora (multi-marketplace)" com o contrato genérico.
- `docs/especificacoes/marketplaces/mercado-livre.md` — seção "Adaptador e Auditoria de Qualidade" (health, coverage_report, adapter_version, fluxo on-publish + backfill).
- `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` — registrar que o motor agora é único e vive em `_shared/marketplace-adapter/meli/`.
- `.lovable/memory/features/marketplaces/canonical-flow-standard.md` — acrescentar o contrato do adaptador como item invariável.
- `docs/REGRAS-DO-SISTEMA.md` — referência cruzada à nova camada (sem mudar regra, só apontar).
- `docs/especificacoes/transversais/mapa-ui.md` — só se a aba Anúncios mudar de fato (chips novos sim, rota não).

## Detalhes técnicos resumidos
- **Schema novo:** `marketplace_category_specs` (tabela), `meli_listings` ganha `health_score int`, `health_actions jsonb`, `health_checked_at timestamptz`, `coverage_report jsonb`, `adapter_version text`. Migration única na Onda A (health) e outra na Onda B (coverage/spec). GRANTs e RLS conforme padrão.
- **Edges novas:** apenas `meli-health-sync`. Tudo o mais é refactor/mover.
- **Removidos ao final da Onda C:** blocos duplicados entre `resolve` e `publish` (lista explícita gerada antes do delete e revisada por mim).

## Limitações e decisões técnicas que assumo (sem nova consulta)
- TTL do espelho da ficha: 7 dias + refresh on-demand quando o adaptador detectar atributo desconhecido.
- Backfill de health: leitura no ML, não destrutiva — sigo sem nova confirmação.
- UI: zero tela nova. Só chips informativos na aba Anúncios já existente. Qualquer página dedicada de "Qualidade dos Anúncios" virá só com sua aprovação futura.
- Núcleo core (Produtos/Clientes/Pedidos) intocado, conforme Regra §3.2.1.

Sigo A → B → C → D → E nessa ordem, validando ao final de cada onda antes de avançar?
