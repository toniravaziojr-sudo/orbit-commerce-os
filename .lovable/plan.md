

## Otimizar Grid de Produtos no Mobile

### Problema Identificado

Na imagem, os cards de produto em grid 2 colunas no mobile mostram:
- Nomes de produtos truncados ("Shampoo Calvície Zero...")
- Preços muito próximos das bordas
- Botões apertados sem respiro visual
- Padding interno excessivo para telas pequenas

### Causa

1. **Container**: `px-4` (16px cada lado) + `gap: 1rem` (16px) = 48px consumidos em largura fixa
2. **Cards**: `p-3` (12px) interno em todas as variantes — muito para mobile em grid 2-col
3. **Textos**: `text-sm` (14px) para preço e nome — grande demais para o espaço disponível em 2 colunas
4. **Botões**: `py-1.5 px-3` — padding horizontal desnecessário em botões full-width

### Alterações

#### 1. `src/index.css` — Reduzir gap do grid mobile
- Mobile (`max-width: 639px`): gap de `1rem` (16px) para `0.5rem` (8px)

#### 2. `src/components/builder/blocks/shared/ProductCard.tsx` — Otimizar padding e tipografia mobile
- **Todas as variantes (default, compact, minimal)**:
  - Padding interno: `p-3` → `p-2 sm:p-3` (8px no mobile, 12px em telas maiores)
  - Nome do produto: `text-sm` → `text-xs sm:text-sm`
  - Preço: `text-sm` → `text-xs sm:text-sm`
  - Preço riscado: manter `text-xs` mas adicionar `text-[10px] sm:text-xs`
  - Botões: `py-1.5 px-3` → `py-1 px-1.5 sm:py-1.5 sm:px-3` e `text-xs` → `text-[11px]`
  - Gap entre botões: `gap-1.5` → `gap-1 sm:gap-1.5`

#### 3. `src/components/builder/blocks/CategoryPageLayout.tsx` — Reduzir padding horizontal mobile
- Container: `px-4` → `px-2 sm:px-4`

#### 4. `src/components/builder/blocks/CollectionSectionBlock.tsx` — Mesma redução de gap
- Grid mobile: `gap-4` → `gap-2 sm:gap-4`

#### 5. `src/components/builder/blocks/interactive/PersonalizedProductsBlock.tsx` — Consistência
- Grid: `gap-4 sm:gap-6` → `gap-2 sm:gap-4 lg:gap-6`

### Resultado Esperado

- Mais espaço para conteúdo dentro dos cards (nomes menos truncados, preços legíveis)
- Respiro visual adequado sem desperdício de pixels em telas pequenas
- Botões proporcionais ao espaço disponível
- Consistência entre todos os componentes de grid de produtos

