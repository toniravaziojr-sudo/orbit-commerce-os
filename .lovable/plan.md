
# Plano Revisado: Unificar Builder com Preview (Abordagem Anti-Regressão)

## ✅ IMPLEMENTADO

### Mudanças Realizadas

#### 1. `useBuilderThemeInjector.ts`
- ✅ Removidas todas as referências a `.builder-preview-canvas` (classe inexistente)
- ✅ Focado apenas em `.storefront-container` que é a classe real do canvas
- ✅ CSS usa `!important` para sobrescrever Tailwind
- ✅ Estilos de hover aplicados corretamente

#### 2. `BlockRenderer.tsx`
- ✅ Substituído `hover:outline` por sistema não-intrusivo de seleção
- ✅ Hover agora usa `ring-1` sutil que NÃO bloqueia eventos dos filhos
- ✅ Seleção usa `ring-2` com `ring-offset-2` para destaque claro
- ✅ Interceptação de cliques: `button` e `a[href]` em modo edição são interceptados (preventDefault + stopPropagation) mas ainda selecionam o bloco

#### 3. Remoção de `hover:bg-transparent` (CRÍTICO)
- ✅ `ProductCTAs.tsx` - Botões "Comprar agora" e "Adicionar ao carrinho"
- ✅ `CartSummary.tsx` - Botões de finalizar compra
- ✅ `CheckoutStepWizard.tsx` - Botões de navegação e pagamento
- ✅ `PaymentResult.tsx` - Botão de visualizar boleto

#### 4. `PropsEditor.tsx` - System Blocks
- ✅ Adicionado `Page` à lista de SYSTEM_BLOCKS
- ✅ Blocos de sistema (Page, Header, Footer, ProductDetails, etc.) agora mostram apenas redirecionamento para Configurações do Tema
- ✅ Nenhuma propriedade "ultrapassada" é exibida para blocos de sistema

### Comportamento Atual

| Ação | Resultado |
|------|-----------|
| Hover em botão "Comprar Agora" | ✅ Cor de hover do tema aparece |
| Clicar em botão em modo edição | ✅ Seleciona o bloco, NÃO executa ação |
| Clicar em botão em modo "Testar" | ✅ Executa ação normalmente |
| Hover de bloco em modo edição | ✅ Ring sutil (não bloqueia filhos) |
| Seleção de bloco | ✅ Ring azul com offset |
| Selecionar bloco de sistema (Page, ProductDetails) | ✅ Mostra redirecionamento, não propriedades |

### Arquitetura Final

```
┌─────────────────────────────────────────┐
│ .storefront-container (canvas)          │
│  ├── Theme CSS injetado (hovers)        │
│  └── Blocks com ring não-intrusivo      │
│       └── Botões/Links recebem :hover   │
│            (sem hover:bg-transparent!)  │
└─────────────────────────────────────────┘
```

O builder agora é um "preview em tempo real" - não há mais necessidade de alternar para modo Preview para ver os estilos corretos.

### Problema Resolvido: hover:bg-transparent

O problema principal era que `hover:bg-transparent` nos botões sobrescrevia o CSS injetado pelo tema:

**Antes:**
```tsx
<Button className="sf-btn-primary hover:bg-transparent">  // ❌ hover:bg-transparent sobrescreve tema
```

**Depois:**
```tsx
<Button className="sf-btn-primary">  // ✅ Apenas sf-btn-primary, tema controla hover
```

O CSS injetado pelo `useBuilderThemeInjector.ts` agora funciona corretamente:
```css
.storefront-container button.sf-btn-primary:hover {
  background-color: var(--theme-button-primary-hover) !important;
}
```
