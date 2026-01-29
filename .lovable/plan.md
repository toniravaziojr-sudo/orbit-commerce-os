
# Plano Revisado: Unificar Builder com Preview (Abordagem Anti-Regressão)

## ✅ IMPLEMENTADO

### Mudanças Realizadas

#### 1. `useBuilderThemeInjector.ts`
- ✅ Removidas todas as referências a `.builder-preview-canvas` (classe inexistente)
- ✅ Focado apenas em `.storefront-container` que é a classe real do canvas
- ✅ Removidos `!important` desnecessários dos estilos de botão
- ✅ CSS simplificado e mais limpo

#### 2. `BlockRenderer.tsx`
- ✅ Substituído `hover:outline` por sistema não-intrusivo de seleção
- ✅ Hover agora usa `ring-1` sutil que NÃO bloqueia eventos dos filhos
- ✅ Seleção usa `ring-2` com `ring-offset-2` para destaque claro
- ✅ Interceptação de cliques: `button` e `a[href]` em modo edição são interceptados (preventDefault + stopPropagation) mas ainda selecionam o bloco

### Comportamento Atual

| Ação | Resultado |
|------|-----------|
| Hover em botão "Comprar Agora" | ✅ Cor de hover do tema aparece |
| Clicar em botão em modo edição | ✅ Seleciona o bloco, NÃO executa ação |
| Clicar em botão em modo "Testar" | ✅ Executa ação normalmente |
| Hover de bloco em modo edição | ✅ Ring sutil (não bloqueia filhos) |
| Seleção de bloco | ✅ Ring azul com offset |

### Arquitetura Final

```
┌─────────────────────────────────────────┐
│ .storefront-container (canvas)          │
│  ├── Theme CSS injetado (hovers)        │
│  └── Blocks com ring não-intrusivo      │
│       └── Botões/Links recebem :hover   │
└─────────────────────────────────────────┘
```

O builder agora é um "preview em tempo real" - não há mais necessidade de alternar para modo Preview para ver os estilos corretos.
