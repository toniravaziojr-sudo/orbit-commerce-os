## Como funciona hoje

1. Ao abrir o diálogo a primeira vez, o sistema sugere uma categoria automática para cada produto e o motor de características roda para essa categoria. O resultado é salvo no anúncio junto com o código da categoria.
2. Quando o lojista troca a categoria manualmente no seletor, o sistema atualiza o **código da categoria** no anúncio, mas **não limpa as características antigas** que ficaram salvas da categoria anterior.
3. Na próxima abertura do painel, a lógica de hidratação verifica: "a categoria salva é a mesma da atual? Sim. Tem características salvas? Sim. Então pula o motor e mostra o que está salvo." Resultado: **mostra as características da categoria antiga**, e campos que existem só na nova categoria (como "Ingredientes Ativos") nunca aparecem, enquanto campos que só existiam na antiga (como "Tipo de Tratamento") continuam aparecendo.

## O problema

Trocar a categoria manualmente persiste só o código novo, sem invalidar as características anteriores. O painel acredita que está tudo coerente e nunca pede nova resolução para a categoria escolhida pelo lojista. Mesmo "escolhendo a mesma categoria de antes", se em algum momento a auto-categorização original ficou diferente da escolha manual, o anúncio fica preso ao primeiro conjunto resolvido.

Há ainda um caso espelho: o botão **"Aplicar categoria a todos"** também atualiza só o código da categoria nos demais anúncios, sem invalidar as características que cada um tinha antes.

## O que eu faria

Ajuste pontual, sem mudar UX nem fluxo:

1. **Toda vez que a categoria de um anúncio mudar** (manualmente ou via "Aplicar a todos"), a persistência também **zera as características salvas** desse anúncio. Resultado: na próxima abertura do painel, o motor roda novamente para a categoria correta — uma única vez — e o conteúdo passa a refletir exatamente o que o Mercado Livre define para a categoria escolhida pelo lojista.

2. **Limpeza do estado em memória do item** logo após a troca, para evitar "piscar" o conjunto antigo enquanto o painel está sendo reaberto.

3. **Reforço de coerência na leitura:** a regra de hidratação rápida ("só aproveita o cache se o código da categoria salva for igual ao atual") já existe. Com o cache zerado na troca, ela passa a ser efetiva — hoje os dois ficam iguais artificialmente após a troca manual e por isso ela nunca dispara.

4. **Anti-regressão:** registrar nas regras do módulo Mercado Livre que **trocar categoria = invalidar características anteriores**. Assim qualquer evolução futura (troca via API, troca em massa, importador) respeita a mesma regra.

## Resultado final

- Trocar a categoria no diálogo, manualmente ou via "Aplicar a todos", sempre dispara nova resolução das características para a categoria escolhida.
- Campos da nova categoria aparecem (ex.: "Ingredientes Ativos"), campos da categoria anterior somem (ex.: "Tipo de Tratamento") — o painel passa a ser fiel ao que o ML define para aquela categoria.
- Reabrir o diálogo continua instantâneo se nada mudou (o cache continua valendo), só perde o atalho quando há razão real (categoria diferente).
- A memória de ajustes manuais por produto continua valendo: o que o lojista já editou em outras categorias continua aprendido e é reaplicado pelo motor quando o nome da característica casa.
- Custo de IA: igual ou menor (para de exibir o conjunto errado, evita o lojista pedir "Recalcular" como contorno).

## Detalhes técnicos

- `src/components/marketplaces/MeliListingCreator.tsx`, funções `handleCategoryChange` e `handleApplyCategoryToAll`: incluir `attributes: null` no `update` em `meli_listings`. Também limpar o estado local do item para evitar flicker.
- `src/components/marketplaces/MeliAttributesPanel.tsx`, `loadSavedOrResolve`: nenhuma mudança lógica — com o cache zerado a função cai naturalmente no caminho do resolver.
- Doc: `docs/especificacoes/marketplaces/mercado-livre.md` — adicionar nota "Troca de categoria invalida características" na seção de Idempotência.
- Memória: `.lovable/memory/constraints/ml-cadastro-fonte-unica.md` — adicionar bullet "Toda troca de categoria zera o cache de características do anúncio".

## Pendência

Confirma que posso ajustar?