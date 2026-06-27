
## Auditoria — 3 pontos do fluxo Mercado Livre (revisado)

### Ponto 1 — Garantia não chega ao ML

**Como funciona hoje**
- Fonte de verdade: cadastro do produto (`warranty_type` em {vendor|factory|none} + `warranty_duration` texto livre). O Balm publicado tem `vendor` + `30 dias`.
- Criação em lote (`MeliListingCreator`): **não tem nenhuma menção a garantia**.
- Edição (`MeliListingWizard`): tem um input "Garantia" de texto livre que, no submit, **não vira atributo do ML** — fica num campo solto que ninguém lê.
- Publicação nova: o edge injeta `WARRANTY_TYPE`/`WARRANTY_TIME` a partir do cadastro **só se** o painel ainda não tiver `WARRANTY_TYPE`. Se o painel persistiu vazio/diferente, o cadastro perde.
- Update (republicar): o sanitizador do update tem uma lista reduzida de campos livres (sem `WARRANTY_TIME`) → tempo de garantia é descartado antes do envio.

**Problema**
- Em qualquer rota, a garantia do cadastro pode ser silenciosamente perdida; e o input do wizard de edição engana o lojista.

**O que vou fazer (decisão técnica)**
- Em `meli-publish-listing`, nas duas rotas (publish novo e update):
  - Cadastro sempre vence: remover do payload qualquer `WARRANTY_TYPE`/`WARRANTY_TIME` herdado e reinjetar a partir do cadastro (`vendor`→"Garantia do vendedor", `factory`→"Garantia de fábrica", `duration` direto).
  - Se a categoria do ML não expõe esses atributos, omitir silenciosamente.
  - Incluir `WARRANTY_TIME` no `FREE_FORM_IDS` do sanitizador do update.

**Mudança de UI (preciso da sua aprovação)**
- O input livre "Garantia" no `MeliListingWizard` (edit) hoje é decorativo. Proposta: substituir por uma linha read-only "Garantia: Garantia do vendedor — 30 dias (vem do cadastro)" com link "Ajustar no cadastro" — mesmo padrão de marca/GTIN já consolidado nos docs. Mantenho o input atual se você preferir.
- No `MeliListingCreator` (criação em lote), proposta: exibir a mesma linha read-only no resumo de cada anúncio, sem adicionar nova etapa. Confirma?

---

### Ponto 2 — Reabrir o edit dialog dispara IA de novo

**Causa raiz (confirmada no banco)**
- O painel só reaproveita o cache quando **todas** as características salvas trazem `resolver_version` igual ao atual.
- O `MeliListingCreator.handleSaveAttributes` persiste o array enxugado (`{id, value_id, value_name}`) **sem** `resolver_version`, `name`, `source`, `values`, `not_applicable`.
- Resultado: no Balm publicado, são 31 atributos persistidos e **0 com `resolver_version`** → o painel marca tudo como cache legado e roda IA de novo a cada abertura. Mesmo problema replicado nos 21 anúncios já publicados.

**O que vou fazer (decisão técnica, sem mexer em UI)**
- Padronizar a persistência de atributos para sempre carimbar o payload completo da v2.4.1 (`resolver_version`, `name`, `source`, suporte a `values`/`not_applicable`) em todos os pontos que escrevem `meli_listings.attributes`:
  - `MeliListingCreator.handleSaveAttributes`.
  - `MeliListingsTab.handleEditSubmit` (e qualquer caller equivalente).
- Auto-cura silenciosa na leitura: ao abrir o painel, se o cache estiver completo mas faltando apenas `resolver_version`, carimbar localmente e regravar uma única vez — sem chamar IA, sem gasto. Resolve os 21 anúncios já publicados sem migração em massa.

---

### Ponto 3 — Resposta sobre "Salvar Alterações" no edit + erro reportado

**O que acontece quando você salva**
1. Grava no nosso banco (`meli_listings`).
2. Se o anúncio já está publicado, dispara **na hora** `meli-publish-listing` com `action=update`, que envia ao ML:
   - PUT em `items/{id}` com título, preço, quantidade, imagens e atributos sanitizados.
   - PUT separado em `items/{id}/description` com a descrição em texto puro.
3. É síncrono — o sucesso/erro aparece imediatamente.

**Sobre o erro**
- Não há logs recentes do edge nem `error_message` registrado no Balm — o erro morreu no front sem rastro. Antes de prometer correção da causa raiz, preciso reproduzir após os fixes 1 e 2. O que já consigo endereçar com segurança agora:

**O que vou fazer (decisão técnica)**
- No `updateListing` do edge:
  - Suportar atributos multi-valor (`values[]`) no sanitizador (hoje só trata `value_name` único).
  - Ampliar `FREE_FORM_IDS` (inclui `WARRANTY_TIME`).
  - Aplicar `humanizeMeliError` na resposta (já existe pro publish, falta no update) → mensagem em PT-BR amigável.
  - Em falha, persistir `error_message` no anúncio para aparecer no card e nos logs do banco.

---

## Validação técnica obrigatória pós-entrega
- Reabrir o edit do Balm: confirmar via consulta a `meli_listings.attributes` que `resolver_version` está preenchido e que o painel não dispara IA.
- Republicar com `action=update`: confirmar via `GET items/{id}` no ML que `WARRANTY_TYPE` e `WARRANTY_TIME` aparecem.
- Forçar erro controlado no update (ex.: título acima do limite) → validar mensagem amigável e `error_message` persistido.

## Documentação a atualizar
- `docs/especificacoes/marketplaces/mercado-livre.md` — bloco Garantia (fonte única = cadastro), padrão de persistência de atributos com `resolver_version`, contrato síncrono do update e tradução de erros.
- `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` — incluir garantia na lista de campos do cadastro e a regra "cache de atributos sempre carimbado com `resolver_version`".

📌 STATUS DA ENTREGA: Diagnóstico fechado. Aguardando sua decisão sobre as duas mudanças de UI do Ponto 1 antes de implementar.
