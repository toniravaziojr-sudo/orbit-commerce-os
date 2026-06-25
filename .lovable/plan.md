## Objetivo
Eliminar o delay visível ao abrir o diálogo de anúncios do Mercado Livre em modo rascunho, mantendo a categoria (código + nome + caminho completo) persistida junto ao próprio anúncio. A consulta à API do ML só acontece quando realmente necessário.

## Como funciona hoje
Ao abrir o diálogo, três etapas rodam em sequência:
1. Render imediato com cache da lista (mostra só o código cru, ex.: `MLB32130`).
2. Releitura do anúncio no banco para evitar dados desatualizados.
3. Para cada categoria distinta, chamada à API `meli-search-categories` para traduzir código → nome + caminho. **Essa terceira etapa é a causa visível do delay.**

Motivo raiz: o anúncio guarda apenas o código da categoria; nome e caminho não são persistidos, então toda abertura precisa reconsultar o ML.

## O que será feito (Opção A — aprovada)

### 1. Persistir categoria completa no anúncio
Salvar, junto ao código da categoria, também o nome e o caminho completo (breadcrumb) no próprio registro do anúncio. Passa a haver 3 campos de categoria persistidos em vez de 1.

### 2. Hidratação instantânea ao abrir o diálogo
Ao abrir, o diálogo usa direto o que está salvo no anúncio — sem chamar a API do ML. Resultado: caminho completo aparece imediatamente, sem flicker e sem skeleton.

### 3. Reconsulta só sob demanda
A API do ML para resolver categoria só é chamada quando:
- O usuário **trocar a categoria** manualmente (busca/seleção nova).
- O usuário clicar em **"Recalcular"** ou ação equivalente que exija reprocessamento.
- O anúncio for **legado sem nome/caminho salvos** (preenchimento único e persistência imediata, para nunca mais reconsultar).

### 4. Preencher anúncios legados de forma incremental
Não haverá migração em massa. Quando um anúncio antigo abrir pela primeira vez sem nome/caminho, o sistema resolve uma única vez via API, persiste no anúncio e nas próximas aberturas já entra instantâneo. Zero processamento desnecessário no agregado.

### 5. Sincronizar gravação ao escolher categoria
Sempre que o usuário escolher/trocar categoria no wizard, o nome e o caminho retornados pela busca já são gravados no anúncio junto com o código — para a próxima abertura não reconsultar.

## O que NÃO muda
- Releitura do anúncio no banco ao abrir (etapa 2) continua, pois protege contra cache desatualizado de outros campos (título, descrição, preço, frete). É barata e local.
- Nenhuma mudança em UI/UX além da ausência do flicker. Layout, textos, botões e fluxo do wizard permanecem idênticos.
- Nenhuma alteração em regras de negócio, validações de cadastro, motor de atributos ou publicação.

## Resultado final
- Abertura do diálogo em rascunho: caminho completo da categoria aparece **instantaneamente**.
- Chamadas à API do ML para resolver categoria: caem para **zero** no caso comum (anúncio já tem nome/caminho salvos).
- Anúncios legados: resolvem **uma única vez** e ficam permanentemente rápidos.
- Sem impacto em outros fluxos, sem regressão visual, sem custo de processamento extra.

## Validação técnica (antes de declarar concluído)
- Abrir um anúncio rascunho recém-salvo: caminho completo aparece sem delay.
- Abrir um anúncio legado antigo: aparece o código por uma fração, resolve, salva. Reabrir: instantâneo.
- Trocar categoria manualmente: nova consulta acontece, novo nome/caminho gravados.
- Conferir nos registros do banco que os 3 campos (código, nome, caminho) ficam coerentes após cada operação.

## Documentação
Atualizar a especificação do Mercado Livre (Layer 3) registrando: persistência de nome+caminho de categoria, política de reconsulta sob demanda e tratamento incremental de anúncios legados.

## Bloco técnico (opcional, para referência)
- Tabela `meli_listings`: adicionar `category_name text` e `category_path_text text` (ou `category_path jsonb` com array de breadcrumbs — decisão técnica a definir na implementação, priorizando simplicidade).
- `MeliListingWizard` / componente de categoria: ler `category_name`/`category_path_text` direto do registro; só disparar `meli-search-categories` em ausência ou em troca explícita.
- Ao confirmar seleção em qualquer busca de categoria, persistir os três campos no mesmo update.
- Sem migração em massa; backfill lazy on-open.

Confirma que sigo com essa execução?
