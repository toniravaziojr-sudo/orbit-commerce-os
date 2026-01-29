
# Plano Revisado: Unificar Builder com Preview (Abordagem Anti-Regressão)

## ✅ IMPLEMENTADO (v2 - WYSIWYG Real)

### Mudanças Realizadas

#### 1. `useBuilderThemeInjector.ts`
- ✅ Removidas todas as referências a `.builder-preview-canvas` (classe inexistente)
- ✅ Focado apenas em `.storefront-container` que é a classe real do canvas
- ✅ CSS usa `!important` para sobrescrever Tailwind
- ✅ Estilos de hover aplicados corretamente

#### 2. `BlockRenderer.tsx` - REFATORAÇÃO WYSIWYG
- ✅ **Arquitetura WYSIWYG Real**: Substituído `onClick` por `onMouseDown`
  - `onClick` capturava o evento após bubble, interferindo com hovers
  - `onMouseDown` captura antes, permitindo CSS :hover funcionar normalmente
- ✅ **Overlay não-intrusivo**: Hover visual usa `div` separado com `pointer-events: none`
  - O ring de hover NÃO está mais no wrapper principal
  - É um elemento filho invisível que aparece via `group-hover`
- ✅ **Label de seleção** agora tem `pointer-events-none` para não interferir

#### 3. Remoção de `hover:bg-transparent` (CRÍTICO)
- ✅ `ProductCTAs.tsx` - Botões "Comprar agora" e "Adicionar ao carrinho"
- ✅ `CartSummary.tsx` - Botões de finalizar compra
- ✅ `CheckoutStepWizard.tsx` - Botões de navegação e pagamento
- ✅ `PaymentResult.tsx` - Botão de visualizar boleto

#### 4. `PropsEditor.tsx` - System Blocks
- ✅ Adicionado `Page` à lista de SYSTEM_BLOCKS
- ✅ Blocos de sistema agora mostram apenas redirecionamento para Configurações do Tema

### Comportamento Atual

| Ação | Resultado |
|------|-----------|
| Hover em botão "Comprar Agora" | ✅ Cor de hover do tema aparece (WYSIWYG) |
| Clicar em botão em modo edição | ✅ Seleciona o bloco, NÃO executa ação |
| Hover de bloco em modo edição | ✅ Ring via overlay (não bloqueia filhos) |
| Seleção de bloco | ✅ Ring azul com offset |
| Selecionar bloco de sistema | ✅ Mostra redirecionamento, não propriedades |

### Arquitetura Final WYSIWYG

```
┌─────────────────────────────────────────┐
│ .storefront-container (canvas)          │
│  ├── Theme CSS injetado (hovers)        │
│  └── Block Wrapper (onMouseDown)        │
│       ├── Hover Overlay (pointer:none)  │
│       └── Block Content                 │
│            └── Botões/Links             │
│                 └── :hover FUNCIONA!    │
└─────────────────────────────────────────┘
```

O builder agora é um "preview em tempo real" - os estados de hover do tema funcionam durante a edição.

### Problema Resolvido: onClick vs onMouseDown

O problema principal era que `onClick` no wrapper do bloco interferia com o bubble de eventos CSS:

**Antes:**
```tsx
<div onClick={handleClick}>  // ❌ onClick captura após bubble, bloqueia :hover
  <Button className="sf-btn-primary">
```

**Depois:**
```tsx
<div onMouseDown={handleMouseDown}>  // ✅ onMouseDown captura antes, :hover funciona
  <div className="pointer-events-none group-hover:opacity-100">  // ✅ Overlay visual separado
  <Button className="sf-btn-primary">  // ✅ Recebe :hover normalmente
```
