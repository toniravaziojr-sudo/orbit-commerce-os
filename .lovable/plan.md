## Como funciona hoje
No resolvedor de atributos do Mercado Livre, o contexto do produto enviado à IA contém apenas `descricao_longa` truncada em 1500 caracteres. Não existe um campo dedicado de "ingredientes/ativos/componentes". Resultado: quando a IA precisa responder atributos multi-valor como `ACTIVE_INGREDIENTS` (lista fechada de 13 valores oficiais do ML: Aloe vera, Cafeína, Pantenol, Queratina, Proteína, Karité etc.), ela acaba escolhendo apenas um ingrediente óbvio ("Aloe vera") e ignora os demais que estão na descrição (Cafeína, Proteína etc.).

## O problema
1. A descrição é jogada inteira no prompt, sem destacar a seção de ingredientes/ativos.
2. A IA não recebe orientação explícita de varrer toda a lista da descrição e cruzar com a lista oficial do ML.
3. Não há diferenciação por tipo de produto — em cosméticos chama-se "ingredientes/ativos", em eletrônicos "componentes", em suplementos "compostos". A IA precisa saber qual rótulo é o correto antes de extrair.

## O que eu faria

### 1. Extração estruturada na origem (loader)
No fluxo do resolver, antes de montar o `productContext`, extrair da descrição (longa + curta + ficha técnica) as seções rotuladas como **Ingredientes / Ingredientes ativos / Ativos / Composição / Fórmula / Componentes / Compostos / Tecnologia**. Heurística simples por regex de cabeçalho/linha (sem custo de IA): captura o bloco entre o rótulo e o próximo cabeçalho/parágrafo.

Resultado vira um array bruto `ingredientes_extraidos_texto: string[]` (ex.: `["Cafeína", "Aloe vera", "Alecrim", "Mentol", "Cetoconazol", "BPantol", "BIOEX", "Proteção UV"]`). Se nada for capturado, manda `null` — sem invenção.

### 2. Rótulo correto por tipo de produto
Anexar ao contexto um campo `rotulo_de_substancias` derivado de `universal_category_id` / `ai_product_type`:
- cosmético / capilar / pele → "ingredientes ativos"
- suplemento / alimento → "compostos / nutrientes"
- eletrônico / equipamento → "componentes / materiais"
- default → "componentes"

Isso vai junto no contexto para a IA usar a palavra certa nos campos descritivos e não confundir naturezas.

### 3. Regra explícita no prompt para atributos de lista fechada multi-valor
Adicionar bloco de regra dedicado para `ACTIVE_INGREDIENTS`, `INGREDIENTS`, `MATERIALS`, `COMPONENTS` (e quaisquer atributos cujo nome contenha "ingrediente", "ativo", "composição", "componente", "material"):
- Quando `multi=true` e há lista fechada `values`, **cruzar TODOS os itens de `ingredientes_extraidos_texto` com a lista oficial** usando normalização (case-insensitive, sem acento, sem espaço extra; tratar sinônimos óbvios como "AloeVera"→"Aloe vera", "B5"→"Pantenol", "Vit E"→"Vitamina E").
- Devolver **todos** os que casarem, separados por vírgula.
- Ingredientes que não estão na lista oficial do ML são **ignorados** (não inventar opção fora da lista — já é regra v2.0.0).

### 4. Memória manual continua precedendo
Se o usuário já editou manualmente `ACTIVE_INGREDIENTS` para esse produto (v2.1.0 — `meli_product_attribute_memory`), ela continua tendo prioridade absoluta. A nova extração só roda quando o atributo está pendente.

### 5. Custo
Zero chamadas extras de IA. Apenas mais ~200 caracteres no prompt já existente (lista de ingredientes extraídos + 1 regra nova). Sem impacto em latência ou tokens significativos.

### 6. Documentação
- Atualizar `.lovable/memory/constraints/meli-resolve-attributes-hardening.md` com nova regra 16 (Extração de ingredientes/componentes).
- Atualizar `docs/especificacoes/marketplaces/mercado-livre.md` com seção "v2.2.0 — Extração de Ingredientes/Componentes da Descrição".

## Resultado final
No produto "Balm Pós-Banho Calvície Zero", o painel passa a sugerir em `Ingredientes Ativos`: **"Aloe vera, Cafeína, Proteína"** (os 3 itens da lista oficial do ML que aparecem na descrição), em vez de só "Aloe vera". Em produtos de outra natureza (eletrônico, suplemento) a mesma lógica funciona usando o rótulo correto, sem confundir ingredientes com componentes.

## Detalhes técnicos
- Arquivo afetado: `supabase/functions/meli-resolve-attributes/index.ts` (sem mudança de schema, sem nova tabela, sem nova edge function).
- Função utilitária nova `extractSubstancesFromDescription(text, productKind)` no mesmo arquivo.
- Mapa `SUBSTANCE_LABEL_BY_KIND` com 4 categorias e default.
- Sem mudança de UI/UX, sem mudança de contrato de negócio.

## Pendências de confirmação
Nenhuma — escopo já confirmado pela sua mensagem (extrair ingredientes via IA, garantindo que o sistema saiba o tipo correto de substância por categoria de produto). Mudanças são só técnicas, sem alterar UI.

Confirma que eu sigo com o ajuste?
